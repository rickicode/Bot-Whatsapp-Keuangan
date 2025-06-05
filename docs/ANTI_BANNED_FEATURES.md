# Anti-Banned Features & Typing Manager

Dokumentasi lengkap untuk fitur anti-banned dan typing manager yang telah ditambahkan ke WhatsApp Financial Bot.

## 🛡️ Fitur Anti-Banned

### Overview
Sistem anti-banned yang komprehensif untuk mencegah WhatsApp bot dari banned dengan mendeteksi dan mencegah pola behavior yang mencurigakan.

### Fitur Utama

#### 1. Ban Risk Detection
- **4 Level Risiko**: LOW, MEDIUM, HIGH, CRITICAL
- **Real-time Assessment**: Penilaian risiko setiap 5 menit
- **Multiple Factors**: Volume pesan, pola mencurigakan, rapid fire incidents

#### 2. Bot Pattern Detection
- **Identical Responses**: Deteksi respons identik berlebihan
- **Response Timing**: Analisis waktu respons yang terlalu cepat
- **Consistency Analysis**: Deteksi pola waktu respons yang terlalu konsisten

#### 3. Natural Behavior Simulation
- **Reading Time**: Kalkulasi waktu baca berdasarkan panjang pesan
- **Thinking Time**: Simulasi waktu berpikir sebelum merespons
- **Random Delays**: Variasi acak untuk naturalness

#### 4. Enhanced Rate Limiting
- **Conservative Limits**: Limit yang lebih konservatif untuk keamanan
- **Dynamic Throttling**: Throttling berdasarkan risk level
- **Emergency Brake**: Sistem pengereman darurat

### Configuration

Environment variables untuk mengkonfigurasi fitur anti-banned:

```env
# Anti-Banned Detection
ANTI_BANNED_DETECTION=true
ANTI_BANNED_NATURAL_DELAYS=true
ANTI_BANNED_RESPONSE_VARIATION=true

# Ban Risk Thresholds
BAN_RISK_PATTERN_COUNT=5
BAN_RISK_RAPID_RESPONSE=10
BAN_RISK_IDENTICAL_RESPONSE=3
BAN_RISK_HOURLY_MAX=400

# Natural Delays (in milliseconds)
NATURAL_DELAY_MIN=500
NATURAL_DELAY_MAX=3000
READING_TIME_PER_CHAR=30
THINKING_TIME=2000

# Enhanced Rate Limits
ANTI_SPAM_USER_PER_MINUTE=8
ANTI_SPAM_USER_PER_HOUR=60
ANTI_SPAM_GLOBAL_PER_MINUTE=30
ANTI_SPAM_GLOBAL_PER_HOUR=600
ANTI_SPAM_EMERGENCY_THRESHOLD=50
```

### Risk Level Behaviors

#### LOW Risk (Normal Operation)
- Normal rate limits berlaku
- Minimal delays diterapkan
- Full fitur tersedia

#### MEDIUM Risk (Moderate Restriction)
- 1 pesan per menit per user
- Natural delays diperpanjang
- Monitoring ditingkatkan

#### HIGH Risk (Severe Restriction)
- 1 pesan per 2 menit per user
- Extended delays
- Limited functionality

#### CRITICAL Risk (Emergency Mode)
- Semua outgoing messages dihentikan
- 10 menit cooldown
- System maintenance mode

## ⌨️ Typing Manager

### Overview
Sistem typing indicator yang natural untuk mensimulasikan behavior manusia dan menghindari deteksi bot.

### Fitur Utama

#### 1. Natural Typing Simulation
- **Dynamic Duration**: Durasi typing berdasarkan panjang pesan
- **Character-based Calculation**: 50ms per karakter
- **Complexity Awareness**: Extra time untuk angka, emoji, dan karakter khusus

#### 2. Queue Management
- **Message Queuing**: Antrian pesan saat typing sedang berlangsung
- **Concurrent Limits**: Maksimal 3 typing concurrent
- **Auto-cleanup**: Pembersihan otomatis queue expired

#### 3. Human-like Patterns
- **Random Variation**: 30% variasi untuk naturalness
- **Pause Between Messages**: Jeda antar pesan
- **Presence Simulation**: Simulasi presence status

#### 4. Anti-Detection Features
- **Typing Spoof**: Spoofing typing patterns
- **Natural Pauses**: Jeda natural dalam typing
- **Response Variation**: Variasi waktu respons

### Configuration

Environment variables untuk typing manager:

```env
# Typing Durations (in milliseconds)
TYPING_BASE_DURATION=1000
TYPING_PER_CHAR=50
TYPING_MAX_DURATION=8000
TYPING_MIN_DURATION=500

# Typing Behavior
TYPING_RANDOM_VARIATION=0.3
TYPING_PAUSE_BETWEEN=500
TYPING_NATURAL=true
TYPING_RANDOM_PAUSES=true

# Anti-Detection
TYPING_SPOOF=true
TYPING_MAX_CONCURRENT=3
```

