const Logger = require('./Logger');

/**
 * TypingManager - Mengelola indikator typing untuk menghindari banned WhatsApp
 * dan membuat percakapan terasa lebih natural
 */
class TypingManager {
    constructor(sock) {
        this.sock = sock;
        this.logger = new Logger();
        this.typingStates = new Map(); // userJid -> typing state
        this.typingQueue = new Map(); // userJid -> queue of typing tasks
        
        // Configuration
        this.config = {
            // Typing durations based on message length - FASTER SETTINGS
            baseTypingDuration: parseInt(process.env.TYPING_BASE_DURATION) || 300, // 0.3 second (faster)
            typingPerChar: parseInt(process.env.TYPING_PER_CHAR) || 15, // 15ms per character (faster)
            maxTypingDuration: parseInt(process.env.TYPING_MAX_DURATION) || 2500, // 2.5 seconds max (faster)
            minTypingDuration: parseInt(process.env.TYPING_MIN_DURATION) || 200, // 0.2 seconds min (faster)
            
            // Typing behavior
            randomVariation: parseFloat(process.env.TYPING_RANDOM_VARIATION) || 0.2, // 20% variation (less random)
            pauseBetweenMessages: parseInt(process.env.TYPING_PAUSE_BETWEEN) || 200, // 0.2s pause (faster)
            
            // Natural typing patterns
            enableNaturalTyping: process.env.TYPING_NATURAL !== 'false',
            enableRandomPauses: process.env.TYPING_RANDOM_PAUSES !== 'false',
            
            // Anti-detection features
            enableTypingSpoof: process.env.TYPING_SPOOF !== 'false',
            maxConcurrentTyping: parseInt(process.env.TYPING_MAX_CONCURRENT) || 3
        };
        
        this.logger.info('⌨️ TypingManager initialized with config:', {
            naturalTyping: this.config.enableNaturalTyping,
            randomPauses: this.config.enableRandomPauses,
            typingSpoof: this.config.enableTypingSpoof
        });
    }

    /**
     * Send typing indicator before sending message
     */
    async sendWithTyping(userJid, message, options = {}) {
        try {
            // Check if typing is already in progress for this user
            if (this.typingStates.has(userJid)) {
                this.logger.debug(`Typing already in progress for ${userJid}, queueing message`);
                return await this.queueTypingMessage(userJid, message, options);
            }

            // Calculate typing duration based on message length
            const typingDuration = this.calculateTypingDuration(message);
            
            // Start typing
            await this.startTyping(userJid, typingDuration);
            
            // Send message after typing duration
            await this.sleep(typingDuration);
            
            // Stop typing and send message
            await this.stopTyping(userJid);
            const result = await this.sock.sendMessage(userJid, { text: message, ...options });
            
            // Add small pause after sending
            await this.sleep(this.config.pauseBetweenMessages);
            
            return result;
            
        } catch (error) {
            this.logger.error(`Error in sendWithTyping for ${userJid}:`, error);
            // Fallback: send without typing
            await this.stopTyping(userJid);
            return await this.sock.sendMessage(userJid, { text: message, ...options });
        }
    }

    /**
     * Start typing indicator
     */
    async startTyping(userJid, duration = null) {
        try {
            if (!this.sock || !this.sock.sendPresenceUpdate) {
                this.logger.warn('Socket not available for typing indicator');
                return;
            }

            // Mark as typing
            this.typingStates.set(userJid, {
                startTime: Date.now(),
                duration: duration || this.config.baseTypingDuration,
                isTyping: true
            });

            // Send composing presence
            await this.sock.sendPresenceUpdate('composing', userJid);
            this.logger.debug(`⌨️ Started typing for ${userJid} (${duration}ms)`);
            
            // Auto-stop typing after duration (safety mechanism)
            if (duration) {
                setTimeout(() => {
                    this.stopTyping(userJid, true);
                }, duration + 1000); // Add 1 second buffer
            }
            
        } catch (error) {
            this.logger.error(`Error starting typing for ${userJid}:`, error);
            this.typingStates.delete(userJid);
        }
    }

    /**
     * Stop typing indicator
     */
    async stopTyping(userJid, isAutoStop = false) {
        try {
            const typingState = this.typingStates.get(userJid);
            if (!typingState || !typingState.isTyping) {
                return; // Not typing or already stopped
            }

            if (!this.sock || !this.sock.sendPresenceUpdate) {
                this.logger.warn('Socket not available for presence update');
                this.typingStates.delete(userJid);
                return;
            }

            // Send paused presence (stops typing indicator)
            await this.sock.sendPresenceUpdate('paused', userJid);
            
            // Remove typing state
            this.typingStates.delete(userJid);
            
            const duration = Date.now() - typingState.startTime;
            this.logger.debug(`⏹️ Stopped typing for ${userJid} (${duration}ms) ${isAutoStop ? '[auto]' : ''}`);
            
            // Process queued messages if any
            await this.processQueue(userJid);
            
        } catch (error) {
            this.logger.error(`Error stopping typing for ${userJid}:`, error);
            this.typingStates.delete(userJid);
        }
    }

