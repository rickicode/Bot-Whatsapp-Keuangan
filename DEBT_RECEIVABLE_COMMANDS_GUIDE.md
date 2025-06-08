# 📋 Panduan Commands Hutang dan Piutang

## 🎯 Commands yang Tersedia

### 📊 **Melihat Daftar Lengkap**
```
/hutang-piutang
```
- Menampilkan semua hutang dan piutang
- Dikelompokkan berdasarkan tipe (PIUTANG dan HUTANG)
- Menampilkan detail lengkap setiap record

### 📈 **Melihat Daftar Piutang Saja**
```
/daftar-piutang
/receivable-list
/hutang-piutang PIUTANG
```
- Menampilkan hanya daftar piutang
- Siapa yang berhutang kepada Anda

### 📉 **Melihat Daftar Hutang Saja**
```
/daftar-hutang
/debt-list
/hutang-piutang HUTANG
```
- Menampilkan hanya daftar hutang
- Kepada siapa Anda berhutang

### 💰 **Ringkasan Saldo Hutang-Piutang**
```
/saldo-hutang
/debt-summary
```
- Total piutang yang akan diterima
- Total hutang yang harus dibayar
- Saldo bersih hutang-piutang

### ✅ **Menandai Sebagai Lunas**
```
/lunas [ID]
/paid [ID]
```
- Contoh: `/lunas 123`
- Menandai hutang/piutang dengan ID tertentu sebagai lunas

## 📱 **Contoh Penggunaan**

### **1. Melihat Semua Hutang-Piutang**
```
User: /hutang-piutang
Bot: 📋 Daftar Hutang Piutang

📈 PIUTANG (2):
1. Warung Madura
   💰 Rp 200.000
   📝 Voucher Wifi 2rebuan
   🆔 ID: 123
   📱 6282817728312

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

### **2. Melihat Piutang Saja**
```
User: /daftar-piutang
Bot: 📋 Daftar Hutang Piutang

📈 PIUTANG (2):
1. Warung Madura
   💰 Rp 200.000
   📝 Voucher Wifi 2rebuan
   🆔 ID: 123
   📱 6282817728312

2. Client Desain
   💰 Rp 500.000
   📝 jasa desain website
   🆔 ID: 124
```

### **3. Melihat Hutang Saja**
```
User: /daftar-hutang
Bot: 📋 Daftar Hutang Piutang

📉 HUTANG (1):
1. Toko Budi
   💰 Rp 150.000
   📝 sembako bulanan
   🆔 ID: 125
```

### **4. Melihat Ringkasan**
```
User: /saldo-hutang
Bot: 💰 Ringkasan Hutang Piutang

📈 Total Piutang: Rp 700.000 (2 items)
📉 Total Hutang: Rp 150.000 (1 item)
📊 Saldo Bersih: +Rp 550.000

💡 Tips:
• /hutang-piutang untuk lihat detail
• /lunas [ID] untuk tandai lunas
```

### **5. Menandai Sebagai Lunas**
```
User: /lunas 123
Bot: ✅ Hutang/Piutang ID 123 telah ditandai sebagai lunas!

📊 Gunakan /saldo-hutang untuk melihat ringkasan terbaru
```

## 🔧 **Commands Alternatif**

| Bahasa Indonesia | English | Fungsi |
|-----------------|---------|---------|
| `/hutang-piutang` | `/debt-receivable` | Daftar lengkap |
| `/daftar-piutang` | `/receivable-list` | Piutang saja |
| `/daftar-hutang` | `/debt-list` | Hutang saja |
| `/saldo-hutang` | `/debt-summary` | Ringkasan |
| `/lunas` | `/paid` | Tandai lunas |

## 💡 **Tips Penggunaan**

1. **Filter Otomatis**: Commands `/daftar-piutang` dan `/daftar-hutang` sudah otomatis memfilter berdasarkan tipe
2. **ID Management**: Setiap hutang/piutang memiliki ID unik untuk tracking
3. **Phone Number**: Nomor HP client ditampilkan jika tersedia
4. **Status Tracking**: Status "active" atau "paid" untuk setiap record
5. **Saldo Bersih**: Hitung otomatis selisih piutang vs hutang

## 🚀 **Quick Access**

**Yang paling sering digunakan:**
- `/daftar-piutang` - Siapa yang hutang ke saya?
- `/daftar-hutang` - Saya hutang ke siapa?
- `/saldo-hutang` - Berapa total saldo hutang-piutang?

---

**🎉 Semua commands sudah tersedia dan siap digunakan!**