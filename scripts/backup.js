require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const DatabaseManager = require('../src/database/DatabaseManager');
const Logger = require('../src/utils/Logger');

async function backup() {
    const logger = new Logger();
    
    try {
        console.log('💾 Starting backup process...\n');
        
        // Initialize database
        const db = new DatabaseManager();
        await db.initialize();
        
        // Create backup
        const backupPath = await db.backup();
        console.log(`✅ Database backup created: ${backupPath}`);
        
        // Export data as CSV for additional backup
        console.log('📊 Exporting transaction data...');
        
        const users = await db.all('SELECT DISTINCT user_phone FROM transactions');
        
        for (const user of users) {
            try {
                const transactions = await db.all(`
                    SELECT 
                        t.id,
                        t.date,
                        t.type,
                        t.amount,
                        t.description,
                        c.name as category_name,
                        t.created_at
                    FROM transactions t
                    LEFT JOIN categories c ON t.category_id = c.id
                    WHERE t.user_phone = ?
                    ORDER BY t.date DESC
                `, [user.user_phone]);
                
                if (transactions.length > 0) {
                    // Create CSV content
                    const csvHeader = 'ID,Date,Type,Amount,Description,Category,Created At\n';
                    const csvRows = transactions.map(t => 
                        `${t.id},"${t.date}","${t.type}",${t.amount},"${t.description}","${t.category_name || ''}","${t.created_at}"`
                    ).join('\n');
                    
                    const csvContent = csvHeader + csvRows;
                    
                    // Save CSV file
                    const sanitizedPhone = user.user_phone.replace(/[^0-9]/g, '');
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const csvPath = path.join(process.env.BACKUP_PATH || './backups', `transactions_${sanitizedPhone}_${timestamp}.csv`);
                    
                    await fs.writeFile(csvPath, csvContent);
                    console.log(`  ✅ CSV exported for ${user.user_phone}: ${csvPath}`);
                }
            } catch (error) {
                console.log(`  ❌ Failed to export CSV for ${user.user_phone}:`, error.message);
            }
        }
        
        // Clean old backups (keep last 30 files)
        console.log('\n🧹 Cleaning old backups...');
        await cleanOldBackups();
        
        // Backup logs
        console.log('📄 Backing up logs...');
        await backupLogs();
        
        await db.close();
        
        console.log('\n✅ Backup process completed successfully!');
        logger.info('Manual backup completed successfully');
        
    } catch (error) {
        console.error('❌ Backup failed:', error);
        const logger = new Logger();
        logger.error('Manual backup failed:', error);
        process.exit(1);
    }
}

async function cleanOldBackups() {
    try {
        const backupDir = process.env.BACKUP_PATH || './backups';
        
        if (!await fs.pathExists(backupDir)) {
            return;
        }
        
        const files = await fs.readdir(backupDir);
        const backupFiles = files
            .filter(file => file.startsWith('financial_backup_') && file.endsWith('.db'))
            .map(file => ({
                name: file,
                path: path.join(backupDir, file),
                stat: fs.statSync(path.join(backupDir, file))
            }))
            .sort((a, b) => b.stat.mtime - a.stat.mtime);
        
        // Keep last 30 backup files
        const filesToDelete = backupFiles.slice(30);
        
        for (const file of filesToDelete) {
            await fs.unlink(file.path);
            console.log(`  🗑️ Deleted old backup: ${file.name}`);
        }
        
        if (filesToDelete.length === 0) {
            console.log('  ✅ No old backups to clean');
        }
        
    } catch (error) {
        console.log('  ⚠️ Failed to clean old backups:', error.message);
    }
}

async function backupLogs() {
    try {
        const logFile = process.env.LOG_FILE || './logs/app.log';
        
        if (!await fs.pathExists(logFile)) {
            console.log('  ✅ No log file to backup');
            return;
        }
        
        const backupDir = process.env.BACKUP_PATH || './backups';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logBackupPath = path.join(backupDir, `app_log_${timestamp}.log`);
        
        await fs.copy(logFile, logBackupPath);
        console.log(`  ✅ Log file backed up: ${logBackupPath}`);
        
    } catch (error) {
        console.log('  ⚠️ Failed to backup logs:', error.message);
    }
}

async function restoreFromBackup(backupPath) {
    const logger = new Logger();
    
    try {
        console.log(`🔄 Restoring from backup: ${backupPath}\n`);
        
        if (!await fs.pathExists(backupPath)) {
            throw new Error('Backup file not found');
        }
        
        // Create backup of current database before restore
        const db = new DatabaseManager();
        await db.initialize();
        
        console.log('💾 Creating backup of current database...');
        const currentBackup = await db.backup();
        console.log(`✅ Current database backed up to: ${currentBackup}`);
        
        await db.close();
        
        // Restore from backup
        const dbPath = process.env.DB_PATH || './data/financial.db';
        await fs.copy(backupPath, dbPath);
        
        console.log('✅ Database restored successfully!');
        logger.info(`Database restored from backup: ${backupPath}`);
        
    } catch (error) {
        console.error('❌ Restore failed:', error);
        logger.error('Database restore failed:', error);
        throw error;
    }
}

// CLI handling
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'restore' && args[1]) {
        restoreFromBackup(args[1]).catch(console.error);
    } else if (command === 'restore') {
        console.log('Usage: node scripts/backup.js restore <backup-file-path>');
        process.exit(1);
    } else {
        backup().catch(console.error);
    }
}

module.exports = { backup, restoreFromBackup, cleanOldBackups };