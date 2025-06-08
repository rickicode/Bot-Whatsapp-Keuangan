require('dotenv').config({ path: '.env' });
const DatabaseFactory = require('../src/database/DatabaseFactory');
const Logger = require('../src/utils/Logger');

class CurhatCleanupSetup {
    constructor() {
        this.logger = new Logger();
    }

    async setupCleanup() {
        let db = null;
        
        try {
            this.logger.info('🧹 Setting up Curhat History Auto-Cleanup System');
            this.logger.info('=================================================');
            
            // Initialize database
            db = DatabaseFactory.create();
            await db.initialize();
            this.logger.info('✅ Database connection established');

            // Create cleanup function
            await this.createCleanupFunction(db);
            
            // Test the cleanup function
            await this.testCleanupFunction(db);
            
            // Show statistics
            await this.showCurhatStats(db);
            
            this.logger.info('\n🎉 Curhat cleanup system setup completed!');
            this.logger.info('\n📋 Summary:');
            this.logger.info('   • PostgreSQL function created for auto-cleanup');
            this.logger.info('   • Data older than 30 days will be automatically removed');
            this.logger.info('   • Manual cleanup can be run with: node scripts/cleanup-curhat.js');
            
        } catch (error) {
            this.logger.error('❌ Error setting up curhat cleanup:', error);
            throw error;
        } finally {
            if (db) {
                await db.close();
            }
        }
    }

    async createCleanupFunction(db) {
        try {
            this.logger.info('\n🔧 Creating PostgreSQL cleanup function...');
            
            await db.scheduleCleanupCurhatHistory();
            
            this.logger.info('✅ PostgreSQL cleanup function created successfully');
            
        } catch (error) {
            this.logger.error('❌ Error creating cleanup function:', error);
            throw error;
        }
    }

    async testCleanupFunction(db) {
        try {
            this.logger.info('\n🧪 Testing cleanup function...');
            
            // Run cleanup function
            const result = await db.sql`SELECT cleanup_old_curhat_history() as deleted_count`;
            const deletedCount = result[0].deleted_count;
            
            this.logger.info(`✅ Cleanup function test completed - ${deletedCount} old records cleaned`);
            
        } catch (error) {
            this.logger.error('❌ Error testing cleanup function:', error);
            throw error;
        }
    }

    async showCurhatStats(db) {
        try {
            this.logger.info('\n📊 Current Curhat History Statistics:');
            
            // Get total records
            const totalResult = await db.sql`
                SELECT 
                    COUNT(*) as total_messages,
                    COUNT(DISTINCT user_phone) as unique_users,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    MIN(created_at) as oldest_message,
                    MAX(created_at) as newest_message
                FROM curhat_history
            `;
            
            if (totalResult[0].total_messages > 0) {
                const stats = totalResult[0];
                this.logger.info(`   • Total messages: ${stats.total_messages}`);
                this.logger.info(`   • Unique users: ${stats.unique_users}`);
                this.logger.info(`   • Unique sessions: ${stats.unique_sessions}`);
                this.logger.info(`   • Oldest message: ${stats.oldest_message}`);
                this.logger.info(`   • Newest message: ${stats.newest_message}`);
                
                // Get messages older than 30 days
                const oldResult = await db.sql`
                    SELECT COUNT(*) as old_messages
                    FROM curhat_history
                    WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
                `;
                
                this.logger.info(`   • Messages older than 30 days: ${oldResult[0].old_messages}`);
            } else {
                this.logger.info('   • No curhat messages found yet');
            }
            
        } catch (error) {
            this.logger.error('❌ Error getting curhat stats:', error);
        }
    }
}

// Create manual cleanup script
function createManualCleanupScript() {
    const logger = new Logger();
    
    const cleanupScript = `#!/usr/bin/env node

require('dotenv').config({ path: '.env' });
const DatabaseFactory = require('../src/database/DatabaseFactory');
const Logger = require('../src/utils/Logger');

class CurhatCleanup {
    constructor() {
        this.logger = new Logger();
    }

    async runCleanup() {
        let db = null;
        
        try {
            this.logger.info('🧹 Starting Curhat History Cleanup');
            this.logger.info('==================================');
            
            db = DatabaseFactory.create();
            await db.initialize();
            
            // Run cleanup
            const deletedCount = await db.cleanupOldCurhatHistory();
            
            this.logger.info(\`✅ Cleanup completed - \${deletedCount} old messages removed\`);
            
        } catch (error) {
            this.logger.error('❌ Cleanup failed:', error);
            process.exit(1);
        } finally {
            if (db) {
                await db.close();
            }
        }
    }
}

if (require.main === module) {
    const cleanup = new CurhatCleanup();
    cleanup.runCleanup().catch(console.error);
}

module.exports = CurhatCleanup;
`;

    require('fs').writeFileSync('scripts/cleanup-curhat.js', cleanupScript);
    logger.info('✅ Created manual cleanup script: scripts/cleanup-curhat.js');
}

// Run setup
if (require.main === module) {
    const setup = new CurhatCleanupSetup();
    
    // Create manual cleanup script
    createManualCleanupScript();
    
    // Setup auto-cleanup system
    setup.setupCleanup().catch(console.error);
}

module.exports = CurhatCleanupSetup;