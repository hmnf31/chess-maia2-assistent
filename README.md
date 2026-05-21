<<<<<<< HEAD
# Maia-2 Human-like Chess Engine

Chrome Extension + Flask Server berbasis **Maia-2** (NeurIPS 2024) — model AI catur yang memprediksi langkah seperti **manusia** berdasarkan level ELO, bukan engine penghitung varian.

Berbeda dengan Stockfish/LC0 yang mencari langkah **terkuat**, Maia-2 memprediksi langkah yang paling mungkin dimainkan **manusia** di rating tertentu. Proyek ini menambahkan layer **persona, emosi, fatigue, style biasing, dan repertoire memory** di atas Maia-2 untuk simulasi kepribadian yang lebih realistis.

---

## Fitur

### Persona System
6 kepribadian dengan parameter unik:

| Persona | ELO | Temperamen | Gaya | Emosi | Fatigue |
|---------|-----|-----------|------|-------|---------|
| Pemula Antusias | 1200 | 0.95 | Agresif | Aktif | Aktif |
| Pemain Klub | 1500 | 0.70 | Solid | Aktif | Aktif |
| Tournament Grinder | 1800 | 0.45 | Positional | Aktif | Aktif |
| Talenta Muda | 2100 | 0.35 | Agresif | Aktif | Nonaktif |
| Master Senior | 2400 | 0.15 | Technical | Nonaktif | Nonaktif |
| The Joker | 1400 | 1.50 | Acak | Aktif | Aktif |

### Human-like Behaviour
- **Stochastic Sampling** — memilih langkah dengan sampling dari distribusi probabilitas (bukan argmax), dikontrol oleh temperature
- **Emotion State Machine** — mood berubah berdasarkan performa: calm, confident, frustrated, tired, pressured, aggressive
- **Style Biasing** — preferensi gaya main (positional, aggressive, solid, technical)
- **Fatigue System** — akurasi menurun pada game panjang (>40 langkah)
- **Transposition Table** — repertoire konsisten: posisi yang sama selalu dijawab langkah yang sama

### Chrome Extension Features
- **Multi-Line Analysis** — top 5 langkah dengan arrow warna berbeda + persentase
- **Eval Bar** — win probability bar real-time (seperti Stockfish eval bar)
- **Blunder Detection** — peringatan jika langkah menyimpang jauh dari rekomendasi
- **End Game Analysis** — analisis otomatis setelah game selesai (accuracy %, blunder count, mood dominan)
- **Castling Rights** — FEN sekarang menyertakan hak castling (rokade tidak lagi dianggap illegal)

---

## Struktur Proyek

```
servermaia2/
├── server.py              # Flask API server (endpoints)
├── jalankan_server.bat    # Script untuk menjalankan server
├── test_maia.py           # Test loading model
├── requirements.txt       # Python dependencies
│
├── maia2/                 # Library Maia-2 original + file extension
│   ├── __init__.py
│   ├── model.py           # Model loading from_pretrained()
│   ├── inference.py       # Inference functions
│   ├── main.py            # Model architecture (MAIA2Model, Transformer)
│   ├── utils.py           # Utilities (FEN parsing, elo dict, etc.)
│   ├── dataset.py         # Dataset classes
│   ├── train.py           # Training pipeline
│   ├── content.js         # Chrome content script
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Extension popup logic
│   └── manifest.json      # Chrome extension manifest
│
├── extension/             # Chrome extension folder (load ini di browser)
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   └── popup.js
│
├── maia2_models/          # Model weights (auto-downloaded)
│   └── *.pt
│
└── repertoire.json        # Transposition table (auto-generated)
```

---

## Cara Instalasi & Penggunaan

### 1. Install Dependencies

```bash
pip install torch flask flask-cors numpy chess gdown pyzstd einops pandas pyyaml requests tqdm
```

### 2. Download Model

Jalankan test untuk mendownload model Maia-2:
```bash
python test_maia.py
```
Atau langsung start server — model akan otomatis di-download saat pertama kali.

### 3. Start Server

```bash
python server.py
```
Atau klik dua kali `jalankan_server.bat`.

Server berjalan di `http://127.0.0.1:5000`.

### 4. Load Chrome Extension

1. Buka `chrome://extensions`
2. Enable **Developer mode**
3. Klik **Load unpacked**
4. Pilih folder `extension/`
5. Extension siap digunakan

### 5. Buka chess.com atau lichess.org

Extension otomatis aktif. Pilih persona dari popup extension.

---

## API Endpoints

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/predict` | POST | Prediksi langkah terbaik + top 5 + mood + persona |
| `/evaluate_move` | POST | Evaluasi langkah user (blunder/inaccuracy) |
| `/analyze_game` | POST | Analisis game setelah selesai |
| `/predict_top5` | POST | Top 5 langkah saja |
| `/reset_emotion` | POST | Reset mood ke calm |
| `/repertoire` | GET/POST/DELETE | Manage transposition table |
| `/personas` | GET | Daftar persona profile |

### Contoh Request `/predict`

```json
{
  "fen": "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -",
  "elo_self": 1500,
  "elo_oppo": 1500,
  "mode": "blitz",
  "persona": "club_player"
}
```

### Response

```json
{
  "bestmove": "d4d5",
  "win_prob": 0.52,
  "top_moves": [
    {"move": "d4d5", "prob": 0.38},
    {"move": "e4e5", "prob": 0.22},
    {"move": "Bg5", "prob": 0.15}
  ],
  "persona_label": "Pemain Klub",
  "mood": "calm",
  "move_count": 12,
  "from_repertoire": false
}
```

---

## Persona Customization

Persona bisa dikustomisasi langsung di `server.py` di dictionary `PERSONAS` (line 21-64):

```python
"my_custom_persona": {
    "label": "My Style",
    "elo_self": 1700, "elo_oppo": 1650,
    "temperature": 0.5,
    "style": "positional",
    "emotion_enabled": True,
    "fatigue_enabled": True,
    "description": "Custom description"
}
```

Parameter:
- `elo_self` / `elo_oppo` — level ELO (800-3500)
- `temperature` — 0.05 (sangat konsisten) sampai 3.0 (sangat acak)
- `style` — aggressive, positional, solid, technical, universal
- `emotion_enabled` — apakah mood mempengaruhi temperature
- `fatigue_enabled` — apakah fatigue mempengaruhi akurasi di game panjang

---

## Tech Stack

- **Model:** Maia-2 (NeurIPS 2024) — PyTorch
- **Backend:** Flask (Python)
- **Frontend:** Chrome Extension (Manifest V3)
- **Chess:** python-chess
- **Compute:** CPU (GPU optional)

---

## Credits

- [Maia-2](https://github.com/CSSLab/maia2) — NeurIPS 2024 paper by CSSLab, University of Toronto
- Original Maia-2 research: [arXiv:2409.20553](https://arxiv.org/abs/2409.20553)

---

## License

MIT
=======
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

Dibuat oleh **hmnf31** — proyek spesial untuk client di TikTok.

TikTok: [@fajarsadchess](https://tiktok.com/@fajarsadchess)

## 📄 Lisensi

Proyek ini menggunakan Maia-2 ([MIT License](servermaia2/maia2/LICENSE)) dan kode tambahan di bawah lisensi MIT.


>>>>>>> 207f98cca6bceb1c811290cd207f4d18a7b954db
