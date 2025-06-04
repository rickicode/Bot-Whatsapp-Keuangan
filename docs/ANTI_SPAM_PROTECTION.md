# Anti-Spam Protection System - Mencegah WhatsApp Ban

## Overview

Sistem Anti-Spam yang komprehensif untuk melindungi bot dari WhatsApp ban dengan mencegah flood/spam messages dan mendeteksi pola penggunaan yang mencurigakan.

## 🚨 Mengapa Anti-Spam Penting?

WhatsApp memiliki sistem deteksi otomatis yang dapat mem-ban nomor yang:
1. **Mengirim terlalu banyak pesan dalam waktu singkat**
2. **Mengirim pesan duplikat berulang kali**
3. **Memiliki pola penggunaan yang mencurigakan**
4. **Menggunakan WhatsApp Business API secara tidak wajar**

**Tanpa proteksi anti-spam, bot bisa di-ban permanen oleh WhatsApp!**

## 🛡️ Fitur Anti-Spam System

### 1. **Rate Limiting per User**
```javascript
// Default limits
ANTI_SPAM_USER_PER_MINUTE=10    // 10 pesan per menit per user
ANTI_SPAM_USER_PER_HOUR=100     // 100 pesan per jam per user
```

### 2. **Global Rate Limiting**
```javascript
// Global limits untuk semua user
ANTI_SPAM_GLOBAL_PER_MINUTE=50  // 50 pesan per menit (semua user)
ANTI_SPAM_GLOBAL_PER_HOUR=1000  // 1000 pesan per jam (semua user)
```

### 3. **Duplicate Message Detection**
```javascript
ANTI_SPAM_MAX_DUPLICATES=3      // Max 3 pesan duplikat
ANTI_SPAM_DUPLICATE_WINDOW=60000 // Dalam window 1 menit
```

### 4. **Rapid Fire Protection**
```javascript
ANTI_SPAM_RAPID_FIRE=5          // 5 pesan cepat
ANTI_SPAM_RAPID_FIRE_WINDOW=10000 // Dalam 10 detik
```

### 5. **Emergency Brake System**
```javascript
ANTI_SPAM_EMERGENCY_BRAKE=true   // Enable emergency brake
ANTI_SPAM_EMERGENCY_THRESHOLD=100 // Trigger pada 100 msg/menit
```

### 6. **Cooldown System**
```javascript
ANTI_SPAM_USER_COOLDOWN=5       // 5 menit cooldown untuk user
ANTI_SPAM_GLOBAL_COOLDOWN=2     // 2 menit global cooldown
```

## 📊 Monitoring & Management

### Real-time Monitoring

```bash
# Lihat statistik real-time
npm run antispam:stats

# Monitor secara kontinyu (update setiap 30 detik)
npm run antispam:monitor

# Monitor dengan interval custom (15 detik)
npm run antispam:monitor 15
```

### Emergency Commands

```bash
# Reset emergency brake
npm run antispam:reset

# Remove cooldown untuk user tertentu
npm run antispam:cooldown +6281234567890
```

### Web Dashboard

Akses monitoring melalui browser:
```
http://localhost:3000/anti-spam/stats
```

Response contoh:
```json
{
  "status": "OK",
  "timestamp": "2025-06-04T05:46:36.000Z",
  "stats": {
    "global": {
      "totalMessages": 1247,
      "messagesPerMinute": 12,
      "emergencyBrakeActive": false
    },
    "users": {
      "total": 45,
      "inCooldown": 2,
      "activeUsers": 12
    },
    "config": {
      "maxMessagesPerMinute": 10,
      "maxGlobalMessagesPerMinute": 50,
      "emergencyBrakeThreshold": 100
    }
  }
}
```

## 🔧 Configuration

### Environment Variables

Tambahkan ke `.env`:

