#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { Pool } = require('pg');
const DatabaseFactory = require('../src/database/DatabaseFactory');
const Logger = require('../src/utils/Logger');

class DatabaseMigrator {
    constructor() {
        this.logger = new Logger();
        this.migrationsPath = path.join(__dirname, 'migrations');
    }

    async run(command) {
        try {
            // Load environment variables
            require('dotenv').config();

            switch (command) {
                case 'fresh':
                    await this.migrateFresh();
                    break;
                case 'reset':
                    await this.reset();
                    break;
                case 'seed':
                    await this.seed();
                    break;
                case 'status':
                    await this.status();
                    break;
                default:
                    console.log(`
Usage: npm run migrate <command>

Commands:
  fresh     Drop all tables and recreate them with fresh data
  reset     Drop all tables and recreate them (no seed data)
  seed      Run seeders only
  status    Show current database status

Examples:
  npm run migrate fresh
  npm run migrate reset
  npm run migrate seed
  npm run migrate status
                    `);
            }
        } catch (error) {
            this.logger.error('Migration failed:', error);
            process.exit(1);
        }
    }

    async migrateFresh() {
        this.logger.info('🚀 Starting fresh migration...');
        
        // Drop all tables first
        await this.dropAllTables();
        
        // Create fresh database structure
        await this.createTables();
        
        // Run seeders
        await this.seed();
        
        this.logger.info('✅ Fresh migration completed successfully!');
    }

    async reset() {
        this.logger.info('🔄 Resetting database...');
        
        // Drop all tables
        await this.dropAllTables();
        
        // Create fresh database structure
        await this.createTables();
        
        this.logger.info('✅ Database reset completed successfully!');
    }

    async dropAllTables() {
        this.logger.info('🗑️  Dropping all tables...');
        
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';
        
        if (dbType === 'postgres' || dbType === 'postgresql' || dbType === 'supabase') {
            await this.dropPostgresTables();
        } else {
            await this.dropSQLiteTables();
        }
    }

