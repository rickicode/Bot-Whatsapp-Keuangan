const axios = require('axios');
const Logger = require('../utils/Logger');

class AIService {
    constructor() {
        this.logger = new Logger();
        this.isEnabled = process.env.ENABLE_AI_FEATURES === 'true';
        
        // Initialize AI provider configuration
        this.initializeProvider();
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
                this.logger.error(`Unknown AI provider: ${this.provider}. Supported providers: deepseek, openai, openaicompatible`);
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

    async makeRequest(messages, temperature = 0.7, maxTokens = 1000) {
        if (!this.isEnabled) {
            throw new Error('Fitur AI tidak aktif');
        }

        try {
            // Prepare request payload
            const payload = {
                model: this.model,
                messages: messages,
                temperature: temperature,
                max_tokens: maxTokens,
                stream: false
            };

            // Prepare headers
            const headers = {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            };

            // Make API request
            const response = await axios.post(`${this.baseURL}/v1/chat/completions`, payload, {
                headers: headers,
                timeout: 30000
            });

            // Extract response
            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                throw new Error('Invalid response format from AI provider');
            }

            return response.data.choices[0].message.content;
        } catch (error) {
            this.logger.error(`${this.provider.toUpperCase()} API error:`, error.response?.data || error.message);
            
            // More specific error messages based on error type
            if (error.response?.status === 401) {
                throw new Error('API key tidak valid. Periksa konfigurasi AI provider.');
            } else if (error.response?.status === 429) {
                throw new Error('Rate limit tercapai. Coba lagi dalam beberapa saat.');
            } else if (error.response?.status >= 500) {
                throw new Error('Server AI provider sedang mengalami masalah. Coba lagi nanti.');
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                throw new Error('Tidak dapat terhubung ke AI provider. Periksa URL dan koneksi internet.');
            } else {
                throw new Error('Layanan AI sementara tidak tersedia');
            }
        }
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
        const systemPrompt = `Kamu adalah parser transaksi keuangan untuk pengguna Indonesia. Analisis input dalam bahasa Indonesia dan ekstrak detail transaksi.

Kembalikan HANYA objek JSON dengan field berikut:
- type: "income" atau "expense"
- amount: number (tanpa simbol mata uang)
- description: string (dalam bahasa Indonesia, tanpa kata-kata seperti "habis", "beli", "bayar")
- category: string (kategori yang sesuai dalam bahasa Indonesia, atau "unknown" jika tidak yakin)
- confidence: number (0-1, seberapa yakin dalam parsing)

Contoh:
"Saya habis 50000 untuk makan siang hari ini" -> {"type":"expense","amount":50000,"description":"makan siang hari ini","category":"Makanan","confidence":0.9}
"Terima 500000 dari bayaran klien" -> {"type":"income","amount":500000,"description":"bayaran klien","category":"Freelance","confidence":0.9}
"Beli bensin 100000" -> {"type":"expense","amount":100000,"description":"bensin","category":"Transportasi","confidence":0.9}
"Habis jajan sate ayam 10000" -> {"type":"expense","amount":10000,"description":"jajan sate ayam","category":"Makanan","confidence":0.9}

Untuk description, hindari kata-kata seperti "habis", "beli", "bayar", "sudah", "spent", "bought", "paid".
Jika tidak yakin dengan kategori, gunakan "unknown".

Input pengguna: "${text}"`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ], 0.3, 300);

            // Try to parse JSON response
            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            const parsedResult = JSON.parse(cleanResponse);
            
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

        const systemPrompt = `Kamu adalah AI penasihat keuangan. Analisis data keuangan yang diberikan dan berikan wawasan, rekomendasi, dan observasi dalam bahasa Indonesia.

Fokus pada:
1. Pola dan tren pengeluaran
2. Keseimbangan pemasukan vs pengeluaran
3. Analisis per kategori
4. Rekomendasi untuk perbaikan
5. Penilaian kesehatan keuangan

Berikan respons yang ringkas namun mendalam. Gunakan format Rupiah Indonesia (IDR) untuk referensi mata uang. Format respons dengan jelas dan terstruktur dengan emoji untuk keterbacaan yang lebih baik.`;

        const userPrompt = `Ringkasan Keuangan:
- Saldo Saat Ini: ${balance.balance}
- Total Pemasukan: ${balance.income}
- Total Pengeluaran: ${balance.expenses}
- Transaksi Terbaru: ${transactions.length}

Tren Bulanan: ${JSON.stringify(monthlyTrends)}
Kategori Teratas: ${JSON.stringify(categories)}

Mohon berikan analisis keuangan yang komprehensif dan rekomendasi.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], 0.7, 1500);

            return response;
        } catch (error) {
            this.logger.error('Error generating financial analysis:', error);
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
        const systemPrompt = `Kamu adalah AI peramal keuangan. Berdasarkan riwayat transaksi, prediksi pola arus kas masa depan dalam bahasa Indonesia.

