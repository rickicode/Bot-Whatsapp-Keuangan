# 📝 Logging Configuration Guide

Panduan lengkap untuk konfigurasi logging dalam WhatsApp Financial Bot.

## 📊 **LOG LEVELS YANG TERSEDIA**

Sistem menggunakan 4 level logging berdasarkan tingkat kepentingan:

### 1. **ERROR** (Level 0) - Paling Kritis
```bash
LOG_LEVEL=error
```
- ✅ **Kapan digunakan**: Production environment dengan traffic tinggi
- ✅ **Yang dicatat**: Hanya critical errors dan exceptions
- ✅ **Contoh**: Database connection failures, API errors, system crashes
- ⚡ **Performance**: Minimal overhead, optimal untuk production

### 2. **WARN** (Level 1) - Peringatan + Error
```bash
LOG_LEVEL=warn
```
- ✅ **Kapan digunakan**: Production environment (recommended)
- ✅ **Yang dicatat**: Warnings + semua error logs
- ✅ **Contoh**: Connection retries, deprecated features, rate limiting
- ⚡ **Performance**: Low overhead, good balance untuk production

### 3. **INFO** (Level 2) - Informasi + Warn + Error (DEFAULT)
```bash
LOG_LEVEL=info
```
- ✅ **Kapan digunakan**: Staging environment dan development
- ✅ **Yang dicatat**: General information + warnings + errors
- ✅ **Contoh**: User registrations, transactions, system status
- ⚡ **Performance**: Moderate overhead, good untuk monitoring

### 4. **DEBUG** (Level 3) - Semua Log (Paling Verbose)
```bash
LOG_LEVEL=debug
```
- ✅ **Kapan digunakan**: Development dan troubleshooting
- ✅ **Yang dicatat**: Detailed debugging info + semua level lainnya
- ✅ **Contoh**: SQL queries, API requests/responses, internal state
- ⚠️ **Performance**: High overhead, hindari di production

## 🎯 **REKOMENDASI PER ENVIRONMENT**

### **Development Environment**
```bash
LOG_LEVEL=debug
DEBUG_POOL=true
LOG_FILE=./logs/dev.log
```
**Benefit**: Maximum visibility untuk debugging dan development

### **Staging Environment**
```bash
LOG_LEVEL=info
DEBUG_POOL=false
LOG_FILE=./logs/staging.log
```
**Benefit**: Balanced logging untuk testing tanpa performance impact

### **Production Environment**
```bash
LOG_LEVEL=warn
DEBUG_POOL=false
LOG_FILE=./logs/production.log
LOG_ROTATION_SIZE=50M
LOG_RETENTION_DAYS=7
```
**Benefit**: Optimal performance dengan essential logging

### **High-Traffic Production**
```bash
LOG_LEVEL=error
DEBUG_POOL=false
LOG_FILE=./logs/prod-critical.log
LOG_ROTATION_SIZE=100M
LOG_RETENTION_DAYS=3
```
**Benefit**: Minimal overhead untuk maximum performance

## 📁 **LOG FILES CONFIGURATION**

### **Main Application Logs**
```bash
LOG_FILE=./logs/app.log           # Main application events
API_LOG_FILE=./logs/api.log       # API requests/responses
WEBHOOK_LOG_FILE=./logs/webhook.log  # Webhook activities
```

### **Log Rotation Settings**
```bash
LOG_ROTATION_SIZE=50M             # Auto-rotate when file reaches 50MB
LOG_RETENTION_DAYS=7              # Keep logs for 7 days
```

### **Advanced Options**
```bash
LOG_FORMAT=json                   # Structured logging (future feature)
LOG_TIMESTAMP_FORMAT=ISO          # ISO format timestamps
LOG_INCLUDE_PID=true              # Include process ID
LOG_INCLUDE_HOSTNAME=false        # Include server hostname
```

## 🔍 **LOG OUTPUT EXAMPLES**

### **ERROR Level Output**
```
[2025-01-15 10:30:25] [1234] [ERROR] Database connection failed: Connection timeout
[2025-01-15 10:30:26] [1234] [ERROR] Failed to process transaction for user +6281234567890
```

### **WARN Level Output**
```
[2025-01-15 10:30:25] [1234] [ERROR] Database connection failed: Connection timeout
[2025-01-15 10:30:26] [1234] [WARN] Connection retry attempt 2/3 for PostgreSQL
[2025-01-15 10:30:27] [1234] [WARN] Pool utilization high: 85%
```

### **INFO Level Output**
```
[2025-01-15 10:30:25] [1234] [ERROR] Database connection failed: Connection timeout
[2025-01-15 10:30:26] [1234] [WARN] Connection retry attempt 2/3 for PostgreSQL
[2025-01-15 10:30:27] [1234] [INFO] User +6281234567890 registered successfully
[2025-01-15 10:30:28] [1234] [INFO] Transaction added: Rp 50,000 - Makanan
```

