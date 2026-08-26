/**
 * Canonical Boolean AST used across the suite.
 *
 * Every front-end feature (truth tables, Quine-McCluskey minimization,
 * K-maps, circuit graphs, code exports, AI verification) derives from this
 * single representation, so there is exactly one source of truth for what a
 * Boolean expression *means*.
 */

export type AstNode =
    | { kind: "var"; name: string }
    | { kind: "const"; value: boolean }
    | { kind: "not"; child: AstNode }
    | { kind: "and"; left: AstNode; right: AstNode }
    | { kind: "or"; left: AstNode; right: AstNode }
    | { kind: "xor"; left: AstNode; right: AstNode };

/** Evaluate the AST against an assignment of variable names to booleans. */
export function evalAst(node: AstNode, assignment: Record<string, boolean>): boolean {
    switch (node.kind) {
        case "var": return assignment[node.name] ?? false;
        case "const": return node.value;
        case "not": return !evalAst(node.child, assignment);
        case "and": return evalAst(node.left, assignment) && evalAst(node.right, assignment);
        case "or": return evalAst(node.left, assignment) || evalAst(node.right, assignment);
        case "xor": return evalAst(node.left, assignment) !== evalAst(node.right, assignment);
    }
}

/** Collect the distinct variable names referenced by the AST (sorted). */
export function collectVars(node: AstNode, out: Set<string> = new Set()): Set<string> {
    switch (node.kind) {
        case "var": out.add(node.name); break;
        case "const": break;
        case "not": collectVars(node.child, out); break;
        default:
            collectVars(node.left, out);
            collectVars(node.right, out);
    }
    return out;
}

/**
 * Build a truth table over the given ordered variables. Variable order is
 * significant: index i of a row corresponds to variables[i], and row number i
 * encodes the inputs MSB-first (variables[0] is the most significant bit).
 */
export interface TruthRow {
    inputs: number[];
    output: number;
}

export function generateCombinations(variableCount: number): number[][] {
    const total = 1 << variableCount;
    const combinations: number[][] = [];
    for (let i = 0; i < total; i++) {
        const row: number[] = [];
        for (let bit = variableCount - 1; bit >= 0; bit--) {
            row.push((i >> bit) & 1);
        }
        combinations.push(row);
    }
    return combinations;
}

export function astTruthTable(ast: AstNode, variables: string[]): TruthRow[] {
    return generateCombinations(variables.length).map(inputs => {
        const assignment: Record<string, boolean> = {};
        variables.forEach((v, i) => { assignment[v] = inputs[i] === 1; });
        return { inputs, output: evalAst(ast, assignment) ? 1 : 0 };
    });
}

/**
 * Exhaustively compare two ASTs over the given variable universe.
 * Returns the first mismatching index, or -1 when equivalent.
 */
export function firstMismatch(a: AstNode, b: AstNode, variables: string[]): number {
    const total = 1 << variables.length;
    for (let i = 0; i < total; i++) {
        const assignment: Record<string, boolean> = {};
        variables.forEach((v, idx) => { assignment[v] = ((i >> (variables.length - 1 - idx)) & 1) === 1; });
        if (evalAst(a, assignment) !== evalAst(b, assignment)) return i;
    }
    return -1;
}
