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
 *  `w` and `h` are logical (CSS) dimensions, not DPR-scaled. */
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
    const graphWidth = width - startX - 30;
    const rowHeight = Math.min(30, Math.floor((height - 20) / signalNames.length));
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
        const lowY = topY + rowHeight - 6;
        const highY = topY + 4;

        // Label
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillStyle = sigName.startsWith("F:") ? "#34d399" : "#60a5fa";
        ctx.textAlign = "right";
        ctx.fillText(sigName, startX - 10, lowY - 2);

        // Waveform
        ctx.strokeStyle = sigName.startsWith("F:") ? "#10b981" : "#38bdf8";
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
        ctx.stroke();
    });
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
