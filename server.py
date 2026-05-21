from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import os
import random
import time as time_module

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

API_KEY = os.environ.get("MAIA_API_KEY")
HF_SPACE = os.environ.get("HF_SPACE", "0")

def require_auth():
    if not API_KEY:
        return None
    key = request.headers.get("X-API-Key") or (request.json or {}).get("api_key")
    if key != API_KEY:
        return jsonify({"error": "Unauthorized: invalid API key"}), 401
    return None

@app.before_request
def before_request():
    if request.method == "OPTIONS":
        return
    err = require_auth()
    if err:
        return err

_heavy = None

def _init_heavy():
    global _heavy
    if _heavy is not None:
        return _heavy
    import numpy as np
    import chess
    import torch
    from maia2 import model, inference
    _heavy = {"np": np, "chess": chess, "torch": torch, "model": model, "inference": inference}
    return _heavy



loaded_models = {}
_device = None

def get_device():
    global _device
    if _device is None:
        h = _init_heavy()
        _device = "cuda" if h["torch"].cuda.is_available() else "cpu"
        print(f"Menjalankan Maia-2 Human-like Server di: {_device.upper()}")
    return _device

_prepared = None

def get_prepared():
    global _prepared
    if _prepared is None:
        h = _init_heavy()
        print("Preparing inference dictionaries...")
        _prepared = h["inference"].prepare()
        print("Inference dictionaries ready.")
    return _prepared

def get_maia_model(mode_type):
    global loaded_models
    if mode_type not in loaded_models:
        h = _init_heavy()
        print(f"Memuat model Maia-2 ({mode_type}) ke memori...")
        loaded_models[mode_type] = h["model"].from_pretrained(type=mode_type, device=get_device())
        print(f"Model {mode_type} berhasil dimuat!")
    return loaded_models[mode_type]

PERSONAS = {
    "club_player": {
        "label": "Pemain Klub",
        "elo_self": 1500, "elo_oppo": 1500,
        "temperature": 0.7, "style": "solid",
        "emotion_enabled": True, "fatigue_enabled": True,
        "description": "Seperti pemain klub mingguan"
    },
    "tournament": {
        "label": "Tournament Grinder",
        "elo_self": 1800, "elo_oppo": 1750,
        "temperature": 0.45, "style": "positional",
        "emotion_enabled": True, "fatigue_enabled": True,
        "description": "Solid, jarang blunder"
    },
    "talented_youth": {
        "label": "Talenta Muda",
        "elo_self": 2100, "elo_oppo": 2050,
        "temperature": 0.35, "style": "aggressive",
        "emotion_enabled": True, "fatigue_enabled": False,
        "description": "Agresif, tajam, suka taktik"
    },
    "master": {
        "label": "Master Senior",
        "elo_self": 2400, "elo_oppo": 2350,
        "temperature": 0.15, "style": "technical",
        "emotion_enabled": False, "fatigue_enabled": False,
        "description": "Endgame kuat, jarang salah"
    },
    "beginner": {
        "label": "Pemula Antusias",
        "elo_self": 1200, "elo_oppo": 1200,
        "temperature": 0.95, "style": "aggressive",
        "emotion_enabled": True, "fatigue_enabled": True,
        "description": "Suka serang, suka blunder"
    },
    "joker": {
        "label": "The Joker",
        "elo_self": 1400, "elo_oppo": 1400,
        "temperature": 1.5, "style": "aggressive",
        "emotion_enabled": True, "fatigue_enabled": True,
        "description": "Anti-metode, unpredictable"
    }
}

REPERTOIRE_PATH = os.path.join(os.path.dirname(__file__), "repertoire.json")

def load_repertoire():
    if os.path.exists(REPERTOIRE_PATH):
        with open(REPERTOIRE_PATH, "r") as f:
            return json.load(f)
    return {}

def save_repertoire(table):
    with open(REPERTOIRE_PATH, "w") as f:
        json.dump(table, f, indent=2)

repertoire_table = load_repertoire()

