# WhatsApp Financial Bot - User Manual

## 📱 Getting Started

### First Time Setup

1. **Contact the Bot**
   - Add the bot's WhatsApp number to your contacts
   - Send any message to start the conversation
   - The bot will automatically create your account

2. **First Command**
   ```
   /help
   ```
   This will show you all available commands and features.

3. **Authorization**
   - Only authorized phone numbers can use the bot
   - Contact the administrator if you get "Unauthorized user" message

## 💰 Recording Transactions

### Adding Income

**Basic Format:**
```
/masuk [amount] [description] [category]
```

**Examples:**
```
/masuk 1500000 salary from ABC company salary
/masuk 500000 freelance project web-design
/masuk 2000000 business sale revenue
/masuk 100000 dividend investment
```

**Quick Tips:**
- Amount should be in numbers only (no commas or currency symbols)
- Description is mandatory
- Category is optional (AI will suggest if not provided)
- If category doesn't exist, bot will use the closest match

### Adding Expenses

**Basic Format:**
```
/keluar [amount] [description] [category]
```

**Examples:**
```
/keluar 50000 lunch at restaurant food
/keluar 100000 gas for car transportation  
/keluar 25000 coffee with client entertainment
/keluar 500000 new laptop business-expense
```

**Quick Tips:**
- Use descriptive descriptions for better AI categorization
- Common categories: food, transportation, utilities, entertainment, healthcare, shopping

### Natural Language Input

Instead of commands, you can type naturally:

**Income Examples:**
```
"I received 500000 from client payment today"
"Got 1000000 salary this month"
"Earned 750000 from project completion"
```

**Expense Examples:**
```
"I spent 50000 for lunch today"
"Bought groceries for 150000"
"Paid 200000 for electricity bill"
```

**How it works:**
- AI analyzes your message
- Extracts amount, description, and suggests category
- High confidence transactions are added automatically
- Medium confidence transactions ask for confirmation

## 📊 Checking Your Finances

### Current Balance

```
/saldo
```

**Shows:**
- Total income
- Total expenses  
- Net balance
- Recent 5 transactions

### Financial Reports

**Daily Report:**
```
/laporan hari
```

**Weekly Report:**
```
/laporan minggu
```

**Monthly Report:**
```
/laporan bulan
```

**Yearly Report:**
```
/laporan tahun
```

**Report Contents:**
- Income vs expenses summary
- Comparison with previous period
- Top expense categories
- Largest transactions
- Daily averages
- Financial health indicator

## 🏷️ Managing Categories

### View Categories

```
/kategori
```
Shows all available income and expense categories.

### Add New Category

```
/kategori-baru [name] [type]
```

**Examples:**
```
/kategori-baru "Online Business" income
/kategori-baru "Pet Care" expense
/kategori-baru "Fitness" expense
```

**Default Categories:**

**Income:**
- Salary
- Freelance  
- Business
- Investment
- Other Income

**Expenses:**
- Food
- Transportation
- Utilities
- Entertainment
- Healthcare
- Shopping
- Business Expense
- Other Expense

## 💳 Debt Management

### Recording Debts (Money Others Owe You)

```
/hutang [amount] [client_name] [description] [due_date]
```

**Examples:**
```
/hutang 2000000 "John Doe" "Website development project" 2024-12-31
/hutang 500000 "ABC Company" "Consulting fee" 2024-06-15
/hutang 1000000 "Jane Smith" "Logo design work" 2024-07-01
```

### Recording Debt Payments

```
/bayar-hutang [client_name] [amount]
```

**Examples:**
```
/bayar-hutang "John Doe" 1000000
/bayar-hutang "ABC Company" 500000
```

**How Payment Works:**
- Payments are applied to oldest debts first
- Partial payments are supported
- Status automatically updates (pending → partial → paid)
- Remaining amount is calculated automatically

### Viewing All Debts

```
/hutang-list
```

**Shows:**
- All debts with status
- Outstanding amounts
- Due dates
- Client information
- Debt IDs for reference

**Debt Status:**
- ⏳ **Pending** - Not paid yet
- 🟡 **Partial** - Partially paid
- ✅ **Paid** - Fully paid
- 🔴 **Overdue** - Past due date

## 📅 Bill Reminders

### Adding Bills

```
/tagihan [amount] [description] [due_date] [frequency]
```

**Examples:**
```
/tagihan 500000 "Office rent" 2024-06-01 monthly
/tagihan 150000 "Internet bill" 2024-06-15 monthly
/tagihan 1000000 "Insurance premium" 2024-12-31 yearly
```

