// Load environment variables from .env file or environment
require('dotenv').config({ path: '.env' });

const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    isJidBroadcast,
    isJidGroup
} = require('baileys');
const DatabaseManager = require('./database/DatabaseManager');
const CommandHandler = require('./handlers/CommandHandler');
const AIService = require('./services/AIService');
const IndonesianAIAssistant = require('./services/IndonesianAIAssistant');
const Logger = require('./utils/Logger');
const AntiSpamManager = require('./utils/AntiSpamManager');
const TypingManager = require('./utils/TypingManager');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cron = require('node-cron');
const ReminderService = require('./services/ReminderService');
const MessagingAPIService = require('./services/MessagingAPIService');
const TrialSchedulerService = require('./services/TrialSchedulerService');
const TrialNotificationService = require('./services/TrialNotificationService');
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
        this.messagingAPI = null;
        this.typingManager = null;
        this.trialScheduler = null;
        this.trialNotificationService = null;
        this.logger = new Logger();
        this.antiSpam = new AntiSpamManager();
        this.app = express();
        this.processedMessages = new Set(); // Track processed messages to prevent duplicates
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
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                    "script-src": ["'self'", "'unsafe-inline'"],
                    "script-src-attr": ["'unsafe-inline'"],
                },
            },
        }));
        this.app.use(cors());
        this.app.use(express.json());
        
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // QR Code state - initialize as disconnected
        this.currentQRCode = null;
        this.isWhatsAppConnected = false;
        
        // Enhanced health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const health = {
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    whatsapp: {
                        connected: this.isWhatsAppConnected,
                        qrRequired: this.currentQRCode ? true : false
                    },
                    database: {
                        status: 'unknown'
                    },
                    antiSpam: {
                        initialized: this.antiSpam ? true : false
                    },
                    typing: {
                        initialized: this.typingManager ? true : false
                    },
                    trialScheduler: {
                        initialized: this.trialScheduler ? true : false
                    },
                    trialNotification: {
                        initialized: this.trialNotificationService ? true : false
                    },
                    sessions: {
                        pending: global.pendingTransactions ? global.pendingTransactions.size : 0,
                        edit: global.editSessions ? global.editSessions.size : 0,
                        delete: global.deleteConfirmations ? global.deleteConfirmations.size : 0
                    }
                };

                // Test database connection
                if (this.db) {
                    try {
                        await this.db.testConnection();
                        health.database.status = 'connected';
                    } catch (error) {
                        health.database.status = 'error';
                        health.database.error = error.message;
                        health.status = 'DEGRADED';
                    }
                } else {
                    health.database.status = 'not_initialized';
                    health.status = 'DEGRADED';
                }

                // Check anti-spam status
                if (this.antiSpam) {
                    try {
                        const stats = this.antiSpam.getStats();
                        health.antiSpam.emergencyBrakeActive = stats.global.emergencyBrakeActive;
                        health.antiSpam.messagesPerMinute = stats.global.messagesPerMinute;
                        health.antiSpam.banRiskLevel = stats.global.banRiskLevel;
                        
                        if (stats.global.emergencyBrakeActive || stats.global.banRiskLevel === 'CRITICAL') {
                            health.status = 'CRITICAL';
                        } else if (stats.global.banRiskLevel === 'HIGH') {
                            health.status = 'DEGRADED';
                        }
                    } catch (error) {
                        health.antiSpam.error = error.message;
                    }
                }

                // Check typing manager status
                if (this.typingManager) {
                    try {
                        const typingStats = this.typingManager.getStats();
                        health.typing.activeTyping = typingStats.activeTyping;
                        health.typing.queuedMessages = typingStats.queuedMessages;
                    } catch (error) {
                        health.typing.error = error.message;
                    }
                }

                // Check trial scheduler status
                if (this.trialScheduler) {
                    try {
                        const schedulerHealth = await this.trialScheduler.healthCheck();
                        health.trialScheduler.status = schedulerHealth.status;
                        health.trialScheduler.totalJobs = schedulerHealth.totalJobs;
                        health.trialScheduler.jobsRunning = schedulerHealth.jobsRunning;
                        health.trialScheduler.lastCheck = schedulerHealth.lastCheck;
                    } catch (error) {
                        health.trialScheduler.error = error.message;
                    }
                }

                // Check trial notification status
                if (this.trialNotificationService) {
                    try {
                        const notificationStats = this.trialNotificationService.getNotificationStats();
                        health.trialNotification.socketAvailable = notificationStats.socketAvailable;
                        health.trialNotification.sentToday = notificationStats.sentToday;
                        health.trialNotification.sentThisWeek = notificationStats.sentThisWeek;
                        health.trialNotification.totalRecords = notificationStats.totalRecords;
                    } catch (error) {
                        health.trialNotification.error = error.message;
                    }
                }

                const statusCode = health.status === 'OK' ? 200 : health.status === 'DEGRADED' ? 503 : 500;
                res.status(statusCode).json(health);
                
            } catch (error) {
                res.status(500).json({
                    status: 'ERROR',
                    timestamp: new Date().toISOString(),
                    error: error.message
                });
            }
        });

        // QR Code routes
        this.app.get('/qrscan', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'qrcode.html'));
        });

        this.app.get('/qrscan/status', (req, res) => {
            // Improved connection status detection
            let hasActiveConnection = false;
            
            // Check multiple indicators of active connection
            if (this.sock && this.isWhatsAppConnected) {
                // Check if socket exists and has user info (indicates successful auth)
                hasActiveConnection = !!(this.sock.user && this.sock.user.id);
                
                // Additional check: if socket readyState exists and is open
                if (this.sock.readyState) {
                    hasActiveConnection = hasActiveConnection && this.sock.readyState === 'open';
                }
            }
            
            // Log status for debugging
            this.logger.debug(`QR Status Check - Connected: ${hasActiveConnection}, Socket exists: ${!!this.sock}, Internal flag: ${this.isWhatsAppConnected}, User ID: ${this.sock?.user?.id || 'none'}, Socket state: ${this.sock?.readyState || 'none'}`);
            
            res.json({
                qr: this.currentQRCode,
                connected: hasActiveConnection,
                error: null
            });
        });

        this.app.post('/qrscan/refresh', (req, res) => {
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

        // Anti-spam monitoring endpoints
        this.app.get('/anti-spam/stats', (req, res) => {
            try {
                const stats = this.antiSpam ? this.antiSpam.getStats() : { error: 'Anti-spam not initialized' };
                res.json({
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    stats
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/anti-spam/reset-emergency', (req, res) => {
            try {
                if (this.antiSpam) {
                    this.antiSpam.resetEmergencyBrake();
                    res.json({ status: 'Emergency brake reset', timestamp: new Date().toISOString() });
                } else {
                    res.status(500).json({ error: 'Anti-spam not initialized' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/anti-spam/remove-cooldown/:phone', (req, res) => {
            try {
                const phone = req.params.phone;
                if (this.antiSpam) {
                    const removed = this.antiSpam.removeCooldown(phone);
                    res.json({
                        status: removed ? 'Cooldown removed' : 'User not found',
                        phone,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.status(500).json({ error: 'Anti-spam not initialized' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Typing manager monitoring endpoints
        this.app.get('/typing/stats', (req, res) => {
            try {
                const stats = this.typingManager ? this.typingManager.getStats() : { error: 'Typing manager not initialized' };
                res.json({
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    stats
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/typing/stop-all', (req, res) => {
            try {
                if (this.typingManager) {
                    this.typingManager.stopAllTyping();
                    res.json({ status: 'All typing stopped', timestamp: new Date().toISOString() });
                } else {
                    res.status(500).json({ error: 'Typing manager not initialized' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Trial scheduler monitoring endpoints
        this.app.get('/trial-scheduler/stats', (req, res) => {
            try {
                const stats = this.trialScheduler ? this.trialScheduler.getSchedulerStatus() : { error: 'Trial scheduler not initialized' };
                res.json({
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    stats
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/trial-scheduler/manual-check', async (req, res) => {
            try {
                if (this.trialScheduler) {
                    const result = await this.trialScheduler.manualTrialCheck();
                    res.json({
                        status: 'Manual trial check completed',
                        result,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.status(500).json({ error: 'Trial scheduler not initialized' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Trial notification monitoring endpoints
        this.app.get('/trial-notification/stats', (req, res) => {
            try {
                const stats = this.trialNotificationService ? this.trialNotificationService.getNotificationStats() : { error: 'Trial notification service not initialized' };
                res.json({
                    status: 'OK',
                    timestamp: new Date().toISOString(),
                    stats
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/trial-notification/test/:phone', async (req, res) => {
            try {
                const phone = req.params.phone;
                const userName = req.body.userName || 'Test User';
                
                if (this.trialNotificationService) {
                    const result = await this.trialNotificationService.sendTestNotification(phone, userName);
                    res.json({
                        status: 'Test notification processed',
                        result,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.status(500).json({ error: 'Trial notification service not initialized' });
                }
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API endpoints for messaging
        this.setupMessagingAPI();
    }

    setupMessagingAPI() {
        // API Authentication middleware
        const authenticateAPI = (req, res, next) => {
            const apiKey = req.headers['x-api-key'] || req.query.api_key;
            const validApiKey = process.env.API_KEY;
            
            if (!validApiKey) {
                return res.status(500).json({
                    error: 'API key not configured on server',
                    code: 'API_KEY_NOT_CONFIGURED'
                });
            }
            
            if (!apiKey || apiKey !== validApiKey) {
                return res.status(401).json({
                    error: 'Invalid or missing API key',
                    code: 'INVALID_API_KEY'
                });
            }
            
            next();
        };

        // Send single text message
        this.app.post('/api/send-message', authenticateAPI, async (req, res) => {
            try {
                const { phoneNumber, message, options = {} } = req.body;

                if (!phoneNumber || !message) {
                    return res.status(400).json({
                        error: 'Phone number and message are required',
                        code: 'MISSING_PARAMETERS'
                    });
                }

                if (!this.messagingAPI) {
                    return res.status(503).json({
                        error: 'Messaging service not available',
                        code: 'SERVICE_UNAVAILABLE'
                    });
                }

                const result = await this.messagingAPI.sendTextMessage(phoneNumber, message, options);
                res.json(result);

            } catch (error) {
                this.logger.error('API send-message error:', error);
                res.status(500).json({
                    error: error.message,
                    code: 'SEND_MESSAGE_FAILED'
                });
            }
        });

        // Send broadcast message
        this.app.post('/api/send-broadcast', authenticateAPI, async (req, res) => {
            try {
                const { phoneNumbers, message, options = {} } = req.body;

                if (!phoneNumbers || !Array.isArray(phoneNumbers) || !message) {
                    return res.status(400).json({
                        error: 'Phone numbers array and message are required',
                        code: 'MISSING_PARAMETERS'
                    });
                }

                if (phoneNumbers.length > 100) {
                    return res.status(400).json({
                        error: 'Maximum 100 phone numbers allowed per broadcast',
                        code: 'TOO_MANY_RECIPIENTS'
                    });
                }

                if (!this.messagingAPI) {
                    return res.status(503).json({
                        error: 'Messaging service not available',
                        code: 'SERVICE_UNAVAILABLE'
                    });
                }

                const result = await this.messagingAPI.sendBroadcastMessage(phoneNumbers, message, options);
                res.json(result);

            } catch (error) {
                this.logger.error('API send-broadcast error:', error);
                res.status(500).json({
                    error: error.message,
                    code: 'SEND_BROADCAST_FAILED'
                });
            }
        });

        // Webhook endpoint
        this.app.post('/api/webhook', authenticateAPI, async (req, res) => {
            try {
                const { event, data } = req.body;

                if (!event) {
                    return res.status(400).json({
                        error: 'Event type is required',
                        code: 'MISSING_EVENT'
                    });
                }

                if (!this.messagingAPI) {
                    return res.status(503).json({
                        error: 'Messaging service not available',
                        code: 'SERVICE_UNAVAILABLE'
                    });
                }

                const result = await this.messagingAPI.processWebhook(event, data, req.headers);
                res.json(result);

            } catch (error) {
                this.logger.error('API webhook error:', error);
                res.status(500).json({
                    error: error.message,
                    code: 'WEBHOOK_FAILED'
                });
            }
        });

        // Get message history
        this.app.get('/api/message-history', authenticateAPI, (req, res) => {
            try {
                if (!this.messagingAPI) {
                    return res.status(503).json({
                        error: 'Messaging service not available',
                        code: 'SERVICE_UNAVAILABLE'
                    });
                }

                const filters = {
                    phoneNumber: req.query.phoneNumber,
                    type: req.query.type,
                    since: req.query.since,
                    limit: req.query.limit ? parseInt(req.query.limit) : undefined
                };

                const history = this.messagingAPI.getMessageHistory(filters);
                res.json({
                    success: true,
                    count: history.length,
                    history
                });

            } catch (error) {
                this.logger.error('API message-history error:', error);
                res.status(500).json({
                    error: error.message,
                    code: 'HISTORY_FAILED'
                });
            }
        });

        // Get API statistics
        this.app.get('/api/stats', authenticateAPI, (req, res) => {
            try {
                if (!this.messagingAPI) {
                    return res.status(503).json({
                        error: 'Messaging service not available',
                        code: 'SERVICE_UNAVAILABLE'
                    });
                }

                const stats = this.messagingAPI.getAPIStats();
                res.json({
                    success: true,
                    timestamp: new Date().toISOString(),
                    ...stats
                });

            } catch (error) {
                this.logger.error('API stats error:', error);
                res.status(500).json({
                    error: error.message,
                    code: 'STATS_FAILED'
                });
            }
        });

        // Clear message history
        this.app.post('/api/clear-history', authenticateAPI, (req, res) => {
            try {
                if (!this.messagingAPI) {
                    return res.status(503).json({
                        error: 'Messaging service not available',
                        code: 'SERVICE_UNAVAILABLE'
                    });
                }

                this.messagingAPI.clearHistory();
                res.json({
                    success: true,
                    message: 'Message history cleared',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                this.logger.error('API clear-history error:', error);
                res.status(500).json({
                    error: error.message,
                    code: 'CLEAR_HISTORY_FAILED'
                });
            }
        });

        // Test API endpoint
        this.app.get('/api/test', authenticateAPI, (req, res) => {
            res.json({
                success: true,
                message: 'API is working',
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            });
        });
    }

    validateEnvironment() {
        this.logger.info('🔍 Validating environment variables...');
        
        // Log current environment
        this.logger.info(`📍 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
        
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
        
        // Log PostgreSQL database configuration
        const dbUrl = process.env.DATABASE_DB_URL || process.env.SUPABASE_DB_URL;
        if (dbUrl) {
            try {
                const url = new URL(dbUrl);
                this.logger.info(`🐘 PostgreSQL via URL: ${url.hostname}:${url.port || 5432}/${url.pathname.slice(1)}`);
            } catch (error) {
                this.logger.warn(`⚠️  Invalid database URL format: ${error.message}`);
            }
        } else {
            const dbHost = process.env.POSTGRES_HOST || process.env.DATABASE_HOST || 'localhost';
            const dbName = process.env.POSTGRES_DB || process.env.DATABASE_NAME || 'financial_bot';
            this.logger.info(`🐘 PostgreSQL via config: ${dbHost}/${dbName}`);
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

            // Initialize trial scheduler service
            this.trialScheduler = new TrialSchedulerService(this.db);
            await this.trialScheduler.initialize();
            this.logger.info('✅ Trial Scheduler Service initialized');

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

    async clearSessionData() {
        // Clear session files when device is unlinked (401 error)
        const sessionPath = './data/sessions';
        try {
            if (fs.existsSync(sessionPath)) {
                const files = fs.readdirSync(sessionPath);
                for (const file of files) {
                    const filePath = path.join(sessionPath, file);
                    fs.unlinkSync(filePath);
                }
                this.logger.info('🧹 Cleared session data due to device unlink');
            }
        } catch (error) {
            this.logger.error('Error clearing session data:', error);
        }
    }

    async connectToBaileys() {
        // Reset connection status when initializing connection
        this.isWhatsAppConnected = false;
        this.currentQRCode = null;
        
        // Clean up existing socket if any
        if (this.sock) {
            try {
                this.sock.ev.removeAllListeners();
                this.sock.end();
            } catch (error) {
                this.logger.warn('Error cleaning up existing socket:', error.message);
            }
        }
        
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

        // Initialize command handler with the socket and sessionManager
        this.commandHandler = new CommandHandler(this.db, this.aiService, this.sock, this.indonesianAI, this.db.sessionManager);
        
        // Initialize typing manager with the socket
        this.typingManager = new TypingManager(this.sock);

        // Use a single event listener to avoid duplicates
        this.sock.ev.on('connection.update', async (update) => {
            await this.handleConnectionUpdate(update);
        });
        
        this.sock.ev.on('creds.update', async () => {
            await saveCreds();
        });
        
        this.sock.ev.on('messages.upsert', async (upsert) => {
            if (upsert.type === 'notify') {
                for (const msg of upsert.messages) {
                    await this.handleMessage(msg);
                }
            }
        });
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            this.logger.info('📱 QR Code generated. Scan with WhatsApp:');
            
            // Convert QR to base64 for web service
            const QRCode = require('qrcode');
            try {
                const qrBase64 = await QRCode.toDataURL(qr);
                const base64Data = qrBase64.replace(/^data:image\/png;base64,/, '');
                this.currentQRCode = base64Data;
                this.isWhatsAppConnected = false;
                
                // Display full URL with domain
                const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
                const qrUrl = `${baseUrl}/qrscan`;
                
                this.logger.info(`🌐 QR Code available at: ${qrUrl}`);
                this.logger.info(`📱 Open this URL in your browser to scan QR code:`);
                this.logger.info(`   ${qrUrl}`);
            } catch (qrError) {
                this.logger.error('Error generating QR for web:', qrError);
            }
        }

        if (connection === 'close') {
            // Reset connection status when closed
            this.isWhatsAppConnected = false;
            this.currentQRCode = null;
            
            const error = lastDisconnect?.error;
            const statusCode = error?.output?.statusCode;
            
            // Check if device was unlinked (401 Unauthorized)
            if (statusCode === 401) {
                this.logger.warn('🔓 Device unlinked detected (401 error) - clearing session data');
                await this.clearSessionData();
                // Force QR code regeneration by reconnecting
                this.logger.info('♻️ Reconnecting to generate new QR code...');
                setTimeout(() => this.connectToBaileys(), 2000);
                return;
            }
            
            // Handle other disconnection reasons
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            this.logger.info('Connection closed due to ', error, ', reconnecting ', shouldReconnect);
            
            if (shouldReconnect) {
                // Add delay before reconnecting to avoid rapid reconnection loops
                setTimeout(() => this.connectToBaileys(), 5000);
            }
        } else if (connection === 'open') {
            const botName = process.env.BOT_NAME || 'Financial Manager Bot';
            this.logger.info('✅ WhatsApp connection opened successfully');
            this.logger.info(`🤖 ${botName} is now ready to serve!`);
            this.logger.info(`📱 Session: ${this.sock.user?.id || 'Unknown'}`);
            
            // Update connection status for web interface
            this.isWhatsAppConnected = true;
            this.currentQRCode = null;
            
            // Log connection status for debugging
            this.logger.info('🌐 QR Scan UI Status Updated: Connected = true, QR = null');

            // Initialize messaging API service after WhatsApp connection is established
            this.messagingAPI = new MessagingAPIService(this.sock, this.antiSpam, this.db);
            this.logger.info('✅ Messaging API Service initialized');
            
            // Initialize trial notification service after WhatsApp connection is established
            this.trialNotificationService = new TrialNotificationService(this.sock);
            this.logger.info('✅ Trial Notification Service initialized');
            
            // Connect trial notification service to database manager
            if (this.db && this.trialNotificationService) {
                this.db.setTrialNotificationService(this.trialNotificationService);
            }
            
            this.setupCronJobs();
            this.setupPeriodicCleanup();
        } else if (connection === 'connecting') {
            this.logger.info('🔄 WhatsApp is connecting...');
            this.isWhatsAppConnected = false;
        }
    }


    async handleMessage(message) {
        // Skip if message is from status broadcast
        if (isJidBroadcast(message.key.remoteJid)) return;
        
        // Skip if message is from group (optional - remove this if you want group support)
        if (isJidGroup(message.key.remoteJid)) return;

        // Skip if no message content
        if (!message.message) return;

        // Check if this is an outgoing message (sent by bot)
        const isFromMe = message.key.fromMe;
        if (isFromMe) {
            // This is a message sent by the bot, don't process it
            return;
        }

        // Create unique message ID to prevent duplicate processing
        const messageId = `${message.key.remoteJid}_${message.key.id}_${message.messageTimestamp || Date.now()}`;
        
        // Check if we've already processed this message
        if (this.processedMessages.has(messageId)) {
            this.logger.debug(`Skipping duplicate message: ${messageId}`);
            return; // Skip duplicate message
        }
        
        // Add to processed messages set
        this.processedMessages.add(messageId);
        
        // Clean up old processed messages (keep only last 1000)
        if (this.processedMessages.size > 1000) {
            const messagesToDelete = Array.from(this.processedMessages).slice(0, 500);
            messagesToDelete.forEach(id => this.processedMessages.delete(id));
        }
        
        // Log message details for debugging
        this.logger.debug(`Processing message ID: ${messageId}`);

        // Extract message text
        const messageText = this.getMessageText(message);
        if (!messageText) return;

        // Get user info
        const userJid = message.key.remoteJid;
        const userPhone = userJid.replace('@s.whatsapp.net', '');

        // Check incoming message against anti-spam
        const incomingCheck = await this.antiSpam.checkMessageAllowed(userPhone, messageText, false);
        if (!incomingCheck.allowed) {
            this.logger.warn(`🛡️ Incoming message blocked for ${userPhone}: ${incomingCheck.reason}`);
            
            // Only send rate limit message if user is not in cooldown (to avoid spam)
            if (incomingCheck.reason !== 'user_in_cooldown') {
                await this.sock.sendMessage(userJid, { text: incomingCheck.message });
            }
            return;
        }

        // Log incoming message (only from users, not bot responses)
        this.logger.info(`📨 Received from ${userPhone}: ${messageText}`);

        // Create a message object compatible with the handlers
        const compatibleMessage = {
            from: userJid,
            body: messageText,
            reply: async (content) => {
                try {
                    // Handle both string and object responses
                    if (typeof content === 'string') {
                        return await this.sendTextReply(userJid, userPhone, content, message);
                    } else if (content && typeof content === 'object') {
                        if (content.type === 'audio') {
                            return await this.sendAudioReply(userJid, userPhone, content, message);
                        } else if (content.type === 'text') {
                            return await this.sendTextReply(userJid, userPhone, content.content, message);
                        }
                    }
                    
                    // Fallback to text if format is unexpected
                    await this.sendTextReply(userJid, userPhone, String(content), message);
                } catch (error) {
                    this.logger.error(`Failed to send reply to ${userPhone}:`, error);
                    throw error;
                }
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
            const errorMsg = '❌ Terjadi kesalahan saat memproses pesan Anda.';
            this.logger.info(`📤 Bot error reply to ${userPhone}: ${errorMsg}`);
            await this.sock.sendMessage(userJid, { text: errorMsg });
        }
    }

    /**
     * Send text reply with anti-spam protection
     */
    async sendTextReply(userJid, userPhone, text, originalMessage) {
        try {
            // Check outgoing message against anti-spam (critical for preventing bans!)
            const outgoingCheck = await this.antiSpam.checkMessageAllowed(userPhone, text, true);
            if (!outgoingCheck.allowed) {
                this.logger.error(`🛡️ Outgoing message blocked for ${userPhone}: ${outgoingCheck.reason}`);
                
                // If emergency brake or global limit, log critical error
                if (outgoingCheck.reason === 'emergency_brake' || outgoingCheck.reason.includes('global')) {
                    this.logger.error('🚨 CRITICAL: Global rate limit reached, stopping outgoing messages to prevent WhatsApp ban');
                }
                
                return; // Don't send the message
            }

            // Apply natural delay if suggested by anti-spam
            if (outgoingCheck.naturalDelay > 0) {
                this.logger.debug(`⏳ Applying natural delay: ${outgoingCheck.naturalDelay}ms for ${userPhone}`);
                await new Promise(resolve => setTimeout(resolve, outgoingCheck.naturalDelay));
            }

            // Log outgoing message from bot
            this.logger.info(`📤 Bot reply to ${userPhone}: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
            
            // Send message with typing indicator for natural feel
            if (this.typingManager) {
                await this.typingManager.sendWithTyping(userJid, text, {
                    quoted: originalMessage
                });
            } else {
                // Fallback if typing manager not available
                await this.sock.sendMessage(userJid, {
                    text: text,
                    quoted: originalMessage
                });
            }
        } catch (error) {
            this.logger.error(`Failed to send text reply to ${userPhone}:`, error);
            throw error;
        }
    }

    /**
     * Send audio reply with TTS
     */
    async sendAudioReply(userJid, userPhone, audioContent, originalMessage) {
        const fs = require('fs');
        
        try {
            // Check if audio file exists
            if (!fs.existsSync(audioContent.audioPath)) {
                this.logger.warn(`Audio file not found: ${audioContent.audioPath}, falling back to text`);
                return await this.sendTextReply(userJid, userPhone, audioContent.content, originalMessage);
            }

            // Check outgoing message against anti-spam
            const outgoingCheck = await this.antiSpam.checkMessageAllowed(userPhone, audioContent.content, true);
            if (!outgoingCheck.allowed) {
                this.logger.error(`🛡️ Outgoing audio blocked for ${userPhone}: ${outgoingCheck.reason}`);
                
                // If emergency brake or global limit, log critical error
                if (outgoingCheck.reason === 'emergency_brake' || outgoingCheck.reason.includes('global')) {
                    this.logger.error('🚨 CRITICAL: Global rate limit reached, stopping outgoing messages to prevent WhatsApp ban');
                }
                
                return; // Don't send the message
            }

            // Apply natural delay if suggested by anti-spam
            if (outgoingCheck.naturalDelay > 0) {
                this.logger.debug(`⏳ Applying natural delay: ${outgoingCheck.naturalDelay}ms for ${userPhone}`);
                await new Promise(resolve => setTimeout(resolve, outgoingCheck.naturalDelay));
            }

            // Log outgoing audio message
            this.logger.info(`🎵 Bot audio reply to ${userPhone}: ${audioContent.content.substring(0, 100)}${audioContent.content.length > 100 ? '...' : ''}`);
            
            // Read audio file
            const audioBuffer = fs.readFileSync(audioContent.audioPath);
            
            // Send audio message
            await this.sock.sendMessage(userJid, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: true, // Set as voice note
                quoted: originalMessage
            });

            // Send caption as follow-up text (optional)
            if (audioContent.caption && audioContent.caption !== audioContent.content) {
                setTimeout(async () => {
                    await this.sendTextReply(userJid, userPhone, audioContent.caption, originalMessage);
                }, 1000); // Small delay between audio and text
            }

            // Clean up audio file after sending
            setTimeout(() => {
                try {
                    if (fs.existsSync(audioContent.audioPath)) {
                        fs.unlinkSync(audioContent.audioPath);
                        this.logger.debug(`Cleaned up audio file: ${audioContent.audioPath}`);
                    }
                } catch (cleanupError) {
                    this.logger.warn(`Failed to cleanup audio file: ${cleanupError.message}`);
                }
            }, 5000); // Clean up after 5 seconds

        } catch (error) {
            this.logger.error(`Failed to send audio reply to ${userPhone}:`, error);
            
            // Fallback to text if audio sending fails
            const fallbackText = `${audioContent.content}\n\n_💬 Maaf, pengiriman suara gagal. Berikut respons dalam teks._`;
            await this.sendTextReply(userJid, userPhone, fallbackText, originalMessage);
            
            // Clean up audio file on error
            try {
                if (fs.existsSync(audioContent.audioPath)) {
                    fs.unlinkSync(audioContent.audioPath);
                }
            } catch (cleanupError) {
                this.logger.warn(`Failed to cleanup audio file on error: ${cleanupError.message}`);
            }
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

    setupPeriodicCleanup() {
        // Clean up expired pending transactions every 2 minutes
        setInterval(() => {
            try {
                const now = Date.now();
                let cleanedCount = 0;

                // Clean up pending transactions older than 3 minutes
                if (global.pendingTransactions) {
                    for (const [userPhone, transaction] of global.pendingTransactions.entries()) {
                        if (now - transaction.timestamp > 180000) { // 3 minutes
                            global.pendingTransactions.delete(userPhone);
                            cleanedCount++;
                        }
                    }
                }

                // Clean up edit sessions older than 10 minutes
                if (global.editSessions) {
                    for (const [userPhone, session] of global.editSessions.entries()) {
                        if (now - session.timestamp > 600000) { // 10 minutes
                            global.editSessions.delete(userPhone);
                            cleanedCount++;
                        }
                    }
                }

                // Clean up delete confirmations older than 5 minutes
                if (global.deleteConfirmations) {
                    for (const [userPhone, confirmation] of global.deleteConfirmations.entries()) {
                        if (now - confirmation.timestamp > 300000) { // 5 minutes
                            global.deleteConfirmations.delete(userPhone);
                            cleanedCount++;
                        }
                    }
                }

                // Clean up auto categorization suggestions older than 10 minutes
                if (global.autoCategorizationSuggestions) {
                    for (const [userPhone, suggestions] of global.autoCategorizationSuggestions.entries()) {
                        if (now - suggestions.timestamp > 600000) { // 10 minutes
                            global.autoCategorizationSuggestions.delete(userPhone);
                            cleanedCount++;
                        }
                    }
                }

                // Clean up typing manager expired states
                if (this.typingManager) {
                    this.typingManager.cleanupExpiredTyping();
                }

                // Clean up trial notification queue
                if (this.trialNotificationService) {
                    this.trialNotificationService.cleanupNotificationQueue();
                }

                if (cleanedCount > 0) {
                    this.logger.info(`🧹 Periodic cleanup: removed ${cleanedCount} expired sessions`);
                }
            } catch (error) {
                this.logger.error('Error during periodic cleanup:', error);
            }
        }, 120000); // Every 2 minutes

        this.logger.info('⏰ Periodic cleanup scheduler started (every 2 minutes)');
    }

    async shutdown() {
        this.logger.info('🛑 Shutting down bot...');
        
        try {
            // Stop all typing states
            if (this.typingManager) {
                await this.typingManager.stopAllTyping();
            }
            
            // Stop trial scheduler
            if (this.trialScheduler) {
                await this.trialScheduler.shutdown();
            }
            
            // Cleanup trial notification service
            if (this.trialNotificationService) {
                this.trialNotificationService.cleanupNotificationQueue();
                this.logger.info('✅ Trial notification service cleaned up');
            }
            
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

// Ensure single instance and prevent multiple startups
if (global.bot) {
    console.warn('⚠️ Bot instance already exists, preventing duplicate startup');
    process.exit(0);
}

// Start the bot
const bot = new WhatsAppFinancialBot();
global.bot = bot;
bot.initialize().catch(error => {
    console.error('Failed to start bot:', error);
    process.exit(1);
});
