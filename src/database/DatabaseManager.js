const DatabaseFactory = require('./DatabaseFactory');
const Logger = require('../utils/Logger');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.logger = new Logger();
    }

    async initialize() {
        try {
            // Create database instance based on configuration
            this.db = DatabaseFactory.create();
            
            // Initialize the database
            await this.db.initialize();
            
            this.logger.info('Database initialized successfully');
        } catch (error) {
            this.logger.error('Error initializing database:', error);
            throw error;
        }
    }

    async close() {
        if (this.db) {
            await this.db.close();
        }
    }

    // Core database operations - delegate to underlying database
    async run(sql, params = []) {
        if (!this.db) {
            throw new Error('Database belum diinisialisasi');
        }
        return this.db.run(sql, params);
    }

    async get(sql, params = []) {
        if (!this.db) {
            throw new Error('Database belum diinisialisasi');
        }
        return this.db.get(sql, params);
    }

    async all(sql, params = []) {
        if (!this.db) {
            throw new Error('Database belum diinisialisasi');
        }
        return this.db.all(sql, params);
    }

    async beginTransaction() {
        if (!this.db) {
            throw new Error('Database belum diinisialisasi');
        }
        return this.db.beginTransaction();
    }

    async commit() {
        if (!this.db) {
            throw new Error('Database belum diinisialisasi');
        }
        return this.db.commit();
    }

    async rollback() {
        if (!this.db) {
            throw new Error('Database belum diinisialisasi');
        }
        return this.db.rollback();
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

    // Client management (for debt tracking)
    async addClient(userPhone, name, phone = null, email = null, notes = null) {
        const result = await this.run(
            'INSERT INTO clients (user_phone, name, phone, email, notes) VALUES (?, ?, ?, ?, ?)',
            [userPhone, name, phone, email, notes]
        );
        return result.lastID;
    }

    async getClients(userPhone) {
        return await this.all(
            'SELECT * FROM clients WHERE user_phone = ? ORDER BY name',
            [userPhone]
        );
    }

    async getClientByName(userPhone, name) {
        return await this.get(
            'SELECT * FROM clients WHERE user_phone = ? AND name = ?',
            [userPhone, name]
        );
    }

    // Debt management
    async addDebt(userPhone, clientId, type, amount, description, dueDate = null) {
        const result = await this.run(
            'INSERT INTO debts (user_phone, client_id, type, amount, description, due_date) VALUES (?, ?, ?, ?, ?, ?)',
            [userPhone, clientId, type, amount, description, dueDate]
        );
        return result.lastID;
    }

    async getDebts(userPhone, status = null) {
        let sql = `
            SELECT d.*, c.name as client_name, c.phone as client_phone 
            FROM debts d 
            JOIN clients c ON d.client_id = c.id 
            WHERE d.user_phone = ?
        `;
        let params = [userPhone];
        
        if (status) {
            sql += ' AND d.status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY d.due_date ASC, d.created_at DESC';
        
        return await this.all(sql, params);
    }

    async updateDebtPayment(debtId, userPhone, paidAmount) {
        const debt = await this.get(
            'SELECT * FROM debts WHERE id = ? AND user_phone = ?',
            [debtId, userPhone]
        );
        
        if (!debt) {
            throw new Error('Hutang tidak ditemukan');
        }
        
        const newPaidAmount = debt.paid_amount + paidAmount;
        let status = 'partial';
        
        if (newPaidAmount >= debt.amount) {
            status = 'paid';
        }
        
        await this.run(
            'UPDATE debts SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newPaidAmount, status, debtId]
        );
        
        return { newPaidAmount, status, remaining: debt.amount - newPaidAmount };
    }

    // Bills management
    async addBill(userPhone, name, amount, categoryId, dueDate, frequency = 'monthly') {
        const result = await this.run(
            'INSERT INTO bills (user_phone, name, amount, category_id, due_date, frequency) VALUES (?, ?, ?, ?, ?, ?)',
            [userPhone, name, amount, categoryId, dueDate, frequency]
        );
        return result.lastID;
    }

    async getBills(userPhone, isActive = true) {
        return await this.all(`
            SELECT b.*, c.name as category_name 
            FROM bills b 
            LEFT JOIN categories c ON b.category_id = c.id 
            WHERE b.user_phone = ? AND b.is_active = ?
            ORDER BY b.due_date ASC
        `, [userPhone, isActive ? 1 : 0]);
    }

    // Settings management
    async getSetting(userPhone, key) {
        const result = await this.get(
            'SELECT setting_value FROM settings WHERE user_phone = ? AND setting_key = ?',
            [userPhone, key]
        );
        return result ? result.setting_value : null;
    }

    async setSetting(userPhone, key, value) {
        await this.run(
            `INSERT OR REPLACE INTO settings (user_phone, setting_key, setting_value, updated_at) 
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [userPhone, key, value]
        );
    }

    // AI interactions log
    async logAIInteraction(userPhone, prompt, response, type = 'general') {
        const result = await this.run(
            'INSERT INTO ai_interactions (user_phone, prompt, response, type) VALUES (?, ?, ?, ?)',
            [userPhone, prompt, response, type]
        );
        return result.lastID;
    }

    async getAIInteractions(userPhone, limit = 50) {
        return await this.all(
            'SELECT * FROM ai_interactions WHERE user_phone = ? ORDER BY created_at DESC LIMIT ?',
            [userPhone, limit]
        );
    }

    // Backup functionality - depends on database type
    async backup() {
        try {
            const dbType = process.env.DATABASE_TYPE || 'sqlite3';
            
            if (dbType === 'sqlite3') {
                const fs = require('fs-extra');
                const path = require('path');
                
                const backupDir = process.env.BACKUP_PATH || './backups';
                await fs.ensureDir(backupDir);
                
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = path.join(backupDir, `financial_backup_${timestamp}.db`);
                
                const dbPath = process.env.DB_PATH || './data/financial.db';
                await fs.copy(dbPath, backupPath);
                
                this.logger.info(`Database backed up to: ${backupPath}`);
                return backupPath;
            } else {
                throw new Error('Backup not yet implemented for PostgreSQL. Use pg_dump instead.');
            }
        } catch (error) {
            this.logger.error('Backup failed:', error);
            throw error;
        }
    }

    // Database type info
    getDatabaseType() {
        return process.env.DATABASE_TYPE || 'sqlite3';
    }
}

module.exports = DatabaseManager;