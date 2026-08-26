/**
 * UI logic for the Web3 7-segment display simulator.
 *
 * Handles: waveform recording + timing diagram, input buttons, truth table,
 * Boolean expressions, Karnaugh maps, Verilog generation, zoom/pan,
 * counter controls, LED color picker, and mode/configuration switching.
 *
 * All functions accept the DOM elements and state they need as parameters.
 */

import { SEGMENTS, HEX_PATTERNS, HEX_CHARS, BCD_MINTERMS } from "./types";
import type { SegmentId, SegmentPattern } from "./types";
import { render7Segment, findMatchingPattern } from "./segments";
import { renderDecoderSchematic } from "./circuit";
import { HEX_EXPRESSIONS, BCD_EXPRESSIONS } from "./hexExpressions";

/* ------------------------------------------------------------------ */
/* DEPENDENCY INTERFACE                                                */
/* ------------------------------------------------------------------ */

export interface Web3State {
    currentMode: "interactive" | "counter";
    isHexMode: boolean;
    isCommonAnode: boolean;
    currentInput: number;
    segmentValues: SegmentPattern;
    zoomScale: number;
    panX: number;
    panY: number;
    segWaveHistory: { time: number; segs: Record<SegmentId, number> }[];
    segWaveTimer: number;
    counterInterval: ReturnType<typeof setInterval> | null;
}

export interface Web3Els {
    step1: HTMLElement;
    step3: HTMLElement;
    backToStep2: HTMLButtonElement;
    breadcrumbCurrent: HTMLElement;
    encBcdBtn: HTMLButtonElement;
    encHexBtn: HTMLButtonElement;
    polCathodeBtn: HTMLButtonElement;
    polAnodeBtn: HTMLButtonElement;
    segmentDisplay: HTMLElement;
    reverseMatchText: HTMLElement;
    bcdInput: HTMLElement;
    truthTable: HTMLElement;
    booleanExpressions: HTMLElement;
    karnaughMaps: HTMLElement;
    circuitDiagram: HTMLElement;
    verilogBox: HTMLElement;
    copyVerilogBtn: HTMLButtonElement;
    segTimingCanvas: HTMLCanvasElement;
    displayHint: HTMLElement;
    counterSection: HTMLElement;
    counterStart: HTMLButtonElement;
    counterStop: HTMLButtonElement;
    counterReset: HTMLButtonElement;
    counterStepFwd: HTMLButtonElement;
    counterStepBack: HTMLButtonElement;
    counterSpeed: HTMLInputElement;
    speedLabel: HTMLElement;
    zoomInBtn: HTMLButtonElement;
    zoomOutBtn: HTMLButtonElement;
    zoomResetBtn: HTMLButtonElement;
}

export interface Web3Deps {
    els: Web3Els;
    state: Web3State;
    sfx: any;
}

/* ------------------------------------------------------------------ */
/* SEGMENT WAVEFORM TIMING DIAGRAM                                     */
/* ------------------------------------------------------------------ */

export function recordSegmentWave(deps: Web3Deps): void {
    const { state } = deps;
    state.segWaveTimer++;
    state.segWaveHistory.push({ time: state.segWaveTimer, segs: { ...state.segmentValues } });
    if (state.segWaveHistory.length > 25) {
        state.segWaveHistory.shift();
    }
    drawSegTimingDiagram(deps);
}

