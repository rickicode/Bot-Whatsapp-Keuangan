# Optimisasi Database PostgreSQL - Panduan Lengkap

## Overview

Dokumen ini menjelaskan optimisasi yang telah dilakukan pada koneksi pooling PostgreSQL untuk meningkatkan performa dan efisiensi database pada aplikasi WhatsApp Financial Bot.

## Optimisasi yang Dilakukan

### 1. Enhanced Connection Pooling

#### Konfigurasi Pool yang Dioptimalkan
```javascript
const poolConfig = {
    // Basic connection settings
    host: this.config.host,
    port: this.config.port,
    database: this.config.database,
    user: this.config.user,
    password: this.config.password,
    
    // Optimized pool settings
    max: 25,                    // Maximum connections in pool
    min: 5,                     // Minimum connections to keep alive
    idleTimeoutMillis: 30000,   // 30 seconds before closing idle connections
    connectionTimeoutMillis: 5000, // 5 seconds to establish connection
    acquireTimeoutMillis: 10000,   // 10 seconds to acquire from pool
    createTimeoutMillis: 5000,     // 5 seconds to create new connection
    destroyTimeoutMillis: 5000,    // 5 seconds to destroy connection
    reapIntervalMillis: 1000,      // 1 second cleanup interval
    
    // Connection stability
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    
    // Query timeouts
    statement_timeout: 30000,   // 30 seconds for SQL statements
    query_timeout: 30000,       // 30 seconds for queries
    
    // Monitoring
    application_name: 'whatsapp-financial-bot'
};
```

### 2. Connection Retry Logic

#### Implementasi Retry dengan Exponential Backoff
- **Maximum Retries**: 3 attempts
- **Base Delay**: 100ms
- **Exponential Backoff**: Delay meningkat exponentially dengan jitter
- **Smart Error Detection**: Tidak retry untuk syntax error dan constraint violations

#### Error Patterns yang Tidak Akan Diretry:
- `syntax error`
- `column does not exist`
- `relation does not exist`
- `duplicate key value`
- `violates check constraint`
- `violates foreign key constraint`
- `violates unique constraint`

### 3. Pool Monitoring dan Health Check

#### Event Monitoring
- **connect**: Log ketika client baru terhubung
- **acquire**: Track penggunaan client dari pool
- **remove**: Monitor client yang dihapus dari pool
- **error**: Handle unexpected errors pada idle clients

#### Health Check Features
- **Response Time Monitoring**: Mengukur waktu response database
- **Pool Statistics**: Real-time statistics tentang penggunaan pool
- **Automatic Alerting**: Warning ketika utilisasi tinggi

### 4. Environment Variables untuk Tuning

Tambahkan ke file `.env` untuk fine-tuning performa:

```bash
# Database Pool Configuration
DB_POOL_MAX=25                    # Maximum connections
DB_POOL_MIN=5                     # Minimum connections
DB_IDLE_TIMEOUT=30000             # Idle timeout (ms)
DB_CONNECTION_TIMEOUT=5000        # Connection timeout (ms)
DB_ACQUIRE_TIMEOUT=10000          # Acquire timeout (ms)
DB_CREATE_TIMEOUT=5000            # Create timeout (ms)
DB_DESTROY_TIMEOUT=5000           # Destroy timeout (ms)
DB_REAP_INTERVAL=1000             # Cleanup interval (ms)
DB_CREATE_RETRY_INTERVAL=200      # Retry interval (ms)
DB_STATEMENT_TIMEOUT=30000        # Statement timeout (ms)
DB_QUERY_TIMEOUT=30000            # Query timeout (ms)
DEBUG_POOL=false                  # Enable pool debugging
```

## Monitoring Tools

### 1. Database Pool Monitor Script

Jalankan monitoring dengan perintah:

```bash
# Continuous monitoring
npm run monitor:pool

# Single health check
npm run monitor:check

# Generate detailed report
npm run monitor:report
```

### 2. Pool Statistics

