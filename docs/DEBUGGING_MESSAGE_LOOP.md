# Debugging Message Loop Issues - Panduan Lengkap

## Overview Masalah

Bot WhatsApp mengalami masalah infinite loop di mana pesan yang dikirim bot sendiri diproses sebagai pesan masuk, menyebabkan:

1. **Logging Salah**: Pesan bot ditampilkan sebagai "Message from [user]" padahal itu adalah "Bot reply to [user]"
2. **Infinite Loop**: Bot memproses pesan sendiri berulang-ulang
3. **Pending Transactions Stuck**: User terjebak dalam session kategori yang tidak pernah selesai

## Solusi yang Telah Diterapkan

### 1. **Message Direction Detection**

Di [`src/index.js`](../src/index.js) telah ditambahkan:

```javascript
// Check if this is an outgoing message (sent by bot)
const isFromMe = message.key.fromMe;
if (isFromMe) {
    // This is a message sent by the bot, don't process it
    return;
}
```

**Fungsi**: Mencegah bot memproses pesannya sendiri dengan memeriksa `message.key.fromMe`.

### 2. **Improved Logging**

```javascript
// Log incoming message (only from users, not bot responses)
this.logger.info(`📨 Received from ${userPhone}: ${messageText}`);

// Log outgoing message from bot  
this.logger.info(`📤 Bot reply to ${userPhone}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
```

**Fungsi**: 
- `📨 Received` = Pesan dari user ke bot
- `📤 Bot reply` = Pesan dari bot ke user
- Membatasi log panjang (100 karakter) untuk readability

### 3. **Session Timeout dan Retry Limits**

Di [`src/handlers/CommandHandler.js`](../src/handlers/CommandHandler.js):

```javascript
// Reduced timeout to 3 minutes (was 5 minutes)
if (Date.now() - pending.timestamp > 180000) {
    global.pendingTransactions.delete(userPhone);
    this.logger.info(`Pending transaction for ${userPhone} expired and cleaned up`);
    return true;
}

// Added retry counter with max 3 attempts
if (!pending.retryCount) {
    pending.retryCount = 0;
}
pending.retryCount++;

if (pending.retryCount > 3) {
    global.pendingTransactions.delete(userPhone);
    this.logger.warn(`Max retry attempts reached for ${userPhone}, cleaning up`);
    return true;
}
```

**Fungsi**: 
- Timeout lebih pendek (3 menit vs 5 menit)
- Max 3 percobaan per session
- Auto cleanup session yang stuck

### 4. **Cancel Commands**

```javascript
// Handle cancel commands
if (trimmedText === 'batal' || trimmedText === 'cancel' || trimmedText === 'stop') {
    global.pendingTransactions.delete(userPhone);
    await message.reply('❌ Konfirmasi kategori dibatalkan.');
    return true;
}
```

**Fungsi**: User dapat membatalkan session dengan mengetik "batal", "cancel", atau "stop".

### 5. **Better Error Responses**

```javascript
const remainingAttempts = 3 - pending.retryCount;
await message.reply(
    `❌ Kategori tidak valid. Silakan pilih nomor yang benar atau ketik nama kategori yang ada.\n\n` +
    `📋 Kategori yang tersedia:\n` +
    pending.categories.map((cat, index) => `${index + 1}. ${cat.name}`).join('\n') +
    `\n\n💡 Sisa percobaan: ${remainingAttempts}\n` +
    `Ketik "batal" untuk membatalkan.`
);
```

**Fungsi**: 
- Menampilkan sisa percobaan
- Reminder kategori yang tersedia
- Opsi untuk membatalkan

### 6. **Periodic Cleanup**

Di [`src/index.js`](../src/index.js):

```javascript
setupPeriodicCleanup() {
    setInterval(() => {
        // Clean up expired sessions every 2 minutes
        // - pending transactions (3+ minutes old)
        // - edit sessions (10+ minutes old)  
        // - delete confirmations (5+ minutes old)
        // - auto categorization suggestions (10+ minutes old)
    }, 120000); // Every 2 minutes
}
```

**Fungsi**: Automatic cleanup setiap 2 menit untuk mencegah memory leak dan session yang stuck.

## Tools untuk Debugging

### 1. **Session Cleanup Script**

```bash
# Lihat statistik session aktif
npm run cleanup:stats

# Cleanup session yang expired
npm run cleanup:sessions  

# Force cleanup SEMUA session
npm run cleanup:force

# Lihat detail lengkap session
npm run cleanup:detail
```

### 2. **Database Pool Monitoring**

```bash
# Monitor pool secara real-time
npm run monitor:pool

