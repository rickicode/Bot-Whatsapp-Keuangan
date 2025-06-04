# Webhook Guide - WhatsApp Financial Bot

## Overview

Webhook memungkinkan sistem eksternal untuk mengirim notifikasi dan trigger aksi ke WhatsApp Financial Bot. Bot akan memproses webhook dan melakukan aksi yang sesuai, seperti mengirim pesan, update status, atau menjalankan command.

## Webhook Endpoint

**POST** `/api/webhook`

Semua webhook dikirim ke endpoint ini dengan struktur yang sama:

```json
{
  "event": "event_type",
  "data": {
    // Event-specific data
  }
}
```

## Authentication

Webhook menggunakan autentikasi yang sama dengan API lainnya:
- Header: `X-API-Key: your_api_key_here`
- Query: `?api_key=your_api_key_here`

## Supported Events

### 1. Message Status Update

Update status pengiriman pesan yang telah dikirim melalui API.

**Event**: `message_status`

```json
{
  "event": "message_status",
  "data": {
    "messageId": "BAE5F4A7B8C9D1E2F3",
    "status": "delivered",
    "phoneNumber": "6281234567890",
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

**Supported Status Values:**
- `sent`: Pesan berhasil dikirim
- `delivered`: Pesan sudah sampai ke device
- `read`: Pesan sudah dibaca
- `failed`: Pengiriman gagal

**Response:**
```json
{
  "success": true,
  "webhookId": "webhook_1642678200000_abc123def",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "processed": {
    "updated": true,
    "messageId": "BAE5F4A7B8C9D1E2F3",
    "status": "delivered"
  }
}
```

### 2. User Action Trigger

Trigger aksi tertentu untuk user, seperti pengiriman reminder atau notifikasi.

**Event**: `user_action`

```json
{
  "event": "user_action",
  "data": {
    "phoneNumber": "6281234567890",
    "action": "send_reminder",
    "context": {
      "message": "Jangan lupa bayar tagihan listrik hari ini!",
      "priority": "high",
      "category": "bills"
    }
  }
}
```

**Supported Actions:**
- `send_reminder`: Kirim pesan pengingat
- `send_notification`: Kirim notifikasi umum
- `trigger_report`: Trigger pembuatan laporan
- `update_balance`: Update saldo user

**Response:**
```json
{
  "success": true,
  "webhookId": "webhook_1642678200000_abc123def",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "processed": {
    "action": "send_reminder",
    "executed": true
  }
}
```

### 3. Payment Notification

Notifikasi pembayaran dari sistem payment gateway atau bank.

**Event**: `payment_notification`

```json
{
  "event": "payment_notification",
  "data": {
    "phoneNumber": "6281234567890",
    "amount": 150000,
    "status": "success",
    "transactionId": "TRX123456789",
    "paymentMethod": "bank_transfer",
    "description": "Pembayaran tagihan listrik",
    "timestamp": "2024-01-20T10:30:00.000Z"
  }
}
```

**Status Values:**
- `success`: Pembayaran berhasil
- `pending`: Pembayaran pending
- `failed`: Pembayaran gagal
- `cancelled`: Pembayaran dibatalkan

**Bot akan mengirim pesan:**
```
💰 *Notifikasi Pembayaran*

ID Transaksi: TRX123456789
Jumlah: Rp 150.000
Status: success
Metode: bank_transfer
Deskripsi: Pembayaran tagihan listrik
Waktu: 20/01/2024 17:30:00
```

### 4. Reminder Trigger

Trigger pengiriman reminder berdasarkan schedule atau event tertentu.

**Event**: `reminder_trigger`

```json
{
  "event": "reminder_trigger",
  "data": {
    "phoneNumber": "6281234567890",
    "reminderText": "Saatnya review pengeluaran bulanan",
    "type": "monthly",
    "category": "review",
    "dueDate": "2024-01-31",
    "metadata": {
      "amount": 0,
      "source": "scheduled_task"
    }
  }
}
```

**Reminder Types:**
- `daily`: Pengingat harian
- `weekly`: Pengingat mingguan
- `monthly`: Pengingat bulanan
- `custom`: Pengingat custom
- `bill`: Pengingat tagihan
- `debt`: Pengingat hutang

**Bot akan mengirim pesan:**
```
⏰ *Pengingat monthly*