### **DEBUG Level Output**
```
[2025-01-15 10:30:25] [1234] [ERROR] Database connection failed: Connection timeout
[2025-01-15 10:30:26] [1234] [WARN] Connection retry attempt 2/3 for PostgreSQL
[2025-01-15 10:30:27] [1234] [INFO] User +6281234567890 registered successfully
[2025-01-15 10:30:28] [1234] [DEBUG] Executing SQL: INSERT INTO transactions (user_phone, amount, type) VALUES ($1, $2, $3)
[2025-01-15 10:30:29] [1234] [DEBUG] Pool stats: {totalCount: 5, idleCount: 3, waitingCount: 0}
```

## ⚡ **PERFORMANCE IMPACT**

### **Log Level Performance Comparison**
| Level | CPU Impact | Disk I/O | Memory | Production Use |
|-------|------------|----------|--------|----------------|
| error | Minimal (1%) | Very Low | Low | ✅ Excellent |
| warn  | Low (3%) | Low | Low | ✅ Recommended |
| info  | Moderate (8%) | Medium | Medium | ⚠️ Acceptable |
| debug | High (15-25%) | High | High | ❌ Avoid |

### **Disk Space Usage (Per Day)**
- **error**: ~10-50 MB/day
- **warn**: ~50-200 MB/day  
- **info**: ~200-500 MB/day
- **debug**: ~1-5 GB/day

## 🛠 **LOG MANAGEMENT COMMANDS**

### **Monitor Logs Real-time**
```bash
# Watch main application logs
tail -f logs/app.log

# Watch specific log level
tail -f logs/app.log | grep ERROR

# Watch multiple logs
tail -f logs/*.log
```

### **Log Analysis**
```bash
# Count errors in last hour
grep "$(date '+%Y-%m-%d %H:')" logs/app.log | grep ERROR | wc -l

# Find specific user logs
grep "+6281234567890" logs/app.log

# Check pool performance logs
grep "Pool stats" logs/app.log
```

### **Log Cleanup**
```bash
# Manual cleanup (older than 7 days)
find logs/ -name "*.log" -mtime +7 -delete

# Compress old logs
gzip logs/*.log.2025-01-*
```

## 🚨 **MONITORING & ALERTS**

### **Critical Log Patterns to Monitor**
```bash
# Database errors
grep "Database.*error\|Connection.*failed" logs/app.log

# High error rates
grep ERROR logs/app.log | tail -100

# Pool issues
grep "Pool.*error\|Pool utilization.*9[0-9]%" logs/app.log

# WhatsApp connection issues
grep "WhatsApp.*disconnect\|Session.*expired" logs/app.log
```

### **Automated Monitoring Setup**
```bash
# Set up log monitoring (example)
LOG_LEVEL=warn
ENABLE_LOG_MONITORING=true
LOG_ERROR_THRESHOLD=50        # Alert if >50 errors/hour
LOG_WARN_THRESHOLD=200        # Alert if >200 warnings/hour
```

## 📋 **TROUBLESHOOTING GUIDE**

### **Common Issues & Solutions**

#### **1. Logs Not Appearing**
```bash
# Check log directory permissions
ls -la logs/
chmod 755 logs/
chmod 644 logs/*.log
```

#### **2. Log Files Too Large**
```bash
# Reduce log level
LOG_LEVEL=warn  # Instead of info or debug

# Increase rotation frequency
LOG_ROTATION_SIZE=10M  # Instead of 50M
```

#### **3. Performance Issues**
```bash
# Switch to error-only logging
LOG_LEVEL=error

# Disable debug features
DEBUG_POOL=false
DEBUG=false
```

#### **4. Missing Critical Information**
```bash
# Temporarily increase log level
LOG_LEVEL=info  # Or debug for detailed troubleshooting

# Enable specific debugging
DEBUG_POOL=true  # For database issues
```

## 🎯 **BEST PRACTICES**

### **✅ DO**
- Use `warn` level untuk production
- Monitor disk space untuk log files
- Set up log rotation
- Use `debug` level hanya untuk troubleshooting
- Regular cleanup old logs

### **❌ DON'T**
- Jangan gunakan `debug` di production
- Jangan log sensitive data (passwords, tokens)
- Jangan abaikan disk space warnings
- Jangan lupa rotate logs

---

**📚 Related Documentation:**
- [PostgreSQL Transaction Pooler Optimization](POSTGRESQL_TRANSACTION_POOLER_OPTIMIZATION.md)
- [Pool Performance Monitoring](../scripts/monitor-pool-performance.js)