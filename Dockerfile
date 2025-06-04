FROM node:18.20.8-bullseye

# Installing only essential dependencies (removed Puppeteer/Chromium dependencies)
RUN apt-get update && apt-get install -y \
    sqlite3 postgresql-client \
    --no-install-recommends \
    && apt-get clean \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN groupadd -r whatsappbot && useradd -r -g whatsappbot whatsappbot

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories and set permissions (updated for Baileys)
RUN mkdir -p data data/sessions logs backups && \
    chown -R whatsappbot:whatsappbot /app && \
    chmod +x scripts/*.js scripts/*.sh

# Switch to non-root user
USER whatsappbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('Health check OK'); process.exit(0);" || exit 1

# Start command with initialization
CMD ["sh", "-c", "node scripts/docker-init.js && exec node src/index.js"]