Saatnya review pengeluaran bulanan

📅 Jatuh tempo: 31/01/2024
📂 Kategori: review
```

### 5. External Command

Eksekusi command bot dari sistem eksternal.

**Event**: `external_command`

```json
{
  "event": "external_command",
  "data": {
    "phoneNumber": "6281234567890",
    "command": "/laporan bulan ini",
    "parameters": {
      "month": "current",
      "format": "summary"
    },
    "source": "web_dashboard",
    "userId": "user123"
  }
}
```

**Supported Commands:**
- `/laporan [period]`: Generate laporan
- `/saldo`: Cek saldo
- `/kategori`: Kelola kategori
- `/reminder [action]`: Kelola reminder
- `/backup`: Backup data
- `/help`: Bantuan

**Bot akan memproses command dan mengirim response sesuai command.**

### 6. System Alert

Alert dari sistem monitoring atau maintenance.

**Event**: `system_alert`

```json
{
  "event": "system_alert",
  "data": {
    "phoneNumber": "6281234567890",
    "alertType": "maintenance",
    "message": "Sistem akan maintenance pada tanggal 25 Januari 2024 pukul 02:00-04:00 WIB",
    "severity": "info",
    "scheduledTime": "2024-01-25T02:00:00.000Z"
  }
}
```

**Alert Types:**
- `maintenance`: Maintenance schedule
- `error`: System error
- `warning`: System warning
- `info`: Informasi umum

### 7. Transaction Sync

Sinkronisasi transaksi dari sistem eksternal (bank, e-wallet, dll).

**Event**: `transaction_sync`

```json
{
  "event": "transaction_sync",
  "data": {
    "phoneNumber": "6281234567890",
    "transactions": [
      {
        "id": "ext_txn_123",
        "amount": -50000,
        "description": "Transfer ke Bank ABC",
        "category": "transfer",
        "date": "2024-01-20T10:30:00.000Z",
        "source": "bank_api"
      },
      {
        "id": "ext_txn_124",
        "amount": 500000,
        "description": "Gaji bulan Januari",
        "category": "income",
        "date": "2024-01-20T09:00:00.000Z",
        "source": "bank_api"
      }
    ],
    "source": "bank_integration",
    "syncTime": "2024-01-20T10:35:00.000Z"
  }
}
```

## Implementation Examples

### 1. Payment Gateway Integration

```javascript
// Contoh integrasi dengan payment gateway
const axios = require('axios');

class PaymentWebhookHandler {
  constructor(botApiKey, botBaseUrl) {
    this.botApiKey = botApiKey;
    this.botBaseUrl = botBaseUrl;
  }

