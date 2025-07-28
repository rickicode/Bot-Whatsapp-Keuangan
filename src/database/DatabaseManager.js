const DatabaseFactory = require('./DatabaseFactory');
const Logger = require('../utils/Logger');

class DatabaseManager {
    constructor() {
        this.db = null;
        this.sessionManager = null;
        this.logger = new Logger();
    }

    async initialize() {
        try {
            // Create database instance based on configuration
            this.db = DatabaseFactory.create();
            
            // Initialize the database
            await this.db.initialize();
            
            // Initialize SessionManager for Redis/PostgreSQL session handling
            this.sessionManager = DatabaseFactory.createSessionManager();
            const postgresConfig = DatabaseFactory.getPostgresConfig();
            const redisConfig = DatabaseFactory.getRedisConfig();
            
            await this.sessionManager.initialize(postgresConfig, redisConfig);
            
            this.logger.info('Database and SessionManager initialized successfully');
        } catch (error) {
            this.logger.error('Error initializing database:', error);
            throw error;
        }
    }

    async close() {
        if (this.sessionManager) {
            await this.sessionManager.close();
        }
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
            // PostgreSQL - Just insert the user - categories are now global
            await this.run(
                'INSERT INTO users (phone, name, timezone) VALUES ($1, $2, $3) ON CONFLICT (phone) DO NOTHING',
                [phone, name, 'Asia/Jakarta']
            );
            
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
        return await this.get('SELECT * FROM users WHERE phone = $1', [phone]);
    }

