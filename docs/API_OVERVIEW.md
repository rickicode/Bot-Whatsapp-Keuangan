# API Overview - WhatsApp Financial Bot

## 🚀 Fitur Baru: Messaging API & Webhook

WhatsApp Financial Bot kini dilengkapi dengan REST API yang powerful untuk integrasi eksternal dan webhook system untuk notifikasi real-time.

## 📋 Quick Start

### 1. Setup API Key

```bash
# Generate API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
API_KEY=your_generated_api_key_here
```

### 2. Test API

```bash
curl -X GET "http://localhost:3000/api/test" \
  -H "X-API-Key: your_api_key_here"
```

### 3. Send Message

```bash
curl -X POST "http://localhost:3000/api/send-message" \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "6281234567890",
    "message": "Halo dari API!"
  }'
```

## 🎯 Use Cases

### 💳 Payment Gateway Integration
```javascript
// Notifikasi pembayaran otomatis
await processWebhook('payment_notification', {
  phoneNumber: '6281234567890',
  amount: 150000,
  status: 'success',
  transactionId: 'TRX123'
});
```

### 📅 Scheduled Reminders
```javascript
// Pengingat terjadwal
await processWebhook('reminder_trigger', {
  phoneNumber: '6281234567890',
  reminderText: 'Jangan lupa bayar tagihan listrik!',
  type: 'monthly'
});
```

### 🏦 Bank Integration
```javascript
// Sync transaksi bank otomatis
await processWebhook('transaction_sync', {
  phoneNumber: '6281234567890',
  transactions: [
    {
      amount: -50000,
      description: 'Transfer ATM',
      category: 'transfer',
      date: '2024-01-20T10:30:00.000Z'
    }
  ]
});
```

### 📢 Broadcast Notifications
```javascript
// Kirim broadcast ke multiple user
await sendBroadcast([
  '6281234567890',
  '6281234567891'
], 'Sistem maintenance pada 25 Jan 2024');
```

## 🛠 Available APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/test` | GET | Test API connectivity |
| `/api/send-message` | POST | Send single message |
| `/api/send-broadcast` | POST | Send to multiple numbers |
| `/api/webhook` | POST | Process webhook events |
| `/api/message-history` | GET | Get message history |
| `/api/stats` | GET | Get API statistics |
| `/api/clear-history` | POST | Clear message history |

## 🔗 Webhook Events

| Event | Description | Use Case |
|-------|-------------|----------|
| `payment_notification` | Payment updates | E-commerce, billing |
| `reminder_trigger` | Schedule reminders | CRM, task management |
| `user_action` | Trigger user actions | Automation workflows |
| `transaction_sync` | Bank/wallet sync | Financial aggregation |
| `external_command` | Remote commands | Dashboard integration |
| `system_alert` | System notifications | Monitoring, maintenance |

## 🔐 Security Features

- **API Key Authentication**: Secure access control
- **Rate Limiting**: Prevent spam and abuse
- **Anti-Spam Protection**: WhatsApp ban prevention
- **Request Validation**: Input sanitization
- **Error Handling**: Comprehensive error responses

## 📊 Monitoring & Analytics

### Real-time Statistics
```bash
curl -X GET "http://localhost:3000/api/stats" \
  -H "X-API-Key: your_api_key"
```

Response:
```json
{
  "total": { "messages": 150, "sent": 145, "failed": 5 },
  "last24Hours": { "messages": 25, "sent": 24, "failed": 1 },
  "connection": { "whatsappConnected": true }
}
```

### Message History
```bash
curl -X GET "http://localhost:3000/api/message-history?limit=10" \
  -H "X-API-Key: your_api_key"
```

## 🚦 Rate Limiting

| Type | Default Limit | Configurable |
|------|---------------|--------------|
| Per User | 10 msg/min | ✅ |
| Global | 100 msg/min | ✅ |
| Emergency Brake | 50 msg/min | ✅ |
| Broadcast | 100 recipients | ❌ |

## 📱 Integration Examples

### Node.js Example
```javascript
const axios = require('axios');

class WhatsAppAPI {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async sendMessage(phoneNumber, message) {
    const response = await axios.post(`${this.baseUrl}/api/send-message`, {
      phoneNumber,
      message
    }, {
      headers: { 'X-API-Key': this.apiKey }
    });
    return response.data;
  }

  async processPayment(phoneNumber, amount, status, transactionId) {
    return await axios.post(`${this.baseUrl}/api/webhook`, {
      event: 'payment_notification',
      data: { phoneNumber, amount, status, transactionId }
    }, {
      headers: { 'X-API-Key': this.apiKey }
    });
  }
}

// Usage
const api = new WhatsAppAPI('your_api_key', 'http://localhost:3000');
await api.sendMessage('6281234567890', 'Hello from API!');
```

