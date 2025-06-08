require('dotenv').config({ path: '.env' });
const Logger = require('../src/utils/Logger');
const AICurhatService = require('../src/services/AICurhatService');

class CurhatAPITester {
    constructor() {
        this.logger = new Logger();
    }

    async testAPIRequest() {
        this.logger.info('🧪 Testing AI Curhat API Request');
        this.logger.info('==================================');
        
        try {
            // Create mock session manager
            const mockSessionManager = {
                setCurhatMode: async () => {},
                isInCurhatMode: async () => false,
                setCurhatHistory: async () => {},
                getCurhatHistory: async () => [],
                clearCurhatHistory: async () => {}
            };
            
            // Initialize service
            const curhatService = new AICurhatService(mockSessionManager);
            const status = curhatService.getStatus();
            
            this.logger.info(`Service Status: ${status.enabled ? 'Enabled' : 'Disabled'}`);
            this.logger.info(`Provider: ${status.provider}`);
            this.logger.info(`Model: ${status.model}`);
            this.logger.info(`Has API Key: ${status.hasApiKey}`);
            
            if (!status.enabled || !status.hasApiKey) {
                this.logger.warn('Service not properly configured for API testing');
                return false;
            }
            
            // Test simple API request
            this.logger.info('\n📡 Testing API Request...');
            
            const testMessages = [
                {
                    role: 'system',
                    content: 'Kamu adalah teman curhat yang baik.'
                },
                {
                    role: 'user',
                    content: 'Halo, apa kabar?'
                }
            ];
            
            const response = await curhatService.makeAIRequest(testMessages);
            
            if (response) {
                this.logger.info('✅ API Request berhasil!');
                this.logger.info(`Response preview: ${response.substring(0, 100)}...`);
                return true;
            } else {
                this.logger.error('❌ API Request gagal - no response');
                return false;
            }
            
        } catch (error) {
            this.logger.error('❌ API Test failed:', error.message);
            return false;
        }
    }

    async testCurhatFlow() {
        this.logger.info('\n🔄 Testing Curhat Flow');
        this.logger.info('======================');
        
        try {
            // Create mock session manager with proper methods
            let curhatMode = false;
            let curhatHistory = [];
            
            const mockSessionManager = {
                setCurhatMode: async (phone, mode) => { 
                    curhatMode = mode;
                },
                isInCurhatMode: async (phone) => {
                    return curhatMode;
                },
                setCurhatHistory: async (phone, history) => {
                    curhatHistory = history;
                },
                getCurhatHistory: async (phone) => {
                    return curhatHistory;
                },
                clearCurhatHistory: async (phone) => {
                    curhatHistory = [];
                }
            };
            
            const curhatService = new AICurhatService(mockSessionManager);
            const testPhone = '628123456789';
            
            // Test enter curhat mode
            this.logger.info('1. Testing enter curhat mode...');
            const enterResult = await curhatService.enterCurhatMode(testPhone);
            this.logger.info(`   Result: ${enterResult.success ? 'Success' : 'Failed'}`);
            
            // Test conversation
            if (enterResult.success && curhatService.getStatus().enabled) {
                this.logger.info('2. Testing conversation...');
                const response = await curhatService.handleCurhatMessage(testPhone, 'Halo, aku lagi sedih nih');
                this.logger.info(`   Response preview: ${response.substring(0, 80)}...`);
                
                // Test exit
                this.logger.info('3. Testing exit curhat mode...');
                const exitResponse = await curhatService.handleCurhatMessage(testPhone, '/quit');
                this.logger.info(`   Exit response preview: ${exitResponse.substring(0, 80)}...`);
                
                return true;
            } else {
                this.logger.warn('Skipping conversation test due to configuration issues');
                return false;
            }
            
        } catch (error) {
            this.logger.error('❌ Curhat Flow test failed:', error.message);
            return false;
        }
    }

    async runTests() {
        this.logger.info('🚀 Starting AI Curhat API Tests\n');
        
        const apiTest = await this.testAPIRequest();
        const flowTest = await this.testCurhatFlow();
        
        this.logger.info('\n🏆 TEST RESULTS');
        this.logger.info('===============');
        this.logger.info(`API Request Test: ${apiTest ? '✅ PASSED' : '❌ FAILED'}`);
        this.logger.info(`Curhat Flow Test: ${flowTest ? '✅ PASSED' : '❌ FAILED'}`);
        
        if (apiTest && flowTest) {
            this.logger.info('\n🎉 ALL TESTS PASSED! AI Curhat is working properly.');
        } else {
            this.logger.info('\n⚠️ Some tests failed. Check configuration and network connectivity.');
        }
    }
}

// Run tests
if (require.main === module) {
    const tester = new CurhatAPITester();
    tester.runTests().catch(console.error);
}

module.exports = CurhatAPITester;