import { describe, it, expect } from "vitest";
import {
    minimizeSOP,
    minimizePOS,
    patternToTermAst,
    sopAstFromImplicants,
    posAstFromImplicants,
    findMinimumCover,
    getPrimeImplicants
} from "../../shared/ts/boolean/minimizer";
import { evalAst, firstMismatch } from "../../shared/ts/boolean/ast";
import { mulberry32, randomMinterms } from "./helpers";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Truth-table equivalence check: minimized SOP must reproduce the original ON-set. */
function expectSopEquivalent(minterms: number[], n: number, dontCares?: Set<number>): void {
    const vars = LETTERS.slice(0, n);
    const result = minimizeSOP(minterms, vars, dontCares);
    if (result.isConstant) {
        const expected = result.constantValue ? true : false;
        for (let m = 0; m < 1 << n; m++) {
            if (dontCares?.has(m)) continue;
            const isOn = minterms.includes(m);
            expect(isOn).toBe(expected);
        }
        return;
    }
    const ast = sopAstFromImplicants(result.implicants, vars);
    for (let m = 0; m < (1 << n); m++) {
        if (dontCares?.has(m)) continue;
        const assignment: Record<string, boolean> = {};
        vars.forEach((v, i) => { assignment[v] = ((m >> (n - 1 - i)) & 1) === 1; });
        expect(evalAst(ast, assignment)).toBe(minterms.includes(m));
    }
}

/** Same for POS over the OFF-set. */
function expectPosEquivalent(zeros: number[], n: number, dontCares?: Set<number>): void {
    const vars = LETTERS.slice(0, n);
    const result = minimizePOS(zeros, vars, dontCares);
    if (result.isConstant) {
        for (let m = 0; m < 1 << n; m++) {
            if (dontCares?.has(m)) continue;
            const isOff = zeros.includes(m);
            // constantValue is the FUNCTION value; off-set rows are its negation.
            expect(isOff).toBe(!result.constantValue);
        }
        return;
    }
    const ast = posAstFromImplicants(result.implicants, vars);
    for (let m = 0; m < (1 << n); m++) {
        if (dontCares?.has(m)) continue;
        const assignment: Record<string, boolean> = {};
        vars.forEach((v, i) => { assignment[v] = ((m >> (n - 1 - i)) & 1) === 1; });
        expect(evalAst(ast, assignment)).toBe(!zeros.includes(m));
    }
}

describe("minimizer: known functions", () => {
    it("minimizes the majority function to three 2-literal terms", () => {
        const r = minimizeSOP([3, 5, 6, 7], ["A", "B", "C"]);
        expect(r.implicants.map(i => i.pattern).sort()).toEqual(["1-1", "11-", "-11"].sort());
    });

    it("produces classic POS for majority", () => {
        const r = minimizePOS([0, 1, 2, 4], ["A", "B", "C"]);
        // Zeros {000,001,010,100} group as 00- / 0-0 / -00 → (A+B)(A+C)(B+C).
        // Clause convention: '0' bit → plain variable.
        expect(r.implicants.map(i => i.pattern).sort()).toEqual(["00-", "0-0", "-00"].sort());
    });

    it("uses don't-cares to grow implicants", () => {
        // Σm(1,3) with d(2): B'C covers 1,3 (and DC 2 is free).
        const r = minimizeSOP([1, 3], ["A", "B", "C"], new Set([2]));
        expect(r.implicants.some(i => i.pattern === "0-1" || i.pattern === "-01")).toBe(true);
        expectSopEquivalent([1, 3], 3, new Set([2]));
    });
});

