# Curhat Database Setup Documentation

## Overview

Sistem AI Curhat Mode sekarang menggunakan PostgreSQL untuk menyimpan histori percakapan dengan fitur auto-cleanup 30 hari. Implementasi ini memberikan persistensi data yang reliable dengan performa optimal.

## Database Schema

### Tabel `curhat_history`

```sql
CREATE TABLE curhat_history (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    role VARCHAR(20) CHECK(role IN ('user', 'assistant', 'system')) NOT NULL,
    content TEXT NOT NULL,
    message_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_curhat_history_user_phone ON curhat_history(user_phone);
CREATE INDEX idx_curhat_history_session ON curhat_history(user_phone, session_id);
CREATE INDEX idx_curhat_history_timestamp ON curhat_history(message_timestamp DESC);
CREATE INDEX idx_curhat_history_created_at ON curhat_history(created_at DESC);
```

### Auto-Cleanup Function

```sql
CREATE OR REPLACE FUNCTION cleanup_old_curhat_history()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM curhat_history
    WHERE created_at < CURRENT_DATE - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
```

## Features

### 🔄 **Session Management**
- Session ID berbasis tanggal (`{phone}_{YYYY-MM-DD}`)
- Setiap hari mendapat session baru
- History tersimpan per session untuk konteks yang lebih baik

### 🧹 **Auto Cleanup (30 Hari)**
- Data otomatis terhapus setelah 30 hari
- PostgreSQL function untuk cleanup efisien
- Manual cleanup tersedia via script

### 📊 **Dual Storage Strategy**
- **Redis**: Cache untuk performa (1 jam expiry)
- **PostgreSQL**: Persistent storage dengan 30 hari retention
- Fallback otomatis jika Redis tidak tersedia

### 🔒 **Data Integrity**
- Foreign key constraint ke tabel `users`
- Cascade delete saat user dihapus
- Role validation (user, assistant, system)

## Setup Instructions

### 1. Database Migration

```bash
# Jalankan migration untuk membuat tabel
node scripts/migrate.js migrate
```

### 2. Setup Auto-Cleanup System

```bash
# Setup PostgreSQL function dan scripts
node scripts/setup-curhat-cleanup.js
```

### 3. Test Installation

```bash
# Test database integration
node scripts/test-curhat-database.js

# Test API functionality
node scripts/test-curhat-api.js
```

## Methods Overview

### SessionManager Methods

```javascript
// Simpan pesan individual
await sessionManager.saveCurhatMessage(phone, sessionId, role, content);

// Ambil history session
const history = await sessionManager.getCurhatSessionHistory(phone, sessionId);

// Clear session tertentu
await sessionManager.clearCurhatSession(phone, sessionId);

// Cleanup otomatis
await sessionManager.cleanupOldCurhatHistory(phone);
```

### PostgresDatabase Methods

```javascript
// Simpan pesan dengan auto-cleanup
await db.saveCurhatMessage(userPhone, sessionId, role, content);

// Ambil history dengan limit
const history = await db.getCurhatHistory(userPhone, sessionId, limit);

// Clear session
await db.clearCurhatSession(userPhone, sessionId);

// Manual cleanup
const deletedCount = await db.cleanupOldCurhatHistory(userPhone);

// Statistics
const stats = await db.getCurhatStats(userPhone, days);
```

## Maintenance

### Manual Cleanup

```bash
# Cleanup semua data lama
node scripts/cleanup-curhat.js
```

### Monitor Usage

```javascript
// Dapatkan statistik
const stats = await db.getCurhatStats(null, 7); // 7 hari terakhir

console.log('Total messages:', stats.total_messages);
console.log('Unique users:', stats.unique_users);
console.log('Unique sessions:', stats.unique_sessions);
```

## Performance Considerations

### 🚀 **Optimized for Speed**
- Indexed queries untuk retrieval cepat
- Session-based partitioning
- Redis caching untuk frequent access

### 💾 **Storage Efficient**
- 30 hari auto-cleanup
- Compressed text storage
- Index-only scans untuk queries umum

### 🔄 **Scalable Design**
- Connection pooling optimized
- Batch operations untuk cleanup
- Async processing

## Configuration

### Environment Variables

```env
# Redis (optional, fallback to PostgreSQL if not available)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL (required)
SUPABASE_DB_URL=your_postgres_connection_string

# AI Curhat
AI_CURHAT_ENABLED=true
AI_CURHAT_PROVIDER=openrouter
AI_CURHAT_MODEL=deepseek/deepseek-chat-v3-0324:free
```

## Migration from Old System

Sistem lama menggunakan Redis/settings table akan tetap kompatibel. Data lama akan dibersihkan secara bertahap saat user menggunakan curhat mode.

## Security

### 🔒 **Data Protection**
- Foreign key constraints
- Cascade delete untuk data consistency
- User isolation per phone number

### 🛡️ **Privacy**
- Auto-cleanup setelah 30 hari
- No persistent logging of sensitive content
- Session-based data segregation

## Troubleshooting

### Common Issues

1. **Foreign Key Constraint Error**
   ```
   Solution: Pastikan user exists di tabel users sebelum save curhat message
   ```

2. **Redis Connection Failed**
   ```
   Solution: Normal, sistem akan fallback ke PostgreSQL
   ```

3. **Cleanup Not Working**
   ```bash
   # Manual check dan run cleanup
   node scripts/cleanup-curhat.js
   ```

## Monitoring

### Health Checks

```javascript
// Check tabel status
const result = await db.sql`
    SELECT COUNT(*) as total_messages,
           COUNT(DISTINCT user_phone) as unique_users
    FROM curhat_history
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
`;
```

### Cleanup Monitoring

```javascript
// Monitor old data
const oldData = await db.sql`
    SELECT COUNT(*) as old_messages
    FROM curhat_history
    WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
`;
```

## Production Recommendations

1. **Scheduled Cleanup**: Jalankan cleanup harian via cron
2. **Monitoring**: Set up alerts untuk usage metrics
3. **Backup**: Include curhat_history dalam backup strategy
4. **Index Maintenance**: Monitor index usage dan performance

---

*Last Updated: June 8, 2025*
*Version: 1.0.0*