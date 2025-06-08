const axios = require('axios');
const Logger = require('../utils/Logger');
const AmountParser = require('../utils/AmountParser');

class AIService {
    constructor() {
        this.logger = new Logger();
        this.amountParser = new AmountParser();
        this.isEnabled = process.env.ENABLE_AI_FEATURES === 'true';
        
        // Initialize AI provider configuration
        this.initializeProvider();
        
        // Initialize fallback providers
        this.initializeFallbackProviders();
        
        // Track current provider and rate limit status
        this.currentProviderIndex = 0;
        this.rateLimitedProviders = new Set();
        this.lastRateLimitReset = Date.now();
    }

    initializeProvider() {
        // Get provider type from environment
        this.provider = process.env.AI_PROVIDER || 'deepseek';
        
        switch (this.provider.toLowerCase()) {
            case 'deepseek':
                this.apiKey = process.env.DEEPSEEK_API_KEY;
                this.baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
                this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
                break;
                
            case 'openai':
                this.apiKey = process.env.OPENAI_API_KEY;
                this.baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com';
                this.model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
                break;
                
            case 'openrouter':
                this.apiKey = process.env.OPENROUTER_API_KEY;
                this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api';
                this.model = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
                break;
                
            case 'openaicompatible':
            case 'openai-compatible':
                this.apiKey = process.env.OPENAI_COMPATIBLE_API_KEY;
                this.baseURL = process.env.OPENAI_COMPATIBLE_BASE_URL;
                this.model = process.env.OPENAI_COMPATIBLE_MODEL || 'gpt-3.5-turbo';
                
                if (!this.baseURL) {
                    this.logger.error('OPENAI_COMPATIBLE_BASE_URL must be set when using openaicompatible provider');
                    this.isEnabled = false;
                    return;
                }
                break;
                
            default:
                this.logger.error(`Unknown AI provider: ${this.provider}. Supported providers: deepseek, openai, openrouter, openaicompatible`);
                this.isEnabled = false;
                return;
        }
        
        // Validate configuration
        if (!this.apiKey && this.isEnabled) {
            this.logger.warn(`${this.provider.toUpperCase()} API key not provided. AI features will be disabled.`);
            this.isEnabled = false;
        }
        
        if (this.isEnabled) {
            this.logger.info(`AI Service initialized with provider: ${this.provider}`);
            this.logger.info(`Base URL: ${this.baseURL}`);
            this.logger.info(`Model: ${this.model}`);
        }
    }

