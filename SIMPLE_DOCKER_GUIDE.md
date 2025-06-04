# Simple Docker Setup - WhatsApp Financial Bot

## 🚀 Quick Start (Dockerfile Only)

This guide helps you run the WhatsApp Financial Bot using the simple Dockerfile (without docker-compose).

### Prerequisites

- Docker installed
- Basic environment configuration

### 1. Build the Image

```bash
docker build -t whatsapp-financial-bot .
```

### 2. Prepare Environment

Copy and edit the environment file:

```bash
cp .env.example .env
# Edit .env with your configuration
```

**Minimal required settings:**
```bash
BOT_ADMIN_PHONE=+6281234567890
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 3. Run the Container

```bash
# Basic run
docker run -d \
  --name whatsapp-bot \
  -p 3000:3000 \
  --env-file .env \
  whatsapp-financial-bot

# With persistent data
docker run -d \
  --name whatsapp-bot \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/backups:/app/backups \
  whatsapp-financial-bot
```

### 4. Access QR Code

Open browser and visit:
```
http://localhost:3000/qrscan
```

Or check container logs:
```bash
docker logs -f whatsapp-bot
```

## 🔧 Container Management

### Check Status
```bash
# Container status
docker ps

# Health check
docker exec whatsapp-bot /usr/local/bin/healthcheck.sh

# View logs
docker logs -f whatsapp-bot
```

### Control Container
```bash
# Stop
docker stop whatsapp-bot

# Start
docker start whatsapp-bot

# Restart
docker restart whatsapp-bot

# Remove
docker stop whatsapp-bot && docker rm whatsapp-bot
```

## ⚙️ Features

This Dockerfile includes:

✅ **Environment Setup**: Uses [`scripts/create-env.js`](scripts/create-env.js) for automatic environment configuration  
✅ **Anti-spam Protection**: Runs [`scripts/anti-spam-monitor.js`](scripts/anti-spam-monitor.js) every 5 minutes  
✅ **Session Cleanup**: Runs [`scripts/cleanup-sessions.js`](scripts/cleanup-sessions.js) every 10 minutes  
✅ **Health Monitoring**: Built-in health check endpoint  
✅ **Security**: Runs as non-root user  
✅ **Process Management**: Proper signal handling with dumb-init  

## 🧪 Testing

Run the test script to verify everything works:

```bash
./test-simple-docker.sh
```

This will:
- Build the Docker image
- Create a test container
- Run health checks
- Show logs
- Clean up

## 🔍 Troubleshooting

### Container won't start
```bash
docker logs whatsapp-bot
```

### QR Code not showing
```bash
# Check if container is running
docker ps

# Check health
curl http://localhost:3000/health

# Restart if needed
docker restart whatsapp-bot
```

### Database issues
```bash
# Check environment
docker exec whatsapp-bot env | grep DATABASE

# Check data directory
docker exec whatsapp-bot ls -la /app/data
```

## 📝 Environment Variables

Key environment variables (see [`.env.example`](.env.example) for complete list):

### Required
- `BOT_ADMIN_PHONE`: Your WhatsApp phone number
- `DEEPSEEK_API_KEY`: Your DeepSeek API key

### Optional
- `DATABASE_TYPE`: `sqlite3` (default) or `postgres`
- `NODE_ENV`: `production` (default)
- `PORT`: `3000` (default)
- `LOG_LEVEL`: `info` (default)

## 🔗 Related Files

- [`Dockerfile`](Dockerfile) - Main Docker configuration
- [`.dockerignore`](.dockerignore) - Docker build exclusions
- [`scripts/create-env.js`](scripts/create-env.js) - Environment setup
- [`test-simple-docker.sh`](test-simple-docker.sh) - Testing script
- [`.env.example`](.env.example) - Environment template

## 🆚 Docker vs Docker Compose

**Use this Dockerfile when:**
- You want simple, single-container deployment
- You don't need external databases
- You prefer manual container management

**Use Docker Compose when:**
- You need multiple services (database, redis, etc.)
- You want automated service orchestration
- You prefer declarative configuration

## 🚨 Production Notes

For production deployment:

1. **Use environment files** (not inline environment variables)
2. **Mount persistent volumes** for data, logs, and backups
3. **Set restart policy**: `--restart unless-stopped`
4. **Monitor logs**: Set up log rotation and monitoring
5. **Security**: Use secrets management for API keys

```bash
# Production example
docker run -d \
  --name whatsapp-bot-prod \
  -p 3000:3000 \
  --env-file .env.production \
  -v /opt/whatsapp-bot/data:/app/data \
  -v /opt/whatsapp-bot/logs:/app/logs \
  -v /opt/whatsapp-bot/backups:/app/backups \
  --restart unless-stopped \
  whatsapp-financial-bot