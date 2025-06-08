const Logger = require('../utils/Logger');
const moment = require('moment');

class ReminderService {
    constructor(database) {
        this.db = database;
        this.logger = new Logger();
    }

    async checkAndSendReminders(client) {
        try {
            // Check for overdue debts
            await this.checkOverdueDebts(client);

        } catch (error) {
            this.logger.error('Error checking reminders:', error);
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
                    const placeholders = debtIds.map((_, index) => `$${index + 1}`).join(',');
                    await this.db.run(
                        `UPDATE debts SET status = 'overdue' WHERE id IN (${placeholders})`,
                        debtIds
                    );
                }

                this.logger.info(`Overdue debt alert sent to ${userPhone}`);
            }

        } catch (error) {
            this.logger.error('Error checking overdue debts:', error);
        }
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