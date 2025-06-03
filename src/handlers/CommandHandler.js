const Logger = require('../utils/Logger');
const TransactionService = require('../services/TransactionService');
const ReportService = require('../services/ReportService');
const DebtService = require('../services/DebtService');
const CategoryService = require('../services/CategoryService');
const moment = require('moment');

class CommandHandler {
    constructor(database, aiService, client) {
        this.db = database;
        this.ai = aiService;
        this.client = client;
        this.logger = new Logger();
        
        // Initialize services
        this.transactionService = new TransactionService(database, aiService);
        this.reportService = new ReportService(database, aiService);
        this.debtService = new DebtService(database);
        this.categoryService = new CategoryService(database);
        
        // Command mappings
        this.commands = {
            // Income commands
            '/masuk': this.handleIncome.bind(this),
            '/income': this.handleIncome.bind(this),
            
            // Expense commands
            '/keluar': this.handleExpense.bind(this),
            '/expense': this.handleExpense.bind(this),
            
            // Debt/receivable commands
            '/hutang': this.handleDebt.bind(this),
            '/debt': this.handleDebt.bind(this),
            '/bayar-hutang': this.handlePayDebt.bind(this),
            '/pay-debt': this.handlePayDebt.bind(this),
            
            // Bill commands
            '/tagihan': this.handleBill.bind(this),
            '/bill': this.handleBill.bind(this),
            
            // Balance and reporting
            '/saldo': this.handleBalance.bind(this),
            '/balance': this.handleBalance.bind(this),
            '/laporan': this.handleReport.bind(this),
            '/report': this.handleReport.bind(this),
            
            // Categories
            '/kategori': this.handleCategories.bind(this),
            '/categories': this.handleCategories.bind(this),
            '/kategori-baru': this.handleNewCategory.bind(this),
            '/new-category': this.handleNewCategory.bind(this),
            
            // Debt management
            '/hutang-list': this.handleListDebts.bind(this),
            '/debt-list': this.handleListDebts.bind(this),
            
            // AI features
            '/analisis': this.handleAnalysis.bind(this),
            '/analysis': this.handleAnalysis.bind(this),
            '/saran': this.handleAdvice.bind(this),
            '/advice': this.handleAdvice.bind(this),
            '/chat': this.handleAIChat.bind(this),
            '/prediksi-ai': this.handleAIPrediction.bind(this),
            '/ai-prediction': this.handleAIPrediction.bind(this),
            '/ringkasan-ai': this.handleAISummary.bind(this),
            '/ai-summary': this.handleAISummary.bind(this),
            '/kategori-otomatis': this.handleAutoCategory.bind(this),
            '/auto-category': this.handleAutoCategory.bind(this),
            
            // Data management
            '/edit': this.handleEdit.bind(this),
            '/hapus': this.handleDelete.bind(this),
            '/delete': this.handleDelete.bind(this),
            '/backup': this.handleBackup.bind(this),
            '/export': this.handleExport.bind(this),
            
            // Predictions
            '/prediksi': this.handlePrediction.bind(this),
            '/prediction': this.handlePrediction.bind(this),
            
            // Help
            '/help': this.handleHelp.bind(this),
            '/bantuan': this.handleHelp.bind(this),
            '/start': this.handleHelp.bind(this)
        };
    }

    async handleMessage(message) {
        try {
            const userPhone = message.from.replace('@c.us', '');
            const text = message.body.trim();
            
            // Ensure user exists in database
            await this.db.createUser(userPhone);
            
            // Check if user has pending transaction confirmation
            if (await this.handlePendingTransaction(message, userPhone, text)) {
                return;
            }
            
            // Check if it's a command
            if (text.startsWith('/')) {
                await this.handleCommand(message, userPhone, text);
            } else if (this.ai.isAvailable()) {
                // Try to parse as natural language transaction
                await this.handleNaturalLanguage(message, userPhone, text);
            } else {
                await message.reply('🤖 Kirim /bantuan untuk melihat perintah yang tersedia.');
            }
            
        } catch (error) {
            this.logger.error('Error handling message:', error);
            await message.reply('❌ Terjadi kesalahan. Silakan coba lagi atau hubungi support.');
        }
    }

    async handleCommand(message, userPhone, text) {
        const parts = text.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        const handler = this.commands[command];
        if (handler) {
            await handler(message, userPhone, args);
        } else {
            await message.reply(`❓ Perintah tidak dikenal: ${command}\nKirim /bantuan untuk melihat perintah yang tersedia.`);
        }
    }

