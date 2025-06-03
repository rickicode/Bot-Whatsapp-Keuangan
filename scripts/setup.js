require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const DatabaseManager = require('../src/database/DatabaseManager');

async function setup() {
    console.log('🚀 Setting up WhatsApp Financial Bot...\n');

    try {
        // Create necessary directories
        console.log('📁 Creating directories...');
        const directories = [
            './data',
            './backups',
            './logs',
            './exports',
            './temp'
        ];

        for (const dir of directories) {
            await fs.ensureDir(dir);
            console.log(`  ✅ Created: ${dir}`);
        }

        // Copy .env file if it doesn't exist (skip in Docker production)
        console.log('\n⚙️ Setting up environment...');
        const isDockerProduction = process.env.NODE_ENV === 'production';
        
        if (!isDockerProduction) {
            if (!await fs.pathExists('.env')) {
                if (await fs.pathExists('.env.example')) {
                    await fs.copy('.env.example', '.env');
                    console.log('  ✅ Created .env from .env.example');
                    console.log('  ⚠️  Please edit .env file with your settings');
                } else {
                    console.log('  ❌ .env.example not found');
                }
            } else {
                console.log('  ✅ .env file already exists');
            }
        } else {
            console.log('  ✅ Environment variables provided by Docker');
        }

        // Initialize database
        console.log('\n🗄️ Initializing database...');
        const db = new DatabaseManager();
        await db.initialize();
        console.log('  ✅ Database initialized successfully');
        await db.close();

        // Create sample data
        console.log('\n📊 Creating sample data...');
        await createSampleData();

        console.log('\n✅ Setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Edit .env file with your configuration');
        console.log('2. Set your DeepSeek API key in .env');
        console.log('3. Configure authorized phone numbers');
        console.log('4. Run: npm start');
        console.log('\n📱 WhatsApp QR code will appear when you start the bot');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        process.exit(1);
    }
}

async function createSampleData() {
    try {
        // Create a sample user and some transactions for testing
        const db = new DatabaseManager();
        await db.initialize();

        // Add sample user
        const samplePhone = '+621234567890';
        await db.createUser(samplePhone, 'Sample User');

        // Add some sample transactions
        const categories = await db.getCategories(samplePhone);
        const incomeCategory = categories.find(c => c.type === 'income') || categories[0];
        const expenseCategory = categories.find(c => c.type === 'expense') || categories[1];

        // Sample income
        await db.addTransaction(
            samplePhone,
            'income',
            1000000,
            incomeCategory?.id,
            'Sample freelance payment',
            '2024-01-01'
        );

        // Sample expense
        await db.addTransaction(
            samplePhone,
            'expense',
            150000,
            expenseCategory?.id,
            'Sample lunch expense',
            '2024-01-01'
        );

        console.log('  ✅ Sample data created');
        console.log(`  📱 Sample user: ${samplePhone}`);
        
        await db.close();
    } catch (error) {
        console.log('  ⚠️ Failed to create sample data:', error.message);
    }
}

// Run setup if called directly
if (require.main === module) {
    setup();
}

module.exports = setup;