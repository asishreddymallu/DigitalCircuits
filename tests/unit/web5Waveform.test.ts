/**
 * Tests for the Web5 waveform graph module (waveform.ts).
 *
 * Verifies signal trace construction from panel history and that the
 * canvas renderer handles empty/canvas-less environments gracefully.
 */

import { describe, it, expect } from "vitest";
import { panelSignals, drawSignals, type WaveSignal } from "../../Web5/src/waveform";
import { createPanelState, recordSample, stepClock } from "../../Web5/src/flipflops";

/** Minimal canvas 2D context stub that tolerates every call. */
function makeCtxStub(): CanvasRenderingContext2D {
    const noop = () => undefined;
    const props: Record<string, unknown> = {};
    return new Proxy(
        {} as CanvasRenderingContext2D,
        {
            get(_t, prop: string) {
                if (prop in props) return props[prop];
                if (
                    ["moveTo", "lineTo", "beginPath", "stroke", "fill", "fillText", "fillRect", "clearRect", "arc", "closePath", "save", "restore", "setLineDash", "setTransform"].includes(prop)
                ) {
                    return noop;
                }
                return undefined;
            },
            set(_t, prop: string, value) {
                props[prop as string] = value;
                return true;
            },
        }
    );
}

/* ================================================================== */
/* panelSignals: trace construction                                    */
/* ================================================================== */

describe("Web5 panelSignals: trace construction", () => {
    it("produces CLK + inputs + Q + Q̄ traces", () => {
        const p = createPanelState("SR", 2);
        recordSample(p, true);
        const signals = panelSignals("SR", ["S", "R"], p.history, "#f59e0b");
        expect(signals.map(s => s.label)).toEqual(["CLK", "S", "R", "Q", "Q̄"]);
    });

    it("single-input flip-flop produces CLK + 1 input + Q + Q̄", () => {
        const p = createPanelState("T", 1);
        recordSample(p, false);
        const signals = panelSignals("T", ["T"], p.history, "#f59e0b");
        expect(signals.map(s => s.label)).toEqual(["CLK", "T", "Q", "Q̄"]);
    });

    it("Q̄ trace is the inverse of Q", () => {
        const p = createPanelState("T", 1);
        p.inputs = [true];
        stepClock(p, true);
        stepClock(p, false);
        recordSample(p, false);
        const signals = panelSignals("T", ["T"], p.history, "#f59e0b");
        const q = signals.find(s => s.label === "Q")!;
        const qn = signals.find(s => s.label === "Q̄")!;
        expect(q.values).toEqual([true]);
        expect(qn.values).toEqual([false]);
        expect(qn.dashed).toBe(true);
    });

    it("CLK trace matches recorded clock levels", () => {
        const p = createPanelState("D", 1);
        [true, true, false, false, true].forEach(clk => recordSample(p, clk));
        const signals = panelSignals("D", ["D"], p.history, "#f59e0b");
        expect(signals[0].values).toEqual([true, true, false, false, true]);
    });

    it("input traces reflect the inputs at each sample time", () => {
        const p = createPanelState("SR", 2);
        recordSample(p, false);       // inputs 0,0
        p.inputs = [true, false];
        recordSample(p, true);        // inputs 1,0
        p.inputs = [true, true];
        recordSample(p, true);        // inputs 1,1 (invalid)
        const signals = panelSignals("SR", ["S", "R"], p.history, "#f59e0b");
        const s = signals.find(x => x.label === "S")!;
        const r = signals.find(x => x.label === "R")!;
        expect(s.values).toEqual([false, true, true]);
        expect(r.values).toEqual([false, false, true]);
    });

    it("every trace has the same length as the history", () => {
        const p = createPanelState("JK", 2);
        for (let i = 0; i < 6; i++) {
            p.inputs = [i % 2 === 0, false];
            recordSample(p, i % 2 === 0);
        }
        const signals = panelSignals("JK", ["J", "K"], p.history, "#f59e0b");
        for (const sig of signals) {
            expect(sig.values.length).toBe(6);
        }
    });

    it("uses the provided clock color for the CLK trace", () => {
        const p = createPanelState("D", 1);
        recordSample(p, false);
        const signals = panelSignals("D", ["D"], p.history, "#abc123");
        expect(signals[0].color).toBe("#abc123");
    });
});

/* ================================================================== */
/* drawSignals: renderer robustness                                    */
/* ================================================================== */

describe("Web5 drawSignals: renderer robustness", () => {
    it("draws without throwing on a stub context", () => {
        const ctx = makeCtxStub();
        const signals: WaveSignal[] = [
            { label: "CLK", values: [true, true, false, false], color: "#f59e0b" },
            { label: "Q", values: [false, true, true, false], color: "#10b981" },
        ];
        expect(() => drawSignals(ctx, signals, 400, 200)).not.toThrow();
    });

    it("handles empty signal list without throwing", () => {
        const ctx = makeCtxStub();
        expect(() => drawSignals(ctx, [], 400, 200)).not.toThrow();
    });

    it("handles empty history without throwing", () => {
        const ctx = makeCtxStub();
        const signals: WaveSignal[] = [{ label: "CLK", values: [], color: "#f59e0b" }];
        expect(() => drawSignals(ctx, signals, 400, 200)).not.toThrow();
    });

    it("handles dashed traces without throwing", () => {
        const ctx = makeCtxStub();
        const signals: WaveSignal[] = [
            { label: "Q̄", values: [true, false], color: "#10b981", dashed: true },
        ];
        expect(() => drawSignals(ctx, signals, 300, 150)).not.toThrow();
    });

    it("draws negative-edge markers when the clock falls", () => {
        const ctx = makeCtxStub();
        const signals: WaveSignal[] = [
            { label: "CLK", values: [true, false, true, false], color: "#f59e0b" },
        ];
        expect(() =>
            drawSignals(ctx, signals, 400, 200, { markNegativeEdges: true, edgeSource: signals[0] })
        ).not.toThrow();
    });

    it("single-sample traces render without division errors", () => {
        const ctx = makeCtxStub();
        const signals: WaveSignal[] = [{ label: "Q", values: [true], color: "#10b981" }];
        expect(() => drawSignals(ctx, signals, 300, 150)).not.toThrow();
    });
});
