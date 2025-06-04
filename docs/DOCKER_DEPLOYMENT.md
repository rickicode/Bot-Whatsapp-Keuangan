# Docker Deployment Guide - Production Ready

## Overview

Panduan lengkap untuk deploy WhatsApp Financial Bot menggunakan Docker dengan fitur-fitur production-ready seperti health checks, monitoring, backup otomatis, dan anti-spam protection.

## 🚀 Quick Start

### 1. **Basic Deployment**
```bash
# Clone repository
git clone <your-repo-url>
cd financial-bot

# Start basic services (Bot + Database)
npm run docker:start

# Or using direct script
./scripts/docker-manager.sh start
```

### 2. **Full Production Deployment**
```bash
# Start all services (Bot + Database + Monitoring + Backup + Logs)
npm run docker:full

# Or using direct script
./scripts/docker-manager.sh start full
```

### 3. **Check Status**
```bash
# Check health
npm run docker:health

# Monitor real-time
npm run docker:monitor

# View logs
npm run docker:logs
```

## 🏗️ Dockerfile Features

### **Enhanced Production Dockerfile** ([`Dockerfile`](../Dockerfile))

#### **Multi-Stage Build**
- ✅ Optimized Alpine Linux base image
- ✅ Separate build and production stages
- ✅ Minimal attack surface

#### **Security Features**
- ✅ Non-root user (`botuser:nodejs`)
- ✅ Proper file permissions
- ✅ Security-hardened Alpine packages

#### **Built-in Scripts**
- ✅ **Health Check Script** (`/usr/local/bin/healthcheck.sh`)
- ✅ **Startup Script** (`/usr/local/bin/start-bot.sh`)
- ✅ **Monitor Script** (`/usr/local/bin/monitor-bot.sh`)
- ✅ **Shutdown Script** (`/usr/local/bin/shutdown-bot.sh`)

#### **Health Check System**
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh
```

**Health Check meliputi:**
- ✅ HTTP endpoint `/health` responsiveness
- ✅ Anti-spam system status
- ✅ Log directory writability
- ✅ Database connection test

#### **Monitoring & Recovery**
- ✅ Automatic session cleanup
- ✅ Log rotation (100MB limit)
- ✅ Emergency brake monitoring
- ✅ Disk space monitoring

#### **Graceful Shutdown**
- ✅ Proper signal handling dengan tini
- ✅ Data persistence on shutdown
- ✅ Session cleanup on exit

## 🐳 Docker Compose Profiles

### **Profile System** ([`docker-compose.yml`](../docker-compose.yml))

#### **Basic Profile** (Default)
```bash
./scripts/docker-manager.sh start basic
```
Services:
- ✅ WhatsApp Bot
- ✅ PostgreSQL Database

#### **Monitoring Profile**
```bash
./scripts/docker-manager.sh start monitoring
```
Additional Services:
- ✅ Anti-spam monitoring
- ✅ Real-time statistics

#### **Backup Profile**
```bash
./scripts/docker-manager.sh start backup
```
Additional Services:
- ✅ Automated database backup (hourly)
- ✅ Backup retention (7 days)

#### **Cleanup Profile**
```bash
./scripts/docker-manager.sh start cleanup
```
Additional Services:
- ✅ Session cleanup service (every 10 minutes)
- ✅ Memory management

#### **Logs Profile**
```bash
./scripts/docker-manager.sh start logs
```
Additional Services:
- ✅ Dozzle web log viewer
- ✅ Access: http://localhost:8080

#### **Auto-Update Profile**
```bash
./scripts/docker-manager.sh start auto-update
```
Additional Services:
- ✅ Watchtower container updater
- ✅ Automatic image updates

#### **Full Profile**
```bash
./scripts/docker-manager.sh start full
```
All Services:
- ✅ All above services combined

## 🛠️ Docker Manager Script

### **Complete Management Tool** ([`scripts/docker-manager.sh`](../scripts/docker-manager.sh))

#### **Available Commands**
```bash
# Service Management
./scripts/docker-manager.sh start [profile]     # Start services
./scripts/docker-manager.sh stop               # Stop all services
./scripts/docker-manager.sh restart [profile]  # Restart services
./scripts/docker-manager.sh status             # Show status

# Monitoring & Debugging
./scripts/docker-manager.sh logs [service]     # Show logs
./scripts/docker-manager.sh health             # Check health
./scripts/docker-manager.sh monitor            # Real-time monitoring

# Maintenance
./scripts/docker-manager.sh update             # Update services
./scripts/docker-manager.sh build              # Rebuild images
./scripts/docker-manager.sh reset              # Reset all data (DANGEROUS)

