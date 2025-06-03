# Fitur Bahasa Indonesia - Bot Keuangan WhatsApp

## 🇮🇩 Implementasi Lengkap Bahasa Indonesia

### ✅ Fitur yang Sudah Diimplementasi

#### 1. **Kategori Default dalam Bahasa Indonesia**
```
Kategori Pemasukan:
• Gaji
• Freelance  
• Bisnis
• Investasi
• Pemasukan Lain

Kategori Pengeluaran:
• Makanan
• Transportasi
• Utilitas
• Hiburan
• Kesehatan
• Belanja
• Pengeluaran Bisnis
• Pengeluaran Lain
```

#### 2. **AI Natural Language Processing (NLP) Bahasa Indonesia**
AI dapat memproses input alami dalam bahasa Indonesia:
- ✅ "Saya habis 50000 untuk makan siang hari ini"
- ✅ "Terima 500000 dari bayaran klien"
- ✅ "Beli bensin 100000"
- ✅ "Gaji bulan ini 5000000"

#### 3. **Deteksi Kategori Otomatis dengan AI**
AI dapat mendeteksi kategori yang tepat untuk transaksi:
- Makanan: makan, sarapan, siang, malam, restoran, warung
- Transportasi: bensin, ojek, bus, taxi, perjalanan
- Gaji: gaji, upah, honor, salary
- Freelance: klien, proyek, freelance, contract

#### 4. **Fitur Tanya Kategori Jika Tidak Diketahui**
Ketika AI tidak yakin dengan kategori (confidence rendah atau "unknown"):
1. Bot akan menanyakan kategori kepada pengguna
2. Menampilkan daftar kategori yang tersedia
3. Pengguna bisa memilih dengan nomor atau ketik nama kategori
4. Transaksi akan disimpan dengan kategori yang dipilih

#### 5. **Interface dalam Bahasa Indonesia**
Semua pesan bot menggunakan bahasa Indonesia:
- Pesan bantuan (/bantuan)
- Konfirmasi transaksi
- Pesan error
- Laporan keuangan

#### 6. **Currency Format Indonesia (IDR)**
- Format mata uang: Rp 50.000
- Menggunakan format Indonesia (id-ID)
- Simbol Rupiah (Rp) dari environment variable

### 🧪 Hasil Testing

#### Test AI Natural Language Processing:
```
Input: "Saya habis 50000 untuk makan siang hari ini"
Output: {
  "type": "expense",
  "amount": 50000,
  "description": "makan siang hari ini", 
  "category": "Makanan",
  "confidence": 0.9
}
```

#### Test Unknown Category Detection:
```
Input: "Beli sesuatu aneh 50000"
Output: {
  "category": "unknown",
  "confidence": 0.7
} 
→ Bot akan menanyakan kategori kepada pengguna
```

### ⚙️ Konfigurasi Environment

```env
# Language & Currency
DEFAULT_LANGUAGE=id
DEFAULT_CURRENCY=IDR
CURRENCY_SYMBOL=Rp

# Features
ASK_CATEGORY_IF_UNKNOWN=true
```

### 🎯 Cara Penggunaan

#### 1. **Input Natural Language (Bahasa Alami)**
```
"Saya habis 50000 untuk makan siang"
"Terima 1000000 gaji bulan ini"
"Beli bensin 100000 untuk motor"
"Bayar listrik 150000"
```

#### 2. **Perintah Manual**
```
/masuk 1000000 gaji bulan ini
/keluar 50000 makan siang makanan
/saldo
/laporan bulan
```

#### 3. **Ketika Kategori Tidak Diketahui**
```
User: "Beli sesuatu aneh 50000"
Bot: 🤔 Saya deteksi transaksi berikut:
     💰 Pengeluaran: Rp 50.000
     📝 Deskripsi: beli sesuatu aneh
     
     Namun saya tidak yakin dengan kategorinya. 
     Silakan pilih kategori yang sesuai:
     
     1. Makanan
     2. Transportasi  
     3. Utilitas
     4. Hiburan
     5. Kesehatan
     6. Belanja
     7. Pengeluaran Bisnis
     8. Pengeluaran Lain
     
     Balas dengan nomor kategori (1-8) atau ketik nama kategori.

User: "6" atau "Belanja"
Bot: ✅ Transaksi berhasil ditambahkan!
     💰 Pengeluaran: Rp 50.000
     📝 Deskripsi: beli sesuatu aneh
     🏷️ Kategori: Belanja
     🆔 ID: 123
```

### 🔧 Implementasi Teknis

#### 1. **AI Service (DeepSeek Integration)**
- Prompt dalam bahasa Indonesia
- Deteksi kategori "unknown" jika tidak yakin
- Sistem confidence scoring

#### 2. **Command Handler**
- Method `askForCategory()` untuk menanyakan kategori
- Method `handlePendingTransaction()` untuk menangani konfirmasi
- Global state `pendingTransactions` untuk menyimpan transaksi sementara

#### 3. **Database Schema**
- Kategori default dalam bahasa Indonesia
- Support untuk custom categories pengguna

#### 4. **Category Service**
- Keyword detection dalam bahasa Indonesia dan Inggris
- Fuzzy matching untuk kategori

### 🎉 Keunggulan Fitur

1. **User Experience yang Natural**: Pengguna bisa mengetik seperti berbicara normal
2. **Akurasi AI Tinggi**: Confidence 0.9 untuk input yang jelas
3. **Fallback yang Elegan**: Jika AI tidak yakin, bot akan bertanya kepada user
4. **Bilingual Support**: Mendukung input bahasa Indonesia dan Inggris
5. **Context Aware**: AI memahami konteks transaksi keuangan Indonesia

### 🚀 Ready for Production

Semua fitur bahasa Indonesia telah diimplementasi dan ditest:
- ✅ Natural Language Processing
- ✅ Kategori dalam bahasa Indonesia  
- ✅ Interface bahasa Indonesia
- ✅ Currency format IDR
- ✅ Fallback untuk kategori tidak diketahui
- ✅ Fully tested dan berfungsi dengan baik

Bot siap digunakan untuk pengguna Indonesia dengan pengalaman yang optimal dan natural!