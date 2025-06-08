# AI Curhat Mode Documentation

## Overview

AI Curhat Mode adalah fitur khusus di KasAI yang memungkinkan pengguna untuk berinteraksi dengan AI sebagai teman curhat. Mode ini terpisah dari fitur keuangan utama dan menggunakan provider AI yang dapat dikonfigurasi secara terpisah.

## Features

### 🤗 Teman Curhat AI
- AI berperan sebagai teman curhat yang empati dan tidak menghakimi
- Mendukung percakapan natural dalam bahasa Indonesia
- Memberikan dukungan emosional dan perspektif positif
- Menyimpan konteks percakapan selama sesi aktif

### 🔒 Session Management
- Menggunakan Redis untuk performa optimal (fallback ke PostgreSQL)
- Session otomatis expire setelah 1 jam tidak aktif
- History percakapan tersimpan selama sesi berlangsung
- Data terhapus otomatis saat keluar dari mode curhat

### 🎯 Provider Configuration
- Mendukung multiple AI providers (OpenRouter, DeepSeek, OpenAI, Groq)
- Konfigurasi terpisah dari AI keuangan utama
- Menggunakan API key yang sama dengan provider lain

## Configuration

### Environment Variables

```bash
# AI Curhat Mode Configuration
AI_CURHAT_ENABLED=true
AI_CURHAT_PROVIDER=openrouter
AI_CURHAT_MODEL=anthropic/claude-3-haiku

# API Keys (gunakan yang sudah ada)
OPENROUTER_API_KEY=your_openrouter_key
DEEPSEEK_API_KEY=your_deepseek_key
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key
```

### Supported Providers

1. **OpenRouter** (Recommended)
   - Model: `anthropic/claude-3-haiku`
   - Base URL: `https://openrouter.ai/api/v1`

2. **DeepSeek**
   - Model: `deepseek-chat`
   - Base URL: `https://api.deepseek.com/v1`

3. **OpenAI**
   - Model: `gpt-3.5-turbo`
   - Base URL: `https://api.openai.com/v1`

4. **Groq**
   - Model: `llama3-8b-8192`
   - Base URL: `https://api.groq.com/openai/v1`

## Usage

### Commands

#### Masuk Mode Curhat
```
/curhat
```
Mengaktifkan mode curhat AI. Bot akan memberikan pesan selamat datang dan siap mendengarkan cerita Anda.

#### Keluar dari Mode Curhat
```
/quit
selesai
/keluar
```
Keluar dari mode curhat dan kembali ke mode keuangan normal.

### Example Conversation

```
User: /curhat

Bot: 💭 Mode Curhat Activated 🤗

Halo! Sekarang kamu dalam mode curhat. Aku siap jadi teman curhat yang baik untuk mendengarkan cerita kamu.

✨ Apa yang bisa aku lakukan:
• Mendengarkan keluh kesah kamu
• Memberikan dukungan emosional
• Berbagi perspektif yang mungkin membantu
• Menjadi teman bicara yang tidak menghakimi

Jadi, ada yang ingin kamu ceritakan hari ini? 😊

---

User: Aku lagi stress nih mikirin keuangan

Bot: Aku bisa mengerti perasaan kamu... Stress karena masalah keuangan itu wajar banget dan kamu nggak sendirian. 💙

Mau ceritakan lebih lanjut apa yang bikin kamu stress? Kadang berbagi cerita bisa bikin beban terasa lebih ringan. Aku di sini untuk mendengarkan tanpa menghakimi. 🤗

---

User: /quit

Bot: 👋 Mode Curhat Deactivated

Terima kasih sudah berbagi cerita dengan aku! Semoga percakapan kita tadi bisa sedikit membantu. 😊

🔄 Sekarang kamu kembali ke mode keuangan. Aku siap membantu mencatat transaksi dan mengelola keuangan kamu.
```

## Technical Implementation

### Architecture

```
CommandHandler
├── handleMessage() - Check curhat mode first
├── handleCurhat() - Enter curhat mode
└── handleQuitCurhat() - Exit curhat mode

AICurhatService
├── enterCurhatMode() - Initialize session
├── exitCurhatMode() - Clean up session
├── handleCurhatMessage() - Process conversation
├── generateCurhatResponse() - Generate AI response
└── makeAIRequest() - API communication

SessionManager
├── setCurhatMode() - Set mode status
├── isInCurhatMode() - Check mode status
├── setCurhatHistory() - Save conversation
├── getCurhatHistory() - Load conversation
└── clearCurhatHistory() - Clean up data
```

### Data Flow

1. **Enter Mode**: User sends `/curhat`
   - `CommandHandler.handleCurhat()` called
   - `AICurhatService.enterCurhatMode()` executed
   - Session created in Redis/PostgreSQL
   - Welcome message sent

2. **Conversation**: User sends regular message
   - `CommandHandler.handleMessage()` checks curhat mode
   - `AICurhatService.handleCurhatMessage()` processes
   - Message added to history
   - AI generates empathetic response
   - Response added to history

