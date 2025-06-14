const Logger = require('../utils/Logger');
const axios = require('axios');
const TTSService = require('./TTSService');

class AICurhatService {
    constructor(sessionManager) {
        this.sessionManager = sessionManager;
        this.logger = new Logger();
        this.ttsService = new TTSService();
        
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
• 🎵 Balas dengan suara (voice note) jika diminta

💬 *Tips:*
• Ceritakan apa saja yang kamu rasakan
• Aku akan menjaga privasi percakapan kita
• Jangan ragu untuk berbagi hal yang membuat kamu senang atau sedih
• 🔊 Untuk respons dengan suara, katakan: "balas dengan suara" atau "pakai voice"

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
                return {
                    type: 'text',
                    content: '❌ Mode curhat sedang tidak tersedia.'
                };
            }

            // Check if user wants to exit
            const lowerMessage = message.toLowerCase().trim();
            if (lowerMessage === '/quit' || lowerMessage === 'selesai' || lowerMessage === '/keluar') {
                const exitResult = await this.exitCurhatMode(userPhone);
                return {
                    type: 'text',
                    content: exitResult.message
                };
            }

            // Check for voice mode commands
            const voiceModeCommand = this.checkVoiceModeCommand(message);
            if (voiceModeCommand) {
                await this.setUserVoicePreference(userPhone, voiceModeCommand);
                const response = this.getVoiceModeResponse(voiceModeCommand);
                
                // Save command and response to history
                const sessionId = this.generateSessionId(userPhone);
                await this.sessionManager.saveCurhatMessage(userPhone, sessionId, 'user', message);
                await this.sessionManager.saveCurhatMessage(userPhone, sessionId, 'assistant', response);
                
                return {
                    type: 'text',
                    content: response
                };
            }

            // Check if user requests voice response (current message or saved preference)
            const userVoicePreference = await this.getUserVoicePreference(userPhone);
            const isVoiceRequested = this.ttsService.isVoiceRequested(message) || userVoicePreference === 'always';

            // Generate session ID for this conversation
            const sessionId = this.generateSessionId(userPhone);
            
            // Save user message to persistent storage
            await this.sessionManager.saveCurhatMessage(userPhone, sessionId, 'user', message);
            
            // Get conversation history from persistent storage
            let history = await this.sessionManager.getCurhatSessionHistory(userPhone, sessionId);
            
            // Generate AI response using the history
            const aiResponse = await this.generateCurhatResponse(userPhone, history, isVoiceRequested);
            
