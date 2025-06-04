const Logger = require('../utils/Logger');
const moment = require('moment');

class ReminderService {
    constructor(database) {
        this.db = database;
        this.logger = new Logger();
    }

    async checkAndSendReminders(client) {
        try {
            // Get users with active bills
            const users = await this.db.all(`
                SELECT DISTINCT user_phone
                FROM bills
                WHERE is_active = true AND next_reminder <= CURRENT_DATE
            `);

            for (const user of users) {
                await this.sendUserReminders(client, user.user_phone);
            }

            // Check for overdue debts
            await this.checkOverdueDebts(client);

        } catch (error) {
            this.logger.error('Error checking reminders:', error);
        }
    }

    async sendUserReminders(client, userPhone) {
        try {
            // Get due bills
            const dueBills = await this.db.all(`
                SELECT b.*, c.name as category_name
                FROM bills b
                LEFT JOIN categories c ON b.category_id = c.id
                WHERE b.user_phone = ? AND b.is_active = true AND b.next_reminder <= CURRENT_DATE
            `, [userPhone]);

            if (dueBills.length === 0) return;

            let reminderMessage = `🔔 *Bill Reminders*\n\n`;
            
            for (const bill of dueBills) {
                const dueDate = moment(bill.due_date).format('DD/MM/YYYY');
                reminderMessage += `💳 *${bill.name}*\n`;
                reminderMessage += `💰 Amount: ${this.formatCurrency(bill.amount)}\n`;
                reminderMessage += `📅 Due: ${dueDate}\n`;
                reminderMessage += `🏷️ Category: ${bill.category_name || 'Other'}\n\n`;

                // Update next reminder date
                await this.updateNextReminder(bill.id, bill.frequency);
            }

            reminderMessage += `💡 Don't forget to record these payments when you make them!`;

            // Send reminder - handle both whatsapp-web.js and Baileys format
            const jid = userPhone.includes('@') ? userPhone : `${userPhone}@s.whatsapp.net`;
            if (client.sendMessage) {
                // Baileys format
                await client.sendMessage(jid, { text: reminderMessage });
            } else {
                // Fallback for whatsapp-web.js
                await client.sendMessage(`${userPhone}@c.us`, reminderMessage);
            }

            this.logger.info(`Bill reminders sent to ${userPhone}`);

        } catch (error) {
            this.logger.error(`Error sending reminders to ${userPhone}:`, error);
        }
    }

    async checkOverdueDebts(client) {
        try {
            // Get overdue debts
            const overdueDebts = await this.db.all(`
                SELECT d.*, c.name as client_name
                FROM debts d
                JOIN clients c ON d.client_id = c.id
                WHERE d.due_date < CURRENT_DATE AND d.status IN ('pending', 'partial')
            `);

            // Group by user
            const userDebts = {};
            overdueDebts.forEach(debt => {
                if (!userDebts[debt.user_phone]) {
                    userDebts[debt.user_phone] = [];
                }
                userDebts[debt.user_phone].push(debt);
            });

            // Send overdue notifications
            for (const [userPhone, debts] of Object.entries(userDebts)) {
                let message = `⚠️ *Overdue Debts Alert*\n\n`;
                message += `You have ${debts.length} overdue debt(s):\n\n`;

                debts.forEach((debt, index) => {
                    const daysOverdue = moment().diff(moment(debt.due_date), 'days');
                    const outstanding = debt.amount - debt.paid_amount;
                    
                    message += `${index + 1}. *${debt.client_name}*\n`;
                    message += `   💰 Outstanding: ${this.formatCurrency(outstanding)}\n`;
                    message += `   📅 Due: ${moment(debt.due_date).format('DD/MM/YYYY')}\n`;
                    message += `   ⏰ Overdue: ${daysOverdue} days\n`;
                    message += `   📝 ${debt.description}\n\n`;
                });

                message += `💡 Consider following up with your clients or updating the debt status.`;

                // Send overdue debt alert - handle both whatsapp-web.js and Baileys format
                const jid = userPhone.includes('@') ? userPhone : `${userPhone}@s.whatsapp.net`;
                if (client.sendMessage) {
                    // Baileys format
                    await client.sendMessage(jid, { text: message });
                } else {
                    // Fallback for whatsapp-web.js
                    await client.sendMessage(`${userPhone}@c.us`, message);
                }

                // Update debt status to overdue
                const debtIds = debts.map(d => d.id);
                if (debtIds.length > 0) {
                    await this.db.run(
                        `UPDATE debts SET status = 'overdue' WHERE id IN (${debtIds.map(() => '?').join(',')})`,
                        debtIds
                    );
                }

                this.logger.info(`Overdue debt alert sent to ${userPhone}`);
            }

        } catch (error) {
            this.logger.error('Error checking overdue debts:', error);
        }
    }

    async updateNextReminder(billId, frequency) {
        try {
            let nextReminder;
            
            switch (frequency) {
                case 'weekly':
                    nextReminder = moment().add(1, 'week').format('YYYY-MM-DD');
                    break;
                case 'monthly':
                    nextReminder = moment().add(1, 'month').format('YYYY-MM-DD');
                    break;
                case 'yearly':
                    nextReminder = moment().add(1, 'year').format('YYYY-MM-DD');
                    break;
                case 'one-time':
                    // Disable the bill after one-time reminder
                    await this.db.run(
                        'UPDATE bills SET is_active = false WHERE id = ?',
                        [billId]
                    );
                    return;
                default:
                    nextReminder = moment().add(1, 'month').format('YYYY-MM-DD');
            }

            await this.db.run(
                'UPDATE bills SET next_reminder = ? WHERE id = ?',
                [nextReminder, billId]
            );

        } catch (error) {
            this.logger.error('Error updating next reminder:', error);
        }
    }

