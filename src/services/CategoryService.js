const Logger = require('../utils/Logger');

class CategoryService {
    constructor(database) {
        this.db = database;
        this.logger = new Logger();
    }

    async addCategory(userPhone, name, type, color = '#007bff') {
        try {
            // Validate type
            if (!['income', 'expense'].includes(type)) {
                throw new Error('Jenis kategori tidak valid. Harus "income" atau "expense"');
            }

            // Check if category already exists
            const existing = await this.db.get(
                'SELECT * FROM categories WHERE name = $1 AND type = $2',
                [name, type]
            );

            if (existing) {
                throw new Error(`Kategori "${name}" sudah ada untuk ${type === 'income' ? 'pemasukan' : 'pengeluaran'}`);
            }

            // Add category (now global categories, admin only)
            const result = await this.db.addCategory(userPhone, name, type, color);

            this.logger.info(`Category added: ${userPhone} - ${name} (${type})`);

            return {
                id: result.lastID,
                name,
                type,
                color
            };
        } catch (error) {
            this.logger.error('Error adding category:', error);
            throw error;
        }
    }

    async getCategories(userPhone, type = null) {
        try {
            // Use DatabaseManager method for consistent global categories
            return await this.db.getCategories(userPhone, type);
        } catch (error) {
            this.logger.error('Error getting categories:', error);
            throw new Error('Gagal mendapatkan kategori');
        }
    }

    async updateCategory(userPhone, categoryId, updates) {
        try {
            // Use DatabaseManager method for consistent category updates (admin only)
            await this.db.updateCategory(userPhone, categoryId, updates);

            this.logger.info(`Category updated: ${categoryId} by ${userPhone}`);

            return await this.db.getCategoryById(categoryId);
        } catch (error) {
            this.logger.error('Error updating category:', error);
            throw error;
        }
    }

    async deleteCategory(userPhone, categoryId) {
        try {
            // Get category before deletion
            const category = await this.db.getCategoryById(categoryId);
            
            if (!category) {
                throw new Error('Kategori tidak ditemukan');
            }

            // Use DatabaseManager method for consistent category deletion (admin only)
            await this.db.deleteCategory(userPhone, categoryId);

            this.logger.info(`Category deleted: ${categoryId} by ${userPhone}`);

            return category;
        } catch (error) {
            this.logger.error('Error deleting category:', error);
            throw error;
        }
    }

    async getCategoryUsage(userPhone, categoryId) {
        try {
            const usage = await this.db.get(`
                SELECT 
                    COUNT(*) as transaction_count,
                    COALESCE(SUM(amount), 0) as total_amount,
                    MAX(date) as last_used
                FROM transactions 
                WHERE user_phone = ? AND category_id = ?
            `, [userPhone, categoryId]);

            return usage;
        } catch (error) {
            this.logger.error('Error getting category usage:', error);
            throw new Error('Gagal mendapatkan penggunaan kategori');
        }
    }

    async suggestCategory(description, amount, type) {
        try {
            // Simple keyword-based suggestion dengan bahasa Indonesia
            const keywords = {
                income: {
                    'Gaji': ['gaji', 'salary', 'payroll', 'upah', 'honor'],
                    'Freelance': ['freelance', 'project', 'client', 'contract', 'klien', 'proyek'],
                    'Bisnis': ['bisnis', 'business', 'sale', 'revenue', 'profit', 'jual', 'untung', 'dagang'],
                    'Investasi': ['dividend', 'interest', 'investment', 'return', 'investasi', 'bunga', 'dividen']
                },
                expense: {
                    'Makanan': ['food', 'makan', 'lunch', 'dinner', 'breakfast', 'restaurant', 'cafe', 'sarapan', 'siang', 'malam', 'restoran', 'warung'],
                    'Transportasi': ['transport', 'gas', 'fuel', 'taxi', 'bus', 'train', 'ojek', 'bensin', 'transportasi', 'perjalanan', 'travel'],
                    'Utilitas': ['electric', 'water', 'internet', 'phone', 'utility', 'bill', 'listrik', 'air', 'telepon', 'tagihan'],
                    'Hiburan': ['movie', 'game', 'entertainment', 'hobby', 'sport', 'film', 'hiburan', 'hobi', 'olahraga', 'rekreasi'],
                    'Kesehatan': ['doctor', 'medicine', 'hospital', 'health', 'medical', 'dokter', 'obat', 'rumah sakit', 'kesehatan', 'medis'],
                    'Belanja': ['shopping', 'clothes', 'shoes', 'fashion', 'retail', 'belanja', 'baju', 'sepatu', 'pakaian', 'beli']
                }
            };

            const desc = description.toLowerCase();
            const typeKeywords = keywords[type] || {};

            for (const [category, terms] of Object.entries(typeKeywords)) {
                if (terms.some(term => desc.includes(term))) {
                    return category;
                }
            }

            return null; // No suggestion found
        } catch (error) {
            this.logger.error('Error suggesting category:', error);
            return null;
        }
    }