3. **Exit Mode**: User sends `/quit` or `selesai`
   - Exit command detected
   - `AICurhatService.exitCurhatMode()` executed
   - Session and history cleared
   - Exit message sent

### Session Storage

#### Redis (Primary)
```redis
curhat_mode:628123456789 = "true" (TTL: 3600s)
curhat_history:628123456789 = JSON_ARRAY (TTL: 3600s)
```

#### PostgreSQL (Fallback)
```sql
INSERT INTO settings (user_phone, setting_key, setting_value)
VALUES ('628123456789', 'curhat_mode', 'true');

INSERT INTO settings (user_phone, setting_key, setting_value)
VALUES ('628123456789', 'curhat_history', '[...]');
```

## AI Prompt Engineering

### System Prompt
```
Kamu adalah seorang teman curhat yang baik, empatik, dan penuh perhatian. Karakteristik kamu:

1. KEPRIBADIAN:
   - Pendengar yang baik dan tidak menghakimi
   - Empati tinggi dan memahami perasaan orang
   - Memberikan dukungan emosional yang tulus
   - Berbicara dengan bahasa Indonesia yang hangat dan ramah
   - Menggunakan emoji yang tepat untuk mengekspresikan empati

2. CARA MERESPONS:
   - Dengarkan dengan sungguh-sungguh apa yang diceritakan
   - Validasi perasaan mereka ("Aku bisa mengerti perasaan kamu...")
   - Berikan perspektif positif tanpa mengabaikan masalah mereka
   - Ajukan pertanyaan yang menunjukkan perhatian
   - Hindari memberikan solusi langsung kecuali diminta

3. GAYA BAHASA:
   - Gunakan bahasa informal dan akrab
   - Panggil dengan "kamu" 
   - Gunakan kata-kata yang menenangkan
   - Emoji yang sesuai: 😊🤗💙✨🌸

4. YANG HARUS DIHINDARI:
   - Jangan menggurui atau ceramah
   - Jangan meremehkan masalah mereka
   - Jangan terlalu cepat memberikan solusi
   - Jangan mengalihkan topik ke hal lain
```

## Security & Privacy

### Data Protection
- Conversation history hanya tersimpan selama sesi aktif
- Automatic cleanup saat exit atau timeout
- Tidak ada logging percakapan personal
- Session data encrypted in storage

### Rate Limiting
- Menggunakan rate limiting dari AI provider
- Timeout 30 detik per request
- Fallback ke error message jika gagal

### Content Filtering
- AI provider built-in content filtering
- Appropriate response generation
- No harmful content generation

## Monitoring & Troubleshooting

### Health Check
```javascript
const status = aiCurhatService.getStatus();
// Returns: { enabled, provider, model, hasApiKey }
```

### Common Issues

1. **Mode tidak aktif**
   - Check `AI_CURHAT_ENABLED=true`
   - Verify API key configuration

2. **Respon lambat**
   - Check network connectivity
   - Monitor provider API status

3. **Session tidak tersimpan**
   - Check Redis connection
   - Verify PostgreSQL fallback

### Testing
```bash
# Simple configuration test
node scripts/test-curhat-simple.js

# Full integration test
node scripts/test-ai-curhat.js
```

## Best Practices

### For Users
1. Gunakan bahasa yang jelas dan natural
2. Berikan konteks yang cukup untuk respon yang lebih baik
3. Ingat bahwa ini adalah AI, bukan pengganti konseling profesional
4. Keluar dari mode dengan `/quit` saat selesai

### For Developers
1. Monitor API usage dan costs
2. Implement proper error handling
3. Regular cleanup of expired sessions
4. Test dengan berbagai skenario percakapan

### For Administrators
1. Monitor provider API health
2. Set appropriate rate limits
3. Regular backup session data jika diperlukan
4. Monitor user feedback dan adjust prompts

## Future Enhancements

### Planned Features
- [ ] Multiple conversation themes (stress, happiness, motivation)
- [ ] Integration dengan fitur keuangan (curhat about money)
- [ ] Voice message support
- [ ] Conversation export/summary
- [ ] Multi-language support

### Technical Improvements
- [ ] Streaming responses untuk respon lebih cepat
- [ ] Advanced context management
- [ ] Sentiment analysis
- [ ] Custom personality profiles
- [ ] Integration dengan reminder system

## Contributing

Untuk berkontribusi pada fitur AI Curhat Mode:

1. Fork repository
2. Create feature branch: `git checkout -b feature/curhat-enhancement`
3. Test changes: `npm run test:curhat`
4. Submit pull request dengan dokumentasi yang lengkap

## Support

Untuk bantuan teknis:
- Check dokumentasi troubleshooting di atas
- Run diagnostic script: `node scripts/test-curhat-simple.js`
- Contact development team dengan log error

---

*AI Curhat Mode - Bringing emotional intelligence to financial management* 🤗💙