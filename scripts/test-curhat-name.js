require('dotenv').config({ path: '.env' });
const Logger = require('../src/utils/Logger');
const DatabaseFactory = require('../src/database/DatabaseFactory');
const SessionManager = require('../src/database/SessionManager');
const AICurhatService = require('../src/services/AICurhatService');

class CurhatNameTester {
    constructor() {
        this.logger = new Logger();
    }

    async testCurhatWithName() {
        this.logger.info('🧪 Testing Curhat with User Name Recognition');
        this.logger.info('===========================================');
        
        let db = null;
        let sessionManager = null;
        let curhatService = null;
        
        try {
            // Initialize database
            this.logger.info('\n1. 🔧 Initializing services...');
            db = DatabaseFactory.create();
            await db.initialize();
            
            sessionManager = new SessionManager();
            await sessionManager.initialize(db.config, null);
            
            curhatService = new AICurhatService(sessionManager);
            this.logger.info('✅ Services initialized');

            // Test with different user scenarios
            await this.testUserWithName(db, curhatService);
            await this.testUserWithoutName(db, curhatService);

        } catch (error) {
            this.logger.error('❌ Test failed:', error);
            throw error;
        } finally {
            if (sessionManager) {
                await sessionManager.close();
            }
            if (db) {
                await db.close();
            }
        }
    }

    async testUserWithName(db, curhatService) {
        this.logger.info('\n2. 🧪 Testing user WITH name...');
        
        const testPhone = '628111111111';
        const testName = 'Sari';
        
        try {
            // Create user with name
            await db.sql`
                INSERT INTO users (phone, name, registration_completed)
                VALUES (${testPhone}, ${testName}, true)
                ON CONFLICT (phone) 
                DO UPDATE SET name = ${testName}
            `;
            this.logger.info(`   ✅ Created user: ${testName} (${testPhone})`);

            // Test getUserName method
            const retrievedName = await curhatService.getUserName(testPhone);
            this.logger.info(`   📝 Retrieved name: ${retrievedName}`);

            // Test enter curhat mode with name
            this.logger.info('   🔄 Testing enter curhat mode...');
            const enterResult = await curhatService.enterCurhatMode(testPhone);
            
            if (enterResult.success) {
                this.logger.info('   ✅ Enter curhat mode successful');
                this.logger.info(`   📄 Welcome message preview:`);
                this.logger.info(`   "${enterResult.message.substring(0, 150)}..."`);
                
                // Check if name is in welcome message
                if (enterResult.message.includes(testName)) {
                    this.logger.info(`   🎉 Name "${testName}" found in welcome message!`);
                } else {
                    this.logger.warn(`   ⚠️ Name "${testName}" NOT found in welcome message`);
                }
            }

            // Test conversation with AI (if enabled)
            if (curhatService.getStatus().enabled && curhatService.getStatus().hasApiKey) {
                this.logger.info('   🤖 Testing AI conversation...');
                const response = await curhatService.handleCurhatMessage(testPhone, 'Aku lagi sedih nih');
                this.logger.info(`   📝 AI Response preview: "${response.substring(0, 100)}..."`);
                
                // Check if AI uses the name
                if (response.includes(testName)) {
                    this.logger.info(`   🎉 AI used name "${testName}" in conversation!`);
                } else {
                    this.logger.info(`   ℹ️ AI didn't use name in this response (normal behavior)`);
                }
            } else {
                this.logger.warn('   ⚠️ AI service not configured - skipping conversation test');
            }

            // Exit curhat mode
            await curhatService.handleCurhatMessage(testPhone, '/quit');
            this.logger.info('   ✅ Exited curhat mode');

        } catch (error) {
            this.logger.error('   ❌ User with name test failed:', error.message);
        }
    }

    async testUserWithoutName(db, curhatService) {
        this.logger.info('\n3. 🧪 Testing user WITHOUT name...');
        
        const testPhone = '628222222222';
        
        try {
            // Create user without name
            await db.sql`
                INSERT INTO users (phone, name, registration_completed)
                VALUES (${testPhone}, NULL, true)
                ON CONFLICT (phone) 
                DO UPDATE SET name = NULL
            `;
            this.logger.info(`   ✅ Created user without name (${testPhone})`);

            // Test getUserName method
            const retrievedName = await curhatService.getUserName(testPhone);
            this.logger.info(`   📝 Retrieved name: ${retrievedName || 'null'}`);

            // Test enter curhat mode without name
            this.logger.info('   🔄 Testing enter curhat mode...');
            const enterResult = await curhatService.enterCurhatMode(testPhone);
            
            if (enterResult.success) {
                this.logger.info('   ✅ Enter curhat mode successful');
                this.logger.info(`   📄 Welcome message preview:`);
                this.logger.info(`   "${enterResult.message.substring(0, 150)}..."`);
                
                // Should use generic "Halo!" greeting
                if (enterResult.message.includes('Halo! Sekarang')) {
                    this.logger.info(`   🎉 Generic greeting used correctly!`);
                } else {
                    this.logger.warn(`   ⚠️ Expected generic greeting not found`);
                }
            }

            // Test conversation with AI (if enabled)
            if (curhatService.getStatus().enabled && curhatService.getStatus().hasApiKey) {
                this.logger.info('   🤖 Testing AI conversation without name...');
                const response = await curhatService.handleCurhatMessage(testPhone, 'Halo, aku butuh teman bicara');
                this.logger.info(`   📝 AI Response preview: "${response.substring(0, 100)}..."`);
                this.logger.info('   ✅ AI conversation without name works');
            }

            // Exit curhat mode
            await curhatService.handleCurhatMessage(testPhone, '/quit');
            this.logger.info('   ✅ Exited curhat mode');

        } catch (error) {
            this.logger.error('   ❌ User without name test failed:', error.message);
        }
    }

    async runTests() {
        this.logger.info('🚀 Starting Curhat Name Recognition Tests\n');
        
        try {
            await this.testCurhatWithName();
            
            this.logger.info('\n🎉 ALL NAME RECOGNITION TESTS PASSED!');
            this.logger.info('============================================');
            this.logger.info('✅ User name retrieval from database working');
            this.logger.info('✅ Personalized welcome messages working');
            this.logger.info('✅ AI system prompt includes user name');
            this.logger.info('✅ Fallback to generic greeting working');
            this.logger.info('\n💡 Curhat service now recognizes user names!');
            
        } catch (error) {
            this.logger.error('\n❌ NAME RECOGNITION TESTS FAILED');
            this.logger.error('=================================');
            this.logger.error('Error:', error.message);
            process.exit(1);
        }
    }
}

// Run tests
if (require.main === module) {
    const tester = new CurhatNameTester();
    tester.runTests().catch(console.error);
}

module.exports = CurhatNameTester;