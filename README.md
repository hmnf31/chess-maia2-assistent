# ♟️ Chess Maia-2 Assistant

Asisten catur berbasis AI yang menggunakan **Maia-2** untuk memberikan prediksi langkah catur ala manusia. Proyek ini terdiri dari server backend (Python/Flask) dan ekstensi Chrome yang menggambar langkah terbaik langsung di papan Chess.com / Lichess.

## ✨ Fitur

- **Maia-2 Engine** — Model catur yang dilatih dari jutaan permainan manusia
- **Visual Hint** — Panah hijau otomatis untuk langkah terbaik
- **Multi-Mode** — Dukungan mode Blitz & Rapid
- **ELO Custom** — Sesuaikan target ELO pemain dan lawan
- **Castling Support** — Deteksi rokade pendek/panjang
- **Real-time Sync** — Deteksi perubahan papan otomatis

## 🧱 Struktur Proyek

```
Chess-Maia2/
├── extension/           # Ekstensi Chrome
│   ├── manifest.json
│   ├── content.js       # Inject ke Chess.com/Lichess
│   ├── popup.html       # Panel pengaturan
│   └── popup.js
├── servermaia2/         # Backend Python
│   ├── server.py        # Flask API server
│   ├── test_maia.py     # Test model
│   ├── jalankan_server.bat
│   └── maia2/           # Library Maia-2 (official)
└── README.md
```

## 🛠️ Persyaratan

- Python 3.10+
- Google Chrome
- Library: `flask`, `flask-cors`, `torch`, `python-chess`, `gdown`, `pyzstd`, `einops`

## 🚀 Cara Pakai

### 1. Install dependencies
```bash
pip install flask flask-cors torch python-chess gdown pyzstd einops
```

### 2. Jalankan server
```bash
cd servermaia2
python server.py
```

### 3. Muat ekstensi Chrome
- Buka `chrome://extensions`
- Aktifkan **Developer mode**
- Klik **Load unpacked**
- Pilih folder `extension`

### 4. Buka Chess.com
Setelah server berjalan dan ekstensi aktif, panah hijau akan muncul secara otomatis di papan catur.

## 👤 Pembuat

Dibuat oleh **Fajar Sad Chess** — proyek spesial untuk client TikTok.

TikTok: [@fajarsadchess](https://tiktok.com/@fajarsadchess)

## 📄 Lisensi

Proyek ini menggunakan Maia-2 ([MIT License](servermaia2/maia2/LICENSE)) dan kode tambahan di bawah lisensi MIT.
