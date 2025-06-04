// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const AIService = require('./src/services/AIService');
const IndonesianAIAssistant = require('./src/services/IndonesianAIAssistant');
const Logger = require('./src/utils/Logger');

async function testRegistrationFlow() {
    const logger = new Logger();
    
    try {
        // Initialize services
        logger.info('🚀 Initializing test services...');
        
        const db = new DatabaseManager();
        await db.initialize();
        logger.info('✅ Database initialized');
        
        const aiService = new AIService();
        const indonesianAI = new IndonesianAIAssistant(db, aiService);
        logger.info('✅ Indonesian AI Assistant initialized');
        
        // Test phone number (new user)
        const testPhone = '6289999999999';
        const testMessage = 'halo';
        
        // Create mock message object
        const mockMessage = {
            from: `${testPhone}@s.whatsapp.net`,
            body: testMessage,
            reply: async (text) => {
                logger.info(`🤖 Bot Reply: ${text}`);
            }
        };
        
        logger.info(`📱 Testing message from ${testPhone}: "${testMessage}"`);
        
        // Process the message
        const result = await indonesianAI.processMessage(mockMessage, testPhone, testMessage);
        
        logger.info(`✅ Message processed successfully. Handled by AI: ${result}`);
        
        // Check user status
        const userStatus = await indonesianAI.checkUserStatus(testPhone);
        logger.info('👤 User Status:', JSON.stringify(userStatus, null, 2));
        
        await db.close();
        logger.info('✅ Test completed successfully');
        
    } catch (error) {
        logger.error('❌ Test failed:', error);
    }
}

// Run the test
testRegistrationFlow();