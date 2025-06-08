#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AIService = require('../src/services/AIService');
const Logger = require('../src/utils/Logger');

async function testOpenRouterIntegration() {
    const logger = new Logger();
    
    logger.info('🌟 Testing OpenRouter Integration');
    logger.info('='.repeat(50));
    
    // Test 1: Check if OpenRouter is configured
    logger.info('\n📋 1. OpenRouter Configuration Check');
    logger.info('-'.repeat(30));
    
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    const openRouterBaseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api';
    const openRouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
    
    logger.info(`OpenRouter API Key: ${hasOpenRouterKey ? '✅ Configured' : '❌ Not Set'}`);
    logger.info(`OpenRouter Base URL: ${openRouterBaseURL}`);
    logger.info(`OpenRouter Model: ${openRouterModel}`);
    
    if (!hasOpenRouterKey) {
        logger.warn('\n⚠️  OpenRouter API Key not configured');
        logger.info('To test OpenRouter integration:');
        logger.info('1. Get an API key from https://openrouter.ai/');
        logger.info('2. Set OPENROUTER_API_KEY in your .env file');
        logger.info('3. Optionally set OPENROUTER_MODEL for your preferred model');
        logger.info('\nExample configuration:');
        logger.info('OPENROUTER_API_KEY=sk-or-your-key-here');
        logger.info('OPENROUTER_MODEL=openai/gpt-3.5-turbo');
        
        // Return early with basic score
        return {
            score: 30, // Base implementation score
            hasApiKey: false,
            isInFallback: false
        };
    }
    
    // Test 2: Test OpenRouter as primary provider
    logger.info('\n🚀 2. Testing OpenRouter as Primary Provider');
    logger.info('-'.repeat(30));
    
    // Temporarily change environment to test OpenRouter
    const originalProvider = process.env.AI_PROVIDER;
    process.env.AI_PROVIDER = 'openrouter';
    
    try {
        const aiService = new AIService();
        
        const providerInfo = aiService.getProviderInfo();
        logger.info(`Provider: ${providerInfo.provider}`);
        logger.info(`Base URL: ${providerInfo.baseURL}`);
        logger.info(`Model: ${providerInfo.model}`);
        logger.info(`Enabled: ${providerInfo.isEnabled}`);
        
        if (aiService.isAvailable()) {
            logger.info('\n🤖 Testing OpenRouter AI Request...');
            const testMessage = "Parse: Beli kopi 15K";
            
            try {
                const result = await aiService.parseNaturalLanguageTransaction(testMessage, "test-user");
                
                if (result) {
                    logger.info('✅ OpenRouter request successful!');
                    logger.info(`   Amount: ${result.amount}`);
                    logger.info(`   Description: ${result.description}`);
                    logger.info(`   Category: ${result.category}`);
                    logger.info(`   Details: ${result.amountDetails}`);
                } else {
                    logger.warn('⚠️  OpenRouter request returned null');
                }
            } catch (error) {
                logger.error('❌ OpenRouter request failed:', error.message);
            }
        } else {
            logger.warn('⚠️  OpenRouter service not available');
        }
        
    } catch (error) {
        logger.error('❌ OpenRouter initialization failed:', error.message);
    } finally {
        // Restore original provider
        process.env.AI_PROVIDER = originalProvider;
    }
    
    // Test 3: Check OpenRouter in fallback system
    logger.info('\n🔄 3. OpenRouter in Fallback System');
    logger.info('-'.repeat(30));
    
    const aiService = new AIService();
    const status = aiService.getProviderStatus();
    
    const openRouterFallback = status.fallbacks.find(p => p.name.includes('openrouter'));
    
    if (openRouterFallback) {
        logger.info('✅ OpenRouter configured as fallback provider');
        logger.info(`   Name: ${openRouterFallback.name}`);
        logger.info(`   Provider: ${openRouterFallback.provider}`);
        logger.info(`   Priority: ${openRouterFallback.priority}`);
        logger.info(`   Rate Limited: ${openRouterFallback.isRateLimited ? '🔴' : '🟢'}`);
    } else {
        logger.info('ℹ️  OpenRouter not in current fallback list');
        logger.info('   (This is normal if primary provider is OpenRouter or API key matches)');
    }
    
    // Test 4: Available OpenRouter models
    logger.info('\n🎯 4. OpenRouter Popular Models');
    logger.info('-'.repeat(30));
    
    const popularModels = [
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
        { id: 'openai/gpt-4', name: 'GPT-4', description: 'Most accurate, higher cost' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and efficient' },
        { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B', description: 'Open source, cost-effective' },
        { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B', description: 'Good balance of speed and quality' }
    ];
    
    popularModels.forEach((model, index) => {
        const current = model.id === openRouterModel ? ' (current)' : '';
        logger.info(`${index + 1}. ${model.name}${current}`);
        logger.info(`   ID: ${model.id}`);
        logger.info(`   Description: ${model.description}`);
    });
    
    // Test 5: Configuration recommendations
    logger.info('\n💡 5. Configuration Recommendations');
    logger.info('-'.repeat(30));
    
    logger.info('For Financial Bot use cases:');
    logger.info('');
    logger.info('🎯 **Recommended Primary Setup:**');
    logger.info('   AI_PROVIDER=openrouter');
    logger.info('   OPENROUTER_MODEL=openai/gpt-3.5-turbo  # Fast & accurate for parsing');
    logger.info('');
    logger.info('🔄 **Recommended Fallback Setup:**');
    logger.info('   Keep current primary + add OpenRouter as fallback');
    logger.info('   OPENROUTER_API_KEY=your-key-here');
    logger.info('');
    logger.info('💰 **Cost-Optimized Setup:**');
    logger.info('   OPENROUTER_MODEL=meta-llama/llama-3-8b-instruct');
    logger.info('');
    logger.info('🚀 **Performance-Optimized Setup:**');
    logger.info('   OPENROUTER_MODEL=anthropic/claude-3-haiku');
    logger.info('');
    logger.info('🎖️ **Accuracy-Optimized Setup:**');
    logger.info('   OPENROUTER_MODEL=openai/gpt-4');
    
    // Final summary
    logger.info('\n' + '='.repeat(50));
    logger.info('📋 OPENROUTER INTEGRATION SUMMARY');
    logger.info('='.repeat(50));
    
    const score = (
        (hasOpenRouterKey ? 40 : 0) +
        (openRouterFallback ? 30 : 0) +
        30 // Base implementation score
    );
    
    logger.info(`🏆 OpenRouter Integration Score: ${score}/100`);
    
    const rating = score >= 90 ? '🎉 EXCELLENT' : 
                   score >= 70 ? '✅ GOOD' : 
                   score >= 40 ? '⚠️  PARTIAL' : '❌ NOT CONFIGURED';
    
    logger.info(`📊 Rating: ${rating}`);
    
    if (hasOpenRouterKey) {
        logger.info('\n✅ OpenRouter is ready to use!');
        logger.info('Benefits:');
        logger.info('• Access to multiple AI models through one API');
        logger.info('• Competitive pricing and high rate limits');
        logger.info('• Built-in redundancy and reliability');
        logger.info('• Easy model switching for different use cases');
    } else {
        logger.info('\n📝 Next Steps:');
        logger.info('1. Sign up at https://openrouter.ai/');
        logger.info('2. Get your API key');
        logger.info('3. Add OPENROUTER_API_KEY to .env file');
        logger.info('4. Choose your preferred model');
        logger.info('5. Test the integration');
    }
    
    return {
        score,
        hasApiKey: hasOpenRouterKey,
        isInFallback: !!openRouterFallback
    };
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
OpenRouter Integration Test Script

Usage: node scripts/test-openrouter-integration.js [options]

Options:
  --help, -h     Show this help message

This script tests OpenRouter integration:
- Configuration check
- Primary provider testing
- Fallback system integration
- Model recommendations
- Setup guidance

Examples:
  node scripts/test-openrouter-integration.js
    `);
    process.exit(0);
}

// Run the tests
testOpenRouterIntegration().then(results => {
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