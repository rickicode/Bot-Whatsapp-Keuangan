const Logger = require('./Logger');
const AmountParser = require('./AmountParser');

class AIPromptTester {
    constructor(aiService) {
        this.ai = aiService;
        this.logger = new Logger();
        this.amountParser = new AmountParser();
    }

    /**
     * Test transaction parsing with various Indonesian expressions
     */
    async testTransactionParsing() {
        const testCases = [
            // Basic transactions
            { input: "Habis 10K beli nasi goreng", expectedAmount: 10000, expectedType: "expense" },
            { input: "Bayar parkir 2K", expectedAmount: 2000, expectedType: "expense" },
            { input: "Beli bensin 50K", expectedAmount: 50000, expectedType: "expense" },
            { input: "Dapat uang 1.5jt dari freelance", expectedAmount: 1500000, expectedType: "income" },
            
            // Problematic cases that need fixing
            { input: "Jajan 40K", expectedAmount: 40000, expectedType: "expense" },
            { input: "Terima gaji 3.5jt", expectedAmount: 3500000, expectedType: "income" },
            { input: "Belanja sayuran 25rb", expectedAmount: 25000, expectedType: "expense" },
            { input: "Cicilan motor 500K", expectedAmount: 500000, expectedType: "expense" },
            
            // Complex cases
            { input: "Habis belanja groceries 150K di supermarket", expectedAmount: 150000, expectedType: "expense" },
            { input: "Dapat bonus lebaran 2.5juta dari kantor", expectedAmount: 2500000, expectedType: "income" },
            { input: "Bayar listrik bulan ini 125ribu", expectedAmount: 125000, expectedType: "expense" },
        ];

        this.logger.info('🧪 Testing AI Transaction Parsing...');
        let passed = 0;
        let failed = 0;
        let errors = [];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            try {
                this.logger.info(`\n📝 Test ${i + 1}: "${testCase.input}"`);
                
                const result = await this.ai.parseNaturalLanguageTransaction(testCase.input, 'test_user');
                
                if (!result) {
                    failed++;
                    errors.push(`Test ${i + 1}: No result returned`);
                    this.logger.error(`❌ No result returned`);
                    continue;
                }

                let testPassed = true;
                let issues = [];

                // Check amount
                if (result.amount !== testCase.expectedAmount) {
                    testPassed = false;
                    issues.push(`Amount: expected ${testCase.expectedAmount}, got ${result.amount}`);
                }

                // Check type
                if (result.type !== testCase.expectedType) {
                    testPassed = false;
                    issues.push(`Type: expected ${testCase.expectedType}, got ${result.type}`);
                }

                // Check confidence
                if (result.confidence < 0.7) {
                    issues.push(`Low confidence: ${result.confidence}`);
                }

                if (testPassed) {
                    passed++;
                    this.logger.info(`✅ PASSED`);
                    this.logger.info(`   Amount: ${result.amount} (${result.amountDetails || 'no details'})`);
                    this.logger.info(`   Type: ${result.type}`);
                    this.logger.info(`   Description: ${result.description}`);
                    this.logger.info(`   Category: ${result.category}`);
                    this.logger.info(`   Confidence: ${result.confidence}`);
                } else {
                    failed++;
                    errors.push(`Test ${i + 1}: ${issues.join(', ')}`);
                    this.logger.error(`❌ FAILED: ${issues.join(', ')}`);
                    this.logger.error(`   Got: amount=${result.amount}, type=${result.type}, confidence=${result.confidence}`);
                }

            } catch (error) {
                failed++;
                errors.push(`Test ${i + 1}: Error - ${error.message}`);
                this.logger.error(`❌ ERROR: ${error.message}`);
            }
        }

