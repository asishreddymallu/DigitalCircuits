/* =========================================================
   7-SEGMENT DISPLAY SIMULATOR - COMPLETE STUDIO ENGINE
   Interactive & Automated Counter Modes • BCD & Hex Modes
   Common Cathode / Common Anode • Reverse Segment Decoding
   LED Phosphor Customizer • Direct Keyboard Typing
   Real-Time Digital Waveform Analyzer • Studio Sound FX
   Truth Tables • K-Maps • Boolean Formulas • Verilog • Zoom
========================================================= */
const SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"];
// 16 Hexadecimal patterns (0 to F)
const HEX_PATTERNS = {
    0: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 },
    1: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    2: { a: 1, b: 1, c: 0, d: 1, e: 1, f: 0, g: 1 },
    3: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 0, g: 1 },
    4: { a: 0, b: 1, c: 1, d: 0, e: 0, f: 1, g: 1 },
    5: { a: 1, b: 0, c: 1, d: 1, e: 0, f: 1, g: 1 },
    6: { a: 1, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
    7: { a: 1, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    8: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
    9: { a: 1, b: 1, c: 1, d: 1, e: 0, f: 1, g: 1 },
    10: { a: 1, b: 1, c: 1, d: 0, e: 1, f: 1, g: 1 }, // A
    11: { a: 0, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 }, // b
    12: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 0 }, // C
    13: { a: 0, b: 1, c: 1, d: 1, e: 1, f: 0, g: 1 }, // d
    14: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 1 }, // E
    15: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 1, g: 1 } // F
};
const HEX_CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "b", "C", "d", "E", "F"];
// BCD Minterms (0-9)
const BCD_MINTERMS = {
    a: [0, 2, 3, 5, 6, 7, 8, 9],
    b: [0, 1, 2, 3, 4, 7, 8, 9],
    c: [0, 1, 3, 4, 5, 6, 7, 8, 9],
    d: [0, 2, 3, 5, 6, 8, 9],
    e: [0, 2, 6, 8],
    f: [0, 4, 5, 6, 8, 9],
    g: [2, 3, 4, 5, 6, 8, 9]
};
// Simplified SOP expressions for BCD
const BCD_EXPRESSIONS = {
    a: "A + C + B·D + B'·D'",
    b: "B' + C·D + C'·D'",
    c: "B + C' + D",
    d: "A + C·D' + B'·D' + B'·C + B·C'·D",
    e: "B'·D' + C·D'",
    f: "A + B·D' + C'·D' + B·C'",
    g: "A + B'·C + C·D' + B·C'"
};
// Simplified SOP expressions for Full Hexadecimal (0–F)
const HEX_EXPRESSIONS = {
    a: "A + C + B·D + B'·D'",
    b: "B' + C'·D' + C·D",
    c: "B + C' + D",
    d: "B'·D' + C·D' + B'·C + B·C'·D + A",
    e: "B'·D' + C·D'",
    f: "A + C'·D' + B·C' + B·D'",
    g: "A + B·C' + B'·C + C·D'"
};
/* =========================================================
   DOM ELEMENTS
========================================================= */
const step1 = document.getElementById("step1");
const step3 = document.getElementById("step3");
const backToStep2 = document.getElementById("backToStep2");
const breadcrumbCurrent = document.getElementById("breadcrumbCurrent");
const encBcdBtn = document.getElementById("encBcdBtn");
const encHexBtn = document.getElementById("encHexBtn");
const polCathodeBtn = document.getElementById("polCathodeBtn");
const polAnodeBtn = document.getElementById("polAnodeBtn");
const segmentDisplay = document.getElementById("segmentDisplay");
const reverseMatchText = document.getElementById("reverseMatchText");
const bcdInput = document.getElementById("bcdInput");
const truthTable = document.getElementById("truthTable");
const booleanExpressions = document.getElementById("booleanExpressions");
const karnaughMaps = document.getElementById("karnaughMaps");
const circuitDiagram = document.getElementById("circuitDiagram");
const verilogBox = document.getElementById("verilogBox");
const copyVerilogBtn = document.getElementById("copyVerilogBtn");
const segTimingCanvas = document.getElementById("segTimingCanvas");
const displayHint = document.getElementById("displayHint");
const counterSection = document.getElementById("counterSection");
const counterStart = document.getElementById("counterStart");
const counterStop = document.getElementById("counterStop");
const counterReset = document.getElementById("counterReset");
const counterStepFwd = document.getElementById("counterStepFwd");
const counterStepBack = document.getElementById("counterStepBack");
const counterSpeed = document.getElementById("counterSpeed");
const speedLabel = document.getElementById("speedLabel");
const zoomInBtn = document.getElementById("zoomInBtn");
const zoomOutBtn = document.getElementById("zoomOutBtn");
const zoomResetBtn = document.getElementById("zoomResetBtn");
/* =========================================================
   STATE
========================================================= */
let currentMode = "interactive";
let isHexMode = false;
let isCommonAnode = false; // false = Common Cathode (active high), true = Common Anode (active low)
let currentInput = 0;
let counterInterval = null;
let segmentValues = { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 };
let zoomScale = 1.0;
let panX = 0;
let panY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let segWaveHistory = [];
let segWaveTimer = 0;
/* =========================================================
   7-SEGMENT DIGITAL LOGIC ANALYZER (TIMING DIAGRAM)
========================================================= */
function recordSegmentWave() {
    segWaveTimer++;
    segWaveHistory.push({ time: segWaveTimer, segs: { ...segmentValues } });
    if (segWaveHistory.length > 25) {
        segWaveHistory.shift();
    }
    drawSegTimingDiagram();
}
function drawSegTimingDiagram() {
    if (!segTimingCanvas || segWaveHistory.length === 0)
        return;
    const ctx = segTimingCanvas.getContext("2d");
    if (!ctx)
        return;
    const w = segTimingCanvas.width;
    const h = segTimingCanvas.height;
    ctx.clearRect(0, 0, w, h);
    const rowHeight = Math.floor((h - 20) / 7);
    const startX = 90;
    const graphWidth = w - startX - 30;
    const stepX = graphWidth / Math.max(15, segWaveHistory.length - 1);
    // Draw background grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = startX; x < w - 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x, h - 10);
        ctx.stroke();
    }
    SEGMENTS.forEach((sId, sIdx) => {
        const topY = 12 + sIdx * rowHeight;
        const lowY = topY + rowHeight - 6;
        const highY = topY + 4;
        // Label
        ctx.font = "bold 12px 'JetBrains Mono', Consolas, monospace";
        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "right";
        ctx.fillText(`seg ${sId}`, startX - 10, lowY - 2);
        // Waveform
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        segWaveHistory.forEach((pt, i) => {
            const x = startX + i * stepX;
            const isLit = isCommonAnode ? pt.segs[sId] === 0 : pt.segs[sId] === 1;
            const y = isLit ? highY : lowY;
            if (i === 0) {
                ctx.moveTo(x, y);
            }
            else {
                const prevLit = isCommonAnode
                    ? segWaveHistory[i - 1].segs[sId] === 0
                    : segWaveHistory[i - 1].segs[sId] === 1;
                const prevY = prevLit ? highY : lowY;
                if (prevY !== y) {
                    ctx.lineTo(x, prevY);
                }
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    });
}
/* =========================================================
   7-SEGMENT DISPLAY SVG RENDERER
========================================================= */
function render7Segment(pattern, size = 180) {
    const w = size;
    const h = size * 1.7;
    const segLen = w * 0.58;
    const gap = w * 0.06;
    const cx = w / 2;
    const topY = h * 0.08;
    const midY = h * 0.50;
    const botY = h * 0.92;
    const leftX = cx - segLen / 2;
    const rightX = cx + segLen / 2;
    const segDefs = [
        { id: "a", path: `M ${leftX + gap} ${topY} L ${rightX - gap} ${topY}`, labelX: cx, labelY: topY - 10 },
        { id: "b", path: `M ${rightX} ${topY + gap * 2} L ${rightX} ${midY - gap}`, labelX: rightX + 16, labelY: (topY + midY) / 2 },
        { id: "c", path: `M ${rightX} ${midY + gap} L ${rightX} ${botY - gap * 2}`, labelX: rightX + 16, labelY: (midY + botY) / 2 },
        { id: "d", path: `M ${leftX + gap} ${botY} L ${rightX - gap} ${botY}`, labelX: cx, labelY: botY + 18 },
        { id: "e", path: `M ${leftX} ${midY + gap} L ${leftX} ${botY - gap * 2}`, labelX: leftX - 16, labelY: (midY + botY) / 2 },
        { id: "f", path: `M ${leftX} ${topY + gap * 2} L ${leftX} ${midY - gap}`, labelX: leftX - 16, labelY: (topY + midY) / 2 },
        { id: "g", path: `M ${leftX + gap} ${midY} L ${rightX - gap} ${midY}`, labelX: cx, labelY: midY - 10 }
    ];
    let svg = `<svg class="seg-svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-25 -20 ${w + 50} ${h + 40}">`;
    segDefs.forEach(seg => {
        const isLit = isCommonAnode ? pattern[seg.id] === 0 : pattern[seg.id] === 1;
        const cls = isLit ? "segment-path seg-on" : "segment-path seg-off";
        svg += `
            <g class="segment-group" data-seg="${seg.id}">
                <path d="${seg.path}" class="${cls}" stroke-width="14" stroke-linecap="round" fill="none" />
                <text x="${seg.labelX}" y="${seg.labelY + 4}" text-anchor="middle" font-size="12" font-weight="750" fill="var(--text-muted)">${seg.id}</text>
            </g>
        `;
    });
    // Decimal point (DP)
    svg += `<circle cx="${rightX + 18}" cy="${botY}" r="7" class="segment-path seg-off" stroke-width="0" fill="var(--seg-off)" />`;
    svg += `</svg>`;
    return svg;
}
function findMatchingPattern(pat) {
    for (let i = 0; i < (isHexMode ? 16 : 10); i++) {
        const hexP = HEX_PATTERNS[i];
        let match = true;
        for (const seg of SEGMENTS) {
            const expected = isCommonAnode ? 1 - hexP[seg] : hexP[seg];
            if (pat[seg] !== expected) {
                match = false;
                break;
            }
        }
        if (match) {
            const bin = i.toString(2).padStart(4, "0");
            return `Digit '${HEX_CHARS[i]}' (${bin}) — Hex 0x${i.toString(16).toUpperCase()}`;
        }
    }
    const litSegs = SEGMENTS.filter(s => isCommonAnode ? pat[s] === 0 : pat[s] === 1).join(", ");
    return `Custom Glyph {${litSegs || "none"}}`;
}
/* =========================================================
   INPUT CONTROLS & DIRECT KEYBOARD TYPING
========================================================= */
function buildInputs() {
    const bits = [
        { name: "A", weight: 8 },
        { name: "B", weight: 4 },
        { name: "C", weight: 2 },
        { name: "D", weight: 1 }
    ];
    bcdInput.innerHTML = bits.map(b => {
        const val = (currentInput & b.weight) ? 1 : 0;
        return `
            <button type="button" class="input-toggle-btn ${val ? "active" : ""}" data-weight="${b.weight}">
                <span>${b.name} (${b.weight})</span>
                <span class="input-val-badge">${val}</span>
            </button>
        `;
    }).join("");
    bcdInput.querySelectorAll(".input-toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const w = Number(btn.getAttribute("data-weight"));
            if (currentInput & w)
                currentInput &= ~w;
            else
                currentInput |= w;
            const maxLimit = isHexMode ? 15 : 9;
            if (currentInput > maxLimit)
                currentInput = maxLimit;
            if (window.StudioFX)
                window.StudioFX.click(true);
            syncDisplayFromInput();
        });
    });
}
function syncDisplayFromInput() {
    const pat = HEX_PATTERNS[currentInput] || HEX_PATTERNS[0];
    SEGMENTS.forEach(s => {
        segmentValues[s] = isCommonAnode ? (1 - pat[s]) : pat[s];
    });
    updateAllViews();
}
function updateAllViews() {
    segmentDisplay.innerHTML = render7Segment(segmentValues);
    segmentDisplay.querySelectorAll(".segment-group").forEach(grp => {
        grp.addEventListener("click", () => {
            if (currentMode !== "interactive")
                return;
            const seg = grp.getAttribute("data-seg");
            if (seg) {
                segmentValues[seg] = segmentValues[seg] === 1 ? 0 : 1;
                if (window.StudioFX)
                    window.StudioFX.click(segmentValues[seg] === 1);
                reverseDecodeCustomDisplay();
            }
        });
    });
    reverseMatchText.textContent = findMatchingPattern(segmentValues);
    bcdInput.querySelectorAll(".input-toggle-btn").forEach(btn => {
        const w = Number(btn.getAttribute("data-weight"));
        const isHigh = (currentInput & w) !== 0;
        btn.classList.toggle("active", isHigh);
        const badge = btn.querySelector(".input-val-badge");
        if (badge)
            badge.textContent = isHigh ? "1" : "0";
    });
    truthTable.querySelectorAll("tbody tr").forEach(tr => {
        const rowVal = Number(tr.getAttribute("data-val"));
        tr.classList.toggle("active-row", rowVal === currentInput);
    });
    renderCircuitDiagram();
    recordSegmentWave();
}
function reverseDecodeCustomDisplay() {
    segmentDisplay.innerHTML = render7Segment(segmentValues);
    segmentDisplay.querySelectorAll(".segment-group").forEach(grp => {
        grp.addEventListener("click", () => {
            const seg = grp.getAttribute("data-seg");
            if (seg) {
                segmentValues[seg] = segmentValues[seg] === 1 ? 0 : 1;
                if (window.StudioFX)
                    window.StudioFX.click(segmentValues[seg] === 1);
                reverseDecodeCustomDisplay();
            }
        });
    });
    reverseMatchText.textContent = findMatchingPattern(segmentValues);
    recordSegmentWave();
}
// Direct Keyboard Typing Support (0-9, A-F)
window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
    const key = e.key.toUpperCase();
    const hexIdx = HEX_CHARS.indexOf(key);
    if (hexIdx !== -1) {
        if (!isHexMode && hexIdx > 9)
            return;
        currentInput = hexIdx;
        if (window.StudioFX)
            window.StudioFX.relay();
        syncDisplayFromInput();
    }
});
/* =========================================================
   TRUTH TABLE
========================================================= */
function buildTruthTable() {
    const totalRows = isHexMode ? 16 : 10;
    let html = `<table class="truth-table"><thead><tr>`;
    html += `<th>Digit</th><th>A (8)</th><th>B (4)</th><th>C (2)</th><th>D (1)</th>`;
    SEGMENTS.forEach(s => { html += `<th>${s}</th>`; });
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < totalRows; i++) {
        const p = HEX_PATTERNS[i];
        const a = (i >> 3) & 1, b = (i >> 2) & 1, c = (i >> 1) & 1, d = i & 1;
        html += `<tr data-val="${i}">`;
        html += `<td><strong>${HEX_CHARS[i]}</strong></td>`;
        html += `<td>${a}</td><td>${b}</td><td>${c}</td><td>${d}</td>`;
        SEGMENTS.forEach(s => {
            const val = isCommonAnode ? (1 - p[s]) : p[s];
            const isLit = isCommonAnode ? val === 0 : val === 1;
            const cls = isLit ? "tt-one" : "tt-zero";
            html += `<td class="${cls}">${val}</td>`;
        });
        html += `</tr>`;
    }
    html += `</tbody></table>`;
    truthTable.innerHTML = html;
}
/* =========================================================
   BOOLEAN FORMULAS & VERILOG
========================================================= */
function buildExpressions() {
    const expressions = isHexMode ? HEX_EXPRESSIONS : BCD_EXPRESSIONS;
    booleanExpressions.innerHTML = SEGMENTS.map(s => `
        <div class="expression-card">
            <h3>Segment ${s.toUpperCase()}</h3>
            <div class="expression-formula">${s} = ${expressions[s]}</div>
        </div>
    `).join("");
    const code = generateVerilogModule();
    verilogBox.textContent = code;
    copyVerilogBtn.onclick = () => {
        if (window.StudioFX)
            window.StudioFX.click(true);
        navigator.clipboard.writeText(code).then(() => {
            copyVerilogBtn.textContent = "✅ Copied!";
            copyVerilogBtn.classList.add("copied");
            setTimeout(() => {
                copyVerilogBtn.textContent = "📋 Copy Verilog";
                copyVerilogBtn.classList.remove("copied");
            }, 1600);
        });
    };
}
function generateVerilogModule() {
    const modName = isHexMode ? "hex_to_7seg_decoder" : "bcd_to_7seg_decoder";
    return `// Synthesizable 7-Segment Decoder (${isHexMode ? "Hex 0-F" : "BCD 0-9"}, ${isCommonAnode ? "Common Anode" : "Common Cathode"})
module ${modName} (
    input  wire [3:0] in,
    output reg  [6:0] seg // {a, b, c, d, e, f, g}
);
    always @(*) begin
        case (in)
            4'h0: seg = 7'b${isCommonAnode ? "0000001" : "1111110"}; // 0
            4'h1: seg = 7'b${isCommonAnode ? "1001111" : "0110000"}; // 1
            4'h2: seg = 7'b${isCommonAnode ? "0010010" : "1101101"}; // 2
            4'h3: seg = 7'b${isCommonAnode ? "0000110" : "1111001"}; // 3
            4'h4: seg = 7'b${isCommonAnode ? "1001100" : "0110011"}; // 4
            4'h5: seg = 7'b${isCommonAnode ? "0100100" : "1011011"}; // 5
            4'h6: seg = 7'b${isCommonAnode ? "0100000" : "1011111"}; // 6
            4'h7: seg = 7'b${isCommonAnode ? "0001111" : "1110000"}; // 7
            4'h8: seg = 7'b${isCommonAnode ? "0000000" : "1111111"}; // 8
            4'h9: seg = 7'b${isCommonAnode ? "0000100" : "1111011"}; // 9
            ${isHexMode ? `
            4'hA: seg = 7'b${isCommonAnode ? "0001000" : "1110111"}; // A
            4'hB: seg = 7'b${isCommonAnode ? "1100000" : "0011111"}; // b
            4'hC: seg = 7'b${isCommonAnode ? "0110001" : "1001110"}; // C
            4'hD: seg = 7'b${isCommonAnode ? "1000010" : "0111101"}; // d
            4'hE: seg = 7'b${isCommonAnode ? "0110000" : "1001111"}; // E
            4'hF: seg = 7'b${isCommonAnode ? "0111000" : "1000111"}; // F` : ""}
            default: seg = 7'b${isCommonAnode ? "1111111" : "0000000"};
        endcase
    end
endmodule`;
}
/* =========================================================
   KARNAUGH MAPS
========================================================= */
function buildKarnaughMaps() {
    const rowLabels = ["00", "01", "11", "10"];
    const colLabels = ["00", "01", "11", "10"];
    const grid = [
        [0, 1, 3, 2],
        [4, 5, 7, 6],
        [12, 13, 15, 14],
        [8, 9, 11, 10]
    ];
    karnaughMaps.innerHTML = SEGMENTS.map(s => {
        const minterms = isHexMode
            ? Array.from({ length: 16 }, (_, i) => i).filter(i => HEX_PATTERNS[i][s] === 1)
            : BCD_MINTERMS[s];
        let table = `<table class="karnaugh-map"><thead><tr><th>AB\\CD</th>`;
        colLabels.forEach(c => { table += `<th>${c}</th>`; });
        table += `</tr></thead><tbody>`;
        for (let r = 0; r < 4; r++) {
            table += `<tr><th>${rowLabels[r]}</th>`;
            for (let c = 0; c < 4; c++) {
                const m = grid[r][c];
                let cellCls = "km-zero";
                let cellVal = "0";
                if (!isHexMode && m >= 10) {
                    cellCls = "km-dontcare";
                    cellVal = "X";
                }
                else if (minterms.includes(m)) {
                    cellCls = "km-one";
                    cellVal = "1";
                }
                table += `<td class="${cellCls}">
                    <span class="km-minterm">m${m}</span>
                    <span class="km-value">${cellVal}</span>
                </td>`;
            }
            table += `</tr>`;
        }
        table += `</tbody></table>`;
        return `
            <div class="kmap-card">
                <h3>Segment ${s.toUpperCase()}</h3>
                ${table}
            </div>
        `;
    }).join("");
}
/* =========================================================
   DECODER SCHEMATIC DIAGRAM WITH LIVE WIRE SIGNALS & WIRE JUMPS
========================================================= */
function wireHopH(x1, x2, y, crossXs, isHigh) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const isLtoR = x1 <= x2;
    const cls = isHigh ? "wire-active" : "wire-inactive";
    const valid = crossXs.filter(cx => cx > minX + 8 && cx < maxX - 8).sort((a, b) => isLtoR ? a - b : b - a);
    if (valid.length === 0) {
        return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="${cls}" stroke-width="2.2" fill="none" />`;
    }
    let d = `M ${x1} ${y}`;
    valid.forEach(cx => {
        if (isLtoR) {
            d += ` H ${cx - 7} A 7 7 0 0 1 ${cx + 7} ${y}`;
        }
        else {
            d += ` H ${cx + 7} A 7 7 0 0 1 ${cx - 7} ${y}`;
        }
    });
    d += ` H ${x2}`;
    return `<path d="${d}" class="${cls}" stroke-width="2.2" fill="none" />`;
}
function wireV(x, y1, y2, isHigh) {
    const cls = isHigh ? "wire-active" : "wire-inactive";
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="${cls}" stroke-width="2.2" fill="none" />`;
}
function dot(cx, cy, isHigh) {
    const col = isHigh ? "var(--wire-high)" : "var(--wire-low)";
    return `<circle cx="${cx}" cy="${cy}" r="3.8" class="circuit-junction" fill="${col}" />`;
}
function renderCircuitDiagram() {
    const a = (currentInput >> 3) & 1;
    const b = (currentInput >> 2) & 1;
    const c = (currentInput >> 1) & 1;
    const d = currentInput & 1;
    const notA = 1 - a;
    const notB = 1 - b;
    const notC = 1 - c;
    const notD = 1 - d;
    let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="800" height="380" viewBox="0 0 800 380">`;
    // Main Decoder IC Housing
    svg += `
        <rect x="250" y="20" width="260" height="340" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-color)" stroke-width="2.2"/>
        <text x="380" y="180" text-anchor="middle" font-size="16" font-weight="800" fill="var(--text-primary)">${isHexMode ? "HEX" : "BCD"} to 7-SEG</text>
        <text x="380" y="205" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-muted)">Decoder Logic Matrix</text>
        <text x="380" y="225" text-anchor="middle" font-size="11" font-weight="600" fill="var(--accent-secondary)">${isCommonAnode ? "Common Anode (Active LOW)" : "Common Cathode (Active HIGH)"}</text>
    `;
    const inY = [60, 130, 200, 270];
    const inNames = ["A (8)", "B (4)", "C (2)", "D (1)"];
    const inVals = [a, b, c, d];
    const inNots = [notA, notB, notC, notD];
    // Inputs, Inverter Gates, and Internal Rails
    for (let i = 0; i < 4; i++) {
        const yPos = inY[i];
        const val = inVals[i];
        const nVal = inNots[i];
        // Input Wire Lead
        svg += wireHopH(30, 130, yPos, [], val);
        svg += `<text x="15" y="${yPos + 4}" font-size="13" font-weight="800" fill="var(--text-primary)">${inNames[i]}</text>`;
        svg += dot(100, yPos, val);
        // Tap for direct True rail
        svg += wireV(100, yPos, yPos + 25, val);
        svg += wireHopH(100, 250, yPos + 25, [], val);
        // Inverter Gate for Complemented rail
        svg += `
            <g transform="translate(130, ${yPos - 12})">
                <polygon points="0,0 26,12 0,24" fill="var(--bg-card)" stroke="var(--border-hover)" stroke-width="2" />
                <circle cx="31" cy="12" r="4" fill="var(--bg-card)" stroke="var(--border-hover)" stroke-width="2" />
            </g>
        `;
        svg += wireHopH(165, 250, yPos, [], nVal);
    }
    // 7 Segment Outputs
    const outY = [45, 90, 135, 180, 225, 270, 315];
    for (let i = 0; i < 7; i++) {
        const sId = SEGMENTS[i];
        const val = segmentValues[sId];
        const isLit = isCommonAnode ? val === 0 : val === 1;
        const yPos = outY[i];
        // Segment output wire from IC to output driver badge
        svg += wireHopH(510, 650, yPos, [], isLit);
        svg += dot(510, yPos, isLit);
        // Interactive glowing badge
        svg += `
            <g transform="translate(660, ${yPos - 13})">
                <rect width="60" height="26" rx="8" fill="var(--bg-card)" stroke="${isLit ? "var(--seg-on)" : "var(--border-color)"}" stroke-width="${isLit ? "2" : "1.2"}"/>
                <text x="30" y="17" text-anchor="middle" font-size="12" font-weight="800" fill="${isLit ? "var(--seg-on)" : "var(--text-muted)"}">seg ${sId} = ${val}</text>
            </g>
        `;
    }
    svg += `</svg>`;
    circuitDiagram.innerHTML = svg;
    applyZoom();
}
function applyZoom() {
    const svg = circuitDiagram.querySelector("svg");
    if (svg) {
        svg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    }
}
function resetZoom() {
    zoomScale = 1.0;
    panX = 0;
    panY = 0;
    applyZoom();
}
zoomInBtn.addEventListener("click", () => {
    zoomScale = Math.min(2.5, zoomScale + 0.2);
    applyZoom();
    if (window.StudioFX)
        window.StudioFX.click(true);
});
zoomOutBtn.addEventListener("click", () => {
    zoomScale = Math.max(0.4, zoomScale - 0.2);
    applyZoom();
    if (window.StudioFX)
        window.StudioFX.click(false);
});
zoomResetBtn.addEventListener("click", resetZoom);
circuitDiagram.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoomScale = Math.min(2.5, Math.max(0.4, zoomScale + delta));
    applyZoom();
}, { passive: false });
circuitDiagram.addEventListener("mousedown", (e) => {
    if (e.button !== 0)
        return;
    isDragging = true;
    startDragX = e.clientX - panX;
    startDragY = e.clientY - panY;
    circuitDiagram.style.cursor = "grabbing";
});
window.addEventListener("mousemove", (e) => {
    if (!isDragging)
        return;
    panX = e.clientX - startDragX;
    panY = e.clientY - startDragY;
    applyZoom();
});
window.addEventListener("mouseup", () => {
    isDragging = false;
    circuitDiagram.style.cursor = "grab";
});
/* =========================================================
   COUNTER CONTROLS
========================================================= */
function stepCounter(dir = 1) {
    const maxVal = isHexMode ? 15 : 9;
    if (dir === 1) {
        currentInput = (currentInput + 1) % (maxVal + 1);
    }
    else {
        currentInput = (currentInput - 1 + (maxVal + 1)) % (maxVal + 1);
    }
    if (window.StudioFX)
        window.StudioFX.tick();
    syncDisplayFromInput();
}
counterStart.addEventListener("click", () => {
    if (counterInterval)
        return;
    counterStart.disabled = true;
    counterStop.disabled = false;
    if (window.StudioFX)
        window.StudioFX.relay();
    const speed = Number(counterSpeed.value);
    counterInterval = setInterval(() => {
        stepCounter(1);
    }, speed);
});
counterStop.addEventListener("click", () => {
    if (counterInterval) {
        clearInterval(counterInterval);
        counterInterval = null;
    }
    counterStart.disabled = false;
    counterStop.disabled = true;
    if (window.StudioFX)
        window.StudioFX.click(false);
});
counterReset.addEventListener("click", () => {
    if (counterInterval) {
        clearInterval(counterInterval);
        counterInterval = null;
        counterStart.disabled = false;
        counterStop.disabled = true;
    }
    currentInput = 0;
    if (window.StudioFX)
        window.StudioFX.click(true);
    syncDisplayFromInput();
});
counterStepFwd.addEventListener("click", () => {
    stepCounter(1);
});
counterStepBack.addEventListener("click", () => {
    stepCounter(-1);
});
counterSpeed.addEventListener("input", () => {
    const ms = Number(counterSpeed.value);
    const hz = (1000 / ms).toFixed(2);
    speedLabel.textContent = `${ms}ms (${hz} Hz)`;
    if (counterInterval) {
        clearInterval(counterInterval);
        counterInterval = setInterval(() => {
            stepCounter(1);
        }, ms);
    }
});
/* =========================================================
   LED PHOSPHOR COLOR PICKER
========================================================= */
document.querySelectorAll(".color-swatch").forEach(swatch => {
    swatch.addEventListener("click", () => {
        const theme = swatch.getAttribute("data-led");
        if (theme) {
            document.body.classList.remove("led-red", "led-green", "led-cyan", "led-amber", "led-purple", "led-white");
            document.body.classList.add(theme);
            document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
            swatch.classList.add("active");
            if (window.StudioFX)
                window.StudioFX.click(true);
            updateAllViews();
        }
    });
});
/* =========================================================
   MODE & CONFIGURATION CONTROLS
========================================================= */
document.querySelectorAll(".category-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-category");
        currentMode = cat;
        step1.classList.add("hidden");
        step3.classList.remove("hidden");
        counterSection.classList.toggle("hidden", currentMode !== "counter");
        displayHint.textContent = currentMode === "interactive"
            ? "Click segments, use binary switches, or press 0-F on your keyboard to control the display."
            : "Use the clock controls below to run the automated counter.";
        breadcrumbCurrent.textContent = `7-Segment Display Simulator / ${currentMode === "interactive" ? "Interactive Mode" : "Counter Mode"}`;
        if (window.StudioFX)
            window.StudioFX.relay();
        syncDisplayFromInput();
        buildTruthTable();
        buildExpressions();
        buildKarnaughMaps();
    });
});
backToStep2.addEventListener("click", () => {
    if (counterInterval) {
        clearInterval(counterInterval);
        counterInterval = null;
        counterStart.disabled = false;
        counterStop.disabled = true;
    }
    step1.classList.remove("hidden");
    step3.classList.add("hidden");
    breadcrumbCurrent.textContent = "7-Segment Display Simulator";
});
encBcdBtn.addEventListener("click", () => {
    isHexMode = false;
    encBcdBtn.classList.add("active");
    encHexBtn.classList.remove("active");
    if (currentInput > 9)
        currentInput = 0;
    if (window.StudioFX)
        window.StudioFX.click(true);
    syncDisplayFromInput();
    buildTruthTable();
    buildExpressions();
    buildKarnaughMaps();
});
encHexBtn.addEventListener("click", () => {
    isHexMode = true;
    encHexBtn.classList.add("active");
    encBcdBtn.classList.remove("active");
    if (window.StudioFX)
        window.StudioFX.click(true);
    syncDisplayFromInput();
    buildTruthTable();
    buildExpressions();
    buildKarnaughMaps();
});
polCathodeBtn.addEventListener("click", () => {
    isCommonAnode = false;
    polCathodeBtn.classList.add("active");
    polAnodeBtn.classList.remove("active");
    if (window.StudioFX)
        window.StudioFX.click(true);
    syncDisplayFromInput();
    buildTruthTable();
    buildExpressions();
});
polAnodeBtn.addEventListener("click", () => {
    isCommonAnode = true;
    polAnodeBtn.classList.add("active");
    polCathodeBtn.classList.remove("active");
    if (window.StudioFX)
        window.StudioFX.click(true);
    syncDisplayFromInput();
    buildTruthTable();
    buildExpressions();
});
/* =========================================================
   INITIALIZATION
========================================================= */
buildInputs();
buildTruthTable();
buildExpressions();
buildKarnaughMaps();
syncDisplayFromInput();
