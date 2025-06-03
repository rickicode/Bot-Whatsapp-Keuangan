# Multi-stage build untuk optimasi ukuran image
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install required system dependencies
RUN apk add --no-cache \
    sqlite \
    postgresql-client \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whatsappbot -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY --chown=whatsappbot:nodejs . .

# Create necessary directories
RUN mkdir -p data logs backups && \
    chown -R whatsappbot:nodejs data logs backups

# Make startup script executable
RUN chmod +x scripts/start.sh

# Switch to non-root user
USER whatsappbot

# Expose port (if web interface is added later)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "const db = require('./src/database/DatabaseFactory').create(); db.initialize().then(() => { console.log('Health check passed'); process.exit(0); }).catch(() => process.exit(1));" || exit 1

# Default command using startup script
CMD ["scripts/start.sh"]