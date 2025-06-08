# 📋 Sistem Manajemen Hutang Piutang - WhatsApp Financial Bot

## 🎯 Overview

Fitur Sistem Manajemen Hutang Piutang adalah tambahan terbaru untuk WhatsApp Financial Bot yang memungkinkan pengguna untuk mengelola hutang dan piutang dengan mudah menggunakan Natural Language Processing (NLP) berbahasa Indonesia.

## ✨ Fitur Utama

### 1. **Natural Language Processing Bahasa Indonesia**
- AI dapat memahami berbagai format input bahasa Indonesia
- Auto-detect apakah input adalah HUTANG atau PIUTANG
- Extract nama client, nominal, dan deskripsi secara otomatis
- Confidence scoring untuk akurasi parsing

### 2. **Auto Client Registration**
- Otomatis mendaftarkan client baru saat pertama kali disebutkan
- Menyimpan nomor WhatsApp client untuk komunikasi
- Manajemen database client yang efisien

### 3. **Format Input yang Didukung**

#### Piutang (Orang berhutang ke user):
```
"Piutang Warung Madura Voucher Wifi 2Rebuan 200K"
"Teman kuliah pinjam 500K belum bayar"
"Pak Budi belum bayar jasa service laptop 300K"
"Adik sepupu hutang uang jajan 50K"
```

#### Hutang (User berhutang ke orang):
```
"Hutang ke Ibu warung nasi gudeg 25K"
"Saya pinjam ke Bank BRI KUR 50juta"
"Belum bayar cicilan motor ke dealer 1.5juta"
"Hutang uang makan ke teman kantor 100K"
```

### 4. **Command Interface**

#### Manual Commands:
- `/piutang [nama] [jumlah] [keterangan]` - Catat piutang
- `/hutang [nama] [jumlah] [keterangan]` - Catat hutang
- `/hutang-piutang [HUTANG/PIUTANG]` - Lihat daftar
- `/saldo-hutang` - Ringkasan hutang/piutang
- `/lunas [id]` - Tandai sebagai lunas

#### Natural Language:
Cukup ketik dalam bahasa natural, AI akan otomatis mendeteksi dan memproses.

## 🔧 Implementasi Teknis

### Database Schema

#### Tabel `clients`:
```sql
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
    UNIQUE(user_phone, name)
);
```

#### Tabel `debt_receivables`:
```sql
CREATE TABLE debt_receivables (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    client_id INTEGER NOT NULL,
    type VARCHAR(10) CHECK(type IN ('HUTANG', 'PIUTANG')) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK(status IN ('active', 'paid', 'cancelled')),
    due_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
```

### AI Processing Logic

1. **Input Validation**: Mengecek keyword hutang/piutang
2. **AI Parsing**: Menggunakan DeepSeek AI untuk extract informasi
3. **Confidence Scoring**: Menilai akurasi parsing (0.0-1.0)
4. **Data Cleaning**: Normalize nama client dan deskripsi
5. **Database Storage**: Menyimpan dengan auto client registration

### Response Pattern

```
Input: "Piutang Warung Madura Voucher Wifi 2Rebuan 200K"

AI Response: 
"Baik, jadi Warung Madura berhutang Voucher Wifi 2Rebuan sebesar Rp 200.000 kepada Anda. 
Apakah Anda punya nomor WhatsApp Warung Madura? Ya/Tidak"
```

## 📱 User Flow

### 1. Input Natural Language
User mengetik: `"Piutang Warung Madura Voucher Wifi 2Rebuan 200K"`

### 2. AI Processing & Confirmation
Bot memproses dan meminta konfirmasi:
```
"Baik, jadi Warung Madura berhutang Voucher Wifi 2Rebuan sebesar Rp 200.000 kepada Anda. 
Apakah Anda punya nomor WhatsApp Warung Madura? Ya/Tidak"
```

### 3. Phone Number Collection
- Jika "Ya": Bot meminta nomor WhatsApp
- Jika "Tidak": Lanjut tanpa nomor

### 4. Data Storage & Confirmation
```
✅ Piutang berhasil dicatat!

👤 Client: Warung Madura
📱 Phone: +6281234567890
💰 Jumlah: Rp 200.000
📝 Keterangan: Voucher Wifi 2Rebuan
📋 Status: Warung Madura berhutang kepada Anda
🆔 ID: 123

🤖 Tingkat Keyakinan AI: 95%
📊 Sisa kuota: 45/50
```

