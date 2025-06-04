# API Setup Guide - WhatsApp Financial Bot

## Environment Variables

Untuk menggunakan fitur API messaging dan webhook, Anda perlu menambahkan environment variable berikut:

### Required Variables

```bash
# API Configuration
API_KEY=your_secret_api_key_here_make_it_strong_and_unique

# Bot Configuration (existing)
DEEPSEEK_API_KEY=your_deepseek_api_key
BOT_ADMIN_PHONE=628123456789
BOT_NAME=Financial Manager Bot

# Database Configuration (existing)
DATABASE_TYPE=sqlite3
DB_PATH=./data/financial.db

# Server Configuration
PORT=3000
NODE_ENV=production
BASE_URL=https://your-bot-domain.com
```

### Optional Variables

```bash
# Rate Limiting (optional, has defaults)
MAX_MESSAGES_PER_MINUTE_PER_USER=10
MAX_MESSAGES_PER_MINUTE_GLOBAL=100
EMERGENCY_BRAKE_THRESHOLD=50

# Webhook Configuration (optional)
WEBHOOK_TIMEOUT=30000
WEBHOOK_RETRY_ATTEMPTS=3
```

## API Key Generation

Generate API key yang kuat untuk keamanan:

```bash
# Method 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Method 2: Using OpenSSL
openssl rand -hex 32

# Method 3: Using uuidgen
uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]'
```

Contoh API key yang dihasilkan:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

## Setup Steps

### 1. Clone Repository & Install Dependencies

```bash
git clone <repository-url>
cd whatsapp-financial-bot
npm install
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env file
nano .env
```

Tambahkan/update variabel berikut di `.env`:
```bash
API_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
DEEPSEEK_API_KEY=your_deepseek_api_key
BOT_ADMIN_PHONE=628123456789
PORT=3000
BASE_URL=https://your-domain.com
```

### 3. Initialize Database

```bash
# Run database migrations
npm run migrate

# Seed initial data (optional)
npm run migrate:seed
```

### 4. Start Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### 5. Test API Connection

```bash
# Test basic connectivity
curl -X GET "http://localhost:3000/api/test" \
  -H "X-API-Key: your_api_key_here"

# Expected response:
# {
#   "success": true,
#   "message": "API is working",
#   "timestamp": "2024-01-20T10:30:00.000Z",
#   "version": "1.0.0"
# }
```

### 6. Connect WhatsApp

1. Open `http://localhost:3000/qrscan` in browser
2. Scan QR code with WhatsApp
3. Wait for connection confirmation
4. Test sending message via API

## Docker Setup

### 1. Using Docker Compose (Recommended)

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  whatsapp-bot:
    build: .
    ports:
      - "3000:3000"
    environment:
      - API_KEY=your_secret_api_key_here
      - DEEPSEEK_API_KEY=your_deepseek_api_key
      - BOT_ADMIN_PHONE=628123456789
      - DATABASE_TYPE=sqlite3
      - DB_PATH=/app/data/financial.db
      - PORT=3000
      - NODE_ENV=production
      - BASE_URL=https://your-domain.com
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Add PostgreSQL if needed
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: financial_bot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

Start with Docker Compose:
```bash
docker-compose up -d
```

### 2. Using Docker Run

```bash
# Build image
docker build -t whatsapp-financial-bot .

# Run container
docker run -d \
  --name whatsapp-bot \
  -p 3000:3000 \
  -e API_KEY=your_secret_api_key_here \
  -e DEEPSEEK_API_KEY=your_deepseek_api_key \
  -e BOT_ADMIN_PHONE=628123456789 \
  -e DATABASE_TYPE=sqlite3 \
  -e DB_PATH=/app/data/financial.db \
  -e PORT=3000 \
  -e NODE_ENV=production \
  -e BASE_URL=https://your-domain.com \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --restart unless-stopped \
  whatsapp-financial-bot
```

## EasyPanel Setup

Jika menggunakan EasyPanel, ikuti langkah berikut:

### 1. Prepare Environment

```bash
# Copy EasyPanel environment template
cp docker/.env.template .env

# Edit environment variables
nano .env
```

### 2. Deploy to EasyPanel

```bash
# Use EasyPanel start script
chmod +x docker/start-easypanel.sh
./docker/start-easypanel.sh
```

### 3. Configure Domain

1. Login ke EasyPanel dashboard
2. Navigate ke app settings
3. Configure domain dan SSL
4. Update `BASE_URL` environment variable

