/**
 * Quine-McCluskey minimization with exact prime-implicant cover.
 *
 * Algorithm (unchanged from the original suite implementation, which was
 * verified against majority/XOR/don't-care functions):
 *
 *   1. Group ON-set terms (+ optional don't-cares) by popcount.
 *   2. Repeatedly merge patterns differing in exactly one bit; unmerged
 *      patterns are prime implicants.
 *   3. Build the prime implicant chart over true minterms only, extract
 *      essential primes, then exhaustively search the remainder for a
 *      minimum cover. A node budget bounds the exponential search; when the
 *      budget is exhausted the remaining minterms are covered greedily.
 *      The result is always a logically equivalent cover (verified by
 *      callers/tests) — only guaranteed minimality is relaxed.
 */

import { AstNode } from "./ast";
import { LIMITS, LimitError } from "./limits";

export interface Implicant {
    /** One char per variable: '1', '0', or '-' (don't care). */
    pattern: string;
}

export interface MinimizeOptions {
    /** Node budget for the exact-cover search (see LIMITS.MINIMIZE_NODE_BUDGET). */
    nodeBudget?: number;
}

export interface MinimizeResult {
    implicants: Implicant[];
    /** True when the function collapsed to the constant indicated by `constantValue`. */
    isConstant: boolean;
    constantValue?: boolean;
    /** True when the budget forced a greedy completion (still correct, maybe non-minimal). */
    coverTruncated: boolean;
}

function canCombine(a: string, b: string): boolean {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            diff++;
            if (diff > 1) return false;
        }
    }
    return diff === 1;
}

function combinePatterns(a: string, b: string): string {
    let result = "";
    for (let i = 0; i < a.length; i++) {
        result += a[i] === b[i] ? a[i] : "-";
    }
    return result;
}

export function patternCovers(pattern: string, minterm: number, variableCount: number): boolean {
    const bin = minterm.toString(2).padStart(variableCount, "0");
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] !== "-" && pattern[i] !== bin[i]) return false;
    }
    return true;
}

export function getPrimeImplicants(minterms: number[], variableCount: number): Implicant[] {
    let groups: Map<number, Set<string>> = new Map();
    minterms.forEach(m => {
        const bin = m.toString(2).padStart(variableCount, "0");
        const ones = (bin.match(/1/g) || []).length;
        if (!groups.has(ones)) groups.set(ones, new Set());
        groups.get(ones)!.add(bin);
    });

    const primes = new Set<string>();

    while (groups.size > 0) {
        const nextGroups: Map<number, Set<string>> = new Map();
        const combined = new Set<string>();
        const onesKeys = [...groups.keys()].sort((a, b) => a - b);

        for (let i = 0; i < onesKeys.length - 1; i++) {
            const k1 = onesKeys[i];
            const k2 = onesKeys[i + 1];
            // Patterns can only merge across adjacent popcount groups.
            if (k2 !== k1 + 1) continue;

            const g1 = groups.get(k1)!;
            const g2 = groups.get(k2)!;

            g1.forEach(p1 => {
                g2.forEach(p2 => {
                    if (canCombine(p1, p2)) {
                        combined.add(p1);
                        combined.add(p2);
                        const merged = combinePatterns(p1, p2);
                        const ones = (merged.replace(/-/g, "").match(/1/g) || []).length;
                        if (!nextGroups.has(ones)) nextGroups.set(ones, new Set());
                        nextGroups.get(ones)!.add(merged);
                    }
                });
            });
        }

        groups.forEach(set => {
            set.forEach(pattern => {
                if (!combined.has(pattern)) primes.add(pattern);
            });
        });

        groups = nextGroups;
    }

    return [...primes].map(pattern => ({ pattern }));
}

/**
 * Find a minimum cover of `minterms` using the given prime implicants.
 * Falls back to greedy coverage of any leftovers when `nodeBudget` is hit;
 * `coverTruncated` reports whether that happened.
 */
