/* =========================================================
   7-SEGMENT DISPLAY SIMULATOR
   Interactive Mode • Decade Counter Mode
   Truth Tables • Karnaugh Maps • Boolean Expressions
   Circuit Diagrams
========================================================= */

/* =========================================================
   TYPES & CONSTANTS
========================================================= */

type SegmentId = "a" | "b" | "c" | "d" | "e" | "f" | "g";

interface SegmentPattern {
    a: number; b: number; c: number; d: number;
    e: number; f: number; g: number;
}

const SEGMENTS: SegmentId[] = ["a", "b", "c", "d", "e", "f", "g"];

// BCD digits 0-9: which segments are ON (1 = on, 0 = off)
const BCD_PATTERNS: Record<number, SegmentPattern> = {
    0: { a:1, b:1, c:1, d:1, e:1, f:1, g:0 },
    1: { a:0, b:1, c:1, d:0, e:0, f:0, g:0 },
    2: { a:1, b:1, c:0, d:1, e:1, f:0, g:1 },
    3: { a:1, b:1, c:1, d:1, e:0, f:0, g:1 },
    4: { a:0, b:1, c:1, d:0, e:0, f:1, g:1 },
    5: { a:1, b:0, c:1, d:1, e:0, f:1, g:1 },
    6: { a:1, b:0, c:1, d:1, e:1, f:1, g:1 },
    7: { a:1, b:1, c:1, d:0, e:0, f:0, g:0 },
    8: { a:1, b:1, c:1, d:1, e:1, f:1, g:1 },
    9: { a:1, b:1, c:1, d:1, e:0, f:1, g:1 }
};

// Minterms for each segment (BCD only — 0-9)
const SEGMENT_MINTERMS: Record<SegmentId, number[]> = {
    a: [0, 2, 3, 5, 6, 7, 8, 9],
    b: [0, 1, 2, 3, 4, 7, 8, 9],
    c: [0, 1, 3, 4, 5, 6, 7, 8, 9],
    d: [0, 2, 3, 5, 6, 8, 9],
    e: [0, 2, 6, 8],
    f: [0, 4, 5, 6, 8, 9],
    g: [2, 3, 4, 5, 6, 8, 9]
};

// Simplified SOP expressions (from PDF Karnaugh map reduction)
// Variable order: A (MSB=8), B (4), C (2), D (LSB=1)
const SEGMENT_EXPRESSIONS: Record<SegmentId, string> = {
    a: "A + C + BD + B'D'",
    b: "B' + CD + C'D'",
    c: "B + C' + D",
    d: "A + CD' + B'D' + B'C + BC'D",
    e: "B'D' + CD'",
    f: "A + BD' + C'D' + BC'",
    g: "A + B'C + CD' + BC'"
};

/* =========================================================
   DOM ELEMENTS
========================================================= */

const step1 = document.getElementById("step1")!;
const step3 = document.getElementById("step3")!;

const backToStep2 = document.getElementById("backToStep2")!;

const segmentDisplay = document.getElementById("segmentDisplay")!;
const bcdInput = document.getElementById("bcdInput")!;
const truthTable = document.getElementById("truthTable")!;
const booleanExpressions = document.getElementById("booleanExpressions")!;
const karnaughMaps = document.getElementById("karnaughMaps")!;
const circuitDiagram = document.getElementById("circuitDiagram")!;
const circuitTitle = document.getElementById("circuitTitle")!;
const displayHint = document.getElementById("displayHint")!;
const liveHint = document.getElementById("liveHint")!;

const displaySection = document.getElementById("displaySection")!;
const inputSection = document.getElementById("inputSection")!;
const counterSection = document.getElementById("counterSection")!;
const counterStart = document.getElementById("counterStart") as HTMLButtonElement;
const counterStop = document.getElementById("counterStop") as HTMLButtonElement;
const counterReset = document.getElementById("counterReset") as HTMLButtonElement;
const counterSpeed = document.getElementById("counterSpeed") as HTMLInputElement;
const speedLabel = document.getElementById("speedLabel")!;

/* =========================================================
   STATE
========================================================= */

