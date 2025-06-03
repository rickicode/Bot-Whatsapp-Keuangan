#!/usr/bin/env node

// Docker initialization script
// Creates .env file from environment variables

const fs = require('fs');
const path = require('path');

function createEnvFromEnvironment() {
    console.log('🐳 Docker initialization: Creating .env from environment variables...');
    
    const envVars = [
        'NODE_ENV',
        'DATABASE_TYPE',
        'DB_PATH',
        'DB_HOST',
        'DB_PORT', 
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        'DB_SSL',
        'BOT_NAME',
        'BOT_ADMIN_PHONE',
        'DEEPSEEK_API_KEY',
        'DEEPSEEK_BASE_URL',
        'ALLOWED_USERS',
        'ENABLE_AI_FEATURES',
        'ENABLE_OCR',
        'ENABLE_REMINDERS',
        'LOG_LEVEL',
        'PORT'
    ];
    
    let envContent = '# Generated .env file from Docker environment variables\n';
    envContent += `# Generated at: ${new Date().toISOString()}\n\n`;
    
    for (const varName of envVars) {
        const value = process.env[varName];
        if (value !== undefined) {
            envContent += `${varName}=${value}\n`;
        }
    }
    
    // Set defaults for Docker environment
    const defaults = {
        'NODE_ENV': process.env.NODE_ENV || 'production',
        'DATABASE_TYPE': process.env.DATABASE_TYPE || 'sqlite3',
        'DB_PATH': process.env.DB_PATH || '/app/data/financial.db',
        'BOT_NAME': process.env.BOT_NAME || 'Financial Bot',
        'DEEPSEEK_BASE_URL': process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        'ENABLE_AI_FEATURES': process.env.ENABLE_AI_FEATURES || 'true',
        'ENABLE_OCR': process.env.ENABLE_OCR || 'true',
        'ENABLE_REMINDERS': process.env.ENABLE_REMINDERS || 'true',
        'LOG_LEVEL': process.env.LOG_LEVEL || 'info',
        'PORT': process.env.PORT || '3000'
    };
    
    envContent += '\n# Docker defaults\n';
    for (const [key, value] of Object.entries(defaults)) {
        if (!process.env[key]) {
            envContent += `${key}=${value}\n`;
        }
    }
    
    try {
        fs.writeFileSync('.env', envContent);
        console.log('✅ .env file created successfully');
        console.log('📍 Environment variables loaded:');
        
        // Log non-sensitive environment variables
        const nonSensitive = ['NODE_ENV', 'DATABASE_TYPE', 'BOT_NAME', 'LOG_LEVEL', 'PORT'];
        for (const key of nonSensitive) {
            if (process.env[key]) {
                console.log(`   ${key}=${process.env[key]}`);
            }
        }
        
        // Check for required variables
        const required = ['DEEPSEEK_API_KEY', 'BOT_ADMIN_PHONE'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            console.warn('⚠️  Missing required environment variables:', missing.join(', '));
            console.warn('   Bot may not function properly without these variables');
        }
        
    } catch (error) {
        console.error('❌ Failed to create .env file:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    createEnvFromEnvironment();
}

module.exports = { createEnvFromEnvironment };