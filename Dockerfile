# Multi-stage build for WhatsApp Financial Management Bot
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install build dependencies, run npm install, then clean up in single layer to save space
RUN apk add --no-cache git python3 make g++ \
    && npm ci --only=production --no-audit --no-fund \
    && apk del git python3 make g++ \
    && npm cache clean --force \
    && rm -rf /var/cache/apk/* /tmp/* /root/.npm

# Production stage
FROM node:20-alpine

# Install necessary packages and clean up in single layer
RUN apk add --no-cache tzdata bash \
    && rm -rf /var/cache/apk/* /tmp/*

# Set timezone
ENV TZ=Asia/Jakarta

# Set working directory
WORKDIR /app

# Copy node modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code (exclude unnecessary files via .dockerignore)
COPY . .

# Create directories and set permissions in single layer
RUN mkdir -p /app/data /app/logs /app/exports /app/temp /app/temp/audio \
    && chmod 755 /app/data /app/logs /app/exports /app/temp /app/temp/audio \
    && chmod +x /app/docker/entrypoint.sh \
    && ln -sf /app/docker/entrypoint.sh /app/entrypoint.sh

# Expose port
EXPOSE 3000


# Add logging configuration
ENV NODE_OPTIONS="--max-old-space-size=512"

# Add comprehensive healthcheck using external script
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
    CMD /app/docker/healthcheck.sh

# Set entrypoint and command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/index.js"]
