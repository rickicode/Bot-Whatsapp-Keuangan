#!/usr/bin/env node

/**
 * Database Migration Script
 * 
 * Usage:
 *   node scripts/migrate.js fresh        # Drop all tables and recreate (DESTRUCTIVE)
 *   node scripts/migrate.js migrate      # Run migrations (safe updates)
 *   node scripts/migrate.js seed         # Seed database with default data
 * 
 * Environment:
 *   Reads configuration from .env file or environment variables
 */

const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseManager = require('../src/database/DatabaseManager');
const Logger = require('../src/utils/Logger');

const logger = new Logger();

async function main() {
    const command = process.argv[2];
    
    if (!command) {
        console.log(`
🔧 Database Migration Tool

Usage:
  node scripts/migrate.js <command>

Commands:
  fresh     Drop all tables and recreate them (⚠️  DESTRUCTIVE - ALL DATA WILL BE LOST)
  migrate   Run database migrations (safe schema updates)
  seed      Seed database with default data
  help      Show this help message

Examples:
  node scripts/migrate.js fresh
  node scripts/migrate.js migrate
  node scripts/migrate.js seed
        `);
        process.exit(0);
    }

    const dbManager = new DatabaseManager();
    
    try {
        logger.info('🔧 Starting database migration tool...');
        logger.info(`📊 Database Type: ${process.env.DATABASE_TYPE || 'sqlite3'}`);
        logger.info(`📁 Database Path: ${process.env.DB_PATH || process.env.SUPABASE_DB_URL || 'Not specified'}`);
        
        // Initialize database connection
        await dbManager.initialize();
        logger.info('✅ Database connection established');

        switch (command.toLowerCase()) {
            case 'fresh':
                logger.warn('⚠️  FRESH MIGRATION WILL DROP ALL TABLES AND DATA!');
                logger.warn('⚠️  This action is IRREVERSIBLE!');
                
                // In production, require confirmation
                if (process.env.NODE_ENV === 'production') {
                    logger.error('❌ Fresh migration is disabled in production for safety');
                    logger.error('❌ Set NODE_ENV to development or staging to enable fresh migrations');
                    process.exit(1);
                }
                
                logger.info('🗑️  Starting fresh migration...');
                await dbManager.migrateFresh();
                logger.info('✅ Fresh migration completed successfully');
                break;

            case 'migrate':
                logger.info('📈 Running database migrations...');
                await dbManager.migrate();
                logger.info('✅ Migrations completed successfully');
                break;

            case 'seed':
                logger.info('🌱 Seeding database with default data...');
                await dbManager.seed();
                logger.info('✅ Database seeding completed successfully');
                break;

            case 'help':
                console.log(`
🔧 Database Migration Tool Help

Commands:
  fresh     - Drops ALL tables and recreates them from scratch
              ⚠️  WARNING: This will delete ALL data permanently!
              Only works in development/staging environments.
              
  migrate   - Runs database migrations to update schema
              This is safe and won't delete existing data.
              
  seed      - Inserts default data into the database
              This includes default categories and subscription plans.
              Safe to run multiple times.

Environment Variables:
  DATABASE_TYPE     - Database type (sqlite3, postgres, supabase)
  DB_PATH           - SQLite database file path
  SUPABASE_DB_URL   - Supabase connection string
  NODE_ENV          - Environment (development, production, staging)

Examples:
  # Safe operations:
  node scripts/migrate.js migrate
  node scripts/migrate.js seed
  
  # Destructive operation (development only):
  NODE_ENV=development node scripts/migrate.js fresh
                `);
                break;

            default:
                logger.error(`❌ Unknown command: ${command}`);
                logger.info('💡 Run "node scripts/migrate.js help" for available commands');
                process.exit(1);
        }

    } catch (error) {
        logger.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Close database connection
        try {
            await dbManager.close();
            logger.info('🔌 Database connection closed');
        } catch (closeError) {
            logger.warn('⚠️  Warning closing database connection:', closeError.message);
        }
    }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
    logger.info('\n🛑 Migration interrupted by user');
    process.exit(0);
});

process.on('SIGTERM', () => {
    logger.info('\n🛑 Migration terminated');
    process.exit(0);
});

// Run the main function
main().catch((error) => {
    logger.error('💥 Unexpected error:', error);
    process.exit(1);
});