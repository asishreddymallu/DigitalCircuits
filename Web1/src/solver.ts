/**
 * Pure solver core: turns raw user input into a fully-derived model of the
 * Boolean function — truth rows, canonical SOP/POS, Quine-McCluskey results
 * and ASTs. No DOM access here, which keeps the whole pipeline unit-testable
 * (tests/unit/solverCore.test.ts).
 *
 * Constants ("0"/"1") flow through as AST const nodes end-to-end (E3), and
 * variables keep their assigned names, including multi-character
 * identifiers like RESET_N (E5).
 */

import {
    AstNode,
    TruthRow,
    astTruthTable,
    evalAst,
    generateCombinations
} from "../../shared/ts/boolean/ast";
import { parseExpression } from "../../shared/ts/boolean/parser";
import {
    Implicant,
    MinimizeResult,
    minimizeSOP,
    minimizePOS,
    patternToTermAst,
    sopAstFromImplicants,
    posAstFromImplicants
} from "../../shared/ts/boolean/minimizer";
import { clauseToString, termToString } from "../../shared/ts/boolean/formatter";
import { LIMITS } from "../../shared/ts/boolean/limits";
import { evaluateCircuit, CircuitGraph } from "./circuits/circuitGraph";

export type InputMode = "expression" | "minterms" | "maxterms" | "dontCare" | "truthTable" | "wordProblem" | "circuitImage";
export type TruthSelection = "0" | "1" | "X";

export interface RawInputs {
    mode: InputMode;
    expression?: string;
    mintermCount?: number;
    mintermList?: number[];
    maxtermCount?: number;
    maxtermList?: number[];
    dontCareCount?: number;
    dontCareMintermList?: number[];
    dontCareList?: number[];
    /** One output selection per truth-table row, MSB-first order. */
    truthSelections?: TruthSelection[];
    /** Pre-validated result of the AI word-problem path. */
    wordProblem?: { variables: string[]; minterms: number[]; dontCares: number[] };
    /** Pre-validated result of the AI circuit image path. */
    circuitImage?: { variables: string[]; minterms: number[]; dontCares: number[]; expression?: string };
}

export interface SolverModel {
    mode: InputMode;
    variables: string[];
    rows: TruthRow[];
    ones: number[];
    zeros: number[];
    dontCares: Set<number>;
    hasDontCares: boolean;
    originalAst: AstNode;
    originalDisplay: string;
    canonicalSOP: string;
    canonicalPOS: string;
    sop: MinimizeResult;
    pos: MinimizeResult;
    simplifiedAst: AstNode;
    simplifiedDisplay: string;
    simplifiedCoverTruncated: boolean;
}

export class SolverInputError extends Error {}

/** A, B, ... for the fixed-size numeric inputs. */
export function generateVariableNames(count: number): string[] {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
        names.push(String.fromCharCode(65 + i));
    }
    return names;
}

function assertVarLimit(count: number): void {
    if (count > LIMITS.MAX_VARIABLES) {
        throw new SolverInputError(
            `${count} variables exceeds the supported maximum of ${LIMITS.MAX_VARIABLES}.`
        );
    }
}

/**
 * Join literal strings so adjacent identifier characters get an explicit '·'
 * — required so displayed products re-parse correctly with multi-char names.
 */
export function joinLiteralsForDisplay(literals: string[]): string {
    let out = "";
    literals.forEach((lit, i) => {
        if (i > 0 && /[A-Za-z0-9_]/.test(out[out.length - 1]) && /[A-Za-z0-9_]/.test(lit[0])) {
            out += "·";
        }
        out += lit;
    });
    return out;
}

/** SOP display built from implicants (auto-separating, constants aware). */
export function sopDisplay(result: MinimizeResult, variables: string[]): string {
    if (result.isConstant) return result.constantValue ? "1" : "0";
    if (result.implicants.length === 0) return "0";
    return result.implicants.map(imp => termToString(imp.pattern, variables)).join(" + ");
}

/** POS display built from complement-convention implicants. */
export function posDisplay(result: MinimizeResult, variables: string[]): string {
    if (result.isConstant) return result.constantValue ? "1" : "0";
    if (result.implicants.length === 0) return "1";
    // Clause boundaries are ')' or quoted identifiers — never ambiguous.
    return result.implicants.map(imp => clauseToString(imp.pattern, variables)).join("");
}