class EmotionState:
    def __init__(self):
        self.mood = "calm"
        self.consecutive_good = 0
        self.consecutive_bad = 0
        self.total_moves = 0
        self.blunder_count = 0

    def update(self, move_was_good, is_blunder=False):
        self.total_moves += 1
        if is_blunder:
            self.blunder_count += 1
            self.consecutive_bad += 1
            self.consecutive_good = 0
        elif move_was_good:
            self.consecutive_good += 1
            self.consecutive_bad = 0
        else:
            self.consecutive_bad = 0
            self.consecutive_good = 0
        self._refresh_mood()

    def _refresh_mood(self):
        if self.blunder_count >= 3:
            self.mood = "frustrated"
        elif self.consecutive_good >= 5:
            self.mood = "confident"
        elif self.total_moves > 50:
            self.mood = "tired"
        elif self.consecutive_bad >= 2:
            self.mood = "pressured"
        else:
            self.mood = "calm"
        if self.mood == "confident" and self.consecutive_good >= 8:
            self.mood = "aggressive"

    def get_temperature_modifier(self):
        mods = {
            "calm": 0.0, "confident": -0.08, "frustrated": 0.2,
            "tired": 0.15, "pressured": 0.1, "aggressive": -0.05
        }
        return mods.get(self.mood, 0.0)

    def reset(self):
        self.mood = "calm"
        self.consecutive_good = 0
        self.consecutive_bad = 0
        self.total_moves = 0
        self.blunder_count = 0

emotion_state = EmotionState()

def stochastic_sample(move_probs, temperature=1.0):
    h = _init_heavy()
    np = h["np"]
    moves = list(move_probs.keys())
    probs = np.array([move_probs[m] for m in moves], dtype=np.float64)
    if temperature > 0 and temperature != 1.0:
        probs = np.power(np.maximum(probs, 1e-10), 1.0 / temperature)
    probs = probs / probs.sum()
    idx = np.random.choice(len(moves), p=probs)
    return moves[idx], probs[idx]

def apply_fatigue(move_probs, move_count, fatigue_enabled=True):
    if not fatigue_enabled:
        return move_probs
    if move_count > 40:
        h = _init_heavy()
        np = h["np"]
        noise = random.gauss(0, 0.015 * min((move_count - 40) / 20, 3))
        moves = list(move_probs.keys())
        probs = np.array([move_probs[m] for m in moves], dtype=np.float64)
        probs = np.maximum(probs + noise, 1e-10)
        probs = probs / probs.sum()
        return {moves[i]: float(probs[i]) for i in range(len(moves))}
    return move_probs

def style_bias_top_moves(move_probs, fen, style, bias_strength=0.15):
    if style == "universal":
        return move_probs
    h = _init_heavy()
    np = h["np"]
    chess = h["chess"]
    try:
        board = chess.Board(fen)
    except Exception:
        return move_probs
    moves = list(move_probs.keys())
    probs = np.array([move_probs[m] for m in moves], dtype=np.float64)
    scores = np.zeros(len(moves))
    for i, m in enumerate(moves):
        try:
            uci = chess.Move.from_uci(m)
            if uci in board.legal_moves:
                board.push(uci)
                is_check = board.is_check()
                is_capture = board.is_capture()
                is_castling = m in ["e1g1", "e1c1", "e8g8", "e8c8"]
                piece_count = len(board.piece_map())
                board.pop()
            else:
                continue
        except Exception:
            continue
        s = 0
        if style == "aggressive":
            if is_check: s += 2
            if is_capture: s += 1
            if is_castling: s -= 0.5
        elif style == "positional":
            if is_castling: s += 1.5
            if is_capture: s -= 0.3
            if is_check: s -= 0.5
        elif style == "solid":
            if is_castling: s += 1
            if is_capture: s += 0.3
            if is_check: s -= 0.2
        elif style == "technical":
            if is_capture and piece_count < 20: s += 1.5
            if is_castling: s += 0.5
        scores[i] = s
    scores_norm = scores - scores.min()
    if scores_norm.max() > 0:
        scores_norm = scores_norm / scores_norm.max()
    bias = bias_strength * scores_norm
    probs = probs * (1 + bias)
    probs = np.maximum(probs, 1e-10)
    probs = probs / probs.sum()
    return {moves[i]: float(probs[i]) for i in range(len(moves))}

def get_persona_config(persona_name):
    if persona_name in PERSONAS:
        return PERSONAS[persona_name]
    return PERSONAS["club_player"]

def resolve_params(persona_name, req_elo_self, req_elo_oppo, req_mode, req_temperature):
    pc = get_persona_config(persona_name)
    elo_self = req_elo_self if req_elo_self is not None else pc["elo_self"]
    elo_oppo = req_elo_oppo if req_elo_oppo is not None else pc["elo_oppo"]
    mode = req_mode if req_mode else "blitz"
    base_temp = req_temperature if req_temperature is not None else pc["temperature"]
    base_temp = max(0.05, min(3.0, base_temp))
    return elo_self, elo_oppo, mode, base_temp, pc

