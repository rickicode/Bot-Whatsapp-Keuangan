#!/bin/bash
set -e

# Validate environment and create .env file
echo "🔧 Creating environment configuration..."
node scripts/create-env.js
if [ $? -ne 0 ]; then
    echo "❌ Environment validation failed, exiting..."
    exit 1
fi

# Start cron daemon
echo "⏰ Starting cron daemon..."
crond

# Set up signal handlers for graceful shutdown
cleanup() {
    echo "🛑 Received shutdown signal, cleaning up..."
    # Signal will be passed to the exec'd process automatically
    exit 0
}

trap cleanup SIGTERM SIGINT

# Execute the main command directly (no background process)
echo "🚀 Starting application..."
echo "📱 Application command: $@"

# Execute the command directly to ensure proper log streaming
exec "$@"