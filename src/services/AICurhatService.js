const Logger = require('../utils/Logger');
const axios = require('axios');

class AICurhatService {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.logger = new Logger();
        
        // Initialize AI configuration for curhat mode
        this.initializeAIConfig();
    }

    initializeAIConfig() {
        this.isEnabled = process.env.AI_CURHAT_ENABLED === 'true';
        this.provider = process.env.AI_CURHAT_PROVIDER || 'openrouter';
        this.model = process.env.AI_CURHAT_MODEL || 'deepseek/deepseek-chat-v3-0324:free';
        
        // Get API configuration based on provider
        this.apiConfig = this.getAPIConfig(this.provider);
        
        if (!this.apiConfig.apiKey) {
            this.logger.warn(`AI Curhat: No API key found for provider ${this.provider}`);
            this.isEnabled = false;
        }
        
        this.logger.info(`AI Curhat Service initialized: ${this.isEnabled ? 'Enabled' : 'Disabled'}`);
        if (this.isEnabled) {
            this.logger.info(`Provider: ${this.provider}, Model: ${this.model}`);
        }
    }

    getAPIConfig(provider) {
        switch (provider.toLowerCase()) {
            case 'openrouter':
                return {
                    apiKey: process.env.OPENROUTER_API_KEY,
                    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
                    model: this.model
                };
            case 'deepseek':
                return {
                    apiKey: process.env.DEEPSEEK_API_KEY,
                    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
                    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
                };
            case 'openai':
                return {
                    apiKey: process.env.OPENAI_API_KEY,
                    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
                    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
                };
            case 'groq':
                return {
                    apiKey: process.env.GROQ_API_KEY,
                    baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
                    model: process.env.GROQ_MODEL || 'llama3-8b-8192'
                };
            default:
                this.logger.error(`Unknown AI provider for curhat: ${provider}`);
                return { apiKey: null, baseURL: null, model: null };
        }
    }

    async enterCurhatMode(userPhone) {
        try {
            if (!this.isEnabled) {
                return {
                    success: false,
                    message: '❌ Maaf, mode curhat sedang tidak tersedia.'
                };
            }

            // Set user session to curhat mode
            await this.sessionManager.setCurhatMode(userPhone, true);
            
            // Initialize conversation history
            await this.sessionManager.setCurhatHistory(userPhone, []);
            
            this.logger.info(`User ${userPhone} entered curhat mode`);
            
            const welcomeMessage = `💭 *Mode Curhat Activated* 🤗

Halo! Sekarang kamu dalam mode curhat. Aku siap jadi teman curhat yang baik untuk mendengarkan cerita kamu.

✨ *Apa yang bisa aku lakukan:*
• Mendengarkan keluh kesah kamu
• Memberikan dukungan emosional
• Berbagi perspektif yang mungkin membantu
• Menjadi teman bicara yang tidak menghakimi

💬 *Tips:*
• Ceritakan apa saja yang kamu rasakan
• Aku akan menjaga privasi percakapan kita
• Jangan ragu untuk berbagi hal yang membuat kamu senang atau sedih

🚪 *Untuk keluar dari mode curhat:*
Ketik */quit* atau *selesai*

Jadi, ada yang ingin kamu ceritakan hari ini? 😊`;

            return {
                success: true,
                message: welcomeMessage
            };

        } catch (error) {
            this.logger.error('Error entering curhat mode:', error);
            return {
                success: false,
                message: '❌ Terjadi kesalahan saat memulai mode curhat.'
            };
        }
    }

    async exitCurhatMode(userPhone) {
        try {
            // Remove user from curhat mode
            await this.sessionManager.setCurhatMode(userPhone, false);
            
            // Clear conversation history
            await this.sessionManager.clearCurhatHistory(userPhone);
            
            this.logger.info(`User ${userPhone} exited curhat mode`);
            
            const exitMessage = `👋 *Mode Curhat Deactivated*

Terima kasih sudah berbagi cerita dengan aku! Semoga percakapan kita tadi bisa sedikit membantu. 😊

🔄 Sekarang kamu kembali ke mode keuangan. Aku siap membantu mencatat transaksi dan mengelola keuangan kamu.

💡 *Ingat:* Kamu bisa kembali ke mode curhat kapan saja dengan mengetik */curhat*

Semoga harimu menyenangkan! ✨`;

            return {
                success: true,
                message: exitMessage
            };

        } catch (error) {
            this.logger.error('Error exiting curhat mode:', error);
            return {
                success: false,
                message: '❌ Terjadi kesalahan saat keluar dari mode curhat.'
            };
        }
    }

    async handleCurhatMessage(userPhone, message) {
        try {
            if (!this.isEnabled) {
                return '❌ Mode curhat sedang tidak tersedia.';
            }

            // Check if user wants to exit
            const lowerMessage = message.toLowerCase().trim();
            if (lowerMessage === '/quit' || lowerMessage === 'selesai' || lowerMessage === '/keluar') {
                const exitResult = await this.exitCurhatMode(userPhone);
                return exitResult.message;
            }

            // Get conversation history
            let history = await this.sessionManager.getCurhatHistory(userPhone) || [];
            
            // Add user message to history
            history.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString()
            });

            // Generate AI response
            const aiResponse = await this.generateCurhatResponse(history);
            
            if (aiResponse) {
                // Add AI response to history
                history.push({
                    role: 'assistant',
                    content: aiResponse,
                    timestamp: new Date().toISOString()
                });

                // Keep only last 20 messages to manage memory
                if (history.length > 20) {
                    history = history.slice(-20);
                }

                // Save updated history
                await this.sessionManager.setCurhatHistory(userPhone, history);
                
                return aiResponse;
            } else {
                return '😅 Maaf, aku sedang sedikit bingung. Bisa coba ceritakan lagi?';
            }

        } catch (error) {
            this.logger.error('Error handling curhat message:', error);
            return '❌ Maaf, terjadi kesalahan. Coba ceritakan lagi ya.';
        }
    }

    async generateCurhatResponse(history) {
        try {
            // Prepare system prompt for curhat mode
            const systemPrompt = `Kamu adalah seorang teman curhat yang baik, empatik, dan penuh perhatian. Karakteristik kamu:

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
   - Emoji yang sesuai untuk menunjukkan empati: 😊🤗💙✨🌸

4. YANG HARUS DIHINDARI:
   - Jangan menggurui atau ceramah
   - Jangan meremehkan masalah mereka
   - Jangan terlalu cepat memberikan solusi
   - Jangan mengalihkan topik ke hal lain

5. PANJANG RESPONS:
   - Berikan respons yang cukup panjang (2-4 kalimat)
   - Tunjukkan bahwa kamu benar-benar memperhatikan

Ingat: Tujuan utama adalah memberikan dukungan emosional dan membuat mereka merasa didengar dan dipahami.`;

            // Prepare messages for AI
            const messages = [
                { role: 'system', content: systemPrompt },
                ...history.slice(-10) // Only send last 10 messages for context
            ];

            // Make API request based on provider
            const response = await this.makeAIRequest(messages);
            
            return response;

        } catch (error) {
            this.logger.error('Error generating curhat response:', error);
            return null;
        }
    }

    async makeAIRequest(messages) {
        try {
            // Use the same logic as AIService.makeRequestWithProvider
            const payload = {
                model: this.apiConfig.model,
                messages: messages,
                temperature: 0.8, // More creative for conversation
                max_tokens: 500,
                stream: false
            };

            // Prepare headers like AIService
            const headers = {
                'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                'Content-Type': 'application/json'
            };

            // Add OpenRouter specific headers if needed
            if (this.provider === 'openrouter') {
                headers['HTTP-Referer'] = 'https://github.com/your-repo';
                headers['X-Title'] = 'KasAI Curhat Mode';
            }

            // Use the same endpoint pattern as AIService: /v1/chat/completions
            const response = await axios.post(`${this.apiConfig.baseURL}/v1/chat/completions`, payload, {
                headers: headers,
                timeout: 30000
            });

            // Extract response like AIService
            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                throw new Error('Invalid response format from AI provider');
            }

            return response.data.choices[0].message.content.trim();

        } catch (error) {
            this.logger.error('Error making AI request:', error.response?.data || error.message);
            return null;
        }
    }

    async isUserInCurhatMode(userPhone) {
        try {
            return await this.sessionManager.isInCurhatMode(userPhone);
        } catch (error) {
            this.logger.error('Error checking curhat mode:', error);
            return false;
        }
    }

    getStatus() {
        return {
            enabled: this.isEnabled,
            provider: this.provider,
            model: this.model,
            hasApiKey: !!this.apiConfig.apiKey
        };
    }
}

module.exports = AICurhatService;