# Docker Build Troubleshooting Guide

## "No Space Left on Device" Error

This error occurs when Docker runs out of disk space during the build process. Here are the solutions:

### Quick Fix
Run the cleanup script before building:
```bash
./scripts/docker-cleanup.sh
./scripts/docker-build-optimized.sh
```

### Manual Cleanup Commands
```bash
# Remove all stopped containers
docker container prune -f

# Remove all unused images
docker image prune -a -f

# Remove all unused volumes
docker volume prune -f

# Remove build cache
docker buildx prune -a -f

# Check disk usage
df -h /var/lib/docker
```

### System-Level Solutions
1. **Increase Docker disk space allocation** (for Docker Desktop)
2. **Clean up system disk space**:
   ```bash
   sudo apt-get autoremove -y
   sudo apt-get autoclean
   ```

## Optimized Build Process

### Use the optimized build script:
```bash
./scripts/docker-build-optimized.sh [image-name] [tag]
```

### Manual optimized build:
```bash
export DOCKER_BUILDKIT=1
docker build --no-cache --compress --rm -t kasai-app:latest .
```

## Dockerfile Optimizations Applied

1. **Combined RUN commands** - Reduces layers and disk usage
2. **Cleanup in same layer** - Removes temporary files immediately
3. **Multi-stage build** - Only production dependencies in final image
4. **Efficient package management** - Clean package cache immediately
5. **Proper .dockerignore** - Excludes unnecessary build context

## Build Environment Requirements

- **Minimum free disk space**: 2GB
- **Recommended free disk space**: 5GB
- **Docker BuildKit**: Enabled (automatic in optimized script)

## Common Issues and Solutions

### Issue: Build fails at npm install
**Solution**: Ensure package.json and package-lock.json are present and valid

### Issue: Entrypoint script not found
**Solution**: Ensure docker/entrypoint.sh exists and is executable

### Issue: Permission denied errors
**Solution**: Run with proper Docker permissions or use sudo

## Health Check
The Docker image includes a comprehensive health check that verifies:
- HTTP endpoint availability
- Application status
- TTS service functionality
- Database connectivity

## Performance Tips
1. Use `.dockerignore` to exclude unnecessary files
2. Order Dockerfile commands from least to most likely to change
3. Use multi-stage builds for smaller production images
4. Clean up package managers in the same RUN command
5. Use BuildKit for faster, more efficient builds