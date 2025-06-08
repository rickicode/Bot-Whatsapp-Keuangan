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

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DatabaseFactory = require('../src/database/DatabaseFactory');
const Logger = require('../src/utils/Logger');

const logger = new Logger();
const readline = require('readline');

// Function to ask for user confirmation (3 times for dangerous operations)
async function askConfirmation(message, times = 3) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    for (let i = 1; i <= times; i++) {
        const question = `${message} (${i}/${times}) [Type "YES" to confirm]: `;
        
        const answer = await new Promise((resolve) => {
            rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });

        if (answer !== 'YES') {
            rl.close();
            logger.info('❌ Operation cancelled by user');
            process.exit(0);
        }

        if (i < times) {
            logger.warn(`⚠️  Confirmation ${i}/${times} completed. ${times - i} more confirmations required.`);
        }
    }

    rl.close();
    logger.info('✅ All confirmations completed. Proceeding with operation...');
    return true;
}

async function dropAllTables(db) {
    logger.info('🗑️  Dropping ALL tables in database...');
    
    try {
        // First, get ALL tables that exist in the database
        const result = await db.all(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY tablename
        `);
        
        const existingTables = result.map(row => row.tablename);
        
        if (existingTables.length === 0) {
            logger.info('ℹ️  No tables found in database');
            return;
        }
        
        logger.info(`📋 Found ${existingTables.length} tables: ${existingTables.join(', ')}`);
        logger.warn('⚠️  These tables and ALL their data will be permanently deleted!');
        
        // Final confirmation before actual deletion
        await askConfirmation(
            '🔥 FINAL WARNING: Proceed with deleting ALL these tables and data?',
            1
        );
        
        // Drop all tables with CASCADE to handle dependencies
        logger.info('🗑️  Dropping all tables with CASCADE...');
        for (const table of existingTables) {
            try {
                await db.run(`DROP TABLE IF EXISTS "${table}" CASCADE`);
                logger.info(`✅ Dropped table: ${table}`);
            } catch (error) {
                logger.warn(`⚠️  Warning dropping table ${table}:`, error.message);
            }
        }
        
        // Drop all sequences that might remain
        logger.info('🗑️  Dropping all sequences...');
        const sequences = await db.all(`
            SELECT sequencename
            FROM pg_sequences
            WHERE schemaname = 'public'
        `);
        
        for (const seq of sequences) {
            try {
                await db.run(`DROP SEQUENCE IF EXISTS "${seq.sequencename}" CASCADE`);
                logger.info(`✅ Dropped sequence: ${seq.sequencename}`);
            } catch (error) {
                logger.warn(`⚠️  Warning dropping sequence ${seq.sequencename}:`, error.message);
            }
        }
        
        // Drop all indexes that might remain
        logger.info('🗑️  Dropping all indexes...');
        const indexes = await db.all(`
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname NOT LIKE 'pg_%'
        `);
        
        for (const idx of indexes) {
            try {
                await db.run(`DROP INDEX IF EXISTS "${idx.indexname}" CASCADE`);
                logger.info(`✅ Dropped index: ${idx.indexname}`);
            } catch (error) {
                logger.warn(`⚠️  Warning dropping index ${idx.indexname}:`, error.message);
            }
        }
        
        // Verify all tables are dropped
        const remainingTables = await db.all(`
            SELECT tablename
            FROM pg_tables
            WHERE schemaname = 'public'
        `);
        
        const remainingSequences = await db.all(`
            SELECT sequencename
            FROM pg_sequences
            WHERE schemaname = 'public'
        `);
        
        if (remainingTables.length === 0 && remainingSequences.length === 0) {
            logger.info('✅ All tables, sequences, and indexes dropped successfully - Database is completely clean');
        } else {
            if (remainingTables.length > 0) {
                logger.warn(`⚠️  ${remainingTables.length} tables still exist: ${remainingTables.map(t => t.tablename).join(', ')}`);
            }
            if (remainingSequences.length > 0) {
                logger.warn(`⚠️  ${remainingSequences.length} sequences still exist: ${remainingSequences.map(s => s.sequencename).join(', ')}`);
            }
        }
        
    } catch (error) {
        logger.error('❌ Error during table dropping:', error);
        throw error;
    }
}

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

    let db = null;
    
    try {
        logger.info('🔧 Starting database migration tool...');
        logger.info(`📊 Database Type: PostgreSQL`);
        logger.info(`📁 Database Connection: ${process.env.SUPABASE_DB_URL ? 'Supabase' : 'Local PostgreSQL'}`);
        
        // Create database instance
        db = DatabaseFactory.create();
        await db.initialize();
        logger.info('✅ Database connection established');

        switch (command.toLowerCase()) {
            case 'fresh':
                logger.warn('⚠️  FRESH MIGRATION WILL DROP ALL TABLES AND DATA!');
                logger.warn('⚠️  This action is IRREVERSIBLE!');
                logger.warn('⚠️  ALL YOUR DATA WILL BE PERMANENTLY DELETED!');
                
                // In production, require confirmation
                if (process.env.NODE_ENV === 'production') {
                    logger.error('❌ Fresh migration is disabled in production for safety');
                    logger.error('❌ Set NODE_ENV to development or staging to enable fresh migrations');
                    process.exit(1);
                }
                
                // Require 3 confirmations for this dangerous operation
                logger.warn('🛑 This operation will PERMANENTLY DELETE ALL DATA in the database!');
                logger.warn('🛑 You will need to confirm this action 3 times to proceed.');
                
                await askConfirmation(
                    '🗑️  Do you really want to DROP ALL TABLES and DELETE ALL DATA?',
                    3
                );
                
                logger.info('🗑️  Starting fresh migration...');
                
                // Drop all tables
                await dropAllTables(db);
                
                // Create all tables
                await db.createTables();
                logger.info('✅ Tables created successfully');
                
                // Insert default data
                await db.insertDefaultCategories();
                logger.info('✅ Default categories inserted');
                
                await db.insertDefaultSubscriptionPlans();
                logger.info('✅ Default subscription plans inserted');
                
                logger.info('✅ Fresh migration completed successfully');
                break;

            case 'migrate':
                logger.info('📈 Running database migrations...');
                
                // Create tables (will skip if exists)
                await db.createTables();
                logger.info('✅ Database schema updated');
                
                logger.info('✅ Migrations completed successfully');
                break;

            case 'seed':
                logger.info('🌱 Seeding database with default data...');
                
                // Insert default data
                await db.insertDefaultCategories();
                logger.info('✅ Default categories seeded');
                
                await db.insertDefaultSubscriptionPlans();
                logger.info('✅ Default subscription plans seeded');
                
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
  SUPABASE_DB_URL       - Supabase connection string
  POSTGRES_HOST         - PostgreSQL host
  POSTGRES_PORT         - PostgreSQL port
  POSTGRES_DB           - PostgreSQL database name
  POSTGRES_USER         - PostgreSQL username
  POSTGRES_PASSWORD     - PostgreSQL password
  NODE_ENV              - Environment (development, production, staging)

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
        if (db) {
            try {
                await db.close();
                logger.info('🔌 Database connection closed');
            } catch (closeError) {
                logger.warn('⚠️  Warning closing database connection:', closeError.message);
            }
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