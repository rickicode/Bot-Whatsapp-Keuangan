# WhatsApp Financial Management Bot with Indonesian AI Assistant

A comprehensive WhatsApp bot for managing personal finances with AI-powered insights using DeepSeek API. Features intelligent user registration, subscription management, and advanced financial analysis through simple WhatsApp commands - all in Indonesian language.

> 🚀 **MIGRATED TO BAILEYS**: This bot now uses [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys) for better performance, stability, and multi-device support. See [BAILEYS_MIGRATION.md](BAILEYS_MIGRATION.md) for details.

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
- ✅ **Debt & Receivables Management** - Track what you owe and what others owe you
- ✅ **Bill Reminders** - Automated reminders for recurring payments
- ✅ **Category Management** - Organize transactions with custom categories
- ✅ **Balance & Reports** - Real-time balance and detailed financial reports

### AI-Powered Features (DeepSeek Integration)
- 🤖 **Natural Language Processing** - "I spent 50k for lunch today"
- 🤖 **Smart Categorization** - AI suggests appropriate categories
- 🤖 **Financial Analysis** - AI-powered spending pattern analysis
- 🤖 **Cash Flow Predictions** - AI-based financial forecasting
- 🤖 **Financial Advice** - Personalized recommendations
- 🤖 **Conversational Interface** - Ask questions about your finances

### Advanced Features
- 📊 **Comprehensive Reporting** - Daily, weekly, monthly, yearly reports
- 💾 **Data Export** - CSV exports for accounting software
- 🔄 **Automated Backups** - Scheduled database backups
- 🔔 **Smart Reminders** - Bill payment and debt collection reminders
- 🏷️ **Flexible Categories** - Custom income and expense categories
- 📱 **Multi-Currency Support** - Handle different currencies
- 🔐 **Security** - Encrypted data storage and user authentication

## 🚀 Quick Start

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
npm run setup
# For existing databases, run migration for Indonesian AI Assistant
node scripts/migrate-registration.js
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
```

### Database Configuration
- **SQLite** (default): Lightweight, perfect for personal use
- **PostgreSQL**: Available for scaling (modify DatabaseManager.js)

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

### Debt Management
```
/hutang 1000000 John "Web project" 2024-12-31
/bayar-hutang John 500000
/hutang-list
```

### AI Commands
```
/analisis          # AI financial analysis
/saran            # AI financial advice
/chat How can I save more money?
/prediksi-ai      # AI cash flow prediction
/kategori-otomatis # Auto-categorize transactions
```

### Data Management
```
/edit 123         # Edit transaction ID 123
/hapus 123        # Delete transaction ID 123
/backup           # Create backup
/export           # Export to CSV
```

### Natural Language
Just type naturally:
```
"I spent 50000 for lunch today"
"Received 500000 from client payment"
"Bought groceries for 75000"
```

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
-- Users
users (id, phone, name, timezone, default_currency, created_at)

-- Categories  
categories (id, user_phone, name, type, color, is_active)

-- Transactions
transactions (id, user_phone, type, amount, category_id, description, date)

-- Debts/Receivables
debts (id, user_phone, client_id, type, amount, paid_amount, status, due_date)

-- Bills/Reminders
bills (id, user_phone, name, amount, due_date, frequency, next_reminder)

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
│   │   ├── DebtService.js
│   │   ├── CategoryService.js
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
npm run setup      # Initial setup
npm run backup     # Manual backup
npm test           # Run tests
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
- [📖 User Manual](docs/USER_MANUAL.md) - Detailed user guide
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
- [SQLite](https://sqlite.org/) - Lightweight database
- [Node.js](https://nodejs.org/) - Runtime environment

## 📞 Support

- 📧 Email: support@example.com
- 💬 WhatsApp: +1234567890
- 🐛 Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 📖 Wiki: [GitHub Wiki](https://github.com/your-repo/wiki)

---

**Made with ❤️ for better financial management**