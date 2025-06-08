# Redis Session Management untuk WhatsApp Financial Bot

## Overview

Fitur Redis Session Management memungkinkan WhatsApp Financial Bot untuk menggunakan Redis sebagai penyimpanan session dengan PostgreSQL sebagai fallback. Ini meningkatkan performa dan skalabilitas untuk mengelola session WhatsApp dan registration session.

## Fitur Utama

### 1. **Dual Storage System**
- **Primary**: Redis (untuk performa tinggi)
- **Fallback**: PostgreSQL (untuk reliabilitas)
- **Auto-Fallback**: Otomatis beralih ke PostgreSQL jika Redis tidak tersedia

### 2. **Session Types yang Didukung**
- **WhatsApp Sessions**: Menyimpan kredensial dan data session WhatsApp
- **Registration Sessions**: Mengelola proses registrasi multi-step user

### 3. **High Availability**
- Deteksi otomatis Redis availability
- Seamless fallback ke PostgreSQL
- Data consistency antara Redis dan PostgreSQL

## Konfigurasi

### Environment Variables

Tambahkan konfigurasi berikut ke file `.env`:

```bash
# ================================
# REDIS CONFIGURATION FOR SESSION MANAGEMENT
# ================================
# Enable Redis for session storage
REDIS_ENABLED=true

# Redis Connection URL (recommended)
REDIS_URL=redis://localhost:6379

# Alternative: Individual Redis variables
# REDIS_HOST=localhost
# REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password_here
# REDIS_USERNAME=your_redis_username_here
# REDIS_DATABASE=0
# REDIS_CONNECT_TIMEOUT=5000
```

### Opsi Konfigurasi

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_ENABLED` | `false` | Enable/disable Redis untuk session |
| `REDIS_URL` | - | Redis connection URL (prioritas tertinggi) |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | - | Redis password (opsional) |
| `REDIS_USERNAME` | - | Redis username (opsional) |
| `REDIS_DATABASE` | `0` | Redis database number |
| `REDIS_CONNECT_TIMEOUT` | `5000` | Connection timeout dalam ms |

## Arsitektur

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   WhatsApp Bot  │───▶│  SessionManager  │───▶│  RedisDatabase   │
│                 │    │                  │    │                  │
└─────────────────┘    │                  │    └──────────────────┘
                       │                  │             │
                       │                  │             ▼ (fallback)
                       │                  │    ┌──────────────────┐
                       │                  │───▶│ PostgresDatabase │
                       │                  │    │                  │
                       └──────────────────┘    └──────────────────┘
```

## Komponen Utama

### 1. RedisDatabase Class
- Mengelola koneksi Redis
- Implementasi session storage methods
- Health monitoring dan error handling

### 2. SessionManager Class
- Orchestrator antara Redis dan PostgreSQL
- Automatic fallback logic
- Data synchronization

### 3. DatabaseManager Integration
- Transparent integration dengan existing code
- Backward compatibility
- Enhanced session methods

## Usage Examples

### Menggunakan SessionManager

```javascript
const DatabaseFactory = require('./src/database/DatabaseFactory');

// Create SessionManager
const sessionManager = DatabaseFactory.createSessionManager();

// Initialize dengan konfigurasi
const postgresConfig = DatabaseFactory.getPostgresConfig();
const redisConfig = DatabaseFactory.getRedisConfig();
await sessionManager.initialize(postgresConfig, redisConfig);

// WhatsApp Session Management
await sessionManager.saveWhatsAppSession('client-123', sessionData);
const session = await sessionManager.getWhatsAppSession('client-123');
await sessionManager.deleteWhatsAppSession('client-123');

// Registration Session Management
await sessionManager.createRegistrationSession('+62812345678');
const regSession = await sessionManager.getRegistrationSession('+62812345678');
await sessionManager.updateRegistrationSession('+62812345678', 'email', data);
await sessionManager.deleteRegistrationSession('+62812345678');
```

### Menggunakan DatabaseManager (Existing Code)

```javascript
const DatabaseManager = require('./src/database/DatabaseManager');

const dbManager = new DatabaseManager();
await dbManager.initialize(); // Otomatis menggunakan SessionManager

// Methods yang sudah ada tetap bekerja, sekarang dengan Redis support
await dbManager.createRegistrationSession(phone);
const session = await dbManager.getRegistrationSession(phone);
await dbManager.updateRegistrationSession(phone, step, data);
```

## Monitoring dan Health Check

### Health Check

