/**
 * Web5 — Sequential Circuits Simulator entry point.
 *
 * Simulates negative-edge-triggered flip-flops (SR, JK, T, D) driven by a
 * shared configurable clock, with gate-level schematics and 0/1 waveform
 * timing diagrams per panel.
 */

import type { FlipFlopKind, PanelState } from "./src/types";
import { FF_PANELS, SIGNAL_COLORS } from "./src/types";
import {
    createPanelState,
    stepClock,
    toggleInput,
    resetPanel,
    recordSample,
    advanceClock,
    excitationTable,
} from "./src/flipflops";
import { renderClockSchematic, renderFlipFlopSchematic, excitationTableHTML } from "./src/schematic";
import { drawSignals, panelSignals } from "./src/waveform";

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el as T;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

interface ClockState {
    tick: number;
    highTicks: number;
    lowTicks: number;
    running: boolean;
    value: boolean;
}

const clock: ClockState = {
    tick: 0,
    highTicks: 2,
    lowTicks: 2,
    running: true,
    value: false,
};

const TICK_MS = 300;
const panels = new Map<FlipFlopKind, PanelState>();
let timer: ReturnType<typeof setInterval> | null = null;

/* ------------------------------------------------------------------ */
/* Initialization                                                      */
/* ------------------------------------------------------------------ */

function init(): void {
    buildClockControls();
    buildPanels();
    setupKeyboard();
    renderAll();

    if (clock.running) start();
}

function buildClockControls(): void {
    const controls = byId("w5ClockControls");
    controls.innerHTML = `
        <button type="button" class="w5-ctrl-btn" id="w5ClockRun" title="Run / pause the clock">⏸ Pause</button>
        <button type="button" class="w5-ctrl-btn" id="w5ClockStep" title="Advance one half period">⏭ Step</button>
        <button type="button" class="w5-ctrl-btn" id="w5ClockReset" title="Reset all flip-flops (Q=0)">⟲ Reset All</button>
        <div class="w5-speed-group" role="group" aria-label="Clock speed">
            <span class="w5-speed-label">Speed</span>
            <button type="button" class="w5-speed-btn" data-speed="slow">0.5×</button>
            <button type="button" class="w5-speed-btn active" data-speed="normal">1×</button>
            <button type="button" class="w5-speed-btn" data-speed="fast">2×</button>
        </div>
    `;

    byId<HTMLButtonElement>("w5ClockRun").addEventListener("click", toggleRun);
    byId<HTMLButtonElement>("w5ClockStep").addEventListener("click", () => {
        if (clock.running) pause();
        tickOnce();
    });
    byId<HTMLButtonElement>("w5ClockReset").addEventListener("click", resetAll);

    controls.querySelectorAll<HTMLButtonElement>(".w5-speed-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const speed = btn.getAttribute("data-speed");
            controls.querySelectorAll(".w5-speed-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            if (speed === "slow") setSpeed(2);
            else if (speed === "fast") setSpeed(0.5);
            else setSpeed(1);
        });
    });
}

function buildPanels(): void {
    const host = byId("w5Panels");
    host.innerHTML = FF_PANELS.map(meta => {
        const inputNames = meta.inputs.map(n => `<span class="w5-in-name">${n}</span>`).join("");
        return `
        <section class="w5-panel" id="w5Panel-${meta.kind}" data-ff="${meta.kind}">
            <header class="w5-panel-header">
                <span class="w5-panel-icon">${meta.icon}</span>
                <div class="w5-panel-titles">
                    <h2>${meta.title}</h2>
                    <p>${meta.description}</p>
                </div>
                <span class="w5-panel-edge" title="Negative edge triggered">▾ neg-edge</span>
                <span class="w5-q-badge" id="w5Q-${meta.kind}" title="Current state Q">Q = 0</span>
            </header>
            <div class="w5-panel-grid">
                <div class="w5-panel-left">
                    <div class="w5-schematic" id="w5Schematic-${meta.kind}"></div>
                    <div class="w5-controls" id="w5Controls-${meta.kind}">
                        <span class="w5-controls-label">Inputs:</span>
                        ${meta.inputs.map(n => `
                            <button type="button" class="w5-in-btn" data-ff="${meta.kind}" data-input="${n}" aria-pressed="false">
                                ${n} <kbd>0</kbd>
                            </button>`).join("")}
                        <button type="button" class="w5-ff-reset" data-ff="${meta.kind}" title="Reset this flip-flop">⟲ Q=0</button>
                    </div>
                    <div class="w5-tt" id="w5TT-${meta.kind}">
                        <div class="w5-tt-title">Excitation table (at ↓)</div>
                        <div class="w5-tt-head"><span>${inputNames}</span><span>Action</span></div>
                        ${excitationTableHTML(excitationTable(meta.kind))}
                    </div>
                </div>
                <div class="w5-panel-right">
                    <div class="w5-wave-header">
                        <span class="w5-wave-title">📈 Timing diagram (0 / 1)</span>
                        <span class="w5-wave-hint">▼ red = negative clock edge (state updates)</span>
                    </div>
                    <div class="w5-wave-canvas-wrap">
                        <canvas id="w5Wave-${meta.kind}" class="w5-wave-canvas"></canvas>
                    </div>
                </div>
            </div>
        </section>`;
    }).join("");

    // Panel interactions
    FF_PANELS.forEach(meta => {
        const kind = meta.kind;
        panels.set(kind, createPanelState(kind, meta.inputs.length));

        byId(`w5Panel-${kind}`).querySelectorAll<HTMLButtonElement>(".w5-in-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const idx = meta.inputs.indexOf(btn.getAttribute("data-input") ?? "");
                if (idx < 0) return;
                const panel = panels.get(kind)!;
                const v = toggleInput(panel, idx);
                btn.setAttribute("aria-pressed", String(v));
                btn.querySelector("kbd")!.textContent = v ? "1" : "0";
                btn.classList.toggle("active", v);
                if (window.StudioFX) window.StudioFX.click(v);
                renderPanel(kind);
            });
        });

        byId(`w5Panel-${kind}`).querySelector<HTMLButtonElement>(".w5-ff-reset")!.addEventListener("click", () => {
            const panel = panels.get(kind)!;
            resetPanel(panel);
            syncPanelButtons(kind);
            renderPanel(kind);
        });
    });
}

