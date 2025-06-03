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

# Check if .env exists
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

# Load environment variables
source .env 2>/dev/null || true

# Run setup
echo "🔧 Running application setup..."
if npm run setup; then
    echo "✅ Application setup completed"
else
    echo "❌ Application setup failed"
    exit 1
fi

# Setup database
echo "🗄️  Setting up database..."
if npm run setup-db; then
    echo "✅ Database setup completed"
else
    echo "❌ Database setup failed"
    exit 1
fi

# Check database connection
echo "🔍 Testing database connection..."
node -e "
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
"

# Start the bot
echo "🤖 Starting WhatsApp Bot..."
exec npm start