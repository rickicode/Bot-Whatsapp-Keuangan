// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const Logger = require('./src/utils/Logger');

async function debugCountType() {
    const logger = new Logger();
    
    try {
        logger.info('🔍 Debugging count return type...');
        
        const db = new DatabaseManager();
        await db.initialize();
        
        const email = 'test.unique@example.com';
        const phone = '6281111111111';
        
        // Test the exact query from isEmailUnique
        const result = await db.get(
            'SELECT COUNT(*) as count FROM users WHERE email = $1 AND phone != $2',
            [email, phone]
        );
        
        logger.info('Result object:', result);
        logger.info('Count value:', result.count);
        logger.info('Count type:', typeof result.count);
        logger.info('Count === 0:', result.count === 0);
        logger.info('Count == 0:', result.count == 0);
        logger.info('Number(count) === 0:', Number(result.count) === 0);
        
        await db.close();
        logger.info('\n✅ Debug completed');
        
    } catch (error) {
        logger.error('❌ Debug failed:', error);
    }
}

// Run the debug
debugCountType();