Analisis data dan berikan:
1. Prediksi pemasukan untuk ${timeframe} berikutnya
2. Prediksi pengeluaran untuk ${timeframe} berikutnya
3. Perkiraan perubahan saldo
4. Tingkat kepercayaan dalam prediksi
5. Faktor-faktor kunci yang mempengaruhi perkiraan

Format respons dengan jelas dengan angka spesifik dan alasan.`;

        const historyText = transactionHistory.map(t => 
            `${t.date}: ${t.type} ${t.amount} (${t.description})`
        ).join('\n');

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Transaction History:\n${historyText}\n\nPredict cash flow for next ${timeframe}:` }
            ], 0.6, 1200);

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
        const systemPrompt = `Kamu adalah AI peramal keuangan yang ahli. Berdasarkan data historis transaksi, buatlah prediksi keuangan yang akurat untuk 30 hari ke depan dalam bahasa Indonesia.

Data historis (60 hari terakhir):
- Total transaksi: ${historicalTransactions.length}
- Saldo saat ini: ${balance.balance}

Pola yang teridentifikasi:
${JSON.stringify(patterns, null, 2)}

Berikan prediksi yang mencakup:
1. Estimasi pemasukan dan pengeluaran bulan depan
2. Perkiraan saldo akhir bulan
3. Tren kategori pengeluaran yang akan meningkat/menurun
4. Rekomendasi berdasarkan prediksi
5. Level akurasi prediksi dan faktor ketidakpastian

Format dengan struktur yang jelas dan angka spesifik.`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: 'Buatlah prediksi keuangan untuk 30 hari ke depan.' }
            ], 0.6, 1500);

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
        const systemPrompt = `Kamu adalah parser transaksi keuangan bulk untuk pengguna Indonesia. Analisis input dalam bahasa Indonesia dan ekstrak multiple transaksi sekaligus.

Kembalikan HANYA objek JSON dengan format:
{
  "transactions": [
    {
      "type": "income" atau "expense",
      "amount": number (tanpa simbol mata uang),
      "description": string (dalam bahasa Indonesia),
      "category": string (kategori yang sesuai dalam bahasa Indonesia, atau "unknown" jika tidak yakin),
      "confidence": number (0-1, seberapa yakin dalam parsing)
    }
  ],
  "totalTransactions": number,
  "overallConfidence": number (0-1, rata-rata confidence semua transaksi)
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
    {"type":"expense","amount":33000,"description":"baju albi","category":"Belanja","confidence":0.9},
    {"type":"expense","amount":30000,"description":"mainan albi","category":"Belanja","confidence":0.8},
    {"type":"expense","amount":20000,"description":"galon kopi","category":"Makanan","confidence":0.9},
    {"type":"expense","amount":2000,"description":"parkir","category":"Transportasi","confidence":0.9},
    {"type":"expense","amount":2000,"description":"permen","category":"Makanan","confidence":0.9}
  ],
  "totalTransactions": 5,
  "overallConfidence": 0.88
}

Rules:
1. Pisahkan berdasarkan line break atau pola yang jelas
2. Deteksi angka (k=ribu, jt=juta, rb=ribu)
3. Identifikasi jenis transaksi (default expense jika tidak jelas)
4. Berikan kategori yang tepat untuk setiap transaksi
5. Minimum confidence 0.6 untuk dianggap valid
6. Jika ada transaksi yang tidak jelas, set confidence rendah
7. PENTING: Untuk description, hindari kata-kata seperti "habis", "beli", "belanja", "bayar", "sudah", "spent", "bought", "paid"
8. Fokus pada objek/item yang dibeli, bukan aksinya

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
}

module.exports = AIService;