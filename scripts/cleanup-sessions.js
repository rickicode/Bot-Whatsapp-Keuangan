const Logger = require('../src/utils/Logger');

class SessionCleanup {
    constructor() {
        this.logger = new Logger();
    }

    cleanupExpiredSessions() {
        const now = Date.now();
        let totalCleaned = 0;

        try {
            // Clean up pending transactions
            if (global.pendingTransactions) {
                const pendingBefore = global.pendingTransactions.size;
                for (const [userPhone, transaction] of global.pendingTransactions.entries()) {
                    if (now - transaction.timestamp > 180000) { // 3 minutes
                        global.pendingTransactions.delete(userPhone);
                        totalCleaned++;
                    }
                }
                const pendingAfter = global.pendingTransactions.size;
                if (pendingBefore > pendingAfter) {
                    this.logger.info(`Cleaned ${pendingBefore - pendingAfter} expired pending transactions`);
                }
            }

            // Clean up edit sessions
            if (global.editSessions) {
                const editBefore = global.editSessions.size;
                for (const [userPhone, session] of global.editSessions.entries()) {
                    if (now - session.timestamp > 600000) { // 10 minutes
                        global.editSessions.delete(userPhone);
                        totalCleaned++;
                    }
                }
                const editAfter = global.editSessions.size;
                if (editBefore > editAfter) {
                    this.logger.info(`Cleaned ${editBefore - editAfter} expired edit sessions`);
                }
            }

            // Clean up delete confirmations
            if (global.deleteConfirmations) {
                const deleteBefore = global.deleteConfirmations.size;
                for (const [userPhone, confirmation] of global.deleteConfirmations.entries()) {
                    if (now - confirmation.timestamp > 300000) { // 5 minutes
                        global.deleteConfirmations.delete(userPhone);
                        totalCleaned++;
                    }
                }
                const deleteAfter = global.deleteConfirmations.size;
                if (deleteBefore > deleteAfter) {
                    this.logger.info(`Cleaned ${deleteBefore - deleteAfter} expired delete confirmations`);
                }
            }

            // Clean up auto categorization suggestions
            if (global.autoCategorizationSuggestions) {
                const autoBefore = global.autoCategorizationSuggestions.size;
                for (const [userPhone, suggestions] of global.autoCategorizationSuggestions.entries()) {
                    if (now - suggestions.timestamp > 600000) { // 10 minutes
                        global.autoCategorizationSuggestions.delete(userPhone);
                        totalCleaned++;
                    }
                }
                const autoAfter = global.autoCategorizationSuggestions.size;
                if (autoBefore > autoAfter) {
                    this.logger.info(`Cleaned ${autoBefore - autoAfter} expired auto categorization suggestions`);
                }
            }

            return totalCleaned;

        } catch (error) {
            this.logger.error('Error during session cleanup:', error);
            return 0;
        }
    }

    getSessionStatistics() {
        const stats = {
            pendingTransactions: global.pendingTransactions ? global.pendingTransactions.size : 0,
            editSessions: global.editSessions ? global.editSessions.size : 0,
            deleteConfirmations: global.deleteConfirmations ? global.deleteConfirmations.size : 0,
            autoCategorizationSuggestions: global.autoCategorizationSuggestions ? global.autoCategorizationSuggestions.size : 0,
            total: 0
        };

        stats.total = stats.pendingTransactions + stats.editSessions + stats.deleteConfirmations + stats.autoCategorizationSuggestions;
        return stats;
    }

    forceCleanupAll() {
        let totalCleaned = 0;

        if (global.pendingTransactions) {
            totalCleaned += global.pendingTransactions.size;
            global.pendingTransactions.clear();
        }

        if (global.editSessions) {
            totalCleaned += global.editSessions.size;
            global.editSessions.clear();
        }

        if (global.deleteConfirmations) {
            totalCleaned += global.deleteConfirmations.size;
            global.deleteConfirmations.clear();
        }

        if (global.autoCategorizationSuggestions) {
            totalCleaned += global.autoCategorizationSuggestions.size;
            global.autoCategorizationSuggestions.clear();
        }

        this.logger.info(`Force cleaned all ${totalCleaned} sessions`);
        return totalCleaned;
    }