```javascript
const health = await sessionManager.healthCheck();
console.log('Health Status:', health);

// Output example:
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "redis": {
    "enabled": true,
    "available": true,
    "status": "healthy",
    "responseTime": 15
  },
  "postgresql": {
    "status": "healthy",
    "responseTime": 25
  }
}
```

### Session Statistics

```javascript
const stats = await sessionManager.getSessionStats();
console.log('Session Stats:', stats);

// Output example:
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "redis": {
    "whatsappSessions": 15,
    "registrationSessions": 3,
    "totalSessions": 18
  },
  "postgresql": {
    "whatsappSessions": 15,
    "registrationSessions": 3
  }
}
```

## Data Structure

### WhatsApp Sessions (Redis)
```
Key: wa:client-id
Value: JSON string of session data
TTL: 24 hours (86400 seconds)
```

### Registration Sessions (Redis)
```
Key: reg:phone-number
Value: JSON object with:
{
  "phone": "+62812345678",
  "step": "email",
  "session_data": {...},
  "created_at": "ISO date",
  "expires_at": "ISO date"
}
TTL: 24 hours (86400 seconds)
```

## Fallback Behavior

### Kondisi Fallback ke PostgreSQL:
1. `REDIS_ENABLED=false` 
2. Redis server tidak tersedia
3. Redis connection error
4. Redis operation timeout

### Auto-Recovery:
- SessionManager secara berkala memeriksa Redis availability
- Otomatis kembali menggunakan Redis setelah pulih
- Data tetap sinkron antara Redis dan PostgreSQL

## Testing

Jalankan test untuk memverifikasi implementasi:

```bash
# Test Redis session management
node test-redis-session.js

# Test dengan environment specific
REDIS_ENABLED=true node test-redis-session.js
REDIS_ENABLED=false node test-redis-session.js
```

## Performance Benefits

### Dengan Redis:
- **Latency**: ~1-5ms untuk session operations
- **Throughput**: >10,000 ops/second
- **Memory**: Efficient key-value storage
- **Scalability**: Horizontal scaling ready

### Fallback PostgreSQL:
- **Latency**: ~10-50ms untuk session operations
- **Reliability**: ACID compliance
- **Persistence**: Durable storage
- **Consistency**: Strong consistency guarantees

## Best Practices

### 1. **Redis Configuration**
- Gunakan Redis dalam mode persistent untuk production
- Set up Redis clustering untuk high availability
- Monitor Redis memory usage

### 2. **Session Management**
- Set appropriate TTL untuk sessions
- Regular cleanup expired sessions
- Monitor session count dan memory usage

### 3. **Error Handling**
- Selalu handle Redis connection errors
- Implement retry logic untuk critical operations
- Log fallback events untuk monitoring

### 4. **Security**
- Gunakan Redis AUTH untuk production
- Enable SSL/TLS untuk Redis connections
- Limit Redis network access

## Troubleshooting

### Common Issues:

#### Redis Connection Failed
```bash
# Check Redis status
redis-cli ping

# Check connection string
echo $REDIS_URL
```

#### High Memory Usage
```bash
# Monitor Redis memory
redis-cli info memory

# Check session count
redis-cli dbsize
```

#### Session Data Inconsistency
```javascript
// Force cleanup dan sync
await sessionManager.cleanupExpiredRegistrationSessions();
```

## Migration Guide

### Dari PostgreSQL-only ke Redis+PostgreSQL:

1. **Install Redis dependency**:
   ```bash
   npm install redis@^4.7.0
   ```

2. **Update environment variables**:
   ```bash
   REDIS_ENABLED=true
   REDIS_URL=redis://localhost:6379
   ```

3. **No code changes required** - existing code automatically benefits from Redis

4. **Monitor performance** using health check dan statistics endpoints

## API Reference

### SessionManager Methods

#### WhatsApp Sessions
- `saveWhatsAppSession(clientId, sessionData)` - Save WhatsApp session
- `getWhatsAppSession(clientId)` - Retrieve WhatsApp session  
- `deleteWhatsAppSession(clientId)` - Delete WhatsApp session

#### Registration Sessions
- `createRegistrationSession(phone)` - Create new registration session
- `getRegistrationSession(phone)` - Get registration session
- `updateRegistrationSession(phone, step, data)` - Update registration session
- `deleteRegistrationSession(phone)` - Delete registration session

#### Management
- `cleanupExpiredRegistrationSessions()` - Cleanup expired sessions
- `healthCheck()` - Get health status
- `getSessionStats()` - Get session statistics
- `close()` - Close connections

---

**Catatan**: Fitur ini backward compatible - existing code akan tetap bekerja tanpa perubahan dan otomatis mendapat benefit dari Redis performance improvements.