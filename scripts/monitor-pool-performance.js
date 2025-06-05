#!/usr/bin/env node

/**
 * PostgreSQL Transaction Pooler Performance Monitor
 * 
 * Script untuk monitoring real-time performa Connection Pool PostgreSQL
 * dalam WhatsApp Financial Bot
 */

const DatabaseManager = require('../src/database/DatabaseManager');
const Logger = require('../src/utils/Logger');

class PoolPerformanceMonitor {
    constructor() {
        this.logger = new Logger();
        this.dbManager = new DatabaseManager();
        this.monitoringInterval = null;
        this.startTime = Date.now();
        this.previousStats = null;
        this.alertThresholds = {
            poolUtilization: 85,      // Alert if > 85%
            errorRate: 5,             // Alert if > 5%
            avgQueryTime: 1000,       // Alert if > 1000ms
            connectionFailures: 10     // Alert if > 10 failures
        };
    }

    async initialize() {
        try {
            await this.dbManager.initialize();
            this.logger.info('🚀 Pool Performance Monitor initialized successfully');
            return true;
        } catch (error) {
            this.logger.error('❌ Failed to initialize Pool Performance Monitor:', error);
            return false;
        }
    }

    async startMonitoring(intervalSeconds = 30) {
        if (!await this.initialize()) {
            process.exit(1);
        }

        this.logger.info(`📊 Starting Pool Performance Monitoring (interval: ${intervalSeconds}s)`);
        this.logger.info('🔧 Alert Thresholds:', this.alertThresholds);
        
        // Initial stats
        await this.collectAndDisplayStats();
        
        // Set up periodic monitoring
        this.monitoringInterval = setInterval(async () => {
            await this.collectAndDisplayStats();
        }, intervalSeconds * 1000);

        // Handle graceful shutdown
        process.on('SIGINT', () => this.stopMonitoring());
        process.on('SIGTERM', () => this.stopMonitoring());
    }

    async collectAndDisplayStats() {
        try {
            const currentTime = new Date();
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            
            // Get pool statistics
            const poolStats = await this.dbManager.getPoolStats();
            const healthCheck = await this.dbManager.healthCheck();
            
            if (!poolStats) {
                this.logger.warn('⚠️  Pool statistics not available (using SQLite?)');
                return;
            }

            // Calculate deltas if we have previous stats
            const deltas = this.calculateDeltas(poolStats);
            
            // Display comprehensive stats
            this.displayHeader(currentTime, uptime);
            this.displayPoolStats(poolStats, healthCheck);
            this.displayPerformanceMetrics(poolStats, deltas);
            this.displayHealthIndicators(poolStats, healthCheck);
            
            // Check for alerts
            this.checkAlerts(poolStats, healthCheck);
            
            // Store current stats for next comparison
            this.previousStats = { ...poolStats, timestamp: Date.now() };
            
        } catch (error) {
            this.logger.error('❌ Error collecting pool statistics:', error);
        }
    }

    calculateDeltas(currentStats) {
        if (!this.previousStats) return null;
        
        const timeDiff = (Date.now() - this.previousStats.timestamp) / 1000; // seconds
        
        return {
            queriesPerSecond: Math.round((currentStats.queriesExecuted - this.previousStats.queriesExecuted) / timeDiff),
            connectionsCreatedPerSecond: Math.round((currentStats.connectionsCreated - this.previousStats.connectionsCreated) / timeDiff),
            errorsPerSecond: Math.round((currentStats.errorsCount - this.previousStats.errorsCount) / timeDiff),
            timePeriod: timeDiff
        };
    }

    displayHeader(currentTime, uptime) {
        console.log('\n' + '='.repeat(80));
        console.log(`📊 PostgreSQL Transaction Pooler Performance Monitor`);
        console.log(`🕐 ${currentTime.toISOString()} | ⏱️  Uptime: ${this.formatUptime(uptime)}`);
        console.log('='.repeat(80));
    }