**Frequency Options:**
- `monthly` - Every month
- `weekly` - Every week  
- `yearly` - Every year
- `one-time` - Single reminder

### How Reminders Work

- Bot sends reminder 1 day before due date
- Automatic reminders via WhatsApp
- After reminder, next due date is calculated
- You can disable reminders anytime

## 🤖 AI Features

### Financial Analysis

```
/analisis
```

**AI provides:**
- Spending pattern analysis
- Income vs expense trends
- Category insights
- Financial health assessment
- Personalized recommendations

### AI Chat

```
/chat [your question]
```

**Examples:**
```
/chat How can I reduce my food expenses?
/chat What's my average monthly income?
/chat Should I invest more money?
/chat How much do I spend on transportation?
```

**AI understands:**
- Questions about your spending habits
- Requests for financial advice
- Budget planning questions
- Savings strategies

### AI Predictions

```
/prediksi-ai
```

**Provides:**
- Cash flow forecasts
- Expected income/expenses
- Budget recommendations
- Trend predictions

### Auto Categorization

```
/kategori-otomatis
```

**Features:**
- Reviews recent transactions
- Suggests better categories
- Learns from your patterns
- Improves accuracy over time

## ✏️ Editing & Managing Data

### Edit Transactions

```
/edit [transaction_id]
```

**Example:**
```
/edit 123
```

Bot will guide you through editing:
- Amount
- Description  
- Category
- Date

### Delete Transactions

```
/hapus [transaction_id]
```

**Example:**
```
/hapus 123
```

**⚠️ Warning:** Deleted transactions cannot be recovered!

### Find Transaction ID

Transaction IDs are shown when you:
- Add new transactions
- View balance (`/saldo`)
- Generate reports
- List debts

## 💾 Data Management

### Backup Your Data

```
/backup
```

**Creates:**
- Database backup file
- CSV export of all transactions
- Stored securely on server

### Export to CSV

```
/export
```

**Exports:**
- All your transactions
- Formatted for Excel/Google Sheets
- Includes categories and dates
- Ready for accounting software

### Data Security

**Your data is:**
- Encrypted at rest
- Backed up daily automatically
- Only accessible by you
- Never shared with third parties

## 📱 Tips for Best Experience

### Writing Good Descriptions

**Good:**
```
"Lunch at McDonald's with team"
"Gas for Honda Civic"
"Client payment for Logo design"
```

**Avoid:**
```
"Food" (too generic)
"Stuff" (not descriptive)
"Money" (unclear purpose)
```

### Using Categories Effectively

- Use specific categories for better insights
- Create custom categories for unique expenses
- AI learns from your category choices
- Consistent categorization improves reports

### Natural Language Tips

**Clear amounts:**
```
"I spent 50000 for lunch" ✅
"Spent around 50k" ❌ (ambiguous)
```

**Specific descriptions:**
```
"Bought groceries at Carrefour" ✅
"Shopping" ❌ (too generic)
```

### Regular Usage

**Best practices:**
- Record transactions immediately
- Check balance weekly
- Review monthly reports
- Set up bill reminders
- Use AI analysis for insights

## 🆘 Troubleshooting

### Common Issues

**"Unknown command" error:**
- Check command spelling
- Use `/help` to see all commands
- Commands are case-sensitive

**"Invalid amount" error:**
- Use numbers only (no commas/symbols)
- Example: `50000` not `50,000` or `Rp 50.000`

**"Category not found":**
- Check available categories with `/kategori`
- Create new category with `/kategori-baru`
- Let AI suggest category (leave blank)

**AI features not working:**
- AI might be temporarily unavailable
- Try again in a few minutes
- Use manual commands as alternative

### Getting Help

**Quick help:**
```
/help
```

**Specific questions:**
```
/chat [your question about the bot]
```

**Emergency contact:**
- Contact bot administrator
- WhatsApp support number
- Email support (if available)

## 🎯 Advanced Features

### Multi-Currency (If Enabled)

- Set default currency in settings
- Record transactions in different currencies
- Automatic conversion for reports

### Bulk Operations

- Import from CSV files
- Bulk categorization
- Mass updates with AI assistance

### Integrations

- Export to accounting software
- Connect with banking APIs (if available)
- Sync with other financial tools

## 🔐 Privacy & Security

### What We Store

- Your transaction data
- Category preferences
- AI interaction history
- Usage statistics

### What We Don't Store

- WhatsApp messages content
- Personal identification details
- Banking information
- Third-party app data

### Your Rights

- Request data export anytime
- Delete your data completely
- Control AI feature usage
- Manage data sharing preferences

---

**Need more help?** Send `/chat` followed by your question, and the AI assistant will help you!