# EasyPanel Setup Guide - Minimal Single Container

## Overview

Setup minimal untuk deployment di EasyPanel menggunakan single container dengan supervisord dan Supabase sebagai database.

## 🚀 Quick Setup

### **1. Persiapan Repository**
```bash
# Clone repository
git clone <your-repo>
cd financial-bot

# Cleanup file yang tidak diperlukan (opsional)
npm run easypanel:cleanup
```

### **2. Konfigurasi Environment**
```bash
# Copy template environment
cp .env.example .env

# Edit konfigurasi untuk Supabase
nano .env
```

#### **Environment Variables untuk EasyPanel + Supabase:**
```env
# Bot Configuration
BOT_NAME=Bot Keuangan Pribadi
BOT_ADMIN_PHONE=+62812345678900

# AI Configuration  
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key

# Supabase Database Configuration
DATABASE_TYPE=postgres
DATABASE_HOST=your-project.supabase.co
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=your_supabase_password
DATABASE_SSL=true

# Production Settings
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Anti-spam Settings (optimized for EasyPanel)
ANTI_SPAM_USER_PER_MINUTE=15
ANTI_SPAM_GLOBAL_PER_MINUTE=75
ANTI_SPAM_EMERGENCY_BRAKE=true
```

### **3. Deploy ke EasyPanel**

#### **Option A: Build dan Deploy**
```bash
# Build image untuk EasyPanel
npm run easypanel:build

# Start container
npm run easypanel:start
```

#### **Option B: Manual Docker**
```bash
# Build image
docker build -f Dockerfile.easypanel -t whatsapp-bot-easypanel .

# Run container
docker run -d \
  --name whatsapp-bot-easypanel \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  --restart unless-stopped \
  whatsapp-bot-easypanel
```

### **4. Verifikasi Deployment**
```bash
# Check status semua services
npm run easypanel:status

# Lihat logs (semua services dalam satu output)
npm run easypanel:logs

# Lihat logs secara real-time
docker logs -f whatsapp-bot-easypanel

# Health check
curl http://localhost:3000/health
```

## 🏗️ Architecture

### **Single Container dengan Supervisord**
```
Container: whatsapp-bot-easypanel
├── supervisord (process manager)
├── whatsapp-bot (main application)
├── antispam-monitor (setiap 5 menit)
├── session-cleanup (setiap 10 menit)
├── health-monitor (setiap 5 menit)
└── log-rotator (setiap 2 jam)
```

### **Specs Container:**
```yaml
Base Image:    node:22-alpine
Size:          ~200MB
Memory Limit:  512MB
CPU Limit:     1.0 cores
Database:      Supabase (external)
Storage:       Local volumes for sessions/logs
```

## 📊 Resource Usage

### **Memory:**
```
Main Bot:           ~180MB
Monitor Services:   ~40MB
Supervisord:        ~10MB
OS Overhead:        ~20MB
Total:             ~250MB (50% dari limit)
```

### **CPU:**
```
Idle:              ~5% CPU
Normal Load:       ~15-25% CPU
Peak Load:         ~60% CPU
```

### **Storage:**
```
Application:       ~200MB
Sessions:          ~50MB (grows over time)
Logs:             ~20MB (rotated automatically)
```

## 🛠️ Management Commands

### **Container Management:**
```bash
# Start/Stop
npm run easypanel:start
npm run easypanel:stop

# Build
npm run easypanel:build

# Logs & Status
npm run easypanel:logs
npm run easypanel:status
```

### **Service Management (di dalam container):**
```bash
# Check semua services
docker exec whatsapp-bot-easypanel supervisorctl status

# Restart main bot
docker exec whatsapp-bot-easypanel supervisorctl restart whatsapp-bot

# Restart monitor
docker exec whatsapp-bot-easypanel supervisorctl restart antispam-monitor

# Stop/start service tertentu
docker exec whatsapp-bot-easypanel supervisorctl stop session-cleanup
docker exec whatsapp-bot-easypanel supervisorctl start session-cleanup
```

### **Monitoring:**
```bash
# Container stats
docker stats whatsapp-bot-easypanel

# Detailed status
npm run easypanel:status

# Health check
curl http://localhost:3000/health
curl http://localhost:3000/anti-spam/stats
```

## 📱 Access URLs

```
Main Health:       http://localhost:3000/health
QR Code:          http://localhost:3000/qrscan
Anti-spam Stats:  http://localhost:3000/anti-spam/stats
```

## 🔧 Troubleshooting

### **Container tidak start:**
```bash
# Check logs
docker logs whatsapp-bot-easypanel

# Check build
npm run easypanel:build
```

### **Service tidak jalan:**
```bash
# Check supervisor status
npm run easypanel:status

# Restart specific service
docker exec whatsapp-bot-easypanel supervisorctl restart whatsapp-bot
```

### **Database connection error:**
```bash
# Verify Supabase config in .env
# Check DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD
# Ensure DATABASE_SSL=true untuk Supabase
```

### **High memory usage:**
```bash
# Check container stats
docker stats whatsapp-bot-easypanel

# Restart container
npm run easypanel:stop
npm run easypanel:start
```

## 🎯 Production Tips

### **1. Supabase Setup:**
- Gunakan connection pooling
- Enable RLS (Row Level Security)
- Setup database indexes untuk performance

### **2. Monitoring:**
- Setup alerts untuk container restart
- Monitor memory usage
- Setup log aggregation

### **3. Security:**
- Gunakan strong password untuk Supabase
- Enable SSL untuk database connection
- Regular backup data penting

### **4. Performance:**
- Monitor anti-spam metrics
- Cleanup old sessions berkala
- Monitor disk usage untuk logs

## 📋 File Structure (Minimal)

```
financial-bot/
├── Dockerfile.easypanel          # Main container definition
├── docker-compose.easypanel.yml  # Compose file for easy deployment  
├── package.json                  # Minimal NPM scripts
├── .env.example                  # Environment template
├── src/                          # Application code
│   ├── index.js                  # Main entry point
│   ├── database/                 # Database handlers
│   ├── handlers/                 # Command handlers  
│   ├── services/                 # Business logic
│   └── utils/                    # Utilities
├── scripts/                      # Essential scripts only
│   ├── anti-spam-monitor.js      # Anti-spam monitoring
│   ├── cleanup-sessions.js       # Session cleanup
│   ├── backup.js                 # Backup utility
│   └── create-env.js             # Environment setup
└── docs/
    └── EASYPANEL_SETUP.md        # This guide
```

Dengan setup ini, bot WhatsApp bisa running di EasyPanel dengan **resource minimal** (512MB RAM, 1 CPU) sambil tetap memiliki semua functionality penting!

🚀 **Ready untuk production deployment di EasyPanel dengan Supabase!**