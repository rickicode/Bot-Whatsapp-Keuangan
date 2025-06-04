// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const Logger = require('./src/utils/Logger');

async function debugEmailCheck() {
    const logger = new Logger();
    
    try {
        logger.info('🔍 Debugging email uniqueness check...');
        
        const db = new DatabaseManager();
        await db.initialize();
        
        // Check what emails exist in the database
        logger.info('\n📋 Current emails in database:');
        const emails = await db.all('SELECT phone, email FROM users WHERE email IS NOT NULL');
        logger.info('Existing emails:', emails);
        
        // Test specific emails
        const testEmails = [
            'unique123456@test.com',
            'never.used@domain.xyz',
            'totally.new@email.com'
        ];
        
        for (const email of testEmails) {
            logger.info(`\n🧪 Testing email: ${email}`);
            
            const result = await db.get(
                'SELECT COUNT(*) as count FROM users WHERE email = $1',
                [email]
            );
            logger.info(`Count result: ${result.count}`);
            
            const isUnique = await db.isEmailUnique(email, '6281111111111');
            logger.info(`isEmailUnique result: ${isUnique}`);
        }
        
        await db.close();
        logger.info('\n✅ Debug completed');
        
    } catch (error) {
        logger.error('❌ Debug failed:', error);
    }
}

// Run the debug
debugEmailCheck();