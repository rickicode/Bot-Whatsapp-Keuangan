# Multi-stage build for WhatsApp Financial Management Bot
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine

# Install cron and other necessary packages
RUN apk add --no-cache \
    dcron \
    tzdata \
    bash \
    && rm -rf /var/cache/apk/*

# Set timezone (optional, adjust as needed)
ENV TZ=Asia/Jakarta

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy node modules from builder stage
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules

# Copy application code
COPY --chown=appuser:nodejs . .

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/backups /app/exports && \
    chown -R appuser:nodejs /app/data /app/logs /app/backups /app/exports

# Create cron job files
RUN echo "# Session cleanup every 5 minutes" > /etc/cron.d/session-cleanup && \
    echo "*/5 * * * * appuser cd /app && /usr/local/bin/node scripts/cleanup-sessions.js cleanup >> /app/logs/cron-cleanup.log 2>&1" >> /etc/cron.d/session-cleanup && \
    echo "" >> /etc/cron.d/session-cleanup

RUN echo "# Anti-spam monitoring every 2 minutes" > /etc/cron.d/anti-spam && \
    echo "*/2 * * * * appuser cd /app && /usr/local/bin/node scripts/anti-spam-monitor.js stats >> /app/logs/cron-antispam.log 2>&1" >> /etc/cron.d/anti-spam && \
    echo "" >> /etc/cron.d/anti-spam

# Set proper permissions for cron files
RUN chmod 0644 /etc/cron.d/session-cleanup && \
    chmod 0644 /etc/cron.d/anti-spam && \
    crontab -u appuser /etc/cron.d/session-cleanup && \
    crontab -u appuser /etc/cron.d/anti-spam

# Create startup script (runs as appuser)
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start cron service' >> /app/start.sh && \
    echo 'crond -f &' >> /app/start.sh && \
    echo 'CRON_PID=$!' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Function to handle shutdown' >> /app/start.sh && \
    echo 'cleanup() {' >> /app/start.sh && \
    echo '    echo "Shutting down services..."' >> /app/start.sh && \
    echo '    kill $CRON_PID 2>/dev/null || true' >> /app/start.sh && \
    echo '    kill $NODE_PID 2>/dev/null || true' >> /app/start.sh && \
    echo '    exit 0' >> /app/start.sh && \
    echo '}' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Set up signal handlers' >> /app/start.sh && \
    echo 'trap cleanup SIGTERM SIGINT' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Wait a moment for cron to start' >> /app/start.sh && \
    echo 'sleep 2' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start the main application' >> /app/start.sh && \
    echo 'echo "🚀 Starting WhatsApp Financial Bot..."' >> /app/start.sh && \
    echo 'node src/index.js &' >> /app/start.sh && \
    echo 'NODE_PID=$!' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Wait for any background process to exit' >> /app/start.sh && \
    echo 'wait $NODE_PID' >> /app/start.sh && \
    chmod +x /app/start.sh

# Create the .env validation script that runs as root, then switches user
RUN echo '#!/bin/bash' > /app/validate-env.sh && \
    echo 'set -e' >> /app/validate-env.sh && \
    echo '' >> /app/validate-env.sh && \
    echo '# Run environment validation as root to create .env file' >> /app/validate-env.sh && \
    echo 'echo "🔧 Validating environment configuration..."' >> /app/validate-env.sh && \
    echo 'node scripts/create-env.js' >> /app/validate-env.sh && \
    echo 'if [ $? -ne 0 ]; then' >> /app/validate-env.sh && \
    echo '    echo "❌ Environment validation failed"' >> /app/validate-env.sh && \
    echo '    exit 1' >> /app/validate-env.sh && \
    echo 'fi' >> /app/validate-env.sh && \
    echo '' >> /app/validate-env.sh && \
    echo '# Fix ownership of created .env file' >> /app/validate-env.sh && \
    echo 'chown appuser:nodejs .env 2>/dev/null || true' >> /app/validate-env.sh && \
    echo '' >> /app/validate-env.sh && \
    echo '# Switch to non-root user and run the main startup script' >> /app/validate-env.sh && \
    echo 'exec su-exec appuser /app/start.sh' >> /app/validate-env.sh && \
    chmod +x /app/validate-env.sh

# Install su-exec for user switching
RUN apk add --no-cache su-exec

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Start the application with environment validation and cron services
CMD ["/app/validate-env.sh"]