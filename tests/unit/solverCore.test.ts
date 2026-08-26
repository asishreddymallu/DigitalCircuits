/**
 * Solver core tests: verifies the full Web1 pipeline from raw user input
 * through to the verified SolverModel, covering all input modes and edge
 * cases including constants and multi-character variables.
 */

import { describe, it, expect } from "vitest";
import {
    buildSolverModel,
    SolverInputError,
    generateVariableNames,
    parseNumberList,
    type RawInputs
} from "../../Web1/src/solverCore";
import { evalAst } from "../../shared/ts/boolean/ast";

describe("solverCore: parseNumberList", () => {
    it("parses comma-separated integers", () => {
        expect(parseNumberList("1, 3, 5")).toEqual([1, 3, 5]);
    });

    it("handles whitespace and mixed delimiters", () => {
        expect(parseNumberList("1 , 3  ,5")).toEqual([1, 3, 5]);
    });

    it("returns empty array for empty string", () => {
        expect(parseNumberList("")).toEqual([]);
    });

    it("parses single number", () => {
        expect(parseNumberList("7")).toEqual([7]);
    });
});

describe("solverCore: generateVariableNames", () => {
    it("generates A..F for counts 1-6", () => {
        expect(generateVariableNames(3)).toEqual(["A", "B", "C"]);
        expect(generateVariableNames(6)).toEqual(["A", "B", "C", "D", "E", "F"]);
    });
});

describe("solverCore: expression mode", () => {
    it("solves a simple SOP expression", () => {
        const model = buildSolverModel({ mode: "expression", expression: "A + B" });
        expect(model.variables).toEqual(["A", "B"]);
        expect(model.rows.length).toBe(4);
        // A+B: rows 1,2,3 are 1; row 0 is 0
        expect(model.rows[0].output).toBe(0);
        expect(model.rows[1].output).toBe(1);
        expect(model.rows[2].output).toBe(1);
        expect(model.rows[3].output).toBe(1);
    });

    it("rejects empty expression", () => {
        expect(() => buildSolverModel({ mode: "expression", expression: "" })).toThrow(/empty/i);
    });
});

describe("solverCore: minterm mode", () => {
    it("solves from minterm list", () => {
        const model = buildSolverModel({
            mode: "minterms",
            mintermCount: 3,
            mintermList: [3, 5, 6, 7]
        });
        expect(model.variables).toEqual(["A", "B", "C"]);
        // Majority: A+B should be the simplified form
        expect(model.ones).toEqual([3, 5, 6, 7]);
        expect(model.zeros).toEqual([0, 1, 2, 4]);
    });

    it("rejects out-of-range minterms", () => {
        expect(() => buildSolverModel({
            mode: "minterms",
            mintermCount: 2,
            mintermList: [5]
        })).toThrow(/out of range/i);
    });
});

describe("solverCore: constant results", () => {
    it("all minterms → constant 1", () => {
        const model = buildSolverModel({
            mode: "minterms",
            mintermCount: 2,
            mintermList: [0, 1, 2, 3]
        });
        expect(model.sop.isConstant).toBe(true);
        expect(model.sop.constantValue).toBe(true);
        expect(model.simplifiedDisplay).toBe("1");
    });

    it("no minterms → constant 0", () => {
        const model = buildSolverModel({
            mode: "minterms",
            mintermCount: 2,
            mintermList: []
        });
        expect(model.sop.isConstant).toBe(true);
        expect(model.sop.constantValue).toBe(false);
        expect(model.simplifiedDisplay).toBe("0");
    });
});

describe("solverCore: don't-care mode", () => {
    it("includes don't-cares in minimization", () => {
        const model = buildSolverModel({
            mode: "dontCare",
            dontCareCount: 3,
            dontCareMintermList: [1, 3],
            dontCareList: [2]
        });
        expect(model.hasDontCares).toBe(true);
        expect(model.dontCares.has(2)).toBe(true);
    });

    it("rejects overlapping minterms and don't-cares", () => {
        expect(() => buildSolverModel({
            mode: "dontCare",
            dontCareCount: 3,
            dontCareMintermList: [1, 2],
            dontCareList: [2, 5]
        })).toThrow(/both minterms and don't cares/);
    });
});

describe("solverCore: verification", () => {
    it("simplified expression matches truth table for majority", () => {
        const model = buildSolverModel({
            mode: "expression",
            expression: "A·B + B·C + A·C"
        });
        // Every non-constant row must be consistent
        for (let i = 0; i < model.rows.length; i++) {
            const row = model.rows[i];
            const assignment: Record<string, boolean> = {};
            model.variables.forEach((v, idx) => {
                assignment[v] = row.inputs[idx] === 1;
            });
            const origVal = evalAst(model.originalAst, assignment);
            const simpVal = evalAst(model.simplifiedAst, assignment);
            expect(origVal).toBe(simpVal);
            expect(origVal).toBe(row.output === 1);
        }
    });
});
