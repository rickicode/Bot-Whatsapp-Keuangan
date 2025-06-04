const Logger = require('../utils/Logger');

/**
 * Service untuk mengelola API messaging WhatsApp
 * Menyediakan endpoint untuk mengirim pesan teks dan webhook
 */
class MessagingAPIService {
    constructor(sock, antiSpam, db) {
        this.sock = sock;
        this.antiSpam = antiSpam;
        this.db = db;
        this.logger = new Logger();
        this.webhookHandlers = new Map();
        this.messageHistory = [];
        this.maxHistorySize = 1000;
    }

    /**
     * Mengirim pesan teks ke nomor WhatsApp
     * @param {string} phoneNumber - Nomor telepon tujuan
     * @param {string} message - Pesan yang akan dikirim
     * @param {Object} options - Opsi tambahan
     * @returns {Object} Response result
     */
    async sendTextMessage(phoneNumber, message, options = {}) {
        try {
            // Validasi input
            if (!phoneNumber || !message) {
                throw new Error('Phone number and message are required');
            }

            // Format nomor telepon
            const formattedPhone = this.formatPhoneNumber(phoneNumber);
            const userJid = `${formattedPhone}@s.whatsapp.net`;

            // Cek koneksi WhatsApp
            if (!this.sock || this.sock.readyState !== 'open') {
                throw new Error('WhatsApp connection is not available');
            }

            // Cek anti-spam
            const antiSpamCheck = await this.antiSpam.checkMessageAllowed(formattedPhone, message, true);
            if (!antiSpamCheck.allowed) {
                throw new Error(`Message blocked by anti-spam: ${antiSpamCheck.reason}`);
            }

            // Siapkan pesan
            const messagePayload = {
                text: message
            };

            // Tambahkan opsi tambahan jika ada
            if (options.quoted && options.quotedMessage) {
                messagePayload.quoted = options.quotedMessage;
            }

            // Kirim pesan
            const result = await this.sock.sendMessage(userJid, messagePayload);

            // Simpan ke history
            this.addToHistory({
                type: 'outgoing',
                to: formattedPhone,
                message: message,
                timestamp: new Date().toISOString(),
                messageId: result.key?.id,
                status: 'sent'
            });

            this.logger.info(`📤 API Message sent to ${formattedPhone}: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);

            return {
                success: true,
                messageId: result.key?.id,
                timestamp: new Date().toISOString(),
                to: formattedPhone,
                message: message
            };

        } catch (error) {
            this.logger.error(`Failed to send API message to ${phoneNumber}:`, error);
            
            // Simpan error ke history
            this.addToHistory({
                type: 'outgoing',
                to: phoneNumber,
                message: message,
                timestamp: new Date().toISOString(),
                status: 'failed',
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Mengirim pesan broadcast ke multiple nomor
     * @param {Array} phoneNumbers - Array nomor telepon
     * @param {string} message - Pesan yang akan dikirim
     * @param {Object} options - Opsi tambahan
     * @returns {Object} Broadcast result
     */
    async sendBroadcastMessage(phoneNumbers, message, options = {}) {
        const results = [];
        const delay = options.delay || 1000; // Default delay 1 detik

        for (const phoneNumber of phoneNumbers) {
            try {
                const result = await this.sendTextMessage(phoneNumber, message, options);
                results.push({
                    phoneNumber,
                    success: true,
                    ...result
                });

                // Delay untuk mencegah spam
                if (delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

            } catch (error) {
                results.push({
                    phoneNumber,
                    success: false,
                    error: error.message
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.length - successCount;

        this.logger.info(`📡 Broadcast completed: ${successCount} sent, ${failedCount} failed`);

        return {
            success: true,
            total: results.length,
            sent: successCount,
            failed: failedCount,
            results
        };
    }

    /**
     * Memproses webhook yang masuk
     * @param {string} event - Event type
     * @param {Object} data - Data webhook
     * @param {Object} headers - Request headers
     * @returns {Object} Webhook process result
     */
    async processWebhook(event, data, headers = {}) {
        try {
            const webhookData = {
                event,
                data,
                headers,
                timestamp: new Date().toISOString(),
                id: this.generateWebhookId()
            };

            this.logger.info(`🔔 Webhook received: ${event}`, data);

            // Simpan webhook ke history
            this.addToHistory({
                type: 'webhook',
                event,
                data,
                timestamp: webhookData.timestamp,
                id: webhookData.id
            });

            // Proses webhook berdasarkan event type
            const result = await this.handleWebhookEvent(webhookData);

            return {
                success: true,
                webhookId: webhookData.id,
                timestamp: webhookData.timestamp,
                processed: result
            };

        } catch (error) {
            this.logger.error('Webhook processing failed:', error);
            throw error;
        }
    }

    /**
     * Menangani event webhook yang spesifik
     * @param {Object} webhookData - Data webhook
     * @returns {Object} Processing result
     */
    async handleWebhookEvent(webhookData) {
        const { event, data } = webhookData;

        switch (event) {
            case 'message_status':
                return await this.handleMessageStatus(data);
            
            case 'user_action':
                return await this.handleUserAction(data);
            
            case 'payment_notification':
                return await this.handlePaymentNotification(data);
            
            case 'reminder_trigger':
                return await this.handleReminderTrigger(data);
            
            case 'external_command':
                return await this.handleExternalCommand(data);
            
            default:
                this.logger.warn(`Unknown webhook event: ${event}`);
                return { processed: false, reason: 'Unknown event type' };
        }
    }

    /**
     * Handle message status webhook
     */
    async handleMessageStatus(data) {
        const { messageId, status, phoneNumber } = data;
        
        // Update message status in history
        const historyIndex = this.messageHistory.findIndex(
            h => h.messageId === messageId && h.to === phoneNumber
        );
        
        if (historyIndex >= 0) {
            this.messageHistory[historyIndex].status = status;
            this.messageHistory[historyIndex].statusTimestamp = new Date().toISOString();
        }

        return { updated: true, messageId, status };
    }

    /**
     * Handle user action webhook
     */
    async handleUserAction(data) {
        const { phoneNumber, action, context } = data;

        // Trigger action based on webhook
        switch (action) {
            case 'send_reminder':
                if (context.message) {
                    await this.sendTextMessage(phoneNumber, context.message);
                }
                break;
            
            case 'send_notification':
                if (context.notification) {
                    await this.sendTextMessage(phoneNumber, context.notification);
                }
                break;
        }

        return { action, executed: true };
    }

    /**
     * Handle payment notification webhook
     */
    async handlePaymentNotification(data) {
        const { phoneNumber, amount, status, transactionId } = data;
        
        const message = `💰 *Notifikasi Pembayaran*\n\n` +
                       `ID Transaksi: ${transactionId}\n` +
                       `Jumlah: Rp ${amount.toLocaleString('id-ID')}\n` +
                       `Status: ${status}\n` +
                       `Waktu: ${new Date().toLocaleString('id-ID')}`;

        await this.sendTextMessage(phoneNumber, message);
        
        return { notificationSent: true, transactionId };
    }

    /**
     * Handle reminder trigger webhook
     */
    async handleReminderTrigger(data) {
        const { phoneNumber, reminderText, type } = data;
        
        const message = `⏰ *Pengingat ${type}*\n\n${reminderText}`;
        await this.sendTextMessage(phoneNumber, message);
        
        return { reminderSent: true, type };
    }

    /**
     * Handle external command webhook
     */
    async handleExternalCommand(data) {
        const { phoneNumber, command, parameters } = data;
        
        // Process command as if it came from WhatsApp
        const mockMessage = {
            from: `${this.formatPhoneNumber(phoneNumber)}@s.whatsapp.net`,
            body: command,
            reply: async (text) => {
                await this.sendTextMessage(phoneNumber, text);
            }
        };

        // Delegate to command handler (would need access to commandHandler)
        // This is a simplified version
        const response = `🤖 Command '${command}' executed via webhook`;
        await this.sendTextMessage(phoneNumber, response);
        
        return { commandExecuted: true, command };
    }

    /**
     * Mendapatkan history pesan
     * @param {Object} filters - Filter untuk history
     * @returns {Array} Message history
     */
    getMessageHistory(filters = {}) {
        let history = [...this.messageHistory];

        if (filters.phoneNumber) {
            history = history.filter(h => 
                h.to === filters.phoneNumber || h.phoneNumber === filters.phoneNumber
            );
        }

        if (filters.type) {
            history = history.filter(h => h.type === filters.type);
        }

        if (filters.since) {
            const sinceDate = new Date(filters.since);
            history = history.filter(h => new Date(h.timestamp) >= sinceDate);
        }

        if (filters.limit) {
            history = history.slice(-filters.limit);
        }

        return history;
    }

    /**
     * Mendapatkan statistik API
     * @returns {Object} API statistics
     */
    getAPIStats() {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

        const recentHistory = this.messageHistory.filter(h => 
            new Date(h.timestamp) >= last24h
        );

        const hourlyHistory = this.messageHistory.filter(h => 
            new Date(h.timestamp) >= lastHour
        );

        return {
            total: {
                messages: this.messageHistory.length,
                sent: this.messageHistory.filter(h => h.status === 'sent').length,
                failed: this.messageHistory.filter(h => h.status === 'failed').length
            },
            last24Hours: {
                messages: recentHistory.length,
                sent: recentHistory.filter(h => h.status === 'sent').length,
                failed: recentHistory.filter(h => h.status === 'failed').length,
                webhooks: recentHistory.filter(h => h.type === 'webhook').length
            },
            lastHour: {
                messages: hourlyHistory.length,
                sent: hourlyHistory.filter(h => h.status === 'sent').length,
                failed: hourlyHistory.filter(h => h.status === 'failed').length
            },
            connection: {
                whatsappConnected: this.sock && this.sock.readyState === 'open',
                antiSpamActive: this.antiSpam ? true : false
            }
        };
    }

    /**
     * Format nomor telepon ke format yang benar
     * @param {string} phoneNumber - Nomor telepon
     * @returns {string} Formatted phone number
     */
    formatPhoneNumber(phoneNumber) {
        // Hapus karakter non-digit
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Jika dimulai dengan 0, ganti dengan 62
        if (cleaned.startsWith('0')) {
            cleaned = '62' + cleaned.substring(1);
        }
        
        // Jika tidak dimulai dengan 62, tambahkan 62
        if (!cleaned.startsWith('62')) {
            cleaned = '62' + cleaned;
        }
        
        return cleaned;
    }

    /**
     * Generate unique webhook ID
     * @returns {string} Webhook ID
     */
    generateWebhookId() {
        return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Tambahkan ke history dengan pembatasan ukuran
     * @param {Object} item - History item
     */
    addToHistory(item) {
        this.messageHistory.push(item);
        
        // Batasi ukuran history
        if (this.messageHistory.length > this.maxHistorySize) {
            this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Clear message history
     */
    clearHistory() {
        this.messageHistory = [];
        this.logger.info('Message history cleared');
    }
}

module.exports = MessagingAPIService;