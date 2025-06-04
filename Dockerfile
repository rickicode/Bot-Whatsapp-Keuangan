# Multi-stage Dockerfile for WhatsApp Financial Bot (Single Container)
# Base: Alpine Linux with Node.js and supervisord for process management

FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    supervisor \
    curl \
    bash \
    openssl \
    python3 \
    make \
    g++ \
    sqlite \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Create botuser for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files first (better Docker layer caching)
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copy application source code
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY docker/ ./docker/

# Copy Docker configuration files to system locations
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/healthcheck.sh /usr/local/bin/healthcheck.sh
COPY docker/supervisor-status.sh /usr/local/bin/supervisor-status.sh
COPY docker/start-easypanel.sh /usr/local/bin/start-easypanel.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/*.sh

# Create necessary directories and set permissions
RUN mkdir -p /app/data /app/data/sessions /app/logs /app/backups /app/exports \
    /var/log/supervisor /var/run \
    && chown -R botuser:nodejs /app \
    && chown -R botuser:nodejs /var/log/supervisor \
    && chmod 755 /app/data /app/logs /app/backups /app/exports

# Create env processing script that works in Docker context
RUN echo '#!/bin/bash' > /usr/local/bin/create-env-from-docker.sh && \
    echo 'set -e' >> /usr/local/bin/create-env-from-docker.sh && \
    echo '' >> /usr/local/bin/create-env-from-docker.sh && \
    echo 'echo "🔧 Creating .env file from Docker environment variables..."' >> /usr/local/bin/create-env-from-docker.sh && \
    echo 'echo "📅 Generated at: $(date)"' >> /usr/local/bin/create-env-from-docker.sh && \
    echo '' >> /usr/local/bin/create-env-from-docker.sh && \
    echo '# Use Node.js script for better environment processing' >> /usr/local/bin/create-env-from-docker.sh && \
    echo 'cd /app' >> /usr/local/bin/create-env-from-docker.sh && \
    echo 'node scripts/create-env.js' >> /usr/local/bin/create-env-from-docker.sh && \
    echo '' >> /usr/local/bin/create-env-from-docker.sh && \
    echo 'echo "✅ Environment setup completed"' >> /usr/local/bin/create-env-from-docker.sh && \
    chmod +x /usr/local/bin/create-env-from-docker.sh

# Health check configuration
HEALTHCHECK --interval=60s --timeout=30s --start-period=30s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Switch to botuser for security (supervisord will start as root then drop privileges)
USER root

# Expose HTTP port for health checks and QR code web interface
EXPOSE 3000

# Set essential environment variables (others handled by create-env.js)
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=384" \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    TZ=Asia/Jakarta \
    PORT=3000 \
    DEPLOYMENT_ENV=docker

# Labels for better container management
LABEL maintainer="Financial Bot Developer" \
      description="WhatsApp Financial Management Bot - Single Container" \
      version="1.0.0" \
      org.opencontainers.image.title="WhatsApp Financial Bot" \
      org.opencontainers.image.description="AI-powered WhatsApp bot for financial management" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Financial Bot Team" \
      org.opencontainers.image.licenses="MIT"

# Start supervisord which manages all services
CMD ["/usr/local/bin/start-easypanel.sh"]