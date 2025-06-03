FROM node:18.20.8-bullseye

# Installing dependencies needed for Puppeteer and Chromium
RUN apt-get update && apt-get install -y \
    wget unzip fontconfig locales gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 \
    libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils chromium \
    sqlite3 postgresql-client \
    --no-install-recommends \
    && apt-get clean \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Setting Puppeteer env to use system installed Chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Create app user for security
RUN groupadd -r whatsappbot && useradd -r -g whatsappbot whatsappbot

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories and set permissions
RUN mkdir -p data data/whatsapp-session logs backups && \
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