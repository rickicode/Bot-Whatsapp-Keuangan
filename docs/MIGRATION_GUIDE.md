# Database Migration Guide

This guide explains how to use the database migration system for the WhatsApp Financial Bot.

## Overview

The migration system provides safe and reliable ways to:
- Update database schema
- Reset database to fresh state (development only)
- Seed database with default data

## Available Commands

### NPM Scripts (Recommended)

```bash
# Run database migrations (safe - updates schema without data loss)
npm run migrate
npm run db:migrate

# Seed database with default data (safe - can run multiple times)
npm run migrate:seed
npm run db:seed

# Fresh migration - DROP ALL TABLES and recreate (⚠️ DESTRUCTIVE)
npm run migrate:fresh
npm run db:fresh

# Show help
npm run migrate:help
```

### Direct Script Usage

```bash
# Run migrations
node scripts/migrate.js migrate

# Seed database
node scripts/migrate.js seed

# Fresh migration (development only)
node scripts/migrate.js fresh

# Show help
node scripts/migrate.js help
```

## Migration Types

### 1. Regular Migration (`migrate`)
- **Safe**: Updates database schema without data loss
- **Purpose**: Add new tables, columns, indexes
- **When to use**: Production deployments, schema updates
- **Data safety**: ✅ Preserves existing data

```bash
npm run migrate
```

### 2. Database Seeding (`seed`)
- **Safe**: Adds default data (categories, subscription plans)
- **Purpose**: Populate database with required default data
- **When to use**: Initial setup, after fresh migration
- **Data safety**: ✅ Safe to run multiple times

```bash
npm run migrate:seed
```

### 3. Fresh Migration (`fresh`)
- **⚠️ DESTRUCTIVE**: Drops all tables and recreates them
- **Purpose**: Complete database reset for development
- **When to use**: Development only, testing, clean start
- **Data safety**: ❌ **ALL DATA WILL BE LOST**
- **Protection**: Disabled in production environments

```bash
# Only works in development/staging
NODE_ENV=development npm run migrate:fresh
```

## Database Types Supported

The migration system works with all supported database types:

- **SQLite3** (default for development)
- **PostgreSQL** (recommended for production)
- **Supabase** (PostgreSQL cloud)

## Environment Configuration

Set up your database configuration in `.env`:

### SQLite (Development)
```env
DATABASE_TYPE=sqlite3
DB_PATH=./data/financial.db
```

### PostgreSQL (Production)
```env
DATABASE_TYPE=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=financial_bot
DATABASE_USER=your_username
DATABASE_PASSWORD=your_password
```

### Supabase (Cloud)
```env
DATABASE_TYPE=supabase
SUPABASE_DB_URL=postgresql://postgres.xxx:password@aws-0-region.pooler.supabase.com:5432/postgres
```

## Common Workflows

### Initial Setup
```bash
# 1. Set up environment
cp .env.example .env
# Edit .env with your configuration

# 2. Install dependencies
npm install

# 3. Run migrations and seed data
npm run migrate
npm run migrate:seed

# 4. Start the application
npm start
```

### Development Reset
```bash
# Reset database completely (development only)
NODE_ENV=development npm run migrate:fresh

# Application will automatically run migrations on startup
npm run dev
```

### Production Deployment
```bash
# Safe schema updates only
npm run migrate

# Add default data if needed
npm run migrate:seed

# Start application
npm start
```

### Docker Environment
```bash
# Inside container
docker exec whatsapp-bot npm run migrate
docker exec whatsapp-bot npm run migrate:seed

# Fresh reset (development containers only)
docker exec whatsapp-bot sh -c "NODE_ENV=development npm run migrate:fresh"
```

## Safety Features

### Production Protection
- Fresh migrations are **disabled** in production
- Requires `NODE_ENV=development` or `NODE_ENV=staging`
- Prevents accidental data loss

### Error Handling
- Comprehensive error logging
- Graceful failure handling
- Database connection cleanup
- Transaction rollback on failures

### Data Validation
- Schema validation before migration
- Foreign key constraint handling
- Index creation with conflict resolution

## Troubleshooting

### Migration Fails
```bash
# Check database connectivity
npm run migrate:help

# Verify environment variables
echo $DATABASE_TYPE
echo $DB_PATH

# Check logs
tail -f logs/app.log
```

### Permission Issues
```bash
# Ensure proper file permissions
chmod +x scripts/migrate.js

# Check database file permissions (SQLite)
ls -la data/
```

### Connection Issues
```bash
# Test database connection
node -e "
const DatabaseManager = require('./src/database/DatabaseManager');
const db = new DatabaseManager();
db.initialize().then(() => {
  console.log('✅ Connection successful');
  process.exit(0);
}).catch(err => {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
});
"
```

## Schema Updates

When adding new features that require database changes:

1. **Update schema** in database classes:
   - `src/database/PostgresDatabase.js` - PostgreSQL tables
   - `src/database/SQLiteDatabase.js` - SQLite tables

2. **Test migration**:
   ```bash
   # Development environment
   NODE_ENV=development npm run migrate:fresh
   npm run migrate:seed
   ```

3. **Deploy to production**:
   ```bash
   # Production environment (safe)
   npm run migrate
   ```

## Default Data

The seeding process adds:

### Categories
- **Income**: Gaji, Freelance, Bisnis, Investasi, etc.
- **Expenses**: Makanan, Transportasi, Kesehatan, etc.

### Subscription Plans
- **Free Plan**: 50 transactions per day
- **Premium Plan**: Unlimited transactions

## Advanced Usage

### Custom Migration Scripts
Create custom migration scripts in `scripts/` directory:

```javascript
// scripts/custom-migration.js
const DatabaseManager = require('../src/database/DatabaseManager');

async function customMigration() {
    const db = new DatabaseManager();
    await db.initialize();
    
    // Your custom migration logic here
    
    await db.close();
}

customMigration().catch(console.error);
```

### Backup Before Migration
```bash
# Backup database before major changes
npm run backup

# Run migration
npm run migrate

# Restore if needed
# (restore from backup files in ./backups/)
```

## Support

For issues or questions:
1. Check the logs: `tail -f logs/app.log`
2. Verify environment configuration
3. Test database connectivity
4. Check Docker container status (if using Docker)

---

**⚠️ Important**: Always backup your database before running migrations in production!