# 🔧 Quick Fix: Mengaktifkan Fitur AI Hutang Piutang

## ❌ Masalah yang Terjadi
Dari log error terlihat:
```
[ERROR] Error in parseDebtReceivableInput: {}
```

Ini menunjukkan AI service belum diaktifkan atau dikonfigurasi dengan benar.

## ✅ Solusi Cepat

### 1. **Pastikan Environment Variables AI Sudah Diset**

Periksa file `.env` Anda dan pastikan memiliki:

```env
# Enable AI Features
ENABLE_AI_FEATURES=true

# AI Provider Configuration
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_actual_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 2. **Jika Menggunakan Provider Lain**

#### Untuk OpenAI:
```env
ENABLE_AI_FEATURES=true
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
```

#### Untuk OpenAI Compatible (Groq, LocalAI, dll):
```env
ENABLE_AI_FEATURES=true
AI_PROVIDER=openaicompatible
OPENAI_COMPATIBLE_API_KEY=your_api_key_here
OPENAI_COMPATIBLE_BASE_URL=https://api.your-provider.com
OPENAI_COMPATIBLE_MODEL=your_model_name
```

### 3. **Restart Aplikasi**
Setelah mengubah environment variables:
```bash
# Stop aplikasi
# Kemudian start ulang
npm start
```

### 4. **Test Fitur**
Setelah restart, test dengan mengirim pesan:
```
Piutang Warung Madura Voucher Wifi 2rebuan 200K
```

## 🔍 Verifikasi AI Service

### Check AI Service Status:
Kirim pesan ke bot: `/status` atau `/health` untuk melihat status AI service.

### Manual Test:
Gunakan test script:
```bash
node test-debt-receivable.js
```

## 🚨 Troubleshooting

### Jika Masih Error:

1. **Periksa API Key Valid**
   - Pastikan API key benar dan memiliki kredit
   - Test API key dengan curl atau aplikasi lain

2. **Periksa Network Connection**
   - Pastikan server dapat akses internet
   - Test koneksi ke AI provider

3. **Periksa Log Detail**
   - Set `LOG_LEVEL=debug` untuk log lebih detail
   - Periksa log untuk error spesifik

### Error Messages yang Mungkin:

- `"AI service tidak tersedia"` → Set `ENABLE_AI_FEATURES=true`
- `"API key tidak valid"` → Periksa API key
- `"Rate limit tercapai"` → Tunggu atau upgrade plan
- `"Server AI provider sedang mengalami masalah"` → Coba lagi nanti

## 📋 Checklist Konfigurasi

- [ ] `ENABLE_AI_FEATURES=true` sudah diset
- [ ] AI provider dan API key sudah dikonfigurasi
- [ ] API key valid dan memiliki kredit
- [ ] Aplikasi sudah di-restart
- [ ] Test input hutang/piutang berhasil

## 🎯 Expected Behavior Setelah Fix

Input: `"Piutang Warung Madura Voucher Wifi 2rebuan 200K"`

Response yang diharapkan:
```
"Baik, jadi Warung Madura berhutang Voucher Wifi 2Rebuan sebesar Rp 200.000 kepada Anda. 
Apakah Anda punya nomor WhatsApp Warung Madura? Ya/Tidak"
```

## 🔗 Link Terkait

- [AI Configuration Documentation](docs/AI_SETUP.md)
- [DeepSeek API Documentation](https://api-docs.deepseek.com/)
- [Complete Feature Documentation](docs/DEBT_RECEIVABLE_FEATURE.md)

---

**Status**: ✅ Quick fix tersedia - aktifkan AI features untuk menggunakan fitur hutang piutang