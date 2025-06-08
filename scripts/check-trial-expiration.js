/**
 * Trial Expiration Checker
 * Script untuk mengecek dan menangani trial yang sudah expired
 * Bisa dijalankan sebagai cron job atau scheduled task
 */

const DatabaseManager = require('../src/database/DatabaseManager');
const Logger = require('../src/utils/Logger');

class TrialExpirationChecker {
    constructor() {
        this.db = new DatabaseManager();
        this.logger = new Logger();
    }

    async initialize() {
        await this.db.initialize();
        this.logger.info('Trial Expiration Checker initialized');
    }

    async checkAllTrials() {
        try {
            this.logger.info('Starting trial expiration check...');

            // Get all users with active trials
            const activeTrials = await this.db.all(`
                SELECT us.user_phone, us.trial_end, u.name
                FROM user_subscriptions us
                JOIN users u ON us.user_phone = u.phone
                WHERE us.is_trial = true 
                AND us.trial_expired = false
                AND us.trial_end <= NOW()
            `);

            this.logger.info(`Found ${activeTrials.length} expired trials to process`);

            let processedCount = 0;
            let errorCount = 0;

            for (const trial of activeTrials) {
                try {
                    await this.db.expireTrialAndMoveToFree(trial.user_phone);
                    
                    this.logger.info(`✅ Processed trial expiration for user ${trial.user_phone} (${trial.name})`);
                    processedCount++;
                    
                    // Optional: Send notification to user about trial expiration
                    // This would require WhatsApp client integration
                    // await this.sendTrialExpirationNotification(trial.user_phone, trial.name);
                    
                } catch (error) {
                    this.logger.error(`❌ Error processing trial expiration for user ${trial.user_phone}:`, error);
                    errorCount++;
                }
            }

            this.logger.info(`Trial expiration check completed: ${processedCount} processed, ${errorCount} errors`);
            
            return {
                totalExpired: activeTrials.length,
                processed: processedCount,
                errors: errorCount
            };

        } catch (error) {
            this.logger.error('Error in trial expiration check:', error);
            throw error;
        }
    }

    async getTrialStatistics() {
        try {
            const stats = await this.db.get(`
                SELECT 
                    COUNT(*) FILTER (WHERE is_trial = true AND trial_expired = false AND trial_end > NOW()) as active_trials,
                    COUNT(*) FILTER (WHERE is_trial = true AND trial_expired = false AND trial_end <= NOW()) as expired_trials,
                    COUNT(*) FILTER (WHERE is_trial = true AND trial_expired = true) as processed_expired_trials,
                    COUNT(*) FILTER (WHERE plan_id = (SELECT id FROM subscription_plans WHERE name = 'free')) as free_users,
                    COUNT(*) FILTER (WHERE plan_id = (SELECT id FROM subscription_plans WHERE name = 'premium')) as premium_users
                FROM user_subscriptions
            `);

            return {
                activeTrials: parseInt(stats.active_trials || 0),
                expiredTrials: parseInt(stats.expired_trials || 0),
                processedExpiredTrials: parseInt(stats.processed_expired_trials || 0),
                freeUsers: parseInt(stats.free_users || 0),
                premiumUsers: parseInt(stats.premium_users || 0)
            };
        } catch (error) {
            this.logger.error('Error getting trial statistics:', error);
            throw error;
        }
    }

    async sendTrialExpirationNotification(userPhone, userName) {
        // Placeholder for sending WhatsApp notification
        // This would require WhatsApp client integration
        this.logger.info(`Would send trial expiration notification to ${userPhone} (${userName})`);
        
        /* Example implementation with WhatsApp client:
        const message = `
🎁 Halo ${userName}!

⏰ Trial gratis 30 hari Anda telah berakhir.

🔄 Akun Anda otomatis pindah ke Free Plan:
• 📊 50 transaksi per hari
• 💰 Fitur dasar keuangan

🚀 Upgrade ke Premium untuk:
• ∞ Unlimited transaksi
• 📈 Laporan advanced  
• 🤖 AI analisis
• 📤 Export data

💡 Ketik "upgrade" untuk info lebih lanjut!
        `;

        // await whatsappClient.sendMessage(userPhone, message);
        */
    }

    async cleanup() {
        await this.db.close();
        this.logger.info('Trial Expiration Checker cleaned up');
    }
}

// CLI Usage
async function main() {
    const checker = new TrialExpirationChecker();
    
    try {
        await checker.initialize();
        
        // Check command line arguments
        const args = process.argv.slice(2);
        const command = args[0];

        switch (command) {
            case 'check':
                const result = await checker.checkAllTrials();
                console.log('Trial Expiration Check Results:', result);
                break;
                
            case 'stats':
                const stats = await checker.getTrialStatistics();
                console.log('Trial Statistics:', stats);
                break;
                
            case 'help':
            default:
                console.log(`
Trial Expiration Checker Commands:

node scripts/check-trial-expiration.js check  - Check and process expired trials
node scripts/check-trial-expiration.js stats  - Show trial statistics
node scripts/check-trial-expiration.js help   - Show this help

Cron Job Example (daily at 6 AM):
0 6 * * * cd /path/to/project && node scripts/check-trial-expiration.js check
                `);
                break;
        }
        
    } catch (error) {
        console.error('Error in trial expiration checker:', error);
        process.exit(1);
    } finally {
        await checker.cleanup();
    }
}

// Export for use as module
module.exports = TrialExpirationChecker;

// Run if called directly
if (require.main === module) {
    main();
}