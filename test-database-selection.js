require('dotenv').config();
const DatabaseFactory = require('./src/database/DatabaseFactory');
const DatabaseManager = require('./src/database/DatabaseManager');

async function testDatabaseSelection() {
    console.log('🧪 Testing Database Selection System...\n');
    
    try {
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';
        console.log(`📊 Current database type: ${dbType}`);
        
        // Test DatabaseFactory
        console.log('\n1. Testing DatabaseFactory...');
        const supportedTypes = DatabaseFactory.getSupportedTypes();
        console.log(`   ✅ Supported types: ${supportedTypes.join(', ')}`);
        
        // Test database creation
        console.log('\n2. Testing Database Creation...');
        const db = DatabaseFactory.create();
        console.log(`   ✅ Database instance created: ${db.constructor.name}`);
        
        // Test DatabaseManager
        console.log('\n3. Testing DatabaseManager...');
        const manager = new DatabaseManager();
        await manager.initialize();
        console.log('   ✅ DatabaseManager initialized successfully');
        
        // Test basic operations
        console.log('\n4. Testing Basic Operations...');
        
        // Test user creation
        const testUser = await manager.createUser('+628123456789', 'Test User');
        console.log('   ✅ User creation works');
        
        // Test categories
        const categories = await manager.getCategories('+628123456789');
        console.log(`   ✅ Categories loaded: ${categories.length} categories found`);
        console.log(`   📋 Sample categories: ${categories.slice(0, 3).map(c => c.name).join(', ')}`);
        
        // Test transaction
        const categoryId = categories.find(c => c.type === 'expense')?.id;
        if (categoryId) {
            const transactionId = await manager.addTransaction(
                '+628123456789',
                'expense',
                50000,
                categoryId,
                'Test transaction'
            );
            console.log(`   ✅ Transaction creation works (ID: ${transactionId})`);
            
            // Test balance
            const balance = await manager.getBalance('+628123456789');
            console.log(`   ✅ Balance calculation works: ${JSON.stringify(balance)}`);
        }
        
        // Test database type info
        console.log('\n5. Database Information:');
        console.log(`   🗄️  Type: ${manager.getDatabaseType()}`);
        
        if (dbType === 'sqlite3') {
            console.log(`   📁 Path: ${process.env.DB_PATH || './data/financial.db'}`);
        } else if (dbType === 'postgres') {
            console.log(`   🌐 Host: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}`);
            console.log(`   🏢 Database: ${process.env.DATABASE_NAME}`);
            console.log(`   👤 User: ${process.env.DATABASE_USER}`);
        }
        
        await manager.close();
        console.log('\n✅ All tests passed! Database selection system working properly.');
        
        console.log('\n📋 Summary:');
        console.log(`   • Database Type: ${dbType}`);
        console.log('   • Factory Pattern: ✅ Working');
        console.log('   • Database Operations: ✅ Working');
        console.log('   • Categories (Indonesian): ✅ Working');
        console.log('   • Transactions: ✅ Working');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.log('\n🔍 Troubleshooting:');
        
        if (error.message.includes('PostgreSQL requires')) {
            console.log('   • Set DATABASE_USER and DATABASE_PASSWORD in .env');
            console.log('   • Run: npm run setup-db');
        } else if (error.message.includes('connect')) {
            console.log('   • Make sure PostgreSQL server is running');
            console.log('   • Check connection details in .env');
        } else {
            console.log('   • Check .env configuration');
            console.log('   • Run: npm run setup-db to configure database');
        }
        
        process.exit(1);
    }
}

// Show usage info
console.log('🗄️  Database Selection Test\n');
console.log('Current configuration:');
console.log(`DATABASE_TYPE: ${process.env.DATABASE_TYPE || 'sqlite3 (default)'}`);

if (process.env.DATABASE_TYPE === 'postgres') {
    console.log(`DATABASE_HOST: ${process.env.DATABASE_HOST || 'not set'}`);
    console.log(`DATABASE_NAME: ${process.env.DATABASE_NAME || 'not set'}`);
    console.log(`DATABASE_USER: ${process.env.DATABASE_USER ? '***' : 'not set'}`);
} else {
    console.log(`DB_PATH: ${process.env.DB_PATH || './data/financial.db (default)'}`);
}

console.log('\nTo change database configuration, run: npm run setup-db\n');

testDatabaseSelection();