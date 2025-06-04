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
            // Configure connection pool with proper SSL settings
            const poolConfig = {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                user: this.config.user,
                password: this.config.password,
                ssl: this.config.ssl ? {
                    rejectUnauthorized: false // Required for Supabase
                } : false,
                max: 20, // Maximum number of clients in the pool
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            };

            // Add extra config if provided (for Supabase)
            if (this.config.extra) {
                Object.assign(poolConfig, this.config.extra);
            }

            this.pool = new Pool(poolConfig);

            // Test connection
            const testClient = await this.pool.connect();
            testClient.release();
            
            // Create tables
            await this.createTables();
            
            this.logger.info('PostgreSQL database initialized successfully');
        } catch (error) {
            this.logger.error('Error initializing PostgreSQL database:', error);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.logger.info('PostgreSQL database connection closed');
        }
    }

    async run(sql, params = []) {
        let client;
        try {
            // Get client from pool
            client = await this.pool.connect();
            
            // Convert SQLite style queries to PostgreSQL
            let pgSql = sql;
            
            // Convert INSERT OR IGNORE
            if (sql.toLowerCase().includes('insert or ignore')) {
                pgSql = sql.replace(/INSERT OR IGNORE/i, 'INSERT');
                if (sql.toLowerCase().includes('into users')) {
                    pgSql += ' ON CONFLICT (phone) DO NOTHING';
                } else if (sql.toLowerCase().includes('into categories')) {
                    pgSql += ' ON CONFLICT (user_phone, name, type) DO NOTHING';
                }
            }
            
            // Convert OR REPLACE
            if (sql.toLowerCase().includes('insert or replace')) {
                if (sql.toLowerCase().includes('into settings')) {
                    pgSql = sql.replace(/INSERT OR REPLACE/i, 'INSERT');
                    pgSql += ' ON CONFLICT (user_phone, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP';
                }
            }
            
            // Convert SQLite style ? placeholders to PostgreSQL $1, $2, etc.
            if (!pgSql.includes('$')) {
                pgSql = this.convertPlaceholders(pgSql);
            }
            
            // Only log SQL in debug mode
            if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                this.logger.info(`Executing SQL: ${pgSql}`, params);
            }
            const result = await client.query(pgSql, params);
            
            // Return SQLite-compatible result with proper lastID
            const lastID = result.rows.length > 0 && result.rows[0].id ? result.rows[0].id :
                          (result.rowCount > 0 ? result.rowCount : null);
            
            return {
                lastID: lastID,
                changes: result.rowCount
            };
        } catch (error) {
            this.logger.error('PostgreSQL run error:', error);
            this.logger.error('SQL:', sql);
            this.logger.error('Params:', params);
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async get(sql, params = []) {
        let client;
        try {
            client = await this.pool.connect();
            let pgSql = sql;
            if (!pgSql.includes('$')) {
                pgSql = this.convertPlaceholders(sql);
            }
            const result = await client.query(pgSql, params);
            return result.rows[0] || null;
        } catch (error) {
            this.logger.error('PostgreSQL get error:', error);
            this.logger.error('SQL:', sql);
            this.logger.error('Params:', params);
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async all(sql, params = []) {
        let client;
        try {
            client = await this.pool.connect();
            let pgSql = sql;
            if (!pgSql.includes('$')) {
                pgSql = this.convertPlaceholders(sql);
            }
            const result = await client.query(pgSql, params);
            return result.rows;
        } catch (error) {
            this.logger.error('PostgreSQL all error:', error);
            this.logger.error('SQL:', sql);
            this.logger.error('Params:', params);
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async beginTransaction() {
        if (!this.client) {
            this.client = await this.pool.connect();
        }
        return this.client.query('BEGIN');
    }

    async commit() {
        if (this.client) {
            const result = await this.client.query('COMMIT');
            this.client.release();
            this.client = null;
            return result;
        }
    }

    async rollback() {
        if (this.client) {
            const result = await this.client.query('ROLLBACK');
            this.client.release();
            this.client = null;
            return result;
        }
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
            // Enable UUID extension if not exists (for Supabase)
            `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,

            // Users table with registration fields
            `CREATE TABLE IF NOT EXISTS users (
                phone VARCHAR(20) PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE,
                city VARCHAR(100),
                timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
                is_active BOOLEAN DEFAULT true,
                registration_completed BOOLEAN DEFAULT false,
                is_admin BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Categories table (Global/Fixed categories only)
            `CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(10) CHECK(type IN ('income', 'expense')) NOT NULL,
                color VARCHAR(10) DEFAULT '#007bff',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, type)
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
            )`,

            // WhatsApp sessions table
            `CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                client_id VARCHAR(100) PRIMARY KEY,
                session_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // Registration sessions table for managing multi-step registration
            `CREATE TABLE IF NOT EXISTS registration_sessions (
                id SERIAL PRIMARY KEY,
                phone VARCHAR(20) NOT NULL,
                step VARCHAR(20) NOT NULL DEFAULT 'name',
                session_data JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
                UNIQUE(phone)
            )`,

            // Subscription plans table
            `CREATE TABLE IF NOT EXISTS subscription_plans (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                display_name VARCHAR(100) NOT NULL,
                description TEXT,
                monthly_transaction_limit INTEGER DEFAULT NULL,
                price_monthly NUMERIC(10,2) DEFAULT 0,
                features JSONB DEFAULT '[]',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,

            // User subscriptions table
            `CREATE TABLE IF NOT EXISTS user_subscriptions (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                plan_id INTEGER NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                transaction_count INTEGER DEFAULT 0,
                last_reset_date DATE DEFAULT CURRENT_DATE,
                subscription_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                subscription_end TIMESTAMP,
                payment_status VARCHAR(20) DEFAULT 'free',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
                UNIQUE(user_phone)
            )`
        ];

        let client;
        try {
            client = await this.pool.connect();
            
            for (const table of tables) {
                await client.query(table);
            }

            // Create indexes for performance
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_phone, date DESC)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)',
                'CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_phone, status)',
                'CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date)',
                'CREATE INDEX IF NOT EXISTS idx_bills_user_active ON bills(user_phone, is_active)',
                'CREATE INDEX IF NOT EXISTS idx_bills_next_reminder ON bills(next_reminder)',
                'CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated ON whatsapp_sessions(updated_at)',
                'CREATE INDEX IF NOT EXISTS idx_registration_sessions_phone ON registration_sessions(phone)',
                'CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires ON registration_sessions(expires_at)',
                'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_phone ON user_subscriptions(user_phone)',
                'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)'
            ];

            for (const index of indexes) {
                try {
                    await client.query(index);
                } catch (error) {
                    // Ignore if index already exists
                    if (!error.message.includes('already exists')) {
                        throw error;
                    }
                }
            }

            // Create triggers
            await this.createTriggers(client);

            // Add missing columns for existing tables
            await this.addMissingColumns(client);

            // Insert default data
            await this.insertDefaultCategories(client);
            await this.insertDefaultSubscriptionPlans(client);
            
        } catch (error) {
            this.logger.error('Error creating tables:', error);
            throw error;
        } finally {
            if (client) {
                client.release();
            }
        }
    }

    async createTriggers(client) {
        // Create update trigger function
        await client.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        // Apply triggers (PostgreSQL doesn't support IF NOT EXISTS for triggers)
        const triggers = [
            {
                name: 'update_transactions_updated_at',
                table: 'transactions',
                sql: 'CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
            },
            {
                name: 'update_debts_updated_at',
                table: 'debts',
                sql: 'CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
            },
            {
                name: 'update_settings_updated_at',
                table: 'settings',
                sql: 'CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
            },
            {
                name: 'update_whatsapp_sessions_updated_at',
                table: 'whatsapp_sessions',
                sql: 'CREATE TRIGGER update_whatsapp_sessions_updated_at BEFORE UPDATE ON whatsapp_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
            },
            {
                name: 'update_user_subscriptions_updated_at',
                table: 'user_subscriptions',
                sql: 'CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
            }
        ];

        for (const trigger of triggers) {
            try {
                // Check if trigger exists
                const exists = await client.query(`
                    SELECT 1 FROM information_schema.triggers
                    WHERE trigger_name = $1 AND event_object_table = $2
                `, [trigger.name, trigger.table]);

                if (exists.rows.length === 0) {
                    await client.query(trigger.sql);
                    this.logger.info(`Created trigger: ${trigger.name}`);
                } else {
                    this.logger.info(`Trigger already exists: ${trigger.name}`);
                }
            } catch (error) {
                this.logger.warn(`Trigger creation warning for ${trigger.name}:`, error.message);
            }
        }
    }

    async addMissingColumns(client) {
        try {
            // Add last_reset_date column to user_subscriptions if it doesn't exist
            await client.query(`
                ALTER TABLE user_subscriptions
                ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE
            `);
            this.logger.info('Added last_reset_date column to user_subscriptions (if not exists)');

            // Add icon column to categories if it doesn't exist
            await client.query(`
                ALTER TABLE categories
                ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '📝'
            `);
            this.logger.info('Added icon column to categories (if not exists)');

            // Update existing user_subscriptions with current date if last_reset_date is null
            await client.query(`
                UPDATE user_subscriptions
                SET last_reset_date = CURRENT_DATE
                WHERE last_reset_date IS NULL
            `);
            this.logger.info('Updated existing user_subscriptions with current date');

        } catch (error) {
            this.logger.error('Error adding missing columns:', error);
            // Don't throw - this is not critical for operation
        }
    }

    async insertDefaultCategories(client = null) {
        const dbClient = client || await this.pool.connect();
        const shouldRelease = !client;
        
        try {
            const defaultCategories = [
                // Income categories (Pemasukan)
                { name: 'Gaji', type: 'income', color: '#28a745' },
                { name: 'Freelance', type: 'income', color: '#17a2b8' },
                { name: 'Bisnis', type: 'income', color: '#007bff' },
                { name: 'Investasi', type: 'income', color: '#6f42c1' },
                { name: 'Dividen', type: 'income', color: '#20c997' },
                { name: 'Bonus', type: 'income', color: '#28a745' },
                { name: 'Tunjangan', type: 'income', color: '#17a2b8' },
                { name: 'Komisi', type: 'income', color: '#007bff' },
                { name: 'Hadiah', type: 'income', color: '#6f42c1' },
                { name: 'Pemasukan Lain', type: 'income', color: '#20c997' },
                
                // Essential Expense categories (Pengeluaran Wajib)
                { name: 'Makanan', type: 'expense', color: '#fd7e14' },
                { name: 'Transportasi', type: 'expense', color: '#6c757d' },
                { name: 'Listrik', type: 'expense', color: '#e83e8c' },
                { name: 'Air', type: 'expense', color: '#17a2b8' },
                { name: 'Internet', type: 'expense', color: '#007bff' },
                { name: 'Telepon', type: 'expense', color: '#6f42c1' },
                { name: 'Sewa Rumah', type: 'expense', color: '#dc3545' },
                { name: 'Cicilan', type: 'expense', color: '#e83e8c' },
                { name: 'Asuransi', type: 'expense', color: '#28a745' },
                
                // Health & Education (Kesehatan & Pendidikan)
                { name: 'Kesehatan', type: 'expense', color: '#ffc107' },
                { name: 'Obat-obatan', type: 'expense', color: '#fd7e14' },
                { name: 'Dokter', type: 'expense', color: '#dc3545' },
                { name: 'Pendidikan', type: 'expense', color: '#007bff' },
                { name: 'Kursus', type: 'expense', color: '#17a2b8' },
                { name: 'Buku', type: 'expense', color: '#6f42c1' },
                
                // Lifestyle & Shopping (Gaya Hidup & Belanja)
                { name: 'Belanja', type: 'expense', color: '#198754' },
                { name: 'Pakaian', type: 'expense', color: '#e83e8c' },
                { name: 'Kosmetik', type: 'expense', color: '#fd7e14' },
                { name: 'Hiburan', type: 'expense', color: '#dc3545' },
                { name: 'Nonton', type: 'expense', color: '#6f42c1' },
                { name: 'Olahraga', type: 'expense', color: '#28a745' },
                { name: 'Hobi', type: 'expense', color: '#17a2b8' },
                { name: 'Liburan', type: 'expense', color: '#007bff' },
                
                // Food & Beverages (Makanan & Minuman)
                { name: 'Makan Siang', type: 'expense', color: '#fd7e14' },
                { name: 'Makan Malam', type: 'expense', color: '#e83e8c' },
                { name: 'Sarapan', type: 'expense', color: '#ffc107' },
                { name: 'Kopi', type: 'expense', color: '#6c757d' },
                { name: 'Snack', type: 'expense', color: '#dc3545' },
                { name: 'Groceries', type: 'expense', color: '#198754' },
                
                // Transportation (Transportasi Detail)
                { name: 'Bensin', type: 'expense', color: '#6c757d' },
                { name: 'Ojol', type: 'expense', color: '#fd7e14' },
                { name: 'Taksi', type: 'expense', color: '#e83e8c' },
                { name: 'Parkir', type: 'expense', color: '#dc3545' },
                { name: 'Servis Kendaraan', type: 'expense', color: '#28a745' },
                
                // Business & Investment (Bisnis & Investasi)
                { name: 'Pengeluaran Bisnis', type: 'expense', color: '#0d6efd' },
                { name: 'Alat Kerja', type: 'expense', color: '#17a2b8' },
                { name: 'Software', type: 'expense', color: '#6f42c1' },
                { name: 'Marketing', type: 'expense', color: '#007bff' },
                { name: 'Investasi', type: 'expense', color: '#28a745' },
                
                // Social & Family (Sosial & Keluarga)
                { name: 'Keluarga', type: 'expense', color: '#e83e8c' },
                { name: 'Hadiah', type: 'expense', color: '#dc3545' },
                { name: 'Donasi', type: 'expense', color: '#28a745' },
                { name: 'Zakat', type: 'expense', color: '#007bff' },
                { name: 'Sedekah', type: 'expense', color: '#20c997' },
                
                // Others (Lain-lain)
                { name: 'Pajak', type: 'expense', color: '#6c757d' },
                { name: 'Denda', type: 'expense', color: '#dc3545' },
                { name: 'Pengeluaran Lain', type: 'expense', color: '#6c757d' }
            ];

            const minCategoriesRequired = defaultCategories.length;

            // Check existing categories count (global/fixed categories only)
            const existingCount = await dbClient.query(
                'SELECT COUNT(*) as count FROM categories'
            );
            
            const currentCount = existingCount.rows[0] ? parseInt(existingCount.rows[0].count) : 0;
            
            this.logger.info(`Current fixed categories: ${currentCount}, Required: ${minCategoriesRequired}`);
            
            // If categories are empty or below minimum threshold, recreate them
            if (currentCount === 0 || currentCount < minCategoriesRequired) {
                this.logger.info('Categories insufficient, recreating fixed categories for PostgreSQL...');
                
                // Delete existing categories
                await dbClient.query('DELETE FROM categories');
                
                // Insert all default categories as fixed global categories
                for (const category of defaultCategories) {
                    try {
                        await dbClient.query(
                            'INSERT INTO categories (name, type, color) VALUES ($1, $2, $3)',
                            [category.name, category.type, category.color]
                        );
                    } catch (error) {
                        this.logger.error(`Error inserting fixed category ${category.name}:`, error);
                    }
                }
                
                // Verify insertion
                const finalCount = await dbClient.query(
                    'SELECT COUNT(*) as count FROM categories'
                );
                
                this.logger.info(`Fixed categories created successfully. Total: ${finalCount.rows[0].count}`);
            } else {
                this.logger.info('Fixed categories already sufficient, skipping recreation');
            }
            
        } catch (error) {
            this.logger.error('Error in insertDefaultCategories for PostgreSQL:', error);
            
            // Fallback: try to insert categories anyway
            this.logger.info('Attempting fallback category insertion for PostgreSQL...');
            const defaultCategories = [
                { name: 'Gaji', type: 'income', color: '#28a745' },
                { name: 'Makanan', type: 'expense', color: '#fd7e14' },
                { name: 'Transportasi', type: 'expense', color: '#6c757d' },
                { name: 'Pengeluaran Lain', type: 'expense', color: '#6c757d' }
            ];
            
            for (const category of defaultCategories) {
                try {
                    await dbClient.query(
                        `INSERT INTO categories (name, type, color)
                         VALUES ($1, $2, $3)
                         ON CONFLICT (name, type) DO NOTHING`,
                        [category.name, category.type, category.color]
                    );
                } catch (fallbackError) {
                    this.logger.error(`Fallback error for category ${category.name}:`, fallbackError);
                }
            }
        } finally {
            if (shouldRelease && dbClient) {
                dbClient.release();
            }
        }
        
        this.logger.info('Default categories setup completed for PostgreSQL');
    }

    async insertDefaultSubscriptionPlans(client = null) {
        const dbClient = client || await this.pool.connect();
        const shouldRelease = !client;
        
        try {
            // Check existing subscription plans count
            const existingCount = await dbClient.query(
                'SELECT COUNT(*) as count FROM subscription_plans'
            );
            
            const currentCount = existingCount.rows[0] ? parseInt(existingCount.rows[0].count) : 0;
            
            this.logger.info(`Current subscription plans: ${currentCount}`);
            
            if (currentCount === 0) {
                this.logger.info('Creating default subscription plans for PostgreSQL...');
                
                const defaultPlans = [
                    {
                        name: 'free',
                        display_name: 'Free Plan',
                        description: 'Plan gratis dengan 50 transaksi per hari',
                        monthly_transaction_limit: 50,
                        price_monthly: 0,
                        features: JSON.stringify(['input_transaksi', 'laporan_bulanan', 'saldo_check', 'daily_limit_50'])
                    },
                    {
                        name: 'premium',
                        display_name: 'Premium Plan',
                        description: 'Plan premium dengan unlimited transaksi per hari',
                        monthly_transaction_limit: null,
                        price_monthly: 50000,
                        features: JSON.stringify(['unlimited_transaksi', 'laporan_advanced', 'ai_analysis', 'export_data', 'priority_support'])
                    }
                ];
                
                for (const plan of defaultPlans) {
                    try {
                        await dbClient.query(
                            `INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, price_monthly, features)
                             VALUES ($1, $2, $3, $4, $5, $6)
                             ON CONFLICT (name) DO NOTHING`,
                            [plan.name, plan.display_name, plan.description, plan.monthly_transaction_limit, plan.price_monthly, plan.features]
                        );
                    } catch (error) {
                        this.logger.error(`Error inserting subscription plan ${plan.name}:`, error);
                    }
                }
                
                // Verify insertion
                const finalCount = await dbClient.query(
                    'SELECT COUNT(*) as count FROM subscription_plans'
                );
                
                this.logger.info(`Subscription plans created successfully. Total: ${finalCount.rows[0].count}`);
            } else {
                this.logger.info('Subscription plans already exist, skipping creation');
            }
            
        } catch (error) {
            this.logger.error('Error in insertDefaultSubscriptionPlans for PostgreSQL:', error);
        } finally {
            if (shouldRelease && dbClient) {
                dbClient.release();
            }
        }
        
        this.logger.info('Default subscription plans setup completed for PostgreSQL');
    }
}

module.exports = PostgresDatabase;