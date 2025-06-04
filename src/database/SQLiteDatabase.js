const sqlite3 = require('sqlite3').verbose();
const BaseDatabase = require('./BaseDatabase');
const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');

class SQLiteDatabase extends BaseDatabase {
    constructor(dbPath) {
        super();
        this.dbPath = dbPath;
        this.db = null;
        this.logger = new Logger();
    }

    async initialize() {
        try {
            // Ensure directory exists
            const dir = path.dirname(this.dbPath);
            await fs.mkdir(dir, { recursive: true });

            // Create database connection
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    throw new Error(`Failed to connect to SQLite database: ${err.message}`);
                }
            });

            // Enable foreign keys
            await this.run('PRAGMA foreign_keys = ON');
            
            // Create tables
            await this.createTables();
            
            this.logger.info('SQLite database initialized successfully');
        } catch (error) {
            this.logger.error('Error initializing SQLite database:', error);
            throw error;
        }
    }

    async close() {
        if (this.db) {
            return new Promise((resolve, reject) => {
                this.db.close((err) => {
                    if (err) {
                        this.logger.error('Error closing SQLite database:', err);
                        reject(err);
                    } else {
                        this.logger.info('SQLite database connection closed');
                        resolve();
                    }
                });
            });
        }
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async beginTransaction() {
        return this.run('BEGIN TRANSACTION');
    }

    async commit() {
        return this.run('COMMIT');
    }

    async rollback() {
        return this.run('ROLLBACK');
    }

    async createTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                phone TEXT PRIMARY KEY,
                name TEXT,
                timezone TEXT DEFAULT 'Asia/Jakarta',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Categories table (Global/Fixed categories only)
            `CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                color TEXT DEFAULT '#007bff',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, type)
            )`,

            // Transactions table
            `CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                description TEXT,
                category_id INTEGER,
                date DATE NOT NULL DEFAULT (date('now')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )`,

            // Clients table for debt management
            `CREATE TABLE IF NOT EXISTS clients (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                UNIQUE(user_phone, name)
            )`,

            // Debts/Receivables table
            `CREATE TABLE IF NOT EXISTS debts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                client_id INTEGER NOT NULL,
                type TEXT CHECK(type IN ('receivable', 'payable')) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                paid_amount DECIMAL(15,2) DEFAULT 0,
                description TEXT,
                due_date DATE,
                status TEXT CHECK(status IN ('pending', 'partial', 'paid', 'overdue')) DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                FOREIGN KEY (client_id) REFERENCES clients(id)
            )`,

            // Bills/Recurring transactions table
            `CREATE TABLE IF NOT EXISTS bills (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                name TEXT NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                category_id INTEGER,
                due_date DATE NOT NULL,
                frequency TEXT CHECK(frequency IN ('monthly', 'weekly', 'yearly', 'one-time')) DEFAULT 'monthly',
                next_reminder DATE,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )`,

            // Settings table
            `CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                setting_key TEXT NOT NULL,
                setting_value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                UNIQUE(user_phone, setting_key)
            )`,

            // AI interactions log
            `CREATE TABLE IF NOT EXISTS ai_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                prompt TEXT NOT NULL,
                response TEXT,
                type TEXT DEFAULT 'general',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone)
            )`
        ];

        for (const table of tables) {
            await this.run(table);
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
            await this.run(index);
        }

        // Insert default categories
        await this.insertDefaultCategories();
    }

    async insertDefaultCategories() {
        const defaultCategories = [
            // Income categories (Pemasukan)
            { name: 'Gaji', type: 'income', color: '#28a745' },
            { name: 'Freelance', type: 'income', color: '#17a2b8' },
            { name: 'Bisnis', type: 'income', color: '#007bff' },
            { name: 'Investasi', type: 'income', color: '#6f42c1' },
            { name: 'Bonus', type: 'income', color: '#28a745' },
            { name: 'Pemasukan Lain', type: 'income', color: '#20c997' },
            
            // Essential Expense categories (Pengeluaran Wajib)
            { name: 'Makanan', type: 'expense', color: '#fd7e14' },
            { name: 'Transportasi', type: 'expense', color: '#6c757d' },
            { name: 'Utilitas', type: 'expense', color: '#e83e8c' },
            { name: 'Kesehatan', type: 'expense', color: '#ffc107' },
            { name: 'Belanja', type: 'expense', color: '#198754' },
            { name: 'Hiburan', type: 'expense', color: '#dc3545' },
            { name: 'Pengeluaran Bisnis', type: 'expense', color: '#0d6efd' },
            { name: 'Pengeluaran Lain', type: 'expense', color: '#6c757d' }
        ];

        try {
            this.logger.info('Setting up global fixed categories for SQLite...');
            
            // Check existing categories
            const existingCount = await this.get('SELECT COUNT(*) as count FROM categories');
            const currentCount = existingCount ? existingCount.count : 0;
            
            this.logger.info(`Current categories: ${currentCount}, Required: ${defaultCategories.length}`);
            
            // If categories are empty or insufficient, recreate them
            if (currentCount === 0 || currentCount < defaultCategories.length) {
                this.logger.info('Recreating global categories...');
                
                // Clear existing categories
                await this.run('DELETE FROM categories');
                
                // Insert all default categories as global categories
                for (const category of defaultCategories) {
                    try {
                        const result = await this.run(
                            'INSERT INTO categories (name, type, color, is_active) VALUES (?, ?, ?, 1)',
                            [category.name, category.type, category.color]
                        );
                        this.logger.info(`✅ Inserted global category: ${category.name} (${category.type}) - ID: ${result.lastID}`);
                    } catch (error) {
                        this.logger.error(`❌ Failed to insert category ${category.name}:`, error);
                    }
                }
                
                // Verify insertion
                const finalCount = await this.get('SELECT COUNT(*) as count FROM categories');
                this.logger.info(`✅ Global categories setup completed. Total: ${finalCount.count}`);
                
                // Show all inserted categories for verification
                const allCategories = await this.all(
                    'SELECT id, name, type FROM categories ORDER BY type, name'
                );
                
                this.logger.info('📋 Global categories:');
                allCategories.forEach(cat => {
                    this.logger.info(`   - ${cat.name} (${cat.type}) [ID: ${cat.id}]`);
                });
            } else {
                this.logger.info('Global categories already sufficient, skipping recreation');
            }
            
        } catch (error) {
            this.logger.error('❌ Critical error in insertDefaultCategories:', error);
            throw error;
        }
    }
}

module.exports = SQLiteDatabase;