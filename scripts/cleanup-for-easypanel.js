#!/usr/bin/env node

// Cleanup script for EasyPanel deployment
const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up files for EasyPanel deployment...\n');

// Files to remove (not needed for EasyPanel)
const filesToRemove = [
  // Multi-container Docker files
  'docker-compose.yml',
  'docker-compose.dev.yml', 
  'docker-compose.lightweight.yml',
  'docker-compose.serverless.yml',
  'Dockerfile.tools',
  'Dockerfile',
  
  // Platform-specific files
  '.buildpacks',
  'Aptfile',
  'Procfile',
  'project.toml',
  'nixpacks.toml',
  'app.json',
  'railway.toml',
  
  // PostgreSQL related files (using Supabase)
  'scripts/init-db.sql',
  'scripts/test-postgres-pool.js',
  'scripts/monitor-database-pool.js',
  
  // VPS specific scripts
  'scripts/docker-manager.sh',
  'scripts/test-docker-setup.sh',
  'scripts/docker-init.js',
  'scripts/test-docker.js',
  'scripts/start.sh',
  
  // Old setup/migration files
  'scripts/migrate-registration.js',
  'scripts/registration-schema.sql',
  'scripts/setup-database.js',
  'scripts/setup.js',
  'scripts/migrate-daily-limits.js',
  'scripts/fresh-daily-setup.js',
  'scripts/migrate.js',
  
  // Test files
  'test-admin-features.js',
  'test-ai-features.js',
  'test-ai-providers.js',
  'test-complete-registration.js',
  'test-daily-limits.js',
  'test-debug-count.js',
  'test-debug-email.js',
  'test-email-validation.js',
  'test-final-registration.js',
  'test-integrated-qr.js',
  'test-laporan-tanggal.js',
  'test-registration.js',
  'test-step-by-step-registration.js',
  'fix-registration-error.js',
  'update-subscription-limits.js',
  
  // Unnecessary documentation
  'docs/DOCKER_DEPLOYMENT.md',
  'docs/LIGHTWEIGHT_DEPLOYMENT.md',
  'docs/DATABASE_OPTIMIZATION.md',
  'docs/DEBUGGING_MESSAGE_LOOP.md'
];

// Directories to remove
const dirsToRemove = [
  '.platform'
];

let removedCount = 0;

// Remove files
filesToRemove.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Removed: ${file}`);
      removedCount++;
    } else {
      console.log(`⚠️  Not found: ${file}`);
    }
  } catch (error) {
    console.log(`❌ Error removing ${file}: ${error.message}`);
  }
});

// Remove directories
dirsToRemove.forEach(dir => {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`✅ Removed directory: ${dir}`);
      removedCount++;
    } else {
      console.log(`⚠️  Directory not found: ${dir}`);
    }
  } catch (error) {
    console.log(`❌ Error removing directory ${dir}: ${error.message}`);
  }
});

console.log(`\n🎯 Cleanup completed! Removed ${removedCount} files/directories.`);
console.log('\n📋 Remaining files optimized for EasyPanel:');
console.log('   ✅ Dockerfile.easypanel (main container)');
console.log('   ✅ docker-compose.easypanel.yml (minimal compose)');
console.log('   ✅ Core application files only');
console.log('   ✅ Essential scripts only');
console.log('\n🚀 Ready for EasyPanel deployment with Supabase!');

// Show final file structure
console.log('\n📁 Final structure for EasyPanel:');
console.log('├── Dockerfile.easypanel');
console.log('├── docker-compose.easypanel.yml');
console.log('├── package.json');
console.log('├── .env.example');
console.log('├── src/ (application code)');
console.log('├── scripts/ (essential scripts only)');
console.log('└── docs/ (minimal documentation)');