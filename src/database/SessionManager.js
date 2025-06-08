const RedisDatabase = require('./RedisDatabase');
const PostgresDatabase = require('./PostgresDatabase');
const Logger = require('../utils/Logger');

class SessionManager {
    constructor() {
        this.redisDb = null;
        this.postgresDb = null;
        this.logger = new Logger();
        this.useRedis = process.env.REDIS_ENABLED === 'true';
        this.redisAvailable = false;
    }

    async initialize(postgresConfig, redisConfig = null) {
        try {
            // Always initialize PostgreSQL as fallback
            this.postgresDb = new PostgresDatabase(postgresConfig);
            await this.postgresDb.initialize();
            this.logger.info('PostgreSQL database initialized for session fallback');

            // Initialize Redis if enabled
            if (this.useRedis && redisConfig) {
                try {
                    this.redisDb = new RedisDatabase(redisConfig);
                    await this.redisDb.initialize();
                    this.redisAvailable = true;
                    this.logger.info('Redis database initialized for session management');
                } catch (error) {
                    this.logger.error('Failed to initialize Redis, using PostgreSQL fallback:', error);
                    this.redisAvailable = false;
                }
            } else {
                this.logger.info('Redis disabled or not configured, using PostgreSQL for sessions');
            }

        } catch (error) {
            this.logger.error('Error initializing SessionManager:', error);
            throw error;
        }
    }

    async close() {
        if (this.redisDb) {
            await this.redisDb.close();
        }
        if (this.postgresDb) {
            await this.postgresDb.close();
        }
    }

    // Check if Redis is available for use
    isRedisAvailable() {
        return this.useRedis && this.redisAvailable && this.redisDb && this.redisDb.isRedisAvailable();
    }

    // ========================================
    // WHATSAPP SESSION METHODS
    // ========================================

