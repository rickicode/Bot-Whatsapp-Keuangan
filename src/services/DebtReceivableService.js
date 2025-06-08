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
Input: "Piutang Andre beli minyak goreng 40K"
Output: {"type": "PIUTANG", "client_name": "Andre", "amount": 200000, "description": "beli minyak goreng", "confidence": 0.95, "parsed_successfully": true}

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
            
            // Extract amount using regex (improved patterns)
            const amountPatterns = [
                /(\d+(?:\.\d+)?)\s*juta/i,           // 1.5juta, 2 juta
                /(\d+(?:\.\d+)?)\s*[kK]/,            // 200K, 150k
                /(\d+)\s*ribu/i,                     // 200ribu
                /(\d+)\s*ribuan/i,                   // 2ribuan, 5ribuan
                /(\d{1,3}(?:[.,]\d{3})*)/            // 150000, 1.500.000, 1,500,000
            ];
            
            let amount = 0;
            let amountFound = false;
            
            for (const pattern of amountPatterns) {
                const match = text.match(pattern);
                if (match) {
                    const num = parseFloat(match[1].replace(/[.,]/g, ''));
                    
                    if (pattern.source.includes('juta')) {
                        amount = num * 1000000;
                    } else if (pattern.source.includes('[kK]')) {
                        amount = num * 1000;
                    } else if (pattern.source.includes('ribu')) {
                        amount = num * 1000;
                    } else if (pattern.source.includes('ribuan')) {
                        amount = num * 1000;
                    } else if (pattern.source.includes('ribun')) {
                        // Handle "5ribun" = 5000
                        amount = num * 1000;
                    } else if (pattern.source.includes('ribu')) {
                        // Handle "5ribu" = 5000
                        amount = num * 1000;
                    } else {
                        // For plain numbers, assume as is
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
                // For piutang, more sophisticated name extraction
                // Pattern: "Piutang [NAME] [description] [amount]"
                
                // Remove amount first to avoid confusion
                let textWithoutAmount = text;
                for (const pattern of amountPatterns) {
                    textWithoutAmount = textWithoutAmount.replace(pattern, '');
                }
                
                // Look for name after "piutang"
                const piutangMatch = textWithoutAmount.match(/piutang\s+([A-Za-z\s]+?)(?:\s+[a-z]|$)/i);
                if (piutangMatch) {
                    // Extract potential client name - usually first 1-3 words after "piutang"
                    const potentialName = piutangMatch[1].trim();
                    const words = potentialName.split(/\s+/);
                    
                    // Take first 1-3 words as client name (common pattern: "Warung Madura", "Toko Budi", etc.)
                    if (words.length >= 2) {
                        clientName = words.slice(0, 2).join(' '); // Take first 2 words
                    } else {
                        clientName = words[0]; // Single word name
                    }
                } else {
                    // Fallback: Try to get first words that look like names
                    const words = textWithoutAmount.split(/\s+/);
                    const skipWords = ['piutang', 'hutang', 'belum', 'bayar', 'pinjam'];
                    let nameWords = [];
                    
                    for (const word of words) {
                        if (!skipWords.includes(word.toLowerCase()) &&
                            isNaN(parseFloat(word)) &&
                            !word.match(/[kK]$|juta|ribu|ribuan/i) &&
                            word.length > 1) {
                            nameWords.push(word);
                            if (nameWords.length >= 2) break; // Limit to 2 words for name
                        }
                    }
                    clientName = nameWords.join(' ');
                }
            }
            
            if (!clientName) {
                return { success: false, confidence: 0, error: 'Tidak dapat mendeteksi nama client' };
            }
            
            // Clean client name
            clientName = this.cleanClientName(clientName);
            
            // Extract description (improved approach)
            let description = text;
            
            // Remove type keywords
            description = description.replace(/^(piutang|hutang|belum bayar|pinjam)\s*/gi, '');
            description = description.replace(/\s+(ke)\s+/gi, ' ');
            
            // Remove client name from description
            if (clientName) {
                description = description.replace(new RegExp(clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
            }
            
            // Remove amount patterns
            for (const pattern of amountPatterns) {
                description = description.replace(pattern, '');
            }
            
            // Clean up extra spaces and trim
            description = description.replace(/\s+/g, ' ').trim();
            
            // If description is empty or too short, create a default one
            if (!description || description.length < 3) {
                description = type === 'PIUTANG' ?
                    `Piutang dari ${clientName}` :
                    `Hutang ke ${clientName}`;
            }
            
            // Clean description
            description = this.cleanDescription(description);
            
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
            
            // 1. Auto register client jika belum ada atau update phone jika ada
            let client = await this.db.get(
                'SELECT * FROM clients WHERE name = $1 AND user_phone = $2',
                [clientName, userPhone]
            );
            
            if (!client) {
                // Create new client
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
                
                this.logger.info(`Auto-registered new client: ${clientName} (ID: ${client.id}) with phone: ${clientPhone}`);
            } else {
                // Update existing client phone if provided and different
                if (clientPhone && client.phone !== clientPhone) {
                    await this.db.run(
                        `UPDATE clients SET phone = $1, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $2`,
                        [clientPhone, client.id]
                    );
                    client.phone = clientPhone;
                    this.logger.info(`Updated client phone: ${clientName} (ID: ${client.id}) new phone: ${clientPhone}`);
                }
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
    async generateConfirmationMessage(parsed, clientName, userPhone) {
        const typeText = parsed.type === 'PIUTANG' ? 'berhutang' : 'Anda berhutang';
        const directionText = parsed.type === 'PIUTANG' ? 'kepada Anda' : `ke ${clientName}`;
        
        // Check if client already exists and has phone number
        let existingClient = null;
        try {
            existingClient = await this.db.get(
                'SELECT * FROM clients WHERE name = $1 AND user_phone = $2',
                [clientName, userPhone]
            );
        } catch (error) {
            this.logger.error('Error checking existing client:', error);
        }
        
        let message = `Baik, jadi ${parsed.type === 'PIUTANG' ? clientName : 'Anda'} ${typeText} ${parsed.description} sebesar Rp ${this.formatCurrency(parsed.amount)} ${directionText}.`;
        
        // Only ask for phone number if client doesn't exist or doesn't have phone
        if (!existingClient || !existingClient.phone) {
            message += `\n\n📱 Silakan masukkan nomor WhatsApp ${clientName}:\n💡 Format: 08xxxxxxxxxx atau 62xxxxxxxxxx\nAtau ketik "tidak" jika tidak punya nomor HP`;
        } else {
            message += `\n\n📱 Client sudah terdaftar dengan nomor: ${existingClient.phone}\n\n✅ Balas dengan "YA" atau "KONFIRMASI" untuk menyimpan transaksi\n❌ Balas dengan "BATAL" untuk membatalkan`;
        }
        
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

    /**
     * Delete debt/receivable record
     */
    async deleteDebtReceivable(userPhone, recordId) {
        try {
            // First get the record details for confirmation
            const record = await this.db.get(
                `SELECT dr.*, c.name as client_name
                 FROM debt_receivables dr
                 JOIN clients c ON dr.client_id = c.id
                 WHERE dr.id = $1 AND dr.user_phone = $2`,
                [recordId, userPhone]
            );
            
            if (!record) {
                throw new Error('Record not found or not authorized');
            }
            
            // Delete the record
            const deleted = await this.db.run(
                `DELETE FROM debt_receivables
                 WHERE id = $1 AND user_phone = $2`,
                [recordId, userPhone]
            );
            
            if (deleted.changes === 0) {
                throw new Error('Failed to delete record');
            }
            
            return {
                success: true,
                deletedRecord: record
            };
            
        } catch (error) {
            this.logger.error('Error deleting debt/receivable:', error);
            throw error;
        }
    }

    /**
     * Search clients by name
     */
    async searchClientsByName(userPhone, searchName) {
        try {
            const clients = await this.db.all(
                `SELECT c.*,
                        COUNT(dr.id) as total_records,
                        SUM(CASE WHEN dr.type = 'PIUTANG' AND dr.status = 'active' THEN dr.amount ELSE 0 END) as total_piutang,
                        SUM(CASE WHEN dr.type = 'HUTANG' AND dr.status = 'active' THEN dr.amount ELSE 0 END) as total_hutang
                 FROM clients c
                 LEFT JOIN debt_receivables dr ON c.id = dr.client_id AND dr.status = 'active'
                 WHERE c.user_phone = $1 AND LOWER(c.name) LIKE LOWER($2)
                 GROUP BY c.id, c.name, c.phone, c.email, c.address, c.notes, c.created_at, c.updated_at
                 ORDER BY c.name`,
                [userPhone, `%${searchName}%`]
            );
            
            return clients;
            
        } catch (error) {
            this.logger.error('Error searching clients:', error);
            throw error;
        }
    }

    /**
     * Get client details with all debt/receivable records
     */
    async getClientDetails(userPhone, clientName) {
        try {
            // Get client info
            const client = await this.db.get(
                `SELECT * FROM clients
                 WHERE user_phone = $1 AND name = $2`,
                [userPhone, clientName]
            );
            
            if (!client) {
                throw new Error('Client not found');
            }
            
            // Get all debt/receivable records for this client
            const records = await this.db.all(
                `SELECT * FROM debt_receivables
                 WHERE client_id = $1 AND user_phone = $2
                 ORDER BY created_at DESC`,
                [client.id, userPhone]
            );
            
            // Calculate totals
            const summary = {
                total_piutang_active: 0,
                total_hutang_active: 0,
                total_piutang_paid: 0,
                total_hutang_paid: 0,
                total_records: records.length
            };
            
            records.forEach(record => {
                if (record.status === 'active') {
                    if (record.type === 'PIUTANG') {
                        summary.total_piutang_active += parseFloat(record.amount);
                    } else {
                        summary.total_hutang_active += parseFloat(record.amount);
                    }
                } else if (record.status === 'paid') {
                    if (record.type === 'PIUTANG') {
                        summary.total_piutang_paid += parseFloat(record.amount);
                    } else {
                        summary.total_hutang_paid += parseFloat(record.amount);
                    }
                }
            });
            
            return {
                client,
                records,
                summary
            };
            
        } catch (error) {
            this.logger.error('Error getting client details:', error);
            throw error;
        }
    }

    /**
     * Get all clients with debt/receivable summary
     */
    async getAllClientsWithSummary(userPhone) {
        try {
            const clients = await this.db.all(
                `SELECT c.*,
                        COUNT(dr.id) as total_records,
                        SUM(CASE WHEN dr.type = 'PIUTANG' AND dr.status = 'active' THEN dr.amount ELSE 0 END) as total_piutang,
                        SUM(CASE WHEN dr.type = 'HUTANG' AND dr.status = 'active' THEN dr.amount ELSE 0 END) as total_hutang,
                        MAX(dr.created_at) as last_transaction
                 FROM clients c
                 LEFT JOIN debt_receivables dr ON c.id = dr.client_id
                 WHERE c.user_phone = $1
                 GROUP BY c.id, c.name, c.phone, c.email, c.address, c.notes, c.created_at, c.updated_at
                 HAVING COUNT(dr.id) > 0
                 ORDER BY last_transaction DESC`,
                [userPhone]
            );
            
            return clients;
            
        } catch (error) {
            this.logger.error('Error getting all clients with summary:', error);
            throw error;
        }
    }
}

module.exports = DebtReceivableService;