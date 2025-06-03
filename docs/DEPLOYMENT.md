# Deployment Guide - WhatsApp Financial Bot

## 🚀 Production Deployment Options

### Option 1: VPS/Cloud Server (Recommended)

#### Requirements
- **CPU**: 1+ cores
- **RAM**: 1GB minimum, 2GB recommended
- **Storage**: 10GB+ SSD
- **OS**: Ubuntu 20.04 LTS or newer
- **Node.js**: 16+ LTS version
- **Network**: Stable internet connection

#### Supported Platforms
- **DigitalOcean** - Droplets
- **AWS EC2** - t3.micro or larger
- **Google Cloud** - Compute Engine
- **Azure** - Virtual Machines
- **Vultr** - Cloud Compute
- **Linode** - Shared CPU instances

### Option 2: Docker Deployment

#### Docker Setup
```bash
# Create Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  whatsapp-bot:
    build: .
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./backups:/app/backups
    environment:
      - NODE_ENV=production
    env_file:
      - .env
```

## 🛠️ Step-by-Step Deployment

### 1. Server Setup

#### Ubuntu Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git
sudo apt install git -y

# Create application user
sudo adduser --system --group whatsapp-bot
sudo usermod -aG sudo whatsapp-bot
```

#### Security Setup
```bash
# Configure firewall
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw enable

# Setup fail2ban (optional)
sudo apt install fail2ban -y
```

### 2. Application Deployment

#### Clone and Setup
```bash
# Switch to app user
sudo su - whatsapp-bot

# Clone repository
git clone <your-repository-url> /home/whatsapp-bot/app
cd /home/whatsapp-bot/app

# Install dependencies
npm ci --only=production

# Run setup
npm run setup
```

#### Environment Configuration
```bash
# Copy and edit environment file
cp .env.example .env
nano .env
```

**Production .env example:**
```env
# Bot Configuration
BOT_NAME=Production Financial Bot
BOT_ADMIN_PHONE=+1234567890

# DeepSeek AI
DEEPSEEK_API_KEY=sk-your-real-api-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Database
DB_PATH=/home/whatsapp-bot/app/data/financial.db
BACKUP_PATH=/home/whatsapp-bot/app/backups

# Server
PORT=3000
NODE_ENV=production

# Security
ENCRYPTION_KEY=your-32-character-secure-key-here
ALLOWED_USERS=+1234567890,+0987654321

# Features
ENABLE_AI_FEATURES=true
ENABLE_OCR=false
ENABLE_REMINDERS=true
DEFAULT_CURRENCY=IDR

# Logging
LOG_LEVEL=info
LOG_FILE=/home/whatsapp-bot/app/logs/app.log
```

### 3. Process Management with PM2

#### PM2 Configuration
Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'whatsapp-financial-bot',
    script: 'src/index.js',
    cwd: '/home/whatsapp-bot/app',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/whatsapp-bot/app/logs/pm2-error.log',
    out_file: '/home/whatsapp-bot/app/logs/pm2-out.log',
    log_file: '/home/whatsapp-bot/app/logs/pm2-combined.log',
    time: true,
    restart_delay: 5000,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

#### Start with PM2
```bash
# Start the application
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Follow the instructions provided by PM2

# Check status
pm2 status
pm2 logs whatsapp-financial-bot
```

### 4. Database Setup

#### Production Database Configuration
```bash
# Ensure proper permissions
chmod 755 /home/whatsapp-bot/app/data
chmod 644 /home/whatsapp-bot/app/data/financial.db

# Setup backup directory
mkdir -p /home/whatsapp-bot/app/backups
chmod 755 /home/whatsapp-bot/app/backups
```

#### Database Backup Automation
```bash
# Add to crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /usr/bin/node /home/whatsapp-bot/app/scripts/backup.js >> /home/whatsapp-bot/app/logs/backup.log 2>&1
```

### 5. SSL/HTTPS Setup (Optional)

#### Nginx Reverse Proxy
```bash
# Install Nginx
sudo apt install nginx -y

# Configure Nginx
sudo nano /etc/nginx/sites-available/whatsapp-bot
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/whatsapp-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

