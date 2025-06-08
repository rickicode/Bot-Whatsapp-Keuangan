require('dotenv').config({ path: '.env' });
const Logger = require('../src/utils/Logger');

class SimpleCurhatTester {
    constructor() {
        this.logger = new Logger();
    }

    testEnvironmentConfiguration() {
        this.logger.info('🔧 Testing AI Curhat Environment Configuration');
        this.logger.info('==============================================');
        
        const config = {
            enabled: process.env.AI_CURHAT_ENABLED,
            provider: process.env.AI_CURHAT_PROVIDER,
            model: process.env.AI_CURHAT_MODEL
        };
        
        this.logger.info(`AI_CURHAT_ENABLED: ${config.enabled}`);
        this.logger.info(`AI_CURHAT_PROVIDER: ${config.provider}`);
        this.logger.info(`AI_CURHAT_MODEL: ${config.model}`);
        
        // Check provider API key
        let hasApiKey = false;
        let apiKeySource = '';
        
        switch (config.provider?.toLowerCase()) {
            case 'openrouter':
                hasApiKey = !!process.env.OPENROUTER_API_KEY;
                apiKeySource = 'OPENROUTER_API_KEY';
                break;
            case 'deepseek':
                hasApiKey = !!process.env.DEEPSEEK_API_KEY;
                apiKeySource = 'DEEPSEEK_API_KEY';
                break;
            case 'openai':
                hasApiKey = !!process.env.OPENAI_API_KEY;
                apiKeySource = 'OPENAI_API_KEY';
                break;
            case 'groq':
                hasApiKey = !!process.env.GROQ_API_KEY;
                apiKeySource = 'GROQ_API_KEY';
                break;
            default:
                this.logger.warn(`Unknown provider: ${config.provider}`);
        }
        
        this.logger.info(`${apiKeySource}: ${hasApiKey ? 'Present ✅' : 'Missing ❌'}`);
        
        // Test AICurhatService import
        try {
            const AICurhatService = require('../src/services/AICurhatService');
            this.logger.info('AICurhatService import: ✅ Success');
            
            // Test basic instantiation (without sessionManager for now)
            try {
                const mockSessionManager = {
                    setCurhatMode: async () => {},
                    isInCurhatMode: async () => false,
                    setCurhatHistory: async () => {},
                    getCurhatHistory: async () => [],
                    clearCurhatHistory: async () => {}
                };
                
                const service = new AICurhatService(mockSessionManager);
                const status = service.getStatus();
                
                this.logger.info('AICurhatService instantiation: ✅ Success');
                this.logger.info(`Service enabled: ${status.enabled}`);
                this.logger.info(`Service provider: ${status.provider}`);
                this.logger.info(`Service model: ${status.model}`);
                this.logger.info(`Service has API key: ${status.hasApiKey}`);
                
            } catch (error) {
                this.logger.error('AICurhatService instantiation: ❌ Failed -', error.message);
            }
            
        } catch (error) {
            this.logger.error('AICurhatService import: ❌ Failed -', error.message);
        }
        
        // Overall assessment
        const checks = {
            enabled: config.enabled === 'true',
            hasProvider: !!config.provider,
            hasModel: !!config.model,
            hasApiKey: hasApiKey
        };
        
        const passedChecks = Object.values(checks).filter(Boolean).length;
        const totalChecks = Object.keys(checks).length;
        
        this.logger.info('\n📊 Configuration Summary:');
        Object.entries(checks).forEach(([key, value]) => {
            this.logger.info(`   ${key}: ${value ? '✅' : '❌'}`);
        });
        
        this.logger.info(`\n🎯 Score: ${passedChecks}/${totalChecks}`);
        
        if (passedChecks === totalChecks) {
            this.logger.info('🎉 Status: READY - AI Curhat is properly configured!');
        } else if (passedChecks >= 3) {
            this.logger.info('👍 Status: MOSTLY READY - Minor configuration needed');
        } else {
            this.logger.info('⚠️ Status: NEEDS CONFIGURATION');
        }
        
        // Recommendations
        this.logger.info('\n💡 Recommendations:');
        if (!checks.enabled) {
            this.logger.info('• Set AI_CURHAT_ENABLED=true in .env file');
        }
        if (!checks.hasProvider) {
            this.logger.info('• Set AI_CURHAT_PROVIDER=openrouter (or another provider) in .env file');
        }
        if (!checks.hasModel) {
            this.logger.info('• Set AI_CURHAT_MODEL=anthropic/claude-3-haiku (or another model) in .env file');
        }
        if (!checks.hasApiKey) {
            this.logger.info(`• Set ${apiKeySource} in .env file`);
        }
        
        return {
            score: passedChecks,
            total: totalChecks,
            ready: passedChecks === totalChecks
        };
    }

    testCommandMappings() {
        this.logger.info('\n📋 Testing Command Mappings');
        this.logger.info('============================');
        
        try {
            const CommandHandler = require('../src/handlers/CommandHandler');
            
            // Create a mock setup to test command mappings
            const mockDB = {};
            const mockAI = {};
            const mockClient = {};
            const mockIndonesianAI = {};
            const mockSessionManager = {};
            
            const handler = new CommandHandler(mockDB, mockAI, mockClient, mockIndonesianAI, mockSessionManager);
            
            const curhatCommands = ['/curhat', '/quit', '/keluar'];
            const results = {};
            
            curhatCommands.forEach(cmd => {
                const hasCommand = !!handler.commands[cmd];
                results[cmd] = hasCommand;
                this.logger.info(`${cmd}: ${hasCommand ? '✅' : '❌'}`);
            });
            
            const passedCommands = Object.values(results).filter(Boolean).length;
            this.logger.info(`\n📊 Command Mapping Score: ${passedCommands}/${curhatCommands.length}`);
            
            return results;
            
        } catch (error) {
            this.logger.error('❌ Command mapping test failed:', error.message);
            return { error: error.message };
        }
    }

    async runSimpleTests() {
        this.logger.info('🧪 Running Simple AI Curhat Tests');
        this.logger.info('==================================');
        
        // Test 1: Environment Configuration
        const configResult = this.testEnvironmentConfiguration();
        
        // Test 2: Command Mappings
        const commandResult = this.testCommandMappings();
        
        // Final Report
        this.logger.info('\n🏆 SIMPLE TEST REPORT');
        this.logger.info('=====================');
        
        this.logger.info(`📋 Configuration: ${configResult.score}/${configResult.total} ${configResult.ready ? '🎉' : '⚠️'}`);
        
        if (commandResult.error) {
            this.logger.info(`📋 Commands: ERROR - ${commandResult.error}`);
        } else {
            const cmdScore = Object.values(commandResult).filter(Boolean).length;
            this.logger.info(`📋 Commands: ${cmdScore}/3 ${cmdScore === 3 ? '✅' : '❌'}`);
        }
        
        if (configResult.ready && !commandResult.error && Object.values(commandResult).filter(Boolean).length === 3) {
            this.logger.info('\n🎉 READY FOR TESTING!');
            this.logger.info('You can now test the curhat feature:');
            this.logger.info('1. Start the bot');
            this.logger.info('2. Send: /curhat');
            this.logger.info('3. Have a conversation');
            this.logger.info('4. Send: /quit to exit');
        } else {
            this.logger.info('\n⚠️ NEEDS SETUP - Please fix the issues above first');
        }
    }
}

// Run tests
const tester = new SimpleCurhatTester();
tester.runSimpleTests().catch(console.error);