    async handleNaturalLanguage(message, userPhone, text) {
        try {
            const parsed = await this.ai.parseNaturalLanguageTransaction(text, userPhone);
            
            if (parsed && parsed.confidence > 0.7) {
                // Check if category is unknown or needs confirmation
                if (parsed.category === 'unknown' || !parsed.category) {
                    await this.askForCategory(message, userPhone, parsed);
                    return;
                }

                // Auto-process high confidence transactions with known category
                const categories = await this.db.getCategories(userPhone, parsed.type);
                const category = categories.find(c =>
                    c.name.toLowerCase() === parsed.category.toLowerCase() ||
                    c.name.toLowerCase().includes(parsed.category.toLowerCase()) ||
                    parsed.category.toLowerCase().includes(c.name.toLowerCase())
                ) || categories[0];
                
                const transactionId = await this.db.addTransaction(
                    userPhone,
                    parsed.type,
                    parsed.amount,
                    category?.id,
                    parsed.description
                );
                
                const response = `✅ Transaksi berhasil ditambahkan!\n\n` +
                    `💰 ${parsed.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${this.formatCurrency(parsed.amount)}\n` +
                    `📝 Deskripsi: ${parsed.description}\n` +
                    `🏷️ Kategori: ${category?.name || 'Lainnya'}\n` +
                    `🆔 ID: ${transactionId}\n\n` +
                    `Tingkat Keyakinan AI: ${Math.round(parsed.confidence * 100)}%`;
                
                await message.reply(response);
            } else if (parsed && parsed.confidence > 0.4) {
                // Ask for confirmation on medium confidence
                if (parsed.category === 'unknown' || !parsed.category) {
                    await this.askForCategory(message, userPhone, parsed);
                    return;
                }

                const response = `🤔 Saya rasa Anda ingin menambah transaksi. Apakah ini benar?\n\n` +
                    `💰 ${parsed.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${this.formatCurrency(parsed.amount)}\n` +
                    `📝 Deskripsi: ${parsed.description}\n` +
                    `🏷️ Kategori: ${parsed.category}\n\n` +
                    `Balas dengan "ya" untuk konfirmasi atau gunakan perintah seperti:\n` +
                    `/${parsed.type === 'income' ? 'masuk' : 'keluar'} ${parsed.amount} ${parsed.description}`;
                
                await message.reply(response);
            } else {
                await message.reply('🤖 Saya tidak mengerti. Kirim /bantuan untuk melihat perintah yang tersedia.');
            }
        } catch (error) {
            this.logger.error('Error handling natural language:', error);
            await message.reply('🤖 Kirim /bantuan untuk melihat perintah yang tersedia.');
        }
    }

    // Income handling
    async handleIncome(message, userPhone, args) {
        if (args.length < 2) {
            await message.reply('📝 Cara pakai: /masuk [jumlah] [deskripsi] [kategori]\nContoh: /masuk 500000 bayaran klien freelance');
            return;
        }

        const amount = parseFloat(args[0]);
        if (isNaN(amount) || amount <= 0) {
            await message.reply('❌ Silakan masukkan jumlah yang valid.');
            return;
        }

        const description = args.slice(1, -1).join(' ') || args.slice(1).join(' ');
        const categoryName = args.length > 2 ? args[args.length - 1] : null;

        try {
            const result = await this.transactionService.addIncome(userPhone, amount, description, categoryName);
            
            const response = `✅ Pemasukan berhasil ditambahkan!\n\n` +
                `💰 Jumlah: ${this.formatCurrency(amount)}\n` +
                `📝 Deskripsi: ${description}\n` +
                `🏷️ Kategori: ${result.categoryName}\n` +
                `🆔 ID Transaksi: ${result.transactionId}\n` +
                `📅 Tanggal: ${moment().format('DD/MM/YYYY')}`;
            
            await message.reply(response);
        } catch (error) {
            await message.reply('❌ Gagal menambah pemasukan: ' + error.message);
        }
    }

