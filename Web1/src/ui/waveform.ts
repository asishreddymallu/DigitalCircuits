/**
 * Interactive Waveform Playground for Web1.
 *
 * Allows users to configure input signal patterns over time and see the
 * output waveform computed from the solved Boolean function.
 */

import { byId } from "./dom";
import { evalAst } from "../../../shared/ts/boolean/ast";
import type { AstNode } from "../../../shared/ts/boolean/ast";

export interface WaveformState {
    variables: string[];
    expression: AstNode | null;
    stepCount: number;
    patterns: Record<string, boolean[]>;  // variable -> array of 0/1 per step
    outputPattern: boolean[];
    currentStep: number;
    isPlaying: boolean;
    speed: number;  // ms per step
    timer: ReturnType<typeof setInterval> | null;
    zoomLevel: number;
}

const state: WaveformState = {
    variables: [],
    expression: null,
    stepCount: 16,
    patterns: {},
    outputPattern: [],
    currentStep: 0,
    isPlaying: false,
    speed: 500,
    timer: null,
    zoomLevel: 1,
};

/** Initialize the waveform playground with new variables and expression. */
export function initWaveformPlayground(variables: string[], expression: AstNode): void {
    state.variables = variables;
    state.expression = expression;
    state.stepCount = 16;
    state.currentStep = 0;
    state.isPlaying = false;
    state.patterns = {};

    // Generate default patterns
    variables.forEach((v, idx) => {
        const pattern: boolean[] = [];
        const period = 1 << (variables.length - 1 - idx);
        for (let step = 0; step < state.stepCount; step++) {
            pattern.push(((step / period) | 0) % 2 === 1);
        }
        state.patterns[v] = pattern;
    });

    computeOutput();
    renderGridEditor();
    drawWaveform();
    updateControls();

    // Show the playground
    const section = byId<HTMLElement>("openInPlaygroundSection");
    if (section) section.style.display = "";
}

/** Reset the waveform state. */
export function resetWaveform(): void {
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    state.isPlaying = false;
    state.variables = [];
    state.expression = null;
    state.patterns = {};
    state.outputPattern = [];
    state.currentStep = 0;
}

/** Compute the output pattern from current input patterns. */
function computeOutput(): void {
    if (!state.expression || state.variables.length === 0) return;
    state.outputPattern = [];
    for (let step = 0; step < state.stepCount; step++) {
        const assignment: Record<string, boolean> = {};
        state.variables.forEach(v => {
            assignment[v] = state.patterns[v]?.[step] ?? false;
        });
        state.outputPattern.push(evalAst(state.expression, assignment));
    }
}

/** Render the grid editor (clickable cells for each variable). */
function renderGridEditor(): void {
    const container = byId<HTMLDivElement>("waveformInputRows");
    if (!container) return;

    let html = "";

    // Input rows
    state.variables.forEach(v => {
        html += `<div class="waveform-input-row">`;
        html += `<span class="waveform-input-label">${v}</span>`;
        html += `<div class="waveform-input-cells">`;
        for (let step = 0; step < state.stepCount; step++) {
            const val = state.patterns[v]?.[step] ?? false;
            const cls = val ? "waveform-cell waveform-cell-high" : "waveform-cell waveform-cell-low";
            const currentCls = step === state.currentStep ? " current-step" : "";
            html += `<div class="${cls}${currentCls}" data-var="${v}" data-step="${step}" role="button" tabindex="0" aria-label="${v} step ${step}: ${val ? '1' : '0'}">${val ? "1" : "0"}</div>`;
        }
        html += `</div></div>`;
    });

    // Output row
    html += `<div class="waveform-input-row">`;
    html += `<span class="waveform-input-label" style="color:var(--accent-secondary);">F</span>`;
    html += `<div class="waveform-input-cells">`;
    for (let step = 0; step < state.stepCount; step++) {
        const val = state.outputPattern[step] ?? false;
        const cls = val ? "waveform-cell waveform-cell-high" : "waveform-cell waveform-cell-output";
        const currentCls = step === state.currentStep ? " current-step" : "";
        html += `<div class="${cls}${currentCls}">${val ? "1" : "0"}</div>`;
    }
    html += `</div></div>`;

    container.innerHTML = html;

    // Wire up click handlers
    container.querySelectorAll<HTMLElement>("[data-var]").forEach(cell => {
        cell.addEventListener("click", () => {
            const v = cell.getAttribute("data-var")!;
            const step = parseInt(cell.getAttribute("data-step")!);
            if (!state.patterns[v]) state.patterns[v] = [];
            state.patterns[v][step] = !state.patterns[v][step];
            computeOutput();
            renderGridEditor();
            drawWaveform();
        });
        cell.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                cell.click();
            }
        });
    });
}

