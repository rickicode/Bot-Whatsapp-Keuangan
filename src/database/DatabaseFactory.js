const PostgresDatabase = require('./PostgresDatabase');
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

    static getDefaultConfig() {
        return {
            // Method 1: Connection URL (recommended)
            DATABASE_DB_URL: 'postgresql://username:password@host:5432/database',
            
            // Method 2: Individual variables (alternative)
            POSTGRES_HOST: 'localhost',
            POSTGRES_PORT: '5432',
            POSTGRES_DB: 'financial_bot',
            POSTGRES_USER: 'your_username',
            POSTGRES_PASSWORD: 'your_password',
            POSTGRES_SSL: 'false'
        };
    }
}

module.exports = DatabaseFactory;