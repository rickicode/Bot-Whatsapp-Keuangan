const Logger = require('./Logger');

class AntiSpamManager {
    constructor() {
        this.logger = new Logger();
        this.messageHistory = new Map(); // userPhone -> message history
        this.userLimits = new Map(); // userPhone -> rate limit info
        this.globalStats = {
            totalMessages: 0,
            messagesPerMinute: 0,
            lastReset: Date.now()
        };
        
        // Configuration
        this.config = {
            // Per user limits
            maxMessagesPerMinute: parseInt(process.env.ANTI_SPAM_USER_PER_MINUTE) || 10,
            maxMessagesPerHour: parseInt(process.env.ANTI_SPAM_USER_PER_HOUR) || 100,
            maxDuplicateMessages: parseInt(process.env.ANTI_SPAM_MAX_DUPLICATES) || 3,
            
            // Global limits (to prevent WhatsApp ban)
            maxGlobalMessagesPerMinute: parseInt(process.env.ANTI_SPAM_GLOBAL_PER_MINUTE) || 50,
            maxGlobalMessagesPerHour: parseInt(process.env.ANTI_SPAM_GLOBAL_PER_HOUR) || 1000,
            
            // Spam detection
            duplicateMessageWindow: parseInt(process.env.ANTI_SPAM_DUPLICATE_WINDOW) || 60000, // 1 minute
            rapidFireThreshold: parseInt(process.env.ANTI_SPAM_RAPID_FIRE) || 5, // 5 messages in 10 seconds
            rapidFireWindow: parseInt(process.env.ANTI_SPAM_RAPID_FIRE_WINDOW) || 10000, // 10 seconds
            
            // Cooldown periods
            userCooldownMinutes: parseInt(process.env.ANTI_SPAM_USER_COOLDOWN) || 5,
            globalCooldownMinutes: parseInt(process.env.ANTI_SPAM_GLOBAL_COOLDOWN) || 2,
            
            // Emergency brake
            emergencyBrakeEnabled: process.env.ANTI_SPAM_EMERGENCY_BRAKE !== 'false',
            emergencyBrakeThreshold: parseInt(process.env.ANTI_SPAM_EMERGENCY_THRESHOLD) || 100 // messages per minute
        };

        // Start periodic cleanup and monitoring
        this.startPeriodicTasks();
        
        this.logger.info('🛡️ Anti-Spam Manager initialized with limits:', {
            userPerMinute: this.config.maxMessagesPerMinute,
            globalPerMinute: this.config.maxGlobalMessagesPerMinute,
            emergencyBrake: this.config.emergencyBrakeEnabled
        });
    }

    // Main method to check if message should be allowed
    async checkMessageAllowed(userPhone, messageText, isOutgoing = false) {
        try {
            const now = Date.now();
            
            // Skip checks for admin users (if needed)
            if (await this.isAdminUser(userPhone)) {
                return { allowed: true, reason: 'admin_bypass' };
            }

            // Global emergency brake
            if (this.config.emergencyBrakeEnabled && this.isEmergencyBrakeTriggered()) {
                this.logger.error('🚨 EMERGENCY BRAKE TRIGGERED - Stopping all outgoing messages');
                return { 
                    allowed: false, 
                    reason: 'emergency_brake',
                    message: '🚨 Sistem dalam mode darurat. Silakan tunggu beberapa menit.',
                    cooldownUntil: now + (this.config.globalCooldownMinutes * 60000)
                };
            }

            // Check global rate limits
            const globalCheck = this.checkGlobalLimits();
            if (!globalCheck.allowed) {
                this.logger.warn('🌍 Global rate limit exceeded:', globalCheck);
                return globalCheck;
            }

            // Check user-specific limits
            const userCheck = this.checkUserLimits(userPhone, messageText, isOutgoing);
            if (!userCheck.allowed) {
                this.logger.warn(`👤 User rate limit exceeded for ${userPhone}:`, userCheck);
                return userCheck;
            }

            // Check for spam patterns
            const spamCheck = this.checkSpamPatterns(userPhone, messageText);
            if (!spamCheck.allowed) {
                this.logger.warn(`🔍 Spam pattern detected for ${userPhone}:`, spamCheck);
                return spamCheck;
            }

            // Check for rapid fire messages
            const rapidFireCheck = this.checkRapidFire(userPhone);
            if (!rapidFireCheck.allowed) {
                this.logger.warn(`⚡ Rapid fire detected for ${userPhone}:`, rapidFireCheck);
                return rapidFireCheck;
            }

            // Record the message if all checks pass
            this.recordMessage(userPhone, messageText, isOutgoing);
            
            return { allowed: true, reason: 'passed_all_checks' };

        } catch (error) {
            this.logger.error('Error in anti-spam check:', error);
            // Fail safe - allow message but log error
            return { allowed: true, reason: 'error_failsafe' };
        }
    }

