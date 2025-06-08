const Logger = require('./Logger');

class AmountParser {
    constructor() {
        this.logger = new Logger();
    }

    /**
     * Parse Indonesian currency expressions to numeric amounts
     * Handles various formats: 10K, 1.5jt, 25rb, 150ribu, etc.
     * 
     * @param {string} text - Text containing amount expression
     * @returns {object} - {success: boolean, amount: number, details: string, confidence: number}
     */
    parseAmount(text) {
        if (!text || typeof text !== 'string') {
            return { success: false, amount: 0, details: 'Invalid input', confidence: 0 };
        }

        const originalText = text.trim();
        const lowerText = originalText.toLowerCase();

        // Define parsing patterns with their multipliers
        const patterns = [
            // Juta patterns
            { regex: /(\d+(?:[.,]\d+)?)\s*(?:jt|juta)/gi, multiplier: 1000000, suffix: 'juta' },
            
            // Ribu patterns
            { regex: /(\d+(?:[.,]\d+)?)\s*[kK]/g, multiplier: 1000, suffix: 'K' },
            { regex: /(\d+(?:[.,]\d+)?)\s*(?:rb|ribu)/gi, multiplier: 1000, suffix: 'ribu' },
            { regex: /(\d+(?:[.,]\d+)?)\s*ribuan/gi, multiplier: 1000, suffix: 'ribuan' },
            
            // Plain numbers (should be last to avoid false matches)
            { regex: /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g, multiplier: 1, suffix: 'plain' }
        ];

        let bestMatch = null;
        let highestConfidence = 0;

        for (const pattern of patterns) {
            const matches = [...text.matchAll(pattern.regex)];
            
            for (const match of matches) {
                try {
                    // Clean the number string
                    let numStr = match[1];
                    
                    // Handle Indonesian decimal separators
                    // In Indonesian: 1.500.000 (thousands separator) vs 1,5 (decimal)
                    if (pattern.suffix === 'plain') {
                        // For plain numbers, assume dots/commas are thousand separators if more than 2 digits after
                        if (numStr.includes('.') && numStr.split('.').length > 2) {
                            // Multiple dots = thousand separators (1.500.000)
                            numStr = numStr.replace(/\./g, '');
                        } else if (numStr.includes(',') && numStr.split(',').length > 2) {
                            // Multiple commas = thousand separators (1,500,000)
                            numStr = numStr.replace(/,/g, '');
                        } else if (numStr.includes('.') && numStr.split('.')[1].length <= 2) {
                            // Single dot with <=2 digits = decimal (1.5)
                            numStr = numStr.replace('.', '.');
                        } else if (numStr.includes(',') && numStr.split(',')[1].length <= 2) {
                            // Single comma with <=2 digits = decimal (1,5)
                            numStr = numStr.replace(',', '.');
                        }
                    } else {
                        // For suffixed numbers (K, jt, rb), dots/commas are decimals
                        numStr = numStr.replace(',', '.');
                    }

                    const baseNumber = parseFloat(numStr);
                    if (isNaN(baseNumber) || baseNumber <= 0) continue;

                    const finalAmount = Math.round(baseNumber * pattern.multiplier);
                    
                    // Calculate confidence based on pattern specificity and context
                    let confidence = 0.7; // Base confidence
                    
                    // Higher confidence for explicit suffixes
                    if (pattern.suffix === 'K' || pattern.suffix === 'juta' || pattern.suffix === 'ribu') {
                        confidence += 0.2;
                    }
                    
                    // Lower confidence for plain numbers in ambiguous contexts
                    if (pattern.suffix === 'plain' && finalAmount < 1000) {
                        confidence -= 0.3;
                    }
                    
                    // Bonus confidence for reasonable amounts
                    if (finalAmount >= 1000 && finalAmount <= 100000000) {
                        confidence += 0.1;
                    }

                    confidence = Math.min(0.95, Math.max(0.1, confidence));

                    if (confidence > highestConfidence) {
                        highestConfidence = confidence;
                        bestMatch = {
                            amount: finalAmount,
                            originalMatch: match[0],
                            baseNumber: baseNumber,
                            multiplier: pattern.multiplier,
                            suffix: pattern.suffix,
                            confidence: confidence
                        };
                    }

                } catch (error) {
                    this.logger.warn('Error parsing amount:', error.message);
                    continue;
                }
            }
        }

        if (bestMatch) {
            const details = this.generateParsingDetails(bestMatch);
            return {
                success: true,
                amount: bestMatch.amount,
                details: details,
                confidence: bestMatch.confidence,
                parsedFrom: bestMatch.originalMatch
            };
        }

        return {
            success: false,
            amount: 0,
            details: 'Tidak dapat mendeteksi nominal dalam teks',
            confidence: 0
        };
    }

