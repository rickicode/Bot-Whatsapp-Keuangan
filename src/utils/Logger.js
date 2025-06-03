const fs = require('fs-extra');
const path = require('path');

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logFile = process.env.LOG_FILE || './logs/app.log';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.ensureLogDirectory();
    }

    async ensureLogDirectory() {
        try {
            const logDir = path.dirname(this.logFile);
            await fs.ensureDir(logDir);
        } catch (error) {
            console.error('Failed to create log directory:', error);
        }
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const pid = process.pid;
        let logMessage = `[${timestamp}] [${pid}] [${level.toUpperCase()}] ${message}`;
        
        if (data) {
            logMessage += ' ' + (typeof data === 'object' ? JSON.stringify(data) : data);
        }
        
        return logMessage;
    }

    async writeToFile(message) {
        try {
            await fs.appendFile(this.logFile, message + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    error(message, data = null) {
        if (this.shouldLog('error')) {
            const formattedMessage = this.formatMessage('error', message, data);
            console.error(formattedMessage);
            this.writeToFile(formattedMessage);
        }
    }

    warn(message, data = null) {
        if (this.shouldLog('warn')) {
            const formattedMessage = this.formatMessage('warn', message, data);
            console.warn(formattedMessage);
            this.writeToFile(formattedMessage);
        }
    }

    info(message, data = null) {
        if (this.shouldLog('info')) {
            const formattedMessage = this.formatMessage('info', message, data);
            console.log(formattedMessage);
            this.writeToFile(formattedMessage);
        }
    }

    debug(message, data = null) {
        if (this.shouldLog('debug')) {
            const formattedMessage = this.formatMessage('debug', message, data);
            console.log(formattedMessage);
            this.writeToFile(formattedMessage);
        }
    }

    // Clean old log files (keep last 30 days)
    async cleanOldLogs() {
        try {
            const logDir = path.dirname(this.logFile);
            const files = await fs.readdir(logDir);
            const logFiles = files.filter(file => file.endsWith('.log'));
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            for (const file of logFiles) {
                const filePath = path.join(logDir, file);
                const stats = await fs.stat(filePath);
                
                if (stats.mtime < thirtyDaysAgo) {
                    await fs.unlink(filePath);
                    this.info(`Deleted old log file: ${file}`);
                }
            }
        } catch (error) {
            this.error('Failed to clean old logs:', error);
        }
    }

    // Rotate log file when it gets too large (>10MB)
    async rotateLogIfNeeded() {
        try {
            if (await fs.pathExists(this.logFile)) {
                const stats = await fs.stat(this.logFile);
                const maxSize = 10 * 1024 * 1024; // 10MB
                
                if (stats.size > maxSize) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const rotatedFile = this.logFile.replace('.log', `_${timestamp}.log`);
                    
                    await fs.move(this.logFile, rotatedFile);
                    this.info(`Log file rotated to: ${rotatedFile}`);
                }
            }
        } catch (error) {
            console.error('Failed to rotate log file:', error);
        }
    }
}

module.exports = Logger;