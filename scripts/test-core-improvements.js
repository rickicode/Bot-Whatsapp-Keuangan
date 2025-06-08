#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AmountParser = require('../src/utils/AmountParser');
const Logger = require('../src/utils/Logger');

async function testCoreImprovements() {
    const logger = new Logger();
    const amountParser = new AmountParser();
    
    logger.info('🎯 Testing Core AI Parsing Improvements');
    logger.info('='.repeat(60));
    
    // Test 1: AmountParser Comprehensive Tests
    logger.info('\n📊 1. AmountParser Comprehensive Tests');
    logger.info('-'.repeat(40));
    
    const testResults = amountParser.runTests();
    
    logger.info(`\n📈 AmountParser Results:`);
    logger.info(`✅ Passed: ${testResults.passed}/${testResults.total}`);
    logger.info(`❌ Failed: ${testResults.failed}/${testResults.total}`);
    logger.info(`📊 Success Rate: ${((testResults.passed/testResults.total)*100).toFixed(1)}%`);
    
    // Test 2: Critical Bug Cases (Previously Failing)
    logger.info('\n🚨 2. Critical Bug Cases (Previously Failing)');
    logger.info('-'.repeat(40));
    
    const criticalCases = [
        { input: 'Jajan 10K', expected: 10000, previouslyGot: 10000000 },
        { input: 'Piutang Andre 40K', expected: 40000, previouslyGot: 200000 },
        { input: 'Dapat gaji 3.5jt', expected: 3500000, previouslyGot: 'variable' },
        { input: 'Bayar parkir 2K', expected: 2000, previouslyGot: 2000000 },
        { input: 'Belanja sembako 150K', expected: 150000, previouslyGot: 'variable' }
    ];
    
    let criticalPassed = 0;
    criticalCases.forEach((test, index) => {
        const result = amountParser.parseAmount(test.input);
        const success = result.success && result.amount === test.expected;
        
        if (success) criticalPassed++;
        
        logger.info(`${success ? '✅' : '❌'} "${test.input}"`);
        logger.info(`   Expected: ${test.expected.toLocaleString('id-ID')}`);
        logger.info(`   Got: ${result.success ? result.amount.toLocaleString('id-ID') : 'FAILED'}`);
        logger.info(`   Details: ${result.details || 'no details'}`);
        if (!success) {
            logger.info(`   Previously got: ${test.previouslyGot.toLocaleString ? test.previouslyGot.toLocaleString('id-ID') : test.previouslyGot}`);
        }
        logger.info('');
    });
    
    // Test 3: Indonesian Format Coverage
    logger.info('\n🇮🇩 3. Indonesian Format Coverage Test');
    logger.info('-'.repeat(40));
    
    const indonesianFormats = [
        { format: 'K suffix', examples: ['10K', '50K', '150K'], multiplier: 1000 },
        { format: 'Juta/jt suffix', examples: ['1jt', '2.5jt', '1,5juta'], multiplier: 1000000 },
        { format: 'Ribu/rb suffix', examples: ['25rb', '500ribu', '10ribuan'], multiplier: 1000 },
        { format: 'Plain numbers', examples: ['1500000', '1.500.000'], multiplier: 1 }
    ];
    
    let formatTests = 0;
    let formatPassed = 0;
    
    indonesianFormats.forEach(formatGroup => {
        logger.info(`\n${formatGroup.format}:`);
        formatGroup.examples.forEach(example => {
            formatTests++;
            const result = amountParser.parseAmount(example);
            const success = result.success && result.confidence >= 0.7;
            
            if (success) formatPassed++;
            
            logger.info(`  ${success ? '✅' : '❌'} "${example}" → ${result.success ? result.amount.toLocaleString('id-ID') : 'FAILED'} (${result.details})`);
        });
    });
    
    // Test 4: Validation System
    logger.info('\n🔒 4. Validation System Test');
    logger.info('-'.repeat(40));
    
    const validationTests = [
        { amount: 1000, context: 'transaction', shouldPass: true },
        { amount: 100, context: 'transaction', shouldPass: false },
        { amount: 1000000000, context: 'transaction', shouldPass: false },
        { amount: 50000, context: 'debt', shouldPass: true },
        { amount: 500, context: 'debt', shouldPass: false }
    ];
    
    let validationPassed = 0;
    validationTests.forEach(test => {
        const validation = amountParser.validateAmount(test.amount, test.context);
        const success = validation.valid === test.shouldPass;
        
        if (success) validationPassed++;
        
        logger.info(`${success ? '✅' : '❌'} Amount: ${test.amount.toLocaleString('id-ID')}, Context: ${test.context}, Valid: ${validation.valid}`);
        if (!validation.valid) {
            logger.info(`   Reason: ${validation.reason}`);
        }
    });
    
    // Test 5: Performance Test
    logger.info('\n⚡ 5. Performance Test');
    logger.info('-'.repeat(40));
    
    const performanceTests = ['10K', 'Jajan 40K beli nasi', 'Piutang Andre minyak goreng 150K', 'Dapat gaji 3.5jt dari freelance'];
    const iterations = 100;
    
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
        performanceTests.forEach(test => {
            amountParser.parseAmount(test);
        });
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / (iterations * performanceTests.length);
    
    logger.info(`Parsed ${iterations * performanceTests.length} amounts in ${totalTime}ms`);
    logger.info(`Average time per parse: ${avgTime.toFixed(2)}ms`);
    logger.info(`Performance: ${avgTime < 5 ? '✅ EXCELLENT' : avgTime < 10 ? '⚠️  GOOD' : '❌ NEEDS IMPROVEMENT'}`);
    
    // Final Summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📋 FINAL IMPROVEMENT SUMMARY');
    logger.info('='.repeat(60));
    
    const overallScore = (
        (testResults.passed / testResults.total) * 25 +
        (criticalPassed / criticalCases.length) * 30 +
        (formatPassed / formatTests) * 25 +
        (validationPassed / validationTests.length) * 10 +
        (avgTime < 5 ? 10 : avgTime < 10 ? 5 : 0)
    );
    
    logger.info(`🎯 Overall Improvement Score: ${overallScore.toFixed(1)}/100`);
    logger.info(`📊 AmountParser Tests: ${testResults.passed}/${testResults.total} (${((testResults.passed/testResults.total)*100).toFixed(1)}%)`);
    logger.info(`🚨 Critical Bug Fixes: ${criticalPassed}/${criticalCases.length} (${((criticalPassed/criticalCases.length)*100).toFixed(1)}%)`);
    logger.info(`🇮🇩 Indonesian Format Coverage: ${formatPassed}/${formatTests} (${((formatPassed/formatTests)*100).toFixed(1)}%)`);
    logger.info(`🔒 Validation System: ${validationPassed}/${validationTests.length} (${((validationPassed/validationTests.length)*100).toFixed(1)}%)`);
    logger.info(`⚡ Performance: ${avgTime.toFixed(2)}ms avg`);
    
    const status = overallScore >= 90 ? '🎉 EXCELLENT' : 
                   overallScore >= 80 ? '✅ GOOD' : 
                   overallScore >= 70 ? '⚠️  NEEDS WORK' : '❌ FAILED';
    
    logger.info(`\n🏆 Status: ${status}`);
    
    if (overallScore >= 90) {
        logger.info('\n🎊 Congratulations! AI parsing improvements are working excellently!');
        logger.info('✅ Critical amount parsing bugs have been fixed');
        logger.info('✅ Indonesian format support is comprehensive');
        logger.info('✅ Validation system is working properly');
        logger.info('✅ Performance is optimal');
    } else if (overallScore >= 80) {
        logger.info('\n✅ Good! AI parsing improvements are working well with minor issues.');
    } else {
        logger.info('\n⚠️  Warning: Some improvements need attention.');
    }
    
    return {
        overallScore,
        amountParserTests: testResults,
        criticalBugFixes: { passed: criticalPassed, total: criticalCases.length },
        formatCoverage: { passed: formatPassed, total: formatTests },
        validation: { passed: validationPassed, total: validationTests.length },
        performance: { avgTime, status: avgTime < 5 ? 'excellent' : avgTime < 10 ? 'good' : 'poor' }
    };
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Core AI Improvements Test Script

Usage: node scripts/test-core-improvements.js [options]

Options:
  --help, -h     Show this help message

This script tests the core AI parsing improvements without requiring API keys:
- AmountParser utility tests
- Critical bug fix verification  
- Indonesian format coverage
- Validation system
- Performance benchmarks

Examples:
  node scripts/test-core-improvements.js
    `);
    process.exit(0);
}

// Run the tests
testCoreImprovements().then(results => {
    if (results.overallScore >= 90) {
        process.exit(0); // Success
    } else if (results.overallScore >= 70) {
        process.exit(1); // Warning
    } else {
        process.exit(2); // Failed
    }
}).catch(error => {
    console.error('Test failed with error:', error);
    process.exit(3);
});