```bash
# Anti-Spam & Rate Limiting (Critical for WhatsApp Ban Prevention)
ANTI_SPAM_USER_PER_MINUTE=10          # Max messages per user per minute
ANTI_SPAM_USER_PER_HOUR=100           # Max messages per user per hour
ANTI_SPAM_MAX_DUPLICATES=3            # Max duplicate messages allowed
ANTI_SPAM_GLOBAL_PER_MINUTE=50        # Global limit per minute (all users)
ANTI_SPAM_GLOBAL_PER_HOUR=1000        # Global limit per hour (all users)
ANTI_SPAM_DUPLICATE_WINDOW=60000      # Window for duplicate detection (ms)
ANTI_SPAM_RAPID_FIRE=5                # Max rapid fire messages
ANTI_SPAM_RAPID_FIRE_WINDOW=10000     # Rapid fire detection window (ms)
ANTI_SPAM_USER_COOLDOWN=5             # User cooldown period (minutes)
ANTI_SPAM_GLOBAL_COOLDOWN=2           # Global cooldown period (minutes)
ANTI_SPAM_EMERGENCY_BRAKE=true        # Enable emergency brake
ANTI_SPAM_EMERGENCY_THRESHOLD=100     # Emergency brake threshold (msg/min)
```

### Recommended Settings by Environment

#### Development
```bash
ANTI_SPAM_USER_PER_MINUTE=20
ANTI_SPAM_GLOBAL_PER_MINUTE=100
ANTI_SPAM_EMERGENCY_BRAKE=false
```

#### Staging
```bash
ANTI_SPAM_USER_PER_MINUTE=15
ANTI_SPAM_GLOBAL_PER_MINUTE=75
ANTI_SPAM_EMERGENCY_BRAKE=true
```

#### Production
```bash
ANTI_SPAM_USER_PER_MINUTE=10
ANTI_SPAM_GLOBAL_PER_MINUTE=50
ANTI_SPAM_EMERGENCY_BRAKE=true
ANTI_SPAM_EMERGENCY_THRESHOLD=80
```

## 🚨 Alert System

### System Alerts

Bot akan mendeteksi dan memberikan peringatan untuk:

#### 1. **Emergency Brake Triggered**
```
🚨 CRITICAL: Emergency brake is active!
```
**Action**: Stop semua outgoing messages, cek apakah ada loop atau spam attack

#### 2. **Global Rate Limit Near Threshold**
```
⚠️ WARNING: Global rate limit near threshold
```
**Action**: Monitor lebih ketat, siapkan untuk scale down

#### 3. **Many Users in Cooldown**
```
⚠️ WARNING: Many users are in cooldown
```
**Action**: Cek apakah ada masalah pada bot atau serangan spam

### User Messages saat Rate Limited

#### User Per-Minute Limit
```
🚫 Terlalu banyak pesan (10/menit). Cooldown 5 menit.
```

#### Duplicate Spam
```
🔄 Pesan duplikat terdeteksi. Silakan tunggu 1 menit.
```

#### Rapid Fire
```
⚡ Pesan terlalu cepat (5 dalam 10s). Silakan pelan-pelan.
```

#### Emergency Brake
```
🚨 Sistem dalam mode darurat. Silakan tunggu beberapa menit.
```

## 🔍 Debugging Anti-Spam Issues

### Common Issues

#### 1. **Bot Tidak Merespons sama sekali**

**Kemungkinan**: Emergency brake aktif

**Debugging**:
```bash
npm run antispam:stats
```

Cari: `"emergencyBrakeActive": true`

**Solusi**:
```bash
npm run antispam:reset
```

#### 2. **User Komplain Tidak Bisa Kirim Pesan**

**Kemungkinan**: User dalam cooldown

**Debugging**:
```bash
npm run antispam:stats
```

Cari: `"inCooldown": [number > 0]`

**Solusi**:
```bash
npm run antispam:cooldown +6281234567890
```

#### 3. **Banyak User dalam Cooldown**

**Kemungkinan**: Serangan spam atau bot loop

**Debugging**:
```bash
# Check logs untuk pattern
grep "🛡️.*blocked" logs/app.log | tail -20

# Check session yang stuck
npm run cleanup:detail
```

**Solusi**:
```bash
# Cleanup sessions
npm run cleanup:force

# Reset emergency brake
npm run antispam:reset
```