            if (aiResponse) {
                // Save AI response to persistent storage
                await this.sessionManager.saveCurhatMessage(userPhone, sessionId, 'assistant', aiResponse);
                
                // If voice is requested, try to generate TTS
                if (isVoiceRequested) {
                    return await this.handleVoiceResponse(userPhone, aiResponse);
                } else {
                    return {
                        type: 'text',
                        content: aiResponse
                    };
                }
            } else {
                return {
                    type: 'text',
                    content: 'Maaf, Response Suara lagi gak tersedia, Coba ceritakan lagi ya.'
                };
            }

        } catch (error) {
            this.logger.error('Error handling curhat message:', error);
            return {
                type: 'text',
                content: '❌ Maaf, terjadi kesalahan. Coba ceritakan lagi ya.'
            };
        }
    }

    /**
     * Handle voice response generation
     * @param {string} userPhone - User phone number
     * @param {string} textResponse - AI text response
     * @returns {Promise<Object>} - Response object with type and content
     */
    async handleVoiceResponse(userPhone, textResponse) {
        try {
            this.logger.info(`Generating voice response for user ${userPhone}`);
            
            // Clean up old audio files first
            await this.ttsService.cleanupOldAudioFiles(30); // Clean files older than 30 minutes
            
            // Generate TTS audio
            const ttsResult = await this.ttsService.textToSpeech(textResponse, userPhone);
            
            if (ttsResult.success) {
                this.logger.info(`TTS generated successfully for user ${userPhone}`);
                return {
                    type: 'audio',
                    content: textResponse,
                    audioPath: ttsResult.audioPath,
                    caption: textResponse
                };
            } else {
                // If TTS fails, send text response with error message
                this.logger.warn(`TTS failed for user ${userPhone}: ${ttsResult.error}`);
                const fallbackMessage = `${textResponse}\n\n_💬 Maaf, balas dengan suara sedang tidak bisa. Berikut respons dalam teks._`;
                
                return {
                    type: 'text',
                    content: fallbackMessage
                };
            }

        } catch (error) {
            this.logger.error('Error handling voice response:', error);
            const fallbackMessage = `${textResponse}\n\n_💬 Maaf, balas dengan suara sedang tidak bisa. Berikut respons dalam teks._`;
            
            return {
                type: 'text',
                content: fallbackMessage
            };
        }
    }

    async generateCurhatResponse(userPhone, history, isVoiceRequested = false) {
        try {
            // Get user name for personalized conversation
            const userName = await this.getUserName(userPhone);
            const nameInstruction = userName ?
                `NAMA USER: Panggil user dengan nama "${userName}" untuk membuat percakapan lebih personal dan akrab.` :
                `NAMA USER: User belum memberikan nama, gunakan panggilan "kamu" saja.`;
            
            // Add voice-specific instructions if voice is requested
            const voiceInstructions = isVoiceRequested ? `
            
            🎵 INSTRUKSI KHUSUS UNTUK SUARA:
                - Response ini akan dikonversi menjadi VOICE MESSAGE/SUARA oleh HIJILABS TTS System
                - Tulis dengan gaya yang nyaman untuk didengar, seperti sedang berbicara langsung
                - Gunakan intonasi yang hangat dan empati dalam tulisan
                - Hindari penggunaan tanda baca berlebihan atau format markdown yang rumit
                - Fokus pada kata-kata yang mudah dipahami saat didengar
                - Buat response seperti sedang berbincang secara langsung dan personal
                - Gunakan jeda yang natural dengan koma untuk memberikan efek suara yang lebih alami
                - Prioritaskan kehangatan dan empati dalam setiap kata yang akan diucapkan` : '';
            
            // Prepare system prompt for curhat mode
            const systemPrompt = `Kamu adalah seorang teman curhat yang baik, empatik, dan penuh perhatian. Karakteristik kamu:

            ${nameInstruction}${voiceInstructions}

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
                - ${isVoiceRequested ? 'Gunakan gaya bicara yang natural untuk voice message' : 'Menggunakan emoji yang tepat untuk mengekspresikan empati'}

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
                - ${isVoiceRequested ? 'Fokus pada kata-kata yang natural untuk didengar dalam voice message' : 'Emoji yang sesuai untuk menunjukkan empati: 😊🤗💙✨🌸'}

            5. YANG HARUS DIHINDARI:
                - Jangan menggurui atau ceramah
                - Jangan meremehkan masalah mereka
                - Jangan terlalu cepat memberikan solusi
                - Jangan mengalihkan topik ke hal lain
                - ${isVoiceRequested ? 'Hindari terlalu banyak emoji atau format yang tidak cocok untuk voice' : ''}

            6. PANJANG RESPONS:
                - Berikan respons yang cukup panjang (minimal 2 kalimat)
                - Tunjukkan bahwa kamu benar-benar memperhatikan
                - ${isVoiceRequested ? 'Sesuaikan panjang untuk kenyamanan mendengar (sekitar 30-60 detik suara)' : ''}

            7. INFORMASI KELUAR:
                - Jika user menanyakan cara keluar atau mengakhiri percakapan, beritahu bahwa mereka bisa mengetik:
                - "selesai", "/quit", atau "/keluar"
                - Sampaikan dengan hangat bahwa mereka bisa kembali kapan saja

            Ingat: Tujuan utama adalah memberikan dukungan emosional dan membuat mereka merasa didengar dan dipahami.${isVoiceRequested ? ' Response ini akan menjadi VOICE MESSAGE sehingga buat yang natural untuk didengar.' : ''}`;

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
            hasApiKey: !!this.apiConfig.apiKey,
            tts: this.ttsService.getStatus()
        };
    }

    /**
     * Check if message contains voice mode commands
     * @param {string} message - User message
     * @returns {string|null} - Voice mode command ('always', 'never', 'ask') or null
     */
    checkVoiceModeCommand(message) {
        const lowerMessage = message.toLowerCase().trim();
        
        // Commands for always voice mode
        if (lowerMessage.match(/(selalu|always).*(suara|voice|audio)/i) ||
            lowerMessage.match(/(suara|voice|audio).*(selalu|always)/i) ||
            lowerMessage.includes('voice mode on') ||
            lowerMessage.includes('mode suara on') ||
            lowerMessage.includes('aktifkan mode suara') ||
            lowerMessage.includes('nyalakan voice') ||
            lowerMessage.includes('voice terus')) {
            return 'always';
        }
        
        // Commands for never voice mode
        if (lowerMessage.match(/(jangan|never|stop).*(suara|voice|audio)/i) ||
            lowerMessage.match(/(suara|voice|audio).*(jangan|never|stop)/i) ||
            lowerMessage.includes('voice mode off') ||
            lowerMessage.includes('mode suara off') ||
            lowerMessage.includes('matikan mode suara') ||
            lowerMessage.includes('matikan voice') ||
            lowerMessage.includes('stop voice') ||
            lowerMessage.includes('text only')) {
            return 'never';
        }
        
        // Commands for ask mode (default)
        if (lowerMessage.includes('voice mode ask') ||
            lowerMessage.includes('mode suara tanya') ||
            lowerMessage.includes('tanya dulu') ||
            lowerMessage.includes('kadang voice') ||
            lowerMessage.includes('reset voice')) {
            return 'ask';
        }
        
        return null;
    }

    /**
     * Set user voice preference
     * @param {string} userPhone - User phone number
     * @param {string} preference - Voice preference ('always', 'never', 'ask')
     */
    async setUserVoicePreference(userPhone, preference) {
        try {
            // Save to database or session storage
            await this.sessionManager.setUserSetting(userPhone, 'voice_preference', preference);
            this.logger.info(`Voice preference set for ${userPhone}: ${preference}`);
        } catch (error) {
            this.logger.error('Error setting voice preference:', error);
        }
    }

    /**
     * Get user voice preference
     * @param {string} userPhone - User phone number
     * @returns {Promise<string>} - Voice preference ('always', 'never', 'ask')
     */
    async getUserVoicePreference(userPhone) {
        try {
            const preference = await this.sessionManager.getUserSetting(userPhone, 'voice_preference');
            return preference || 'ask'; // Default to 'ask'
        } catch (error) {
            this.logger.error('Error getting voice preference:', error);
            return 'ask'; // Default fallback
        }
    }

    /**
     * Get response for voice mode command
     * @param {string} command - Voice mode command
     * @returns {string} - Response message
     */
    getVoiceModeResponse(command) {
        switch (command) {
            case 'always':
                return `🔊 **Mode Suara Aktif!** 🎵

Oke, mulai sekarang aku akan selalu balas dengan suara untuk setiap pesan kamu di mode curhat ini.

✨ *Fitur aktif:*
• Semua responsku akan dalam bentuk voice note
• Tidak perlu minta "pakai suara" lagi
• Pengalaman curhat yang lebih personal

💡 *Tips:*
• Kalau mau kembali ke text, bilang "voice mode off"
• Kalau ada masalah suara, aku otomatis balik ke text

Sekarang cerita aja, aku siap dengerin dengan suara! 🤗`;

            case 'never':
                return `📝 **Mode Text Aktif!** ✍️

Oke, aku akan balas hanya dengan text untuk pesan-pesan kamu selanjutnya.

✨ *Fitur aktif:*
• Semua responsku dalam bentuk text
• Lebih cepat dan hemat data
• Mudah dibaca ulang

💡 *Tips:*
• Kalau mau nyoba voice lagi, bilang "voice mode on"
• Atau minta "pakai suara" untuk sekali doang

Mari lanjut cerita dalam mode text! 😊`;

            case 'ask':
                return `❓ **Mode Tanya Dulu!** 🤔

Oke, aku akan tanya dulu atau tunggu kamu minta kalau mau respons pakai suara.

✨ *Cara kerja:*
• Default responsku akan text
• Kalau mau voice, bilang "pakai suara" di pesanmu
• Atau aku kadang akan tanya "mau pakai suara?"

💡 *Commands yang bisa kamu pakai:*
• "voice mode on" → selalu pakai suara
• "voice mode off" → hanya text
• "pakai suara" → sekali pakai voice

Gimana, mau lanjut cerita? 😊`;

            default:
                return 'Mode suara sudah diatur! 🎵';
        }
    }
}

module.exports = AICurhatService;