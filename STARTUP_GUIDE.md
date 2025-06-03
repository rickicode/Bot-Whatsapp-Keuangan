# Panduan Startup - Bot WhatsApp Keuangan

## 🚀 Startup Script yang Diperbaiki

Bot sekarang dilengkapi dengan startup script yang robust (`scripts/start.sh`) yang memastikan inisialisasi yang proper sebelum bot dimulai.

## 🔧 Proses Startup Otomatis

### 1. Validasi Environment
- ✅ Cek versi Node.js (minimal v16)
- ✅ Cek ketersediaan dependencies
- ✅ Validasi file `.env`

### 2. Setup Direktori
- ✅ Buat folder `data`, `logs`, `backups`
- ✅ Set permission yang tepat

### 3. Inisialisasi Aplikasi
- ✅ Jalankan `npm run setup`
- ✅ Setup database dengan `npm run setup-db`
- ✅ Test koneksi database

### 4. Start Bot
- ✅ Jalankan WhatsApp bot dengan konfigurasi yang valid

## 📦 Deployment Options

### 1. Docker (Recommended)

**Production:**
```bash
# Akan otomatis run setup script
docker-compose up -d
```

**Development:**
```bash
# Akan otomatis run setup script
docker-compose -f docker-compose.dev.yml up -d
```

**Manual Docker:**
```bash
# Build dengan setup included
docker build -t whatsapp-financial-bot .
docker run -d --name whatsapp-bot whatsapp-financial-bot
```

### 2. NPM Scripts

**Production dengan Startup Script:**
```bash
npm run start:production
```

**Development:**
```bash
npm run dev
```

**Docker Commands:**
```bash
npm run docker:prod    # Production deployment
npm run docker:dev     # Development deployment
npm run docker:build   # Build image only
```

### 3. Manual Setup (untuk debugging)

```bash
# Step by step manual setup
npm run setup           # Setup aplikasi
npm run setup-db        # Setup database
npm start              # Start bot
```

### 4. Cloud Platforms

**Heroku:**
- PostDeploy script: `npm run setup && npm run setup-db`
- Akan otomatis dijalankan setelah deployment

**Railway (Nixpacks):**
- Build phase: `npm run setup && npm run setup-db`
- Start command: `npm start`

**Render/DigitalOcean:**
- Build command: `npm install && npm run setup`
- Start command: `npm start`

## 🔍 Health Checks

### Docker Health Check
```bash
# Health check yang lebih robust
docker ps  # Check container status
docker logs whatsapp-bot  # Check startup logs
```

### Manual Health Check
```bash
# Test database connection
node -e "const db = require('./src/database/DatabaseFactory').create(); db.initialize().then(() => console.log('OK')).catch(console.error);"
```

## 🐛 Troubleshooting

### 1. Permission Issues (Linux/Mac)
```bash
chmod +x scripts/start.sh
```

### 2. Node.js Version
```bash
node -v  # Should be v16 or higher
```

### 3. Environment Variables
```bash
# Check if .env exists and is configured
cat .env
```

### 4. Database Issues
```bash
# For SQLite3
ls -la data/  # Check if database file exists

# For PostgreSQL
pg_isready -h localhost -p 5432  # Check if server is running
```

### 5. Docker Issues
```bash
# Check container logs
docker logs whatsapp-financial-bot

# Check database container
docker logs postgres-financial-bot

# Restart with fresh setup
docker-compose down
docker-compose up -d
```

## 📋 Startup Sequence

1. **Pre-checks** 🔍
   - Node.js version validation
   - Environment file validation
   - Directory creation

2. **Application Setup** 🔧
   - Run `npm run setup`
   - Initialize configuration
   - Validate dependencies

3. **Database Setup** 🗄️
   - Run `npm run setup-db`
   - Create tables and indexes
   - Insert default categories
   - Test connection

4. **Bot Initialization** 🤖
   - Initialize WhatsApp client
   - Load user sessions
   - Start message handlers

5. **Health Monitoring** 📊
   - Periodic health checks
   - Database connection monitoring
   - Error logging and recovery

## ⚡ Quick Start Commands

```bash
# Docker (Simplest)
docker-compose up -d

# NPM (Local development)
npm run start:production

# Manual (Step by step)
npm run setup
npm run setup-db
npm start
```

## 🔒 Security Notes

- Startup script checks for secure environment configuration
- Database credentials validation before connection
- Non-root user execution in Docker
- Proper file permissions for data directories

## 📝 Logs & Monitoring

Startup logs tersedia di:
- **Console**: Real-time startup progress
- **File**: `logs/app.log` untuk persistent logging
- **Docker**: `docker logs whatsapp-financial-bot`

---

**Bot WhatsApp Keuangan sekarang memiliki startup process yang robust dan reliable untuk semua deployment scenarios!** 🚀