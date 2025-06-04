#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Updating WhatsApp bot dependencies to use Baileys...');

try {
    // Remove old whatsapp-web.js if exists
    console.log('📦 Removing old whatsapp-web.js...');
    try {
        execSync('npm uninstall whatsapp-web.js', { stdio: 'inherit' });
    } catch (error) {
        console.log('ℹ️  whatsapp-web.js was not installed');
    }

    // Install new dependencies
    console.log('📦 Installing Baileys...');
    execSync('npm install @whiskeysockets/baileys@^6.7.8', { stdio: 'inherit' });
    
    // Fix sharp version conflict
    console.log('🔧 Fixing sharp version conflict with Baileys...');
    execSync('npm install sharp@^0.32.6', { stdio: 'inherit' });

    console.log('✅ Dependencies updated successfully!');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('1. Make sure your .env file is properly configured');
    console.log('2. Run: npm start');
    console.log('3. Scan the QR code with your WhatsApp');
    console.log('');
    console.log('📱 The bot now uses Baileys for better performance and stability!');

} catch (error) {
    console.error('❌ Error updating dependencies:', error.message);
    process.exit(1);
}