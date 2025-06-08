const Logger = require('../src/utils/Logger');
const AICurhatService = require('../src/services/AICurhatService');
const SessionManager = require('../src/database/SessionManager');
const DatabaseFactory = require('../src/database/DatabaseFactory');

class AICurhatTester {
    constructor() {
        this.logger = new Logger();
        this.sessionManager = null;
        this.aiCurhatService = null;
    }

    async initialize() {
        try {
            this.logger.info('🚀 Initializing AI Curhat Test Environment...');
            
            // Initialize SessionManager
            this.sessionManager = DatabaseFactory.createSessionManager();
            const postgresConfig = DatabaseFactory.getPostgresConfig();
            const redisConfig = DatabaseFactory.getRedisConfig();
            
            await this.sessionManager.initialize(postgresConfig, redisConfig);
            this.logger.info('✅ SessionManager initialized');
            
            // Initialize AICurhatService
            this.aiCurhatService = new AICurhatService(this.sessionManager);
            this.logger.info('✅ AICurhatService initialized');
            
        } catch (error) {
            this.logger.error('❌ Initialization failed:', error);
            throw error;
        }
    }

    async testCurhatModeFlow() {
        const testPhone = '6281234567890';
        
        try {
            this.logger.info('🧪 Testing AI Curhat Mode Flow...');
            this.logger.info('=====================================');
            
            // Test 1: Check initial status
            this.logger.info('1. Checking initial curhat mode status...');
            const initialStatus = await this.aiCurhatService.isUserInCurhatMode(testPhone);
            this.logger.info(`   Initial status: ${initialStatus ? 'In curhat mode' : 'Not in curhat mode'}`);
            
            // Test 2: Enter curhat mode
            this.logger.info('2. Entering curhat mode...');
            const enterResult = await this.aiCurhatService.enterCurhatMode(testPhone);
            this.logger.info(`   Enter result: ${enterResult.success ? 'Success' : 'Failed'}`);
            if (enterResult.success) {
                this.logger.info(`   Welcome message preview: ${enterResult.message.substring(0, 100)}...`);
            }
            
            // Test 3: Check status after entering
            this.logger.info('3. Checking status after entering...');
            const afterEnterStatus = await this.aiCurhatService.isUserInCurhatMode(testPhone);
            this.logger.info(`   Status: ${afterEnterStatus ? 'In curhat mode ✅' : 'Not in curhat mode ❌'}`);
            
            // Test 4: Test conversation
            if (afterEnterStatus) {
                this.logger.info('4. Testing conversation...');
                const testMessages = [
                    'Halo, aku lagi stress nih',
                    'Aku lagi pusing mikirin keuangan',
                    'Terima kasih sudah mendengarkan'
                ];
                
                for (let i = 0; i < testMessages.length; i++) {
                    this.logger.info(`   Testing message ${i + 1}: "${testMessages[i]}"`);
                    const response = await this.aiCurhatService.handleCurhatMessage(testPhone, testMessages[i]);
                    this.logger.info(`   AI Response preview: ${response.substring(0, 100)}...`);
                    
                    // Add small delay between messages
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            // Test 5: Exit curhat mode
            this.logger.info('5. Exiting curhat mode...');
            const exitResult = await this.aiCurhatService.exitCurhatMode(testPhone);
            this.logger.info(`   Exit result: ${exitResult.success ? 'Success' : 'Failed'}`);
            if (exitResult.success) {
                this.logger.info(`   Exit message preview: ${exitResult.message.substring(0, 100)}...`);
            }
            
            // Test 6: Check final status
            this.logger.info('6. Checking final status...');
            const finalStatus = await this.aiCurhatService.isUserInCurhatMode(testPhone);
            this.logger.info(`   Final status: ${finalStatus ? 'In curhat mode ❌' : 'Not in curhat mode ✅'}`);
            
            return {
                success: true,
                tests: {
                    initialStatus: !initialStatus,
                    enterMode: enterResult.success,
                    statusAfterEnter: afterEnterStatus,
                    conversationWorking: afterEnterStatus,
                    exitMode: exitResult.success,
                    finalStatus: !finalStatus
                }
            };
            
        } catch (error) {
            this.logger.error('❌ Test failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async testCurhatConfiguration() {
        try {
            this.logger.info('🔧 Testing AI Curhat Configuration...');
            this.logger.info('=========================================');
            
            const status = this.aiCurhatService.getStatus();
            
            this.logger.info(`✓ Enabled: ${status.enabled}`);
            this.logger.info(`✓ Provider: ${status.provider}`);
            this.logger.info(`✓ Model: ${status.model}`);
            this.logger.info(`✓ Has API Key: ${status.hasApiKey}`);
            
            // Test configuration values
            const configTests = {
                enabled: status.enabled,
                hasProvider: !!status.provider,
                hasModel: !!status.model,
                hasApiKey: status.hasApiKey
            };
            
            const configScore = Object.values(configTests).filter(Boolean).length;
            this.logger.info(`\n📊 Configuration Score: ${configScore}/4`);
            
            if (configScore === 4) {
                this.logger.info('🎉 Configuration: EXCELLENT');
            } else if (configScore >= 3) {
                this.logger.info('👍 Configuration: GOOD');
            } else {
                this.logger.info('⚠️ Configuration: NEEDS ATTENTION');
            }
            
            return configTests;
            
        } catch (error) {
            this.logger.error('❌ Configuration test failed:', error);
            return { error: error.message };
        }
    }

    async testSessionPersistence() {
        const testPhone = '6281234567891';
        
        try {
            this.logger.info('💾 Testing Session Persistence...');
            this.logger.info('=================================');
            
            // Test history persistence
            const testHistory = [
                { role: 'user', content: 'Test message 1', timestamp: new Date().toISOString() },
                { role: 'assistant', content: 'Test response 1', timestamp: new Date().toISOString() }
            ];
            
            this.logger.info('1. Setting curhat history...');
            await this.sessionManager.setCurhatHistory(testPhone, testHistory);
            
            this.logger.info('2. Getting curhat history...');
            const retrievedHistory = await this.sessionManager.getCurhatHistory(testPhone);
            
            this.logger.info('3. Setting curhat mode...');
            await this.sessionManager.setCurhatMode(testPhone, true);
            
            this.logger.info('4. Checking curhat mode...');
            const isInMode = await this.sessionManager.isInCurhatMode(testPhone);
            
            this.logger.info('5. Clearing curhat data...');
            await this.sessionManager.clearCurhatHistory(testPhone);
            
            this.logger.info('6. Verifying cleanup...');
            const afterClearHistory = await this.sessionManager.getCurhatHistory(testPhone);
            const afterClearMode = await this.sessionManager.isInCurhatMode(testPhone);
            
            const results = {
                historySet: Array.isArray(retrievedHistory) && retrievedHistory.length === testHistory.length,
                modeSet: isInMode,
                historyCleared: afterClearHistory.length === 0,
                modeCleared: !afterClearMode
            };
            
            this.logger.info('\n📊 Session Persistence Results:');
            Object.entries(results).forEach(([key, value]) => {
                this.logger.info(`   ${key}: ${value ? '✅' : '❌'}`);
            });
            
            return results;
            
        } catch (error) {
            this.logger.error('❌ Session persistence test failed:', error);
            return { error: error.message };
        }
    }

    async runAllTests() {
        try {
            await this.initialize();
            
            this.logger.info('🧪 Starting AI Curhat Comprehensive Tests');
            this.logger.info('==========================================');
            
            // Test 1: Configuration
            const configResults = await this.testCurhatConfiguration();
            
            // Test 2: Session Persistence
            const persistenceResults = await this.testSessionPersistence();
            
            // Test 3: Full Flow (only if configuration is good)
            let flowResults = { skipped: true };
            if (configResults.enabled && configResults.hasApiKey) {
                flowResults = await this.testCurhatModeFlow();
            } else {
                this.logger.info('⚠️ Skipping flow test due to configuration issues');
            }
            
            // Generate final report
            this.generateFinalReport(configResults, persistenceResults, flowResults);
            
        } catch (error) {
            this.logger.error('❌ Test suite failed:', error);
        } finally {
            if (this.sessionManager) {
                await this.sessionManager.close();
            }
        }
    }

    generateFinalReport(configResults, persistenceResults, flowResults) {
        this.logger.info('\n🏆 FINAL TEST REPORT');
        this.logger.info('====================');
        
        // Configuration Score
        const configScore = Object.values(configResults).filter(v => v === true).length;
        this.logger.info(`📋 Configuration: ${configScore}/4 ${this.getScoreEmoji(configScore, 4)}`);
        
        // Persistence Score
        const persistenceScore = Object.values(persistenceResults).filter(v => v === true).length;
        this.logger.info(`💾 Session Persistence: ${persistenceScore}/4 ${this.getScoreEmoji(persistenceScore, 4)}`);
        
        // Flow Score
        if (!flowResults.skipped) {
            const flowScore = Object.values(flowResults.tests || {}).filter(v => v === true).length;
            this.logger.info(`🔄 Full Flow: ${flowScore}/6 ${this.getScoreEmoji(flowScore, 6)}`);
        } else {
            this.logger.info(`🔄 Full Flow: SKIPPED (configuration issues)`);
        }
        
        // Overall Assessment
        const totalPossible = 4 + 4 + (flowResults.skipped ? 0 : 6);
        const totalScored = configScore + persistenceScore + (flowResults.skipped ? 0 : Object.values(flowResults.tests || {}).filter(v => v === true).length);
        
        const overallPercent = totalPossible > 0 ? Math.round((totalScored / totalPossible) * 100) : 0;
        
        this.logger.info(`\n🎯 Overall Score: ${totalScored}/${totalPossible} (${overallPercent}%)`);
        
        if (overallPercent >= 90) {
            this.logger.info('🎉 Status: EXCELLENT - AI Curhat ready for production!');
        } else if (overallPercent >= 70) {
            this.logger.info('👍 Status: GOOD - Minor issues to address');
        } else if (overallPercent >= 50) {
            this.logger.info('⚠️ Status: FAIR - Several issues need attention');
        } else {
            this.logger.info('❌ Status: POOR - Major issues need to be fixed');
        }
        
        // Recommendations
        this.logger.info('\n💡 RECOMMENDATIONS:');
        if (!configResults.enabled) {
            this.logger.info('• Enable AI curhat by setting AI_CURHAT_ENABLED=true');
        }
        if (!configResults.hasApiKey) {
            this.logger.info('• Configure API key for your chosen provider');
        }
        if (persistenceScore < 4) {
            this.logger.info('• Check Redis/PostgreSQL session storage configuration');
        }
        if (!flowResults.skipped && flowResults.tests && Object.values(flowResults.tests).some(v => !v)) {
            this.logger.info('• Review AI service configuration and network connectivity');
        }
    }

    getScoreEmoji(score, total) {
        const percentage = (score / total) * 100;
        if (percentage >= 90) return '🎉';
        if (percentage >= 70) return '✅';
        if (percentage >= 50) return '⚠️';
        return '❌';
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new AICurhatTester();
    tester.runAllTests().catch(console.error);
}

module.exports = AICurhatTester;