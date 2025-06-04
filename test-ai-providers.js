const AIService = require('./src/services/AIService');

// Test different AI providers
async function testAIProviders() {
    console.log('🤖 Testing AI Providers\n');
    console.log('=' + '='.repeat(60));

    // Test scenarios for each provider
    const testScenarios = [
        {
            name: 'DeepSeek Provider',
            env: {
                AI_PROVIDER: 'deepseek',
                DEEPSEEK_API_KEY: 'your_deepseek_api_key_here',
                DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
                DEEPSEEK_MODEL: 'deepseek-chat',
                ENABLE_AI_FEATURES: 'true'
            }
        },
        {
            name: 'OpenAI Provider', 
            env: {
                AI_PROVIDER: 'openai',
                OPENAI_API_KEY: 'your_openai_api_key_here',
                OPENAI_BASE_URL: 'https://api.openai.com',
                OPENAI_MODEL: 'gpt-3.5-turbo',
                ENABLE_AI_FEATURES: 'true'
            }
        },
        {
            name: 'OpenAI Compatible (DeepSeek)',
            env: {
                AI_PROVIDER: 'openaicompatible',
                OPENAI_COMPATIBLE_API_KEY: 'your_deepseek_api_key_here',
                OPENAI_COMPATIBLE_BASE_URL: 'https://api.deepseek.com',
                OPENAI_COMPATIBLE_MODEL: 'deepseek-chat',
                ENABLE_AI_FEATURES: 'true'
            }
        },
        {
            name: 'OpenAI Compatible (Groq)',
            env: {
                AI_PROVIDER: 'openaicompatible',
                OPENAI_COMPATIBLE_API_KEY: 'your_groq_api_key_here',
                OPENAI_COMPATIBLE_BASE_URL: 'https://api.groq.com/openai',
                OPENAI_COMPATIBLE_MODEL: 'llama3-8b-8192',
                ENABLE_AI_FEATURES: 'true'
            }
        },
        {
            name: 'OpenAI Compatible (LocalAI)',
            env: {
                AI_PROVIDER: 'openaicompatible',
                OPENAI_COMPATIBLE_API_KEY: 'not-needed',
                OPENAI_COMPATIBLE_BASE_URL: 'http://localhost:8080',
                OPENAI_COMPATIBLE_MODEL: 'gpt-3.5-turbo',
                ENABLE_AI_FEATURES: 'true'
            }
        }
    ];

    for (const scenario of testScenarios) {
        console.log(`\n🧪 Testing: ${scenario.name}`);
        console.log('-'.repeat(50));

        // Set environment variables for this test
        const originalEnv = {};
        for (const [key, value] of Object.entries(scenario.env)) {
            originalEnv[key] = process.env[key];
            process.env[key] = value;
        }

        try {
            // Create new AI service instance
            const aiService = new AIService();
            
            // Test provider initialization
            console.log('📋 Provider Info:', aiService.getProviderInfo());
            
            if (!aiService.isAvailable()) {
                console.log('❌ AI Service not available (missing API key or disabled)');
                continue;
            }

            // Test basic functionality
            console.log('✅ AI Service initialized successfully');
            console.log(`📡 Provider: ${aiService.provider}`);
            console.log(`🌐 Base URL: ${aiService.baseURL}`);
            console.log(`🔧 Model: ${aiService.model}`);

            // Test basic request (will fail with dummy keys, but we can test the setup)
            try {
                console.log('🔄 Testing basic request...');
                
                // This will likely fail with dummy API keys, but that's expected
                const testResponse = await aiService.makeRequest([
                    { role: 'user', content: 'Hello, test message' }
                ], 0.7, 50);
                
                console.log('✅ Request successful:', testResponse.substring(0, 100) + '...');
            } catch (error) {
                if (error.message.includes('API key tidak valid') || 
                    error.message.includes('401') ||
                    error.message.includes('unauthorized')) {
                    console.log('⚠️ Request failed: Invalid API key (expected with dummy keys)');
                } else if (error.message.includes('Tidak dapat terhubung') ||
                          error.message.includes('ECONNREFUSED') ||
                          error.message.includes('ENOTFOUND')) {
                    console.log('⚠️ Request failed: Connection error (expected with localhost/invalid URLs)');
                } else {
                    console.log('❌ Request failed:', error.message);
                }
            }

        } catch (error) {
            console.log('❌ Provider initialization failed:', error.message);
        }

        // Restore original environment
        for (const [key, value] of Object.entries(originalEnv)) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ AI Provider Testing Complete');
    console.log('\n📝 Configuration Examples:');
    console.log('\n1. DeepSeek (Native):');
    console.log('   AI_PROVIDER=deepseek');
    console.log('   DEEPSEEK_API_KEY=sk-xxxx');
    console.log('   DEEPSEEK_MODEL=deepseek-chat');
    
    console.log('\n2. OpenAI:');
    console.log('   AI_PROVIDER=openai');
    console.log('   OPENAI_API_KEY=sk-xxxx');
    console.log('   OPENAI_MODEL=gpt-3.5-turbo');
    
    console.log('\n3. DeepSeek (via OpenAI Compatible):');
    console.log('   AI_PROVIDER=openaicompatible');
    console.log('   OPENAI_COMPATIBLE_API_KEY=sk-xxxx');
    console.log('   OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com');
    console.log('   OPENAI_COMPATIBLE_MODEL=deepseek-chat');
    
    console.log('\n4. Groq:');
    console.log('   AI_PROVIDER=openaicompatible');
    console.log('   OPENAI_COMPATIBLE_API_KEY=gsk_xxxx');
    console.log('   OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai');
    console.log('   OPENAI_COMPATIBLE_MODEL=llama3-8b-8192');
    
    console.log('\n5. LocalAI:');
    console.log('   AI_PROVIDER=openaicompatible');
    console.log('   OPENAI_COMPATIBLE_BASE_URL=http://localhost:8080');
    console.log('   OPENAI_COMPATIBLE_MODEL=your-local-model');
}

// Test current configuration
async function testCurrentConfig() {
    console.log('🔍 Testing Current Configuration\n');
    console.log('=' + '='.repeat(40));

    try {
        const aiService = new AIService();
        const info = aiService.getProviderInfo();
        
        console.log('📋 Current Configuration:');
        console.log(`📡 Provider: ${info.provider}`);
        console.log(`🌐 Base URL: ${info.baseURL}`);
        console.log(`🔧 Model: ${info.model}`);
        console.log(`✅ Status: ${info.isEnabled ? 'Enabled' : 'Disabled'}`);
        
        if (info.isEnabled) {
            console.log('\n🔄 Testing current configuration...');
            
            try {
                const testResponse = await aiService.makeRequest([
                    { role: 'user', content: 'Test message for financial bot' }
                ], 0.7, 50);
                
                console.log('✅ Current configuration works!');
                console.log('📝 Response preview:', testResponse.substring(0, 100) + '...');
            } catch (error) {
                console.log('❌ Current configuration failed:', error.message);
            }
        }
        
    } catch (error) {
        console.log('❌ Error testing current config:', error.message);
    }
}

// Test natural language parsing
async function testNaturalLanguageParsing() {
    console.log('\n🗣️ Testing Natural Language Parsing\n');
    console.log('=' + '='.repeat(40));

    const testInputs = [
        'Saya habis 50000 untuk makan siang',
        'Terima 3 juta gaji bulan ini',
        'Beli bensin 100000',
        'Dapat bonus 500 ribu'
    ];

    try {
        const aiService = new AIService();
        
        if (!aiService.isAvailable()) {
            console.log('❌ AI Service not available for testing');
            return;
        }

        for (const input of testInputs) {
            console.log(`\n📝 Input: "${input}"`);
            
            try {
                const parsed = await aiService.parseNaturalLanguageTransaction(input, '+6281234567890');
                
                if (parsed) {
                    console.log('✅ Parsed successfully:');
                    console.log(`   Type: ${parsed.type}`);
                    console.log(`   Amount: ${parsed.amount}`);
                    console.log(`   Description: ${parsed.description}`);
                    console.log(`   Category: ${parsed.category}`);
                    console.log(`   Confidence: ${(parsed.confidence * 100).toFixed(1)}%`);
                } else {
                    console.log('❌ Failed to parse');
                }
            } catch (error) {
                console.log('❌ Parsing error:', error.message);
            }
        }
    } catch (error) {
        console.log('❌ Error in natural language testing:', error.message);
    }
}

// Main test function
async function runAllTests() {
    console.log('🚀 AI Provider Comprehensive Testing\n');
    
    // Test all provider configurations
    await testAIProviders();
    
    // Test current active configuration
    await testCurrentConfig();
    
    // Test natural language parsing (if current config works)
    await testNaturalLanguageParsing();
    
    console.log('\n🎉 All tests completed!');
    console.log('\n💡 Tips:');
    console.log('- Set your actual API keys in .env to test real functionality');
    console.log('- Use /ai-info command in WhatsApp to check current provider');
    console.log('- Switch providers by changing AI_PROVIDER environment variable');
}

// Run tests
if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = {
    testAIProviders,
    testCurrentConfig,
    testNaturalLanguageParsing,
    runAllTests
};