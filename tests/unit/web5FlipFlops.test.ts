/**
 * Unit tests for the Web5 sequential circuits logic (flipflops.ts).
 *
 * Covers:
 *   - Next-state logic for SR / JK / T / D flip-flops
 *   - Negative-edge (falling-edge) triggering semantics
 *   - Hold behaviour while the clock is high or steady
 *   - SR invalid (S=R=1) detection
 *   - History recording and capping
 *   - Reference clock waveform generation
 *   - Excitation tables
 */

import { describe, it, expect } from "vitest";
import {
    nextQ,
    isInvalid,
    createPanelState,
    stepClock,
    toggleInput,
    resetPanel,
    recordSample,
    advanceClock,
    excitationTable,
} from "../../Web5/src/flipflops";
import { HISTORY_LIMIT, FF_PANELS } from "../../Web5/src/types";

/* ================================================================== */
/* 1. Next-state logic (combinational nextQ)                           */
/* ================================================================== */

describe("Web5 nextQ: SR flip-flop", () => {
    it("S=1, R=0 sets Q", () => {
        expect(nextQ("SR", [true, false], false).q).toBe(true);
        expect(nextQ("SR", [true, false], true).q).toBe(true);
    });

    it("S=0, R=1 resets Q", () => {
        expect(nextQ("SR", [false, true], true).q).toBe(false);
        expect(nextQ("SR", [false, true], false).q).toBe(false);
    });

    it("S=0, R=0 holds Q", () => {
        expect(nextQ("SR", [false, false], true).q).toBe(true);
        expect(nextQ("SR", [false, false], false).q).toBe(false);
    });

    it("S=1, R=1 is invalid and holds previous state", () => {
        const r = nextQ("SR", [true, true], true);
        expect(r.invalid).toBe(true);
        expect(r.q).toBe(true);

        const r0 = nextQ("SR", [true, true], false);
        expect(r0.invalid).toBe(true);
        expect(r0.q).toBe(false);
    });
});

describe("Web5 nextQ: JK flip-flop", () => {
    it("J=1, K=0 sets Q", () => {
        expect(nextQ("JK", [true, false], false).q).toBe(true);
    });

    it("J=0, K=1 resets Q", () => {
        expect(nextQ("JK", [false, true], true).q).toBe(false);
    });

    it("J=0, K=0 holds Q", () => {
        expect(nextQ("JK", [false, false], true).q).toBe(true);
        expect(nextQ("JK", [false, false], false).q).toBe(false);
    });

    it("J=1, K=1 toggles Q", () => {
        expect(nextQ("JK", [true, true], false).q).toBe(true);
        expect(nextQ("JK", [true, true], true).q).toBe(false);
    });

    it("JK never reports invalid", () => {
        expect(nextQ("JK", [true, true], true).invalid).toBe(false);
    });
});

describe("Web5 nextQ: T flip-flop", () => {
    it("T=1 toggles Q", () => {
        expect(nextQ("T", [true], false).q).toBe(true);
        expect(nextQ("T", [true], true).q).toBe(false);
    });

    it("T=0 holds Q", () => {
        expect(nextQ("T", [false], true).q).toBe(true);
        expect(nextQ("T", [false], false).q).toBe(false);
    });
});

describe("Web5 nextQ: D flip-flop", () => {
    it("Q copies D", () => {
        expect(nextQ("D", [true], false).q).toBe(true);
        expect(nextQ("D", [false], true).q).toBe(false);
        expect(nextQ("D", [true], true).q).toBe(true);
        expect(nextQ("D", [false], false).q).toBe(false);
    });
});

/* ================================================================== */
/* 2. Negative-edge triggering                                         */
/* ================================================================== */

