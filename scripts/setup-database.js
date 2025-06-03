#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function setupDatabase() {
    console.log('🗄️  Database Setup for WhatsApp Financial Bot\n');
    
    try {
        // Ask user to choose database type
        console.log('Available database options:');
        console.log('1. SQLite3 (recommended for small to medium usage)');
        console.log('2. PostgreSQL (recommended for production/high usage)\n');
        
        const choice = await askQuestion('Choose database type (1 or 2): ');
        
        let dbConfig = {};
        
        if (choice === '1') {
            console.log('\n📦 Setting up SQLite3...');
            dbConfig = {
                DATABASE_TYPE: 'sqlite3',
                DB_PATH: './data/financial.db'
            };
            console.log('✅ SQLite3 configuration ready');
            
        } else if (choice === '2') {
            console.log('\n🐘 Setting up PostgreSQL...');
            console.log('Please provide PostgreSQL connection details:\n');
            
            const host = await askQuestion('Database host (default: localhost): ') || 'localhost';
            const port = await askQuestion('Database port (default: 5432): ') || '5432';
            const database = await askQuestion('Database name (default: financial_bot): ') || 'financial_bot';
            const user = await askQuestion('Database username: ');
            const password = await askQuestion('Database password: ');
            const ssl = await askQuestion('Use SSL? (y/N): ');
            
            if (!user || !password) {
                throw new Error('Username and password are required for PostgreSQL');
            }
            
            dbConfig = {
                DATABASE_TYPE: 'postgres',
                DATABASE_HOST: host,
                DATABASE_PORT: port,
                DATABASE_NAME: database,
                DATABASE_USER: user,
                DATABASE_PASSWORD: password,
                DATABASE_SSL: ssl.toLowerCase() === 'y' ? 'true' : 'false'
            };
            console.log('✅ PostgreSQL configuration ready');
            
        } else {
            throw new Error('Invalid choice. Please select 1 or 2.');
        }
        
        // Update .env file
        await updateEnvFile(dbConfig);
        
        console.log('\n🎉 Database configuration completed!');
        console.log('\nNext steps:');
        
        if (choice === '1') {
            console.log('• SQLite database will be created automatically');
            console.log('• Run: npm run setup');
        } else {
            console.log('• Make sure PostgreSQL server is running');
            console.log('• Create the database if it doesn\'t exist:');
            console.log(`  CREATE DATABASE ${dbConfig.DATABASE_NAME};`);
            console.log('• Run: npm run setup');
        }
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
}

async function updateEnvFile(dbConfig) {
    const envPath = './.env';
    const envExamplePath = './.env.example';
    
    try {
        // Read current .env file or create from .env.example
        let envContent = '';
        try {
            envContent = await fs.readFile(envPath, 'utf8');
        } catch (error) {
            // If .env doesn't exist, copy from .env.example
            envContent = await fs.readFile(envExamplePath, 'utf8');
        }
        
        // Update database configuration
        for (const [key, value] of Object.entries(dbConfig)) {
            const regex = new RegExp(`^${key}=.*`, 'm');
            const newLine = `${key}=${value}`;
            
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, newLine);
            } else {
                // Add new configuration
                envContent += `\n${newLine}`;
            }
        }
        
        // Comment out unused database configs
        if (dbConfig.DATABASE_TYPE === 'sqlite3') {
            // Comment out PostgreSQL configs
            envContent = envContent.replace(/^(DATABASE_HOST=)/m, '# $1');
            envContent = envContent.replace(/^(DATABASE_PORT=)/m, '# $1');
            envContent = envContent.replace(/^(DATABASE_NAME=)/m, '# $1');
            envContent = envContent.replace(/^(DATABASE_USER=)/m, '# $1');
            envContent = envContent.replace(/^(DATABASE_PASSWORD=)/m, '# $1');
            envContent = envContent.replace(/^(DATABASE_SSL=)/m, '# $1');
        } else {
            // Comment out SQLite configs
            envContent = envContent.replace(/^(DB_PATH=)/m, '# $1');
        }
        
        await fs.writeFile(envPath, envContent);
        console.log('✅ .env file updated with database configuration');
        
    } catch (error) {
        throw new Error(`Failed to update .env file: ${error.message}`);
    }
}

// Run setup if this script is executed directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };