<<<<<<< HEAD
console.log("Maia-2 Human-like Engine - Aktif!");

let currentFen = "";
let isThinking = false;
let preFen = "";
let userLastMove = null;

let currentPersona = "club_player";
let currentModel = "blitz";
let eloSelf = 1500;
let eloOppo = 1500;
let showEval = true;
let showArrow = true;
let showMultiLine = true;
let blunderWarn = true;
let showAnalysis = true;

chrome.storage.local.get([
  "personaSelect", "modelSelect", "eloSelf", "eloOppo",
  "evalToggle", "arrowToggle", "multiLineToggle", "blunderToggle", "analysisToggle"
], (data) => {
  if (data.personaSelect) currentPersona = data.personaSelect;
  if (data.modelSelect) currentModel = data.modelSelect;
  if (data.eloSelf) eloSelf = parseInt(data.eloSelf);
  if (data.eloOppo) eloOppo = parseInt(data.eloOppo);
  if (data.evalToggle !== undefined) showEval = data.evalToggle;
  if (data.arrowToggle !== undefined) showArrow = data.arrowToggle;
  if (data.multiLineToggle !== undefined) showMultiLine = data.multiLineToggle;
  if (data.blunderToggle !== undefined) blunderWarn = data.blunderToggle;
  if (data.analysisToggle !== undefined) showAnalysis = data.analysisToggle;
});

let castlingTracker = {
  K: true, Q: true, k: true, q: true,
  initialized: false,
  lastBoardMap: null
};

let gameHistory = [];
let moveCount = 0;
let lastUserMoveFen = null;
let lastBlunderInfo = null;

setInterval(checkBoard, 500);
setInterval(checkGameOver, 2000);

function checkBoard() {
  if (isThinking) return;
  let result = getBoardState();
  if (!result) return;
  let newFen = result.fen;
  if (newFen && newFen !== currentFen) {
    preFen = currentFen;
    currentFen = newFen;
    detectUserMove(newFen, preFen);
    removeArrows();
    removeEvalBar();
    askEngine(newFen);
  }
}

function detectUserMove(newFen, oldFen) {
  if (!oldFen) return;
  let oldBoard = fenToSimple(oldFen);
  let newBoard = fenToSimple(newFen);
  let movedPiece = null;
  let fromSq = null;
  let toSq = null;
  for (let key in oldBoard) {
    if (oldBoard[key] && (!newBoard[key] || newBoard[key] !== oldBoard[key])) {
      fromSq = key;
      movedPiece = oldBoard[key];
    }
  }
  for (let key in newBoard) {
    if (newBoard[key] && (!oldBoard[key] || oldBoard[key] !== newBoard[key])) {
      toSq = key;
    }
  }
  if (fromSq && toSq) {
    let uci = squaresToUci(fromSq, toSq, newBoard);
    if (uci && uci.length >= 4) {
      userLastMove = uci;
      lastUserMoveFen = oldFen;
      if (blunderWarn) checkBlunder(oldFen, uci);
    }
  }
}

function fenToSimple(fen) {
  let parts = fen.split(" ");
  let rows = parts[0].split("/");
  let map = {};
  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (let ch of rows[r]) {
      if (ch >= "1" && ch <= "8") {
        col += parseInt(ch);
      } else {
        map[`${col},${7 - r}`] = ch;
        col++;
      }
    }
  }
  return map;
}

function squaresToUci(fromKey, toKey, board) {
  let [fx, fy] = fromKey.split(",").map(Number);
  let [tx, ty] = toKey.split(",").map(Number);
  let file = String.fromCharCode(97 + fx);
  let rank = (fy + 1).toString();
  let tfile = String.fromCharCode(97 + tx);
  let trunk = (ty + 1).toString();
  let piece = board[toKey] || "";
  let promotion = "";
  if ((piece === "q" || piece === "Q") && (trunk === "8" || trunk === "1")) {
    promotion = "q";
  }
  return file + rank + tfile + trunk + promotion;
}

async function checkBlunder(fen, moveUci) {
  try {
    let resp = await fetch("http://127.0.0.1:5000/evaluate_move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fen: fen,
        move: moveUci,
        elo_self: eloSelf,
        elo_oppo: eloOppo,
        mode: currentModel,
        persona: currentPersona
      })
    });
    let data = await resp.json();
    lastBlunderInfo = {
      is_blunder: data.blunder || false,
      is_inaccuracy: data.inaccuracy || false,
      user_move: moveUci,
      best_move: data.best_move || "",
      user_prob: data.user_prob || 0
    };
    if (data.blunder) {
      showBlunderToast(data.blunder_msg || "Blunder! Coba langkah lain.");
    } else if (data.inaccuracy) {
      showBlunderToast(data.inaccuracy_msg || "Kurang akurat, ada langkah lebih baik.");
    }
  } catch (e) {
  }
}

function showBlunderToast(msg) {
  let toast = document.createElement("div");
  toast.id = "maia-blunder-toast";
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: "fixed", top: "20px", left: "50%", transform: "translateX(-50%)",
    background: "#e74c3c", color: "white", padding: "12px 24px",
    borderRadius: "8px", zIndex: "99999", fontSize: "16px",
    fontWeight: "bold", boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
    transition: "opacity 0.3s", fontFamily: "Arial, sans-serif"
  });
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 3000);
}

async function askEngine(fen) {
  isThinking = true;
  try {
    let body = {
      fen: fen,
      elo_self: eloSelf,
      elo_oppo: eloOppo,
      mode: currentModel,
      persona: currentPersona
    };
    let resp = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    let data = await resp.json();
    if (data.error) { console.error("Engine Error:", data.error); return; }

    removeArrows();
    removeEvalBar();

    let bestMove = data.bestmove;
    let winProb = data.win_prob;
    let topMoves = data.top_moves || [];
    let mood = data.mood || "calm";
    let personaLabel = data.persona_label || "";
    let moveCount = data.move_count || 0;

    if (showArrow && bestMove) {
      if (showMultiLine && topMoves.length > 1) {
        drawMultiArrows(topMoves);
      } else {
        drawArrow(bestMove, 1, "our_move", "#2ed573");
      }
    }
    if (showEval && winProb !== undefined) {
      drawEvalBar(winProb, mood);
    }
    showPersonaIndicator(personaLabel, mood, moveCount);

    gameHistory.push({
      fen: fen,
      best_move: bestMove,
      top_moves: topMoves,
      win_prob: winProb,
      mood: mood,
      is_blunder: lastBlunderInfo ? lastBlunderInfo.is_blunder : false,
      is_inaccuracy: lastBlunderInfo ? lastBlunderInfo.is_inaccuracy : false,
      user_move: lastBlunderInfo ? lastBlunderInfo.user_move : "",
      user_prob: lastBlunderInfo ? lastBlunderInfo.user_prob : 0
    });
    if (lastBlunderInfo) lastBlunderInfo = null;
    if (data.game_over && showAnalysis) {
      setTimeout(() => analyzeGame(), 1500);
    }
  } catch (e) {
    console.error("Gagal hubungi server. Pastikan server.py aktif.");
  } finally {
    isThinking = false;
  }
}

function drawMultiArrows(topMoves) {
  let colors = ["#2ed573", "#3498db", "#f39c12", "#9b59b6", "#95a5a6"];
  let widths = [2.0, 1.6, 1.3, 1.0, 0.8];
  let opacities = [0.95, 0.8, 0.65, 0.5, 0.35];
  let maxCount = Math.min(topMoves.length, 5);
  for (let i = 0; i < maxCount; i++) {
    let move = topMoves[i].move;
    let prob = topMoves[i].prob;
    drawArrow(move, i + 1, "our_move", colors[i], widths[i], opacities[i], prob);
  }
}

function drawArrow(bestMove, rank, type, color, strokeWidth, opacity, prob) {
  const board = document.querySelector("wc-chess-board") || document.querySelector(".board") || document.querySelector("chess-board");
  if (!board) return;
  if (!color) color = "#2ed573";
  if (!strokeWidth) strokeWidth = 1.8;
  if (!opacity) opacity = 0.9;
  const isFlipped = board.classList.contains("flipped") || board.hasAttribute("flipped");
  const fromStr = bestMove.substring(0, 2);
  const toStr = bestMove.substring(2, 4);
  const fromCoord = getSquareCoordinates(fromStr, isFlipped);
  const toCoord = getSquareCoordinates(toStr, isFlipped);
  let svg = document.getElementById("ai-arrow-svg");
  if (!svg) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "ai-arrow-svg";
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999; overflow:visible;";
    board.appendChild(svg);
  }
  const dx = toCoord.x - fromCoord.x;
  const dy = toCoord.y - fromCoord.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance < 0.1) return;
  let curveFactor = 0.02;
  const midX = (fromCoord.x + toCoord.x) / 2;
  const midY = (fromCoord.y + toCoord.y) / 2;
  const normX = -dy / distance;
  const normY = dx / distance;
  const cpX = midX + normX * distance * curveFactor;
  const cpY = midY + normY * distance * curveFactor;
  let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${fromCoord.x} ${fromCoord.y} Q ${cpX} ${cpY} ${toCoord.x} ${toCoord.y}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", color);
  path.setAttribute("stroke-width", String(strokeWidth));
  path.setAttribute("stroke-linecap", "round");
  path.style.opacity = String(opacity);
  svg.appendChild(path);
  let head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  const angle = Math.atan2(toCoord.y - cpY, toCoord.x - cpX) * (180 / Math.PI);
  const headSize = 3.5;
  head.setAttribute("points", `0,0 ${headSize},${headSize / 2} 0,${headSize} ${headSize / 4},${headSize / 2}`);
  head.setAttribute("fill", color);
  head.setAttribute("transform", `translate(${toCoord.x}, ${toCoord.y}) rotate(${angle}) translate(-${headSize * 0.8}, -${headSize / 2})`);
  head.style.opacity = String(opacity);
  svg.appendChild(head);
  if (prob !== undefined) {
    let label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    let lx = toCoord.x + 2;
    let ly = toCoord.y - (rank * 5) - 2;
    label.setAttribute("x", String(lx));
    label.setAttribute("y", String(ly));
    label.setAttribute("fill", color);
    label.setAttribute("font-size", "4");
    label.setAttribute("font-weight", "bold");
    label.setAttribute("style", "text-shadow: 0 0 2px black;");
    label.textContent = `${(prob * 100).toFixed(1)}%`;
    svg.appendChild(label);
  }
}

function drawEvalBar(winProb, mood) {
  const board = document.querySelector("wc-chess-board") || document.querySelector(".board") || document.querySelector("chess-board");
  if (!board) return;
  if (document.getElementById("maia-eval-bar")) return;
  let bar = document.createElement("div");
  bar.id = "maia-eval-bar";
  let barHeight = board.offsetHeight || 400;
  bar.style.cssText = `
    position:absolute; right:-28px; top:0; width:22px; height:${barHeight}px;
    border-radius:4px; overflow:hidden; z-index:9998;
    background: #333; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  `;
  let fill = document.createElement("div");
  fill.id = "maia-eval-fill";
  let pct = Math.max(2, Math.min(98, winProb * 100));
  fill.style.cssText = `
    position:absolute; bottom:0; width:100%; height:${pct}%;
    background: linear-gradient(to top, #1a1a1a, #ccc);
    transition: height 0.4s ease;
    border-radius: 0 0 4px 4px;
  `;
  bar.appendChild(fill);
  let label = document.createElement("div");
  label.id = "maia-eval-label";
  label.textContent = `${(winProb * 100).toFixed(0)}%`;
  label.style.cssText = `
    position:absolute; width:100%; text-align:center;
    top:50%; left:0; transform:translateY(-50%);
    font-size:11px; font-weight:bold; color:#fff;
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    z-index:2; pointer-events:none;
  `;
  bar.appendChild(label);
  if (mood) {
    let moodIcon = document.createElement("div");
    moodIcon.textContent = getMoodEmoji(mood);
    moodIcon.style.cssText = `
      position:absolute; top:-20px; left:50%; transform:translateX(-50%);
      font-size:14px; text-align:center;
    `;
    bar.appendChild(moodIcon);
  }
  bar.style.position = "absolute";
  board.parentElement.style.position = "relative";
  board.parentElement.appendChild(bar);
}

function getMoodEmoji(mood) {
  const map = {
    calm: "😐", frustrated: "😤", confident: "😏",
    tired: "😴", pressured: "😰", aggressive: "🔥"
  };
  return map[mood] || "😐";
}

function removeEvalBar() {
  let bar = document.getElementById("maia-eval-bar");
  if (bar) bar.remove();
}

function showPersonaIndicator(label, mood, mCount) {
  let existing = document.getElementById("maia-persona-indicator");
  if (existing) existing.remove();
  if (!label) return;
  let el = document.createElement("div");
  el.id = "maia-persona-indicator";
  let emoji = getMoodEmoji(mood);
  el.textContent = `${emoji} ${label} #${mCount}`;
  el.style.cssText = `
    position:fixed; bottom:12px; right:12px;
    background:rgba(0,0,0,0.7); color:#81b64c;
    padding:6px 14px; border-radius:20px;
    font-size:12px; font-weight:bold; font-family:Arial,sans-serif;
    z-index:99999; pointer-events:none;
    backdrop-filter:blur(4px);
  `;
  document.body.appendChild(el);
}

