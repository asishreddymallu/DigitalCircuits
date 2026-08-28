/**
 * Tests for the circuit image analysis pipeline.
 * Validates the solver correctly handles the circuitImage input mode.
 */

import { describe, it, expect } from "vitest";
import {
    buildSolverModel,
    SolverInputError,
    generateVariableNames,
} from "../../Web1/src/solverCore";
import { evalAst } from "../../shared/ts/boolean/ast";

describe("solverCore: circuitImage mode", () => {
    it("solves from AI-provided minterms", () => {
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B"],
                minterms: [1, 2, 3],
                dontCares: [],
            }
        });
        expect(model.variables).toEqual(["A", "B"]);
        expect(model.mode).toBe("circuitImage");
        expect(model.rows.length).toBe(4);
        expect(model.rows[0].output).toBe(0); // 00 → 0
        expect(model.rows[1].output).toBe(1); // 01 → 1
        expect(model.rows[2].output).toBe(1); // 10 → 1
        expect(model.rows[3].output).toBe(1); // 11 → 1
    });

    it("handles don't cares from AI", () => {
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B", "C"],
                minterms: [1, 3],
                dontCares: [2],
            }
        });
        expect(model.hasDontCares).toBe(true);
        expect(model.dontCares.has(2)).toBe(true);
        expect(model.ones).toContain(1);
        expect(model.ones).toContain(3);
    });

    it("uses expression for display when provided", () => {
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B"],
                minterms: [1, 2, 3],
                dontCares: [],
                expression: "A + B",
            }
        });
        expect(model.originalDisplay).toBe("A + B");
    });

    it("rejects empty variables", () => {
        expect(() => buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: [],
                minterms: [],
                dontCares: [],
            }
        })).toThrow(/couldn't identify any variables/i);
    });

    it("rejects out-of-range minterms", () => {
        expect(() => buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B"],
                minterms: [5],
                dontCares: [],
            }
        })).toThrow(/out of range/i);
    });

    it("derives correct truth table for AND circuit", () => {
        // AND gate: F = A·B → minterms: {3}
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B"],
                minterms: [3],
                dontCares: [],
                expression: "A·B",
            }
        });
        expect(model.rows[0].output).toBe(0); // 00
        expect(model.rows[1].output).toBe(0); // 01
        expect(model.rows[2].output).toBe(0); // 10
        expect(model.rows[3].output).toBe(1); // 11
    });

    it("derives correct truth table for NOT circuit", () => {
        // NOT gate: F = A' → minterms: {0}
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A"],
                minterms: [0],
                dontCares: [],
                expression: "A'",
            }
        });
        expect(model.rows[0].output).toBe(1); // 0
        expect(model.rows[1].output).toBe(0); // 1
    });

    it("derives correct truth table for multi-gate circuit (A'B + BC)", () => {
        // F = A'B + BC → minterms: 2, 3, 6, 7
        // A=0,B=1,C=0 → A'=1, A'B=1 → 2
        // A=0,B=1,C=1 → A'B=1, BC=1 → 3
        // A=1,B=1,C=0 → BC=0, A'B=0 → wait let me recalculate
        // A'B: when A=0 AND B=1 → minterms 2 (010), 3 (011)
        // BC:  when B=1 AND C=1 → minterms 3 (011), 7 (111)
        // Union: {2, 3, 7}... let me verify all 8:
        // 000: A'=1, B=0 → 0; BC=0 → 0. F=0
        // 001: A'=1, B=0 → 0; BC=0 → 0. F=0
        // 010: A'=1, B=1 → 1; BC=0 → 0. F=1 ✓ (minterm 2)
        // 011: A'=1, B=1 → 1; BC=1 → 1. F=1 ✓ (minterm 3)
        // 100: A'=0 → 0; BC=0 → 0. F=0
        // 101: A'=0 → 0; BC=0 → 0. F=0
        // 110: A'=0 → 0; BC=0 → 0. F=0
        // 111: A'=0 → 0; BC=1 → 1. F=1 ✓ (minterm 7)
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B", "C"],
                minterms: [2, 3, 7],
                dontCares: [],
                expression: "A'B + B·C",
            }
        });
        expect(model.variables).toEqual(["A", "B", "C"]);
        expect(model.ones).toEqual([2, 3, 7]);

        // Verify every row against expression
        for (let i = 0; i < model.rows.length; i++) {
            const row = model.rows[i];
            const assignment: Record<string, boolean> = {};
            model.variables.forEach((v, idx) => {
                assignment[v] = row.inputs[idx] === 1;
            });
            const expected = model.rows[i].output === 1;
            expect(evalAst(model.originalAst, assignment)).toBe(expected);
        }
    });

    it("strips duplicate minterms", () => {
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B"],
                minterms: [1, 1, 2, 2, 3],
                dontCares: [],
            }
        });
        expect(model.ones).toEqual([1, 2, 3]);
    });

    it("removes don't-cares that overlap with minterms", () => {
        const model = buildSolverModel({
            mode: "circuitImage",
            circuitImage: {
                variables: ["A", "B"],
                minterms: [1, 3],
                dontCares: [1, 2],
            }
        });
        expect(model.dontCares.has(1)).toBe(false);
        expect(model.dontCares.has(2)).toBe(true);
    });
});