export function findMinimumCover(
    minterms: number[],
    primes: Implicant[],
    variableCount: number,
    nodeBudget: number = LIMITS.MINIMIZE_NODE_BUDGET
): { cover: Implicant[]; truncated: boolean } {
    if (minterms.length === 0 || primes.length === 0) return { cover: [], truncated: false };

    const chart: boolean[][] = primes.map(p =>
        minterms.map(m => patternCovers(p.pattern, m, variableCount))
    );

    // Essential primes: columns with exactly one covering row.
    const essentialPrimes = new Set<number>();
    const uncoveredMinterms = new Set<number>(minterms.map((_, i) => i));

    for (let c = 0; c < minterms.length; c++) {
        const coveringPrimes: number[] = [];
        for (let r = 0; r < primes.length; r++) {
            if (chart[r][c]) coveringPrimes.push(r);
        }
        if (coveringPrimes.length === 1) {
            const r = coveringPrimes[0];
            essentialPrimes.add(r);
            for (let col = 0; col < minterms.length; col++) {
                if (chart[r][col]) uncoveredMinterms.delete(col);
            }
        }
    }

    if (uncoveredMinterms.size === 0) {
        return { cover: [...essentialPrimes].map(i => primes[i]), truncated: false };
    }

    const remainingPrimes = primes
        .map((_, i) => i)
        .filter(i => !essentialPrimes.has(i));
    const remainingMinterms = [...uncoveredMinterms];

    let bestCombination: number[] | null = null;
    let nodesUsed = 0;
    let truncated = false;

    function search(uncovered: number[], chosen: number[]): void {
        if (uncovered.length === 0) {
            if (bestCombination === null || chosen.length < bestCombination.length) {
                bestCombination = [...chosen];
            }
            return;
        }
        if (bestCombination !== null && chosen.length >= bestCombination.length) return;

        // Budget check: abandon optimality rather than freezing the browser.
        if (++nodesUsed > nodeBudget) {
            truncated = true;
            return;
        }

        const targetMinterm = uncovered[0];
        const covering = remainingPrimes.filter(p => chart[p][targetMinterm] && !chosen.includes(p));

        for (const p of covering) {
            const newUncovered = uncovered.filter(m => !chart[p][m]);
            search(newUncovered, [...chosen, p]);
        }
    }

    search(remainingMinterms, []);

    let chosenIndices = new Set([...essentialPrimes, ...(bestCombination ?? [])]);
    let stillUncovered = truncated
        ? remainingMinterms.filter(mIdx => ![...chosenIndices].some(r => chart[r][mIdx]))
        : [];

    if (truncated && stillUncovered.length > 0) {
        // Greedy completion: repeatedly take the prime covering the most
        // still-uncovered minterms. Correctness (full cover) is guaranteed;
        // minimality is not.
        while (stillUncovered.length > 0) {
            let bestPrime = -1;
            let bestGain = -1;
            for (const r of remainingPrimes) {
                if (chosenIndices.has(r)) continue;
                const gain = stillUncovered.filter(mIdx => chart[r][mIdx]).length;
                if (gain > bestGain) {
                    bestGain = gain;
                    bestPrime = r;
                }
            }
            if (bestPrime === -1 || bestGain <= 0) break;
            chosenIndices.add(bestPrime);
            stillUncovered = stillUncovered.filter(mIdx => !chart[bestPrime][mIdx]);
        }
    }

    return { cover: [...chosenIndices].map(i => primes[i]), truncated };
}

/** Guard against runaway input sizes before any exponential work starts. */
export function assertMinimizable(varCount: number, termCount: number): void {
    if (varCount > LIMITS.MAX_VARIABLES) {
        throw new LimitError(
            `${varCount} variables exceeds the supported maximum of ${LIMITS.MAX_VARIABLES}. ` +
            `Reduce the number of variables in this function.`
        );
    }
    if (termCount > 1 << varCount) {
        throw new LimitError(`Term list contains more entries than the ${varCount}-variable space allows.`);
    }
}