function getBoardState() {
  const pieces = document.querySelectorAll(".piece");
  if (pieces.length === 0) return null;
  let boardMap = {};
  pieces.forEach((p) => {
    const cls = p.className;
    const pMatch = cls.match(/([wb][prnbqk])/);
    const sMatch = cls.match(/square-(\d+)/);
    if (pMatch && sMatch) {
      let char = pMatch[1][1];
      if (pMatch[1][0] === "w") char = char.toUpperCase();
      boardMap[`${parseInt(sMatch[1][0]) - 1},${parseInt(sMatch[1][1]) - 1}`] = char;
    }
  });
  let fen = "";
  for (let r = 7; r >= 0; r--) {
    let empty = 0;
    for (let f = 0; f <= 7; f++) {
      let p = boardMap[`${f},${r}`];
      if (p) { if (empty > 0) fen += empty; fen += p; empty = 0; } else empty++;
    }
    if (empty > 0) fen += empty;
    if (r > 0) fen += "/";
  }
  let turn = "w";
  const boardEl = document.querySelector("wc-chess-board") || document.querySelector(".board") || document.querySelector("chess-board");
  const isFlipped = boardEl && (boardEl.classList.contains("flipped") || boardEl.hasAttribute("flipped"));
  const activeClockBottom = document.querySelector(".clock-bottom.clock-player-turn");
  const activeClockTop = document.querySelector(".clock-top.clock-player-turn");
  if (activeClockBottom) turn = isFlipped ? "b" : "w";
  else if (activeClockTop) turn = isFlipped ? "w" : "b";
  let castling = getCastlingRights(boardMap);
  return { fen: `${fen} ${turn} ${castling} - 0 1`, boardMap };
}

function getCastlingRights(boardMap) {
  if (!castlingTracker.initialized) {
    castlingTracker.initialized = true;
    castlingTracker.lastBoardMap = JSON.parse(JSON.stringify(boardMap));
    castlingTracker.K = true; castlingTracker.Q = true;
    castlingTracker.k = true; castlingTracker.q = true;
    return "KQkq";
  }
  if (!boardMap["4,7"] || boardMap["4,7"] !== "K") { castlingTracker.K = false; castlingTracker.Q = false; }
  if (!boardMap["4,0"] || boardMap["4,0"] !== "k") { castlingTracker.k = false; castlingTracker.q = false; }
  if (!boardMap["7,7"] || boardMap["7,7"] !== "R") castlingTracker.K = false;
  if (!boardMap["0,7"] || boardMap["0,7"] !== "R") castlingTracker.Q = false;
  if (!boardMap["7,0"] || boardMap["7,0"] !== "r") castlingTracker.k = false;
  if (!boardMap["0,0"] || boardMap["0,0"] !== "r") castlingTracker.q = false;
  castlingTracker.lastBoardMap = JSON.parse(JSON.stringify(boardMap));
  let r = "";
  if (castlingTracker.K) r += "K";
  if (castlingTracker.Q) r += "Q";
  if (castlingTracker.k) r += "k";
  if (castlingTracker.q) r += "q";
  return r || "-";
}

function getSquareCoordinates(square, isFlipped) {
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]) - 1;
  let x = file * 12.5 + 6.25;
  let y = (7 - rank) * 12.5 + 6.25;
  if (isFlipped) { x = 100 - x; y = 100 - y; }
  return { x, y };
}

function removeArrows() {
  const svg = document.getElementById("ai-arrow-svg");
  if (svg) svg.innerHTML = "";
}

function checkGameOver() {
  if (!showAnalysis) return;
  const resultOverlay = document.querySelector(".game-over") ||
    document.querySelector(".result") ||
    document.querySelector('[class*="result"]') ||
    document.querySelector('[class*="game-over"]') ||
    document.querySelector('[class*="gameover"]');
  if (resultOverlay && gameHistory.length > 3) {
    let analyzed = sessionStorage.getItem("maia_analyzed");
    if (!analyzed) {
      sessionStorage.setItem("maia_analyzed", "1");
      setTimeout(() => analyzeGame(), 1000);
    }
  }
  if (gameHistory.length > 100) {
    gameHistory = [];
    sessionStorage.removeItem("maia_analyzed");
  }
}

