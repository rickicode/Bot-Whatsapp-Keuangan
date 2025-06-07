#!/bin/bash
set -e

# Validate environment and create .env file
echo "🔧 Creating environment configuration..." >&2
node scripts/create-env.js
if [ $? -ne 0 ]; then
    echo "❌ Environment validation failed, exiting..." >&2
    exit 1
fi

# Set up signal handlers for graceful shutdown
cleanup() {
    echo "🛑 Received shutdown signal, cleaning up..." >&2
    # Application handles cleanup internally
    exit 0
}

trap cleanup SIGTERM SIGINT

# Execute the main command directly
echo "🚀 Starting application..." >&2
echo "📱 Application command: $@" >&2

# Execute the command directly to ensure proper log streaming
# Application handles all cleanup and monitoring internally
exec "$@"
