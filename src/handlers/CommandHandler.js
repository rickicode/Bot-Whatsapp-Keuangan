const Logger = require('../utils/Logger');
const TransactionService = require('../services/TransactionService');
const ReportService = require('../services/ReportService');
const CategoryService = require('../services/CategoryService');
const DebtReceivableService = require('../services/DebtReceivableService');
const moment = require('moment');

class CommandHandler {
    constructor(database, aiService, client, indonesianAI = null) {
        this.db = database;
        this.ai = aiService;
        this.client = client;
        this.indonesianAI = indonesianAI;
        this.logger = new Logger();
        
        // Initialize services
        this.transactionService = new TransactionService(database, aiService);
        this.reportService = new ReportService(database, aiService);
        this.categoryService = new CategoryService(database);
        this.debtReceivableService = new DebtReceivableService(database, aiService);
        
        // Command mappings
        this.commands = {
            // Income commands
            '/masuk': this.handleIncome.bind(this),
            '/income': this.handleIncome.bind(this),
            
            // Expense commands
            '/keluar': this.handleExpense.bind(this),
            '/expense': this.handleExpense.bind(this),
            
            // Debt/Receivable commands
            '/hutang': this.handleDebt.bind(this),
            '/debt': this.handleDebt.bind(this),
            '/piutang': this.handleReceivable.bind(this),
            '/receivable': this.handleReceivable.bind(this),
            '/hutang-piutang': this.handleDebtReceivableList.bind(this),
            '/debt-receivable': this.handleDebtReceivableList.bind(this),
            '/daftar-hutang': this.handleDebtList.bind(this),
            '/debt-list': this.handleDebtList.bind(this),
            '/daftar-piutang': this.handleReceivableList.bind(this),
            '/receivable-list': this.handleReceivableList.bind(this),
            '/saldo-hutang': this.handleDebtReceivableSummary.bind(this),
            '/debt-summary': this.handleDebtReceivableSummary.bind(this),
            '/lunas': this.handleMarkAsPaid.bind(this),
            '/paid': this.handleMarkAsPaid.bind(this),
            
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
            '/menu': this.handleMainMenu.bind(this),
            '/menu-admin': this.handleAdminMenu.bind(this),
            '/admin': this.handleAdminMenu.bind(this),
            '/change-plan': this.handleChangePlan.bind(this),
            '/suspend-user': this.handleSuspendUser.bind(this),
            '/user-list': this.handleUserList.bind(this),
            '/reset-limit': this.handleResetLimit.bind(this),
            '/user-detail': this.handleUserDetail.bind(this),
            '/ai-info': this.handleAIInfo.bind(this),
            
            // Bulk transaction features
            '/bulk': this.handleBulkTransaction.bind(this),
            '/bulk-transaksi': this.handleBulkTransaction.bind(this)
        };
    }

