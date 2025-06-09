# GitHub Actions Docker Hub Workflow

This document explains the GitHub Actions workflow for automatically building and pushing Docker images to Docker Hub.

## Workflow Overview

The workflow (`docker-publish.yml`) automatically:
- Builds the Docker image using multi-platform support (AMD64 and ARM64)
- Pushes images to Docker Hub when code is pushed to main/master branch or when tags are created
- Uses Docker layer caching for faster builds
- Updates Docker Hub repository description from README.md
- Creates appropriate tags based on branch names and semantic versioning

## Setup Instructions

### 1. Docker Hub Account Setup

1. Create a Docker Hub account at https://hub.docker.com if you don't have one
2. Create a repository for your project (e.g., `yourusername/whatsapp-financial-bot`)

### 2. GitHub Repository Secrets

Add the following secrets to your GitHub repository:

1. Go to your GitHub repository
2. Click on "Settings" tab
3. Click on "Secrets and variables" → "Actions"
4. Add the following repository secrets:

#### Required Secrets:

- **`DOCKER_USERNAME`**: Your Docker Hub username
- **`DOCKER_PASSWORD`**: Your Docker Hub password or access token

> **Security Note**: It's recommended to use Docker Hub Access Tokens instead of your password:
> 1. Go to Docker Hub → Account Settings → Security
> 2. Create a new Access Token
> 3. Use this token as `DOCKER_PASSWORD`

### 3. Workflow Configuration

The workflow is configured to:

#### Triggers:
- **Push to main/master**: Builds and pushes with `latest` tag
- **Push tags (v*)**: Builds and pushes with semantic version tags
- **Pull requests**: Builds only (no push) for testing

#### Image Tags:
- `latest` - for main/master branch
- `v1.0.0` - for version tags
- `v1.0` - major.minor for version tags
- `v1` - major version for version tags
- `main` - branch name for development

## Usage Examples

### 1. Development Push
```bash
git add .
git commit -m "Add new feature"
git push origin main
```
This will create image: `yourusername/whatsapp-financial-bot:latest`

### 2. Release Version
```bash
git tag v1.0.0
git push origin v1.0.0
```
This will create images:
- `yourusername/whatsapp-financial-bot:v1.0.0`
- `yourusername/whatsapp-financial-bot:v1.0`
- `yourusername/whatsapp-financial-bot:v1`
- `yourusername/whatsapp-financial-bot:latest`

### 3. Pull Image
```bash
# Latest version
docker pull yourusername/whatsapp-financial-bot:latest

# Specific version
docker pull yourusername/whatsapp-financial-bot:v1.0.0

# Run the container
docker run -d \
  --name whatsapp-bot \
  -p 3000:3000 \
  -v ./data:/app/data \
  -v ./logs:/app/logs \
  --env-file .env \
  yourusername/whatsapp-financial-bot:latest
```

## Workflow Features

### Multi-Platform Support
The workflow builds images for both AMD64 and ARM64 architectures, ensuring compatibility with:
- Intel/AMD processors (x86_64)
- Apple Silicon (M1/M2 Macs)
- ARM-based servers

### Docker Layer Caching
Uses GitHub Actions cache to speed up builds by reusing unchanged layers.

### Automatic Tagging
Intelligently creates tags based on:
- Git branch names
- Semantic version tags
- Special `latest` tag for main branch

### Security Best Practices
- Only pushes on main branch and tags (not PRs)
- Uses Docker Hub access tokens
- Employs GitHub's built-in security features

## Troubleshooting

### Common Issues:

1. **Authentication Failed**
   - Verify `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets
   - Ensure Docker Hub access token has write permissions

2. **Build Failed**
   - Check Dockerfile syntax
   - Verify all required files are present
   - Check build logs in GitHub Actions tab

3. **Push Failed**
   - Ensure repository exists on Docker Hub
   - Verify repository name matches workflow configuration
   - Check if repository is private and you have access

### Debug Steps:

1. Check GitHub Actions logs:
   - Go to "Actions" tab in your repository
   - Click on the failed workflow run
   - Expand failed steps to see detailed logs

2. Test locally:
   ```bash
   # Build image locally
   docker build -t test-image .
   
   # Run image locally
   docker run -p 3000:3000 test-image
   ```

## Customization

### Change Image Name
Edit the `IMAGE_NAME` environment variable in the workflow:
```yaml
env:
  IMAGE_NAME: your-custom-image-name
```

### Add Different Triggers
Add more trigger conditions:
```yaml
on:
  push:
    branches: [ main, develop ]
  schedule:
    - cron: '0 2 * * 1'  # Weekly builds
```

### Custom Tags
Modify the metadata extraction step:
```yaml
tags: |
  type=ref,event=branch
  type=raw,value=nightly,enable={{is_default_branch}}
  type=raw,value={{branch}}-{{sha}}
```

## Monitoring

### View Build Status
- GitHub repository badge: Add to README.md
- Docker Hub automated builds section
- GitHub Actions workflow status

### Notifications
Configure GitHub Actions to send notifications on:
- Build failures
- Successful deployments
- Security vulnerabilities

## Next Steps

1. Set up the required secrets in your GitHub repository
2. Push code to trigger the first build
3. Verify the image appears in your Docker Hub repository
4. Test pulling and running the image
5. Set up monitoring and notifications as needed

For more advanced configurations, refer to:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [Docker Buildx Documentation](https://docs.docker.com/buildx/)