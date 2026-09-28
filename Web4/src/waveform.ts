/**
 * Waveform / oscilloscope panel for Web4.
 * Records signal history and draws timing diagrams on a canvas.
 */

import type { PlaygroundNode, Wire } from "./types";

export interface WaveformHistory {
    time: number;
    signals: Record<string, boolean>;
}

export interface WaveformState {
    history: WaveformHistory[];
    timeCounter: number;
    maxHistory: number;
    isPaused: boolean;
}

export function createWaveformState(maxHistory = 50): WaveformState {
    return {
        history: [],
        timeCounter: 0,
        maxHistory,
        isPaused: false,
    };
}

/** Record a new sample. */
export function recordSample(
    state: WaveformState,
    nodes: PlaygroundNode[],
    wires: Wire[],
    nodeValues: Map<string, boolean>
): void {
    if (state.isPaused) return;

    state.timeCounter++;
    const signals: Record<string, boolean> = {};

    // Record input nodes
    for (const node of nodes) {
        if (node.type === "INPUT" || node.type === "SWITCH" || node.type === "CLOCK") {
            signals[node.label || node.id] = nodeValues.get(node.id) ?? false;
        }
    }

    // Record output nodes
    for (const node of nodes) {
        if (node.type === "OUTPUT" || node.type === "LED") {
            signals[`F:${node.label || node.id}`] = nodeValues.get(node.id) ?? false;
        }
    }

    state.history.push({ time: state.timeCounter, signals });
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    }
}

/** Draw the waveform timing diagram on a canvas.
 *  `w` and `h` are logical (CSS) dimensions, not DPR-scaled.
 *
 *  Improved rendering:
 *  - 0/1 value numerals printed along every trace
 *  - dashed high/low level guide lines with "1"/"0" axis labels
 *  - traces extend to the right edge (current level stays visible)
 *  - rising/falling transition dots on each trace
 *  - input traces blue, output traces green (legend colours)
 */
export function drawWaveform(
    canvas: HTMLCanvasElement,
    state: WaveformState,
    signalNames: string[],
    w?: number,
    h?: number
): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = w ?? canvas.width;
    const height = h ?? canvas.height;
    // clearRect is already called by caller (DPR-aware), skip here

    if (state.history.length === 0 || signalNames.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("No signals to display", width / 2, height / 2);
        return;
    }

    const startX = 100;
    const graphWidth = width - startX - 26;
    const rowHeight = Math.min(34, Math.floor((height - 20) / signalNames.length));
    const stepX = graphWidth / Math.max(15, state.history.length - 1);

    // Background grid
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = startX; x < width - 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x, height - 10);
        ctx.stroke();
    }

    // Time axis labels
    ctx.fillStyle = "#64748b";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < state.history.length; i += 5) {
        const x = startX + i * stepX;
        ctx.fillText(String(state.history[i].time), x, height - 4);
    }

    signalNames.forEach((sigName, sigIdx) => {
        const topY = 15 + sigIdx * rowHeight;
        const lowY = topY + rowHeight - 8;
        const highY = topY + 6;
        const isOutput = sigName.startsWith("F:");
        const traceColor = isOutput ? "#10b981" : "#38bdf8";

        // Label
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = traceColor;
        ctx.textAlign = "right";
        ctx.fillText(sigName, startX - 10, lowY - 2);

        // Dashed high/low level guides with 0/1 axis labels
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(startX, lowY);
        ctx.lineTo(width - 16, lowY);
        ctx.moveTo(startX, highY);
        ctx.lineTo(width - 16, highY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(148,163,184,0.7)";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("1", width - 12, highY + 3);
        ctx.fillText("0", width - 12, lowY + 3);

        // Waveform
        ctx.strokeStyle = traceColor;
        ctx.lineWidth = 2;
        ctx.beginPath();

        state.history.forEach((pt, i) => {
            const x = startX + i * stepX;
            const val = pt.signals[sigName] ?? false;
            const y = val ? highY : lowY;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevVal = state.history[i - 1].signals[sigName] ?? false;
                const prevY = prevVal ? highY : lowY;
                if (prevY !== y) {
                    ctx.lineTo(x, prevY);
                }
                ctx.lineTo(x, y);
            }
        });
        // Extend the current level to the right edge
        const lastPt = state.history[state.history.length - 1];
        const lastY = (lastPt.signals[sigName] ?? false) ? highY : lowY;
        ctx.lineTo(startX + (state.history.length - 1) * stepX + stepX, lastY);
        ctx.stroke();

        // Transition dots where the signal changes value
        ctx.fillStyle = traceColor;
        for (let i = 1; i < state.history.length; i++) {
            const prevVal = state.history[i - 1].signals[sigName] ?? false;
            const val = state.history[i].signals[sigName] ?? false;
            if (prevVal !== val) {
                const x = startX + i * stepX;
                ctx.beginPath();
                ctx.arc(x, val ? highY : lowY, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 0/1 value numerals along the trace
        ctx.font = "8.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        for (let i = 0; i < state.history.length; i++) {
            const val = state.history[i].signals[sigName] ?? false;
            const x = startX + i * stepX;
            const y = val ? highY : lowY;
            ctx.fillStyle = "rgba(148,163,184,0.85)";
            ctx.fillText(val ? "1" : "0", x + stepX / 2, y - 3);
        }
    });

    // Legend: inputs vs outputs
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(8, height - 14, 8, 3);
    ctx.fillText("inputs", 20, height - 8);
    ctx.fillStyle = "#10b981";
    ctx.fillRect(66, height - 14, 8, 3);
    ctx.fillText("outputs (F:)", 78, height - 8);
}

/** Get all signal names from current node list. */
export function getSignalNames(nodes: PlaygroundNode[]): string[] {
    const names: string[] = [];
    for (const node of nodes) {
        if (node.type === "INPUT" || node.type === "SWITCH" || node.type === "CLOCK") {
            names.push(node.label || node.id);
        }
    }
    for (const node of nodes) {
        if (node.type === "OUTPUT" || node.type === "LED") {
            names.push(`F:${node.label || node.id}`);
        }
    }
    return names;
}
