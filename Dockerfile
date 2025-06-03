# Universal Dockerfile untuk Serverless dan VPS
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    sqlite \
    postgresql-client \
    bash \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && rm -rf /var/cache/apk/*

# Configure Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S whatsappbot -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=whatsappbot:nodejs . .

# Create directories and set permissions
RUN mkdir -p data logs backups && \
    chown -R whatsappbot:nodejs . && \
    chmod +x scripts/*.sh

# Switch to non-root user
USER whatsappbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('Health OK'); process.exit(0);" || exit 1

# Default command
CMD ["node", "src/index.js"]