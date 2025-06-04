const moment = require('moment');

// Mock message object
const createMockMessage = (body) => ({
    from: '+6281234567890@c.us',
    body: body,
    reply: async (text) => {
        console.log('🤖 Bot Reply:');
        console.log(text);
        console.log('=' + '='.repeat(80));
    }
});

// Mock AI Service with sample responses
const mockAIService = {
    isAvailable: () => true,
    
    async generateFinancialAdvice(userContext, balance, spendingAnalysis) {
        return `🎯 **Saran Keuangan Personal:**

📊 **Analisis Kondisi Keuangan:**
• Saldo bersih Anda saat ini cukup sehat dengan ${this.formatCurrency(balance.balance)}
• Pengeluaran harian rata-rata ${this.formatCurrency(spendingAnalysis.dailyAverage)}
• Kategori pengeluaran terbesar: Makanan (${Math.round((spendingAnalysis.categorySpending.Makanan / spendingAnalysis.totalExpenses) * 100)}%)

💡 **Rekomendasi Aksi:**
• Coba kurangi pengeluaran makanan 10-15% dengan masak di rumah
• Set budget harian maksimal ${this.formatCurrency(spendingAnalysis.dailyAverage * 0.9)}
• Sisihkan 20% dari saldo untuk dana darurat
• Catat semua pengeluaran kecil untuk kontrol yang lebih baik

🎯 **Target Bulan Depan:**
• Hemat minimal ${this.formatCurrency(spendingAnalysis.totalExpenses * 0.1)} dari pengeluaran
• Tingkatkan pemasukan melalui side hustle atau freelance
• Mulai investasi kecil-kecilan ${this.formatCurrency(50000)} per minggu`;
    },

    async generateFinancialPrediction(historicalTransactions, balance, patterns) {
        return `🔮 **Prediksi Keuangan 30 Hari Ke Depan:**

📈 **Estimasi Pemasukan:**
• Pemasukan rutin: ${this.formatCurrency(3500000)} (berdasarkan pola gaji)
• Pemasukan tambahan: ${this.formatCurrency(800000)} (freelance/bonus)
• **Total prediksi pemasukan: ${this.formatCurrency(4300000)}**

📉 **Estimasi Pengeluaran:**
• Pengeluaran tetap: ${this.formatCurrency(2100000)} (makanan, transport, utilitas)
• Pengeluaran variabel: ${this.formatCurrency(1200000)} (hiburan, belanja)
• **Total prediksi pengeluaran: ${this.formatCurrency(3300000)}**

💰 **Proyeksi Saldo:**
• Saldo saat ini: ${this.formatCurrency(balance.balance)}
• Perkiraan saldo akhir bulan: ${this.formatCurrency(balance.balance + 1000000)}
• **Net cashflow: +${this.formatCurrency(1000000)}** ✅

📊 **Tren Kategori:**
• Makanan: Stabil (rata-rata ${this.formatCurrency(70000)}/hari)
• Transportasi: Meningkat 15% (kenaikan BBM)
• Hiburan: Menurun 20% (lebih selektif)

⚠️ **Faktor Risiko:**
• Pengeluaran mendadak/darurat: 15% kemungkinan
• Fluktuasi pemasukan freelance: ±20%
• **Akurasi prediksi: 78%** (berdasarkan pola 60 hari)`;
    },

    async generateFinancialSummary(transactions, balance, periodAnalysis, period) {
        const periodName = this.getPeriodName(period);
        return `📋 **Ringkasan AI - ${periodName}:**

🎯 **Highlight Utama:**
• Total ${transactions.length} transaksi dalam ${periodAnalysis.periodDays} hari
• Rata-rata ${periodAnalysis.averageDaily.toFixed(1)} transaksi per hari
• Net cashflow: ${periodAnalysis.totalIncome - periodAnalysis.totalExpenses >= 0 ? '+' : ''}${this.formatCurrency(periodAnalysis.totalIncome - periodAnalysis.totalExpenses)}

📈 **Performa Kategori:**
• **Terbaik:** Pengeluaran utilitas terkontrol dengan baik
• **Perlu Perhatian:** Pengeluaran makanan 23% dari total budget
• **Mengejutkan:** Transportasi naik 35% vs periode lalu

🔍 **Insight Menarik:**
• Hari paling aktif: ${periodAnalysis.peakDay} (${periodAnalysis.dailyTransactions[periodAnalysis.peakDay] || 0} transaksi)
• Pola spending: Lebih boros di awal periode, hemat di akhir
• Efisiensi transaksi: 87% transaksi di atas ${this.formatCurrency(25000)}

📊 **Benchmark:**
• Savings rate: ${Math.round(((periodAnalysis.totalIncome - periodAnalysis.totalExpenses) / periodAnalysis.totalIncome) * 100)}%
• Budget adherence: 92% (sangat baik!)
• Category diversification: Optimal (6 kategori aktif)

🎯 **Rekomendasi ${periodName} Depan:**
• Pertahankan kontrol pengeluaran utilitas
• Set limit makanan maksimal ${this.formatCurrency(Math.round(periodAnalysis.categoryBreakdown.Makanan * 0.9))}
• Explore cara hemat transportasi (carpool/public transport)
• Target savings rate 25% untuk periode depan`;
    },

    async suggestCategory(description, type, categories) {
        // Simple mock categorization logic
        const lowerDesc = description.toLowerCase();
        let suggestedCategory = null;
        let confidence = 0.5;

        const typeCategories = categories.filter(c => c.type === type);
        
        if (type === 'expense') {
            if (lowerDesc.includes('makan') || lowerDesc.includes('food') || lowerDesc.includes('restoran')) {
                suggestedCategory = typeCategories.find(c => c.name.toLowerCase().includes('makanan'));
                confidence = 0.9;
            } else if (lowerDesc.includes('bensin') || lowerDesc.includes('transport') || lowerDesc.includes('ojol')) {
                suggestedCategory = typeCategories.find(c => c.name.toLowerCase().includes('transport'));
                confidence = 0.85;
            } else if (lowerDesc.includes('listrik') || lowerDesc.includes('air') || lowerDesc.includes('wifi')) {
                suggestedCategory = typeCategories.find(c => c.name.toLowerCase().includes('utilitas'));
                confidence = 0.88;
            }
        } else {
            if (lowerDesc.includes('gaji') || lowerDesc.includes('salary')) {
                suggestedCategory = typeCategories.find(c => c.name.toLowerCase().includes('gaji'));
                confidence = 0.95;
            } else if (lowerDesc.includes('freelance') || lowerDesc.includes('klien') || lowerDesc.includes('project')) {
                suggestedCategory = typeCategories.find(c => c.name.toLowerCase().includes('freelance'));
                confidence = 0.9;
            }
        }

        return {
            category: suggestedCategory,
            confidence: confidence,
            reasoning: `Berdasarkan kata kunci "${description}", kategori ${suggestedCategory?.name} paling sesuai`
        };
    },

    // Helper method
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    getPeriodName: (period) => {
        switch (period?.toLowerCase()) {
            case 'harian': return 'Hari Ini';
            case 'mingguan': return 'Minggu Ini';
            case 'bulanan': return 'Bulan Ini';
            default: return 'Bulan Ini';
        }
    }
};

