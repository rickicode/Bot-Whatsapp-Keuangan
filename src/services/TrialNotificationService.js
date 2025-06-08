/**
 * Trial Notification Service
 * Service untuk mengirim notifikasi WhatsApp kepada pengguna ketika trial habis
 */

const Logger = require('../utils/Logger');

class TrialNotificationService {
    constructor(whatsappSocket) {
        this.sock = whatsappSocket;
        this.logger = new Logger();
        this.notificationQueue = new Map(); // Store notifications to avoid spam
    }

    /**
     * Send trial expiration notification to user via WhatsApp
     */
    async sendTrialExpirationNotification(userPhone, userName = 'User') {
        try {
            // Check if notification already sent recently (prevent spam)
            const notificationKey = `trial_expired_${userPhone}`;
            const lastSent = this.notificationQueue.get(notificationKey);
            const now = new Date();
            
            // Don't send again if sent within last 24 hours
            if (lastSent && (now - lastSent) < 24 * 60 * 60 * 1000) {
                this.logger.info(`Trial expiration notification already sent to ${userPhone} recently`);
                return { sent: false, reason: 'already_sent_recently' };
            }

            const message = this.createTrialExpirationMessage(userName);
            
            if (this.sock && this.sock.user) {
                const jid = this.formatPhoneNumber(userPhone);
                
                await this.sock.sendMessage(jid, {
                    text: message
                });
                
                // Mark as sent
                this.notificationQueue.set(notificationKey, now);
                
                this.logger.info(`Trial expiration notification sent to ${userPhone} (${userName})`);
                return { sent: true, timestamp: now };
                
            } else {
                this.logger.warn('WhatsApp socket not available for trial notification');
                return { sent: false, reason: 'socket_unavailable' };
            }
            
        } catch (error) {
            this.logger.error('Error sending trial expiration notification:', error);
            return { sent: false, reason: 'error', error: error.message };
        }
    }

    /**
     * Send trial reminder notification (e.g., 3 days before expiration)
     */
    async sendTrialReminderNotification(userPhone, userName = 'User', daysRemaining = 3) {
        try {
            const notificationKey = `trial_reminder_${userPhone}_${daysRemaining}`;
            const lastSent = this.notificationQueue.get(notificationKey);
            const now = new Date();
            
            // Don't send same reminder again within 12 hours
            if (lastSent && (now - lastSent) < 12 * 60 * 60 * 1000) {
                this.logger.info(`Trial reminder already sent to ${userPhone} recently`);
                return { sent: false, reason: 'already_sent_recently' };
            }

            const message = this.createTrialReminderMessage(userName, daysRemaining);
            
            if (this.sock && this.sock.user) {
                const jid = this.formatPhoneNumber(userPhone);
                
                await this.sock.sendMessage(jid, {
                    text: message
                });
                
                // Mark as sent
                this.notificationQueue.set(notificationKey, now);
                
                this.logger.info(`Trial reminder notification sent to ${userPhone} (${userName}) - ${daysRemaining} days remaining`);
                return { sent: true, timestamp: now };
                
            } else {
                this.logger.warn('WhatsApp socket not available for trial reminder');
                return { sent: false, reason: 'socket_unavailable' };
            }
            
        } catch (error) {
            this.logger.error('Error sending trial reminder notification:', error);
            return { sent: false, reason: 'error', error: error.message };
        }
    }

    /**
     * Create trial expiration message
     */
    createTrialExpirationMessage(userName) {
        return `🎁 Halo ${userName}!

⏰ Trial gratis 30 hari Anda telah berakhir.

🔄 Akun Anda otomatis pindah ke Free Plan:
• 📊 50 transaksi per hari
• 💰 Fitur dasar keuangan
• 📈 Laporan bulanan

🚀 Upgrade ke Premium untuk:
• ∞ Unlimited transaksi
• 📊 Laporan advanced  
• 🤖 AI analisis mendalam
• 📤 Export data Excel/PDF
• 🔔 Reminder otomatis
• 💎 Prioritas support

💡 Ketik "upgrade" untuk info lebih lanjut!

Terima kasih telah menggunakan trial kami! 🙏`;
    }

