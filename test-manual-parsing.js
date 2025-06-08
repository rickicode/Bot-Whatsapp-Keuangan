const DebtReceivableService = require('./src/services/DebtReceivableService');

async function testManualParsing() {
    console.log('🧪 Testing Manual Debt/Receivable Parsing (No AI Required)...\n');
    
    // Create service without AI (null AI service)
    const debtService = new DebtReceivableService(null, null);
    
    // Test cases
    const testCases = [
        "Piutang Warung Madura Voucher Wifi 2Rebuan 200K",
        "Hutang ke Toko Budi sembako 150K", 
        "Saya pinjam ke Pak RT 500K untuk modal",
        "Teman kantor belum bayar makan siang 50K",
        "Cicilan ke Yamaha bulan ini 1.2 juta",
        "Adik sepupu hutang uang jajan 50ribu"
    ];
    
    console.log('🔍 Testing Manual Pattern Recognition:\n');
    
    for (let i = 0; i < testCases.length; i++) {
        const input = testCases[i];
        console.log(`📝 Test ${i + 1}: "${input}"`);
        
        try {
            const result = debtService.parseDebtReceivableManually(input);
            
            if (result.success) {
                console.log(`✅ Success (Confidence: ${Math.round(result.confidence * 100)}%)`);
                console.log(`   Type: ${result.type}`);
                console.log(`   Client: ${result.clientName}`);
                console.log(`   Amount: Rp ${result.amount.toLocaleString('id-ID')}`);
                console.log(`   Description: ${result.description}`);
            } else {
                console.log(`❌ Failed: ${result.error}`);
            }
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for readability
    }
    
    console.log('✅ Manual parsing test completed!');
    console.log('\n📋 Manual Parsing Features:');
    console.log('• Pattern recognition untuk HUTANG vs PIUTANG');
    console.log('• Regex parsing untuk nominal (K, juta, ribu, rebuan)');
    console.log('• Client name extraction');
    console.log('• Fallback ketika AI tidak tersedia');
    console.log('• Confidence score 0.7 untuk manual parsing');
}

// Run tests
testManualParsing().then(() => {
    console.log('\n🎉 Manual parsing ready to use as AI fallback!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});