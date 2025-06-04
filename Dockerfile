FROM node:22 AS builder

WORKDIR /app

COPY package*.json .

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    sqlite3 \
    postgresql-client \
    python3 \
    make \
    g++ \
    tini \
    && rm -rf /var/lib/apt/lists/*

COPY . .


RUN npm install

# Create directories with proper permissions for session persistence
RUN mkdir -p data data/sessions logs backups && \
    chmod 777 data data/sessions logs backups

# Declare volumes for persistent data (includes WhatsApp sessions)
VOLUME ["/app/data", "/app/logs", "/app/backups"]

# Keep running as root user for file access permissions

# Make create-env script executable
RUN chmod +x scripts/create-env.js

# Create .env from all available environment variables
RUN node scripts/create-env.js

# Expose port
EXPOSE 3000

# Use tini as init system for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start application directly with node (better signal handling than npm)
CMD ["node", "src/index.js"]