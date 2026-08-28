/**
 * Shared gate type definitions used across Web1, Web4, and any future tools.
 * This is the single source of truth for what gate types are supported.
 */

export type GateType =
    | "INPUT"
    | "OUTPUT"
    | "CONST"
    | "CLOCK"
    | "NOT"
    | "BUFFER"
    | "AND"
    | "OR"
    | "NAND"
    | "NOR"
    | "XOR"
    | "XNOR"
    | "SWITCH"
    | "LED";

/** Metadata about a gate type for rendering and validation. */
export interface GateMeta {
    type: GateType;
    label: string;
    inputCount: number;  // -1 = variable
    outputCount: number;
    description: string;
}

export const GATE_REGISTRY: Record<GateType, GateMeta> = {
    INPUT:   { type: "INPUT",   label: "INPUT",   inputCount: 0,  outputCount: 1, description: "User-togglable input signal" },
    OUTPUT:  { type: "OUTPUT",  label: "OUTPUT",  inputCount: 1,  outputCount: 0, description: "Output indicator (LED)" },
    CONST:   { type: "CONST",   label: "CONST",   inputCount: 0,  outputCount: 1, description: "Constant 0 or 1" },
    CLOCK:   { type: "CLOCK",   label: "CLOCK",   inputCount: 0,  outputCount: 1, description: "Periodic clock signal" },
    SWITCH:  { type: "SWITCH",  label: "SWITCH",  inputCount: 0,  outputCount: 1, description: "Manual toggle switch" },
    LED:     { type: "LED",     label: "LED",     inputCount: 1,  outputCount: 0, description: "LED output indicator" },
    BUFFER:  { type: "BUFFER",  label: "BUFFER",  inputCount: 1,  outputCount: 1, description: "Buffer (no inversion)" },
    NOT:     { type: "NOT",     label: "NOT",     inputCount: 1,  outputCount: 1, description: "Inverter" },
    AND:     { type: "AND",     label: "AND",     inputCount: 2,  outputCount: 1, description: "AND gate" },
    OR:      { type: "OR",      label: "OR",      inputCount: 2,  outputCount: 1, description: "OR gate" },
    NAND:    { type: "NAND",    label: "NAND",    inputCount: 2,  outputCount: 1, description: "NAND gate" },
    NOR:     { type: "NOR",     label: "NOR",     inputCount: 2,  outputCount: 1, description: "NOR gate" },
    XOR:     { type: "XOR",     label: "XOR",     inputCount: 2,  outputCount: 1, description: "Exclusive OR" },
    XNOR:    { type: "XNOR",    label: "XNOR",    inputCount: 2,  outputCount: 1, description: "Exclusive NOR" },
};



/** Types that act as sources (no inputs required). */
export const SOURCE_TYPES: ReadonlySet<GateType> = new Set(["INPUT", "CONST", "CLOCK", "SWITCH"]);

/** Types that act as sinks (no outputs). */
export const SINK_TYPES: ReadonlySet<GateType> = new Set(["OUTPUT", "LED"]);

/** Types that can be freely toggled by the user. */
export const TOGGLEABLE_TYPES: ReadonlySet<GateType> = new Set(["INPUT", "SWITCH"]);

/** Types that have a configurable value. */
export const CONFIGURABLE_TYPES: ReadonlySet<GateType> = new Set(["CONST", "CLOCK"]);

/**
 * Evaluate a gate given its input values.
 * Returns the output boolean, or undefined if inputs are insufficient.
 */
export function evaluateGate(type: GateType, inputs: boolean[], config?: { value?: boolean; frequency?: number; dutyCycle?: number }): boolean {
    switch (type) {
        case "INPUT":
        case "SWITCH":
        case "CLOCK":
            return inputs[0] ?? false;
        case "CONST":
            return config?.value ?? false;
        case "BUFFER":
            return inputs[0] ?? false;
        case "NOT":
            return !(inputs[0] ?? false);
        case "AND":
            return inputs.length > 0 && inputs.every(Boolean);
        case "OR":
            return inputs.some(Boolean);
        case "NAND":
            return !(inputs.length > 0 && inputs.every(Boolean));
        case "NOR":
            return !inputs.some(Boolean);
        case "XOR":
            return inputs.reduce((acc, v) => acc !== v, false);
        case "XNOR":
            return !inputs.reduce((acc, v) => acc !== v, false);
        case "OUTPUT":
        case "LED":
            return inputs[0] ?? false;
        default:
            return false;
    }
}