### Monitoring Commands

```bash
# Real-time monitoring
npm run antispam:monitor

# Check specific stats
curl http://localhost:3000/anti-spam/stats | jq .

# Check logs untuk anti-spam events
grep "Anti-spam" logs/app.log
grep "🛡️" logs/app.log
grep "🚨" logs/app.log
```

## 📈 Performance Impact

### Memory Usage
- **Session Storage**: ~1KB per active user
- **Message History**: ~100 bytes per message (last hour only)
- **Total Overhead**: < 1MB untuk 1000+ users

### CPU Impact
- **Per Message**: < 1ms overhead
- **Cleanup Tasks**: Runs every 5 minutes, < 10ms
- **Total Impact**: Negligible

### Network Impact
- **No external calls**
- **Local processing only**
- **Zero latency added**

## 🎯 Best Practices

### 1. **Admin Bypass**
Pastikan admin phone number di-configure untuk bypass:
```bash
BOT_ADMIN_PHONE=+6281234567890
```

### 2. **Graceful Degradation**
Anti-spam akan fail-safe jika ada error:
```javascript
// Jika error, allow message dan log error
return { allowed: true, reason: 'error_failsafe' };
```

### 3. **Logging Strategy**
Semua anti-spam events di-log untuk audit:
```
🛡️ Incoming message blocked for 6281234567890: user_rate_limit_minute
🛡️ Outgoing message blocked for 6281234567890: global_rate_limit_minute
🚨 CRITICAL: Global rate limit reached, stopping outgoing messages
```

### 4. **Regular Monitoring**
Set up monitoring dashboard untuk track:
- Messages per minute
- Users in cooldown
- Emergency brake status
- Error rates

### 5. **Alerting Setup**
Integrate dengan monitoring system:
```bash
# Example: Send alert jika emergency brake active
curl -X POST http://localhost:3000/anti-spam/stats | \
jq -r '.stats.global.emergencyBrakeActive' | \
if [ "true" ]; then
  # Send alert to Slack/Discord/Email
  echo "ALERT: WhatsApp Bot Emergency Brake Active!"
fi
```

## 🔄 Integration dengan Existing Code

### Auto-Integration
Anti-spam system sudah terintegrasi otomatis di:

1. **Message Handling** (`src/index.js`)
   - Check incoming messages
   - Check outgoing replies
   - Block messages yang melanggar rules

2. **API Endpoints** (`src/index.js`)
   - `/anti-spam/stats` - Statistics
   - `/anti-spam/reset-emergency` - Reset emergency brake
   - `/anti-spam/remove-cooldown/:phone` - Remove user cooldown

3. **Periodic Cleanup** (`src/index.js`)
   - Auto cleanup expired data
   - Memory management
   - Performance optimization

### Manual Integration untuk Custom Replies

Jika ada custom reply function:

```javascript
const antiSpam = require('./src/utils/AntiSpamManager');

async function customReply(userPhone, message) {
    // Check before sending
    const check = await antiSpam.checkMessageAllowed(userPhone, message, true);
    if (!check.allowed) {
        console.log('Message blocked:', check.reason);
        return;
    }
    
    // Send message
    await sendMessage(userPhone, message);
}
```

## 📋 Troubleshooting Checklist

### Pre-deployment
- [ ] Anti-spam environment variables configured
- [ ] Emergency brake enabled for production
- [ ] Admin phone numbers configured
- [ ] Monitoring endpoints accessible

### Daily Monitoring
- [ ] Check emergency brake status
- [ ] Monitor users in cooldown
- [ ] Review anti-spam logs
- [ ] Check global message rates

### Weekly Maintenance
- [ ] Review rate limit settings
- [ ] Analyze usage patterns
- [ ] Update thresholds if needed
- [ ] Test emergency procedures

### Monthly Review
- [ ] Analyze ban incidents (if any)
- [ ] Review and adjust limits
- [ ] Performance optimization
- [ ] Update documentation

Dengan sistem anti-spam ini, bot akan terlindungi dari WhatsApp ban dan dapat beroperasi dengan aman dalam jangka panjang.