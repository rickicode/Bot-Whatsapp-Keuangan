# Multi-stage build for WhatsApp Financial Management Bot
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install git and build dependencies
RUN apk add --no-cache git python3 make g++

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:20-alpine

# Install necessary packages
RUN apk add --no-cache \
    dcron \
    tzdata \
    bash \
    && rm -rf /var/cache/apk/*

# Set timezone
ENV TZ=Asia/Jakarta

# Set working directory
WORKDIR /app

# Copy node modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /app/data /app/logs /app/backups /app/exports

# Create cron job files
RUN echo "*/5 * * * * cd /app && /usr/local/bin/node scripts/cleanup-sessions.js cleanup >> /app/logs/cron-cleanup.log 2>&1" > /etc/cron.d/session-cleanup && \
    echo "*/2 * * * * cd /app && /usr/local/bin/node scripts/anti-spam-monitor.js stats >> /app/logs/cron-antispam.log 2>&1" > /etc/cron.d/anti-spam && \
    chmod 0644 /etc/cron.d/session-cleanup && \
    chmod 0644 /etc/cron.d/anti-spam

# Copy and set up entrypoint script
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 3000


# Set entrypoint and command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/index.js"]