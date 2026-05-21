---
title: Maia-2 Human-like Chess Engine
emoji: ♟️
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# Maia-2 Human-like Chess Engine

Chrome Extension + Flask Server berbasis **Maia-2** (NeurIPS 2024) — model AI catur yang memprediksi langkah seperti **manusia** berdasarkan level ELO, bukan engine penghitung varian.

Berbeda dengan Stockfish/LC0 yang mencari langkah **terkuat**, Maia-2 memprediksi langkah yang paling mungkin dimainkan **manusia** di rating tertentu. Proyek ini menambahkan layer **persona, emosi, fatigue, style biasing, dan repertoire memory** di atas Maia-2 untuk simulasi kepribadian yang lebih realistis.

---

## Dual-Server Mode

Proyek mendukung **dua mode** koneksi:

| Mode | URL | Kegunaan |
|------|-----|----------|
| **Local** | `http://127.0.0.1:5000` | Development, offline, tanpa internet |
| **Online (HF Spaces)** | `https://hmnf31-maia2online.hf.space` | Produksi, langsung pakai, tanpa instal Python |

Extension otomatis default ke **server online** — langsung bisa dipakai tanpa menjalankan server lokal.

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
- **Eval Bar** — win probability bar real-time
- **Blunder Detection** — peringatan jika langkah menyimpang jauh dari rekomendasi
- **End Game Analysis** — analisis otomatis setelah game selesai
- **Server URL Config** — ganti antara server lokal dan online dari popup extension
- **API Key Support** — proteksi server online dengan key

---

## Cara Pakai (Online — Tanpa Install Python)

Langsung pakai server online di Hugging Face Spaces:

1. Buka `chrome://extensions`
2. Enable **Developer mode**
3. Klik **Load unpacked**
4. Pilih folder `extension/`
5. Buka Chess.com atau Lichess.org
6. Extension otomatis connect ke server online

Extension sudah default ke `https://hmnf31-maia2online.hf.space` — tidak perlu setting apapun.

### Ganti ke Server Lokal (Opsional)

Buka popup extension, ubah URL ke `http://127.0.0.1:5000`, klik **Test**, lalu **Simpan**.

---

## Cara Pakai (Local — Server Python)

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Download Model

Jalankan test untuk mendownload model Maia-2:
```bash
python test_maia.py
```
Atau langsung start server — model akan otomatis di-download saat pertama kali dari Google Drive.

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

### 5. Buka chess.com atau lichess.org

Extension otomatis aktif. Pilih persona dari popup extension.

---

## HF Spaces (Deploy Sendiri)

Server sudah di-deploy di `https://hmnf31-maia2online.hf.space`. Untuk deploy ulang atau kustomisasi:

```bash
cd hf_maia2online
git add -A
git commit -m "update"
git push origin main
```

HF Spaces auto-build dan auto-deploy dari push ke repo `huggingface.co/spaces/Hmnf31/maia2online`.

### Set API Key (Opsional)

```bash
curl -X POST https://huggingface.co/api/spaces/Hmnf31/maia2online/secret \
  -H "Authorization: Bearer YOUR_HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "MAIA_API_KEY", "value": "your-secret-key"}'
```

---

## API Endpoints

