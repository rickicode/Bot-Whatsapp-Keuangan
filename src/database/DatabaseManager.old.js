const sqlite3 = require('sqlite3').verbose();
const fs = require('fs-extra');
const path = require('path');
const Logger = require('../utils/Logger');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.logger = new Logger();
        this.dbPath = process.env.DB_PATH || './data/financial.db';
    }

    async initialize() {
        try {
            // Ensure data directory exists
            const dbDir = path.dirname(this.dbPath);
            await fs.ensureDir(dbDir);

            // Create database connection
            this.db = new sqlite3.Database(this.dbPath);
            
            // Enable foreign keys
            await this.run('PRAGMA foreign_keys = ON');
            
            // Create tables
            await this.createTables();
            
            this.logger.info('Database initialized successfully');
        } catch (error) {
            this.logger.error('Database initialization failed:', error);
            throw error;
        }
    }

    async createTables() {
        const tables = [
            // Users table
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                name TEXT,
                timezone TEXT DEFAULT 'Asia/Jakarta',
                default_currency TEXT DEFAULT 'IDR',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Categories table
            `CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                color TEXT DEFAULT '#007bff',
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                UNIQUE(user_phone, name, type)
            )`,

            // Transactions table
            `CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                category_id INTEGER,
                description TEXT,
                date DATE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )`,

            // Clients/Debtors table
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
                await this.run(
                    `INSERT OR IGNORE INTO categories (user_phone, name, type, color) 
                     SELECT 'default', ?, ?, ? WHERE NOT EXISTS (
                         SELECT 1 FROM categories WHERE user_phone = 'default' AND name = ? AND type = ?
                     )`,
                    [category.name, category.type, category.color, category.name, category.type]
                );
            } catch (error) {
                // Ignore duplicate entries
            }
        }
    }

    // Promisify database operations
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // User management
    async createUser(phone, name = null) {
        try {
            await this.run(
                'INSERT OR IGNORE INTO users (phone, name) VALUES (?, ?)',
                [phone, name]
            );
            
            // Copy default categories for new user
            await this.run(`
                INSERT OR IGNORE INTO categories (user_phone, name, type, color)
                SELECT ?, name, type, color FROM categories WHERE user_phone = 'default'
            `, [phone]);
            
            return await this.getUser(phone);
        } catch (error) {
            this.logger.error('Error creating user:', error);
            throw error;
        }
    }

    async getUser(phone) {
        return await this.get('SELECT * FROM users WHERE phone = ?', [phone]);
    }

    // Transaction methods
    async addTransaction(userPhone, type, amount, categoryId, description, date = null) {
        const transactionDate = date || new Date().toISOString().split('T')[0];
        
        const result = await this.run(
            `INSERT INTO transactions (user_phone, type, amount, category_id, description, date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userPhone, type, amount, categoryId, description, transactionDate]
        );
        
        return result.lastID;
    }

    async getTransactions(userPhone, limit = 50, offset = 0) {
        return await this.all(`
            SELECT t.*, c.name as category_name, c.color as category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = ?
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT ? OFFSET ?
        `, [userPhone, limit, offset]);
    }

    async getTransactionById(id, userPhone) {
        return await this.get(`
            SELECT t.*, c.name as category_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = ? AND t.user_phone = ?
        `, [id, userPhone]);
    }

    async updateTransaction(id, userPhone, updates) {
        const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const values = Object.values(updates);
        values.push(id, userPhone);
        
        await this.run(
            `UPDATE transactions SET ${fields}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ? AND user_phone = ?`,
            values
        );
    }

    async deleteTransaction(id, userPhone) {
        await this.run(
            'DELETE FROM transactions WHERE id = ? AND user_phone = ?',
            [id, userPhone]
        );
    }

    // Category methods
    async getCategories(userPhone, type = null) {
        let sql = 'SELECT * FROM categories WHERE user_phone IN (?, "default") AND is_active = 1';
        let params = [userPhone];
        
        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }
        
        sql += ' ORDER BY name';
        
        return await this.all(sql, params);
    }

    async getCategoryById(id) {
        return await this.get('SELECT * FROM categories WHERE id = ?', [id]);
    }

    async addCategory(userPhone, name, type, color = '#007bff') {
        const result = await this.run(
            'INSERT INTO categories (user_phone, name, type, color) VALUES (?, ?, ?, ?)',
            [userPhone, name, type, color]
        );
        return result.lastID;
    }

    // Balance calculation
    async getBalance(userPhone, endDate = null) {
        const dateFilter = endDate ? 'AND date <= ?' : '';
        const params = endDate ? [userPhone, endDate] : [userPhone];
        
        const income = await this.get(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM transactions 
            WHERE user_phone = ? AND type = 'income' ${dateFilter}
        `, params);
        
        const expenses = await this.get(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM transactions 
            WHERE user_phone = ? AND type = 'expense' ${dateFilter}
        `, params);
        
        return {
            income: income.total,
            expenses: expenses.total,
            balance: income.total - expenses.total
        };
    }

    // Backup functionality
    async backup() {
        try {
            const backupDir = process.env.BACKUP_PATH || './backups';
            await fs.ensureDir(backupDir);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `financial_backup_${timestamp}.db`);
            
            await fs.copy(this.dbPath, backupPath);
            
            this.logger.info(`Database backed up to: ${backupPath}`);
            return backupPath;
        } catch (error) {
            this.logger.error('Backup failed:', error);
            throw error;
        }
    }

    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        this.logger.error('Error closing database:', err);
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = DatabaseManager;