    async saveWhatsAppSession(clientId, sessionData) {
        if (this.isRedisAvailable()) {
            try {
                await this.redisDb.saveWhatsAppSession(clientId, sessionData);
                this.logger.info(`WhatsApp session saved to Redis for client: ${clientId}`);
                return;
            } catch (error) {
                this.logger.error(`Redis save failed for WhatsApp session ${clientId}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            await this.postgresDb.run(
                'INSERT INTO whatsapp_sessions (client_id, session_data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (client_id) DO UPDATE SET session_data = $2, updated_at = CURRENT_TIMESTAMP',
                [clientId, JSON.stringify(sessionData)]
            );
            this.logger.info(`WhatsApp session saved to PostgreSQL for client: ${clientId}`);
        } catch (error) {
            this.logger.error('Failed to save WhatsApp session to PostgreSQL:', error);
            throw error;
        }
    }

    async getWhatsAppSession(clientId) {
        if (this.isRedisAvailable()) {
            try {
                const sessionData = await this.redisDb.getWhatsAppSession(clientId);
                if (sessionData) {
                    this.logger.info(`WhatsApp session retrieved from Redis for client: ${clientId}`);
                    return sessionData;
                }
            } catch (error) {
                this.logger.error(`Redis get failed for WhatsApp session ${clientId}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            const result = await this.postgresDb.get(
                'SELECT session_data FROM whatsapp_sessions WHERE client_id = $1',
                [clientId]
            );
            
            if (result) {
                const sessionData = JSON.parse(result.session_data);
                this.logger.info(`WhatsApp session retrieved from PostgreSQL for client: ${clientId}`);
                
                // If Redis is available, cache the session
                if (this.isRedisAvailable()) {
                    try {
                        await this.redisDb.saveWhatsAppSession(clientId, sessionData);
                    } catch (error) {
                        this.logger.warn('Failed to cache WhatsApp session in Redis:', error);
                    }
                }
                
                return sessionData;
            }
            
            return null;
        } catch (error) {
            this.logger.error('Failed to get WhatsApp session from PostgreSQL:', error);
            throw error;
        }
    }

    async deleteWhatsAppSession(clientId) {
        // Delete from both Redis and PostgreSQL
        const promises = [];

        if (this.isRedisAvailable()) {
            promises.push(
                this.redisDb.deleteWhatsAppSession(clientId).catch(error => {
                    this.logger.error(`Failed to delete WhatsApp session from Redis for ${clientId}:`, error);
                })
            );
        }

        promises.push(
            this.postgresDb.run(
                'DELETE FROM whatsapp_sessions WHERE client_id = $1',
                [clientId]
            ).catch(error => {
                this.logger.error(`Failed to delete WhatsApp session from PostgreSQL for ${clientId}:`, error);
            })
        );

        await Promise.allSettled(promises);
        this.logger.info(`WhatsApp session deleted for client: ${clientId}`);
    }

    // ========================================
    // REGISTRATION SESSION METHODS
    // ========================================

    async createRegistrationSession(phone) {
        if (this.isRedisAvailable()) {
            try {
                await this.redisDb.createRegistrationSession(phone);
                this.logger.info(`Registration session created in Redis for phone: ${phone}`);
                return;
            } catch (error) {
                this.logger.error(`Redis create failed for registration session ${phone}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            await this.postgresDb.run(
                `INSERT INTO registration_sessions (phone, step, session_data, expires_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
                 ON CONFLICT (phone) DO UPDATE SET
                 step = $2, session_data = $3, expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours', created_at = CURRENT_TIMESTAMP`,
                [phone, 'name', '{}']
            );
            this.logger.info(`Registration session created in PostgreSQL for phone: ${phone}`);
        } catch (error) {
            this.logger.error('Failed to create registration session in PostgreSQL:', error);
            throw error;
        }
    }

    async getRegistrationSession(phone) {
        if (this.isRedisAvailable()) {
            try {
                const session = await this.redisDb.getRegistrationSession(phone);
                if (session) {
                    this.logger.info(`Registration session retrieved from Redis for phone: ${phone}`);
                    return session;
                }
            } catch (error) {
                this.logger.error(`Redis get failed for registration session ${phone}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            const result = await this.postgresDb.get(
                'SELECT * FROM registration_sessions WHERE phone = $1 AND expires_at > CURRENT_TIMESTAMP',
                [phone]
            );
            
            if (result) {
                this.logger.info(`Registration session retrieved from PostgreSQL for phone: ${phone}`);
                
                // If Redis is available, cache the session
                if (this.isRedisAvailable()) {
                    try {
                        const sessionData = JSON.parse(result.session_data);
                        await this.redisDb.updateRegistrationSession(phone, result.step, sessionData);
                    } catch (error) {
                        this.logger.warn('Failed to cache registration session in Redis:', error);
                    }
                }
                
                return result;
            }
            
            return null;
        } catch (error) {
            this.logger.error('Failed to get registration session from PostgreSQL:', error);
            throw error;
        }
    }

    async updateRegistrationSession(phone, step, sessionData) {
        if (this.isRedisAvailable()) {
            try {
                await this.redisDb.updateRegistrationSession(phone, step, sessionData);
                this.logger.info(`Registration session updated in Redis for phone: ${phone}`);
                return;
            } catch (error) {
                this.logger.error(`Redis update failed for registration session ${phone}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            await this.postgresDb.run(
                'UPDATE registration_sessions SET step = $1, session_data = $2 WHERE phone = $3',
                [step, JSON.stringify(sessionData), phone]
            );
            this.logger.info(`Registration session updated in PostgreSQL for phone: ${phone}`);
        } catch (error) {
            this.logger.error('Failed to update registration session in PostgreSQL:', error);
            throw error;
        }
    }

    async deleteRegistrationSession(phone) {
        // Delete from both Redis and PostgreSQL
        const promises = [];

        if (this.isRedisAvailable()) {
            promises.push(
                this.redisDb.deleteRegistrationSession(phone).catch(error => {
                    this.logger.error(`Failed to delete registration session from Redis for ${phone}:`, error);
                })
            );
        }

        promises.push(
            this.postgresDb.run(
                'DELETE FROM registration_sessions WHERE phone = $1',
                [phone]
            ).catch(error => {
                this.logger.error(`Failed to delete registration session from PostgreSQL for ${phone}:`, error);
            })
        );

        await Promise.allSettled(promises);
        this.logger.info(`Registration session deleted for phone: ${phone}`);
    }

    // ========================================
    // AI CURHAT MODE METHODS
    // ========================================

    async setCurhatMode(phone, isActive) {
        const key = `curhat_mode:${phone}`;
        
        if (this.isRedisAvailable()) {
            try {
                if (isActive) {
                    await this.redisDb.client.setex(key, 3600, 'true'); // Expire after 1 hour of inactivity
                } else {
                    await this.redisDb.client.del(key);
                }
                this.logger.info(`Curhat mode ${isActive ? 'activated' : 'deactivated'} in Redis for phone: ${phone}`);
                return;
            } catch (error) {
                this.logger.error(`Redis curhat mode operation failed for ${phone}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            if (isActive) {
                await this.postgresDb.run(
                    `INSERT INTO settings (user_phone, setting_key, setting_value, updated_at)
                     VALUES ($1, 'curhat_mode', 'true', CURRENT_TIMESTAMP)
                     ON CONFLICT (user_phone, setting_key)
                     DO UPDATE SET setting_value = 'true', updated_at = CURRENT_TIMESTAMP`,
                    [phone]
                );
            } else {
                await this.postgresDb.run(
                    'DELETE FROM settings WHERE user_phone = $1 AND setting_key = $2',
                    [phone, 'curhat_mode']
                );
            }
            this.logger.info(`Curhat mode ${isActive ? 'activated' : 'deactivated'} in PostgreSQL for phone: ${phone}`);
        } catch (error) {
            this.logger.error('Failed to set curhat mode in PostgreSQL:', error);
            throw error;
        }
    }

    async isInCurhatMode(phone) {
        const key = `curhat_mode:${phone}`;
        
        if (this.isRedisAvailable()) {
            try {
                const result = await this.redisDb.client.get(key);
                return result === 'true';
            } catch (error) {
                this.logger.error(`Redis curhat mode check failed for ${phone}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            const result = await this.postgresDb.get(
                'SELECT setting_value FROM settings WHERE user_phone = $1 AND setting_key = $2',
                [phone, 'curhat_mode']
            );
            return result && result.setting_value === 'true';
        } catch (error) {
            this.logger.error('Failed to check curhat mode in PostgreSQL:', error);
            return false;
        }
    }

    async setCurhatHistory(phone, history) {
        const key = `curhat_history:${phone}`;
        
        if (this.isRedisAvailable()) {
            try {
                await this.redisDb.client.setex(key, 3600, JSON.stringify(history)); // Expire after 1 hour
                this.logger.info(`Curhat history saved in Redis for phone: ${phone}`);
                return;
            } catch (error) {
                this.logger.error(`Redis curhat history save failed for ${phone}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL - use dedicated curhat_history table
        try {
            // For PostgreSQL, we'll save individual messages instead of the whole history
            // This is handled by AICurhatService.saveCurhatMessage method
            // This method is kept for Redis compatibility
            await this.postgresDb.run(
                `INSERT INTO settings (user_phone, setting_key, setting_value, updated_at)
                 VALUES ($1, 'curhat_history', $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_phone, setting_key)
                 DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
                [phone, JSON.stringify(history)]
            );
            this.logger.info(`Curhat history saved in PostgreSQL for phone: ${phone}`);
        } catch (error) {
            this.logger.error('Failed to save curhat history in PostgreSQL:', error);
            throw error;
        }
    }

    async getCurhatHistory(phone) {
        const key = `curhat_history:${phone}`;
        
        if (this.isRedisAvailable()) {
            try {
                const result = await this.redisDb.client.get(key);
                if (result) {
                    return JSON.parse(result);
                }
            } catch (error) {
                this.logger.error(`Redis curhat history get failed for ${phone}, falling back to PostgreSQL:`, error);
                this.redisAvailable = false;
            }
        }

        // Fallback to PostgreSQL
        try {
            const result = await this.postgresDb.get(
                'SELECT setting_value FROM settings WHERE user_phone = $1 AND setting_key = $2',
                [phone, 'curhat_history']
            );
            
            if (result) {
                const history = JSON.parse(result.setting_value);
                
                // If Redis is available, cache the history
                if (this.isRedisAvailable()) {
                    try {
                        await this.redisDb.client.setex(key, 3600, JSON.stringify(history));
                    } catch (error) {
                        this.logger.warn('Failed to cache curhat history in Redis:', error);
                    }
                }
                
                return history;
            }
            
            return [];
        } catch (error) {
            this.logger.error('Failed to get curhat history from PostgreSQL:', error);
            return [];
        }
    }

    async clearCurhatHistory(phone) {
        const historyKey = `curhat_history:${phone}`;
        const modeKey = `curhat_mode:${phone}`;
        
        // Clear from both Redis and PostgreSQL
        const promises = [];

        if (this.isRedisAvailable()) {
            promises.push(
                this.redisDb.client.del(historyKey).catch(error => {
                    this.logger.error(`Failed to delete curhat history from Redis for ${phone}:`, error);
                })
            );
            promises.push(
                this.redisDb.client.del(modeKey).catch(error => {
                    this.logger.error(`Failed to delete curhat mode from Redis for ${phone}:`, error);
                })
            );
        }

        promises.push(
            this.postgresDb.run(
                'DELETE FROM settings WHERE user_phone = $1 AND setting_key IN ($2, $3)',
                [phone, 'curhat_history', 'curhat_mode']
            ).catch(error => {
                this.logger.error(`Failed to delete curhat data from PostgreSQL for ${phone}:`, error);
            })
        );

        await Promise.allSettled(promises);
        this.logger.info(`Curhat data cleared for phone: ${phone}`);
    }

    /**
     * New methods for dedicated curhat_history table
     */
    
    async saveCurhatMessage(phone, sessionId, role, content) {
        const key = `curhat_session:${phone}:${sessionId}`;
        
        // Always save to PostgreSQL for persistent storage
        try {
            await this.postgresDb.saveCurhatMessage(phone, sessionId, role, content);
        } catch (error) {
            this.logger.error('Failed to save curhat message to PostgreSQL:', error);
            throw error;
        }

        // Also update Redis cache if available
        if (this.isRedisAvailable()) {
            try {
                const history = await this.getCurhatSessionHistory(phone, sessionId);
                await this.redisDb.client.setex(key, 3600, JSON.stringify(history));
            } catch (error) {
                this.logger.warn('Failed to update Redis cache for curhat session:', error);
            }
        }
    }

    async getCurhatSessionHistory(phone, sessionId, limit = 50) {
        const key = `curhat_session:${phone}:${sessionId}`;
        
        // Try Redis first
        if (this.isRedisAvailable()) {
            try {
                const cached = await this.redisDb.client.get(key);
                if (cached) {
                    return JSON.parse(cached);
                }
            } catch (error) {
                this.logger.warn('Failed to get curhat history from Redis:', error);
            }
        }

        // Fallback to PostgreSQL
        try {
            const history = await this.postgresDb.getCurhatHistory(phone, sessionId, limit);
            
            // Cache in Redis if available
            if (this.isRedisAvailable() && history.length > 0) {
                try {
                    await this.redisDb.client.setex(key, 3600, JSON.stringify(history));
                } catch (error) {
                    this.logger.warn('Failed to cache curhat history in Redis:', error);
                }
            }
            
            return history;
        } catch (error) {
            this.logger.error('Failed to get curhat history from PostgreSQL:', error);
            return [];
        }
    }

    async clearCurhatSession(phone, sessionId) {
        const key = `curhat_session:${phone}:${sessionId}`;
        
        // Clear from PostgreSQL
        try {
            await this.postgresDb.clearCurhatSession(phone, sessionId);
        } catch (error) {
            this.logger.error('Failed to clear curhat session from PostgreSQL:', error);
        }

        // Clear from Redis
        if (this.isRedisAvailable()) {
            try {
                await this.redisDb.client.del(key);
            } catch (error) {
                this.logger.warn('Failed to clear curhat session from Redis:', error);
            }
        }

        this.logger.info(`Curhat session ${sessionId} cleared for phone: ${phone}`);
    }

    async cleanupOldCurhatHistory(phone = null) {
        try {
            const deletedCount = await this.postgresDb.cleanupOldCurhatHistory(phone);
            
            // Clear related Redis keys if cleaning up for specific user
            if (phone && this.isRedisAvailable()) {
                try {
                    const pattern = `curhat_session:${phone}:*`;
                    const keys = await this.redisDb.client.keys(pattern);
                    if (keys.length > 0) {
                        await this.redisDb.client.del(...keys);
                        this.logger.info(`Cleared ${keys.length} Redis keys for user ${phone}`);
                    }
                } catch (error) {
                    this.logger.warn('Failed to clear Redis curhat keys:', error);
                }
            }
            
            return deletedCount;
        } catch (error) {
            this.logger.error('Failed to cleanup old curhat history:', error);
            return 0;
        }
    }

    // ========================================
    // MAINTENANCE METHODS
    // ========================================

    async cleanupExpiredRegistrationSessions() {
        let totalDeleted = 0;

        // Cleanup from Redis
        if (this.isRedisAvailable()) {
            try {
                const redisDeleted = await this.redisDb.cleanupExpiredRegistrationSessions();
                totalDeleted += redisDeleted;
            } catch (error) {
                this.logger.error('Failed to cleanup expired sessions from Redis:', error);
            }
        }

        // Cleanup from PostgreSQL
        try {
            const result = await this.postgresDb.run('DELETE FROM registration_sessions WHERE expires_at < CURRENT_TIMESTAMP');
            const pgDeleted = result.changes || 0;
            totalDeleted += pgDeleted;
        } catch (error) {
            this.logger.error('Failed to cleanup expired sessions from PostgreSQL:', error);
        }

        this.logger.info(`Cleaned up ${totalDeleted} expired registration sessions`);
        return totalDeleted;
    }

    // ========================================
    // USER SETTINGS METHODS
    // ========================================

    /**
     * Set user setting (like voice preference)
     * @param {string} userPhone - User phone number
     * @param {string} settingKey - Setting key
     * @param {string} settingValue - Setting value
     */
    async setUserSetting(userPhone, settingKey, settingValue) {
        const redisKey = `user_setting:${userPhone}:${settingKey}`;
        
        // Always save to PostgreSQL for persistence
        try {
            await this.postgresDb.run(`
                INSERT INTO settings (user_phone, setting_key, setting_value)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_phone, setting_key)
                DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP
            `, [userPhone, settingKey, settingValue]);
            
            this.logger.info(`User setting saved to PostgreSQL: ${userPhone} - ${settingKey} = ${settingValue}`);
        } catch (error) {
            this.logger.error('Failed to save user setting to PostgreSQL:', error);
            throw error;
        }

        // Also cache in Redis if available
        if (this.isRedisAvailable()) {
            try {
                await this.redisDb.client.setex(redisKey, 86400, settingValue); // Cache for 24 hours
                this.logger.debug(`User setting cached in Redis: ${userPhone} - ${settingKey}`);
            } catch (error) {
                this.logger.warn('Failed to cache user setting in Redis:', error);
            }
        }
    }

    /**
     * Get user setting (like voice preference)
     * @param {string} userPhone - User phone number
     * @param {string} settingKey - Setting key
     * @returns {Promise<string|null>} - Setting value or null if not found
     */
    async getUserSetting(userPhone, settingKey) {
        const redisKey = `user_setting:${userPhone}:${settingKey}`;
        
        // Try Redis first for faster access
        if (this.isRedisAvailable()) {
            try {
                const cached = await this.redisDb.client.get(redisKey);
                if (cached !== null) {
                    this.logger.debug(`User setting retrieved from Redis: ${userPhone} - ${settingKey}`);
                    return cached;
                }
            } catch (error) {
                this.logger.warn('Failed to get user setting from Redis:', error);
            }
        }

        // Fallback to PostgreSQL
        try {
            const result = await this.postgresDb.get(
                'SELECT setting_value FROM settings WHERE user_phone = $1 AND setting_key = $2',
                [userPhone, settingKey]
            );
            
            if (result) {
                const value = result.setting_value;
                
                // Cache in Redis if available
                if (this.isRedisAvailable()) {
                    try {
                        await this.redisDb.client.setex(redisKey, 86400, value);
                    } catch (error) {
                        this.logger.warn('Failed to cache user setting in Redis:', error);
                    }
                }
                
                this.logger.debug(`User setting retrieved from PostgreSQL: ${userPhone} - ${settingKey}`);
                return value;
            }
            
            return null;
        } catch (error) {
            this.logger.error('Failed to get user setting from PostgreSQL:', error);
            return null;
        }
    }

    // ========================================
    // HEALTH CHECK AND STATS
    // ========================================

    async healthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            redis: {
                enabled: this.useRedis,
                available: this.isRedisAvailable(),
                status: 'unknown'
            },
            postgresql: {
                status: 'unknown'
            }
        };

        // Check Redis health
        if (this.redisDb) {
            try {
                const redisHealth = await this.redisDb.healthCheck();
                health.redis.status = redisHealth.status;
                health.redis.responseTime = redisHealth.responseTime;
            } catch (error) {
                health.redis.status = 'unhealthy';
                health.redis.error = error.message;
            }
        } else {
            health.redis.status = 'disabled';
        }

        // Check PostgreSQL health
        if (this.postgresDb) {
            try {
                const pgHealth = await this.postgresDb.healthCheck();
                health.postgresql.status = pgHealth.status;
                health.postgresql.responseTime = pgHealth.responseTime;
            } catch (error) {
                health.postgresql.status = 'unhealthy';
                health.postgresql.error = error.message;
            }
        }

        return health;
    }

    async getSessionStats() {
        const stats = {
            timestamp: new Date().toISOString(),
            redis: {
                whatsappSessions: 0,
                registrationSessions: 0,
                totalSessions: 0
            },
            postgresql: {
                whatsappSessions: 0,
                registrationSessions: 0
            }
        };

        // Get Redis stats
        if (this.isRedisAvailable()) {
            try {
                stats.redis.whatsappSessions = await this.redisDb.getSessionCount(this.redisDb.whatsappSessionPrefix);
                stats.redis.registrationSessions = await this.redisDb.getSessionCount(this.redisDb.registrationPrefix);
                stats.redis.totalSessions = stats.redis.whatsappSessions + stats.redis.registrationSessions;
            } catch (error) {
                this.logger.error('Failed to get Redis session stats:', error);
            }
        }

        // Get PostgreSQL stats
        if (this.postgresDb) {
            try {
                const waResult = await this.postgresDb.get('SELECT COUNT(*) as count FROM whatsapp_sessions');
                stats.postgresql.whatsappSessions = waResult ? parseInt(waResult.count) : 0;

                const regResult = await this.postgresDb.get('SELECT COUNT(*) as count FROM registration_sessions WHERE expires_at > CURRENT_TIMESTAMP');
                stats.postgresql.registrationSessions = regResult ? parseInt(regResult.count) : 0;
            } catch (error) {
                this.logger.error('Failed to get PostgreSQL session stats:', error);
            }
        }

        return stats;
    }
}

module.exports = SessionManager;