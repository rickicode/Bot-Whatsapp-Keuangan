#!/bin/bash

# Simple Docker test script for WhatsApp Financial Bot
set -e

echo "🔧 Building Docker image..."
docker build -t whatsapp-financial-bot .

echo "🚀 Testing container with minimal environment..."

# Create test environment file
cat > .env.test << EOF
# Minimal test configuration
BOT_NAME=Test Bot
BOT_ADMIN_PHONE=+6281234567890
DEEPSEEK_API_KEY=test_key_here
DATABASE_TYPE=sqlite3
DB_PATH=/app/data/financial.db
AI_PROVIDER=deepseek
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
EOF

# Run container with test environment
echo "📱 Starting container..."
docker run --rm -d \
    --name whatsapp-bot-test \
    -p 3000:3000 \
    --env-file .env.test \
    -v $(pwd)/data:/app/data \
    -v $(pwd)/logs:/app/logs \
    whatsapp-financial-bot

echo "⏳ Waiting for container to start (30 seconds)..."
sleep 30

echo "🔍 Checking container health..."
if docker exec whatsapp-bot-test /usr/local/bin/healthcheck.sh; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed"
fi

echo "📊 Container status:"
docker ps -f name=whatsapp-bot-test

echo "📜 Container logs (last 20 lines):"
docker logs --tail=20 whatsapp-bot-test

echo "🛑 Stopping test container..."
docker stop whatsapp-bot-test

echo "🧹 Cleaning up test files..."
rm -f .env.test

echo "✅ Docker test completed successfully!"
echo ""
echo "🚀 To run with your own configuration:"
echo "   1. Copy .env.example to .env"
echo "   2. Edit .env with your settings"
echo "   3. Run: docker run -d --name whatsapp-bot -p 3000:3000 --env-file .env whatsapp-financial-bot"
echo "   4. Check QR: http://localhost:3000/qrscan"