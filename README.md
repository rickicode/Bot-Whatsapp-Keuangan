# WhatsApp Financial Management Bot with Indonesian AI Assistant

A comprehensive WhatsApp bot for managing personal finances with AI-powered insights using DeepSeek API. Features intelligent user registration, subscription management, and advanced financial analysis through simple WhatsApp commands - all in Indonesian language.

> 🚀 **MIGRATED TO BAILEYS**: This bot now uses [`baileys`](https://github.com/WhiskeySockets/Baileys) for better performance, stability, and multi-device support. See [BAILEYS_MIGRATION.md](BAILEYS_MIGRATION.md) for details.

## 🌟 Features

### 🇮🇩 Indonesian AI Assistant (NEW!)
- 🤖 **Intelligent User Registration** - Multi-step registration flow with validation
- 👤 **User Authentication** - Secure user management and session handling
- 💎 **Subscription Management** - Free vs Premium plans with transaction limits
- 🔐 **Access Control** - Plan-based feature restrictions and quota management
- 📊 **Usage Tracking** - Real-time transaction limit monitoring
- 🎯 **Personalized Experience** - Time-based greetings and contextual responses
- 🌐 **Indonesian Language** - Complete Indonesian language support

### Core Financial Management
- ✅ **Income & Expense Tracking** - Simple commands to record transactions
- ✅ **Category Management** - Organize transactions with custom categories
- ✅ **Balance & Reports** - Real-time balance and detailed financial reports
- ✅ **Transaction Search & Edit** - Find and modify transactions easily
- ✅ **Bulk Transaction Processing** - Add multiple transactions at once with AI

### 📋 Debt & Receivable Management (NEW!)
- 💰 **Intelligent Debt/Receivable Tracking** - "Piutang Warung Madura Voucher Wifi 200K"
- 🤖 **Natural Language Processing** - AI understands Indonesian debt/receivable patterns
- 👥 **Auto Client Registration** - Automatically registers new clients/contacts
- 📱 **Contact Management** - Store WhatsApp numbers for easy communication
- 📊 **Comprehensive Reporting** - Track who owes you and who you owe
- ✅ **Payment Tracking** - Mark debts as paid with timestamp
- 🔍 **Smart Detection** - Auto-detect HUTANG vs PIUTANG from text

### 🤖 AI-Powered Features (Enhanced & Improved!)
- 🎯 **Accurate Amount Parsing** - FIXED: "40K" now correctly parsed as 40,000 (not 40,000,000!)
- 🇮🇩 **Indonesian NLP** - Perfect understanding of "10K", "1.5jt", "25rb", "500ribu" formats
- 🤖 **Smart Categorization** - AI suggests appropriate categories with confidence scoring
- 🤖 **Auto-Clean Descriptions** - "habis jajan sate ayam 10k" → "Jajan Sate Ayam"
- 📊 **Advanced Financial Analysis** - AI health scoring, risk assessment, actionable insights
- 🔮 **Enhanced Predictions** - Monte Carlo simulation, scenario analysis, trend forecasting
- 💡 **Intelligent Advice** - Context-aware recommendations with specific action items
- 🤖 **Conversational Interface** - Ask complex financial questions in Indonesian
- ✅ **Validation & Fallback** - Built-in amount validation with fallback parsing
- 🧪 **Quality Assurance** - Comprehensive testing framework for AI accuracy

### 💭 AI Curhat Mode (NEW!)
- 🤗 **Personal AI Companion** - Separate AI mode for emotional support and conversation
- 💙 **Empathetic Responses** - AI trained to be a caring, non-judgmental friend
- 🎵 **Voice Response (TTS)** - AI can respond with voice notes using ElevenLabs API
- 🔒 **Session Management** - Secure conversation sessions with Redis/PostgreSQL fallback
- 🎯 **Separate Configuration** - Independent AI provider settings for curhat mode
- 🗣️ **Text-to-Speech** - Natural Indonesian voice responses when requested
- 🌟 **Natural Conversation** - Free-flowing chat in Indonesian language
- 🚪 **Easy Toggle** - Simple `/curhat` to enter, `/quit` to exit back to finance mode

### Advanced Features
- 📊 **Comprehensive Reporting** - Daily, weekly, monthly, yearly reports
- 💾 **Data Export** - CSV exports for accounting software
- 🔄 **Automated Backups** - Scheduled database backups
- 🏷️ **Flexible Categories** - Custom income and expense categories
- 📱 **Multi-Currency Support** - Handle different currencies
- 🔐 **Security** - Encrypted data storage and user authentication
- 🔍 **Smart Search** - Find transactions by amount, description, or category

### 🛡️ Anti-Banned Features (NEW!)
- 🤖 **Bot Pattern Detection** - Detects and prevents bot-like behavior
- ⌨️ **Natural Typing Simulation** - Human-like typing indicators
- 📊 **Ban Risk Assessment** - Real-time risk level monitoring (LOW/MEDIUM/HIGH/CRITICAL)
- 🚨 **Emergency Brake System** - Automatic protection against rate limits
- ⏱️ **Natural Delays** - Simulates human reading and thinking time
- 🔄 **Response Variation** - Prevents identical response patterns
- 📈 **Enhanced Rate Limiting** - Conservative limits to prevent detection
- 🎯 **Adaptive Throttling** - Dynamic message limiting based on risk level

### � NEW: REST API & Webhook Integration
- 📡 **REST API** - Send WhatsApp messages via HTTP API
- 🔗 **Webhook System** - Receive real-time notifications and triggers
- 💳 **Payment Integration** - Automatic payment notifications
- 📅 **Scheduled Reminders** - External reminder triggers
- 🏦 **Bank Integration** - Auto-sync bank transactions
- 📢 **Broadcast Messages** - Send to multiple recipients
- 📊 **API Analytics** - Monitor usage and performance
- 🔐 **API Security** - Secure authentication and rate limiting

## � Quick Start

### Prerequisites
- Node.js 16+ (untuk local development)
- Docker & Docker Compose (untuk deployment)
- DeepSeek API key (untuk AI features)
- WhatsApp account

### Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd whatsapp-financial-bot
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

4. **Setup database and start**
```bash
# Run database migrations
npm run migrate

# Seed with default data (categories, subscription plans)
npm run migrate:seed

# Start the application
npm start
```

### Docker Deployment

#### Serverless (Easypanel/Coolify/Railway)
```bash
# Build dan deploy untuk serverless
npm run docker:serverless

# Atau upload ke platform dengan environment variables:
# DEEPSEEK_API_KEY, BOT_ADMIN_PHONE, dll
```

#### VPS dengan PostgreSQL
```bash
# Deploy dengan PostgreSQL
npm run docker:vps

# Lihat logs
npm run docker:logs
```

#### Development dengan Docker
```bash
npm run docker:dev
```

### Environment Variables
Buat file `.env` atau set di platform deployment:
```env
DEEPSEEK_API_KEY=your_api_key_here
BOT_ADMIN_PHONE=+62xxxxxxxxxx
USER_ADMIN=+62xxxxxxxxxx

# Note: ALLOWED_USERS tidak diperlukan lagi -
# Semua user dapat register otomatis melalui Indonesian AI Assistant
# USER_ADMIN menentukan siapa yang memiliki akses admin

# Anti-Banned Configuration (NEW!)
ANTI_BANNED_DETECTION=true
ANTI_BANNED_NATURAL_DELAYS=true
TYPING_NATURAL=true
TYPING_SPOOF=true
NATURAL_DELAY_MIN=500
NATURAL_DELAY_MAX=3000
ANTI_SPAM_GLOBAL_PER_MINUTE=30
ANTI_SPAM_EMERGENCY_THRESHOLD=50
```

### Subscription Plans
- **Free Plan**: 10 transaksi/bulan, fitur dasar
- **Premium Plan**: Unlimited transaksi, fitur lengkap (Rp 50.000/bulan)

### User Registration & First Time Setup
1. **Scan QR Code**
   - QR code akan muncul di terminal/logs
   - Scan dengan WhatsApp untuk connect

2. **User Registration (Indonesian AI Assistant)**
   - Kirim pesan apa saja untuk memulai registrasi
   - Bot akan memandu proses registrasi 3 langkah:
     - Nama lengkap
     - Alamat email
     - Kota asal
   - Otomatis mendapat Free Plan (10 transaksi/bulan)

3. **Start Using**
   - Kirim `/menu` untuk melihat semua fitur
   - Gunakan bahasa natural: "saya habis 50000 untuk makan siang"

## ⚙️ Configuration

### Environment Variables

Edit `.env` file with your configuration:

```env
# Bot Configuration
BOT_NAME=Your Financial Bot
BOT_ADMIN_PHONE=+1234567890

# DeepSeek AI (Required for AI features)
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com

# Security
ALLOWED_USERS=+1234567890,+0987654321

# Features
ENABLE_AI_FEATURES=true
ENABLE_OCR=true
ENABLE_REMINDERS=true

# AI Curhat Mode (NEW!)
AI_CURHAT_ENABLED=true
AI_CURHAT_PROVIDER=openrouter
AI_CURHAT_MODEL=anthropic/claude-3-haiku

# Additional AI Providers (for curhat or main AI)
OPENROUTER_API_KEY=your_openrouter_key
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
```

### Database Configuration
- **PostgreSQL** (default): Robust database for production environments
- **Supabase**: Cloud PostgreSQL with built-in features and easy setup

## 📱 Commands Reference

### Basic Commands

#### Income & Expenses
```
/masuk 500000 client payment freelance
/keluar 50000 lunch food
/saldo
```

#### Reports
```
/laporan hari     # Daily report
/laporan minggu   # Weekly report  
/laporan bulan    # Monthly report
/laporan tahun    # Yearly report
```

#### Categories
```
/kategori                    # View all categories
/kategori-baru Food expense  # Add new category
```

### Bulk Transactions (NEW!)
```
/bulk Habis belanja baju 33k
Mainan anak 30k
Galon + kopi 20k
Parkir 2k
Permen 2k
```

### AI Commands
```
/analisis          # AI financial analysis
/saran            # AI financial advice
/chat How can I save more money?
/prediksi-ai      # AI cash flow prediction
/ringkasan-ai     # AI financial summary
/kategori-otomatis # Auto-categorize transactions

# AI Curhat Mode (NEW!)
/curhat           # Enter personal AI companion mode
/quit             # Exit curhat mode back to finance
```

### Debt & Receivable Management (NEW!)
```
# Manual Commands
/piutang "Warung Madura" 200000 "Voucher Wifi 2Rebuan"
/hutang "Toko Budi" 150000 "sembako bulanan"
/hutang-piutang           # View all debt/receivables
/hutang-piutang PIUTANG   # View receivables only
/hutang-piutang HUTANG    # View debts only
/saldo-hutang             # Debt/receivable summary
/lunas 123                # Mark as paid

# Natural Language (AI Powered)
"Piutang Warung Madura Voucher Wifi 2Rebuan 200K"
"Hutang ke Toko Budi sembako 150K"
"Teman kantor belum bayar makan siang 50K"
"Saya pinjam uang ke Pak RT 500K untuk modal"
"Cicilan motor ke Yamaha bulan ini 1.2 juta"
```

### Data Management
```
/edit 123         # Edit transaction ID 123
/hapus 123        # Delete transaction ID 123
/cari makan       # Search transactions by keyword
/backup           # Create backup
/export           # Export to CSV
```

### Natural Language & Bulk Processing
Just type naturally:
```
"I spent 50000 for lunch today"
"Received 500000 from client payment"
"Bought groceries for 75000"

# With auto-capitalize feature:
"habis jajan sate ayam 10k" → Saved as "Jajan Sate Ayam"
"beli kopi susu 15k" → Saved as "Kopi Susu"
"bayar internet bulan ini 300k" → Saved as "Internet Bulan Ini"

# Bulk transactions (AI auto-detects multiple transactions):
"Hari ini beli kopi 25k, makan siang 50k, bensin 100k"
"Belanja: beras 50k, telur 30k, sayur 20k"
```

## 📡 REST API & Webhook Integration

WhatsApp Financial Bot kini dilengkapi dengan REST API powerful untuk integrasi eksternal dan sistem webhook untuk notifikasi real-time.

### 🚀 API Quick Start

1. **Setup API Key**
```bash
# Generate secure API key
API_KEY=your_secret_api_key_32_characters_minimum
```

2. **Test Connectivity**
```bash
curl -X GET "http://localhost:3000/api/test" \
  -H "X-API-Key: your_api_key_here"
```

3. **Send Message**
```bash
curl -X POST "http://localhost:3000/api/send-message" \
  -H "X-API-Key: your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "6281234567890",
    "message": "Halo dari API!"
  }'
```

### 📋 Available API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/test` | GET | Test API connectivity |
| `/api/send-message` | POST | Send single WhatsApp message |
| `/api/send-broadcast` | POST | Send to multiple recipients |
| `/api/webhook` | POST | Process webhook events |
| `/api/message-history` | GET | Get message history |
| `/api/stats` | GET | API usage statistics |
| `/api/clear-history` | POST | Clear message history |

### 🔗 Webhook Events

| Event | Use Case | Description |
|-------|----------|-------------|
| `payment_notification` | E-commerce, Billing | Automatic payment updates |
| `reminder_trigger` | CRM, Task Management | Scheduled reminders |
| `user_action` | Automation | Trigger user actions |
| `transaction_sync` | Banking | Auto-sync bank transactions |
| `external_command` | Dashboard | Remote command execution |
| `system_alert` | Monitoring | System notifications |

### 💳 Use Case Examples

**Payment Gateway Integration:**
```javascript
// Send payment notification via webhook
await fetch('http://localhost:3000/api/webhook', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event: 'payment_notification',
    data: {
      phoneNumber: '6281234567890',
      amount: 150000,
      status: 'success',
      transactionId: 'TRX123456'
    }
  })
});
```

**Scheduled Reminders:**
```javascript
// Send reminder via webhook
await fetch('http://localhost:3000/api/webhook', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    event: 'reminder_trigger',
    data: {
      phoneNumber: '6281234567890',
      reminderText: 'Jangan lupa bayar tagihan listrik!',
      type: 'monthly'
    }
  })
});
```

**Broadcast Messages:**
```javascript
// Send broadcast to multiple users
await fetch('http://localhost:3000/api/send-broadcast', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phoneNumbers: ['6281234567890', '6281234567891'],
    message: 'Sistem maintenance pada 25 Jan 2024',
    options: { delay: 2000 }
  })
});
```

### 🔐 API Security & Rate Limiting

- **Authentication**: Secure API key authentication
- **Rate Limiting**: 10 messages/minute per user, 100/minute global
- **Anti-Spam**: Built-in protection against WhatsApp bans
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Detailed error responses with codes

### 📊 Monitoring & Analytics

```bash
# Get real-time API statistics
curl -X GET "http://localhost:3000/api/stats" \
  -H "X-API-Key: your_api_key"

# Response includes:
# - Total messages sent/failed
# - 24-hour and hourly statistics
# - Connection status
# - Webhook processing stats
```

### 📚 API Documentation

- **[📖 Complete API Documentation](docs/API_DOCUMENTATION.md)** - Full API reference
- **[🔗 Webhook Implementation Guide](docs/WEBHOOK_GUIDE.md)** - Webhook setup and examples
- **[⚙️ API Setup Guide](docs/API_SETUP.md)** - Installation and configuration
- **[🎯 API Overview](docs/API_OVERVIEW.md)** - Quick start and examples

## 🤖 AI Features

### DeepSeek Integration

The bot uses DeepSeek AI for intelligent features:

1. **Natural Language Processing**
   - Parse natural language transactions
   - Extract amount, description, and category
   - High accuracy transaction recording

2. **Smart Categorization**
   - AI suggests appropriate categories
   - Learns from your transaction patterns
   - Reduces manual categorization

3. **Financial Analysis**
   - Spending pattern analysis
   - Income vs expense trends
   - Category-wise insights
   - Financial health assessment

4. **Conversational AI**
   - Ask questions about your finances
   - Get personalized advice
   - Financial planning suggestions

5. **Predictive Analytics**
   - Cash flow forecasting
   - Expense predictions
   - Budget recommendations

## 📊 Data Structure

### Database Schema

```sql
-- Users & Authentication
users (id, phone, name, email, city, timezone, is_active, is_admin, created_at)

-- Subscription Management
user_subscriptions (user_phone, plan_name, transaction_count, last_reset_date, payment_status)
subscription_plans (name, display_name, monthly_transaction_limit, price, features)

-- Categories
categories (id, user_phone, name, type, color, is_active)

-- Transactions
transactions (id, user_phone, type, amount, category_id, description, date, created_at)

-- AI Interactions
ai_interactions (id, user_phone, prompt, response, type, created_at)
```

## 🔧 Development

### Project Structure
```
whatsapp-financial-bot/
├── src/
│   ├── index.js              # Main application entry
│   ├── database/
│   │   └── DatabaseManager.js
│   ├── handlers/
│   │   └── CommandHandler.js
│   ├── services/
│   │   ├── AIService.js
│   │   ├── TransactionService.js
│   │   ├── ReportService.js
│   │   ├── CategoryService.js
│   │   ├── IndonesianAIAssistant.js
│   │   ├── MessagingAPIService.js
│   │   ├── QRCodeService.js
│   │   └── ReminderService.js
│   └── utils/
│       └── Logger.js
├── scripts/
│   ├── setup.js
│   └── backup.js
└── docs/
    ├── API.md
    ├── DEPLOYMENT.md
    └── USER_MANUAL.md
```

### Available Scripts
```bash
npm start          # Start the bot
npm run dev        # Development mode with nodemon
npm run backup     # Manual backup
npm test           # Run tests

# Database Migration Scripts
npm run migrate          # Run database migrations (safe)
npm run migrate:seed     # Seed database with default data
npm run migrate:fresh    # Fresh migration - drops all tables (dev only)
npm run migrate:help     # Show migration help
```

### 🗄️ Database Migrations

The bot includes a comprehensive migration system for database management:

#### Quick Migration Commands
```bash
# Safe migration (production-ready)
npm run migrate

# Add default data (categories, subscription plans)
npm run migrate:seed

# Complete reset (development only - ⚠️ DESTRUCTIVE)
NODE_ENV=development npm run migrate:fresh
```

#### Migration Features
- ✅ **Safe Schema Updates** - Non-destructive migrations for production
- ✅ **Data Seeding** - Populate database with default categories and plans
- ✅ **Fresh Reset** - Complete database recreation for development
- ✅ **Multi-Database Support** - Works with PostgreSQL and Supabase
- ✅ **Production Protection** - Fresh migrations disabled in production
- ✅ **Error Handling** - Comprehensive error handling and rollback

#### Database Support
- **PostgreSQL** - Primary database for all environments
- **Supabase** - Cloud PostgreSQL with built-in features and easy setup

See [Migration Guide](docs/MIGRATION_GUIDE.md) for detailed instructions.
```

### Adding New Commands

1. Add command handler in `CommandHandler.js`
2. Create service method if needed
3. Update help text
4. Test thoroughly

Example:
```javascript
// In CommandHandler.js
async handleNewCommand(message, userPhone, args) {
    // Your command logic here
    await message.reply('Command executed!');
}

// Register in constructor
this.commands['/newcommand'] = this.handleNewCommand.bind(this);
```

## 📚 Documentation

- [🇮🇩 Indonesian AI Assistant](INDONESIAN_AI_ASSISTANT.md) - Complete guide to registration & subscription system
- [🛡️ Anti-Banned Features](docs/ANTI_BANNED_FEATURES.md) - Comprehensive guide to anti-banned system & typing manager
- [� User Manual](docs/USER_MANUAL.md) - Detailed user guide
- [🚀 Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [🔌 API Reference](docs/API.md) - API documentation
- [🛠️ Development Guide](docs/DEVELOPMENT.md) - Development setup

## 🔒 Security Features

- **User Authentication** - Only authorized phone numbers
- **Data Encryption** - Secure data storage
- **Input Validation** - Prevent injection attacks
- **Rate Limiting** - Prevent spam/abuse
- **Audit Logging** - Track all activities
- **Backup Encryption** - Secure backups

## 📈 Performance

- **Response Time** - Commands execute in 2-3 seconds
- **Scalability** - Handles growing transaction volume
- **Reliability** - 99%+ uptime with error recovery
- **Memory Usage** - Optimized for efficient memory usage
- **Database** - Indexed for fast queries

## 🐛 Troubleshooting

### Common Issues

1. **QR Code not appearing**
   - Check internet connection
   - Restart the application
   - Clear WhatsApp Web cache

2. **AI features not working**
   - Verify DeepSeek API key
   - Check API quota/limits
   - Ensure ENABLE_AI_FEATURES=true

3. **Database errors**
   - Check file permissions
   - Ensure disk space available
   - Run database backup/restore

4. **WhatsApp disconnection**
   - Automatic reconnection enabled
   - Check phone connection
   - Re-scan QR if needed

### Debug Mode
```bash
LOG_LEVEL=debug npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

### Development Guidelines
- Follow existing code style
- Add tests for new features
- Update documentation
- Test with real WhatsApp account

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API (Multi-Device)
- [DeepSeek](https://deepseek.com/) - AI API for intelligent features
- [PostgreSQL](https://postgresql.org/) - Robust and reliable database
- [Supabase](https://supabase.com/) - Cloud PostgreSQL with built-in features
- [Node.js](https://nodejs.org/) - Runtime environment

## 📞 Support

- 📧 Email: support@example.com
- 💬 WhatsApp: +1234567890
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 📖 Wiki: [GitHub Wiki](https://github.com/your-repo/wiki)

---

**Made with ❤️ for better financial management**