let selectedCategory: string | null = null;
let currentInput: number = 0;
let counterInterval: ReturnType<typeof setInterval> | null = null;
let segmentValues: SegmentPattern = { a:0, b:0, c:0, d:0, e:0, f:0, g:0 };

/* =========================================================
   SVG 7-SEGMENT DISPLAY RENDERER
========================================================= */

function render7Segment(pattern: SegmentPattern, size: number = 200): string {
    const w = size;
    const h = size * 1.8;
    const segLen = w * 0.55;
    const segThick = w * 0.08;
    const gap = w * 0.06;

    const cx = w / 2;
    const topY = h * 0.08;
    const midY = h * 0.50;
    const botY = h * 0.92;
    const leftX = cx - segLen / 2;
    const rightX = cx + segLen / 2;

    type SegDef = { id: SegmentId; path: string; labelX: number; labelY: number };

    const segDefs: SegDef[] = [
        { id: "a", path: `M ${leftX + gap} ${topY} L ${rightX - gap} ${topY}`, labelX: cx, labelY: topY - 10 },
        { id: "b", path: `M ${rightX} ${topY + gap * 2} L ${rightX} ${midY - gap}`, labelX: rightX + 16, labelY: (topY + midY) / 2 },
        { id: "c", path: `M ${rightX} ${midY + gap} L ${rightX} ${botY - gap * 2}`, labelX: rightX + 16, labelY: (midY + botY) / 2 },
        { id: "d", path: `M ${leftX + gap} ${botY} L ${rightX - gap} ${botY}`, labelX: cx, labelY: botY + 18 },
        { id: "e", path: `M ${leftX} ${midY + gap} L ${leftX} ${botY - gap * 2}`, labelX: leftX - 16, labelY: (midY + botY) / 2 },
        { id: "f", path: `M ${leftX} ${topY + gap * 2} L ${leftX} ${midY - gap}`, labelX: leftX - 16, labelY: (topY + midY) / 2 },
        { id: "g", path: `M ${leftX + gap} ${midY} L ${rightX - gap} ${midY}`, labelX: cx, labelY: midY - 10 }
    ];

    let svg = `<svg class="seven-seg-svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<rect x="${leftX - 12}" y="${topY - 14}" width="${segLen + 24}" height="${botY - topY + 28}" rx="10" fill="#1a1a2e" stroke="#2d2d44" stroke-width="2"/>`;

    segDefs.forEach(seg => {
        const isOn = pattern[seg.id] === 1;
        const cls = isOn ? "seg-on" : "seg-off";
        svg += `<path d="${seg.path}" class="${cls}" stroke="${isOn ? '#ef4444' : '#52525b'}" stroke-width="${segThick}" stroke-linecap="round"/>`;
        svg += `<text x="${seg.labelX}" y="${seg.labelY}" class="seg-label" text-anchor="middle" dominant-baseline="middle" font-size="${size * 0.08}">${seg.id}</text>`;
    });

    svg += `</svg>`;
    return svg;
}

/* =========================================================
   TRUTH TABLE BUILDER
========================================================= */

function buildTruthTable(): string {
    let html = "<table><thead><tr>";
    html += "<th>Digit</th><th>A (8)</th><th>B (4)</th><th>C (2)</th><th>D (1)</th>";
    SEGMENTS.forEach(s => { html += `<th>${s.toUpperCase()}</th>`; });
    html += "</tr></thead><tbody>";

    for (let i = 0; i <= 9; i++) {
        const a = (i >> 3) & 1, b = (i >> 2) & 1, c = (i >> 1) & 1, d = i & 1;
        const pattern = BCD_PATTERNS[i];
        const highlight = i === currentInput ? " highlighted" : "";

        html += `<tr class="${highlight}">`;
        html += `<td class="decimal-col">${i}</td>`;
        html += `<td>${a}</td><td>${b}</td><td>${c}</td><td>${d}</td>`;
        SEGMENTS.forEach(s => {
            const cls = pattern[s] === 1 ? "seg-on-cell" : "seg-off-cell";
            html += `<td class="${cls}">${pattern[s]}</td>`;
        });
        html += "</tr>";
    }

    // Don't-care rows 10-15
    for (let i = 10; i <= 15; i++) {
        const a = (i >> 3) & 1, b = (i >> 2) & 1, c = (i >> 1) & 1, d = i & 1;

        html += `<tr class="dont-care-row">`;
        html += `<td class="decimal-col">—</td>`;
        html += `<td>${a}</td><td>${b}</td><td>${c}</td><td>${d}</td>`;
        SEGMENTS.forEach(s => {
            html += `<td class="dont-care-cell">X</td>`;
        });
        html += "</tr>";
    }

    html += "</tbody></table>";
    return html;
}

/* =========================================================
   BOOLEAN EXPRESSIONS DISPLAY
========================================================= */

function showExpressions(): void {
    booleanExpressions.innerHTML = "";
    SEGMENTS.forEach(seg => {
        const row = document.createElement("div");
        row.className = "expression-row";
        row.innerHTML = `
            <span class="expression-label">${seg.toUpperCase()}</span>
            <div class="expression-box">${SEGMENT_EXPRESSIONS[seg]}</div>
        `;
        booleanExpressions.appendChild(row);
    });
}

/* =========================================================
   KARNAUGH MAP RENDERER (4-variable: AB rows, CD columns)
========================================================= */

const GRAY2 = [[0,0],[0,1],[1,1],[1,0]];

const TRUTH_VALUES: Record<SegmentId, number[][]> = {
    a: [[1,0,1,1],[0,1,1,1],[-1,-1,-1,-1],[1,1,-1,-1]],
    b: [[1,1,1,1],[1,0,1,0],[-1,-1,-1,-1],[1,1,-1,-1]],
    c: [[1,1,1,0],[1,1,1,1],[-1,-1,-1,-1],[1,1,-1,-1]],
    d: [[1,0,1,1],[0,1,0,1],[-1,-1,-1,-1],[1,1,-1,-1]],
    e: [[1,0,0,1],[0,0,0,1],[-1,-1,-1,-1],[1,0,-1,-1]],
    f: [[1,0,0,0],[1,1,0,1],[-1,-1,-1,-1],[1,1,-1,-1]],
    g: [[0,0,1,1],[1,1,0,1],[-1,-1,-1,-1],[1,1,-1,-1]]
};

function buildKarnaughMap(seg: SegmentId): string {
    const grid = TRUTH_VALUES[seg];

    let html = `<div class="kmap-card">`;
    html += `<div class="kmap-title">Segment ${seg.toUpperCase()}</div>`;
    html += `<table class="karnaugh-map">`;
    html += `<tr><th class="km-corner">AB \\ CD</th>`;
    GRAY2.forEach(cd => { html += `<th>${cd[0]}${cd[1]}</th>`; });
    html += `</tr>`;

    for (let r = 0; r < 4; r++) {
        const ab = GRAY2[r];
        html += `<tr><th class="km-corner">${ab[0]}${ab[1]}</th>`;
        for (let c = 0; c < 4; c++) {
            const val = grid[r][c];
            const abVal = (ab[0] << 1) | ab[1];
            const cdVal = (GRAY2[c][0] << 1) | GRAY2[c][1];
            const minterm = (abVal << 2) | cdVal;
            let cls = "";
            let display = "";
            if (val === 1) { cls = "km-one"; display = "1"; }
            else if (val === 0) { cls = "km-zero"; display = "0"; }
            else { cls = "km-dontcare"; display = "X"; }
            html += `<td class="${cls}"><span class="km-minterm">${minterm}</span><span class="km-value">${display}</span></td>`;
        }
        html += `</tr>`;
    }

    html += `</table>`;
    html += `<div class="kmap-expr">${seg} = ${SEGMENT_EXPRESSIONS[seg]}</div>`;
    html += `</div>`;
    return html;
}

function showKarnaughMaps(): void {
    karnaughMaps.innerHTML = "";
    SEGMENTS.forEach(seg => {
        karnaughMaps.innerHTML += buildKarnaughMap(seg);
    });
}

/* =========================================================
   CIRCUIT DIAGRAM — Clean Schematic Style
========================================================= */

