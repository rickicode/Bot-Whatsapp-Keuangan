# API Documentation - WhatsApp Financial Bot

## Overview

WhatsApp Financial Bot menyediakan REST API untuk mengirim pesan teks dan mengelola webhook. API ini memungkinkan integrasi eksternal untuk mengirim pesan melalui WhatsApp dan menerima notifikasi melalui webhook.

## Base URL

```
http://localhost:3000
```

Atau gunakan URL production Anda sesuai konfigurasi.

## Authentication

Semua endpoint API memerlukan autentikasi menggunakan API Key. API Key dapat dikirim melalui:

1. **Header**: `X-API-Key: your_api_key`
2. **Query Parameter**: `?api_key=your_api_key`

### Environment Variable

Set API Key di environment variable:
```bash
API_KEY=your_secret_api_key_here
```

## Endpoints

### 1. Test API Connection

**GET** `/api/test`

Test konektivitas API.

#### Response
```json
{
  "success": true,
  "message": "API is working",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "version": "1.0.0"
}
```

### 2. Send Single Message

**POST** `/api/send-message`

Mengirim pesan teks ke satu nomor WhatsApp.

#### Request Body
```json
{
  "phoneNumber": "6281234567890",
  "message": "Halo, ini pesan dari API WhatsApp Bot!",
  "options": {
    "quoted": false
  }
}
```

#### Parameters
- `phoneNumber` (string, required): Nomor telepon tujuan (format: 6281234567890)
- `message` (string, required): Pesan yang akan dikirim
- `options` (object, optional): Opsi tambahan untuk pesan

#### Response
```json
{
  "success": true,
  "messageId": "BAE5F4A7B8C9D1E2F3",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "to": "6281234567890",
  "message": "Halo, ini pesan dari API WhatsApp Bot!"
}
```

#### Error Response
```json
{
  "error": "Phone number and message are required",
  "code": "MISSING_PARAMETERS"
}
```

### 3. Send Broadcast Message

**POST** `/api/send-broadcast`

Mengirim pesan ke multiple nomor WhatsApp.

#### Request Body
```json
{
  "phoneNumbers": [
    "6281234567890",
    "6281234567891",
    "6281234567892"
  ],
  "message": "Broadcast message untuk semua user!",
  "options": {
    "delay": 2000
  }
}
```

#### Parameters
- `phoneNumbers` (array, required): Array nomor telepon tujuan (maksimal 100)
- `message` (string, required): Pesan yang akan dikirim
- `options` (object, optional):
  - `delay` (number): Delay antar pesan dalam milliseconds (default: 1000)

#### Response
```json
{
  "success": true,
  "total": 3,
  "sent": 3,
  "failed": 0,
  "results": [
    {
      "phoneNumber": "6281234567890",
      "success": true,
      "messageId": "BAE5F4A7B8C9D1E2F3",
      "timestamp": "2024-01-20T10:30:00.000Z"
    },
    {
      "phoneNumber": "6281234567891",
      "success": true,
      "messageId": "BAE5F4A7B8C9D1E2F4",
      "timestamp": "2024-01-20T10:30:02.000Z"
    },
    {
      "phoneNumber": "6281234567892",
      "success": false,
      "error": "Message blocked by anti-spam"
    }
  ]
}
```

### 4. Process Webhook

**POST** `/api/webhook`

Memproses webhook event dari sistem eksternal.

#### Request Body
```json
{
  "event": "payment_notification",
  "data": {
    "phoneNumber": "6281234567890",
    "amount": 150000,
    "status": "success",
    "transactionId": "TRX123456789"
  }
}
```

#### Supported Events

1. **message_status**: Update status pesan
```json
{
  "event": "message_status",
  "data": {
    "messageId": "BAE5F4A7B8C9D1E2F3",
    "status": "delivered",
    "phoneNumber": "6281234567890"
  }
}
```

2. **user_action**: Trigger aksi user
```json
{
  "event": "user_action",
  "data": {
    "phoneNumber": "6281234567890",
    "action": "send_reminder",
    "context": {
      "message": "Jangan lupa bayar tagihan listrik hari ini!"
    }
  }
}
```

3. **payment_notification**: Notifikasi pembayaran
```json
{
  "event": "payment_notification",
  "data": {
    "phoneNumber": "6281234567890",
    "amount": 150000,
    "status": "success",
    "transactionId": "TRX123456789"
  }
}
```

4. **reminder_trigger**: Trigger pengingat
```json
{
  "event": "reminder_trigger",
  "data": {
    "phoneNumber": "6281234567890",
    "reminderText": "Saatnya review pengeluaran bulanan",
    "type": "monthly"
  }
}
```

5. **external_command**: Eksekusi command eksternal
```json
{
  "event": "external_command",
  "data": {
    "phoneNumber": "6281234567890",
    "command": "/laporan bulan ini",
    "parameters": {}
  }
}
```

#### Response
```json
{
  "success": true,
  "webhookId": "webhook_1642678200000_abc123def",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "processed": {
    "notificationSent": true,
    "transactionId": "TRX123456789"
  }
}
```

### 5. Get Message History

**GET** `/api/message-history`

Mendapatkan riwayat pesan yang dikirim melalui API.

#### Query Parameters
- `phoneNumber` (string, optional): Filter berdasarkan nomor telepon
- `type` (string, optional): Filter berdasarkan tipe (`outgoing`, `webhook`)
- `since` (string, optional): Filter sejak tanggal (ISO format)
- `limit` (number, optional): Batasi jumlah hasil

#### Example
```
GET /api/message-history?phoneNumber=6281234567890&limit=10
```