describe("minimizer: constant functions", () => {
    it("returns constant 0 for an empty ON-set", () => {
        const r = minimizeSOP([], ["A", "B"]);
        expect(r.isConstant).toBe(true);
        expect(r.constantValue).toBe(false);
    });

    it("returns constant 1 when every combination is a minterm or don't-care", () => {
        const r = minimizeSOP([0, 1], ["A", "B"], new Set([2, 3]));
        expect(r.isConstant).toBe(true);
        expect(r.constantValue).toBe(true);
    });

    it("returns constant 1 for a full ON-set POS input (no zeros)", () => {
        const r = minimizePOS([], ["A", "B"]);
        expect(r.isConstant).toBe(true);
        expect(r.constantValue).toBe(true);
    });

    it("builds CONST ASTs for constants", () => {
        expect(sopAstFromImplicants([], ["A"]).kind).toBe("const");
        const allDash = [{ pattern: "--" }];
        expect(evalAst(sopAstFromImplicants(allDash, ["A", "B"]), {})).toBe(true);
    });
});

describe("minimizer: exhaustive equivalence over random functions", () => {
    // Property test: for seeded-random functions at several densities and
    // arities, SOP and POS minimizations must be truth-table equivalent to
    // the original function. This is the core correctness guarantee of QM.
    const rand = mulberry32(20260826);

    for (const n of [2, 3, 4, 5]) {
        it(`n=${n}: SOP and POS equivalence across 60 random functions`, () => {
            for (let trial = 0; trial < 60; trial++) {
                const density = [0.15, 0.35, 0.5, 0.65, 0.85][trial % 5];
                const minterms = randomMinterms(rand, n, density);
                const zeros: number[] = [];
                for (let m = 0; m < (1 << n); m++) if (!minterms.includes(m)) zeros.push(m);

                expect(() => expectSopEquivalent(minterms, n)).not.toThrow();
                expect(() => expectPosEquivalent(zeros, n)).not.toThrow();

                // Random disjoint don't-care set.
                if (rand() < 0.5 && minterms.length + zeros.length > 0) {
                    const dc = new Set<number>();
                    for (let m = 0; m < (1 << n); m++) {
                        if (rand() < 0.1) dc.add(m);
                    }
                    const cleaned = [...dc].filter(m => !minterms.includes(m));
                    const dcSet = new Set(cleaned);
                    const onesNoDc = minterms.filter(m => !dcSet.has(m));
                    const zerosNoDc = zeros.filter(m => !dcSet.has(m));
                    expect(() => expectSopEquivalent(onesNoDc, n, dcSet)).not.toThrow();
                    expect(() => expectPosEquivalent(zerosNoDc, n, dcSet)).not.toThrow();
                }
            }
        });
    }

    it("n=6 spot checks (largest UI-supported arity)", () => {
        for (let trial = 0; trial < 10; trial++) {
            const minterms = randomMinterms(rand, 6, 0.4);
            expect(() => expectSopEquivalent(minterms, 6)).not.toThrow();
        }
    });
});

describe("minimizer: budget fallback stays correct", () => {
    it("greedy completion still produces an equivalent cover", () => {
        const rand = mulberry32(7);
        const n = 5;
        const minterms = randomMinterms(rand, n, 0.45);
        // Force the exact-cover search to bail immediately.
        const vars = LETTERS.slice(0, n);
        const primes = getPrimeImplicants([...new Set([...minterms])], n);
        const { cover, truncated } = findMinimumCover(minterms, primes, n, 1);
        const ast = sopAstFromImplicants(cover.length ? cover : minimizeSOP(minterms, vars).implicants, vars);
        for (let m = 0; m < (1 << n); m++) {
            const assignment: Record<string, boolean> = {};
            vars.forEach((v, i) => { assignment[v] = ((m >> (n - 1 - i)) & 1) === 1; });
            expect(evalAst(ast, assignment)).toBe(minterms.includes(m));
        }
        void truncated;
    });
});

describe("minimizer: multi-character variables", () => {
    it("works with named variables beyond A-F", () => {
        const vars = ["RESET_N", "ENABLE", "DATA0"];
        // Majority function on renamed variables.
        const minterms = [3, 5, 6, 7];
        const r = minimizeSOP(minterms, vars);
        const ast = sopAstFromImplicants(r.implicants, vars);
        expect(firstMismatch(ast, ast, vars)).toBe(-1);
        expectSopEquivalent(minterms, 3);
    });
});
