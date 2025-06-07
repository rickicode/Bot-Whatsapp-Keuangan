const PostgresDatabase = require('./PostgresDatabase');
const Logger = require('../utils/Logger');

class DatabaseFactory {
    static create() {
        const logger = new Logger();
        const dbType = process.env.DATABASE_TYPE || 'postgres';

        logger.info(`Initializing database type: ${dbType}`);

        switch (dbType.toLowerCase()) {
            case 'postgres':
            case 'postgresql':
            case 'supabase':
                let config;
                
                if (dbType.toLowerCase() === 'supabase') {
                    // Supabase configuration
                    const supabaseUrl = process.env.SUPABASE_DB_URL;
                    if (!supabaseUrl) {
                        throw new Error('Supabase requires SUPABASE_DB_URL to be set');
                    }
                    
                    // Parse Supabase connection URL
                    const url = new URL(supabaseUrl);
                    config = {
                        host: url.hostname,
                        port: parseInt(url.port) || 5432,
                        database: url.pathname.slice(1),
                        user: url.username,
                        password: url.password,
                        ssl: true,
                        // Additional Supabase specific settings
                        extra: {
                            ssl: {
                                rejectUnauthorized: false
                            }
                        }
                    };
                    
                    logger.info('Using Supabase PostgreSQL configuration');
                } else {
                    // Standard PostgreSQL configuration
                    config = {
                        host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
                        port: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT) || 5432,
                        database: process.env.DB_NAME || process.env.DATABASE_NAME || 'financial_bot',
                        user: process.env.DB_USER || process.env.DATABASE_USER,
                        password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD,
                        ssl: (process.env.DB_SSL || process.env.DATABASE_SSL) === 'true'
                    };
                }

                // Validate required PostgreSQL config
                if (!config.user || !config.password) {
                    throw new Error('PostgreSQL/Supabase requires database credentials to be set');
                }

                return new PostgresDatabase(config);

            default:
                throw new Error(`Jenis database tidak didukung: ${dbType}. Jenis yang didukung: postgres, postgresql, supabase`);
        }
    }

    static getSupportedTypes() {
        return ['postgres', 'postgresql', 'supabase'];
    }

    static getDefaultConfig(type) {
        switch (type.toLowerCase()) {
            case 'postgres':
            case 'postgresql':
                return {
                    DATABASE_TYPE: 'postgres',
                    DATABASE_HOST: 'localhost',
                    DATABASE_PORT: '5432',
                    DATABASE_NAME: 'financial_bot',
                    DATABASE_USER: 'your_username',
                    DATABASE_PASSWORD: 'your_password',
                    DATABASE_SSL: 'false'
                };

            case 'supabase':
                return {
                    DATABASE_TYPE: 'supabase',
                    SUPABASE_DB_URL: 'postgresql://username:password@host:5432/database'
                };

            default:
                throw new Error(`Unknown database type: ${type}`);
        }
    }
}

module.exports = DatabaseFactory;