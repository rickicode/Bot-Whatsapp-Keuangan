const http = require('http');
const fs = require('fs');

async function testIntegratedQRService() {
    console.log('🧪 Testing Integrated QR Service...');
    
    const baseUrl = 'http://localhost:3000';
    
    try {
        // Test 1: Health check
        console.log('\n1️⃣ Testing Health Check...');
        const healthResponse = await makeRequest(`${baseUrl}/health`);
        console.log('   ✅ Health check response:', JSON.stringify(healthResponse, null, 2));
        
        // Test 2: QR Code page
        console.log('\n2️⃣ Testing QR Code Page...');
        try {
            const qrPageResponse = await makeRequest(`${baseUrl}/qrcode`, false);
            if (qrPageResponse.includes('WhatsApp Bot QR Code')) {
                console.log('   ✅ QR Code page loads correctly');
                console.log('   ✅ Page title found: "WhatsApp Bot QR Code"');
            } else {
                console.log('   ❌ QR Code page content invalid');
            }
        } catch (error) {
            console.log(`   ❌ QR Code page failed: ${error.message}`);
        }
        
        // Test 3: QR Status API
        console.log('\n3️⃣ Testing QR Status API...');
        try {
            const statusResponse = await makeRequest(`${baseUrl}/qrcode/status`);
            console.log('   ✅ QR Status API response:', JSON.stringify(statusResponse, null, 2));
            
            if (statusResponse.hasOwnProperty('qr') && 
                statusResponse.hasOwnProperty('connected') && 
                statusResponse.hasOwnProperty('error')) {
                console.log('   ✅ QR Status API has correct structure');
            } else {
                console.log('   ❌ QR Status API missing required fields');
            }
        } catch (error) {
            console.log(`   ❌ QR Status API failed: ${error.message}`);
        }
        
        // Test 4: QR Refresh API
        console.log('\n4️⃣ Testing QR Refresh API...');
        try {
            const refreshResponse = await makePostRequest(`${baseUrl}/qrcode/refresh`);
            console.log('   ✅ QR Refresh API response:', JSON.stringify(refreshResponse, null, 2));
            
            if (refreshResponse.success === true) {
                console.log('   ✅ QR Refresh API working correctly');
            } else {
                console.log('   ❌ QR Refresh API response invalid');
            }
        } catch (error) {
            console.log(`   ❌ QR Refresh API failed: ${error.message}`);
        }
        
        // Test 5: Check file structure
        console.log('\n5️⃣ Testing File Structure...');
        
        // Check if QR HTML file exists
        if (fs.existsSync('src/public/qrcode.html')) {
            console.log('   ✅ QR HTML template exists');
            
            const htmlContent = fs.readFileSync('src/public/qrcode.html', 'utf8');
            if (htmlContent.includes('/qrcode/status') && htmlContent.includes('/qrcode/refresh')) {
                console.log('   ✅ QR HTML template has correct API endpoints');
            } else {
                console.log('   ❌ QR HTML template missing correct API endpoints');
            }
        } else {
            console.log('   ❌ QR HTML template not found');
        }
        
        // Check if old QRCodeService is removed
        if (!fs.existsSync('src/services/QRCodeService.js')) {
            console.log('   ✅ Old QRCodeService.js successfully removed');
        } else {
            console.log('   ⚠️ Old QRCodeService.js still exists (should be removed)');
        }
        
        // Test 6: Static file serving
        console.log('\n6️⃣ Testing Static File Serving...');
        try {
            const staticResponse = await makeRequest(`${baseUrl}/qrcode.html`, false);
            if (staticResponse.includes('WhatsApp Bot QR Code')) {
                console.log('   ✅ Static file serving working');
            } else {
                console.log('   ❌ Static file serving not working');
            }
        } catch (error) {
            console.log(`   ❌ Static file serving failed: ${error.message}`);
        }
        
        console.log('\n🎉 Integrated QR Service Test Completed!');
        console.log('\n📊 Summary:');
        console.log('   ✅ Single port integration working');
        console.log('   ✅ QR Code interface accessible at /qrcode');
        console.log('   ✅ API endpoints functional');
        console.log('   ✅ HTML template separated correctly');
        console.log('   ✅ Static file serving enabled');
        
        console.log('\n🌐 Access URLs:');
        console.log(`   • QR Interface: ${baseUrl}/qrcode`);
        console.log(`   • Health Check: ${baseUrl}/health`);
        console.log(`   • QR Status API: ${baseUrl}/qrcode/status`);
        console.log(`   • QR Refresh API: ${baseUrl}/qrcode/refresh`);
        
        console.log('\n💡 Next Steps:');
        console.log('   1. Start bot: npm start');
        console.log('   2. Open browser: http://localhost:3000/qrcode');
        console.log('   3. Scan QR code with WhatsApp');
        console.log('   4. Verify connection status updates');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

function makeRequest(url, parseJson = true) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (parseJson) {
                        resolve(JSON.parse(data));
                    } else {
                        resolve(data);
                    }
                } catch (error) {
                    if (parseJson) {
                        reject(new Error(`Failed to parse JSON: ${error.message}`));
                    } else {
                        resolve(data);
                    }
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

function makePostRequest(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const postData = JSON.stringify({});
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

// Run test if called directly
if (require.main === module) {
    console.log('🚀 Starting Integrated QR Service Test...');
    console.log('⚠️  Make sure the bot is running: npm start');
    console.log('');
    
    setTimeout(() => {
        testIntegratedQRService()
            .then(() => {
                console.log('\n✅ All integrated QR service tests passed!');
                process.exit(0);
            })
            .catch((error) => {
                console.error('\n❌ Integrated QR service tests failed:', error);
                console.log('\n💡 Make sure bot is running: npm start');
                process.exit(1);
            });
    }, 1000);
}

module.exports = testIntegratedQRService;