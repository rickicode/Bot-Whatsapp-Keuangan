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
RUN mkdir -p /app/data /app/logs /app/exports /app/temp /app/temp/audio && \
    chmod 755 /app/data /app/logs /app/exports /app/temp /app/temp/audio

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

# TTS Configuration Environment Variables
ENV ELEVENLABS_TTS_ENABLED=false
ENV ELEVENLABS_API_KEY=""
ENV ELEVENLABS_VOICE_ID="pNInz6obpgDQGcFmaJgB"
ENV ELEVENLABS_BASE_URL="https://api.elevenlabs.io/v1"
ENV ELEVENLABS_MODEL="eleven_multilingual_v2"
ENV ELEVENLABS_LANGUAGE_ID="id"

# AI Curhat Configuration
ENV AI_CURHAT_ENABLED=true
ENV AI_CURHAT_PROVIDER="openrouter"
ENV AI_CURHAT_MODEL="deepseek/deepseek-chat-v3-0324:free"

# Redis Configuration for Session Management
ENV REDIS_ENABLED=true
ENV REDIS_URL=""
ENV REDIS_HOST="localhost"
ENV REDIS_PORT="6379"
ENV REDIS_PASSWORD=""
ENV REDIS_USERNAME=""
ENV REDIS_DATABASE="0"
ENV REDIS_CONNECT_TIMEOUT="5000"

# Add healthcheck with TTS and curhat support
HEALTHCHECK --interval=30s --timeout=15s --start-period=90s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3000, path: '/health', timeout: 10000 }; \
    const req = http.request(options, (res) => { \
        let data = ''; \
        res.on('data', chunk => data += chunk); \
        res.on('end', () => { \
            if (res.statusCode === 200) { \
                try { \
                    const health = JSON.parse(data); \
                    if (health.status === 'healthy' || health.status === 'degraded') { \
                        process.exit(0); \
                    } else { \
                        console.error('Health check failed:', health); \
                        process.exit(1); \
                    } \
                } catch (e) { \
                    console.error('Invalid health response:', data); \
                    process.exit(1); \
                } \
            } else if (res.statusCode === 503) { \
                process.exit(0); \
            } else { \
                process.exit(1); \
            } \
        }); \
    }); \
    req.on('error', (e) => { console.error('Health check error:', e); process.exit(1); }); \
    req.on('timeout', () => { console.error('Health check timeout'); process.exit(1); }); \
    req.setTimeout(10000); \
    req.end();"

# Set entrypoint and command
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/index.js"]
