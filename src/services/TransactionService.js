const Logger = require('../utils/Logger');
const moment = require('moment');

class TransactionService {
    constructor(database, aiService) {
        this.db = database;
        this.ai = aiService;
        this.logger = new Logger();
    }

    async addIncome(userPhone, amount, description, categoryName = null) {
        try {
            // Get or create category
            const category = await this.getCategoryForTransaction(userPhone, 'income', categoryName, description, amount);
            
            // Add transaction
            const transactionId = await this.db.addTransaction(
                userPhone,
                'income',
                amount,
                category.id,
                description
            );

            this.logger.info(`Income added: ${userPhone} - ${amount} - ${description}`);
            
            return {
                transactionId,
                categoryName: category.name,
                amount,
                description
            };
        } catch (error) {
            this.logger.error('Error adding income:', error);
            throw new Error('Gagal menambah transaksi pemasukan');
        }
    }

    async addExpense(userPhone, amount, description, categoryName = null) {
        try {
            // Get or create category
            const category = await this.getCategoryForTransaction(userPhone, 'expense', categoryName, description, amount);
            
            // Add transaction
            const transactionId = await this.db.addTransaction(
                userPhone,
                'expense',
                amount,
                category.id,
                description
            );

            this.logger.info(`Expense added: ${userPhone} - ${amount} - ${description}`);
            
            return {
                transactionId,
                categoryName: category.name,
                amount,
                description
            };
        } catch (error) {
            this.logger.error('Error adding expense:', error);
            throw new Error('Gagal menambah transaksi pengeluaran');
        }
    }

    async getCategoryForTransaction(userPhone, type, categoryName, description, amount) {
        let categories = await this.db.getCategories(userPhone, type);
        
        // If specific category provided, try to find it
        if (categoryName) {
            const foundCategory = categories.find(c => 
                c.name.toLowerCase().includes(categoryName.toLowerCase()) ||
                categoryName.toLowerCase().includes(c.name.toLowerCase())
            );
            
            if (foundCategory) {
                return foundCategory;
            }
        }

        // Use AI to suggest category if available
        if (this.ai.isAvailable() && !categoryName) {
            try {
                const suggestedCategory = await this.ai.categorizeTransaction(description, amount, type);
                const aiCategory = categories.find(c => 
                    c.name.toLowerCase() === suggestedCategory.toLowerCase()
                );
                
                if (aiCategory) {
                    return aiCategory;
                }
            } catch (error) {
                this.logger.warn('AI categorization failed, using default');
            }
        }

        // Return default category
        const defaultCategory = categories.find(c => c.name.includes('Other')) || categories[0];
        return defaultCategory;
    }

    async updateTransaction(userPhone, transactionId, updates) {
        try {
            // Verify transaction belongs to user
            const transaction = await this.db.getTransactionById(transactionId, userPhone);
            if (!transaction) {
                throw new Error('Transaksi tidak ditemukan atau tidak diizinkan');
            }

            // Process updates
            const processedUpdates = {};
            
            if (updates.amount !== undefined) {
                const amount = parseFloat(updates.amount);
                if (isNaN(amount) || amount <= 0) {
                    throw new Error('Jumlah tidak valid');
                }
                processedUpdates.amount = amount;
            }

            if (updates.description !== undefined) {
                processedUpdates.description = updates.description;
            }

            if (updates.categoryName !== undefined) {
                const category = await this.getCategoryForTransaction(
                    userPhone, 
                    transaction.type, 
                    updates.categoryName, 
                    updates.description || transaction.description,
                    updates.amount || transaction.amount
                );
                processedUpdates.category_id = category.id;
            }

            if (updates.date !== undefined) {
                const date = moment(updates.date);
                if (!date.isValid()) {
                    throw new Error('Format tanggal tidak valid');
                }
                processedUpdates.date = date.format('YYYY-MM-DD');
            }

            // Update transaction
            await this.db.updateTransaction(transactionId, userPhone, processedUpdates);
            
            this.logger.info(`Transaction updated: ${transactionId} by ${userPhone}`);
            
            return await this.db.getTransactionById(transactionId, userPhone);
        } catch (error) {
            this.logger.error('Error updating transaction:', error);
            throw error;
        }
    }

    async deleteTransaction(userPhone, transactionId) {
        try {
            // Verify transaction belongs to user
            const transaction = await this.db.getTransactionById(transactionId, userPhone);
            if (!transaction) {
                throw new Error('Transaksi tidak ditemukan atau tidak diizinkan');
            }

            await this.db.deleteTransaction(transactionId, userPhone);
            
            this.logger.info(`Transaction deleted: ${transactionId} by ${userPhone}`);
            
            return transaction;
        } catch (error) {
            this.logger.error('Error deleting transaction:', error);
            throw error;
        }
    }

    async getTransactionHistory(userPhone, filters = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                type = null,
                categoryId = null,
                startDate = null,
                endDate = null,
                search = null
            } = filters;

            let sql = `
                SELECT t.*, c.name as category_name, c.color as category_color
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = ?
            `;
            