/** Canonical SOP text: one product term per row where F=1. */
export function generateCanonicalSOP(rows: TruthRow[], variables: string[], dontCares?: ReadonlySet<number>): string {
    const terms = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row, index }) => row.output === 1 && (!dontCares || !dontCares.has(index)))
        .map(({ row }) => joinLiteralsForDisplay(
            row.inputs.map((val, idx) => val ? variables[idx] : `${variables[idx]}'`)));
    return terms.length > 0 ? terms.join(" + ") : "0";
}

/** Canonical POS text: one parenthesized sum clause per row where F=0. */
export function generateCanonicalPOS(rows: TruthRow[], variables: string[], dontCares?: ReadonlySet<number>): string {
    const clauses = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row, index }) => row.output === 0 && (!dontCares || !dontCares.has(index)))
        .map(({ row }) => {
            const sum = row.inputs.map((val, idx) => val ? `${variables[idx]}'` : variables[idx]).join(" + ");
            return `(${sum})`;
        });
    return clauses.length > 0 ? clauses.join("") : "1";
}

/** Build the complete model from raw inputs. Throws SolverInputError / parse errors on bad input. */
export function buildSolverModel(raw: RawInputs): SolverModel {
    switch (raw.mode) {
        case "expression": return fromExpression(raw.expression ?? "");
        case "minterms": return fromMintermList(raw.mintermCount!, raw.mintermList ?? [], new Set(), "minterms");
        case "maxterms": return fromMaxtermList(raw.maxtermCount!, raw.maxtermList ?? []);
        case "dontCare": return fromDontCare(raw.dontCareCount!, raw.dontCareMintermList ?? [], raw.dontCareList ?? []);
        case "truthTable": return fromTruthSelections(raw.truthSelections ?? []);
        case "wordProblem": return fromWordProblem(raw.wordProblem!);
        case "circuitImage": return fromCircuitImage(raw.circuitImage!);
    }
}

/* ------------------------------------------------------------------ */
/* Shared construction helpers                                         */
/* ------------------------------------------------------------------ */

function finish(
    mode: InputMode,
    variables: string[],
    originalAst: AstNode,
    originalDisplay: string,
    rows: TruthRow[],
    dontCares: Set<number>
): SolverModel {
    const ones: number[] = [];
    const zeros: number[] = [];
    rows.forEach((row, index) => {
        if (row.output === 1) ones.push(index);
        else if (row.output === 0) zeros.push(index);
    });

    const hasDontCares = dontCares.size > 0;
    const dc = hasDontCares ? dontCares : undefined;

    const sop = minimizeSOP(ones, variables, dc);
    const pos = minimizePOS(zeros, variables, dc);

    // Constant results become CONST AST nodes so verification and exports
    // behave uniformly (E3).
    const simplifiedAst: AstNode = sop.isConstant
        ? { kind: "const", value: !!sop.constantValue }
        : sopAstFromImplicants(sop.implicants, variables);

    return {
        mode,
        variables,
        rows,
        ones,
        zeros,
        dontCares,
        hasDontCares,
        originalAst,
        originalDisplay,
        canonicalSOP: generateCanonicalSOP(rows, variables, dc),
        canonicalPOS: generateCanonicalPOS(rows, variables, dc),
        sop,
        pos,
        simplifiedAst,
        simplifiedDisplay: sopDisplay(sop, variables),
        simplifiedCoverTruncated: sop.coverTruncated
    };
}

/** OR of one product term per minterm; collapses to constants at the edges. */
export function astFromMinterms(minterms: number[], variables: string[]): AstNode {
    if (minterms.length === 0) return { kind: "const", value: false };
    if (minterms.length === 1 << variables.length) return { kind: "const", value: true };
    return minterms
        .map(m => patternToTermAst(toPattern(m, variables.length), variables))
        .reduce((acc, term) => ({ kind: "or", left: acc, right: term }));
}

/** Implicant-pattern string ("0101") for a minterm index, MSB-first. */
export function toPattern(minterm: number, varCount: number): string {
    return minterm.toString(2).padStart(varCount, "0");
}

