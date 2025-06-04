const DatabaseFactory = require('../src/database/DatabaseFactory');

async function migrateToDailyLimits() {
    const db = DatabaseFactory.create();
    await db.initialize();
    
    console.log('🔄 Starting migration to daily limits...');
    
    try {
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        // 1. Add last_reset_date column to user_subscriptions if it doesn't exist
        console.log('📝 Adding last_reset_date column...');
        
        if (isPostgres) {
            await db.run(`
                ALTER TABLE user_subscriptions 
                ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE
            `);
        } else {
            // For SQLite, check if column exists first
            try {
                await db.run(`
                    ALTER TABLE user_subscriptions 
                    ADD COLUMN last_reset_date TEXT DEFAULT (date('now'))
                `);
            } catch (error) {
                if (!error.message.includes('duplicate column name')) {
                    throw error;
                }
                console.log('   ✅ Column last_reset_date already exists');
            }
        }
        
        // 2. Update subscription plan descriptions to mention daily limits
        console.log('📝 Updating subscription plan descriptions...');
        
        if (isPostgres) {
            await db.run(`
                UPDATE subscription_plans 
                SET description = 'Plan gratis dengan 50 transaksi per hari'
                WHERE name = 'free'
            `);
            
            await db.run(`
                UPDATE subscription_plans 
                SET description = 'Plan premium dengan unlimited transaksi per hari'
                WHERE name = 'premium'
            `);
        } else {
            await db.run(`
                UPDATE subscription_plans 
                SET description = 'Plan gratis dengan 50 transaksi per hari'
                WHERE name = 'free'
            `);
            
            await db.run(`
                UPDATE subscription_plans 
                SET description = 'Plan premium dengan unlimited transaksi per hari'
                WHERE name = 'premium'
            `);
        }
        
        // 3. Reset all user transaction counts and set last_reset_date to today
        console.log('📝 Resetting all user transaction counts...');
        
        if (isPostgres) {
            await db.run(`
                UPDATE user_subscriptions 
                SET transaction_count = 0, last_reset_date = CURRENT_DATE
            `);
        } else {
            await db.run(`
                UPDATE user_subscriptions 
                SET transaction_count = 0, last_reset_date = date('now')
            `);
        }
        
        // 4. Set timezone for all users to Asia/Jakarta if not set
        console.log('📝 Setting timezone for all users...');
        
        if (isPostgres) {
            await db.run(`
                UPDATE users 
                SET timezone = 'Asia/Jakarta' 
                WHERE timezone IS NULL OR timezone = ''
            `);
        } else {
            await db.run(`
                UPDATE users 
                SET timezone = 'Asia/Jakarta' 
                WHERE timezone IS NULL OR timezone = ''
            `);
        }
        
        // 5. Check if we have the correct subscription plans
        console.log('📝 Checking subscription plans...');
        
        const freePlan = await db.get(
            isPostgres 
                ? 'SELECT * FROM subscription_plans WHERE name = $1' 
                : 'SELECT * FROM subscription_plans WHERE name = ?', 
            ['free']
        );
        
        if (!freePlan) {
            console.log('📝 Creating free plan...');
            if (isPostgres) {
                await db.run(`
                    INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features)
                    VALUES ($1, $2, $3, $4, $5)
                `, ['free', 'Free Plan', 'Plan gratis dengan 50 transaksi per hari', 50, '{"basic_features": true}']);
            } else {
                await db.run(`
                    INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features)
                    VALUES (?, ?, ?, ?, ?)
                `, ['free', 'Free Plan', 'Plan gratis dengan 50 transaksi per hari', 50, '{"basic_features": true}']);
            }
        }
        
        const premiumPlan = await db.get(
            isPostgres 
                ? 'SELECT * FROM subscription_plans WHERE name = $1' 
                : 'SELECT * FROM subscription_plans WHERE name = ?', 
            ['premium']
        );
        
        if (!premiumPlan) {
            console.log('📝 Creating premium plan...');
            if (isPostgres) {
                await db.run(`
                    INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features)
                    VALUES ($1, $2, $3, $4, $5)
                `, ['premium', 'Premium Plan', 'Plan premium dengan unlimited transaksi per hari', null, '{"unlimited_transactions": true, "advanced_reports": true, "export_data": true}']);
            } else {
                await db.run(`
                    INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, features)
                    VALUES (?, ?, ?, ?, ?)
                `, ['premium', 'Premium Plan', 'Plan premium dengan unlimited transaksi per hari', null, '{"unlimited_transactions": true, "advanced_reports": true, "export_data": true}']);
            }
        }
        
        // 6. Ensure all users have subscriptions
        console.log('📝 Ensuring all users have subscriptions...');
        
        const usersWithoutSubs = await db.all(`
            SELECT u.phone FROM users u 
            LEFT JOIN user_subscriptions us ON u.phone = us.user_phone 
            WHERE us.user_phone IS NULL AND u.registration_completed = ${isPostgres ? 'true' : '1'}
        `);
        
        const freeIdQuery = isPostgres 
            ? 'SELECT id FROM subscription_plans WHERE name = $1' 
            : 'SELECT id FROM subscription_plans WHERE name = ?';
        const freePlanId = await db.get(freeIdQuery, ['free']);
        
        for (const user of usersWithoutSubs) {
            console.log(`   ➕ Adding free subscription for user: ${user.phone}`);
            if (isPostgres) {
                await db.run(`
                    INSERT INTO user_subscriptions (user_phone, plan_id, status, transaction_count, last_reset_date)
                    VALUES ($1, $2, $3, 0, CURRENT_DATE)
                `, [user.phone, freePlanId.id, 'active']);
            } else {
                await db.run(`
                    INSERT INTO user_subscriptions (user_phone, plan_id, status, transaction_count, last_reset_date)
                    VALUES (?, ?, ?, 0, date('now'))
                `, [user.phone, freePlanId.id, 'active']);
            }
        }
        
        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('🔄 Changes made:');
        console.log('   ✅ Added last_reset_date column to user_subscriptions');
        console.log('   ✅ Updated subscription plan descriptions to mention daily limits');
        console.log('   ✅ Reset all user transaction counts');
        console.log('   ✅ Set timezone to Asia/Jakarta for all users');
        console.log('   ✅ Ensured all users have subscriptions');
        console.log('');
        console.log('📊 System now uses DAILY transaction limits:');
        console.log('   • Free Plan: 50 transactions per day');
        console.log('   • Premium Plan: Unlimited transactions per day');
        console.log('   • Limits reset automatically at midnight (Asia/Jakarta)');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateToDailyLimits()
        .then(() => {
            console.log('🎉 Daily limits migration completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}

module.exports = migrateToDailyLimits;