        this.logger.info(`\n📊 Transaction Parsing Test Results:`);
        this.logger.info(`✅ Passed: ${passed}/${testCases.length}`);
        this.logger.info(`❌ Failed: ${failed}/${testCases.length}`);
        this.logger.info(`📈 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

        if (errors.length > 0) {
            this.logger.info(`\n🚨 Errors:`);
            errors.forEach(error => this.logger.info(`   - ${error}`));
        }

        return {
            passed,
            failed,
            total: testCases.length,
            successRate: (passed / testCases.length) * 100,
            errors
        };
    }

    /**
     * Test debt/receivable parsing
     */
    async testDebtReceivableParsing(debtService) {
        const testCases = [
            { input: "Piutang Andre beli minyak goreng 40K", expectedAmount: 40000, expectedType: "PIUTANG", expectedClient: "Andre" },
            { input: "Hutang ke Toko Budi sembako 150K", expectedAmount: 150000, expectedType: "HUTANG", expectedClient: "Toko Budi" },
            { input: "Piutang Warung Sari mie ayam 25rb", expectedAmount: 25000, expectedType: "PIUTANG", expectedClient: "Warung Sari" },
            { input: "Belum bayar ke Pak Andi bensin 100K", expectedAmount: 100000, expectedType: "HUTANG", expectedClient: "Pak Andi" },
            { input: "Sarah hutang beli baju 250K", expectedAmount: 250000, expectedType: "PIUTANG", expectedClient: "Sarah" },
        ];

        this.logger.info('\n🧪 Testing Debt/Receivable Parsing...');
        let passed = 0;
        let failed = 0;
        let errors = [];

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];
            try {
                this.logger.info(`\n📝 Test ${i + 1}: "${testCase.input}"`);
                
                const result = await debtService.parseDebtReceivableInput(testCase.input, 'test_user');
                
                if (!result.success) {
                    failed++;
                    errors.push(`Test ${i + 1}: Parsing failed - ${result.error}`);
                    this.logger.error(`❌ Parsing failed: ${result.error}`);
                    continue;
                }

                let testPassed = true;
                let issues = [];

                // Check amount
                if (result.amount !== testCase.expectedAmount) {
                    testPassed = false;
                    issues.push(`Amount: expected ${testCase.expectedAmount}, got ${result.amount}`);
                }

                // Check type
                if (result.type !== testCase.expectedType) {
                    testPassed = false;
                    issues.push(`Type: expected ${testCase.expectedType}, got ${result.type}`);
                }

                // Check client name (case insensitive)
                if (result.clientName.toLowerCase() !== testCase.expectedClient.toLowerCase()) {
                    testPassed = false;
                    issues.push(`Client: expected ${testCase.expectedClient}, got ${result.clientName}`);
                }

                if (testPassed) {
                    passed++;
                    this.logger.info(`✅ PASSED`);
                    this.logger.info(`   Amount: ${result.amount} (${result.amountDetails || 'no details'})`);
                    this.logger.info(`   Type: ${result.type}`);
                    this.logger.info(`   Client: ${result.clientName}`);
                    this.logger.info(`   Description: ${result.description}`);
                    this.logger.info(`   Confidence: ${result.confidence}`);
                } else {
                    failed++;
                    errors.push(`Test ${i + 1}: ${issues.join(', ')}`);
                    this.logger.error(`❌ FAILED: ${issues.join(', ')}`);
                }

            } catch (error) {
                failed++;
                errors.push(`Test ${i + 1}: Error - ${error.message}`);
                this.logger.error(`❌ ERROR: ${error.message}`);
            }
        }

        this.logger.info(`\n📊 Debt/Receivable Parsing Test Results:`);
        this.logger.info(`✅ Passed: ${passed}/${testCases.length}`);
        this.logger.info(`❌ Failed: ${failed}/${testCases.length}`);
        this.logger.info(`📈 Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);

