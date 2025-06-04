# 🤖 Multi-Provider AI Configuration

Bot keuangan WhatsApp kini mendukung multiple AI providers dengan konfigurasi yang fleksibel.

## 📋 **Supported Providers**

### 1. **DeepSeek (Native)**
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 2. **OpenAI**
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com
OPENAI_MODEL=gpt-3.5-turbo
```

### 3. **OpenAI Compatible**
Untuk provider yang mendukung OpenAI API format:

#### DeepSeek via OpenAI Compatible:
```env
AI_PROVIDER=openaicompatible
OPENAI_COMPATIBLE_API_KEY=sk-xxxxxxxxxxxx
OPENAI_COMPATIBLE_BASE_URL=https://api.deepseek.com
OPENAI_COMPATIBLE_MODEL=deepseek-chat
```

#### Groq:
```env
AI_PROVIDER=openaicompatible
OPENAI_COMPATIBLE_API_KEY=gsk_xxxxxxxxxxxx
OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai
OPENAI_COMPATIBLE_MODEL=llama3-8b-8192
```

#### LocalAI:
```env
AI_PROVIDER=openaicompatible
OPENAI_COMPATIBLE_API_KEY=not-needed
OPENAI_COMPATIBLE_BASE_URL=http://localhost:8080
OPENAI_COMPATIBLE_MODEL=gpt-3.5-turbo
```

## ⚙️ **Configuration Steps**

1. **Choose Provider**: Set `AI_PROVIDER` to your preferred provider
2. **Set API Key**: Configure the appropriate API key variable
3. **Set Base URL**: Configure the base URL (optional for OpenAI/DeepSeek)
4. **Set Model**: Choose the model you want to use
5. **Enable Features**: Set `ENABLE_AI_FEATURES=true`

## 🔧 **Testing Configuration**

### Test All Providers:
```bash
node test-ai-providers.js
```

### Test Current Config:
```javascript
const { testCurrentConfig } = require('./test-ai-providers');
testCurrentConfig();
```

### Check Provider Info in WhatsApp:
```
/ai-info
```

## 📊 **Provider Comparison**

| Provider | Speed | Cost | Models Available | Best For |
|----------|-------|------|------------------|----------|
| **DeepSeek** | Fast | Low | deepseek-chat, deepseek-coder | General use, coding |
| **OpenAI** | Medium | High | gpt-3.5-turbo, gpt-4 | High quality responses |
| **Groq** | Very Fast | Low | llama3-8b-8192, mixtral-8x7b | Fast inference |
| **LocalAI** | Variable | Free | Custom models | Privacy, offline |

## 🚀 **Quick Start Examples**

### For DeepSeek Users:
```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_actual_key_here
ENABLE_AI_FEATURES=true
```

### For OpenAI Users:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_actual_key_here
OPENAI_MODEL=gpt-3.5-turbo
ENABLE_AI_FEATURES=true
```

### For Groq Users (Fast & Free):
```env
AI_PROVIDER=openaicompatible
OPENAI_COMPATIBLE_API_KEY=your_groq_key_here
OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai
OPENAI_COMPATIBLE_MODEL=llama3-8b-8192
ENABLE_AI_FEATURES=true
```

## 🛠️ **Available AI Features**

✅ **Natural Language Transaction Processing**
- "Saya habis 50000 untuk makan siang"
- "Terima 3 juta gaji bulan ini"

✅ **Smart Commands**
- `/chat` - AI consultation
- `/analisis` - Financial analysis
- `/saran` - Personal advice
- `/prediksi-ai` - Financial prediction
- `/ringkasan-ai` - Intelligent summaries
- `/kategori-otomatis` - Auto categorization

✅ **Advanced Features**
- Natural language editing
- Receipt parsing (future)
- Smart categorization
- Financial insights

## 🔍 **Troubleshooting**

### AI Not Working?
1. Check if `ENABLE_AI_FEATURES=true`
2. Verify API key is correct
3. Test with `/ai-info` command
4. Run `node test-ai-providers.js`

### Provider Switching:
1. Update `AI_PROVIDER` environment variable
2. Set the corresponding API key variables
3. Restart the bot
4. Test with `/ai-info`

### Common Issues:
- **401 Error**: Invalid API key
- **Connection Error**: Wrong base URL
- **Model Error**: Model not available for provider
- **Rate Limit**: Too many requests

## 💡 **Best Practices**

1. **Start with DeepSeek**: Good balance of speed, cost, and quality
2. **Use Groq for Speed**: When you need fast responses
3. **OpenAI for Quality**: When you need the best responses
4. **LocalAI for Privacy**: When data privacy is crucial

## 🔄 **Switching Providers**

You can easily switch between providers by changing environment variables:

```bash
# Switch to DeepSeek
export AI_PROVIDER=deepseek
export DEEPSEEK_API_KEY=your_key

# Switch to Groq
export AI_PROVIDER=openaicompatible
export OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai
export OPENAI_COMPATIBLE_API_KEY=your_groq_key
```

## 🎯 **Production Recommendations**

1. **Use Environment Variables**: Never hardcode API keys
2. **Monitor Usage**: Track API costs and rate limits
3. **Fallback Strategy**: Have backup provider configured
4. **Log Monitoring**: Monitor AI service errors
5. **Performance Testing**: Test with real workloads

---

✅ **Multi-provider AI system is now fully implemented and ready for production use!**