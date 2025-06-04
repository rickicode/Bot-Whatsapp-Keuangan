// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const AIService = require('./src/services/AIService');
const IndonesianAIAssistant = require('./src/services/IndonesianAIAssistant');
const Logger = require('./src/utils/Logger');

async function testFinalRegistration() {
    const logger = new Logger();
    
    try {
        // Initialize services
        logger.info('🚀 Final registration test with unique data...');
        
        const db = new DatabaseManager();
        await db.initialize();
        
        const aiService = new AIService();
        const indonesianAI = new IndonesianAIAssistant(db, aiService);
        
        // Test phone number (new user)
        const testPhone = '6281111111111';
        const timestamp = Date.now();
        const uniqueEmail = `user${timestamp}@testdomain.com`;
        
        // Clean up any existing data
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
        
        logger.info('\n=== 🚀 Step 1: Initial contact ===');
        await indonesianAI.processMessage(createMockMessage('hello'), testPhone, 'hello');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        logger.info('\n=== 👤 Step 2: Provide name ===');
        await indonesianAI.processMessage(createMockMessage('Jane Smith'), testPhone, 'Jane Smith');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        logger.info(`\n=== 📧 Step 3: Provide unique email: ${uniqueEmail} ===`);
        await indonesianAI.processMessage(createMockMessage(uniqueEmail), testPhone, uniqueEmail);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        logger.info('\n=== 🏙️ Step 4: Provide city ===');
        await indonesianAI.processMessage(createMockMessage('Bandung'), testPhone, 'Bandung');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Check final status
        const status = await indonesianAI.checkUserStatus(testPhone);
        logger.info('\n👤 Final Status:', JSON.stringify(status, null, 2));
        
        logger.info('\n=== 🎯 Test accessing /menu after registration ===');
        const result = await indonesianAI.processMessage(createMockMessage('/menu'), testPhone, '/menu');
        logger.info(`Message handled by AI: ${result} (should be false if registration complete)`);
        
        // Test access control for registered user
        const accessCheck = await indonesianAI.checkAccessControl(testPhone);
        logger.info('\n🔐 Access Control for registered user:', JSON.stringify(accessCheck, null, 2));
        
        await db.close();
        logger.info('\n✅ Final registration test completed!');
        
    } catch (error) {
        logger.error('❌ Test failed:', error);
    }
}

// Run the test
testFinalRegistration();