function svgAND(cx: number, cy: number, w: number, h: number): string {
    const hw = w / 2, hh = h / 2;
    return `<path d="M ${cx - hw} ${cy - hh} h ${hw} a ${hh} ${hh} 0 0 1 0 ${h} h ${-hw} z" fill="white" stroke="#1a2744" stroke-width="2" stroke-linejoin="round"/>`;
}

function svgNOT(cx: number, cy: number, h: number): string {
    const hh = h / 2;
    return `<polygon points="${cx - hh},${cy - hh} ${cx + hh},${cy} ${cx - hh},${cy + hh}" fill="white" stroke="#1a2744" stroke-width="2" stroke-linejoin="round"/>
            <circle cx="${cx + hh + 4}" cy="${cy}" r="4" fill="white" stroke="#1a2744" stroke-width="1.8"/>`;
}

function svgWire(x1: number, y1: number, x2: number, y2: number): string {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/>`;
}

function svgJunction(x: number, y: number): string {
    return `<circle cx="${x}" cy="${y}" r="3" fill="#2563eb" stroke="#1e40af" stroke-width="0.6"/>`;
}

function svgCircuitLabel(x: number, y: number, text: string, opts?: { size?: number; weight?: string; color?: string; anchor?: string }): string {
    const size = opts?.size ?? 14;
    const weight = opts?.weight ?? "700";
    const color = opts?.color ?? "#1a2744";
    const anchor = opts?.anchor ?? "middle";
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${color}" font-family="Inter, system-ui, sans-serif">${text}</text>`;
}

function renderCircuitDiagram(): string {
    const svgW = 980;
    const svgH = 560;

    const busX0 = 60;
    const busGap = 28;
    const busTop = 50;
    const busBot = svgH - 20;
    const busNames = ["A", "A\u2032", "B", "B\u2032", "C", "C\u2032", "D", "D\u2032"];
    const busX: number[] = [];
    for (let i = 0; i < 8; i++) busX.push(busX0 + i * busGap);

    const inputY = [90, 190, 290, 390];
    const inputNames = ["A", "B", "C", "D"];
    const inputWeights = ["8", "4", "2", "1"];

    const andX = 370;
    const andW = 60;
    const andH = 34;
    const segNames: SegmentId[] = ["a", "b", "c", "d", "e", "f", "g"];
    const segY: number[] = [];
    const segGap = 68;
    const segStartY = 68;
    for (let i = 0; i < 7; i++) segY.push(segStartY + i * segGap);

    const outX = svgW - 60;
    const exprX = andX + andW / 2 + 120;

    let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
    svg += `<rect x="0" y="0" width="${svgW}" height="${svgH}" rx="8" fill="#fafbfd" stroke="#d9dee7" stroke-width="1"/>`;
    svg += svgCircuitLabel(svgW / 2, 28, "BCD-to-7-Segment Decoder", { size: 16, weight: "700" });

    busX.forEach((x) => { svg += svgWire(x, busTop, x, busBot); });
    busX.forEach((x, i) => {
        svg += svgCircuitLabel(x, busTop - 8, busNames[i], { size: 11, weight: "700", color: i % 2 === 0 ? "#1a2744" : "#ef4444" });
    });

    inputNames.forEach((name, i) => {
        const y = inputY[i];
        const wX = busX[i * 2];
        svg += svgCircuitLabel(20, y + 5, name, { size: 16, anchor: "start" });
        svg += svgCircuitLabel(38, y + 5, inputWeights[i], { size: 10, weight: "600", color: "#6b7280", anchor: "start" });
        svg += svgWire(50, y, wX, y);
        const notX = (wX + busX[i * 2 + 1]) / 2;
        svg += svgWire(wX, y, notX - 11, y);
        svg += svgNOT(notX, y, 10);
        svg += svgWire(notX + 14, y, busX[i * 2 + 1], y);
        svg += svgJunction(wX, y);
    });

    segNames.forEach((seg, i) => {
        const y = segY[i];
        const gateTipX = andX + andW / 2;
        const gateLeftX = andX - andW / 2;

        svg += svgAND(andX, y, andW, andH);
        svg += svgCircuitLabel(andX, y + 4, seg.toUpperCase(), { size: 12, weight: "700" });
        svg += svgWire(gateTipX, y, outX - 20, y);
        svg += `<circle cx="${outX - 16}" cy="${y}" r="4" fill="#ef4444" stroke="#b91c1c" stroke-width="1"/>`;
        svg += svgCircuitLabel(outX, y + 5, seg.toUpperCase(), { size: 14, anchor: "start" });

        const busIndices = getSegmentBusIndices(seg);
        const inputSpacing = andH / (busIndices.length + 1);

        busIndices.forEach((busIdx, j) => {
            const srcX = busX[busIdx];
            const tgtY = y - andH / 2 + inputSpacing * (j + 1);
            svg += svgWire(srcX, y, srcX, tgtY);
            svg += svgWire(srcX, tgtY, gateLeftX, tgtY);
            svg += svgJunction(srcX, y);
        });
    });

    const expressions: Record<string, string> = {
        a: "A + C + BD + B\u2032D\u2032",
        b: "B\u2032 + CD + C\u2032D\u2032",
        c: "B + C\u2032 + D",
        d: "A + CD\u2032 + B\u2032D\u2032 + B\u2032C + BC\u2032D",
        e: "B\u2032D\u2032 + CD\u2032",
        f: "A + BD\u2032 + C\u2032D\u2032 + BC\u2032",
        g: "A + B\u2032C + CD\u2032 + BC\u2032"
    };

    segNames.forEach((seg, i) => {
        svg += svgCircuitLabel(exprX, segY[i] + 5, expressions[seg], { size: 11, weight: "600", color: "#374151", anchor: "start" });
    });

    svg += `</svg>`;
    return svg;
}

