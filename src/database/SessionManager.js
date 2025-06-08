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