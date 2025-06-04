#!/bin/bash
set -e

# Startup script for EasyPanel deployment

echo "🚀 Starting WhatsApp Bot for EasyPanel..."
echo "📅 Started at: $(date)"
echo "🐧 Base: Alpine Linux with supervisord"
echo "👤 Running as: Multi-user (supervisord + botuser)"

# Environment check
echo "🔧 Checking environment..."
if [ ! -f ".env" ]; then
    echo "⚠️ No .env file found, creating from environment variables..."
    node scripts/create-env.js || echo "Warning: Could not create .env"
fi

# Note: Using Supabase - no local database test needed
echo "🗄️ Database: Supabase (external)"

# Check disk space
echo "💾 Checking disk space..."
df -h | head -2 || true

# Start supervisord which will manage all services
echo "🎯 Starting supervisord with all services..."
echo "Services that will be started:"
echo "  - WhatsApp Bot (main application)"
echo "  - Anti-spam Monitor (every 5 minutes)"  
echo "  - Session Cleanup (every 10 minutes)"
echo "  - Health Monitor (every 5 minutes)"
echo "  - Log Rotator (every 2 hours)"
echo ""
echo "📋 All logs will be displayed in Docker logs"

exec supervisord -c /etc/supervisord.conf