    async handleMessage(message) {
        try {
            // Handle both whatsapp-web.js and Baileys format
            const userPhone = message.from.replace(/@c\.us|@s\.whatsapp\.net/g, '');
            const text = message.body.trim();
            
            // Note: User registration and authentication is now handled by IndonesianAIAssistant
            // We assume user is already registered and authenticated when reaching this point
            
            // Check if user has pending transaction confirmation
            if (await this.handlePendingTransaction(message, userPhone, text)) {
                return;
            }
            
            // Check if user has pending debt/receivable confirmation
            if (await this.handlePendingDebtReceivableConfirmation(message, userPhone, text)) {
                return;
            }
            
            // Check if user has pending bulk transaction session
            if (await this.handleBulkTransactionSession(message, userPhone, text)) {
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
            // Check for auto categorization apply command
            if (await this.handleAutoCategorizationApply(message, userPhone, text)) {
                return;
            }
            
            // Check for debt/receivable processing first (higher priority)
            if (await this.handleNaturalLanguageDebtReceivable(message, userPhone, text)) {
                return;
            }
            
            // First check if this might be an edit instruction
            if (await this.handleNaturalLanguageEdit(message, userPhone, text)) {
                return;
            }
            
            // Check if this might be a bulk transaction (multiple lines or multiple transaction indicators)
            if (await this.detectAndHandleBulkTransaction(message, userPhone, text)) {
                return;
            }
            
            const parsed = await this.ai.parseNaturalLanguageTransaction(text, userPhone, this.indonesianAI);
            
            if (parsed && parsed.confidence > 0.7) {
                // Check transaction limit before processing
                const limitCheck = await this.db.checkTransactionLimit(userPhone);
                if (!limitCheck.allowed) {
                    if (limitCheck.reason === 'Daily limit reached') {
                        await message.reply(
                            `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                            '⏰ Kuota akan direset besok pagi.\n' +
                            '💎 Upgrade ke Premium untuk unlimited transaksi.\n' +
                            "Ketik 'upgrade' untuk info lebih lanjut!"
                        );
                    } else {
                        await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
                    }
                    return;
                }

                // Check if category is unknown or needs confirmation
                if (parsed.category === 'unknown' || !parsed.category) {
                    await this.askForCategory(message, userPhone, parsed);
                    return;
                }

                // Auto-process high confidence transactions with known category
                this.logger.info(`Getting categories for user ${userPhone}, type: ${parsed.type}`);
                const categories = await this.db.getCategories(userPhone, parsed.type);
                this.logger.info(`Found ${categories.length} categories for ${parsed.type}:`, categories.map(c => `${c.name} (id: ${c.id})`));
                
                const category = categories.find(c =>
                    c.name.toLowerCase() === parsed.category.toLowerCase() ||
                    c.name.toLowerCase().includes(parsed.category.toLowerCase()) ||
                    parsed.category.toLowerCase().includes(c.name.toLowerCase())
                ) || categories[0];
                
                this.logger.info(`Selected category for "${parsed.category}":`, category);
                
                if (!category) {
                    this.logger.error(`No category found for type ${parsed.type}. Available categories:`, categories);
                    await this.askForCategory(message, userPhone, parsed);
                    return;
                }
                
                this.logger.info(`Adding transaction with category_id: ${category.id}`);
                const transactionId = await this.db.addTransaction(
                    userPhone,
                    parsed.type,
                    parsed.amount,
                    category.id,
                    parsed.description
                );
                this.logger.info(`Transaction added with ID: ${transactionId}`);
                
                // Increment transaction count for limited plans
                if (limitCheck.subscription.monthly_transaction_limit !== null) {
                    await this.db.incrementTransactionCount(userPhone);
                }
                
                const remaining = limitCheck.subscription.monthly_transaction_limit
                    ? limitCheck.remaining - 1
                    : '∞';
                
                const response = `✅ Transaksi berhasil ditambahkan!\n\n` +
                    `💰 ${parsed.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${this.formatCurrency(parsed.amount)}\n` +
                    `📝 Deskripsi: ${parsed.description}\n` +
                    `🏷️ Kategori: ${category?.name || 'Lainnya'}\n` +
                    `🆔 ID: ${transactionId}\n\n` +
                    `🤖 Tingkat Keyakinan AI: ${Math.round(parsed.confidence * 100)}%\n` +
                    `📊 Sisa kuota: ${remaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}`;
                
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

        // Check transaction limit before processing
        const limitCheck = await this.db.checkTransactionLimit(userPhone);
        if (!limitCheck.allowed) {
            if (limitCheck.reason === 'Daily limit reached') {
                await message.reply(
                    `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                    '⏰ Kuota akan direset besok pagi.\n' +
                    '💎 Upgrade ke Premium untuk unlimited transaksi.\n' +
                    "Ketik 'upgrade' untuk info lebih lanjut!"
                );
            } else {
                await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
            }
            return;
        }

        const description = args.slice(1, -1).join(' ') || args.slice(1).join(' ');
        const categoryName = args.length > 2 ? args[args.length - 1] : null;

        try {
            const result = await this.transactionService.addIncome(userPhone, amount, description, categoryName);
            
            // Increment transaction count for limited plans
            if (limitCheck.subscription.monthly_transaction_limit !== null) {
                await this.db.incrementTransactionCount(userPhone);
            }
            
            const remaining = limitCheck.subscription.monthly_transaction_limit
                ? limitCheck.remaining - 1
                : '∞';
            
            const response = `✅ Pemasukan berhasil ditambahkan!\n\n` +
                `💰 Jumlah: ${this.formatCurrency(amount)}\n` +
                `📝 Deskripsi: ${description}\n` +
                `🏷️ Kategori: ${result.categoryName}\n` +
                `🆔 ID Transaksi: ${result.transactionId}\n` +
                `📅 Tanggal: ${moment().format('DD/MM/YYYY')}\n\n` +
                `📊 Sisa kuota: ${remaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}`;
            
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

        // Check transaction limit before processing
        const limitCheck = await this.db.checkTransactionLimit(userPhone);
        if (!limitCheck.allowed) {
            if (limitCheck.reason === 'Daily limit reached') {
                await message.reply(
                    `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                    '⏰ Kuota akan direset besok pagi.\n' +
                    '💎 Upgrade ke Premium untuk unlimited transaksi.\n' +
                    "Ketik 'upgrade' untuk info lebih lanjut!"
                );
            } else {
                await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
            }
            return;
        }

        const description = args.slice(1, -1).join(' ') || args.slice(1).join(' ');
        const categoryName = args.length > 2 ? args[args.length - 1] : null;

        try {
            const result = await this.transactionService.addExpense(userPhone, amount, description, categoryName);
            
            // Increment transaction count for limited plans
            if (limitCheck.subscription.monthly_transaction_limit !== null) {
                await this.db.incrementTransactionCount(userPhone);
            }
            
            const remaining = limitCheck.subscription.monthly_transaction_limit
                ? limitCheck.remaining - 1
                : '∞';
            
            const response = `✅ Pengeluaran berhasil ditambahkan!\n\n` +
                `💸 Jumlah: ${this.formatCurrency(amount)}\n` +
                `📝 Deskripsi: ${description}\n` +
                `🏷️ Kategori: ${result.categoryName}\n` +
                `🆔 ID Transaksi: ${result.transactionId}\n` +
                `📅 Tanggal: ${moment().format('DD/MM/YYYY')}\n\n` +
                `📊 Sisa kuota: ${remaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}`;
            
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
            // Check if first argument is "tanggal"
            if (args[0] && args[0].toLowerCase() === 'tanggal') {
                await this.handleDateReport(message, userPhone, args.slice(1));
                return;
            }
            
            const period = args[0] || 'bulanan';
            const report = await this.reportService.generateReport(userPhone, period);
            
            await message.reply(report);
        } catch (error) {
            await message.reply('❌ Gagal membuat laporan: ' + error.message);
        }
    }

    // Date-specific report handling
    async handleDateReport(message, userPhone, args) {
        try {
            if (args.length === 0) {
                await message.reply(
                    '📅 Cara pakai: /laporan tanggal [DD/MM/YYYY]\n\n' +
                    'Contoh:\n' +
                    '• /laporan tanggal 07/06/2025\n' +
                    '• /laporan tanggal 15/05/2025\n' +
                    '• /laporan tanggal hari ini (untuk hari ini)\n\n' +
                    '💡 Format tanggal: DD/MM/YYYY'
                );
                return;
            }

            let targetDate;
            const dateInput = args.join(' ').toLowerCase();

            // Handle "hari ini" or "today"
            if (dateInput === 'hari ini' || dateInput === 'today') {
                targetDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            } else {
                // Parse date from DD/MM/YYYY format
                targetDate = this.parseDateToISO(args[0]);
                if (!targetDate) {
                    await message.reply(
                        '❌ Format tanggal tidak valid!\n\n' +
                        '📅 Gunakan format: DD/MM/YYYY\n' +
                        'Contoh: 07/06/2025\n\n' +
                        'Atau ketik "hari ini" untuk laporan hari ini.'
                    );
                    return;
                }
            }

            // Get transactions for the specific date
            const transactions = await this.db.getTransactionsByDate(userPhone, targetDate);
            const balance = await this.db.getBalanceByDate(userPhone, targetDate);

            // Format the date for display
            const displayDate = this.formatDate(targetDate);
            
            if (transactions.length === 0) {
                await message.reply(
                    `📅 *Laporan Tanggal ${displayDate}*\n\n` +
                    '📊 Tidak ada transaksi pada tanggal ini.\n\n' +
                    '💡 Coba tanggal lain atau gunakan /saldo untuk melihat transaksi terbaru.'
                );
                return;
            }

            // Generate report
            let response = `📅 *Laporan Keuangan - ${displayDate}*\n\n`;
            
            // Summary section
            response += `💰 *RINGKASAN HARI INI:*\n`;
            response += `📈 Total Pemasukan: ${this.formatCurrency(balance.income)}\n`;
            response += `📉 Total Pengeluaran: ${this.formatCurrency(balance.expenses)}\n`;
            response += `💵 Selisih: ${this.formatCurrency(balance.balance)}\n`;
            response += `🔢 Total Transaksi: ${transactions.length}\n\n`;

            // Transactions by category
            const incomeTransactions = transactions.filter(t => t.type === 'income');
            const expenseTransactions = transactions.filter(t => t.type === 'expense');

            if (incomeTransactions.length > 0) {
                response += `📈 *PEMASUKAN (${incomeTransactions.length}):*\n`;
                incomeTransactions.forEach((t, index) => {
                    response += `${index + 1}. ${this.formatCurrency(t.amount)} - ${t.description}\n`;
                    response += `   🏷️ ${t.category_name || 'Lainnya'} | 🆔 ${t.id}\n`;
                });
                response += '\n';
            }

            if (expenseTransactions.length > 0) {
                response += `📉 *PENGELUARAN (${expenseTransactions.length}):*\n`;
                expenseTransactions.forEach((t, index) => {
                    response += `${index + 1}. ${this.formatCurrency(t.amount)} - ${t.description}\n`;
                    response += `   🏷️ ${t.category_name || 'Lainnya'} | 🆔 ${t.id}\n`;
                });
                response += '\n';
            }

            // Category breakdown for expenses
            if (expenseTransactions.length > 0) {
                const categoryTotals = {};
                expenseTransactions.forEach(t => {
                    const categoryName = t.category_name || 'Lainnya';
                    categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + parseFloat(t.amount);
                });

                response += `🏷️ *PENGELUARAN PER KATEGORI:*\n`;
                Object.entries(categoryTotals)
                    .sort((a, b) => b[1] - a[1]) // Sort by amount descending
                    .forEach(([category, total]) => {
                        const percentage = ((total / balance.expenses) * 100).toFixed(1);
                        response += `• ${category}: ${this.formatCurrency(total)} (${percentage}%)\n`;
                    });
                response += '\n';
            }

            // Tips and actions
            response += `💡 *AKSI CEPAT:*\n`;
            response += `• /edit [ID] - Edit transaksi\n`;
            response += `• /hapus [ID] - Hapus transaksi\n`;
            response += `• /saldo - Lihat saldo keseluruhan\n`;
            response += `• /laporan bulanan - Laporan bulan ini`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error generating date report:', error);
            await message.reply('❌ Gagal membuat laporan tanggal: ' + error.message);
        }
    }

    // Helper method to parse DD/MM/YYYY to YYYY-MM-DD
    parseDateToISO(dateString) {
        try {
            // Handle DD/MM/YYYY format
            const parts = dateString.split('/');
            if (parts.length !== 3) {
                return null;
            }

            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            // Validate ranges
            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return null;
            }

            // Create date and validate it
            const date = new Date(year, month - 1, day);
            if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
                return null;
            }

            // Return in YYYY-MM-DD format
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        } catch (error) {
            return null;
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
        const botName = process.env.BOT_NAME || 'Bot Keuangan';
        
        const menuText = `🤖 *${botName} - Menu Utama*

📚 *PANDUAN BANTUAN:*

📋 /bantuan - Panduan perintah dasar
🤖 /bantuan-ai - Panduan fitur AI & bahasa natural
📝 /contoh - Contoh-contoh penggunaan
💰 /saldo - Cek saldo & transaksi terbaru
📊 /laporan - Buat laporan keuangan

⚡ *PERINTAH CEPAT:*

💰 /masuk [jumlah] [deskripsi] - Tambah pemasukan
💸 /keluar [jumlah] [deskripsi] - Tambah pengeluaran
💳 /bulk [multiple transaksi] - Tambah banyak transaksi sekaligus
🔍 /cari [kata kunci] - Cari transaksi
✏️ /edit [id] - Edit transaksi
🗑️ /hapus [id] - Hapus transaksi

📋 *HUTANG PIUTANG (BARU!):*

📈 /piutang [nama] [jumlah] [keterangan] - Catat piutang
📉 /hutang [nama] [jumlah] [keterangan] - Catat hutang
📊 /hutang-piutang - Lihat daftar hutang/piutang
💰 /saldo-hutang - Ringkasan hutang/piutang
✅ /lunas [id] - Tandai sebagai lunas

🆘 *BUTUH BANTUAN?*
Ketik: "Bagaimana cara..." atau pilih panduan di atas!

✨ *Tips:*
• Coba ketik dengan bahasa natural seperti "saya habis 50000 untuk makan siang" - AI akan otomatis memproses!
• Untuk hutang piutang: "Piutang Warung Madura Voucher Wifi 200K" atau "Hutang ke Toko Budi sembako 150K"
• Untuk multiple transaksi, ketik langsung atau gunakan /bulk`;

        await message.reply(menuText);
    }

    // Help - Basic Commands
    async handleHelp(message, userPhone, args) {
        const botName = process.env.BOT_NAME || 'Bot Keuangan';
        
        const helpText = `📋 *${botName} - Panduan Perintah Dasar*

💰 *TAMBAH TRANSAKSI:*

• /masuk [jumlah] [deskripsi] [kategori]
  💡 Contoh: /masuk 5000000 gaji bulanan

• /keluar [jumlah] [deskripsi] [kategori]
  💡 Contoh: /keluar 50000 makan siang makanan

💳 *BULK TRANSAKSI (BARU!):*

• /bulk [multiple transaksi]
  💡 Contoh: /bulk Habis belanja baju 33k
           Mainan anak 30k
           Galon + kopi 20k
           Parkir 2k

📊 *LIHAT DATA:*

• /saldo - Saldo & transaksi terbaru (dengan ID)
• /laporan [periode] - Laporan harian/mingguan/bulanan
• /laporan tanggal [DD/MM/YYYY] - Laporan tanggal spesifik
• /kategori - Lihat semua kategori

🔍 *CARI & EDIT:*

• /cari [kata kunci] - Cari transaksi
• /edit [id] - Edit transaksi interaktif
• /hapus [id] - Hapus transaksi (dengan konfirmasi)

🏷️ *KATEGORI:*

*Pemasukan:* Gaji, Freelance, Bisnis, Investasi
*Pengeluaran:* Makanan, Transportasi, Utilitas, Hiburan

📋 *HUTANG PIUTANG:*

• /piutang [nama] [jumlah] [keterangan] - Catat piutang
• /hutang [nama] [jumlah] [keterangan] - Catat hutang
• /hutang-piutang [HUTANG/PIUTANG] - Lihat daftar
• /saldo-hutang - Ringkasan hutang/piutang
• /lunas [id] - Tandai sebagai lunas

📚 *BANTUAN LANJUTAN:*

🤖 /bantuan-ai - Fitur AI & bahasa natural
📝 /contoh - Contoh penggunaan lengkap
🏠 /menu - Kembali ke menu utama

💡 *Tips Cepat:*
1. Gunakan /saldo untuk lihat ID transaksi
2. Edit langsung: "edit transaksi 123 ubah jumlah jadi 100000"
3. Ketik natural: "saya habis 25000 beli kopi"
4. Hutang piutang natural: "Piutang Warung Madura Voucher Wifi 200K"
5. Bulk natural: AI auto-deteksi multiple transaksi!`;

        await message.reply(helpText);
    }

    // Help - AI Features
    async handleAIHelp(message, userPhone, args) {
        const botName = process.env.BOT_NAME || 'Bot Keuangan';
        
        const aiHelpText = `🤖 *${botName} - Panduan Fitur AI*

💬 *CHAT DENGAN AI:*

• /chat [pertanyaan] - Konsultasi keuangan
• /analisis - Analisis pola keuangan AI
• /saran - Saran keuangan personal
• /prediksi-ai - Prediksi keuangan masa depan
• /ringkasan-ai [periode] - Ringkasan AI (harian/mingguan/bulanan)
• /kategori-otomatis - Auto kategorisasi transaksi dengan AI

💳 *BULK TRANSAKSI AI (FITUR BARU!):*

• /bulk [multiple transaksi] - Input banyak transaksi sekaligus
• AI auto-deteksi: ketik langsung multiple transaksi, AI otomatis proses!

✅ *Contoh Bulk Transaksi:*
Habis belanja baju albi 33k
Mainan albi 30k
Galon + kopi 20k
Parkir 2k
Permen 2k

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

✅ *Contoh Multiple Transaksi (Auto-Bulk):*
• "Hari ini beli kopi 25k, makan siang 50k, bensin 100k"
• "Belanja: beras 50k, telur 30k, sayur 20k"

🔧 *EDIT DENGAN AI:*

• "Edit transaksi 123 ubah jumlah jadi 75000"
• "Ubah deskripsi transaksi jadi makan malam"
• "Ganti kategori transaksi ke transportasi"
• "Ubah jumlah jadi 50000 dan kategori jadi makanan"

🤖 *BAGAIMANA AI BEKERJA:*

1. **Deteksi Otomatis** - AI mengenali jenis transaksi (single/bulk)
2. **Smart Categorization** - AI sarankan kategori yang tepat
3. **Confidence Score** - Tingkat keyakinan AI (60-100%)
4. **Konfirmasi Interaktif** - Jika AI tidak yakin, akan bertanya
5. **Bulk Processing** - Proses multiple transaksi sekaligus

⚠️ *JIKA AI TIDAK YAKIN:*
Bot akan tampilkan menu kategori untuk dipilih!

🎯 *TIPS AI YANG EFEKTIF:*

✅ **DO:**
• Gunakan kalimat yang jelas dan spesifik
• Sebutkan angka tanpa titik/koma
• Gunakan nama kategori yang sudah ada
• Berikan konteks yang cukup
• Pisahkan transaksi dengan baris baru untuk bulk

❌ **DON'T:**
• Kalimat terlalu singkat atau ambigu
• Gunakan singkatan yang tidak jelas
• Campur transaksi yang tidak berhubungan

📚 *BANTUAN LAINNYA:*

📋 /bantuan - Perintah dasar
📝 /contoh - Contoh penggunaan
🏠 /menu - Menu utama

🚀 *Mulai gunakan AI untuk pengalaman yang lebih mudah!*`;

        await message.reply(aiHelpText);
    }

    // Examples
    async handleExamples(message, userPhone, args) {
        const botName = process.env.BOT_NAME || 'Bot Keuangan';
        
        const examplesText = `📝 *Contoh Penggunaan ${botName}*

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

💳 *CONTOH BULK TRANSAKSI (BARU!):*

\`\`\`
/bulk Habis belanja baju albi 33k
Mainan albi 30k
Galon + kopi 20k
Parkir 2k
Permen 2k
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

✅ **Bulk Transaksi (Auto-Detection):**
• "Hari ini beli kopi 25k, makan siang 50k, bensin 100k"
• "Belanja: beras 50k, telur 30k, sayur 20k"
• Atau langsung ketik multiple baris:
  "Habis belanja baju 33k
   Mainan anak 30k
   Parkir 2k"

📋 *CONTOH HUTANG PIUTANG (BARU!):*

✅ **Manual Commands:**
\`\`\`
/piutang "Warung Madura" 200000 "Voucher Wifi 2Rebuan"
/hutang "Toko Budi" 150000 "sembako bulanan"
/hutang-piutang PIUTANG
/saldo-hutang
/lunas 123
\`\`\`

✅ **Natural Language:**
• "Piutang Warung Madura Voucher Wifi 2Rebuan 200K"
• "Hutang ke Toko Budi sembako 150K"
• "Teman kantor belum bayar makan siang 50K"
• "Saya pinjam uang ke Pak RT 500K untuk modal"
• "Cicilan motor ke Yamaha bulan ini 1.2 juta"
• "Adik sepupu hutang uang jajan 50K"

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
/laporan tanggal 07/06/2025
/laporan tanggal hari ini
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
            
            // Check if pending transaction is too old (3 minutes - reduced to prevent hanging)
            if (Date.now() - pending.timestamp > 180000) {
                global.pendingTransactions.delete(userPhone);
                this.logger.info(`Pending transaction for ${userPhone} expired and cleaned up`);
                await message.reply('⏰ Waktu konfirmasi kategori habis. Silakan ulangi transaksi.');
                return true;
            }

            // Check for timeout or invalid responses
            if (!text || text.trim().length === 0) {
                this.logger.warn(`Empty response from ${userPhone} for pending transaction`);
                return true; // Don't process empty responses
            }

            const trimmedText = text.trim().toLowerCase();
            
            // Handle cancel commands
            if (trimmedText === 'batal' || trimmedText === 'cancel' || trimmedText === 'stop') {
                global.pendingTransactions.delete(userPhone);
                await message.reply('❌ Konfirmasi kategori dibatalkan.');
                return true;
            }

            let selectedCategory = null;

            // Track retry attempts to prevent infinite loops
            if (!pending.retryCount) {
                pending.retryCount = 0;
            }
            pending.retryCount++;

            // Max 3 retry attempts before cleanup
            if (pending.retryCount > 3) {
                global.pendingTransactions.delete(userPhone);
                this.logger.warn(`Max retry attempts reached for ${userPhone}, cleaning up pending transaction`);
                await message.reply('❌ Terlalu banyak percobaan. Silakan mulai transaksi baru dengan format yang benar.');
                return true;
            }

            // Check if user sent a number
            const categoryIndex = parseInt(trimmedText) - 1;
            if (!isNaN(categoryIndex) && categoryIndex >= 0 && categoryIndex < pending.categories.length) {
                selectedCategory = pending.categories[categoryIndex];
            } else {
                // Check if user typed category name
                selectedCategory = pending.categories.find(c =>
                    c.name.toLowerCase().includes(trimmedText) ||
                    trimmedText.includes(c.name.toLowerCase())
                );
            }

            if (selectedCategory) {
                // Check transaction limit before processing
                const limitCheck = await this.db.checkTransactionLimit(userPhone);
                if (!limitCheck.allowed) {
                    if (limitCheck.reason === 'Daily limit reached') {
                        await message.reply(
                            `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                            '⏰ Kuota akan direset besok pagi.\n' +
                            '💎 Upgrade ke Premium untuk unlimited transaksi.\n' +
                            "Ketik 'upgrade' untuk info lebih lanjut!"
                        );
                    } else {
                        await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
                    }
                    global.pendingTransactions.delete(userPhone);
                    return true;
                }

                // Add the transaction with selected category
                const transactionId = await this.db.addTransaction(
                    userPhone,
                    pending.type,
                    pending.amount,
                    selectedCategory.id,
                    pending.description
                );

                // Increment transaction count for limited plans
                if (limitCheck.subscription.monthly_transaction_limit !== null) {
                    await this.db.incrementTransactionCount(userPhone);
                }
                
                const remaining = limitCheck.subscription.monthly_transaction_limit
                    ? limitCheck.remaining - 1
                    : '∞';

                const response = `✅ Transaksi berhasil ditambahkan!\n\n` +
                    `💰 ${pending.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}: ${this.formatCurrency(pending.amount)}\n` +
                    `📝 Deskripsi: ${pending.description}\n` +
                    `🏷️ Kategori: ${selectedCategory.name}\n` +
                    `🆔 ID: ${transactionId}\n\n` +
                    `📊 Sisa kuota: ${remaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}`;

                await message.reply(response);
                global.pendingTransactions.delete(userPhone);
                return true;
            } else {
                // Update pending transaction with retry count
                global.pendingTransactions.set(userPhone, pending);
                
                const remainingAttempts = 3 - pending.retryCount;
                await message.reply(
                    `❌ Kategori tidak valid. Silakan pilih nomor yang benar atau ketik nama kategori yang ada.\n\n` +
                    `📋 Kategori yang tersedia:\n` +
                    pending.categories.map((cat, index) => `${index + 1}. ${cat.name}`).join('\n') +
                    `\n\n💡 Sisa percobaan: ${remainingAttempts}\n` +
                    `Ketik "batal" untuk membatalkan.`
                );
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

    async handleAutoCategorizationApply(message, userPhone, text) {
        const lowerText = text.toLowerCase().trim();
        
        // Check if user wants to apply auto categorization suggestions
        if (lowerText === 'apply auto' || lowerText === 'terapkan auto' || lowerText === 'apply all') {
            try {
                if (!global.autoCategorizationSuggestions || !global.autoCategorizationSuggestions.has(userPhone)) {
                    await message.reply('❌ Tidak ada saran kategorisasi yang tersimpan. Gunakan /kategori-otomatis terlebih dahulu.');
                    return true;
                }

                const stored = global.autoCategorizationSuggestions.get(userPhone);
                
                // Check if suggestions are too old (10 minutes)
                if (Date.now() - stored.timestamp > 600000) {
                    global.autoCategorizationSuggestions.delete(userPhone);
                    await message.reply('⏰ Saran kategorisasi sudah kadaluarsa. Gunakan /kategori-otomatis untuk saran baru.');
                    return true;
                }

                const suggestions = stored.suggestions;
                
                if (suggestions.length === 0) {
                    await message.reply('ℹ️ Tidak ada saran dengan keyakinan >90% untuk diterapkan secara otomatis.');
                    return true;
                }

                await message.reply(`🤖 Menerapkan ${suggestions.length} saran kategorisasi dengan keyakinan tinggi...`);

                let successCount = 0;
                let failCount = 0;
                const results = [];

                // Apply each suggestion
                for (const suggestion of suggestions) {
                    try {
                        await this.transactionService.updateTransaction(
                            userPhone,
                            suggestion.transaction.id,
                            { category_id: suggestion.suggested.category.id }
                        );
                        
                        results.push({
                            id: suggestion.transaction.id,
                            description: suggestion.transaction.description,
                            oldCategory: suggestion.current,
                            newCategory: suggestion.suggested.category.name,
                            success: true
                        });
                        successCount++;
                    } catch (error) {
                        this.logger.error(`Failed to update transaction ${suggestion.transaction.id}:`, error);
                        results.push({
                            id: suggestion.transaction.id,
                            description: suggestion.transaction.description,
                            success: false,
                            error: error.message
                        });
                        failCount++;
                    }
                }

                // Generate response
                let response = `✅ *Auto Kategorisasi Selesai!*\n\n`;
                response += `📊 **Hasil:**\n`;
                response += `✅ Berhasil: ${successCount}\n`;
                response += `❌ Gagal: ${failCount}\n\n`;

                if (successCount > 0) {
                    response += `🏷️ **Perubahan yang Diterapkan:**\n`;
                    results.filter(r => r.success).forEach((result, index) => {
                        response += `${index + 1}. ${result.description}\n`;
                        response += `   🔄 ${result.oldCategory} → **${result.newCategory}**\n`;
                    });
                    response += '\n';
                }

                if (failCount > 0) {
                    response += `⚠️ **Gagal Diproses:**\n`;
                    results.filter(r => !r.success).forEach((result, index) => {
                        response += `${index + 1}. ID ${result.id} - ${result.description}\n`;
                    });
                    response += '\n';
                }

                response += `💡 **Tips:** Gunakan /saldo atau /laporan untuk melihat hasil perubahan.`;

                await message.reply(response);
                
                // Clean up suggestions
                global.autoCategorizationSuggestions.delete(userPhone);
                return true;

            } catch (error) {
                this.logger.error('Error applying auto categorization:', error);
                await message.reply('❌ Gagal menerapkan kategorisasi otomatis: ' + error.message);
                return true;
            }
        }

        return false;
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

    async detectAndHandleBulkTransaction(message, userPhone, text) {
        if (!this.ai.isAvailable()) {
            return false;
        }

        try {
            // Detect bulk transaction patterns
            const lines = text.split(/\n|;|,/).filter(line => line.trim().length > 0);
            
            // Check if it looks like bulk transactions
            const bulkIndicators = [
                lines.length >= 2, // Multiple lines
                /habis|belanja|beli.*\d+.*beli|dan.*\d+.*dan/i.test(text), // Multiple purchase indicators
                (text.match(/\d+[k|rb|ribu|jt|juta]/gi) || []).length >= 2, // Multiple amounts
                /\d+.*\n.*\d+/m.test(text), // Numbers on different lines
                /(^\d+[\.\s]|^-\s|\*\s)/m.test(text) // List-like formatting
            ];

            const bulkScore = bulkIndicators.filter(Boolean).length;
            
            // If it doesn't look like bulk, return false
            if (bulkScore < 2) {
                return false;
            }

            // Try to parse as bulk transaction
            await message.reply('🤖 Mendeteksi multiple transaksi, memproses dengan bulk AI...');
            
            const bulkResult = await this.ai.parseBulkTransactions(text, userPhone, this.indonesianAI);

            if (bulkResult.error || bulkResult.totalTransactions === 0) {
                // If bulk parsing fails, let single transaction parsing handle it
                return false;
            }

            // If we found multiple transactions, process as bulk
            if (bulkResult.totalTransactions >= 2) {
                // Check transaction limits
                const limitCheck = await this.db.checkTransactionLimit(userPhone);
                if (!limitCheck.allowed) {
                    if (limitCheck.reason === 'Daily limit reached') {
                        await message.reply(
                            `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                            '⏰ Kuota akan direset besok pagi.\n' +
                            '💎 Upgrade ke Premium untuk unlimited transaksi.\n' +
                            "Ketik 'upgrade' untuk info lebih lanjut!"
                        );
                    } else {
                        await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
                    }
                    return true;
                }

                // Check if user has enough quota for all transactions
                const remainingQuota = limitCheck.subscription.monthly_transaction_limit
                    ? limitCheck.remaining
                    : Infinity;

                if (limitCheck.subscription.monthly_transaction_limit && bulkResult.totalTransactions > remainingQuota) {
                    await message.reply(
                        `⚠️ **Kuota Tidak Mencukupi untuk Bulk**\n\n` +
                        `📊 Transaksi terdeteksi: ${bulkResult.totalTransactions}\n` +
                        `📊 Kuota tersisa: ${remainingQuota}/${limitCheck.subscription.monthly_transaction_limit}\n\n` +
                        `💡 **Solusi:**\n` +
                        `• Kirim transaksi satu per satu\n` +
                        `• Atau upgrade ke Premium untuk unlimited transaksi\n\n` +
                        `Ketik 'upgrade' untuk info lebih lanjut!`
                    );
                    return true;
                }

                // Show bulk preview
                let response = `🎯 **Auto-Detected Bulk Transaction**\n\n`;
                response += `🤖 **AI mendeteksi ${bulkResult.totalTransactions} transaksi:**\n`;
                response += `📊 Tingkat keyakinan rata-rata: ${Math.round(bulkResult.overallConfidence * 100)}%\n\n`;

                let totalAmount = 0;
                bulkResult.transactions.forEach((transaction, index) => {
                    const emoji = transaction.type === 'income' ? '📈' : '📉';
                    const confidencePercent = Math.round(transaction.confidence * 100);
                    response += `${index + 1}. ${emoji} ${this.formatCurrency(transaction.amount)}\n`;
                    response += `   📝 ${transaction.description}\n`;
                    response += `   🏷️ ${transaction.category}\n`;
                    response += `   🤖 ${confidencePercent}%\n\n`;
                    
                    if (transaction.type === 'expense') {
                        totalAmount += transaction.amount;
                    } else {
                        totalAmount -= transaction.amount;
                    }
                });

                response += `💰 **Total pengeluaran bersih:** ${this.formatCurrency(Math.abs(totalAmount))}\n\n`;
                
                const newRemaining = limitCheck.subscription.monthly_transaction_limit
                    ? remainingQuota - bulkResult.totalTransactions
                    : '∞';
                response += `📊 **Kuota setelah input:** ${newRemaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}\n\n`;

                response += `✅ **Konfirmasi:** Balas dengan "YA" atau "KONFIRMASI" untuk menyimpan semua transaksi\n`;
                response += `❌ **Batal:** Balas dengan "BATAL" untuk membatalkan`;

                // Store bulk transaction session
                if (!global.bulkTransactionSessions) {
                    global.bulkTransactionSessions = new Map();
                }
                
                global.bulkTransactionSessions.set(userPhone, {
                    transactions: bulkResult.transactions,
                    timestamp: Date.now(),
                    totalTransactions: bulkResult.totalTransactions,
                    overallConfidence: bulkResult.overallConfidence
                });

                await message.reply(response);
                return true;
            }

            return false;

        } catch (error) {
            this.logger.error('Error detecting bulk transaction:', error);
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

    async handleBulkTransactionSession(message, userPhone, text) {
        try {
            if (!global.bulkTransactionSessions || !global.bulkTransactionSessions.has(userPhone)) {
                return false;
            }

            const session = global.bulkTransactionSessions.get(userPhone);
            
            // Check if session is too old (5 minutes)
            if (Date.now() - session.timestamp > 300000) {
                global.bulkTransactionSessions.delete(userPhone);
                await message.reply('⏰ Waktu konfirmasi bulk transaksi habis. Silakan ulangi perintah /bulk');
                return true;
            }

            const lowerText = text.toLowerCase().trim();
            
            // Handle cancel
            if (lowerText.includes('batal') || lowerText.includes('cancel')) {
                global.bulkTransactionSessions.delete(userPhone);
                await message.reply('❌ Bulk transaksi dibatalkan.');
                return true;
            }

            // Handle confirmation
            if (lowerText === 'ya' || lowerText === 'konfirmasi' || lowerText === 'yes' || lowerText === 'confirm') {
                try {
                    await message.reply('💾 Menyimpan semua transaksi...');

                    // Check transaction limit again before processing
                    const limitCheck = await this.db.checkTransactionLimit(userPhone);
                    if (!limitCheck.allowed) {
                        await message.reply('❌ Limit transaksi telah tercapai. Transaksi dibatalkan.');
                        global.bulkTransactionSessions.delete(userPhone);
                        return true;
                    }

                    const results = [];
                    let successCount = 0;
                    let failCount = 0;

                    // Process each transaction
                    for (const transaction of session.transactions) {
                        try {
                            // Get categories for this user and transaction type
                            const categories = await this.db.getCategories(userPhone, transaction.type);
                            
                            // Find matching category or use default
                            let selectedCategory = categories.find(c =>
                                c.name.toLowerCase() === transaction.category.toLowerCase() ||
                                c.name.toLowerCase().includes(transaction.category.toLowerCase()) ||
                                transaction.category.toLowerCase().includes(c.name.toLowerCase())
                            );

                            // If no category found, use default
                            if (!selectedCategory) {
                                selectedCategory = categories.find(c => c.name.includes('Lain')) || categories[0];
                            }

                            if (!selectedCategory) {
                                throw new Error(`Tidak ada kategori ${transaction.type} yang tersedia`);
                            }

                            // Add the transaction
                            const transactionId = await this.db.addTransaction(
                                userPhone,
                                transaction.type,
                                transaction.amount,
                                selectedCategory.id,
                                transaction.description
                            );

                            results.push({
                                success: true,
                                id: transactionId,
                                description: transaction.description,
                                amount: transaction.amount,
                                category: selectedCategory.name,
                                type: transaction.type
                            });
                            successCount++;

                            // Increment transaction count for limited plans
                            if (limitCheck.subscription.monthly_transaction_limit !== null) {
                                await this.db.incrementTransactionCount(userPhone);
                            }

                        } catch (error) {
                            this.logger.error(`Failed to add bulk transaction:`, error);
                            results.push({
                                success: false,
                                description: transaction.description,
                                amount: transaction.amount,
                                error: error.message
                            });
                            failCount++;
                        }
                    }

                    // Generate success response
                    let response = `✅ **Bulk Transaksi Selesai!**\n\n`;
                    response += `📊 **Hasil:**\n`;
                    response += `✅ Berhasil: ${successCount} transaksi\n`;
                    response += `❌ Gagal: ${failCount} transaksi\n\n`;

                    if (successCount > 0) {
                        response += `💾 **Transaksi yang Tersimpan:**\n`;
                        const successfulTransactions = results.filter(r => r.success);
                        let totalExpenses = 0;
                        let totalIncome = 0;

                        successfulTransactions.forEach((result, index) => {
                            const emoji = result.type === 'income' ? '📈' : '📉';
                            response += `${index + 1}. ${emoji} ${this.formatCurrency(result.amount)}\n`;
                            response += `   📝 ${result.description}\n`;
                            response += `   🏷️ ${result.category}\n`;
                            response += `   🆔 ID: ${result.id}\n\n`;

                            if (result.type === 'income') {
                                totalIncome += result.amount;
                            } else {
                                totalExpenses += result.amount;
                            }
                        });

                        response += `💰 **Ringkasan:**\n`;
                        if (totalIncome > 0) {
                            response += `📈 Total Pemasukan: ${this.formatCurrency(totalIncome)}\n`;
                        }
                        if (totalExpenses > 0) {
                            response += `📉 Total Pengeluaran: ${this.formatCurrency(totalExpenses)}\n`;
                        }
                        response += `💵 Selisih: ${this.formatCurrency(totalIncome - totalExpenses)}\n\n`;

                        // Show remaining quota
                        const newRemaining = limitCheck.subscription.monthly_transaction_limit
                            ? limitCheck.remaining - successCount
                            : '∞';
                        response += `📊 Sisa kuota: ${newRemaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}\n\n`;
                    }

                    if (failCount > 0) {
                        response += `⚠️ **Transaksi yang Gagal:**\n`;
                        const failedTransactions = results.filter(r => !r.success);
                        failedTransactions.forEach((result, index) => {
                            response += `${index + 1}. ${this.formatCurrency(result.amount)} - ${result.description}\n`;
                            response += `   ❌ ${result.error}\n`;
                        });
                        response += '\n';
                    }

                    response += `💡 **Tips:** Gunakan /saldo untuk melihat saldo terbaru atau /laporan untuk analisis lebih detail.`;

                    await message.reply(response);
                    global.bulkTransactionSessions.delete(userPhone);
                    return true;

                } catch (error) {
                    this.logger.error('Error processing bulk transactions:', error);
                    await message.reply('❌ Gagal memproses bulk transaksi: ' + error.message);
                    global.bulkTransactionSessions.delete(userPhone);
                    return true;
                }
            }

            // Handle edit specific transaction
            if (lowerText.startsWith('edit ')) {
                const editIndex = parseInt(lowerText.split(' ')[1]) - 1;
                if (isNaN(editIndex) || editIndex < 0 || editIndex >= session.transactions.length) {
                    await message.reply(`❌ Nomor transaksi tidak valid. Pilih antara 1-${session.transactions.length}`);
                    return true;
                }

                // TODO: Implement individual transaction edit in bulk session
                await message.reply('🚧 Fitur edit transaksi individual dalam bulk session akan segera hadir!\n\nUntuk saat ini, silakan batalkan dan buat ulang dengan data yang benar.');
                return true;
            }

            // Invalid response
            await message.reply(
                '❓ Respons tidak valid.\n\n' +
                '✅ Balas dengan "YA" atau "KONFIRMASI" untuk menyimpan\n' +
                '❌ Balas dengan "BATAL" untuk membatalkan\n' +
                '✏️ Atau "EDIT [nomor]" untuk edit transaksi tertentu'
            );
            return true;

        } catch (error) {
            this.logger.error('Error handling bulk transaction session:', error);
            await message.reply('❌ Terjadi kesalahan saat memproses bulk transaksi.');
            if (global.bulkTransactionSessions) {
                global.bulkTransactionSessions.delete(userPhone);
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

    // Helper methods for AI features
    analyzeSpendingPatterns(transactions, balance) {
        const expenses = transactions.filter(t => t.type === 'expense');
        const income = transactions.filter(t => t.type === 'income');
        
        // Calculate category spending
        const categorySpending = {};
        expenses.forEach(t => {
            const category = t.category_name || 'Lainnya';
            categorySpending[category] = (categorySpending[category] || 0) + parseFloat(t.amount);
        });

        // Calculate daily average
        const days = Math.max(1, Math.ceil((Date.now() - new Date(transactions[transactions.length - 1]?.date || Date.now())) / (24 * 60 * 60 * 1000)));
        const dailyAverage = expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0) / days;

        // Find largest expenses
        const largestExpenses = expenses
            .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
            .slice(0, 5);

        return {
            categorySpending,
            dailyAverage,
            largestExpenses,
            totalExpenses: expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0),
            totalIncome: income.reduce((sum, t) => sum + parseFloat(t.amount), 0),
            transactionCount: transactions.length,
            timespan: days
        };
    }

    analyzePredictionPatterns(transactions) {
        const weeklyData = {};
        const monthlyData = {};
        const categoryTrends = {};

        transactions.forEach(t => {
            const date = new Date(t.date);
            const week = this.getWeekKey(date);
            const month = this.getMonthKey(date);
            const category = t.category_name || 'Lainnya';

            // Weekly patterns
            if (!weeklyData[week]) weeklyData[week] = { income: 0, expenses: 0 };
            if (t.type === 'income') weeklyData[week].income += parseFloat(t.amount);
            else weeklyData[week].expenses += parseFloat(t.amount);

            // Monthly patterns
            if (!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0 };
            if (t.type === 'income') monthlyData[month].income += parseFloat(t.amount);
            else monthlyData[month].expenses += parseFloat(t.amount);

            // Category trends
            if (!categoryTrends[category]) categoryTrends[category] = [];
            categoryTrends[category].push({
                amount: parseFloat(t.amount),
                date: t.date,
                type: t.type
            });
        });

        return {
            weeklyData,
            monthlyData,
            categoryTrends,
            totalTransactions: transactions.length
        };
    }

    calculateWeeklyAverage(transactions) {
        const weeks = {};
        transactions.forEach(t => {
            const week = this.getWeekKey(new Date(t.date));
            if (!weeks[week]) weeks[week] = { income: 0, expenses: 0 };
            
            if (t.type === 'income') weeks[week].income += parseFloat(t.amount);
            else weeks[week].expenses += parseFloat(t.amount);
        });

        const weekCount = Object.keys(weeks).length || 1;
        const totalIncome = Object.values(weeks).reduce((sum, w) => sum + w.income, 0);
        const totalExpenses = Object.values(weeks).reduce((sum, w) => sum + w.expenses, 0);

        return {
            income: totalIncome / weekCount,
            expenses: totalExpenses / weekCount
        };
    }

    calculateMonthlyTrend(transactions) {
        const months = {};
        transactions.forEach(t => {
            const month = this.getMonthKey(new Date(t.date));
            if (!months[month]) months[month] = { income: 0, expenses: 0, net: 0 };
            
            if (t.type === 'income') {
                months[month].income += parseFloat(t.amount);
                months[month].net += parseFloat(t.amount);
            } else {
                months[month].expenses += parseFloat(t.amount);
                months[month].net -= parseFloat(t.amount);
            }
        });

        const monthKeys = Object.keys(months).sort();
        if (monthKeys.length < 2) {
            return { direction: 'stabil', percentage: 0 };
        }

        const firstMonth = months[monthKeys[0]].net;
        const lastMonth = months[monthKeys[monthKeys.length - 1]].net;
        
        const change = ((lastMonth - firstMonth) / Math.abs(firstMonth || 1)) * 100;
        
        return {
            direction: change > 5 ? 'naik' : change < -5 ? 'turun' : 'stabil',
            percentage: change
        };
    }

    analyzePeriodData(transactions, startDate, endDate) {
        const days = Math.ceil((new Date(endDate) - new Date(startDate)) / (24 * 60 * 60 * 1000)) + 1;
        
        const income = transactions.filter(t => t.type === 'income');
        const expenses = transactions.filter(t => t.type === 'expense');
        
        const categoryBreakdown = {};
        expenses.forEach(t => {
            const category = t.category_name || 'Lainnya';
            categoryBreakdown[category] = (categoryBreakdown[category] || 0) + parseFloat(t.amount);
        });

        const dailyTransactions = {};
        transactions.forEach(t => {
            const date = t.date;
            dailyTransactions[date] = (dailyTransactions[date] || 0) + 1;
        });

        return {
            periodDays: days,
            totalIncome: income.reduce((sum, t) => sum + parseFloat(t.amount), 0),
            totalExpenses: expenses.reduce((sum, t) => sum + parseFloat(t.amount), 0),
            categoryBreakdown,
            dailyTransactions,
            averageDaily: transactions.length / days,
            peakDay: Object.keys(dailyTransactions).reduce((a, b) => dailyTransactions[a] > dailyTransactions[b] ? a : b, Object.keys(dailyTransactions)[0])
        };
    }

    getPeriodName(period) {
        switch (period.toLowerCase()) {
            case 'harian':
            case 'daily':
                return 'Hari Ini';
            case 'mingguan':
            case 'weekly':
                return 'Minggu Ini';
            case 'bulanan':
            case 'monthly':
            default:
                return 'Bulan Ini';
        }
    }

    getTopExpenseCategories(expenses) {
        const categories = {};
        expenses.forEach(t => {
            const category = t.category_name || 'Lainnya';
            categories[category] = (categories[category] || 0) + parseFloat(t.amount);
        });

        return Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map((entry, index) => `${index + 1}. ${entry[0]}: ${this.formatCurrency(entry[1])}`)
            .join('\n');
    }

    getWeekKey(date) {
        const year = date.getFullYear();
        const week = Math.ceil(((date - new Date(year, 0, 1)) / 86400000 + new Date(year, 0, 1).getDay() + 1) / 7);
        return `${year}-W${week}`;
    }

    getMonthKey(date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }


    async handleAdvice(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia.');
            return;
        }

        try {
            await message.reply('🤖 Menganalisis data keuangan Anda untuk memberikan saran...');

            // Get user's financial context
            const userContext = await this.reportService.getUserContext(userPhone);
            const balance = await this.db.getBalance(userPhone);
            const recentTransactions = await this.db.getTransactions(userPhone, 20);

            // Get spending patterns for last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const startDate = thirtyDaysAgo.toISOString().split('T')[0];
            const endDate = new Date().toISOString().split('T')[0];
            
            const monthlyTransactions = await this.db.getTransactionsByDateRange(userPhone, startDate, endDate);

            // Analyze spending patterns
            const spendingAnalysis = this.analyzeSpendingPatterns(monthlyTransactions, balance);

            // Generate AI advice
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
            this.logger.error('Error generating advice:', error);
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

            // Get historical data for prediction
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

            // Analyze patterns for prediction
            const patterns = this.analyzePredictionPatterns(historicalTransactions);
            
            // Generate AI prediction
            const prediction = await this.ai.generateFinancialPrediction(historicalTransactions, balance, patterns);

            // Calculate trend indicators
            const weeklyAverage = this.calculateWeeklyAverage(historicalTransactions);
            const monthlyTrend = this.calculateMonthlyTrend(historicalTransactions);

            const response = `🔮 *Prediksi Keuangan AI*\n\n` +
                `📊 *Analisis Historik (60 hari):*\n` +
                `💳 Total Transaksi: ${historicalTransactions.length}\n` +
                `📈 Rata-rata Mingguan: ${this.formatCurrency(weeklyAverage.income)} (masuk) | ${this.formatCurrency(weeklyAverage.expenses)} (keluar)\n` +
                `📉 Trend Bulanan: ${monthlyTrend.direction} ${Math.abs(monthlyTrend.percentage).toFixed(1)}%\n\n` +
                `🤖 *Prediksi AI:*\n${prediction}\n\n` +
                `⚠️ *Disclaimer:* Prediksi berdasarkan pola historis dan dapat berubah sesuai kondisi.`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error generating AI prediction:', error);
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

            // Get period for summary (default: current month)
            const period = args[0] || 'bulanan';
            let startDate, endDate;
            
            const now = new Date();
            if (period === 'mingguan' || period === 'weekly') {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                startDate = weekStart.toISOString().split('T')[0];
                endDate = now.toISOString().split('T')[0];
            } else if (period === 'harian' || period === 'daily') {
                startDate = endDate = now.toISOString().split('T')[0];
            } else {
                // Monthly (default)
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate = monthStart.toISOString().split('T')[0];
                endDate = now.toISOString().split('T')[0];
            }

            // Get transactions for the period
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

            // Analyze period data
            const periodAnalysis = this.analyzePeriodData(transactions, startDate, endDate);
            
            // Generate AI summary
            const summary = await this.ai.generateFinancialSummary(transactions, balance, periodAnalysis, period);

            // Calculate key metrics
            const periodIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const periodExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount), 0);
            const periodBalance = periodIncome - periodExpenses;

            // Get top categories
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
            this.logger.error('Error generating AI summary:', error);
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

            // Get recent uncategorized or miscategorized transactions
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

            // Find transactions that might need better categorization
            const suggestedChanges = [];
            let processedCount = 0;

            for (const transaction of recentTransactions) {
                if (processedCount >= 10) break; // Limit to 10 suggestions at a time

                const aiSuggestion = await this.ai.suggestCategory(
                    transaction.description,
                    transaction.type,
                    categories
                );

                if (aiSuggestion && aiSuggestion.category &&
                    aiSuggestion.confidence > 0.8 &&
                    aiSuggestion.category.name !== transaction.category_name) {
                    
                    suggestedChanges.push({
                        transaction,
                        suggested: aiSuggestion,
                        current: transaction.category_name || 'Tidak ada'
                    });
                    processedCount++;
                }
            }

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

            // Show suggestions
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

            // Store suggestions for auto-apply
            if (!global.autoCategorizationSuggestions) {
                global.autoCategorizationSuggestions = new Map();
            }
            
            const highConfidenceSuggestions = suggestedChanges.filter(c => c.suggested.confidence > 0.9);
            global.autoCategorizationSuggestions.set(userPhone, {
                suggestions: highConfidenceSuggestions,
                timestamp: Date.now()
            });

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error in auto categorization:', error);
            await message.reply('❌ Gagal melakukan kategorisasi otomatis: ' + error.message);
        }
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

    // Admin Menu Handler
    async handleAdminMenu(message, userPhone, args) {
        try {
            // Check if user is admin
            const isAdmin = await this.db.isUserAdmin(userPhone);
            if (!isAdmin) {
                await message.reply('❌ Akses ditolak. Hanya admin yang dapat menggunakan menu ini.');
                return;
            }

            const adminMenuText = `👑 *Menu Administrator*

🛠️ *MANAJEMEN USER:*

📋 /user-list - Lihat 10 user terbaru
👤 /user-detail [phone] - Detail lengkap user
🔄 /change-plan [phone] [plan] - Ubah plan user
⛔ /suspend-user [phone] - Suspend/unsuspend user
🔃 /reset-limit [phone] - Reset limit harian user

🏷️ *MANAJEMEN KATEGORI:*

➕ /kategori-baru [nama] [type] [warna] - Tambah kategori baru
✏️ /edit-kategori [id] [nama] [warna] - Edit kategori
🗑️ /hapus-kategori [id] - Nonaktifkan kategori

📊 *INFORMASI SISTEM:*

📈 /stats - Statistik sistem

💡 *Contoh Penggunaan:*

• /user-detail +6281234567890
• /change-plan +6281234567890 premium
• /reset-limit +6281234567890
• /suspend-user +6281234567890

🔄 *Plan yang tersedia:* free, premium

⚠️ *Perhatian:* Hanya admin yang dapat menggunakan menu ini!`;

            await message.reply(adminMenuText);
        } catch (error) {
            this.logger.error('Error in handleAdminMenu:', error);
            await message.reply('❌ Terjadi kesalahan saat mengakses menu admin.');
        }
    }

    // Change User Plan (Admin only)
    async handleChangePlan(message, userPhone, args) {
        try {
            // Check if user is admin
            const isAdmin = await this.db.isUserAdmin(userPhone);
            if (!isAdmin) {
                await message.reply('❌ Akses ditolak. Hanya admin yang dapat mengubah plan user.');
                return;
            }

            if (args.length < 2) {
                await message.reply('📝 Cara pakai: /change-plan [nomor_phone] [nama_plan]\n\nContoh: /change-plan +6281234567890 premium\n\nPlan tersedia: free, premium');
                return;
            }

            const targetPhone = args[0];
            const newPlanName = args[1].toLowerCase();

            // Validate target user exists
            const targetUser = await this.db.getUser(targetPhone);
            if (!targetUser) {
                await message.reply(`❌ User dengan nomor ${targetPhone} tidak ditemukan.`);
                return;
            }

            // Change the plan
            const newPlan = await this.db.changeUserPlan(userPhone, targetPhone, newPlanName);
            
            await message.reply(
                `✅ *Plan Berhasil Diubah!*\n\n` +
                `👤 User: ${targetUser.name} (${targetPhone})\n` +
                `💎 Plan Baru: ${newPlan.display_name}\n` +
                `📊 Limit Transaksi: ${newPlan.monthly_transaction_limit || '∞'} per hari\n` +
                `🔄 Kuota transaksi telah direset ke 0.`
            );

        } catch (error) {
            this.logger.error('Error in handleChangePlan:', error);
            await message.reply('❌ Gagal mengubah plan: ' + error.message);
        }
    }

    // Suspend User (Admin only)
    async handleSuspendUser(message, userPhone, args) {
        try {
            // Check if user is admin
            const isAdmin = await this.db.isUserAdmin(userPhone);
            if (!isAdmin) {
                await message.reply('❌ Akses ditolak. Hanya admin yang dapat menangguhkan user.');
                return;
            }

            if (args.length < 1) {
                await message.reply('📝 Cara pakai: /suspend-user [nomor_phone]\n\nContoh: /suspend-user +6281234567890\n\nCatatan: Jika user sudah suspended, perintah ini akan meng-unsuspend.');
                return;
            }

            const targetPhone = args[0];

            // Validate target user exists
            const targetUser = await this.db.getUser(targetPhone);
            if (!targetUser) {
                await message.reply(`❌ User dengan nomor ${targetPhone} tidak ditemukan.`);
                return;
            }

            // Toggle suspend status
            const newStatus = !targetUser.is_active;
            await this.db.suspendUser(userPhone, targetPhone, !newStatus);
            
            const statusText = newStatus ? 'Diaktifkan kembali' : 'Ditangguhkan';
            const statusEmoji = newStatus ? '✅' : '⛔';
            
            await message.reply(
                `${statusEmoji} *User ${statusText}!*\n\n` +
                `👤 User: ${targetUser.name} (${targetPhone})\n` +
                `📊 Status: ${newStatus ? 'Aktif' : 'Suspended'}\n\n` +
                `${newStatus ? '✅ User dapat menggunakan bot kembali.' : '⛔ User tidak dapat menggunakan bot.'}`
            );

        } catch (error) {
            this.logger.error('Error in handleSuspendUser:', error);
            await message.reply('❌ Gagal mengubah status user: ' + error.message);
        }
    }

    // User List (Admin only) - Show latest 10 users by default
    async handleUserList(message, userPhone, args) {
        try {
            // Check if user is admin
            const isAdmin = await this.db.isUserAdmin(userPhone);
            if (!isAdmin) {
                await message.reply('❌ Akses ditolak. Hanya admin yang dapat melihat daftar user.');
                return;
            }

            // Maximum 10 users, ordered by newest first
            const limit = 10;
            const users = await this.db.getUserList(userPhone, limit, 0, 'newest');

            if (users.length === 0) {
                await message.reply('📋 Tidak ada user yang terdaftar.');
                return;
            }

            let response = `📋 *10 User Terbaru (${users.length} user)*\n\n`;

            users.forEach((user, index) => {
                const status = user.is_active ? '✅' : '⛔';
                const adminBadge = user.is_admin ? ' 👑' : '';
                const planInfo = user.plan_name || 'No Plan';
                
                response += `${index + 1}. ${status} ${user.name}${adminBadge}\n`;
                response += `   📱 ${user.phone}\n`;
                response += `   📧 ${user.email}\n`;
                response += `   💎 ${planInfo}\n`;
                response += `   📊 ${user.transaction_count || 0} transaksi\n\n`;
            });

            response += `💡 *Commands:*\n`;
            response += `• /user-detail [phone] - Detail user\n`;
            response += `• /change-plan [phone] [plan] - Ubah plan\n`;
            response += `• /suspend-user [phone] - Suspend/unsuspend\n`;
            response += `• /reset-limit [phone] - Reset limit harian`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error in handleUserList:', error);
            await message.reply('❌ Gagal mengambil daftar user: ' + error.message);
        }
    }

    // Reset User Daily Limit (Admin only)
    async handleResetLimit(message, userPhone, args) {
        try {
            // Check if user is admin
            const isAdmin = await this.db.isUserAdmin(userPhone);
            if (!isAdmin) {
                await message.reply('❌ Akses ditolak. Hanya admin yang dapat reset limit user.');
                return;
            }

            if (args.length < 1) {
                await message.reply('📝 Cara pakai: /reset-limit [nomor_phone]\n\nContoh: /reset-limit +6281234567890\n\nPerintah ini akan reset limit transaksi harian user ke 0.');
                return;
            }

            const targetPhone = args[0];

            // Check if target user exists
            const targetUser = await this.db.getUser(targetPhone);
            if (!targetUser) {
                await message.reply(`❌ User dengan nomor ${targetPhone} tidak ditemukan.`);
                return;
            }

            // Reset daily limit
            await this.db.resetUserDailyLimit(targetPhone);
            
            // Get updated subscription info
            const subscription = await this.db.getUserSubscription(targetPhone);
            
            await message.reply(
                `✅ *Limit Harian Berhasil Direset!*\n\n` +
                `👤 User: ${targetUser.name} (${targetPhone})\n` +
                `💎 Plan: ${subscription.display_name}\n` +
                `📊 Limit: ${subscription.monthly_transaction_limit || '∞'} transaksi/hari\n` +
                `🔄 Transaksi count: 0 (direset)\n\n` +
                `✅ User dapat melakukan transaksi lagi.`
            );

        } catch (error) {
            this.logger.error('Error in handleResetLimit:', error);
            await message.reply('❌ Gagal reset limit: ' + error.message);
        }
    }

    // User Detail (Admin only)
    async handleUserDetail(message, userPhone, args) {
        try {
            // Check if user is admin
            const isAdmin = await this.db.isUserAdmin(userPhone);
            if (!isAdmin) {
                await message.reply('❌ Akses ditolak. Hanya admin yang dapat melihat detail user.');
                return;
            }

            if (args.length < 1) {
                await message.reply('📝 Cara pakai: /user-detail [nomor_phone]\n\nContoh: /user-detail +6281234567890');
                return;
            }

            const targetPhone = args[0];

            // Check if user exists
            const user = await this.db.getUser(targetPhone);
            if (!user) {
                await message.reply(
                    `❌ *User Belum Registrasi*\n\n` +
                    `📱 Nomor: ${targetPhone}\n` +
                    `📝 Status: Belum terdaftar di sistem\n\n` +
                    `💡 User perlu mengirim pesan ke bot untuk memulai registrasi.`
                );
                return;
            }

            // Get subscription info
            const subscription = await this.db.getUserSubscription(targetPhone);
            
            // Get transaction count for today
            const today = new Date().toISOString().split('T')[0];
            const todayTransactions = await this.db.getTransactionsByDateRange(targetPhone, today, today);
            
            // Format user detail
            const statusEmoji = user.is_active ? '✅' : '⛔';
            const adminBadge = user.is_admin ? ' 👑' : '';
            const registrationStatus = user.registration_completed ? '✅ Lengkap' : '⚠️ Belum lengkap';
            
            let response = `👤 *Detail User*\n\n`;
            response += `${statusEmoji} **${user.name}**${adminBadge}\n`;
            response += `📱 Phone: ${user.phone}\n`;
            response += `📧 Email: ${user.email || 'Tidak ada'}\n`;
            response += `🏙️ Kota: ${user.city || 'Tidak ada'}\n`;
            response += `🕐 Timezone: ${user.timezone || 'Asia/Jakarta'}\n\n`;
            
            response += `📊 **Status & Plan:**\n`;
            response += `📝 Registrasi: ${registrationStatus}\n`;
            response += `🔄 Aktif: ${user.is_active ? 'Ya' : 'Tidak'}\n`;
            response += `👑 Admin: ${user.is_admin ? 'Ya' : 'Tidak'}\n`;
            
            if (subscription) {
                response += `💎 Plan: ${subscription.display_name}\n`;
                response += `📊 Transaksi hari ini: ${subscription.transaction_count || 0}`;
                if (subscription.monthly_transaction_limit) {
                    response += `/${subscription.monthly_transaction_limit}`;
                }
                response += `\n`;
                response += `🗓️ Reset terakhir: ${subscription.last_reset_date || 'Tidak ada'}\n`;
                response += `💳 Status bayar: ${subscription.payment_status || 'free'}\n`;
            } else {
                response += `💎 Plan: Tidak ada subscription\n`;
            }
            
            response += `\n📈 **Aktivitas:**\n`;
            response += `📅 Terdaftar: ${user.created_at ? new Date(user.created_at).toLocaleDateString('id-ID') : 'Tidak diketahui'}\n`;
            response += `⏰ Aktivitas terakhir: ${user.last_activity ? new Date(user.last_activity).toLocaleString('id-ID') : 'Tidak ada'}\n`;
            response += `🔢 Transaksi hari ini: ${todayTransactions ? todayTransactions.length : 0} transaksi\n`;
            
            response += `\n💡 **Quick Actions:**\n`;
            response += `• /change-plan ${targetPhone} [plan]\n`;
            response += `• /suspend-user ${targetPhone}\n`;
            response += `• /reset-limit ${targetPhone}`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error in handleUserDetail:', error);
            await message.reply('❌ Gagal mengambil detail user: ' + error.message);
        }
    }

    // AI Info Handler
    async handleAIInfo(message, userPhone, args) {
        try {
            if (!this.ai.isAvailable()) {
                await message.reply('❌ Fitur AI tidak tersedia saat ini.');
                return;
            }

            const providerInfo = this.ai.getProviderInfo();
            
            let response = `🤖 *Informasi AI Provider*\n\n`;
            response += `📡 **Provider:** ${providerInfo.provider.toUpperCase()}\n`;
            response += `🌐 **Base URL:** ${providerInfo.baseURL}\n`;
            response += `🔧 **Model:** ${providerInfo.model}\n`;
            response += `✅ **Status:** ${providerInfo.isEnabled ? 'Aktif' : 'Tidak Aktif'}\n\n`;
            
            response += `💡 **Fitur AI yang Tersedia:**\n`;
            response += `• /chat - Chat dengan AI\n`;
            response += `• /analisis - Analisis keuangan AI\n`;
            response += `• /saran - Saran keuangan personal\n`;
            response += `• /prediksi-ai - Prediksi keuangan\n`;
            response += `• /ringkasan-ai - Ringkasan AI\n`;
            response += `• /kategori-otomatis - Auto kategorisasi\n\n`;
            
            response += `⚙️ **Konfigurasi Provider:**\n`;
            response += `Untuk mengubah provider AI, set environment variables:\n`;
            response += `• AI_PROVIDER=deepseek|openai|openaicompatible\n`;
            response += `• [PROVIDER]_API_KEY\n`;
            response += `• [PROVIDER]_BASE_URL\n`;
            response += `• [PROVIDER]_MODEL`;

            await message.reply(response);
        } catch (error) {
            this.logger.error('Error in handleAIInfo:', error);
            await message.reply('❌ Terjadi kesalahan saat mengambil informasi AI provider.');
        }
    }

    // Bulk Transaction Handler
    async handleBulkTransaction(message, userPhone, args) {
        if (!this.ai.isAvailable()) {
            await message.reply('❌ Fitur AI tidak tersedia. Fitur bulk transaksi memerlukan AI untuk memproses data.');
            return;
        }

        if (args.length === 0) {
            await message.reply(
                '💳 *Bulk Transaksi dengan AI*\n\n' +
                '📝 **Cara pakai:** /bulk [daftar transaksi]\n\n' +
                '✅ **Contoh:**\n' +
                '```\n' +
                '/bulk Habis belanja baju albi 33k\n' +
                'Mainan albi 30k\n' +
                'Galon + kopi 20k\n' +
                'Parkir 2k\n' +
                'Permen 2k\n' +
                '```\n\n' +
                '🤖 **AI akan otomatis:**\n' +
                '• Memisahkan setiap transaksi\n' +
                '• Mendeteksi jumlah dan deskripsi\n' +
                '• Mengkategorikan secara otomatis\n' +
                '• Meminta konfirmasi sebelum menyimpan\n\n' +
                '💡 **Tips:**\n' +
                '• Tulis satu transaksi per baris\n' +
                '• Gunakan "k" untuk ribu (33k = 33.000)\n' +
                '• Sebutkan aktivitas dengan jelas\n' +
                '• Pisahkan dengan enter atau koma'
            );
            return;
        }

        try {
            // Join all arguments to form the full text
            const bulkText = args.join(' ');
            
            await message.reply('🤖 Sedang memproses transaksi bulk dengan AI...');

            // Parse bulk transactions using AI
            const bulkResult = await this.ai.parseBulkTransactions(bulkText, userPhone);

            if (bulkResult.error) {
                await message.reply(`❌ Gagal memproses bulk transaksi: ${bulkResult.error}`);
                return;
            }

            if (bulkResult.totalTransactions === 0) {
                await message.reply(
                    '❌ Tidak ada transaksi yang berhasil diproses.\n\n' +
                    '💡 **Tips:**\n' +
                    '• Pastikan format jelas: "aktivitas jumlah"\n' +
                    '• Contoh: "makan siang 25000" atau "makan siang 25k"\n' +
                    '• Pisahkan setiap transaksi dengan baris baru\n\n' +
                    'Coba lagi dengan format yang lebih jelas.'
                );
                return;
            }

            // Check transaction limits before showing preview
            const limitCheck = await this.db.checkTransactionLimit(userPhone);
            if (!limitCheck.allowed) {
                if (limitCheck.reason === 'Daily limit reached') {
                    await message.reply(
                        `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                        '⏰ Kuota akan direset besok pagi.\n' +
                        '💎 Upgrade ke Premium untuk unlimited transaksi.\n' +
                        "Ketik 'upgrade' untuk info lebih lanjut!"
                    );
                } else {
                    await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
                }
                return;
            }

            // Check if user has enough quota for all transactions
            const remainingQuota = limitCheck.subscription.monthly_transaction_limit
                ? limitCheck.remaining
                : Infinity;

            if (limitCheck.subscription.monthly_transaction_limit && bulkResult.totalTransactions > remainingQuota) {
                await message.reply(
                    `⚠️ **Kuota Tidak Mencukupi**\n\n` +
                    `📊 Transaksi yang akan ditambah: ${bulkResult.totalTransactions}\n` +
                    `📊 Kuota tersisa: ${remainingQuota}/${limitCheck.subscription.monthly_transaction_limit}\n\n` +
                    `💡 **Solusi:**\n` +
                    `• Kurangi jumlah transaksi menjadi maksimal ${remainingQuota}\n` +
                    `• Atau upgrade ke Premium untuk unlimited transaksi\n\n` +
                    `Ketik 'upgrade' untuk info lebih lanjut!`
                );
                return;
            }

            // Show preview and ask for confirmation
            let response = `💳 **Preview Bulk Transaksi**\n\n`;
            response += `🤖 **AI berhasil memproses ${bulkResult.totalTransactions} transaksi:**\n`;
            response += `📊 Tingkat keyakinan rata-rata: ${Math.round(bulkResult.overallConfidence * 100)}%\n\n`;

            if (bulkResult.filtered > 0) {
                response += `⚠️ ${bulkResult.filtered} transaksi difilter karena keyakinan rendah\n\n`;
            }

            let totalAmount = 0;
            bulkResult.transactions.forEach((transaction, index) => {
                const emoji = transaction.type === 'income' ? '📈' : '📉';
                const confidencePercent = Math.round(transaction.confidence * 100);
                response += `${index + 1}. ${emoji} ${this.formatCurrency(transaction.amount)}\n`;
                response += `   📝 ${transaction.description}\n`;
                response += `   🏷️ ${transaction.category}\n`;
                response += `   🤖 ${confidencePercent}%\n\n`;
                
                if (transaction.type === 'expense') {
                    totalAmount += transaction.amount;
                } else {
                    totalAmount -= transaction.amount;
                }
            });

            response += `💰 **Total pengeluaran bersih:** ${this.formatCurrency(Math.abs(totalAmount))}\n\n`;
            
            const newRemaining = limitCheck.subscription.monthly_transaction_limit
                ? remainingQuota - bulkResult.totalTransactions
                : '∞';
            response += `📊 **Kuota setelah input:** ${newRemaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}\n\n`;

            response += `✅ **Konfirmasi:** Balas dengan "YA" atau "KONFIRMASI" untuk menyimpan semua transaksi\n`;
            response += `❌ **Batal:** Balas dengan "BATAL" untuk membatalkan\n`;
            response += `✏️ **Edit:** Balas dengan "EDIT [nomor]" untuk edit transaksi tertentu`;

            // Store bulk transaction session
            if (!global.bulkTransactionSessions) {
                global.bulkTransactionSessions = new Map();
            }
            
            global.bulkTransactionSessions.set(userPhone, {
                transactions: bulkResult.transactions,
                timestamp: Date.now(),
                totalTransactions: bulkResult.totalTransactions,
                overallConfidence: bulkResult.overallConfidence
            });

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error in handleBulkTransaction:', error);
            await message.reply('❌ Terjadi kesalahan saat memproses bulk transaksi: ' + error.message);
        }
    }

    // ===== DEBT/RECEIVABLE HANDLING METHODS =====

    /**
     * Handle natural language debt/receivable input
     */
    async handleNaturalLanguageDebtReceivable(message, userPhone, text) {
        try {
            // Check if text contains debt/receivable keywords
            const debtReceivableKeywords = [
                'piutang', 'hutang', 'berhutang', 'pinjam', 'belum bayar', 'cicilan',
                'kredit', 'bayar nanti', 'tempo', 'ngutang', 'utang'
            ];
            
            const hasKeyword = debtReceivableKeywords.some(keyword => 
                text.toLowerCase().includes(keyword)
            );
            
            if (!hasKeyword) {
                return false; // Not a debt/receivable transaction
            }

            // Check if user has pending debt/receivable confirmation
            if (await this.handlePendingDebtReceivableConfirmation(message, userPhone, text)) {
                return true;
            }

            // Parse the debt/receivable input using AI
            const parsed = await this.debtReceivableService.parseDebtReceivableInput(text, userPhone);
            
            if (!parsed.success || parsed.confidence < 0.6) {
                // Low confidence, ask for clarification
                await message.reply(
                    '🤔 Saya kurang yakin dengan maksud Anda tentang hutang/piutang.\n\n' +
                    '💡 Coba gunakan format yang lebih jelas:\n' +
                    '• Untuk piutang: "Piutang [nama] [keterangan] [nominal]"\n' +
                    '• Untuk hutang: "Hutang ke [nama] [keterangan] [nominal]"\n\n' +
                    'Contoh:\n' +
                    '• "Piutang Warung Madura Voucher Wifi 2Rebuan 200K"\n' +
                    '• "Hutang ke Toko Budi sembako 150K"'
                );
                return true;
            }

            // High confidence, ask for confirmation with phone number
            const confirmationMessage = this.debtReceivableService.generateConfirmationMessage(parsed, parsed.clientName);
            
            // Store pending confirmation
            if (!global.pendingDebtReceivableConfirmations) {
                global.pendingDebtReceivableConfirmations = new Map();
            }
            
            global.pendingDebtReceivableConfirmations.set(userPhone, {
                parsed: parsed,
                timestamp: Date.now()
            });

            await message.reply(confirmationMessage);
            return true;

        } catch (error) {
            this.logger.error('Error in handleNaturalLanguageDebtReceivable:', error);
            return false;
        }
    }

    /**
     * Handle pending debt/receivable confirmation
     */
    async handlePendingDebtReceivableConfirmation(message, userPhone, text) {
        try {
            if (!global.pendingDebtReceivableConfirmations) {
                return false;
            }

            const pending = global.pendingDebtReceivableConfirmations.get(userPhone);
            if (!pending) {
                return false;
            }

            // Check timeout (5 minutes)
            if (Date.now() - pending.timestamp > 5 * 60 * 1000) {
                global.pendingDebtReceivableConfirmations.delete(userPhone);
                return false;
            }

            const lowerText = text.toLowerCase().trim();
            
            // Handle "Tidak" case - process without phone number
            if (lowerText === 'tidak' || lowerText === 'no' || lowerText === 'n' || lowerText === 'tidak ada') {
                await this.processDebtReceivableRecord(message, userPhone, pending.parsed, null);
                global.pendingDebtReceivableConfirmations.delete(userPhone);
                return true;
            }

            // Handle direct phone number input
            let clientPhone = null;
            
            // Try to parse as phone number
            clientPhone = this.cleanPhoneNumber(text);
            if (!clientPhone) {
                await message.reply(
                    '❌ Format nomor tidak valid!\n\n' +
                    '💡 Gunakan format: 08xxxxxxxxxx atau 62xxxxxxxxxx\n' +
                    'Atau ketik "tidak" jika tidak punya nomor HP'
                );
                return true;
            }

            // Process the debt/receivable record
            await this.processDebtReceivableRecord(message, userPhone, pending.parsed, clientPhone);
            global.pendingDebtReceivableConfirmations.delete(userPhone);
            return true;

        } catch (error) {
            this.logger.error('Error in handlePendingDebtReceivableConfirmation:', error);
            return false;
        }
    }

    /**
     * Process and save debt/receivable record
     */
    async processDebtReceivableRecord(message, userPhone, parsed, clientPhone) {
        try {
            // Check transaction limit before processing
            const limitCheck = await this.db.checkTransactionLimit(userPhone);
            if (!limitCheck.allowed) {
                if (limitCheck.reason === 'Daily limit reached') {
                    await message.reply(
                        `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                        '⏰ Kuota akan direset besok pagi.\n' +
                        '💎 Upgrade ke Premium untuk unlimited transaksi.\n' +
                        "Ketik 'upgrade' untuk info lebih lanjut!"
                    );
                } else {
                    await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
                }
                return;
            }

            // Add the debt/receivable record
            const result = await this.debtReceivableService.addDebtReceivable(
                userPhone, 
                parsed.type, 
                parsed.clientName, 
                parsed.amount, 
                parsed.description,
                clientPhone
            );

            // Increment transaction count for limited plans
            if (limitCheck.subscription.monthly_transaction_limit !== null) {
                await this.db.incrementTransactionCount(userPhone);
            }

            const remaining = limitCheck.subscription.monthly_transaction_limit
                ? limitCheck.remaining - 1
                : '∞';

            // Generate success message
            const typeText = parsed.type === 'PIUTANG' ? 'Piutang' : 'Hutang';
            const directionText = parsed.type === 'PIUTANG' ? 
                `${parsed.clientName} berhutang kepada Anda` : 
                `Anda berhutang ke ${parsed.clientName}`;
            
            let response = `✅ ${typeText} berhasil dicatat!\n\n`;
            response += `👤 Client: ${parsed.clientName}\n`;
            if (clientPhone) {
                response += `📱 Phone: ${clientPhone}\n`;
            }
            response += `💰 Jumlah: ${this.debtReceivableService.formatCurrency(parsed.amount)}\n`;
            response += `📝 Keterangan: ${parsed.description}\n`;
            response += `📋 Status: ${directionText}\n`;
            response += `🆔 ID: ${result.recordId}\n\n`;
            response += `🤖 Tingkat Keyakinan AI: ${Math.round(parsed.confidence * 100)}%\n`;
            response += `📊 Sisa kuota: ${remaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error processing debt/receivable record:', error);
            await message.reply('❌ Gagal menyimpan data hutang/piutang: ' + error.message);
        }
    }

    /**
     * Clean and validate phone number
     */
    cleanPhoneNumber(phone) {
        if (!phone || typeof phone !== 'string') return null;
        
        // Remove all non-digits
        let cleaned = phone.replace(/\D/g, '');
        
        // Handle Indonesian phone numbers
        if (cleaned.startsWith('62')) {
            // Already in international format
            return cleaned;
        } else if (cleaned.startsWith('0')) {
            // Convert to international format
            return '62' + cleaned.substring(1);
        } else if (cleaned.length >= 9 && cleaned.length <= 13) {
            // Assume it's missing the leading 0
            return '62' + cleaned;
        }
        
        return null; // Invalid format
    }

    /**
     * Handle manual debt command
     */
    async handleDebt(message, userPhone, args) {
        if (args.length < 3) {
            await message.reply(
                '📝 Cara pakai: /hutang [nama] [jumlah] [keterangan]\n\n' +
                'Contoh:\n' +
                '• /hutang "Toko Budi" 150000 "sembako bulanan"\n' +
                '• /hutang Warung 50000 "makan siang"\n\n' +
                '💡 Gunakan tanda kutip jika nama mengandung spasi'
            );
            return;
        }

        await this.processManualDebtReceivable(message, userPhone, 'HUTANG', args);
    }

    /**
     * Handle manual receivable command
     */
    async handleReceivable(message, userPhone, args) {
        if (args.length < 3) {
            await message.reply(
                '📝 Cara pakai: /piutang [nama] [jumlah] [keterangan]\n\n' +
                'Contoh:\n' +
                '• /piutang "Warung Madura" 200000 "Voucher Wifi 2Rebuan"\n' +
                '• /piutang Client 500000 "jasa desain"\n\n' +
                '💡 Gunakan tanda kutip jika nama mengandung spasi'
            );
            return;
        }

        await this.processManualDebtReceivable(message, userPhone, 'PIUTANG', args);
    }

    /**
     * Process manual debt/receivable entry
     */
    async processManualDebtReceivable(message, userPhone, type, args) {
        try {
            // Parse arguments
            let clientName = args[0];
            const amount = parseFloat(args[1]);
            const description = args.slice(2).join(' ');

            // Remove quotes if present
            if (clientName.startsWith('"') && clientName.endsWith('"')) {
                clientName = clientName.slice(1, -1);
            }

            // Validate amount
            if (isNaN(amount) || amount <= 0) {
                await message.reply('❌ Silakan masukkan jumlah yang valid.');
                return;
            }

            // Check transaction limit
            const limitCheck = await this.db.checkTransactionLimit(userPhone);
            if (!limitCheck.allowed) {
                if (limitCheck.reason === 'Daily limit reached') {
                    await message.reply(
                        `🚫 Kuota transaksi harian Free Plan Anda sudah habis (${limitCheck.subscription.transaction_count}/${limitCheck.subscription.monthly_transaction_limit})!\n\n` +
                        '⏰ Kuota akan direset besok pagi.\n' +
                        '💎 Upgrade ke Premium untuk unlimited transaksi.'
                    );
                } else {
                    await message.reply('❌ Akses ditolak. Silakan periksa status subscription Anda.');
                }
                return;
            }

            // Add the record
            const result = await this.debtReceivableService.addDebtReceivable(
                userPhone, type, clientName, amount, description
            );

            // Increment transaction count
            if (limitCheck.subscription.monthly_transaction_limit !== null) {
                await this.db.incrementTransactionCount(userPhone);
            }

            const remaining = limitCheck.subscription.monthly_transaction_limit
                ? limitCheck.remaining - 1
                : '∞';

            // Success response
            const typeText = type === 'PIUTANG' ? 'Piutang' : 'Hutang';
            let response = `✅ ${typeText} berhasil dicatat!\n\n`;
            response += `👤 Client: ${clientName}\n`;
            response += `💰 Jumlah: ${this.debtReceivableService.formatCurrency(amount)}\n`;
            response += `📝 Keterangan: ${description}\n`;
            response += `🆔 ID: ${result.recordId}\n\n`;
            response += `📊 Sisa kuota: ${remaining}${limitCheck.subscription.monthly_transaction_limit ? `/${limitCheck.subscription.monthly_transaction_limit}` : ''}`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error in processManualDebtReceivable:', error);
            await message.reply('❌ Gagal mencatat hutang/piutang: ' + error.message);
        }
    }

    /**
     * Handle debt/receivable list command
     */
    async handleDebtReceivableList(message, userPhone, args) {
        try {
            const type = args[0] ? args[0].toUpperCase() : null;
            const validTypes = ['HUTANG', 'PIUTANG'];
            
            if (type && !validTypes.includes(type)) {
                await message.reply(
                    '❌ Tipe tidak valid!\n\n' +
                    '📝 Cara pakai:\n' +
                    '• /hutang-piutang - lihat semua\n' +
                    '• /hutang-piutang HUTANG - lihat hutang saja\n' +
                    '• /hutang-piutang PIUTANG - lihat piutang saja'
                );
                return;
            }

            const records = await this.debtReceivableService.getDebtReceivables(userPhone, type);
            
            if (records.length === 0) {
                const typeText = type ? 
                    (type === 'HUTANG' ? 'hutang' : 'piutang') : 
                    'hutang/piutang';
                await message.reply(`📋 Tidak ada data ${typeText} yang ditemukan.`);
                return;
            }

            // Group by type
            const hutangRecords = records.filter(r => r.type === 'HUTANG');
            const piutangRecords = records.filter(r => r.type === 'PIUTANG');

            let response = `📋 *Daftar Hutang Piutang*\n\n`;

            if (piutangRecords.length > 0) {
                response += `📈 *PIUTANG (${piutangRecords.length}):*\n`;
                piutangRecords.forEach((record, index) => {
                    response += `${index + 1}. ${record.clientName}\n`;
                    response += `   💰 ${this.debtReceivableService.formatCurrency(record.amount)}\n`;
                    response += `   📝 ${record.description}\n`;
                    response += `   🆔 ID: ${record.id}\n`;
                    if (record.clientPhone) {
                        response += `   📱 ${record.clientPhone}\n`;
                    }
                    response += `\n`;
                });
            }

            if (hutangRecords.length > 0) {
                response += `📉 *HUTANG (${hutangRecords.length}):*\n`;
                hutangRecords.forEach((record, index) => {
                    response += `${index + 1}. ${record.clientName}\n`;
                    response += `   💰 ${this.debtReceivableService.formatCurrency(record.amount)}\n`;
                    response += `   📝 ${record.description}\n`;
                    response += `   🆔 ID: ${record.id}\n`;
                    if (record.clientPhone) {
                        response += `   📱 ${record.clientPhone}\n`;
                    }
                    response += `\n`;
                });
            }

            response += `💡 *Tip:* Gunakan /lunas [ID] untuk menandai sebagai lunas`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error in handleDebtReceivableList:', error);
            await message.reply('❌ Gagal mengambil daftar hutang/piutang: ' + error.message);
        }
    }

    /**
     * Handle debt/receivable summary
     */
    async handleDebtReceivableSummary(message, userPhone, args) {
        try {
            const summary = await this.debtReceivableService.getDebtReceivableSummary(userPhone);
            
            let response = `💰 *Ringkasan Hutang Piutang*\n\n`;
            response += `📈 Total Piutang: ${this.debtReceivableService.formatCurrency(summary.totalPiutang)}\n`;
            response += `📊 Jumlah: ${summary.countPiutang} transaksi\n\n`;
            response += `📉 Total Hutang: ${this.debtReceivableService.formatCurrency(summary.totalHutang)}\n`;
            response += `📊 Jumlah: ${summary.countHutang} transaksi\n\n`;
            
            const netBalanceText = summary.netBalance >= 0 ? 
                `📈 Saldo Bersih: +${this.debtReceivableService.formatCurrency(summary.netBalance)}` :
                `📉 Saldo Bersih: ${this.debtReceivableService.formatCurrency(summary.netBalance)}`;
            
            response += `${netBalanceText}\n\n`;
            response += `💡 *Tips:*\n`;
            response += `• /hutang-piutang untuk lihat detail\n`;
            response += `• /lunas [ID] untuk tandai lunas`;

            await message.reply(response);

        } catch (error) {
            this.logger.error('Error in handleDebtReceivableSummary:', error);
            await message.reply('❌ Gagal mengambil ringkasan: ' + error.message);
        }
    }

    /**
     * Handle mark as paid command
     */
    async handleMarkAsPaid(message, userPhone, args) {
        if (args.length === 0) {
            await message.reply(
                '📝 Cara pakai: /lunas [ID]\n\n' +
                'Contoh: /lunas 123\n\n' +
                '💡 Gunakan /hutang-piutang untuk melihat daftar ID'
            );
            return;
        }

        try {
            const recordId = parseInt(args[0]);
            if (isNaN(recordId)) {
                await message.reply('❌ ID harus berupa angka!');
                return;
            }

            await this.debtReceivableService.markAsPaid(userPhone, recordId);
            
            await message.reply(
                `✅ Hutang/Piutang ID ${recordId} telah ditandai sebagai lunas!\n\n` +
                '📊 Gunakan /saldo-hutang untuk melihat ringkasan terbaru'
            );

        } catch (error) {
            this.logger.error('Error in handleMarkAsPaid:', error);
            if (error.message.includes('not found')) {
                await message.reply('❌ ID tidak ditemukan atau tidak valid!');
            } else {
                await message.reply('❌ Gagal menandai sebagai lunas: ' + error.message);
            }
        }
    }

    /**
     * Handle debt list command (hutang saja)
     */
    async handleDebtList(message, userPhone, args) {
        await this.handleDebtReceivableList(message, userPhone, ['HUTANG']);
    }

    /**
     * Handle receivable list command (piutang saja)
     */
    async handleReceivableList(message, userPhone, args) {
        await this.handleDebtReceivableList(message, userPhone, ['PIUTANG']);
    }

    /**
     * Handle main menu command
     */
    async handleMainMenu(message, userPhone, args) {
        try {
            const user = await this.db.getUser(userPhone);
            const subscription = await this.db.getUserSubscription(userPhone);
            const isAdmin = await this.db.isUserAdmin(userPhone);
            
            const adminBadge = isAdmin ? ' 👑' : '';
            const botName = process.env.BOT_NAME || 'Bot Keuangan';
            const remaining = subscription.monthly_transaction_limit
                ? subscription.monthly_transaction_limit - subscription.transaction_count
                : '∞';

            let menuText = `🏠 *MENU UTAMA*\n\n`;
            menuText += `👤 Halo ${user.name}${adminBadge}!\n`;
            menuText += `💎 Plan: ${subscription.display_name}\n`;
            menuText += `📊 Sisa transaksi: ${remaining}${subscription.monthly_transaction_limit ? `/${subscription.monthly_transaction_limit}` : ''}\n\n`;

            menuText += `💰 *TRANSAKSI UMUM:*\n`;
            menuText += `📈 /masuk [jumlah] [keterangan] - Catat pemasukan\n`;
            menuText += `📉 /keluar [jumlah] [keterangan] - Catat pengeluaran\n`;
            menuText += `💵 /saldo - Cek saldo dan transaksi terbaru\n`;
            menuText += `📊 /laporan [tanggal] - Laporan harian\n\n`;

            menuText += `💳 *HUTANG & PIUTANG:* ⭐ NEW!\n`;
            menuText += `📈 /daftar-piutang - Lihat siapa yang hutang ke Anda\n`;
            menuText += `📉 /daftar-hutang - Lihat Anda hutang ke siapa\n`;
            menuText += `📋 /hutang-piutang - Lihat semua hutang & piutang\n`;
            menuText += `💰 /saldo-hutang - Ringkasan saldo hutang-piutang\n`;
            menuText += `✅ /lunas [ID] - Tandai sebagai lunas\n\n`;

            menuText += `🏷️ *KATEGORI:*\n`;
            menuText += `📝 /kategori - Lihat semua kategori\n`;
            menuText += `➕ /kategori-baru [nama] [type] - Tambah kategori\n\n`;

            menuText += `🔍 *PENCARIAN & EDIT:*\n`;
            menuText += `🔍 /cari [kata_kunci] - Cari transaksi\n`;
            menuText += `✏️ /edit [ID] - Edit transaksi\n`;
            menuText += `🗑️ /hapus [ID] - Hapus transaksi\n\n`;

            if (this.ai.isAvailable()) {
                menuText += `🤖 *FITUR AI:*\n`;
                menuText += `💬 /chat [pesan] - Chat dengan AI\n`;
                menuText += `📊 /analisis - Analisis keuangan AI\n`;
                menuText += `💡 /saran - Saran keuangan personal\n`;
                menuText += `🔮 /prediksi-ai - Prediksi keuangan\n`;
                menuText += `💳 /bulk [daftar] - Input bulk transaksi\n\n`;
            }

            if (isAdmin) {
                menuText += `👑 *ADMIN:*\n`;
                menuText += `/menu-admin - Menu administrator\n\n`;
            }

            menuText += `❓ *BANTUAN:*\n`;
            menuText += `/bantuan - Panduan lengkap\n`;
            menuText += `/contoh - Contoh penggunaan\n\n`;

            menuText += `💡 *Tips:* Anda juga bisa mengetik dengan bahasa natural!\n`;
            menuText += `Contoh: "Beli nasi gudeg 15ribu" atau "Piutang Warung Madura 200K"`;

            await message.reply(menuText);
        } catch (error) {
            this.logger.error('Error in handleMainMenu:', error);
            await message.reply('❌ Terjadi kesalahan saat menampilkan menu.');
        }
    }

    /**
     * Handle help command
     */
    async handleHelp(message, userPhone, args) {
        try {
            const botName = process.env.BOT_NAME || 'Bot Keuangan';
            
            let helpText = `📚 *PANDUAN ${botName.toUpperCase()}*\n\n`;
            
            helpText += `🏠 *MENU & NAVIGASI:*\n`;
            helpText += `/menu - Menu utama lengkap\n`;
            helpText += `/bantuan - Panduan ini\n`;
            helpText += `/contoh - Contoh penggunaan\n\n`;

            helpText += `💰 *TRANSAKSI DASAR:*\n`;
            helpText += `📈 /masuk 50000 makan siang\n`;
            helpText += `📉 /keluar 25000 transport\n`;
            helpText += `💵 /saldo - Lihat saldo\n`;
            helpText += `📊 /laporan 2024-01-15\n\n`;

            helpText += `💳 *HUTANG & PIUTANG:* ⭐ FITUR TERBARU!\n\n`;
            
            helpText += `📋 *Commands Hutang-Piutang:*\n`;
            helpText += `📈 /daftar-piutang - Siapa yang hutang ke Anda\n`;
            helpText += `📉 /daftar-hutang - Anda hutang ke siapa\n`;
            helpText += `📋 /hutang-piutang - Lihat semua\n`;
            helpText += `💰 /saldo-hutang - Ringkasan total\n`;
            helpText += `✅ /lunas 123 - Tandai ID 123 lunas\n\n`;

            helpText += `🗣️ *Input Natural Language:*\n`;
            helpText += `"Piutang Warung Madura 200K voucher wifi"\n`;
            helpText += `"Hutang ke Toko Budi 150K sembako"\n`;
            helpText += `"082817728312" (nomor HP client)\n`;
            helpText += `"tidak" (jika tidak ada nomor HP)\n\n`;

            helpText += `📱 *Format Nomor HP:*\n`;
            helpText += `✅ 082817728312\n`;
            helpText += `✅ 6282817728312\n`;
            helpText += `❌ +6282817728312 (tidak perlu "+")\n\n`;

            helpText += `🏷️ *KATEGORI:*\n`;
            helpText += `/kategori - Lihat semua\n`;
            helpText += `/kategori-baru Makanan expense #FF5733\n\n`;

            helpText += `🔍 *PENCARIAN & EDIT:*\n`;
            helpText += `/cari makan - Cari transaksi\n`;
            helpText += `/edit 123 - Edit transaksi ID 123\n`;
            helpText += `/hapus 123 - Hapus transaksi ID 123\n\n`;

            if (this.ai.isAvailable()) {
                helpText += `🤖 *FITUR AI:*\n`;
                helpText += `/chat Bagaimana cara menghemat?\n`;
                helpText += `/analisis - Analisis pengeluaran\n`;
                helpText += `/saran - Saran keuangan\n`;
                helpText += `/prediksi-ai - Prediksi trend\n`;
                helpText += `/bulk Makan 25k, transport 10k, kopi 5k\n\n`;
            }

            helpText += `💡 *TIPS PENGGUNAAN:*\n`;
            helpText += `• Gunakan "k" untuk ribu (25k = 25.000)\n`;
            helpText += `• Format tanggal: YYYY-MM-DD atau DD/MM/YYYY\n`;
            helpText += `• ID transaksi bisa dilihat di /saldo\n`;
            helpText += `• Bot mendukung bahasa natural Indonesia\n\n`;

            helpText += `❓ *BUTUH BANTUAN?*\n`;
            helpText += `• Ketik /menu untuk navigasi cepat\n`;
            helpText += `• Ketik /contoh untuk melihat contoh\n`;
            helpText += `• Hubungi admin jika ada masalah`;

            await message.reply(helpText);
        } catch (error) {
            this.logger.error('Error in handleHelp:', error);
            await message.reply('❌ Terjadi kesalahan saat menampilkan bantuan.');
        }
    }
}

module.exports = CommandHandler;
