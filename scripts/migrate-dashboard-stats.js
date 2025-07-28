const DatabaseManager = require('../src/database/DatabaseManager');
const Logger = require('../src/utils/Logger');

const logger = new Logger();

async function migrateDashboardStats() {
    const db = new DatabaseManager();
    
    try {
        logger.info('🚀 Starting dashboard statistics migration...');
        
        await db.initialize();
        
        // 1. Dashboard Stats Table - for storing daily/monthly aggregated statistics
        await db.run(`
            CREATE TABLE IF NOT EXISTS dashboard_stats (
                id SERIAL PRIMARY KEY,
                stat_date DATE NOT NULL,
                stat_type VARCHAR(50) NOT NULL,
                metric_name VARCHAR(100) NOT NULL,
                metric_value NUMERIC(15,2) DEFAULT 0,
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(stat_date, stat_type, metric_name)
            )
        `);
        
        // 2. Message Logs Table - for tracking all WhatsApp messages
        await db.run(`
            CREATE TABLE IF NOT EXISTS message_logs (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20) NOT NULL,
                message_type VARCHAR(20) CHECK(message_type IN ('incoming', 'outgoing')) NOT NULL,
                message_content TEXT,
                message_length INTEGER DEFAULT 0,
                success BOOLEAN DEFAULT true,
                error_message TEXT,
                processing_time INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message_date DATE DEFAULT CURRENT_DATE
            )
        `);
        
        // 3. API Usage Logs Table - for tracking REST API usage
        await db.run(`
            CREATE TABLE IF NOT EXISTS api_usage_logs (
                id SERIAL PRIMARY KEY,
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                api_key_used VARCHAR(100),
                request_ip VARCHAR(45),
                response_status INTEGER,
                response_time INTEGER,
                success BOOLEAN DEFAULT true,
                error_message TEXT,
                request_size INTEGER DEFAULT 0,
                response_size INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                request_date DATE DEFAULT CURRENT_DATE
            )
        `);
        
        // 4. System Metrics Table - for storing system health metrics
        await db.run(`
            CREATE TABLE IF NOT EXISTS system_metrics (
                id SERIAL PRIMARY KEY,
                metric_type VARCHAR(50) NOT NULL,
                metric_name VARCHAR(100) NOT NULL,
                metric_value NUMERIC(15,4),
                metric_unit VARCHAR(20),
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metric_date DATE DEFAULT CURRENT_DATE
            )
        `);
        
        // 5. Activity Logs Table - for general activity logging
        await db.run(`
            CREATE TABLE IF NOT EXISTS activity_logs (
                id SERIAL PRIMARY KEY,
                user_phone VARCHAR(20),
                activity_type VARCHAR(50) NOT NULL,
                activity_description TEXT NOT NULL,
                log_level VARCHAR(10) CHECK(log_level IN ('error', 'warn', 'info', 'debug')) DEFAULT 'info',
                source VARCHAR(50) DEFAULT 'system',
                metadata JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                activity_date DATE DEFAULT CURRENT_DATE
            )
        `);
        
        // 6. WhatsApp Metrics Table - for specific WhatsApp metrics
        await db.run(`
            CREATE TABLE IF NOT EXISTS whatsapp_metrics (
                id SERIAL PRIMARY KEY,
                metric_date DATE DEFAULT CURRENT_DATE,
                messages_sent INTEGER DEFAULT 0,
                messages_received INTEGER DEFAULT 0,
                messages_failed INTEGER DEFAULT 0,
                spam_blocked INTEGER DEFAULT 0,
                connection_uptime INTEGER DEFAULT 0,
                qr_generated INTEGER DEFAULT 0,
                session_restarts INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(metric_date)
            )
        `);
        
        // Create indexes for performance
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_dashboard_stats_date_type ON dashboard_stats(stat_date, stat_type)',
            'CREATE INDEX IF NOT EXISTS idx_message_logs_date_type ON message_logs(message_date, message_type)',
            'CREATE INDEX IF NOT EXISTS idx_message_logs_user_phone ON message_logs(user_phone)',
            'CREATE INDEX IF NOT EXISTS idx_api_usage_logs_date ON api_usage_logs(request_date)',
            'CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint)',
            'CREATE INDEX IF NOT EXISTS idx_system_metrics_date_type ON system_metrics(metric_date, metric_type)',
            'CREATE INDEX IF NOT EXISTS idx_activity_logs_date_level ON activity_logs(activity_date, log_level)',
            'CREATE INDEX IF NOT EXISTS idx_activity_logs_source ON activity_logs(source)',
            'CREATE INDEX IF NOT EXISTS idx_whatsapp_metrics_date ON whatsapp_metrics(metric_date)'
        ];
        
        for (const index of indexes) {
            try {
                await db.run(index);
            } catch (error) {
                if (!error.message.includes('already exists')) {
                    logger.warn(`Index creation warning: ${error.message}`);
                }
            }
        }
        
        // Create triggers for updated_at
        await db.run(`
            CREATE OR REPLACE FUNCTION update_dashboard_stats_updated_at()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);
        
        // Apply triggers
        const triggers = [
            'CREATE TRIGGER update_dashboard_stats_trigger BEFORE UPDATE ON dashboard_stats FOR EACH ROW EXECUTE FUNCTION update_dashboard_stats_updated_at()',
            'CREATE TRIGGER update_whatsapp_metrics_trigger BEFORE UPDATE ON whatsapp_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
        ];
        
        for (const trigger of triggers) {
            try {
                await db.run(trigger);
            } catch (error) {
                if (!error.message.includes('already exists')) {
                    logger.warn(`Trigger creation warning: ${error.message}`);
                }
            }
        }
        
        // Initialize today's WhatsApp metrics
        await db.run(`
            INSERT INTO whatsapp_metrics (metric_date) 
            VALUES (CURRENT_DATE)
            ON CONFLICT (metric_date) DO NOTHING
        `);
        
        logger.info('✅ Dashboard statistics tables created successfully');
        logger.info('✅ Indexes and triggers applied');
        logger.info('✅ Initial data inserted');
        
        await db.close();
        
        logger.info('🎉 Dashboard statistics migration completed successfully!');
        
    } catch (error) {
        logger.error('❌ Error during dashboard statistics migration:', error);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    migrateDashboardStats().then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Migration failed:', error);
        process.exit(1);
    });
}

module.exports = migrateDashboardStats;