        return {
            passed,
            failed,
            total: testCases.length,
            successRate: (passed / testCases.length) * 100,
            errors
        };
    }

    /**
     * Test bulk transaction parsing
     */
    async testBulkTransactionParsing() {
        const testInput = `Habis belanja baju albi 33k
Mainan albi 30k
Galon + kopi 20k
Parkir 2k
Permen 2k`;

        const expectedResults = [
            { amount: 33000, description: "baju albi" },
            { amount: 30000, description: "mainan albi" },
            { amount: 20000, description: "galon kopi" },
            { amount: 2000, description: "parkir" },
            { amount: 2000, description: "permen" }
        ];

        this.logger.info('\n🧪 Testing Bulk Transaction Parsing...');
        this.logger.info(`Input:\n${testInput}`);

        try {
            const result = await this.ai.parseBulkTransactions(testInput, 'test_user');
            
            if (!result.transactions || result.transactions.length === 0) {
                this.logger.error('❌ No transactions parsed');
                return { passed: 0, failed: 1, total: 1, successRate: 0 };
            }

            let passed = 0;
            let failed = 0;

            this.logger.info(`\n📊 Parsed ${result.transactions.length} transactions:`);

            result.transactions.forEach((transaction, index) => {
                const expected = expectedResults[index];
                if (expected) {
                    const amountMatch = transaction.amount === expected.amount;
                    const descMatch = transaction.description.toLowerCase().includes(expected.description.toLowerCase());
                    
                    if (amountMatch && descMatch) {
                        passed++;
                        this.logger.info(`✅ Transaction ${index + 1}: ${transaction.amount} - ${transaction.description} (${transaction.amountDetails || 'no details'})`);
                    } else {
                        failed++;
                        this.logger.error(`❌ Transaction ${index + 1}: Expected ${expected.amount} - ${expected.description}, got ${transaction.amount} - ${transaction.description}`);
                    }
                } else {
                    this.logger.info(`ℹ️  Extra transaction ${index + 1}: ${transaction.amount} - ${transaction.description}`);
                }
            });

            this.logger.info(`\n📈 Bulk Parsing Results:`);
            this.logger.info(`✅ Passed: ${passed}/${expectedResults.length}`);
            this.logger.info(`❌ Failed: ${failed}/${expectedResults.length}`);
            this.logger.info(`📊 Overall Confidence: ${result.overallConfidence}`);

            return {
                passed,
                failed,
                total: expectedResults.length,
                successRate: (passed / expectedResults.length) * 100,
                overallConfidence: result.overallConfidence
            };

        } catch (error) {
            this.logger.error(`❌ Bulk parsing error: ${error.message}`);
            return { passed: 0, failed: 1, total: 1, successRate: 0, error: error.message };
        }
    }

    /**
     * Run comprehensive AI tests
     */
    async runAllTests(debtService = null) {
        this.logger.info('🚀 Starting comprehensive AI parsing tests...');
        
        const results = {
            amountParser: null,
            transactionParsing: null,
            debtReceivableParsing: null,
            bulkTransactionParsing: null
        };

        // Test AmountParser
        this.logger.info('\n='.repeat(50));
        results.amountParser = this.amountParser.runTests();

        // Test transaction parsing
        this.logger.info('\n' + '='.repeat(50));
        results.transactionParsing = await this.testTransactionParsing();

        // Test debt/receivable parsing (if service provided)
        if (debtService) {
            this.logger.info('\n' + '='.repeat(50));
            results.debtReceivableParsing = await this.testDebtReceivableParsing(debtService);
        }

        // Test bulk transaction parsing
        this.logger.info('\n' + '='.repeat(50));
        results.bulkTransactionParsing = await this.testBulkTransactionParsing();

        // Overall summary
        this.logger.info('\n' + '='.repeat(50));
        this.logger.info('📋 COMPREHENSIVE TEST SUMMARY');
        this.logger.info('='.repeat(50));

        Object.entries(results).forEach(([testName, result]) => {
            if (result) {
                this.logger.info(`${testName}: ${result.passed}/${result.total} passed (${result.successRate?.toFixed(1) || 'N/A'}%)`);
            }
        });

        return results;
    }

    /**
     * Generate test report
     */
    generateReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: 0,
                totalPassed: 0,
                totalFailed: 0,
                overallSuccessRate: 0
            },
            details: results
        };

        // Calculate totals
        Object.values(results).forEach(result => {
            if (result && result.total) {
                report.summary.totalTests += result.total;
                report.summary.totalPassed += result.passed;
                report.summary.totalFailed += result.failed;
            }
        });

        if (report.summary.totalTests > 0) {
            report.summary.overallSuccessRate = (report.summary.totalPassed / report.summary.totalTests) * 100;
        }

        return report;
    }
}

module.exports = AIPromptTester;