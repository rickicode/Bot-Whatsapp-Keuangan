#!/usr/bin/env node

// Docker test script to verify configuration
const fs = require('fs');
const path = require('path');

console.log('🐳 Docker Configuration Test');
console.log('============================');

// Test 1: Environment Variables
console.log('\n1. Environment Variables:');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`   DATABASE_TYPE: ${process.env.DATABASE_TYPE || 'not set'}`);
console.log(`   PUPPETEER_EXECUTABLE_PATH: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'not set'}`);

// Test 2: File System Permissions
console.log('\n2. File System:');
try {
    // Test directory creation
    const testDir = './data/test';
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
        console.log('   ✅ Directory creation: OK');
        fs.rmSync(testDir, { recursive: true, force: true });
    } else {
        console.log('   ✅ Directory access: OK');
    }
} catch (error) {
    console.log('   ❌ File system error:', error.message);
}

// Test 3: Chromium Availability
console.log('\n3. Chromium:');
const chromiumPath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
if (fs.existsSync(chromiumPath)) {
    console.log(`   ✅ Chromium found at: ${chromiumPath}`);
} else {
    console.log(`   ❌ Chromium not found at: ${chromiumPath}`);
}

// Test 4: Required Files
console.log('\n4. Application Files:');
const requiredFiles = [
    './src/index.js',
    './package.json',
    './.env'
];

for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`   ✅ ${file}: Found`);
    } else {
        console.log(`   ❌ ${file}: Missing`);
    }
}

// Test 5: Database Connection Test
console.log('\n5. Database:');
try {
    const DatabaseManager = require('../src/database/DatabaseManager');
    console.log('   ✅ Database module: Loaded');
    
    // Quick connection test
    const dbManager = new DatabaseManager();
    dbManager.initialize().then(() => {
        console.log('   ✅ Database: Connection successful');
        dbManager.close();
    }).catch(error => {
        console.log('   ❌ Database: Connection failed -', error.message);
    });
    
} catch (error) {
    console.log('   ❌ Database module error:', error.message);
}

console.log('\n🎯 Test completed. Check results above.');