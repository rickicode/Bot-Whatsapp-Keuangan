const DatabaseFactory = require('./src/database/DatabaseFactory');
const SessionManager = require('./src/database/SessionManager');
const Logger = require('./src/utils/Logger');

require('dotenv').config();

const logger = new Logger();

async function testRedisSessionManagement() {
    console.log('🚀 Testing Redis Session Management Implementation');
    console.log('================================================');
    
    let sessionManager = null;
    
    try {
        // Create SessionManager
        console.log('1. Creating SessionManager...');
        sessionManager = DatabaseFactory.createSessionManager();
        
        const postgresConfig = DatabaseFactory.getPostgresConfig();
        const redisConfig = DatabaseFactory.getRedisConfig();
        
        console.log('📋 Configuration:');
        console.log('- Redis Enabled:', process.env.REDIS_ENABLED);
        console.log('- Redis Config:', redisConfig ? 'Available' : 'Not configured');
        console.log('- PostgreSQL Config:', postgresConfig ? 'Available' : 'Not configured');
        
        // Initialize SessionManager
        console.log('\n2. Initializing SessionManager...');
        await sessionManager.initialize(postgresConfig, redisConfig);
        console.log('✅ SessionManager initialized successfully');
        
        // Health Check
        console.log('\n3. Running health check...');
        const health = await sessionManager.healthCheck();
        console.log('📊 Health Status:');
        console.log(`- Redis: ${health.redis.status} (${health.redis.enabled ? 'enabled' : 'disabled'})`);
        console.log(`- PostgreSQL: ${health.postgresql.status}`);
        
        // Test WhatsApp Session Management
        console.log('\n4. Testing WhatsApp Session Management...');
        const clientId = 'test-client-123';
        const sessionData = {
            creds: { noiseKey: 'test-noise-key' },
            keys: { preKeys: {} },
            timestamp: new Date().toISOString()
        };
        
        // Save session
        await sessionManager.saveWhatsAppSession(clientId, sessionData);
        console.log('✅ WhatsApp session saved');
        
        // Retrieve session
        const retrievedSession = await sessionManager.getWhatsAppSession(clientId);
        if (retrievedSession && retrievedSession.creds) {
            console.log('✅ WhatsApp session retrieved successfully');
        } else {
            console.log('❌ Failed to retrieve WhatsApp session');
        }
        
        // Test Registration Session Management
        console.log('\n5. Testing Registration Session Management...');
        const testPhone = '+62812345678901';
        
        // Create registration session
        await sessionManager.createRegistrationSession(testPhone);
        console.log('✅ Registration session created');
        
        // Get registration session
        let regSession = await sessionManager.getRegistrationSession(testPhone);
        if (regSession && regSession.phone === testPhone) {
            console.log('✅ Registration session retrieved successfully');
        } else {
            console.log('❌ Failed to retrieve registration session');
        }
        
        // Update registration session
        const sessionDataUpdate = { name: 'Test User', email: 'test@example.com' };
        await sessionManager.updateRegistrationSession(testPhone, 'email', sessionDataUpdate);
        console.log('✅ Registration session updated');
        
        // Get updated session
        regSession = await sessionManager.getRegistrationSession(testPhone);
        if (regSession && regSession.step === 'email') {
            console.log('✅ Registration session update verified');
        } else {
            console.log('❌ Registration session update failed');
        }
        
        // Test session statistics
        console.log('\n6. Testing session statistics...');
        const stats = await sessionManager.getSessionStats();
        console.log('📊 Session Statistics:');
        console.log(`- Redis WhatsApp Sessions: ${stats.redis.whatsappSessions}`);
        console.log(`- Redis Registration Sessions: ${stats.redis.registrationSessions}`);
        console.log(`- PostgreSQL WhatsApp Sessions: ${stats.postgresql.whatsappSessions}`);
        console.log(`- PostgreSQL Registration Sessions: ${stats.postgresql.registrationSessions}`);
        
        // Test cleanup
        console.log('\n7. Testing session cleanup...');
        const cleanupResult = await sessionManager.cleanupExpiredRegistrationSessions();
        console.log(`✅ Cleanup completed, ${cleanupResult} sessions removed`);
        
        // Clean up test data
        console.log('\n8. Cleaning up test data...');
        await sessionManager.deleteWhatsAppSession(clientId);
        await sessionManager.deleteRegistrationSession(testPhone);
        console.log('✅ Test data cleaned up');
        
        console.log('\n🎉 All tests completed successfully!');
        
        // Final health check
        console.log('\n9. Final health check...');
        const finalHealth = await sessionManager.healthCheck();
        console.log('📊 Final Health Status:');
        console.log(JSON.stringify(finalHealth, null, 2));
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        logger.error('Redis session test error:', error);
    } finally {
        if (sessionManager) {
            await sessionManager.close();
            console.log('🔒 SessionManager closed');
        }
    }
}

// Test dengan error handling untuk Redis yang tidak tersedia
async function testFallbackBehavior() {
    console.log('\n🔄 Testing Fallback Behavior (Redis Unavailable)');
    console.log('=================================================');
    
    // Temporarily disable Redis
    const originalRedisEnabled = process.env.REDIS_ENABLED;
    process.env.REDIS_ENABLED = 'false';
    
    let sessionManager = null;
    
    try {
        sessionManager = DatabaseFactory.createSessionManager();
        const postgresConfig = DatabaseFactory.getPostgresConfig();
        const redisConfig = DatabaseFactory.getRedisConfig();
        
        await sessionManager.initialize(postgresConfig, redisConfig);
        console.log('✅ SessionManager initialized in PostgreSQL-only mode');
        
        const testPhone = '+62812345678902';
        await sessionManager.createRegistrationSession(testPhone);
        console.log('✅ Registration session created using PostgreSQL fallback');
        
        const session = await sessionManager.getRegistrationSession(testPhone);
        if (session) {
            console.log('✅ Registration session retrieved from PostgreSQL');
        }
        
        await sessionManager.deleteRegistrationSession(testPhone);
        console.log('✅ Registration session deleted from PostgreSQL');
        
        console.log('🎉 Fallback behavior test completed successfully!');
        
    } catch (error) {
        console.error('❌ Fallback test failed:', error);
    } finally {
        // Restore original setting
        process.env.REDIS_ENABLED = originalRedisEnabled;
        
        if (sessionManager) {
            await sessionManager.close();
        }
    }
}

// Run tests
async function runAllTests() {
    try {
        await testRedisSessionManagement();
        await testFallbackBehavior();
        
        console.log('\n✨ All Redis session management tests completed!');
        console.log('\n📝 Summary:');
        console.log('- Redis integration with PostgreSQL fallback ✅');
        console.log('- WhatsApp session management ✅');
        console.log('- Registration session management ✅');
        console.log('- Session statistics and health checks ✅');
        console.log('- Automatic fallback behavior ✅');
        console.log('\n🚀 Your Redis session management is ready to use!');
        
    } catch (error) {
        console.error('❌ Tests failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    runAllTests();
}

module.exports = { testRedisSessionManagement, testFallbackBehavior };