const Logger = require('../utils/Logger');
const moment = require('moment');

class ReportService {
    constructor(database, aiService) {
        this.db = database;
        this.ai = aiService;
        this.logger = new Logger();
    }

    async generateReport(userPhone, period = 'bulanan') {
        try {
            const summary = await this.getReportData(userPhone, period);
            return this.formatReport(summary, period);
        } catch (error) {
            this.logger.error('Error generating report:', error);
            throw new Error('Gagal membuat laporan');
        }
    }

    async getReportData(userPhone, period) {
        let startDate, endDate, periodLabel;
        
        switch (period.toLowerCase()) {
            case 'harian':
            case 'hari':
            case 'day':
                startDate = moment().startOf('day');
                endDate = moment().endOf('day');
                periodLabel = 'Hari Ini';
                break;
            case 'mingguan':
            case 'minggu':
            case 'week':
                startDate = moment().startOf('week');
                endDate = moment().endOf('week');
                periodLabel = 'Minggu Ini';
                break;
            case 'bulanan':
            case 'bulan':
            case 'month':
            default:
                startDate = moment().startOf('month');
                endDate = moment().endOf('month');
                periodLabel = 'Bulan Ini';
                break;
            case 'tahunan':
            case 'tahun':
            case 'year':
                startDate = moment().startOf('year');
                endDate = moment().endOf('year');
                periodLabel = 'Tahun Ini';
                break;
        }

        // Get balance data
        const balance = await this.db.get(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
            FROM transactions 
            WHERE user_phone = ? AND date BETWEEN ? AND ?
        `, [userPhone, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]);

        const netBalance = balance.income - balance.expenses;

        // Get category breakdown
        const categoryData = await this.db.all(`
            SELECT 
                c.name as category_name,
                t.type,
                SUM(t.amount) as total_amount,
                COUNT(t.id) as transaction_count,
                ROUND(AVG(t.amount), 0) as avg_amount
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = ? AND t.date BETWEEN ? AND ?
            GROUP BY c.id, t.type
            ORDER BY total_amount DESC
        `, [userPhone, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]);

        // Get transaction trends (daily)
        const dailyData = await this.db.all(`
            SELECT 
                DATE(date) as day,
                SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as daily_income,
                SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as daily_expenses,
                COUNT(id) as daily_transactions
            FROM transactions
            WHERE user_phone = ? AND date BETWEEN ? AND ?
            GROUP BY DATE(date)
            ORDER BY day
        `, [userPhone, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]);

        // Get top transactions
        const topTransactions = await this.db.all(`
            SELECT t.*, c.name as category_name
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            WHERE t.user_phone = ? AND t.date BETWEEN ? AND ?
            ORDER BY t.amount DESC
            LIMIT 5
        `, [userPhone, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]);

        // Calculate previous period for comparison
        const getPeriodUnit = (p) => {
            if (p === 'harian' || p === 'hari') return 'day';
            if (p === 'mingguan' || p === 'minggu') return 'week';
            if (p === 'bulanan' || p === 'bulan') return 'month';
            if (p === 'tahunan' || p === 'tahun') return 'year';
            return 'month'; // default
        };
        
        const periodUnit = getPeriodUnit(period);
        const prevStartDate = startDate.clone().subtract(1, periodUnit);
        const prevEndDate = endDate.clone().subtract(1, periodUnit);
        
        const prevBalance = await this.db.get(`
            SELECT 
                COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
            FROM transactions 
            WHERE user_phone = ? AND date BETWEEN ? AND ?
        `, [userPhone, prevStartDate.format('YYYY-MM-DD'), prevEndDate.format('YYYY-MM-DD')]);

        return {
            period: periodLabel,
            startDate: startDate.format('DD/MM/YYYY'),
            endDate: endDate.format('DD/MM/YYYY'),
            balance: {
                income: balance.income,
                expenses: balance.expenses,
                net: netBalance
            },
            previousPeriod: {
                income: prevBalance.income,
                expenses: prevBalance.expenses,
                net: prevBalance.income - prevBalance.expenses
            },
            categories: {
                income: categoryData.filter(c => c.type === 'income'),
                expenses: categoryData.filter(c => c.type === 'expense')
            },
            dailyTrends: dailyData,
            topTransactions
        };
    }

    formatReport(data, period) {
        let report = `📊 *Laporan Keuangan - ${data.period}*\n`;
        report += `📅 ${data.startDate} - ${data.endDate}\n\n`;

        // Balance Summary
        report += `💰 *Ringkasan Saldo:*\n`;
        report += `📈 Pemasukan: ${this.formatCurrency(data.balance.income)}\n`;
        report += `📉 Pengeluaran: ${this.formatCurrency(data.balance.expenses)}\n`;
        report += `💵 Saldo Bersih: ${this.formatCurrency(data.balance.net)} ${data.balance.net >= 0 ? '✅' : '⚠️'}\n\n`;

        // Comparison with previous period
        const incomeChange = data.balance.income - data.previousPeriod.income;
        const expenseChange = data.balance.expenses - data.previousPeriod.expenses;
        const netChange = data.balance.net - data.previousPeriod.net;

        report += `📈 *Perubahan dari Periode Sebelumnya:*\n`;
        report += `Pemasukan: ${this.formatChangeIndicator(incomeChange)}\n`;
        report += `Pengeluaran: ${this.formatChangeIndicator(expenseChange, true)}\n`;
        report += `Saldo Bersih: ${this.formatChangeIndicator(netChange)}\n\n`;

        // Top Expense Categories
        if (data.categories.expenses.length > 0) {
            report += `💸 *Kategori Pengeluaran Tertinggi:*\n`;
            data.categories.expenses.slice(0, 5).forEach((cat, index) => {
                const percentage = data.balance.expenses > 0 ?
                    Math.round((cat.total_amount / data.balance.expenses) * 100) : 0;
                report += `${index + 1}. ${cat.category_name}: ${this.formatCurrency(cat.total_amount)} (${percentage}%)\n`;
            });
            report += '\n';
        }

        // Top Income Sources
        if (data.categories.income.length > 0) {
            report += `💰 *Sumber Pemasukan Utama:*\n`;
            data.categories.income.slice(0, 3).forEach((cat, index) => {
                const percentage = data.balance.income > 0 ?
                    Math.round((cat.total_amount / data.balance.income) * 100) : 0;
                report += `${index + 1}. ${cat.category_name}: ${this.formatCurrency(cat.total_amount)} (${percentage}%)\n`;
            });
            report += '\n';
        }

        // Largest Transactions
        if (data.topTransactions.length > 0) {
            report += `🔝 *Transaksi Terbesar:*\n`;
            data.topTransactions.slice(0, 3).forEach((trans, index) => {
                const emoji = trans.type === 'income' ? '📈' : '📉';
                report += `${index + 1}. ${emoji} ${this.formatCurrency(trans.amount)} - ${trans.description}\n`;
            });
            report += '\n';
        }

        // Daily Average
        const daysInPeriod = data.dailyTrends.length || 1;
        const avgDailyIncome = data.balance.income / daysInPeriod;
        const avgDailyExpense = data.balance.expenses / daysInPeriod;

        report += `📊 *Rata-rata Harian:*\n`;
        report += `📈 Rata-rata Pemasukan: ${this.formatCurrency(avgDailyIncome)}\n`;
        report += `📉 Rata-rata Pengeluaran: ${this.formatCurrency(avgDailyExpense)}\n`;
        report += `💵 Rata-rata Saldo Bersih: ${this.formatCurrency(avgDailyIncome - avgDailyExpense)}\n\n`;

        // Financial Health Indicator
        const savingsRate = data.balance.income > 0 ?
            Math.round(((data.balance.income - data.balance.expenses) / data.balance.income) * 100) : 0;
        
        report += `🏥 *Kesehatan Keuangan:*\n`;
        if (savingsRate >= 20) {
            report += `Sangat Baik! 🌟 Tingkat Tabungan: ${savingsRate}%`;
        } else if (savingsRate >= 10) {
            report += `Baik 👍 Tingkat Tabungan: ${savingsRate}%`;
        } else if (savingsRate >= 0) {
            report += `Cukup ⚖️ Tingkat Tabungan: ${savingsRate}%`;
        } else {
            report += `Perlu Perhatian ⚠️ Defisit: ${Math.abs(savingsRate)}%`;
        }

        return report;
    }

    async generateAIAnalysis(userPhone) {
        if (!this.ai.isAvailable()) {
            throw new Error('Fitur AI tidak tersedia');
        }

        try {
            // Get comprehensive financial data
            const reportData = await this.getReportData(userPhone, 'bulan');
            const recentTransactions = await this.db.getTransactions(userPhone, 20);
            const balance = await this.db.getBalance(userPhone);
            
            // Get monthly trends for last 3 months
            const monthlyTrends = await this.getMonthlyTrends(userPhone, 3);
            
            const financialData = {
                balance,
                transactions: recentTransactions,
                monthlyTrends,
                categories: reportData.categories,
                currentPeriod: reportData
            };

            const analysis = await this.ai.generateFinancialAnalysis(financialData);
            
            // Log the interaction
            await this.ai.logInteraction(userPhone, 'financial_analysis', analysis, 'analysis');
            
            return analysis;
        } catch (error) {
            this.logger.error('Error generating AI analysis:', error);
            throw error;
        }
    }

    async generateWeeklySummary() {
        try {
            const users = await this.db.all('SELECT DISTINCT user_phone FROM transactions WHERE date >= date("now", "-7 days")');
            
            let summary = `📊 *Ringkasan Sistem Mingguan*\n\n`;
            summary += `📅 ${moment().subtract(7, 'days').format('DD/MM/YYYY')} - ${moment().format('DD/MM/YYYY')}\n\n`;
            
            let totalUsers = users.length;
            let totalTransactions = 0;
            let totalIncome = 0;
            let totalExpenses = 0;
            
            for (const user of users) {
                const userData = await this.getReportData(user.user_phone, 'minggu');
                totalTransactions += userData.dailyTrends.reduce((sum, day) => sum + day.daily_transactions, 0);
                totalIncome += userData.balance.income;
                totalExpenses += userData.balance.expenses;
            }
            
            summary += `👥 Pengguna Aktif: ${totalUsers}\n`;
            summary += `📝 Total Transaksi: ${totalTransactions}\n`;
            summary += `📈 Total Pemasukan: ${this.formatCurrency(totalIncome)}\n`;
            summary += `📉 Total Pengeluaran: ${this.formatCurrency(totalExpenses)}\n`;
            summary += `💵 Pergerakan Bersih: ${this.formatCurrency(totalIncome - totalExpenses)}\n`;
            
            return summary;
        } catch (error) {
            this.logger.error('Error generating weekly summary:', error);
            return 'Gagal membuat ringkasan mingguan';
        }
    }

    async getUserContext(userPhone) {
        try {
            const balance = await this.db.getBalance(userPhone);
            const monthlyData = await this.getReportData(userPhone, 'bulan');
            const categories = await this.db.getCategories(userPhone);
            
            // Calculate monthly averages
            const monthlyTrends = await this.getMonthlyTrends(userPhone, 6);
            const avgMonthlyIncome = monthlyTrends.reduce((sum, month) => sum + month.income, 0) / Math.max(monthlyTrends.length, 1);
            const avgMonthlyExpenses = monthlyTrends.reduce((sum, month) => sum + month.expenses, 0) / Math.max(monthlyTrends.length, 1);
            
            // Top expense categories
            const topExpenseCategories = monthlyData.categories.expenses
                .slice(0, 3)
                .map(cat => cat.category_name);
            
            return {
                balance: balance.balance,
                totalIncome: balance.income,
                totalExpenses: balance.expenses,
                monthlyIncome: avgMonthlyIncome,
                monthlyExpenses: avgMonthlyExpenses,
                topExpenseCategories,
                categoriesCount: categories.length,
                currentMonthIncome: monthlyData.balance.income,
                currentMonthExpenses: monthlyData.balance.expenses
            };
        } catch (error) {
            this.logger.error('Error getting user context:', error);
            return {};
        }
    }

    async getMonthlyTrends(userPhone, monthCount = 6) {
        const trends = [];
        
        for (let i = 0; i < monthCount; i++) {
            const startDate = moment().subtract(i, 'month').startOf('month');
            const endDate = moment().subtract(i, 'month').endOf('month');
            
            const balance = await this.db.get(`
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
                    COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses
                FROM transactions 
                WHERE user_phone = ? AND date BETWEEN ? AND ?
            `, [userPhone, startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD')]);
            
            trends.unshift({
                month: startDate.format('MMM YYYY'),
                income: balance.income,
                expenses: balance.expenses,
                net: balance.income - balance.expenses
            });
        }
        
        return trends;
    }

    async exportToCsv(userPhone, startDate = null, endDate = null) {
        try {
            let dateFilter = '';
            const params = [userPhone];
            
            if (startDate && endDate) {
                dateFilter = 'AND t.date BETWEEN ? AND ?';
                params.push(startDate, endDate);
            }
            
            const transactions = await this.db.all(`
                SELECT 
                    t.id,
                    t.date,
                    t.type,
                    t.amount,
                    t.description,
                    c.name as category_name,
                    t.created_at
                FROM transactions t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_phone = ? ${dateFilter}
                ORDER BY t.date DESC, t.created_at DESC
            `, params);
            
            // Convert to CSV format
            const csvHeader = 'ID,Date,Type,Amount,Description,Category,Created At\n';
            const csvRows = transactions.map(t => 
                `${t.id},"${t.date}","${t.type}",${t.amount},"${t.description}","${t.category_name || ''}","${t.created_at}"`
            ).join('\n');
            
            return csvHeader + csvRows;
        } catch (error) {
            this.logger.error('Error exporting to CSV:', error);
            throw new Error('Gagal mengekspor data');
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

    formatChangeIndicator(change, isExpense = false) {
        if (change === 0) return `${this.formatCurrency(0)} ➡️`;
        
        const emoji = change > 0 ? (isExpense ? '📈⚠️' : '📈✅') : (isExpense ? '📉✅' : '📉⚠️');
        const sign = change > 0 ? '+' : '';
        
        return `${sign}${this.formatCurrency(change)} ${emoji}`;
    }
}

module.exports = ReportService;