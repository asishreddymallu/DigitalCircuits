/**
 * Tests for the Web1 waveform playground computation logic.
 * Tests that the Boolean function output is correctly computed
 * from input signal patterns.
 */

import { describe, it, expect } from "vitest";
import { evalAst, generateCombinations } from "../../shared/ts/boolean/ast";
import { parseExpression } from "../../shared/ts/boolean/parser";

/**
 * Compute output waveform from input patterns and an expression.
 * This mirrors the core logic of the waveform playground.
 */
function computeWaveform(
    expression: string,
    variables: string[],
    patterns: Record<string, boolean[]>,
    stepCount: number
): boolean[] {
    const { ast } = parseExpression(expression);
    const output: boolean[] = [];
    for (let step = 0; step < stepCount; step++) {
        const assignment: Record<string, boolean> = {};
        variables.forEach(v => {
            assignment[v] = patterns[v]?.[step] ?? false;
        });
        output.push(evalAst(ast, assignment));
    }
    return output;
}

describe("waveform: output computation", () => {
    it("computes AND gate output correctly", () => {
        // A: 0101, B: 0011 → F = A&B: 0001
        const output = computeWaveform("A·B", ["A", "B"], {
            A: [false, true, false, true],
            B: [false, false, true, true],
        }, 4);
        expect(output).toEqual([false, false, false, true]);
    });

    it("computes OR gate output correctly", () => {
        // A: 0101, B: 0011 → F = A+B: 0111
        const output = computeWaveform("A + B", ["A", "B"], {
            A: [false, true, false, true],
            B: [false, false, true, true],
        }, 4);
        expect(output).toEqual([false, true, true, true]);
    });

    it("computes NOT gate output correctly", () => {
        // A: 0101 → F = A': 1010
        const output = computeWaveform("A'", ["A"], {
            A: [false, true, false, true],
        }, 4);
        expect(output).toEqual([true, false, true, false]);
    });

    it("computes XOR gate output correctly", () => {
        // A: 0101, B: 0011 → F = A^B: 0110
        const output = computeWaveform("A ^ B", ["A", "B"], {
            A: [false, true, false, true],
            B: [false, false, true, true],
        }, 4);
        expect(output).toEqual([false, true, true, false]);
    });

    it("computes AB + C correctly with 3 variables", () => {
        // Variables A,B,C with 8 steps (all combinations)
        const patterns = {
            A: [false, false, false, false, true, true, true, true],
            B: [false, false, true, true, false, false, true, true],
            C: [false, true, false, true, false, true, false, true],
        };
        const output = computeWaveform("A·B + C", ["A", "B", "C"], patterns, 8);
        expect(output).toEqual([false, true, false, true, false, true, true, true]);
    });

    it("computes full adder sum correctly", () => {
        // Sum = A ^ B ^ C
        const patterns = {
            A: [false, false, false, false, true, true, true, true],
            B: [false, false, true, true, false, false, true, true],
            C: [false, true, false, true, false, true, false, true],
        };
        const output = computeWaveform("A ^ B ^ C", ["A", "B", "C"], patterns, 8);
        // Full adder sum: 0,1,1,0,1,0,0,1
        expect(output).toEqual([false, true, true, false, true, false, false, true]);
    });

    it("handles constant input patterns", () => {
        // All zeros → output should be 0 for any non-trivial function
        const output = computeWaveform("A + B", ["A", "B"], {
            A: [false, false, false, false],
            B: [false, false, false, false],
        }, 4);
        expect(output).toEqual([false, false, false, false]);
    });

    it("handles all-ones input patterns", () => {
        // All ones → output should be 1 for any non-constant-0 function
        const output = computeWaveform("A + B", ["A", "B"], {
            A: [true, true, true, true],
            B: [true, true, true, true],
        }, 4);
        expect(output).toEqual([true, true, true, true]);
    });

    it("output matches truth table for AB+C", () => {
        const vars = ["A", "B", "C"];
        const combos = generateCombinations(3);
        const patterns: Record<string, boolean[]> = {};
        vars.forEach((v, i) => {
            patterns[v] = combos.map(row => row[i] === 1);
        });

        const output = computeWaveform("A·B + C", vars, patterns, 8);

        // Verify against direct evaluation
        const { ast } = parseExpression("A·B + C");
        combos.forEach((inputs, idx) => {
            const assignment: Record<string, boolean> = {};
            vars.forEach((v, i) => { assignment[v] = inputs[i] === 1; });
            expect(output[idx]).toBe(evalAst(ast, assignment));
        });
    });
});

describe("waveform: pattern generation", () => {
    it("generates correct binary counter pattern for single variable", () => {
        // Single variable A: 01010101 (toggles every step)
        const stepCount = 8;
        const pattern: boolean[] = [];
        for (let step = 0; step < stepCount; step++) {
            pattern.push(step % 2 === 1);
        }
        expect(pattern).toEqual([false, true, false, true, false, true, false, true]);
    });

    it("generates correct binary counter pattern for second variable", () => {
        // Second variable B: 00110011 (toggles every 2 steps)
        const stepCount = 8;
        const pattern: boolean[] = [];
        for (let step = 0; step < stepCount; step++) {
            pattern.push((Math.floor(step / 2) % 2) === 1);
        }
        expect(pattern).toEqual([false, false, true, true, false, false, true, true]);
    });

    it("generates correct binary counter pattern for third variable", () => {
        // Third variable C: 00001111 (toggles every 4 steps)
        const stepCount = 8;
        const pattern: boolean[] = [];
        for (let step = 0; step < stepCount; step++) {
            pattern.push((Math.floor(step / 4) % 2) === 1);
        }
        expect(pattern).toEqual([false, false, false, false, true, true, true, true]);
    });
});
