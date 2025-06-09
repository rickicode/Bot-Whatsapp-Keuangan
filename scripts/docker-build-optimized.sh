#!/bin/bash

# Optimized Docker build script with automatic cleanup
set -e

IMAGE_NAME=${1:-"kasai-app"}
TAG=${2:-"latest"}

echo "🚀 Building Docker image: $IMAGE_NAME:$TAG"
echo "📦 This script will automatically clean up disk space and use optimized build settings"
echo ""

# Check available disk space
echo "💾 Checking available disk space..."
df -h . | grep -v Filesystem

# Clean up Docker to free space
echo ""
echo "🧹 Running Docker cleanup..."
./scripts/docker-cleanup.sh

echo ""
echo "🔨 Starting optimized Docker build..."

# Use BuildKit for more efficient builds
export DOCKER_BUILDKIT=1

# Build with optimized settings
docker build \
    --no-cache \
    --compress \
    --rm \
    --tag "$IMAGE_NAME:$TAG" \
    --progress=plain \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Docker build completed successfully!"
    echo "🏷️  Image: $IMAGE_NAME:$TAG"
    echo ""
    echo "📊 Image size:"
    docker images "$IMAGE_NAME:$TAG"
    echo ""
    echo "🚀 To run the container:"
    echo "   docker run -p 3000:3000 --env-file .env $IMAGE_NAME:$TAG"
else
    echo ""
    echo "❌ Docker build failed!"
    echo "💡 Try running the cleanup script manually: ./scripts/docker-cleanup.sh"
    exit 1
fi