  async handlePaymentSuccess(paymentData) {
    const webhookPayload = {
      event: 'payment_notification',
      data: {
        phoneNumber: paymentData.customer_phone,
        amount: paymentData.amount,
        status: 'success',
        transactionId: paymentData.transaction_id,
        paymentMethod: paymentData.payment_method,
        description: paymentData.description,
        timestamp: new Date().toISOString()
      }
    };

    try {
      const response = await axios.post(
        `${this.botBaseUrl}/api/webhook`,
        webhookPayload,
        {
          headers: {
            'X-API-Key': this.botApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Payment notification sent to bot:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to send payment notification:', error);
      throw error;
    }
  }

  async handlePaymentFailed(paymentData) {
    const webhookPayload = {
      event: 'payment_notification',
      data: {
        phoneNumber: paymentData.customer_phone,
        amount: paymentData.amount,
        status: 'failed',
        transactionId: paymentData.transaction_id,
        paymentMethod: paymentData.payment_method,
        description: `Payment failed: ${paymentData.failure_reason}`,
        timestamp: new Date().toISOString()
      }
    };

    return this.sendWebhook(webhookPayload);
  }
}

// Usage in your payment webhook endpoint
app.post('/payment/webhook', async (req, res) => {
  const paymentHandler = new PaymentWebhookHandler(
    process.env.BOT_API_KEY,
    process.env.BOT_BASE_URL
  );

  if (req.body.status === 'success') {
    await paymentHandler.handlePaymentSuccess(req.body);
  } else if (req.body.status === 'failed') {
    await paymentHandler.handlePaymentFailed(req.body);
  }

  res.json({ status: 'received' });
});
```

### 2. Scheduled Reminder System

```javascript
// Sistem reminder terjadwal menggunakan cron
const cron = require('node-cron');
const axios = require('axios');

class ReminderScheduler {
  constructor(botApiKey, botBaseUrl) {
    this.botApiKey = botApiKey;
    this.botBaseUrl = botBaseUrl;
  }

  async sendReminder(phoneNumber, reminderText, type, metadata = {}) {
    const webhookPayload = {
      event: 'reminder_trigger',
      data: {
        phoneNumber,
        reminderText,
        type,
        metadata,
        timestamp: new Date().toISOString()
      }
    };

    try {
      const response = await axios.post(
        `${this.botBaseUrl}/api/webhook`,
        webhookPayload,
        {
          headers: {
            'X-API-Key': this.botApiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Failed to send reminder:', error);
      throw error;
    }
  }

  setupScheduledReminders() {
    // Reminder harian untuk review transaksi
    cron.schedule('0 20 * * *', async () => {
      const users = await this.getActiveUsers(); // Implementasi sesuai database Anda
      
      for (const user of users) {
        await this.sendReminder(
          user.phoneNumber,
          'Jangan lupa review transaksi hari ini dan catat pengeluaran yang belum tercatat!',
          'daily',
          { source: 'scheduled_daily_review' }
        );
      }
    });

    // Reminder mingguan untuk laporan
    cron.schedule('0 9 * * 1', async () => {
      const users = await this.getActiveUsers();
      
      for (const user of users) {
        await this.sendReminder(
          user.phoneNumber,
          'Saatnya melihat laporan pengeluaran minggu lalu. Ketik /laporan minggu untuk melihat summary.',
          'weekly',
          { source: 'scheduled_weekly_report' }
        );
      }
    });

    // Reminder bulanan untuk budget review
    cron.schedule('0 9 1 * *', async () => {
      const users = await this.getActiveUsers();
      
      for (const user of users) {
        await this.sendReminder(
          user.phoneNumber,
          'Bulan baru dimulai! Saatnya review budget dan set target pengeluaran bulan ini.',
          'monthly',
          { source: 'scheduled_monthly_budget' }
        );
      }
    });
  }

  async getActiveUsers() {
    // Implementasi untuk mendapatkan list user aktif
    // Sesuaikan dengan struktur database Anda
    return [
      { phoneNumber: '6281234567890' },
      { phoneNumber: '6281234567891' }
    ];
  }
}

// Inisialisasi scheduler
const scheduler = new ReminderScheduler(
  process.env.BOT_API_KEY,
  process.env.BOT_BASE_URL
);

scheduler.setupScheduledReminders();
```

### 3. Bank API Integration

```javascript
// Integrasi dengan API bank untuk auto-sync transaksi
class BankIntegration {
  constructor(botApiKey, botBaseUrl, bankApiKey) {
    this.botApiKey = botApiKey;
    this.botBaseUrl = botBaseUrl;
    this.bankApiKey = bankApiKey;
  }

  async syncTransactions(accountNumber, userPhone) {
    try {
      // Ambil transaksi dari API bank (contoh)
      const bankTransactions = await this.fetchBankTransactions(accountNumber);
      
      // Convert ke format bot
      const formattedTransactions = bankTransactions.map(txn => ({
        id: txn.reference_id,
        amount: txn.type === 'debit' ? -txn.amount : txn.amount,
        description: txn.description,
        category: this.categorizeTransaction(txn.description),
        date: txn.transaction_date,
        source: 'bank_api'
      }));

      // Kirim ke bot via webhook
      const webhookPayload = {
        event: 'transaction_sync',
        data: {
          phoneNumber: userPhone,
          transactions: formattedTransactions,
          source: 'bank_integration',
          syncTime: new Date().toISOString()
        }
      };

      const response = await axios.post(
        `${this.botBaseUrl}/api/webhook`,
        webhookPayload,
        {
          headers: {
            'X-API-Key': this.botApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Bank sync failed:', error);
      throw error;
    }
  }

  async fetchBankTransactions(accountNumber) {
    // Implementasi untuk fetch dari API bank
    // Ini contoh, sesuaikan dengan API bank yang digunakan
    const response = await axios.get(
      `https://api.bank.com/accounts/${accountNumber}/transactions`,
      {
        headers: {
          'Authorization': `Bearer ${this.bankApiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 50,
          from_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        }
      }
    );

    return response.data.transactions;
  }

  categorizeTransaction(description) {
    // Auto-kategorisasi sederhana berdasarkan deskripsi
    const desc = description.toLowerCase();
    
    if (desc.includes('atm') || desc.includes('tarik tunai')) return 'cash_withdrawal';
    if (desc.includes('transfer')) return 'transfer';
    if (desc.includes('belanja') || desc.includes('merchant')) return 'shopping';
    if (desc.includes('listrik') || desc.includes('pln')) return 'utilities';
    if (desc.includes('pulsa') || desc.includes('telkom')) return 'communication';
    if (desc.includes('gaji') || desc.includes('salary')) return 'income';
    
    return 'other';
  }
}

// Setup periodic sync
cron.schedule('0 */6 * * *', async () => {
  const integration = new BankIntegration(
    process.env.BOT_API_KEY,
    process.env.BOT_BASE_URL,
    process.env.BANK_API_KEY
  );

  const userAccounts = await getUserBankAccounts(); // Implementasi sesuai database
  
  for (const account of userAccounts) {
    try {
      await integration.syncTransactions(account.accountNumber, account.phoneNumber);
      console.log(`Sync completed for ${account.phoneNumber}`);
    } catch (error) {
      console.error(`Sync failed for ${account.phoneNumber}:`, error);
    }
  }
});
```

## Error Handling

Webhook responses akan mengikuti standar HTTP status codes:

- **200**: Webhook berhasil diproses
- **400**: Bad request (data tidak valid)
- **401**: Unauthorized (API key tidak valid)
- **500**: Internal server error

Contoh error response:
```json
{
  "error": "Invalid event type",
  "code": "WEBHOOK_FAILED",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Best Practices

1. **Retry Logic**: Implementasikan retry dengan exponential backoff
2. **Idempotency**: Gunakan unique ID untuk mencegah duplicate processing
3. **Validation**: Validasi data webhook sebelum mengirim
4. **Monitoring**: Monitor webhook success/failure rates
5. **Security**: Gunakan HTTPS dan validate API keys
6. **Rate Limiting**: Respect bot's rate limiting
7. **Error Handling**: Handle semua possible errors gracefully

## Testing Webhooks

Gunakan tools seperti ngrok untuk testing webhook di development:

```bash
# Install ngrok
npm install -g ngrok

# Expose local port
ngrok http 3000

# Use the ngrok URL for webhook testing
# https://abc123.ngrok.io/api/webhook
```

Contoh test webhook dengan curl:
```bash
curl -X POST "https://abc123.ngrok.io/api/webhook" \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment_notification",
    "data": {
      "phoneNumber": "6281234567890",
      "amount": 100000,
      "status": "success",
      "transactionId": "TEST123"
    }
  }'
```

## Support

Untuk pertanyaan atau troubleshooting webhook, silakan:
1. Cek logs di `/api/message-history` untuk debug
2. Monitor `/api/stats` untuk melihat webhook success rate
3. Hubungi tim development untuk bantuan lebih lanjut