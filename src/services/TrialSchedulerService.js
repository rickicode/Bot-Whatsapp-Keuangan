/**
 * Trial Scheduler Service
 * Service untuk menjalankan scheduled task trial expiration menggunakan node-cron
 */

const cron = require('node-cron');
const Logger = require('../utils/Logger');
const TrialExpirationChecker = require('../../scripts/check-trial-expiration');

class TrialSchedulerService {
    constructor(database) {
        this.db = database;
        this.logger = new Logger();
        this.checker = new TrialExpirationChecker();
        this.jobs = new Map();
        this.isRunning = false;
    }

    /**
     * Initialize and start all scheduled tasks
     */
    async initialize() {
        try {
            // Initialize trial checker with database
            await this.checker.initialize();
            
            this.logger.info('Trial Scheduler Service initialized');
            this.startScheduledTasks();
            
        } catch (error) {
            this.logger.error('Error initializing Trial Scheduler Service:', error);
            throw error;
        }
    }

    /**
     * Start all scheduled tasks
     */
    startScheduledTasks() {
        try {
            // Daily trial expiration check at 6:00 AM
            this.scheduleDailyTrialCheck();
            
            // Hourly trial statistics update (optional)
            this.scheduleHourlyStatsUpdate();
            
            // Weekly trial cleanup (optional)
            this.scheduleWeeklyCleanup();
            
            this.isRunning = true;
            this.logger.info('All trial scheduled tasks started successfully');
            
        } catch (error) {
            this.logger.error('Error starting scheduled tasks:', error);
            throw error;
        }
    }

    /**
     * Schedule daily trial expiration check at 6:00 AM
     */
    scheduleDailyTrialCheck() {
        const jobName = 'daily_trial_check';
        
        // Cron expression: '0 6 * * *' = Every day at 6:00 AM
        const task = cron.schedule('0 6 * * *', async () => {
            try {
                this.logger.info('Starting scheduled daily trial expiration check...');
                
                const result = await this.checker.checkAllTrials();
                
                this.logger.info('Daily trial check completed:', {
                    totalExpired: result.totalExpired,
                    processed: result.processed,
                    errors: result.errors
                });
                
                // Optional: Send summary to admin if needed
                if (result.totalExpired > 0) {
                    await this.notifyAdminTrialSummary(result);
                }
                
            } catch (error) {
                this.logger.error('Error in scheduled daily trial check:', error);
            }
        }, {
            scheduled: false, // Don't start immediately
            timezone: process.env.TZ || 'Asia/Jakarta'
        });

        this.jobs.set(jobName, task);
        task.start();
        
        this.logger.info(`Scheduled daily trial check at 6:00 AM (${process.env.TZ || 'Asia/Jakarta'})`);
    }

    /**
     * Schedule hourly trial statistics update (optional)
     */
    scheduleHourlyStatsUpdate() {
        const jobName = 'hourly_stats_update';
        
        // Cron expression: '0 * * * *' = Every hour at minute 0
        const task = cron.schedule('0 * * * *', async () => {
            try {
                this.logger.info('Starting hourly trial statistics update...');
                
                const stats = await this.checker.getTrialStatistics();
                
                // Log statistics for monitoring
                this.logger.info('Trial Statistics:', stats);
                
                // Optional: Store stats in database for analytics
                await this.storeTrialStatistics(stats);
                
            } catch (error) {
                this.logger.error('Error in hourly stats update:', error);
            }
        }, {
            scheduled: false,
            timezone: process.env.TZ || 'Asia/Jakarta'
        });

        this.jobs.set(jobName, task);
        task.start();
        
        this.logger.info('Scheduled hourly trial statistics update');
    }

    /**
     * Schedule weekly cleanup of expired data (optional)
     */
    scheduleWeeklyCleanup() {
        const jobName = 'weekly_cleanup';
        
        // Cron expression: '0 2 * * 0' = Every Sunday at 2:00 AM
        const task = cron.schedule('0 2 * * 0', async () => {
            try {
                this.logger.info('Starting weekly trial cleanup...');
                
                // Cleanup old registration sessions (older than 30 days)
                await this.cleanupOldRegistrationSessions();
                
                // Optional: Cleanup other trial-related data
                await this.cleanupTrialLogs();
                
                this.logger.info('Weekly trial cleanup completed');
                
            } catch (error) {
                this.logger.error('Error in weekly cleanup:', error);
            }
        }, {
            scheduled: false,
            timezone: process.env.TZ || 'Asia/Jakarta'
        });

        this.jobs.set(jobName, task);
        task.start();
        
        this.logger.info('Scheduled weekly cleanup every Sunday at 2:00 AM');
    }

