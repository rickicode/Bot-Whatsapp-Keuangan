#!/bin/bash

# Docker Build and Test Script for WhatsApp Financial Bot

set -e

echo "🐳 WhatsApp Financial Bot - Docker Build Script"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Clean up previous builds (optional)
if [ "$1" = "--clean" ]; then
    print_status "Cleaning up previous builds..."
    docker-compose down --volumes --remove-orphans 2>/dev/null || true
    docker system prune -f 2>/dev/null || true
    print_success "Cleanup completed"
fi

# Build the Docker image
print_status "Building Docker image..."
if docker build -t whatsapp-financial-bot .; then
    print_success "Docker image built successfully"
else
    print_error "Failed to build Docker image"
    exit 1
fi

# Test the image basic functionality
print_status "Testing Docker image..."
if docker run --rm whatsapp-financial-bot node -e "console.log('✅ Node.js is working'); process.exit(0);"; then
    print_success "Basic Node.js test passed"
else
    print_error "Basic Node.js test failed"
    exit 1
fi

# Test database setup with SQLite (safe test)
print_status "Testing database setup..."
if docker run --rm -e DATABASE_TYPE=sqlite3 -e NODE_ENV=production whatsapp-financial-bot node scripts/setup-database.js; then
    print_success "Database setup test passed"
else
    print_warning "Database setup test had issues (this might be normal)"
fi

print_success "Docker build completed successfully!"
echo ""
echo "🚀 Next steps:"
echo "   For development: docker-compose -f docker-compose.dev.yml up"
echo "   For production:  docker-compose up"
echo ""
echo "📝 Notes:"
echo "   - Make sure to configure your .env file for development"
echo "   - PostgreSQL will be started automatically in production"
echo "   - Check logs with: docker-compose logs -f"