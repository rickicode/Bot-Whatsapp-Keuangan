#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of environment variables that the application uses
const ENV_VARIABLES = [
    'NODE_ENV',
    'DATABASE_TYPE',
    'DB_PATH',
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'DB_SSL',
    'SUPABASE_DB_URL',
    'BOT_NAME',
    'BOT_ADMIN_PHONE',
    'USER_ADMIN',
    'ALLOWED_USERS',
    'AI_PROVIDER',
    'DEEPSEEK_API_KEY',
    'DEEPSEEK_BASE_URL',
    'DEEPSEEK_MODEL',
    'OPENAI_API_KEY',
    'OPENAI_BASE_URL',
    'OPENAI_MODEL',
    'OPENAI_COMPATIBLE_API_KEY',
    'OPENAI_COMPATIBLE_BASE_URL',
    'OPENAI_COMPATIBLE_MODEL',
    'PORT',
    'ENCRYPTION_KEY',
    'DEFAULT_LANGUAGE',
    'DEFAULT_CURRENCY',
    'CURRENCY_SYMBOL',
    'ENABLE_AI_FEATURES',
    'ENABLE_OCR',
    'ENABLE_REMINDERS',
    'ASK_CATEGORY_IF_UNKNOWN',
    'TZ',
    'LOG_LEVEL',
    'LOG_FILE',
    'BACKUP_PATH'
];

// Default values for missing environment variables
const DEFAULT_VALUES = {
    'NODE_ENV': 'production',
    'DATABASE_TYPE': 'sqlite3',
    'DB_PATH': './data/financial.db',
    'BOT_NAME': 'Financial Bot',
    'AI_PROVIDER': 'deepseek',
    'DEEPSEEK_BASE_URL': 'https://api.deepseek.com',
    'DEEPSEEK_MODEL': 'deepseek-chat',
    'OPENAI_BASE_URL': 'https://api.openai.com',
    'OPENAI_MODEL': 'gpt-3.5-turbo',
    'PORT': '3000',
    'DEFAULT_LANGUAGE': 'id',
    'DEFAULT_CURRENCY': 'IDR',
    'CURRENCY_SYMBOL': 'Rp',
    'ENABLE_AI_FEATURES': 'true',
    'ENABLE_OCR': 'false',
    'ENABLE_REMINDERS': 'true',
    'ASK_CATEGORY_IF_UNKNOWN': 'true',
    'TZ': 'Asia/Jakarta',
    'LOG_LEVEL': 'info',
    'LOG_FILE': './logs/app.log',
    'BACKUP_PATH': './backups'
};

function createEnvFile() {
    console.log('🔧 Creating .env file from environment variables...');
    
    let envContent = '# Generated .env file from Docker environment variables\n';
    envContent += `# Generated at: ${new Date().toISOString()}\n\n`;
    
    // Process all known environment variables
    ENV_VARIABLES.forEach(varName => {
        const value = process.env[varName] || DEFAULT_VALUES[varName] || '';
        if (value) {
            envContent += `${varName}=${value}\n`;
        }
    });
    
    // Add any other environment variables that start with common prefixes
    const additionalPrefixes = ['BOT_', 'DB_', 'AI_', 'DEEPSEEK_', 'OPENAI_'];
    Object.keys(process.env).forEach(key => {
        if (!ENV_VARIABLES.includes(key)) {
            const hasPrefix = additionalPrefixes.some(prefix => key.startsWith(prefix));
            if (hasPrefix) {
                envContent += `${key}=${process.env[key]}\n`;
            }
        }
    });
    
    try {
        fs.writeFileSync('.env', envContent);
        console.log('✅ .env file created successfully');
        
        // Log non-sensitive variables for debugging
        console.log('📍 Environment variables loaded:');
        const nonSensitive = ['NODE_ENV', 'DATABASE_TYPE', 'BOT_NAME', 'AI_PROVIDER', 'LOG_LEVEL', 'PORT'];
        nonSensitive.forEach(key => {
            const value = process.env[key] || DEFAULT_VALUES[key];
            if (value) {
                console.log(`   ${key}=${value}`);
            }
        });
        
        // Check for critical missing variables
        const critical = ['BOT_ADMIN_PHONE'];
        const missing = critical.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.warn('⚠️  Missing critical environment variables:', missing.join(', '));
            console.warn('   Bot may not function properly without these variables');
        }
        
    } catch (error) {
        console.error('❌ Failed to create .env file:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    createEnvFile();
}

module.exports = { createEnvFile };