const Logger = require('../utils/Logger');

class DebtReceivableService {
    constructor(database, aiService) {
        this.db = database;
        this.ai = aiService;
        this.logger = new Logger();
    }

    /**
     * Parse natural language input untuk hutang piutang
     * Menggunakan AI untuk mengidentifikasi pola-pola bahasa Indonesia
     */
    async parseDebtReceivableInput(text, userPhone) {
        try {
            // Check if AI service is available
            if (!this.ai || !this.ai.isAvailable()) {
                this.logger.warn('AI service not available, using manual parsing for debt/receivable');
                return this.parseDebtReceivableManually(text);
            }

            // Prompt khusus untuk parsing hutang piutang dalam bahasa Indonesia
            const prompt = `
Analisis teks transaksi hutang/piutang dalam bahasa Indonesia berikut dan extract informasi:

Input: "${text}"

Tugas:
1. Tentukan jenis: HUTANG (user berhutang ke orang) atau PIUTANG (orang berhutang ke user)
2. Extract nama client/pihak lain
3. Extract nominal uang (konversi ke angka, contoh: 200K=200000, 1.5juta=1500000)
4. Extract deskripsi/keterangan transaksi
5. Berikan confidence score (0.0-1.0)

Pola yang harus dideteksi:
- PIUTANG: "Piutang [nama] [produk/layanan] [nominal]", "[nama] berhutang [keterangan] [nominal]", "[nama] belum bayar [keterangan] [nominal]"
- HUTANG: "Hutang ke [nama] [keterangan] [nominal]", "Pinjam ke [nama] [keterangan] [nominal]", "Belum bayar [keterangan] ke [nama] [nominal]"

Format output JSON:
{
    "type": "HUTANG" atau "PIUTANG",
    "client_name": "nama client",
    "amount": nominal_dalam_angka,
    "description": "deskripsi transaksi",
    "confidence": 0.0-1.0,
    "parsed_successfully": true/false
}

Contoh:
Input: "Piutang Warung Madura Voucher Wifi 2Rebuan 200K"
Output: {"type": "PIUTANG", "client_name": "Warung Madura", "amount": 200000, "description": "Voucher Wifi 2Rebuan", "confidence": 0.95, "parsed_successfully": true}

Input: "Hutang ke Toko Budi sembako 150K"
Output: {"type": "HUTANG", "client_name": "Toko Budi", "amount": 150000, "description": "sembako", "confidence": 0.9, "parsed_successfully": true}
`;

            const aiResponse = await this.ai.makeRequest([
                { role: 'user', content: prompt }
            ], 0.7, 500);
            
            try {
                // Extract JSON dari response AI
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No JSON found in AI response');
                }
                
                const parsed = JSON.parse(jsonMatch[0]);
                
                // Validasi hasil parsing
                if (!parsed.parsed_successfully || !parsed.type || !parsed.client_name || !parsed.amount) {
                    return { success: false, confidence: 0, error: 'Parsing incomplete' };
                }
                
                // Normalisasi tipe
                parsed.type = parsed.type.toUpperCase();
                if (!['HUTANG', 'PIUTANG'].includes(parsed.type)) {
                    return { success: false, confidence: 0, error: 'Invalid type' };
                }
                
                // Validasi amount
                if (typeof parsed.amount !== 'number' || parsed.amount <= 0) {
                    return { success: false, confidence: 0, error: 'Invalid amount' };
                }
                
                // Clean client name dan description
                parsed.client_name = this.cleanClientName(parsed.client_name);
                parsed.description = this.cleanDescription(parsed.description || '');
                
                return {
                    success: true,
                    type: parsed.type,
                    clientName: parsed.client_name,
                    amount: parsed.amount,
                    description: parsed.description,
                    confidence: parsed.confidence || 0.8
                };
                
            } catch (parseError) {
                this.logger.error('Error parsing AI response:', parseError);
                return { success: false, confidence: 0, error: 'AI response parsing failed' };
            }
            
        } catch (error) {
            this.logger.error('Error in parseDebtReceivableInput:', error);
            return { success: false, confidence: 0, error: error.message };
        }
    }

    /**
     * Manual parsing sebagai fallback ketika AI tidak tersedia
     */
    parseDebtReceivableManually(text) {
        try {
            const lowerText = text.toLowerCase();
            
            // Detect type berdasarkan keyword
            let type = null;
            
            // Piutang keywords (orang berhutang ke user)
            const piutangKeywords = ['piutang', 'belum bayar', 'hutang', 'pinjam'];
            // Hutang keywords (user berhutang ke orang)
            const hutangKeywords = ['hutang ke', 'pinjam ke', 'belum bayar ke', 'cicilan ke'];
            
            // Check hutang keywords first (more specific)
            if (hutangKeywords.some(keyword => lowerText.includes(keyword))) {
                type = 'HUTANG';
            } else if (piutangKeywords.some(keyword => lowerText.includes(keyword))) {
                type = 'PIUTANG';
            }
            
            if (!type) {
                return { success: false, confidence: 0, error: 'Tidak dapat mendeteksi jenis hutang/piutang' };
            }
            
            // Extract amount using regex
            const amountPatterns = [
                /(\d+(?:\.\d+)?)\s*juta/i,           // 1.5juta, 2 juta
                /(\d+(?:\.\d+)?)\s*[kK]/,            // 200K, 150k
                /(\d+)\s*ribu/i,                     // 200ribu
                /(\d+)\s*rebuan/i,                   // 2rebuan
                /(\d{1,3}(?:\.\d{3})*)/              // 150000, 1.500.000
            ];
            
            let amount = 0;
            let amountFound = false;
            
            for (const pattern of amountPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const num = parseFloat(match[1].replace(/\./g, ''));
                    
                    if (pattern.source.includes('juta')) {
                        amount = num * 1000000;
                    } else if (pattern.source.includes('[kK]')) {
                        amount = num * 1000;
                    } else if (pattern.source.includes('ribu')) {
                        amount = num * 1000;
                    } else if (pattern.source.includes('rebuan')) {
                        amount = num * 1000;
                    } else {
                        amount = num;
                    }
                    
                    amountFound = true;
                    break;
                }
            }
            
            if (!amountFound || amount <= 0) {
                return { success: false, confidence: 0, error: 'Tidak dapat mendeteksi nominal' };
            }
            
            // Extract client name
            let clientName = '';
            
            if (type === 'HUTANG') {
                // For hutang, look for name after "ke"
                const keMatch = text.match(/(?:hutang|pinjam|cicilan)\s+ke\s+([^0-9]+?)(?:\s+|$)/i);
                if (keMatch) {
                    clientName = keMatch[1].trim();
                }
            } else {
                // For piutang, look for name at the beginning or after "piutang"
                const piutangMatch = text.match(/piutang\s+([^0-9]+?)(?:\s+|$)/i);
                if (piutangMatch) {
                    clientName = piutangMatch[1].trim();
                } else {
                    // Try to get first words that are not keywords
                    const words = text.split(/\s+/);
                    const skipWords = ['piutang', 'hutang', 'belum', 'bayar', 'pinjam'];
                    for (const word of words) {
                        if (!skipWords.includes(word.toLowerCase()) && isNaN(parseFloat(word))) {
                            if (!word.match(/[kK]$|juta|ribu|rebuan/)) {
                                clientName += word + ' ';
                            }
                        }
                    }
                    clientName = clientName.trim();
                }
            }
            
            if (!clientName) {
                return { success: false, confidence: 0, error: 'Tidak dapat mendeteksi nama client' };
            }
            
            // Clean client name
            clientName = this.cleanClientName(clientName);
            
            // Extract description (simple approach)
            let description = text;
            // Remove type keywords and amount
            description = description.replace(/piutang|hutang|belum bayar|pinjam|ke/gi, '');
            description = description.replace(/\d+(?:\.\d+)?\s*(?:juta|[kK]|ribu|rebuan)/gi, '');
            description = description.replace(clientName, '');
            description = description.trim();
            
            // Clean description
            description = this.cleanDescription(description || 'Transaksi hutang/piutang');
            
            return {
                success: true,
                type: type,
                clientName: clientName,
                amount: amount,
                description: description,
                confidence: 0.7, // Lower confidence for manual parsing
                isManualParsing: true // Flag to indicate this was parsed manually
            };
            
        } catch (error) {
            this.logger.error('Error in manual parsing:', error);
            return { success: false, confidence: 0, error: 'Gagal memproses input secara manual' };
        }
    }

    /**
     * Clean dan format nama client
     */
    cleanClientName(name) {
        if (!name || typeof name !== 'string') return name;
        
        // Remove common prefixes/suffixes
        let cleaned = name.trim()
            .replace(/^(pak |bu |bapak |ibu |mas |mbak |bang |kak )/i, '')
            .replace(/^(toko |warung |counter |bengkel |salon )/i, '$1')
            .replace(/\s+/g, ' ');
        
        // Capitalize first letter of each word
        return cleaned.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    /**
     * Clean dan format description
     */
    cleanDescription(description) {
        if (!description || typeof description !== 'string') return description;
        
        return description.trim()
            .replace(/^(untuk |buat |bayar |beli )/i, '')
            .toLowerCase()
            .replace(/\b\w/g, l => l.toUpperCase()); // Title case
    }

    /**
     * Add hutang piutang record dengan auto client registration
     */
    async addDebtReceivable(userPhone, type, clientName, amount, description, clientPhone = null) {
        try {
            await this.db.beginTransaction();
            
            // 1. Auto register client jika belum ada
            let client = await this.db.get(
                'SELECT * FROM clients WHERE name = $1 AND user_phone = $2',
                [clientName, userPhone]
            );
            
            if (!client) {
                const clientId = await this.db.run(
                    `INSERT INTO clients (user_phone, name, phone, created_at) 
                     VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id`,
                    [userPhone, clientName, clientPhone]
                );
                
                client = {
                    id: clientId.lastID,
                    user_phone: userPhone,
                    name: clientName,
                    phone: clientPhone
                };
                
                this.logger.info(`Auto-registered new client: ${clientName} (ID: ${client.id})`);
            }
            
            // 2. Add debt/receivable record
            const recordId = await this.db.run(
                `INSERT INTO debt_receivables (user_phone, client_id, type, amount, description, status, created_at)
                 VALUES ($1, $2, $3, $4, $5, 'active', CURRENT_TIMESTAMP) RETURNING id`,
                [userPhone, client.id, type, amount, description]
            );
            
            await this.db.commit();
            
            return {
                success: true,
                recordId: recordId.lastID,
                clientId: client.id,
                clientName: clientName,
                type: type,
                amount: amount,
                description: description
            };
            
        } catch (error) {
            await this.db.rollback();
            this.logger.error('Error adding debt/receivable:', error);
            throw error;
        }
    }

    /**
     * Get debt/receivable records untuk user
     */
    async getDebtReceivables(userPhone, type = null, status = 'active', limit = 50) {
        try {
            let sql = `
                SELECT dr.*, c.name as client_name, c.phone as client_phone
                FROM debt_receivables dr
                JOIN clients c ON dr.client_id = c.id
                WHERE dr.user_phone = $1 AND dr.status = $2
            `;
            
            let params = [userPhone, status];
            
            if (type && ['HUTANG', 'PIUTANG'].includes(type.toUpperCase())) {
                sql += ' AND dr.type = $3';
                params.push(type.toUpperCase());
            }
            
            sql += ' ORDER BY dr.created_at DESC LIMIT $' + (params.length + 1);
            params.push(limit);
            
            const records = await this.db.all(sql, params);
            
            return records.map(record => ({
                id: record.id,
                type: record.type,
                clientName: record.client_name,
                clientPhone: record.client_phone,
                amount: record.amount,
                description: record.description,
                status: record.status,
                createdAt: record.created_at,
                dueDate: record.due_date
            }));
            
        } catch (error) {
            this.logger.error('Error getting debt/receivables:', error);
            throw error;
        }
    }

    /**
     * Get summary of debt/receivables
     */
    async getDebtReceivableSummary(userPhone) {
        try {
            const summary = await this.db.get(`
                SELECT 
                    COALESCE(SUM(CASE WHEN type = 'PIUTANG' AND status = 'active' THEN amount ELSE 0 END), 0) as total_piutang,
                    COALESCE(SUM(CASE WHEN type = 'HUTANG' AND status = 'active' THEN amount ELSE 0 END), 0) as total_hutang,
                    COUNT(CASE WHEN type = 'PIUTANG' AND status = 'active' THEN 1 END) as count_piutang,
                    COUNT(CASE WHEN type = 'HUTANG' AND status = 'active' THEN 1 END) as count_hutang
                FROM debt_receivables 
                WHERE user_phone = $1
            `, [userPhone]);
            
            return {
                totalPiutang: summary.total_piutang || 0,
                totalHutang: summary.total_hutang || 0,
                countPiutang: summary.count_piutang || 0,
                countHutang: summary.count_hutang || 0,
                netBalance: (summary.total_piutang || 0) - (summary.total_hutang || 0)
            };
            
        } catch (error) {
            this.logger.error('Error getting debt/receivable summary:', error);
            throw error;
        }
    }

    /**
     * Mark debt/receivable as paid
     */
    async markAsPaid(userPhone, recordId) {
        try {
            const updated = await this.db.run(
                `UPDATE debt_receivables 
                 SET status = 'paid', paid_at = CURRENT_TIMESTAMP
                 WHERE id = $1 AND user_phone = $2`,
                [recordId, userPhone]
            );
            
            if (updated.changes === 0) {
                throw new Error('Record not found or not authorized');
            }
            
            return { success: true };
            
        } catch (error) {
            this.logger.error('Error marking as paid:', error);
            throw error;
        }
    }

    /**
     * Update client phone number
     */
    async updateClientPhone(userPhone, clientName, clientPhone) {
        try {
            const updated = await this.db.run(
                `UPDATE clients 
                 SET phone = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE name = $2 AND user_phone = $3`,
                [clientPhone, clientName, userPhone]
            );
            
            if (updated.changes === 0) {
                throw new Error('Client not found');
            }
            
            return { success: true };
            
        } catch (error) {
            this.logger.error('Error updating client phone:', error);
            throw error;
        }
    }

    /**
     * Generate AI response untuk konfirmasi
     */
    generateConfirmationMessage(parsed, clientName) {
        const typeText = parsed.type === 'PIUTANG' ? 'berhutang' : 'Anda berhutang';
        const directionText = parsed.type === 'PIUTANG' ? 'kepada Anda' : `ke ${clientName}`;
        
        let message = `Baik, jadi ${parsed.type === 'PIUTANG' ? clientName : 'Anda'} ${typeText} ${parsed.description} sebesar Rp ${this.formatCurrency(parsed.amount)} ${directionText}.\n\n📱 Silakan masukkan nomor WhatsApp ${clientName}:\n💡 Format: 08xxxxxxxxxx atau 62xxxxxxxxxx\nAtau ketik "tidak" jika tidak punya nomor HP`;
        
        // Add note if this was parsed manually (without AI)
        if (parsed.isManualParsing) {
            message += `\n\n💡 *Catatan*: Parsing menggunakan sistem manual (AI tidak tersedia). Pastikan informasi sudah benar.`;
        }
        
        return message;
    }

    /**
     * Format currency untuk display
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    }
}

module.exports = DebtReceivableService;