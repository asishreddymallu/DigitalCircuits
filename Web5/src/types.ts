/**
 * Type definitions for the Web5 Sequential Circuits Simulator.
 *
 * Web5 simulates negative-edge-triggered flip-flops: SR, JK, T and D,
 * driven by a shared configurable clock.
 */

export type FlipFlopKind = "SR" | "JK" | "T" | "D";

/** Metadata about one flip-flop panel. */
export interface FlipFlopMeta {
    kind: FlipFlopKind;
    /** Panel title, e.g. "SR Flip-Flop". */
    title: string;
    /** Canonical input names in input-array order. */
    inputs: string[];
    /** What the flip-flop does, shown under the panel title. */
    description: string;
    /** Characteristic equation shown in the schematic header. */
    characteristic: string;
    /** Emoji for the panel badge. */
    icon: string;
}

/** Panel order shown on the page (after the clock panel). */
export const FF_PANELS: FlipFlopMeta[] = [
    {
        kind: "SR",
        title: "SR Flip-Flop",
        inputs: ["S", "R"],
        description: "Set–Reset. S=1 sets Q, R=1 resets Q, S=R=0 holds. S=R=1 is forbidden.",
        characteristic: "Q⁺ = S + R′·Q   (S·R = 0)",
        icon: "🔀",
    },
    {
        kind: "JK",
        title: "JK Flip-Flop",
        inputs: ["J", "K"],
        description: "Universal flip-flop. J=K=1 toggles Q on every active clock edge.",
        characteristic: "Q⁺ = J·Q′ + K′·Q",
        icon: "♻️",
    },
    {
        kind: "T",
        title: "T Flip-Flop",
        inputs: ["T"],
        description: "Toggle flip-flop. T=1 inverts Q on every active clock edge, T=0 holds.",
        characteristic: "Q⁺ = T ⊕ Q",
        icon: "🔁",
    },
    {
        kind: "D",
        title: "D Flip-Flop",
        inputs: ["D"],
        description: "Data / delay flip-flop. Q copies D at the active clock edge, otherwise holds.",
        characteristic: "Q⁺ = D",
        icon: "💾",
    },
];

/** One recorded sample of a flip-flop panel's signals. */
export interface Sample {
    /** Clock value at the time of the sample. */
    clk: boolean;
    /** Input values in canonical input order. */
    inputs: boolean[];
    /** Current state output Q. */
    q: boolean;
    /** True when the inputs are invalid (SR: S=R=1). */
    invalid: boolean;
}

/** Mutable state of one flip-flop panel. */
export interface PanelState {
    kind: FlipFlopKind;
    /** Current input values (canonical order). */
    inputs: boolean[];
    /** Current state Q. */
    q: boolean;
    /** Whether the current input combination is invalid. */
    invalid: boolean;
    /** Previous clock value, used for negative-edge detection. */
    prevClk: boolean;
    /** Recorded history (oldest first, capped at HISTORY_LIMIT). */
    history: Sample[];
}

/** Maximum number of samples kept per panel. */
export const HISTORY_LIMIT = 48;

/** Signal colors used by the waveform renderer and schematic badges. */
export const SIGNAL_COLORS = {
    clock: "#f59e0b",
    input: "#38bdf8",
    output: "#10b981",
    edge: "#ef4444",
    low: "#64748b",
} as const;
