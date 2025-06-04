# Docker Setup - WhatsApp Financial Bot

Panduan lengkap untuk menjalankan WhatsApp Financial Bot menggunakan Docker dalam satu container.

## 🚀 Quick Start

### 1. Persiapan Environment

Copy file environment example dan isi dengan konfigurasi Anda:

```bash
# Copy file example
cp .env.docker.example .env

# Edit file .env dengan editor favorit Anda
nano .env
```

**Minimal configuration yang diperlukan:**

```bash
# Required
BOT_ADMIN_PHONE=+6281234567890
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional (akan menggunakan SQLite default)
DATABASE_TYPE=sqlite3
```

### 2. Build dan Jalankan Container

```bash
# Build Docker image
npm run docker:build

# Jalankan container
npm run docker:run

# Lihat logs untuk QR Code
npm run docker:logs
```

### 3. Scan QR Code

Setelah container berjalan, buka browser dan akses:

```
http://localhost:3000/qrscan
```

Atau lihat QR code di logs:

```bash
npm run docker:logs
```

## 🔧 Konfigurasi Environment

### Database Options

#### SQLite (Default - Recommended untuk single user)
```bash
DATABASE_TYPE=sqlite3
DB_PATH=/app/data/financial.db
```

#### PostgreSQL (Untuk production/multi-user)
```bash
DATABASE_TYPE=postgres
DATABASE_HOST=your-postgres-host
DATABASE_PORT=5432
DATABASE_NAME=financial_bot
DATABASE_USER=postgres
DATABASE_PASSWORD=your-password
DATABASE_SSL=true
```

### AI Provider Options

#### DeepSeek (Recommended - Cost effective)
```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_MODEL=deepseek-chat
```

#### OpenAI
```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-3.5-turbo
```

#### Groq (Fast inference)
```bash
AI_PROVIDER=groq
GROQ_API_KEY=your_key_here
```

## 📋 Docker Commands

### Basic Operations
```bash
# Build image
npm run docker:build

# Run container (first time)
npm run docker:run

# Start existing container
npm run docker:start

# Stop container
npm run docker:stop

# Restart container
npm run docker:restart

# Remove container
npm run docker:remove
```

### Monitoring & Debugging
```bash
# View logs
npm run docker:logs

# Check health status
npm run docker:health

# Check supervisor status
npm run docker:status

# Open shell in container
npm run docker:shell

# Clean up Docker system
npm run docker:clean
```

### Manual Docker Commands

Jika Anda ingin menjalankan manual:

```bash
# Build
docker build -t whatsapp-financial-bot .

# Run with environment file
docker run -d \
  --name whatsapp-bot \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  whatsapp-financial-bot

# Run with individual environment variables
docker run -d \
  --name whatsapp-bot \
  -p 3000:3000 \
  -e BOT_ADMIN_PHONE=+6281234567890 \
  -e DEEPSEEK_API_KEY=your_key_here \
  -e DATABASE_TYPE=sqlite3 \
  -v $(pwd)/data:/app/data \
  whatsapp-financial-bot
```

## 🏗️ Architecture

Container ini menggunakan **supervisord** untuk mengelola multiple services:

```
Container (whatsapp-financial-bot)
├── WhatsApp Bot (Main Application)
├── Anti-spam Monitor (setiap 5 menit)
├── Session Cleanup (setiap 10 menit)
├── Health Monitor (setiap 5 menit)
└── Log Rotator (setiap 2 jam)
```

### Ports
- **3000**: HTTP server untuk health check & QR code web interface

### Volumes
- **`/app/data`**: Database dan session WhatsApp
- **`/app/logs`**: Log files
- **`/app/backups`**: Database backups

## 🔍 Monitoring & Health Checks

### Health Check Endpoints

```bash
# Basic health check
curl http://localhost:3000/health

# Anti-spam statistics
curl http://localhost:3000/anti-spam/stats

# QR code status
curl http://localhost:3000/qrscan/status
```

### Container Health Check

Docker secara otomatis melakukan health check setiap 60 detik:

```bash
# Manual health check
docker exec whatsapp-bot /usr/local/bin/healthcheck.sh

# Check semua services
docker exec whatsapp-bot /usr/local/bin/supervisor-status.sh
```