function getSegmentBusIndices(seg: SegmentId): number[] {
    const busMap: Record<string, number[]> = {
        a: [0, 4, 2, 6, 3, 7],
        b: [3, 4, 6, 5, 7],
        c: [2, 5, 6],
        d: [0, 4, 5, 3, 7, 2, 5, 6],
        e: [3, 7, 4, 5],
        f: [0, 2, 5, 7, 2, 5],
        g: [0, 3, 4, 5, 2, 5]
    };
    return busMap[seg] || [];
}

/* =========================================================
   7-SEGMENT DISPLAY — INTERACTIVE CLICK
========================================================= */

function renderClickableDisplay(): void {
    segmentDisplay.innerHTML = render7Segment(segmentValues, 220);
}

/* =========================================================
   BCD INPUT PANEL
========================================================= */

function buildBCDInput(): void {
    bcdInput.innerHTML = "";
    const bits = ["A", "B", "C", "D"];
    bits.forEach((name, i) => {
        const val = (currentInput >> (3 - i)) & 1;
        const group = document.createElement("div");
        group.className = "input-group";
        group.innerHTML = `
            <label>${name} (${Math.pow(2, 3 - i)})</label>
            <div class="input-toggle" data-input="${name}">
                <button type="button" class="input-toggle-btn ${val === 0 ? 'active' : ''}" data-value="0">0</button>
                <button type="button" class="input-toggle-btn ${val === 1 ? 'active' : ''}" data-value="1">1</button>
            </div>`;
        bcdInput.appendChild(group);
    });

    bcdInput.querySelectorAll(".input-toggle").forEach(toggle => {
        const btns = toggle.querySelectorAll(".input-toggle-btn");
        btns.forEach(btn => {
            btn.addEventListener("click", () => {
                btns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                updateBCDFromInputs();
            });
        });
    });
}

function updateBCDFromInputs(): void {
    let val = 0;
    const bits = ["A", "B", "C", "D"];
    bits.forEach((name, i) => {
        const toggle = bcdInput.querySelector(`[data-input="${name}"]`);
        const active = toggle?.querySelector(".input-toggle-btn.active");
        const bitVal = Number(active?.getAttribute("data-value") ?? 0);
        val |= (bitVal << (3 - i));
    });
    currentInput = Math.min(val, 9);
    updateDisplay();
}

function syncInputsFromValue(): void {
    const bits = ["A", "B", "C", "D"];
    bits.forEach((name, i) => {
        const bitVal = (currentInput >> (3 - i)) & 1;
        const toggle = bcdInput.querySelector(`[data-input="${name}"]`);
        const btns = toggle?.querySelectorAll(".input-toggle-btn");
        btns?.forEach(b => {
            b.classList.toggle("active", Number(b.getAttribute("data-value")) === bitVal);
        });
    });
}

