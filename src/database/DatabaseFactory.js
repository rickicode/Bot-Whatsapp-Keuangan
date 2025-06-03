const SQLiteDatabase = require('./SQLiteDatabase');
const PostgresDatabase = require('./PostgresDatabase');
const Logger = require('../utils/Logger');

class DatabaseFactory {
    static create() {
        const logger = new Logger();
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';

        logger.info(`Initializing database type: ${dbType}`);

        switch (dbType.toLowerCase()) {
            case 'sqlite3':
            case 'sqlite':
                const dbPath = process.env.DB_PATH || './data/financial.db';
                return new SQLiteDatabase(dbPath);

            case 'postgres':
            case 'postgresql':
                const config = {
                    host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
                    port: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT) || 5432,
                    database: process.env.DB_NAME || process.env.DATABASE_NAME || 'financial_bot',
                    user: process.env.DB_USER || process.env.DATABASE_USER,
                    password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD,
                    ssl: (process.env.DB_SSL || process.env.DATABASE_SSL) === 'true'
                };

                // Validate required PostgreSQL config
                if (!config.user || !config.password) {
                    throw new Error('PostgreSQL requires DATABASE_USER and DATABASE_PASSWORD to be set');
                }

                return new PostgresDatabase(config);

            default:
                throw new Error(`Jenis database tidak didukung: ${dbType}. Jenis yang didukung: sqlite3, postgres`);
        }
    }

    static getSupportedTypes() {
        return ['sqlite3', 'postgres'];
    }

    static getDefaultConfig(type) {
        switch (type.toLowerCase()) {
            case 'sqlite3':
                return {
                    DATABASE_TYPE: 'sqlite3',
                    DB_PATH: './data/financial.db'
                };

            case 'postgres':
                return {
                    DATABASE_TYPE: 'postgres',
                    DATABASE_HOST: 'localhost',
                    DATABASE_PORT: '5432',
                    DATABASE_NAME: 'financial_bot',
                    DATABASE_USER: 'your_username',
                    DATABASE_PASSWORD: 'your_password',
                    DATABASE_SSL: 'false'
                };

            default:
                throw new Error(`Unknown database type: ${type}`);
        }
    }
}

module.exports = DatabaseFactory;