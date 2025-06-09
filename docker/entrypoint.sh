#!/bin/bash
set -e

# Create necessary directories
echo "📁 Setting up directories..." >&2
mkdir -p /app/temp/audio /app/data /app/logs /app/exports
chmod 755 /app/temp /app/temp/audio /app/data /app/logs /app/exports

# Validate environment and create .env file
echo "🔧 Creating environment configuration..." >&2
node scripts/create-env.js
if [ $? -ne 0 ]; then
    echo "❌ Environment validation failed, exiting..." >&2
    exit 1
fi

# Check TTS configuration
if [ "$ELEVENLABS_TTS_ENABLED" = "true" ]; then
    echo "🗣️ TTS (Text-to-Speech) enabled with ElevenLabs" >&2
    echo "🎵 Audio files will be stored in: /app/temp/audio" >&2
    if [ -z "$ELEVENLABS_API_KEY" ]; then
        echo "⚠️ Warning: ELEVENLABS_API_KEY not set, TTS will not work" >&2
    fi
else
    echo "📝 TTS disabled, using text responses only" >&2
fi

# Check AI Curhat configuration
if [ "$AI_CURHAT_ENABLED" = "true" ]; then
    echo "💬 AI Curhat mode enabled with provider: ${AI_CURHAT_PROVIDER:-openrouter}" >&2
else
    echo "🤖 AI Curhat mode disabled" >&2
fi

# Check Redis configuration
if [ "$REDIS_ENABLED" = "true" ]; then
    echo "🔄 Redis enabled for session management" >&2
    if [ -n "$REDIS_URL" ] && [ "$REDIS_URL" != "redis://localhost:6379" ]; then
        echo "🌐 Using Redis URL: ${REDIS_URL}" >&2
    elif [ -n "$REDIS_HOST" ] && [ "$REDIS_HOST" != "localhost" ]; then
        echo "🌐 Using Redis host: ${REDIS_HOST}:${REDIS_PORT:-6379}" >&2
    else
        echo "🏠 Using Redis localhost default configuration" >&2
    fi
else
    echo "🗄️ Redis disabled, using PostgreSQL for sessions" >&2
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
