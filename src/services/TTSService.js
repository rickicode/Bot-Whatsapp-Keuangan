const Logger = require('../utils/Logger');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class TTSService {
    constructor() {
        this.logger = new Logger();
        this.initializeConfig();
    }

    initializeConfig() {
        this.isEnabled = process.env.ELEVENLABS_TTS_ENABLED === 'true';
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Default voice ID
        this.baseURL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1';
        this.model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
        this.languageId = process.env.ELEVENLABS_LANGUAGE_ID || 'id'; // Indonesian by default
        
        // Create temp directory for audio files if it doesn't exist
        this.tempDir = path.join(process.cwd(), 'temp', 'audio');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        if (!this.apiKey && this.isEnabled) {
            this.logger.warn('ElevenLabs TTS: No API key found');
            this.isEnabled = false;
        }

        this.logger.info(`TTS Service initialized: ${this.isEnabled ? 'Enabled' : 'Disabled'}`);
        if (this.isEnabled) {
            this.logger.info(`Voice ID: ${this.voiceId}, Model: ${this.model}, Language: ${this.languageId}`);
        }
    }

    /**
     * Convert text to speech using ElevenLabs API
     * @param {string} text - Text to convert to speech
     * @param {string} userPhone - User phone for unique filename
     * @returns {Promise<{success: boolean, audioPath?: string, error?: string}>}
     */
    async textToSpeech(text, userPhone) {
        if (!this.isEnabled) {
            return {
                success: false,
                error: 'TTS service is disabled'
            };
        }

        try {
            // Clean text for TTS (remove markdown formatting)
            const cleanText = this.cleanTextForTTS(text);
            
            if (cleanText.length > 2500) {
                return {
                    success: false,
                    error: 'Text too long for TTS conversion'
                };
            }

            // Generate unique filename
            const timestamp = Date.now();
            const fileName = `tts_${userPhone}_${timestamp}.mp3`;
            const audioPath = path.join(this.tempDir, fileName);

            // Prepare API request
            const url = `${this.baseURL}/text-to-speech/${this.voiceId}`;
            const payload = {
                text: cleanText,
                model_id: this.model,
                language_id: this.languageId, // Indonesian language code for better pronunciation
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                    style: 0.0,
                    use_speaker_boost: true
                }
            };

            const headers = {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': this.apiKey
            };

            this.logger.info(`Converting text to speech for user ${userPhone}, length: ${cleanText.length} chars`);

            // Make request to ElevenLabs
            const response = await axios.post(url, payload, {
                headers: headers,
                responseType: 'stream',
                timeout: 30000
            });

            // Save audio to file
            const writer = fs.createWriteStream(audioPath);
            response.data.pipe(writer);

            return new Promise((resolve) => {
                writer.on('finish', () => {
                    this.logger.info(`TTS audio saved: ${audioPath}`);
                    resolve({
                        success: true,
                        audioPath: audioPath
                    });
                });

                writer.on('error', (error) => {
                    this.logger.error('Error writing TTS audio file:', error);
                    resolve({
                        success: false,
                        error: 'Failed to save audio file'
                    });
                });
            });

        } catch (error) {
            this.logger.error('Error generating TTS:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.detail || error.message || 'Failed to generate speech'
            };
        }
    }

    /**
     * Clean text for TTS conversion (remove markdown, emojis, etc.)
     * @param {string} text - Original text
     * @returns {string} - Cleaned text
     */
    cleanTextForTTS(text) {
        return text
            // Remove markdown formatting
            .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
            .replace(/\*(.*?)\*/g, '$1') // Italic
            .replace(/_(.*?)_/g, '$1') // Underline
            .replace(/`(.*?)`/g, '$1') // Code
            .replace(/#{1,6}\s/g, '') // Headers
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
            
            // Remove emojis and special characters for better pronunciation
            // Use Unicode ranges and specific characters instead of problematic ranges
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
            .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Regional indicator
            .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
            .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
            .replace(/💰|💸|💵|💴|💶|💷|💳|💎/g, '') // Money emojis
            .replace(/✨|🌸|🤗|💙/g, '') // Decorative emojis
            .replace(/❌|✅|💭|🚪|🔄|💡|👋/g, '') // Symbol emojis
            
            // Clean up multiple spaces and newlines
            .replace(/\n+/g, '. ') // Replace newlines with periods
            .replace(/\s+/g, ' ') // Multiple spaces to single space
            .replace(/\.\s*\./g, '.') // Multiple periods
            
            // Trim and return
            .trim();
    }

    /**
     * Clean up old audio files to save disk space
     * @param {number} maxAgeMinutes - Maximum age of files in minutes (default: 60)
     */
    async cleanupOldAudioFiles(maxAgeMinutes = 60) {
        try {
            const files = fs.readdirSync(this.tempDir);
            const now = Date.now();
            let deletedCount = 0;

            for (const file of files) {
                if (file.startsWith('tts_') && file.endsWith('.mp3')) {
                    const filePath = path.join(this.tempDir, file);
                    const stats = fs.statSync(filePath);
                    const ageMinutes = (now - stats.mtime.getTime()) / (1000 * 60);

                    if (ageMinutes > maxAgeMinutes) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            }

            if (deletedCount > 0) {
                this.logger.info(`Cleaned up ${deletedCount} old TTS audio files`);
            }

        } catch (error) {
            this.logger.warn('Error cleaning up TTS audio files:', error.message);
        }
    }

    /**
     * Check if user's message requests voice response with dynamic detection
     * @param {string} message - User message
     * @returns {boolean} - True if voice response is requested
     */
    isVoiceRequested(message) {
        const lowerMessage = message.toLowerCase();
        
        // Primary voice request keywords (high confidence)
        const primaryKeywords = [
            'balas dengan suara',
            'bales dengan suara',
            'bales pake suara',
            'pakai suara',
            'pake suara',
            'gunakan suara',
            'dengan voice',
            'pakai voice',
            'pake voice',
            'suarakan',
            'ceritakan dengan suara',
            'jelasin pake suara',
            'jelasin dengan suara',
            'nyanyiin',
            'nyanyi',
            'bicarakan dengan suara',
            'jawab pake suara',
            'jawab dengan suara',
            'bisa pake suara',
            'bisa dengan suara',
            'minta suara',
            'mau suara'
        ];
        
        // Secondary keywords (medium confidence, need context)
        const secondaryKeywords = [
            'voice note',
            'voice message',
            'pesan suara',
            'audio',
            'rekam',
            'recording',
            'tts'
        ];
        
        // Contextual phrases that suggest voice request
        const contextualPhrases = [
            'dengar suara',
            'mau dengar',
            'pingin dengar',
            'pengen dengar',
            'biar kedengeran',
            'suara kamu',
            'gimana suara',
            'seperti apa suara',
            'kirim suara',
            'send voice',
            'voice dong',
            'suara dong',
            'audio dong'
        ];
        
        // Emotional contexts that work well with voice
        const emotionalContexts = [
            'sedih',
            'senang',
            'bahagia',
            'kecewa',
            'marah',
            'takut',
            'gugup',
            'excited',
            'semangat',
            'galau',
            'bingung',
            'stress',
            'lelah',
            'capek'
        ];
        
        // Check primary keywords (direct match)
        if (primaryKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return true;
        }
        
        // Check secondary keywords with emotional context
        const hasSecondaryKeyword = secondaryKeywords.some(keyword => lowerMessage.includes(keyword));
        const hasEmotionalContext = emotionalContexts.some(emotion => lowerMessage.includes(emotion));
        
        if (hasSecondaryKeyword && hasEmotionalContext) {
            return true;
        }
        
        // Check contextual phrases
        if (contextualPhrases.some(phrase => lowerMessage.includes(phrase))) {
            return true;
        }
        
        // Advanced pattern matching for natural requests
        const naturalPatterns = [
            /bisa.*suara/,
            /minta.*suara/,
            /tolong.*suara/,
            /coba.*suara/,
            /pake.*audio/,
            /dengan.*audio/,
            /kirim.*suara/,
            /send.*voice/,
            /voice.*dong/,
            /suara.*dong/,
            /audio.*nya/,
            /suara.*nya/,
            /voice.*nya/,
            /.*suara.*ya$/,
            /.*voice.*ya$/,
            /.*audio.*ya$/,
            /.*suara.*aja$/,
            /.*voice.*aja$/,
            /suara.*gak$/,
            /voice.*gak$/,
            /suara.*tidak$/,
            /gimana.*kalau.*suara/,
            /bagaimana.*kalau.*suara/
        ];
        
        return naturalPatterns.some(pattern => pattern.test(lowerMessage));
    }

    /**
     * Get available voices from ElevenLabs
     * @returns {Promise<Array>} - Array of available voices
     */
    async getAvailableVoices() {
        if (!this.isEnabled) {
            return [];
        }

        try {
            const response = await axios.get(`${this.baseURL}/voices`, {
                headers: {
                    'xi-api-key': this.apiKey
                },
                timeout: 10000
            });

            return response.data.voices || [];

        } catch (error) {
            this.logger.error('Error fetching voices:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Get service status
     * @returns {Object} - Service status
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            hasApiKey: !!this.apiKey,
            voiceId: this.voiceId,
            model: this.model,
            languageId: this.languageId,
            tempDir: this.tempDir
        };
    }
}

module.exports = TTSService;