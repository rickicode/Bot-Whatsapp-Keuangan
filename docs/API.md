# API Documentation - WhatsApp Financial Bot

## 🌐 HTTP Endpoints

The bot includes a simple Express server for health checks and webhook integrations.

### Health Check

**GET** `/health`

Returns the current status of the bot.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600
}
```

### Webhook Endpoint

**POST** `/webhook`

Endpoint for external integrations and notifications.

**Request Body:**
```json
{
  "type": "external_transaction",
  "data": {
    "amount": 50000,
    "description": "Bank transfer received",
    "user_phone": "+1234567890"
  }
}
```

## 📊 Database API

### Direct Database Access

For advanced integrations, you can access the database directly through the DatabaseManager class.

#### Initialize Connection

```javascript
const DatabaseManager = require('./src/database/DatabaseManager');

const db = new DatabaseManager();
await db.initialize();
```

#### User Management

```javascript
// Create user
await db.createUser(phoneNumber, name);

// Get user
const user = await db.getUser(phoneNumber);
```

#### Transaction Operations

```javascript
// Add transaction
const transactionId = await db.addTransaction(
    userPhone,
    'expense',  // or 'income'
    amount,
    categoryId,
    description,
    date
);

// Get transactions
const transactions = await db.getTransactions(userPhone, limit, offset);

// Update transaction
await db.updateTransaction(transactionId, userPhone, {
    amount: newAmount,
    description: newDescription
});

// Delete transaction
await db.deleteTransaction(transactionId, userPhone);
```

#### Category Operations

```javascript
// Get categories
const categories = await db.getCategories(userPhone, 'expense');

// Add category
const categoryId = await db.addCategory(userPhone, name, type, color);
```

#### Balance Calculation

```javascript
// Get current balance
const balance = await db.getBalance(userPhone);
// Returns: { income: number, expenses: number, balance: number }

// Get balance for specific period
const periodBalance = await db.getBalance(userPhone, endDate);
```

## 🤖 AI Service API

### DeepSeek Integration

The AIService class provides methods for AI-powered features.

#### Initialize AI Service

```javascript
const AIService = require('./src/services/AIService');

const ai = new AIService();
```

#### Natural Language Processing

```javascript
// Parse natural language transaction
const parsed = await ai.parseNaturalLanguageTransaction(
    "I spent 50000 for lunch today",
    userPhone
);

// Returns:
// {
//   type: "expense",
//   amount: 50000,
//   description: "lunch today",
//   category: "Food",
//   confidence: 0.9
// }
```

#### Smart Categorization

```javascript
// Suggest category for transaction
const category = await ai.categorizeTransaction(
    "lunch at restaurant",
    50000,
    "expense"
);
// Returns: "Food"
```

#### Financial Analysis

```javascript
// Generate AI analysis
const analysis = await ai.generateFinancialAnalysis({
    balance: balanceData,
    transactions: transactionList,
    monthlyTrends: trendsData,
    categories: categoryData
});
```

#### Financial Advice

```javascript
// Get AI advice
const advice = await ai.generateFinancialAdvice(
    "How can I reduce my expenses?",
    userContext
);
```

## 🔧 Service APIs

### Transaction Service

```javascript
const TransactionService = require('./src/services/TransactionService');

const transactionService = new TransactionService(database, aiService);

// Add income
const result = await transactionService.addIncome(
    userPhone,
    amount,
    description,
    categoryName
);

// Add expense
const result = await transactionService.addExpense(
    userPhone,
    amount,
    description,
    categoryName
);

// Get transaction history with filters
const history = await transactionService.getTransactionHistory(userPhone, {
    limit: 50,
    type: 'expense',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    search: 'lunch'
});

// Get transaction summary
const summary = await transactionService.getTransactionSummary(userPhone, 'month');
```

### Report Service

```javascript
const ReportService = require('./src/services/ReportService');

const reportService = new ReportService(database, aiService);

// Generate report
const report = await reportService.generateReport(userPhone, 'month');

// Generate AI analysis
const analysis = await reportService.generateAIAnalysis(userPhone);

// Export to CSV
const csvData = await reportService.exportToCsv(userPhone, startDate, endDate);

// Get user context for AI
const context = await reportService.getUserContext(userPhone);
```

### Debt Service

```javascript
const DebtService = require('./src/services/DebtService');

const debtService = new DebtService(database);

// Add debt
const debt = await debtService.addDebt(
    userPhone,
    clientName,
    amount,
    description,
    dueDate,
    'receivable'
);

// Process payment
const payment = await debtService.payDebt(userPhone, clientName, amount);

// Get all debts
const debts = await debtService.getDebts(userPhone, 'pending');

// Get debt summary
const summary = await debtService.getDebtSummary(userPhone);
```

### Category Service

```javascript
const CategoryService = require('./src/services/CategoryService');

const categoryService = new CategoryService(database);

// Add category
const category = await categoryService.addCategory(
    userPhone,
    'Custom Category',
    'expense',
    '#ff0000'
);

// Get categories
const categories = await categoryService.getCategories(userPhone, 'expense');

// Get category statistics
const stats = await categoryService.getCategoryStats(userPhone, 'month');

// Suggest category
const suggestion = await categoryService.suggestCategory(
    'lunch at restaurant',
    50000,
    'expense'
);
```

### Reminder Service

```javascript
const ReminderService = require('./src/services/ReminderService');

const reminderService = new ReminderService(database);

