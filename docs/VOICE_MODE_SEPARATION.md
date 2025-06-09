# Voice Mode Separation

This document explains how voice features are separated between different bot modes to maintain clear functionality boundaries.

## 🎯 **Voice Feature Scope**

### **Voice ENABLED:**
- 💬 **AI Curhat Mode** - Voice responses for emotional support and conversation

### **Voice DISABLED:**
- 💰 **Financial Bot Mode** - Text-only responses for transactions, reports, and financial data
- 📊 **Report Generation** - Text-based reports and summaries
- 🔍 **Transaction Queries** - Text responses for financial inquiries
- ⚙️ **Bot Configuration** - Text-based settings and commands

## 🏗️ **Architecture Implementation**

### **1. Service Separation**

```javascript
// AICurhatService.js - HAS voice support
class AICurhatService {
    async handleCurhatMessage(userPhone, message) {
        // Detects voice requests
        const isVoiceRequested = this.ttsService.isVoiceRequested(message);
        
        // Uses different prompts for voice vs text
        const aiResponse = await this.generateCurhatResponse(
            userPhone, 
            history, 
            isVoiceRequested  // 🔑 Voice-aware prompt
        );
        
        // Returns voice or text response
        if (isVoiceRequested) {
            return await this.handleVoiceResponse(userPhone, aiResponse);
        }
    }
}

// AIService.js - NO voice support
class AIService {
    async parseNaturalLanguageTransaction(text, userPhone) {
        // Only text-based transaction parsing
        // No voice detection or TTS integration
        return parsedTransaction;
    }
}
```

### **2. Prompt Differentiation**

```javascript
// Curhat Mode - Voice Prompt
const voicePrompt = `
🎵 INSTRUKSI KHUSUS UNTUK SUARA:
- Response ini akan dikonversi menjadi VOICE MESSAGE oleh HIJILABS TTS System
- Tulis dengan gaya yang nyaman untuk didengar
- Gunakan intonasi yang hangat dan empati dalam tulisan
- Fokus pada kata-kata yang mudah dipahami saat didengar
- Buat response seperti sedang berbincang secara langsung
`;

// Curhat Mode - Text Prompt  
const textPrompt = `
- Menggunakan emoji yang tepat untuk mengekspresikan empati: 😊🤗💙✨🌸
- Format markdown untuk text yang lebih menarik
`;

// Financial Mode - Always Text Only
const financialPrompt = `
Kamu adalah parser transaksi keuangan yang ahli.
Analisis input dan ekstrak detail transaksi dengan akurat.
// No voice instructions - financial data stays text-based
`;
```

## 🔄 **User Experience Flows**

### **Financial Bot Mode (Text Only)**
```
User: "Habis 50K beli makan, balas dengan suara"
Bot: 💰 Transaksi berhasil dicatat:
     • Pengeluaran: Rp 50.000
     • Kategori: Makanan
     • Deskripsi: makan
     
     ✅ Saldo terupdate
```
*Note: Voice request ignored in financial mode*

### **Curhat Mode with Voice Request**
```
User: "Lagi sedih nih, cerita pake suara dong"
Bot: 🗣️ [VOICE MESSAGE: "Aku bisa mengerti perasaan kamu yang 
     sedang sedih. Cerita aja sama aku, aku siap mendengarkan..."]
     
     📝 Transcript: "Aku bisa mengerti perasaan kamu..."
```

### **Curhat Mode without Voice Request**
```
User: "Lagi galau nih"
Bot: 💙 Aku bisa mengerti perasaan kamu yang lagi galau. 
     Mau cerita apa yang bikin kamu merasa seperti ini? 
     Aku di sini buat dengerin kamu 🤗✨
```

## 🛡️ **Boundary Enforcement**

### **1. Service Level Protection**
```javascript
// CommandHandler.js
async handleMessage(message) {
    // Check if user is in curhat mode
    if (await this.aiCurhatService.isUserInCurhatMode(userPhone)) {
        // 🎵 Voice features available
        return await this.aiCurhatService.handleCurhatMessage(userPhone, message);
    } else {
        // 💰 Financial mode - text only
        return await this.handleFinancialMessage(message);
    }
}
```