// Mock database with sample data
const mockDb = {
    async getBalance(userPhone) {
        return {
            income: 5000000,
            expenses: 3200000,
            balance: 1800000
        };
    },

    async getTransactions(userPhone, limit) {
        return [
            {
                id: 1,
                type: 'expense',
                amount: 50000,
                description: 'Makan siang di warteg',
                category_name: 'Makanan',
                date: '2025-06-07'
            },
            {
                id: 2,
                type: 'expense',
                amount: 35000,
                description: 'Bensin motor',
                category_name: 'Transportasi',
                date: '2025-06-07'
            },
            {
                id: 3,
                type: 'income',
                amount: 500000,
                description: 'Freelance web development',
                category_name: 'Freelance',
                date: '2025-06-06'
            },
            {
                id: 4,
                type: 'expense',
                amount: 25000,
                description: 'Kopi starbucks',
                category_name: 'Makanan',
                date: '2025-06-06'
            },
            {
                id: 5,
                type: 'expense',
                amount: 150000,
                description: 'Tagihan listrik PLN',
                category_name: 'Utilitas',
                date: '2025-06-05'
            }
        ].slice(0, limit);
    },

    async getTransactionsByDateRange(userPhone, startDate, endDate) {
        // Return sample data for the date range
        return [
            {
                id: 1,
                type: 'expense',
                amount: 50000,
                description: 'Makan siang di warteg',
                category_name: 'Makanan',
                date: startDate
            },
            {
                id: 2,
                type: 'expense',
                amount: 35000,
                description: 'Bensin motor',
                category_name: 'Transportasi',
                date: startDate
            },
            {
                id: 3,
                type: 'income',
                amount: 3500000,
                description: 'Gaji bulanan',
                category_name: 'Gaji',
                date: startDate
            }
        ];
    },

    async getCategories(userPhone, type) {
        const allCategories = [
            { id: 1, name: 'Makanan', type: 'expense', color: '#FF6B6B' },
            { id: 2, name: 'Transportasi', type: 'expense', color: '#4ECDC4' },
            { id: 3, name: 'Utilitas', type: 'expense', color: '#45B7D1' },
            { id: 4, name: 'Hiburan', type: 'expense', color: '#96CEB4' },
            { id: 5, name: 'Gaji', type: 'income', color: '#FFEAA7' },
            { id: 6, name: 'Freelance', type: 'income', color: '#DDA0DD' },
            { id: 7, name: 'Bisnis', type: 'income', color: '#98D8C8' }
        ];

        return type ? allCategories.filter(c => c.type === type) : allCategories;
    }
};

