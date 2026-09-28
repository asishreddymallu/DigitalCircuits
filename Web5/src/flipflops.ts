/**
 * Pure flip-flop logic for the Web5 Sequential Circuits Simulator.
 *
 * All flip-flops are negative-edge triggered: the state updates only on the
 * 1 → 0 transition of the clock. No DOM access — fully unit-testable.
 */

import type { FlipFlopKind, PanelState, Sample } from "./types";
import { HISTORY_LIMIT } from "./types";

/**
 * Compute the next state of a flip-flop from its current state and inputs.
 * This is the combinational "next-state" logic used at the active edge.
 *
 * SR with S=R=1 is the forbidden combination; the simulator marks it invalid
 * and holds the previous state (a common practical convention).
 */
export function nextQ(kind: FlipFlopKind, inputs: boolean[], q: boolean): { q: boolean; invalid: boolean } {
    switch (kind) {
        case "SR": {
            const [s, r] = inputs;
            if (s && r) return { q, invalid: true };   // forbidden: hold
            if (s) return { q: true, invalid: false };  // set
            if (r) return { q: false, invalid: false }; // reset
            return { q, invalid: false };               // hold
        }
        case "JK": {
            const [j, k] = inputs;
            if (j && k) return { q: !q, invalid: false }; // toggle
            if (j) return { q: true, invalid: false };
            if (k) return { q: false, invalid: false };
            return { q, invalid: false };                 // hold
        }
        case "T": {
            const [t] = inputs;
            return t ? { q: !q, invalid: false } : { q, invalid: false };
        }
        case "D": {
            const [d] = inputs;
            return { q: d, invalid: false };
        }
    }
}

/** True when the given input combination is invalid for this flip-flop. */
export function isInvalid(kind: FlipFlopKind, inputs: boolean[]): boolean {
    return kind === "SR" && inputs[0] === true && inputs[1] === true;
}

/** Create a fresh panel state for a flip-flop (Q starts at 0). */
export function createPanelState(kind: FlipFlopKind, inputCount: number): PanelState {
    return {
        kind,
        inputs: new Array(inputCount).fill(false),
        q: false,
        invalid: false,
        prevClk: false,
        history: [],
    };
}

/**
 * Drive one panel with a clock level. Detects negative edges (1 → 0) and
 * applies the next-state logic only there. Returns true if the state changed.
 */
export function stepClock(panel: PanelState, clk: boolean): boolean {
    const edge = panel.prevClk === true && clk === false;
    panel.prevClk = clk;

    if (!edge) {
        panel.invalid = isInvalid(panel.kind, panel.inputs);
        return false;
    }

    const result = nextQ(panel.kind, panel.inputs, panel.q);
    const changed = result.q !== panel.q;
    panel.q = result.q;
    panel.invalid = result.invalid;
    return changed;
}

/** Toggle one input of a panel by index. Returns the new value. */
export function toggleInput(panel: PanelState, index: number): boolean {
    panel.inputs[index] = !panel.inputs[index];
    panel.invalid = isInvalid(panel.kind, panel.inputs);
    return panel.inputs[index];
}

/** Reset a panel to its power-on state (Q=0, inputs cleared). */
export function resetPanel(panel: PanelState): void {
    panel.inputs = panel.inputs.map(() => false);
    panel.q = false;
    panel.invalid = false;
    panel.prevClk = false;
    panel.history = [];
}

/** Record the current panel signals into its history ring. */
export function recordSample(panel: PanelState, clk: boolean): void {
    const sample: Sample = {
        clk,
        inputs: [...panel.inputs],
        q: panel.q,
        invalid: panel.invalid,
    };
    panel.history.push(sample);
    if (panel.history.length > HISTORY_LIMIT) {
        panel.history.shift();
    }
}

/**
 * Advance a full cycle of a reference clock waveform by one tick.
 * The clock runs at `dutyCycle` high proportion: high for `highTicks`,
 * low for `lowTicks`. This is the shared clock shown on the page.
 */
export function advanceClock(state: { tick: number; highTicks: number; lowTicks: number }): boolean {
    const period = state.highTicks + state.lowTicks;
    const phase = state.tick % period;
    state.tick++;
    return phase < state.highTicks;
}

/** Build an exhaustive excitation table row list for reference display. */
export function excitationTable(kind: FlipFlopKind): { inputs: string; action: string }[] {
    switch (kind) {
        case "SR":
            return [
                { inputs: "0 0", action: "Hold (no change)" },
                { inputs: "0 1", action: "Reset → Q = 0" },
                { inputs: "1 0", action: "Set → Q = 1" },
                { inputs: "1 1", action: "Forbidden ✗" },
            ];
        case "JK":
            return [
                { inputs: "0 0", action: "Hold (no change)" },
                { inputs: "0 1", action: "Reset → Q = 0" },
                { inputs: "1 0", action: "Set → Q = 1" },
                { inputs: "1 1", action: "Toggle → Q = Q̄" },
            ];
        case "T":
            return [
                { inputs: "0", action: "Hold (no change)" },
                { inputs: "1", action: "Toggle → Q = Q̄" },
            ];
        case "D":
            return [
                { inputs: "0", action: "Q⁺ = 0" },
                { inputs: "1", action: "Q⁺ = 1" },
            ];
    }
}
