# Docker Deployment with TTS Support

This document explains how to deploy the WhatsApp Financial Bot with Text-to-Speech (TTS) support using Docker.

## 🚀 **What's New in Docker Support**

The Dockerfile has been enhanced to support:
- **🗣️ TTS (Text-to-Speech)** with ElevenLabs API
- **💬 AI Curhat Mode** with voice responses
- **🎵 Audio file management** with automatic cleanup
- **🇮🇩 Indonesian language optimization**
- **🛡️ Enhanced health checks** for TTS services

## 📋 **Dockerfile Improvements**

### **New Features Added:**
1. **Audio Directory Support**
   ```dockerfile
   RUN mkdir -p /app/data /app/logs /app/exports /app/temp /app/temp/audio && \
       chmod 755 /app/data /app/logs /app/exports /app/temp /app/temp/audio
   ```

2. **TTS Environment Variables**
   ```dockerfile
   ENV ELEVENLABS_TTS_ENABLED=false
   ENV ELEVENLABS_API_KEY=""
   ENV ELEVENLABS_VOICE_ID="pNInz6obpgDQGcFmaJgB"
   ENV ELEVENLABS_BASE_URL="https://api.elevenlabs.io/v1"
   ENV ELEVENLABS_MODEL="eleven_multilingual_v2"
   ENV ELEVENLABS_LANGUAGE_ID="id"
   ```

3. **AI Curhat Configuration**
   ```dockerfile
   ENV AI_CURHAT_ENABLED=true
   ENV AI_CURHAT_PROVIDER="openrouter"
   ENV AI_CURHAT_MODEL="deepseek/deepseek-chat-v3-0324:free"
   ```

4. **Enhanced Health Check**
   - Improved timeout: 15s (was 10s)
   - Better error handling for TTS services
   - JSON response parsing for detailed health status

## 🔧 **Build & Deployment**

### **1. Basic Build**
```bash
# Build image with TTS support
docker build -t whatsapp-bot-tts .

# Check build success
docker images | grep whatsapp-bot-tts
```

### **2. Environment Configuration**
Create a `.env` file with TTS configuration:
```bash
# Required for TTS functionality
ELEVENLABS_TTS_ENABLED=true
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_LANGUAGE_ID=id

# AI Curhat configuration
AI_CURHAT_ENABLED=true
AI_CURHAT_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key

# Database (required)
DATABASE_DB_URL=your_postgresql_connection_string

# Basic bot config
BOT_ADMIN_PHONE=+6281234567890
```

### **3. Run Container**
```bash
# Run with environment file
docker run -d \
  --name whatsapp-bot-tts \
  --env-file .env \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  whatsapp-bot-tts

# Check container status
docker ps | grep whatsapp-bot-tts
```

### **4. Production Deployment**
```bash
# Production with resource limits
docker run -d \
  --name whatsapp-bot-production \
  --env-file .env.production \
  -p 3000:3000 \
  --memory=512m \
  --cpus=1.0 \
  --restart=unless-stopped \
  -v /var/app/data:/app/data \
  -v /var/app/logs:/app/logs \
  whatsapp-bot-tts
```

## 🎵 **TTS Configuration in Docker**

### **Environment Variables**
```bash
# Enable TTS
ELEVENLABS_TTS_ENABLED=true

# API Configuration
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxx
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1

# Voice Settings
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL=eleven_multilingual_v2
ELEVENLABS_LANGUAGE_ID=id

# AI Curhat Integration
AI_CURHAT_ENABLED=true
AI_CURHAT_PROVIDER=openrouter
```

### **Audio File Management**
The container automatically:
- Creates `/app/temp/audio` directory for temporary audio files
- Sets proper permissions for audio file generation
- Cleans up old audio files (configurable interval)
- Handles storage efficiently for production use

### **Volume Mounts for Audio**
```bash
# Optional: Persist audio cache
-v /var/app/audio:/app/temp/audio
```

## 🔍 **Monitoring & Health Checks**

### **Enhanced Health Check**
The new health check monitors:
- Application status
- Database connectivity
- TTS service availability
- AI service health
- Memory usage
- Audio file system

