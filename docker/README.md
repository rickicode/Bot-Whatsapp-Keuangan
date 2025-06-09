# Docker Configuration Files for EasyPanel

This folder contains all Docker configuration files for EasyPanel deployment.

## 📁 File Structure

```
docker/
├── README.md              # This documentation
├── supervisord.conf       # Supervisord configuration
├── healthcheck.sh         # Health check script
├── start-easypanel.sh     # Container startup script
└── supervisor-status.sh   # Status monitoring script
```

## 📋 File Descriptions

### **supervisord.conf**
Main supervisord configuration that manages all services:
- **whatsapp-bot**: Main application process
- **antispam-monitor**: Anti-spam monitoring (every 5 minutes)
- **session-cleanup**: Session cleanup (every 10 minutes)
- **health-monitor**: Health monitoring (every 5 minutes)
- **log-rotator**: Log cleanup (every 2 hours)

**Key Features:**
- All logs output to Docker stdout/stderr
- Service restart policies configured
- Process monitoring and auto-restart
- Service isolation with proper user permissions

### **healthcheck.sh**
Container health check script that verifies:
- Supervisord process is running
- Main bot process is active
- HTTP health endpoint responds
- Container is functioning properly

**Usage:**
```bash
# Manual health check
docker exec whatsapp-bot-easypanel /usr/local/bin/healthcheck.sh

# Docker automatically runs this every 60 seconds
```

### **start-easypanel.sh**
Container startup script that:
- Displays startup information
- Checks environment configuration
- Creates .env file if needed
- Shows disk space information
- Starts supervisord with all services

**Features:**
- Environment validation
- Service initialization logging
- Error handling and warnings
- Supabase connection preparation

### **supervisor-status.sh**
Status monitoring script that shows:
- Supervisord service status
- Running process information
- Log access instructions
- Service management commands

**Usage:**
```bash
# Check all services status
npm run easypanel:status

# Or directly
docker exec whatsapp-bot-easypanel /usr/local/bin/supervisor-status.sh
```

## 🔧 Configuration Customization

### **Modifying Service Intervals**
Edit `supervisord.conf` to change service frequencies:

```ini
# Anti-spam monitor (currently every 5 minutes)
command=bash -c "sleep 60 && while true; do ...; sleep 300; done"
#                                                      ^^^ Change this

# Session cleanup (currently every 10 minutes)  
command=bash -c "sleep 120 && while true; do ...; sleep 600; done"
#                                                       ^^^ Change this
```

### **Adding New Services**
Add new service blocks to `supervisord.conf`:

```ini
[program:new-service]
command=your-command-here
directory=/app
user=botuser
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
```

### **Customizing Health Checks**
Modify `healthcheck.sh` to add additional checks:

```bash
# Add custom health check
if ! your-custom-check; then
    echo "❌ Custom check failed"
    exit 1
fi
```

### **Environment-Specific Startup**
Customize `start-easypanel.sh` for different environments:

```bash
# Add environment-specific logic
if [ "$NODE_ENV" = "production" ]; then
    echo "🚀 Production mode enabled"
    # Production-specific setup
fi
```

## 🚀 Usage Examples

### **Build and Deploy**
```bash
# Build image with Docker configs
npm run easypanel:build

# Start container
npm run easypanel:start

# Check status
npm run easypanel:status
```

### **Service Management**
```bash
# Restart main bot
docker exec whatsapp-bot-easypanel supervisorctl restart whatsapp-bot

# Check service logs
docker logs -f whatsapp-bot-easypanel | grep "\[WHATSAPP-BOT\]"

# Stop specific service
docker exec whatsapp-bot-easypanel supervisorctl stop antispam-monitor
```

### **Troubleshooting**
```bash
# View all logs
docker logs whatsapp-bot-easypanel

# Check service status
docker exec whatsapp-bot-easypanel supervisorctl status

# Manual health check
docker exec whatsapp-bot-easypanel /usr/local/bin/healthcheck.sh
```

## 🔍 Log Output Format

All services output structured logs with prefixes:

```
🚀 Starting WhatsApp Bot for EasyPanel...
📅 Started at: Wed Jun 4 13:44:00 UTC 2025
[WHATSAPP-BOT] Bot initializing...
[ANTISPAM] Running check at Wed Jun 4 13:44:30 UTC 2025
[HEALTH] OK at Wed Jun 4 13:44:45 UTC 2025
[CLEANUP] Running cleanup at Wed Jun 4 13:45:00 UTC 2025
[LOGROTATE] Running cleanup at Wed Jun 4 13:46:00 UTC 2025
```

## 🎵 TTS (Text-to-Speech) Support

The Docker container now supports TTS functionality with ElevenLabs API:

### **Audio Directory:**
- Container includes `/app/temp/audio` for temporary audio files
- Automatic cleanup of old audio files (configurable)
- Proper permissions for audio file generation

### **TTS Configuration:**
Required environment variables for TTS functionality:
```bash
ELEVENLABS_TTS_ENABLED=true
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1
ELEVENLABS_MODEL=eleven_multilingual_v2
ELEVENLABS_LANGUAGE_ID=id
```

### **AI Curhat Mode:**
Enhanced conversational AI with voice support:
```bash
AI_CURHAT_ENABLED=true
AI_CURHAT_PROVIDER=openrouter
AI_CURHAT_MODEL=deepseek/deepseek-chat-v3-0324:free
```

### **Voice Features:**
- Dynamic voice request detection
- User voice preferences (always/never/ask)
- Indonesian language optimization
- Automatic fallback to text on TTS failure

## 📊 Resource Optimization

### **Memory Usage:**
- Supervisord: ~10MB
- Main Bot: ~190MB (with TTS)
- Monitor Services: ~40MB total
- Audio Processing: ~20MB peak
- **Total: ~260MB**

### **CPU Usage:**
- Idle: ~5%
- Normal Load: ~15-25%
- Peak Load (with TTS): ~70%
- Audio Generation: ~40% spike

## 🛡️ Security Features

- **Non-root execution**: Services run as `botuser`
- **Process isolation**: Each service isolated
- **Resource limits**: Memory and CPU constraints
- **Health monitoring**: Automatic restart on failure

This modular approach makes it easier to maintain, customize, and debug the EasyPanel deployment! 🚀