    /**
     * Stop all scheduled tasks
     */
    stopScheduledTasks() {
        this.jobs.forEach((task, jobName) => {
            task.stop();
            this.logger.info(`Stopped scheduled task: ${jobName}`);
        });
        
        this.jobs.clear();
        this.isRunning = false;
        this.logger.info('All scheduled tasks stopped');
    }

    /**
     * Get status of all scheduled tasks
     */
    getSchedulerStatus() {
        const status = {
            isRunning: this.isRunning,
            totalJobs: this.jobs.size,
            jobs: []
        };

        this.jobs.forEach((task, jobName) => {
            status.jobs.push({
                name: jobName,
                running: task.running || false,
                scheduled: task.scheduled || false
            });
        });

        return status;
    }

    /**
     * Manually trigger trial expiration check
     */
    async manualTrialCheck() {
        try {
            this.logger.info('Manual trial expiration check triggered');
            
            const result = await this.checker.checkAllTrials();
            
            this.logger.info('Manual trial check completed:', result);
            return result;
            
        } catch (error) {
            this.logger.error('Error in manual trial check:', error);
            throw error;
        }
    }

    /**
     * Store trial statistics for analytics (optional)
     */
    async storeTrialStatistics(stats) {
        try {
            // Optional: Store in database for trend analysis
            const timestamp = new Date().toISOString();
            
            // Example implementation - could be enhanced based on needs
            this.logger.debug('Trial statistics stored:', { timestamp, ...stats });
            
        } catch (error) {
            this.logger.error('Error storing trial statistics:', error);
        }
    }

    /**
     * Notify admin about trial expiration summary (optional)
     */
    async notifyAdminTrialSummary(result) {
        try {
            // Optional: Send notification to admin about daily trial expirations
            // This could be WhatsApp message, email, or webhook
            
            const message = `
📊 Daily Trial Expiration Summary

⏰ Date: ${new Date().toLocaleDateString('id-ID')}
🔄 Total Expired: ${result.totalExpired}
✅ Successfully Processed: ${result.processed}
❌ Errors: ${result.errors}

${result.errors > 0 ? '⚠️ Please check logs for error details' : '✅ All trials processed successfully'}
            `;

            this.logger.info('Trial summary prepared for admin:', message);
            
            // TODO: Implement actual notification mechanism if needed
            // await this.sendAdminNotification(message);
            
        } catch (error) {
            this.logger.error('Error notifying admin:', error);
        }
    }

    /**
     * Cleanup old registration sessions
     */
    async cleanupOldRegistrationSessions() {
        try {
            const result = await this.db.run(
                'DELETE FROM registration_sessions WHERE created_at < NOW() - INTERVAL \'30 days\'',
                []
            );
            
            this.logger.info(`Cleaned up old registration sessions: ${result.rowCount || 0} deleted`);
            
        } catch (error) {
            this.logger.error('Error cleaning up registration sessions:', error);
        }
    }

    /**
     * Cleanup trial logs (optional)
     */
    async cleanupTrialLogs() {
        try {
            // Optional: Cleanup old log entries, temporary data, etc.
            this.logger.info('Trial logs cleanup completed');
            
        } catch (error) {
            this.logger.error('Error cleaning up trial logs:', error);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        try {
            this.logger.info('Shutting down Trial Scheduler Service...');
            
            // Stop all scheduled tasks
            this.stopScheduledTasks();
            
            // Cleanup trial checker
            if (this.checker) {
                await this.checker.cleanup();
            }
            
            this.logger.info('Trial Scheduler Service shutdown completed');
            
        } catch (error) {
            this.logger.error('Error during scheduler shutdown:', error);
        }
    }

    /**
     * Health check for scheduler
     */
    async healthCheck() {
        return {
            status: this.isRunning ? 'healthy' : 'stopped',
            totalJobs: this.jobs.size,
            jobsRunning: Array.from(this.jobs.values()).filter(task => task.running).length,
            lastCheck: new Date().toISOString()
        };
    }
}

module.exports = TrialSchedulerService;