// Mock ReportService
const mockReportService = {
    async getUserContext(userPhone) {
        return {
            totalTransactions: 25,
            monthlyIncome: 4500000,
            monthlyExpenses: 3200000,
            topCategories: ['Makanan', 'Transportasi', 'Utilitas']
        };
    }
};

// Mock TransactionService
const mockTransactionService = {
    async updateTransaction(userPhone, transactionId, updates) {
        console.log(`🔄 Updating transaction ${transactionId} with:`, updates);
        return true;
    }
};

// Mock CommandHandler with all AI features
class MockCommandHandler {
    constructor() {
        this.ai = mockAIService;
        this.db = mockDb;
        this.reportService = mockReportService;
        this.transactionService = mockTransactionService;
        this.logger = { error: console.error, info: console.log };
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    // Copy all the helper methods from the original CommandHandler
    analyzeSpendingPatterns(transactions, balance) {
        const expenses = transactions.filter(t => t.type === 'expense');
        const categorySpending = { Makanan: 850000, Transportasi: 450000, Utilitas: 300000 };
        
        return {
            categorySpending,
            dailyAverage: 65000,
            totalExpenses: expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0),
            totalIncome: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0),
            transactionCount: transactions.length,
            timespan: 30
        };
    }

    analyzePredictionPatterns(transactions) {
        return {
            weeklyData: { '2025-W23': { income: 875000, expenses: 420000 } },
            monthlyData: { '2025-06': { income: 3500000, expenses: 1680000 } },
            categoryTrends: { Makanan: [{ amount: 50000, date: '2025-06-07', type: 'expense' }] },
            totalTransactions: transactions.length
        };
    }

    analyzePeriodData(transactions, startDate, endDate) {
        return {
            periodDays: 7,
            totalIncome: 3500000,
            totalExpenses: 1680000,
            categoryBreakdown: { Makanan: 350000, Transportasi: 245000, Utilitas: 150000 },
            dailyTransactions: { '2025-06-07': 3, '2025-06-06': 2 },
            averageDaily: 2.1,
            peakDay: '2025-06-07'
        };
    }

    getPeriodName(period) {
        return mockAIService.getPeriodName(period);
    }

    getTopExpenseCategories(expenses) {
        return '1. Makanan: Rp350.000\n2. Transportasi: Rp245.000\n3. Utilitas: Rp150.000';
    }

    // Include all AI handler methods from the original implementation
    async handleAdvice(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }

        try {
            await message.reply('🤖 Menganalisis data keuangan Anda untuk memberikan saran...');

            const userContext = await this.reportService.getUserContext(userPhone);
            const balance = await this.db.getBalance(userPhone);
            const recentTransactions = await this.db.getTransactions(userPhone, 20);

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startDate = thirtyDaysAgo.toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];
            
            const monthlyTransactions = await this.db.getTransactionsByDateRange(userPhone, startDate, endDate);
            const spendingAnalysis = this.analyzeSpendingPatterns(monthlyTransactions, balance);
            const advice = await this.ai.generateFinancialAdvice(userContext, balance, spendingAnalysis);

            const response = `💡 *Saran Keuangan Personal*\n\n` +
                `📊 *Ringkasan Keuangan:*\n` +
                `💰 Saldo Bersih: ${this.formatCurrency(balance.balance)}\n` +
                `📈 Total Pemasukan: ${this.formatCurrency(balance.income)}\n` +
                `📉 Total Pengeluaran: ${this.formatCurrency(balance.expenses)}\n\n` +
                `🤖 *Saran AI:*\n${advice}\n\n` +
                `💡 *Tips:* Gunakan /analisis untuk analisis mendalam atau /chat untuk konsultasi lebih lanjut.`;

            await message.reply(response);
        } catch (error) {
            console.error('Error generating advice:', error);
            await message.reply('❌ Gagal membuat saran: ' + error.message);
        }
    }

    async handleAIPrediction(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }

        try {
            await message.reply('🔮 Menganalisis pola transaksi untuk prediksi keuangan...');

            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const startDate = sixtyDaysAgo.toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];
            
            const historicalTransactions = await this.db.getTransactionsByDateRange(userPhone, startDate, endDate);
            const balance = await this.db.getBalance(userPhone);

            if (historicalTransactions.length < 10) {
                await message.reply(
                    '📊 *Prediksi AI*\n\n' +
                    '⚠️ Data transaksi belum cukup untuk membuat prediksi yang akurat.\n\n' +
                    '💡 *Saran:* Lakukan minimal 10 transaksi dalam 60 hari terakhir untuk mendapatkan prediksi yang lebih baik.\n\n' +
                    `📈 Transaksi saat ini: ${historicalTransactions.length}/10`
                );
                return;
            }

            const patterns = this.analyzePredictionPatterns(historicalTransactions);
            const prediction = await this.ai.generateFinancialPrediction(historicalTransactions, balance, patterns);

            const response = `🔮 *Prediksi Keuangan AI*\n\n` +
                `📊 *Analisis Historik (60 hari):*\n` +
                `💳 Total Transaksi: ${historicalTransactions.length}\n` +
                `📈 Rata-rata Mingguan: ${this.formatCurrency(875000)} (masuk) | ${this.formatCurrency(420000)} (keluar)\n` +
                `📉 Trend Bulanan: naik 12.5%\n\n` +
                `🤖 *Prediksi AI:*\n${prediction}\n\n` +
                `⚠️ *Disclaimer:* Prediksi berdasarkan pola historis dan dapat berubah sesuai kondisi.`;

            await message.reply(response);
        } catch (error) {
            console.error('Error generating AI prediction:', error);
            await message.reply('❌ Gagal membuat prediksi: ' + error.message);
        }
    }

    async handleAISummary(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }

        try {
            await message.reply('📋 Membuat ringkasan keuangan dengan AI...');

            const period = args[0] || 'bulanan';
            const now = new Date();
            let startDate, endDate;
            
            if (period === 'mingguan') {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                startDate = weekStart.toISOString().split('T')[0];
                endDate = now.toISOString().split('T')[0];
            } else if (period === 'harian') {
                startDate = endDate = now.toISOString().split('T')[0];
            } else {
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate = monthStart.toISOString().split('T')[0];
                endDate = now.toISOString().split('T')[0];
            }

            const transactions = await this.db.getTransactionsByDateRange(userPhone, startDate, endDate);
            const balance = await this.db.getBalance(userPhone);

            if (transactions.length === 0) {
                await message.reply(
                    `📋 *Ringkasan AI - ${this.getPeriodName(period)}*\n\n` +
                    '📊 Tidak ada transaksi pada periode ini.\n\n' +
                    '💡 Mulai mencatat transaksi untuk mendapatkan ringkasan yang bermakna.'
                );
                return;
            }

            const periodAnalysis = this.analyzePeriodData(transactions, startDate, endDate);
            const summary = await this.ai.generateFinancialSummary(transactions, balance, periodAnalysis, period);

            const periodIncome = 3500000;
            const periodExpenses = 1680000;
            const periodBalance = periodIncome - periodExpenses;
            const topCategories = this.getTopExpenseCategories(transactions.filter(t => t.type === 'expense'));

            const response = `📋 *Ringkasan AI - ${this.getPeriodName(period)}*\n\n` +
                `📊 *Metrik Periode:*\n` +
                `📈 Pemasukan: ${this.formatCurrency(periodIncome)}\n` +
                `📉 Pengeluaran: ${this.formatCurrency(periodExpenses)}\n` +
                `💵 Selisih: ${this.formatCurrency(periodBalance)}\n` +
                `🔢 Total Transaksi: ${transactions.length}\n\n` +
                `🏷️ *Kategori Teratas:*\n${topCategories}\n\n` +
                `🤖 *Ringkasan AI:*\n${summary}\n\n` +
                `💡 *Tips:* Gunakan /saran untuk rekomendasi atau /prediksi-ai untuk prediksi masa depan.`;

            await message.reply(response);
        } catch (error) {
            console.error('Error generating AI summary:', error);
            await message.reply('❌ Gagal membuat ringkasan: ' + error.message);
        }
    }

    async handleAutoCategory(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }

        try {
            await message.reply('🤖 Menganalisis dan mengkategorikan transaksi dengan AI...');

            const recentTransactions = await this.db.getTransactions(userPhone, 50);
            const categories = await this.db.getCategories(userPhone);

            if (recentTransactions.length === 0) {
                await message.reply(
                    '🏷️ *Auto Kategorisasi AI*\n\n' +
                    '📊 Tidak ada transaksi yang perlu dikategorisasi.\n\n' +
                    '💡 Tambahkan beberapa transaksi terlebih dahulu.'
                );
                return;
            }

            // Simulate suggestions
            const suggestedChanges = [
                {
                    transaction: recentTransactions[0],
                    suggested: { 
                        category: { id: 1, name: 'Makanan' }, 
                        confidence: 0.92,
                        reasoning: 'Kata "warteg" mengindikasikan makanan'
                    },
                    current: 'Lainnya'
                },
                {
                    transaction: recentTransactions[1],
                    suggested: { 
                        category: { id: 2, name: 'Transportasi' }, 
                        confidence: 0.95,
                        reasoning: 'Kata "bensin" jelas kategori transportasi'
                    },
                    current: 'Lainnya'
                }
            ];

            if (suggestedChanges.length === 0) {
                await message.reply(
                    '🏷️ *Auto Kategorisasi AI*\n\n' +
                    '✅ Semua transaksi terbaru sudah dikategorikan dengan baik!\n\n' +
                    `📊 Dianalisis: ${Math.min(recentTransactions.length, 10)} transaksi terbaru\n` +
                    '🤖 Tidak ada saran perubahan kategori.\n\n' +
                    '💡 AI akan terus memantau dan memberikan saran untuk transaksi baru.'
                );
                return;
            }

            let response = `🏷️ *Auto Kategorisasi AI*\n\n`;
            response += `📊 *Saran Perubahan Kategori:*\n\n`;

            suggestedChanges.forEach((change, index) => {
                const confidencePercent = Math.round(change.suggested.confidence * 100);
                response += `${index + 1}. 💳 **${change.transaction.description}**\n`;
                response += `   💰 ${this.formatCurrency(change.transaction.amount)}\n`;
                response += `   🔄 ${change.current} → **${change.suggested.category.name}**\n`;
                response += `   🤖 Keyakinan: ${confidencePercent}%\n`;
                response += `   🆔 ID: ${change.transaction.id}\n\n`;
            });

            response += `💡 *Cara Menggunakan:*\n`;
            response += `• Gunakan /edit [ID] untuk mengubah kategori\n`;
            response += `• Contoh: /edit ${suggestedChanges[0].transaction.id}\n\n`;
            response += `🔄 *Auto-Apply:* Ketik "apply auto" untuk menerapkan semua saran dengan keyakinan >90%`;

            await message.reply(response);
        } catch (error) {
            console.error('Error in auto categorization:', error);
            await message.reply('❌ Gagal melakukan kategorisasi otomatis: ' + error.message);
        }
    }

    async handleAutoCategorizationApply(message, userPhone, text) {
        const lowerText = text.toLowerCase().trim();
        
        if (lowerText === 'apply auto' || lowerText === 'terapkan auto' || lowerText === 'apply all') {
            try {
                // Simulate applying categorization
                await message.reply(`🤖 Menerapkan 2 saran kategorisasi dengan keyakinan tinggi...`);

                const response = `✅ *Auto Kategorisasi Selesai!*\n\n` +
                    `📊 **Hasil:**\n` +
                    `✅ Berhasil: 2\n` +
                    `❌ Gagal: 0\n\n` +
                    `🏷️ **Perubahan yang Diterapkan:**\n` +
                    `1. Makan siang di warteg\n` +
                    `   🔄 Lainnya → **Makanan**\n` +
                    `2. Bensin motor\n` +
                    `   🔄 Lainnya → **Transportasi**\n\n` +
                    `💡 **Tips:** Gunakan /saldo atau /laporan untuk melihat hasil perubahan.`;

                await message.reply(response);
                return true;
            } catch (error) {
                console.error('Error applying auto categorization:', error);
                await message.reply('❌ Gagal menerapkan kategorisasi otomatis: ' + error.message);
                return true;
            }
        }

        return false;
    }
}