Monitor statistik pool secara real-time:
- **Total Connections**: Jumlah total koneksi aktif
- **Idle Connections**: Koneksi yang tidak digunakan
- **Waiting Requests**: Request yang menunggu koneksi
- **Utilization Rate**: Persentase penggunaan pool

### 3. Automated Alerts

Sistem akan memberikan warning otomatis untuk:
- **High Utilization** (>80%): Pool usage tinggi
- **Very High Utilization** (>90%): Pool hampir penuh
- **Many Waiting Requests** (>5): Banyak request menunggu
- **Connection Errors**: Error koneksi database

## Performance Benefits

### Sebelum Optimisasi:
- **Pool Size**: 20 connections (fixed)
- **No Retry Logic**: Gagal langsung error
- **No Monitoring**: Tidak ada visibility pool usage
- **Basic Timeouts**: Timeout default yang tidak optimal

### Setelah Optimisasi:
- **Dynamic Pool**: Min 5, Max 25 connections
- **Smart Retry**: Automatic retry dengan backoff
- **Real-time Monitoring**: Pool statistics dan health checks
- **Optimized Timeouts**: Fine-tuned untuk berbagai scenarios
- **Better Error Handling**: Differentiated retry logic

### Hasil yang Diharapkan:
1. **Reduced Connection Errors**: Retry logic mengurangi error sementara
2. **Better Resource Utilization**: Pool dinamis menyesuaikan load
3. **Faster Response Times**: Connection pooling yang lebih efisien
4. **Improved Stability**: Health monitoring dan alerting
5. **Better Scalability**: Pool size dapat disesuaikan dengan kebutuhan

## Tuning Recommendations

### Untuk Traffic Rendah (< 100 users):
```bash
DB_POOL_MAX=15
DB_POOL_MIN=3
```

### Untuk Traffic Sedang (100-500 users):
```bash
DB_POOL_MAX=25
DB_POOL_MIN=5
```

### Untuk Traffic Tinggi (> 500 users):
```bash
DB_POOL_MAX=50
DB_POOL_MIN=10
DB_IDLE_TIMEOUT=60000
```

### Untuk Development:
```bash
DB_POOL_MAX=10
DB_POOL_MIN=2
DEBUG_POOL=true
```

## Troubleshooting

### Problem: Pool Utilization Tinggi
**Solution**: Increase `DB_POOL_MAX` atau optimize queries

### Problem: Banyak Waiting Requests
**Solution**: 
- Increase pool size
- Check untuk long-running queries
- Optimize database indexes

### Problem: Connection Timeouts
**Solution**:
- Increase `DB_CONNECTION_TIMEOUT`
- Check network connectivity
- Verify database server capacity

### Problem: Memory Usage Tinggi
**Solution**:
- Decrease `DB_POOL_MAX`
- Increase `DB_IDLE_TIMEOUT` untuk cleanup lebih cepat

## Monitoring Best Practices

1. **Regular Health Checks**: Jalankan health check minimal setiap jam
2. **Pool Statistics Logging**: Monitor pool usage patterns
3. **Alert Setup**: Set up alerts untuk utilization > 80%
4. **Performance Baselines**: Establish baseline metrics untuk comparison
5. **Regular Tuning**: Review dan adjust pool settings berdasarkan usage patterns

## Migration Guide

Untuk mengaplikasikan optimisasi ini pada deployment yang sudah ada:

1. **Update Environment Variables**: Add pool configuration ke `.env`
2. **Test Pool Settings**: Jalankan monitoring untuk verify settings
3. **Gradual Rollout**: Implement di development dulu, kemudian production
4. **Monitor Closely**: Watch metrics selama 24-48 jam pertama
5. **Fine-tune**: Adjust settings berdasarkan real usage patterns

## Kesimpulan

Optimisasi database pooling ini memberikan foundation yang solid untuk aplikasi yang scalable dan reliable. Dengan proper monitoring dan tuning, performa database akan meningkat signifikan terutama pada high-load scenarios.

Monitoring tools yang disediakan memungkinkan real-time visibility ke pool performance, sehingga issues dapat dideteksi dan diselesaikan proactively.