### **2. Voice Detection Isolation**
```javascript
// Only AICurhatService checks for voice requests
const isVoiceRequested = this.ttsService.isVoiceRequested(message);

// AIService never checks for voice - maintains separation
const parsed = await this.ai.parseNaturalLanguageTransaction(text, userPhone);
```

## 🎵 **Voice Request Detection**

### **Supported Voice Keywords (Curhat Mode Only)**
```javascript
const voiceKeywords = [
    'balas dengan suara',
    'bales dengan suara', 
    'pakai suara',
    'pake suara',
    'dengan voice',
    'pakai voice',
    'jawab pake suara',
    'minta suara',
    'ceritakan dengan suara'
];
```

### **Financial Messages with Voice Requests (Ignored)**
```
❌ "Habis 50K makan, balas dengan suara" -> Text response only
❌ "Dapat gaji 3jt, pake voice dong" -> Text response only  
❌ "Laporan bulan ini pake suara" -> Text response only
```

## 📊 **Feature Comparison**

| Feature | Financial Bot | Curhat Mode |
|---------|---------------|-------------|
| **Voice Response** | ❌ No | ✅ Yes |
| **Voice Detection** | ❌ No | ✅ Yes |
| **TTS Integration** | ❌ No | ✅ Yes |
| **Voice Prompts** | ❌ No | ✅ Yes |
| **Emoji Usage** | ✅ Minimal | ✅ Extensive |
| **Response Type** | 📝 Text Only | 🗣️ Voice + Text |

## 🔧 **Configuration**

### **Environment Variables**
```bash
# TTS Configuration (Curhat Mode Only)
ELEVENLABS_TTS_ENABLED=true
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB
ELEVENLABS_LANGUAGE_ID=id

# AI Curhat Configuration  
AI_CURHAT_ENABLED=true
AI_CURHAT_PROVIDER=openrouter

# Financial AI (No Voice Config Needed)
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_deepseek_key
```

### **Service Initialization**
```javascript
// TTS Service only initialized for curhat
if (this.sessionManager) {
    this.aiCurhatService = new AICurhatService(this.sessionManager);
    // AICurhatService internally creates TTSService
}

// AIService never uses TTS
this.aiService = new AIService(); // Text-only financial AI
```

## ✅ **Benefits of Separation**

### **1. Clear Responsibilities**
- **Financial AI**: Focus on accurate transaction parsing and financial data
- **Curhat AI**: Focus on emotional support and conversational responses

### **2. Performance Optimization**
- Financial operations remain fast (no TTS processing)
- Voice features only active when contextually appropriate

### **3. User Experience**
- Financial data stays professional and precise
- Emotional support becomes more personal with voice

### **4. Maintainability**
- Clean separation of concerns
- Easy to modify one mode without affecting the other
- Clear debugging boundaries

## 🚀 **Usage Examples**

### **Correct Usage**
```javascript
// In curhat mode - voice available
await aiCurhatService.handleCurhatMessage(userPhone, "Sedih nih, balas pake suara");
// Returns: { type: 'audio', content: text, audioPath: path }

// In financial mode - text only  
await aiService.parseNaturalLanguageTransaction("Habis 50K makan");
// Returns: { type: 'expense', amount: 50000, description: 'makan' }
```

### **Architecture Enforcement**
```javascript
// This is NOT possible - AIService has no voice methods
await aiService.handleVoiceResponse(); // ❌ Method doesn't exist

// This is NOT possible - Financial mode ignores voice requests
const isVoice = aiService.isVoiceRequested(); // ❌ Method doesn't exist
```

## 🎯 **Summary**

Voice features are **exclusively** available in **AI Curhat Mode** to maintain:

- 🎯 **Purpose clarity**: Financial = precise, Curhat = emotional
- ⚡ **Performance**: No unnecessary TTS processing in financial operations  
- 🛡️ **Architecture**: Clean separation prevents feature creep
- 👥 **User experience**: Appropriate response types for different contexts

The separation ensures that users get the right type of interaction for their current need - professional text for financial tasks, warm voice responses for emotional support.