## 📊 Monitoring & Maintenance

### Log Management

#### Log Rotation
```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/whatsapp-bot
```

```
/home/whatsapp-bot/app/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 whatsapp-bot whatsapp-bot
    postrotate
        pm2 reload whatsapp-financial-bot
    endscript
}
```

#### Monitoring Commands
```bash
# Check application status
pm2 status
pm2 monit

# View logs
pm2 logs whatsapp-financial-bot --lines 100

# Check system resources
htop
df -h
free -h

# Check application health
curl http://localhost:3000/health
```

### Performance Optimization

#### System Optimization
```bash
# Increase file descriptor limits
echo "* soft nofile 65535" >> /etc/security/limits.conf
echo "* hard nofile 65535" >> /etc/security/limits.conf

# Optimize Node.js memory
export NODE_OPTIONS="--max-old-space-size=1024"
```

#### Database Optimization
```bash
# Regular database maintenance
sqlite3 /path/to/financial.db "VACUUM;"
sqlite3 /path/to/financial.db "REINDEX;"
```

### Backup Strategy

#### Automated Backups
```bash
#!/bin/bash
# backup-script.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/whatsapp-bot/app/backups"
DB_PATH="/home/whatsapp-bot/app/data/financial.db"

# Create backup
cp $DB_PATH $BACKUP_DIR/financial_$DATE.db

# Compress old backups (older than 7 days)
find $BACKUP_DIR -name "*.db" -mtime +7 -exec gzip {} \;

# Remove very old backups (older than 90 days)
find $BACKUP_DIR -name "*.gz" -mtime +90 -delete

# Upload to cloud storage (optional)
# aws s3 cp $BACKUP_DIR/financial_$DATE.db s3://your-bucket/backups/
```

#### Remote Backup Setup
```bash
# Setup AWS CLI for S3 backups
sudo apt install awscli -y
aws configure

# Or setup rsync for remote backup
rsync -avz /home/whatsapp-bot/app/backups/ user@backup-server:/backups/whatsapp-bot/
```

## 🔒 Security Best Practices

### Server Security

#### Firewall Configuration
```bash
# Basic firewall rules
sudo ufw deny incoming
sudo ufw allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw enable
```

#### SSH Security
```bash
# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no
sudo systemctl restart ssh
```

### Application Security

#### Environment Variables
- Store sensitive data in environment variables
- Use strong encryption keys (32+ characters)
- Rotate API keys regularly
- Limit user access with ALLOWED_USERS

#### Data Protection
```bash
# Set proper file permissions
chmod 600 .env
chmod 755 data/
chmod 644 data/financial.db
chmod 755 logs/
chmod 755 backups/
```

## 🚨 Troubleshooting

### Common Deployment Issues

#### WhatsApp Connection Issues
```bash
# Clear WhatsApp session
rm -rf .wwebjs_auth/
pm2 restart whatsapp-financial-bot

# Check if Chromium dependencies are installed
sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
```

#### Memory Issues
```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Increase swap if needed
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### Database Issues
```bash
# Check database integrity
sqlite3 /path/to/financial.db "PRAGMA integrity_check;"

# Backup and restore if corrupted
cp financial.db financial_corrupted.db
sqlite3 financial_corrupted.db ".dump" | sqlite3 financial_new.db
```

### Monitoring Commands

#### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Process status
pm2 status
systemctl status nginx

# Resource usage
htop
iostat
netstat -tulpn
```

#### Log Analysis
```bash
# Check application logs
tail -f /home/whatsapp-bot/app/logs/app.log

# Check PM2 logs
pm2 logs whatsapp-financial-bot

# Check system logs
sudo journalctl -f
sudo tail -f /var/log/syslog
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx/HAProxy)
- Database clustering (PostgreSQL)
- Redis for session management
- Multiple bot instances

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Enable caching
- Use CDN for static assets

### Performance Monitoring
- Setup monitoring tools (Grafana, Prometheus)
- Application performance monitoring (New Relic, DataDog)
- Database monitoring
- Server monitoring

---

**Remember**: Always test deployments in staging environment first!