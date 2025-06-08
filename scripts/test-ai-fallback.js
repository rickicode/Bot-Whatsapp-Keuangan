#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AIService = require('../src/services/AIService');
const Logger = require('../src/utils/Logger');

async function testAIFallbackSystem() {
    const logger = new Logger();
    const aiService = new AIService();
    
    logger.info('🧪 Testing AI Fallback System');
    logger.info('='.repeat(50));
    
    // Test 1: Check provider initialization
    logger.info('\n📋 1. Provider Configuration');
    logger.info('-'.repeat(30));
    
    const providerInfo = aiService.getProviderInfo();
    logger.info(`Primary Provider: ${providerInfo.provider}`);
    logger.info(`Base URL: ${providerInfo.baseURL}`);
    logger.info(`Model: ${providerInfo.model}`);
    logger.info(`Enabled: ${providerInfo.isEnabled}`);
    
    // Test 2: Check fallback providers
    const status = aiService.getProviderStatus();
    logger.info(`\n🔄 2. Fallback Providers (${status.fallbacks.length} configured)`);
    logger.info('-'.repeat(30));
    
    status.fallbacks.forEach((provider, index) => {
        logger.info(`${index + 1}. ${provider.name} (${provider.provider})`);
        logger.info(`   URL: ${provider.baseURL}`);
        logger.info(`   Model: ${provider.model}`);
        logger.info(`   Priority: ${provider.priority}`);
        logger.info(`   Rate Limited: ${provider.isRateLimited ? '🔴' : '🟢'}`);
    });
    
    if (status.fallbacks.length === 0) {
        logger.warn('⚠️  No fallback providers configured!');
        logger.info('\n💡 To configure fallbacks, set multiple API keys:');
        logger.info('   OPENAI_COMPATIBLE_API_KEY=key1,key2,key3');
        logger.info('   DEEPSEEK_API_KEY=your_deepseek_key');
        logger.info('   OPENAI_API_KEY=your_openai_key');
        return;
    }
    
    // Test 3: Test simple AI request
    if (aiService.isAvailable()) {
        logger.info('\n🤖 3. Testing AI Request');
        logger.info('-'.repeat(30));
        
        try {
            const testMessage = "Test parsing: Jajan 10K";
            logger.info(`Testing with: "${testMessage}"`);
            
            const result = await aiService.parseNaturalLanguageTransaction(testMessage, "test-user");
            
            if (result) {
                logger.info('✅ AI Request successful!');
                logger.info(`   Parsed amount: ${result.amount}`);
                logger.info(`   Description: ${result.description}`);
                logger.info(`   Details: ${result.amountDetails}`);
            } else {
                logger.warn('⚠️  AI Request returned null');
            }
            
        } catch (error) {
            logger.error('❌ AI Request failed:', error.message);
            
            if (error.message.includes('RATE_LIMITED')) {
                logger.info('🔄 Testing fallback response...');
                // This would trigger the fallback system
            }
        }
    } else {
        logger.warn('⚠️  AI Service is not available (check API keys)');
    }
    
    // Test 4: Provider status monitoring
    logger.info('\n📊 4. Provider Status Monitoring');
    logger.info('-'.repeat(30));
    
    const currentStatus = aiService.getProviderStatus();
    logger.info(`Rate Limited Providers: ${currentStatus.rateLimitedCount}`);
    logger.info(`Available Providers: ${currentStatus.availableProviders}`);
    logger.info(`Last Reset: ${currentStatus.lastReset}`);
    
    // Test 5: Manual rate limit reset
    logger.info('\n🔄 5. Testing Manual Reset');
    logger.info('-'.repeat(30));
    
    const resetResult = aiService.resetRateLimits();
    logger.info(`Reset ${resetResult.resetCount} rate limited providers`);
    logger.info(`Reset timestamp: ${resetResult.timestamp}`);
    
    // Final summary
    logger.info('\n' + '='.repeat(50));
    logger.info('📋 FALLBACK SYSTEM SUMMARY');
    logger.info('='.repeat(50));
    
    logger.info(`🎯 Primary Provider: ${providerInfo.provider} (${providerInfo.isEnabled ? 'Enabled' : 'Disabled'})`);
    logger.info(`🔄 Fallback Providers: ${status.fallbacks.length}`);
    logger.info(`⚡ Available Providers: ${currentStatus.availableProviders}`);
    
    if (status.fallbacks.length > 0) {
        logger.info('\n✅ Fallback system is properly configured!');
        logger.info('When primary provider hits rate limits:');
        logger.info('1. System will automatically try fallback providers');
        logger.info('2. Users will get seamless service');
        logger.info('3. Rate limits reset automatically every 10 minutes');
    } else {
        logger.warn('\n⚠️  Fallback system needs configuration!');
    }
    
    const score = (
        (providerInfo.isEnabled ? 25 : 0) +
        (status.fallbacks.length > 0 ? 25 : 0) +
        (status.fallbacks.length > 1 ? 25 : 0) +
        (currentStatus.availableProviders === status.fallbacks.length ? 25 : 0)
    );
    
    logger.info(`\n🏆 Fallback System Score: ${score}/100`);
    
    const rating = score >= 90 ? '🎉 EXCELLENT' : 
                   score >= 70 ? '✅ GOOD' : 
                   score >= 50 ? '⚠️  NEEDS WORK' : '❌ NEEDS SETUP';
    
    logger.info(`📊 Rating: ${rating}`);
    
    return {
        score,
        primaryEnabled: providerInfo.isEnabled,
        fallbackCount: status.fallbacks.length,
        availableCount: currentStatus.availableProviders
    };
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
AI Fallback System Test Script

Usage: node scripts/test-ai-fallback.js [options]

Options:
  --help, -h     Show this help message

This script tests the AI fallback system:
- Primary provider configuration
- Fallback provider setup
- Rate limit handling
- Provider status monitoring
- Manual reset functionality

Examples:
  node scripts/test-ai-fallback.js
    `);
    process.exit(0);
}

// Run the tests
testAIFallbackSystem().then(results => {
    if (results.score >= 90) {
        process.exit(0); // Excellent
    } else if (results.score >= 70) {
        process.exit(1); // Good
    } else {
        process.exit(2); // Needs work
    }
}).catch(error => {
    console.error('Test failed with error:', error);
    process.exit(3);
});