// Test scenarios
async function testAIFeatures() {
    console.log('🧪 Testing AI Features Implementation');
    console.log('=' + '='.repeat(80));

    const handler = new MockCommandHandler();
    const userPhone = '+6281234567890';

    console.log('\n💡 Test 1: AI Financial Advice');
    const message1 = createMockMessage('/saran');
    await handler.handleAdvice(message1, userPhone, []);

    console.log('\n🔮 Test 2: AI Financial Prediction');
    const message2 = createMockMessage('/prediksi-ai');
    await handler.handleAIPrediction(message2, userPhone, []);

    console.log('\n📋 Test 3: AI Summary (Monthly)');
    const message3 = createMockMessage('/ringkasan-ai bulanan');
    await handler.handleAISummary(message3, userPhone, ['bulanan']);

    console.log('\n📋 Test 4: AI Summary (Weekly)');
    const message4 = createMockMessage('/ringkasan-ai mingguan');
    await handler.handleAISummary(message4, userPhone, ['mingguan']);

    console.log('\n🏷️ Test 5: Auto Categorization');
    const message5 = createMockMessage('/kategori-otomatis');
    await handler.handleAutoCategory(message5, userPhone, []);

    console.log('\n🔄 Test 6: Apply Auto Categorization');
    const message6 = createMockMessage('apply auto');
    await handler.handleAutoCategorizationApply(message6, userPhone, 'apply auto');

    console.log('\n⚠️ Test 7: Insufficient Data for Prediction');
    // Simulate insufficient data
    const originalGetTransactionsByDateRange = handler.db.getTransactionsByDateRange;
    handler.db.getTransactionsByDateRange = async () => []; // Return empty array
    
    const message7 = createMockMessage('/prediksi-ai');
    await handler.handleAIPrediction(message7, userPhone, []);
    
    // Restore original method
    handler.db.getTransactionsByDateRange = originalGetTransactionsByDateRange;

    console.log('\n📊 Test 8: AI Summary with No Data');
    handler.db.getTransactionsByDateRange = async () => [];
    const message8 = createMockMessage('/ringkasan-ai harian');
    await handler.handleAISummary(message8, userPhone, ['harian']);

    console.log('\n✅ All AI features tests completed!');
}

// Run tests
if (require.main === module) {
    testAIFeatures().catch(console.error);
}

module.exports = { testAIFeatures };