describe("Web5 stepClock: negative-edge triggering", () => {
    it("D flip-flop updates Q only on 1→0 transition", () => {
        const p = createPanelState("D", 1);
        p.inputs = [true]; // D=1

        // clk 0: no edge
        stepClock(p, false);
        expect(p.q).toBe(false);

        // clk rising 0→1: no update yet
        stepClock(p, true);
        expect(p.q).toBe(false);

        // clk high, still no update
        stepClock(p, true);
        expect(p.q).toBe(false);

        // clk falling 1→0: Q captures D=1
        stepClock(p, false);
        expect(p.q).toBe(true);
    });

    it("D flip-flop captures the value present at the falling edge", () => {
        const p = createPanelState("D", 1);
        p.inputs = [true];
        stepClock(p, true);
        stepClock(p, false);
        expect(p.q).toBe(true);

        // Change D while clock low → no change (not edge triggered)
        p.inputs = [false];
        stepClock(p, false);
        expect(p.q).toBe(true);

        // Rising edge with new D → still no change
        stepClock(p, true);
        expect(p.q).toBe(true);

        // Falling edge → Q captures D=0
        stepClock(p, false);
        expect(p.q).toBe(false);
    });

    it("T flip-flop toggles once per falling edge when T=1", () => {
        const p = createPanelState("T", 1);
        p.inputs = [true];

        for (let i = 0; i < 4; i++) {
            stepClock(p, true);   // rising
            stepClock(p, false);  // falling → toggle
        }
        // 4 toggles from Q=0 → back to 0
        expect(p.q).toBe(false);
    });

    it("T flip-flop holds when T=0", () => {
        const p = createPanelState("T", 1);
        p.q = true;
        p.inputs = [false];
        stepClock(p, true);
        stepClock(p, false);
        expect(p.q).toBe(true);
    });

    it("JK toggles on each falling edge with J=K=1 (frequency divider)", () => {
        const p = createPanelState("JK", 2);
        p.inputs = [true, true];
        const seq: boolean[] = [];
        for (let i = 0; i < 6; i++) {
            stepClock(p, true);
            stepClock(p, false);
            seq.push(p.q);
        }
        expect(seq).toEqual([true, false, true, false, true, false]);
    });

    it("SR sets on falling edge with S=1, R=0", () => {
        const p = createPanelState("SR", 2);
        p.inputs = [true, false];
        stepClock(p, true);
        stepClock(p, false);
        expect(p.q).toBe(true);
    });

    it("no edge when clock stays low or stays high", () => {
        const p = createPanelState("T", 1);
        p.inputs = [true];
        stepClock(p, false);
        stepClock(p, false);
        stepClock(p, false);
        expect(p.q).toBe(false); // held

        // initial prevClk=false so first true is rising, not falling
        stepClock(p, true);
        stepClock(p, true);
        expect(p.q).toBe(false); // still held
    });

    it("stepClock returns whether the state changed", () => {
        const p = createPanelState("T", 1);
        p.inputs = [true];
        expect(stepClock(p, true)).toBe(false);   // rising: no change
        expect(stepClock(p, false)).toBe(true);   // falling: toggle
        expect(stepClock(p, false)).toBe(false);  // staying low: hold
    });
});

/* ================================================================== */
/* 3. Invalid input detection                                          */
/* ================================================================== */

describe("Web5 invalid input detection", () => {
    it("SR with S=R=1 is invalid", () => {
        expect(isInvalid("SR", [true, true])).toBe(true);
    });

    it("SR with other combinations is valid", () => {
        expect(isInvalid("SR", [false, false])).toBe(false);
        expect(isInvalid("SR", [true, false])).toBe(false);
        expect(isInvalid("SR", [false, true])).toBe(false);
    });

    it("other flip-flops are never invalid", () => {
        expect(isInvalid("JK", [true, true])).toBe(false);
        expect(isInvalid("T", [true])).toBe(false);
        expect(isInvalid("D", [true])).toBe(false);
    });

    it("toggling into S=R=1 marks panel invalid without changing Q", () => {
        const p = createPanelState("SR", 2);
        toggleInput(p, 0); // S=1
        toggleInput(p, 1); // R=1 → invalid
        expect(p.invalid).toBe(true);
        expect(p.q).toBe(false);
    });

    it("invalid flag clears when inputs become valid again", () => {
        const p = createPanelState("SR", 2);
        toggleInput(p, 0);
        toggleInput(p, 1);
        expect(p.invalid).toBe(true);
        toggleInput(p, 1); // R=0
        expect(p.invalid).toBe(false);
    });
});

/* ================================================================== */
/* 4. Panel state management                                           */
/* ================================================================== */

describe("Web5 panel state", () => {
    it("createPanelState initializes inputs to false and Q to false", () => {
        const p = createPanelState("JK", 2);
        expect(p.inputs).toEqual([false, false]);
        expect(p.q).toBe(false);
        expect(p.invalid).toBe(false);
        expect(p.prevClk).toBe(false);
        expect(p.history).toEqual([]);
    });

    it("toggleInput flips the right index", () => {
        const p = createPanelState("SR", 2);
        toggleInput(p, 1);
        expect(p.inputs).toEqual([false, true]);
        toggleInput(p, 1);
        expect(p.inputs).toEqual([false, false]);
    });

    it("resetPanel clears Q, inputs and history", () => {
        const p = createPanelState("T", 1);
        p.inputs = [true];
        stepClock(p, true);
        stepClock(p, false);
        recordSample(p, false);
        expect(p.q).toBe(true);
        expect(p.history.length).toBe(1);

        resetPanel(p);
        expect(p.q).toBe(false);
        expect(p.inputs).toEqual([false]);
        expect(p.history).toEqual([]);
        expect(p.prevClk).toBe(false);
    });
});