## 🎯 Format Nominal yang Didukung

- `200K` → 200,000
- `1.5juta` → 1,500,000
- `2Rebuan` → 2,000
- `50ribu` → 50,000
- `1.2 juta` → 1,200,000
- `150000` → 150,000

## 📊 Laporan dan Tracking

### Summary Command: `/saldo-hutang`
```
💰 Ringkasan Hutang Piutang

📈 Total Piutang: Rp 1.200.000
📊 Jumlah: 3 transaksi

📉 Total Hutang: Rp 500.000
📊 Jumlah: 2 transaksi

📈 Saldo Bersih: +Rp 700.000

💡 Tips:
• /hutang-piutang untuk lihat detail
• /lunas [ID] untuk tandai lunas
```

### List Command: `/hutang-piutang`
```
📋 Daftar Hutang Piutang

📈 PIUTANG (2):
1. Warung Madura
   💰 Rp 200.000
   📝 Voucher Wifi 2Rebuan
   🆔 ID: 123
   📱 6281234567890

2. Client Desain
   💰 Rp 500.000
   📝 jasa desain website
   🆔 ID: 124

📉 HUTANG (1):
1. Toko Budi
   💰 Rp 150.000
   📝 sembako bulanan
   🆔 ID: 125

💡 Tip: Gunakan /lunas [ID] untuk menandai sebagai lunas
```

## 🔐 Security & Validation

### Phone Number Validation
- Format Indonesia: `08xxxxxxxxxx` atau `62xxxxxxxxxx`
- Auto-normalisasi ke format internasional
- Validasi panjang dan format

### Data Validation
- Amount validation (must be positive number)
- Client name cleaning dan formatting
- Description normalization
- Type validation (HUTANG/PIUTANG only)

### Access Control
- Integrated dengan subscription system
- Transaction limit enforcement
- User authentication required

## 🚀 Integration Points

### Dengan Sistem Existing:
1. **Database Manager**: Menggunakan PostgreSQL existing
2. **CommandHandler**: Terintegrasi dengan command system
3. **AI Service**: Menggunakan DeepSeek AI existing
4. **Anti-Spam**: Protected dengan rate limiting
5. **Subscription**: Mengikuti quota system

### Global Variables:
- `global.pendingDebtReceivableConfirmations` - Untuk konfirmasi pending
- Timeout handling untuk session management

## 📝 Testing

Gunakan script test yang disediakan:
```bash
node test-debt-receivable.js
```

Test coverage:
- Natural language parsing accuracy
- Database schema validation
- Command handler integration
- Phone number validation
- Error handling

## 🎨 User Experience

### Bahasa Indonesia Native
- Semua response dalam bahasa Indonesia
- Pemahaman konteks Indonesia (warung, toko, pak, bu, dll)
- Format currency Indonesia (Rp)

### Conversational Flow
- Natural conversation flow
- Clear confirmation steps
- Helpful error messages
- Contextual tips dan guidance

### Mobile Optimized
- WhatsApp interface friendly
- Emoji untuk visual clarity
- Compact information display
- Quick action commands

## 🔮 Future Enhancements

### Planned Features:
1. **Due Date Management**: Tracking tanggal jatuh tempo
2. **Reminder System**: Otomatis reminder hutang/piutang
3. **Payment Tracking**: Partial payment support
4. **WhatsApp Integration**: Direct message ke client
5. **Export Reports**: PDF/Excel export
6. **Analytics**: Trend analysis hutang/piutang
7. **Categories**: Kategorisasi jenis hutang/piutang

### Potential Integrations:
- Payment gateway integration
- QR code generation untuk payment
- Voice message support
- Bulk import dari spreadsheet

## 💡 Tips Penggunaan

1. **Natural Language**: Gunakan bahasa sehari-hari, AI akan memahami
2. **Nama Konsisten**: Gunakan nama yang konsisten untuk client yang sama
3. **Detail Keterangan**: Berikan keterangan yang jelas untuk tracking
4. **Regular Update**: Tandai sebagai lunas secara berkala
5. **Backup Data**: Gunakan export feature untuk backup

## 🤝 Contributing

Untuk mengembangkan fitur ini lebih lanjut:
1. Fork repository
2. Buat feature branch
3. Test menggunakan `test-debt-receivable.js`
4. Submit pull request dengan documentation

---

**Developed by**: AI Assistant untuk KasAI WhatsApp Financial Bot
**Version**: 1.0.0
**Last Updated**: Desember 2024