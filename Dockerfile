# WhatsApp Financial Bot Dockerfile
# Multi-stage build for optimized production image

FROM node:20-bullseye-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN useradd --create-home --shell /bin/bash botuser

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p \
    /app/data \
    /app/data/sessions \
    /app/logs \
    /app/backups \
    && chown -R botuser:botuser /app

# Create health check script
RUN echo '#!/bin/bash\n\
curl -f http://localhost:${PORT:-3000}/health > /dev/null 2>&1\n\
exit $?' > /usr/local/bin/healthcheck.sh && \
    chmod +x /usr/local/bin/healthcheck.sh

# Switch to non-root user
USER botuser

# Set environment variables
ENV NODE_ENV=production
ENV TZ=Asia/Jakarta
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=60s --timeout=30s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Create entrypoint script
COPY <<'EOF' /app/entrypoint.sh
#!/bin/bash
set -e

echo "🔧 Setting up environment..."

# Run create-env.js to generate .env file from environment variables
echo "📝 Creating .env file from environment variables..."
node scripts/create-env.js

# Check if .env was created successfully
if [ -f .env ]; then
    echo "✅ .env file created successfully"
    echo "🔍 Environment validation:"
    # Show non-sensitive env vars for debugging
    echo "   NODE_ENV: ${NODE_ENV:-not set}"
    echo "   DATABASE_TYPE: ${DATABASE_TYPE:-not set}"
    echo "   AI_PROVIDER: ${AI_PROVIDER:-not set}"
    echo "   PORT: ${PORT:-not set}"
else
    echo "❌ Failed to create .env file"
    exit 1
fi

echo "🚀 Starting WhatsApp Financial Bot..."

# Function to cleanup on exit
cleanup() {
    echo "🛑 Shutting down gracefully..."
    if [ ! -z "$MAIN_PID" ]; then
        kill -TERM "$MAIN_PID" 2>/dev/null || true
        wait "$MAIN_PID" 2>/dev/null || true
    fi
    if [ ! -z "$ANTISPAM_PID" ]; then
        kill -TERM "$ANTISPAM_PID" 2>/dev/null || true
    fi
    if [ ! -z "$CLEANUP_PID" ]; then
        kill -TERM "$CLEANUP_PID" 2>/dev/null || true
    fi
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Start the main application in background
node src/index.js &
MAIN_PID=$!

# Start anti-spam monitor in background
(
    while true; do
        sleep 300  # 5 minutes
        echo "🛡️ Running anti-spam monitor..."
        node scripts/anti-spam-monitor.js monitor 2>&1 | sed 's/^/[ANTISPAM] /'
    done
) &
ANTISPAM_PID=$!

# Start session cleanup in background
(
    while true; do
        sleep 600  # 10 minutes
        echo "🧹 Running session cleanup..."
        node scripts/cleanup-sessions.js cleanup 2>&1 | sed 's/^/[CLEANUP] /'
    done
) &
CLEANUP_PID=$!

echo "✅ All services started"
echo "   Main app PID: $MAIN_PID"
echo "   Anti-spam monitor PID: $ANTISPAM_PID"
echo "   Session cleanup PID: $CLEANUP_PID"

# Wait for main process
wait $MAIN_PID
EXIT_CODE=$?

echo "🏁 Main application exited with code $EXIT_CODE"
cleanup
exit $EXIT_CODE
EOF

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Use dumb-init as entrypoint for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/entrypoint.sh"]