    showDetailedSessionInfo() {
        const now = Date.now();
        
        this.logger.info('📊 Detailed Session Information:');
        
        // Pending transactions
        if (global.pendingTransactions && global.pendingTransactions.size > 0) {
            this.logger.info(`\n📝 Pending Transactions (${global.pendingTransactions.size}):`);
            for (const [userPhone, transaction] of global.pendingTransactions.entries()) {
                const age = Math.floor((now - transaction.timestamp) / 1000);
                const retryCount = transaction.retryCount || 0;
                this.logger.info(`  • ${userPhone}: ${age}s old, ${retryCount} retries, ${transaction.type} ${transaction.amount}`);
            }
        }

        // Edit sessions
        if (global.editSessions && global.editSessions.size > 0) {
            this.logger.info(`\n✏️ Edit Sessions (${global.editSessions.size}):`);
            for (const [userPhone, session] of global.editSessions.entries()) {
                const age = Math.floor((now - session.timestamp) / 1000);
                this.logger.info(`  • ${userPhone}: ${age}s old, step: ${session.step}, txn: ${session.transactionId}`);
            }
        }

        // Delete confirmations
        if (global.deleteConfirmations && global.deleteConfirmations.size > 0) {
            this.logger.info(`\n🗑️ Delete Confirmations (${global.deleteConfirmations.size}):`);
            for (const [userPhone, confirmation] of global.deleteConfirmations.entries()) {
                const age = Math.floor((now - confirmation.timestamp) / 1000);
                this.logger.info(`  • ${userPhone}: ${age}s old, txn: ${confirmation.transactionId}`);
            }
        }

        // Auto categorization suggestions
        if (global.autoCategorizationSuggestions && global.autoCategorizationSuggestions.size > 0) {
            this.logger.info(`\n🏷️ Auto Categorization Suggestions (${global.autoCategorizationSuggestions.size}):`);
            for (const [userPhone, suggestions] of global.autoCategorizationSuggestions.entries()) {
                const age = Math.floor((now - suggestions.timestamp) / 1000);
                this.logger.info(`  • ${userPhone}: ${age}s old, ${suggestions.suggestions.length} suggestions`);
            }
        }

        if (this.getSessionStatistics().total === 0) {
            this.logger.info('✅ No active sessions found.');
        }
    }
}

// CLI interface
async function main() {
    const cleanup = new SessionCleanup();
    const command = process.argv[2] || 'stats';

    switch (command) {
        case 'stats':
            console.log('📊 Session Statistics:');
            const stats = cleanup.getSessionStatistics();
            console.log(`  Pending Transactions: ${stats.pendingTransactions}`);
            console.log(`  Edit Sessions: ${stats.editSessions}`);
            console.log(`  Delete Confirmations: ${stats.deleteConfirmations}`);
            console.log(`  Auto Categorization: ${stats.autoCategorizationSuggestions}`);
            console.log(`  Total Active Sessions: ${stats.total}`);
            break;

        case 'cleanup':
            console.log('🧹 Cleaning up expired sessions...');
            const cleaned = cleanup.cleanupExpiredSessions();
            console.log(`✅ Cleaned ${cleaned} expired sessions`);
            break;

        case 'force-clean':
            console.log('⚠️ Force cleaning ALL sessions...');
            const forceCleaned = cleanup.forceCleanupAll();
            console.log(`✅ Force cleaned ${forceCleaned} sessions`);
            break;

        case 'detail':
            cleanup.showDetailedSessionInfo();
            break;

        default:
            console.log('Usage: node scripts/cleanup-sessions.js [command]');
            console.log('Commands:');
            console.log('  stats      - Show session statistics (default)');
            console.log('  cleanup    - Clean expired sessions');
            console.log('  force-clean - Force clean ALL sessions');
            console.log('  detail     - Show detailed session information');
            break;
    }
}

// Export for use in other modules
module.exports = SessionCleanup;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}