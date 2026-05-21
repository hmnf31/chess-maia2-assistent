from flask import Flask, request, jsonify
from flask_cors import CORS
import torch

# Pastikan folder 'maia2' ada di direktori yang sama dengan server.py ini
from maia2 import model, inference

app = Flask(__name__)
CORS(app)

# Dictionary untuk menyimpan model yang sudah di-load ke memory agar tidak lag
loaded_models = {}
device = "cuda" if torch.cuda.is_available() else "cpu"

print(f"🚀 Menjalankan Maia-2 Server di perangkat: {device.upper()}")

# Inisialisasi prepare() sesuai dokumentasi
prepared = inference.prepare()

def get_maia_model(mode_type):
    """Fungsi untuk load model (blitz/rapid) secara dinamis jika belum ada di memory"""
    global loaded_models
    if mode_type not in loaded_models:
        print(f"⏳ Memuat model Maia-2 ({mode_type}) ke memori...")
        loaded_models[mode_type] = model.from_pretrained(type=mode_type, device=device)
        print(f"✅ Model {mode_type} berhasil dimuat!")
    return loaded_models[mode_type]


@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        fen = data.get('fen')
        elo_self = int(data.get('elo_self', 2800))
        elo_oppo = int(data.get('elo_oppo', 2750))
        mode = data.get('mode', 'blitz')  # 'blitz' atau 'rapid'

        if not fen:
            return jsonify({"error": "FEN tidak boleh kosong"}), 400

        # Ambil model berdasarkan mode dari dropdown ekstensi
        maia2_model = get_maia_model(mode)

        # Proses Inference sesuai dokumentasi Maia-2
        move_probs, win_prob = inference.inference_each(
            maia2_model, 
            prepared, 
            fen, 
            elo_self, 
            elo_oppo
        )

        # Cari langkah dengan probabilitas tertinggi
        best_move = max(move_probs, key=move_probs.get)

        return jsonify({
            "bestmove": best_move,
            "win_prob": float(win_prob),
            "move_probs": move_probs  # Bisa digunakan jika Anda mau melihat kandidat langkah lain
        })

    except Exception as e:
        print(f"Error saat prediksi: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    # Jangan gunakan debug=True untuk mode produksi agar performa tidak terpotong
    app.run(host="127.0.0.1", port=5000, threaded=True)

    