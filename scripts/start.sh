#!/bin/bash

# WhatsApp Financial Bot Startup Script
# This script ensures proper initialization before starting the bot

set -e

echo "🚀 Starting WhatsApp Financial Bot..."

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data logs backups
echo "✅ Directories created"

# Check if running in Docker (environment variables will be provided)
if [ "$NODE_ENV" = "production" ] && [ -n "$DATABASE_TYPE" ]; then
    echo "✅ Running in Docker production mode"
    echo "📍 Database type: $DATABASE_TYPE"
    
    # Wait for database if using PostgreSQL
    if [ "$DATABASE_TYPE" = "postgresql" ]; then
        echo "⏳ Waiting for PostgreSQL to be ready..."
        max_attempts=30
        attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
                echo "✅ PostgreSQL is ready!"
                break
            fi
            
            echo "⏳ Attempt $attempt/$max_attempts: Waiting for PostgreSQL..."
            sleep 2
            attempt=$((attempt + 1))
        done
        
        if [ $attempt -gt $max_attempts ]; then
            echo "❌ PostgreSQL connection timeout"
            exit 1
        fi
    fi
else
    # Check if .env exists for local development
    if [ ! -f .env ]; then
        echo "⚠️  .env file not found. Copying from .env.example..."
        if [ -f .env.example ]; then
            cp .env.example .env
            echo "✅ .env file created from example"
            echo "🔧 Please edit .env file with your configuration before continuing"
            exit 1
        else
            echo "❌ .env.example not found. Please create .env file manually."
            exit 1
        fi
    fi

    echo "✅ Environment configuration found"
    # Load environment variables for local development
    set -a
    source .env 2>/dev/null || true
    set +a
fi

# Run setup
echo "🔧 Running application setup..."
if npm run setup; then
    echo "✅ Application setup completed"
else
    echo "⚠️  Application setup had issues, continuing..."
fi

# Setup database
echo "🗄️  Setting up database..."
if npm run setup-db; then
    echo "✅ Database setup completed"
else
    echo "⚠️  Database setup had issues, continuing..."
fi

# Check database connection with timeout
echo "🔍 Testing database connection..."
timeout 30s node -e "
const DatabaseFactory = require('./src/database/DatabaseFactory');
(async () => {
    try {
        const db = DatabaseFactory.create();
        await db.initialize();
        console.log('✅ Database connection successful');
        await db.close();
    } catch (error) {
        console.log('❌ Database connection failed:', error.message);
        process.exit(1);
    }
})();
" || {
    echo "⚠️  Database connection test timeout, starting bot anyway..."
}

# Start the bot
echo "🤖 Starting WhatsApp Bot..."
exec npm start