    async dropPostgresTables() {
        let pool, client;
        try {
            const config = this.getPostgresConfig();
            pool = new Pool(config);
            client = await pool.connect();

            // Get all tables
            const result = await client.query(`
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                AND tablename NOT LIKE 'pg_%'
                AND tablename != 'information_schema'
            `);

            // Drop tables in correct order (to handle foreign keys)
            const dropOrder = [
                'ai_interactions',
                'whatsapp_sessions',
                'bills',
                'debts',
                'clients',
                'transactions',
                'categories',
                'settings',
                'users'
            ];

            for (const tableName of dropOrder) {
                try {
                    await client.query(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
                    this.logger.info(`  ✓ Dropped table: ${tableName}`);
                } catch (error) {
                    this.logger.warn(`  ⚠ Could not drop table ${tableName}:`, error.message);
                }
            }

            // Drop any remaining tables
            for (const row of result.rows) {
                if (!dropOrder.includes(row.tablename)) {
                    try {
                        await client.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
                        this.logger.info(`  ✓ Dropped remaining table: ${row.tablename}`);
                    } catch (error) {
                        this.logger.warn(`  ⚠ Could not drop table ${row.tablename}:`, error.message);
                    }
                }
            }

            // Drop functions
            await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');

        } catch (error) {
            this.logger.error('Error dropping PostgreSQL tables:', error);
            throw error;
        } finally {
            if (client) client.release();
            if (pool) await pool.end();
        }
    }

    async dropSQLiteTables() {
        const DatabaseManager = require('../src/database/DatabaseManager');
        const dbManager = new DatabaseManager();
        
        try {
            await dbManager.initialize();
            
            // Get all tables
            const tables = await dbManager.all(`
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                AND name NOT LIKE 'sqlite_%'
            `);

            // Drop tables
            for (const table of tables) {
                await dbManager.run(`DROP TABLE IF EXISTS ${table.name}`);
                this.logger.info(`  ✓ Dropped table: ${table.name}`);
            }
        } catch (error) {
            this.logger.error('Error dropping SQLite tables:', error);
            throw error;
        } finally {
            await dbManager.close();
        }
    }

    async createTables() {
        this.logger.info('📋 Creating database tables...');
        
        const DatabaseManager = require('../src/database/DatabaseManager');
        const dbManager = new DatabaseManager();
        
        try {
            await dbManager.initialize();
            this.logger.info('✅ Database tables created successfully!');
        } catch (error) {
            this.logger.error('Error creating tables:', error);
            throw error;
        } finally {
            await dbManager.close();
        }
    }

    async seed() {
        this.logger.info('🌱 Running database seeders...');
        
        // Create default user if needed
        await this.seedDefaultUser();
        
        this.logger.info('✅ Database seeding completed!');
    }

    async seedDefaultUser() {
        const DatabaseManager = require('../src/database/DatabaseManager');
        const dbManager = new DatabaseManager();
        
        try {
            await dbManager.initialize();
            
            // Check if default user exists
            const adminPhone = process.env.BOT_ADMIN_PHONE;
            if (adminPhone) {
                const existingUser = await dbManager.getUser(adminPhone);
                if (!existingUser) {
                    await dbManager.createUser(adminPhone, 'Admin Bot');
                    this.logger.info(`  ✓ Created admin user: ${adminPhone}`);
                } else {
                    this.logger.info(`  ℹ Admin user already exists: ${adminPhone}`);
                }
            }
        } catch (error) {
            this.logger.error('Error seeding default user:', error);
            throw error;
        } finally {
            await dbManager.close();
        }
    }

    async status() {
        this.logger.info('📊 Database Status:');
        
        const DatabaseManager = require('../src/database/DatabaseManager');
        const dbManager = new DatabaseManager();
        
        try {
            await dbManager.initialize();
            
            // Check tables and record counts
            const dbType = process.env.DATABASE_TYPE || 'sqlite3';
            this.logger.info(`  Database Type: ${dbType}`);
            
            const tables = ['users', 'categories', 'transactions', 'clients', 'debts', 'bills', 'settings', 'ai_interactions'];
            
            for (const table of tables) {
                try {
                    const result = await dbManager.get(`SELECT COUNT(*) as count FROM ${table}`);
                    this.logger.info(`  ${table}: ${result.count} records`);
                } catch (error) {
                    this.logger.warn(`  ${table}: Table not found or error - ${error.message}`);
                }
            }
            
        } catch (error) {
            this.logger.error('Error checking database status:', error);
            throw error;
        } finally {
            await dbManager.close();
        }
    }

    getPostgresConfig() {
        const dbType = process.env.DATABASE_TYPE || 'sqlite3';
        
        if (dbType.toLowerCase() === 'supabase') {
            // Supabase configuration
            const supabaseUrl = process.env.SUPABASE_DB_URL;
            if (!supabaseUrl) {
                throw new Error('Supabase requires SUPABASE_DB_URL to be set');
            }
            
            // Parse Supabase connection URL
            const url = new URL(supabaseUrl);
            return {
                host: url.hostname,
                port: parseInt(url.port) || 5432,
                database: url.pathname.slice(1),
                user: url.username,
                password: url.password,
                ssl: {
                    rejectUnauthorized: false
                }
            };
        } else {
            // Standard PostgreSQL configuration
            return {
                host: process.env.DB_HOST || process.env.DATABASE_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || process.env.DATABASE_PORT) || 5432,
                database: process.env.DB_NAME || process.env.DATABASE_NAME || 'financial_bot',
                user: process.env.DB_USER || process.env.DATABASE_USER,
                password: process.env.DB_PASSWORD || process.env.DATABASE_PASSWORD,
                ssl: (process.env.DB_SSL || process.env.DATABASE_SSL) === 'true'
            };
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    const command = process.argv[2];
    const migrator = new DatabaseMigrator();
    migrator.run(command);
}

module.exports = DatabaseMigrator;