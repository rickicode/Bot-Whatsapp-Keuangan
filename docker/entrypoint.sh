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
    if [ ! -z "$APP_PID" ]; then
        kill -TERM "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGTERM SIGINT

# Execute the main command in background and wait
echo "🚀 Starting application..."
"$@" &
APP_PID=$!
echo "📱 Application started with PID: $APP_PID"

# Wait for the application process
wait "$APP_PID"
APP_EXIT_CODE=$?

# Log exit information
echo "🏁 Application exited with code: $APP_EXIT_CODE"
exit $APP_EXIT_CODE