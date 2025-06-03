# Deployment Guide - Bot WhatsApp Keuangan

## 🚀 Pilihan Deployment

Bot WhatsApp Keuangan mendukung berbagai platform deployment dengan dua pilihan database:
- **SQLite3** (default, untuk deployment sederhana)
- **PostgreSQL** (untuk production dengan skalabilitas tinggi)

## 📋 Persiapan

### 1. Environment Variables
Copy `.env.example` ke `.env` dan sesuaikan konfigurasi:

```bash
cp .env.example .env
```

### 2. Database Configuration

#### SQLite3 (Sederhana)
```env
DATABASE_TYPE=sqlite3
DB_PATH=./data/financial.db
```

#### PostgreSQL (Production)
```env
DATABASE_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=financial_bot
DB_USER=botuser
DB_PASSWORD=botpassword
DB_SSL=false
```

## 🐳 Docker Deployment

### 1. Production dengan Docker Compose
```bash
# Clone repository
git clone <repository-url>
cd whatsapp-financial-bot

# Setup environment
cp .env.example .env
# Edit .env sesuai kebutuhan

# Start dengan PostgreSQL (akan otomatis run setup)
docker-compose up -d
```

### 2. Development dengan Docker
```bash
# Start development environment (akan otomatis run setup)
docker-compose -f docker-compose.dev.yml up -d

# Access pgAdmin: http://localhost:8080
# Login: admin@financialbot.com / admin123
```

### 3. Build Custom Image
```bash
# Build image
docker build -t whatsapp-financial-bot .

# Run container (setup sudah included dalam build)
docker run -d \
  --name whatsapp-bot \
  -e DATABASE_TYPE=sqlite3 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  whatsapp-financial-bot
```

## ☁️ Cloud Deployment

### 1. Heroku (Buildpacks)

#### Deploy Button
[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

#### Manual Deployment
```bash
# Install Heroku CLI
# Login dan create app
heroku login
heroku create your-bot-name

# Set environment variables
heroku config:set DATABASE_TYPE=postgresql
heroku config:set ENABLE_AI_FEATURES=true
heroku config:set DEEPSEEK_API_KEY=your_api_key

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Deploy
git push heroku main
```

### 2. Railway (Nixpacks)

1. Connect GitHub repository di [Railway](https://railway.app)
2. Railway akan otomatis detect `nixpacks.toml`
3. Add PostgreSQL service
4. Set environment variables:
   ```
   DATABASE_TYPE=postgresql
   ENABLE_AI_FEATURES=true
   DEEPSEEK_API_KEY=your_api_key
   ```

### 3. Render

1. Create new Web Service di [Render](https://render.com)
2. Connect GitHub repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add PostgreSQL database
6. Set environment variables

### 4. DigitalOcean App Platform

```yaml
# .do/app.yaml
name: whatsapp-financial-bot
services:
- name: web
  source_dir: /
  github:
    repo: your-username/whatsapp-financial-bot
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: DATABASE_TYPE
    value: postgresql
  - key: ENABLE_AI_FEATURES
    value: "true"
databases:
- engine: PG
  name: financial-db
  num_nodes: 1
  size: db-s-dev-database
  version: "15"
```

## 🖥️ VPS/Server Deployment

### 1. Ubuntu/Debian Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL (optional)
sudo apt install postgresql postgresql-contrib

# Setup PostgreSQL
sudo -u postgres createuser --interactive
sudo -u postgres createdb financial_bot

# Clone dan setup aplikasi
git clone <repository-url>
cd whatsapp-financial-bot
npm install
cp .env.example .env
# Edit .env

# Setup aplikasi dan database
npm run setup
npm run setup-db

# Install PM2 untuk process management
sudo npm install -g pm2

# Start aplikasi
pm2 start src/index.js --name whatsapp-bot
pm2 startup
pm2 save
```

### 2. Dengan Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/whatsapp-bot
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

## 🔧 Konfigurasi Khusus

### 1. Environment Variables Penting

```env
# Database
DATABASE_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=financial_bot
DB_USER=botuser
DB_PASSWORD=secure_password

# AI Features
ENABLE_AI_FEATURES=true
DEEPSEEK_API_KEY=your_deepseek_api_key

# Security
ALLOWED_USERS=+62812345678900
ENCRYPTION_KEY=your_32_character_key

# Puppeteer (untuk cloud deployment)
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 2. Database Migration

```bash
# Setup database pertama kali
npm run setup-db

# Backup database
npm run backup

# Manual PostgreSQL backup
pg_dump -U botuser -d financial_bot > backup.sql
```

## 📱 Konfigurasi WhatsApp

1. Jalankan bot pertama kali
2. Scan QR code yang muncul dengan WhatsApp Web
3. Bot akan tersimpan session secara otomatis
4. Restart tidak perlu scan ulang

## 🔒 Security Best Practices

1. **Environment Variables**: Jangan commit `.env` ke repository
2. **Database**: Gunakan password yang kuat
3. **HTTPS**: Setup SSL/TLS untuk production
4. **Firewall**: Batasi akses ke port database
5. **Updates**: Selalu update dependencies
6. **Backup**: Setup backup otomatis database

## 📊 Monitoring

### 1. Logs
```bash
# Docker logs
docker logs whatsapp-financial-bot

# PM2 logs
pm2 logs whatsapp-bot

# File logs
tail -f logs/app.log
```

### 2. Database Monitoring
```sql
-- PostgreSQL
SELECT * FROM pg_stat_activity;

-- Check database size
SELECT pg_size_pretty(pg_database_size('financial_bot'));
```

## 🆘 Troubleshooting

### 1. Common Issues

**WhatsApp tidak connect:**
- Hapus folder session: `rm -rf data/whatsapp-session`
- Restart bot dan scan QR code ulang

**Database connection failed:**
- Cek environment variables
- Pastikan database service berjalan
- Cek network connectivity

**Memory issues:**
- Upgrade instance size
- Setup swap (untuk VPS kecil)
- Monitor memory usage

### 2. Performance Optimization

```javascript
// PM2 ecosystem file
module.exports = {
  apps: [{
    name: 'whatsapp-bot',
    script: 'src/index.js',
    instances: 1,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## 📞 Support

Jika mengalami masalah deployment:

1. Cek logs aplikasi
2. Verifikasi environment variables
3. Test koneksi database
4. Cek dokumentasi platform deployment
5. Buat issue di repository dengan detail error

---

**Bot WhatsApp Keuangan siap untuk production dengan dukungan SQLite3 dan PostgreSQL!** 🚀