def get_top_moves(move_probs, n=5):
    sorted_moves = sorted(move_probs.items(), key=lambda x: x[1], reverse=True)
    return [{"move": m, "prob": round(p, 4)} for m, p in sorted_moves[:n]]

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "service": "maia2"})

@app.route("/personas", methods=["GET"])
def get_personas():
    return jsonify(PERSONAS)

@app.route("/predict", methods=["POST"])
def predict():
    global emotion_state, repertoire_table
    try:
        data = request.json
        fen = data.get("fen")
        req_elo_self = data.get("elo_self")
        req_elo_oppo = data.get("elo_oppo")
        req_mode = data.get("mode", "blitz")
        persona_name = data.get("persona", "club_player")
        req_temperature = data.get("temperature")
        style_override = data.get("style")
        bias_strength = data.get("bias_strength")
        req_emotion = data.get("emotion_enabled")
        req_fatigue = data.get("fatigue_enabled")

        if not fen:
            return jsonify({"error": "FEN tidak boleh kosong"}), 400

        elo_self, elo_oppo, mode, temperature, pc = resolve_params(
            persona_name, req_elo_self, req_elo_oppo, req_mode, req_temperature
        )

        effective_style = style_override if style_override else pc["style"]
        effective_bias = bias_strength if bias_strength is not None else 0.15
        effective_emotion = req_emotion if req_emotion is not None else pc["emotion_enabled"]
        effective_fatigue = req_fatigue if req_fatigue is not None else pc["fatigue_enabled"]

        if effective_emotion:
            temperature += emotion_state.get_temperature_modifier()
        temperature = max(0.05, min(3.0, temperature))

        h = _init_heavy()
        maia2_model = get_maia_model(mode)

        cached_move = repertoire_table.get(fen)
        if cached_move:
            move_probs, win_prob = h["inference"].inference_each(
                maia2_model, get_prepared(), fen, elo_self, elo_oppo
            )
            if cached_move in move_probs:
                for m in move_probs:
                    move_probs[m] = 1e-6 if m != cached_move else move_probs.get(cached_move, 0.5)
                total = sum(move_probs.values())
                for m in move_probs:
                    move_probs[m] /= total
                best_move = cached_move
                best_prob = move_probs[cached_move]
                top_moves = get_top_moves(move_probs)
                return jsonify({
                    "bestmove": best_move,
                    "win_prob": float(win_prob),
                    "top_moves": top_moves,
                    "move_probs": move_probs,
                    "persona_label": pc["label"],
                    "mood": emotion_state.mood,
                    "move_count": emotion_state.total_moves,
                    "from_repertoire": True
                })

        move_probs, win_prob = h["inference"].inference_each(
            maia2_model, get_prepared(), fen, elo_self, elo_oppo
        )

        move_probs = apply_fatigue(move_probs, emotion_state.total_moves, effective_fatigue)
        move_probs = style_bias_top_moves(move_probs, fen, effective_style, effective_bias)

        best_move, best_prob = stochastic_sample(move_probs, temperature)

        if fen not in repertoire_table:
            repertoire_table[fen] = best_move
            if len(repertoire_table) <= 10000:
                save_repertoire(repertoire_table)

        top_moves = get_top_moves(move_probs)

        return jsonify({
            "bestmove": best_move,
            "win_prob": float(win_prob),
            "top_moves": top_moves,
            "move_probs": move_probs,
            "persona_label": pc["label"],
            "mood": emotion_state.mood,
            "move_count": emotion_state.total_moves,
            "from_repertoire": False
        })

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/evaluate_move", methods=["POST"])
def evaluate_move():
    try:
        data = request.json
        fen = data.get("fen")
        move_uci = data.get("move")
        req_elo_self = data.get("elo_self")
        req_elo_oppo = data.get("elo_oppo")
        req_mode = data.get("mode", "blitz")
        persona_name = data.get("persona", "club_player")

        if not fen or not move_uci:
            return jsonify({"error": "FEN dan move diperlukan"}), 400

        elo_self, elo_oppo, mode, temperature, pc = resolve_params(
            persona_name, req_elo_self, req_elo_oppo, req_mode, None
        )
        h = _init_heavy()
        maia2_model = get_maia_model(mode)
        move_probs, win_prob = h["inference"].inference_each(
            maia2_model, get_prepared(), fen, elo_self, elo_oppo
        )

        user_prob = move_probs.get(move_uci, 0.0)
        best_move = max(move_probs, key=move_probs.get)
        best_prob = move_probs[best_move]

        is_blunder = user_prob < 0.05 or (best_prob > 0 and user_prob / best_prob < 0.1)
        is_inaccuracy = user_prob < 0.15 and user_prob >= 0.05

        emotion_state.update(move_was_good=(not is_blunder), is_blunder=is_blunder)

        response = {
            "user_move": move_uci,
            "user_prob": round(user_prob, 4),
            "best_move": best_move,
            "best_prob": round(best_prob, 4),
            "blunder": is_blunder,
            "inaccuracy": is_inaccuracy and not is_blunder
        }
        if is_blunder:
            response["blunder_msg"] = f"Blunder! Langkah terbaik: {best_move} ({best_prob*100:.1f}%)"
        elif is_inaccuracy:
            response["inaccuracy_msg"] = f"Kurang akurat. Coba {best_move} ({best_prob*100:.1f}%)"

        return jsonify(response)

    except Exception as e:
        print(f"Error evaluate_move: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/analyze_game", methods=["POST"])
