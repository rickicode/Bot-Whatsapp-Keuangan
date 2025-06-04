const DatabaseManager = require('../src/database/DatabaseManager');
const Logger = require('../src/utils/Logger');
const fs = require('fs');
const path = require('path');

class RegistrationMigration {
    constructor() {
        this.logger = new Logger();
        this.db = null;
    }

    async run() {
        try {
            this.logger.info('🚀 Starting registration migration...');
            
            // Initialize database
            this.db = new DatabaseManager();
            await this.db.initialize();
            
            const dbType = this.db.getDatabaseType();
            this.logger.info(`📊 Database type: ${dbType}`);
            
            if (dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase') {
                await this.migratePostgreSQL();
            } else {
                await this.migrateSQLite();
            }
            
            this.logger.info('✅ Registration migration completed successfully!');
            
        } catch (error) {
            this.logger.error('❌ Migration failed:', error);
            throw error;
        } finally {
            if (this.db) {
                await this.db.close();
            }
        }
    }

    async migratePostgreSQL() {
        this.logger.info('🐘 Running PostgreSQL migration...');
        
        try {
            await this.db.beginTransaction();
            
            // Add new columns to users table
            this.logger.info('📝 Adding new columns to users table...');
            await this.db.run(`
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
                ADD COLUMN IF NOT EXISTS city VARCHAR(100),
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
                ADD COLUMN IF NOT EXISTS registration_completed BOOLEAN DEFAULT false,
                ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false
            `);
            
            // Update categories table to be global/fixed
            this.logger.info('🔄 Migrating categories to global/fixed structure...');
            
            // Create new global categories table
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS categories_new (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    type VARCHAR(10) CHECK(type IN ('income', 'expense')) NOT NULL,
                    color VARCHAR(10) DEFAULT '#007bff',
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name, type)
                )
            `);
            
            // Copy unique categories from old table
            try {
                await this.db.run(`
                    INSERT INTO categories_new (name, type, color, is_active, created_at)
                    SELECT DISTINCT name, type, color, is_active, MIN(created_at)
                    FROM categories
                    WHERE user_phone = 'default' OR user_phone IS NULL
                    GROUP BY name, type, color, is_active
                    ON CONFLICT (name, type) DO NOTHING
                `);
                this.logger.info('✅ Migrated existing categories to global structure');
            } catch (error) {
                this.logger.warn('No existing categories to migrate, will use defaults from schema');
            }
            
            // Drop old categories table and rename new one
            await this.db.run('DROP TABLE categories');
            await this.db.run('ALTER TABLE categories_new RENAME TO categories');
            
            // Create registration_sessions table
            this.logger.info('📋 Creating registration_sessions table...');
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS registration_sessions (
                    id SERIAL PRIMARY KEY,
                    phone VARCHAR(20) NOT NULL,
                    step VARCHAR(20) NOT NULL DEFAULT 'name',
                    session_data JSONB DEFAULT '{}',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
                    UNIQUE(phone)
                )
            `);
            
