const Logger = require('./Logger');

class AntiSpamManager {
    constructor() {
        this.logger = new Logger();
        this.messageHistory = new Map(); // userPhone -> message history
        this.userLimits = new Map(); // userPhone -> rate limit info
        this.globalStats = {
            totalMessages: 0,
            messagesPerMinute: 0,
            messagesPerHour: 0,
            lastMinuteReset: Date.now(),
            lastHourReset: Date.now()
        };
        
        // Anti-banned detection
        this.suspiciousPatterns = new Map(); // userPhone -> suspicious activity
        this.banRiskLevel = 'LOW'; // LOW, MEDIUM, HIGH, CRITICAL
        this.lastRiskAssessment = Date.now();
        
        // Message timing tracking for natural behavior
        this.messageTiming = new Map(); // userPhone -> timing patterns
        
        // Configuration
        this.config = {
            // Per user limits - RELAXED FOR HIGH VOLUME
            maxMessagesPerMinute: parseInt(process.env.ANTI_SPAM_USER_PER_MINUTE) || 15,
            maxMessagesPerHour: parseInt(process.env.ANTI_SPAM_USER_PER_HOUR) || 200,
            maxDuplicateMessages: parseInt(process.env.ANTI_SPAM_MAX_DUPLICATES) || 5,
            
            // Global limits (to prevent WhatsApp ban) - RELAXED FOR HIGH VOLUME
            maxGlobalMessagesPerMinute: parseInt(process.env.ANTI_SPAM_GLOBAL_PER_MINUTE) || 100,
            maxGlobalMessagesPerHour: parseInt(process.env.ANTI_SPAM_GLOBAL_PER_HOUR) || 3000,
            maxGlobalMessagesPerDay: parseInt(process.env.ANTI_SPAM_GLOBAL_PER_DAY) || 50000,
            
            // Spam detection - RELAXED FOR HIGH VOLUME
            duplicateMessageWindow: parseInt(process.env.ANTI_SPAM_DUPLICATE_WINDOW) || 300000, // 5 minutes
            rapidFireThreshold: parseInt(process.env.ANTI_SPAM_RAPID_FIRE) || 10, // 10 messages in 10 seconds
            rapidFireWindow: parseInt(process.env.ANTI_SPAM_RAPID_FIRE_WINDOW) || 10000, // 10 seconds
            
            // Cooldown periods - SHORTER FOR HIGH VOLUME
            userCooldownMinutes: parseInt(process.env.ANTI_SPAM_USER_COOLDOWN) || 1,
            globalCooldownMinutes: parseInt(process.env.ANTI_SPAM_GLOBAL_COOLDOWN) || 2,
            
            // Emergency brake - HIGHER THRESHOLD FOR HIGH VOLUME
            emergencyBrakeEnabled: process.env.ANTI_SPAM_EMERGENCY_BRAKE !== 'false',
            emergencyBrakeThreshold: parseInt(process.env.ANTI_SPAM_EMERGENCY_THRESHOLD) || 200, // messages per minute
            
            // Anti-banned features
            enableBanRiskDetection: process.env.ANTI_BANNED_DETECTION !== 'false',
            enableNaturalDelays: process.env.ANTI_BANNED_NATURAL_DELAYS !== 'false',
            enableResponseVariation: process.env.ANTI_BANNED_RESPONSE_VARIATION !== 'false',
            
            // Ban risk thresholds - RELAXED FOR HIGH VOLUME
            banRiskThresholds: {
                suspiciousPatternCount: parseInt(process.env.BAN_RISK_PATTERN_COUNT) || 15, // Increased from 5
                rapidResponseCount: parseInt(process.env.BAN_RISK_RAPID_RESPONSE) || 25, // Increased from 10
                identicalResponseCount: parseInt(process.env.BAN_RISK_IDENTICAL_RESPONSE) || 8, // Increased from 3
                maxHourlyMessages: parseInt(process.env.BAN_RISK_HOURLY_MAX) || 800 // Increased from 400
            },
            
            // Natural behavior simulation - FASTER SETTINGS
            naturalDelays: {
                min: parseInt(process.env.NATURAL_DELAY_MIN) || 200, // 0.2s (faster)
                max: parseInt(process.env.NATURAL_DELAY_MAX) || 1000, // 1s (faster)
                readingTimePerChar: parseInt(process.env.READING_TIME_PER_CHAR) || 10, // 10ms per char (faster)
                thinkingTime: parseInt(process.env.THINKING_TIME) || 500 // 0.5s thinking time (faster)
            }
        };

        // Start periodic cleanup and monitoring
        this.startPeriodicTasks();
        
        this.logger.info('🛡️ Enhanced Anti-Spam & Anti-Banned Manager initialized:', {
            userPerMinute: this.config.maxMessagesPerMinute,
            globalPerMinute: this.config.maxGlobalMessagesPerMinute,
            emergencyBrake: this.config.emergencyBrakeEnabled,
            banRiskDetection: this.config.enableBanRiskDetection,
            naturalDelays: this.config.enableNaturalDelays
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

            // Check ban risk level first
            if (this.config.enableBanRiskDetection) {
                const banRiskCheck = await this.assessBanRisk(userPhone, messageText, isOutgoing);
                if (!banRiskCheck.allowed) {
                    this.logger.error(`🚨 BAN RISK DETECTED for ${userPhone}:`, banRiskCheck);
                    return banRiskCheck;
                }
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

            // Check for bot-like behavior patterns
            if (this.config.enableBanRiskDetection && isOutgoing) {
                const botPatternCheck = this.checkBotPatterns(userPhone, messageText);
                if (!botPatternCheck.allowed) {
                    this.logger.warn(`🤖 Bot pattern detected for ${userPhone}:`, botPatternCheck);
                    return botPatternCheck;
                }
            }

            // Record the message if all checks pass
            this.recordMessage(userPhone, messageText, isOutgoing);
            
            // Calculate natural delay if enabled
            let naturalDelay = 0;
            if (this.config.enableNaturalDelays && isOutgoing) {
                naturalDelay = this.calculateNaturalDelay(messageText);
            }
            
            return {
                allowed: true,
                reason: 'passed_all_checks',
                naturalDelay,
                banRiskLevel: this.banRiskLevel
            };

        } catch (error) {
            this.logger.error('Error in anti-spam check:', error);
            // Fail safe - allow message but log error
            return { allowed: true, reason: 'error_failsafe' };
        }
    }

    /**
     * Assess ban risk based on various factors
     */
    async assessBanRisk(userPhone, messageText, isOutgoing) {
        const now = Date.now();
        
        // Update risk assessment every 5 minutes
        if (now - this.lastRiskAssessment > 300000) {
            this.updateBanRiskLevel();
            this.lastRiskAssessment = now;
        }
        
        // CRITICAL risk - stop immediately
        if (this.banRiskLevel === 'CRITICAL') {
            return {
                allowed: false,
                reason: 'critical_ban_risk',
                message: '🚨 CRITICAL: Sistem dihentikan untuk mencegah banned. Tunggu 10 menit.',
                cooldownUntil: now + 600000, // 10 minutes
                banRiskLevel: this.banRiskLevel
            };
        }
        
        // HIGH risk - severe limitations
        if (this.banRiskLevel === 'HIGH') {
            // Only allow 1 message per 2 minutes for each user
            const userLimit = this.userLimits.get(userPhone);
            if (userLimit && now - userLimit.lastMessageTime < 120000) {
                return {
                    allowed: false,
                    reason: 'high_ban_risk_throttle',
                    message: '⚠️ Risiko banned tinggi. Pesan dibatasi 1 per 2 menit.',
                    cooldownUntil: userLimit.lastMessageTime + 120000,
                    banRiskLevel: this.banRiskLevel
                };
            }
        }
        
        // MEDIUM risk - moderate limitations
        if (this.banRiskLevel === 'MEDIUM') {
            // Only allow 1 message per minute for each user
            const userLimit = this.userLimits.get(userPhone);
            if (userLimit && now - userLimit.lastMessageTime < 60000) {
                return {
                    allowed: false,
                    reason: 'medium_ban_risk_throttle',
                    message: '⚠️ Risiko banned sedang. Pesan dibatasi 1 per menit.',
                    cooldownUntil: userLimit.lastMessageTime + 60000,
                    banRiskLevel: this.banRiskLevel
                };
            }
        }
        
        return { allowed: true, banRiskLevel: this.banRiskLevel };
    }

    /**
     * Update ban risk level based on system behavior
     */
    updateBanRiskLevel() {
        const stats = this.getDetailedStats();
        let riskScore = 0;
        
        // Factor 1: Message volume - RELAXED FOR HIGH VOLUME
        if (stats.global.messagesPerMinute > 80) riskScore += 3; // Increased from 40
        else if (stats.global.messagesPerMinute > 60) riskScore += 2; // Increased from 25
        else if (stats.global.messagesPerMinute > 40) riskScore += 1; // Increased from 15
        
        if (stats.global.messagesPerHour > 1500) riskScore += 3; // Increased from 500
        else if (stats.global.messagesPerHour > 1000) riskScore += 2; // Increased from 300
        else if (stats.global.messagesPerHour > 600) riskScore += 1; // Increased from 200
        
        // Factor 2: Suspicious patterns - RELAXED
        const suspiciousUsers = Array.from(this.suspiciousPatterns.values())
            .reduce((total, patterns) => total + patterns.length, 0);
        if (suspiciousUsers > 100) riskScore += 3; // Increased from 20
        else if (suspiciousUsers > 50) riskScore += 2; // Increased from 10
        else if (suspiciousUsers > 25) riskScore += 1; // Increased from 5
        
        // Factor 3: Rapid fire incidents - RELAXED
        const rapidFireUsers = Array.from(this.userLimits.values())
            .filter(limit => limit.rapidFireIncidents > 0).length;
        if (rapidFireUsers > 20) riskScore += 2; // Increased from 5
        else if (rapidFireUsers > 10) riskScore += 1; // Increased from 2
        
        // Factor 4: Emergency brake triggers - RELAXED
        if (this.globalStats.emergencyBrakeCount > 10) riskScore += 4; // Increased from 3
        else if (this.globalStats.emergencyBrakeCount > 5) riskScore += 2; // Increased from 1
        
        // Determine risk level
        const previousRisk = this.banRiskLevel;
        if (riskScore >= 8) {
            this.banRiskLevel = 'CRITICAL';
        } else if (riskScore >= 5) {
            this.banRiskLevel = 'HIGH';
        } else if (riskScore >= 3) {
            this.banRiskLevel = 'MEDIUM';
        } else {
            this.banRiskLevel = 'LOW';
        }
        
        // Log risk level changes
        if (this.banRiskLevel !== previousRisk) {
            this.logger.warn(`🚨 Ban risk level changed: ${previousRisk} → ${this.banRiskLevel} (score: ${riskScore})`);
        }
        
        return this.banRiskLevel;
    }

    /**
     * Check for bot-like behavior patterns
     */
    checkBotPatterns(userPhone, messageText) {
        const now = Date.now();
        
        // Get or create suspicious pattern tracking
        if (!this.suspiciousPatterns.has(userPhone)) {
            this.suspiciousPatterns.set(userPhone, []);
        }
        
        const patterns = this.suspiciousPatterns.get(userPhone);
        const userLimit = this.userLimits.get(userPhone);
        
        // Pattern 1: Too many identical responses
        const recentMessages = (this.messageHistory.get(userPhone)?.messages || [])
            .filter(msg => msg.isOutgoing && now - msg.timestamp < 3600000); // Last hour
        
        const identicalCount = recentMessages.filter(msg => msg.text === messageText).length;
        if (identicalCount >= this.config.banRiskThresholds.identicalResponseCount) {
            patterns.push({
                type: 'identical_responses',
                count: identicalCount,
                timestamp: now
            });
        }
        
        // Pattern 2: Responses too fast (less than human reading time) - RELAXED
        if (userLimit && userLimit.lastMessageTime) {
            const timeSinceLastMessage = now - userLimit.lastMessageTime;
            const minimumReadingTime = messageText.length * this.config.naturalDelays.readingTimePerChar;
            
            // Only flag if response is EXTREMELY fast (less than 100ms)
            if (timeSinceLastMessage < 100) {
                patterns.push({
                    type: 'too_fast_response',
                    responseTime: timeSinceLastMessage,
                    expectedMinimum: 100,
                    timestamp: now
                });
            }
        }
        
        // Pattern 3: Too consistent response times - DISABLED FOR HIGH VOLUME
        // Commented out to reduce false positives in high-volume scenarios
        /*
        if (recentMessages.length >= 10) { // Increased threshold from 5 to 10
            const responseTimes = [];
            for (let i = 1; i < recentMessages.length; i++) {
                responseTimes.push(recentMessages[i].timestamp - recentMessages[i-1].timestamp);
            }
            
            const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length;
            const stdDev = Math.sqrt(variance);
            
            // Much more relaxed variance check - only extremely consistent patterns
            if (stdDev < avgResponseTime * 0.05 && avgResponseTime < 1000) { // 5% variation and under 1s avg
                patterns.push({
                    type: 'consistent_timing',
                    avgResponseTime,
                    variance: stdDev,
                    timestamp: now
                });
            }
        }
        */
        
        // Clean old patterns (keep only last hour)
        const validPatterns = patterns.filter(pattern => now - pattern.timestamp < 3600000);
        this.suspiciousPatterns.set(userPhone, validPatterns);
        
        // Check if too many suspicious patterns
        if (validPatterns.length >= this.config.banRiskThresholds.suspiciousPatternCount) {
            return {
                allowed: false,
                reason: 'bot_pattern_detected',
                message: '🤖 Pola bot terdeteksi. Sistem akan istirahat 5 menit.',
                cooldownUntil: now + 300000, // 5 minutes
                patterns: validPatterns.slice(-3) // Last 3 patterns
            };
        }
        
        return { allowed: true };
    }

    /**
     * Calculate natural delay to simulate human behavior
     */
    calculateNaturalDelay(messageText) {
        if (!this.config.enableNaturalDelays) {
            return 0;
        }
        
        // Base reading time
        const readingTime = messageText.length * this.config.naturalDelays.readingTimePerChar;
        
        // Thinking time
        const thinkingTime = this.config.naturalDelays.thinkingTime;
        
        // Random variation
        const minDelay = this.config.naturalDelays.min;
        const maxDelay = this.config.naturalDelays.max;
        const randomVariation = Math.random() * (maxDelay - minDelay) + minDelay;
        
        // Combine all factors
        const totalDelay = Math.min(
            readingTime + thinkingTime + randomVariation,
            maxDelay
        );
        
        return Math.max(totalDelay, minDelay);
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

        // Check per hour limit
        if (this.globalStats.messagesPerHour >= this.config.maxGlobalMessagesPerHour) {
            return {
                allowed: false,
                reason: 'global_rate_limit_hour',
                message: '⚠️ Limit pesan per jam tercapai. Silakan tunggu.',
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
        this.globalStats.messagesPerMinute++;
        this.globalStats.messagesPerHour++;
    }

    updateGlobalStats() {
        const now = Date.now();
        
        // Reset per minute counter if needed
        if (now - this.globalStats.lastMinuteReset >= 60000) {
            this.globalStats.messagesPerMinute = 0;
            this.globalStats.lastMinuteReset = now;
        }
        
        // Reset per hour counter if needed
        if (now - this.globalStats.lastHourReset >= 3600000) {
            this.globalStats.messagesPerHour = 0;
            this.globalStats.lastHourReset = now;
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
                messagesPerHour: this.globalStats.messagesPerHour,
                emergencyBrakeActive: this.isEmergencyBrakeTriggered(),
                banRiskLevel: this.banRiskLevel
            },
            users: {
                total: this.userLimits.size,
                inCooldown: Array.from(this.userLimits.values()).filter(u => u.cooldownUntil > now).length,
                activeUsers: this.messageHistory.size,
                suspiciousPatterns: this.suspiciousPatterns.size
            },
            config: this.config
        };
    }

    // Get detailed statistics for ban risk assessment
    getDetailedStats() {
        const now = Date.now();
        
        // Count rapid fire incidents
        const rapidFireUsers = Array.from(this.userLimits.values())
            .filter(limit => {
                if (!limit.rapidFireIncidents) limit.rapidFireIncidents = 0;
                return limit.rapidFireIncidents > 0;
            }).length;

        // Count suspicious patterns
        const totalSuspiciousPatterns = Array.from(this.suspiciousPatterns.values())
            .reduce((total, patterns) => total + patterns.length, 0);

        // Initialize emergency brake count if not exists
        if (!this.globalStats.emergencyBrakeCount) {
            this.globalStats.emergencyBrakeCount = 0;
        }

        return {
            global: {
                totalMessages: this.globalStats.totalMessages,
                messagesPerMinute: this.globalStats.messagesPerMinute,
                messagesPerHour: this.globalStats.messagesPerHour,
                emergencyBrakeActive: this.isEmergencyBrakeTriggered(),
                emergencyBrakeCount: this.globalStats.emergencyBrakeCount,
                banRiskLevel: this.banRiskLevel
            },
            users: {
                total: this.userLimits.size,
                inCooldown: Array.from(this.userLimits.values()).filter(u => u.cooldownUntil > now).length,
                activeUsers: this.messageHistory.size,
                suspiciousPatterns: this.suspiciousPatterns.size,
                totalSuspiciousPatterns,
                rapidFireUsers
            },
            patterns: {
                suspiciousPatternsPerUser: Array.from(this.suspiciousPatterns.entries())
                    .map(([phone, patterns]) => ({ phone, count: patterns.length }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10) // Top 10 users with most patterns
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