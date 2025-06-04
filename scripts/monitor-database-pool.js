const DatabaseManager = require('../src/database/DatabaseManager');
const Logger = require('../src/utils/Logger');

class DatabasePoolMonitor {
    constructor() {
        this.db = new DatabaseManager();
        this.logger = new Logger();
        this.isRunning = false;
        this.intervalId = null;
    }

    async initialize() {
        try {
            await this.db.initialize();
            this.logger.info('Database pool monitor initialized');
        } catch (error) {
            this.logger.error('Failed to initialize database pool monitor:', error);
            throw error;
        }
    }

    async startMonitoring(intervalSeconds = 30) {
        if (this.isRunning) {
            this.logger.warn('Pool monitoring is already running');
            return;
        }

        this.isRunning = true;
        this.logger.info(`Starting database pool monitoring every ${intervalSeconds} seconds`);

        // Initial health check
        await this.performHealthCheck();

        this.intervalId = setInterval(async () => {
            try {
                await this.performHealthCheck();
                await this.logPoolStatistics();
            } catch (error) {
                this.logger.error('Error during pool monitoring:', error);
            }
        }, intervalSeconds * 1000);
    }

    async stopMonitoring() {
        if (!this.isRunning) {
            this.logger.warn('Pool monitoring is not running');
            return;
        }

        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.logger.info('Database pool monitoring stopped');
        await this.db.close();
    }

    async performHealthCheck() {
        try {
            const healthStatus = await this.db.healthCheck();
            
            if (healthStatus.status === 'healthy') {
                this.logger.info('Database health check: HEALTHY', {
                    responseTime: healthStatus.responseTime + 'ms',
                    timestamp: healthStatus.timestamp
                });
            } else {
                this.logger.error('Database health check: UNHEALTHY', {
                    error: healthStatus.error,
                    timestamp: healthStatus.timestamp
                });
            }

            return healthStatus;
        } catch (error) {
            this.logger.error('Health check failed:', error);
            return { status: 'error', error: error.message };
        }
    }

    async logPoolStatistics() {
        try {
            const stats = await this.db.getPoolStats();
            
            if (stats) {
                this.logger.info('Database Pool Statistics:', {
                    totalConnections: stats.totalCount,
                    idleConnections: stats.idleCount,
                    waitingRequests: stats.waitingCount,
                    maxConnections: stats.max,
                    minConnections: stats.min,
                    utilizationRate: ((stats.totalCount - stats.idleCount) / stats.max * 100).toFixed(2) + '%'
                });

                // Alert if pool utilization is high
                const utilizationRate = (stats.totalCount - stats.idleCount) / stats.max;
                if (utilizationRate > 0.8) {
                    this.logger.warn('High database pool utilization detected!', {
                        utilizationRate: (utilizationRate * 100).toFixed(2) + '%',
                        recommendation: 'Consider increasing DB_POOL_MAX or optimizing queries'
                    });
                }

                // Alert if many requests are waiting
                if (stats.waitingCount > 5) {
                    this.logger.warn('Many requests waiting for database connections!', {
                        waitingCount: stats.waitingCount,
                        recommendation: 'Consider increasing pool size or optimizing query performance'
                    });
                }
            }
        } catch (error) {
            this.logger.error('Failed to get pool statistics:', error);
        }
    }

    async generateReport() {
        try {
            const healthStatus = await this.performHealthCheck();
            const stats = await this.db.getPoolStats();

            const report = {
                timestamp: new Date().toISOString(),
                health: healthStatus,
                poolStats: stats,
                recommendations: this.generateRecommendations(stats)
            };

            this.logger.info('Database Pool Report:', report);
            return report;
        } catch (error) {
            this.logger.error('Failed to generate pool report:', error);
            throw error;
        }
    }

    generateRecommendations(stats) {
        const recommendations = [];

        if (!stats) {
            recommendations.push('Pool statistics not available - check database connection');
            return recommendations;
        }

        const utilizationRate = (stats.totalCount - stats.idleCount) / stats.max;

        if (utilizationRate > 0.9) {
            recommendations.push('Very high pool utilization (>90%) - increase DB_POOL_MAX');
        } else if (utilizationRate > 0.8) {
            recommendations.push('High pool utilization (>80%) - monitor closely and consider increasing pool size');
        }

        if (stats.waitingCount > 10) {
            recommendations.push('Too many waiting requests - increase pool size or optimize queries');
        }

        if (stats.idleCount > stats.max * 0.7) {
            recommendations.push('Many idle connections - consider reducing DB_POOL_MIN');
        }

        if (stats.totalCount < stats.min) {
            recommendations.push('Pool below minimum size - check pool configuration');
        }

        if (recommendations.length === 0) {
            recommendations.push('Pool performance looks good!');
        }

        return recommendations;
    }
}

// CLI interface
async function main() {
    const monitor = new DatabasePoolMonitor();
    
    try {
        await monitor.initialize();

        const command = process.argv[2] || 'monitor';
        const duration = parseInt(process.argv[3]) || 30;

        switch (command) {
            case 'monitor':
                console.log('Starting database pool monitoring...');
                console.log('Press Ctrl+C to stop');
                
                await monitor.startMonitoring(duration);
                
                // Handle graceful shutdown
                process.on('SIGINT', async () => {
                    console.log('\nStopping monitor...');
                    await monitor.stopMonitoring();
                    process.exit(0);
                });
                break;

            case 'check':
                console.log('Performing single health check...');
                const health = await monitor.performHealthCheck();
                await monitor.logPoolStatistics();
                await monitor.stopMonitoring();
                break;

            case 'report':
                console.log('Generating pool report...');
                await monitor.generateReport();
                await monitor.stopMonitoring();
                break;

            default:
                console.log('Usage: node scripts/monitor-database-pool.js [monitor|check|report] [interval_seconds]');
                console.log('  monitor: Start continuous monitoring (default)');
                console.log('  check: Perform single health check');
                console.log('  report: Generate detailed report');
                await monitor.stopMonitoring();
                break;
        }
    } catch (error) {
        console.error('Monitor error:', error);
        await monitor.stopMonitoring();
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = DatabasePoolMonitor;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}