    checkGlobalLimits() {
        const now = Date.now();
        
        // Update global stats
        this.updateGlobalStats();
        
        // Check per minute limit
        if (this.globalStats.messagesPerMinute >= this.config.maxGlobalMessagesPerMinute) {
            return {
                allowed: false,
                reason: 'global_rate_limit_minute',
                message: '⚠️ Sistem sedang sibuk. Silakan tunggu sebentar.',
                cooldownUntil: now + (this.config.globalCooldownMinutes * 60000),
                stats: this.globalStats
            };
        }

        return { allowed: true };
    }

    checkUserLimits(userPhone, messageText, isOutgoing) {
        const now = Date.now();
        let userLimit = this.userLimits.get(userPhone);
        
        if (!userLimit) {
            userLimit = {
                messagesThisMinute: 0,
                messagesThisHour: 0,
                lastMessageTime: 0,
                lastMinuteReset: now,
                lastHourReset: now,
                cooldownUntil: 0
            };
            this.userLimits.set(userPhone, userLimit);
        }

        // Check if user is in cooldown
        if (userLimit.cooldownUntil > now) {
            const remainingMs = userLimit.cooldownUntil - now;
            const remainingMinutes = Math.ceil(remainingMs / 60000);
            return {
                allowed: false,
                reason: 'user_in_cooldown',
                message: `⏰ Anda dalam cooldown. Silakan tunggu ${remainingMinutes} menit lagi.`,
                cooldownUntil: userLimit.cooldownUntil
            };
        }

        // Reset counters if needed
        if (now - userLimit.lastMinuteReset >= 60000) {
            userLimit.messagesThisMinute = 0;
            userLimit.lastMinuteReset = now;
        }
        
        if (now - userLimit.lastHourReset >= 3600000) {
            userLimit.messagesThisHour = 0;
            userLimit.lastHourReset = now;
        }

        // Check per minute limit
        if (userLimit.messagesThisMinute >= this.config.maxMessagesPerMinute) {
            userLimit.cooldownUntil = now + (this.config.userCooldownMinutes * 60000);
            return {
                allowed: false,
                reason: 'user_rate_limit_minute',
                message: `🚫 Terlalu banyak pesan (${userLimit.messagesThisMinute}/menit). Cooldown ${this.config.userCooldownMinutes} menit.`,
                cooldownUntil: userLimit.cooldownUntil
            };
        }

        // Check per hour limit
        if (userLimit.messagesThisHour >= this.config.maxMessagesPerHour) {
            userLimit.cooldownUntil = now + (this.config.userCooldownMinutes * 60000);
            return {
                allowed: false,
                reason: 'user_rate_limit_hour',
                message: `🚫 Limit harian tercapai (${userLimit.messagesThisHour}/jam). Cooldown ${this.config.userCooldownMinutes} menit.`,
                cooldownUntil: userLimit.cooldownUntil
            };
        }

        return { allowed: true };
    }

    checkSpamPatterns(userPhone, messageText) {
        const now = Date.now();
        let history = this.messageHistory.get(userPhone);
        
        if (!history) {
            history = { messages: [], duplicates: {} };
            this.messageHistory.set(userPhone, history);
        }

        // Clean old messages
        history.messages = history.messages.filter(msg => 
            now - msg.timestamp < this.config.duplicateMessageWindow
        );

        // Check for duplicate messages
        const duplicateCount = history.messages.filter(msg => 
            msg.text === messageText
        ).length;

        if (duplicateCount >= this.config.maxDuplicateMessages) {
            return {
                allowed: false,
                reason: 'duplicate_spam',
                message: `🔄 Pesan duplikat terdeteksi. Silakan tunggu ${Math.ceil(this.config.duplicateMessageWindow/60000)} menit.`,
                cooldownUntil: now + this.config.duplicateMessageWindow
            };
        }

        return { allowed: true };
    }

    checkRapidFire(userPhone) {
        const now = Date.now();
        let history = this.messageHistory.get(userPhone);
        
        if (!history) return { allowed: true };

        // Count messages in rapid fire window
        const recentMessages = history.messages.filter(msg => 
            now - msg.timestamp < this.config.rapidFireWindow
        );

        if (recentMessages.length >= this.config.rapidFireThreshold) {
            return {
                allowed: false,
                reason: 'rapid_fire',
                message: `⚡ Pesan terlalu cepat (${recentMessages.length} dalam ${this.config.rapidFireWindow/1000}s). Silakan pelan-pelan.`,
                cooldownUntil: now + (this.config.userCooldownMinutes * 60000)
            };
        }

        return { allowed: true };
    }

