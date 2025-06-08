const PostgresDatabase = require('./PostgresDatabase');
const SessionManager = require('./SessionManager');
const Logger = require('../utils/Logger');

class DatabaseFactory {
    static create() {
        const logger = new Logger();
        
        logger.info('Initializing PostgreSQL database');

        let config;
        
        // Priority 1: Check for connection URL (DATABASE_DB_URL or SUPABASE_DB_URL)
        const dbUrl = process.env.DATABASE_DB_URL || process.env.SUPABASE_DB_URL;
        
        if (dbUrl) {
            try {
                // Parse connection URL
                const url = new URL(dbUrl);
                config = {
                    host: url.hostname,
                    port: parseInt(url.port) || 5432,
                    database: url.pathname.slice(1),
                    user: url.username,
                    password: url.password,
                    ssl: url.searchParams.get('sslmode') === 'require' || url.hostname.includes('supabase'),
                    // Additional SSL settings for cloud databases
                    extra: {
                        ssl: {
                            rejectUnauthorized: false
                        }
                    }
                };
                
                logger.info(`Using PostgreSQL with connection URL: ${url.hostname}:${config.port}/${config.database}`);
            } catch (error) {
                throw new Error(`Invalid database URL format: ${error.message}`);
            }
        } else {
            // Priority 2: Use individual environment variables
            config = {
                host: process.env.POSTGRES_HOST || process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.POSTGRES_PORT || process.env.DATABASE_PORT) || 5432,
                database: process.env.POSTGRES_DB || process.env.DATABASE_NAME || 'financial_bot',
                user: process.env.POSTGRES_USER || process.env.DATABASE_USER,
                password: process.env.POSTGRES_PASSWORD || process.env.DATABASE_PASSWORD,
                ssl: (process.env.POSTGRES_SSL || process.env.DATABASE_SSL) === 'true'
            };
            
            logger.info(`Using PostgreSQL with individual config: ${config.host}:${config.port}/${config.database}`);
        }

        // Validate required PostgreSQL config
        if (!config.user || !config.password) {
            throw new Error('PostgreSQL requires database credentials. Set DATABASE_DB_URL or POSTGRES_USER/POSTGRES_PASSWORD');
        }

        return new PostgresDatabase(config);
    }

    static createSessionManager() {
        const logger = new Logger();
        
        // Get PostgreSQL config
        const postgresConfig = DatabaseFactory.getPostgresConfig();
        
        // Get Redis config
        const redisConfig = DatabaseFactory.getRedisConfig();
        
        logger.info('Creating SessionManager with Redis and PostgreSQL fallback');
        
        return new SessionManager();
    }

    static getPostgresConfig() {
        let config;
        
        // Priority 1: Check for connection URL (DATABASE_DB_URL or SUPABASE_DB_URL)
        const dbUrl = process.env.DATABASE_DB_URL || process.env.SUPABASE_DB_URL;
        
        if (dbUrl) {
            try {
                // Parse connection URL
                const url = new URL(dbUrl);
                config = {
                    host: url.hostname,
                    port: parseInt(url.port) || 5432,
                    database: url.pathname.slice(1),
                    user: url.username,
                    password: url.password,
                    ssl: url.searchParams.get('sslmode') === 'require' || url.hostname.includes('supabase'),
                    // Additional SSL settings for cloud databases
                    extra: {
                        ssl: {
                            rejectUnauthorized: false
                        }
                    }
                };
            } catch (error) {
                throw new Error(`Invalid database URL format: ${error.message}`);
            }
        } else {
            // Priority 2: Use individual environment variables
            config = {
                host: process.env.POSTGRES_HOST || process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.POSTGRES_PORT || process.env.DATABASE_PORT) || 5432,
                database: process.env.POSTGRES_DB || process.env.DATABASE_NAME || 'financial_bot',
                user: process.env.POSTGRES_USER || process.env.DATABASE_USER,
                password: process.env.POSTGRES_PASSWORD || process.env.DATABASE_PASSWORD,
                ssl: (process.env.POSTGRES_SSL || process.env.DATABASE_SSL) === 'true'
            };
        }

        // Validate required PostgreSQL config
        if (!config.user || !config.password) {
            throw new Error('PostgreSQL requires database credentials. Set DATABASE_DB_URL or POSTGRES_USER/POSTGRES_PASSWORD');
        }

        return config;
    }

    static getRedisConfig() {
        // Check if Redis is enabled
        if (process.env.REDIS_ENABLED !== 'true') {
            return null;
        }

        let config;

        // Priority 1: Check for Redis URL
        const redisUrl = process.env.REDIS_URL;
        
        if (redisUrl) {
            try {
                const url = new URL(redisUrl);
                config = {
                    host: url.hostname,
                    port: parseInt(url.port) || 6379,
                    password: url.password || undefined,
                    username: url.username || undefined,
                    database: url.pathname ? parseInt(url.pathname.slice(1)) : 0
                };
            } catch (error) {
                throw new Error(`Invalid Redis URL format: ${error.message}`);
            }
        } else {
            // Priority 2: Use individual environment variables
            config = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                username: process.env.REDIS_USERNAME || undefined,
                database: parseInt(process.env.REDIS_DATABASE) || 0,
                connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT) || 5000
            };
        }

        return config;
    }

    static getDefaultConfig() {
        return {
            // PostgreSQL Configuration
            // Method 1: Connection URL (recommended)
            DATABASE_DB_URL: 'postgresql://username:password@host:5432/database',
            
            // Method 2: Individual variables (alternative)
            POSTGRES_HOST: 'localhost',
            POSTGRES_PORT: '5432',
            POSTGRES_DB: 'financial_bot',
            POSTGRES_USER: 'your_username',
            POSTGRES_PASSWORD: 'your_password',
            POSTGRES_SSL: 'false',

            // Redis Configuration for Sessions
            REDIS_ENABLED: 'true',
            REDIS_URL: 'redis://localhost:6379',
            
            // Alternative Redis individual variables
            REDIS_HOST: 'localhost',
            REDIS_PORT: '6379',
            REDIS_PASSWORD: 'your_redis_password',
            REDIS_USERNAME: 'your_redis_username',
            REDIS_DATABASE: '0',
            REDIS_CONNECT_TIMEOUT: '5000'
        };
    }
}

module.exports = DatabaseFactory;