#!/bin/bash

# Test Docker GitHub Workflow Locally
# This script simulates the GitHub Actions workflow for local testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="whatsapp-financial-bot"
DOCKER_USERNAME="${DOCKER_USERNAME:-your-dockerhub-username}"
PLATFORMS="linux/amd64,linux/arm64"

echo -e "${BLUE}🐳 Testing Docker GitHub Workflow Locally${NC}"
echo "=================================================="

# Function to print step headers
print_step() {
    echo -e "\n${YELLOW}📋 Step: $1${NC}"
    echo "----------------------------------------"
}

# Function to print success messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print error messages
print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if Docker is installed and running
print_step "Checking Docker installation"
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
fi

if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running"
fi

print_success "Docker is installed and running"

# Check if Docker Buildx is available
print_step "Checking Docker Buildx"
if ! docker buildx version &> /dev/null; then
    print_error "Docker Buildx is not available"
fi

print_success "Docker Buildx is available"

# Create/use buildx builder
print_step "Setting up Docker Buildx builder"
BUILDER_NAME="github-actions-builder"

if ! docker buildx inspect $BUILDER_NAME &> /dev/null; then
    echo "Creating new buildx builder: $BUILDER_NAME"
    docker buildx create --name $BUILDER_NAME --driver docker-container --use
else
    echo "Using existing buildx builder: $BUILDER_NAME"
    docker buildx use $BUILDER_NAME
fi

print_success "Buildx builder is ready"

# Build for single platform (faster for testing)
print_step "Building Docker image for local platform"
docker buildx build \
    --tag "$DOCKER_USERNAME/$IMAGE_NAME:test" \
    --load \
    .

print_success "Single platform build completed"

# Test the built image
print_step "Testing built image"
echo "Testing if the image can start properly..."

# Run a quick test to see if the container starts
CONTAINER_ID=$(docker run -d --name "${IMAGE_NAME}-test" "$DOCKER_USERNAME/$IMAGE_NAME:test" /bin/sh -c "sleep 10")

# Wait a moment for container to start
sleep 3

# Check if container is running
if docker ps | grep -q "${IMAGE_NAME}-test"; then
    print_success "Container started successfully"
else
    print_error "Container failed to start"
fi

# Clean up test container
docker stop "$CONTAINER_ID" >/dev/null 2>&1 || true
docker rm "$CONTAINER_ID" >/dev/null 2>&1 || true

# Optional: Build for multiple platforms (if requested)
if [[ "$1" == "--multi-platform" ]]; then
    print_step "Building for multiple platforms (AMD64 + ARM64)"
    echo "⚠️  This may take significantly longer..."
    
    docker buildx build \
        --platform $PLATFORMS \
        --tag "$DOCKER_USERNAME/$IMAGE_NAME:multi-test" \
        .
    
    print_success "Multi-platform build completed"
fi

# Show image information
print_step "Image information"
docker images "$DOCKER_USERNAME/$IMAGE_NAME:test"

# Show image size
IMAGE_SIZE=$(docker images "$DOCKER_USERNAME/$IMAGE_NAME:test" --format "table {{.Size}}" | tail -n 1)
echo -e "Image size: ${BLUE}$IMAGE_SIZE${NC}"

# Cleanup local test image
print_step "Cleanup"
docker rmi "$DOCKER_USERNAME/$IMAGE_NAME:test" >/dev/null 2>&1 || true
if [[ "$1" == "--multi-platform" ]]; then
    docker buildx imagetools inspect "$DOCKER_USERNAME/$IMAGE_NAME:multi-test" >/dev/null 2>&1 || true
fi

print_success "Cleanup completed"

echo ""
echo -e "${GREEN}🎉 All tests passed! Your Docker setup is ready for GitHub Actions.${NC}"
echo ""
echo "Next steps:"
echo "1. Set up DOCKER_USERNAME and DOCKER_PASSWORD secrets in GitHub"
echo "2. Push your code to trigger the workflow"
echo "3. Check the Actions tab in your GitHub repository"
echo ""
echo "To test multi-platform build locally, run:"
echo "  ./scripts/test-docker-github-workflow.sh --multi-platform"