/* =========================================================
   UPDATE DISPLAY & TABLES
========================================================= */

function updateDisplay(): void {
    const pattern = BCD_PATTERNS[currentInput] ?? { a:0,b:0,c:0,d:0,e:0,f:0,g:0 };
    segmentValues = pattern;
    renderClickableDisplay();
    updateTruthTableHighlight();
}

function updateTruthTableHighlight(): void {
    const rows = truthTable.querySelectorAll("tbody tr");
    rows.forEach((row, idx) => {
        row.classList.toggle("highlighted", idx === currentInput);
    });
}

/* =========================================================
   COUNTER MODE
========================================================= */

function startCounter(): void {
    if (counterInterval) return;
    const speed = Number(counterSpeed.value);
    counterInterval = setInterval(() => {
        currentInput = currentInput >= 9 ? 0 : currentInput + 1;
        syncInputsFromValue();
        updateDisplay();
    }, speed);
    counterStart.disabled = true;
    counterStop.disabled = false;
}

function stopCounter(): void {
    if (counterInterval) {
        clearInterval(counterInterval);
        counterInterval = null;
    }
    counterStart.disabled = false;
    counterStop.disabled = true;
}

function resetCounter(): void {
    stopCounter();
    currentInput = 0;
    syncInputsFromValue();
    updateDisplay();
}

/* =========================================================
   STEP NAVIGATION
========================================================= */

const categoryBtns = document.querySelectorAll(".category-btn");

categoryBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        selectedCategory = btn.getAttribute("data-category")!;
        if (selectedCategory === "interactive") {
            showStep3("commonCathode");
        } else if (selectedCategory === "counter") {
            showStep3("decadeCounter");
        }
    });
});

backToStep2.addEventListener("click", () => {
    stopCounter();
    step3.classList.add("hidden");
    step1.classList.remove("hidden");
    selectedCategory = null;
    categoryBtns.forEach(b => b.classList.remove("selected"));
});

counterStart.addEventListener("click", startCounter);
counterStop.addEventListener("click", stopCounter);
counterReset.addEventListener("click", resetCounter);

counterSpeed.addEventListener("input", () => {
    speedLabel.textContent = `${counterSpeed.value}ms`;
    if (counterInterval) {
        stopCounter();
        startCounter();
    }
});

/* =========================================================
   STEP DISPLAY
========================================================= */

function showStep3(circuitId: string): void {
    step1.classList.add("hidden");
    step3.classList.remove("hidden");

    const isCounterMode = circuitId === "decadeCounter";
    currentInput = 0;

    circuitTitle.textContent = isCounterMode
        ? "Decade Counter (0\u20139)"
        : "Common Cathode 7-Segment Display";

    displayHint.textContent = isCounterMode
        ? "BCD toggles update automatically as the counter runs."
        : "Click segments or use BCD input below to control the display.";
    liveHint.classList.toggle("hidden", isCounterMode);

    displaySection.classList.remove("hidden");
    inputSection.classList.remove("hidden");
    counterSection.classList.toggle("hidden", !isCounterMode);

    let num = 65;
    document.getElementById("ttSectionNum")!.textContent = String.fromCharCode(num++);
    document.getElementById("exprSectionNum")!.textContent = String.fromCharCode(num++);
    document.getElementById("kmapSectionNum")!.textContent = String.fromCharCode(num++);
    document.getElementById("circuitSectionNum")!.textContent = String.fromCharCode(num++);

    buildBCDInput();

    if (isCounterMode) {
        bcdInput.querySelectorAll(".input-toggle-btn").forEach(btn => {
            (btn as HTMLButtonElement).disabled = true;
        });
    }

    updateDisplay();
    truthTable.innerHTML = buildTruthTable();
    showExpressions();
    showKarnaughMaps();
    circuitDiagram.innerHTML = renderCircuitDiagram();

    step3.scrollIntoView({ behavior: "smooth" });
}

/* =========================================================
   INITIAL STATE
========================================================= */

step1.classList.remove("hidden");