/* ================================================================== */
/* 5. History recording                                                */
/* ================================================================== */

describe("Web5 history recording", () => {
    it("recordSample stores clock, inputs and Q", () => {
        const p = createPanelState("D", 1);
        p.inputs = [true];
        recordSample(p, true);
        expect(p.history.length).toBe(1);
        expect(p.history[0].clk).toBe(true);
        expect(p.history[0].inputs).toEqual([true]);
        expect(p.history[0].q).toBe(false);
        expect(p.history[0].invalid).toBe(false);
    });

    it("history is capped at HISTORY_LIMIT", () => {
        const p = createPanelState("T", 1);
        for (let i = 0; i < HISTORY_LIMIT + 20; i++) {
            recordSample(p, i % 2 === 0);
        }
        expect(p.history.length).toBe(HISTORY_LIMIT);
        // Oldest samples were dropped: first stored clk matches i=20 (even → true)
        expect(p.history[0].clk).toBe(true);
    });

    it("recorded samples are independent copies (not live references)", () => {
        const p = createPanelState("SR", 2);
        p.inputs = [true, false];
        recordSample(p, false);
        toggleInput(p, 1); // mutate live inputs
        expect(p.history[0].inputs).toEqual([true, false]);
    });
});

/* ================================================================== */
/* 6. Reference clock                                                  */
/* ================================================================== */

describe("Web5 advanceClock", () => {
    it("produces highTicks highs then lowTicks lows", () => {
        const clk = { tick: 0, highTicks: 2, lowTicks: 2 };
        const seq = Array.from({ length: 8 }, () => advanceClock(clk));
        expect(seq).toEqual([true, true, false, false, true, true, false, false]);
    });

    it("advances the tick counter once per call", () => {
        const clk = { tick: 0, highTicks: 1, lowTicks: 1 };
        advanceClock(clk);
        expect(clk.tick).toBe(1);
        advanceClock(clk);
        expect(clk.tick).toBe(2);
    });

    it("starts in the high phase (tick 0)", () => {
        const clk = { tick: 0, highTicks: 3, lowTicks: 1 };
        expect(advanceClock(clk)).toBe(true);
    });

    it("wraps around the period correctly", () => {
        const clk = { tick: 0, highTicks: 1, lowTicks: 3 };
        const seq = Array.from({ length: 8 }, () => advanceClock(clk));
        expect(seq).toEqual([true, false, false, false, true, false, false, false]);
    });
});

/* ================================================================== */
/* 7. Excitation tables                                                */
/* ================================================================== */

describe("Web5 excitation tables", () => {
    it("SR table has 4 rows with a forbidden entry", () => {
        const rows = excitationTable("SR");
        expect(rows.length).toBe(4);
        expect(rows[3].action).toContain("Forbidden");
    });

    it("JK table has 4 rows with a toggle entry", () => {
        const rows = excitationTable("JK");
        expect(rows.length).toBe(4);
        expect(rows[3].action).toContain("Toggle");
    });

    it("T table has 2 rows", () => {
        const rows = excitationTable("T");
        expect(rows.length).toBe(2);
        expect(rows[1].action).toContain("Toggle");
    });

    it("D table has 2 rows", () => {
        const rows = excitationTable("D");
        expect(rows.length).toBe(2);
    });
});

/* ================================================================== */
/* 8. Panel metadata integrity                                         */
/* ================================================================== */

describe("Web5 panel metadata", () => {
    it("all four flip-flop kinds are present in canonical order", () => {
        expect(FF_PANELS.map(p => p.kind)).toEqual(["SR", "JK", "T", "D"]);
    });

    it("input counts match the flip-flop kind", () => {
        expect(FF_PANELS.find(p => p.kind === "SR")!.inputs).toEqual(["S", "R"]);
        expect(FF_PANELS.find(p => p.kind === "JK")!.inputs).toEqual(["J", "K"]);
        expect(FF_PANELS.find(p => p.kind === "T")!.inputs).toEqual(["T"]);
        expect(FF_PANELS.find(p => p.kind === "D")!.inputs).toEqual(["D"]);
    });

    it("every panel has a title, description and characteristic equation", () => {
        for (const panel of FF_PANELS) {
            expect(panel.title.length).toBeGreaterThan(0);
            expect(panel.description.length).toBeGreaterThan(0);
            expect(panel.characteristic.length).toBeGreaterThan(0);
        }
    });
});