    displayPoolStats(stats, health) {
        console.log(`\n🏊 POOL STATISTICS:`);
        console.log(`   Total Connections: ${stats.totalCount}/${stats.max} (${stats.poolUtilization})`);
        console.log(`   Idle Connections:  ${stats.idleCount} (${stats.poolEfficiency})`);
        console.log(`   Waiting Clients:   ${stats.waitingCount}`);
        console.log(`   Min Pool Size:     ${stats.min}`);
        
        console.log(`\n📈 CONNECTION LIFECYCLE:`);
        console.log(`   Created:           ${stats.connectionsCreated}`);
        console.log(`   Destroyed:         ${stats.connectionsDestroyed}`);
        console.log(`   Net Growth:        ${stats.connectionsCreated - stats.connectionsDestroyed}`);
        console.log(`   Reuse Ratio:       ${this.calculateReuseRatio(stats)}`);
    }

    displayPerformanceMetrics(stats, deltas) {
        console.log(`\n⚡ PERFORMANCE METRICS:`);
        console.log(`   Total Queries:     ${stats.queriesExecuted}`);
        console.log(`   Average Query Time: ${stats.avgQueryTime.toFixed(2)}ms`);
        console.log(`   Total Errors:      ${stats.errorsCount}`);
        console.log(`   Error Rate:        ${this.calculateErrorRate(stats)}%`);
        
        if (deltas) {
            console.log(`\n📊 CURRENT THROUGHPUT (${deltas.timePeriod}s period):`);
            console.log(`   Queries/sec:       ${deltas.queriesPerSecond}`);
            console.log(`   New Connections/s: ${deltas.connectionsCreatedPerSecond}`);
            console.log(`   Errors/sec:        ${deltas.errorsPerSecond}`);
        }
    }

    displayHealthIndicators(stats, health) {
        const healthIcon = health.status === 'healthy' ? '🟢' : '🔴';
        const poolHealthIcon = stats.connectionHealth === 'healthy' ? '🟢' : 
                              stats.connectionHealth === 'degraded' ? '🟡' : '🔴';
        
        console.log(`\n${healthIcon} HEALTH STATUS:`);
        console.log(`   Database:          ${health.status} (${health.responseTime}ms)`);
        console.log(`   Pool Health:       ${poolHealthIcon} ${stats.connectionHealth}`);
        
        if (health.transactionPoolerStatus) {
            const tps = health.transactionPoolerStatus;
            console.log(`   Optimal Pool Size: ${tps.optimalPoolSize ? '✅' : '❌'}`);
            console.log(`   Connection Reuse:  ${tps.connectionReuse ? '✅' : '❌'}`);
            console.log(`   Error Rate:        ${tps.errorRate}`);
            console.log(`   Pool Stability:    ${tps.poolStability ? '✅' : '❌'}`);
        }
        
        console.log(`   Last Health Check: ${stats.lastHealthCheck || 'N/A'}`);
    }

    checkAlerts(stats, health) {
        const alerts = [];
        
        // Check pool utilization
        const utilizationPercent = parseFloat(stats.poolUtilization.replace('%', ''));
        if (utilizationPercent > this.alertThresholds.poolUtilization) {
            alerts.push(`🚨 HIGH POOL UTILIZATION: ${stats.poolUtilization}`);
        }
        
        // Check error rate
        const errorRate = this.calculateErrorRate(stats);
        if (errorRate > this.alertThresholds.errorRate) {
            alerts.push(`🚨 HIGH ERROR RATE: ${errorRate}%`);
        }
        
        // Check average query time
        if (stats.avgQueryTime > this.alertThresholds.avgQueryTime) {
            alerts.push(`🚨 SLOW QUERIES: ${stats.avgQueryTime.toFixed(2)}ms avg`);
        }
        
        // Check for database health
        if (health.status !== 'healthy') {
            alerts.push(`🚨 DATABASE UNHEALTHY: ${health.status}`);
        }
        
        // Check response time
        if (health.responseTime > 5000) {
            alerts.push(`🚨 SLOW DATABASE RESPONSE: ${health.responseTime}ms`);
        }
        
        // Display alerts
        if (alerts.length > 0) {
            console.log(`\n🚨 ALERTS:`);
            alerts.forEach(alert => console.log(`   ${alert}`));
        } else {
            console.log(`\n✅ ALL SYSTEMS NORMAL`);
        }
    }

    calculateReuseRatio(stats) {
        if (stats.connectionsCreated === 0) return 'N/A';
        const ratio = stats.queriesExecuted / stats.connectionsCreated;
        return `${ratio.toFixed(1)}x`;
    }

