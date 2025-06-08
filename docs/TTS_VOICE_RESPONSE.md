# TTS Voice Response Feature

## Overview

Fitur Text-to-Speech (TTS) memungkinkan bot WhatsApp Financial untuk merespons dengan voice note menggunakan ElevenLabs API ketika pengguna meminta dalam mode curhat.

## Features

- 🎵 **Voice Response**: Bot dapat merespons dengan voice note
- 🧹 **Text Cleaning**: Otomatis membersihkan markdown dan emoji untuk TTS
- 🔄 **Fallback**: Jika TTS gagal, otomatis kembali ke respons teks
- 🗑️ **Auto Cleanup**: File audio otomatis dihapus setelah dikirim
- 🌍 **Multilingual**: Mendukung bahasa Indonesia dengan model multilingual

## Configuration

### Environment Variables

Tambahkan konfigurasi berikut ke file `.env`:

```env
# ================================
# TTS CONFIGURATION (ElevenLabs)
# ================================
ELEVENLABS_TTS_ENABLED=true
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
ELEVENLABS_BASE_URL=https://api.elevenlabs.io/v1
ELEVENLABS_MODEL=eleven_multilingual_v2
ELEVENLABS_LANGUAGE_ID=id
```

### Configuration Details

| Variable | Description | Default |
|----------|-------------|---------|
| `ELEVENLABS_TTS_ENABLED` | Enable/disable TTS feature | `false` |
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | Required |
| `ELEVENLABS_VOICE_ID` | Voice ID to use | `pNInz6obpgDQGcFmaJgB` |
| `ELEVENLABS_BASE_URL` | ElevenLabs API base URL | `https://api.elevenlabs.io/v1` |
| `ELEVENLABS_MODEL` | TTS model to use | `eleven_multilingual_v2` |
| `ELEVENLABS_LANGUAGE_ID` | Language code for pronunciation | `id` (Indonesian) |

## How to Use

### For Users

1. **Enter Curhat Mode**: Send `/curhat` to enter curhat mode
2. **Request Voice Response**: Include any of these phrases in your message:
   - "balas dengan suara"
   - "pakai suara"
   - "gunakan suara"
   - "dengan voice"
   - "pakai voice"
   - "suarakan"
   - "voice"
   - "tts"
   - "audio"

### Example Usage

```
User: Hari ini aku sedih, tolong balas dengan suara ya
Bot: [Sends voice note] + text response
```

## Technical Implementation

### Architecture

```
User Message → AICurhatService → TTSService → ElevenLabs API → Voice Note
                     ↓
              Text Cleaning & Processing
                     ↓
              Fallback to Text if Failed
```

### Key Components

1. **TTSService.js**: Main TTS service handling API calls
2. **AICurhatService.js**: Integration with curhat mode
3. **index.js**: Audio message sending logic

### Text Processing

The TTS service automatically cleans text by:
- Removing markdown formatting (`**bold**`, `*italic*`)
- Removing emojis and special characters
- Converting newlines to periods
- Limiting text length (max 2500 characters)

### Error Handling

- **API Failure**: Falls back to text response with error message
- **File Issues**: Automatic cleanup and fallback
- **Network Issues**: Graceful degradation to text
- **Rate Limiting**: Respects ElevenLabs rate limits

## API Integration

### ElevenLabs API

The service uses ElevenLabs Text-to-Speech API:
- **Endpoint**: `POST /v1/text-to-speech/{voice_id}`
- **Model**: `eleven_multilingual_v2` (supports Indonesian)
- **Output**: MP3 audio stream
- **Voice Settings**: Optimized for conversational tone

### Voice Settings

```javascript
{
  stability: 0.5,
  similarity_boost: 0.5,
  style: 0.0,
  use_speaker_boost: true
}
```

## File Management

### Temporary Files

- **Location**: `temp/audio/` directory
- **Format**: `tts_{userPhone}_{timestamp}.mp3`
- **Cleanup**: Automatic deletion after 5 seconds
- **Old File Cleanup**: Files older than 30 minutes are cleaned up

### Storage Considerations

- Audio files are temporary and deleted after sending
- No permanent storage of voice files
- Minimal disk space usage

## Testing

Run the TTS test script:

```bash
node scripts/test-tts.js
```

The test script will:
1. Check TTS service status
2. Test voice request detection
3. Test text cleaning
4. Generate sample TTS (if API key is valid)
5. List available voices

## Security & Privacy

### Data Protection

- **No Audio Storage**: Voice files are deleted immediately after sending
- **Text Processing**: Only processes text for TTS, no storage
- **API Security**: Uses secure HTTPS connections to ElevenLabs

### Rate Limiting

- Respects ElevenLabs API rate limits
- Implements fallback to text on rate limit exceeded
- No excessive API calls through smart caching

## Troubleshooting

### Common Issues

1. **TTS Not Working**
   - Check `ELEVENLABS_TTS_ENABLED=true`
   - Verify API key is valid
   - Check internet connection

2. **Voice Not Detected**
   - Use exact keywords: "balas dengan suara"
   - Check in curhat mode only
   - Case-insensitive detection

3. **Audio File Issues**
   - Check temp directory permissions
   - Verify disk space availability
   - Check file cleanup process

### Error Messages

- `"💬 Maaf, balas dengan suara sedang tidak bisa"` - TTS API failure
- `"❌ Mode curhat sedang tidak tersedia"` - Curhat mode disabled
- Text length exceeded - Message over 2500 characters

## Performance

### Optimization

- **Async Processing**: Non-blocking TTS generation
- **Smart Cleanup**: Automatic file management
- **Efficient Text Processing**: Minimal processing overhead
- **Fallback Strategy**: Quick recovery from failures

### Monitoring

- TTS success/failure rates logged
- Audio file creation and cleanup tracked
- API response times monitored
- Error patterns identified

## Future Enhancements

### Planned Features

1. **Voice Selection**: Allow users to choose different voices
2. **Language Detection**: Auto-detect language for optimal TTS
3. **Emotion Recognition**: Adjust voice tone based on message sentiment
4. **Speed Control**: Allow users to adjust speech speed
5. **Audio Caching**: Cache common responses to reduce API calls

### Integration Opportunities

1. **Voice Commands**: Accept voice input from users
2. **Multi-language Support**: Expand to other languages
3. **Custom Voice Training**: Train custom voices
4. **Accessibility Features**: Enhanced support for visually impaired users

## Getting Started

### Quick Setup

1. **Get ElevenLabs API Key**:
   - Sign up at https://elevenlabs.io/
   - Get your API key from dashboard
   - Choose a voice ID (or use default)

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your ElevenLabs configuration
   ```

3. **Test TTS**:
   ```bash
   node scripts/test-tts.js
   ```

4. **Start Bot**:
   ```bash
   npm start
   ```

5. **Try Voice Response**:
   - Send `/curhat` to enter curhat mode
   - Send: "Halo, tolong balas dengan suara"
   - Receive voice note response

### Best Practices

1. **API Key Security**: Keep API key secure and don't commit to version control
2. **Text Length**: Keep messages under 2500 characters for optimal TTS
3. **Voice Selection**: Choose appropriate voice for your target audience
4. **Error Handling**: Always implement fallback to text responses
5. **Resource Management**: Monitor API usage and implement rate limiting

## Support

For issues or questions:
1. Check the troubleshooting section
2. Run the test script for diagnostics
3. Check logs for detailed error information
4. Verify ElevenLabs API status and quotas