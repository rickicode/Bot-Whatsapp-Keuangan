const postgres = require('postgres');
const BaseDatabase = require('./BaseDatabase');
const Logger = require('../utils/Logger');

class PostgresDatabase extends BaseDatabase {
    constructor(config) {
        super();
        this.config = config;
        this.sql = null;
        this.logger = new Logger();
        this.poolMetrics = {
            connectionsCreated: 0,
            connectionsDestroyed: 0,
            queriesExecuted: 0,
            errorsCount: 0,
            avgQueryTime: 0,
            lastHealthCheck: null
        };
    }

    async initialize() {
        try {
            // Configure postgres connection with pool settings
            const connectionConfig = {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
                username: this.config.user,
                password: this.config.password,
                
                // SSL Configuration
                ssl: this.config.ssl ? {
                    rejectUnauthorized: false // Required for Supabase
                } : false,
                
                // ==========================================
                // OPTIMIZED POOL SETTINGS FOR TRANSACTION POOLER
                // ==========================================
                
                // Pool Size Configuration
                max: parseInt(process.env.DB_POOL_MAX) || 25, // Maximum number of clients in the pool
                min: parseInt(process.env.DB_POOL_MIN) || 5,  // Minimum number of clients to keep in pool
                
                // Connection Timeouts (Fine-tuned for optimal performance)
                idle_timeout: parseInt(process.env.DB_IDLE_TIMEOUT) || 30, // 30 seconds
                connect_timeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5, // 5 seconds
                
                // Pool Management (Optimized for transaction throughput)
                max_lifetime: parseInt(process.env.DB_MAX_LIFETIME) || 3600, // 1 hour
                
                // Connection Stability & Performance
                keep_alive: true,
                
                // Query Performance Optimization
                statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000, // 30 seconds
                query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000, // 30 seconds
                
                // Application identification for monitoring
                application_name: process.env.APP_NAME || 'whatsapp-financial-bot',
                
                // Performance parameters for PostgreSQL
                prepare: false, // Disable prepared statements for better compatibility
                
                // Connection pooling specific optimizations
                transform: {
                    undefined: null
                },
                
                // Enhanced timeout settings
                idle_in_transaction_session_timeout: parseInt(process.env.DB_IDLE_IN_TRANSACTION_TIMEOUT) || 60000, // 60 seconds
                
                // Suppress PostgreSQL NOTICE messages (like "table already exists")
                // Enable with DEBUG_NOTICES=true if needed for troubleshooting
                onnotice: process.env.DEBUG_NOTICES === 'true' ?
                    (notice) => this.logger.info('PostgreSQL Notice:', notice.message) :
                    () => {}, // Suppress notice messages by default
                
                // Additional config for Supabase
                ...(this.config.extra || {})
            };

            // Create postgres connection
            this.sql = postgres(connectionConfig);

            // Set up enhanced connection monitoring
            this.setupConnectionMonitoring();

            // Test connection with enhanced validation
            await this.validateConnection();
            
            // Create tables
            await this.createTables();
            
            // Log configuration for debugging
            this.logger.info('PostgreSQL Connection Pool initialized with enhanced config:', {
                max: connectionConfig.max,
                min: connectionConfig.min,
                idle_timeout: connectionConfig.idle_timeout,
                connect_timeout: connectionConfig.connect_timeout,
                keep_alive: connectionConfig.keep_alive,
                statement_timeout: connectionConfig.statement_timeout,
                query_timeout: connectionConfig.query_timeout
            });
            this.logger.info('PostgreSQL database initialized successfully with postgres module');
        } catch (error) {
            this.logger.error('Error initializing PostgreSQL database:', error);
            throw error;
        }
    }

    async validateConnection() {
        try {
            // Enhanced connection validation
            const start = Date.now();
            const result = await this.sql`SELECT NOW() as server_time, version() as server_version`;
            const duration = Date.now() - start;
            
            this.logger.info(`Connection validated successfully (${duration}ms)`);
            this.poolMetrics.lastHealthCheck = new Date();
            
            return result[0];
        } catch (error) {
            this.logger.error('Connection validation failed:', error);
            throw error;
        }
    }

