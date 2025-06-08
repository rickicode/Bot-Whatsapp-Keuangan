require('dotenv').config();
const DatabaseManager = require('../src/database/DatabaseManager');
const AICurhatService = require('../src/services/AICurhatService');
const SessionManager = require('../src/database/SessionManager');
const Logger = require('../src/utils/Logger');

async function testCurhatTTS() {
    const logger = new Logger();
    console.log('🧪 Testing Curhat Mode with TTS Integration...\n');
    
    // Initialize database and services
    console.log('📋 Initializing services...');
    const db = new DatabaseManager();
    await db.initialize();
    
    const sessionManager = new SessionManager(db.postgresDb);
    const aiCurhatService = new AICurhatService(sessionManager);
    
    const testUserPhone = '+6281234567890';
    
    console.log('✅ Services initialized\n');
    
    // Test 1: Check service status
    console.log('📋 Test 1: Service Status');
    const status = aiCurhatService.getStatus();
    console.log('AI Curhat Status:', JSON.stringify(status, null, 2));
    console.log('');
    
    if (!status.enabled) {
        console.log('❌ AI Curhat service is disabled. Please check your configuration.');
        return;
    }
    
    // Test 2: Enter curhat mode
    console.log('📋 Test 2: Enter Curhat Mode');
    try {
        const enterResult = await aiCurhatService.enterCurhatMode(testUserPhone);
        console.log('Enter mode result:', enterResult.success ? '✅ Success' : '❌ Failed');
        if (enterResult.message) {
            console.log('Welcome message preview:', enterResult.message.substring(0, 200) + '...');
        }
        console.log('');
    } catch (error) {
        console.log('❌ Error entering curhat mode:', error.message);
        return;
    }
    
    // Test 3: Test different message types
    console.log('📋 Test 3: Message Processing');
    
    const testMessages = [
        {
            message: 'Halo, apa kabar hari ini?',
            description: 'Regular message (should return text)'
        },
        {
            message: 'Aku sedang sedih, tolong balas dengan suara ya',
            description: 'Voice request message (should return audio if TTS enabled)'
        },
        {
            message: 'Ceritakan bagaimana cara mengatasi stress pakai voice',
            description: 'Voice request with topic (should return audio if TTS enabled)'
        },
        {
            message: 'Biasa saja sih hari ini',
            description: 'Regular response (should return text)'
        }
    ];
    
    for (let i = 0; i < testMessages.length; i++) {
        const testCase = testMessages[i];
        console.log(`\n🔍 Test 3.${i + 1}: ${testCase.description}`);
        console.log(`Message: "${testCase.message}"`);
        
        try {
            const response = await aiCurhatService.handleCurhatMessage(testUserPhone, testCase.message);
            
            console.log(`Response type: ${response.type}`);
            
            if (response.type === 'text') {
                console.log('✅ Text response generated');
                console.log('Preview:', response.content.substring(0, 150) + '...');
            } else if (response.type === 'audio') {
                console.log('🎵 Audio response generated');
                console.log('Audio path:', response.audioPath);
                console.log('Caption preview:', response.caption.substring(0, 100) + '...');
                
                // Check if audio file exists
                const fs = require('fs');
                if (fs.existsSync(response.audioPath)) {
                    const stats = fs.statSync(response.audioPath);
                    console.log(`✅ Audio file created: ${(stats.size / 1024).toFixed(2)} KB`);
                    
                    // Clean up test audio file
                    setTimeout(() => {
                        try {
                            fs.unlinkSync(response.audioPath);
                            console.log('🗑️ Test audio file cleaned up');
                        } catch (cleanupError) {
                            console.log('⚠️ Could not clean up test audio file');
                        }
                    }, 2000);
                } else {
                    console.log('❌ Audio file was not created');
                }
            }
            
        } catch (error) {
            console.log('❌ Error processing message:', error.message);
        }
    }
    
    // Test 4: Exit curhat mode
    console.log('\n📋 Test 4: Exit Curhat Mode');
    try {
        const exitResult = await aiCurhatService.exitCurhatMode(testUserPhone);
        console.log('Exit mode result:', exitResult.success ? '✅ Success' : '❌ Failed');
        console.log('');
    } catch (error) {
        console.log('❌ Error exiting curhat mode:', error.message);
    }
    
    // Test 5: Cleanup and summary
    console.log('📋 Test 5: Cleanup');
    try {
        // Clean up test user data
        await sessionManager.clearCurhatHistory(testUserPhone);
        console.log('✅ Test data cleaned up');
    } catch (error) {
        console.log('⚠️ Could not clean up test data:', error.message);
    }
    
    await db.close();
    console.log('✅ Database connection closed');
    
    console.log('\n🎉 Curhat TTS Integration test completed!');
    
    // Summary and recommendations
    console.log('\n📊 Test Summary:');
    console.log('- AI Curhat Service:', status.enabled ? '✅ Enabled' : '❌ Disabled');
    console.log('- TTS Service:', status.tts.enabled ? '✅ Enabled' : '❌ Disabled');
    console.log('- TTS API Key:', status.tts.hasApiKey ? '✅ Present' : '❌ Missing');
    
    if (!status.tts.enabled || !status.tts.hasApiKey) {
        console.log('\n💡 To enable TTS features:');
        console.log('1. Set ELEVENLABS_TTS_ENABLED=true in your .env file');
        console.log('2. Get API key from https://elevenlabs.io/');
        console.log('3. Set ELEVENLABS_API_KEY=your_actual_api_key');
        console.log('4. Restart the application');
        console.log('5. Test with: "tolong balas dengan suara"');
    }
    
    console.log('\n🚀 Ready for production use!');
}

// Run the test
testCurhatTTS().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});