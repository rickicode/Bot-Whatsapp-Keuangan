#!/bin/bash

# Docker cleanup script to free up disk space before building

echo "🧹 Starting Docker cleanup to free up disk space..."

# Remove all stopped containers
echo "Removing stopped containers..."
docker container prune -f

# Remove all unused images
echo "Removing unused images..."
docker image prune -a -f

# Remove all unused volumes
echo "Removing unused volumes..."
docker volume prune -f

# Remove all unused networks
echo "Removing unused networks..."
docker network prune -f

# Remove build cache
echo "Removing build cache..."
docker buildx prune -a -f

# Show disk usage after cleanup
echo "📊 Disk usage after cleanup:"
df -h /var/lib/docker 2>/dev/null || df -h /

echo "✅ Docker cleanup completed!"
echo ""
echo "💡 Now you can run: docker build -t your-app ."