#### Response
```json
{
  "success": true,
  "count": 5,
  "history": [
    {
      "type": "outgoing",
      "to": "6281234567890",
      "message": "Halo, ini pesan dari API",
      "timestamp": "2024-01-20T10:30:00.000Z",
      "messageId": "BAE5F4A7B8C9D1E2F3",
      "status": "sent"
    },
    {
      "type": "webhook",
      "event": "payment_notification",
      "data": {
        "amount": 150000,
        "status": "success"
      },
      "timestamp": "2024-01-20T10:25:00.000Z",
      "id": "webhook_1642678200000_abc123def"
    }
  ]
}
```

### 6. Get API Statistics

**GET** `/api/stats`

Mendapatkan statistik penggunaan API.

#### Response
```json
{
  "success": true,
  "timestamp": "2024-01-20T10:30:00.000Z",
  "total": {
    "messages": 150,
    "sent": 145,
    "failed": 5
  },
  "last24Hours": {
    "messages": 25,
    "sent": 24,
    "failed": 1,
    "webhooks": 8
  },
  "lastHour": {
    "messages": 3,
    "sent": 3,
    "failed": 0
  },
  "connection": {
    "whatsappConnected": true,
    "antiSpamActive": true
  }
}
```

### 7. Clear Message History

**POST** `/api/clear-history`

Menghapus semua riwayat pesan.

#### Response
```json
{
  "success": true,
  "message": "Message history cleared",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `API_KEY_NOT_CONFIGURED` | API key belum dikonfigurasi di server |
| `INVALID_API_KEY` | API key tidak valid atau missing |
| `MISSING_PARAMETERS` | Parameter required tidak ada |
| `TOO_MANY_RECIPIENTS` | Terlalu banyak penerima (>100) |
| `SERVICE_UNAVAILABLE` | Service messaging tidak tersedia |
| `SEND_MESSAGE_FAILED` | Gagal mengirim pesan |
| `SEND_BROADCAST_FAILED` | Gagal mengirim broadcast |
| `WEBHOOK_FAILED` | Gagal memproses webhook |
| `HISTORY_FAILED` | Gagal mengambil history |
| `STATS_FAILED` | Gagal mengambil statistik |
| `CLEAR_HISTORY_FAILED` | Gagal menghapus history |

## Rate Limiting

API menggunakan sistem anti-spam yang membatasi:

- **Per User**: 10 pesan per menit
- **Global**: 100 pesan per menit
- **Emergency Brake**: Aktif jika ada 50+ pesan dalam 1 menit

Jika rate limit tercapai, API akan mengembalikan error:
```json
{
  "error": "Message blocked by anti-spam: rate_limit_exceeded",
  "code": "SEND_MESSAGE_FAILED"
}
```

## Phone Number Format

Nomor telepon harus dalam format internasional tanpa tanda `+`:

- ✅ Benar: `6281234567890`
- ❌ Salah: `+6281234567890`, `081234567890`, `81234567890`

Bot akan secara otomatis memformat nomor yang dimulai dengan `0` ke format `62`.

## Example Code

### JavaScript/Node.js

```javascript
const axios = require('axios');

const apiKey = 'your_api_key_here';
const baseURL = 'http://localhost:3000';

// Send single message
async function sendMessage(phoneNumber, message) {
  try {
    const response = await axios.post(`${baseURL}/api/send-message`, {
      phoneNumber,
      message
    }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Send broadcast
async function sendBroadcast(phoneNumbers, message) {
  try {
    const response = await axios.post(`${baseURL}/api/send-broadcast`, {
      phoneNumbers,
      message,
      options: { delay: 2000 }
    }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Broadcast sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Process webhook
async function processWebhook(event, data) {
  try {
    const response = await axios.post(`${baseURL}/api/webhook`, {
      event,
      data
    }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Webhook processed:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Example usage
(async () => {
  // Send single message
  await sendMessage('6281234567890', 'Halo dari API!');
  
  // Send broadcast
  await sendBroadcast([
    '6281234567890',
    '6281234567891'
  ], 'Broadcast message untuk semua!');
  
  // Process payment notification webhook
  await processWebhook('payment_notification', {
    phoneNumber: '6281234567890',
    amount: 150000,
    status: 'success',
    transactionId: 'TRX123456789'
  });
})();
```

### cURL Examples

```bash
# Test API
curl -X GET "http://localhost:3000/api/test" \
  -H "X-API-Key: your_api_key_here"

# Send message
curl -X POST "http://localhost:3000/api/send-message" \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "6281234567890",
    "message": "Halo dari API!"
  }'

# Send broadcast
curl -X POST "http://localhost:3000/api/send-broadcast" \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumbers": ["6281234567890", "6281234567891"],
    "message": "Broadcast message!",
    "options": {"delay": 2000}
  }'

# Process webhook
curl -X POST "http://localhost:3000/api/webhook" \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment_notification",
    "data": {
      "phoneNumber": "6281234567890",
      "amount": 150000,
      "status": "success",
      "transactionId": "TRX123456789"
    }
  }'

# Get message history
curl -X GET "http://localhost:3000/api/message-history?limit=10" \
  -H "X-API-Key: your_api_key_here"

# Get API stats
curl -X GET "http://localhost:3000/api/stats" \
  -H "X-API-Key: your_api_key_here"
```

## Best Practices

1. **Gunakan HTTPS** di production untuk keamanan API key
2. **Simpan API key dengan aman** jangan expose di code repository
3. **Handle rate limiting** dengan retry mechanism yang appropriate
4. **Validate phone numbers** sebelum mengirim request
5. **Monitor API stats** untuk usage tracking
6. **Use webhooks** untuk notifikasi real-time daripada polling
7. **Implement proper error handling** untuk semua API calls
8. **Set reasonable delays** untuk broadcast messages (min 1 detik)

## Support

Untuk pertanyaan atau issue terkait API, silakan buka issue di repository atau hubungi tim development.