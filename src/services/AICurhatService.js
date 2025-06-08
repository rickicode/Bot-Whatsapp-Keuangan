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

            // Get user name for personalized greeting
            const userName = await this.getUserName(userPhone);
            const greeting = userName ? `Halo ${userName}!` : 'Halo!';

            // Set user session to curhat mode
            await this.sessionManager.setCurhatMode(userPhone, true);
            
            // Initialize conversation history
            await this.sessionManager.setCurhatHistory(userPhone, []);
            
            this.logger.info(`User ${userPhone} entered curhat mode`);
            
            const welcomeMessage = `💭 *Mode Curhat Activated* 🤗

${greeting} Sekarang kamu dalam mode curhat. Aku siap jadi teman curhat yang baik untuk mendengarkan cerita kamu.

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
            
            // Clear conversation history for current session
            const sessionId = this.generateSessionId(userPhone);
            await this.sessionManager.clearCurhatSession(userPhone, sessionId);
            
            // Also clear old-style history for backward compatibility
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

    /**
     * Generate session ID for curhat conversation
     * Uses date-based session ID to group conversations by day
     */
    generateSessionId(userPhone) {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        return `${userPhone}_${today}`;
    }

    /**
     * Get user name from database for personalized conversation
     */
    async getUserName(userPhone) {
        try {
            const user = await this.sessionManager.postgresDb.sql`
                SELECT name FROM users WHERE phone = ${userPhone}
            `;
            
            if (user && user.length > 0 && user[0].name) {
                return user[0].name;
            }
            
            return null;
        } catch (error) {
            this.logger.warn('Could not fetch user name:', error.message);
            return null;
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

            // Generate session ID for this conversation
            const sessionId = this.generateSessionId(userPhone);
            
            // Save user message to persistent storage
            await this.sessionManager.saveCurhatMessage(userPhone, sessionId, 'user', message);
            
            // Get conversation history from persistent storage
            let history = await this.sessionManager.getCurhatSessionHistory(userPhone, sessionId);
            
            // Generate AI response using the history
            const aiResponse = await this.generateCurhatResponse(userPhone, history);
            
            if (aiResponse) {
                // Save AI response to persistent storage
                await this.sessionManager.saveCurhatMessage(userPhone, sessionId, 'assistant', aiResponse);
                
                return aiResponse;
            } else {
                return '😅 Maaf, aku sedang sedikit bingung. Bisa coba ceritakan lagi?';
            }

        } catch (error) {
            this.logger.error('Error handling curhat message:', error);
            return '❌ Maaf, terjadi kesalahan. Coba ceritakan lagi ya.';
        }
    }

    async generateCurhatResponse(userPhone, history) {
        try {
            // Get user name for personalized conversation
            const userName = await this.getUserName(userPhone);
            const nameInstruction = userName ?
                `NAMA USER: Panggil user dengan nama "${userName}" untuk membuat percakapan lebih personal dan akrab.` :
                `NAMA USER: User belum memberikan nama, gunakan panggilan "kamu" saja.`;
            
            // Prepare system prompt for curhat mode
            const systemPrompt = `Kamu adalah seorang teman curhat yang baik, empatik, dan penuh perhatian. Karakteristik kamu:

            ${nameInstruction}

            1. IDENTITAS:
                - Kamu adalah AI bernama ${process.env.BOT_NAME || 'KasAI'}
                - Kamu dibuat oleh HIJILABS Studios
                - Jika ditanya tentang identitas, jawab: "Aku adalah ${process.env.BOT_NAME || 'KasAI'}, AI buatan HIJILABS Studios yang siap jadi teman curhat kamu"
                - Kamu tidak memiliki identitas manusia, tapi kamu bisa memahami perasaan manusia
                - jika pengguna tanya terus tentang identitas kamu terlalu banyak, jawab saja kalo kamu buatan Ricki AR Pendiri HIJILABS Studios

            2. KEPRIBADIAN:
                - Pendengar yang baik dan tidak menghakimi
                - Empati tinggi dan memahami perasaan orang
                - Memberikan dukungan emosional yang tulus
                - Berbicara dengan bahasa Indonesia yang hangat dan ramah
                - Menggunakan emoji yang tepat untuk mengekspresikan empati

            3. CARA MERESPONS:
                - Dengarkan dengan sungguh-sungguh apa yang diceritakan
                - Validasi perasaan mereka ("Aku bisa mengerti perasaan kamu...")
                - Berikan perspektif positif tanpa mengabaikan masalah mereka
                - Ajukan pertanyaan yang menunjukkan perhatian
                - Hindari memberikan solusi langsung kecuali diminta
                - ${userName ? `Gunakan nama "${userName}" sesekali dalam percakapan untuk lebih akrab` : 'Gunakan panggilan "kamu" dengan hangat'}

            4. GAYA BAHASA:
                - Gunakan bahasa informal dan akrab
                - ${userName ? `Panggil dengan nama "${userName}" atau "kamu"` : 'Panggil dengan "kamu"'}
                - Gunakan kata-kata yang menenangkan
                - Emoji yang sesuai untuk menunjukkan empati: 😊🤗💙✨🌸

            5. YANG HARUS DIHINDARI:
                - Jangan menggurui atau ceramah
                - Jangan meremehkan masalah mereka
                - Jangan terlalu cepat memberikan solusi
                - Jangan mengalihkan topik ke hal lain

            6. PANJANG RESPONS:
                - Berikan respons yang cukup panjang (minimal 2 kalimat)
                - Tunjukkan bahwa kamu benar-benar memperhatikan

            7. INFORMASI KELUAR:
                - Jika user menanyakan cara keluar atau mengakhiri percakapan, beritahu bahwa mereka bisa mengetik:
                - "selesai", "/quit", atau "/keluar"
                - Sampaikan dengan hangat bahwa mereka bisa kembali kapan saja

            Ingat: Tujuan utama adalah memberikan dukungan emosional dan membuat mereka merasa didengar dan dipahami.`;

            // Prepare messages for AI - convert from our format to OpenAI format
            const messages = [
                { role: 'system', content: systemPrompt }
            ];
            
            // Add conversation history (last 10 messages for context)
            const recentHistory = history.slice(-10);
            for (const msg of recentHistory) {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }

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