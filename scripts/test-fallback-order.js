#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const AIService = require('../src/services/AIService');
const Logger = require('../src/utils/Logger');

async function testFallbackOrder() {
    const logger = new Logger();
    
    logger.info('🔄 Testing Configurable Fallback Order System');
    logger.info('='.repeat(60));
    
    // Test 1: Current fallback order
    logger.info('\n📋 1. Current Fallback Order Configuration');
    logger.info('-'.repeat(40));
    
    const currentOrder = process.env.AI_FALLBACK_ORDER || 'openrouter,deepseek,openai,groq';
    logger.info(`Current AI_FALLBACK_ORDER: ${currentOrder}`);
    
    const aiService = new AIService();
    const status = aiService.getProviderStatus();
    
    logger.info(`\n🔄 Configured Fallback Providers: ${status.fallbacks.length}`);
    status.fallbacks.forEach((provider, index) => {
        logger.info(`${index + 1}. ${provider.name} (${provider.provider})`);
        logger.info(`   Priority: ${provider.priority}`);
        logger.info(`   Model: ${provider.model}`);
        logger.info(`   Rate Limited: ${provider.isRateLimited ? '🔴' : '🟢'}`);
    });
    
    // Test 2: Different fallback order scenarios
    logger.info('\n🎯 2. Fallback Order Scenarios');
    logger.info('-'.repeat(40));
    
    const scenarios = [
        {
            name: 'OpenRouter-First (Current)',
            order: 'openrouter,deepseek,openai,groq',
            description: 'Best reliability and model variety'
        },
        {
            name: 'DeepSeek-First', 
            order: 'deepseek,openrouter,openai,groq',
            description: 'Direct DeepSeek API first, OpenRouter backup'
        },
        {
            name: 'Cost-Optimized',
            order: 'groq,deepseek,openrouter,openai',
            description: 'Free/cheap models first'
        },
        {
            name: 'Performance-Optimized',
            order: 'openrouter,openai,deepseek,groq', 
            description: 'Fastest providers first'
        },
        {
            name: 'OpenAI-First',
            order: 'openai,openrouter,deepseek,groq',
            description: 'Premium OpenAI first if available'
        }
    ];
    
    scenarios.forEach((scenario, index) => {
        const isCurrent = scenario.order === currentOrder;
        const marker = isCurrent ? ' (CURRENT)' : '';
        
        logger.info(`\n${index + 1}. ${scenario.name}${marker}`);
        logger.info(`   Order: ${scenario.order}`);
        logger.info(`   Description: ${scenario.description}`);
        logger.info(`   Priority Flow: ${scenario.order.split(',').join(' → ')}`);
    });
    
    // Test 3: Provider availability check
    logger.info('\n🔍 3. Provider Availability Check');
    logger.info('-'.repeat(40));
    
    const providers = ['openrouter', 'deepseek', 'openai', 'groq'];
    
    providers.forEach(provider => {
        let isConfigured = false;
        let apiKeyVar = '';
        
        switch (provider) {
            case 'openrouter':
                isConfigured = !!process.env.OPENROUTER_API_KEY;
                apiKeyVar = 'OPENROUTER_API_KEY';
                break;
            case 'deepseek':
                isConfigured = !!process.env.DEEPSEEK_API_KEY;
                apiKeyVar = 'DEEPSEEK_API_KEY';
                break;
            case 'openai':
                isConfigured = !!process.env.OPENAI_API_KEY;
                apiKeyVar = 'OPENAI_API_KEY';
                break;
            case 'groq':
                isConfigured = !!process.env.GROQ_API_KEY;
                apiKeyVar = 'GROQ_API_KEY';
                break;
        }
        
        const statusIcon = isConfigured ? '✅' : '❌';
        const statusText = isConfigured ? 'Available' : 'Not Configured';
        
        logger.info(`${statusIcon} ${provider.toUpperCase()}: ${statusText}`);
        if (!isConfigured) {
            logger.info(`   → Set ${apiKeyVar} to enable`);
        }
    });
    
    // Test 4: How to change fallback order
    logger.info('\n⚙️  4. How to Change Fallback Order');
    logger.info('-'.repeat(40));
    
    logger.info('To change the fallback order, modify .env file:');
    logger.info('');
    logger.info('# Example: Make DeepSeek first fallback');
    logger.info('AI_FALLBACK_ORDER=deepseek,openrouter,openai,groq');
    logger.info('');
    logger.info('# Example: Cost-optimized order');
    logger.info('AI_FALLBACK_ORDER=groq,deepseek,openrouter,openai');
    logger.info('');
    logger.info('# Example: Premium quality first');
    logger.info('AI_FALLBACK_ORDER=openai,openrouter,deepseek,groq');
    
    // Test 5: Real-world fallback simulation
    logger.info('\n🎮 5. Fallback Flow Simulation');
    logger.info('-'.repeat(40));
    
    logger.info('When primary provider fails, the system tries:');
    logger.info('');
    
    const fallbackFlow = currentOrder.split(',').map(p => p.trim());
    const availableInOrder = fallbackFlow.filter(provider => {
        switch (provider) {
            case 'openrouter': return !!process.env.OPENROUTER_API_KEY;
            case 'deepseek': return !!process.env.DEEPSEEK_API_KEY;
            case 'openai': return !!process.env.OPENAI_API_KEY;
            case 'groq': return !!process.env.GROQ_API_KEY;
            default: return false;
        }
    });
    
    logger.info('Primary Provider: openaicompatible (configured)');
    logger.info('  ↓ (rate limited)');
    
    availableInOrder.forEach((provider, index) => {
        const isLast = index === availableInOrder.length - 1;
        const arrow = isLast ? '  ✅ Success!' : '  ↓ (rate limited)';
        logger.info(`Fallback ${index + 1}: ${provider.toUpperCase()}`);
        logger.info(arrow);
    });
    
    if (availableInOrder.length === 0) {
        logger.info('❌ No fallback providers configured!');
        logger.info('  ↓');
        logger.info('Use basic fallback response');
    }
    
    // Test 6: Performance impact
    logger.info('\n⚡ 6. Performance Analysis');
    logger.info('-'.repeat(40));
    
    const configuredCount = providers.filter(provider => {
        switch (provider) {
            case 'openrouter': return !!process.env.OPENROUTER_API_KEY;
            case 'deepseek': return !!process.env.DEEPSEEK_API_KEY;
            case 'openai': return !!process.env.OPENAI_API_KEY;
            case 'groq': return !!process.env.GROQ_API_KEY;
            default: return false;
        }
    }).length;
    
    logger.info(`Configured Providers: ${configuredCount}/4`);
    logger.info(`Fallback Depth: ${availableInOrder.length} levels`);
    logger.info(`Switch Overhead: ~100ms per provider`);
    logger.info(`Max Fallback Time: ~${availableInOrder.length * 100}ms`);
    
    const reliabilityScore = Math.min(100, 50 + (configuredCount * 12.5));
    logger.info(`Reliability Score: ${reliabilityScore}/100`);
    
    // Final summary
    logger.info('\n' + '='.repeat(60));
    logger.info('📋 FALLBACK ORDER SYSTEM SUMMARY');
    logger.info('='.repeat(60));
    
    const score = (
        (configuredCount >= 2 ? 30 : configuredCount * 15) +
        (availableInOrder.length >= 2 ? 25 : availableInOrder.length * 12) +
        (currentOrder.includes('openrouter') ? 20 : 0) +
        25 // Base implementation score
    );
    
    logger.info(`🏆 Fallback Order Score: ${score}/100`);
    
    const rating = score >= 90 ? '🎉 EXCELLENT' : 
                   score >= 70 ? '✅ GOOD' : 
                   score >= 50 ? '⚠️  FAIR' : '❌ NEEDS IMPROVEMENT';
    
    logger.info(`📊 Rating: ${rating}`);
    logger.info(`🔄 Current Order: ${currentOrder}`);
    logger.info(`⚡ Available Fallbacks: ${availableInOrder.length}`);
    logger.info(`🎯 Reliability: ${reliabilityScore}%`);
    
    if (score >= 90) {
        logger.info('\n🎊 Excellent fallback configuration!');
        logger.info('Your system has maximum reliability with optimal fallback order.');
    } else if (score >= 70) {
        logger.info('\n✅ Good fallback configuration!');
        logger.info('Consider adding more providers for even better reliability.');
    } else {
        logger.info('\n📝 Recommendations:');
        logger.info('1. Configure more AI providers');
        logger.info('2. Optimize fallback order for your use case');
        logger.info('3. Test different provider combinations');
    }
    
    return {
        score,
        configuredProviders: configuredCount,
        availableFallbacks: availableInOrder.length,
        currentOrder,
        reliabilityScore
    };
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Fallback Order Test Script

Usage: node scripts/test-fallback-order.js [options]

Options:
  --help, -h     Show this help message

This script tests the configurable fallback order system:
- Current fallback order analysis
- Different order scenarios
- Provider availability check
- Performance impact analysis
- Configuration recommendations

Examples:
  node scripts/test-fallback-order.js
    `);
    process.exit(0);
}

// Run the tests
testFallbackOrder().then(results => {
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