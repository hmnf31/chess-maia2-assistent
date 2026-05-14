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

