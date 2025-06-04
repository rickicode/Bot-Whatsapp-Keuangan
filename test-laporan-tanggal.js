const moment = require('moment');

// Mock message object
const createMockMessage = (body) => ({
    from: '+6281234567890@c.us',
    body: body,
    reply: async (text) => {
        console.log('🤖 Bot Reply:');
        console.log(text);
        console.log('=' + '='.repeat(50));
    }
});

// Mock database with sample data
const mockDb = {
    async getTransactionsByDate(userPhone, date) {
        const sampleData = [
            {
                id: 1,
                type: 'expense',
                amount: 50000,
                description: 'Makan siang di warteg',
                category_name: 'Makanan',
                category_color: '#FF6B6B',
                created_at: '2025-06-07T12:00:00Z'
            },
            {
                id: 2,
                type: 'expense',
                amount: 15000,
                description: 'Kopi di cafe',
                category_name: 'Makanan',
                category_color: '#FF6B6B',
                created_at: '2025-06-07T14:30:00Z'
            },
            {
                id: 3,
                type: 'income',
                amount: 500000,
                description: 'Freelance project',
                category_name: 'Freelance',
                category_color: '#4ECDC4',
                created_at: '2025-06-07T09:00:00Z'
            },
            {
                id: 4,
                type: 'expense',
                amount: 25000,
                description: 'Bensin motor',
                category_name: 'Transportasi',
                category_color: '#45B7D1',
                created_at: '2025-06-07T16:00:00Z'
            }
        ];

        // Filter by date (simulate database filtering)
        if (date === '2025-06-07') {
            return sampleData;
        } else if (date === moment().format('YYYY-MM-DD')) {
            // Return some data for "today"
            return sampleData.slice(0, 2);
        }
        
        return []; // No data for other dates
    },

    async getBalanceByDate(userPhone, date) {
        if (date === '2025-06-07') {
            return {
                income: 500000,
                expenses: 90000, // 50000 + 15000 + 25000
                balance: 410000
            };
        } else if (date === moment().format('YYYY-MM-DD')) {
            return {
                income: 0,
                expenses: 65000, // 50000 + 15000
                balance: -65000
            };
        }
        
        return {
            income: 0,
            expenses: 0,
            balance: 0
        };
    }
};

// Mock CommandHandler with date report functionality
class MockCommandHandler {
    constructor() {
        this.db = mockDb;
    }

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

    parseDateToISO(dateString) {
        try {
            const parts = dateString.split('/');
            if (parts.length !== 3) {
                return null;
            }

            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);

            if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
                return null;
            }

            const date = new Date(year, month - 1, day);
            if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
                return null;
            }

            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

        } catch (error) {
            return null;
        }
    }

    async handleReport(message, userPhone, args) {
        try {
            // Check if first argument is "tanggal"
            if (args[0] && args[0].toLowerCase() === 'tanggal') {
                await this.handleDateReport(message, userPhone, args.slice(1));
                return;
            }
            
            // Regular report handling would go here
            await message.reply('📊 Regular report functionality...');
        } catch (error) {
            await message.reply('❌ Gagal membuat laporan: ' + error.message);
        }
    }

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
                targetDate = new Date().toISOString().split('T')[0];
            } else {
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
                    .sort((a, b) => b[1] - a[1])
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
            console.error('Error generating date report:', error);
            await message.reply('❌ Gagal membuat laporan tanggal: ' + error.message);
        }
    }
}

// Test scenarios
async function testDateReports() {
    console.log('🧪 Testing Date Report Feature');
    console.log('=' + '='.repeat(50));

    const handler = new MockCommandHandler();
    const userPhone = '+6281234567890';

    console.log('\n📅 Test 1: Help message');
    const message1 = createMockMessage('/laporan tanggal');
    await handler.handleReport(message1, userPhone, ['tanggal']);

    console.log('\n📅 Test 2: Specific date with data (07/06/2025)');
    const message2 = createMockMessage('/laporan tanggal 07/06/2025');
    await handler.handleReport(message2, userPhone, ['tanggal', '07/06/2025']);

    console.log('\n📅 Test 3: Today report');
    const message3 = createMockMessage('/laporan tanggal hari ini');
    await handler.handleReport(message3, userPhone, ['tanggal', 'hari', 'ini']);

    console.log('\n📅 Test 4: Invalid date format');
    const message4 = createMockMessage('/laporan tanggal 2025-06-07');
    await handler.handleReport(message4, userPhone, ['tanggal', '2025-06-07']);

    console.log('\n📅 Test 5: Date with no data');
    const message5 = createMockMessage('/laporan tanggal 15/05/2025');
    await handler.handleReport(message5, userPhone, ['tanggal', '15/05/2025']);

    console.log('\n📅 Test 6: Regular report (non-date)');
    const message6 = createMockMessage('/laporan bulanan');
    await handler.handleReport(message6, userPhone, ['bulanan']);

    console.log('\n✅ All tests completed!');
}

// Run tests
if (require.main === module) {
    testDateReports().catch(console.error);
}

module.exports = { testDateReports };