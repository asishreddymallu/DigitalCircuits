/**
 * UI logic for the Web2 combinational circuits simulator.
 *
 * Handles: waveform recording + timing diagram, input button rendering,
 * circuit state updates, truth table / expression building, zoom/pan,
 * ripple carry animation, and category navigation.
 *
 * All functions accept the DOM elements and state they need as parameters,
 * keeping this module free of module-scope side effects.
 */

import type { CircuitDefinition, WaveformPoint } from "./types";

/** Dependencies that script.ts injects at startup. */
export interface UIDependencies {
    /** DOM refs (same shape as the element IDs in index.html). */
    els: {
        circuitTitle: HTMLElement;
        breadcrumbCategory: HTMLElement;
        inputControls: HTMLElement;
        rippleControls: HTMLElement;
        rippleAnimateBtn: HTMLButtonElement;
        rippleStepBadge: HTMLElement;
        circuitDiagram: HTMLElement;
        truthTable: HTMLElement;
        booleanExpressions: HTMLElement;
        verilogCode: HTMLElement;
        copyVerilogBtn: HTMLButtonElement;
        timingCanvas: HTMLCanvasElement;
        zoomInBtn: HTMLButtonElement;
        zoomOutBtn: HTMLButtonElement;
        zoomResetBtn: HTMLButtonElement;
        step1: HTMLElement;
        step2: HTMLElement;
        step3: HTMLElement;
        step2Title: HTMLElement;
        subcategoryGrid: HTMLElement;
        backToStep2: HTMLButtonElement;
    };
    /** Mutable state object shared with script.ts. */
    state: {
        currentCircuit: CircuitDefinition | null;
        currentInputs: Record<string, number>;
        zoomScale: number;
        panX: number;
        panY: number;
        waveformHistory: WaveformPoint[];
        waveTimeCounter: number;
    };
    /** Sound effects interface (StudioFX or null). */
    sfx: any;
    /** All circuit definitions. */
    circuits: Record<string, CircuitDefinition>;
    /** All category definitions. */
    categories: Record<string, { title: string; circuits: string[] }>;
}

/* ------------------------------------------------------------------ */
/* WAVEFORM TIMING DIAGRAM                                             */
/* ------------------------------------------------------------------ */

export function recordWaveformSample(deps: UIDependencies): void {
    const { state, els } = deps;
    if (!state.currentCircuit) return;
    const outputs = state.currentCircuit.evaluate(state.currentInputs);
    const sample: Record<string, number> = { ...state.currentInputs, ...outputs };

    state.waveTimeCounter++;
    state.waveformHistory.push({ time: state.waveTimeCounter, signals: sample });
    if (state.waveformHistory.length > 25) {
        state.waveformHistory.shift();
    }
    drawTimingDiagram(deps);
}

export function drawTimingDiagram(deps: UIDependencies): void {
    const { state, els } = deps;
    const canvas = els.timingCanvas;
    if (!canvas || !state.currentCircuit || state.waveformHistory.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const signalNames = [...state.currentCircuit.inputs, ...state.currentCircuit.outputs];
    const rowHeight = Math.min(32, Math.floor((h - 20) / signalNames.length));
    const startX = 120;
    const graphWidth = w - startX - 30;
    const stepX = graphWidth / Math.max(15, state.waveformHistory.length - 1);

    // Background grid lines.
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = startX; x < w - 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x, h - 10);
        ctx.stroke();
    }

    signalNames.forEach((sigName, sigIdx) => {
        const topY = 15 + sigIdx * rowHeight;
        const lowY = topY + rowHeight - 8;
        const highY = topY + 4;

        // Signal label.
        ctx.font = "bold 11px 'JetBrains Mono', Consolas, monospace";
        ctx.fillStyle = sigIdx < state.currentCircuit!.inputs.length ? "#60a5fa" : "#34d399";
        ctx.textAlign = "right";
        ctx.fillText(sigName, startX - 10, lowY - 3);

        // Waveform path.
        ctx.strokeStyle = sigIdx < state.currentCircuit!.inputs.length ? "#38bdf8" : "#10b981";
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        state.waveformHistory.forEach((pt, i) => {
            const x = startX + i * stepX;
            const val = pt.signals[sigName] ?? 0;
            const y = val === 1 ? highY : lowY;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevVal = state.waveformHistory[i - 1].signals[sigName] ?? 0;
                const prevY = prevVal === 1 ? highY : lowY;
                if (prevY !== y) {
                    ctx.lineTo(x, prevY); // Vertical clock edge.
                }
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    });
}

/* ------------------------------------------------------------------ */
/* CIRCUIT WORKSPACE                                                   */
/* ------------------------------------------------------------------ */

export function loadCircuitWorkspace(circuit: CircuitDefinition, deps: UIDependencies): void {
    const { state, els } = deps;
    state.currentCircuit = circuit;
    state.currentInputs = {};
    circuit.inputs.forEach(inp => { state.currentInputs[inp] = 0; });
    state.waveformHistory = [];
    state.waveTimeCounter = 0;

    els.circuitTitle.textContent = `${circuit.title} Workspace`;
    els.breadcrumbCategory.textContent = `Circuits Simulator / ${circuit.title}`;

    els.rippleControls.classList.toggle("hidden", circuit.id !== "ripple_carry_adder_4bit");

    buildInputButtons(deps);
    updateCircuitState(deps);
    buildTruthTable(deps);
    buildExpressions(deps);

    els.step2.classList.add("hidden");
    els.step3.classList.remove("hidden");
    resetZoom(deps);
}

export function buildInputButtons(deps: UIDependencies): void {
    const { state, els } = deps;
    if (!state.currentCircuit) return;

    els.inputControls.innerHTML = state.currentCircuit.inputs.map(inp => `
        <button type="button" class="input-toggle-btn" data-input="${inp}">
            <span>${inp}</span>
            <span class="input-val-badge">0</span>
        </button>
    `).join("");

    els.inputControls.querySelectorAll(".input-toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const inpName = btn.getAttribute("data-input");
            if (inpName) {
                state.currentInputs[inpName] = state.currentInputs[inpName] === 1 ? 0 : 1;
                if (deps.sfx) deps.sfx.click(state.currentInputs[inpName] === 1);
                updateCircuitState(deps);
            }
        });
    });
}

