const DatabaseFactory = require('./src/database/DatabaseFactory');

async function fixRegistrationError() {
    console.log('🔧 Fixing registration error by adding missing columns...');
    
    const db = DatabaseFactory.create();
    await db.initialize();
    
    try {
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';
        const isPostgres = dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase';
        
        console.log(`📊 Database type: ${dbType}`);
        
        if (isPostgres) {
            // Add last_reset_date column if it doesn't exist
            console.log('📝 Adding last_reset_date column...');
            await db.run(`
                ALTER TABLE user_subscriptions 
                ADD COLUMN IF NOT EXISTS last_reset_date DATE DEFAULT CURRENT_DATE
            `);
            
            // Update existing records
            console.log('📝 Updating existing user_subscriptions...');
            await db.run(`
                UPDATE user_subscriptions 
                SET last_reset_date = CURRENT_DATE 
                WHERE last_reset_date IS NULL
            `);
            
            // Update subscription plan descriptions for daily limits
            console.log('📝 Updating subscription plan descriptions...');
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
            // SQLite
            try {
                console.log('📝 Adding last_reset_date column (SQLite)...');
                await db.run(`
                    ALTER TABLE user_subscriptions 
                    ADD COLUMN last_reset_date TEXT DEFAULT (date('now'))
                `);
            } catch (error) {
                if (!error.message.includes('duplicate column')) {
                    throw error;
                }
                console.log('   ✅ Column already exists');
            }
            
            // Update existing records
            console.log('📝 Updating existing user_subscriptions...');
            await db.run(`
                UPDATE user_subscriptions 
                SET last_reset_date = date('now') 
                WHERE last_reset_date IS NULL
            `);
            
            // Update subscription plan descriptions
            console.log('📝 Updating subscription plan descriptions...');
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
        
        // Verify the fix
        console.log('\n🔍 Verifying fix...');
        
        // Check if column exists
        try {
            const testSub = await db.get(`
                SELECT last_reset_date FROM user_subscriptions LIMIT 1
            `);
            console.log('   ✅ last_reset_date column exists and accessible');
        } catch (error) {
            console.log('   ❌ last_reset_date column still not accessible:', error.message);
        }
        
        // Check subscription plans
        const plans = await db.all('SELECT name, description FROM subscription_plans');
        console.log('   ✅ Subscription plans:');
        plans.forEach(plan => {
            console.log(`      • ${plan.name}: ${plan.description}`);
        });
        
        console.log('\n✅ Registration error fix completed!');
        console.log('');
        console.log('🚀 Now you can:');
        console.log('   1. Restart the bot: npm start');
        console.log('   2. Try registration again');
        console.log('   3. User should automatically get Free Plan with daily limits');
        
    } catch (error) {
        console.error('❌ Fix failed:', error);
        throw error;
    } finally {
        await db.close();
    }
}

// Run fix if called directly
if (require.main === module) {
    fixRegistrationError()
        .then(() => {
            console.log('🎉 Registration error fix completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Fix failed:', error);
            process.exit(1);
        });
}

module.exports = fixRegistrationError;