// Load environment variables
require('dotenv').config({ path: '.env' });

const DatabaseManager = require('./src/database/DatabaseManager');
const Logger = require('./src/utils/Logger');

async function updateSubscriptionLimits() {
    const logger = new Logger();
    
    try {
        logger.info('🔄 Updating subscription plan limits...');
        
        const db = new DatabaseManager();
        await db.initialize();
        
        // Update Free Plan limit from 10 to 50
        await db.run(
            'UPDATE subscription_plans SET monthly_transaction_limit = $1 WHERE name = $2',
            [50, 'free']
        );
        
        logger.info('✅ Updated Free Plan transaction limit to 50/month');
        
        // Verify the update
        const freePlan = await db.get('SELECT * FROM subscription_plans WHERE name = $1', ['free']);
        logger.info('📋 Updated Free Plan:', freePlan);
        
        await db.close();
        logger.info('✅ Subscription limits updated successfully');
        
    } catch (error) {
        logger.error('❌ Update failed:', error);
    }
}

// Run the update
updateSubscriptionLimits();