### Log Monitoring

```bash
# Semua logs
docker logs -f whatsapp-bot

# Filter logs by service
docker logs whatsapp-bot | grep "\[WHATSAPP-BOT\]"
docker logs whatsapp-bot | grep "\[ANTISPAM\]"
docker logs whatsapp-bot | grep "\[HEALTH\]"
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Container tidak bisa start
```bash
# Check logs
docker logs whatsapp-bot

# Check environment variables
docker exec whatsapp-bot env | grep -E "(BOT_|DATABASE_|AI_)"
```

#### 2. QR Code tidak muncul
```bash
# Restart WhatsApp service only
docker exec whatsapp-bot supervisorctl restart whatsapp-bot

# Check supervisor status
npm run docker:status
```

#### 3. Database connection error
```bash
# Check database configuration
docker exec whatsapp-bot cat /app/.env | grep DATABASE

# Test database connection
docker exec whatsapp-bot node -e "
const db = require('./src/database/DatabaseManager');
const dbInstance = new db();
dbInstance.initialize().then(() => console.log('DB OK')).catch(console.error);
"
```

#### 4. Memory issues
```bash
# Check memory usage
docker stats whatsapp-bot

# Restart container if needed
npm run docker:restart
```

### Service Management

```bash
# Restart specific service
docker exec whatsapp-bot supervisorctl restart whatsapp-bot
docker exec whatsapp-bot supervisorctl restart antispam-monitor

# Stop specific service
docker exec whatsapp-bot supervisorctl stop session-cleanup

# Start specific service
docker exec whatsapp-bot supervisorctl start health-monitor

# View all services status
docker exec whatsapp-bot supervisorctl status
```

## 🔒 Security Notes

1. **Environment Variables**: Jangan commit file `.env` ke git
2. **API Keys**: Gunakan API keys dengan scope terbatas
3. **Database**: Gunakan strong passwords untuk PostgreSQL
4. **Network**: Container berjalan sebagai non-root user (`botuser`)
5. **Volumes**: Set proper file permissions untuk mounted volumes

## 📊 Resource Requirements

### Minimum
- **RAM**: 512MB
- **CPU**: 1 core
- **Storage**: 1GB

### Recommended
- **RAM**: 1GB
- **CPU**: 2 cores  
- **Storage**: 5GB

### Performance Notes
- SQLite: Cocok untuk 1-10 users
- PostgreSQL: Cocok untuk 10+ users
- Memory usage: ~200-400MB normal operation

## 🚀 Deployment Options

### Local Development
```bash
npm run docker:build
npm run docker:run
```

### Production (with volumes)
```bash
docker run -d \
  --name whatsapp-bot-prod \
  -p 3000:3000 \
  --env-file .env.production \
  -v /opt/whatsapp-bot/data:/app/data \
  -v /opt/whatsapp-bot/logs:/app/logs \
  -v /opt/whatsapp-bot/backups:/app/backups \
  --restart unless-stopped \
  whatsapp-financial-bot
```

### Docker Compose Alternative
```yaml
version: '3.8'
services:
  whatsapp-bot:
    build: .
    container_name: whatsapp-bot
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./backups:/app/backups
    restart: unless-stopped
    healthcheck:
      test: ["/usr/local/bin/healthcheck.sh"]
      interval: 60s
      timeout: 30s
      retries: 3
      start_period: 30s
```

Simpan sebagai `docker-compose.yml` dan jalankan:
```bash
docker-compose up -d
```

## 📝 Environment Variables Reference

Lihat file [`.env.docker.example`](.env.docker.example) untuk daftar lengkap environment variables yang tersedia.

## 🆘 Support

Jika mengalami masalah:

1. Check logs: `npm run docker:logs`
2. Check health: `npm run docker:health`
3. Check supervisor: `npm run docker:status`
4. Restart container: `npm run docker:restart`

Untuk masalah yang tidak terselesaikan, silakan buat issue di repository ini dengan informasi:
- Docker version: `docker --version`
- Container logs: `npm run docker:logs`
- Environment config (tanpa API keys)