# Specific Services
./scripts/docker-manager.sh backup             # Start backup service
./scripts/docker-manager.sh cleanup            # Start cleanup service
./scripts/docker-manager.sh logs-viewer        # Start web log viewer
```

#### **NPM Shortcuts**
```bash
npm run docker:start        # Start basic services
npm run docker:stop         # Stop all services
npm run docker:restart      # Restart services
npm run docker:logs         # Show bot logs
npm run docker:health       # Check health
npm run docker:monitor      # Real-time monitoring
npm run docker:full         # Start all services
```

## 📊 Service Architecture

### **Container Structure**
```
financial-bot-network
├── whatsapp-financial-bot     # Main bot application
├── postgres-financial-bot     # PostgreSQL database
├── financial-db-backup       # Database backup service
├── financial-monitor         # Anti-spam monitoring
├── financial-cleanup         # Session cleanup
├── financial-logs            # Dozzle log viewer
└── financial-watchtower      # Auto-update service
```

### **Volume Mapping**
```yaml
volumes:
  - ./data:/app/data                    # WhatsApp sessions & SQLite
  - ./data/sessions:/app/data/sessions  # WhatsApp session files
  - ./logs:/app/logs                    # Application logs
  - ./backups:/app/backups              # Database backups
  - postgres_data:/var/lib/postgresql/data  # PostgreSQL data
```

### **Network Configuration**
```yaml
networks:
  financial-bot-network:
    driver: bridge
    name: financial-bot-network
```

## 🔧 Configuration

### **Environment Variables**

#### **Required Variables** (`.env`)
```bash
# WhatsApp Configuration
BOT_NAME=Bot Keuangan Pribadi
BOT_ADMIN_PHONE=+62812345678900

# AI Configuration
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_api_key_here

# Database (PostgreSQL for production)
DATABASE_TYPE=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=financial_bot
DATABASE_USER=botuser
DATABASE_PASSWORD=botpassword
```

#### **Production Anti-Spam Settings**
```bash
# Anti-Spam Protection (Auto-configured in Docker)
ANTI_SPAM_USER_PER_MINUTE=10
ANTI_SPAM_GLOBAL_PER_MINUTE=50
ANTI_SPAM_EMERGENCY_BRAKE=true
ANTI_SPAM_EMERGENCY_THRESHOLD=80
```

#### **Container Settings**
```bash
# Container Environment
NODE_ENV=production
TZ=Asia/Jakarta
LOG_LEVEL=info
PORT=3000
```

### **Production Recommendations**

#### **Resource Limits**
```yaml
# Add to docker-compose.yml for production
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
    reservations:
      cpus: '0.5'
      memory: 512M
```

#### **Security Settings**
```yaml
# Add to docker-compose.yml for production
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /app/tmp
```

## 🚨 Health Monitoring

### **Health Endpoint**
```bash
curl http://localhost:3000/health
```

#### **Response Format**
```json
{
  "status": "OK",
  "timestamp": "2025-06-04T06:09:00.000Z",
  "uptime": 1234.567,
  "memory": {
    "rss": 67108864,
    "heapTotal": 31457280,
    "heapUsed": 18874376
  },
  "whatsapp": {
    "connected": true,
    "qrRequired": false
  },
  "database": {
    "status": "connected"
  },
  "antiSpam": {
    "initialized": true,
    "emergencyBrakeActive": false,
    "messagesPerMinute": 12
  },
  "sessions": {
    "pending": 0,
    "edit": 0,
    "delete": 0
  }
}
```

#### **Status Codes**
- ✅ **200 OK**: All systems healthy
- ⚠️ **503 DEGRADED**: Some issues but functional
- 🚨 **500 CRITICAL**: Major issues requiring attention

### **Docker Health Check**
```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Detailed health info
docker inspect whatsapp-financial-bot | jq '.[0].State.Health'
```

## 📋 Monitoring & Alerting

### **Real-time Monitoring**
```bash
# Anti-spam monitoring
npm run docker:monitor

# System monitoring
docker stats

# Log monitoring
npm run docker:logs
```

### **Web Dashboards**

#### **Bot Health Dashboard**
```
http://localhost:3000/health
```

#### **Anti-spam Statistics**
```
http://localhost:3000/anti-spam/stats
```

#### **QR Code Scanner**
```
http://localhost:3000/qrscan
```

#### **Log Viewer (Dozzle)**
```
http://localhost:8080
```
*Available when logs profile is active*

### **Alerting Setup**

#### **External Monitoring Integration**
```bash
# Example: Ping health endpoint every minute
*/1 * * * * curl -f http://localhost:3000/health || echo "Bot health check failed" | mail -s "Bot Alert" admin@example.com
```

#### **Emergency Brake Alerts**
```bash
# Check for emergency brake
curl -s http://localhost:3000/anti-spam/stats | \
jq -r '.stats.global.emergencyBrakeActive' | \
if [ "true" ]; then
  echo "ALERT: Emergency brake active!" | mail -s "Critical Bot Alert" admin@example.com
