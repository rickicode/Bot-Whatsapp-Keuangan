const fs = require('fs-extra');
const path = require('path');
const DatabaseFactory = require('../src/database/DatabaseFactory');

async function freshDailySetup() {
    console.log('🚀 Starting fresh setup with daily limits...');
    
    try {
        // 1. Create database instance
        const db = DatabaseFactory.create();
        await db.initialize();
        
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        console.log(`📊 Database type: ${dbType}`);
        
        // 2. Create/Update subscription plans with daily limits
        console.log('📝 Setting up subscription plans with daily limits...');
        
        // Clear existing plans if any
        if (isPostgres) {
            await db.run('DELETE FROM subscription_plans');
        } else {
            await db.run('DELETE FROM subscription_plans');
        }
        
        // Create Free Plan (50 transactions per day)
        if (isPostgres) {
            await db.run(`
                INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [
                'free',
                'Free Plan', 
                'Plan gratis dengan 50 transaksi per hari',
                50,
                JSON.stringify({
                    "basic_features": true,
                    "transaction_limit": "50_per_day",
                    "categories": "global",
                    "reports": "basic"
                })
            ]);
        } else {
            await db.run(`
                INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, [
                'free',
                'Free Plan', 
                'Plan gratis dengan 50 transaksi per hari',
                50,
                JSON.stringify({
                    "basic_features": true,
                    "transaction_limit": "50_per_day",
                    "categories": "global",
                    "reports": "basic"
                })
            ]);
        }
        
        // Create Premium Plan (unlimited transactions per day)
        if (isPostgres) {
            await db.run(`
                INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [
                'premium',
                'Premium Plan', 
                'Plan premium dengan unlimited transaksi per hari',
                null,
                JSON.stringify({
                    "unlimited_transactions": true,
                    "advanced_reports": true,
                    "export_data": true,
                    "priority_support": true,
                    "custom_categories": true
                })
            ]);
        } else {
            await db.run(`
                INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            `, [
                'premium',
                'Premium Plan', 
                'Plan premium dengan unlimited transaksi per hari',
                null,
                JSON.stringify({
                    "unlimited_transactions": true,
                    "advanced_reports": true,
                    "export_data": true,
                    "priority_support": true,
                    "custom_categories": true
                })
            ]);
        }
        
        // 3. Setup default global categories
        console.log('📝 Setting up global categories...');
        
        const categories = [
            // Income categories
            { name: 'Gaji', type: 'income', color: '#4CAF50', icon: '💰' },
            { name: 'Freelance', type: 'income', color: '#2196F3', icon: '💼' },
            { name: 'Bisnis', type: 'income', color: '#FF9800', icon: '🏢' },
            { name: 'Investasi', type: 'income', color: '#9C27B0', icon: '📈' },
            { name: 'Bonus', type: 'income', color: '#FFC107', icon: '🎁' },
            { name: 'Lainnya', type: 'income', color: '#607D8B', icon: '📝' },
            
            // Expense categories
            { name: 'Makanan', type: 'expense', color: '#F44336', icon: '🍽️' },
            { name: 'Transportasi', type: 'expense', color: '#3F51B5', icon: '🚗' },
            { name: 'Utilitas', type: 'expense', color: '#009688', icon: '💡' },
            { name: 'Hiburan', type: 'expense', color: '#E91E63', icon: '🎬' },
            { name: 'Kesehatan', type: 'expense', color: '#4CAF50', icon: '🏥' },
            { name: 'Pendidikan', type: 'expense', color: '#2196F3', icon: '📚' },
            { name: 'Belanja', type: 'expense', color: '#FF9800', icon: '🛍️' },
            { name: 'Rumah Tangga', type: 'expense', color: '#795548', icon: '🏠' },
            { name: 'Komunikasi', type: 'expense', color: '#9C27B0', icon: '📱' },
            { name: 'Lainnya', type: 'expense', color: '#607D8B', icon: '📝' }
        ];
        
        // Clear existing categories if any
        if (isPostgres) {
            await db.run('DELETE FROM categories');
        } else {
            await db.run('DELETE FROM categories');
        }
        
        for (const category of categories) {
            if (isPostgres) {
                await db.run(`
                    INSERT INTO categories (name, type, color, icon, is_active, created_at)
                    VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
                `, [category.name, category.type, category.color, category.icon]);
            } else {
                await db.run(`
                    INSERT INTO categories (name, type, color, icon, is_active, created_at)
                    VALUES (?, ?, ?, ?, 1, datetime('now'))
                `, [category.name, category.type, category.color, category.icon]);
            }
        }
        
        // 4. Ensure database schema is up to date
        console.log('📝 Ensuring database schema is up to date...');
        
        // Add last_reset_date column if not exists
        try {
            if (isPostgres) {
                await db.run(`
                    ALTER TABLE user_subscriptions 
                    ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE
                `);
            } else {
                await db.run(`
                    ALTER TABLE user_subscriptions 
                    ADD COLUMN last_reset_date TEXT DEFAULT (date('now'))
                `);
            }
        } catch (error) {
            if (!error.message.includes('duplicate column') && !error.message.includes('already exists')) {
                console.log('   ⚠️ Note: Could not add last_reset_date column, might already exist');
            }
        }
        
        // Add icon column to categories if not exists
        try {
            if (isPostgres) {
                await db.run(`
                    ALTER TABLE categories 
                    ADD COLUMN IF NOT EXISTS icon VARCHAR(10) DEFAULT '📝'
                `);
            } else {
                await db.run(`
                    ALTER TABLE categories 
                    ADD COLUMN icon TEXT DEFAULT '📝'
                `);
            }
        } catch (error) {
            if (!error.message.includes('duplicate column') && !error.message.includes('already exists')) {
                console.log('   ⚠️ Note: Could not add icon column, might already exist');
            }
        }
        
        // 5. Clean up any existing user data for fresh start (optional)
        console.log('📝 Cleaning up for fresh start...');
        
        // Clear sessions and temporary data
        if (isPostgres) {
            await db.run('DELETE FROM registration_sessions');
            await db.run('DELETE FROM ai_interactions');
        } else {
            await db.run('DELETE FROM registration_sessions');
            await db.run('DELETE FROM ai_interactions');
        }
        
        console.log('✅ Fresh setup completed successfully!');
        console.log('');
        console.log('🎉 Bot ready with daily limits system:');
        console.log('   ✅ Free Plan: 50 transactions per day');
        console.log('   ✅ Premium Plan: Unlimited transactions per day');
        console.log('   ✅ Global categories setup');
        console.log('   ✅ Admin auto-promotion enabled');
        console.log('   ✅ Timezone: Asia/Jakarta');
        console.log('');
        console.log('🚀 Next steps:');
        console.log('   1. Start the bot: npm start');
        console.log('   2. Send message from admin number to auto-register as admin');
        console.log('   3. Regular users will get Free Plan on registration');
        console.log('   4. Use /menu-admin for admin functions');
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Fresh setup failed:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    freshDailySetup()
        .then(() => {
            console.log('🎉 Fresh daily setup completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Fresh setup failed:', error);
            process.exit(1);
        });
}

module.exports = freshDailySetup;