async function analyzeGame() {
  if (gameHistory.length < 3) return;
  try {
    let resp = await fetch("http://127.0.0.1:5000/analyze_game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_history: gameHistory,
        persona: currentPersona
      })
    });
    let data = await resp.json();
    showAnalysisResult(data);
  } catch (e) {
    console.error("Gagal analisis game:", e);
  }
}

function showAnalysisResult(data) {
  let existing = document.getElementById("maia-analysis-modal");
  if (existing) existing.remove();
  let modal = document.createElement("div");
  modal.id = "maia-analysis-modal";
  modal.style.cssText = `
    position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
    background:#262421; color:#fff; padding:24px; border-radius:12px;
    z-index:99999; min-width:320px; max-width:480px; max-height:80vh;
    overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.6);
    font-family:Arial,sans-serif;
  `;
  let close = document.createElement("button");
  close.textContent = "X";
  close.style.cssText = "float:right; background:none; border:none; color:#fff; font-size:20px; cursor:pointer;";
  close.onclick = () => modal.remove();
  modal.appendChild(close);
  let title = document.createElement("h2");
  title.textContent = "Analisis Game";
  title.style.cssText = "color:#81b64c; margin-top:0;";
  modal.appendChild(title);
  let stats = document.createElement("div");
  stats.innerHTML = `
    <p>Akurasi: ${(data.accuracy * 100).toFixed(1)}%</p>
    <p>Best Moves: ${data.best_count}/${data.total_moves}</p>
    <p>Blunder: ${data.blunder_count}</p>
    <p>Inaccuracy: ${data.inaccuracy_count}</p>
    <p>Mood dominan: ${data.dominant_mood || "calm"}</p>
  `;
  modal.appendChild(stats);
  let closeBtn = document.createElement("button");
  closeBtn.textContent = "Tutup";
  closeBtn.style.cssText = `
    width:100%; padding:10px; background:#81b64c; color:white;
    border:none; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:12px;
  `;
  closeBtn.onclick = () => modal.remove();
  modal.appendChild(closeBtn);
  document.body.appendChild(modal);
}
=======
console.log("🧠 Maia-2 Ultimate Assistant - Aktif!");

let currentFen = "";
let isThinking = false;

// Default Settings (Disesuaikan untuk Maia-2)
let currentModel = 'blitz'; // Maia-2 menggunakan tipe model seperti 'blitz' atau 'gen'
let eloSelf = 2200;
let eloOppo = 2200;
let showEval = true, showArrow = true, showOpponent = false;

// Load settings dari storage jika ada
chrome.storage.local.get([
    'modelSelect', 'eloSelf', 'eloOppo', 'evalToggle', 'arrowToggle'
], (data) => {
    if (data.modelSelect) currentModel = data.modelSelect;
    if (data.eloSelf) eloSelf = parseInt(data.eloSelf);
    if (data.eloOppo) eloOppo = parseInt(data.eloOppo);
    if (data.evalToggle !== undefined) showEval = data.evalToggle;
    if (data.arrowToggle !== undefined) showArrow = data.arrowToggle;
});

// Interval cek papan (menggunakan fungsi getBoardState bawaan Anda yang sudah stabil)
setInterval(checkBoard, 500); 

function checkBoard() {
    if (isThinking) return; 
    let newFen = getBoardState();
    if (newFen && newFen !== currentFen) {
        currentFen = newFen;
        removeArrows();
        askEngine(newFen);
    }
}

async function askEngine(fen) {
    isThinking = true;
    try {
        // Mengarahkan ke endpoint server Maia-2 (127.0.0.1:5000/predict)
        const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fen: fen,
                elo_self: eloSelf,
                elo_oppo: eloOppo,
                mode: currentModel
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error("Engine Error:", data.error);
            return;
        }

        removeArrows(); 
        
        // Menggunakan fungsi drawArrow bawaan Anda untuk menggambar langkah dari Maia-2
        if (showArrow && data.bestmove) {
            console.log("🎯 Maia-2 Suggestion:", data.bestmove);
            drawArrow(data.bestmove, 1, 'our_move');
        }

        // Jika server Maia-2 mengirimkan evaluasi (opsional)
        if (data.score !== undefined && showEval) {
            currentEvaluation = data.score;
            updateEvaluationBar();
        }

    } catch (error) {
        console.error("❌ Gagal menghubungi server Maia-2. Pastikan server.py aktif di terminal.");
    } finally {
        isThinking = false;
    }
}

