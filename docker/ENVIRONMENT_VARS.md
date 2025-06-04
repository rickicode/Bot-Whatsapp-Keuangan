# Environment Variables for EasyPanel Deployment

This document explains how to configure environment variables for EasyPanel deployment.

## 🔧 EasyPanel Configuration

### **Setting Environment Variables in EasyPanel:**

1. **In EasyPanel Dashboard:**
   - Go to your application settings
   - Navigate to "Environment Variables" section
   - Add the required variables listed below

2. **Required Variables:**
   ```bash
   # Critical variables that MUST be set
   DEEPSEEK_API_KEY=your_deepseek_api_key_here
   DATABASE_HOST=your-project.supabase.co
   DATABASE_PASSWORD=your_supabase_password
   BOT_ADMIN_PHONE=+6281234567890
   ```

3. **Optional but Recommended:**
   ```bash
   BOT_NAME=Your Bot Name
   AI_PROVIDER=deepseek
   DATABASE_USER=postgres
   DATABASE_NAME=postgres
   ```

## 📋 Complete Environment Variables List

### **🤖 Bot Configuration**
```bash
BOT_NAME=Bot Keuangan Pribadi
BOT_ADMIN_PHONE=+6281234567890
```

### **🧠 AI Configuration**
```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat

# Alternative AI providers (optional)
OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
GOOGLE_API_KEY=your_google_api_key
```

### **🗄️ Database Configuration (Supabase)**
```bash
DATABASE_TYPE=postgres
DATABASE_HOST=your-project.supabase.co
DATABASE_PORT=5432
DATABASE_NAME=postgres
DATABASE_USER=postgres
DATABASE_PASSWORD=your_supabase_password
DATABASE_SSL=true
```

### **⚙️ Application Settings**
```bash
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
TZ=Asia/Jakarta
LOCALE=id-ID
```

### **🛡️ Anti-spam Configuration**
```bash
ANTI_SPAM_USER_PER_MINUTE=15
ANTI_SPAM_GLOBAL_PER_MINUTE=75
ANTI_SPAM_EMERGENCY_BRAKE=true
ANTI_SPAM_EMERGENCY_THRESHOLD=90
```

### **🎯 Feature Flags**
```bash
ENABLE_AI_FEATURES=true
ENABLE_OCR=true
ENABLE_REMINDERS=true
ASK_CATEGORY_IF_UNKNOWN=true
```

### **🚀 Performance Optimization**
```bash
NODE_OPTIONS=--max-old-space-size=320
NPM_CONFIG_FUND=false
NPM_CONFIG_AUDIT=false
```

### **💾 Backup Configuration**
```bash
BACKUP_ENABLED=true
BACKUP_INTERVAL_HOURS=24
BACKUP_RETENTION_DAYS=7
```

### **🔐 Security Settings**
```bash
SESSION_SECRET=your_random_session_secret
ENCRYPTION_KEY=your_random_encryption_key
```

### **📊 Monitoring & Logging**
```bash
HEALTH_CHECK_INTERVAL=60
LOG_ROTATION_SIZE=50M
LOG_RETENTION_DAYS=7
```

### **🌐 Webhook & External Services**
```bash
WEBHOOK_URL=your_webhook_url
WEBHOOK_SECRET=your_webhook_secret
```

### **📱 EasyPanel Specific**
```bash
DEPLOYMENT_ENV=easypanel
CONTAINER_NAME=whatsapp-bot-easypanel
```

## 🔧 EasyPanel Setup Steps

### **Step 1: Minimal Required Setup**
```bash
# Set these in EasyPanel environment variables
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx
DATABASE_HOST=abcdefgh.supabase.co
DATABASE_PASSWORD=your_strong_password
BOT_ADMIN_PHONE=+6281234567890
```

### **Step 2: Deploy**
```bash
# EasyPanel will automatically:
# 1. Set environment variables in container
# 2. Run create-env-from-docker.sh script
# 3. Generate .env file from environment variables
# 4. Start the application
```

### **Step 3: Verify**
```bash
# Check logs to see if environment was created properly
# Look for: "✅ .env file created successfully"
```

## 📝 Environment Variable Examples

### **Development/Testing:**
```bash
NODE_ENV=development
LOG_LEVEL=debug
DATABASE_TYPE=sqlite
DB_PATH=/app/data/test.db
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-test-key
```

### **Production (EasyPanel):**
```bash
NODE_ENV=production
LOG_LEVEL=info
DATABASE_TYPE=postgres
DATABASE_HOST=myproject.supabase.co
DATABASE_PASSWORD=strong_password_here
DATABASE_SSL=true
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-live-key
ANTI_SPAM_EMERGENCY_BRAKE=true
ENABLE_AI_FEATURES=true
```

## 🔍 Troubleshooting Environment Variables

### **Check Generated .env File:**
```bash
# View generated .env file
docker exec whatsapp-bot-easypanel cat /app/.env

# Check specific variable
docker exec whatsapp-bot-easypanel grep "DATABASE_HOST" /app/.env
```

### **Regenerate .env File:**
```bash
# Force regenerate .env from current environment
docker exec whatsapp-bot-easypanel /usr/local/bin/create-env-from-docker.sh
```

### **Validate Environment:**
```bash
# Check environment variables in container
docker exec whatsapp-bot-easypanel env | grep -E "(DATABASE|BOT|AI)"

# Test database connection
docker exec whatsapp-bot-easypanel node -e "
const DatabaseManager = require('./src/database/DatabaseManager');
const db = new DatabaseManager();
db.testConnection().then(() => console.log('✅ DB OK')).catch(console.error);
"
```

## ⚠️ Security Considerations

### **Sensitive Variables:**
- **Never commit** `.env` files to version control
- **Use strong passwords** for DATABASE_PASSWORD
- **Generate random secrets** for SESSION_SECRET and ENCRYPTION_KEY
- **Rotate API keys** regularly

### **EasyPanel Security:**
- Environment variables in EasyPanel are **encrypted at rest**
- Variables are **not exposed** in logs
- Access is **controlled** by EasyPanel permissions

## 🚀 Ready for Deployment

After setting all required environment variables in EasyPanel:

1. **Build**: EasyPanel builds from `Dockerfile.easypanel`
2. **Environment**: Container gets environment variables from EasyPanel
3. **Generate**: `create-env-from-docker.sh` creates `.env` file
4. **Start**: Application reads configuration from `.env`
5. **Run**: WhatsApp Bot starts with proper configuration

All environment variables are automatically converted to a proper `.env` file format for the application to use! 🎯