            // Create subscription_plans table
            this.logger.info('💎 Creating subscription_plans table...');
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS subscription_plans (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(50) NOT NULL UNIQUE,
                    display_name VARCHAR(100) NOT NULL,
                    description TEXT,
                    monthly_transaction_limit INTEGER DEFAULT NULL,
                    price_monthly NUMERIC(10,2) DEFAULT 0,
                    features JSONB DEFAULT '[]',
                    is_active BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create user_subscriptions table
            this.logger.info('👥 Creating user_subscriptions table...');
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS user_subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_phone VARCHAR(20) NOT NULL,
                    plan_id INTEGER NOT NULL,
                    status VARCHAR(20) DEFAULT 'active',
                    transaction_count INTEGER DEFAULT 0,
                    subscription_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    subscription_end TIMESTAMP,
                    payment_status VARCHAR(20) DEFAULT 'free',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
                    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
                    UNIQUE(user_phone)
                )
            `);
            
            // Insert default subscription plans
            this.logger.info('🎯 Inserting default subscription plans...');
            await this.db.run(`
                INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, price_monthly, features) VALUES
                ('free', 'Free Plan', 'Plan gratis dengan fitur dasar', 10, 0, '["input_transaksi", "laporan_bulanan", "saldo_check"]'),
                ('premium', 'Premium Plan', 'Plan premium dengan fitur lengkap', NULL, 50000, '["unlimited_transaksi", "laporan_advanced", "ai_analysis", "export_data", "priority_support"]')
                ON CONFLICT (name) DO NOTHING
            `);
            
            // Create indexes
            this.logger.info('🔍 Creating indexes...');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_registration_sessions_phone ON registration_sessions(phone)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires ON registration_sessions(expires_at)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_phone ON user_subscriptions(user_phone)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status)');
            
            // Add trigger for user_subscriptions updated_at (check if exists first)
            try {
                const triggerExists = await this.db.get(`
                    SELECT 1 FROM information_schema.triggers
                    WHERE trigger_name = 'update_user_subscriptions_updated_at'
                    AND event_object_table = 'user_subscriptions'
                `);

                if (!triggerExists) {
                    await this.db.run(`
                        CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
                        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
                    `);
                    this.logger.info('✅ Created user_subscriptions trigger');
                } else {
                    this.logger.info('ℹ️ Trigger user_subscriptions_updated_at already exists');
                }
            } catch (error) {
                this.logger.warn('⚠️ Trigger creation warning:', error.message);
            }
            
            // Add validation constraint
            await this.db.run(`
                ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS check_registration_completed 
                CHECK (
                    (registration_completed = false) OR 
                    (registration_completed = true AND name IS NOT NULL AND email IS NOT NULL AND city IS NOT NULL)
                )
            `);
            
            // Migrate existing users to have default subscriptions
            this.logger.info('👤 Migrating existing users...');
            const freePlan = await this.db.get("SELECT id FROM subscription_plans WHERE name = 'free'");
            
            if (freePlan) {
                await this.db.run(`
                    INSERT INTO user_subscriptions (user_phone, plan_id, status, transaction_count)
                    SELECT phone, $1, 'active', 0
                    FROM users 
                    WHERE phone NOT IN (SELECT user_phone FROM user_subscriptions)
                `, [freePlan.id]);
                
                // Mark existing users as registration completed
                await this.db.run(`
                    UPDATE users 
                    SET registration_completed = true, is_active = true 
                    WHERE name IS NOT NULL
                `);
            }
            
            await this.db.commit();
            this.logger.info('✅ PostgreSQL migration completed successfully!');
            
        } catch (error) {
            await this.db.rollback();
            throw error;
        }
    }

    async migrateSQLite() {
        this.logger.info('📂 Running SQLite migration...');
        
        try {
            // For SQLite, we need to handle the migration differently
            // Check if new columns exist
            const tableInfo = await this.db.all("PRAGMA table_info(users)");
            const hasEmail = tableInfo.some(col => col.name === 'email');
            const hasCity = tableInfo.some(col => col.name === 'city');
            const hasIsActive = tableInfo.some(col => col.name === 'is_active');
            const hasRegCompleted = tableInfo.some(col => col.name === 'registration_completed');
            const hasIsAdmin = tableInfo.some(col => col.name === 'is_admin');
            
            // Add missing columns to users table
            if (!hasEmail) {
                this.logger.info('📧 Adding email column...');
                await this.db.run('ALTER TABLE users ADD COLUMN email VARCHAR(255)');
            }
            
            if (!hasCity) {
                this.logger.info('🏙️ Adding city column...');
                await this.db.run('ALTER TABLE users ADD COLUMN city VARCHAR(100)');
            }
            
            if (!hasIsActive) {
                this.logger.info('✅ Adding is_active column...');
                await this.db.run('ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1');
            }
            
            if (!hasRegCompleted) {
                this.logger.info('📋 Adding registration_completed column...');
                await this.db.run('ALTER TABLE users ADD COLUMN registration_completed BOOLEAN DEFAULT 0');
            }
            
            if (!hasIsAdmin) {
                this.logger.info('👑 Adding is_admin column...');
                await this.db.run('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0');
            }
            
            // Update categories table to be global/fixed
            this.logger.info('🔄 Migrating categories to global/fixed structure...');
            
            // Create new global categories table
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS categories_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
                    color TEXT DEFAULT '#007bff',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(name, type)
                )
            `);
            
            // Copy unique categories from old table if exists
            try {
                await this.db.run(`
                    INSERT OR IGNORE INTO categories_new (name, type, color, is_active, created_at)
                    SELECT DISTINCT name, type, color, is_active, MIN(created_at)
                    FROM categories
                    WHERE user_phone = 'default'
                    GROUP BY name, type, color, is_active
                `);
            } catch (error) {
                this.logger.warn('No existing categories to migrate, will create defaults');
            }
            
            // Drop old categories table and rename new one
            await this.db.run('DROP TABLE IF EXISTS categories');
            await this.db.run('ALTER TABLE categories_new RENAME TO categories');
            
            // Create registration_sessions table
            this.logger.info('📝 Creating registration_sessions table...');
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS registration_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phone VARCHAR(20) NOT NULL UNIQUE,
                    step VARCHAR(20) NOT NULL DEFAULT 'name',
                    session_data TEXT DEFAULT '{}',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME DEFAULT (datetime('now', '+24 hours'))
                )
            `);
            
            // Create subscription_plans table
            this.logger.info('💎 Creating subscription_plans table...');
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS subscription_plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(50) NOT NULL UNIQUE,
                    display_name VARCHAR(100) NOT NULL,
                    description TEXT,
                    monthly_transaction_limit INTEGER DEFAULT NULL,
                    price_monthly REAL DEFAULT 0,
                    features TEXT DEFAULT '[]',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Create user_subscriptions table
            this.logger.info('👥 Creating user_subscriptions table...');
            await this.db.run(`
                CREATE TABLE IF NOT EXISTS user_subscriptions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_phone VARCHAR(20) NOT NULL UNIQUE,
                    plan_id INTEGER NOT NULL,
                    status VARCHAR(20) DEFAULT 'active',
                    transaction_count INTEGER DEFAULT 0,
                    subscription_start DATETIME DEFAULT CURRENT_TIMESTAMP,
                    subscription_end DATETIME,
                    payment_status VARCHAR(20) DEFAULT 'free',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
                    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
                )
            `);
            
            // Insert default subscription plans
            this.logger.info('🎯 Inserting default subscription plans...');
            await this.db.run(`
                INSERT OR IGNORE INTO subscription_plans (name, display_name, description, monthly_transaction_limit, price_monthly, features) VALUES
                ('free', 'Free Plan', 'Plan gratis dengan fitur dasar', 10, 0, '["input_transaksi", "laporan_bulanan", "saldo_check"]'),
                ('premium', 'Premium Plan', 'Plan premium dengan fitur lengkap', NULL, 50000, '["unlimited_transaksi", "laporan_advanced", "ai_analysis", "export_data", "priority_support"]')
            `);
            
            // Create indexes
            this.logger.info('🔍 Creating indexes...');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_registration_sessions_phone ON registration_sessions(phone)');
            await this.db.run('CREATE INDEX IF NOT EXISTS idx_user_subscriptions_phone ON user_subscriptions(user_phone)');
            
            // Migrate existing users to have default subscriptions
            this.logger.info('👤 Migrating existing users...');
            const freePlan = await this.db.get("SELECT id FROM subscription_plans WHERE name = 'free'");
            
            if (freePlan) {
                await this.db.run(`
                    INSERT OR IGNORE INTO user_subscriptions (user_phone, plan_id, status, transaction_count)
                    SELECT phone, ?, 'active', 0
                    FROM users 
                    WHERE phone NOT IN (SELECT user_phone FROM user_subscriptions)
                `, [freePlan.id]);
                
                // Mark existing users as registration completed
                await this.db.run(`
                    UPDATE users 
                    SET registration_completed = 1, is_active = 1 
                    WHERE name IS NOT NULL
                `);
            }
            
            this.logger.info('✅ SQLite migration completed successfully!');
            
        } catch (error) {
            this.logger.error('❌ SQLite migration failed:', error);
            throw error;
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const migration = new RegistrationMigration();
    migration.run()
        .then(() => {
            console.log('Migration completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = RegistrationMigration;