    setupConnectionMonitoring() {
        // Enhanced monitoring for connection tracking
        this.poolMetrics.connectionsCreated++;
        
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_POOL === 'true') {
            this.logger.info(`New connection established. Total created: ${this.poolMetrics.connectionsCreated}`);
        }
    }

    getPoolStatsSync() {
        if (!this.sql) return null;
        
        return {
            connectionString: this.sql.options.host + ':' + this.sql.options.port,
            database: this.sql.options.database,
            username: this.sql.options.username,
            max: this.sql.options.max,
            min: this.sql.options.min,
            ssl: !!this.sql.options.ssl
        };
    }

    async getPoolStats() {
        if (!this.sql) return null;
        
        return {
            // Basic connection statistics
            connectionString: this.sql.options.host + ':' + this.sql.options.port,
            database: this.sql.options.database,
            username: this.sql.options.username,
            max: this.sql.options.max,
            min: this.sql.options.min,
            ssl: !!this.sql.options.ssl,
            
            // Enhanced metrics for transaction pooler monitoring
            connectionsCreated: this.poolMetrics.connectionsCreated,
            connectionsDestroyed: this.poolMetrics.connectionsDestroyed,
            queriesExecuted: this.poolMetrics.queriesExecuted,
            errorsCount: this.poolMetrics.errorsCount,
            avgQueryTime: this.poolMetrics.avgQueryTime,
            lastHealthCheck: this.poolMetrics.lastHealthCheck,
            
            // Connection health
            connectionHealth: this.poolMetrics.errorsCount < 5 ? 'healthy' : 'degraded',
            
            // Timestamp
            timestamp: new Date().toISOString()
        };
    }

    async healthCheck() {
        try {
            const start = Date.now();
            
            // Enhanced health check with multiple validations
            await this.sql`SELECT 1 as health_check`;
            await this.sql`SELECT NOW() as server_time`;
            await this.sql`SELECT version() as server_version`;
            
            const duration = Date.now() - start;
            
            // Update metrics
            this.poolMetrics.lastHealthCheck = new Date();
            
            const stats = await this.getPoolStats();
            
            return {
                status: 'healthy',
                responseTime: duration,
                connectionStats: stats,
                connectionHealth: stats.connectionHealth,
                timestamp: new Date().toISOString(),
                
                // Transaction pooler specific health indicators
                transactionPoolerStatus: {
                    connectionReuse: stats.connectionsCreated > 0 && stats.queriesExecuted > stats.connectionsCreated,
                    errorRate: stats.queriesExecuted > 0 ? (stats.errorsCount / stats.queriesExecuted * 100).toFixed(2) + '%' : '0%',
                    connectionStability: stats.connectionsDestroyed < stats.connectionsCreated * 0.5 // Less than 50% churn
                }
            };
        } catch (error) {
            this.poolMetrics.errorsCount++;
            this.logger.error('Database health check failed:', error);
            return {
                status: 'unhealthy',
                error: error.message,
                connectionStats: await this.getPoolStats(),
                timestamp: new Date().toISOString(),
                transactionPoolerStatus: {
                    error: 'Health check failed'
                }
            };
        }
    }

    async close() {
        if (this.sql) {
            const stats = await this.getPoolStats();
            this.logger.info('Closing PostgreSQL Connection Pool. Final stats:', stats);
            
            // Graceful connection shutdown
            await this.sql.end();
            this.logger.info('PostgreSQL Connection Pool closed successfully');
        }
    }

    async run(sql, params = []) {
        return this.executeWithRetry(async () => {
            const queryStart = Date.now();
            
            try {
                // Convert SQLite style queries to PostgreSQL
                let pgSql = sql;
                
                // Convert INSERT OR IGNORE
                if (sql.toLowerCase().includes('insert or ignore')) {
                    pgSql = sql.replace(/INSERT OR IGNORE/i, 'INSERT');
                    if (sql.toLowerCase().includes('into users')) {
                        pgSql += ' ON CONFLICT (phone) DO NOTHING';
                    } else if (sql.toLowerCase().includes('into categories')) {
                        pgSql += ' ON CONFLICT (name, type) DO NOTHING';
                    }
                }
                
                // Convert OR REPLACE
                if (sql.toLowerCase().includes('insert or replace')) {
                    if (sql.toLowerCase().includes('into settings')) {
                        pgSql = sql.replace(/INSERT OR REPLACE/i, 'INSERT');
                        pgSql += ' ON CONFLICT (user_phone, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP';
                    }
                }
                
                // Only log SQL in debug mode
                if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
                    this.logger.info(`Executing SQL: ${pgSql}`, params);
                }
                
                // Execute query using postgres template literal
                const result = await this.sql.unsafe(pgSql, params);
                
                // Update metrics
                const queryDuration = Date.now() - queryStart;
                this.poolMetrics.queriesExecuted++;
                this.poolMetrics.avgQueryTime = (this.poolMetrics.avgQueryTime + queryDuration) / 2;
                
                // Return SQLite-compatible result with proper lastID
                const lastID = result.length > 0 && result[0].id ? result[0].id :
                              (result.count > 0 ? result.count : null);
                
                return {
                    lastID: lastID,
                    changes: result.count || result.length || 0
                };
            } catch (error) {
                this.poolMetrics.errorsCount++;
                this.logger.error('PostgreSQL run error:', error);
                this.logger.error('SQL:', sql);
                this.logger.error('Params:', params);
                throw error;
            }
        });
    }

    async executeWithRetry(operation, maxRetries = 3, baseDelay = 100) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (this.shouldNotRetry(error)) {
                    throw error;
                }
                
                if (attempt === maxRetries) {
                    this.logger.error(`Database operation failed after ${maxRetries} attempts:`, error);
                    throw error;
                }
                
                // Exponential backoff with jitter for better distribution
                const jitter = Math.random() * 100;
                const delay = baseDelay * Math.pow(2, attempt - 1) + jitter;
                this.logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms:`, error.message);
                
                await this.sleep(delay);
            }
        }
        
        throw lastError;
    }

    shouldNotRetry(error) {
        // Enhanced error detection for better retry logic
        const noRetryPatterns = [
            'syntax error',
            'column does not exist',
            'relation does not exist',
            'duplicate key value',
            'violates check constraint',
            'violates foreign key constraint',
            'violates unique constraint',
            'permission denied',
            'authentication failed',
            'invalid input syntax'
        ];
        
        return noRetryPatterns.some(pattern =>
            error.message.toLowerCase().includes(pattern)
        );
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async get(sql, params = []) {
        return this.executeWithRetry(async () => {
            const queryStart = Date.now();
            
            try {
                const result = await this.sql.unsafe(sql, params);
                
                // Update metrics
                const queryDuration = Date.now() - queryStart;
                this.poolMetrics.queriesExecuted++;
                this.poolMetrics.avgQueryTime = (this.poolMetrics.avgQueryTime + queryDuration) / 2;
                
                return result[0] || null;
            } catch (error) {
                this.poolMetrics.errorsCount++;
                this.logger.error('PostgreSQL get error:', error);
                this.logger.error('SQL:', sql);
                this.logger.error('Params:', params);
                throw error;
            }
        });
    }

    async all(sql, params = []) {
        return this.executeWithRetry(async () => {
            const queryStart = Date.now();
            
            try {
                const result = await this.sql.unsafe(sql, params);
                
                // Update metrics
                const queryDuration = Date.now() - queryStart;
                this.poolMetrics.queriesExecuted++;
                this.poolMetrics.avgQueryTime = (this.poolMetrics.avgQueryTime + queryDuration) / 2;
                
                return result;
            } catch (error) {
                this.poolMetrics.errorsCount++;
                this.logger.error('PostgreSQL all error:', error);
                this.logger.error('SQL:', sql);
                this.logger.error('Params:', params);
                throw error;
            }
        });
    }

    async beginTransaction() {
        return await this.sql.begin(async sql => {
            this.transactionSql = sql;
            return sql;
        });
    }

    async commit() {
        // Transaction is automatically committed when the function returns successfully
        // in postgres module's begin() method
        if (this.transactionSql) {
            this.transactionSql = null;
        }
        return Promise.resolve();
    }

    async rollback() {
        // Transaction is automatically rolled back when an error is thrown
        // in postgres module's begin() method
        if (this.transactionSql) {
            this.transactionSql = null;
        }
        return Promise.resolve();
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
                is_trial BOOLEAN DEFAULT false,
                trial_start TIMESTAMP,
                trial_end TIMESTAMP,
                trial_expired BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
                FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
                UNIQUE(user_phone)
            )`,

            // Clients table untuk manajemen kontak hutang piutang
            `CREATE TABLE IF NOT EXISTS clients (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                address TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
                UNIQUE(user_phone, name)
            )`,

            // Debt Receivables table untuk tracking hutang piutang
            `CREATE TABLE IF NOT EXISTS debt_receivables (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                client_id INTEGER NOT NULL,
                type VARCHAR(10) CHECK(type IN ('HUTANG', 'PIUTANG')) NOT NULL,
                amount NUMERIC(15,2) NOT NULL,
                description TEXT,
                status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'paid', 'cancelled')),
                due_date DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                paid_at TIMESTAMP,
                notes TEXT,
                FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
                FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
            )`,

            // Curhat history table untuk menyimpan histori chat curhat mode
            `CREATE TABLE IF NOT EXISTS curhat_history (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                session_id VARCHAR(100) NOT NULL,
                role VARCHAR(20) CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
                content TEXT NOT NULL,
                message_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
            )`
        ];

        try {
            for (const table of tables) {
                await this.sql.unsafe(table);
            }

            // Create indexes for performance - optimized for transaction pooler
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_phone, date DESC)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id)',
                'CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC)',
                'CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated ON whatsapp_sessions(updated_at)',
                'CREATE INDEX IF NOT EXISTS idx_registration_sessions_phone ON registration_sessions(phone)',
                'CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires ON registration_sessions(expires_at)',
                'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_phone ON user_subscriptions(user_phone)',
                'CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)',
                'CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)',
                'CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true',
                'CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type) WHERE is_active = true',
                
                // Indexes untuk Debt/Receivable tables
                'CREATE INDEX IF NOT EXISTS idx_clients_user_phone ON clients(user_phone)',
                'CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(user_phone, name)',
                'CREATE INDEX IF NOT EXISTS idx_debt_receivables_user_phone ON debt_receivables(user_phone)',
                'CREATE INDEX IF NOT EXISTS idx_debt_receivables_client ON debt_receivables(client_id)',
                'CREATE INDEX IF NOT EXISTS idx_debt_receivables_type_status ON debt_receivables(user_phone, type, status)',
                'CREATE INDEX IF NOT EXISTS idx_debt_receivables_created_at ON debt_receivables(created_at DESC)',
                'CREATE INDEX IF NOT EXISTS idx_debt_receivables_due_date ON debt_receivables(due_date) WHERE due_date IS NOT NULL',
                
                // Indexes untuk Curhat History table
                'CREATE INDEX IF NOT EXISTS idx_curhat_history_user_phone ON curhat_history(user_phone)',
                'CREATE INDEX IF NOT EXISTS idx_curhat_history_session ON curhat_history(user_phone, session_id)',
                'CREATE INDEX IF NOT EXISTS idx_curhat_history_timestamp ON curhat_history(message_timestamp DESC)',
                'CREATE INDEX IF NOT EXISTS idx_curhat_history_created_at ON curhat_history(created_at DESC)'
            ];

            for (const index of indexes) {
                try {
                    await this.sql.unsafe(index);
                } catch (error) {
                    // Ignore if index already exists
                    if (!error.message.includes('already exists')) {
                        throw error;
                    }
                }
            }

            // Create triggers
            await this.createTriggers();

            // Add missing columns for existing tables
            await this.addMissingColumns();

            // Insert default data
            await this.insertDefaultCategories();
            await this.insertDefaultSubscriptionPlans();
            
        } catch (error) {
            this.logger.error('Error creating tables:', error);
            throw error;
        }
    }

    async createTriggers() {
        // Create update trigger function
        await this.sql`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `;

        // Apply triggers (PostgreSQL doesn't support IF NOT EXISTS for triggers)
        const triggers = [
            {
                name: 'update_transactions_updated_at',
                table: 'transactions',
                sql: 'CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
            },
            {
                name: 'update_debt_receivables_updated_at',
                table: 'debt_receivables',
                sql: 'CREATE TRIGGER update_debt_receivables_updated_at BEFORE UPDATE ON debt_receivables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
            },
            {
                name: 'update_clients_updated_at',
                table: 'clients',
                sql: 'CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
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
                // First check if the table exists
                const tableExists = await this.sql`
                    SELECT 1 FROM information_schema.tables
                    WHERE table_name = ${trigger.table} AND table_schema = 'public'
                `;

                if (tableExists.length === 0) {
                    this.logger.warn(`Skipping trigger ${trigger.name}: table '${trigger.table}' does not exist`);
                    continue;
                }

                // Check if trigger exists
                const triggerExists = await this.sql`
                    SELECT 1 FROM information_schema.triggers
                    WHERE trigger_name = ${trigger.name} AND event_object_table = ${trigger.table}
                `;

                if (triggerExists.length === 0) {
                    await this.sql.unsafe(trigger.sql);
                    this.logger.info(`Created trigger: ${trigger.name}`);
                } else {
                    this.logger.info(`Trigger already exists: ${trigger.name}`);
                }
            } catch (error) {
                this.logger.warn(`Trigger creation warning for ${trigger.name}:`, error.message);
            }
        }
    }

    async addMissingColumns() {
        try {
            // Add last_reset_date column to user_subscriptions if it doesn't exist
            await this.sql`
                ALTER TABLE user_subscriptions
                ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE
            `;
            this.logger.info('Added last_reset_date column to user_subscriptions (if not exists)');

            // Add trial-related columns to user_subscriptions if they don't exist
            await this.sql`
                ALTER TABLE user_subscriptions
                ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false
            `;
            await this.sql`
                ALTER TABLE user_subscriptions
                ADD COLUMN IF NOT EXISTS trial_start TIMESTAMP
            `;
            await this.sql`
                ALTER TABLE user_subscriptions
                ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP
            `;
            await this.sql`
                ALTER TABLE user_subscriptions
                ADD COLUMN IF NOT EXISTS trial_expired BOOLEAN DEFAULT false
            `;
            this.logger.info('Added trial-related columns to user_subscriptions (if not exists)');

            // Add icon column to categories if it doesn't exist
            await this.sql`
                ALTER TABLE categories
                ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '📝'
            `;
            this.logger.info('Added icon column to categories (if not exists)');

            // Update existing user_subscriptions with current date if last_reset_date is null
            await this.sql`
                UPDATE user_subscriptions
                SET last_reset_date = CURRENT_DATE
                WHERE last_reset_date IS NULL
            `;
            this.logger.info('Updated existing user_subscriptions with current date');

        } catch (error) {
            this.logger.error('Error adding missing columns:', error);
            // Don't throw - this is not critical for operation
        }
    }

    async insertDefaultCategories() {
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
                // Additional income categories for lower-income individuals
                { name: 'Upah Harian', type: 'income', color: '#ffc107' }, // Wage
                { name: 'Uang Lembur', type: 'income', color: '#fd7e14' }, // Overtime pay
                { name: 'BLT', type: 'income', color: '#dc3545' }, // Direct Cash Assistance
                { name: 'Subsidi', type: 'income', color: '#e83e8c' }, // Subsidy
                { name: 'Bantuan Sosial', type: 'income', color: '#198754' }, // Social Assistance
                { name: 'Hasil Bertani', type: 'income', color: '#6c757d' }, // Farming income
                { name: 'Hasil Melaut', type: 'income', color: '#0d6efd' }, // Fishing income
                { name: 'Pinjaman', type: 'income', color: '#adb5bd' }, // Loan (handle with care)
                { name: 'Pensiun', type: 'income', color: '#a8a29e' },
                { name: 'Beasiswa', type: 'income', color: '#4ade80' },


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
            const existingCount = await this.sql`SELECT COUNT(*) as count FROM categories`;
            const currentCount = existingCount[0] ? parseInt(existingCount[0].count) : 0;
            
            this.logger.info(`Current fixed categories: ${currentCount}, Required: ${minCategoriesRequired}`);
            
            // If categories are empty or below minimum threshold, recreate them
            if (currentCount === 0 || currentCount < minCategoriesRequired) {
                this.logger.info('Categories insufficient, recreating fixed categories for PostgreSQL...');
                
                // Delete existing categories
                await this.sql`DELETE FROM categories`;
                
                // Insert all default categories as fixed global categories
                for (const category of defaultCategories) {
                    try {
                        await this.sql`
                            INSERT INTO categories (name, type, color) 
                            VALUES (${category.name}, ${category.type}, ${category.color})
                        `;
                    } catch (error) {
                        this.logger.error(`Error inserting fixed category ${category.name}:`, error);
                    }
                }
                
                // Verify insertion
                const finalCount = await this.sql`SELECT COUNT(*) as count FROM categories`;
                this.logger.info(`Fixed categories created successfully. Total: ${finalCount[0].count}`);
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
                    await this.sql`
                        INSERT INTO categories (name, type, color)
                        VALUES (${category.name}, ${category.type}, ${category.color})
                        ON CONFLICT (name, type) DO NOTHING
                    `;
                } catch (fallbackError) {
                    this.logger.error(`Fallback error for category ${category.name}:`, fallbackError);
                }
            }
        }
        
        this.logger.info('Default categories setup completed for PostgreSQL');
    }

    async insertDefaultSubscriptionPlans() {
        try {
            // Check existing subscription plans count
            const existingCount = await this.sql`SELECT COUNT(*) as count FROM subscription_plans`;
            const currentCount = existingCount[0] ? parseInt(existingCount[0].count) : 0;
            
            this.logger.info(`Current subscription plans: ${currentCount}`);
            
            if (currentCount === 0) {
                this.logger.info('Creating default subscription plans for PostgreSQL...');
                
                const defaultPlans = [
                    {
                        name: 'trial',
                        display_name: 'Free Trial (30 Hari)',
                        description: 'Trial gratis selama 30 hari dengan unlimited transaksi',
                        monthly_transaction_limit: null,
                        price_monthly: 0,
                        features: JSON.stringify(['unlimited_transaksi_trial', 'laporan_bulanan', 'saldo_check', 'ai_basic', 'trial_30_days'])
                    },
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
                        await this.sql`
                            INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, price_monthly, features)
                            VALUES (${plan.name}, ${plan.display_name}, ${plan.description}, ${plan.monthly_transaction_limit}, ${plan.price_monthly}, ${plan.features})
                            ON CONFLICT (name) DO NOTHING
                        `;
                    } catch (error) {
                        this.logger.error(`Error inserting subscription plan ${plan.name}:`, error);
                    }
                }
                
                // Verify insertion
                const finalCount = await this.sql`SELECT COUNT(*) as count FROM subscription_plans`;
                this.logger.info(`Subscription plans created successfully. Total: ${finalCount[0].count}`);
            } else {
                this.logger.info('Subscription plans already exist, skipping creation');
            }
            
        } catch (error) {
            this.logger.error('Error in insertDefaultSubscriptionPlans for PostgreSQL:', error);
        }
        
        this.logger.info('Default subscription plans setup completed for PostgreSQL');
    }

    // Migration functions
    async migrateFresh() {
        try {
            this.logger.warn('⚠️  WARNING: Fresh migration will DROP ALL TABLES and recreate them');
            this.logger.warn('⚠️  This action is IRREVERSIBLE and will DELETE ALL DATA!');
            
            // Safety check - only allow in development/staging
            if (process.env.NODE_ENV === 'production') {
                this.logger.error('❌ Fresh migration is DISABLED in production for safety');
                throw new Error('Fresh migration not allowed in production environment');
            }
            
            this.logger.info('Starting fresh migration for PostgreSQL - This will DROP ALL TABLES and recreate them');
            
            await this.dropAllTables();
            await this.createTables();
            
            this.logger.info('Fresh migration completed for PostgreSQL');
        } catch (error) {
            this.logger.error('Error during PostgreSQL fresh migration:', error);
            throw error;
        }
    }

    async dropAllTables() {
        try {
            this.logger.warn('🔥 DANGER: Dropping all PostgreSQL tables...');
            this.logger.warn('🔥 This will PERMANENTLY DELETE ALL DATA!');
            
            // Safety check - only allow in development/staging
            if (process.env.NODE_ENV === 'production') {
                this.logger.error('❌ Drop all tables is DISABLED in production for safety');
                throw new Error('Drop all tables not allowed in production environment');
            }
            
            // Drop tables in order to handle foreign key constraints
            const tables = [
                'ai_interactions',
                'curhat_history',
                'whatsapp_sessions',
                'registration_sessions',
                'user_subscriptions',
                'settings',
                'debt_receivables',
                'debts',
                'clients',
                'transactions',
                'categories',
                'subscription_plans',
                'users'
            ];

            this.logger.warn(`⚠️  About to drop ${tables.length} tables: ${tables.join(', ')}`);

            for (const table of tables) {
                try {
                    await this.sql.unsafe(`DROP TABLE IF EXISTS ${table} CASCADE`);
                    this.logger.info(`🗑️  Dropped table: ${table}`);
                } catch (error) {
                    this.logger.warn(`Warning dropping table ${table}:`, error.message);
                }
            }

            // Drop any remaining triggers and functions
            try {
                await this.sql`DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE`;
                this.logger.info('Dropped update trigger function');
            } catch (error) {
                this.logger.warn('Warning dropping trigger function:', error.message);
            }

            this.logger.info('All PostgreSQL tables dropped successfully');
        } catch (error) {
            this.logger.error('Error dropping PostgreSQL tables:', error);
            throw error;
        }
    }

    async migrate() {
        try {
            this.logger.info('Running PostgreSQL migrations...');
            
            // For now, just ensure tables exist with latest schema
            await this.createTables();
            
            this.logger.info('PostgreSQL migrations completed');
        } catch (error) {
            this.logger.error('Error during PostgreSQL migration:', error);
            throw error;
        }
    }

    async seed() {
        try {
            this.logger.info('Seeding PostgreSQL database with default data...');
            
            await this.insertDefaultCategories();
            await this.insertDefaultSubscriptionPlans();
            
            this.logger.info('PostgreSQL seeding completed');
        } catch (error) {
            this.logger.error('Error during PostgreSQL seeding:', error);
            throw error;
        }
    }

    /**
     * Log AI interactions for monitoring and improvement
     */
    async logAIInteraction(userPhone, prompt, response, type = 'general') {
        try {
            // Create ai_interactions table if it doesn't exist
            await this.sql`
                CREATE TABLE IF NOT EXISTS ai_interactions (
                    id SERIAL PRIMARY KEY,
                    user_phone VARCHAR(20) NOT NULL,
                    interaction_type VARCHAR(50) DEFAULT 'general',
                    prompt TEXT,
                    response TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
                )
            `;

            // Insert the interaction log
            await this.sql`
                INSERT INTO ai_interactions (user_phone, interaction_type, prompt, response)
                VALUES (${userPhone}, ${type}, ${prompt}, ${response})
            `;

            // Only log in debug mode to avoid spam
            if (process.env.DEBUG_AI_INTERACTIONS === 'true') {
                this.logger.info(`AI interaction logged for ${userPhone}: ${type}`);
            }

        } catch (error) {
            // Don't throw error for logging failures, just warn
            this.logger.warn('Failed to log AI interaction:', error.message);
        }
    }

    /**
     * Get AI interaction statistics for monitoring
     */
    async getAIInteractionStats(userPhone = null, days = 7) {
        try {
            const dateFilter = `created_at >= CURRENT_DATE - INTERVAL '${days} days'`;
            const userFilter = userPhone ? `AND user_phone = $1` : '';
            const params = userPhone ? [userPhone] : [];

            const stats = await this.sql.unsafe(`
                SELECT
                    interaction_type,
                    COUNT(*) as count,
                    DATE(created_at) as date
                FROM ai_interactions
                WHERE ${dateFilter} ${userFilter}
                GROUP BY interaction_type, DATE(created_at)
                ORDER BY date DESC, interaction_type
            `, params);

            return stats;
        } catch (error) {
            this.logger.error('Error getting AI interaction stats:', error);
            return [];
        }
    }

    /**
     * Curhat History Management Methods
     */
    
    /**
     * Save curhat message to history with auto cleanup
     */
    async saveCurhatMessage(userPhone, sessionId, role, content) {
        try {
            // Insert new message
            await this.sql`
                INSERT INTO curhat_history (user_phone, session_id, role, content, message_timestamp)
                VALUES (${userPhone}, ${sessionId}, ${role}, ${content}, CURRENT_TIMESTAMP)
            `;

            // Auto cleanup old messages (older than 30 days) for this user
            await this.cleanupOldCurhatHistory(userPhone);

        } catch (error) {
            this.logger.error('Error saving curhat message:', error);
            throw error;
        }
    }

    /**
     * Get curhat history for a session
     */
    async getCurhatHistory(userPhone, sessionId, limit = 50) {
        try {
            const history = await this.sql`
                SELECT role, content, message_timestamp, created_at
                FROM curhat_history
                WHERE user_phone = ${userPhone}
                  AND session_id = ${sessionId}
                  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
                ORDER BY message_timestamp ASC
                LIMIT ${limit}
            `;

            return history.map(row => ({
                role: row.role,
                content: row.content,
                timestamp: row.message_timestamp.toISOString()
            }));

        } catch (error) {
            this.logger.error('Error getting curhat history:', error);
            return [];
        }
    }

    /**
     * Clear curhat history for a specific session
     */
    async clearCurhatSession(userPhone, sessionId) {
        try {
            const result = await this.sql`
                DELETE FROM curhat_history
                WHERE user_phone = ${userPhone}
                  AND session_id = ${sessionId}
            `;

            this.logger.info(`Cleared ${result.count} curhat messages for session ${sessionId}`);
            return result.count;

        } catch (error) {
            this.logger.error('Error clearing curhat session:', error);
            throw error;
        }
    }

    /**
     * Cleanup old curhat history (older than 30 days) for a user
     */
    async cleanupOldCurhatHistory(userPhone = null) {
        try {
            let result;
            
            if (userPhone) {
                // Cleanup for specific user
                result = await this.sql`
                    DELETE FROM curhat_history
                    WHERE user_phone = ${userPhone}
                      AND created_at < CURRENT_DATE - INTERVAL '30 days'
                `;
            } else {
                // Cleanup for all users
                result = await this.sql`
                    DELETE FROM curhat_history
                    WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
                `;
            }

            if (result.count > 0) {
                this.logger.info(`Cleaned up ${result.count} old curhat messages${userPhone ? ` for user ${userPhone}` : ''}`);
            }

            return result.count;

        } catch (error) {
            this.logger.error('Error cleaning up old curhat history:', error);
            throw error;
        }
    }

    /**
     * Get curhat statistics
     */
    async getCurhatStats(userPhone = null, days = 7) {
        try {
            const userFilter = userPhone ? 'AND user_phone = $1' : '';
            const params = userPhone ? [userPhone] : [];

            const stats = await this.sql.unsafe(`
                SELECT
                    DATE(created_at) as date,
                    COUNT(*) as total_messages,
                    COUNT(DISTINCT session_id) as unique_sessions,
                    COUNT(DISTINCT user_phone) as unique_users,
                    COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
                    COUNT(CASE WHEN role = 'assistant' THEN 1 END) as assistant_messages
                FROM curhat_history
                WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
                  ${userFilter}
                GROUP BY DATE(created_at)
                ORDER BY date DESC
            `, params);

            return stats;

        } catch (error) {
            this.logger.error('Error getting curhat stats:', error);
            return [];
        }
    }

    /**
     * Create scheduled cleanup job for curhat history
     */
    async scheduleCleanupCurhatHistory() {
        try {
            // Create a function for automatic cleanup (PostgreSQL function)
            await this.sql`
                CREATE OR REPLACE FUNCTION cleanup_old_curhat_history()
                RETURNS INTEGER AS $$
                DECLARE
                    deleted_count INTEGER;
                BEGIN
                    DELETE FROM curhat_history
                    WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
                    
                    GET DIAGNOSTICS deleted_count = ROW_COUNT;
                    
                    RETURN deleted_count;
                END;
                $$ LANGUAGE plpgsql;
            `;

            this.logger.info('Created cleanup function for curhat history');

        } catch (error) {
            this.logger.error('Error creating cleanup function:', error);
            throw error;
        }
    }
}

module.exports = PostgresDatabase;