### Usage Examples

#### Basic Usage
```javascript
// Send with typing indicator
await typingManager.sendWithTyping(userJid, "Hello! How can I help you?");

// Send multiple messages with natural delays
await typingManager.sendMultipleWithTyping(userJid, [
    "Processing your request...",
    "Here are your results:",
    "Let me know if you need anything else!"
]);
```

#### Advanced Features
```javascript
// Simulate human presence
await typingManager.simulateHumanPresence(userJid, 30000);

// Check typing status
if (typingManager.isTypingTo(userJid)) {
    console.log("Already typing to this user");
}

// Get statistics
const stats = typingManager.getStats();
console.log("Active typing:", stats.activeTyping);
```

## 📊 Monitoring & Statistics

### Health Check Endpoint
```bash
GET /health
```

Response includes:
```json
{
    "antiSpam": {
        "banRiskLevel": "LOW",
        "emergencyBrakeActive": false,
        "messagesPerMinute": 15
    },
    "typing": {
        "activeTyping": 2,
        "queuedMessages": 5
    }
}
```

### Anti-Spam Stats
```bash
GET /anti-spam/stats
```

### Typing Stats
```bash
GET /typing/stats
```

### Emergency Controls
```bash
# Reset emergency brake
POST /anti-spam/reset-emergency

# Stop all typing
POST /typing/stop-all

# Remove user cooldown
POST /anti-spam/remove-cooldown/{phone}
```

## 🚨 Alert System

### Critical Alerts
- **CRITICAL Ban Risk**: Semua messages dihentikan
- **Emergency Brake**: Rate limit global terlampaui
- **Bot Pattern Detection**: Pola bot terdeteksi

### Warning Alerts
- **HIGH Ban Risk**: Throttling severe
- **MEDIUM Ban Risk**: Throttling moderate
- **Suspicious Patterns**: Pola mencurigakan terdeteksi

## 🔧 Best Practices

### 1. Configuration
- Gunakan rate limits yang konservatif
- Enable semua fitur anti-banned
- Monitor ban risk level secara regular

### 2. Monitoring
- Setup alerting untuk CRITICAL risk level
- Monitor emergency brake triggers
- Track suspicious pattern trends

### 3. Maintenance
- Regular cleanup expired data
- Monitor memory usage
- Update thresholds berdasarkan usage patterns

### 4. Incident Response
- CRITICAL risk: Stop bot operations
- HIGH risk: Investigate patterns
- Emergency brake: Check global limits

## 📈 Performance Impact

### Memory Usage
- Typing Manager: ~1-5MB
- Enhanced Anti-Spam: ~2-10MB
- Pattern Detection: ~5-20MB

### CPU Impact
- Real-time analysis: ~1-3% CPU
- Pattern detection: ~2-5% CPU
- Natural delays: Minimal impact

### Network Impact
- Typing indicators: +~10% traffic
- Natural delays: Reduced burst traffic
- Overall: More distributed load

## 🔍 Troubleshooting

### Common Issues

#### 1. Messages Not Sending
- Check ban risk level
- Verify rate limits
- Check emergency brake status

#### 2. Typing Not Working
- Verify socket connection
- Check typing manager initialization
- Monitor queue status

#### 3. High Memory Usage
- Enable auto-cleanup
- Check pattern detection data
- Monitor queue sizes

### Debug Commands
```bash
# Check current status
curl http://localhost:3000/health

# View anti-spam stats
curl http://localhost:3000/anti-spam/stats

# View typing stats
curl http://localhost:3000/typing/stats
```

## 🆕 Future Enhancements

### Planned Features
1. **Machine Learning**: ML-based pattern detection
2. **Adaptive Limits**: Dynamic rate limit adjustment
3. **Advanced Analytics**: Behavioral analysis dashboard
4. **Integration**: Third-party monitoring tools

### Experimental Features
1. **Voice Message Simulation**: Typing for voice messages
2. **Media Typing**: Different typing for media types
3. **Group Behavior**: Group-specific patterns
4. **Time-based Patterns**: Activity based on time of day

---

## 📞 Support

Untuk pertanyaan atau masalah terkait fitur anti-banned:

1. Check health endpoint terlebih dahulu
2. Review logs untuk error patterns
3. Monitor ban risk level trends
4. Contact support dengan diagnostic info

**Remember**: Fitur ini dirancang untuk mencegah banned, namun tidak menjamin 100%. Selalu gunakan dengan bijak dan patuhi terms of service WhatsApp.