    /**
     * Calculate natural typing duration based on message content
     */
    calculateTypingDuration(message) {
        if (!this.config.enableNaturalTyping) {
            return this.config.baseTypingDuration;
        }

        const messageLength = message.length;
        let duration = this.config.baseTypingDuration + (messageLength * this.config.typingPerChar);
        
        // Add random variation for natural feel
        if (this.config.enableRandomPauses) {
            const variation = duration * this.config.randomVariation;
            const randomOffset = (Math.random() - 0.5) * variation;
            duration += randomOffset;
        }
        
        // Add extra time for complex messages (numbers, special chars)
        const complexChars = (message.match(/[0-9\s\n\t.,!?;:()[\]{}]/g) || []).length;
        duration += complexChars * 20; // 20ms per complex character
        
        // Add extra time for emojis
        const emojiCount = (message.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || []).length;
        duration += emojiCount * 300; // 300ms per emoji
        
        // Apply bounds
        duration = Math.max(this.config.minTypingDuration, duration);
        duration = Math.min(this.config.maxTypingDuration, duration);
        
        return Math.round(duration);
    }

    /**
     * Queue message when typing is already in progress
     */
    async queueTypingMessage(userJid, message, options = {}) {
        if (!this.typingQueue.has(userJid)) {
            this.typingQueue.set(userJid, []);
        }
        
        const queue = this.typingQueue.get(userJid);
        queue.push({ message, options, timestamp: Date.now() });
        
        this.logger.debug(`📝 Queued message for ${userJid} (queue size: ${queue.length})`);
        
        // Return a promise that resolves when the message is sent
        return new Promise((resolve, reject) => {
            queue[queue.length - 1].resolve = resolve;
            queue[queue.length - 1].reject = reject;
        });
    }

    /**
     * Process queued messages for a user
     */
    async processQueue(userJid) {
        const queue = this.typingQueue.get(userJid);
        if (!queue || queue.length === 0) {
            return;
        }

        this.logger.debug(`📤 Processing queue for ${userJid} (${queue.length} messages)`);
        
        // Process first message in queue
        const queuedMessage = queue.shift();
        if (queuedMessage) {
            try {
                const result = await this.sendWithTyping(userJid, queuedMessage.message, queuedMessage.options);
                if (queuedMessage.resolve) {
                    queuedMessage.resolve(result);
                }
            } catch (error) {
                if (queuedMessage.reject) {
                    queuedMessage.reject(error);
                }
            }
        }
        
        // Clean up empty queue
        if (queue.length === 0) {
            this.typingQueue.delete(userJid);
        }
    }

    /**
     * Send multiple messages with natural typing delays
     */
    async sendMultipleWithTyping(userJid, messages, options = {}) {
        const results = [];
        
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            
            // Add extra pause between multiple messages
            if (i > 0) {
                await this.sleep(this.config.pauseBetweenMessages * 2);
            }
            
            const result = await this.sendWithTyping(userJid, message, options);
            results.push(result);
        }
        
        return results;
    }

    /**
     * Simulate human-like presence updates
     */
    async simulateHumanPresence(userJid, duration = 30000) {
        if (!this.config.enableTypingSpoof) {
            return;
        }

        try {
            const startTime = Date.now();
            const presenceStates = ['available', 'composing', 'paused'];
            
            while (Date.now() - startTime < duration) {
                // Random presence state
                const randomState = presenceStates[Math.floor(Math.random() * presenceStates.length)];
                await this.sock.sendPresenceUpdate(randomState, userJid);
                
                // Random delay between 2-8 seconds
                const delay = 2000 + Math.random() * 6000;
                await this.sleep(delay);
            }
            
            // End with available status
            await this.sock.sendPresenceUpdate('available', userJid);
            
        } catch (error) {
            this.logger.error(`Error in simulateHumanPresence for ${userJid}:`, error);
        }
    }

    /**
     * Get typing statistics
     */
    getStats() {
        return {
            activeTyping: this.typingStates.size,
            queuedMessages: Array.from(this.typingQueue.values()).reduce((total, queue) => total + queue.length, 0),
            totalQueues: this.typingQueue.size,
            config: this.config
        };
    }

    /**
     * Clean up expired typing states
     */
    cleanupExpiredTyping() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [userJid, typingState] of this.typingStates.entries()) {
            const elapsed = now - typingState.startTime;
            
            // Clean up typing states older than max duration + 10 seconds
            if (elapsed > this.config.maxTypingDuration + 10000) {
                this.stopTyping(userJid, true);
                cleanedCount++;
            }
        }
        
        // Clean up old queued messages (older than 5 minutes)
        for (const [userJid, queue] of this.typingQueue.entries()) {
            const validMessages = queue.filter(msg => now - msg.timestamp < 300000);
            
            if (validMessages.length !== queue.length) {
                if (validMessages.length === 0) {
                    this.typingQueue.delete(userJid);
                } else {
                    this.typingQueue.set(userJid, validMessages);
                }
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            this.logger.info(`🧹 TypingManager cleanup: ${cleanedCount} expired states/queues`);
        }
    }

    /**
     * Utility sleep function
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if currently typing to a user
     */
    isTypingTo(userJid) {
        const typingState = this.typingStates.get(userJid);
        return typingState && typingState.isTyping;
    }

    /**
     * Force stop all typing states (emergency cleanup)
     */
    async stopAllTyping() {
        this.logger.info('🛑 Stopping all typing states');
        
        for (const [userJid] of this.typingStates.entries()) {
            await this.stopTyping(userJid, true);
        }
        
        // Clear all queues
        this.typingQueue.clear();
    }
}

module.exports = TypingManager;