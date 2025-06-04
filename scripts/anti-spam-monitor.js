const http = require('http');
const Logger = require('../src/utils/Logger');

class AntiSpamMonitor {
    constructor(baseUrl = 'http://localhost:3000') {
        this.baseUrl = baseUrl;
        this.logger = new Logger();
    }

    async makeRequest(path, method = 'GET', data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.baseUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        resolve({ statusCode: res.statusCode, data: parsed });
                    } catch (error) {
                        resolve({ statusCode: res.statusCode, data: body });
                    }
                });
            });

            req.on('error', reject);

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async getStats() {
        try {
            const response = await this.makeRequest('/anti-spam/stats');
            if (response.statusCode === 200) {
                return response.data;
            } else {
                throw new Error(`HTTP ${response.statusCode}: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            this.logger.error('Failed to get anti-spam stats:', error);
            throw error;
        }
    }

    async resetEmergencyBrake() {
        try {
            const response = await this.makeRequest('/anti-spam/reset-emergency', 'POST');
            if (response.statusCode === 200) {
                return response.data;
            } else {
                throw new Error(`HTTP ${response.statusCode}: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            this.logger.error('Failed to reset emergency brake:', error);
            throw error;
        }
    }

    async removeCooldown(phone) {
        try {
            const response = await this.makeRequest(`/anti-spam/remove-cooldown/${encodeURIComponent(phone)}`, 'POST');
            if (response.statusCode === 200) {
                return response.data;
            } else {
                throw new Error(`HTTP ${response.statusCode}: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            this.logger.error(`Failed to remove cooldown for ${phone}:`, error);
            throw error;
        }
    }

    displayStats(stats) {
        console.log('\n🛡️ ANTI-SPAM MONITORING DASHBOARD');
        console.log('═'.repeat(50));
        
        if (stats.error) {
            console.log('❌ Error:', stats.error);
            return;
        }

        console.log(`📊 Updated: ${new Date(stats.timestamp).toLocaleString()}`);
        console.log('');

        // Global stats
        const global = stats.stats.global;
        console.log('🌍 GLOBAL STATISTICS:');
        console.log(`  Total Messages: ${global.totalMessages}`);
        console.log(`  Messages/Minute: ${global.messagesPerMinute}`);
        console.log(`  Emergency Brake: ${global.emergencyBrakeActive ? '🚨 ACTIVE' : '✅ Normal'}`);
        console.log('');

        // User stats
        const users = stats.stats.users;
        console.log('👥 USER STATISTICS:');
        console.log(`  Total Registered: ${users.total}`);
        console.log(`  In Cooldown: ${users.inCooldown}`);
        console.log(`  Active Users: ${users.activeUsers}`);
        console.log('');

        // Configuration
        const config = stats.stats.config;
        console.log('⚙️ CONFIGURATION:');
        console.log(`  User Limits: ${config.maxMessagesPerMinute}/min, ${config.maxMessagesPerHour}/hour`);
        console.log(`  Global Limits: ${config.maxGlobalMessagesPerMinute}/min, ${config.maxGlobalMessagesPerHour}/hour`);
        console.log(`  Emergency Threshold: ${config.emergencyBrakeThreshold} msg/min`);
        console.log(`  Cooldown: User=${config.userCooldownMinutes}min, Global=${config.globalCooldownMinutes}min`);
        console.log('');

        // Alerts
        this.checkAlerts(stats.stats);
    }

    checkAlerts(stats) {
        const alerts = [];

        // Emergency brake alert
        if (stats.global.emergencyBrakeActive) {
            alerts.push('🚨 CRITICAL: Emergency brake is active!');
        }

        // High usage alerts
        if (stats.global.messagesPerMinute > stats.config.maxGlobalMessagesPerMinute * 0.8) {
            alerts.push('⚠️ WARNING: Global rate limit near threshold');
        }

        // Many users in cooldown
        if (stats.users.inCooldown > stats.users.total * 0.3) {
            alerts.push('⚠️ WARNING: Many users are in cooldown');
        }

        if (alerts.length > 0) {
            console.log('🚨 ALERTS:');
            alerts.forEach(alert => console.log(`  ${alert}`));
            console.log('');
        }
    }

    async monitorContinuous(intervalSeconds = 30) {
        console.log(`🔄 Starting continuous monitoring (every ${intervalSeconds}s)`);
        console.log('Press Ctrl+C to stop');
        console.log('');

        const monitor = async () => {
            try {
                // Clear screen (ANSI escape code)
                process.stdout.write('\x1Bc');
                
                const stats = await this.getStats();
                this.displayStats(stats);
                
                console.log(`🔄 Next update in ${intervalSeconds}s...`);
            } catch (error) {
                console.error('❌ Monitoring error:', error.message);
            }
        };

        // Initial run
        await monitor();

        // Set up interval
        const intervalId = setInterval(monitor, intervalSeconds * 1000);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\n👋 Monitoring stopped');
            clearInterval(intervalId);
            process.exit(0);
        });
    }

    async showHelp() {
        console.log('🛡️ Anti-Spam Monitor Commands:');
        console.log('');
        console.log('Usage: node scripts/anti-spam-monitor.js [command] [options]');
        console.log('');
        console.log('Commands:');
        console.log('  stats                     - Show current anti-spam statistics');
        console.log('  monitor [interval]        - Continuous monitoring (default: 30s)');
        console.log('  reset-emergency          - Reset emergency brake');
        console.log('  remove-cooldown <phone>  - Remove cooldown for specific user');
        console.log('  help                     - Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node scripts/anti-spam-monitor.js stats');
        console.log('  node scripts/anti-spam-monitor.js monitor 15');
        console.log('  node scripts/anti-spam-monitor.js remove-cooldown +6281234567890');
        console.log('');
        console.log('Environment:');
        console.log('  BOT_URL - Base URL for bot API (default: http://localhost:3000)');
    }
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';
    
    const baseUrl = process.env.BOT_URL || 'http://localhost:3000';
    const monitor = new AntiSpamMonitor(baseUrl);

    try {
        switch (command) {
            case 'stats':
                console.log('📊 Fetching anti-spam statistics...\n');
                const stats = await monitor.getStats();
                monitor.displayStats(stats);
                break;

            case 'monitor':
                const interval = parseInt(args[1]) || 30;
                await monitor.monitorContinuous(interval);
                break;

            case 'reset-emergency':
                console.log('🚨 Resetting emergency brake...');
                const resetResult = await monitor.resetEmergencyBrake();
                console.log('✅', resetResult.status);
                break;

            case 'remove-cooldown':
                const phone = args[1];
                if (!phone) {
                    console.error('❌ Phone number is required');
                    console.log('Usage: remove-cooldown <phone>');
                    process.exit(1);
                }
                console.log(`⏰ Removing cooldown for ${phone}...`);
                const cooldownResult = await monitor.removeCooldown(phone);
                console.log('✅', cooldownResult.status);
                break;

            case 'help':
            default:
                await monitor.showHelp();
                break;
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Export for use in other modules
module.exports = AntiSpamMonitor;

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}