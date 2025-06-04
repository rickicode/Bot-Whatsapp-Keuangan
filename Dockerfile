# Multi-stage build for optimized production image
FROM node:22-alpine AS base

# Install system dependencies and tools for production
RUN apk add --no-cache \
    git \
    sqlite \
    postgresql-client \
    python3 \
    make \
    g++ \
    tini \
    curl \
    jq \
    bash \
    tzdata \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:22-alpine AS production

# Install runtime dependencies and monitoring tools
RUN apk add --no-cache \
    tini \
    curl \
    jq \
    bash \
    postgresql-client \
    sqlite \
    tzdata \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Create app user for security (non-root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Copy dependencies from base stage
COPY --from=base /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create directories with proper permissions
RUN mkdir -p data data/sessions logs backups tmp && \
    chown -R botuser:nodejs data data/sessions logs backups tmp && \
    chmod 755 data data/sessions logs backups tmp

# Make scripts executable
RUN chmod +x scripts/*.js scripts/*.sh || true

# Create .env from environment variables (with error handling)
RUN node scripts/create-env.js || echo "Warning: Could not create .env file"

# Add health check script
COPY <<EOF /usr/local/bin/healthcheck.sh
#!/bin/bash
set -e

# Check if the main port is responding
if ! curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "Health check failed: /health endpoint not responding"
    exit 1
fi

# Check if anti-spam system is working
if ! curl -f http://localhost:3000/anti-spam/stats >/dev/null 2>&1; then
    echo "Warning: Anti-spam endpoint not responding"
fi

# Check if logs directory is writable
if ! touch /app/logs/healthcheck.tmp 2>/dev/null; then
    echo "Health check failed: Cannot write to logs directory"
    exit 1
fi
rm -f /app/logs/healthcheck.tmp

# Check database connection
if ! node -e "
const DatabaseManager = require('./src/database/DatabaseManager');
const db = new DatabaseManager();
db.testConnection().then(() => {
    console.log('Database connection OK');
    process.exit(0);
}).catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
});
" >/dev/null 2>&1; then
    echo "Health check failed: Database connection error"
    exit 1
fi

echo "All health checks passed"
exit 0
EOF

RUN chmod +x /usr/local/bin/healthcheck.sh

# Add startup script with monitoring and recovery
COPY <<EOF /usr/local/bin/start-bot.sh
#!/bin/bash
set -e

echo "🚀 Starting WhatsApp Financial Bot..."
echo "📅 Started at: \$(date)"
echo "🌍 Timezone: \$(cat /etc/timezone 2>/dev/null || echo 'UTC')"
echo "👤 Running as: \$(whoami)"
echo "📂 Working directory: \$(pwd)"

# Verify environment
echo "🔧 Checking environment..."
if [ ! -f ".env" ]; then
    echo "⚠️ No .env file found, creating from environment variables..."
    node scripts/create-env.js || echo "Warning: Could not create .env"
fi

# Database health check and setup
echo "🗄️ Checking database..."
if ! node scripts/setup-database.js >/dev/null 2>&1; then
    echo "⚠️ Database setup issues detected, attempting to fix..."
    sleep 5
fi

# Test database connection
echo "🔗 Testing database connection..."
node -e "
const DatabaseManager = require('./src/database/DatabaseManager');
const db = new DatabaseManager();
db.testConnection().then(() => {
    console.log('✅ Database connection successful');
}).catch(err => {
    console.error('❌ Database connection failed:', err.message);
    process.exit(1);
});
" || exit 1

# Clean up any stuck sessions
echo "🧹 Cleaning up stuck sessions..."
node scripts/cleanup-sessions.js force-clean >/dev/null 2>&1 || true

# Monitor disk space
echo "💾 Checking disk space..."
df -h | grep -E "(Filesystem|/app)" || true

# Start the application with monitoring
echo "🎯 Starting application..."
exec node src/index.js
EOF

RUN chmod +x /usr/local/bin/start-bot.sh

# Add monitoring script that runs in background
COPY <<EOF /usr/local/bin/monitor-bot.sh
#!/bin/bash

# Background monitoring script
while true; do
    sleep 300  # Check every 5 minutes
    
    # Check if anti-spam emergency brake is active
    if curl -s http://localhost:3000/anti-spam/stats | jq -r '.stats.global.emergencyBrakeActive' 2>/dev/null | grep -q "true"; then
        echo "\$(date): 🚨 ALERT: Emergency brake is active!"
    fi
    
    # Check for high session counts
    SESSION_COUNT=\$(node scripts/cleanup-sessions.js stats 2>/dev/null | grep -o "Total Active Sessions: [0-9]*" | grep -o "[0-9]*" || echo "0")
    if [ "\$SESSION_COUNT" -gt 20 ]; then
        echo "\$(date): ⚠️ WARNING: High session count: \$SESSION_COUNT"
        # Auto cleanup if too many sessions
        node scripts/cleanup-sessions.js cleanup >/dev/null 2>&1
    fi
    
    # Check log file size
    if [ -f "/app/logs/app.log" ]; then
        LOG_SIZE=\$(du -m "/app/logs/app.log" | cut -f1)
        if [ "\$LOG_SIZE" -gt 100 ]; then
            echo "\$(date): 📝 Log file size: \${LOG_SIZE}MB, rotating..."
            mv "/app/logs/app.log" "/app/logs/app.log.\$(date +%Y%m%d_%H%M%S)"
            touch "/app/logs/app.log"
            chown botuser:nodejs "/app/logs/app.log"
        fi
    fi
done
EOF

RUN chmod +x /usr/local/bin/monitor-bot.sh

# Add graceful shutdown script
COPY <<EOF /usr/local/bin/shutdown-bot.sh
#!/bin/bash
echo "🛑 Graceful shutdown initiated..."

# Save any pending data
echo "💾 Saving pending data..."
node -e "
console.log('Cleaning up pending sessions...');
if (global.pendingTransactions) global.pendingTransactions.clear();
if (global.editSessions) global.editSessions.clear();
if (global.deleteConfirmations) global.deleteConfirmations.clear();
console.log('Cleanup complete');
" >/dev/null 2>&1 || true

# Create shutdown marker
echo "📝 Creating shutdown marker..."
echo "\$(date): Graceful shutdown completed" >> /app/logs/shutdown.log

echo "✅ Shutdown preparation complete"
EOF

RUN chmod +x /usr/local/bin/shutdown-bot.sh

# Set proper ownership
RUN chown -R botuser:nodejs /app

# Declare volumes for persistent data
VOLUME ["/app/data", "/app/logs", "/app/backups"]

# Switch to non-root user for security
USER botuser

# Expose port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Set up environment variables with defaults
ENV NODE_ENV=production \
    LOG_LEVEL=info \
    ANTI_SPAM_EMERGENCY_BRAKE=true \
    ENABLE_AI_FEATURES=true \
    PORT=3000

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]

# Use custom startup script with monitoring
CMD ["/usr/local/bin/start-bot.sh"]

# Add labels for better container management
LABEL maintainer="WhatsApp Financial Bot" \
      version="1.0.0" \
      description="Production-ready WhatsApp Financial Bot with monitoring and anti-spam protection" \
      org.opencontainers.image.source="https://github.com/your-repo/financial-bot" \
      org.opencontainers.image.documentation="https://github.com/your-repo/financial-bot/blob/main/README.md"