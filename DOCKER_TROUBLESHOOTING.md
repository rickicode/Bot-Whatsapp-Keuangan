# Docker Troubleshooting Guide

## Perbaikan Dockerfile dan Build Issues

Panduan ini menjelaskan perbaikan yang telah dilakukan untuk mengatasi masalah Docker dan cara menjalankan aplikasi dengan benar.

## 🔧 Perbaikan yang Telah Dilakukan

### 1. Dockerfile Improvements
- ✅ Menambahkan `bash` ke dependencies Alpine Linux
- ✅ Memperbaiki health check yang lebih sederhana
- ✅ Menggunakan `bash` sebagai default shell untuk CMD
- ✅ Memperbaiki permission handling untuk script startup

### 2. Docker Compose Enhancements
- ✅ Menambahkan health check untuk PostgreSQL
- ✅ Proper dependency management dengan `depends_on`
- ✅ Environment variable configuration yang lebih baik

### 3. Startup Script Fixes
- ✅ Non-interactive database setup untuk Docker
- ✅ Proper PostgreSQL connection waiting
- ✅ Environment variable detection
- ✅ Timeout handling untuk database connections

### 4. Database Setup Improvements
- ✅ Auto-detection environment mode (Docker vs local)
- ✅ Non-interactive setup untuk production
- ✅ Fallback configuration untuk error handling

## 🚀 Cara Menjalankan

### Development Mode (SQLite)
```bash
# Build dan jalankan untuk development
npm run docker:dev

# Lihat logs
npm run docker:dev-logs

# Stop containers
docker-compose -f docker-compose.dev.yml down
```

### Production Mode (PostgreSQL)
```bash
# Build image terlebih dahulu
npm run docker:build

# Jalankan production setup
npm run docker:prod

# Lihat logs
npm run docker:prod-logs

# Stop containers
npm run docker:stop
```

### Manual Docker Commands
```bash
# Build image saja
docker build -t whatsapp-financial-bot .

# Test build dengan script otomatis
./scripts/docker-build.sh

# Clean build (hapus cache)
./scripts/docker-build.sh --clean
```

## 🐛 Common Issues dan Solutions

### Issue 1: "bash: not found"
**Problem:** Alpine Linux tidak include bash by default
**Solution:** ✅ Sudah diperbaiki - menambahkan `bash` ke dependencies

### Issue 2: Health Check Gagal
**Problem:** Health check terlalu kompleks dan timeout
**Solution:** ✅ Sudah diperbaiki - health check sederhana

### Issue 3: PostgreSQL Connection Timeout
**Problem:** Bot start sebelum PostgreSQL ready
**Solution:** ✅ Sudah diperbaiki - menambahkan waiting logic dan health check

### Issue 4: Interactive Database Setup
**Problem:** Script setup meminta input saat di Docker
**Solution:** ✅ Sudah diperbaiki - auto-detection environment mode

### Issue 5: Permission Denied pada Scripts
**Problem:** Script tidak executable
**Solution:** ✅ Sudah diperbaiki - chmod +x dalam Dockerfile

## 📋 Verification Steps

### 1. Test Build
```bash
# Test apakah image bisa dibuild
npm run docker:build
```

### 2. Test Basic Functionality
```bash
# Test Node.js berjalan di container
docker run --rm whatsapp-financial-bot node -v
```

### 3. Test Database Setup
```bash
# Test database setup dengan SQLite
docker run --rm -e DATABASE_TYPE=sqlite3 -e NODE_ENV=production whatsapp-financial-bot node scripts/setup-database.js
```

### 4. Test Full Stack
```bash
# Development mode
npm run docker:dev
docker-compose -f docker-compose.dev.yml ps

# Production mode
npm run docker:prod
docker-compose ps
```

## 📊 Monitoring

### Check Container Status
```bash
# Lihat status containers
docker-compose ps

# Lihat resource usage
docker stats

# Lihat logs real-time
docker-compose logs -f whatsapp-bot
```

### Health Checks
```bash
# Manual health check
docker exec whatsapp-financial-bot node -e "console.log('Health OK')"

# PostgreSQL health check
docker exec postgres-financial-bot pg_isready -U botuser -d financial_bot
```

## 🔄 Clean Up Commands

```bash
# Stop dan hapus containers
npm run docker:clean

# Manual cleanup
docker-compose down --volumes --remove-orphans
docker system prune -f
docker volume prune -f
```

## 📝 Configuration Notes

### Environment Variables for Production
Pastikan environment variables berikut di-set untuk production:

```env
NODE_ENV=production
DATABASE_TYPE=postgresql
DB_HOST=postgres
DB_PORT=5432
DB_NAME=financial_bot
DB_USER=botuser
DB_PASSWORD=botpassword
DEEPSEEK_API_KEY=your_api_key_here
BOT_ADMIN_PHONE=+62xxxxxxxxxx
```

### Volume Mounts
- `./data:/app/data` - Database dan file data
- `./logs:/app/logs` - Log files
- `./backups:/app/backups` - Backup files

## 🎯 Next Steps

1. **Test the Build**: Jalankan `npm run docker:build`
2. **Development Testing**: Gunakan `npm run docker:dev`
3. **Production Deployment**: Gunakan `npm run docker:prod`
4. **Monitor Logs**: Gunakan `npm run docker:prod-logs`

## 📞 Jika Masih Ada Issues

1. Pastikan Docker dan Docker Compose terinstall
2. Cek Docker daemon berjalan: `docker ps`
3. Cek disk space: `df -h`
4. Cek logs detail: `docker-compose logs`
5. Reset semua: `npm run docker:clean` kemudian build ulang

---

**Status**: ✅ Semua major issues sudah diperbaiki
**Last Updated**: 2025-06-03