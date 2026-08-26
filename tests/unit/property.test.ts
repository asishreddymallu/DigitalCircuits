/**
 * Property-style tests for the Quine-McCluskey minimizer.
 *
 * For each randomly generated Boolean function:
 *   1. Generate the full truth table (2^n rows).
 *   2. Minimize using QM (minimizeSOP).
 *   3. Convert implicants to AST (sopAstFromImplicants).
 *   4. Evaluate the AST for all 2^n inputs (evalAst).
 *   5. Compare every minterm — they MUST be identical.
 *
 * This catches subtle correctness bugs that hand-written test cases miss.
 */

import { describe, it, expect } from "vitest";
import { minimizeSOP, sopAstFromImplicants } from "../../shared/ts/boolean/minimizer";
import { mulberry32, randomMinterms, evalAstAtIndex } from "./helpers";

/** A, B, C, D, … for n variables. */
function generateVariableNames(count: number): string[] {
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
        names.push(String.fromCharCode(65 + i));
    }
    return names;
}

/**
 * Evaluate an AST against a truth table and return minterm indices.
 */
function astToMinterms(ast: ReturnType<typeof sopAstFromImplicants>, numVars: number): number[] {
    const variables = generateVariableNames(numVars);
    const minterms: number[] = [];
    for (let i = 0; i < (1 << numVars); i++) {
        if (evalAstAtIndex(ast, variables, i)) {
            minterms.push(i);
        }
    }
    return minterms;
}

/** Convert minterm list to minimized AST. */
function minimizeToAst(minterms: number[], variables: string[], dontCares?: Set<number>) {
    const result = minimizeSOP(minterms, variables, dontCares);
    if (result.isConstant) {
        return { kind: "const" as const, value: !!result.constantValue };
    }
    return sopAstFromImplicants(result.implicants, variables);
}

describe("Property: random function minimization preserves truth table", () => {
    const testCases: [number, number[]][] = [
        [2, [42, 123, 256, 999]],
        [3, [1, 42, 200, 777, 1024]],
        [4, [7, 42, 100, 333, 555, 1024]],
        [5, [3, 42, 88, 256, 777]],
        [6, [10, 42, 100, 999]],
    ];

    for (const [numVars, seeds] of testCases) {
        for (const seed of seeds) {
            it(`n=${numVars} seed=${seed}`, () => {
                const rand = mulberry32(seed);
                const minterms = randomMinterms(rand, numVars);
                const variables = generateVariableNames(numVars);

                const ast = minimizeToAst(minterms, variables);
                const resultMinterms = astToMinterms(ast, numVars);
                expect(resultMinterms.sort((a, b) => a - b)).toEqual(
                    [...minterms].sort((a, b) => a - b),
                );
            });
        }
    }
});

describe("Property: all-0 and all-1 functions", () => {
    for (let n = 1; n <= 6; n++) {
        it(`constant-0 for ${n} variables`, () => {
            const result = minimizeSOP([], generateVariableNames(n));
            expect(result.isConstant).toBe(true);
            expect(result.constantValue).toBe(false);
        });

        it(`constant-1 for ${n} variables`, () => {
            const allMinterms = Array.from({ length: 2 ** n }, (_, i) => i);
            const result = minimizeSOP(allMinterms, generateVariableNames(n));
            expect(result.isConstant).toBe(true);
            expect(result.constantValue).toBe(true);
        });
    }
});

describe("Property: XOR and XNOR functions", () => {
    for (let n = 2; n <= 5; n++) {
        it(`XOR of ${n} variables`, () => {
            const variables = generateVariableNames(n);
            const total = 2 ** n;
            const minterms: number[] = [];
            for (let i = 0; i < total; i++) {
                let ones = 0;
                for (let b = 0; b < n; b++) {
                    if ((i >> b) & 1) ones++;
                }
                if (ones % 2 === 1) minterms.push(i);
            }

            const ast = minimizeToAst(minterms, variables);
            const resultMinterms = astToMinterms(ast, n);
            expect(resultMinterms.sort((a, b) => a - b)).toEqual(
                [...minterms].sort((a, b) => a - b),
            );
        });

        it(`XNOR of ${n} variables`, () => {
            const variables = generateVariableNames(n);
            const total = 2 ** n;
            const minterms: number[] = [];
            for (let i = 0; i < total; i++) {
                let ones = 0;
                for (let b = 0; b < n; b++) {
                    if ((i >> b) & 1) ones++;
                }
                if (ones % 2 === 0) minterms.push(i);
            }

            const ast = minimizeToAst(minterms, variables);
            const resultMinterms = astToMinterms(ast, n);
            expect(resultMinterms.sort((a, b) => a - b)).toEqual(
                [...minterms].sort((a, b) => a - b),
            );
        });
    }
});

describe("Property: majority function", () => {
    for (let n = 3; n <= 6; n++) {
        it(`majority of ${n} variables`, () => {
            const variables = generateVariableNames(n);
            const total = 2 ** n;
            const threshold = Math.ceil(n / 2);
            const minterms: number[] = [];
            for (let i = 0; i < total; i++) {
                let ones = 0;
                for (let b = 0; b < n; b++) {
                    if ((i >> b) & 1) ones++;
                }
                if (ones >= threshold) minterms.push(i);
            }

            const ast = minimizeToAst(minterms, variables);
            const resultMinterms = astToMinterms(ast, n);
            expect(resultMinterms.sort((a, b) => a - b)).toEqual(
                [...minterms].sort((a, b) => a - b),
            );
        });
    }
});

describe("Property: don't-care optimization", () => {
    for (let n = 3; n <= 5; n++) {
        it(`function with don't-cares for ${n} variables`, () => {
            const variables = generateVariableNames(n);
            const total = 2 ** n;
            const seed = n * 100 + 42;
            const rand = mulberry32(seed);
            const minterms: number[] = [];
            const dontCares: number[] = [];
            for (let i = 0; i < total; i++) {
                const r = rand();
                if (r < 0.33) minterms.push(i);
                else if (r < 0.66) dontCares.push(i);
            }

            const ast = minimizeToAst(minterms, variables, new Set(dontCares));
            const resultMinterms = astToMinterms(ast, n);

            // Every minterm must be in the result.
            for (const m of minterms) {
                expect(resultMinterms).toContain(m);
            }
            // No non-don't-care zero should be in the result.
            const nonDCZeros = Array.from({ length: total }, (_, i) => i)
                .filter(i => !minterms.includes(i) && !dontCares.includes(i));
            for (const z of nonDCZeros) {
                expect(resultMinterms).not.toContain(z);
            }
        });
    }
});