    async addBill(userPhone, name, amount, categoryId, dueDate, frequency = 'monthly') {
        try {
            // Calculate next reminder (1 day before due date)
            const nextReminder = moment(dueDate).subtract(1, 'day').format('YYYY-MM-DD');

            const result = await this.db.run(`
                INSERT INTO bills (user_phone, name, amount, category_id, due_date, frequency, next_reminder)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userPhone, name, amount, categoryId, dueDate, frequency, nextReminder]);

            this.logger.info(`Bill added: ${userPhone} - ${name} - ${amount}`);

            return {
                billId: result.lastID,
                name,
                amount,
                dueDate,
                frequency,
                nextReminder
            };

        } catch (error) {
            this.logger.error('Error adding bill:', error);
            throw new Error('Failed to add bill');
        }
    }

    async getBills(userPhone, activeOnly = true) {
        try {
            let sql = `
                SELECT b.*, c.name as category_name
                FROM bills b
                LEFT JOIN categories c ON b.category_id = c.id
                WHERE b.user_phone = ?
            `;
            
            const params = [userPhone];

            if (activeOnly) {
                sql += ' AND b.is_active = true';
            }

            sql += ' ORDER BY b.due_date ASC';

            return await this.db.all(sql, params);

        } catch (error) {
            this.logger.error('Error getting bills:', error);
            throw new Error('Failed to get bills');
        }
    }

    async updateBill(userPhone, billId, updates) {
        try {
            // Verify bill belongs to user
            const bill = await this.db.get(
                'SELECT * FROM bills WHERE id = ? AND user_phone = ?',
                [billId, userPhone]
            );

            if (!bill) {
                throw new Error('Bill not found or unauthorized');
            }

            const allowedFields = ['name', 'amount', 'category_id', 'due_date', 'frequency', 'is_active'];
            const updateFields = Object.keys(updates)
                .filter(key => allowedFields.includes(key))
                .map(key => `${key} = ?`);

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            const values = Object.keys(updates)
                .filter(key => allowedFields.includes(key))
                .map(key => updates[key]);

            // If due_date or frequency changed, recalculate next_reminder
            if (updates.due_date || updates.frequency) {
                const newDueDate = updates.due_date || bill.due_date;
                const nextReminder = moment(newDueDate).subtract(1, 'day').format('YYYY-MM-DD');
                updateFields.push('next_reminder = ?');
                values.push(nextReminder);
            }

            values.push(billId, userPhone);

            await this.db.run(
                `UPDATE bills SET ${updateFields.join(', ')} WHERE id = ? AND user_phone = ?`,
                values
            );

            this.logger.info(`Bill updated: ${billId} by ${userPhone}`);

            return await this.db.get(
                'SELECT * FROM bills WHERE id = ?',
                [billId]
            );

        } catch (error) {
            this.logger.error('Error updating bill:', error);
            throw error;
        }
    }

    async deleteBill(userPhone, billId) {
        try {
            // Verify bill belongs to user
            const bill = await this.db.get(
                'SELECT * FROM bills WHERE id = ? AND user_phone = ?',
                [billId, userPhone]
            );

            if (!bill) {
                throw new Error('Bill not found or unauthorized');
            }

            await this.db.run(
                'DELETE FROM bills WHERE id = ? AND user_phone = ?',
                [billId, userPhone]
            );

            this.logger.info(`Bill deleted: ${billId} by ${userPhone}`);

            return bill;

        } catch (error) {
            this.logger.error('Error deleting bill:', error);
            throw error;
        }
    }

    async getUpcomingBills(userPhone, days = 7) {
        try {
            const endDate = moment().add(days, 'days').format('YYYY-MM-DD');
            
            return await this.db.all(`
                SELECT b.*, c.name as category_name
                FROM bills b
                LEFT JOIN categories c ON b.category_id = c.id
                WHERE b.user_phone = ?
                AND b.due_date BETWEEN CURRENT_DATE AND ?
                AND b.is_active = true
                ORDER BY b.due_date ASC
            `, [userPhone, endDate]);

        } catch (error) {
            this.logger.error('Error getting upcoming bills:', error);
            throw new Error('Failed to get upcoming bills');
        }
    }

    formatBillList(bills) {
        if (bills.length === 0) {
            return '📋 No bills found.';
        }

        let response = `💳 *Bills Summary (${bills.length} items)*\n\n`;

        bills.forEach((bill, index) => {
            const dueDate = moment(bill.due_date).format('DD/MM/YYYY');
            const nextReminder = bill.next_reminder ? 
                moment(bill.next_reminder).format('DD/MM/YYYY') : 'Not set';
            const status = bill.is_active ? '🔔 Active' : '⏸️ Inactive';
            
            response += `${index + 1}. *${bill.name}* ${status}\n`;
            response += `   💰 Amount: ${this.formatCurrency(bill.amount)}\n`;
            response += `   📅 Due: ${dueDate}\n`;
            response += `   🔄 Frequency: ${bill.frequency}\n`;
            response += `   🔔 Next Reminder: ${nextReminder}\n`;
            response += `   🏷️ Category: ${bill.category_name || 'Other'}\n`;
            response += `   🆔 ID: ${bill.id}\n\n`;
        });

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

module.exports = ReminderService;