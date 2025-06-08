require('dotenv').config();
const TTSService = require('../src/services/TTSService');
const Logger = require('../src/utils/Logger');

async function testTTSService() {
    const logger = new Logger();
    const ttsService = new TTSService();
    
    console.log('🧪 Testing TTS Service...\n');
    
    // Test 1: Check TTS Service Status
    console.log('📋 Test 1: TTS Service Status');
    const status = ttsService.getStatus();
    console.log('Status:', JSON.stringify(status, null, 2));
    console.log('');
    
    if (!status.enabled) {
        console.log('❌ TTS Service is disabled. Please check your configuration.');
        console.log('Required environment variables:');
        console.log('- ELEVENLABS_TTS_ENABLED=true');
        console.log('- ELEVENLABS_API_KEY=your_api_key');
        return;
    }
    
    // Test 2: Check Voice Request Detection
    console.log('📋 Test 2: Voice Request Detection');
    const testMessages = [
        'Halo, bagaimana kabarmu?',
        'Tolong balas dengan suara ya',
        'Bisa pakai voice?',
        'Gunakan suara untuk balas',
        'Ceritakan dengan audio',
        'Biasa aja sih'
    ];
    
    for (const message of testMessages) {
        const isVoiceRequested = ttsService.isVoiceRequested(message);
        console.log(`"${message}" -> Voice requested: ${isVoiceRequested ? '✅' : '❌'}`);
    }
    console.log('');
    
    // Test 3: Text Cleaning for TTS
    console.log('📋 Test 3: Text Cleaning for TTS');
    const sampleText = `**Halo!** Aku senang bisa *membantu* kamu hari ini 😊
    
✨ Ini adalah respons dengan:
• Format markdown
• Emoji 💙🌸
• Baris baru

💡 Semoga bermanfaat!`;
    
    const cleanedText = ttsService.cleanTextForTTS(sampleText);
    console.log('Original text:');
    console.log(sampleText);
    console.log('\nCleaned text:');
    console.log(cleanedText);
    console.log('');
    
    // Test 4: TTS Generation (if API key is valid)
    if (status.hasApiKey && status.enabled) {
        console.log('📋 Test 4: TTS Generation');
        console.log('Generating TTS for: "Halo, ini adalah test suara dari bot keuangan."');
        
        try {
            const result = await ttsService.textToSpeech(
                'Halo, ini adalah test suara dari bot keuangan.',
                'test_user_123'
            );
            
            if (result.success) {
                console.log('✅ TTS generation successful!');
                console.log('Audio file:', result.audioPath);
                
                // Check if file exists
                const fs = require('fs');
                if (fs.existsSync(result.audioPath)) {
                    const stats = fs.statSync(result.audioPath);
                    console.log(`File size: ${(stats.size / 1024).toFixed(2)} KB`);
                    
                    // Clean up test file
                    setTimeout(() => {
                        try {
                            fs.unlinkSync(result.audioPath);
                            console.log('🗑️ Test audio file cleaned up');
                        } catch (error) {
                            console.log('⚠️ Could not clean up test file:', error.message);
                        }
                    }, 5000);
                } else {
                    console.log('❌ Audio file was not created');
                }
            } else {
                console.log('❌ TTS generation failed:', result.error);
            }
        } catch (error) {
            console.log('❌ TTS test error:', error.message);
        }
    } else {
        console.log('📋 Test 4: Skipped (No valid API key)');
    }
    
    console.log('');
    
    // Test 5: Get Available Voices (if API key is valid)
    if (status.hasApiKey && status.enabled) {
        console.log('📋 Test 5: Available Voices');
        try {
            const voices = await ttsService.getAvailableVoices();
            if (voices.length > 0) {
                console.log(`✅ Found ${voices.length} available voices:`);
                voices.slice(0, 5).forEach(voice => {
                    console.log(`- ${voice.name} (${voice.voice_id}) - ${voice.labels?.gender || 'Unknown'}`);
                });
                if (voices.length > 5) {
                    console.log(`... and ${voices.length - 5} more voices`);
                }
            } else {
                console.log('❌ No voices found');
            }
        } catch (error) {
            console.log('❌ Could not fetch voices:', error.message);
        }
    } else {
        console.log('📋 Test 5: Skipped (No valid API key)');
    }
    
    console.log('\n🎉 TTS Service test completed!');
    
    // Configuration recommendations
    console.log('\n💡 Configuration Tips:');
    console.log('1. Get your API key from: https://elevenlabs.io/');
    console.log('2. Set ELEVENLABS_TTS_ENABLED=true in your .env file');
    console.log('3. Set ELEVENLABS_API_KEY=your_actual_api_key');
    console.log('4. Optionally set ELEVENLABS_VOICE_ID for specific voice');
    console.log('5. In curhat mode, users can say "balas dengan suara" to get voice responses');
}

// Run the test
testTTSService().catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});