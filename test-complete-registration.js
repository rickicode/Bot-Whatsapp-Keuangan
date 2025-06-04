// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const AIService = require('./src/services/AIService');
const IndonesianAIAssistant = require('./src/services/IndonesianAIAssistant');
const Logger = require('./src/utils/Logger');

async function testCompleteRegistration() {
    const logger = new Logger();
    
    try {
        // Initialize services
        logger.info('🚀 Testing complete registration flow...');
        
        const db = new DatabaseManager();
        await db.initialize();
        
        const aiService = new AIService();
        const indonesianAI = new IndonesianAIAssistant(db, aiService);
        
        // Test phone number (new user)
        const testPhone = '6289876543210';
        
        // Mock message object factory
        const createMockMessage = (body) => ({
            from: `${testPhone}@s.whatsapp.net`,
            body: body,
            reply: async (text) => {
                logger.info(`🤖 Bot Reply: ${text}`);
            }
        });
        
        logger.info('\n=== Step 1: Initial contact (unregistered user) ===');
        await indonesianAI.processMessage(createMockMessage('halo'), testPhone, 'halo');
        
        logger.info('\n=== Step 2: Provide name ===');
        await indonesianAI.processMessage(createMockMessage('John Doe'), testPhone, 'John Doe');
        
        logger.info('\n=== Step 3: Provide email ===');
        await indonesianAI.processMessage(createMockMessage('john.doe@example.com'), testPhone, 'john.doe@example.com');
        
        logger.info('\n=== Step 4: Provide city ===');
        await indonesianAI.processMessage(createMockMessage('Jakarta'), testPhone, 'Jakarta');
        
        logger.info('\n=== Step 5: Test registered user access ===');
        await indonesianAI.processMessage(createMockMessage('/menu'), testPhone, '/menu');
        
        // Check final user status
        const userStatus = await indonesianAI.checkUserStatus(testPhone);
        logger.info('\n👤 Final User Status:', JSON.stringify(userStatus, null, 2));
        
        // Test access control
        const accessCheck = await indonesianAI.checkAccessControl(testPhone);
        logger.info('\n🔐 Access Control:', JSON.stringify(accessCheck, null, 2));
        
        await db.close();
        logger.info('\n✅ Complete registration test finished successfully');
        
    } catch (error) {
        logger.error('❌ Test failed:', error);
    }
}

// Run the test
testCompleteRegistration();