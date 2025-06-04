#!/usr/bin/env node

/**
 * Test Script untuk WhatsApp Financial Bot API
 * Script ini memudahkan testing berbagai endpoint API
 */

const axios = require('axios');
require('dotenv').config();

class APITester {
    constructor(baseUrl = 'http://localhost:3000', apiKey = process.env.API_KEY) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.headers = {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
        };
    }

    log(message, data = null) {
        console.log(`\n🔍 ${message}`);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    error(message, error) {
        console.error(`\n❌ ${message}`);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }

    success(message, data) {
        console.log(`\n✅ ${message}`);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    async testConnection() {
        try {
            this.log('Testing API Connection...');
            const response = await axios.get(`${this.baseUrl}/api/test`, {
                headers: this.headers
            });
            this.success('API Connection Test Passed', response.data);
            return true;
        } catch (error) {
            this.error('API Connection Test Failed', error);
            return false;
        }
    }

    async testSendMessage(phoneNumber, message) {
        try {
            this.log(`Sending message to ${phoneNumber}...`);
            const response = await axios.post(`${this.baseUrl}/api/send-message`, {
                phoneNumber,
                message
            }, {
                headers: this.headers
            });
            this.success('Message Sent Successfully', response.data);
            return response.data;
        } catch (error) {
            this.error('Send Message Failed', error);
            return null;
        }
    }

    async testBroadcast(phoneNumbers, message) {
        try {
            this.log(`Sending broadcast to ${phoneNumbers.length} recipients...`);
            const response = await axios.post(`${this.baseUrl}/api/send-broadcast`, {
                phoneNumbers,
                message,
                options: { delay: 1000 }
            }, {
                headers: this.headers
            });
            this.success('Broadcast Sent Successfully', response.data);
            return response.data;
        } catch (error) {
            this.error('Broadcast Failed', error);
            return null;
        }
    }

    async testWebhook(event, data) {
        try {
            this.log(`Testing webhook event: ${event}...`);
            const response = await axios.post(`${this.baseUrl}/api/webhook`, {
                event,
                data
            }, {
                headers: this.headers
            });
            this.success('Webhook Processed Successfully', response.data);
            return response.data;
        } catch (error) {
            this.error('Webhook Processing Failed', error);
            return null;
        }
    }

    async testGetHistory(filters = {}) {
        try {
            this.log('Getting message history...');
            const queryParams = new URLSearchParams(filters).toString();
            const url = `${this.baseUrl}/api/message-history${queryParams ? '?' + queryParams : ''}`;
            
            const response = await axios.get(url, {
                headers: this.headers
            });
            this.success('Message History Retrieved', response.data);
            return response.data;
        } catch (error) {
            this.error('Get History Failed', error);
            return null;
        }
    }

    async testGetStats() {
        try {
            this.log('Getting API statistics...');
            const response = await axios.get(`${this.baseUrl}/api/stats`, {
                headers: this.headers
            });
            this.success('API Statistics Retrieved', response.data);
            return response.data;
        } catch (error) {
            this.error('Get Stats Failed', error);
            return null;
        }
    }

    async testHealthCheck() {
        try {
            this.log('Checking application health...');
            const response = await axios.get(`${this.baseUrl}/health`);
            this.success('Health Check Passed', response.data);
            return response.data;
        } catch (error) {
            this.error('Health Check Failed', error);
            return null;
        }
    }

    async runFullTest(testPhoneNumber) {
        console.log('🚀 Starting WhatsApp Financial Bot API Tests');
        console.log('=' * 50);

        if (!this.apiKey) {
            console.error('❌ API_KEY not found in environment variables');
            console.log('Please set API_KEY in your .env file or environment');
            return false;
        }

        if (!testPhoneNumber) {
            console.error('❌ Test phone number not provided');
            console.log('Usage: node scripts/test-api.js <phone_number>');
            return false;
        }

        let allTestsPassed = true;

        // Test 1: Health Check
        console.log('\n📊 Test 1: Health Check');
        const healthResult = await this.testHealthCheck();
        if (!healthResult) allTestsPassed = false;

        // Test 2: API Connection
        console.log('\n🔌 Test 2: API Connection');
        const connectionResult = await this.testConnection();
        if (!connectionResult) allTestsPassed = false;

        // Test 3: Send Single Message
        console.log('\n📱 Test 3: Send Single Message');
        const messageResult = await this.testSendMessage(
            testPhoneNumber,
            '🧪 Test message from API! Pesan test dari API WhatsApp Bot.'
        );
        if (!messageResult) allTestsPassed = false;

        // Test 4: Webhook - Payment Notification
        console.log('\n💳 Test 4: Webhook - Payment Notification');
        const paymentWebhook = await this.testWebhook('payment_notification', {
            phoneNumber: testPhoneNumber,
            amount: 100000,
            status: 'success',
            transactionId: 'TEST_' + Date.now(),
            paymentMethod: 'bank_transfer',
            description: 'Test payment notification'
        });
        if (!paymentWebhook) allTestsPassed = false;

        // Test 5: Webhook - Reminder Trigger
        console.log('\n⏰ Test 5: Webhook - Reminder Trigger');
        const reminderWebhook = await this.testWebhook('reminder_trigger', {
            phoneNumber: testPhoneNumber,
            reminderText: 'Test reminder: Jangan lupa bayar tagihan listrik!',
            type: 'monthly',
            category: 'bills'
        });
        if (!reminderWebhook) allTestsPassed = false;

        // Test 6: Get API Statistics
        console.log('\n📊 Test 6: API Statistics');
        const statsResult = await this.testGetStats();
        if (!statsResult) allTestsPassed = false;

        // Test 7: Get Message History
        console.log('\n📜 Test 7: Message History');
        const historyResult = await this.testGetHistory({ limit: 5 });
        if (!historyResult) allTestsPassed = false;

        // Test 8: Broadcast (optional, only if multiple numbers provided)
        const testNumbers = testPhoneNumber.split(',');
        if (testNumbers.length > 1) {
            console.log('\n📢 Test 8: Broadcast Message');
            const broadcastResult = await this.testBroadcast(
                testNumbers,
                '📡 Test broadcast message from API!'
            );
            if (!broadcastResult) allTestsPassed = false;
        } else {
            console.log('\n📢 Test 8: Broadcast Message (Skipped - single number)');
        }

        // Summary
        console.log('\n' + '='.repeat(50));
        if (allTestsPassed) {
            console.log('🎉 All tests passed successfully!');
            console.log('✅ WhatsApp Financial Bot API is working correctly');
        } else {
            console.log('⚠️  Some tests failed');
            console.log('Please check the error messages above');
        }

        console.log('\n📚 Next Steps:');
        console.log('1. Check message history: GET /api/message-history');
        console.log('2. Monitor API stats: GET /api/stats');
        console.log('3. Implement webhooks in your application');
        console.log('4. Read full documentation: docs/API_DOCUMENTATION.md');

        return allTestsPassed;
    }
}

// CLI Usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const command = args[0];
    const phoneNumber = args[1];
    const message = args[2];

    const tester = new APITester();

    switch (command) {
        case 'test':
            if (!phoneNumber) {
                console.error('Usage: node scripts/test-api.js test <phone_number>');
                process.exit(1);
            }
            tester.runFullTest(phoneNumber);
            break;

        case 'health':
            tester.testHealthCheck();
            break;

        case 'connect':
            tester.testConnection();
            break;

        case 'send':
            if (!phoneNumber || !message) {
                console.error('Usage: node scripts/test-api.js send <phone_number> <message>');
                process.exit(1);
            }
            tester.testSendMessage(phoneNumber, message);
            break;

        case 'stats':
            tester.testGetStats();
            break;

        case 'history':
            tester.testGetHistory({ limit: 10 });
            break;

        case 'webhook-payment':
            if (!phoneNumber) {
                console.error('Usage: node scripts/test-api.js webhook-payment <phone_number>');
                process.exit(1);
            }
            tester.testWebhook('payment_notification', {
                phoneNumber,
                amount: 150000,
                status: 'success',
                transactionId: 'TEST_' + Date.now()
            });
            break;

        case 'webhook-reminder':
            if (!phoneNumber) {
                console.error('Usage: node scripts/test-api.js webhook-reminder <phone_number>');
                process.exit(1);
            }
            tester.testWebhook('reminder_trigger', {
                phoneNumber,
                reminderText: 'Test reminder dari API!',
                type: 'daily'
            });
            break;

        default:
            console.log('🧪 WhatsApp Financial Bot API Tester');
            console.log('');
            console.log('Usage:');
            console.log('  node scripts/test-api.js test <phone_number>           # Run full test suite');
            console.log('  node scripts/test-api.js health                        # Health check');
            console.log('  node scripts/test-api.js connect                       # Test API connection');
            console.log('  node scripts/test-api.js send <phone> <message>        # Send message');
            console.log('  node scripts/test-api.js stats                         # Get API stats');
            console.log('  node scripts/test-api.js history                       # Get message history');
            console.log('  node scripts/test-api.js webhook-payment <phone>       # Test payment webhook');
            console.log('  node scripts/test-api.js webhook-reminder <phone>      # Test reminder webhook');
            console.log('');
            console.log('Examples:');
            console.log('  node scripts/test-api.js test 6281234567890');
            console.log('  node scripts/test-api.js send 6281234567890 "Hello from API!"');
            console.log('  node scripts/test-api.js webhook-payment 6281234567890');
            console.log('');
            console.log('Environment Variables:');
            console.log('  API_KEY=your_api_key_here     # Required');
            console.log('  BASE_URL=http://localhost:3000 # Optional');
            break;
    }
}

module.exports = APITester;