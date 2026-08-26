/**
 * Application-wide mutable state for the Boolean Logic Solver page.
 * Kept in one place so UI modules can coordinate without circular imports.
 */
import type { TruthRow } from "../../shared/ts/boolean/ast";
import type { Implicant } from "../../shared/ts/boolean/minimizer";
import type { CircuitGraph } from "./circuits/circuitGraph";

export interface SolverPageState {
    variables: string[];
    rows: TruthRow[];
    graphs: {
        basic: CircuitGraph | null;
        nand: CircuitGraph | null;
        nor: CircuitGraph | null;
    };
    /** Live probe values per variable name. */
    probeState: Record<string, boolean>;
    /** Last rendered K-map inputs, used to reposition overlays on resize. */
    kmap: {
        implicants: Implicant[] | null;
        variables: string[];
    };
}

export const state: SolverPageState = {
    variables: [],
    rows: [],
    graphs: { basic: null, nand: null, nor: null },
    probeState: {},
    kmap: { implicants: null, variables: [] }
};
