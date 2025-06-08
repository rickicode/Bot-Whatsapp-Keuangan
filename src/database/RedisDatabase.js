const redis = require('redis');
const BaseDatabase = require('./BaseDatabase');
const Logger = require('../utils/Logger');

class RedisDatabase extends BaseDatabase {
    constructor(config) {
        super();
        this.config = config;
        this.client = null;
        this.logger = new Logger();
        this.fallbackDatabase = null; // PostgreSQL fallback
        this.isConnected = false;
        this.sessionPrefix = 'session:';
        this.registrationPrefix = 'reg:';
        this.whatsappSessionPrefix = 'wa:';
        this.defaultExpiry = 86400; // 24 hours in seconds
    }

    async initialize() {
        try {
            // Create Redis client with configuration
            const clientConfig = {
                socket: {
                    host: this.config.host || 'localhost',
                    port: this.config.port || 6379,
                    connectTimeout: this.config.connectTimeout || 5000,
                    lazyConnect: true
                },
                ...(this.config.password && { password: this.config.password }),
                ...(this.config.username && { username: this.config.username }),
                ...(this.config.database && { database: this.config.database }),
                retry_delay: 100,
                max_retry_time: 5000,
                enable_offline_queue: false
            };

            this.client = redis.createClient(clientConfig);

            // Set up error handling
            this.client.on('error', (err) => {
                this.logger.error('Redis connection error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                this.logger.info('Redis client connecting...');
            });

            this.client.on('ready', () => {
                this.logger.info('Redis client connected and ready');
                this.isConnected = true;
            });

            this.client.on('end', () => {
                this.logger.warn('Redis connection ended');
                this.isConnected = false;
            });

            // Connect to Redis
            await this.client.connect();
            
            // Test connection
            await this.validateConnection();
            
            this.logger.info('Redis database initialized successfully for session management');
        } catch (error) {
            this.logger.error('Error initializing Redis database:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async validateConnection() {
        try {
            const start = Date.now();
            const result = await this.client.ping();
            const duration = Date.now() - start;
            
            if (result !== 'PONG') {
                throw new Error('Redis ping failed');
            }
            
            this.logger.info(`Redis connection validated successfully (${duration}ms)`);
            this.isConnected = true;
            return true;
        } catch (error) {
            this.logger.error('Redis connection validation failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async close() {
        if (this.client) {
            try {
                await this.client.quit();
                this.logger.info('Redis connection closed successfully');
            } catch (error) {
                this.logger.error('Error closing Redis connection:', error);
                // Force close if quit fails
                this.client.disconnect();
            }
        }
        this.isConnected = false;
    }

    async healthCheck() {
        try {
            const start = Date.now();
            await this.client.ping();
            const duration = Date.now() - start;
            
            return {
                status: 'healthy',
                responseTime: duration,
                connectionStatus: this.isConnected ? 'connected' : 'disconnected',
                timestamp: new Date().toISOString(),
                redisInfo: {
                    host: this.config.host,
                    port: this.config.port,
                    database: this.config.database || 0
                }
            };
        } catch (error) {
            this.logger.error('Redis health check failed:', error);
            return {
                status: 'unhealthy',
                error: error.message,
                connectionStatus: 'disconnected',
                timestamp: new Date().toISOString()
            };
        }
    }

    // ========================================
    // SESSION MANAGEMENT METHODS
    // ========================================

    // WhatsApp Sessions Management
    async saveWhatsAppSession(clientId, sessionData) {
        try {
            const key = `${this.whatsappSessionPrefix}${clientId}`;
            await this.client.setEx(key, this.defaultExpiry, JSON.stringify(sessionData));
            this.logger.info(`WhatsApp session saved for client: ${clientId}`);
        } catch (error) {
            this.logger.error('Error saving WhatsApp session to Redis:', error);
            throw error;
        }
    }

    async getWhatsAppSession(clientId) {
        try {
            const key = `${this.whatsappSessionPrefix}${clientId}`;
            const sessionData = await this.client.get(key);
            
            if (!sessionData) {
                return null;
            }
            
            // Extend expiry time
            await this.client.expire(key, this.defaultExpiry);
            
            return JSON.parse(sessionData);
        } catch (error) {
            this.logger.error('Error getting WhatsApp session from Redis:', error);
            throw error;
        }
    }

    async deleteWhatsAppSession(clientId) {
        try {
            const key = `${this.whatsappSessionPrefix}${clientId}`;
            await this.client.del(key);
            this.logger.info(`WhatsApp session deleted for client: ${clientId}`);
        } catch (error) {
            this.logger.error('Error deleting WhatsApp session from Redis:', error);
            throw error;
        }
    }

    // Registration Sessions Management
    async createRegistrationSession(phone) {
        try {
            const key = `${this.registrationPrefix}${phone}`;
            const sessionData = {
                phone: phone,
                step: 'name',
                session_data: {},
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
            };
            
            await this.client.setEx(key, this.defaultExpiry, JSON.stringify(sessionData));
            this.logger.info(`Registration session created for phone: ${phone}`);
        } catch (error) {
            this.logger.error('Error creating registration session in Redis:', error);
            throw error;
        }
    }

    async getRegistrationSession(phone) {
        try {
            const key = `${this.registrationPrefix}${phone}`;
            const sessionData = await this.client.get(key);
            
            if (!sessionData) {
                return null;
            }
            
            const session = JSON.parse(sessionData);
            
            // Check if session has expired
            if (new Date(session.expires_at) < new Date()) {
                await this.deleteRegistrationSession(phone);
                return null;
            }
            
            return session;
        } catch (error) {
            this.logger.error('Error getting registration session from Redis:', error);
            throw error;
        }
    }

    async updateRegistrationSession(phone, step, sessionData) {
        try {
            const key = `${this.registrationPrefix}${phone}`;
            const existingSession = await this.getRegistrationSession(phone);
            
            if (!existingSession) {
                throw new Error('Registration session not found');
            }
            
            const updatedSession = {
                ...existingSession,
                step: step,
                session_data: sessionData,
                updated_at: new Date().toISOString()
            };
            
            await this.client.setEx(key, this.defaultExpiry, JSON.stringify(updatedSession));
            this.logger.info(`Registration session updated for phone: ${phone}, step: ${step}`);
        } catch (error) {
            this.logger.error('Error updating registration session in Redis:', error);
            throw error;
        }
    }

    async deleteRegistrationSession(phone) {
        try {
            const key = `${this.registrationPrefix}${phone}`;
            await this.client.del(key);
            this.logger.info(`Registration session deleted for phone: ${phone}`);
        } catch (error) {
            this.logger.error('Error deleting registration session from Redis:', error);
            throw error;
        }
    }

    // Cleanup expired sessions
    async cleanupExpiredRegistrationSessions() {
        try {
            const pattern = `${this.registrationPrefix}*`;
            const keys = await this.client.keys(pattern);
            let deletedCount = 0;
            
            for (const key of keys) {
                try {
                    const sessionData = await this.client.get(key);
                    if (sessionData) {
                        const session = JSON.parse(sessionData);
                        if (new Date(session.expires_at) < new Date()) {
                            await this.client.del(key);
                            deletedCount++;
                        }
                    }
                } catch (error) {
                    // Delete corrupted session data
                    await this.client.del(key);
                    deletedCount++;
                }
            }
            
            this.logger.info(`Cleaned up ${deletedCount} expired registration sessions from Redis`);
            return deletedCount;
        } catch (error) {
            this.logger.error('Error cleaning up expired registration sessions in Redis:', error);
            return 0;
        }
    }

    // ========================================
    // COMPATIBILITY METHODS (For DatabaseManager)
    // ========================================
    
    // These methods are required by DatabaseManager but not applicable for Redis session storage
    // They will throw errors to indicate they should use PostgreSQL fallback
    
    async run(sql, params = []) {
        throw new Error('SQL operations not supported in Redis - use PostgreSQL fallback');
    }

    async get(sql, params = []) {
        throw new Error('SQL operations not supported in Redis - use PostgreSQL fallback');
    }

    async all(sql, params = []) {
        throw new Error('SQL operations not supported in Redis - use PostgreSQL fallback');
    }

    async beginTransaction() {
        throw new Error('Transactions not supported in Redis - use PostgreSQL fallback');
    }

    async commit() {
        throw new Error('Transactions not supported in Redis - use PostgreSQL fallback');
    }

    async rollback() {
        throw new Error('Transactions not supported in Redis - use PostgreSQL fallback');
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    async getAllSessionKeys(prefix = '') {
        try {
            const pattern = prefix ? `${prefix}*` : '*';
            return await this.client.keys(pattern);
        } catch (error) {
            this.logger.error('Error getting session keys from Redis:', error);
            return [];
        }
    }

    async getSessionCount(prefix = '') {
        try {
            const keys = await this.getAllSessionKeys(prefix);
            return keys.length;
        } catch (error) {
            this.logger.error('Error counting sessions in Redis:', error);
            return 0;
        }
    }

    async clearAllSessions(prefix = '') {
        try {
            const keys = await this.getAllSessionKeys(prefix);
            if (keys.length > 0) {
                await this.client.del(keys);
                this.logger.info(`Cleared ${keys.length} sessions from Redis`);
            }
            return keys.length;
        } catch (error) {
            this.logger.error('Error clearing sessions from Redis:', error);
            return 0;
        }
    }

    // Check if Redis is available and connected
    isRedisAvailable() {
        return this.isConnected && this.client && this.client.isReady;
    }

    // Set fallback database (PostgreSQL)
    setFallbackDatabase(fallbackDb) {
        this.fallbackDatabase = fallbackDb;
    }
}

module.exports = RedisDatabase;