    calculateErrorRate(stats) {
        if (stats.queriesExecuted === 0) return 0;
        return ((stats.errorsCount / stats.queriesExecuted) * 100).toFixed(2);
    }

    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = seconds % 60;
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }

    async runSingleCheck() {
        if (!await this.initialize()) {
            process.exit(1);
        }
        
        console.log('🔍 Running single pool performance check...\n');
        await this.collectAndDisplayStats();
        await this.dbManager.close();
    }

    async runLoadTest(duration = 60, concurrency = 10) {
        if (!await this.initialize()) {
            process.exit(1);
        }
        
        console.log(`🏋️  Starting load test: ${concurrency} concurrent connections for ${duration}s`);
        
        const startTime = Date.now();
        const promises = [];
        let completedQueries = 0;
        let failedQueries = 0;
        
        // Start load test
        for (let i = 0; i < concurrency; i++) {
            promises.push(this.runLoadTestWorker(duration, (success) => {
                if (success) completedQueries++;
                else failedQueries++;
            }));
        }
        
        // Monitor during load test
        const monitorInterval = setInterval(async () => {
            console.log(`\n📊 Load Test Progress - Completed: ${completedQueries}, Failed: ${failedQueries}`);
            await this.collectAndDisplayStats();
        }, 10000);
        
        // Wait for completion
        await Promise.all(promises);
        clearInterval(monitorInterval);
        
        const totalTime = (Date.now() - startTime) / 1000;
        const totalQueries = completedQueries + failedQueries;
        const qps = (totalQueries / totalTime).toFixed(2);
        
        console.log(`\n✅ Load Test Completed:`);
        console.log(`   Duration: ${totalTime.toFixed(2)}s`);
        console.log(`   Total Queries: ${totalQueries}`);
        console.log(`   Successful: ${completedQueries}`);
        console.log(`   Failed: ${failedQueries}`);
        console.log(`   QPS: ${qps}`);
        console.log(`   Success Rate: ${((completedQueries / totalQueries) * 100).toFixed(2)}%`);
        
        await this.dbManager.close();
    }

    async runLoadTestWorker(duration, callback) {
        const endTime = Date.now() + (duration * 1000);
        
        while (Date.now() < endTime) {
            try {
                // Simple query to test pool performance
                await this.dbManager.get('SELECT NOW() as current_time');
                callback(true);
            } catch (error) {
                callback(false);
            }
            
            // Small delay to prevent overwhelming
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    async stopMonitoring() {
        console.log('\n🛑 Stopping Pool Performance Monitor...');
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        
        // Final stats
        console.log('\n📊 Final Statistics:');
        await this.collectAndDisplayStats();
        
        await this.dbManager.close();
        console.log('✅ Monitor stopped gracefully');
        process.exit(0);
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'monitor';
    
    const monitor = new PoolPerformanceMonitor();
    
    switch (command) {
        case 'monitor':
            const interval = parseInt(args[1]) || 30;
            await monitor.startMonitoring(interval);
            break;
            
        case 'check':
            await monitor.runSingleCheck();
            break;
            
        case 'load-test':
            const duration = parseInt(args[1]) || 60;
            const concurrency = parseInt(args[2]) || 10;
            await monitor.runLoadTest(duration, concurrency);
            break;
            
        case 'help':
        default:
            console.log(`
🚀 PostgreSQL Transaction Pooler Performance Monitor

Usage:
  node scripts/monitor-pool-performance.js [command] [options]

Commands:
  monitor [interval]           Start continuous monitoring (default: 30s interval)
  check                       Run single performance check
  load-test [duration] [conc] Run load test (default: 60s, 10 concurrent)
  help                        Show this help message

Examples:
  node scripts/monitor-pool-performance.js monitor 15
  node scripts/monitor-pool-performance.js check
  node scripts/monitor-pool-performance.js load-test 120 20

Environment Variables:
  DEBUG_POOL=true            Enable detailed pool logging
  POOL_MONITORING=true       Enable pool statistics
            `);
            break;
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Monitor failed:', error);
        process.exit(1);
    });
}

module.exports = PoolPerformanceMonitor;