function drawSegTimingDiagram(deps: Web3Deps): void {
    const { state, els } = deps;
    const canvas = els.segTimingCanvas;
    if (!canvas || state.segWaveHistory.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const rowHeight = Math.floor((h - 20) / 7);
    const startX = 90;
    const graphWidth = w - startX - 30;
    const stepX = graphWidth / Math.max(15, state.segWaveHistory.length - 1);

    // Background grid lines.
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

        ctx.font = "bold 12px 'JetBrains Mono', Consolas, monospace";
        ctx.fillStyle = "#38bdf8";
        ctx.textAlign = "right";
        ctx.fillText(`seg ${sId}`, startX - 10, lowY - 2);

        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        state.segWaveHistory.forEach((pt, i) => {
            const x = startX + i * stepX;
            const isLit = state.isCommonAnode ? pt.segs[sId] === 0 : pt.segs[sId] === 1;
            const y = isLit ? highY : lowY;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevLit = state.isCommonAnode
                    ? state.segWaveHistory[i - 1].segs[sId] === 0
                    : state.segWaveHistory[i - 1].segs[sId] === 1;
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

/* ------------------------------------------------------------------ */
/* INPUT CONTROLS                                                      */
/* ------------------------------------------------------------------ */

export function buildInputs(deps: Web3Deps): void {
    const { state, els, sfx } = deps;
    const bits = [
        { name: "A", weight: 8 },
        { name: "B", weight: 4 },
        { name: "C", weight: 2 },
        { name: "D", weight: 1 },
    ];

    els.bcdInput.innerHTML = bits.map(b => {
        const val = (state.currentInput & b.weight) ? 1 : 0;
        return `
            <button type="button" class="input-toggle-btn ${val ? "active" : ""}" data-weight="${b.weight}">
                <span>${b.name} (${b.weight})</span>
                <span class="input-val-badge">${val}</span>
            </button>
        `;
    }).join("");

    els.bcdInput.querySelectorAll(".input-toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const w = Number(btn.getAttribute("data-weight"));
            if (state.currentInput & w) state.currentInput &= ~w;
            else state.currentInput |= w;

            const maxLimit = state.isHexMode ? 15 : 9;
            if (state.currentInput > maxLimit) state.currentInput = maxLimit;

            if (sfx) sfx.click(true);
            syncDisplayFromInput(deps);
        });
    });
}

export function syncDisplayFromInput(deps: Web3Deps): void {
    const { state } = deps;
    const pat = HEX_PATTERNS[state.currentInput] || HEX_PATTERNS[0];
    SEGMENTS.forEach(s => {
        state.segmentValues[s] = state.isCommonAnode ? (1 - pat[s]) : pat[s];
    });
    updateAllViews(deps);
}

export function updateAllViews(deps: Web3Deps): void {
    const { state, els, sfx } = deps;

    els.segmentDisplay.innerHTML = render7Segment(state.segmentValues, state.isCommonAnode);
    els.segmentDisplay.querySelectorAll(".segment-group").forEach(grp => {
        grp.addEventListener("click", () => {
            if (state.currentMode !== "interactive") return;
            const seg = grp.getAttribute("data-seg") as SegmentId | null;
            if (seg) {
                state.segmentValues[seg] = state.segmentValues[seg] === 1 ? 0 : 1;
                if (sfx) sfx.click(state.segmentValues[seg] === 1);
                reverseDecodeCustomDisplay(deps);
            }
        });
    });

    els.reverseMatchText.textContent = findMatchingPattern(
        state.segmentValues, state.isHexMode, state.isCommonAnode,
    );

    els.bcdInput.querySelectorAll(".input-toggle-btn").forEach(btn => {
        const w = Number(btn.getAttribute("data-weight"));
        const isHigh = (state.currentInput & w) !== 0;
        btn.classList.toggle("active", isHigh);
        const badge = btn.querySelector(".input-val-badge");
        if (badge) badge.textContent = isHigh ? "1" : "0";
    });

    els.truthTable.querySelectorAll("tbody tr").forEach(tr => {
        const rowVal = Number(tr.getAttribute("data-val"));
        tr.classList.toggle("active-row", rowVal === state.currentInput);
    });

    renderCircuitDiagram(deps);
    recordSegmentWave(deps);
}

function reverseDecodeCustomDisplay(deps: Web3Deps): void {
    const { state, els, sfx } = deps;
    els.segmentDisplay.innerHTML = render7Segment(state.segmentValues, state.isCommonAnode);
    els.segmentDisplay.querySelectorAll(".segment-group").forEach(grp => {
        grp.addEventListener("click", () => {
            const seg = grp.getAttribute("data-seg") as SegmentId | null;
            if (seg) {
                state.segmentValues[seg] = state.segmentValues[seg] === 1 ? 0 : 1;
                if (sfx) sfx.click(state.segmentValues[seg] === 1);
                reverseDecodeCustomDisplay(deps);
            }
        });
    });
    els.reverseMatchText.textContent = findMatchingPattern(
        state.segmentValues, state.isHexMode, state.isCommonAnode,
    );
    recordSegmentWave(deps);
}

/* ------------------------------------------------------------------ */
/* TRUTH TABLE                                                         */
/* ------------------------------------------------------------------ */

export function buildTruthTable(deps: Web3Deps): void {
    const { state, els } = deps;
    const totalRows = state.isHexMode ? 16 : 10;
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
            const val = state.isCommonAnode ? (1 - p[s]) : p[s];
            const isLit = state.isCommonAnode ? val === 0 : val === 1;
            const cls = isLit ? "tt-one" : "tt-zero";
            html += `<td class="${cls}">${val}</td>`;
        });
        html += `</tr>`;
    }

    html += `</tbody></table>`;
    els.truthTable.innerHTML = html;
}

