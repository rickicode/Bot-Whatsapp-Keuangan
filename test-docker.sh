#!/bin/bash

# Test script for Docker setup
echo "🧪 Testing Docker Setup for WhatsApp Financial Bot"
echo "=================================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

echo "✅ Docker is installed: $(docker --version)"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found"
    echo "📝 Creating .env from .env.docker.example..."
    cp .env.docker.example .env
    echo "✏️  Please edit .env file with your configuration"
    echo "   Minimal required:"
    echo "   - BOT_ADMIN_PHONE=+6281234567890"
    echo "   - DEEPSEEK_API_KEY=your_api_key_here"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

echo "✅ .env file found"

# Check Docker daemon
if ! docker info &> /dev/null; then
    echo "❌ Docker daemon is not running"
    echo "   Please start Docker and try again"
    exit 1
fi

echo "✅ Docker daemon is running"

# Build the image
echo ""
echo "🔨 Building Docker image..."
if docker build -t whatsapp-financial-bot-test .; then
    echo "✅ Docker image built successfully"
else
    echo "❌ Failed to build Docker image"
    exit 1
fi

# Test environment variable processing
echo ""
echo "🔧 Testing environment variable processing..."
if docker run --rm --env-file .env whatsapp-financial-bot-test node scripts/create-env.js; then
    echo "✅ Environment variable processing works"
else
    echo "❌ Environment variable processing failed"
    exit 1
fi

# Test health check script
echo ""
echo "🏥 Testing health check script..."
if docker run --rm whatsapp-financial-bot-test /usr/local/bin/healthcheck.sh; then
    echo "❌ Health check should fail when services are not running (this is expected)"
else
    echo "✅ Health check script works (fails as expected without running services)"
fi

# Test supervisord configuration
echo ""
echo "📋 Testing supervisord configuration..."
if docker run --rm whatsapp-financial-bot-test supervisord -t -c /etc/supervisord.conf; then
    echo "✅ Supervisord configuration is valid"
else
    echo "❌ Supervisord configuration has errors"
    exit 1
fi

# Show final instructions
echo ""
echo "🚀 Docker setup test completed successfully!"
echo ""
echo "To run the bot:"
echo "  npm run docker:build    # Build image"
echo "  npm run docker:run      # Run container"
echo "  npm run docker:logs     # View logs"
echo ""
echo "Web interface will be available at:"
echo "  http://localhost:3000/qrscan (QR Code)"
echo "  http://localhost:3000/health (Health check)"
echo ""
echo "📝 Make sure to configure your .env file with:"
echo "  - BOT_ADMIN_PHONE (required)"
echo "  - DEEPSEEK_API_KEY or other AI provider key (required)"
echo "  - DATABASE configuration (optional, defaults to SQLite)"

# Cleanup test image
echo ""
echo "🧹 Cleaning up test image..."
docker rmi whatsapp-financial-bot-test &> /dev/null || true

echo "✅ Test completed!"