### Daftar Endpoint

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/` | GET | Halaman web UI (config panel + evaluator) |
| `/api/health` | GET | Health check |
| `/personas` | GET | Daftar persona profile |
| `/predict` | POST | Prediksi langkah terbaik + top 5 + mood + persona |
| `/predict_top5` | POST | Top 5 langkah saja |
| `/evaluate_move` | POST | Evaluasi langkah user (blunder/inaccuracy) |
| `/analyze_game` | POST | Analisis game setelah selesai |
| `/reset_emotion` | POST | Reset mood ke calm |
| `/repertoire` | GET/POST/DELETE | Manage transposition table |

### Contoh Request `/predict`

```json
{
  "fen": "rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq -",
  "elo_self": 1500,
  "elo_oppo": 1500,
  "mode": "blitz",
  "persona": "club_player",
  "temperature": 0.7,
  "style": "aggressive",
  "bias_strength": 0.2,
  "emotion_enabled": true,
  "fatigue_enabled": true
}
```

### Response

```json
{
  "bestmove": "d4d5",
  "win_prob": 0.52,
  "top_moves": [
    {"move": "d4d5", "prob": 0.38},
    {"move": "e4e5", "prob": 0.22}
  ],
  "move_probs": {"d4d5": 0.38, "e4e5": 0.22, ...},
  "persona_label": "Pemain Klub",
  "mood": "calm",
  "move_count": 12,
  "from_repertoire": false
}
```

### Parameter `/predict` Lengkap

| Parameter | Tipe | Default | Deskripsi |
|-----------|------|---------|-----------|
| `fen` | string | required | FEN posisi catur |
| `persona` | string | `"club_player"` | Nama persona |
| `mode` | string | `"blitz"` | `"blitz"` atau `"rapid"` |
| `elo_self` | int | dari persona | ELO pemain |
| `elo_oppo` | int | dari persona | ELO lawan |
| `temperature` | float | dari persona | Randomness (0.05–3.0) |
| `style` | string | dari persona | Override gaya: `aggressive`, `positional`, `solid`, `technical`, `universal` |
| `bias_strength` | float | 0.15 | Kekuatan style bias (0–0.5) |
| `emotion_enabled` | bool | dari persona | Aktifkan sistem emosi |
| `fatigue_enabled` | bool | dari persona | Aktifkan sistem fatigue |

---

## Web UI (HF Spaces)

Server menyediakan halaman web di `/` yang bisa digunakan untuk:

- Memilih persona dan melihat parameter detailnya
- Mengatur ELO, temperature, style bias
- Toggle emotion/fatigue system
- Input FEN + klik Analyze untuk evaluasi posisi
- Melihat best move, top 5 moves, win probability bar
- Melihat mood engine saat ini
- Reset emotion atau clear repertoire cache

Buka `https://hmnf31-maia2online.hf.space` di browser.

---

## Struktur Proyek

```
servermaia2/
├── server.py              # Flask API server (endpoints)
├── Dockerfile             # Docker image untuk HF Spaces
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html         # Web UI halaman config & evaluator
│
├── maia2/                 # Library Maia-2 original
│   ├── model.py           # Model loading from_pretrained()
│   ├── inference.py       # Inference functions
│   ├── main.py            # Model architecture
│   ├── utils.py           # Utilities
│   ├── content.js         # Chrome content script
│   ├── popup.html         # Extension popup UI
│   ├── popup.js           # Extension popup logic
│   └── manifest.json      # Chrome extension manifest
│
├── extension/             # Chrome extension folder (load ini)
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   └── popup.js
│
├── maia2_models/          # Model weights
│   └── blitz_model.pt
│
├── hf_maia2online/        # Git clone HF Spaces repo
│
└── repertoire.json        # Transposition table (auto-generated)
```

---

## Persona Customization

Persona bisa dikustomisasi langsung di `server.py` di dictionary `PERSONAS`:

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
- `elo_self` / `elo_oppo` — level ELO (800–3500)
- `temperature` — 0.05 (sangat konsisten) sampai 3.0 (sangat acak)
- `style` — aggressive, positional, solid, technical, universal
- `emotion_enabled` — apakah mood mempengaruhi temperature
- `fatigue_enabled` — apakah fatigue mempengaruhi akurasi di game panjang

---

## Tech Stack

- **Model:** Maia-2 (NeurIPS 2024) — PyTorch
- **Backend:** Flask (Python)
- **Frontend:** Chrome Extension (Manifest V3) + Web UI (HTML/CSS/JS)
- **Hosting:** Hugging Face Spaces (CPU free tier)
- **Chess:** python-chess
- **Compute:** CPU (GPU optional)

---

## Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `PORT` | Port server (default: 7860) |
| `HF_SPACE` | Set `"1"` jika di HF Spaces |
| `MAIA_API_KEY` | API key untuk autentikasi |

---

## Credits

- [Maia-2](https://github.com/CSSLab/maia2) — NeurIPS 2024 paper by CSSLab, University of Toronto
- Original Maia-2 research: [arXiv:2409.20553](https://arxiv.org/abs/2409.20553)
- Hugging Face Spaces untuk hosting gratis

---

## License

MIT
