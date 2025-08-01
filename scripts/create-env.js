#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of environment variables that the application uses (based on .env.example)
const ENV_VARIABLES = [
    // Bot Configuration
    'BOT_NAME',
    'BOT_ADMIN_PHONE',
    
    // AI Configuration
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
    'GROQ_API_KEY',
    'GOOGLE_API_KEY',
    
    // OpenRouter Configuration
    'OPENROUTER_API_KEY',
    'OPENROUTER_BASE_URL',
    'OPENROUTER_MODEL',
    
    // AI Fallback Configuration
    'AI_FALLBACK_ORDER',
    
    // AI Curhat Mode Configuration
    'AI_CURHAT_ENABLED',
    'AI_CURHAT_PROVIDER',
    'AI_CURHAT_MODEL',
    
    // TTS Configuration (ElevenLabs)
    'ELEVENLABS_TTS_ENABLED',
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_VOICE_ID',
    'ELEVENLABS_BASE_URL',
    'ELEVENLABS_MODEL',
    'ELEVENLABS_LANGUAGE_ID',
    
    // Redis Configuration for Session Management
    'REDIS_ENABLED',
    'REDIS_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_PASSWORD',
    'REDIS_USERNAME',
    'REDIS_DATABASE',
    'REDIS_CONNECT_TIMEOUT',
    
    // Database Configuration
    'DATABASE_TYPE',
    'DB_PATH',
    'BACKUP_PATH',
    'DATABASE_HOST',
    'DATABASE_PORT',
    'DATABASE_NAME',
    'DATABASE_USER',
    'DATABASE_PASSWORD',
    'DATABASE_SSL',
    'SUPABASE_DB_URL',
    
    // Database Pool Configuration
    'DB_POOL_MAX',
    'DB_POOL_MIN',
    'DB_IDLE_TIMEOUT',
    'DB_CONNECTION_TIMEOUT',
    'DB_ACQUIRE_TIMEOUT',
    'DB_CREATE_TIMEOUT',
    'DB_DESTROY_TIMEOUT',
    'DB_REAP_INTERVAL',
    'DB_CREATE_RETRY_INTERVAL',
    'DB_STATEMENT_TIMEOUT',
    'DB_QUERY_TIMEOUT',
    'DEBUG_POOL',
    
    // Server Configuration
    'PORT',
    'NODE_ENV',
    'BASE_URL',
    
    // Security
    'ENCRYPTION_KEY',
    'USER_ADMIN',
    'SESSION_SECRET',
    
    // Language & Currency
    'DEFAULT_LANGUAGE',
    'DEFAULT_CURRENCY',
    'CURRENCY_SYMBOL',
    
    // Features
    'WHATSAPP_SESSION_STORAGE',
    'ENABLE_AI_FEATURES',
    'ENABLE_OCR',
    'ENABLE_REMINDERS',
    'ASK_CATEGORY_IF_UNKNOWN',
    
    // Anti-Spam & Rate Limiting
    'ANTI_SPAM_USER_PER_MINUTE',
    'ANTI_SPAM_USER_PER_HOUR',
    'ANTI_SPAM_MAX_DUPLICATES',
    'ANTI_SPAM_GLOBAL_PER_MINUTE',
    'ANTI_SPAM_GLOBAL_PER_HOUR',
    'ANTI_SPAM_DUPLICATE_WINDOW',
    'ANTI_SPAM_RAPID_FIRE',
    'ANTI_SPAM_RAPID_FIRE_WINDOW',
    'ANTI_SPAM_USER_COOLDOWN',
    'ANTI_SPAM_GLOBAL_COOLDOWN',
    'ANTI_SPAM_EMERGENCY_BRAKE',
    'ANTI_SPAM_EMERGENCY_THRESHOLD',
    
    // Logging
    'LOG_LEVEL',
    'LOG_FILE',
    
    // System & Docker
    'TZ',
    'LOCALE',
    'BACKUP_ENABLED',
    'BACKUP_INTERVAL_HOURS',
    'BACKUP_RETENTION_DAYS',
    'HEALTH_CHECK_INTERVAL',
    'LOG_ROTATION_SIZE',
    'LOG_RETENTION_DAYS',
    'CONTAINER_NAME',
    'DEPLOYMENT_ENV',
    'WEBHOOK_URL',
    'WEBHOOK_SECRET'
];