def analyze_game():
    try:
        data = request.json
        game_history = data.get("game_history", [])

        total = len(game_history)
        if total == 0:
            return jsonify({
                "accuracy": 1.0, "total_moves": 0,
                "best_count": 0, "blunder_count": emotion_state.blunder_count,
                "inaccuracy_count": 0, "dominant_mood": emotion_state.mood
            })

        blunder_count = 0
        inaccuracy_count = 0
        correct_count = 0
        mood_counts = {}

        for entry in game_history:
            mood = entry.get("mood", "calm")
            mood_counts[mood] = mood_counts.get(mood, 0) + 1
            if entry.get("is_blunder"):
                blunder_count += 1
            elif entry.get("is_inaccuracy"):
                inaccuracy_count += 1
            else:
                correct_count += 1

        if blunder_count + inaccuracy_count + correct_count == 0:
            correct_count = total

        accuracy = max(0, 1.0 - (blunder_count + inaccuracy_count * 0.5) / max(total, 1))
        dominant_mood = max(mood_counts, key=mood_counts.get) if mood_counts else "calm"

        return jsonify({
            "accuracy": round(accuracy, 4),
            "total_moves": total,
            "best_count": correct_count,
            "blunder_count": blunder_count,
            "inaccuracy_count": inaccuracy_count,
            "dominant_mood": dominant_mood
        })

    except Exception as e:
        print(f"Error analyze_game: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/reset_emotion", methods=["POST"])
def reset_emotion():
    emotion_state.reset()
    return jsonify({"status": "ok", "mood": emotion_state.mood})

@app.route("/repertoire", methods=["GET", "POST", "DELETE"])
def handle_repertoire():
    global repertoire_table
    if request.method == "GET":
        return jsonify({"size": len(repertoire_table)})
    elif request.method == "POST":
        data = request.json
        if data.get("clear"):
            repertoire_table = {}
            save_repertoire(repertoire_table)
            return jsonify({"status": "cleared"})
        if data.get("fen") and data.get("move"):
            repertoire_table[data["fen"]] = data["move"]
            save_repertoire(repertoire_table)
            return jsonify({"status": "saved"})
        return jsonify({"error": "Invalid request"}), 400
    elif request.method == "DELETE":
        repertoire_table = {}
        if os.path.exists(REPERTOIRE_PATH):
            os.remove(REPERTOIRE_PATH)
        return jsonify({"status": "deleted"})

@app.route("/predict_top5", methods=["POST"])
def predict_top5():
    try:
        data = request.json
        fen = data.get("fen")
        if not fen:
            return jsonify({"error": "FEN diperlukan"}), 400

        req_elo_self = data.get("elo_self")
        req_elo_oppo = data.get("elo_oppo")
        req_mode = data.get("mode", "blitz")
        persona_name = data.get("persona", "club_player")

        elo_self, elo_oppo, mode, temperature, pc = resolve_params(
            persona_name, req_elo_self, req_elo_oppo, req_mode, None
        )
        h = _init_heavy()
        maia2_model = get_maia_model(mode)
        move_probs, win_prob = h["inference"].inference_each(
            maia2_model, get_prepared(), fen, elo_self, elo_oppo
        )

        top5 = get_top_moves(move_probs, 5)
        return jsonify({"top_moves": top5, "win_prob": round(win_prob, 4)})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    host = "0.0.0.0" if HF_SPACE == "1" else "127.0.0.1"
    print(f"Listening on {host}:{port}")
    app.run(host=host, port=port, threaded=True)
