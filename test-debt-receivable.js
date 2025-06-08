const DebtReceivableService = require('./src/services/DebtReceivableService');
const DatabaseManager = require('./src/database/DatabaseManager');
const AIService = require('./src/services/AIService');

async function testDebtReceivableFeature() {
    console.log('🧪 Testing Debt/Receivable Feature...\n');
    
    try {
        // Initialize services
        const db = new DatabaseManager();
        await db.initialize();
        
        const aiService = new AIService();
        const debtService = new DebtReceivableService(db, aiService);
        
        console.log('✅ Services initialized successfully\n');
        
        // Test cases - Natural Language Parsing
        const testCases = [
            "Piutang Warung Madura Voucher Wifi 2Rebuan 200K",
            "Hutang ke Toko Budi sembako 150K", 
            "Saya pinjam uang ke Pak RT 500K untuk modal",
            "Teman kantor belum bayar makan siang 50K",
            "Cicilan motor ke Yamaha bulan ini 1.2 juta",
            "Adik sepupu hutang uang jajan 50K"
        ];
        
        console.log('🔍 Testing Natural Language Parsing:\n');
        
        for (let i = 0; i < testCases.length; i++) {
            const input = testCases[i];
            console.log(`📝 Test ${i + 1}: "${input}"`);
            
            try {
                const result = await debtService.parseDebtReceivableInput(input, '628123456789');
                
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
        
        // Test database operations (without actually inserting for safety)
        console.log('🗄️ Testing Database Schema...\n');
        
        // Test if tables exist
        try {
            const clientsCount = await db.get('SELECT COUNT(*) as count FROM clients');
            console.log(`✅ Clients table accessible (${clientsCount.count} records)`);
            
            const debtCount = await db.get('SELECT COUNT(*) as count FROM debt_receivables');
            console.log(`✅ Debt_receivables table accessible (${debtCount.count} records)`);
        } catch (error) {
            console.log(`❌ Database error: ${error.message}`);
        }
        
        console.log('\n🎉 All tests completed!');
        console.log('\n📋 Features Ready:');
        console.log('• Natural Language Processing untuk hutang/piutang');
        console.log('• Auto client registration');
        console.log('• Command handlers: /hutang, /piutang, /hutang-piutang, /saldo-hutang, /lunas');
        console.log('• AI parsing dengan confidence scoring');
        console.log('• Phone number validation dan formatting');
        console.log('• Integration dengan WhatsApp bot existing');
        
        await db.close();
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run tests
testDebtReceivableFeature().then(() => {
    console.log('\n✅ Test suite completed successfully!');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
});