    /**
     * Generate human-readable parsing details
     */
    generateParsingDetails(match) {
        const { baseNumber, multiplier, suffix, amount } = match;
        
        if (suffix === 'K') {
            return `${baseNumber}K = ${amount.toLocaleString('id-ID')}`;
        } else if (suffix === 'juta') {
            return `${baseNumber}jt = ${amount.toLocaleString('id-ID')}`;
        } else if (suffix === 'ribu' || suffix === 'ribuan') {
            return `${baseNumber}${suffix} = ${amount.toLocaleString('id-ID')}`;
        } else {
            return `${baseNumber} = ${amount.toLocaleString('id-ID')}`;
        }
    }

    /**
     * Validate if parsed amount is reasonable for Indonesian context
     */
    validateAmount(amount, context = 'general') {
        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return { valid: false, reason: 'Invalid amount' };
        }

        // Context-specific validation
        const limits = {
            general: { min: 100, max: 1000000000 }, // 100 rupiah to 1 billion
            transaction: { min: 500, max: 100000000 }, // 500 rupiah to 100 million
            debt: { min: 1000, max: 500000000 }, // 1K to 500 million
            salary: { min: 1000000, max: 100000000 } // 1 million to 100 million
        };

        const limit = limits[context] || limits.general;

        if (amount < limit.min) {
            return {
                valid: false,
                reason: `Amount too small for ${context} (minimum: Rp ${limit.min.toLocaleString('id-ID')})`
            };
        }

        if (amount > limit.max) {
            return {
                valid: false,
                reason: `Amount too large for ${context} (maximum: Rp ${limit.max.toLocaleString('id-ID')})`
            };
        }

        return { valid: true, reason: 'Amount is valid' };
    }

    /**
     * Parse multiple amounts from text (for bulk transactions)
     */
    parseMultipleAmounts(text) {
        if (!text || typeof text !== 'string') {
            return { success: false, amounts: [], details: 'Invalid input' };
        }

        const lines = text.split(/\n|;|,(?=\s*[A-Za-z])/); // Split by line breaks or semicolons
        const results = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.length === 0) continue;

            const parseResult = this.parseAmount(line);
            if (parseResult.success && parseResult.confidence >= 0.6) {
                results.push({
                    lineNumber: i + 1,
                    originalText: line,
                    ...parseResult
                });
            }
        }

        return {
            success: results.length > 0,
            amounts: results,
            totalFound: results.length,
            details: `Found ${results.length} valid amounts`
        };
    }

    /**
     * Format amount to Indonesian currency string
     */
    formatToIDR(amount) {
        if (!amount || typeof amount !== 'number') return 'Rp 0';
        
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }

    /**
     * Test the parser with common Indonesian expressions
     */
    runTests() {
        const testCases = [
            { input: '10K', expected: 10000 },
            { input: '40K', expected: 40000 },
            { input: '150K', expected: 150000 },
            { input: '1.5jt', expected: 1500000 },
            { input: '2,5 juta', expected: 2500000 },
            { input: '25rb', expected: 25000 },
            { input: '500ribu', expected: 500000 },
            { input: '10 ribuan', expected: 10000 },
            { input: '1.500.000', expected: 1500000 },
            { input: 'habis 50K untuk makan', expected: 50000 },
            { input: 'bayar parkir 2k', expected: 2000 }
        ];

        this.logger.info('Running AmountParser tests...');
        let passed = 0;
        let failed = 0;

        testCases.forEach((test, index) => {
            const result = this.parseAmount(test.input);
            const success = result.success && result.amount === test.expected;
            
            if (success) {
                passed++;
                this.logger.info(`✓ Test ${index + 1}: "${test.input}" -> ${result.amount} (${result.details})`);
            } else {
                failed++;
                this.logger.error(`✗ Test ${index + 1}: "${test.input}" -> Expected: ${test.expected}, Got: ${result.amount}`);
            }
        });

        this.logger.info(`Tests completed: ${passed} passed, ${failed} failed`);
        return { passed, failed, total: testCases.length };
    }
}

module.exports = AmountParser;