/** Draw the waveform timing diagram on the canvas. */
function drawWaveform(): void {
    const canvas = byId<HTMLCanvasElement>("waveformCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas
    const wrapper = canvas.parentElement;
    if (wrapper) {
        canvas.width = wrapper.clientWidth - 2;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (state.variables.length === 0) return;

    const signalNames = [...state.variables, "F"];
    const startX = 50;
    const graphWidth = w - startX - 20;
    const rowHeight = Math.min(28, Math.floor((h - 10) / signalNames.length));
    const stepX = (graphWidth / Math.max(1, state.stepCount - 1)) * state.zoomLevel;

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i < state.stepCount; i++) {
        const x = startX + i * stepX;
        ctx.beginPath();
        ctx.moveTo(x, 5);
        ctx.lineTo(x, h - 5);
        ctx.stroke();
    }

    // Current step indicator
    const curX = startX + state.currentStep * stepX;
    ctx.strokeStyle = "rgba(56, 189, 248, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(curX, 5);
    ctx.lineTo(curX, h - 5);
    ctx.stroke();

    signalNames.forEach((name, idx) => {
        const isOutput = name === "F";
        const pattern = isOutput ? state.outputPattern : state.patterns[name];
        if (!pattern) return;

        const topY = 10 + idx * rowHeight;
        const lowY = topY + rowHeight - 5;
        const highY = topY + 5;

        // Label
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = isOutput ? "#34d399" : "#60a5fa";
        ctx.textAlign = "right";
        ctx.fillText(name, startX - 8, (highY + lowY) / 2 + 4);

        // Waveform
        ctx.strokeStyle = isOutput ? "#10b981" : "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();

        for (let step = 0; step < state.stepCount; step++) {
            const x = startX + step * stepX;
            const val = pattern[step];
            const y = val ? highY : lowY;

            if (step === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevVal = pattern[step - 1];
                const prevY = prevVal ? highY : lowY;
                if (prevY !== y) {
                    ctx.lineTo(x, prevY);
                    ctx.lineTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
        ctx.stroke();
    });

    // Update time display
    byId<HTMLElement>("waveformTimeDisplay").textContent = String(state.currentStep);
    byId<HTMLElement>("waveformPeriodDisplay").textContent = String(state.stepCount);
}

/** Update control button states. */
function updateControls(): void {
    const playBtn = byId<HTMLButtonElement>("waveformPlayBtn");
    const pauseBtn = byId<HTMLButtonElement>("waveformPauseBtn");
    if (playBtn) playBtn.classList.toggle("active", !state.isPlaying);
    if (pauseBtn) pauseBtn.classList.toggle("active", state.isPlaying);
}

/** Step forward one step. */
function stepForward(): void {
    state.currentStep = (state.currentStep + 1) % state.stepCount;
    renderGridEditor();
    drawWaveform();
}

/** Step backward one step. */
function stepBackward(): void {
    state.currentStep = (state.currentStep - 1 + state.stepCount) % state.stepCount;
    renderGridEditor();
    drawWaveform();
}

/** Start auto-play. */
function startPlay(): void {
    if (state.isPlaying) return;
    state.isPlaying = true;
    state.timer = setInterval(() => {
        stepForward();
        // Ensure UI updates
        updateControls();
    }, state.speed);
    updateControls();
}

/** Pause auto-play. */
function pausePlay(): void {
    if (!state.isPlaying) return;
    state.isPlaying = false;
    if (state.timer) clearInterval(state.timer);
    state.timer = null;
    updateControls();
}

/** Stop and reset to step 0. */
function stopPlay(): void {
    pausePlay();
    state.currentStep = 0;
    renderGridEditor();
    drawWaveform();
}

/** Wire up all waveform controls. Called once at init. */
export function setupWaveformControls(): void {
    byId<HTMLButtonElement>("waveformPlayBtn")?.addEventListener("click", startPlay);
    byId<HTMLButtonElement>("waveformPauseBtn")?.addEventListener("click", pausePlay);
    byId<HTMLButtonElement>("waveformStopBtn")?.addEventListener("click", stopPlay);
    byId<HTMLButtonElement>("waveformStepFwdBtn")?.addEventListener("click", stepForward);
    byId<HTMLButtonElement>("waveformStepBackBtn")?.addEventListener("click", stepBackward);

    const speedSlider = byId<HTMLInputElement>("waveformSpeed");
    const speedLabel = byId<HTMLElement>("waveformSpeedLabel");
    if (speedSlider) {
        speedSlider.addEventListener("input", () => {
            state.speed = Number(speedSlider.value);
            if (speedLabel) speedLabel.textContent = `${state.speed}ms`;
            if (state.isPlaying) {
                pausePlay();
                startPlay();
            }
        });
    }

    byId<HTMLButtonElement>("waveformZoomIn")?.addEventListener("click", () => {
        state.zoomLevel = Math.min(3, state.zoomLevel + 0.5);
        drawWaveform();
    });
    byId<HTMLButtonElement>("waveformZoomOut")?.addEventListener("click", () => {
        state.zoomLevel = Math.max(0.5, state.zoomLevel - 0.5);
        drawWaveform();
    });

    // Step count control
    const stepsSelect = byId<HTMLSelectElement>("waveformSteps");
    if (stepsSelect) {
        stepsSelect.addEventListener("change", () => {
            const newCount = Number(stepsSelect.value);
            if (newCount !== state.stepCount && state.variables.length > 0) {
                state.stepCount = newCount;
                state.currentStep = 0;
                // Regenerate patterns for new step count
                state.variables.forEach((v, idx) => {
                    const pattern: boolean[] = [];
                    const period = 1 << (state.variables.length - 1 - idx);
                    for (let step = 0; step < state.stepCount; step++) {
                        pattern.push(((step / period) | 0) % 2 === 1);
                    }
                    state.patterns[v] = pattern;
                });
                computeOutput();
                renderGridEditor();
                drawWaveform();
                updateControls();
                const periodDisplay = byId<HTMLElement>("waveformPeriodDisplay");
                if (periodDisplay) periodDisplay.textContent = String(state.stepCount);
            }
        });
    }

    // Redraw on window resize
    window.addEventListener("resize", () => drawWaveform());
}