export function updateCircuitState(deps: UIDependencies, rippleStage = -1): void {
    const { state, els } = deps;
    if (!state.currentCircuit) return;

    // Update input button badges.
    els.inputControls.querySelectorAll(".input-toggle-btn").forEach(btn => {
        const inpName = btn.getAttribute("data-input");
        if (inpName) {
            const isHigh = state.currentInputs[inpName] === 1;
            btn.classList.toggle("active", isHigh);
            const badge = btn.querySelector(".input-val-badge");
            if (badge) badge.textContent = isHigh ? "1" : "0";
        }
    });

    // Render schematic.
    const outputs = state.currentCircuit.evaluate(state.currentInputs);
    els.circuitDiagram.innerHTML = state.currentCircuit.renderSchematic(state.currentInputs, outputs, rippleStage);
    applyZoom(deps);

    // Highlight active row in truth table.
    const inVals = state.currentCircuit.inputs.map(k => state.currentInputs[k]);
    els.truthTable.querySelectorAll("tbody tr").forEach(tr => {
        const rowData = tr.getAttribute("data-inputs");
        if (rowData) {
            tr.classList.toggle("active-row", rowData === inVals.join(","));
        }
    });

    recordWaveformSample(deps);
}

/* ------------------------------------------------------------------ */
/* TRUTH TABLE & EXPRESSIONS                                           */
/* ------------------------------------------------------------------ */

