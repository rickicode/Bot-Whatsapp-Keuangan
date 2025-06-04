#!/bin/bash

# Script to create .env file from Docker environment variables
# This script reads environment variables and creates a .env file for the application

ENV_FILE="/app/.env"

echo "🔧 Creating .env file from Docker environment variables..."
echo "📅 Generated at: $(date)"

# Create .env file with environment variables
cat > "$ENV_FILE" << EOF
# Auto-generated .env file from Docker environment
# Generated at: $(date)

# ================================
# BOT CONFIGURATION
# ================================
BOT_NAME=${BOT_NAME:-Bot Keuangan Pribadi}
BOT_ADMIN_PHONE=${BOT_ADMIN_PHONE:-+6281234567890}

# ================================
# AI CONFIGURATION
# ================================
AI_PROVIDER=${AI_PROVIDER:-deepseek}
DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}
DEEPSEEK_MODEL=${DEEPSEEK_MODEL:-deepseek-chat}

# Alternative AI providers
OPENAI_API_KEY=${OPENAI_API_KEY}
GROQ_API_KEY=${GROQ_API_KEY}
GOOGLE_API_KEY=${GOOGLE_API_KEY}

# ================================
# DATABASE CONFIGURATION (SUPABASE)
# ================================
DATABASE_TYPE=${DATABASE_TYPE:-postgres}
DATABASE_HOST=${DATABASE_HOST}
DATABASE_PORT=${DATABASE_PORT:-5432}
DATABASE_NAME=${DATABASE_NAME:-postgres}
DATABASE_USER=${DATABASE_USER:-postgres}
DATABASE_PASSWORD=${DATABASE_PASSWORD}
DATABASE_SSL=${DATABASE_SSL:-true}

# SQLite fallback
DB_PATH=${DB_PATH:-/app/data/financial.db}

# ================================
# APPLICATION SETTINGS
# ================================
NODE_ENV=${NODE_ENV:-production}
LOG_LEVEL=${LOG_LEVEL:-info}
PORT=${PORT:-3000}

# ================================
# ANTI-SPAM CONFIGURATION
# ================================
ANTI_SPAM_USER_PER_MINUTE=${ANTI_SPAM_USER_PER_MINUTE:-15}
ANTI_SPAM_GLOBAL_PER_MINUTE=${ANTI_SPAM_GLOBAL_PER_MINUTE:-75}
ANTI_SPAM_EMERGENCY_BRAKE=${ANTI_SPAM_EMERGENCY_BRAKE:-true}
ANTI_SPAM_EMERGENCY_THRESHOLD=${ANTI_SPAM_EMERGENCY_THRESHOLD:-90}

# ================================
# FEATURE FLAGS
# ================================
ENABLE_AI_FEATURES=${ENABLE_AI_FEATURES:-true}
ENABLE_OCR=${ENABLE_OCR:-true}
ENABLE_REMINDERS=${ENABLE_REMINDERS:-true}
ASK_CATEGORY_IF_UNKNOWN=${ASK_CATEGORY_IF_UNKNOWN:-true}

# ================================
# TIMEZONE & LOCALIZATION
# ================================
TZ=${TZ:-Asia/Jakarta}
LOCALE=${LOCALE:-id-ID}

# ================================
# PERFORMANCE OPTIMIZATION
# ================================
NODE_OPTIONS=${NODE_OPTIONS:---max-old-space-size=384}
NPM_CONFIG_FUND=${NPM_CONFIG_FUND:-false}
NPM_CONFIG_AUDIT=${NPM_CONFIG_AUDIT:-false}

# ================================
# BACKUP CONFIGURATION
# ================================
BACKUP_ENABLED=${BACKUP_ENABLED:-true}
BACKUP_INTERVAL_HOURS=${BACKUP_INTERVAL_HOURS:-24}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-7}

# ================================
# WEBHOOK & EXTERNAL SERVICES
# ================================
WEBHOOK_URL=${WEBHOOK_URL}
WEBHOOK_SECRET=${WEBHOOK_SECRET}

# ================================
# MONITORING & LOGGING
# ================================
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-60}
LOG_ROTATION_SIZE=${LOG_ROTATION_SIZE:-50M}
LOG_RETENTION_DAYS=${LOG_RETENTION_DAYS:-7}

# ================================
# SECURITY SETTINGS
# ================================
SESSION_SECRET=${SESSION_SECRET:-$(openssl rand -hex 32)}
ENCRYPTION_KEY=${ENCRYPTION_KEY:-$(openssl rand -hex 32)}

# ================================
# EASYPANEL SPECIFIC
# ================================
CONTAINER_NAME=${CONTAINER_NAME:-whatsapp-bot-easypanel}
DEPLOYMENT_ENV=${DEPLOYMENT_ENV:-easypanel}
EOF

# Set proper permissions
chmod 600 "$ENV_FILE"
chown botuser:nodejs "$ENV_FILE" 2>/dev/null || true

echo "✅ .env file created successfully at: $ENV_FILE"
echo "📊 Configuration summary:"
echo "   - Database Type: ${DATABASE_TYPE:-postgres}"
echo "   - Database Host: ${DATABASE_HOST:-not-set}"
echo "   - AI Provider: ${AI_PROVIDER:-deepseek}"
echo "   - Node Environment: ${NODE_ENV:-production}"
echo "   - Anti-spam enabled: ${ANTI_SPAM_EMERGENCY_BRAKE:-true}"
echo "   - AI Features: ${ENABLE_AI_FEATURES:-true}"

# Validate critical environment variables
echo ""
echo "🔍 Validating critical environment variables..."

if [ -z "$DATABASE_HOST" ] && [ -z "$DATABASE_PASSWORD" ]; then
    echo "⚠️  WARNING: DATABASE_HOST and DATABASE_PASSWORD not set!"
    echo "   The bot will try to use SQLite fallback."
fi

if [ -z "$DEEPSEEK_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  WARNING: No AI API keys set!"
    echo "   AI features may not work properly."
fi

if [ -z "$BOT_ADMIN_PHONE" ]; then
    echo "⚠️  WARNING: BOT_ADMIN_PHONE not set!"
    echo "   Admin features may not work."
fi

echo ""
echo "🚀 Environment file ready for EasyPanel deployment!"