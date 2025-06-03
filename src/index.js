require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const DatabaseManager = require('./database/DatabaseManager');
const CommandHandler = require('./handlers/CommandHandler');
const AIService = require('./services/AIService');
const Logger = require('./utils/Logger');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cron = require('node-cron');
const ReminderService = require('./services/ReminderService');

class WhatsAppFinancialBot {
    constructor() {
        this.client = null;
        this.db = null;
        this.commandHandler = null;
        this.aiService = null;
        this.reminderService = null;
        this.logger = new Logger();
        this.app = express();
        this.setupExpress();
    }

    setupExpress() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Webhook endpoint for external integrations
        this.app.post('/webhook', (req, res) => {
            this.logger.info('Webhook received:', req.body);
            res.status(200).json({ status: 'received' });
        });
    }

    async initialize() {
        try {
            this.logger.info('🚀 Initializing WhatsApp Financial Bot...');

            // Initialize database
            this.db = new DatabaseManager();
            await this.db.initialize();
            this.logger.info('✅ Database initialized');

            // Initialize AI service
            this.aiService = new AIService();
            this.logger.info('✅ AI Service initialized');

            // Initialize reminder service
            this.reminderService = new ReminderService(this.db);
            this.logger.info('✅ Reminder Service initialized');

            // Initialize WhatsApp client
            this.client = new Client({
                authStrategy: new LocalAuth({
                    clientId: 'financial-bot'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process',
                        '--disable-gpu'
                    ]
                }
            });

            // Initialize command handler
            this.commandHandler = new CommandHandler(this.db, this.aiService, this.client);
            
            this.setupEventHandlers();
            this.setupCronJobs();
            
            // Start WhatsApp client
            await this.client.initialize();
            
            // Start Express server
            const port = process.env.PORT || 3000;
            this.app.listen(port, () => {
                this.logger.info(`🌐 Express server running on port ${port}`);
            });

        } catch (error) {
            this.logger.error('❌ Failed to initialize bot:', error);
            process.exit(1);
        }
    }

    setupEventHandlers() {
        // QR code generation
        this.client.on('qr', (qr) => {
            this.logger.info('📱 QR Code generated. Scan with WhatsApp:');
            qrcode.generate(qr, { small: true });
        });

        // Client ready
        this.client.on('ready', () => {
            this.logger.info('✅ WhatsApp client is ready!');
            this.logger.info(`📱 Bot Name: ${process.env.BOT_NAME || 'Financial Manager Bot'}`);
        });

        // Authentication status
        this.client.on('authenticated', () => {
            this.logger.info('🔐 Client authenticated successfully');
        });

        this.client.on('auth_failure', (msg) => {
            this.logger.error('❌ Authentication failed:', msg);
        });

        // Message handling
        this.client.on('message', async (message) => {
            try {
                await this.handleMessage(message);
            } catch (error) {
                this.logger.error('Error handling message:', error);
            }
        });

        // Disconnection handling
        this.client.on('disconnected', (reason) => {
            this.logger.warn('⚠️ Client disconnected:', reason);
        });

        // Error handling
        this.client.on('error', (error) => {
            this.logger.error('❌ Client error:', error);
        });
    }

    async handleMessage(message) {
        // Skip if message is from status or group (optional)
        if (message.from === 'status@broadcast') return;

        // Check if user is authorized
        const userPhone = message.from.replace('@c.us', '');
        if (!this.isAuthorizedUser(userPhone)) {
            await message.reply('❌ Unauthorized user. Please contact administrator.');
            return;
        }

        // Log the message
        this.logger.info(`📨 Message from ${userPhone}: ${message.body}`);

        // Handle the command
        await this.commandHandler.handleMessage(message);
    }

    isAuthorizedUser(phoneNumber) {
        const allowedUsers = process.env.ALLOWED_USERS?.split(',') || [];
        return allowedUsers.some(allowed => phoneNumber.includes(allowed.replace(/\+/g, '')));
    }

    setupCronJobs() {
        // Daily backup at 2 AM
        cron.schedule('0 2 * * *', async () => {
            try {
                await this.db.backup();
                this.logger.info('✅ Daily backup completed');
            } catch (error) {
                this.logger.error('❌ Daily backup failed:', error);
            }
        });

        // Check reminders every hour
        cron.schedule('0 * * * *', async () => {
            try {
                await this.reminderService.checkAndSendReminders(this.client);
            } catch (error) {
                this.logger.error('❌ Reminder check failed:', error);
            }
        });

        // Weekly summary report (Sunday 9 AM)
        cron.schedule('0 9 * * 0', async () => {
            try {
                const adminPhone = process.env.BOT_ADMIN_PHONE;
                if (adminPhone) {
                    const summary = await this.commandHandler.reportService.generateWeeklySummary();
                    await this.client.sendMessage(adminPhone + '@c.us', `📊 *Weekly Summary*\n\n${summary}`);
                }
            } catch (error) {
                this.logger.error('❌ Weekly summary failed:', error);
            }
        });
    }

    async shutdown() {
        this.logger.info('🛑 Shutting down bot...');
        
        try {
            if (this.client) {
                await this.client.destroy();
            }
            if (this.db) {
                await this.db.close();
            }
            this.logger.info('✅ Bot shutdown complete');
        } catch (error) {
            this.logger.error('❌ Error during shutdown:', error);
        }
        
        process.exit(0);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    if (global.bot) {
        await global.bot.shutdown();
    }
});

process.on('SIGTERM', async () => {
    if (global.bot) {
        await global.bot.shutdown();
    }
});

// Start the bot
const bot = new WhatsAppFinancialBot();
global.bot = bot;
bot.initialize().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});