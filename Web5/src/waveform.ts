/**
 * Waveform / timing-diagram renderer for Web5.
 *
 * Draws a grid of 0/1 signal traces (clock, inputs, Q, Q̄) on a canvas.
 * Negative clock edges are marked with a red dashed line so the trigger
 * instant is visible. Canvas 2D, DPR-aware.
 */

import type { Sample } from "./types";
import { SIGNAL_COLORS } from "./types";

export interface WaveSignal {
    /** Display label drawn to the left of the trace. */
    label: string;
    /** One boolean per sample (oldest first). */
    values: boolean[];
    /** Trace color. */
    color: string;
    /** Render as a dashed trace (invalid states). */
    dashed?: boolean;
}

/** Layout metrics (logical px). */
const LABEL_W = 92;
const RIGHT_PAD = 14;
const TOP_PAD = 18;
const BOTTOM_PAD = 26;
const ROW_MIN = 34;

/** Draw a set of signal traces on a canvas. Assumes caller cleared the canvas. */
export function drawSignals(
    ctx: CanvasRenderingContext2D,
    signals: WaveSignal[],
    w: number,
    h: number,
    opts?: { sampleIntervalMs?: number; markNegativeEdges?: boolean; edgeSource?: WaveSignal }
): void {
    const width = w;
    const height = h;
    if (signals.length === 0) {
        ctx.fillStyle = "#64748b";
        ctx.font = "13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("No signals to display", width / 2, height / 2);
        return;
    }

    const plotW = width - LABEL_W - RIGHT_PAD;
    const rowH = Math.max(ROW_MIN, Math.min(46, (height - TOP_PAD - BOTTOM_PAD) / signals.length));
    const n = Math.max(...signals.map(s => s.values.length));
    if (n === 0) return;

    const stepX = plotW / Math.max(n - 1, 1);

    // Background grid: vertical lines per sample, horizontal per row
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.12)";
    for (let i = 0; i < n; i += Math.ceil(n / 16)) {
        const x = LABEL_W + i * stepX;
        ctx.beginPath();
        ctx.moveTo(x, TOP_PAD - 6);
        ctx.lineTo(x, height - BOTTOM_PAD + 6);
        ctx.stroke();
    }

    // Time axis labels (sample indices)
    ctx.fillStyle = "#64748b";
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < n; i += Math.ceil(n / 16)) {
        const x = LABEL_W + i * stepX;
        ctx.fillText(String(i), x, height - 8);
    }

    // Negative-edge detection source (usually the clock trace)
    const edgeRef = opts?.edgeSource ?? signals[0];
    const markEdges = opts?.markNegativeEdges !== false && edgeRef.values.length > 1;
    const edgeXs: number[] = [];
    if (markEdges) {
        for (let i = 1; i < edgeRef.values.length; i++) {
            if (edgeRef.values[i - 1] === true && edgeRef.values[i] === false) {
                edgeXs.push(LABEL_W + i * stepX);
            }
        }
    }

    signals.forEach((sig, sigIdx) => {
        const topY = TOP_PAD + sigIdx * rowH;
        const highY = topY + 6;
        const lowY = topY + rowH - 14;

        // Row band + label
        if (sigIdx % 2 === 0) {
            ctx.fillStyle = "rgba(148, 163, 184, 0.05)";
            ctx.fillRect(LABEL_W, topY, plotW, rowH);
        }
        ctx.fillStyle = sig.color;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.textAlign = "right";
        ctx.fillText(sig.label, LABEL_W - 10, (highY + lowY) / 2 + 4);

        // Low/high guide lines
        ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(LABEL_W, lowY);
        ctx.lineTo(width - RIGHT_PAD, lowY);
        ctx.moveTo(LABEL_W, highY);
        ctx.lineTo(width - RIGHT_PAD, highY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 0/1 level labels on the right of the band
        ctx.fillStyle = "rgba(148, 163, 184, 0.55)";
        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText("1", width - RIGHT_PAD + 2, highY + 3);
        ctx.fillText("0", width - RIGHT_PAD + 2, lowY + 3);

        // The waveform trace itself
        ctx.strokeStyle = sig.color;
        ctx.lineWidth = 2;
        if (sig.dashed) ctx.setLineDash([5, 4]);
        ctx.beginPath();
        const vals = sig.values;
        for (let i = 0; i < vals.length; i++) {
            const x = LABEL_W + i * stepX;
            const y = vals[i] ? highY : lowY;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevY = vals[i - 1] ? highY : lowY;
                if (prevY !== y) ctx.lineTo(x, prevY); // vertical transition
                ctx.lineTo(x, y);
            }
        }
        // Extend the last level to the right edge
        const lastY = vals[vals.length - 1] ? highY : lowY;
        ctx.lineTo(LABEL_W + (vals.length - 1) * stepX + stepX, lastY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 0/1 value numerals along the trace
        ctx.fillStyle = sig.color;
        ctx.font = "8.5px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        for (let i = 0; i < vals.length; i++) {
            const x = LABEL_W + i * stepX;
            const y = vals[i] ? highY : lowY;
            ctx.fillText(vals[i] ? "1" : "0", x + stepX / 2, y - 3);
        }
    });

    // Negative clock edge markers on top
    if (markEdges) {
        ctx.strokeStyle = SIGNAL_COLORS.edge;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        for (const x of edgeXs) {
            ctx.beginPath();
            ctx.moveTo(x, TOP_PAD - 4);
            ctx.lineTo(x, height - BOTTOM_PAD + 4);
            ctx.stroke();
            // Small ▼ arrow at the top
            ctx.setLineDash([]);
            ctx.fillStyle = SIGNAL_COLORS.edge;
            ctx.beginPath();
            ctx.moveTo(x - 4, TOP_PAD - 10);
            ctx.lineTo(x + 4, TOP_PAD - 10);
            ctx.lineTo(x, TOP_PAD - 4);
            ctx.closePath();
            ctx.fill();
            ctx.setLineDash([4, 3]);
        }
        ctx.setLineDash([]);

        if (edgeXs.length > 0) {
            ctx.fillStyle = SIGNAL_COLORS.edge;
            ctx.font = "9.5px 'JetBrains Mono', monospace";
            ctx.textAlign = "left";
            ctx.fillText("▼ = negative (falling) clock edge → state updates", LABEL_W + 4, TOP_PAD + 2);
        }
    }
}

/** Build signal traces for one panel from its sample history. */
export function panelSignals(
    kind: string,
    inputNames: string[],
    history: Sample[],
    clockColor: string
): WaveSignal[] {
    const signals: WaveSignal[] = [
        {
            label: "CLK",
            values: history.map(s => s.clk),
            color: clockColor,
        },
    ];
    inputNames.forEach((name, i) => {
        signals.push({
            label: name,
            values: history.map(s => s.inputs[i] ?? false),
            color: SIGNAL_COLORS.input,
        });
    });
    signals.push({
        label: "Q",
        values: history.map(s => s.q),
        color: SIGNAL_COLORS.output,
    });
    signals.push({
        label: "Q̄",
        values: history.map(s => !s.q),
        color: SIGNAL_COLORS.output,
        dashed: true,
    });
    void kind;
    return signals;
}
