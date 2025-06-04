// Load environment variables from .env file or environment
require('dotenv').config({ path: '.env' });

const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    isJidBroadcast,
    isJidGroup
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const DatabaseManager = require('./database/DatabaseManager');
const CommandHandler = require('./handlers/CommandHandler');
const AIService = require('./services/AIService');
const IndonesianAIAssistant = require('./services/IndonesianAIAssistant');
const Logger = require('./utils/Logger');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cron = require('node-cron');
const ReminderService = require('./services/ReminderService');
const fs = require('fs');
const path = require('path');

class WhatsAppFinancialBot {
    constructor() {
        this.sock = null;
        this.db = null;
        this.commandHandler = null;
        this.aiService = null;
        this.indonesianAI = null;
        this.reminderService = null;
        this.logger = new Logger();
        this.app = express();
        this.setupExpress();
        this.ensureDataDirectories();
    }

    ensureDataDirectories() {
        // Create necessary directories
        const dirs = ['./data', './data/sessions'];
        dirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    setupExpress() {
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(express.json());
        
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // QR Code state
        this.currentQRCode = null;
        this.isWhatsAppConnected = false;
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                whatsapp_connected: this.isWhatsAppConnected
            });
        });

        // QR Code routes
        this.app.get('/qrcode', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'qrcode.html'));
        });

        this.app.get('/qrcode/status', (req, res) => {
            res.json({
                qr: this.currentQRCode,
                connected: this.isWhatsAppConnected,
                error: null
            });
        });

        this.app.post('/qrcode/refresh', (req, res) => {
            this.currentQRCode = null;
            this.isWhatsAppConnected = false;
            this.logger.info('QR Code refresh requested');
            res.json({ success: true });
        });

        // Webhook endpoint for external integrations
        this.app.post('/webhook', (req, res) => {
            this.logger.info('Webhook received:', req.body);
            res.status(200).json({ status: 'received' });
        });
    }

    validateEnvironment() {
        this.logger.info('🔍 Validating environment variables...');
        
        // Log current environment
        this.logger.info(`📍 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        this.logger.info(`📍 DATABASE_TYPE: ${process.env.DATABASE_TYPE || 'not set'}`);
        
        // Check for .env file
        if (fs.existsSync('.env')) {
            this.logger.info('✅ .env file found');
        } else {
            this.logger.warn('⚠️  .env file not found, using environment variables only');
        }
        
        // Check required variables
        const requiredVars = ['DEEPSEEK_API_KEY', 'BOT_ADMIN_PHONE'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            this.logger.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
            this.logger.warn('   Bot functionality may be limited');
        } else {
            this.logger.info('✅ All required environment variables present');
        }
        
        // Log database configuration
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';
        this.logger.info(`📊 Database type: ${dbType}`);
        
        if (dbType === 'sqlite3') {
            const dbPath = process.env.DB_PATH || './data/financial.db';
            this.logger.info(`📁 Database path: ${dbPath}`);
        } else if (dbType === 'postgresql') {
            const dbHost = process.env.DB_HOST || 'localhost';
            const dbName = process.env.DB_NAME || 'financial_bot';
            this.logger.info(`🐘 PostgreSQL: ${dbHost}/${dbName}`);
        }
    }

    async initialize() {
        try {
            this.logger.info('🚀 Initializing WhatsApp Financial Bot with Baileys...');
            
            // Validate environment variables
            this.validateEnvironment();

            // Initialize database
            this.db = new DatabaseManager();
            await this.db.initialize();
            this.logger.info('✅ Database initialized');

            // Initialize AI service
            this.aiService = new AIService();
            this.logger.info('✅ AI Service initialized');

            // Initialize Indonesian AI Assistant
            this.indonesianAI = new IndonesianAIAssistant(this.db, this.aiService);
            this.logger.info('✅ Indonesian AI Assistant initialized');

            // Initialize reminder service
            this.reminderService = new ReminderService(this.db);
            this.logger.info('✅ Reminder Service initialized');

            // Start WhatsApp client with retry mechanism
            await this.initializeWhatsAppWithRetry();
            
            // Start Express server
            const port = process.env.PORT || 3000;
            this.app.listen(port, () => {
                this.logger.info(`🌐 Express server running on port ${port}`);
            });

        } catch (error) {
            this.logger.error('❌ Failed to initialize bot:', error);
            // In production/Docker, retry instead of immediate exit
            if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development') {
                this.logger.info('🔄 Retrying initialization in 10 seconds...');
                setTimeout(() => this.initialize(), 10000);
            } else {
                process.exit(1);
            }
        }
    }

    async initializeWhatsAppWithRetry(maxRetries = 5) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                this.logger.info(`📱 Attempting to initialize Baileys WhatsApp client (attempt ${attempt}/${maxRetries})`);
                
                await this.connectToBaileys();
                this.logger.info('✅ Baileys WhatsApp client initialized successfully');
                return;
                
            } catch (error) {
                this.logger.error(`❌ Baileys initialization attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    const delay = Math.min(5000 * attempt, 30000); // Exponential backoff, max 30 seconds
                    this.logger.info(`⏳ Waiting ${delay/1000} seconds before retry...`);
                    
                    // Cleanup current socket
                    if (this.sock) {
                        try {
                            this.sock.end();
                        } catch (destroyError) {
                            this.logger.warn('Warning during socket cleanup:', destroyError.message);
                        }
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw new Error(`Failed to initialize Baileys after ${maxRetries} attempts: ${error.message}`);
                }
            }
        }
    }

    async connectToBaileys() {
        const { state, saveCreds } = await useMultiFileAuthState('./data/sessions');
        
        // Fetch latest version of WA Web
        const { version, isLatest } = await fetchLatestBaileysVersion();
        this.logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        // Create minimal logger to suppress verbose Baileys logs
        const baileysPinoLogger = {
            fatal: () => {},
            error: () => {},
            warn: () => {},
            info: () => {},
            debug: () => {},
            trace: () => {},
            child: () => baileysPinoLogger
        };

        this.sock = makeWASocket({
            version,
            logger: baileysPinoLogger,
            printQRInTerminal: false, // We'll handle QR code printing ourselves
            auth: state,
            msgRetryCounterMap: {},
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: undefined,
        });

        // Initialize command handler with the socket
        this.commandHandler = new CommandHandler(this.db, this.aiService, this.sock);

        this.sock.ev.process(
            async (events) => {
                // Connection updates
                if (events['connection.update']) {
                    const update = events['connection.update'];
                    const { connection, lastDisconnect, qr } = update;

                    if (qr) {
                        this.logger.info('📱 QR Code generated for WhatsApp login');
                        
                        // Show QR in terminal (backup)
                        qrcode.generate(qr, { small: true });
                        
                        // Convert QR to base64 for web service
                        const QRCode = require('qrcode');
                        try {
                            const qrBase64 = await QRCode.toDataURL(qr);
                            const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
                            this.currentQRCode = base64Data;
                            this.isWhatsAppConnected = false;
                            
                            const port = process.env.PORT || 3000;
                            this.logger.info(`🌐 QR Code available at: http://localhost:${port}/qrcode`);
                        } catch (qrError) {
                            this.logger.error('Error generating QR for web:', qrError);
                        }
                    }

                    if (connection === 'close') {
                        // Reconnect if not logged out
                        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                        this.logger.info('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                        
                        if (shouldReconnect) {
                            await this.connectToBaileys();
                        }
                    } else if (connection === 'open') {
                        this.logger.info('✅ WhatsApp connection opened successfully');
                        this.logger.info(`📱 Bot Name: ${process.env.BOT_NAME || 'Financial Manager Bot'}`);
                        
                        // Update connection status for web interface
                        this.isWhatsAppConnected = true;
                        this.currentQRCode = null;
                        
                        this.setupCronJobs();
                    }
                }

                // Save credentials
                if (events['creds.update']) {
                    await saveCreds();
                }

                // Handle messages
                if (events['messages.upsert']) {
                    const upsert = events['messages.upsert'];
                    
                    if (upsert.type === 'notify') {
                        for (const msg of upsert.messages) {
                            await this.handleMessage(msg);
                        }
                    }
                }
            }
        );
    }

    async handleMessage(message) {
        // Skip if message is from status broadcast
        if (isJidBroadcast(message.key.remoteJid)) return;
        
        // Skip if message is from group (optional - remove this if you want group support)
        if (isJidGroup(message.key.remoteJid)) return;

        // Skip if no message content
        if (!message.message) return;

        // Extract message text
        const messageText = this.getMessageText(message);
        if (!messageText) return;

        // Get user info
        const userJid = message.key.remoteJid;
        const userPhone = userJid.replace('@s.whatsapp.net', '');

        // Log the message
        this.logger.info(`📨 Message from ${userPhone}: ${messageText}`);

        // Create a message object compatible with the handlers
        const compatibleMessage = {
            from: userJid,
            body: messageText,
            reply: async (text) => {
                await this.sock.sendMessage(userJid, { text });
            }
        };

        try {
            // First, let Indonesian AI Assistant handle user registration and authentication
            const handledByAI = await this.indonesianAI.processMessage(compatibleMessage, userPhone, messageText);
            
            if (handledByAI) {
                // Message was handled by AI Assistant (registration flow or access control)
                return;
            }

            // User is registered and authenticated, proceed with normal command handling
            await this.commandHandler.handleMessage(compatibleMessage);
            
        } catch (error) {
            this.logger.error('Error handling message:', error);
            await this.sock.sendMessage(userJid, { text: '❌ Terjadi kesalahan saat memproses pesan Anda.' });
        }
    }

    getMessageText(message) {
        // Extract text from different message types
        if (message.message?.conversation) {
            return message.message.conversation;
        } else if (message.message?.extendedTextMessage?.text) {
            return message.message.extendedTextMessage.text;
        } else if (message.message?.imageMessage?.caption) {
            return message.message.imageMessage.caption;
        } else if (message.message?.videoMessage?.caption) {
            return message.message.videoMessage.caption;
        }
        return null;
    }

    // Note: Authorization is now handled by IndonesianAIAssistant
    // This method is kept for backward compatibility but not used
    isAuthorizedUser(phoneNumber) {
        // All users can now register through the AI Assistant
        return true;
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
                await this.reminderService.checkAndSendReminders(this.sock);
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
                    const adminJid = adminPhone.includes('@') ? adminPhone : `${adminPhone}@s.whatsapp.net`;
                    await this.sock.sendMessage(adminJid, { text: `📊 *Weekly Summary*\n\n${summary}` });
                }
            } catch (error) {
                this.logger.error('❌ Weekly summary failed:', error);
            }
        });
    }

    async shutdown() {
        this.logger.info('🛑 Shutting down bot...');
        
        try {
            if (this.sock) {
                this.sock.end();
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