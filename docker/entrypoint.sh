#!/bin/bash
set -e

# Validate environment and create .env file
echo "🔧 Creating environment configuration..." >&2
node scripts/create-env.js
if [ $? -ne 0 ]; then
    echo "❌ Environment validation failed, exiting..." >&2
    exit 1
fi

# Start cron daemon (silently to avoid log pollution)
echo "⏰ Starting cron daemon..." >&2
crond > /dev/null 2>&1

# Set up signal handlers for graceful shutdown
cleanup() {
    echo "🛑 Received shutdown signal, cleaning up..." >&2
    # Kill cron daemon
    killall crond > /dev/null 2>&1 || true
    exit 0
}

trap cleanup SIGTERM SIGINT

# Execute the main command directly (no background process)
echo "🚀 Starting application..." >&2
echo "📱 Application command: $@" >&2

# Execute the command directly to ensure proper log streaming
# Only the main application should log to stdout
exec "$@"