# Health check database
npm run monitor:check

# Generate performance report
npm run monitor:report
```

### 3. **PostgreSQL Pool Testing**

```bash
# Test koneksi PostgreSQL pool
npm run test:postgres-pool
```

## Debugging Checklist

### Ketika Bot Tidak Merespons:

1. **Check Session Statistics**:
   ```bash
   npm run cleanup:stats
   ```

2. **Check Database Health**:
   ```bash
   npm run monitor:check
   ```

3. **Check Logs untuk Error Pattern**:
   ```bash
   grep "📨 Received" logs/app.log | tail -10
   grep "📤 Bot reply" logs/app.log | tail -10
   ```

### Ketika User Stuck di Session:

1. **Check Detail Session**:
   ```bash
   npm run cleanup:detail
   ```

2. **Force Cleanup jika Perlu**:
   ```bash
   npm run cleanup:force
   ```

3. **Check Retry Count pada Logs**:
   ```bash
   grep "Max retry attempts" logs/app.log
   ```

### Ketika Infinite Loop Terjadi:

1. **Check Message Direction**:
   - Log harus menunjukkan `📨 Received` untuk user input
   - Log harus menunjukkan `📤 Bot reply` untuk bot response
   - Jika masih ada `📨 Received` untuk bot response, ada bug pada `message.key.fromMe`

2. **Stop Bot dan Cleanup**:
   ```bash
   # Stop bot process
   pkill -f "node src/index.js"
   
   # Start dan force cleanup
   npm run cleanup:force
   npm start
   ```

## Monitoring dan Prevention

### 1. **Real-time Monitoring**

Set up monitoring dashboard untuk:
- Session count trends
- Database pool utilization
- Message processing rates
- Error rates

### 2. **Alerting**

Set alerts untuk:
- Session count > 10 (possible stuck sessions)
- High database pool utilization (>80%)
- Repeated error patterns
- Memory usage spikes

### 3. **Regular Maintenance**

Jalankan cleanup secara berkala:
```bash
# Daily cleanup (bisa ditambah ke cron)
0 2 * * * cd /path/to/bot && npm run cleanup:sessions

# Weekly force cleanup
0 3 * * 0 cd /path/to/bot && npm run cleanup:force
```

## Common Issues dan Solusi

### Issue: "❌ Kategori tidak valid" Loop

**Gejala**: User terus menerima pesan error kategori
**Solusi**: 
1. Check dengan `npm run cleanup:detail`
2. Jika retry count tinggi, gunakan `npm run cleanup:force`
3. User dapat ketik "batal" untuk keluar

### Issue: Bot Tidak Merespons sama sekali

**Gejala**: User kirim pesan tapi tidak ada response
**Solusi**:
1. Check database health: `npm run monitor:check`
2. Check session stats: `npm run cleanup:stats`
3. Restart bot dengan cleanup: `npm run cleanup:force && npm start`

### Issue: Database Connection Errors

**Gejala**: Error koneksi ke PostgreSQL
**Solusi**:
1. Test pool: `npm run test:postgres-pool`
2. Check pool stats: `npm run monitor:report`
3. Adjust pool settings di `.env`

### Issue: Memory Leak dari Sessions

**Gejala**: Memory usage terus naik
**Solusi**:
1. Monitor dengan `npm run cleanup:stats`
2. Pastikan periodic cleanup berjalan
3. Check logs untuk cleanup messages: `grep "Periodic cleanup" logs/app.log`

## Best Practices

1. **Always Check `fromMe`**: Setiap message handler harus cek `message.key.fromMe`
2. **Set Timeouts**: Semua user sessions harus punya timeout
3. **Implement Retry Limits**: Max attempts untuk mencegah infinite retry
4. **Cleanup Regularly**: Periodic cleanup untuk expired sessions
5. **Monitor Sessions**: Regular monitoring untuk detect stuck sessions
6. **Graceful Error Handling**: Provide cara untuk user keluar dari stuck state
7. **Detailed Logging**: Separate log untuk incoming vs outgoing messages

## Environment Variables untuk Debugging

```bash
# Enable detailed logging
DEBUG=true
LOG_LEVEL=debug

# Reduce session timeouts for faster debugging
PENDING_TRANSACTION_TIMEOUT=120000  # 2 minutes instead of 3
EDIT_SESSION_TIMEOUT=300000         # 5 minutes instead of 10

# Enable pool debugging
DEBUG_POOL=true
```

Dengan implementasi fixes ini, bot seharusnya tidak lagi mengalami infinite loop dan user stuck sessions.