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
            
            // Search transactions
            '/cari': this.handleSearch.bind(this),
            '/search': this.handleSearch.bind(this),
            
            // Predictions
            '/prediksi': this.handlePrediction.bind(this),
            '/prediction': this.handlePrediction.bind(this),
            
            // Help
            '/help': this.handleHelp.bind(this),
            '/bantuan': this.handleHelp.bind(this),
            '/start': this.handleMainMenu.bind(this),
            '/bantuan-ai': this.handleAIHelp.bind(this),
            '/help-ai': this.handleAIHelp.bind(this),
            '/contoh': this.handleExamples.bind(this),
            '/examples': this.handleExamples.bind(this),
            '/menu': this.handleMainMenu.bind(this)
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
            
            // Check if user has pending edit session
            if (await this.handleEditSession(message, userPhone, text)) {
                return;
            }
            
            // Check if user has pending delete confirmation
            if (await this.handleDeleteConfirmation(message, userPhone, text)) {
                return;
            }
            
            // Check if it's a command
            if (text.startsWith('/')) {
                await this.handleCommand(message, userPhone, text);
            } else if (this.ai.isAvailable()) {
                // Try to parse as natural language transaction
                await this.handleNaturalLanguage(message, userPhone, text);
            } else {
                await message.reply('🤖 Kirim /menu untuk melihat semua perintah atau /bantuan untuk panduan dasar.');
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
            await message.reply(`❓ Perintah tidak dikenal: ${command}\n\n📚 Kirim /menu untuk melihat semua perintah yang tersedia.\n📋 Atau /bantuan untuk panduan dasar.`);
        }
    }

    async handleNaturalLanguage(message, userPhone, text) {
        try {
            // First check if this might be an edit instruction
            if (await this.handleNaturalLanguageEdit(message, userPhone, text)) {
                return;
            }
            
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
                await message.reply('🤖 Saya tidak mengerti. Kirim /menu untuk melihat semua perintah atau /contoh untuk melihat contoh penggunaan.');
            }
        } catch (error) {
            this.logger.error('Error handling natural language:', error);
            await message.reply('🤖 Kirim /menu untuk melihat semua perintah atau /bantuan untuk panduan dasar.');
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
                    const date = this.formatDate(t.date);
                    response += `${emoji} ID:${t.id} | ${this.formatCurrency(t.amount)} | ${t.description}\n`;
                    response += `    📅 ${date} | 🏷️ ${t.category_name || 'Lainnya'}\n\n`;
                });
                response += `💡 *Tip:* Gunakan /edit [ID] untuk mengedit transaksi\nContoh: /edit ${recentTransactions[0].id}`;
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

    // Help - Main Menu
    async handleMainMenu(message, userPhone, args) {
        const menuText = `🤖 *Bot Keuangan WhatsApp - Menu Utama*

📚 *PANDUAN BANTUAN:*

📋 /bantuan - Panduan perintah dasar
🤖 /bantuan-ai - Panduan fitur AI & bahasa natural
📝 /contoh - Contoh-contoh penggunaan
💰 /saldo - Cek saldo & transaksi terbaru
📊 /laporan - Buat laporan keuangan

⚡ *PERINTAH CEPAT:*

💰 /masuk [jumlah] [deskripsi] - Tambah pemasukan
💸 /keluar [jumlah] [deskripsi] - Tambah pengeluaran
🔍 /cari [kata kunci] - Cari transaksi
✏️ /edit [id] - Edit transaksi
🗑️ /hapus [id] - Hapus transaksi

🆘 *BUTUH BANTUAN?*
Ketik: "Bagaimana cara..." atau pilih panduan di atas!

✨ *Tips:* Coba ketik dengan bahasa natural seperti "saya habis 50000 untuk makan siang" - AI akan otomatis memproses!`;

        await message.reply(menuText);
    }

    // Help - Basic Commands
    async handleHelp(message, userPhone, args) {
        const helpText = `📋 *Bot Keuangan - Panduan Perintah Dasar*

💰 *TAMBAH TRANSAKSI:*

• /masuk [jumlah] [deskripsi] [kategori]
  💡 Contoh: /masuk 5000000 gaji bulanan

• /keluar [jumlah] [deskripsi] [kategori]
  💡 Contoh: /keluar 50000 makan siang makanan

📊 *LIHAT DATA:*

• /saldo - Saldo & transaksi terbaru (dengan ID)
• /laporan [periode] - Laporan harian/mingguan/bulanan
• /kategori - Lihat semua kategori

🔍 *CARI & EDIT:*

• /cari [kata kunci] - Cari transaksi
• /edit [id] - Edit transaksi interaktif
• /hapus [id] - Hapus transaksi (dengan konfirmasi)

🏷️ *KATEGORI:*

*Pemasukan:* Gaji, Freelance, Bisnis, Investasi
*Pengeluaran:* Makanan, Transportasi, Utilitas, Hiburan

📚 *BANTUAN LANJUTAN:*

🤖 /bantuan-ai - Fitur AI & bahasa natural
📝 /contoh - Contoh penggunaan lengkap
🏠 /menu - Kembali ke menu utama

💡 *Tips Cepat:*
1. Gunakan /saldo untuk lihat ID transaksi
2. Edit langsung: "edit transaksi 123 ubah jumlah jadi 100000"
3. Ketik natural: "saya habis 25000 beli kopi"`;

        await message.reply(helpText);
    }

    // Help - AI Features
    async handleAIHelp(message, userPhone, args) {
        const aiHelpText = `🤖 *Bot Keuangan - Panduan Fitur AI*

💬 *CHAT DENGAN AI:*

• /chat [pertanyaan] - Konsultasi keuangan
• /analisis - Analisis pola keuangan AI
• /saran - Saran keuangan personal

💡 *BAHASA NATURAL (FITUR UNGGULAN):*

Ketik seperti berbicara normal, AI otomatis memproses!

✅ *Contoh Pemasukan:*
• "Terima 5 juta gaji bulan ini"
• "Dapat 1.5 juta dari proyek klien"
• "Bonus kerja 500 ribu"

✅ *Contoh Pengeluaran:*
• "Saya habis 50000 untuk makan siang"
• "Beli bensin 100 ribu"
• "Bayar listrik 150000"
• "Belanja groceries 200000"

🔧 *EDIT DENGAN AI:*

• "Edit transaksi 123 ubah jumlah jadi 75000"
• "Ubah deskripsi transaksi jadi makan malam"
• "Ganti kategori transaksi ke transportasi"
• "Ubah jumlah jadi 50000 dan kategori jadi makanan"

🤖 *BAGAIMANA AI BEKERJA:*

1. **Deteksi Otomatis** - AI mengenali jenis transaksi
2. **Smart Categorization** - AI sarankan kategori yang tepat
3. **Confidence Score** - Tingkat keyakinan AI (60-100%)
4. **Konfirmasi Interaktif** - Jika AI tidak yakin, akan bertanya

⚠️ *JIKA AI TIDAK YAKIN:*
Bot akan tampilkan menu kategori untuk dipilih!

🎯 *TIPS AI YANG EFEKTIF:*

✅ **DO:**
• Gunakan kalimat yang jelas dan spesifik
• Sebutkan angka tanpa titik/koma
• Gunakan nama kategori yang sudah ada
• Berikan konteks yang cukup

❌ **DON'T:**
• Kalimat terlalu singkat atau ambigu
• Campur multiple transaksi dalam satu pesan
• Gunakan singkatan yang tidak jelas

📚 *BANTUAN LAINNYA:*

📋 /bantuan - Perintah dasar
📝 /contoh - Contoh penggunaan
🏠 /menu - Menu utama

🚀 *Mulai gunakan AI untuk pengalaman yang lebih mudah!*`;

        await message.reply(aiHelpText);
    }

    // Examples
    async handleExamples(message, userPhone, args) {
        const examplesText = `📝 *Contoh Penggunaan Bot Keuangan*

💰 *CONTOH PEMASUKAN:*

\`\`\`
/masuk 5000000 gaji bulanan januari
/masuk 1500000 proyek website freelance
/masuk 500000 bonus kinerja
/masuk 2000000 hasil investasi saham
\`\`\`

💸 *CONTOH PENGELUARAN:*

\`\`\`
/keluar 50000 makan siang warteg
/keluar 100000 bensin motor shell
/keluar 150000 tagihan listrik pln
/keluar 75000 belanja sayuran pasar
/keluar 200000 bayar internet indihome
\`\`\`

🤖 *CONTOH BAHASA NATURAL:*

✅ **Pemasukan:**
• "Terima 3 juta gaji bulan ini"
• "Dapat 800000 dari klien kemarin"
• "Bonus lebaran 1.5 juta"

✅ **Pengeluaran:**
• "Saya habis 35000 beli kopi starbucks"
• "Bayar ojol 15000 ke kantor"
• "Belanja groceries 250000 di supermarket"
• "Makan pizza 120000 sama teman"

🔧 *CONTOH EDIT TRANSAKSI:*

\`\`\`
/edit 123
/cari makan siang
/hapus 456
\`\`\`

🤖 **Edit dengan AI:**
• "Edit transaksi 123 ubah jumlah jadi 65000"
• "Ubah deskripsi transaksi 456 jadi makan malam"
• "Ganti kategori transaksi 789 ke transportasi"

📊 *CONTOH LAPORAN:*

\`\`\`
/saldo
/laporan harian
/laporan mingguan
/laporan bulanan
/analisis
/chat Bagaimana pengeluaran saya bulan ini?
\`\`\`

🔍 *CONTOH PENCARIAN:*

\`\`\`
/cari makan
/cari starbucks
/cari 50000
/cari transportasi
/cari januari
\`\`\`

💬 *CONTOH CHAT AI:*

• "/chat Apakah pengeluaran saya normal?"
• "/chat Tips hemat untuk mahasiswa"
• "/chat Bagaimana cara budgeting yang baik?"
• "/chat Investasi apa yang cocok untuk pemula?"

📚 *KEMBALI KE BANTUAN:*

📋 /bantuan - Perintah dasar
🤖 /bantuan-ai - Fitur AI
🏠 /menu - Menu utama

💡 *Pro Tips:*
• Gunakan deskripsi yang jelas untuk tracking yang lebih baik
• Konsisten dengan nama kategori
• Manfaatkan fitur AI untuk input yang lebih cepat!`;

        await message.reply(examplesText);
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

    async handleNaturalLanguageEdit(message, userPhone, text) {
        if (!this.ai.isAvailable()) {
            return false;
        }

        try {
            // Keywords that might indicate edit intent
            const editKeywords = [
                'edit', 'ubah', 'ganti', 'perbaiki', 'koreksi', 'update',
                'edit transaksi', 'ubah transaksi', 'ganti transaksi',
                'perbaiki transaksi', 'koreksi transaksi', 'update transaksi',
                'rubah', 'betulkan', 'revisi'
            ];

            const lowerText = text.toLowerCase();
            const hasEditKeyword = editKeywords.some(keyword => lowerText.includes(keyword));

            if (!hasEditKeyword) {
                return false;
            }

            // Try to parse as edit instruction
            const editParsed = await this.ai.parseNaturalEdit(text, userPhone);
            
            if (!editParsed || editParsed.confidence < 0.6) {
                return false;
            }

            if (editParsed.needsTransactionId) {
                // Ask user to specify which transaction to edit
                const recentTransactions = await this.db.getTransactions(userPhone, 5);
                
                if (recentTransactions.length === 0) {
                    await message.reply('❌ Tidak ada transaksi untuk diedit. Silakan tambah transaksi terlebih dahulu.');
                    return true;
                }

                let response = `🤖 Saya mengerti Anda ingin mengedit transaksi, tapi perlu tahu transaksi yang mana.\n\n`;
                response += `📋 *Transaksi Terbaru:*\n`;
                
                recentTransactions.forEach((t, index) => {
                    const emoji = t.type === 'income' ? '📈' : '📉';
                    const date = this.formatDate(t.date);
                    response += `${index + 1}. ${emoji} ID:${t.id} | ${this.formatCurrency(t.amount)} | ${t.description}\n`;
                });

                response += `\nBalas dengan:\n`;
                response += `• ID transaksi yang ingin diedit (contoh: ${recentTransactions[0].id})\n`;
                response += `• Atau gunakan /edit [ID] untuk edit interaktif`;

                await message.reply(response);
                return true;
            }

            if (editParsed.transactionId) {
                // Apply the edit directly
                const transaction = await this.db.getTransactionById(editParsed.transactionId, userPhone);
                
                if (!transaction) {
                    await message.reply(`❌ Transaksi dengan ID ${editParsed.transactionId} tidak ditemukan.`);
                    return true;
                }

                await this.transactionService.updateTransaction(userPhone, editParsed.transactionId, editParsed.updates);
                
                const updatedTransaction = await this.db.getTransactionById(editParsed.transactionId, userPhone);
                
                const response = `✅ *Transaksi berhasil diperbarui dengan AI!*\n\n` +
                    `📊 *Perubahan:* ${editParsed.summary}\n\n` +
                    `📊 *Transaksi Terbaru:*\n` +
                    `💰 Jumlah: ${this.formatCurrency(updatedTransaction.amount)}\n` +
                    `📝 Deskripsi: ${updatedTransaction.description}\n` +
                    `🏷️ Kategori: ${updatedTransaction.category_name}\n` +
                    `📅 Tanggal: ${this.formatDate(updatedTransaction.date)}\n\n` +
                    `🤖 Tingkat keyakinan AI: ${Math.round(editParsed.confidence * 100)}%`;

                await message.reply(response);
                return true;
            }

            return false;

        } catch (error) {
            this.logger.error('Error handling natural language edit:', error);
            return false;
        }
    }

    async handleEditSession(message, userPhone, text) {
        try {
            if (!global.editSessions || !global.editSessions.has(userPhone)) {
                return false;
            }

            const session = global.editSessions.get(userPhone);
            
            // Check if edit session is too old (10 minutes)
            if (Date.now() - session.timestamp > 600000) {
                global.editSessions.delete(userPhone);
                await message.reply('⏰ Waktu edit transaksi habis. Silakan mulai lagi dengan /edit [id]');
                return true;
            }

            // Handle cancel
            if (text.toLowerCase().includes('batal') || text.toLowerCase().includes('cancel')) {
                global.editSessions.delete(userPhone);
                await message.reply('❌ Edit transaksi dibatalkan.');
                return true;
            }

            if (session.step === 'select_field') {
                return await this.handleFieldSelection(message, userPhone, text, session);
            } else if (session.step === 'edit_field') {
                return await this.handleFieldEdit(message, userPhone, text, session);
            } else if (session.step === 'ai_edit') {
                return await this.handleAIEdit(message, userPhone, text, session);
            }

            return false;
        } catch (error) {
            this.logger.error('Error handling edit session:', error);
            await message.reply('❌ Terjadi kesalahan saat mengedit transaksi.');
            if (global.editSessions) {
                global.editSessions.delete(userPhone);
            }
            return true;
        }
    }

    async handleFieldSelection(message, userPhone, text, session) {
        const choice = parseInt(text.trim());
        
        if (isNaN(choice) || choice < 1 || choice > 5) {
            await message.reply('❌ Pilihan tidak valid. Silakan pilih nomor 1-5.');
            return true;
        }

        session.step = choice === 5 ? 'ai_edit' : 'edit_field';
        session.editField = choice;
        session.timestamp = Date.now();

        let prompt = '';
        
        switch (choice) {
            case 1: // Amount
                prompt = `💰 *Edit Jumlah Transaksi*\n\n` +
                    `Jumlah saat ini: ${this.formatCurrency(session.transaction.amount)}\n\n` +
                    `Masukkan jumlah baru (hanya angka):`;
                break;
            case 2: // Description
                prompt = `📝 *Edit Deskripsi Transaksi*\n\n` +
                    `Deskripsi saat ini: ${session.transaction.description}\n\n` +
                    `Masukkan deskripsi baru:`;
                break;
            case 3: // Category
                const categories = await this.db.getCategories(userPhone, session.transaction.type);
                prompt = `🏷️ *Edit Kategori Transaksi*\n\n` +
                    `Kategori saat ini: ${session.transaction.category_name}\n\n` +
                    `Pilih kategori baru:\n`;
                
                categories.forEach((cat, index) => {
                    prompt += `${index + 1}. ${cat.name}\n`;
                });
                
                prompt += `\nBalas dengan nomor kategori (1-${categories.length}) atau ketik nama kategori:`;
                session.categories = categories;
                break;
            case 4: // Date
                prompt = `📅 *Edit Tanggal Transaksi*\n\n` +
                    `Tanggal saat ini: ${this.formatDate(session.transaction.date)}\n\n` +
                    `Masukkan tanggal baru (format: DD/MM/YYYY atau YYYY-MM-DD):`;
                break;
            case 5: // AI Edit
                prompt = `🤖 *Edit dengan AI*\n\n` +
                    `Transaksi saat ini:\n` +
                    `💰 ${this.formatCurrency(session.transaction.amount)}\n` +
                    `📝 ${session.transaction.description}\n` +
                    `🏷️ ${session.transaction.category_name}\n` +
                    `📅 ${this.formatDate(session.transaction.date)}\n\n` +
                    `Jelaskan perubahan yang ingin Anda buat dengan bahasa natural.\n` +
                    `Contoh: "ubah jumlah jadi 100000 dan deskripsi jadi makan malam"`;
                break;
        }

        global.editSessions.set(userPhone, session);
        await message.reply(prompt);
        return true;
    }

    async handleFieldEdit(message, userPhone, text, session) {
        const updates = {};
        let successMessage = '';

        try {
            switch (session.editField) {
                case 1: // Amount
                    const amount = parseFloat(text.replace(/[^\d.]/g, ''));
                    if (isNaN(amount) || amount <= 0) {
                        await message.reply('❌ Jumlah tidak valid. Masukkan angka yang benar.');
                        return true;
                    }
                    updates.amount = amount;
                    successMessage = `💰 Jumlah berhasil diubah menjadi ${this.formatCurrency(amount)}`;
                    break;

                case 2: // Description
                    if (text.trim().length === 0) {
                        await message.reply('❌ Deskripsi tidak boleh kosong.');
                        return true;
                    }
                    updates.description = text.trim();
                    successMessage = `📝 Deskripsi berhasil diubah menjadi "${text.trim()}"`;
                    break;

                case 3: // Category
                    let selectedCategory = null;
                    const categoryIndex = parseInt(text.trim()) - 1;
                    
                    if (!isNaN(categoryIndex) && categoryIndex >= 0 && categoryIndex < session.categories.length) {
                        selectedCategory = session.categories[categoryIndex];
                    } else {
                        selectedCategory = session.categories.find(c =>
                            c.name.toLowerCase().includes(text.toLowerCase()) ||
                            text.toLowerCase().includes(c.name.toLowerCase())
                        );
                    }

                    if (!selectedCategory) {
                        await message.reply('❌ Kategori tidak valid. Pilih nomor atau nama kategori yang tersedia.');
                        return true;
                    }
                    
                    updates.category_id = selectedCategory.id;
                    successMessage = `🏷️ Kategori berhasil diubah menjadi "${selectedCategory.name}"`;
                    break;

                case 4: // Date
                    const date = this.parseDate(text.trim());
                    if (!date) {
                        await message.reply('❌ Format tanggal tidak valid. Gunakan DD/MM/YYYY atau YYYY-MM-DD.');
                        return true;
                    }
                    updates.date = date;
                    successMessage = `📅 Tanggal berhasil diubah menjadi ${this.formatDate(date)}`;
                    break;
            }

            // Update transaction
            await this.transactionService.updateTransaction(userPhone, session.transactionId, updates);
            
            // Get updated transaction
            const updatedTransaction = await this.db.getTransactionById(session.transactionId, userPhone);
            
            const finalResponse = `✅ ${successMessage}\n\n` +
                `📊 *Transaksi Terbaru:*\n` +
                `💰 Jumlah: ${this.formatCurrency(updatedTransaction.amount)}\n` +
                `📝 Deskripsi: ${updatedTransaction.description}\n` +
                `🏷️ Kategori: ${updatedTransaction.category_name}\n` +
                `📅 Tanggal: ${this.formatDate(updatedTransaction.date)}`;

            await message.reply(finalResponse);
            global.editSessions.delete(userPhone);
            return true;

        } catch (error) {
            this.logger.error('Error updating transaction:', error);
            await message.reply('❌ Gagal memperbarui transaksi: ' + error.message);
            global.editSessions.delete(userPhone);
            return true;
        }
    }

    async handleAIEdit(message, userPhone, text, session) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia. Gunakan edit manual dengan /edit [id]');
            global.editSessions.delete(userPhone);
            return true;
        }

        try {
            await message.reply('🤖 Sedang memproses perubahan dengan AI...');

            const editInstructions = await this.ai.parseEditInstructions(
                text,
                session.transaction,
                userPhone
            );

            if (!editInstructions || editInstructions.confidence < 0.6) {
                await message.reply('❌ Maaf, saya tidak dapat memahami instruksi edit Anda. Silakan coba lagi dengan lebih spesifik.\n\nContoh: "ubah jumlah jadi 50000 dan kategori jadi makanan"');
                return true;
            }

            // Apply AI-suggested changes
            await this.transactionService.updateTransaction(userPhone, session.transactionId, editInstructions.updates);
            
            // Get updated transaction
            const updatedTransaction = await this.db.getTransactionById(session.transactionId, userPhone);
            
            const response = `✅ *Transaksi berhasil diperbarui dengan AI!*\n\n` +
                `📊 *Perubahan yang dibuat:*\n${editInstructions.summary}\n\n` +
                `📊 *Transaksi Terbaru:*\n` +
                `💰 Jumlah: ${this.formatCurrency(updatedTransaction.amount)}\n` +
                `📝 Deskripsi: ${updatedTransaction.description}\n` +
                `🏷️ Kategori: ${updatedTransaction.category_name}\n` +
                `📅 Tanggal: ${this.formatDate(updatedTransaction.date)}\n\n` +
                `🤖 Tingkat keyakinan AI: ${Math.round(editInstructions.confidence * 100)}%`;

            await message.reply(response);
            global.editSessions.delete(userPhone);
            return true;

        } catch (error) {
            this.logger.error('Error in AI edit:', error);
            await message.reply('❌ Gagal memproses edit dengan AI: ' + error.message);
            global.editSessions.delete(userPhone);
            return true;
        }
    }

    async handleDeleteConfirmation(message, userPhone, text) {
        try {
            if (!global.deleteConfirmations || !global.deleteConfirmations.has(userPhone)) {
                return false;
            }

            const confirmation = global.deleteConfirmations.get(userPhone);
            
            // Check if confirmation is too old (5 minutes)
            if (Date.now() - confirmation.timestamp > 300000) {
                global.deleteConfirmations.delete(userPhone);
                await message.reply('⏰ Waktu konfirmasi hapus habis. Silakan ulangi perintah /hapus [id]');
                return true;
            }

            const lowerText = text.toLowerCase().trim();
            
            // Handle cancel
            if (lowerText.includes('batal') || lowerText.includes('cancel') || lowerText.includes('tidak')) {
                global.deleteConfirmations.delete(userPhone);
                await message.reply('❌ Penghapusan transaksi dibatalkan.');
                return true;
            }

            // Handle confirmation
            if (lowerText === 'ya' || lowerText === 'hapus' || lowerText === 'yes' || lowerText === 'delete') {
                try {
                    // Delete the transaction
                    await this.transactionService.deleteTransaction(userPhone, confirmation.transactionId);
                    
                    const response = `✅ *Transaksi berhasil dihapus!*\n\n` +
                        `🗑️ Transaksi #${confirmation.transactionId} telah dihapus:\n` +
                        `💰 ${confirmation.transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${this.formatCurrency(confirmation.transaction.amount)}\n` +
                        `📝 Deskripsi: ${confirmation.transaction.description}\n` +
                        `🏷️ Kategori: ${confirmation.transaction.category_name || 'Tidak ada'}\n` +
                        `📅 Tanggal: ${this.formatDate(confirmation.transaction.date)}`;

                    await message.reply(response);
                    global.deleteConfirmations.delete(userPhone);
                    return true;

                } catch (error) {
                    this.logger.error('Error deleting transaction:', error);
                    await message.reply('❌ Gagal menghapus transaksi: ' + error.message);
                    global.deleteConfirmations.delete(userPhone);
                    return true;
                }
            }

            // Invalid confirmation response
            await message.reply('❓ Respons tidak valid. Balas dengan "YA" atau "HAPUS" untuk konfirmasi, atau "BATAL" untuk membatalkan.');
            return true;

        } catch (error) {
            this.logger.error('Error handling delete confirmation:', error);
            await message.reply('❌ Terjadi kesalahan saat memproses konfirmasi.');
            if (global.deleteConfirmations) {
                global.deleteConfirmations.delete(userPhone);
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

    formatDate(date) {
        return moment(date).format('DD/MM/YYYY');
    }

    parseDate(dateString) {
        // Try different date formats
        const formats = ['DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY', 'MM/DD/YYYY'];
        
        for (const format of formats) {
            const parsed = moment(dateString, format, true);
            if (parsed.isValid()) {
                return parsed.format('YYYY-MM-DD');
            }
        }
        
        // Try natural parsing
        const natural = moment(dateString);
        if (natural.isValid()) {
            return natural.format('YYYY-MM-DD');
        }
        
        return null;
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
        if (args.length === 0) {
            await message.reply('📝 Cara pakai: /edit [id_transaksi]\nContoh: /edit 123\n\nUntuk melihat ID transaksi, gunakan /saldo atau /laporan');
            return;
        }

        const transactionId = parseInt(args[0]);
        if (isNaN(transactionId)) {
            await message.reply('❌ ID transaksi harus berupa angka.\nContoh: /edit 123');
            return;
        }

        try {
            // Get transaction details
            const transaction = await this.db.getTransactionById(transactionId, userPhone);
            
            if (!transaction) {
                await message.reply('❌ Transaksi tidak ditemukan atau Anda tidak memiliki akses untuk mengeditnya.');
                return;
            }

            // Show transaction details and edit options
            const typeText = transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
            const emoji = transaction.type === 'income' ? '📈' : '📉';
            
            const response = `${emoji} *Detail Transaksi #${transactionId}*\n\n` +
                `💰 Jenis: ${typeText}\n` +
                `💵 Jumlah: ${this.formatCurrency(transaction.amount)}\n` +
                `📝 Deskripsi: ${transaction.description}\n` +
                `🏷️ Kategori: ${transaction.category_name || 'Tidak ada'}\n` +
                `📅 Tanggal: ${this.formatDate(transaction.date)}\n\n` +
                `*Pilih yang ingin diedit:*\n` +
                `1️⃣ Jumlah\n` +
                `2️⃣ Deskripsi\n` +
                `3️⃣ Kategori\n` +
                `4️⃣ Tanggal\n` +
                `5️⃣ Edit semua dengan AI\n\n` +
                `Balas dengan nomor pilihan (1-5) atau ketik "batal" untuk membatalkan.`;

            // Store edit session
            if (!global.editSessions) {
                global.editSessions = new Map();
            }
            
            global.editSessions.set(userPhone, {
                transactionId,
                transaction,
                step: 'select_field',
                timestamp: Date.now()
            });

            await message.reply(response);
        } catch (error) {
            this.logger.error('Error in handleEdit:', error);
            await message.reply('❌ Terjadi kesalahan saat mengambil data transaksi.');
        }
    }

    async handleDelete(message, userPhone, args) {
        if (args.length === 0) {
            await message.reply('📝 Cara pakai: /hapus [id_transaksi]\nContoh: /hapus 123\n\nUntuk melihat ID transaksi, gunakan /saldo atau /cari');
            return;
        }

        const transactionId = parseInt(args[0]);
        if (isNaN(transactionId)) {
            await message.reply('❌ ID transaksi harus berupa angka.\nContoh: /hapus 123');
            return;
        }

        try {
            // Get transaction details first
            const transaction = await this.db.getTransactionById(transactionId, userPhone);
            
            if (!transaction) {
                await message.reply('❌ Transaksi tidak ditemukan atau Anda tidak memiliki akses untuk menghapusnya.');
                return;
            }

            // Show transaction details and ask for confirmation
            const typeText = transaction.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
            const emoji = transaction.type === 'income' ? '📈' : '📉';
            
            const response = `⚠️ *Konfirmasi Hapus Transaksi*\n\n` +
                `${emoji} *Transaksi #${transactionId}*\n` +
                `💰 Jenis: ${typeText}\n` +
                `💵 Jumlah: ${this.formatCurrency(transaction.amount)}\n` +
                `📝 Deskripsi: ${transaction.description}\n` +
                `🏷️ Kategori: ${transaction.category_name || 'Tidak ada'}\n` +
                `📅 Tanggal: ${this.formatDate(transaction.date)}\n\n` +
                `❗ *PERINGATAN:* Transaksi yang dihapus tidak dapat dikembalikan!\n\n` +
                `Balas dengan "YA" atau "HAPUS" untuk konfirmasi hapus.\nBalas dengan "BATAL" untuk membatalkan.`;

            // Store delete confirmation session
            if (!global.deleteConfirmations) {
                global.deleteConfirmations = new Map();
            }
            
            global.deleteConfirmations.set(userPhone, {
                transactionId,
                transaction,
                timestamp: Date.now()
            });

            await message.reply(response);
        } catch (error) {
            this.logger.error('Error in handleDelete:', error);
            await message.reply('❌ Terjadi kesalahan saat mengambil data transaksi.');
        }
    }

    async handleBackup(message, userPhone, args) {
        await message.reply('🚧 Fitur backup akan segera hadir!');
    }

    async handleExport(message, userPhone, args) {
        await message.reply('🚧 Fitur ekspor akan segera hadir!');
    }

    async handleSearch(message, userPhone, args) {
        if (args.length === 0) {
            await message.reply('🔍 Cara pakai: /cari [kata kunci]\nContoh: /cari makan\nContoh: /cari 50000\nContoh: /cari makanan');
            return;
        }

        try {
            const searchTerm = args.join(' ');
            const transactions = await this.transactionService.getTransactionHistory(userPhone, {
                search: searchTerm,
                limit: 10
            });

            if (transactions.length === 0) {
                await message.reply(`🔍 Tidak ditemukan transaksi dengan kata kunci "${searchTerm}"`);
                return;
            }

            let response = `🔍 *Hasil Pencarian: "${searchTerm}"*\n\n`;
            response += `Ditemukan ${transactions.length} transaksi:\n\n`;

            transactions.forEach((t, index) => {
                const emoji = t.type === 'income' ? '📈' : '📉';
                const date = this.formatDate(t.date);
                response += `${index + 1}. ${emoji} ID:${t.id}\n`;
                response += `   💰 ${this.formatCurrency(t.amount)}\n`;
                response += `   📝 ${t.description}\n`;
                response += `   🏷️ ${t.category_name || 'Lainnya'}\n`;
                response += `   📅 ${date}\n\n`;
            });

            response += `💡 *Tip:* Gunakan /edit [ID] untuk mengedit transaksi\nContoh: /edit ${transactions[0].id}`;

            await message.reply(response);
        } catch (error) {
            this.logger.error('Error searching transactions:', error);
            await message.reply('❌ Gagal mencari transaksi: ' + error.message);
        }
    }

    async handlePrediction(message, userPhone, args) {
        await message.reply('🚧 Fitur prediksi arus kas akan segera hadir!');
    }
}

module.exports = CommandHandler;