// Default values for missing environment variables (based on .env.example)
const DEFAULT_VALUES = {
    // Bot Configuration
    'BOT_NAME': 'Bot Keuangan Pribadi',
    'BOT_ADMIN_PHONE': '+62812345678900',
    
    // AI Configuration
    'AI_PROVIDER': 'deepseek',
    'DEEPSEEK_API_KEY': 'your_deepseek_api_key_here',
    'DEEPSEEK_BASE_URL': 'https://api.deepseek.com',
    'DEEPSEEK_MODEL': 'deepseek-chat',
    'OPENAI_API_KEY': 'your_openai_api_key_here',
    'OPENAI_BASE_URL': 'https://api.openai.com',
    'OPENAI_MODEL': 'gpt-3.5-turbo',
    'OPENAI_COMPATIBLE_API_KEY': 'your_provider_api_key_here',
    'OPENAI_COMPATIBLE_BASE_URL': 'https://api.your-provider.com',
    'OPENAI_COMPATIBLE_MODEL': 'your_model_name',
    
    // OpenRouter Configuration
    'OPENROUTER_API_KEY': 'your_openrouter_api_key_here',
    'OPENROUTER_BASE_URL': 'https://openrouter.ai/api',
    'OPENROUTER_MODEL': 'deepseek/deepseek-chat-v3-0324:free',
    
    // AI Fallback Configuration
    'AI_FALLBACK_ORDER': 'openrouter,deepseek,openai,groq',
    
    // AI Curhat Mode Configuration
    'AI_CURHAT_ENABLED': 'true',
    'AI_CURHAT_PROVIDER': 'openrouter',
    'AI_CURHAT_MODEL': 'deepseek/deepseek-chat-v3-0324:free',
    
    // TTS Configuration (ElevenLabs)
    'ELEVENLABS_TTS_ENABLED': 'false',
    'ELEVENLABS_API_KEY': 'your_elevenlabs_api_key_here',
    'ELEVENLABS_VOICE_ID': 'pNInz6obpgDQGcFmaJgB',
    'ELEVENLABS_BASE_URL': 'https://api.elevenlabs.io/v1',
    'ELEVENLABS_MODEL': 'eleven_multilingual_v2',
    'ELEVENLABS_LANGUAGE_ID': 'id',
    
    // Redis Configuration for Session Management
    'REDIS_ENABLED': 'true',
    'REDIS_URL': 'redis://localhost:6379',
    'REDIS_HOST': 'localhost',
    'REDIS_PORT': '6379',
    'REDIS_PASSWORD': '',
    'REDIS_USERNAME': '',
    'REDIS_DATABASE': '0',
    'REDIS_CONNECT_TIMEOUT': '5000',
    
    // Database Configuration (PostgreSQL default)
    'DATABASE_TYPE': 'postgres',
    'DATABASE_HOST': 'localhost',
    'DATABASE_PORT': '5432',
    'DATABASE_NAME': 'financial_bot',
    'DATABASE_USER': 'postgres',
    'DATABASE_PASSWORD': 'your_password_here',
    'DATABASE_SSL': 'false',
    'BACKUP_PATH': '/app/backups',
    
    // Database Pool Configuration
    'DB_POOL_MAX': '25',
    'DB_POOL_MIN': '5',
    'DB_IDLE_TIMEOUT': '30000',
    'DB_CONNECTION_TIMEOUT': '5000',
    'DB_ACQUIRE_TIMEOUT': '10000',
    'DB_CREATE_TIMEOUT': '5000',
    'DB_DESTROY_TIMEOUT': '5000',
    'DB_REAP_INTERVAL': '1000',
    'DB_CREATE_RETRY_INTERVAL': '200',
    'DB_STATEMENT_TIMEOUT': '30000',
    'DB_QUERY_TIMEOUT': '30000',
    'DEBUG_POOL': 'false',
    
    // Server Configuration
    'PORT': '3000',
    'NODE_ENV': 'production',
    'BASE_URL': 'http://localhost:3000',
    
    // Security
    'ENCRYPTION_KEY': 'your_32_character_encryption_key_here',
    'USER_ADMIN': '+62812345678900',
    
    // Language & Currency
    'DEFAULT_LANGUAGE': 'id',
    'DEFAULT_CURRENCY': 'IDR',
    'CURRENCY_SYMBOL': 'Rp',
    
    // Features
    'WHATSAPP_SESSION_STORAGE': 'database',
    'ENABLE_AI_FEATURES': 'true',
    'ENABLE_OCR': 'true',
    'ENABLE_REMINDERS': 'true',
    'ASK_CATEGORY_IF_UNKNOWN': 'true',
    
    // Anti-Spam & Rate Limiting
    'ANTI_SPAM_USER_PER_MINUTE': '10',
    'ANTI_SPAM_USER_PER_HOUR': '100',
    'ANTI_SPAM_MAX_DUPLICATES': '3',
    'ANTI_SPAM_GLOBAL_PER_MINUTE': '50',
    'ANTI_SPAM_GLOBAL_PER_HOUR': '1000',
    'ANTI_SPAM_DUPLICATE_WINDOW': '60000',
    'ANTI_SPAM_RAPID_FIRE': '5',
    'ANTI_SPAM_RAPID_FIRE_WINDOW': '10000',
    'ANTI_SPAM_USER_COOLDOWN': '5',
    'ANTI_SPAM_GLOBAL_COOLDOWN': '2',
    'ANTI_SPAM_EMERGENCY_BRAKE': 'true',
    'ANTI_SPAM_EMERGENCY_THRESHOLD': '100',
    
    // Logging
    'LOG_LEVEL': 'info',
    'LOG_FILE': '/app/logs/app.log',
    
    // System & Docker
    'TZ': 'Asia/Jakarta',
    'LOCALE': 'id-ID',
    'BACKUP_ENABLED': 'true',
    'BACKUP_INTERVAL_HOURS': '24',
    'BACKUP_RETENTION_DAYS': '7',
    'HEALTH_CHECK_INTERVAL': '60',
    'LOG_ROTATION_SIZE': '50M',
    'LOG_RETENTION_DAYS': '7',
    'CONTAINER_NAME': 'whatsapp-bot',
    'DEPLOYMENT_ENV': 'docker'
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
    const additionalPrefixes = ['BOT_', 'DB_', 'DATABASE_', 'AI_', 'DEEPSEEK_', 'OPENAI_', 'OPENROUTER_', 'GROQ_', 'GOOGLE_', 'ELEVENLABS_', 'REDIS_', 'ANTI_SPAM_', 'WEBHOOK_', 'BACKUP_', 'LOG_', 'HEALTH_'];
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
        const critical = ['BOT_ADMIN_PHONE', 'DEEPSEEK_API_KEY'];
        const missing = critical.filter(key => !process.env[key] && !DEFAULT_VALUES[key]);
        
        if (missing.length > 0) {
            console.warn('⚠️  Missing critical environment variables:', missing.join(', '));
            console.warn('   Bot may not function properly without these variables');
            console.warn('   Please set these variables in your Docker environment or .env file');
        }
        
        // Additional validation for AI providers
        const hasAnyAIKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GROQ_API_KEY || process.env.GOOGLE_API_KEY;
        if (!hasAnyAIKey) {
            console.warn('⚠️  No AI API keys detected!');
            console.warn('   Please set at least one of: DEEPSEEK_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, GROQ_API_KEY, GOOGLE_API_KEY');
        }
        
        // TTS validation
        const ttsEnabled = process.env.ELEVENLABS_TTS_ENABLED === 'true';
        if (ttsEnabled) {
            if (!process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY === 'your_elevenlabs_api_key_here') {
                console.warn('⚠️  TTS is enabled but ELEVENLABS_API_KEY is missing or using placeholder value');
                console.warn('   Get your API key from: https://elevenlabs.io/');
            } else {
                console.log('✅ TTS (Text-to-Speech) configuration detected');
            }
        }
        
        // AI Curhat validation
        const curhatEnabled = process.env.AI_CURHAT_ENABLED === 'true';
        if (curhatEnabled) {
            const curhatProvider = process.env.AI_CURHAT_PROVIDER || 'openrouter';
            console.log(`✅ AI Curhat mode enabled with provider: ${curhatProvider}`);
            
            if (curhatProvider === 'openrouter' && (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY === 'your_openrouter_api_key_here')) {
                console.warn('⚠️  AI Curhat uses OpenRouter but OPENROUTER_API_KEY is missing or using placeholder value');
                console.warn('   Get your API key from: https://openrouter.ai/');
            }
        }
        
        // Redis validation
        const redisEnabled = process.env.REDIS_ENABLED === 'true';
        if (redisEnabled) {
            const hasRedisUrl = process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379';
            const hasRedisHost = process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost';
            
            if (hasRedisUrl || hasRedisHost) {
                console.log('✅ Redis configuration detected for session management');
            } else {
                console.log('ℹ️  Redis enabled with localhost default configuration');
                console.log('   For production, consider setting REDIS_URL or REDIS_HOST');
            }
        } else {
            console.log('ℹ️  Redis disabled, using PostgreSQL for session storage');
        }
        
        // Database validation
        const dbType = process.env.DATABASE_TYPE || DEFAULT_VALUES.DATABASE_TYPE;
        if (dbType === 'postgres' || dbType === 'postgresql') {
            const dbRequiredVars = ['DATABASE_HOST', 'DATABASE_PASSWORD', 'DATABASE_NAME', 'DATABASE_USER'];
            const dbMissing = dbRequiredVars.filter(key => !process.env[key] && !DEFAULT_VALUES[key]);
            if (dbMissing.length > 0) {
                console.warn('⚠️  PostgreSQL database configuration incomplete:');
                console.warn('   Missing:', dbMissing.join(', '));
                console.warn('   Please provide PostgreSQL configuration or use Supabase URL');
            }
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