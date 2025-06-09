# Lightweight build for WhatsApp Financial Management Bot
FROM node:20-alpine

# Single RUN command to minimize layers and storage usage
RUN apk add --no-cache tzdata bash && \
    rm -rf /var/cache/apk/* /tmp/* /var/tmp/* && \
    mkdir -p /app/data /app/logs /app/exports /app/temp /app/temp/audio && \
    chmod 755 /app/data /app/logs /app/exports /app/temp /app/temp/audio

# Set environment and working directory
ENV TZ=Asia/Jakarta \
    NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=384"
WORKDIR /app

# Copy package files and install dependencies in single layer
COPY package*.json ./
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/tmp/* ~/.npm /root/.npm

# Copy application code and setup entrypoint in single layer
COPY . .
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 3000

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