    recordMessage(userPhone, messageText, isOutgoing = false) {
        const now = Date.now();

        // Record in user history
        let history = this.messageHistory.get(userPhone);
        if (!history) {
            history = { messages: [], duplicates: {} };
            this.messageHistory.set(userPhone, history);
        }

        history.messages.push({
            text: messageText,
            timestamp: now,
            isOutgoing
        });

        // Update user limits
        let userLimit = this.userLimits.get(userPhone);
        if (userLimit) {
            userLimit.messagesThisMinute++;
            userLimit.messagesThisHour++;
            userLimit.lastMessageTime = now;
        }

        // Update global stats
        this.globalStats.totalMessages++;
    }

    updateGlobalStats() {
        const now = Date.now();
        
        // Reset per minute counter if needed
        if (now - this.globalStats.lastReset >= 60000) {
            this.globalStats.messagesPerMinute = 0;
            this.globalStats.lastReset = now;
        }
    }

    isEmergencyBrakeTriggered() {
        this.updateGlobalStats();
        return this.globalStats.messagesPerMinute >= this.config.emergencyBrakeThreshold;
    }

    async isAdminUser(userPhone) {
        // Check if user is admin - implement based on your admin system
        const adminPhones = (process.env.BOT_ADMIN_PHONE || '').split(',').map(p => p.trim());
        return adminPhones.includes(userPhone);
    }

    // Get statistics for monitoring
    getStats() {
        const now = Date.now();
        
        return {
            global: {
                totalMessages: this.globalStats.totalMessages,
                messagesPerMinute: this.globalStats.messagesPerMinute,
                emergencyBrakeActive: this.isEmergencyBrakeTriggered()
            },
            users: {
                total: this.userLimits.size,
                inCooldown: Array.from(this.userLimits.values()).filter(u => u.cooldownUntil > now).length,
                activeUsers: this.messageHistory.size
            },
            config: this.config
        };
    }

    // Force remove user from cooldown (admin function)
    removeCooldown(userPhone) {
        const userLimit = this.userLimits.get(userPhone);
        if (userLimit) {
            userLimit.cooldownUntil = 0;
            userLimit.messagesThisMinute = 0;
            userLimit.messagesThisHour = 0;
            this.logger.info(`🔧 Cooldown removed for ${userPhone}`);
            return true;
        }
        return false;
    }

    // Reset emergency brake
    resetEmergencyBrake() {
        this.globalStats.messagesPerMinute = 0;
        this.globalStats.lastReset = Date.now();
        this.logger.info('🔧 Emergency brake reset');
    }

    startPeriodicTasks() {
        // Cleanup old data every 5 minutes
        setInterval(() => {
            this.cleanupOldData();
        }, 300000); // 5 minutes

        // Log stats every 30 minutes
        setInterval(() => {
            this.logStats();
        }, 1800000); // 30 minutes

        this.logger.info('🔄 Anti-spam periodic tasks started');
    }

    cleanupOldData() {
        const now = Date.now();
        let cleanedUsers = 0;
        let cleanedMessages = 0;

        // Cleanup message history
        for (const [userPhone, history] of this.messageHistory.entries()) {
            const beforeCount = history.messages.length;
            history.messages = history.messages.filter(msg => 
                now - msg.timestamp < 3600000 // Keep last hour
            );
            cleanedMessages += beforeCount - history.messages.length;
            
            if (history.messages.length === 0) {
                this.messageHistory.delete(userPhone);
                cleanedUsers++;
            }
        }

        // Cleanup expired cooldowns
        for (const [userPhone, userLimit] of this.userLimits.entries()) {
            if (userLimit.cooldownUntil < now && 
                now - userLimit.lastMessageTime > 3600000) { // 1 hour inactive
                this.userLimits.delete(userPhone);
                cleanedUsers++;
            }
        }

        if (cleanedUsers > 0 || cleanedMessages > 0) {
            this.logger.info(`🧹 Anti-spam cleanup: ${cleanedUsers} users, ${cleanedMessages} messages`);
        }
    }

    logStats() {
        const stats = this.getStats();
        this.logger.info('📊 Anti-spam stats:', stats);
    }
}

module.exports = AntiSpamManager;