    // Transaction methods
    async addTransaction(userPhone, type, amount, categoryId, description, date = null) {
        try {
            const transactionDate = date || new Date().toISOString().split('T')[0];
            
            // Only log transaction details in debug mode
            if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                this.logger.info(`Adding transaction: userPhone=${userPhone}, type=${type}, amount=${amount}, categoryId=${categoryId}, description=${description}, date=${transactionDate}`);
            }
            
            // Verify user exists
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
        } catch (error) {
            this.logger.error('❌ Error in addTransaction:', error);
            this.logger.error('Parameters:', { userPhone, type, amount, categoryId, description, date });
            throw error;
        }
    }

    async getTransactions(userPhone, limit = 50, offset = 0) {
        return await this.all(`
            SELECT t.*, c.name as category_name, c.color as category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = $1
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT $2 OFFSET $3
        `, [userPhone, limit, offset]);
    }

    async getTransactionById(id, userPhone) {
        return await this.get(`
            SELECT t.*, c.name as category_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.id = $1 AND t.user_phone = $2
        `, [id, userPhone]);
    }

    async updateTransaction(id, userPhone, updates) {
        let paramCount = 1;
        const fields = Object.keys(updates).map(key => {
            return `${key} = $${paramCount++}`;
        }).join(', ');
        
        const values = Object.values(updates);
        values.push(id, userPhone);
        
        await this.run(
            `UPDATE transactions SET ${fields}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount++}
             AND user_phone = $${paramCount}`,
            values
        );
    }

    async deleteTransaction(id, userPhone) {
        await this.run(
            'DELETE FROM transactions WHERE id = $1 AND user_phone = $2',
            [id, userPhone]
        );
    }

    // Category methods (Fixed/Global categories only)
    async getCategories(userPhone = null, type = null) {
        let sql = 'SELECT * FROM categories WHERE is_active = true';
        let params = [];
        
        if (type) {
            sql += ' AND type = $1';
            params.push(type);
        }
        
        sql += ' ORDER BY name';
        return await this.all(sql, params);
    }

    async getCategoryById(id) {
        return await this.get('SELECT * FROM categories WHERE id = $1', [id]);
    }

    // Admin-only category management for global categories
    async addCategory(userPhone, name, type, color = '#007bff') {
        // Check if user is admin
        const isAdmin = await this.isUserAdmin(userPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat menambahkan kategori baru.');
        }

        const result = await this.run(
            'INSERT INTO categories (name, type, color) VALUES ($1, $2, $3) RETURNING id',
            [name, type, color]
        );
        return result.lastID;
    }

    // Admin-only category editing
    async updateCategory(userPhone, categoryId, updates) {
        // Check if user is admin
        const isAdmin = await this.isUserAdmin(userPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat mengedit kategori.');
        }

        let paramCount = 1;
        const fields = Object.keys(updates).map(key => {
            return `${key} = $${paramCount++}`;
        }).join(', ');
        
        const values = Object.values(updates);
        values.push(categoryId);
        
        await this.run(
            `UPDATE categories SET ${fields} WHERE id = $${paramCount}`,
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

        // Soft delete - just deactivate the category
        await this.run(
            'UPDATE categories SET is_active = false WHERE id = $1',
            [categoryId]
        );
    }

    // Balance calculation
    async getBalance(userPhone, endDate = null) {
        let dateFilter = '';
        let params = [userPhone];
        
        if (endDate) {
            dateFilter = 'AND date <= $2';
            params.push(endDate);
        }
        
        const income = await this.get(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_phone = $1
            AND type = 'income' ${dateFilter}
        `, params);
        
        const expenses = await this.get(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM transactions
            WHERE user_phone = $1
            AND type = 'expense' ${dateFilter}
        `, params);
        
        return {
            income: income.total,
            expenses: expenses.total,
            balance: income.total - expenses.total
        };
    }


    // Settings management
    async getSetting(userPhone, key) {
        const result = await this.get(
            'SELECT setting_value FROM settings WHERE user_phone = $1 AND setting_key = $2',
            [userPhone, key]
        );
        return result ? result.setting_value : null;
    }

    async setSetting(userPhone, key, value) {
        await this.run(
            `INSERT INTO settings (user_phone, setting_key, setting_value, updated_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT (user_phone, setting_key)
             DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
            [userPhone, key, value]
        );
    }



    // User Registration Management
    async getUserRegistrationStatus(phone) {
        return await this.get(
            'SELECT phone, name, email, city, registration_completed, is_active FROM users WHERE phone = $1',
            [phone]
        );
    }

    async createRegistrationSession(phone) {
        if (this.sessionManager) {
            await this.sessionManager.createRegistrationSession(phone);
        } else {
            // Fallback to direct PostgreSQL
            await this.run(
                `INSERT INTO registration_sessions (phone, step, session_data, expires_at)
                 VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
                 ON CONFLICT (phone) DO UPDATE SET
                 step = $2, session_data = $3, expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours', created_at = CURRENT_TIMESTAMP`,
                [phone, 'name', '{}']
            );
        }
    }

    async getRegistrationSession(phone) {
        if (this.sessionManager) {
            return await this.sessionManager.getRegistrationSession(phone);
        } else {
            // Fallback to direct PostgreSQL
            return await this.get(
                'SELECT * FROM registration_sessions WHERE phone = $1 AND expires_at > CURRENT_TIMESTAMP',
                [phone]
            );
        }
    }

    async updateRegistrationSession(phone, step, sessionData) {
        if (this.sessionManager) {
            await this.sessionManager.updateRegistrationSession(phone, step, sessionData);
        } else {
            // Fallback to direct PostgreSQL
            await this.run(
                'UPDATE registration_sessions SET step = $1, session_data = $2 WHERE phone = $3',
                [step, JSON.stringify(sessionData), phone]
            );
        }
    }

    async completeUserRegistration(phone, name, email, city) {
        try {
            await this.beginTransaction();
            
            // Update user with complete registration data
            await this.run(
                `INSERT INTO users (phone, name, email, city, timezone, registration_completed, is_active)
                 VALUES ($1, $2, $3, $4, $5, true, true)
                 ON CONFLICT (phone) DO UPDATE SET
                 name = $2, email = $3, city = $4, registration_completed = true, is_active = true`,
                [phone, name, email, city, 'Asia/Jakarta']
            );
            
            // Create 30-day trial subscription for new users
            const trialPlan = await this.get('SELECT id FROM subscription_plans WHERE name = $1', ['trial']);
            if (trialPlan) {
                const trialStart = new Date();
                const trialEnd = new Date();
                trialEnd.setDate(trialEnd.getDate() + 30); // 30 days trial
                
                await this.run(
                    `INSERT INTO user_subscriptions (
                        user_phone, plan_id, status, transaction_count, last_reset_date,
                        is_trial, trial_start, trial_end, trial_expired
                     )
                     VALUES ($1, $2, $3, 0, CURRENT_DATE, true, $4, $5, false)
                     ON CONFLICT (user_phone) DO NOTHING`,
                    [phone, trialPlan.id, 'active', trialStart.toISOString(), trialEnd.toISOString()]
                );
            }
            
            // Delete registration session
            if (this.sessionManager) {
                await this.sessionManager.deleteRegistrationSession(phone);
            } else {
                await this.run('DELETE FROM registration_sessions WHERE phone = $1', [phone]);
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
        if (this.sessionManager) {
            await this.sessionManager.deleteRegistrationSession(phone);
        } else {
            await this.run('DELETE FROM registration_sessions WHERE phone = $1', [phone]);
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
        return await this.get(`
            SELECT us.*, sp.name as plan_name, sp.display_name, sp.description,
                   sp.monthly_transaction_limit, sp.features
            FROM user_subscriptions us
            JOIN subscription_plans sp ON us.plan_id = sp.id
            WHERE us.user_phone = $1
        `, [phone]);
    }

    async checkTransactionLimit(phone) {
        const subscription = await this.getUserSubscription(phone);
        
        if (!subscription) {
            return { allowed: false, reason: 'No subscription found' };
        }
        
        if (subscription.status !== 'active') {
            return { allowed: false, reason: 'Subscription expired', subscription };
        }
        
        // Check and handle trial expiration
        await this.checkAndHandleTrialExpiration(phone);
        
        // Auto-reset daily transaction count if needed
        await this.checkAndResetDailyCount(phone);
        
        // Get updated subscription after potential trial check and reset
        const updatedSubscription = await this.getUserSubscription(phone);
        
        // Premium plan or active trial has unlimited transactions
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
        await this.run(
            'UPDATE user_subscriptions SET transaction_count = transaction_count + 1 WHERE user_phone = $1',
            [phone]
        );
    }

    async checkAndResetDailyCount(phone) {
        await this.run(
            `UPDATE user_subscriptions
             SET transaction_count = 0, last_reset_date = CURRENT_DATE
             WHERE user_phone = $1 AND (last_reset_date < CURRENT_DATE OR last_reset_date IS NULL)`,
            [phone]
        );
    }

    async resetMonthlyTransactionCount(phone) {
        // Now this method resets daily count (renamed but kept for backward compatibility)
        await this.checkAndResetDailyCount(phone);
    }

    // Trial Management Methods
    async checkAndHandleTrialExpiration(phone) {
        const subscription = await this.getUserSubscription(phone);
        
        if (!subscription || !subscription.is_trial || subscription.trial_expired) {
            return; // Not a trial or already handled
        }
        
        const now = new Date();
        const trialEnd = new Date(subscription.trial_end);
        
        if (now > trialEnd) {
            // Trial has expired, move user to free plan
            await this.expireTrialAndMoveToFree(phone);
        }
    }

    async expireTrialAndMoveToFree(phone) {
        try {
            await this.beginTransaction();
            
            // Get user info before expiring trial
            const user = await this.get('SELECT name FROM users WHERE phone = $1', [phone]);
            const userName = user ? user.name : 'User';
            
            // Get free plan
            const freePlan = await this.get('SELECT id FROM subscription_plans WHERE name = $1', ['free']);
            if (!freePlan) {
                throw new Error('Free plan not found');
            }
            
            // Update subscription to free plan
            await this.run(
                `UPDATE user_subscriptions
                 SET plan_id = $1, is_trial = false, trial_expired = true,
                     transaction_count = 0, last_reset_date = CURRENT_DATE
                 WHERE user_phone = $2`,
                [freePlan.id, phone]
            );
            
            await this.commit();
            this.logger.info(`User ${phone} trial expired, moved to free plan`);
            
            // Send trial expiration notification
            if (this.trialNotificationService) {
                try {
                    const result = await this.trialNotificationService.sendTrialExpirationNotification(phone, userName);
                    this.logger.info(`Trial expiration notification result for ${phone}:`, result);
                } catch (notificationError) {
                    // Don't fail the expiration process if notification fails
                    this.logger.error('Failed to send trial expiration notification:', notificationError);
                }
            }
            
        } catch (error) {
            await this.rollback();
            this.logger.error('Error expiring trial:', error);
            throw error;
        }
    }

    // Set trial notification service (called from main app)
    setTrialNotificationService(notificationService) {
        this.trialNotificationService = notificationService;
        this.logger.info('Trial notification service set for DatabaseManager');
    }

    async getTrialStatus(phone) {
        const subscription = await this.getUserSubscription(phone);
        
        if (!subscription || !subscription.is_trial) {
            return { isTrial: false };
        }
        
        const now = new Date();
        const trialEnd = new Date(subscription.trial_end);
        const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
        
        return {
            isTrial: true,
            isExpired: subscription.trial_expired || now > trialEnd,
            trialEnd: subscription.trial_end,
            daysRemaining: Math.max(0, daysRemaining)
        };
    }

    async extendTrial(phone, additionalDays) {
        const subscription = await this.getUserSubscription(phone);
        
        if (!subscription || !subscription.is_trial) {
            throw new Error('User is not on trial');
        }
        
        const currentTrialEnd = new Date(subscription.trial_end);
        const newTrialEnd = new Date(currentTrialEnd);
        newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays);
        
        await this.run(
            `UPDATE user_subscriptions
             SET trial_end = $1, trial_expired = false
             WHERE user_phone = $2`,
            [newTrialEnd.toISOString(), phone]
        );
        
        this.logger.info(`Extended trial for user ${phone} by ${additionalDays} days`);
    }

    async updateLastActivity(phone) {
        await this.run(
            'UPDATE users SET last_activity = CURRENT_TIMESTAMP WHERE phone = $1',
            [phone]
        );
    }

    // Email validation
    async isEmailUnique(email, excludePhone = null) {
        let sql, params;
        
        if (excludePhone) {
            sql = 'SELECT COUNT(*) as count FROM users WHERE email = $1 AND phone != $2';
            params = [email, excludePhone];
        } else {
            sql = 'SELECT COUNT(*) as count FROM users WHERE email = $1';
            params = [email];
        }
        
        const result = await this.get(sql, params);
        return Number(result.count) === 0;
    }

    // Cleanup expired registration sessions
    async cleanupExpiredRegistrationSessions() {
        if (this.sessionManager) {
            return await this.sessionManager.cleanupExpiredRegistrationSessions();
        } else {
            const result = await this.run('DELETE FROM registration_sessions WHERE expires_at < CURRENT_TIMESTAMP');
            return result.changes || 0;
        }
    }

    // ========================================
    // WHATSAPP SESSION MANAGEMENT
    // ========================================

    async saveWhatsAppSession(clientId, sessionData) {
        if (this.sessionManager) {
            await this.sessionManager.saveWhatsAppSession(clientId, sessionData);
        } else {
            // Fallback to direct PostgreSQL
            await this.run(
                'INSERT INTO whatsapp_sessions (client_id, session_data, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (client_id) DO UPDATE SET session_data = $2, updated_at = CURRENT_TIMESTAMP',
                [clientId, JSON.stringify(sessionData)]
            );
        }
    }

    async getWhatsAppSession(clientId) {
        if (this.sessionManager) {
            return await this.sessionManager.getWhatsAppSession(clientId);
        } else {
            // Fallback to direct PostgreSQL
            const result = await this.get(
                'SELECT session_data FROM whatsapp_sessions WHERE client_id = $1',
                [clientId]
            );
            return result ? JSON.parse(result.session_data) : null;
        }
    }

    async deleteWhatsAppSession(clientId) {
        if (this.sessionManager) {
            await this.sessionManager.deleteWhatsAppSession(clientId);
        } else {
            // Fallback to direct PostgreSQL
            await this.run(
                'DELETE FROM whatsapp_sessions WHERE client_id = $1',
                [clientId]
            );
        }
    }

    // ========================================
    // SESSION MANAGEMENT STATS & HEALTH
    // ========================================

    async getSessionStats() {
        if (this.sessionManager) {
            return await this.sessionManager.getSessionStats();
        } else {
            // Return basic PostgreSQL stats
            const waResult = await this.get('SELECT COUNT(*) as count FROM whatsapp_sessions');
            const regResult = await this.get('SELECT COUNT(*) as count FROM registration_sessions WHERE expires_at > CURRENT_TIMESTAMP');
            
            return {
                timestamp: new Date().toISOString(),
                redis: {
                    whatsappSessions: 0,
                    registrationSessions: 0,
                    totalSessions: 0
                },
                postgresql: {
                    whatsappSessions: waResult ? parseInt(waResult.count) : 0,
                    registrationSessions: regResult ? parseInt(regResult.count) : 0
                }
            };
        }
    }

    async getSessionHealthCheck() {
        if (this.sessionManager) {
            return await this.sessionManager.healthCheck();
        } else {
            return {
                timestamp: new Date().toISOString(),
                redis: {
                    enabled: false,
                    available: false,
                    status: 'disabled'
                },
                postgresql: {
                    status: 'healthy'
                }
            };
        }
    }

    // Admin Management
    async isUserAdmin(phone) {
        // Check if user is admin by phone number from env
        const adminPhone = process.env.USER_ADMIN?.replace(/\+/g, '');
        const userPhoneClean = phone.replace(/\+/g, '');
        
        if (adminPhone && userPhoneClean.includes(adminPhone)) {
            return true;
        }
        
        // Check if user is marked as admin in database
        const user = await this.get('SELECT is_admin FROM users WHERE phone = $1', [phone]);
        
        return user?.is_admin || false;
    }

    async setUserAdmin(phone, isAdmin = true) {
        await this.run(
            'UPDATE users SET is_admin = $1 WHERE phone = $2',
            [isAdmin, phone]
        );
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

        // Get the new plan
        const plan = await this.get('SELECT * FROM subscription_plans WHERE name = $1', [newPlanName]);
        
        if (!plan) {
            throw new Error(`Plan '${newPlanName}' tidak ditemukan.`);
        }

        // Update user subscription
        await this.run(
            `UPDATE user_subscriptions
             SET plan_id = $1, transaction_count = 0, last_reset_date = CURRENT_DATE
             WHERE user_phone = $2`,
            [plan.id, targetPhone]
        );

        return plan;
    }

    // Admin-only: Suspend/Unsuspend user
    async suspendUser(adminPhone, targetPhone, suspend = true) {
        // Check if requester is admin
        const isAdmin = await this.isUserAdmin(adminPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat menangguhkan user.');
        }

        await this.run(
            'UPDATE users SET is_active = $1 WHERE phone = $2',
            [!suspend, targetPhone]
        );
    }

    // Get all subscription plans
    async getSubscriptionPlans() {
        return await this.all('SELECT * FROM subscription_plans ORDER BY name');
    }

    // Get user list (admin only) - with ordering options
    async getUserList(adminPhone, limit = 20, offset = 0, orderBy = 'name') {
        // Check if requester is admin
        const isAdmin = await this.isUserAdmin(adminPhone);
        if (!isAdmin) {
            throw new Error('Hanya admin yang dapat melihat daftar user.');
        }

        // Determine order clause
        let orderClause = 'ORDER BY u.name';
        if (orderBy === 'newest') {
            orderClause = 'ORDER BY u.created_at DESC';
        } else if (orderBy === 'activity') {
            orderClause = 'ORDER BY u.last_activity DESC';
        }
        
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
    }

    // Reset user daily limit (admin only)
    async resetUserDailyLimit(targetPhone) {
        await this.run(
            `UPDATE user_subscriptions
             SET transaction_count = 0, last_reset_date = CURRENT_DATE
             WHERE user_phone = $1`,
            [targetPhone]
        );
    }

    // Get transactions by date range
    async getTransactionsByDateRange(userPhone, startDate, endDate) {
        return await this.all(`
            SELECT t.*, c.name as category_name, c.type as category_type
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = $1 AND t.date >= $2 AND t.date <= $3
            ORDER BY t.date DESC, t.created_at DESC
        `, [userPhone, startDate, endDate]);
    }

    // Get transactions by specific date
    async getTransactionsByDate(userPhone, date) {
        return await this.all(`
            SELECT t.*, c.name as category_name, c.type as category_type, c.color as category_color
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = $1 AND t.date = $2
            ORDER BY t.created_at DESC
        `, [userPhone, date]);
    }

    // Get balance summary by specific date
    async getBalanceByDate(userPhone, date) {
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
    }

    // Simple health check
    async healthCheck() {
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

    // ========================================
    // DASHBOARD STATISTICS METHODS
    // ========================================

    // Log WhatsApp message for dashboard statistics
    async logMessage(userPhone, messageType, content, success = true, errorMessage = null, processingTime = 0) {
        try {
            await this.run(
                `INSERT INTO message_logs (user_phone, message_type, message_content, message_length, success, error_message, processing_time)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [userPhone, messageType, content, content.length, success, errorMessage, processingTime]
            );
        } catch (error) {
            this.logger.warn('Failed to log message:', error.message);
        }
    }

    // Log API usage for dashboard statistics
    async logAPIUsage(endpoint, method, apiKey, requestIP, responseStatus, responseTime, success, errorMessage = null, requestSize = 0, responseSize = 0) {
        try {
            await this.run(
                `INSERT INTO api_usage_logs (endpoint, method, api_key_used, request_ip, response_status, response_time, success, error_message, request_size, response_size)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [endpoint, method, apiKey, requestIP, responseStatus, responseTime, success, errorMessage, requestSize, responseSize]
            );
        } catch (error) {
            this.logger.warn('Failed to log API usage:', error.message);
        }
    }

    // Log system metrics
    async logSystemMetric(metricType, metricName, metricValue, metricUnit = null, metadata = {}) {
        try {
            await this.run(
                `INSERT INTO system_metrics (metric_type, metric_name, metric_value, metric_unit, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [metricType, metricName, metricValue, metricUnit, JSON.stringify(metadata)]
            );
        } catch (error) {
            this.logger.warn('Failed to log system metric:', error.message);
        }
    }

    // Log activity for dashboard
    async logActivity(userPhone, activityType, description, logLevel = 'info', source = 'system', metadata = {}) {
        try {
            await this.run(
                `INSERT INTO activity_logs (user_phone, activity_type, activity_description, log_level, source, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [userPhone, activityType, description, logLevel, source, JSON.stringify(metadata)]
            );
        } catch (error) {
            this.logger.warn('Failed to log activity:', error.message);
        }
    }

    // Update WhatsApp metrics
    async updateWhatsAppMetric(metricName, increment = 1) {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Initialize today's record if it doesn't exist
            await this.run(
                `INSERT INTO whatsapp_metrics (metric_date) 
                 VALUES ($1) 
                 ON CONFLICT (metric_date) DO NOTHING`,
                [today]
            );

            // Update the specific metric
            await this.run(
                `UPDATE whatsapp_metrics 
                 SET ${metricName} = ${metricName} + $1, updated_at = CURRENT_TIMESTAMP
                 WHERE metric_date = $2`,
                [increment, today]
            );
        } catch (error) {
            this.logger.warn(`Failed to update WhatsApp metric ${metricName}:`, error.message);
        }
    }

    // Get dashboard statistics
    async getDashboardStats() {
        try {
            const stats = {};

            // Get user statistics
            const userStats = await this.get(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN registration_completed = true THEN 1 END) as registered_users,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
                    COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as new_users_week
                FROM users
            `);

            stats.users = {
                total: parseInt(userStats.total_users) || 0,
                registered: parseInt(userStats.registered_users) || 0,
                active: parseInt(userStats.active_users) || 0,
                newThisWeek: parseInt(userStats.new_users_week) || 0
            };

            // Get subscription breakdown
            const subStats = await this.all(`
                SELECT sp.name, sp.display_name, COUNT(us.user_phone) as count
                FROM subscription_plans sp
                LEFT JOIN user_subscriptions us ON sp.id = us.plan_id AND us.status = 'active'
                GROUP BY sp.id, sp.name, sp.display_name
                ORDER BY sp.name
            `);

            stats.subscriptions = subStats.map(sub => ({
                plan: sub.name,
                displayName: sub.display_name,
                count: parseInt(sub.count) || 0
            }));

            // Get today's message statistics
            const messageStats = await this.get(`
                SELECT 
                    COUNT(*) as total_messages,
                    COUNT(CASE WHEN message_type = 'incoming' THEN 1 END) as incoming,
                    COUNT(CASE WHEN message_type = 'outgoing' THEN 1 END) as outgoing,
                    COUNT(CASE WHEN success = false THEN 1 END) as failed
                FROM message_logs
                WHERE message_date = CURRENT_DATE
            `);

            stats.messages = {
                today: parseInt(messageStats.total_messages) || 0,
                incoming: parseInt(messageStats.incoming) || 0,
                outgoing: parseInt(messageStats.outgoing) || 0,
                failed: parseInt(messageStats.failed) || 0
            };

            // Get WhatsApp metrics for today
            const waStats = await this.get(`
                SELECT * FROM whatsapp_metrics 
                WHERE metric_date = CURRENT_DATE
            `);

            stats.whatsapp = {
                messagesSent: parseInt(waStats?.messages_sent) || 0,
                messagesReceived: parseInt(waStats?.messages_received) || 0,
                messagesFailed: parseInt(waStats?.messages_failed) || 0,
                spamBlocked: parseInt(waStats?.spam_blocked) || 0,
                connectionUptime: parseInt(waStats?.connection_uptime) || 0,
                qrGenerated: parseInt(waStats?.qr_generated) || 0,
                sessionRestarts: parseInt(waStats?.session_restarts) || 0
            };

            // Get API statistics for today
            const apiStats = await this.get(`
                SELECT 
                    COUNT(*) as total_calls,
                    COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
                    AVG(response_time) as avg_response_time,
                    COUNT(CASE WHEN response_status = 429 THEN 1 END) as rate_limited
                FROM api_usage_logs
                WHERE request_date = CURRENT_DATE
            `);

            stats.api = {
                callsToday: parseInt(apiStats.total_calls) || 0,
                successfulCalls: parseInt(apiStats.successful_calls) || 0,
                successRate: apiStats.total_calls > 0 ? Math.round((apiStats.successful_calls / apiStats.total_calls) * 100) : 0,
                avgResponseTime: Math.round(parseFloat(apiStats.avg_response_time)) || 0,
                rateLimited: parseInt(apiStats.rate_limited) || 0
            };

            return stats;

        } catch (error) {
            this.logger.error('Error getting dashboard stats:', error);
            return {
                users: { total: 0, registered: 0, active: 0, newThisWeek: 0 },
                subscriptions: [],
                messages: { today: 0, incoming: 0, outgoing: 0, failed: 0 },
                whatsapp: { messagesSent: 0, messagesReceived: 0, messagesFailed: 0, spamBlocked: 0, connectionUptime: 0, qrGenerated: 0, sessionRestarts: 0 },
                api: { callsToday: 0, successfulCalls: 0, successRate: 0, avgResponseTime: 0, rateLimited: 0 }
            };
        }
    }

    // Get user growth data for charts (last 7 days)
    async getUserGrowthData(days = 7) {
        try {
            const growthData = await this.all(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_users
                FROM users
                WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY DATE(created_at)
                ORDER BY DATE(created_at)
            `);

            return growthData.map(row => ({
                date: row.date,
                count: parseInt(row.new_users) || 0
            }));

        } catch (error) {
            this.logger.error('Error getting user growth data:', error);
            return [];
        }
    }

    // Get message volume data for charts (last 24 hours)
    async getMessageVolumeData(hours = 24) {
        try {
            const volumeData = await this.all(`
                SELECT 
                    EXTRACT(HOUR FROM created_at) as hour,
                    COUNT(*) as message_count
                FROM message_logs
                WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${hours} hours'
                GROUP BY EXTRACT(HOUR FROM created_at)
                ORDER BY EXTRACT(HOUR FROM created_at)
            `);

            return volumeData.map(row => ({
                hour: parseInt(row.hour),
                count: parseInt(row.message_count) || 0
            }));

        } catch (error) {
            this.logger.error('Error getting message volume data:', error);
            return [];
        }
    }

    // Get recent activity logs
    async getRecentActivityLogs(limit = 50, logLevel = null, source = null) {
        try {
            let sql = `
                SELECT activity_type, activity_description, log_level, source, created_at, user_phone
                FROM activity_logs
                WHERE 1=1
            `;
            
            const params = [];
            let paramCount = 1;

            if (logLevel) {
                sql += ` AND log_level = $${paramCount++}`;
                params.push(logLevel);
            }

            if (source) {
                sql += ` AND source = $${paramCount++}`;
                params.push(source);
            }

            sql += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
            params.push(limit);

            const logs = await this.all(sql, params);

            return logs.map(log => ({
                timestamp: log.created_at,
                level: log.log_level,
                source: log.source,
                message: log.activity_description,
                userPhone: log.user_phone,
                type: log.activity_type
            }));

        } catch (error) {
            this.logger.error('Error getting activity logs:', error);
            return [];
        }
    }

    // Get API endpoint usage statistics
    async getAPIEndpointStats(days = 7) {
        try {
            const endpointStats = await this.all(`
                SELECT 
                    endpoint,
                    method,
                    COUNT(*) as total_calls,
                    COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
                    AVG(response_time) as avg_response_time,
                    COUNT(CASE WHEN response_status = 429 THEN 1 END) as rate_limited
                FROM api_usage_logs
                WHERE request_date >= CURRENT_DATE - INTERVAL '${days} days'
                GROUP BY endpoint, method
                ORDER BY total_calls DESC
                LIMIT 20
            `);

            return endpointStats.map(stat => ({
                endpoint: stat.endpoint,
                method: stat.method,
                calls: parseInt(stat.total_calls) || 0,
                successfulCalls: parseInt(stat.successful_calls) || 0,
                successRate: stat.total_calls > 0 ? Math.round((stat.successful_calls / stat.total_calls) * 100) : 0,
                avgTime: Math.round(parseFloat(stat.avg_response_time)) || 0,
                rateLimited: parseInt(stat.rate_limited) || 0
            }));

        } catch (error) {
            this.logger.error('Error getting API endpoint stats:', error);
            return [];
        }
    }
}

module.exports = DatabaseManager;
