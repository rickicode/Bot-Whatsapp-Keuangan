#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Set up project root and environment
const projectRoot = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });

const AIService = require('../src/services/AIService');
const DebtReceivableService = require('../src/services/DebtReceivableService');
const AIPromptTester = require('../src/utils/AIPromptTester');
const AmountParser = require('../src/utils/AmountParser');
const Logger = require('../src/utils/Logger');

async function runTests() {
    const logger = new Logger();
    
    logger.info('🚀 Starting AI Parsing Improvement Tests');
    logger.info('='.repeat(60));
    
    try {
        // Initialize services
        const aiService = new AIService();
        const debtService = new DebtReceivableService(null, aiService); // Mock database for testing
        const tester = new AIPromptTester(aiService);
        
        // Check if AI service is available
        if (!aiService.isAvailable()) {
            logger.warn('⚠️  AI Service is not available. Please check your configuration.');
            logger.info('Environment variables needed:');
            logger.info('- ENABLE_AI_FEATURES=true');
            logger.info('- AI_PROVIDER (deepseek/openai/openaicompatible)');
            logger.info('- Corresponding API key');
            return;
        }
        
        logger.info(`✅ AI Service initialized with provider: ${aiService.getProviderInfo().provider}`);
        
        // Run comprehensive tests
        const results = await tester.runAllTests(debtService);
        
        // Generate detailed report
        const report = tester.generateReport(results);
        
        // Save report to file
        const reportPath = path.join(projectRoot, 'ai-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        logger.info('\n📊 FINAL SUMMARY');
        logger.info('=' * 40);
        logger.info(`📈 Overall Success Rate: ${report.summary.overallSuccessRate.toFixed(1)}%`);
        logger.info(`✅ Total Passed: ${report.summary.totalPassed}`);
        logger.info(`❌ Total Failed: ${report.summary.totalFailed}`);
        logger.info(`📝 Total Tests: ${report.summary.totalTests}`);
        logger.info(`💾 Report saved to: ${reportPath}`);
        
        // Test specific problematic cases
        logger.info('\n🔍 Testing Specific Problematic Cases');
        logger.info('=' * 40);
        
        const problemCases = [
            "Jajan 10K",
            "Habis 40K beli minyak goreng",
            "Piutang Andre 40K",
            "Bayar parkir 2K"
        ];
        
        for (const testCase of problemCases) {
            logger.info(`\n🧪 Testing: "${testCase}"`);
            
            try {
                // Test with AmountParser directly
                const amountParser = new AmountParser();
                const amountResult = amountParser.parseAmount(testCase);
                logger.info(`   AmountParser: ${amountResult.success ? amountResult.amount + ' (' + amountResult.details + ')' : 'Failed'}`);
                
                // Test with AI Service
                const aiResult = await aiService.parseNaturalLanguageTransaction(testCase, 'test_user');
                logger.info(`   AI Service: ${aiResult ? aiResult.amount + ' (' + (aiResult.amountDetails || 'no details') + ')' : 'Failed'}`);
                
                // Check consistency
                if (amountResult.success && aiResult && amountResult.amount === aiResult.amount) {
                    logger.info(`   ✅ Consistent results`);
                } else {
                    logger.info(`   ⚠️  Inconsistent results`);
                }
                
            } catch (error) {
                logger.error(`   ❌ Error: ${error.message}`);
            }
        }
        
        // Performance test
        logger.info('\n⚡ Performance Test');
        logger.info('=' * 40);
        
        const perfTestCases = [
            "Beli bensin 50K",
            "Dapat gaji 3.5jt",
            "Piutang Toko ABC 150K",
            "Hutang ke Bank 2.5juta"
        ];
        
        const startTime = Date.now();
        
        for (const testCase of perfTestCases) {
            const caseStart = Date.now();
            await aiService.parseNaturalLanguageTransaction(testCase, 'test_user');
            const caseEnd = Date.now();
            logger.info(`   "${testCase}": ${caseEnd - caseStart}ms`);
        }
        
        const endTime = Date.now();
        logger.info(`   Average: ${((endTime - startTime) / perfTestCases.length).toFixed(0)}ms per parse`);
        
        logger.info('\n🎉 Testing completed successfully!');
        
    } catch (error) {
        logger.error('❌ Test failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AI Parsing Test Script

Usage: node scripts/test-ai-parsing.js [options]

Options:
  --help, -h     Show this help message
  
Environment Variables Required:
  ENABLE_AI_FEATURES=true
  AI_PROVIDER=deepseek|openai|openaicompatible
  [PROVIDER]_API_KEY=your_api_key
  [PROVIDER]_BASE_URL=your_base_url (optional)

Examples:
  node scripts/test-ai-parsing.js
    `);
    process.exit(0);
}

// Run the tests
runTests().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});