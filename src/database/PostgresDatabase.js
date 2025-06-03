const { Pool } = require('pg');
const BaseDatabase = require('./BaseDatabase');
const Logger = require('../utils/Logger');

class PostgresDatabase extends BaseDatabase {
    constructor(config) {
        super();
        this.config = config;
        this.pool = null;
        this.client = null;
        this.logger = new Logger();
    }

    async initialize() {
        try {
            // Create connection pool
            this.pool = new Pool({
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                ssl: this.config.ssl
            });

            // Test connection
            this.client = await this.pool.connect();
            
            // Create tables
            await this.createTables();
            
            this.logger.info('PostgreSQL database initialized successfully');
        } catch (error) {
            this.logger.error('Error initializing PostgreSQL database:', error);
            throw error;
        }
    }

    async close() {
        if (this.client) {
            this.client.release();
        }
        if (this.pool) {
            await this.pool.end();
            this.logger.info('PostgreSQL database connection closed');
        }
    }

    async run(sql, params = []) {
        try {
            // Convert SQLite style ? placeholders to PostgreSQL $1, $2, etc.
            const pgSql = this.convertPlaceholders(sql);
            const result = await this.client.query(pgSql, params);
            
            // Return SQLite-compatible result
            return {
                lastID: result.rows[0]?.id || result.rows.length,
                changes: result.rowCount
            };
        } catch (error) {
            this.logger.error('PostgreSQL run error:', error);
            throw error;
        }
    }

    async get(sql, params = []) {
        try {
            const pgSql = this.convertPlaceholders(sql);
            const result = await this.client.query(pgSql, params);
            return result.rows[0] || null;
        } catch (error) {
            this.logger.error('PostgreSQL get error:', error);
            throw error;
        }
    }

    async all(sql, params = []) {
        try {
            const pgSql = this.convertPlaceholders(sql);
            const result = await this.client.query(pgSql, params);
            return result.rows;
        } catch (error) {
            this.logger.error('PostgreSQL all error:', error);
            throw error;
        }
    }

    async beginTransaction() {
        return this.client.query('BEGIN');
    }

    async commit() {
        return this.client.query('COMMIT');
    }

    async rollback() {
        return this.client.query('ROLLBACK');
    }

    // Convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
    convertPlaceholders(sql) {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++}`);
    }

    // Convert SQLite syntax to PostgreSQL syntax
    convertSQLiteToPostgres(sql) {
        return sql
            // Convert AUTOINCREMENT to SERIAL
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
            // Convert DATETIME to TIMESTAMP
            .replace(/DATETIME/g, 'TIMESTAMP')
            // Convert DECIMAL to NUMERIC
            .replace(/DECIMAL\((\d+),(\d+)\)/g, 'NUMERIC($1,$2)')
            // Convert BOOLEAN to BOOLEAN (same)
            .replace(/BOOLEAN/g, 'BOOLEAN')
            // Convert CHECK constraints
            .replace(/CHECK\((\w+) IN \(([^)]+)\)\)/g, 'CHECK($1 IN ($2))')
            // Convert DEFAULT CURRENT_TIMESTAMP
            .replace(/DEFAULT CURRENT_TIMESTAMP/g, 'DEFAULT CURRENT_TIMESTAMP')
            // Convert date functions
            .replace(/date\('now'\)/g, 'CURRENT_DATE')
            .replace(/datetime\('now'\)/g, 'CURRENT_TIMESTAMP')
            // Convert IGNORE to ON CONFLICT DO NOTHING
            .replace(/INSERT OR IGNORE/g, 'INSERT')
            // Convert IF NOT EXISTS for indexes
            .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX IF NOT EXISTS');
    }

    async createTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                phone VARCHAR(20) PRIMARY KEY,
                name VARCHAR(255),
                timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Categories table
            `CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(10) CHECK(type IN ('income', 'expense')) NOT NULL,
                color VARCHAR(10) DEFAULT '#007bff',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                UNIQUE(user_phone, name, type)
            )`,

            // Transactions table
            `CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                type VARCHAR(10) CHECK(type IN ('income', 'expense')) NOT NULL,
                amount NUMERIC(15,2) NOT NULL,
                description TEXT,
                category_id INTEGER,
                date DATE NOT NULL DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )`,

            // Clients table for debt management
            `CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                UNIQUE(user_phone, name)
            )`,

            // Debts/Receivables table
            `CREATE TABLE IF NOT EXISTS debts (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                client_id INTEGER NOT NULL,
                type VARCHAR(15) CHECK(type IN ('receivable', 'payable')) NOT NULL,
                amount NUMERIC(15,2) NOT NULL,
                paid_amount NUMERIC(15,2) DEFAULT 0,
                description TEXT,
                due_date DATE,
                status VARCHAR(15) CHECK(status IN ('pending', 'partial', 'paid', 'overdue')) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )`,

            // Bills/Recurring transactions table
            `CREATE TABLE IF NOT EXISTS bills (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                amount NUMERIC(15,2) NOT NULL,
                category_id INTEGER,
                due_date DATE NOT NULL,
                frequency VARCHAR(15) CHECK(frequency IN ('monthly', 'weekly', 'yearly', 'one-time')) DEFAULT 'monthly',
                next_reminder DATE,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )`,

            // Settings table
            `CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                setting_key VARCHAR(100) NOT NULL,
                setting_value TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                UNIQUE(user_phone, setting_key)
            )`,

            // AI interactions log
            `CREATE TABLE IF NOT EXISTS ai_interactions (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                prompt TEXT NOT NULL,
                response TEXT,
                type VARCHAR(50) DEFAULT 'general',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone)
            )`
        ];

        for (const table of tables) {
            await this.client.query(table);
        }

        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_phone, date DESC)',
            'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)',
            'CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_phone, status)',
            'CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date)',
            'CREATE INDEX IF NOT EXISTS idx_bills_user_active ON bills(user_phone, is_active)',
            'CREATE INDEX IF NOT EXISTS idx_bills_next_reminder ON bills(next_reminder)'
        ];

        for (const index of indexes) {
            try {
                await this.client.query(index);
            } catch (error) {
                // Ignore if index already exists
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }
        }

        // Insert default categories
        await this.insertDefaultCategories();
    }

    async insertDefaultCategories() {
        const defaultCategories = [
            // Income categories (dalam bahasa Indonesia)
            { name: 'Gaji', type: 'income', color: '#28a745' },
            { name: 'Freelance', type: 'income', color: '#17a2b8' },
            { name: 'Bisnis', type: 'income', color: '#007bff' },
            { name: 'Investasi', type: 'income', color: '#6f42c1' },
            { name: 'Pemasukan Lain', type: 'income', color: '#20c997' },
            
            // Expense categories (dalam bahasa Indonesia)
            { name: 'Makanan', type: 'expense', color: '#fd7e14' },
            { name: 'Transportasi', type: 'expense', color: '#6c757d' },
            { name: 'Utilitas', type: 'expense', color: '#e83e8c' },
            { name: 'Hiburan', type: 'expense', color: '#dc3545' },
            { name: 'Kesehatan', type: 'expense', color: '#ffc107' },
            { name: 'Belanja', type: 'expense', color: '#198754' },
            { name: 'Pengeluaran Bisnis', type: 'expense', color: '#0d6efd' },
            { name: 'Pengeluaran Lain', type: 'expense', color: '#6c757d' }
        ];

        for (const category of defaultCategories) {
            try {
                // Use ON CONFLICT DO NOTHING for PostgreSQL
                await this.client.query(
                    `INSERT INTO categories (user_phone, name, type, color) 
                     VALUES ($1, $2, $3, $4) 
                     ON CONFLICT (user_phone, name, type) DO NOTHING`,
                    ['default', category.name, category.type, category.color]
                );
            } catch (error) {
                this.logger.error(`Error inserting default category ${category.name}:`, error);
            }
        }
    }
}

module.exports = PostgresDatabase;