/**
 * Circuit registry — imports all category modules and re-exports the
 * combined CIRCUITS map and CATEGORIES index.
 */

import type { CircuitDefinition } from "../types";

// Import per-category circuit definitions
import { half_adder, full_adder, ripple_carry_adder_4bit } from "./adders";
import { half_subtractor, full_subtractor, subtractor_4bit } from "./subtractors";
import { mux_2to1, mux_4to1, mux_8to1 } from "./mux";
import { demux_1to2, demux_1to4, demux_1to8 } from "./demux";
import { decoder_2to4, decoder_3to8, priority_encoder_4to2, priority_encoder_8to3 } from "./decoders";
import { comparator_1bit, comparator_2bit } from "./comparators";

/** All 18 circuit definitions, keyed by circuit ID. */
export const CIRCUITS: Record<string, CircuitDefinition> = {
    half_adder,
    full_adder,
    ripple_carry_adder_4bit,
    half_subtractor,
    full_subtractor,
    subtractor_4bit,
    mux_2to1,
    mux_4to1,
    mux_8to1,
    demux_1to2,
    demux_1to4,
    demux_1to8,
    decoder_2to4,
    decoder_3to8,
    priority_encoder_4to2,
    priority_encoder_8to3,
    comparator_1bit,
    comparator_2bit,
};

/** Category → { title, circuit IDs } for navigation and grouping. */
export const CATEGORIES: Record<string, { title: string; circuits: string[] }> = {
    adders: {
        title: "Adders",
        circuits: ["half_adder", "full_adder", "ripple_carry_adder_4bit"]
    },
    subtractors: {
        title: "Subtractors",
        circuits: ["half_subtractor", "full_subtractor", "subtractor_4bit"]
    },
    mux: {
        title: "Multiplexers (MUX)",
        circuits: ["mux_2to1", "mux_4to1", "mux_8to1"]
    },
    demux: {
        title: "Demultiplexers (DEMUX)",
        circuits: ["demux_1to2", "demux_1to4", "demux_1to8"]
    },
    decoders: {
        title: "Decoders & Encoders",
        circuits: ["decoder_2to4", "decoder_3to8", "priority_encoder_4to2", "priority_encoder_8to3"]
    },
    comparators: {
        title: "Magnitude Comparators",
        circuits: ["comparator_1bit", "comparator_2bit"]
    },
};
