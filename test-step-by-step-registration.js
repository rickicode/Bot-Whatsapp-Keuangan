// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const AIService = require('./src/services/AIService');
const IndonesianAIAssistant = require('./src/services/IndonesianAIAssistant');
const Logger = require('./src/utils/Logger');

async function testStepByStepRegistration() {
    const logger = new Logger();
    
    try {
        // Initialize services
        logger.info('🚀 Testing step-by-step registration flow...');
        
        const db = new DatabaseManager();
        await db.initialize();
        
        const aiService = new AIService();
        const indonesianAI = new IndonesianAIAssistant(db, aiService);
        
        // Test phone number (new user)
        const testPhone = '6281234567890';
        
        // Clean up any existing registration session
        try {
            await db.deleteRegistrationSession(testPhone);
        } catch (e) {
            // Ignore if session doesn't exist
        }
        
        // Mock message object factory
        const createMockMessage = (body) => ({
            from: `${testPhone}@s.whatsapp.net`,
            body: body,
            reply: async (text) => {
                logger.info(`🤖 Bot Reply: ${text}`);
            }
        });
        
        logger.info('\n=== 🚀 Step 1: User starts conversation ===');
        let result = await indonesianAI.processMessage(createMockMessage('halo'), testPhone, 'halo');
        logger.info(`Handled by AI: ${result}`);
        
        // Check current status
        let status = await indonesianAI.checkUserStatus(testPhone);
        logger.info(`Current step: ${status.registrationSession?.step}`);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.info('\n=== 👤 Step 2: User provides name ===');
        result = await indonesianAI.processMessage(createMockMessage('John Doe Test'), testPhone, 'John Doe Test');
        logger.info(`Handled by AI: ${result}`);
        
        status = await indonesianAI.checkUserStatus(testPhone);
        logger.info(`Current step: ${status.registrationSession?.step}`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.info('\n=== 📧 Step 3: User provides email ===');
        result = await indonesianAI.processMessage(createMockMessage('john.test@example.com'), testPhone, 'john.test@example.com');
        logger.info(`Handled by AI: ${result}`);
        
        status = await indonesianAI.checkUserStatus(testPhone);
        logger.info(`Current step: ${status.registrationSession?.step}`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        logger.info('\n=== 🏙️ Step 4: User provides city ===');
        result = await indonesianAI.processMessage(createMockMessage('Jakarta'), testPhone, 'Jakarta');
        logger.info(`Handled by AI: ${result}`);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check final user status
        status = await indonesianAI.checkUserStatus(testPhone);
        logger.info('\n👤 Final User Status:', JSON.stringify(status, null, 2));
        
        logger.info('\n=== 🎯 Step 5: Test registered user access ===');
        result = await indonesianAI.processMessage(createMockMessage('/menu'), testPhone, '/menu');
        logger.info(`Handled by AI: ${result} (should be false if registration completed)`);
        
        // Test access control
        const accessCheck = await indonesianAI.checkAccessControl(testPhone);
        logger.info('\n🔐 Access Control:', JSON.stringify(accessCheck, null, 2));
        
        await db.close();
        logger.info('\n✅ Step-by-step registration test completed successfully');
        
    } catch (error) {
        logger.error('❌ Test failed:', error);
    }
}

// Run the test
testStepByStepRegistration();