/** Minimize the SOP (minterm) form. Don't-cares may be used freely in grouping. */
export function minimizeSOP(
    minterms: number[],
    variables: string[],
    dontCares?: ReadonlySet<number>,
    options?: MinimizeOptions
): MinimizeResult {
    assertMinimizable(variables.length, minterms.length + (dontCares?.size ?? 0));
    const varCount = variables.length;

    if (minterms.length === 0) {
        return { implicants: [], isConstant: true, constantValue: false, coverTruncated: false };
    }
    if (minterms.length + (dontCares?.size ?? 0) === (1 << varCount)) {
        // Every combination is 1 or don't-care: the function is identically 1.
        return {
            implicants: [{ pattern: "-".repeat(varCount) }],
            isConstant: true,
            constantValue: true,
            coverTruncated: false
        };
    }

    const allTerms = dontCares ? [...new Set([...minterms, ...dontCares])] : minterms;
    const primes = getPrimeImplicants(allTerms, varCount);
    if (primes.length > 5000) {
        throw new LimitError(
            `This function produced ${primes.length} prime implicants, which is too complex to minimize interactively.`
        );
    }
    const { cover, truncated } =
        findMinimumCover(minterms, primes, varCount, options?.nodeBudget ?? LIMITS.MINIMIZE_NODE_BUDGET);
    return { implicants: cover, isConstant: false, coverTruncated: truncated };
}

/** Minimize the POS (maxterm) form by minimizing the complement's SOP. */
export function minimizePOS(
    zeros: number[],
    variables: string[],
    dontCares?: ReadonlySet<number>,
    options?: MinimizeOptions
): MinimizeResult {
    assertMinimizable(variables.length, zeros.length + (dontCares?.size ?? 0));
    const varCount = variables.length;

    if (zeros.length === 0) {
        return { implicants: [], isConstant: true, constantValue: true, coverTruncated: false };
    }
    if (zeros.length + (dontCares?.size ?? 0) === (1 << varCount)) {
        return {
            implicants: [{ pattern: "-".repeat(varCount) }],
            isConstant: true,
            constantValue: false,
            coverTruncated: false
        };
    }

    const allTerms = dontCares ? [...new Set([...zeros, ...dontCares])] : zeros;
    const primes = getPrimeImplicants(allTerms, varCount);
    if (primes.length > 5000) {
        throw new LimitError(
            `This function produced ${primes.length} prime implicants, which is too complex to minimize interactively.`
        );
    }
    const { cover, truncated } =
        findMinimumCover(zeros, primes, varCount, options?.nodeBudget ?? LIMITS.MINIMIZE_NODE_BUDGET);
    return { implicants: cover, isConstant: false, coverTruncated: truncated };
}

/* ------------------------------------------------------------------ */
/* Implicant → AST construction                                       */
/* ------------------------------------------------------------------ */

/**
 * Convert one implicant pattern into an AND-of-literals AST term.
 * Pattern bit '1' → plain variable, '0' → complemented variable.
 * An all-dash pattern means "always true" and yields CONST(true).
 */
export function patternToTermAst(pattern: string, variables: string[]): AstNode {
    const literals: AstNode[] = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "1") literals.push({ kind: "var", name: variables[i] });
        else if (pattern[i] === "0") literals.push({ kind: "not", child: { kind: "var", name: variables[i] } });
    }
    if (literals.length === 0) return { kind: "const", value: true };
    return literals.reduce((acc, lit) => ({ kind: "and", left: acc, right: lit }));
}

/** OR together the minimized SOP terms. Empty cover ⇒ constant 0. */
export function sopAstFromImplicants(implicants: Implicant[], variables: string[]): AstNode {
    if (implicants.length === 0) return { kind: "const", value: false };
    return implicants
        .map(imp => patternToTermAst(imp.pattern, variables))
        .reduce((acc, term) => ({ kind: "or", left: acc, right: term }));
}

/**
 * POS clauses: pattern '0' → plain variable, '1' → complemented variable
 * (this is the complement convention versus SOP). All-dash ⇒ constant 0 clause.
 */
export function patternToClauseAst(pattern: string, variables: string[]): AstNode {
    const parts: AstNode[] = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "0") parts.push({ kind: "var", name: variables[i] });
        else if (pattern[i] === "1") parts.push({ kind: "not", child: { kind: "var", name: variables[i] } });
    }
    if (parts.length === 0) return { kind: "const", value: false };
    return parts.reduce((acc, lit) => ({ kind: "or", left: acc, right: lit }));
}

/** AND together the minimized POS clauses. Empty cover ⇒ constant 1. */
export function posAstFromImplicants(implicants: Implicant[], variables: string[]): AstNode {
    if (implicants.length === 0) return { kind: "const", value: true };
    return implicants
        .map(imp => patternToClauseAst(imp.pattern, variables))
        .reduce((acc, clause) => ({ kind: "and", left: acc, right: clause }));
}
