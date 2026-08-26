/**
 * Re-export of the pure solver core plus the numeric-list parsing helper
 * that main.ts needs for the minterm / maxterm input fields.
 */

export {
    buildSolverModel,
    SolverInputError,
    generateVariableNames,
    type RawInputs,
    type TruthSelection,
    type SolverModel
} from "./solver";

/** Parse a comma-separated string of integers, ignoring whitespace. */
export function parseNumberList(raw: string): number[] {
    return raw
        .split(/[\s,]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(Number);
}