    // Expense handling
    async handleExpense(message, userPhone, args) {
        if (args.length < 2) {
            await message.reply('📝 Cara pakai: /keluar [jumlah] [deskripsi] [kategori]\nContoh: /keluar 50000 makan siang makanan');
            return;
        }

        const amount = parseFloat(args[0]);
        if (isNaN(amount) || amount <= 0) {
            await message.reply('❌ Silakan masukkan jumlah yang valid.');
            return;
        }

        const description = args.slice(1, -1).join(' ') || args.slice(1).join(' ');
        const categoryName = args.length > 2 ? args[args.length - 1] : null;

        try {
            const result = await this.transactionService.addExpense(userPhone, amount, description, categoryName);
            
            const response = `✅ Pengeluaran berhasil ditambahkan!\n\n` +
                `💸 Jumlah: ${this.formatCurrency(amount)}\n` +
                `📝 Deskripsi: ${description}\n` +
                `🏷️ Kategori: ${result.categoryName}\n` +
                `🆔 ID Transaksi: ${result.transactionId}\n` +
                `📅 Tanggal: ${moment().format('DD/MM/YYYY')}`;
            
            await message.reply(response);
        } catch (error) {
            await message.reply('❌ Gagal menambah pengeluaran: ' + error.message);
        }
    }

    // Balance handling
    async handleBalance(message, userPhone, args) {
        try {
            const balance = await this.db.getBalance(userPhone);
            const recentTransactions = await this.db.getTransactions(userPhone, 5);
            
            let response = `💰 *Saldo Saat Ini*\n\n`;
            response += `📈 Total Pemasukan: ${this.formatCurrency(balance.income)}\n`;
            response += `📉 Total Pengeluaran: ${this.formatCurrency(balance.expenses)}\n`;
            response += `💵 Saldo Bersih: ${this.formatCurrency(balance.balance)}\n\n`;
            
            if (recentTransactions.length > 0) {
                response += `📋 *Transaksi Terbaru:*\n`;
                recentTransactions.forEach((t, i) => {
                    const emoji = t.type === 'income' ? '📈' : '📉';
                    response += `${emoji} ${this.formatCurrency(t.amount)} - ${t.description}\n`;
                });
            }
            
            await message.reply(response);
        } catch (error) {
            await message.reply('❌ Gagal mendapatkan saldo: ' + error.message);
        }
    }

    // Report handling
    async handleReport(message, userPhone, args) {
        try {
            const period = args[0] || 'bulanan';
            const report = await this.reportService.generateReport(userPhone, period);
            
            await message.reply(report);
        } catch (error) {
            await message.reply('❌ Gagal membuat laporan: ' + error.message);
        }
    }

    // AI Analysis
    async handleAnalysis(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }

        try {
            await message.reply('🔍 Menganalisis data keuangan Anda...');
            
            const analysis = await this.reportService.generateAIAnalysis(userPhone);
            await message.reply(analysis);
        } catch (error) {
            await message.reply('❌ Gagal membuat analisis: ' + error.message);
        }
    }

    // AI Chat
    async handleAIChat(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }

        if (args.length === 0) {
            await message.reply('💬 Cara pakai: /chat [pertanyaan Anda]\nContoh: /chat Bagaimana cara mengurangi pengeluaran saya?');
            return;
        }

        try {
            const question = args.join(' ');
            const userContext = await this.reportService.getUserContext(userPhone);
            
            await message.reply('🤖 Sedang berpikir...');
            
            const response = await this.ai.answerFinancialQuestion(question, userContext);
            await this.ai.logInteraction(userPhone, question, response, 'chat');
            
            await message.reply(`💬 *Asisten AI:*\n\n${response}`);
        } catch (error) {
            await message.reply('❌ Gagal mendapatkan respons AI: ' + error.message);
        }
    }

    // Categories
    async handleCategories(message, userPhone, args) {
        try {
            const type = args[0]; // 'income' or 'expense'
            const categories = await this.db.getCategories(userPhone, type);
            
            let response = `🏷️ *Kategori*\n\n`;
            
            const incomeCategories = categories.filter(c => c.type === 'income');
            const expenseCategories = categories.filter(c => c.type === 'expense');
            
            if (incomeCategories.length > 0) {
                response += `📈 *Kategori Pemasukan:*\n`;
                incomeCategories.forEach(cat => {
                    response += `• ${cat.name}\n`;
                });
                response += '\n';
            }
            
            if (expenseCategories.length > 0) {
                response += `📉 *Kategori Pengeluaran:*\n`;
                expenseCategories.forEach(cat => {
                    response += `• ${cat.name}\n`;
                });
            }
            
            await message.reply(response);
        } catch (error) {
            await message.reply('❌ Gagal mendapatkan kategori: ' + error.message);
        }
    }

    // Help
    async handleHelp(message, userPhone, args) {
        const helpText = `🤖 *Bot Keuangan WhatsApp - Panduan Lengkap*

📊 *PERINTAH DASAR:*

💰 *Tambah Pemasukan:*
• /masuk [jumlah] [deskripsi] [kategori]
  Contoh: /masuk 5000000 gaji bulanan gaji
  Contoh: /masuk 1500000 proyek website freelance
  Contoh: /masuk 500000 bonus kerja

💸 *Tambah Pengeluaran:*
• /keluar [jumlah] [deskripsi] [kategori]
  Contoh: /keluar 50000 makan siang makanan
  Contoh: /keluar 100000 bensin motor transportasi
  Contoh: /keluar 150000 tagihan listrik utilitas

📊 *Cek Saldo & Laporan:*
• /saldo - Lihat saldo saat ini
• /laporan harian - Laporan harian
• /laporan mingguan - Laporan mingguan
• /laporan bulanan - Laporan bulanan
• /laporan tahunan - Laporan tahunan

🏷️ *MANAJEMEN KATEGORI:*

• /kategori - Lihat semua kategori tersedia
• /kategori-baru nama jenis - Buat kategori baru
  Contoh: /kategori-baru "Kopi Harian" expense

📝 *Kategori Default:*
*Pemasukan:* Gaji, Freelance, Bisnis, Investasi
*Pengeluaran:* Makanan, Transportasi, Utilitas, Hiburan, Kesehatan, Belanja

🤖 *FITUR AI CANGGIH:*

💬 *Chat dengan AI:*
• /chat [pertanyaan keuangan]
  Contoh: /chat Bagaimana cara menghemat pengeluaran?
  Contoh: /chat Apakah pengeluaran saya normal?
  Contoh: /chat Tips investasi untuk pemula

🔍 *Analisis AI:*
• /analisis - Analisis pola keuangan mendalam
• /saran - Saran keuangan personal
• /prediksi-ai - Prediksi arus kas masa depan

💡 *BAHASA NATURAL (FITUR UNGGULAN):*

Ketik seperti berbicara normal, AI akan otomatis memproses:

*Contoh Pemasukan:*
• "Terima 5 juta gaji bulan ini"
• "Dapat 1.5 juta dari proyek klien"
• "Bonus kerja 500 ribu"

*Contoh Pengeluaran:*
• "Saya habis 50000 untuk makan siang"
• "Beli bensin 100 ribu"
• "Bayar listrik 150000"
• "Belanja groceries 200000"
• "Beli kopi 25000"

*Jika AI tidak yakin kategori:*
Bot akan bertanya kategori yang tepat dengan pilihan menu!

💳 *MANAJEMEN HUTANG:*

• /hutang [jumlah] [nama_klien] [deskripsi] [tanggal_jatuh_tempo]
  Contoh: /hutang 2000000 "PT ABC" "Pembuatan website" "2024-12-31"

• /bayar-hutang [nama_klien] [jumlah]
  Contoh: /bayar-hutang "PT ABC" 1000000

• /hutang-list - Lihat semua hutang

📋 *MANAJEMEN DATA:*

• /edit [id] - Edit transaksi
• /hapus [id] - Hapus transaksi
• /backup - Backup data ke file
• /export - Export ke format CSV

⚡ *TIPS PENGGUNAAN:*

1. *Gunakan Bahasa Natural* - Lebih mudah dan cepat!
2. *Konsisten dengan Kategori* - Untuk laporan yang akurat
3. *Cek Saldo Rutin* - Pantau keuangan harian
4. *Manfaatkan AI Chat* - Untuk konsultasi keuangan
5. *Backup Berkala* - Jaga keamanan data

🆘 *BUTUH BANTUAN LEBIH?*
Ketik: "Bagaimana cara..." atau "Tolong jelaskan..."
AI siap membantu 24/7! 😊

💰 *Mulai sekarang untuk hidup finansial yang lebih teratur!*`;

        await message.reply(helpText);
    }

    async askForCategory(message, userPhone, parsed) {
        try {
            const categories = await this.db.getCategories(userPhone, parsed.type);
            const typeCategories = categories.filter(c => c.type === parsed.type);
            
            let response = `🤔 Saya deteksi transaksi berikut:\n\n` +
                `💰 ${parsed.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${this.formatCurrency(parsed.amount)}\n` +
                `📝 Deskripsi: ${parsed.description}\n\n` +
                `Namun saya tidak yakin dengan kategorinya. Silakan pilih kategori yang sesuai:\n\n`;

            typeCategories.forEach((cat, index) => {
                response += `${index + 1}. ${cat.name}\n`;
            });

            response += `\nBalas dengan nomor kategori yang sesuai (1-${typeCategories.length}), atau ketik nama kategori secara langsung.`;

            // Store pending transaction for user confirmation
            if (!global.pendingTransactions) {
                global.pendingTransactions = new Map();
            }
            
            global.pendingTransactions.set(userPhone, {
                ...parsed,
                categories: typeCategories,
                timestamp: Date.now()
            });

            await message.reply(response);
        } catch (error) {
            this.logger.error('Error asking for category:', error);
            await message.reply('❌ Terjadi kesalahan. Silakan coba lagi atau gunakan perintah manual.');
        }
    }

    async handlePendingTransaction(message, userPhone, text) {
        try {
            if (!global.pendingTransactions || !global.pendingTransactions.has(userPhone)) {
                return false;
            }

            const pending = global.pendingTransactions.get(userPhone);
            
            // Check if pending transaction is too old (5 minutes)
            if (Date.now() - pending.timestamp > 300000) {
                global.pendingTransactions.delete(userPhone);
                await message.reply('⏰ Waktu konfirmasi kategori habis. Silakan ulangi transaksi.');
                return true;
            }

            let selectedCategory = null;

            // Check if user sent a number
            const categoryIndex = parseInt(text.trim()) - 1;
            if (!isNaN(categoryIndex) && categoryIndex >= 0 && categoryIndex < pending.categories.length) {
                selectedCategory = pending.categories[categoryIndex];
            } else {
                // Check if user typed category name
                selectedCategory = pending.categories.find(c =>
                    c.name.toLowerCase().includes(text.toLowerCase()) ||
                    text.toLowerCase().includes(c.name.toLowerCase())
                );
            }

            if (selectedCategory) {
                // Add the transaction with selected category
                const transactionId = await this.db.addTransaction(
                    userPhone,
                    pending.type,
                    pending.amount,
                    selectedCategory.id,
                    pending.description
                );

                const response = `✅ Transaksi berhasil ditambahkan!\n\n` +
                    `💰 ${pending.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${this.formatCurrency(pending.amount)}\n` +
                    `📝 Deskripsi: ${pending.description}\n` +
                    `🏷️ Kategori: ${selectedCategory.name}\n` +
                    `🆔 ID: ${transactionId}`;

                await message.reply(response);
                global.pendingTransactions.delete(userPhone);
                return true;
            } else {
                await message.reply('❌ Kategori tidak valid. Silakan pilih nomor yang benar atau ketik nama kategori yang ada.');
                return true;
            }
        } catch (error) {
            this.logger.error('Error handling pending transaction:', error);
            await message.reply('❌ Terjadi kesalahan. Silakan coba lagi.');
            if (global.pendingTransactions) {
                global.pendingTransactions.delete(userPhone);
            }
            return true;
        }
    }

    // Utility methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }

    // Placeholder methods for other commands
    async handleDebt(message, userPhone, args) {
        await message.reply('🚧 Fitur manajemen hutang akan segera hadir!');
    }

    async handlePayDebt(message, userPhone, args) {
        await message.reply('🚧 Fitur pembayaran hutang akan segera hadir!');
    }

    async handleBill(message, userPhone, args) {
        await message.reply('🚧 Fitur manajemen tagihan akan segera hadir!');
    }

    async handleListDebts(message, userPhone, args) {
        await message.reply('🚧 Fitur daftar hutang akan segera hadir!');
    }

    async handleAdvice(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }
        await message.reply('🚧 Fitur saran AI akan segera hadir!');
    }

    async handleAIPrediction(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }
        await message.reply('🚧 Fitur prediksi AI akan segera hadir!');
    }

    async handleAISummary(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }
        await message.reply('🚧 Fitur ringkasan AI akan segera hadir!');
    }

    async handleAutoCategory(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }
        await message.reply('🚧 Fitur kategorisasi otomatis akan segera hadir!');
    }

    async handleNewCategory(message, userPhone, args) {
        await message.reply('🚧 Fitur kategori baru akan segera hadir!');
    }

    async handleEdit(message, userPhone, args) {
        await message.reply('🚧 Fitur edit transaksi akan segera hadir!');
    }

    async handleDelete(message, userPhone, args) {
        await message.reply('🚧 Fitur hapus transaksi akan segera hadir!');
    }

    async handleBackup(message, userPhone, args) {
        await message.reply('🚧 Fitur backup akan segera hadir!');
    }

    async handleExport(message, userPhone, args) {
        await message.reply('🚧 Fitur ekspor akan segera hadir!');
    }

    async handlePrediction(message, userPhone, args) {
        await message.reply('🚧 Fitur prediksi arus kas akan segera hadir!');
    }
}

module.exports = CommandHandler;