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
        // Check if running in Docker or with environment variables
        const isDocker = process.env.NODE_ENV === 'production' && process.env.DATABASE_TYPE;
        const databaseType = process.env.DATABASE_TYPE;
        
        let dbConfig = {};
        
        if (isDocker) {
            console.log('🐳 Running in Docker mode with environment variables');
            
            if (databaseType === 'postgresql') {
                console.log('\n🐘 Using PostgreSQL from environment...');
                dbConfig = {
                    DATABASE_TYPE: 'postgresql',
                    DB_HOST: process.env.DB_HOST || 'postgres',
                    DB_PORT: process.env.DB_PORT || '5432',
                    DB_NAME: process.env.DB_NAME || 'financial_bot',
                    DB_USER: process.env.DB_USER || 'botuser',
                    DB_PASSWORD: process.env.DB_PASSWORD || 'botpassword',
                    DB_SSL: process.env.DB_SSL || 'false'
                };
                console.log('✅ PostgreSQL configuration from environment');
                
            } else {
                console.log('\n📦 Using SQLite3 as fallback...');
                dbConfig = {
                    DATABASE_TYPE: 'sqlite3',
                    DB_PATH: './data/financial.db'
                };
                console.log('✅ SQLite3 configuration ready');
            }
            
            console.log('🎉 Database configuration completed!');
            return dbConfig;
            
        } else {
            // Interactive mode for local development
            console.log('Available database options:');
            console.log('1. SQLite3 (recommended for small to medium usage)');
            console.log('2. PostgreSQL (recommended for production/high usage)');
            console.log('3. Supabase PostgreSQL (serverless/cloud)\n');
            
            const choice = await askQuestion('Choose database type (1, 2, or 3): ');
            
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
                    DATABASE_TYPE: 'postgresql',
                    DB_HOST: host,
                    DB_PORT: port,
                    DB_NAME: database,
                    DB_USER: user,
                    DB_PASSWORD: password,
                    DB_SSL: ssl.toLowerCase() === 'y' ? 'true' : 'false'
                };
                console.log('✅ PostgreSQL configuration ready');
                
            } else if (choice === '3') {
                console.log('\n🚀 Setting up Supabase PostgreSQL...');
                console.log('Please provide your Supabase database connection details:\n');
                
                const supabaseUrl = await askQuestion('Supabase Database URL: ');
                
                if (!supabaseUrl) {
                    throw new Error('Supabase Database URL is required');
                }
                
                dbConfig = {
                    DATABASE_TYPE: 'supabase',
                    SUPABASE_DB_URL: supabaseUrl
                };
                
                console.log('✅ Supabase configuration ready');
                
            } else {
                throw new Error('Invalid choice. Please select 1, 2, or 3.');
            }
            
            // Update .env file only in interactive mode
            await updateEnvFile(dbConfig);
            
            console.log('\n🎉 Database configuration completed!');
            console.log('\nNext steps:');
            
            if (choice === '1') {
                console.log('• SQLite database will be created automatically');
                console.log('• Run: npm run setup');
            } else {
                if (choice === '2') {
                    console.log('• Make sure PostgreSQL server is running');
                    console.log('• Create the database if it doesn\'t exist:');
                    console.log(`  CREATE DATABASE ${dbConfig.DB_NAME};`);
                    console.log('• Run: npm run setup');
                } else if (choice === '3') {
                    console.log('\n📝 Supabase Setup Instructions:');
                    console.log('1. Go to your Supabase project dashboard');
                    console.log('2. Navigate to Settings > Database');
                    console.log('3. Find your connection info under "Connection string"');
                    console.log('4. Make sure you have enabled "Bypass RLS" for the bot user');
                    console.log('5. Run: npm run setup');
                    console.log('\n⚠️  Important Security Notes:');
                    console.log('• Store your Supabase URL securely');
                    console.log('• Never commit the URL to version control');
                    console.log('• Consider using environment variables in production');
                }
            }
        }
        
        return dbConfig;
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        if (!process.env.NODE_ENV || process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
        // In production, don't exit completely, return default config
        console.log('⚠️  Using default SQLite configuration');
        return {
            DATABASE_TYPE: 'sqlite3',
            DB_PATH: './data/financial.db'
        };
    } finally {
        if (rl) {
            rl.close();
        }
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