    /**
     * Create trial reminder message
     */
    createTrialReminderMessage(userName, daysRemaining) {
        const dayText = daysRemaining === 1 ? 'hari' : 'hari';
        
        return `🎁 Halo ${userName}!

⏰ Trial gratis Anda akan berakhir dalam ${daysRemaining} ${dayText}.

✨ Selama trial Anda telah menikmati:
• ∞ Unlimited transaksi
• 📊 Laporan lengkap
• 🤖 AI assistant

🔄 Setelah trial berakhir:
• Otomatis pindah ke Free Plan (50 transaksi/hari)
• Tetap bisa gunakan fitur dasar

🚀 Upgrade ke Premium sekarang untuk:
• ∞ Unlimited transaksi selamanya
• 📈 Fitur premium lengkap
• 💎 Support prioritas

💡 Ketik "upgrade" untuk info dan penawaran khusus!

Jangan lewatkan kesempatan ini! ⭐`;
    }

    /**
     * Format phone number to WhatsApp JID
     */
    formatPhoneNumber(phone) {
        // Remove any non-digit characters
        let cleanPhone = phone.replace(/\D/g, '');
        
        // Add country code if not present
        if (!cleanPhone.startsWith('62')) {
            if (cleanPhone.startsWith('0')) {
                cleanPhone = '62' + cleanPhone.substring(1);
            } else {
                cleanPhone = '62' + cleanPhone;
            }
        }
        
        return cleanPhone + '@s.whatsapp.net';
    }

    /**
     * Cleanup old notification records to prevent memory leak
     */
    cleanupNotificationQueue() {
        const now = new Date();
        const cutoff = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        for (const [key, timestamp] of this.notificationQueue.entries()) {
            if (now - timestamp > cutoff) {
                this.notificationQueue.delete(key);
            }
        }
        
        this.logger.debug(`Cleaned up notification queue, ${this.notificationQueue.size} records remaining`);
    }

    /**
     * Get notification statistics
     */
    getNotificationStats() {
        const now = new Date();
        let sentToday = 0;
        let sentThisWeek = 0;
        
        for (const [key, timestamp] of this.notificationQueue.entries()) {
            const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
            
            if (hoursDiff <= 24) {
                sentToday++;
            }
            if (hoursDiff <= 168) { // 7 days
                sentThisWeek++;
            }
        }
        
        return {
            totalRecords: this.notificationQueue.size,
            sentToday,
            sentThisWeek,
            socketAvailable: !!(this.sock && this.sock.user)
        };
    }

    /**
     * Update WhatsApp socket reference
     */
    updateSocket(whatsappSocket) {
        this.sock = whatsappSocket;
        this.logger.info('WhatsApp socket updated for trial notifications');
    }

    /**
     * Test notification (for development/testing)
     */
    async sendTestNotification(userPhone, userName = 'Test User') {
        try {
            const message = `🧪 Test Notification untuk ${userName}

Ini adalah test notifikasi trial system.
Timestamp: ${new Date().toISOString()}

✅ Sistem notifikasi berfungsi dengan baik!`;

            if (this.sock && this.sock.user) {
                const jid = this.formatPhoneNumber(userPhone);
                
                await this.sock.sendMessage(jid, {
                    text: message
                });
                
                this.logger.info(`Test notification sent to ${userPhone}`);
                return { sent: true, message: 'Test notification sent' };
                
            } else {
                return { sent: false, reason: 'socket_unavailable' };
            }
            
        } catch (error) {
            this.logger.error('Error sending test notification:', error);
            return { sent: false, error: error.message };
        }
    }
}

module.exports = TrialNotificationService;