### Python Example
```python
import requests

class WhatsAppAPI:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {'X-API-Key': api_key, 'Content-Type': 'application/json'}
    
    def send_message(self, phone_number, message):
        response = requests.post(
            f'{self.base_url}/api/send-message',
            json={'phoneNumber': phone_number, 'message': message},
            headers=self.headers
        )
        return response.json()
    
    def process_webhook(self, event, data):
        response = requests.post(
            f'{self.base_url}/api/webhook',
            json={'event': event, 'data': data},
            headers=self.headers
        )
        return response.json()

# Usage
api = WhatsAppAPI('your_api_key', 'http://localhost:3000')
api.send_message('6281234567890', 'Hello from Python!')
```

### PHP Example
```php
<?php
class WhatsAppAPI {
    private $apiKey;
    private $baseUrl;
    
    public function __construct($apiKey, $baseUrl) {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl;
    }
    
    public function sendMessage($phoneNumber, $message) {
        $data = json_encode([
            'phoneNumber' => $phoneNumber,
            'message' => $message
        ]);
        
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "X-API-Key: {$this->apiKey}\r\n" .
                           "Content-Type: application/json\r\n",
                'content' => $data
            ]
        ]);
        
        $response = file_get_contents("{$this->baseUrl}/api/send-message", false, $context);
        return json_decode($response, true);
    }
}

// Usage
$api = new WhatsAppAPI('your_api_key', 'http://localhost:3000');
$api->sendMessage('6281234567890', 'Hello from PHP!');
?>
```

## 🐳 Docker Integration

### Docker Compose
```yaml
version: '3.8'
services:
  whatsapp-bot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - API_KEY=your_secret_api_key
      - DEEPSEEK_API_KEY=your_deepseek_key
      - BOT_ADMIN_PHONE=628123456789
    volumes:
      - ./data:/app/data
```

### Environment Variables
```bash
# Required
API_KEY=your_secret_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key
BOT_ADMIN_PHONE=628123456789

# Optional
API_MAX_MESSAGES_PER_MINUTE_PER_USER=10
API_MAX_MESSAGES_PER_MINUTE_GLOBAL=100
BASE_URL=https://your-domain.com
```

## 🔧 Configuration Options

### Anti-Spam Settings
```bash
ANTI_SPAM_USER_PER_MINUTE=10
ANTI_SPAM_GLOBAL_PER_MINUTE=50
ANTI_SPAM_EMERGENCY_BRAKE=true
```

### Webhook Settings
```bash
WEBHOOK_TIMEOUT=30000
WEBHOOK_RETRY_ATTEMPTS=3
WEBHOOK_MAX_HISTORY_SIZE=1000
```

### Security Settings
```bash
API_REQUIRE_HTTPS=true
API_ENABLE_IP_WHITELIST=true
API_ALLOWED_IPS=192.168.1.100,10.0.0.0/8
```

## 📚 Documentation Links

- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
- **[Webhook Guide](./WEBHOOK_GUIDE.md)** - Webhook implementation guide
- **[API Setup](./API_SETUP.md)** - Installation and configuration
- **[Migration Guide](./MIGRATION_GUIDE.md)** - Upgrade instructions

## 🆘 Support & Troubleshooting

### Common Issues

**API Key Invalid**
```bash
# Check API key in environment
echo $API_KEY

# Test with curl
curl -X GET "http://localhost:3000/api/test" -H "X-API-Key: $API_KEY"
```

**WhatsApp Not Connected**
```bash
# Check connection status
curl -X GET "http://localhost:3000/health"

# Access QR scan page
open http://localhost:3000/qrscan
```

**Rate Limit Exceeded**
```bash
# Check current stats
curl -X GET "http://localhost:3000/api/stats" -H "X-API-Key: $API_KEY"

# Reset emergency brake if needed
curl -X POST "http://localhost:3000/anti-spam/reset-emergency"
```

### Debug Mode
```bash
DEBUG=whatsapp-bot:* npm start
```

### Health Check
```bash
# Application health
curl http://localhost:3000/health

# API specific test
curl -H "X-API-Key: $API_KEY" http://localhost:3000/api/test
```

## 🎯 Next Steps

1. **Setup API Key** - Generate and configure secure API key
2. **Test Connection** - Verify API connectivity
3. **Connect WhatsApp** - Scan QR code and establish connection
4. **Integrate Webhooks** - Implement payment/reminder notifications
5. **Monitor Usage** - Track API statistics and performance
6. **Scale & Deploy** - Production deployment with proper security

---

**Ready to start?** Follow the [API Setup Guide](./API_SETUP.md) for detailed installation instructions.