// --- FUNGSI HELPER (TETAP MENGGUNAKAN LOGIKA ASLI ANDA AGAR DRAW BERJALAN) ---

function drawArrow(bestMove, rank, type) {
    const board = document.querySelector('wc-chess-board') || document.querySelector('.board') || document.querySelector('chess-board');
    if (!board) return;

    const isFlipped = board.classList.contains('flipped') || board.hasAttribute('flipped');
    const fromStr = bestMove.substring(0, 2);
    const toStr = bestMove.substring(2, 4);
    
    const fromCoord = getSquareCoordinates(fromStr, isFlipped);
    const toCoord = getSquareCoordinates(toStr, isFlipped);

    let mainColor = "#2ed573"; // Hijau untuk Maia-2
    let opacity = 0.9;
    let strokeWidth = 1.8;

    let svg = document.getElementById('ai-arrow-svg');
    if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.id = 'ai-arrow-svg';
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:9999; overflow:visible;";
        board.appendChild(svg);
    }

    const dx = toCoord.x - fromCoord.x;
    const dy = toCoord.y - fromCoord.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    let curveFactor = 0.02;
    const midX = (fromCoord.x + toCoord.x) / 2;
    const midY = (fromCoord.y + toCoord.y) / 2;
    const normX = -dy / distance;
    const normY = dx / distance;
    const cpX = midX + (normX * distance * curveFactor);
    const cpY = midY + (normY * distance * curveFactor);

    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${fromCoord.x} ${fromCoord.y} Q ${cpX} ${cpY} ${toCoord.x} ${toCoord.y}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", mainColor);
    path.setAttribute("stroke-width", strokeWidth);
    path.setAttribute("stroke-linecap", "round");
    path.style.opacity = opacity;
    svg.appendChild(path);

    let head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const angle = Math.atan2(toCoord.y - cpY, toCoord.x - cpX) * (180 / Math.PI);
    const headSize = 3.5;
    head.setAttribute("points", `0,0 ${headSize},${headSize/2} 0,${headSize} ${headSize/4},${headSize/2}`);
    head.setAttribute("fill", mainColor);
    head.setAttribute("transform", `translate(${toCoord.x}, ${toCoord.y}) rotate(${angle}) translate(-${headSize*0.8}, -${headSize/2})`);
    head.style.opacity = opacity;
    svg.appendChild(head);
}

function getBoardState() {
    const pieces = document.querySelectorAll('.piece');
    if (pieces.length === 0) return null;
    
    let boardMap = {};
    pieces.forEach(p => {
        const cls = p.className;
        const pMatch = cls.match(/([wb][prnbqk])/);
        const sMatch = cls.match(/square-(\d+)/);
        if (pMatch && sMatch) {
            let char = pMatch[1][1];
            if (pMatch[1][0] === 'w') char = char.toUpperCase();
            boardMap[`${parseInt(sMatch[1][0]) - 1},${parseInt(sMatch[1][1]) - 1}`] = char;
        }
    });
    
    let fen = "";
    for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let f = 0; f <= 7; f++) {
            let p = boardMap[`${f},${r}`];
            if (p) { if(empty > 0) fen += empty; fen += p; empty = 0; }
            else empty++;
        }
        if (empty > 0) fen += empty;
        if (r > 0) fen += "/";
    }

    let turn = "w";
    const board = document.querySelector('wc-chess-board') || document.querySelector('.board') || document.querySelector('chess-board');
    const isFlipped = board && (board.classList.contains('flipped') || board.hasAttribute('flipped'));

    const activeClockBottom = document.querySelector('.clock-bottom.clock-player-turn');
    const activeClockTop = document.querySelector('.clock-top.clock-player-turn');
    
    if (activeClockBottom) turn = isFlipped ? "b" : "w";
    else if (activeClockTop) turn = isFlipped ? "w" : "b";

    return `${fen} ${turn} - - 0 1`;
}

function getSquareCoordinates(square, isFlipped) {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1]) - 1;
    let x = (file * 12.5) + 6.25;
    let y = ((7 - rank) * 12.5) + 6.25;
    if (isFlipped) { x = 100 - x; y = 100 - y; }
    return { x, y };
}

function removeArrows() {
    const svg = document.getElementById('ai-arrow-svg');
    if (svg) svg.innerHTML = "";
}

>>>>>>> 207f98cca6bceb1c811290cd207f4d18a7b954db
