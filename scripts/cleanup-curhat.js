#!/usr/bin/env node

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
            
            this.logger.info(`✅ Cleanup completed - ${deletedCount} old messages removed`);
            
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