export function buildTruthTable(deps: UIDependencies): void {
    const { state, els } = deps;
    if (!state.currentCircuit) return;
    const inKeys = state.currentCircuit.inputs;
    const outKeys = state.currentCircuit.outputs;

    let html = `<table class="truth-table"><thead><tr>`;
    inKeys.forEach(k => { html += `<th>${k}</th>`; });
    outKeys.forEach(k => { html += `<th>${k}</th>`; });
    html += `</tr></thead><tbody>`;

    state.currentCircuit.truthTable.forEach(row => {
        html += `<tr data-inputs="${row.inputs.join(",")}">`;
        row.inputs.forEach(v => { html += `<td>${v}</td>`; });
        row.outputs.forEach(v => {
            html += `<td class="${v === 1 ? "tt-one" : "tt-zero"}">${v}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    els.truthTable.innerHTML = html;
}

export function buildExpressions(deps: UIDependencies): void {
    const { state, els } = deps;
    if (!state.currentCircuit) return;

    els.booleanExpressions.innerHTML = state.currentCircuit.expressions.map(exp => `
        <div class="expression-card">
            <h3>${exp.output}</h3>
            <div class="expression-formula">${exp.formula}</div>
        </div>
    `).join("");

    els.verilogCode.textContent = state.currentCircuit.verilogModule;
    els.copyVerilogBtn.onclick = () => {
        if (deps.sfx) deps.sfx.click(true);
        navigator.clipboard.writeText(state.currentCircuit!.verilogModule).then(() => {
            els.copyVerilogBtn.textContent = "✅ Copied!";
            els.copyVerilogBtn.classList.add("copied");
            setTimeout(() => {
                els.copyVerilogBtn.textContent = "📋 Copy Verilog";
                els.copyVerilogBtn.classList.remove("copied");
            }, 1600);
        });
    };
}

/* ------------------------------------------------------------------ */
/* ZOOM & PAN                                                          */
/* ------------------------------------------------------------------ */

export function applyZoom(deps: UIDependencies): void {
    const { state, els } = deps;
    const svg = els.circuitDiagram.querySelector("svg") as SVGSVGElement | null;
    if (svg) {
        svg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoomScale})`;
    }
}

export function resetZoom(deps: UIDependencies): void {
    deps.state.zoomScale = 1.0;
    deps.state.panX = 0;
    deps.state.panY = 0;
    applyZoom(deps);
}

/* ------------------------------------------------------------------ */
/* RIPPLE CARRY ANIMATION                                               */
/* ------------------------------------------------------------------ */

export function setupRippleAnimation(deps: UIDependencies): void {
    const { els } = deps;
    let rippleTimer: ReturnType<typeof setTimeout> | null = null;

    if (els.rippleAnimateBtn) {
        els.rippleAnimateBtn.addEventListener("click", () => {
            if (rippleTimer) clearTimeout(rippleTimer);
            let stage = 0;
            els.rippleAnimateBtn.disabled = true;
            if (deps.sfx) deps.sfx.relay();

            function step() {
                if (stage <= 3) {
                    els.rippleStepBadge.textContent = `Stage: Processing FA ${stage}...`;
                    updateCircuitState(deps, stage);
                    if (deps.sfx) deps.sfx.tick();
                    stage++;
                    rippleTimer = setTimeout(step, 650);
                } else {
                    els.rippleStepBadge.textContent = "Stage: Complete (Cout Stable)";
                    updateCircuitState(deps, -1);
                    els.rippleAnimateBtn.disabled = false;
                    if (deps.sfx) deps.sfx.success();
                }
            }
            step();
        });
    }
}

/* ------------------------------------------------------------------ */
/* CATEGORY NAVIGATION                                                 */
/* ------------------------------------------------------------------ */

export function setupNavigation(deps: UIDependencies): void {
    const { els, state, circuits, categories } = deps;

    let currentCategory: string | null = null;

    document.querySelectorAll(".category-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const catKey = btn.getAttribute("data-category");
            if (catKey && categories[catKey]) {
                currentCategory = catKey;
                const cat = categories[catKey];
                els.step2Title.textContent = `Select a ${cat.title} Model`;
                els.breadcrumbCategory.textContent = `Circuits Simulator / ${cat.title}`;

                els.subcategoryGrid.innerHTML = cat.circuits.map(cId => {
                    const c = circuits[cId];
                    return `<button class="subcategory-btn" data-circuit="${cId}">${c.title}</button>`;
                }).join("");

                els.subcategoryGrid.querySelectorAll(".subcategory-btn").forEach(sBtn => {
                    sBtn.addEventListener("click", () => {
                        const cId = sBtn.getAttribute("data-circuit");
                        if (cId && circuits[cId]) {
                            loadCircuitWorkspace(circuits[cId], deps);
                            if (deps.sfx) deps.sfx.relay();
                        }
                    });
                });

                els.step1.classList.add("hidden");
                els.step2.classList.remove("hidden");
                if (deps.sfx) deps.sfx.click(true);
            }
        });
    });

    els.backToStep2.addEventListener("click", () => {
        els.step3.classList.add("hidden");
        els.step2.classList.remove("hidden");
        if (currentCategory && categories[currentCategory]) {
            els.breadcrumbCategory.textContent = `Circuits Simulator / ${categories[currentCategory].title}`;
        }
    });
}

/* ------------------------------------------------------------------ */
/* ZOOM & PAN EVENT SETUP                                              */
/* ------------------------------------------------------------------ */

export function setupZoomPan(deps: UIDependencies): void {
    const { state, els } = deps;
    let isDragging = false;
    let startDragX = 0;
    let startDragY = 0;

    els.zoomInBtn.addEventListener("click", () => {
        state.zoomScale = Math.min(2.5, state.zoomScale + 0.2);
        applyZoom(deps);
        if (deps.sfx) deps.sfx.click(true);
    });

    els.zoomOutBtn.addEventListener("click", () => {
        state.zoomScale = Math.max(0.4, state.zoomScale - 0.2);
        applyZoom(deps);
        if (deps.sfx) deps.sfx.click(false);
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