## Reverse Proxy Setup

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-bot-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-bot-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # Rate limiting untuk API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Rate limiting configuration
http {
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
}
```

### Apache Configuration

```apache
<VirtualHost *:80>
    ServerName your-bot-domain.com
    Redirect permanent / https://your-bot-domain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName your-bot-domain.com
    
    SSLEngine on
    SSLCertificateFile /path/to/your/certificate.crt
    SSLCertificateKeyFile /path/to/your/private.key
    
    ProxyPreserveHost On
    ProxyRequests Off
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # Headers untuk WebSocket support
    ProxyPass /ws/ ws://localhost:3000/ws/
    ProxyPassReverse /ws/ ws://localhost:3000/ws/
</VirtualHost>
```

## Health Check & Monitoring

### Health Check Endpoint

```bash
# Check application health
curl -X GET "http://localhost:3000/health"

# Expected response:
# {
#   "status": "OK",
#   "timestamp": "2024-01-20T10:30:00.000Z",
#   "uptime": 3600,
#   "whatsapp": {
#     "connected": true,
#     "qrRequired": false
#   },
#   "database": {
#     "status": "connected"
#   }
# }
```

### Monitoring Script

Create `scripts/monitor-api.sh`:
```bash
#!/bin/bash

API_URL="http://localhost:3000"
API_KEY="your_api_key_here"

# Test API connectivity
echo "Testing API connectivity..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "$API_URL/api/test" \
  -H "X-API-Key: $API_KEY")

if [ $response -eq 200 ]; then
    echo "✅ API is healthy"
else
    echo "❌ API is not responding properly (HTTP $response)"
    exit 1
fi

# Test WhatsApp connection
echo "Testing WhatsApp connection..."
health=$(curl -s "$API_URL/health" | jq -r '.whatsapp.connected')

if [ "$health" == "true" ]; then
    echo "✅ WhatsApp is connected"
else
    echo "❌ WhatsApp is not connected"
    exit 1
fi

echo "All systems operational!"
```

Make it executable and run:
```bash
chmod +x scripts/monitor-api.sh
./scripts/monitor-api.sh
```

## Security Considerations

### 1. API Key Security

- Gunakan API key yang kuat (minimal 32 karakter)
- Jangan hardcode API key di source code
- Rotate API key secara berkala
- Monitor API usage untuk detect abuse

### 2. Rate Limiting

Configure rate limiting di aplikasi:
```javascript
// Custom rate limiting di environment
MAX_MESSAGES_PER_MINUTE_PER_USER=5
MAX_MESSAGES_PER_MINUTE_GLOBAL=50
EMERGENCY_BRAKE_THRESHOLD=30
```

### 3. IP Whitelist (Optional)

Jika perlu, implementasikan IP whitelist:
```javascript
// Di environment variable
ALLOWED_IPS=192.168.1.100,10.0.0.0/8,172.16.0.0/12

// Atau di nginx
location /api/ {
    allow 192.168.1.100;
    allow 10.0.0.0/8;
    deny all;
    proxy_pass http://localhost:3000;
}
```

### 4. HTTPS Only

Selalu gunakan HTTPS di production:
```javascript
// Middleware untuk force HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  } else {
    next();
  }
});
```

## Troubleshooting

### Common Issues

1. **API Key tidak valid**
   ```
   Error: Invalid or missing API key
   Solution: Periksa API_KEY di environment variable
   ```

2. **WhatsApp tidak terhubung**
   ```
   Error: Messaging service not available
   Solution: Scan QR code di /qrscan dan tunggu koneksi
   ```

3. **Rate limit exceeded**
   ```
   Error: Message blocked by anti-spam
   Solution: Tunggu beberapa menit atau adjust rate limit
   ```

4. **Database connection error**
   ```
   Error: Database connection failed
   Solution: Periksa DATABASE_TYPE dan DB_PATH/connection string
   ```

### Debug Mode

Enable debug logging:
```bash
DEBUG=whatsapp-bot:* npm start
```

### Log Files

Check log files untuk troubleshooting:
```bash
# Application logs
tail -f logs/app.log

# Error logs
tail -f logs/error.log

# API access logs
tail -f logs/api.log
```

## Support & Documentation

- **API Documentation**: [docs/API_DOCUMENTATION.md](./API_DOCUMENTATION.md)
- **Webhook Guide**: [docs/WEBHOOK_GUIDE.md](./WEBHOOK_GUIDE.md)
- **Migration Guide**: [docs/MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)
- **EasyPanel Setup**: [docs/EASYPANEL_SETUP.md](./EASYPANEL_SETUP.md)

Untuk pertanyaan lebih lanjut, buka issue di repository atau hubungi tim development.