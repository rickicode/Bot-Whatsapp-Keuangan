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
            const dbType = this.getDatabaseType();
            
            if (dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase') {
                // Just insert the user - categories are now global
                await this.run(
                    'INSERT INTO users (phone, name, timezone) VALUES ($1, $2, $3) ON CONFLICT (phone) DO NOTHING',
                    [phone, name, 'Asia/Jakarta']
                );
            } else {
                // SQLite syntax
                await this.run(
                    'INSERT OR IGNORE INTO users (phone, name, timezone) VALUES (?, ?, ?)',
                    [phone, name, 'Asia/Jakarta']
                );
            }
            
            // Only log detailed user creation in debug mode
            if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                this.logger.info(`User ${phone} created successfully - using global categories`);
            }
            return await this.getUser(phone);
        } catch (error) {
            this.logger.error('Error creating user:', error);
            throw error;
        }
    }

    async getUser(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.get('SELECT * FROM users WHERE phone = $1', [phone]);
        } else {
            return await this.get('SELECT * FROM users WHERE phone = ?', [phone]);
        }
    }

    // Transaction methods
    async addTransaction(userPhone, type, amount, categoryId, description, date = null) {
        try {
            const dbType = this.getDatabaseType();
            const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
            const transactionDate = date || new Date().toISOString().split('T')[0];
            
            // Only log transaction details in debug mode
            if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                this.logger.info(`Adding transaction: userPhone=${userPhone}, type=${type}, amount=${amount}, categoryId=${categoryId}, description=${description}, date=${transactionDate}`);
            }
            
            // Verify user exists
            if (isPostgres) {
                const userExists = await this.get('SELECT phone FROM users WHERE phone = $1', [userPhone]);
                if (!userExists) {
                    this.logger.error(`User ${userPhone} does not exist in database`);
                    throw new Error(`User ${userPhone} not found`);
                }
                
                // Verify category exists
                const categoryExists = await this.get('SELECT id FROM categories WHERE id = $1', [categoryId]);
                if (!categoryExists) {
                    this.logger.error(`Category ${categoryId} does not exist in database`);
                    throw new Error(`Category ${categoryId} not found`);
                }
                
                const result = await this.run(
                    `INSERT INTO transactions (user_phone, type, amount, category_id, description, date)
                     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                    [userPhone, type, amount, categoryId, description, transactionDate]
                );
                
                // Only log detailed transaction info in debug mode
                if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                    this.logger.info(`✅ Transaction inserted successfully with ID: ${result.lastID}`);
                }
                return result.lastID;
            } else {
                // SQLite syntax
                const userExists = await this.get('SELECT phone FROM users WHERE phone = ?', [userPhone]);
                if (!userExists) {
                    this.logger.error(`User ${userPhone} does not exist in database`);
                    throw new Error(`User ${userPhone} not found`);
                }
                
                // Verify category exists
                const categoryExists = await this.get('SELECT id FROM categories WHERE id = ?', [categoryId]);
                if (!categoryExists) {
                    this.logger.error(`Category ${categoryId} does not exist in database`);
                    throw new Error(`Category ${categoryId} not found`);
                }
                
                const result = await this.run(
                    `INSERT INTO transactions (user_phone, type, amount, category_id, description, date)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [userPhone, type, amount, categoryId, description, transactionDate]
                );
                
                // Only log detailed transaction info in debug mode
                if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                    this.logger.info(`✅ Transaction inserted successfully with ID: ${result.lastID}`);
                }
                return result.lastID;
            }
        } catch (error) {
            this.logger.error('❌ Error in addTransaction:', error);
            this.logger.error('Parameters:', { userPhone, type, amount, categoryId, description, date });
            throw error;
        }
    }

    async getTransactions(userPhone, limit = 50, offset = 0) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.all(`
                SELECT t.*, c.name as category_name, c.color as category_color
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = $1
                ORDER BY t.date DESC, t.created_at DESC
                LIMIT $2 OFFSET $3
            `, [userPhone, limit, offset]);
        } else {
            return await this.all(`
                SELECT t.*, c.name as category_name, c.color as category_color
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = ?
                ORDER BY t.date DESC, t.created_at DESC
                LIMIT ? OFFSET ?
            `, [userPhone, limit, offset]);
        }
    }

    async getTransactionById(id, userPhone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.get(`
                SELECT t.*, c.name as category_name
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = $1 AND t.user_phone = $2
            `, [id, userPhone]);
        } else {
            return await this.get(`
                SELECT t.*, c.name as category_name
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = ? AND t.user_phone = ?
            `, [id, userPhone]);
        }
    }

    async updateTransaction(id, userPhone, updates) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql';
        
        let paramCount = 1;
        const fields = Object.keys(updates).map(key => {
            return `${key} = ${isPostgres ? '$' + paramCount++ : '?'}`;
        }).join(', ');
        
        const values = Object.values(updates);
        values.push(id, userPhone);
        
        await this.run(
            `UPDATE transactions SET ${fields}, updated_at = CURRENT_TIMESTAMP
             WHERE id = ${isPostgres ? '$' + paramCount++ : '?'}
             AND user_phone = ${isPostgres ? '$' + paramCount : '?'}`,
            values
        );
    }

    async deleteTransaction(id, userPhone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                'DELETE FROM transactions WHERE id = $1 AND user_phone = $2',
                [id, userPhone]
            );
        } else {
            await this.run(
                'DELETE FROM transactions WHERE id = ? AND user_phone = ?',
                [id, userPhone]
            );
        }
    }

    // Category methods (Fixed/Global categories only)
    async getCategories(userPhone = null, type = null) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            let sql = 'SELECT * FROM categories WHERE is_active = true';
            let params = [];
            
            if (type) {
                sql += ' AND type = $1';
                params.push(type);
            }
            
            sql += ' ORDER BY name';
            return await this.all(sql, params);
        } else {
            let sql = 'SELECT * FROM categories WHERE is_active = 1';
            let params = [];
            
            if (type) {
                sql += ' AND type = ?';
                params.push(type);
            }
            
            sql += ' ORDER BY name';
            return await this.all(sql, params);
        }
    }

    async getCategoryById(id) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.get('SELECT * FROM categories WHERE id = $1', [id]);
        } else {
            return await this.get('SELECT * FROM categories WHERE id = ?', [id]);
        }
    }

    // Admin-only category management for global categories
    async addCategory(userPhone, name, type, color = '#007bff') {
        // Check if user is admin
        const isAdmin = await this.isUserAdmin(userPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat menambahkan kategori baru.');
        }

        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            const result = await this.run(
                'INSERT INTO categories (name, type, color) VALUES ($1, $2, $3) RETURNING id',
                [name, type, color]
            );
            return result.lastID;
        } else {
            const result = await this.run(
                'INSERT INTO categories (name, type, color) VALUES (?, ?, ?)',
                [name, type, color]
            );
            return result.lastID;
        }
    }

    // Admin-only category editing
    async updateCategory(userPhone, categoryId, updates) {
        // Check if user is admin
        const isAdmin = await this.isUserAdmin(userPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat mengedit kategori.');
        }

        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        let paramCount = 1;
        const fields = Object.keys(updates).map(key => {
            return `${key} = ${isPostgres ? '$' + paramCount++ : '?'}`;
        }).join(', ');
        
        const values = Object.values(updates);
        values.push(categoryId);
        
        await this.run(
            `UPDATE categories SET ${fields} WHERE id = ${isPostgres ? '$' + paramCount : '?'}`,
            values
        );
    }

    // Admin-only category deletion (deactivation)
    async deleteCategory(userPhone, categoryId) {
        // Check if user is admin
        const isAdmin = await this.isUserAdmin(userPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat menghapus kategori.');
        }

        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        // Soft delete - just deactivate the category
        if (isPostgres) {
            await this.run(
                'UPDATE categories SET is_active = false WHERE id = $1',
                [categoryId]
            );
        } else {
            await this.run(
                'UPDATE categories SET is_active = 0 WHERE id = ?',
                [categoryId]
            );
        }
    }

    // Balance calculation
    async getBalance(userPhone, endDate = null) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql';
        
        let dateFilter = '';
        let params = [userPhone];
        
        if (endDate) {
            dateFilter = `AND date <= ${isPostgres ? '$2' : '?'}`;
            params.push(endDate);
        }
        
        const income = await this.get(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_phone = ${isPostgres ? '$1' : '?'}
            AND type = 'income' ${dateFilter}
        `, params);
        
        const expenses = await this.get(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_phone = ${isPostgres ? '$1' : '?'}
            AND type = 'expense' ${dateFilter}
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
        const dbType = this.getDatabaseType();
        
        if (dbType === 'postgres' || dbType === 'postgresql') {
            await this.run(
                `INSERT INTO settings (user_phone, setting_key, setting_value, updated_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                 ON CONFLICT (user_phone, setting_key)
                 DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
                [userPhone, key, value]
            );
        } else {
            await this.run(
                `INSERT OR REPLACE INTO settings (user_phone, setting_key, setting_value, updated_at)
                 VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [userPhone, key, value]
            );
        }
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

    // User Registration Management
    async getUserRegistrationStatus(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.get(
                'SELECT phone, name, email, city, registration_completed, is_active FROM users WHERE phone = $1',
                [phone]
            );
        } else {
            return await this.get(
                'SELECT phone, name, email, city, registration_completed, is_active FROM users WHERE phone = ?',
                [phone]
            );
        }
    }

    async createRegistrationSession(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                `INSERT INTO registration_sessions (phone, step, session_data, expires_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
                 ON CONFLICT (phone) DO UPDATE SET
                 step = $2, session_data = $3, expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours', created_at = CURRENT_TIMESTAMP`,
                [phone, 'name', '{}']
            );
        } else {
            // For SQLite, we'll use a simpler approach
            await this.run(
                `INSERT OR REPLACE INTO registration_sessions (phone, step, session_data, expires_at)
                 VALUES (?, ?, ?, datetime('now', '+24 hours'))`,
                [phone, 'name', '{}']
            );
        }
    }

    async getRegistrationSession(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.get(
                'SELECT * FROM registration_sessions WHERE phone = $1 AND expires_at > CURRENT_TIMESTAMP',
                [phone]
            );
        } else {
            return await this.get(
                "SELECT * FROM registration_sessions WHERE phone = ? AND expires_at > datetime('now')",
                [phone]
            );
        }
    }

    async updateRegistrationSession(phone, step, sessionData) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                'UPDATE registration_sessions SET step = $1, session_data = $2 WHERE phone = $3',
                [step, JSON.stringify(sessionData), phone]
            );
        } else {
            await this.run(
                'UPDATE registration_sessions SET step = ?, session_data = ? WHERE phone = ?',
                [step, JSON.stringify(sessionData), phone]
            );
        }
    }

    async completeUserRegistration(phone, name, email, city) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        try {
            await this.beginTransaction();
            
            // Update user with complete registration data
            if (isPostgres) {
                await this.run(
                    `INSERT INTO users (phone, name, email, city, timezone, registration_completed, is_active)
                     VALUES ($1, $2, $3, $4, $5, true, true)
                     ON CONFLICT (phone) DO UPDATE SET
                     name = $2, email = $3, city = $4, registration_completed = true, is_active = true`,
                    [phone, name, email, city, 'Asia/Jakarta']
                );
                
                // Create default free subscription
                const freePlan = await this.get('SELECT id FROM subscription_plans WHERE name = $1', ['free']);
                if (freePlan) {
                    await this.run(
                        `INSERT INTO user_subscriptions (user_phone, plan_id, status, transaction_count, last_reset_date)
                         VALUES ($1, $2, $3, 0, CURRENT_DATE)
                         ON CONFLICT (user_phone) DO NOTHING`,
                        [phone, freePlan.id, 'active']
                    );
                }
                
                // Delete registration session
                await this.run('DELETE FROM registration_sessions WHERE phone = $1', [phone]);
            } else {
                // SQLite implementation
                await this.run(
                    `INSERT OR REPLACE INTO users (phone, name, email, city, timezone, registration_completed, is_active)
                     VALUES (?, ?, ?, ?, ?, 1, 1)`,
                    [phone, name, email, city, 'Asia/Jakarta']
                );
                
                // Create default free subscription
                const freePlan = await this.get('SELECT id FROM subscription_plans WHERE name = ?', ['free']);
                if (freePlan) {
                    await this.run(
                        `INSERT OR IGNORE INTO user_subscriptions (user_phone, plan_id, status, transaction_count, last_reset_date)
                         VALUES (?, ?, ?, 0, date('now'))`,
                        [phone, freePlan.id, 'active']
                    );
                }
                
                // Delete registration session
                await this.run('DELETE FROM registration_sessions WHERE phone = ?', [phone]);
            }
            
            await this.commit();
            
            // Copy default categories for the new user
            await this.copyDefaultCategories(phone);
            
            // Check and auto-promote admin user
            const isPromoted = await this.checkAndPromoteAdmin(phone);
            if (isPromoted) {
                this.logger.info(`User ${phone} auto-promoted to admin based on USER_ADMIN env`);
            }
            
            return await this.getUser(phone);
            
        } catch (error) {
            await this.rollback();
            throw error;
        }
    }

    async deleteRegistrationSession(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run('DELETE FROM registration_sessions WHERE phone = $1', [phone]);
        } else {
            await this.run('DELETE FROM registration_sessions WHERE phone = ?', [phone]);
        }
    }

    // Categories are now global - no need to copy per user
    async copyDefaultCategories(phone) {
        // Categories are now fixed/global, no copying needed
        this.logger.info(`Skipping category copy for ${phone} - using global categories`);
        return;
    }

    // Subscription Management
    async getUserSubscription(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.get(`
                SELECT us.*, sp.name as plan_name, sp.display_name, sp.description,
                       sp.monthly_transaction_limit, sp.features
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.user_phone = $1
            `, [phone]);
        } else {
            return await this.get(`
                SELECT us.*, sp.name as plan_name, sp.display_name, sp.description,
                       sp.monthly_transaction_limit, sp.features
                FROM user_subscriptions us
                JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE us.user_phone = ?
            `, [phone]);
        }
    }

    async checkTransactionLimit(phone) {
        const subscription = await this.getUserSubscription(phone);
        
        if (!subscription) {
            return { allowed: false, reason: 'No subscription found' };
        }
        
        if (subscription.status !== 'active') {
            return { allowed: false, reason: 'Subscription expired', subscription };
        }
        
        // Auto-reset daily transaction count if needed
        await this.checkAndResetDailyCount(phone);
        
        // Get updated subscription after potential reset
        const updatedSubscription = await this.getUserSubscription(phone);
        
        // Premium plan has unlimited transactions
        if (updatedSubscription.monthly_transaction_limit === null) {
            return { allowed: true, subscription: updatedSubscription };
        }
        
        // Check if user has reached the daily limit (now using monthly_transaction_limit as daily limit)
        if (updatedSubscription.transaction_count >= updatedSubscription.monthly_transaction_limit) {
            return {
                allowed: false,
                reason: 'Daily limit reached',
                subscription: updatedSubscription,
                remaining: 0
            };
        }
        
        return {
            allowed: true,
            subscription: updatedSubscription,
            remaining: updatedSubscription.monthly_transaction_limit - updatedSubscription.transaction_count
        };
    }

    async incrementTransactionCount(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                'UPDATE user_subscriptions SET transaction_count = transaction_count + 1 WHERE user_phone = $1',
                [phone]
            );
        } else {
            await this.run(
                'UPDATE user_subscriptions SET transaction_count = transaction_count + 1 WHERE user_phone = ?',
                [phone]
            );
        }
    }

    async checkAndResetDailyCount(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                `UPDATE user_subscriptions
                 SET transaction_count = 0, last_reset_date = CURRENT_DATE
                 WHERE user_phone = $1 AND (last_reset_date < CURRENT_DATE OR last_reset_date IS NULL)`,
                [phone]
            );
        } else {
            await this.run(
                `UPDATE user_subscriptions
                 SET transaction_count = 0, last_reset_date = date('now')
                 WHERE user_phone = ? AND (last_reset_date < date('now') OR last_reset_date IS NULL)`,
                [phone]
            );
        }
    }

    async resetMonthlyTransactionCount(phone) {
        // Now this method resets daily count (renamed but kept for backward compatibility)
        await this.checkAndResetDailyCount(phone);
    }

    async updateLastActivity(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE phone = $1',
                [phone]
            );
        } else {
            await this.run(
                "UPDATE users SET last_activity = datetime('now') WHERE phone = ?",
                [phone]
            );
        }
    }

    // Email validation
    async isEmailUnique(email, excludePhone = null) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        let sql, params;
        
        if (excludePhone) {
            if (isPostgres) {
                sql = 'SELECT COUNT(*) as count FROM users WHERE email = $1 AND phone != $2';
                params = [email, excludePhone];
            } else {
                sql = 'SELECT COUNT(*) as count FROM users WHERE email = ? AND phone != ?';
                params = [email, excludePhone];
            }
        } else {
            if (isPostgres) {
                sql = 'SELECT COUNT(*) as count FROM users WHERE email = $1';
                params = [email];
            } else {
                sql = 'SELECT COUNT(*) as count FROM users WHERE email = ?';
                params = [email];
            }
        }
        
        const result = await this.get(sql, params);
        return Number(result.count) === 0;
    }

    // Cleanup expired registration sessions
    async cleanupExpiredRegistrationSessions() {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            const result = await this.run('DELETE FROM registration_sessions WHERE expires_at < CURRENT_TIMESTAMP');
            return result.changes || 0;
        } else {
            const result = await this.run("DELETE FROM registration_sessions WHERE expires_at < datetime('now')");
            return result.changes || 0;
        }
    }

    // Admin Management
    async isUserAdmin(phone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        // Check if user is admin by phone number from env
        const adminPhone = process.env.USER_ADMIN?.replace(/\+/g, '');
        const userPhoneClean = phone.replace(/\+/g, '');
        
        if (adminPhone && userPhoneClean.includes(adminPhone)) {
            return true;
        }
        
        // Check if user is marked as admin in database
        let user;
        if (isPostgres) {
            user = await this.get('SELECT is_admin FROM users WHERE phone = $1', [phone]);
        } else {
            user = await this.get('SELECT is_admin FROM users WHERE phone = ?', [phone]);
        }
        
        return user?.is_admin || false;
    }

    async setUserAdmin(phone, isAdmin = true) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                'UPDATE users SET is_admin = $1 WHERE phone = $2',
                [isAdmin, phone]
            );
        } else {
            await this.run(
                'UPDATE users SET is_admin = ? WHERE phone = ?',
                [isAdmin ? 1 : 0, phone]
            );
        }
    }

    // Auto-promote admin user during registration
    async checkAndPromoteAdmin(phone) {
        const adminPhone = process.env.USER_ADMIN?.replace(/\+/g, '');
        const userPhoneClean = phone.replace(/\+/g, '');
        
        if (adminPhone && userPhoneClean.includes(adminPhone)) {
            await this.setUserAdmin(phone, true);
            return true;
        }
        
        return false;
    }

    // Admin-only: Change user plan
    async changeUserPlan(adminPhone, targetPhone, newPlanName) {
        // Check if requester is admin
        const isAdmin = await this.isUserAdmin(adminPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat mengubah plan user.');
        }

        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        // Get the new plan
        let plan;
        if (isPostgres) {
            plan = await this.get('SELECT * FROM subscription_plans WHERE name = $1', [newPlanName]);
        } else {
            plan = await this.get('SELECT * FROM subscription_plans WHERE name = ?', [newPlanName]);
        }
        
        if (!plan) {
            throw new Error(`Plan '${newPlanName}' tidak ditemukan.`);
        }

        // Update user subscription
        if (isPostgres) {
            await this.run(
                `UPDATE user_subscriptions
                 SET plan_id = $1, transaction_count = 0, last_reset_date = CURRENT_DATE
                 WHERE user_phone = $2`,
                [plan.id, targetPhone]
            );
        } else {
            await this.run(
                `UPDATE user_subscriptions
                 SET plan_id = ?, transaction_count = 0, last_reset_date = date('now')
                 WHERE user_phone = ?`,
                [plan.id, targetPhone]
            );
        }

        return plan;
    }

    // Admin-only: Suspend/Unsuspend user
    async suspendUser(adminPhone, targetPhone, suspend = true) {
        // Check if requester is admin
        const isAdmin = await this.isUserAdmin(adminPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat menangguhkan user.');
        }

        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                'UPDATE users SET is_active = $1 WHERE phone = $2',
                [!suspend, targetPhone]
            );
        } else {
            await this.run(
                'UPDATE users SET is_active = ? WHERE phone = ?',
                [suspend ? 0 : 1, targetPhone]
            );
        }
    }

    // Get all subscription plans
    async getSubscriptionPlans() {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.all('SELECT * FROM subscription_plans ORDER BY name');
        } else {
            return await this.all('SELECT * FROM subscription_plans ORDER BY name');
        }
    }

    // Get user list (admin only) - with ordering options
    async getUserList(adminPhone, limit = 20, offset = 0, orderBy = 'name') {
        // Check if requester is admin
        const isAdmin = await this.isUserAdmin(adminPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat melihat daftar user.');
        }

        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        // Determine order clause
        let orderClause = 'ORDER BY u.name';
        if (orderBy === 'newest') {
            orderClause = 'ORDER BY u.created_at DESC';
        } else if (orderBy === 'activity') {
            orderClause = 'ORDER BY u.last_activity DESC';
        }
        
        if (isPostgres) {
            return await this.all(`
                SELECT u.phone, u.name, u.email, u.city, u.is_active, u.is_admin, u.registration_completed,
                       u.created_at, u.last_activity,
                       sp.display_name as plan_name, us.transaction_count, us.status as subscription_status
                FROM users u
                LEFT JOIN user_subscriptions us ON u.phone = us.user_phone
                LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE u.registration_completed = true
                ${orderClause}
                LIMIT $1 OFFSET $2
            `, [limit, offset]);
        } else {
            return await this.all(`
                SELECT u.phone, u.name, u.email, u.city, u.is_active, u.is_admin, u.registration_completed,
                       u.created_at, u.last_activity,
                       sp.display_name as plan_name, us.transaction_count, us.status as subscription_status
                FROM users u
                LEFT JOIN user_subscriptions us ON u.phone = us.user_phone
                LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
                WHERE u.registration_completed = 1
                ${orderClause}
                LIMIT ? OFFSET ?
            `, [limit, offset]);
        }
    }

    // Reset user daily limit (admin only)
    async resetUserDailyLimit(targetPhone) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            await this.run(
                `UPDATE user_subscriptions
                 SET transaction_count = 0, last_reset_date = CURRENT_DATE
                 WHERE user_phone = $1`,
                [targetPhone]
            );
        } else {
            await this.run(
                `UPDATE user_subscriptions
                 SET transaction_count = 0, last_reset_date = date('now')
                 WHERE user_phone = ?`,
                [targetPhone]
            );
        }
    }

    // Get transactions by date range
    async getTransactionsByDateRange(userPhone, startDate, endDate) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.all(`
                SELECT t.*, c.name as category_name, c.type as category_type
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = $1 AND t.date >= $2 AND t.date <= $3
                ORDER BY t.date DESC, t.created_at DESC
            `, [userPhone, startDate, endDate]);
        } else {
            return await this.all(`
                SELECT t.*, c.name as category_name, c.type as category_type
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = ? AND t.date >= ? AND t.date <= ?
                ORDER BY t.date DESC, t.created_at DESC
            `, [userPhone, startDate, endDate]);
        }
    }

    // Get transactions by specific date
    async getTransactionsByDate(userPhone, date) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            return await this.all(`
                SELECT t.*, c.name as category_name, c.type as category_type, c.color as category_color
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = $1 AND t.date = $2
                ORDER BY t.created_at DESC
            `, [userPhone, date]);
        } else {
            return await this.all(`
                SELECT t.*, c.name as category_name, c.type as category_type, c.color as category_color
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = ? AND t.date = ?
                ORDER BY t.created_at DESC
            `, [userPhone, date]);
        }
    }

    // Get balance summary by specific date
    async getBalanceByDate(userPhone, date) {
        const dbType = this.getDatabaseType();
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        if (isPostgres) {
            const income = await this.get(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM transactions
                WHERE user_phone = $1 AND date = $2 AND type = 'income'
            `, [userPhone, date]);
            
            const expenses = await this.get(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM transactions
                WHERE user_phone = $1 AND date = $2 AND type = 'expense'
            `, [userPhone, date]);
            
            return {
                income: income.total,
                expenses: expenses.total,
                balance: income.total - expenses.total
            };
        } else {
            const income = await this.get(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM transactions
                WHERE user_phone = ? AND date = ? AND type = 'income'
            `, [userPhone, date]);
            
            const expenses = await this.get(`
                SELECT COALESCE(SUM(amount), 0) as total
                FROM transactions
                WHERE user_phone = ? AND date = ? AND type = 'expense'
            `, [userPhone, date]);
            
            return {
                income: income.total,
                expenses: expenses.total,
                balance: income.total - expenses.total
            };
        }
    }

    // Pool monitoring and health check methods
    async getPoolStats() {
        if (this.db && typeof this.db.getPoolStats === 'function') {
            return await this.db.getPoolStats();
        }
        return null;
    }

    async healthCheck() {
        if (this.db && typeof this.db.healthCheck === 'function') {
            return await this.db.healthCheck();
        }
        
        // Fallback health check for non-PostgreSQL databases
        try {
            await this.get('SELECT 1');
            return {
                status: 'healthy',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Log pool statistics (useful for monitoring)
    async logPoolStats() {
        const stats = await this.getPoolStats();
        if (stats) {
            this.logger.info('Database pool stats:', stats);
        }
    }
}

module.exports = DatabaseManager;