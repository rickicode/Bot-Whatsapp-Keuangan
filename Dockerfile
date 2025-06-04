FROM node:18.20.8-bullseye

# Install system dependencies including build tools for native modules
RUN apt-get update && apt-get install -y \
    sqlite3 postgresql-client \
    python3 make g++ \
    libc6-dev \
    libvips-dev \
    pkg-config \
    --no-install-recommends \
    && apt-get clean \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN groupadd -r whatsappbot && useradd -r -g whatsappbot whatsappbot

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Set npm configuration for better compatibility
RUN npm config set unsafe-perm true && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# Install dependencies with better error handling
RUN npm ci --production --legacy-peer-deps --verbose --progress=false --unsafe-perm=true && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories and set permissions (updated for Baileys)
RUN mkdir -p data data/sessions logs backups && \
    chown -R whatsappbot:whatsappbot /app && \
    chmod +x scripts/*.js scripts/*.sh 2>/dev/null || true

# Switch to non-root user
USER whatsappbot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('Health check OK'); process.exit(0);" || exit 1

# Start command with initialization
CMD ["sh", "-c", "node scripts/docker-init.js && exec node src/index.js"]