    async getCategoryStats(userPhone, period = 'bulanan') {
        try {
            let dateFilter = '';
            const params = [userPhone];

            switch (period) {
                case 'mingguan':
                case 'minggu':
                case 'week':
                    dateFilter = `AND t.date >= CURRENT_DATE - INTERVAL '7 days'`;
                    break;
                case 'bulanan':
                case 'bulan':
                case 'month':
                    dateFilter = `AND t.date >= DATE_TRUNC('month', CURRENT_DATE)`;
                    break;
                case 'tahunan':
                case 'tahun':
                case 'year':
                    dateFilter = `AND t.date >= DATE_TRUNC('year', CURRENT_DATE)`;
                    break;
            }

            const stats = await this.db.all(`
                SELECT
                    c.id,
                    c.name,
                    c.type,
                    c.color,
                    COUNT(t.id) as transaction_count,
                    COALESCE(SUM(t.amount), 0) as total_amount,
                    COALESCE(AVG(t.amount), 0) as avg_amount,
                    MAX(t.date) as last_transaction
                FROM categories c
                LEFT JOIN transactions t ON c.id = t.category_id AND t.user_phone = $1 ${dateFilter}
                WHERE c.is_active = true
                GROUP BY c.id, c.name, c.type, c.color
                ORDER BY total_amount DESC
            `, params);

            return stats || [];
        } catch (error) {
            this.logger.error('Error getting category stats:', error);
            throw new Error('Gagal mendapatkan statistik kategori');
        }
    }

    formatCategoryList(categories) {
        if (categories.length === 0) {
            return '🏷️ Tidak ada kategori yang ditemukan.';
        }

        const incomeCategories = categories.filter(c => c.type === 'income');
        const expenseCategories = categories.filter(c => c.type === 'expense');

        let response = `🏷️ *Kategori (${categories.length} total)*\n\n`;

        if (incomeCategories.length > 0) {
            response += `📈 *Kategori Pemasukan (${incomeCategories.length}):*\n`;
            incomeCategories.forEach((cat, index) => {
                const userOwned = cat.user_phone !== 'default' ? ' 👤' : '';
                response += `${index + 1}. ${cat.name}${userOwned}\n`;
            });
            response += '\n';
        }

        if (expenseCategories.length > 0) {
            response += `📉 *Kategori Pengeluaran (${expenseCategories.length}):*\n`;
            expenseCategories.forEach((cat, index) => {
                const userOwned = cat.user_phone !== 'default' ? ' 👤' : '';
                response += `${index + 1}. ${cat.name}${userOwned}\n`;
            });
        }

        response += '\n💡 Gunakan /kategori-baru untuk menambah kategori baru';
        response += '\n👤 = Kategori kustom Anda';

        return response;
    }

    formatCategoryStats(stats, period) {
        if (stats.length === 0) {
            return `📊 Tidak ada statistik kategori yang ditemukan untuk ${period}.`;
        }

        const incomeStats = stats.filter(s => s.type === 'income' && s.total_amount > 0);
        const expenseStats = stats.filter(s => s.type === 'expense' && s.total_amount > 0);

        let periodLabel = period;
        switch(period) {
            case 'mingguan':
            case 'minggu':
            case 'week':
                periodLabel = 'Minggu';
                break;
            case 'bulanan':
            case 'bulan':
            case 'month':
                periodLabel = 'Bulan';
                break;
            case 'tahunan':
            case 'tahun':
            case 'year':
                periodLabel = 'Tahun';
                break;
            case 'harian':
            case 'hari':
            case 'day':
                periodLabel = 'Hari';
                break;
        }

        let response = `📊 *Statistik Kategori - ${periodLabel}*\n\n`;

        if (incomeStats.length > 0) {
            response += `📈 *Kategori Pemasukan Teratas:*\n`;
            incomeStats.slice(0, 5).forEach((stat, index) => {
                response += `${index + 1}. *${stat.name}*\n`;
                response += `   💰 Total: ${this.formatCurrency(stat.total_amount)}\n`;
                response += `   📝 Transaksi: ${stat.transaction_count}\n`;
                response += `   📊 Rata-rata: ${this.formatCurrency(stat.avg_amount)}\n\n`;
            });
        }

        if (expenseStats.length > 0) {
            response += `📉 *Kategori Pengeluaran Teratas:*\n`;
            expenseStats.slice(0, 5).forEach((stat, index) => {
                response += `${index + 1}. *${stat.name}*\n`;
                response += `   💸 Total: ${this.formatCurrency(stat.total_amount)}\n`;
                response += `   📝 Transaksi: ${stat.transaction_count}\n`;
                response += `   📊 Rata-rata: ${this.formatCurrency(stat.avg_amount)}\n\n`;
            });
        }

        return response;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
}

module.exports = CategoryService;