function setupKeyboard(): void {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;

        if (e.key === " ") {
            e.preventDefault();
            toggleRun();
        } else if (e.key.toLowerCase() === "n") {
            if (clock.running) pause();
            tickOnce();
        }
    });
}

/* ------------------------------------------------------------------ */
/* Clock engine                                                        */
/* ------------------------------------------------------------------ */

function setSpeed(multiplier: number): void {
    const base = 600; // ms per full period at 1×
    const period = base * multiplier;
    const half = Math.max(120, Math.round(period / 2));
    // Re-derive ticks-per-half so the visual duty cycle stays honest:
    // each render tick advances half a period.
    clock.highTicks = Math.max(1, Math.round(half / TICK_MS));
    clock.lowTicks = clock.highTicks;
    if (clock.running) {
        stopTimer();
        startTimer(half);
    }
}

function startTimer(intervalMs: number): void {
    timer = setInterval(tickOnce, intervalMs);
}

function stopTimer(): void {
    if (timer) clearInterval(timer);
    timer = null;
}

function start(): void {
    clock.running = true;
    startTimer(halfPeriodMs());
    byId<HTMLButtonElement>("w5ClockRun").textContent = "⏸ Pause";
}

function pause(): void {
    clock.running = false;
    stopTimer();
    byId<HTMLButtonElement>("w5ClockRun").textContent = "▶ Run";
}

function toggleRun(): void {
    if (clock.running) pause();
    else start();
}

function halfPeriodMs(): number {
    const speedActive = document.querySelector(".w5-speed-btn.active")?.getAttribute("data-speed") ?? "normal";
    const mult = speedActive === "slow" ? 2 : speedActive === "fast" ? 0.5 : 1;
    return Math.max(120, Math.round(300 * mult));
}

/** Advance the shared clock by half a period; update all panels. */
function tickOnce(): void {
    const level = advanceClock(clock);
    clock.value = level;

    FF_PANELS.forEach(meta => {
        const panel = panels.get(meta.kind)!;
        stepClock(panel, level);
        recordSample(panel, level);
    });

    renderAll();
}

function resetAll(): void {
    FF_PANELS.forEach(meta => {
        const panel = panels.get(meta.kind)!;
        resetPanel(panel);
        syncPanelButtons(meta.kind);
    });
    renderAll();
}

/** Re-sync the input buttons to a panel's state (after reset). */
function syncPanelButtons(kind: FlipFlopKind): void {
    const panel = panels.get(kind)!;
    byId(`w5Panel-${kind}`).querySelectorAll<HTMLButtonElement>(".w5-in-btn").forEach(btn => {
        const name = btn.getAttribute("data-input") ?? "";
        const idx = kind === "SR" ? (name === "S" ? 0 : 1) : kind === "JK" ? (name === "J" ? 0 : 1) : 0;
        const v = panel.inputs[idx];
        btn.setAttribute("aria-pressed", String(v));
        btn.querySelector("kbd")!.textContent = v ? "1" : "0";
        btn.classList.toggle("active", v);
    });
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderAll(): void {
    byId("w5ClockSchematic").innerHTML = renderClockSchematic(clock.value, clock.highTicks, clock.lowTicks);
    byId("w5ClockBadge").textContent = clock.value ? "1" : "0";
    byId("w5ClockBadge").classList.toggle("high", clock.value);

    FF_PANELS.forEach(meta => renderPanel(meta.kind));
    byId("w5TickCounter").textContent = String(clock.tick);
}

function renderPanel(kind: FlipFlopKind): void {
    const panel = panels.get(kind)!;
    const meta = FF_PANELS.find(m => m.kind === kind)!;

    byId(`w5Schematic-${kind}`).innerHTML = renderFlipFlopSchematic(panel, clock.value);

    // Q badge in the panel header
    const qBadge = byId(`w5Q-${kind}`);
    qBadge.textContent = panel.q ? "1" : "0";
    qBadge.classList.toggle("high", panel.q);
    qBadge.classList.toggle("invalid", panel.invalid);

    drawWave(kind, meta.inputs, panel);
}

function drawWave(kind: FlipFlopKind, inputNames: string[], panel: PanelState): void {
    const canvas = byId<HTMLCanvasElement>(`w5Wave-${kind}`);
    const wrap = canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(260, wrap.clientWidth - 8);
    const h = Math.max(150, wrap.clientHeight - 8);

    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const signals = panelSignals(kind, inputNames, panel.history, SIGNAL_COLORS.clock);
    drawSignals(ctx, signals, w, h, {
        markNegativeEdges: true,
        edgeSource: signals[0],
    });
}

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", init);