// Add bill reminder
const bill = await reminderService.addBill(
    userPhone,
    'Electricity Bill',
    150000,
    categoryId,
    '2024-06-15',
    'monthly'
);

// Get bills
const bills = await reminderService.getBills(userPhone, true);

// Get upcoming bills
const upcoming = await reminderService.getUpcomingBills(userPhone, 7);

// Check and send reminders (used by cron job)
await reminderService.checkAndSendReminders(whatsappClient);
```

## 📱 WhatsApp Integration

### Message Handling

```javascript
// The main message handler in CommandHandler.js
async handleMessage(message) {
    const userPhone = message.from.replace('@c.us', '');
    const text = message.body.trim();
    
    // Ensure user exists
    await this.db.createUser(userPhone);
    
    // Process command or natural language
    if (text.startsWith('/')) {
        await this.handleCommand(message, userPhone, text);
    } else if (this.ai.isAvailable()) {
        await this.handleNaturalLanguage(message, userPhone, text);
    }
}
```

### Sending Messages

```javascript
// Send message to specific user
await client.sendMessage(phoneNumber + '@c.us', message);

// Send message with media
await client.sendMessage(phoneNumber + '@c.us', message, {
    media: await MessageMedia.fromFilePath('./chart.png'),
    caption: 'Your financial chart'
});
```

### Message Types

```javascript
// Text message
await message.reply('Hello!');

// Formatted message
await message.reply(`*Bold Text*
_Italic Text_
~Strikethrough~
\`\`\`Code Block\`\`\``);

// Message with buttons (if supported)
await message.reply('Choose an option:', {
    buttons: [
        { body: 'Income', id: 'income' },
        { body: 'Expense', id: 'expense' }
    ]
});
```

## 🔐 Authentication & Security

### User Authorization

```javascript
// Check if user is authorized
isAuthorizedUser(phoneNumber) {
    const allowedUsers = process.env.ALLOWED_USERS?.split(',') || [];
    return allowedUsers.some(allowed => 
        phoneNumber.includes(allowed.replace(/\+/g, ''))
    );
}
```

### Data Encryption

```javascript
// Encrypt sensitive data (if implemented)
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = process.env.ENCRYPTION_KEY;

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encryptedText) {
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}
```

## 🛠️ Error Handling

### Standard Error Response

```javascript
try {
    // Operation that might fail
    const result = await someOperation();
    await message.reply(`✅ Success: ${result}`);
} catch (error) {
    this.logger.error('Operation failed:', error);
    await message.reply('❌ Operation failed. Please try again.');
}
```

### Custom Error Types

```javascript
class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

class DatabaseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DatabaseError';
    }
}

class AIServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AIServiceError';
    }
}
```

## 📊 Data Models

### Transaction Model

```javascript
{
    id: 1,
    user_phone: "+1234567890",
    type: "expense", // or "income"
    amount: 50000,
    category_id: 5,
    description: "Lunch at restaurant",
    date: "2024-01-01",
    created_at: "2024-01-01T12:00:00.000Z",
    updated_at: "2024-01-01T12:00:00.000Z"
}
```

### Category Model

```javascript
{
    id: 1,
    user_phone: "+1234567890",
    name: "Food",
    type: "expense",
    color: "#ff6b6b",
    is_active: true,
    created_at: "2024-01-01T12:00:00.000Z"
}
```

### Debt Model

```javascript
{
    id: 1,
    user_phone: "+1234567890",
    client_id: 1,
    type: "receivable", // or "payable"
    amount: 1000000,
    paid_amount: 500000,
    description: "Website development",
    due_date: "2024-06-15",
    status: "partial", // pending, partial, paid, overdue
    created_at: "2024-01-01T12:00:00.000Z",
    updated_at: "2024-01-01T12:00:00.000Z"
}
```

### Client Model

```javascript
{
    id: 1,
    user_phone: "+1234567890",
    name: "John Doe",
    phone: "+0987654321",
    email: "john@example.com",
    notes: "Regular client",
    created_at: "2024-01-01T12:00:00.000Z"
}
```

### Bill Model

```javascript
{
    id: 1,
    user_phone: "+1234567890",
    name: "Electricity Bill",
    amount: 150000,
    category_id: 3,
    due_date: "2024-06-15",
    frequency: "monthly", // weekly, monthly, yearly, one-time
    next_reminder: "2024-06-14",
    is_active: true,
    created_at: "2024-01-01T12:00:00.000Z"
}
```

## 🔍 Testing

### Unit Testing Example

```javascript
const { expect } = require('chai');
const TransactionService = require('../src/services/TransactionService');

describe('TransactionService', () => {
    let transactionService;
    
    beforeEach(() => {
        transactionService = new TransactionService(mockDb, mockAI);
    });
    
    it('should add income transaction', async () => {
        const result = await transactionService.addIncome(
            '+1234567890',
            100000,
            'Test income',
            'Salary'
        );
        
        expect(result.amount).to.equal(100000);
        expect(result.categoryName).to.equal('Salary');
    });
});
```

### Integration Testing

```javascript
const request = require('supertest');
const app = require('../src/index.js');

describe('Health Endpoint', () => {
    it('should return OK status', async () => {
        const response = await request(app)
            .get('/health')
            .expect(200);
            
        expect(response.body.status).to.equal('OK');
    });
});
```

---

**Note**: This API documentation covers the main interfaces and methods. For complete implementation details, refer to the source code in each service file.