            const params = [userPhone];

            // Apply filters
            if (type) {
                sql += ' AND t.type = ?';
                params.push(type);
            }

            if (categoryId) {
                sql += ' AND t.category_id = ?';
                params.push(categoryId);
            }

            if (startDate) {
                sql += ' AND t.date >= ?';
                params.push(startDate);
            }

            if (endDate) {
                sql += ' AND t.date <= ?';
                params.push(endDate);
            }

            if (search) {
                sql += ' AND (t.description LIKE ? OR c.name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }

            sql += ' ORDER BY t.date DESC, t.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            return await this.db.all(sql, params);
        } catch (error) {
            this.logger.error('Error getting transaction history:', error);
            throw new Error('Gagal mendapatkan riwayat transaksi');
        }
    }

    async getTransactionSummary(userPhone, period = 'bulanan') {
        try {
            let startDate, endDate;
            
            switch (period) {
                case 'harian':
                case 'day':
                case 'hari':
                    startDate = moment().startOf('day').format('YYYY-MM-DD');
                    endDate = moment().endOf('day').format('YYYY-MM-DD');
                    break;
                case 'mingguan':
                case 'week':
                case 'minggu':
                    startDate = moment().startOf('week').format('YYYY-MM-DD');
                    endDate = moment().endOf('week').format('YYYY-MM-DD');
                    break;
                case 'bulanan':
                case 'month':
                case 'bulan':
                default:
                    startDate = moment().startOf('month').format('YYYY-MM-DD');
                    endDate = moment().endOf('month').format('YYYY-MM-DD');
                    break;
                case 'tahunan':
                case 'year':
                case 'tahun':
                    startDate = moment().startOf('year').format('YYYY-MM-DD');
                    endDate = moment().endOf('year').format('YYYY-MM-DD');
                    break;
            }

            // Get balance for period
            const balance = await this.getBalanceForPeriod(userPhone, startDate, endDate);
            
            // Get category breakdown
            const categoryBreakdown = await this.getCategoryBreakdown(userPhone, startDate, endDate);
            
            // Get daily trends for charts
            const dailyTrends = await this.getDailyTrends(userPhone, startDate, endDate);
            
            // Get recent transactions
            const recentTransactions = await this.getTransactionHistory(userPhone, {
                startDate,
                endDate,
                limit: 10
            });

            return {
                period,
                startDate,
                endDate,
                balance,
                categoryBreakdown,
                dailyTrends,
                recentTransactions,
                transactionCount: recentTransactions.length
            };
        } catch (error) {
            this.logger.error('Error getting transaction summary:', error);
            throw new Error('Gagal mendapatkan ringkasan transaksi');
        }
    }

    async getBalanceForPeriod(userPhone, startDate, endDate) {
        const income = await this.db.get(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM transactions 
            WHERE user_phone = ? AND type = 'income' AND date BETWEEN ? AND ?
        `, [userPhone, startDate, endDate]);
        
        const expenses = await this.db.get(`
            SELECT COALESCE(SUM(amount), 0) as total 
            FROM transactions 
            WHERE user_phone = ? AND type = 'expense' AND date BETWEEN ? AND ?
        `, [userPhone, startDate, endDate]);
        
        return {
            income: income.total,
            expenses: expenses.total,
            balance: income.total - expenses.total
        };
    }

    async getCategoryBreakdown(userPhone, startDate, endDate) {
        const breakdown = await this.db.all(`
            SELECT 
                c.name as category_name,
                c.color as category_color,
                t.type,
                SUM(t.amount) as total_amount,
                COUNT(t.id) as transaction_count
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = ? AND t.date BETWEEN ? AND ?
            GROUP BY c.id, t.type
            ORDER BY total_amount DESC
        `, [userPhone, startDate, endDate]);
        
        return {
            income: breakdown.filter(b => b.type === 'income'),
            expenses: breakdown.filter(b => b.type === 'expense')
        };
    }

    async getDailyTrends(userPhone, startDate, endDate) {
        return await this.db.all(`
            SELECT 
                DATE(date) as day,
                type,
                SUM(amount) as daily_total
            FROM transactions
            WHERE user_phone = ? AND date BETWEEN ? AND ?
            GROUP BY DATE(date), type
            ORDER BY day
        `, [userPhone, startDate, endDate]);
    }

    async processReceiptImage(userPhone, imageBuffer) {
        try {
            if (!this.ai.isAvailable()) {
                throw new Error('Fitur AI tidak tersedia');
            }

            // This would typically involve OCR processing
            // For now, return a placeholder
            throw new Error('Fitur pemrosesan struk akan segera hadir');
            
        } catch (error) {
            this.logger.error('Error processing receipt:', error);
            throw error;
        }
    }

    async bulkImport(userPhone, csvData) {
        try {
            // This would parse CSV and import transactions
            // For now, return a placeholder
            throw new Error('Fitur impor massal akan segera hadir');
            
        } catch (error) {
            this.logger.error('Error in bulk import:', error);
            throw error;
        }
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
}

module.exports = TransactionService;