### **Check Container Health**
```bash
# View health status
docker inspect --format='{{json .State.Health}}' whatsapp-bot-tts

# Manual health check
docker exec whatsapp-bot-tts curl -f http://localhost:3000/health
```

### **Log Monitoring**
```bash
# View all logs
docker logs -f whatsapp-bot-tts

# Filter TTS logs
docker logs whatsapp-bot-tts 2>&1 | grep -i "tts\|voice\|audio"

# Filter AI Curhat logs
docker logs whatsapp-bot-tts 2>&1 | grep -i "curhat"
```

## 📊 **Resource Requirements**

### **With TTS Features:**
- **Memory**: 512MB recommended (peak 260MB)
- **CPU**: 1 vCPU (70% peak during TTS generation)
- **Storage**: 
  - Base: ~100MB
  - Audio cache: ~50MB (auto-cleanup)
  - Logs: ~20MB/day
- **Network**: Outbound HTTPS for APIs

### **Environment-Specific Resources:**
```bash
# Development
--memory=256m --cpus=0.5

# Staging  
--memory=384m --cpus=0.7

# Production
--memory=512m --cpus=1.0
```

## 🛠️ **Troubleshooting**

### **TTS Issues**
```bash
# Check TTS configuration
docker exec whatsapp-bot-tts env | grep ELEVENLABS

# Test TTS service
docker exec whatsapp-bot-tts node -e "
const TTSService = require('./src/services/TTSService');
const tts = new TTSService();
console.log('TTS Status:', tts.getStatus());
"

# Check audio directory
docker exec whatsapp-bot-tts ls -la /app/temp/audio/
```

### **AI Curhat Issues**
```bash
# Check AI configuration
docker exec whatsapp-bot-tts env | grep -E "(AI_CURHAT|OPENROUTER)"

# Test AI service
docker exec whatsapp-bot-tts node -e "
const AICurhatService = require('./src/services/AICurhatService');
const ai = new AICurhatService();
console.log('AI Status:', ai.getStatus());
"
```

### **Memory Issues**
```bash
# Check memory usage
docker stats whatsapp-bot-tts --no-stream

# Check audio file cleanup
docker exec whatsapp-bot-tts find /app/temp/audio -name "*.mp3" -mmin +60
```

## 🔐 **Security Considerations**

### **API Keys**
- Store in environment variables, not in image
- Use Docker secrets for production
- Rotate keys regularly

### **File Permissions**
- Audio files are created with secure permissions
- Temporary files are cleaned up automatically
- No sensitive data in audio files

### **Network Security**
```bash
# Run with network isolation
docker network create bot-network
docker run --network=bot-network ...
```

## 🚀 **EasyPanel Deployment**

For EasyPanel deployment, the Dockerfile is optimized with:
- Multi-stage build for smaller images
- Proper environment variable handling
- Health checks compatible with EasyPanel
- Logging optimized for EasyPanel logs

### **EasyPanel Configuration**
```yaml
# Environment variables in EasyPanel
ELEVENLABS_TTS_ENABLED: "true"
ELEVENLABS_API_KEY: "your_api_key"
AI_CURHAT_ENABLED: "true"
OPENROUTER_API_KEY: "your_openrouter_key"
DATABASE_DB_URL: "your_database_url"
```

## ✅ **Verification Checklist**

Before deployment, verify:
- [ ] Dockerfile builds successfully
- [ ] All environment variables are set
- [ ] TTS service initializes properly
- [ ] AI Curhat service connects
- [ ] Health check returns 200
- [ ] Audio directory has correct permissions
- [ ] Logs show proper service initialization

## 📚 **Related Documentation**

- [TTS Voice Response Guide](./TTS_VOICE_RESPONSE.md)
- [AI Curhat Mode Documentation](./AI_CURHAT_MODE.md)
- [Docker Environment Variables](../docker/ENVIRONMENT_VARS.md)
- [EasyPanel Setup Guide](./EASYPANEL_SETUP.md)

---

🎉 **Your WhatsApp bot is now ready for deployment with full TTS and AI Curhat support!**