fi
```

## 🔄 Backup & Recovery

### **Automated Backup**

#### **Database Backup Service**
```bash
# Start backup service
./scripts/docker-manager.sh backup

# Manual backup
docker exec postgres-financial-bot pg_dump -U botuser financial_bot > backup.sql
```

#### **Backup Schedule**
- ✅ **Frequency**: Every hour
- ✅ **Retention**: 7 days
- ✅ **Location**: `./backups/` directory
- ✅ **Format**: SQL dump files

#### **WhatsApp Session Backup**
```bash
# Sessions are automatically persisted in ./data/sessions/
# Backup sessions directory
tar -czf sessions_backup_$(date +%Y%m%d).tar.gz data/sessions/
```

### **Recovery Procedures**

#### **Database Recovery**
```bash
# Stop services
./scripts/docker-manager.sh stop

# Restore from backup
docker run --rm -v $(pwd)/backups:/backups -v financial-bot_postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine sh -c "
    psql -U botuser -d financial_bot < /backups/backup_YYYYMMDD_HHMMSS.sql
  "

# Restart services
./scripts/docker-manager.sh start
```

#### **Complete System Recovery**
```bash
# Reset everything
./scripts/docker-manager.sh reset

# Restore data
cp -r backup_data/* data/
cp -r backup_logs/* logs/

# Start fresh
./scripts/docker-manager.sh start full
```

## 🚀 Deployment Strategies

### **Development Environment**
```bash
# Basic setup for development
git clone <repo>
cd financial-bot
cp .env.example .env
# Edit .env with your settings
npm run docker:start
```

### **Staging Environment**
```bash
# Staging with monitoring
./scripts/docker-manager.sh start monitoring
```

### **Production Environment**
```bash
# Full production setup
./scripts/docker-manager.sh start full

# Enable all monitoring
# Setup external alerts
# Configure backup retention
# Setup log aggregation
```

### **High Availability Setup**
```bash
# Multiple replicas (requires Docker Swarm or Kubernetes)
# Load balancer configuration
# Database clustering
# Shared storage for sessions
```

## 🔧 Troubleshooting

### **Common Issues**

#### **Container Won't Start**
```bash
# Check logs
./scripts/docker-manager.sh logs whatsapp-bot

# Check health
./scripts/docker-manager.sh health

# Rebuild
./scripts/docker-manager.sh build
```

#### **Database Connection Issues**
```bash
# Check PostgreSQL status
docker exec postgres-financial-bot pg_isready -U botuser

# Check network connectivity
docker exec whatsapp-financial-bot ping postgres

# Reset database
docker volume rm financial-bot_postgres_data
./scripts/docker-manager.sh restart
```

#### **WhatsApp Connection Issues**
```bash
# Check QR code
curl http://localhost:3000/qrscan/status

# Reset WhatsApp session
rm -rf data/sessions/*
./scripts/docker-manager.sh restart
```

#### **High Memory Usage**
```bash
# Check memory stats
docker stats whatsapp-financial-bot

# Clean up sessions
npm run cleanup:force

# Restart with cleanup
./scripts/docker-manager.sh start cleanup
```

### **Performance Optimization**

#### **Resource Tuning**
```yaml
# Add to docker-compose.yml
environment:
  - NODE_OPTIONS=--max-old-space-size=512
  - DB_POOL_MAX=10
  - DB_POOL_MIN=2
```

#### **Log Management**
```bash
# Configure log rotation
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

#### **Database Optimization**
```bash
# PostgreSQL tuning
environment:
  - POSTGRES_SHARED_BUFFERS=128MB
  - POSTGRES_EFFECTIVE_CACHE_SIZE=256MB
```

## 📈 Scaling Considerations

### **Horizontal Scaling**
- Use external Redis for session storage
- Database clustering/replication
- Load balancer for multiple bot instances
- Shared file storage for WhatsApp sessions

### **Vertical Scaling**
- Increase container resource limits
- Optimize database pool settings
- Tune garbage collection settings
- Use SSD storage for better I/O

### **Monitoring at Scale**
- Prometheus + Grafana integration
- ELK stack for log aggregation
- Alert manager configuration
- Performance metrics collection

Dengan setup Docker ini, bot WhatsApp Anda akan memiliki infrastructure production-ready yang reliable, scalable, dan mudah di-maintain!