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

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs /app/exports && \
    chmod 755 /app/data /app/logs /app/exports

# Don't create symlinks to avoid double logging
# The application will log directly to stdout/stderr

# Remove old cron jobs - application now handles cleanup internally
# No external scripts needed for session cleanup or anti-spam monitoring

# Copy and set up entrypoint script
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 3000


# Add logging configuration
ENV NODE_OPTIONS="--max-old-space-size=512"

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3000, path: '/health', timeout: 5000 }; \
    const req = http.request(options, (res) => { \
        if (res.statusCode === 200 || res.statusCode === 503) { process.exit(0); } else { process.exit(1); } \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.setTimeout(5000); \
    req.end();"

# Set entrypoint and command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/index.js"]
