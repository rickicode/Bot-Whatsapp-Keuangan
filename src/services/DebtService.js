const Logger = require('../utils/Logger');
const moment = require('moment');

class DebtService {
    constructor(database) {
        this.db = database;
        this.logger = new Logger();
    }

    async addDebt(userPhone, clientName, amount, description, dueDate = null, type = 'receivable') {
        try {
            // Get or create client
            let client = await this.db.get(
                'SELECT * FROM clients WHERE user_phone = ? AND name = ?',
                [userPhone, clientName]
            );

            if (!client) {
                const result = await this.db.run(
                    'INSERT INTO clients (user_phone, name) VALUES (?, ?)',
                    [userPhone, clientName]
                );
                client = { id: result.lastID, name: clientName };
            }

            // Add debt record
            const debtResult = await this.db.run(
                `INSERT INTO debts (user_phone, client_id, type, amount, description, due_date, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                [userPhone, client.id, type, amount, description, dueDate]
            );

            this.logger.info(`Debt added: ${userPhone} - ${clientName} - ${amount}`);

            return {
                debtId: debtResult.lastID,
                clientName,
                amount,
                description,
                dueDate,
                type
            };
        } catch (error) {
            this.logger.error('Error adding debt:', error);
            throw new Error('Failed to add debt record');
        }
    }

    async payDebt(userPhone, clientName, amount) {
        try {
            // Find pending debts for this client
            const debts = await this.db.all(`
                SELECT d.*, c.name as client_name
                FROM debts d
                JOIN clients c ON d.client_id = c.id
                WHERE d.user_phone = ? AND c.name = ? AND d.status IN ('pending', 'partial')
                ORDER BY d.due_date ASC, d.created_at ASC
            `, [userPhone, clientName]);

            if (debts.length === 0) {
                throw new Error(`No pending debts found for ${clientName}`);
            }

            let remainingAmount = amount;
            const updatedDebts = [];

            // Apply payment to debts (oldest first)
            for (const debt of debts) {
                if (remainingAmount <= 0) break;

                const outstandingAmount = debt.amount - debt.paid_amount;
                const paymentForThisDebt = Math.min(remainingAmount, outstandingAmount);
                const newPaidAmount = debt.paid_amount + paymentForThisDebt;
                
                let newStatus = 'partial';
                if (newPaidAmount >= debt.amount) {
                    newStatus = 'paid';
                }

                await this.db.run(
                    'UPDATE debts SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [newPaidAmount, newStatus, debt.id]
                );

                updatedDebts.push({
                    debtId: debt.id,
                    description: debt.description,
                    totalAmount: debt.amount,
                    previousPaid: debt.paid_amount,
                    paymentApplied: paymentForThisDebt,
                    newPaidAmount,
                    status: newStatus
                });

                remainingAmount -= paymentForThisDebt;
            }

            this.logger.info(`Debt payment processed: ${userPhone} - ${clientName} - ${amount}`);

            return {
                clientName,
                totalPayment: amount,
                remainingAmount,
                updatedDebts
            };
        } catch (error) {
            this.logger.error('Error processing debt payment:', error);
            throw error;
        }
    }

    async getDebts(userPhone, status = null) {
        try {
            let sql = `
                SELECT d.*, c.name as client_name, c.phone as client_phone
                FROM debts d
                JOIN clients c ON d.client_id = c.id
                WHERE d.user_phone = ?
            `;
            const params = [userPhone];

            if (status) {
                sql += ' AND d.status = ?';
                params.push(status);
            }

            sql += ' ORDER BY d.due_date ASC, d.created_at DESC';

            return await this.db.all(sql, params);
        } catch (error) {
            this.logger.error('Error getting debts:', error);
            throw new Error('Failed to retrieve debts');
        }
    }

    async getDebtSummary(userPhone) {
        try {
            const summary = await this.db.get(`
                SELECT 
                    COUNT(*) as total_debts,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_count,
                    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
                    COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COALESCE(SUM(paid_amount), 0) as total_paid,
                    COALESCE(SUM(amount - paid_amount), 0) as total_outstanding
                FROM debts
                WHERE user_phone = ?
            `, [userPhone]);

            // Get overdue debts
            const overdueDebts = await this.db.all(`
                SELECT d.*, c.name as client_name
                FROM debts d
                JOIN clients c ON d.client_id = c.id
                WHERE d.user_phone = ? AND d.due_date < CURRENT_DATE AND d.status IN ('pending', 'partial')
                ORDER BY d.due_date ASC
            `, [userPhone]);

            // Update overdue status
            if (overdueDebts.length > 0) {
                await this.db.run(`
                    UPDATE debts 
                    SET status = 'overdue' 
                    WHERE user_phone = ? AND due_date < CURRENT_DATE AND status IN ('pending', 'partial')
                `, [userPhone]);
            }

            return {
                ...summary,
                overdue_debts: overdueDebts
            };
        } catch (error) {
            this.logger.error('Error getting debt summary:', error);
            throw new Error('Failed to get debt summary');
        }
    }

    async getClientDebts(userPhone, clientName) {
        try {
            return await this.db.all(`
                SELECT d.*, c.name as client_name, c.phone as client_phone
                FROM debts d
                JOIN clients c ON d.client_id = c.id
                WHERE d.user_phone = ? AND c.name = ?
                ORDER BY d.created_at DESC
            `, [userPhone, clientName]);
        } catch (error) {
            this.logger.error('Error getting client debts:', error);
            throw new Error('Failed to get client debts');
        }
    }

    async updateDebt(userPhone, debtId, updates) {
        try {
            // Verify debt belongs to user
            const debt = await this.db.get(
                'SELECT * FROM debts WHERE id = ? AND user_phone = ?',
                [debtId, userPhone]
            );

            if (!debt) {
                throw new Error('Debt not found or unauthorized');
            }

            const allowedFields = ['amount', 'description', 'due_date', 'status'];
            const updateFields = Object.keys(updates)
                .filter(key => allowedFields.includes(key))
                .map(key => `${key} = ?`);

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            const values = Object.keys(updates)
                .filter(key => allowedFields.includes(key))
                .map(key => updates[key]);

            values.push(debtId, userPhone);

            await this.db.run(
                `UPDATE debts SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ? AND user_phone = ?`,
                values
            );

            this.logger.info(`Debt updated: ${debtId} by ${userPhone}`);

            return await this.db.get(
                'SELECT * FROM debts WHERE id = ? AND user_phone = ?',
                [debtId, userPhone]
            );
        } catch (error) {
            this.logger.error('Error updating debt:', error);
            throw error;
        }
    }

    async deleteDebt(userPhone, debtId) {
        try {
            // Verify debt belongs to user
            const debt = await this.db.get(
                'SELECT * FROM debts WHERE id = ? AND user_phone = ?',
                [debtId, userPhone]
            );

            if (!debt) {
                throw new Error('Debt not found or unauthorized');
            }

            await this.db.run(
                'DELETE FROM debts WHERE id = ? AND user_phone = ?',
                [debtId, userPhone]
            );

            this.logger.info(`Debt deleted: ${debtId} by ${userPhone}`);

            return debt;
        } catch (error) {
            this.logger.error('Error deleting debt:', error);
            throw error;
        }
    }

    async getUpcomingDueDates(userPhone, days = 7) {
        try {
            const endDate = moment().add(days, 'days').format('YYYY-MM-DD');
            
            return await this.db.all(`
                SELECT d.*, c.name as client_name, c.phone as client_phone
                FROM debts d
                JOIN clients c ON d.client_id = c.id
                WHERE d.user_phone = ? 
                AND d.due_date BETWEEN CURRENT_DATE AND ?
                AND d.status IN ('pending', 'partial')
                ORDER BY d.due_date ASC
            `, [userPhone, endDate]);
        } catch (error) {
            this.logger.error('Error getting upcoming due dates:', error);
            throw new Error('Failed to get upcoming due dates');
        }
    }

    formatDebtList(debts) {
        if (debts.length === 0) {
            return '📋 No debts found.';
        }

        let response = `💳 *Debt Summary (${debts.length} items)*\n\n`;

        debts.forEach((debt, index) => {
            const statusEmoji = this.getStatusEmoji(debt.status);
            const outstanding = debt.amount - debt.paid_amount;
            const dueDate = debt.due_date ? moment(debt.due_date).format('DD/MM/YYYY') : 'No due date';
            
            response += `${index + 1}. ${statusEmoji} *${debt.client_name}*\n`;
            response += `   💰 Total: ${this.formatCurrency(debt.amount)}\n`;
            response += `   💸 Paid: ${this.formatCurrency(debt.paid_amount)}\n`;
            response += `   ⏳ Outstanding: ${this.formatCurrency(outstanding)}\n`;
            response += `   📅 Due: ${dueDate}\n`;
            response += `   📝 ${debt.description}\n`;
            response += `   🆔 ID: ${debt.id}\n\n`;
        });

        return response;
    }

    getStatusEmoji(status) {
        const statusEmojis = {
            'pending': '⏳',
            'partial': '🟡',
            'paid': '✅',
            'overdue': '🔴'
        };
        return statusEmojis[status] || '❓';
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
}

module.exports = DebtService;