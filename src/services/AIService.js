const axios = require('axios');
const Logger = require('../utils/Logger');

class AIService {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
        this.logger = new Logger();
        this.isEnabled = process.env.ENABLE_AI_FEATURES === 'true';
        
        if (!this.apiKey && this.isEnabled) {
            this.logger.warn('DeepSeek API key not provided. AI features will be disabled.');
            this.isEnabled = false;
        }
    }

    async makeRequest(messages, temperature = 0.7, maxTokens = 1000) {
        if (!this.isEnabled) {
            throw new Error('Fitur AI tidak aktif');
        }

        try {
            const response = await axios.post(`${this.baseURL}/v1/chat/completions`, {
                model: 'deepseek-chat',
                messages: messages,
                temperature: temperature,
                max_tokens: maxTokens,
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            return response.data.choices[0].message.content;
        } catch (error) {
            this.logger.error('DeepSeek API error:', error.response?.data || error.message);
            throw new Error('Layanan AI sementara tidak tersedia');
        }
    }

    async parseNaturalLanguageTransaction(text, userPhone) {
        const systemPrompt = `Kamu adalah parser transaksi keuangan untuk pengguna Indonesia. Analisis input dalam bahasa Indonesia dan ekstrak detail transaksi.

Kembalikan HANYA objek JSON dengan field berikut:
- type: "income" atau "expense"
- amount: number (tanpa simbol mata uang)
- description: string (dalam bahasa Indonesia)
- category: string (kategori yang sesuai dalam bahasa Indonesia, atau "unknown" jika tidak yakin)
- confidence: number (0-1, seberapa yakin dalam parsing)

Contoh:
"Saya habis 50000 untuk makan siang hari ini" -> {"type":"expense","amount":50000,"description":"makan siang hari ini","category":"Makanan","confidence":0.9}
"Terima 500000 dari bayaran klien" -> {"type":"income","amount":500000,"description":"bayaran klien","category":"Freelance","confidence":0.9}
"Beli bensin 100000" -> {"type":"expense","amount":100000,"description":"beli bensin","category":"Transportasi","confidence":0.9}
"Gaji bulan ini 5000000" -> {"type":"income","amount":5000000,"description":"gaji bulan ini","category":"Gaji","confidence":0.9}

Jika tidak yakin dengan kategori, gunakan "unknown".

Input pengguna: "${text}"`;

        try {
            const response = await this.makeRequest([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ], 0.3, 300);

            // Try to parse JSON response
            const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
            return JSON.parse(cleanResponse);
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
                await global.bot.db.run(
                    'INSERT INTO ai_interactions (user_phone, prompt, response, type) VALUES (?, ?, ?, ?)',
                    [userPhone, prompt, response, type]
                );
            }
        } catch (error) {
            this.logger.error('Error logging AI interaction:', error);
        }
    }

    isAvailable() {
        return this.isEnabled;
    }
}

module.exports = AIService;