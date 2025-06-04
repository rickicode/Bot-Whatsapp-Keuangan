// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const IndonesianAIAssistant = require('./src/services/IndonesianAIAssistant');
const Logger = require('./src/utils/Logger');

async function testEmailValidation() {
    const logger = new Logger();
    
    try {
        logger.info('🔍 Testing email validation...');
        
        const db = new DatabaseManager();
        await db.initialize();
        
        const indonesianAI = new IndonesianAIAssistant(db, null);
        
        const testEmails = [
            'test@example.com',
            'user123@gmail.com',
            'jane.doe@company.co.id',
            'test+tag@domain.org',
            'simple@test.net'
        ];
        
        for (const email of testEmails) {
            logger.info(`\n🧪 Testing email: ${email}`);
            
            try {
                const validation = await indonesianAI.validateEmail(email, '6281111111111');
                logger.info(`✅ Validation result:`, validation);
            } catch (error) {
                logger.error(`❌ Validation error:`, error);
            }
        }
        
        // Test email uniqueness check directly
        logger.info('\n🔍 Direct email uniqueness check...');
        const isUnique = await db.isEmailUnique('newtest@example.com', '6281111111111');
        logger.info(`Email uniqueness result: ${isUnique}`);
        
        await db.close();
        logger.info('\n✅ Email validation test completed');
        
    } catch (error) {
        logger.error('❌ Test failed:', error);
    }
}

// Run the test
testEmailValidation();