/* ------------------------------------------------------------------ */
/* BOOLEAN FORMULAS & VERILOG                                          */
/* ------------------------------------------------------------------ */

export function buildExpressions(deps: Web3Deps): void {
    const { state, els, sfx } = deps;
    const expressions = state.isHexMode ? HEX_EXPRESSIONS : BCD_EXPRESSIONS;
    els.booleanExpressions.innerHTML = SEGMENTS.map(s => `
        <div class="expression-card">
            <h3>Segment ${s.toUpperCase()}</h3>
            <div class="expression-formula">${s} = ${expressions[s]}</div>
        </div>
    `).join("");

    const code = generateVerilogModule(state.isHexMode, state.isCommonAnode);
    els.verilogBox.textContent = code;

    els.copyVerilogBtn.onclick = () => {
        if (sfx) sfx.click(true);
        navigator.clipboard.writeText(code).then(() => {
            els.copyVerilogBtn.textContent = "✅ Copied!";
            els.copyVerilogBtn.classList.add("copied");
            setTimeout(() => {
                els.copyVerilogBtn.textContent = "📋 Copy Verilog";
                els.copyVerilogBtn.classList.remove("copied");
            }, 1600);
        });
    };
}

function generateVerilogModule(isHexMode: boolean, isCommonAnode: boolean): string {
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

/* ------------------------------------------------------------------ */
/* KARNAUGH MAPS                                                       */
/* ------------------------------------------------------------------ */

export function buildKarnaughMaps(deps: Web3Deps): void {
    const { state, els } = deps;
    const rowLabels = ["00", "01", "11", "10"];
    const colLabels = ["00", "01", "11", "10"];

    const grid = [
        [0, 1, 3, 2],
        [4, 5, 7, 6],
        [12, 13, 15, 14],
        [8, 9, 11, 10],
    ];

    els.karnaughMaps.innerHTML = SEGMENTS.map(s => {
        const minterms = state.isHexMode
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

                if (!state.isHexMode && m >= 10) {
                    cellCls = "km-dontcare";
                    cellVal = "X";
                } else if (minterms.includes(m)) {
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

/* ------------------------------------------------------------------ */
/* CIRCUIT DIAGRAM + ZOOM/PAN                                          */
/* ------------------------------------------------------------------ */

export function renderCircuitDiagram(deps: Web3Deps): void {
    const { state, els } = deps;
    els.circuitDiagram.innerHTML = renderDecoderSchematic(
        state.currentInput, state.segmentValues, state.isHexMode, state.isCommonAnode,
    );
    applyZoom(deps);
}

function applyZoom(deps: Web3Deps): void {
    const { state, els } = deps;
    const svg = els.circuitDiagram.querySelector("svg") as SVGSVGElement | null;
    if (svg) {
        svg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomScale})`;
    }
}

function resetZoom(deps: Web3Deps): void {
    deps.state.zoomScale = 1.0;
    deps.state.panX = 0;
    deps.state.panY = 0;
    applyZoom(deps);
}

export function setupZoomPan(deps: Web3Deps): void {
    const { state, els, sfx } = deps;
    let isDragging = false;
    let startDragX = 0;
    let startDragY = 0;

    els.zoomInBtn.addEventListener("click", () => {
        state.zoomScale = Math.min(2.5, state.zoomScale + 0.2);
        applyZoom(deps);
        if (sfx) sfx.click(true);
    });

    els.zoomOutBtn.addEventListener("click", () => {
        state.zoomScale = Math.max(0.4, state.zoomScale - 0.2);
        applyZoom(deps);
        if (sfx) sfx.click(false);
    });

    els.zoomResetBtn.addEventListener("click", () => resetZoom(deps));

    els.circuitDiagram.addEventListener("wheel", (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        state.zoomScale = Math.min(2.5, Math.max(0.4, state.zoomScale + delta));
        applyZoom(deps);
    }, { passive: false });

    els.circuitDiagram.addEventListener("mousedown", (e: MouseEvent) => {
        if (e.button !== 0) return;
        isDragging = true;
        startDragX = e.clientX - state.panX;
        startDragY = e.clientY - state.panY;
        els.circuitDiagram.style.cursor = "grabbing";
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
        if (!isDragging) return;
        state.panX = e.clientX - startDragX;
        state.panY = e.clientY - startDragY;
        applyZoom(deps);
    });

    window.addEventListener("mouseup", () => {
        isDragging = false;
        els.circuitDiagram.style.cursor = "grab";
    });
}

/* ------------------------------------------------------------------ */
/* COUNTER CONTROLS                                                    */
/* ------------------------------------------------------------------ */

export function setupCounter(deps: Web3Deps): void {
    const { state, els, sfx } = deps;

    function stepCounter(dir = 1): void {
        const maxVal = state.isHexMode ? 15 : 9;
        if (dir === 1) {
            state.currentInput = (state.currentInput + 1) % (maxVal + 1);
        } else {
            state.currentInput = (state.currentInput - 1 + (maxVal + 1)) % (maxVal + 1);
        }
        if (sfx) sfx.tick();
        syncDisplayFromInput(deps);
    }

    els.counterStart.addEventListener("click", () => {
        if (state.counterInterval) return;
        els.counterStart.disabled = true;
        els.counterStop.disabled = false;
        if (sfx) sfx.relay();

        const speed = Number(els.counterSpeed.value);
        state.counterInterval = setInterval(() => stepCounter(1), speed);
    });

    els.counterStop.addEventListener("click", () => {
        if (state.counterInterval) {
            clearInterval(state.counterInterval);
            state.counterInterval = null;
        }
        els.counterStart.disabled = false;
        els.counterStop.disabled = true;
        if (sfx) sfx.click(false);
    });

    els.counterReset.addEventListener("click", () => {
        if (state.counterInterval) {
            clearInterval(state.counterInterval);
            state.counterInterval = null;
            els.counterStart.disabled = false;
            els.counterStop.disabled = true;
        }
        state.currentInput = 0;
        if (sfx) sfx.click(true);
        syncDisplayFromInput(deps);
    });

    els.counterStepFwd.addEventListener("click", () => stepCounter(1));
    els.counterStepBack.addEventListener("click", () => stepCounter(-1));

    els.counterSpeed.addEventListener("input", () => {
        const ms = Number(els.counterSpeed.value);
        const hz = (1000 / ms).toFixed(2);
        els.speedLabel.textContent = `${ms}ms (${hz} Hz)`;

        if (state.counterInterval) {
            clearInterval(state.counterInterval);
            state.counterInterval = setInterval(() => stepCounter(1), ms);
        }
    });
}

/* ------------------------------------------------------------------ */
/* LED COLOR PICKER                                                    */
/* ------------------------------------------------------------------ */

export function setupLedColorPicker(deps: Web3Deps): void {
    document.querySelectorAll(".color-swatch").forEach(swatch => {
        swatch.addEventListener("click", () => {
            const theme = swatch.getAttribute("data-led");
            if (theme) {
                document.body.classList.remove("led-red", "led-green", "led-cyan", "led-amber", "led-purple", "led-white");
                document.body.classList.add(theme);
                document.querySelectorAll(".color-swatch").forEach(s => s.classList.remove("active"));
                swatch.classList.add("active");
                if (deps.sfx) deps.sfx.click(true);
                updateAllViews(deps);
            }
        });
    });
}

/* ------------------------------------------------------------------ */
/* KEYBOARD TYPING SUPPORT                                             */
/* ------------------------------------------------------------------ */

export function setupKeyboard(deps: Web3Deps): void {
    const { state, sfx } = deps;
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        const key = e.key.toUpperCase();
        const hexIdx = HEX_CHARS.indexOf(key);

        if (hexIdx !== -1) {
            if (!state.isHexMode && hexIdx > 9) return;
            state.currentInput = hexIdx;
            if (sfx) sfx.relay();
            syncDisplayFromInput(deps);
        }
    });
}

/* ------------------------------------------------------------------ */
/* MODE & CONFIGURATION CONTROLS                                       */
/* ------------------------------------------------------------------ */

export function setupModeControls(deps: Web3Deps): void {
    const { state, els, sfx } = deps;

    function refreshAll(): void {
        syncDisplayFromInput(deps);
        buildTruthTable(deps);
        buildExpressions(deps);
        buildKarnaughMaps(deps);
    }

    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cat = btn.getAttribute("data-category") as "interactive" | "counter";
            state.currentMode = cat;
            els.step1.classList.add("hidden");
            els.step3.classList.remove("hidden");

            els.counterSection.classList.toggle("hidden", state.currentMode !== "counter");
            els.displayHint.textContent = state.currentMode === "interactive"
                ? "Click segments, use binary switches, or press 0-F on your keyboard to control the display."
                : "Use the clock controls below to run the automated counter.";

            els.breadcrumbCurrent.textContent = `7-Segment Display Simulator / ${state.currentMode === "interactive" ? "Interactive Mode" : "Counter Mode"}`;

            if (sfx) sfx.relay();
            refreshAll();
        });
    });

    els.backToStep2.addEventListener("click", () => {
        if (state.counterInterval) {
            clearInterval(state.counterInterval);
            state.counterInterval = null;
            els.counterStart.disabled = false;
            els.counterStop.disabled = true;
        }
        els.step1.classList.remove("hidden");
        els.step3.classList.add("hidden");
        els.breadcrumbCurrent.textContent = "7-Segment Display Simulator";
    });

    els.encBcdBtn.addEventListener("click", () => {
        state.isHexMode = false;
        els.encBcdBtn.classList.add("active");
        els.encHexBtn.classList.remove("active");
        if (state.currentInput > 9) state.currentInput = 0;

        if (sfx) sfx.click(true);
        refreshAll();
    });

    els.encHexBtn.addEventListener("click", () => {
        state.isHexMode = true;
        els.encHexBtn.classList.add("active");
        els.encBcdBtn.classList.remove("active");

        if (sfx) sfx.click(true);
        refreshAll();
    });

    els.polCathodeBtn.addEventListener("click", () => {
        state.isCommonAnode = false;
        els.polCathodeBtn.classList.add("active");
        els.polAnodeBtn.classList.remove("active");

        if (sfx) sfx.click(true);
        syncDisplayFromInput(deps);
        buildTruthTable(deps);
        buildExpressions(deps);
    });

    els.polAnodeBtn.addEventListener("click", () => {
        state.isCommonAnode = true;
        els.polAnodeBtn.classList.add("active");
        els.polCathodeBtn.classList.remove("active");

        if (sfx) sfx.click(true);
        syncDisplayFromInput(deps);
        buildTruthTable(deps);
        buildExpressions(deps);
    });
}