/** Canonical-expansion display for a list of true minterms. */
function mintermExpansionDisplay(minterms: number[], varCount: number): string {
    const variables = generateVariableNames(varCount);
    if (minterms.length === 0) return "0";
    if (minterms.length === 1 << varCount) return "1";
    return minterms.map(m => termToString(toPattern(m, varCount), variables)).join(" + ");
}

function rowsFromMinterms(variableCount: number, minterms: number[], dontCares: Set<number>): TruthRow[] {
    const combinations = generateCombinations(variableCount);
    return combinations.map((inputs, index) => {
        let output: number;
        if (minterms.includes(index)) output = 1;
        else if (dontCares.has(index)) output = -1;
        else output = 0;
        return { inputs, output };
    });
}

function validateIndices(list: number[], varCount: number, label: string): void {
    const maxVal = (1 << varCount) - 1;
    const bad = list.filter(v => !Number.isInteger(v) || v < 0 || v > maxVal);
    if (bad.length > 0) {
        throw new SolverInputError(
            `${label} index out of range: ${bad.join(", ")}. ` +
            `For ${varCount} variables, valid indices are 0 to ${maxVal}.`
        );
    }
}

/* ------------------------------------------------------------------ */
/* Mode-specific builders                                              */
/* ------------------------------------------------------------------ */

function fromExpression(expression: string): SolverModel {
    const trimmed = expression.trim();
    const parsed = parseExpression(trimmed);
    const variables = [...new Set(parsed.variables)].sort();
    assertVarLimit(variables.length);
    return finish("expression", variables, parsed.ast, trimmed, astTruthTable(parsed.ast, variables), new Set());
}

function fromMintermList(
    count: number,
    mintermList: number[],
    dontCares: Set<number>,
    _origin: string
): SolverModel {
    assertVarLimit(count);
    const variables = generateVariableNames(count);
    validateIndices(mintermList, count, "Minterm");
    const unique = [...new Set(mintermList)].sort((a, b) => a - b);
    const ast = astFromMinterms(unique, variables);
    const display = mintermExpansionDisplay(unique, count);
    return finish("minterms", variables, ast, display, rowsFromMinterms(count, unique, dontCares), dontCares);
}

function fromMaxtermList(count: number, maxtermList: number[]): SolverModel {
    assertVarLimit(count);
    const variables = generateVariableNames(count);
    validateIndices(maxtermList, count, "Maxterm");
    const unique = [...new Set(maxtermList)].sort((a, b) => a - b);

    // A maxterm list defines the ZERO set; minterms are its complement.
    const zerosSet = new Set(unique);
    const minterms: number[] = [];
    for (let i = 0; i < (1 << count); i++) {
        if (!zerosSet.has(i)) minterms.push(i);
    }

    const ast = astFromMinterms(minterms, variables);
    const display = unique.length === 0 ? "1"
        : unique.length === (1 << count) ? "0"
            : unique.map(m => clauseToString(toPattern(m, count), variables)).join("");
    return finish("maxterms", variables, ast, display, rowsFromMinterms(count, minterms, new Set()), new Set());
}

function fromDontCare(count: number, mintermList: number[], dcList: number[]): SolverModel {
    assertVarLimit(count);
    if (mintermList.length === 0 && dcList.length === 0) {
        throw new SolverInputError("Please enter at least one minterm or don't-care term.");
    }
    const overlap = mintermList.filter(m => dcList.includes(m));
    if (overlap.length > 0) {
        throw new SolverInputError(`Terms ${overlap.join(", ")} appear in both minterms and don't cares.`);
    }
    validateIndices(mintermList, count, "Minterm");
    validateIndices(dcList, count, "Don't-care");

    const dontCares = new Set(dcList);
    return fromMintermList(count, mintermList, dontCares, "dontCare");
}

function fromTruthSelections(selections: TruthSelection[]): SolverModel {
    const count = Math.log2(selections.length);
    if (!Number.isInteger(count)) {
        throw new SolverInputError("Truth table length must be a power of two.");
    }
    const variables = generateVariableNames(count);
    const combinations = generateCombinations(count);
    const minterms: number[] = [];
    const dontCares = new Set<number>();
    const rows: TruthRow[] = [];

    selections.forEach((val, i) => {
        if (val === "1") { rows.push({ inputs: combinations[i], output: 1 }); minterms.push(i); }
        else if (val === "X") { rows.push({ inputs: combinations[i], output: -1 }); dontCares.add(i); }
        else { rows.push({ inputs: combinations[i], output: 0 }); }
    });

    return finish(
        "truthTable",
        variables,
        astFromMinterms(minterms, variables),
        mintermExpansionDisplay(minterms, count),
        rows,
        dontCares
    );
}

