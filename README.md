# Muka App 🎵

Aplikasi streaming & download musik/video YouTube dengan desain modern.

## Cara Menjalankan

### 1. Buka Langsung di Browser
Buka file `index.html` di browser. Untuk tampilan mobile terbaik, gunakan DevTools (F12) → Toggle Device Toolbar → pilih ukuran HP.

### 2. Jalankan sebagai Web Server (Recommended)
```bash
# Dengan Python
python -m http.server 8080

# Dengan Node.js (npx)
npx serve .
```
Lalu buka: `http://localhost:8080`

### 3. Konversi ke APK (Android)
Gunakan **Capacitor** untuk membungkus menjadi APK:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Muka" "com.muka.app"
npx cap add android
npx cap copy
npx cap open android
```
Lalu build APK dari Android Studio.

---

## Fitur

| Tab | Fitur |
|-----|-------|
| 🏠 Beranda | Feed video, search YouTube, download & share |
| 🎵 Musik | Pilihan cepat, playlist trending komunitas |
| 📥 File Saya | Daftar file yang diunduh, hapus file |
| ⚙️ Pengaturan | Akun, bahasa, toggle pencarian cepat, sosmed |

## Mengaktifkan YouTube API (Opsional)

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru → Enable **YouTube Data API v3**
3. Buat API Key
4. Ganti `YOUR_YOUTUBE_API_KEY` di `app.js` baris pertama

Tanpa API key, aplikasi berjalan dalam **mode demo** dengan data sampel.

## Stack Teknologi

- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Storage**: localStorage (untuk daftar file)
- **API**: YouTube Data API v3 (opsional)
- **PWA**: Web App Manifest untuk install ke homescreen

## Struktur File

```
muka_app/
├── index.html      # Struktur UI utama
├── styles.css      # Semua styling (mobile-first)
├── app.js          # Logic aplikasi
├── manifest.json   # PWA manifest
└── assets/
    ├── logo.svg              # Logo Muka
    └── thumb-placeholder.svg # Placeholder thumbnail
```