    initializeFallbackProviders() {
        this.fallbackProviders = [];
        
        // If primary is openaicompatible, check for multiple API keys
        if (this.provider === 'openaicompatible' && this.apiKey) {
            const apiKeys = this.apiKey.split(',').map(key => key.trim()).filter(key => key);
            
            // Create providers for each API key
            apiKeys.forEach((key, index) => {
                this.fallbackProviders.push({
                    name: `openaicompatible-${index + 1}`,
                    provider: 'openaicompatible',
                    apiKey: key,
                    baseURL: this.baseURL,
                    model: this.model,
                    priority: index + 1
                });
            });
        }
        
        // Get fallback order from environment variable
        const fallbackOrder = process.env.AI_FALLBACK_ORDER || 'openrouter,deepseek,openai,groq';
        const orderedProviders = fallbackOrder.split(',').map(p => p.trim().toLowerCase());
        
        // Initialize fallback providers based on configured order
        orderedProviders.forEach((providerName, index) => {
            const basePriority = 100 + (index * 10); // Start at 100, increment by 10
            
            switch (providerName) {
                case 'deepseek':
                    if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== this.apiKey) {
                        this.fallbackProviders.push({
                            name: 'deepseek-fallback',
                            provider: 'deepseek',
                            apiKey: process.env.DEEPSEEK_API_KEY,
                            baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
                            model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
                            priority: basePriority
                        });
                    }
                    break;
                    
                case 'openrouter':
                    if (process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== this.apiKey) {
                        this.fallbackProviders.push({
                            name: 'openrouter-fallback',
                            provider: 'openrouter',
                            apiKey: process.env.OPENROUTER_API_KEY,
                            baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api',
                            model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
                            priority: basePriority
                        });
                    }
                    break;
                    
                case 'openai':
                    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== this.apiKey) {
                        this.fallbackProviders.push({
                            name: 'openai-fallback',
                            provider: 'openai',
                            apiKey: process.env.OPENAI_API_KEY,
                            baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
                            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
                            priority: basePriority
                        });
                    }
                    break;
                    
                case 'groq':
                    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== this.apiKey) {
                        this.fallbackProviders.push({
                            name: 'groq-fallback',
                            provider: 'openaicompatible', // Groq uses OpenAI compatible API
                            apiKey: process.env.GROQ_API_KEY,
                            baseURL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai',
                            model: process.env.GROQ_MODEL || 'llama3-8b-8192',
                            priority: basePriority
                        });
                    }
                    break;
                    
                default:
                    this.logger.warn(`Unknown fallback provider in AI_FALLBACK_ORDER: ${providerName}`);
                    break;
            }
        });
        
        // Sort by priority
        this.fallbackProviders.sort((a, b) => a.priority - b.priority);
        
        if (this.fallbackProviders.length > 0) {
            this.logger.info(`Initialized ${this.fallbackProviders.length} fallback AI providers (ordered):`,
                this.fallbackProviders.map(p => `${p.name} (${p.provider}, priority: ${p.priority})`));
            this.logger.info(`Fallback order: ${orderedProviders.join(' → ')}`);
        }
    }

    async makeRequest(messages, temperature = 0.7, maxTokens = 1000) {
        if (!this.isEnabled) {
            throw new Error('Fitur AI tidak aktif');
        }

        // Reset rate limited providers periodically (every 10 minutes)
        if (Date.now() - this.lastRateLimitReset > 10 * 60 * 1000) {
            this.rateLimitedProviders.clear();
            this.lastRateLimitReset = Date.now();
            this.logger.info('Reset rate limited providers - retrying all providers');
        }

        // Try primary provider first
        try {
            return await this.makeRequestWithProvider({
                name: `${this.provider}-primary`,
                provider: this.provider,
                apiKey: this.apiKey,
                baseURL: this.baseURL,
                model: this.model
            }, messages, temperature, maxTokens);
        } catch (error) {
            // If primary provider hits rate limit, try fallbacks
            if (this.isRateLimitError(error)) {
                this.logger.warn(`Primary provider ${this.provider} hit rate limit, trying fallbacks...`);
                this.rateLimitedProviders.add(`${this.provider}-primary`);
                
                // Try fallback providers
                for (const provider of this.fallbackProviders) {
                    if (this.rateLimitedProviders.has(provider.name)) {
                        continue; // Skip rate limited providers
                    }
                    
                    try {
                        this.logger.info(`Trying fallback provider: ${provider.name}`);
                        const result = await this.makeRequestWithProvider(provider, messages, temperature, maxTokens);
                        this.logger.info(`✅ Successfully used fallback provider: ${provider.name}`);
                        return result;
                    } catch (fallbackError) {
                        if (this.isRateLimitError(fallbackError)) {
                            this.logger.warn(`Fallback provider ${provider.name} also hit rate limit`);
                            this.rateLimitedProviders.add(provider.name);
                        } else {
                            this.logger.warn(`Fallback provider ${provider.name} failed:`, fallbackError.message);
                        }
                    }
                }
                
                // All providers are rate limited or failed
                this.logger.error('All AI providers are rate limited or unavailable');
                throw new Error('RATE_LIMITED_ALL_PROVIDERS');
            }
            
            // Non-rate-limit error, rethrow
            throw error;
        }
    }

    async makeRequestWithProvider(providerConfig, messages, temperature, maxTokens) {
        // Prepare request payload
        const payload = {
            model: providerConfig.model,
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            stream: false
        };

        // Prepare headers
        const headers = {
            'Authorization': `Bearer ${providerConfig.apiKey}`,
            'Content-Type': 'application/json'
        };

        // Make API request
        const response = await axios.post(`${providerConfig.baseURL}/v1/chat/completions`, payload, {
            headers: headers,
            timeout: 30000
        });

        // Extract response
        if (!response.data || !response.data.choices || !response.data.choices[0]) {
            throw new Error('Invalid response format from AI provider');
        }

        return response.data.choices[0].message.content;
    }

    isRateLimitError(error) {
        if (error.response?.status === 429) return true;
        if (error.message && error.message.toLowerCase().includes('rate limit')) return true;
        if (error.response?.data && JSON.stringify(error.response.data).toLowerCase().includes('rate limit')) return true;
        return false;
    }

    getProviderInfo() {
        return {
            provider: this.provider,
            baseURL: this.baseURL,
            model: this.model,
            isEnabled: this.isEnabled
        };
    }

    async listAvailableModels() {
        if (!this.isEnabled) {
            throw new Error('Fitur AI tidak aktif');
        }

        try {
            // Try to get models list from /v1/models endpoint
            const response = await axios.get(`${this.baseURL}/v1/models`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && response.data.data) {
                return {
                    success: true,
                    models: response.data.data.map(model => ({
                        id: model.id,
                        name: model.id,
                        created: model.created || null,
                        owned_by: model.owned_by || 'unknown'
                    })),
                    provider: this.provider,
                    baseURL: this.baseURL
                };
            } else {
                throw new Error('Invalid response format');
            }

        } catch (error) {
            this.logger.error(`Error listing models for ${this.provider}:`, error.response?.data || error.message);
            
            // Return common models based on provider type if API call fails
            return this.getFallbackModels(error);
        }
    }

    getFallbackModels(error) {
        const fallbackModels = {
            deepseek: [
                { id: 'deepseek-chat', name: 'DeepSeek Chat', owned_by: 'deepseek' },
                { id: 'deepseek-coder', name: 'DeepSeek Coder', owned_by: 'deepseek' }
            ],
            openai: [
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', owned_by: 'openai' },
                { id: 'gpt-3.5-turbo-16k', name: 'GPT-3.5 Turbo 16K', owned_by: 'openai' },
                { id: 'gpt-4', name: 'GPT-4', owned_by: 'openai' },
                { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', owned_by: 'openai' }
            ],
            openrouter: [
                { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo (OpenRouter)', owned_by: 'openai' },
                { id: 'openai/gpt-4', name: 'GPT-4 (OpenRouter)', owned_by: 'openai' },
                { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', owned_by: 'anthropic' },
                { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B Instruct', owned_by: 'meta' },
                { id: 'mistralai/mixtral-8x7b-instruct', name: 'Mixtral 8x7B Instruct', owned_by: 'mistralai' }
            ],
            groq: [
                { id: 'llama3-8b-8192', name: 'Llama 3 8B', owned_by: 'meta' },
                { id: 'llama3-70b-8192', name: 'Llama 3 70B', owned_by: 'meta' },
                { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', owned_by: 'mistralai' },
                { id: 'gemma-7b-it', name: 'Gemma 7B IT', owned_by: 'google' }
            ]
        };

        // Detect provider type from base URL if provider is openaicompatible
        let providerKey = this.provider;
        if (this.provider === 'openaicompatible') {
            if (this.baseURL.includes('groq.com')) {
                providerKey = 'groq';
            } else if (this.baseURL.includes('deepseek.com')) {
                providerKey = 'deepseek';
            } else if (this.baseURL.includes('openai.com')) {
                providerKey = 'openai';
            } else if (this.baseURL.includes('openrouter.ai')) {
                providerKey = 'openrouter';
            }
        }

        return {
            success: false,
            models: fallbackModels[providerKey] || [
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo (fallback)', owned_by: 'unknown' }
            ],
            provider: this.provider,
            baseURL: this.baseURL,
            error: error.message,
            note: 'Models list from API failed, showing common models for this provider type'
        };
    }

    async testModel(modelName) {
        if (!this.isEnabled) {
            throw new Error('Fitur AI tidak aktif');
        }

        const originalModel = this.model;
        
        try {
            // Temporarily set the model to test
            this.model = modelName;
            
            // Test with a simple request
            const testResponse = await this.makeRequest([
                { role: 'user', content: 'Hi, please respond with just "OK" to test this model.' }
            ], 0.1, 10);

            return {
                success: true,
                model: modelName,
                response: testResponse,
                provider: this.provider
            };

        } catch (error) {
            return {
                success: false,
                model: modelName,
                error: error.message,
                provider: this.provider
            };
        } finally {
            // Restore original model
            this.model = originalModel;
        }
    }

    async parseNaturalLanguageTransaction(text, userPhone, indonesianAI = null) {
        const systemPrompt = `Kamu adalah parser transaksi keuangan yang ahli untuk pengguna Indonesia. Analisis input dalam bahasa Indonesia dan ekstrak detail transaksi dengan akurat.

RULES PARSING AMOUNT (SANGAT PENTING):
- "10K" = 10.000 (sepuluh ribu)
- "10k" = 10.000 (sepuluh ribu)
- "50K" = 50.000 (lima puluh ribu)
- "100K" = 100.000 (seratus ribu)
- "1jt" = 1.000.000 (satu juta)
- "1.5jt" = 1.500.000 (satu setengah juta)
- "2,5juta" = 2.500.000 (dua setengah juta)
- "15rb" = 15.000 (lima belas ribu)
- "25ribu" = 25.000 (dua puluh lima ribu)
- Untuk angka tanpa suffix: gunakan nilai asli (contoh: "10000" = 10.000)

JANGAN MENGALIKAN AMOUNT YANG SUDAH BENAR!

Kembalikan HANYA objek JSON dengan field berikut:
- type: "income" atau "expense"
- amount: number (tanpa simbol mata uang, PASTIKAN KONVERSI BENAR)
- description: string (dalam bahasa Indonesia, bersih tanpa kata kerja)
- category: string (kategori yang sesuai dalam bahasa Indonesia, atau "unknown" jika tidak yakin)
- confidence: number (0-1, seberapa yakin dalam parsing)
- amountDetails: string (jelaskan konversi amount untuk verifikasi)

Contoh BENAR:
"Saya habis 50K untuk makan siang" -> {"type":"expense","amount":50000,"description":"makan siang","category":"Makanan","confidence":0.9,"amountDetails":"50K = 50.000"}
"Terima 500rb dari bayaran klien" -> {"type":"income","amount":500000,"description":"bayaran klien","category":"Freelance","confidence":0.9,"amountDetails":"500rb = 500.000"}
"Beli bensin 100K" -> {"type":"expense","amount":100000,"description":"bensin","category":"Transportasi","confidence":0.9,"amountDetails":"100K = 100.000"}
"Habis jajan 10K" -> {"type":"expense","amount":10000,"description":"jajan","category":"Makanan","confidence":0.9,"amountDetails":"10K = 10.000"}
"Dapat uang 1.5jt" -> {"type":"income","amount":1500000,"description":"dapat uang","category":"Pemasukan Lain","confidence":0.8,"amountDetails":"1.5jt = 1.500.000"}

Untuk description, hapus kata kerja seperti "habis", "beli", "bayar", "dapat", "terima", "spent", "bought", "paid".
Fokus pada objek/item/layanan yang dibeli/diterima.

Input pengguna: "${text}"`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ], 0.3, 300);

            // Try to parse JSON response
            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            const parsedResult = JSON.parse(cleanResponse);
            
            // Validate amount using AmountParser
            if (parsedResult.amount) {
                const validation = this.amountParser.validateAmount(parsedResult.amount, 'transaction');
                if (!validation.valid) {
                    this.logger.warn(`AI parsed amount validation failed: ${validation.reason}. Amount: ${parsedResult.amount}`);
                    // Try to re-parse amount from original text
                    const amountParseResult = this.amountParser.parseAmount(text);
                    if (amountParseResult.success && amountParseResult.confidence >= 0.7) {
                        this.logger.info(`Using AmountParser fallback: ${amountParseResult.amount} (${amountParseResult.details})`);
                        parsedResult.amount = amountParseResult.amount;
                        parsedResult.amountDetails = amountParseResult.details;
                        parsedResult.confidence = Math.min(parsedResult.confidence || 0.8, amountParseResult.confidence);
                    }
                }
            }
            
            // Apply title case formatting to description if indonesianAI is provided
            if (indonesianAI && parsedResult.description) {
                parsedResult.description = indonesianAI.cleanTransactionDescription(parsedResult.description);
            }
            
            return parsedResult;
        } catch (error) {
            this.logger.error('Error parsing natural language transaction:', error);
            return null;
        }
    }

    async categorizeTransaction(description, amount, type) {
        const systemPrompt = `Kamu adalah ahli kategorisasi keuangan untuk pengguna Indonesia. Berdasarkan deskripsi, jumlah, dan jenis transaksi, sarankan kategori yang paling sesuai.

Kategori yang tersedia untuk pengeluaran: Makanan, Transportasi, Utilitas, Hiburan, Kesehatan, Belanja, Pengeluaran Bisnis, Pengeluaran Lain
Kategori yang tersedia untuk pemasukan: Gaji, Freelance, Bisnis, Investasi, Pemasukan Lain

Jika kamu tidak yakin 100% dengan kategori yang tepat, kembalikan "unknown".
Jika yakin, kembalikan HANYA nama kategori yang paling sesuai.

Transaksi: ${type === 'income' ? 'pemasukan' : 'pengeluaran'} sebesar ${amount} untuk "${description}"`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Kategorikan transaksi ini: ${description}` }
            ], 0.3, 50);

            const category = response.trim();
            
            // Jika AI tidak yakin atau mengembalikan "unknown", kembalikan unknown
            if (category.toLowerCase().includes('unknown') ||
                category.toLowerCase().includes('tidak yakin') ||
                category.toLowerCase().includes('unsure')) {
                return 'unknown';
            }

            return category;
        } catch (error) {
            this.logger.error('Error categorizing transaction:', error);
            return 'unknown';
        }
    }

    async generateFinancialAnalysis(financialData) {
        const { balance, transactions, monthlyTrends, categories } = financialData;

        const systemPrompt = `Kamu adalah AI penasihat keuangan personal yang sangat ahli dan berpengalaman. Analisis data keuangan dengan mendalam dan berikan wawasan yang actionable dalam bahasa Indonesia.

Sebagai AI Financial Advisor yang ahli, lakukan analisis mendalam pada:

📊 ANALISIS UTAMA:
1. Kesehatan keuangan secara keseluruhan (skor 1-10)
2. Pola dan tren pengeluaran (identifikasi anomali dan pola berulang)
3. Rasio pemasukan vs pengeluaran dan stabilitas cash flow
4. Analisis per kategori dengan identifikasi kategori yang bermasalah
5. Prediksi keuangan jangka pendek (1-3 bulan)
6. Risk assessment dan early warning signs

🎯 REKOMENDASI SPESIFIK:
1. Action items yang dapat ditindaklanjuti segera
2. Target penghematan realistis dengan timeline
3. Strategi optimasi untuk setiap kategori bermasalah
4. Tips praktis sesuai kondisi keuangan user
5. Emergency fund planning
6. Investment readiness assessment

📈 FORMAT RESPONS:
- Gunakan emoji untuk visual appeal
- Struktur dengan heading yang jelas
- Berikan angka spesifik dan persentase
- Sertakan timeline yang realistic
- Tone yang encouraging namun honest
- Gunakan format Rupiah Indonesia (IDR)`;

        const userPrompt = `DATA KEUANGAN USER:
💰 Saldo Saat Ini: Rp ${balance.balance?.toLocaleString('id-ID') || 0}
📈 Total Pemasukan: Rp ${balance.income?.toLocaleString('id-ID') || 0}
📉 Total Pengeluaran: Rp ${balance.expenses?.toLocaleString('id-ID') || 0}
📋 Jumlah Transaksi: ${transactions.length}
⚖️ Net Cash Flow: Rp ${((balance.income || 0) - (balance.expenses || 0)).toLocaleString('id-ID')}

📊 Tren Bulanan:
${monthlyTrends ? JSON.stringify(monthlyTrends, null, 2) : 'Data tidak tersedia'}

🏷️ Breakdown Kategori:
${categories ? JSON.stringify(categories, null, 2) : 'Data tidak tersedia'}

Berikan analisis komprehensif dengan rekomendasi spesifik dan actionable untuk memperbaiki kondisi keuangan user.`;

        try {
            const response = await this.makeRequestWithFallback([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], this.generateFallbackFinancialAnalysis.bind(this), userPrompt, 0.7, 1500);

            return response;
        } catch (error) {
            this.logger.error('Error generating financial analysis:', error);
            
            // If all providers are rate limited, use fallback
            if (error.message === 'RATE_LIMITED' || error.message === 'RATE_LIMITED_ALL_PROVIDERS') {
                return this.generateFallbackFinancialAnalysis(userPrompt);
            }
            
            return 'Maaf, saya tidak dapat membuat analisis keuangan saat ini. Silakan coba lagi nanti.';
        }
    }

    async generateFinancialAdvice(query, userContext) {
        const systemPrompt = `Kamu adalah asisten AI penasihat keuangan pribadi. Berikan saran keuangan yang membantu dan praktis dalam bahasa Indonesia berdasarkan pertanyaan pengguna dan konteks keuangan mereka.

Konteks Keuangan Pengguna:
- Saldo Saat Ini: ${userContext.balance}
- Rata-rata Pemasukan Bulanan: ${userContext.monthlyIncome}
- Rata-rata Pengeluaran Bulanan: ${userContext.monthlyExpenses}
- Kategori Pengeluaran Teratas: ${userContext.topExpenseCategories?.join(', ')}

Berikan saran yang:
1. Praktis dan dapat ditindaklanjuti
2. Disesuaikan dengan situasi keuangan mereka
3. Ditulis dengan nada yang ramah dan mendorong
4. Menyertakan tips spesifik bila memungkinkan
5. Menggunakan Rupiah Indonesia (IDR) untuk referensi mata uang

Berikan respons yang ringkas namun berharga.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ], 0.7, 1000);

            return response;
        } catch (error) {
            this.logger.error('Error generating financial advice:', error);
            return 'Maaf, saya tidak dapat memberikan saran keuangan saat ini. Silakan coba lagi nanti.';
        }
    }

    async predictCashFlow(transactionHistory, timeframe = 'month') {
        const systemPrompt = `Kamu adalah AI Data Scientist keuangan yang ahli dalam prediksi cash flow. Analisis pola historis dan buat prediksi akurat untuk ${timeframe} berikutnya dalam bahasa Indonesia.

ANALISIS YANG HARUS DILAKUKAN:
🔍 PATTERN RECOGNITION:
1. Identifikasi pola musiman dan cyclical trends
2. Deteksi transaksi rutin vs one-time expenses
3. Analisis volatilitas income dan expenses
4. Identifikasi growth trends atau declining patterns

📊 STATISTICAL ANALYSIS:
1. Calculate moving averages untuk income/expenses
2. Identify outliers dan anomalies
3. Seasonal adjustment factors
4. Variance analysis dan standard deviation

🎯 PREDICTION MODEL:
1. Prediksi pemasukan ${timeframe} depan dengan confidence interval
2. Prediksi pengeluaran ${timeframe} depan dengan breakdown kategori
3. Net cash flow prediction dengan scenario analysis (best/worst/realistic case)
4. Probability assessment untuk different outcomes
5. Risk factors dan mitigation strategies

📈 ADVANCED INSIGHTS:
1. Early warning indicators
2. Trend acceleration/deceleration signals
3. Seasonal adjustment recommendations
4. Cash flow optimization opportunities

Format respons dengan:
- Angka spesifik dengan confidence level
- Visual indicators (emoji/symbols)
- Actionable recommendations
- Risk assessment matrix
- Timeline yang jelas`;

        // Enhanced transaction history formatting with more context
        const historyText = transactionHistory.map((t, index) => {
            const date = new Date(t.date).toLocaleDateString('id-ID');
            const amount = typeof t.amount === 'number' ? t.amount.toLocaleString('id-ID') : t.amount;
            return `${index + 1}. [${date}] ${t.type.toUpperCase()}: Rp ${amount} - ${t.description} ${t.category ? `(${t.category})` : ''}`;
        }).join('\n');

        // Add statistical summary for better context
        const totalTransactions = transactionHistory.length;
        const incomeTransactions = transactionHistory.filter(t => t.type === 'income');
        const expenseTransactions = transactionHistory.filter(t => t.type === 'expense');
        
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0);
        const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (typeof t.amount === 'number' ? t.amount : 0), 0);
        const avgIncome = incomeTransactions.length > 0 ? totalIncome / incomeTransactions.length : 0;
        const avgExpense = expenseTransactions.length > 0 ? totalExpenses / expenseTransactions.length : 0;

        const statisticalSummary = `
📊 STATISTICAL SUMMARY:
- Total Transaksi: ${totalTransactions}
- Transaksi Income: ${incomeTransactions.length}
- Transaksi Expense: ${expenseTransactions.length}
- Total Income: Rp ${totalIncome.toLocaleString('id-ID')}
- Total Expenses: Rp ${totalExpenses.toLocaleString('id-ID')}
- Rata-rata Income: Rp ${avgIncome.toLocaleString('id-ID')}
- Rata-rata Expense: Rp ${avgExpense.toLocaleString('id-ID')}
- Net Cash Flow: Rp ${(totalIncome - totalExpenses).toLocaleString('id-ID')}`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `${statisticalSummary}\n\n📋 TRANSACTION HISTORY:\n${historyText}\n\n🔮 TASK: Buat prediksi cash flow yang akurat dan komprehensif untuk ${timeframe} berikutnya berdasarkan data historis di atas.` }
            ], 0.6, 1500);

            return response;
        } catch (error) {
            this.logger.error('Error predicting cash flow:', error);
            return 'Maaf, saya tidak dapat membuat prediksi arus kas saat ini. Silakan coba lagi nanti.';
        }
    }

    async generateSummaryReport(period, data) {
        const systemPrompt = `Kamu adalah AI pelaporan keuangan. Buat laporan ringkasan keuangan ${period} yang komprehensif dalam bahasa Indonesia.

Sertakan:
1. Ringkasan Eksekutif dengan poin-poin penting
2. Rincian Pemasukan dan Pengeluaran
3. Tren atau perubahan yang patut dicatat
4. Analisis kategori
5. Rekomendasi untuk ${period} berikutnya

Gunakan emoji dan format yang jelas. Jadilah profesional namun mudah didekati.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Generate ${period} report for this data: ${JSON.stringify(data)}` }
            ], 0.6, 1500);

            return response;
        } catch (error) {
            this.logger.error('Error generating summary report:', error);
            return `Maaf, saya tidak dapat membuat laporan ringkasan ${period} saat ini. Silakan coba lagi nanti.`;
        }
    }

    async extractReceiptData(ocrText) {
        const systemPrompt = `Kamu adalah parser struk OCR. Ekstrak detail transaksi keuangan dari teks OCR sebuah struk.

Kembalikan HANYA objek JSON dengan:
- amount: number (jumlah total)
- merchant: string (nama toko/bisnis)
- date: string (format YYYY-MM-DD, hari ini jika tidak ditemukan)
- items: array barang yang dibeli (jika dapat diidentifikasi)
- category: string (kategori yang disarankan)
- confidence: number (0-1)

Jika tidak dapat memparse struk dengan benar, kembalikan {"confidence": 0}`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Parse this receipt text: ${ocrText}` }
            ], 0.3, 500);

            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            return JSON.parse(cleanResponse);
        } catch (error) {
            this.logger.error('Error extracting receipt data:', error);
            return { confidence: 0 };
        }
    }

    async answerFinancialQuestion(question, userContext) {
        const systemPrompt = `Kamu adalah asisten keuangan yang berpengetahuan luas. Jawab pertanyaan keuangan pengguna dalam bahasa Indonesia menggunakan konteks mereka dan pengetahuan keuangan umum.

Konteks Pengguna:
${JSON.stringify(userContext, null, 2)}

Berikan jawaban yang akurat dan membantu yang:
1. Relevan dengan situasi mereka
2. Mudah dipahami
3. Dapat ditindaklanjuti bila sesuai
4. Jujur tentang keterbatasan

Gunakan Rupiah Indonesia (IDR) untuk referensi mata uang bila berlaku.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question }
            ], 0.7, 1000);

            return response;
        } catch (error) {
            this.logger.error('Error answering financial question:', error);
            return 'Maaf, saya tidak dapat menjawab pertanyaan Anda saat ini. Silakan coba lagi nanti atau hubungi dukungan.';
        }
    }

    async parseEditInstructions(editText, currentTransaction, userPhone) {
        const systemPrompt = `Kamu adalah parser instruksi edit transaksi keuangan. Analisis instruksi edit dalam bahasa Indonesia dan tentukan perubahan yang perlu dibuat.

Transaksi saat ini:
- ID: ${currentTransaction.id}
- Jenis: ${currentTransaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
- Jumlah: ${currentTransaction.amount}
- Deskripsi: ${currentTransaction.description}
- Kategori: ${currentTransaction.category_name}
- Tanggal: ${currentTransaction.date}

Kembalikan HANYA objek JSON dengan format:
{
  "updates": {
    "amount": number (jika diubah),
    "description": string (jika diubah),
    "categoryName": string (jika diubah - nama kategori yang sesuai),
    "date": string (jika diubah - format YYYY-MM-DD)
  },
  "summary": string (ringkasan perubahan yang dibuat),
  "confidence": number (0-1, seberapa yakin dalam parsing)
}

Contoh:
"ubah jumlah jadi 100000" -> {"updates":{"amount":100000},"summary":"Jumlah diubah menjadi Rp 100.000","confidence":0.9}
"ganti deskripsi jadi makan malam" -> {"updates":{"description":"makan malam"},"summary":"Deskripsi diubah menjadi 'makan malam'","confidence":0.9}
"ubah kategori ke makanan" -> {"updates":{"categoryName":"Makanan"},"summary":"Kategori diubah ke Makanan","confidence":0.8}

Jika tidak yakin dengan instruksi, berikan confidence rendah.

Instruksi edit: "${editText}"`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: editText }
            ], 0.3, 500);

            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            const parsed = JSON.parse(cleanResponse);
            
            // Validate the response structure
            if (!parsed.updates || !parsed.summary || parsed.confidence === undefined) {
                throw new Error('Invalid response structure');
            }

            return parsed;
        } catch (error) {
            this.logger.error('Error parsing edit instructions:', error);
            return {
                updates: {},
                summary: "Tidak dapat memahami instruksi edit",
                confidence: 0
            };
        }
    }

    async parseNaturalEdit(editText, userPhone) {
        const systemPrompt = `Kamu adalah parser instruksi edit transaksi dalam bahasa natural. Analisis teks dan tentukan apakah ini adalah instruksi edit transaksi.

Kembalikan HANYA objek JSON dengan format:
{
  "needsTransactionId": boolean (true jika perlu ID transaksi),
  "transactionId": number (jika ID disebutkan secara eksplisit),
  "updates": {
    "amount": number (jika diubah),
    "description": string (jika diubah),
    "categoryName": string (jika diubah),
    "date": string (jika diubah - format YYYY-MM-DD)
  },
  "summary": string (ringkasan perubahan yang diminta),
  "confidence": number (0-1, seberapa yakin ini adalah instruksi edit)
}

Contoh:
"edit transaksi id 123 ubah jumlah jadi 50000" -> {"needsTransactionId":false,"transactionId":123,"updates":{"amount":50000},"summary":"Ubah jumlah transaksi ID 123 menjadi Rp 50.000","confidence":0.9}
"ubah transaksi terakhir jadi 100000" -> {"needsTransactionId":true,"updates":{"amount":100000},"summary":"Ubah jumlah transaksi menjadi Rp 100.000","confidence":0.8}
"ganti deskripsi transaksi jadi makan malam" -> {"needsTransactionId":true,"updates":{"description":"makan malam"},"summary":"Ubah deskripsi menjadi 'makan malam'","confidence":0.8}

Jika bukan instruksi edit atau confidence rendah, return confidence < 0.6.

Teks: "${editText}"`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: editText }
            ], 0.3, 400);

            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            const parsed = JSON.parse(cleanResponse);
            
            // Validate the response structure
            if (parsed.confidence === undefined || !parsed.updates) {
                throw new Error('Invalid response structure');
            }

            return parsed;
        } catch (error) {
            this.logger.error('Error parsing natural edit:', error);
            return {
                needsTransactionId: false,
                updates: {},
                summary: "Tidak dapat memahami instruksi",
                confidence: 0
            };
        }
    }

    async logInteraction(userPhone, prompt, response, type = 'general') {
        try {
            if (global.bot && global.bot.db) {
                await global.bot.db.logAIInteraction(userPhone, prompt, response, type);
            }
        } catch (error) {
            this.logger.warn('Warning: Could not log AI interaction:', error.message);
            // Don't throw error, just log warning to prevent AI functionality from breaking
        }
    }

    async generateFinancialAdvice(userContext, balance, spendingAnalysis) {
        const systemPrompt = `Kamu adalah AI penasihat keuangan personal yang ahli. Berikan saran keuangan yang personal dan actionable dalam bahasa Indonesia berdasarkan data keuangan pengguna.

Analisis yang tersedia:
- Saldo bersih: ${balance.balance}
- Total pemasukan: ${balance.income}
- Total pengeluaran: ${balance.expenses}
- Pengeluaran harian rata-rata: ${spendingAnalysis.dailyAverage}
- Total transaksi: ${spendingAnalysis.transactionCount}
- Rentang waktu analisis: ${spendingAnalysis.timespan} hari

Kategori pengeluaran teratas:
${Object.entries(spendingAnalysis.categorySpending).map(([cat, amount]) => `- ${cat}: Rp ${amount.toLocaleString()}`).join('\n')}

Berikan saran yang:
1. Spesifik dan dapat ditindaklanjuti
2. Berdasarkan pola keuangan yang teridentifikasi
3. Mencakup tips hemat dan optimisasi pengeluaran
4. Memberikan target atau goal yang realistis
5. Disesuaikan dengan kondisi keuangan saat ini

Format respons dengan bullet points yang jelas dan praktis.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Berikan saran keuangan personal berdasarkan data di atas.' }
            ], 0.7, 1200);

            return response;
        } catch (error) {
            this.logger.error('Error generating financial advice:', error);
            return 'Maaf, saya tidak dapat memberikan saran keuangan saat ini. Silakan coba lagi nanti.';
        }
    }

    async generateFinancialPrediction(historicalTransactions, balance, patterns) {
        const systemPrompt = `Kamu adalah AI Financial Forecasting Specialist yang menggunakan advanced analytics untuk prediksi keuangan. Buat prediksi yang akurat dan actionable untuk 30 hari ke depan dalam bahasa Indonesia.

METODOLOGI PREDIKSI:
🧮 QUANTITATIVE ANALYSIS:
1. Time series analysis dengan trend decomposition
2. Moving averages dan exponential smoothing
3. Seasonal pattern recognition
4. Volatility analysis dan confidence intervals
5. Monte Carlo simulation untuk scenario planning

📊 MACHINE LEARNING INSIGHTS:
1. Pattern recognition untuk recurring transactions
2. Anomaly detection untuk unusual spending
3. Correlation analysis antar kategori
4. Behavioral pattern modeling
5. Risk assessment dengan probability scoring

🎯 PREDICTION FRAMEWORK:
- Base Case (50% probability): Most likely scenario
- Optimistic Case (25% probability): Best case scenario
- Pessimistic Case (25% probability): Worst case scenario
- Black Swan Events: Low probability, high impact risks

DATA HISTORIS (60 hari terakhir):
- Total Transaksi: ${historicalTransactions.length}
- Saldo Saat Ini: Rp ${balance.balance?.toLocaleString('id-ID') || 0}
- Periode Analisis: ${historicalTransactions.length > 0 ?
    `${new Date(Math.min(...historicalTransactions.map(t => new Date(t.date)))).toLocaleDateString('id-ID')} - ${new Date(Math.max(...historicalTransactions.map(t => new Date(t.date)))).toLocaleDateString('id-ID')}` :
    'Data tidak tersedia'}

POLA YANG TERIDENTIFIKASI:
${patterns ? JSON.stringify(patterns, null, 2) : 'Analisis pola sedang diproses...'}

DELIVERABLES YANG DIHARAPKAN:
📈 PREDIKSI KEUANGAN 30 HARI:
1. Income prediction dengan confidence interval (min-max range)
2. Expense breakdown per kategori dengan trend analysis
3. Net cash flow scenarios (base/optimistic/pessimistic)
4. Saldo projection dengan risk assessment
5. Liquidity analysis dan cash burn rate

🚨 RISK ASSESSMENT:
1. Cash flow stress testing
2. Early warning indicators
3. Probability of cash shortfall
4. Emergency fund adequacy analysis
5. Financial stability score (1-10)

💡 STRATEGIC RECOMMENDATIONS:
1. Immediate actions (0-7 hari)
2. Short-term optimizations (1-2 minggu)
3. Medium-term strategies (3-4 minggu)
4. Contingency planning untuk different scenarios
5. KPIs untuk monitoring prediksi accuracy

Format dengan struktur yang jelas, angka spesifik, confidence levels, dan timeline yang actionable.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Buatlah prediksi keuangan komprehensif untuk 30 hari ke depan berdasarkan data historis yang telah disediakan.' }
            ], 0.6, 1800);

            return response;
        } catch (error) {
            this.logger.error('Error generating financial prediction:', error);
            return 'Maaf, saya tidak dapat membuat prediksi keuangan saat ini. Silakan coba lagi nanti.';
        }
    }

    async generateFinancialSummary(transactions, balance, periodAnalysis, period) {
        const systemPrompt = `Kamu adalah AI analis keuangan yang membuat ringkasan periode. Buatlah ringkasan yang komprehensif dan insightful untuk periode ${period} dalam bahasa Indonesia.

Data periode:
- Total transaksi: ${transactions.length}
- Hari dalam periode: ${periodAnalysis.periodDays}
- Total pemasukan periode: ${periodAnalysis.totalIncome}
- Total pengeluaran periode: ${periodAnalysis.totalExpenses}
- Rata-rata transaksi harian: ${periodAnalysis.averageDaily}
- Hari paling aktif: ${periodAnalysis.peakDay}

Breakdown kategori:
${Object.entries(periodAnalysis.categoryBreakdown).map(([cat, amount]) => `- ${cat}: Rp ${amount.toLocaleString()}`).join('\n')}

Buatlah ringkasan yang mencakup:
1. Highlight utama periode ini
2. Perbandingan dengan periode sebelumnya (jika memungkinkan)
3. Tren dan pola yang menarik
4. Kategori dengan performa terbaik/terburuk
5. Rekomendasi untuk periode berikutnya
6. Key takeaways yang actionable

Gunakan tone yang profesional namun mudah dipahami.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Buatlah ringkasan keuangan ${period} berdasarkan data di atas.` }
            ], 0.7, 1300);

            return response;
        } catch (error) {
            this.logger.error('Error generating financial summary:', error);
            return `Maaf, saya tidak dapat membuat ringkasan ${period} saat ini. Silakan coba lagi nanti.`;
        }
    }

    async suggestCategory(description, type, availableCategories) {
        const systemPrompt = `Kamu adalah AI ahli kategorisasi transaksi keuangan. Berdasarkan deskripsi transaksi, sarankan kategori yang paling sesuai dari daftar kategori yang tersedia.

Kategori yang tersedia untuk ${type === 'income' ? 'pemasukan' : 'pengeluaran'}:
${availableCategories.filter(c => c.type === type).map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}

Kembalikan HANYA objek JSON dengan format:
{
  "category": {
    "id": number,
    "name": string
  },
  "confidence": number (0-1),
  "reasoning": string (alasan singkat pemilihan kategori)
}

Jika tidak yakin atau tidak ada kategori yang cocok, return confidence < 0.7.

Deskripsi transaksi: "${description}"
Jenis: ${type === 'income' ? 'Pemasukan' : 'Pengeluaran'}`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Kategorikan transaksi: ${description}` }
            ], 0.3, 300);

            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            const parsed = JSON.parse(cleanResponse);
            
            // Validate response structure
            if (!parsed.category || !parsed.category.id || !parsed.category.name || parsed.confidence === undefined) {
                throw new Error('Invalid response structure');
            }

            // Verify the suggested category exists in available categories
            const categoryExists = availableCategories.find(c => c.id === parsed.category.id);
            if (!categoryExists) {
                throw new Error('Suggested category not in available list');
            }

            return parsed;
        } catch (error) {
            this.logger.error('Error suggesting category:', error);
            return {
                category: null,
                confidence: 0,
                reasoning: "Tidak dapat menentukan kategori yang sesuai"
            };
        }
    }

    async parseBulkTransactions(text, userPhone, indonesianAI = null) {
        const systemPrompt = `Kamu adalah parser transaksi keuangan bulk yang ahli untuk pengguna Indonesia. Analisis input dalam bahasa Indonesia dan ekstrak multiple transaksi dengan akurat.

RULES PARSING AMOUNT (SANGAT PENTING):
- "10K" = 10.000, "33k" = 33.000, "150K" = 150.000
- "1jt" = 1.000.000, "1.5jt" = 1.500.000
- "25rb" = 25.000, "500ribu" = 500.000
- "2k" = 2.000, "20k" = 20.000, "30k" = 30.000
- Angka tanpa suffix: gunakan nilai asli

JANGAN MENGALIKAN AMOUNT YANG SUDAH BENAR!

Kembalikan HANYA objek JSON dengan format:
{
  "transactions": [
    {
      "type": "income" atau "expense",
      "amount": number (PASTIKAN KONVERSI BENAR),
      "description": string (bersih tanpa kata kerja),
      "category": string (kategori yang sesuai),
      "confidence": number (0-1),
      "amountDetails": string (jelaskan konversi)
    }
  ],
  "totalTransactions": number,
  "overallConfidence": number (0-1, rata-rata confidence)
}

Contoh input:
"Habis belanja baju albi 33k
Mainan albi 30k
Galon + kopi 20k
Parkir 2k
Permen 2k"

Hasil yang diharapkan:
{
  "transactions": [
    {"type":"expense","amount":33000,"description":"baju albi","category":"Belanja","confidence":0.9,"amountDetails":"33k = 33.000"},
    {"type":"expense","amount":30000,"description":"mainan albi","category":"Belanja","confidence":0.8,"amountDetails":"30k = 30.000"},
    {"type":"expense","amount":20000,"description":"galon kopi","category":"Makanan","confidence":0.9,"amountDetails":"20k = 20.000"},
    {"type":"expense","amount":2000,"description":"parkir","category":"Transportasi","confidence":0.9,"amountDetails":"2k = 2.000"},
    {"type":"expense","amount":2000,"description":"permen","category":"Makanan","confidence":0.9,"amountDetails":"2k = 2.000"}
  ],
  "totalTransactions": 5,
  "overallConfidence": 0.88
}

Rules:
1. Pisahkan berdasarkan line break atau pola yang jelas
2. PASTIKAN konversi amount BENAR sesuai rules di atas
3. Identifikasi jenis transaksi (default expense jika tidak jelas)
4. Berikan kategori yang tepat untuk setiap transaksi
5. Minimum confidence 0.6 untuk dianggap valid
6. Hapus kata kerja dari description: "habis", "beli", "belanja", "bayar", "sudah", "spent", "bought", "paid"
7. Fokus pada objek/item yang dibeli, bukan aksinya
8. Sertakan amountDetails untuk verifikasi konversi

Input pengguna: "${text}"`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ], 0.3, 800);

            // Try to parse JSON response
            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            const parsed = JSON.parse(cleanResponse);
            
            // Validate response structure
            if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
                throw new Error('Invalid response structure: missing transactions array');
            }

            // Validate each transaction
            const validTransactions = parsed.transactions.filter(t =>
                t.type && t.amount && t.description && t.confidence >= 0.6
            );

            // Apply title case formatting to descriptions if indonesianAI is provided
            if (indonesianAI) {
                validTransactions.forEach(transaction => {
                    if (transaction.description) {
                        transaction.description = indonesianAI.cleanTransactionDescription(transaction.description);
                    }
                });
            }

            return {
                transactions: validTransactions,
                totalTransactions: validTransactions.length,
                overallConfidence: validTransactions.length > 0
                    ? validTransactions.reduce((sum, t) => sum + t.confidence, 0) / validTransactions.length
                    : 0,
                originalTotal: parsed.transactions.length,
                filtered: parsed.transactions.length - validTransactions.length
            };
        } catch (error) {
            this.logger.error('Error parsing bulk transactions:', error);
            return {
                transactions: [],
                totalTransactions: 0,
                overallConfidence: 0,
                error: error.message
            };
        }
    }

    isAvailable() {
        return this.isEnabled;
    }

    /**
     * Generate fallback financial analysis when AI is unavailable
     */
    generateFallbackFinancialAnalysis(analysisData) {
        try {
            // Parse the analysis data to extract key metrics
            const lines = analysisData.split('\n');
            let totalIncome = 0;
            let totalExpenses = 0;
            let balance = 0;
            let transactionCount = 0;

            // Extract basic metrics from the data
            lines.forEach(line => {
                if (line.includes('Total Pemasukan:')) {
                    totalIncome = parseFloat(line.match(/[\d,]+/)?.[0]?.replace(/,/g, '') || 0);
                }
                if (line.includes('Total Pengeluaran:')) {
                    totalExpenses = parseFloat(line.match(/[\d,]+/)?.[0]?.replace(/,/g, '') || 0);
                }
                if (line.includes('Saldo Bersih:')) {
                    balance = parseFloat(line.match(/-?[\d,]+/)?.[0]?.replace(/,/g, '') || 0);
                }
                if (line.includes('Total Transaksi:')) {
                    transactionCount = parseInt(line.match(/\d+/)?.[0] || 0);
                }
            });

            // Generate basic analysis
            const incomeExpenseRatio = totalIncome > 0 ? (totalExpenses / totalIncome * 100).toFixed(1) : 0;
            const avgDaily = totalExpenses > 0 ? (totalExpenses / 30).toFixed(0) : 0;
            
            let healthStatus = '🟢 Sehat';
            let healthScore = 8;
            
            if (balance < 0) {
                healthStatus = '🔴 Perlu Perhatian';
                healthScore = 3;
            } else if (incomeExpenseRatio > 80) {
                healthStatus = '🟡 Hati-hati';
                healthScore = 5;
            }

            return `📊 **ANALISIS KEUANGAN RINGKAS**

🎯 **STATUS KEUANGAN**
• Status: ${healthStatus}
• Skor Kesehatan: ${healthScore}/10
• Rasio Pengeluaran: ${incomeExpenseRatio}% dari pemasukan

💰 **RINGKASAN KEUANGAN**
• Total Pemasukan: Rp ${totalIncome.toLocaleString('id-ID')}
• Total Pengeluaran: Rp ${totalExpenses.toLocaleString('id-ID')}
• Saldo Bersih: Rp ${balance.toLocaleString('id-ID')}
• Rata-rata Pengeluaran Harian: Rp ${avgDaily.toLocaleString('id-ID')}

📈 **INSIGHTS OTOMATIS**
${balance > 0 ?
    '• ✅ Keuangan Anda dalam kondisi positif' :
    '• ⚠️ Pengeluaran melebihi pemasukan, perlu evaluasi'}
${incomeExpenseRatio < 70 ?
    '• ✅ Rasio pengeluaran masih dalam batas aman' :
    '• ⚠️ Rasio pengeluaran tinggi, pertimbangkan untuk berhemat'}
• 📊 Total ${transactionCount} transaksi tercatat

💡 **REKOMENDASI CEPAT**
${balance < 0 ?
    '• 🚨 Prioritas: Kurangi pengeluaran non-esensial\n• 💼 Cari sumber pemasukan tambahan' :
    incomeExpenseRatio > 80 ?
    '• 💰 Sisihkan lebih banyak untuk tabungan\n• 📝 Buat anggaran bulanan yang lebih ketat' :
    '• ✅ Pertahankan pola keuangan yang baik\n• 📈 Pertimbangkan investasi untuk masa depan'}

⚠️ *Analisis ini menggunakan mode cadangan. Untuk analisis AI yang lebih mendalam, silakan coba lagi nanti.*`;

        } catch (error) {
            this.logger.error('Error generating fallback analysis:', error);
            return `📊 **ANALISIS KEUANGAN TIDAK TERSEDIA**

Maaf, sistem analisis sedang mengalami gangguan. Beberapa informasi dasar:

• Layanan AI sedang sibuk atau mengalami rate limit
• Data keuangan Anda tetap aman dan tersimpan
• Anda masih dapat mencatat transaksi seperti biasa

💡 **Saran:**
• Coba analisis keuangan lagi dalam 10-15 menit
• Gunakan command /saldo untuk melihat ringkasan cepat
• Gunakan /laporan untuk melihat data transaksi

Terima kasih atas pengertiannya! 🙏`;
        }
    }

    /**
     * Generate fallback cash flow prediction
     */
    generateFallbackCashFlowPrediction(historicalTransactions, timeframe) {
        try {
            if (!historicalTransactions || historicalTransactions.length === 0) {
                return `📈 **PREDIKSI ARUS KAS - ${timeframe.toUpperCase()}**

⚠️ Data transaksi tidak mencukupi untuk membuat prediksi.

💡 **Untuk mendapatkan prediksi yang akurat:**
• Catat minimal 10-15 transaksi
• Gunakan aplikasi secara konsisten selama 1-2 minggu
• Pastikan mencatat semua pemasukan dan pengeluaran

Sistem akan memberikan prediksi otomatis setelah data mencukupi.`;
            }

            // Simple trend analysis
            const recentTransactions = historicalTransactions.slice(-14); // Last 14 days
            const avgIncome = recentTransactions.filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0) / 14;
            const avgExpense = recentTransactions.filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0) / 14;

            const timeframeDays = timeframe === 'mingguan' ? 7 : timeframe === 'bulanan' ? 30 : 14;
            const projectedIncome = avgIncome * timeframeDays;
            const projectedExpense = avgExpense * timeframeDays;
            const projectedNet = projectedIncome - projectedExpense;

            return `📈 **PREDIKSI ARUS KAS - ${timeframe.toUpperCase()}**

📊 **PREDIKSI BERDASARKAN TREN 14 HARI TERAKHIR:**

💰 **PROYEKSI PEMASUKAN**
• Estimasi: Rp ${projectedIncome.toLocaleString('id-ID')}
• Rata-rata harian: Rp ${avgIncome.toLocaleString('id-ID')}

💸 **PROYEKSI PENGELUARAN**
• Estimasi: Rp ${projectedExpense.toLocaleString('id-ID')}
• Rata-rata harian: Rp ${avgExpense.toLocaleString('id-ID')}

🎯 **NET CASH FLOW**
• Proyeksi bersih: Rp ${projectedNet.toLocaleString('id-ID')}
• Status: ${projectedNet > 0 ? '✅ Positif' : '⚠️ Negatif'}

⚠️ *Ini adalah prediksi sederhana. Untuk analisis mendalam dengan AI, coba lagi nanti.*`;

        } catch (error) {
            this.logger.error('Error generating fallback prediction:', error);
            return `📈 **PREDIKSI ARUS KAS TIDAK TERSEDIA**

Sistem prediksi sedang mengalami gangguan. Silakan coba lagi dalam beberapa menit.`;
        }
    }

    /**
     * Enhanced error handling for AI requests with fallback
     */
    async makeRequestWithFallback(messages, fallbackFunction = null, ...fallbackArgs) {
        try {
            return await this.makeRequest(messages);
        } catch (error) {
            // Handle rate limit for all providers
            if (error.message === 'RATE_LIMITED_ALL_PROVIDERS' || this.isRateLimitError(error)) {
                this.logger.warn('All AI providers rate limited, using fallback response');
                if (fallbackFunction && typeof fallbackFunction === 'function') {
                    return fallbackFunction(...fallbackArgs);
                }
                throw new Error('RATE_LIMITED');
            }
            throw error;
        }
    }

    /**
     * Get current provider status for monitoring
     */
    getProviderStatus() {
        const status = {
            primary: {
                provider: this.provider,
                baseURL: this.baseURL,
                model: this.model,
                isRateLimited: this.rateLimitedProviders.has(`${this.provider}-primary`),
                isEnabled: this.isEnabled
            },
            fallbacks: this.fallbackProviders.map(p => ({
                name: p.name,
                provider: p.provider,
                baseURL: p.baseURL,
                model: p.model,
                isRateLimited: this.rateLimitedProviders.has(p.name),
                priority: p.priority
            })),
            rateLimitedCount: this.rateLimitedProviders.size,
            lastReset: new Date(this.lastRateLimitReset).toISOString(),
            availableProviders: this.fallbackProviders.filter(p => !this.rateLimitedProviders.has(p.name)).length
        };

        return status;
    }

    /**
     * Force reset rate limited providers (for admin use)
     */
    resetRateLimits() {
        const previousCount = this.rateLimitedProviders.size;
        this.rateLimitedProviders.clear();
        this.lastRateLimitReset = Date.now();
        this.logger.info(`Manually reset ${previousCount} rate limited providers`);
        return {
            resetCount: previousCount,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = AIService;