function fromCircuitImage(ci: { variables: string[]; minterms: number[]; dontCares: number[]; expression?: string }): SolverModel {
    if (ci.variables.length === 0) {
        throw new SolverInputError("The AI backend couldn't identify any variables in the circuit image.");
    }
    assertVarLimit(ci.variables.length);

    const dontCares = new Set(ci.dontCares.filter(d => !ci.minterms.includes(d)));
    const sorted = [...new Set(ci.minterms)].sort((a, b) => a - b);
    validateIndices(sorted, ci.variables.length, "Minterm");

    // If an expression was provided, try to use it for display
    const display = ci.expression || (sorted.length === 0 ? "0"
        : sorted.length === (1 << ci.variables.length) ? "1"
            : sorted.map(m => termToString(toPattern(m, ci.variables.length), ci.variables)).join(" + "));

    // Try to parse the expression if available
    let originalAst: AstNode;
    let originalDisplay: string;
    if (ci.expression) {
        try {
            const parsed = parseExpression(ci.expression);
            originalAst = parsed.ast;
            originalDisplay = ci.expression;
        } catch {
            // Fall back to minterm-based AST
            originalAst = astFromMinterms(sorted, ci.variables);
            originalDisplay = display;
        }
    } else {
        originalAst = astFromMinterms(sorted, ci.variables);
        originalDisplay = display;
    }

    return finish(
        "circuitImage",
        ci.variables,
        originalAst,
        originalDisplay,
        rowsFromMinterms(ci.variables.length, sorted, dontCares),
        dontCares
    );
}

function fromWordProblem(wp: { variables: string[]; minterms: number[]; dontCares: number[] }): SolverModel {
    if (wp.variables.length === 0) {
        throw new SolverInputError("The AI backend couldn't identify any variables in that problem.");
    }
    assertVarLimit(wp.variables.length);

    // Don't-cares never override explicit minterms.
    const dontCares = new Set(wp.dontCares.filter(d => !wp.minterms.includes(d)));
    const sorted = [...new Set(wp.minterms)].sort((a, b) => a - b);
    validateIndices(sorted, wp.variables.length, "Minterm");

    // Display uses the backend's own variable names (E5), with automatic '·'
    // separation so names like RESET_N stay unambiguous.
    const display = sorted.length === 0 ? "0"
        : sorted.length === (1 << wp.variables.length) ? "1"
            : sorted.map(m => termToString(toPattern(m, wp.variables.length), wp.variables)).join(" + ");

    return finish(
        "wordProblem",
        wp.variables,
        astFromMinterms(sorted, wp.variables),
        display,
        rowsFromMinterms(wp.variables.length, sorted, dontCares),
        dontCares
    );
}

/* ------------------------------------------------------------------ */
/* Verification                                                        */
/* ------------------------------------------------------------------ */

export interface CircuitTriple {
    basic: CircuitGraph;
    nand: CircuitGraph;
    nor: CircuitGraph;
}

/**
 * Exhaustively check that the original expression, the minimized SOP, and all
 * three gate-level implementations agree with the truth table on every
 * non-don't-care row. Returns false (never throws) so callers can render a
 * failure panel rather than crash.
 */
export function verifySolution(model: SolverModel, circuits: CircuitTriple): boolean {
    for (let i = 0; i < model.rows.length; i++) {
        const row = model.rows[i];
        if (row.output === -1) continue;

        const assignment: Record<string, boolean> = {};
        model.variables.forEach((v, idx) => { assignment[v] = row.inputs[idx] === 1; });
        const expected = row.output === 1;

        if (
            evalAst(model.originalAst, assignment) !== expected ||
            evalAst(model.simplifiedAst, assignment) !== expected ||
            evaluateCircuit(circuits.basic, assignment) !== expected ||
            evaluateCircuit(circuits.nand, assignment) !== expected ||
            evaluateCircuit(circuits.nor, assignment) !== expected
        ) {
            return false;
        }
    }
    return true;
}
