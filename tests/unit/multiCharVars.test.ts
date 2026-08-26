/**
 * E5: Multi-character variable name tests.
 *
 * Identifiers like PIN, ENABLE, RESET_N, DATA0 must be treated as single
 * variables through the full pipeline: parse → evaluate → minimize →
 * verify → export.
 */

import { describe, it, expect } from "vitest";
import { parseExpression } from "../../shared/ts/boolean/parser";
import { evalAst, firstMismatch, astTruthTable } from "../../shared/ts/boolean/ast";
import { minimizeSOP, sopAstFromImplicants } from "../../shared/ts/boolean/minimizer";
import { termToString, formatAst } from "../../shared/ts/boolean/formatter";
import { generateVerilogModule } from "../../shared/ts/exporters/verilog";
import { generateCFunction } from "../../shared/ts/exporters/c";

describe("E5: multi-char parsing", () => {
    it("PIN is one variable", () => {
        expect(parseExpression("PIN").variables).toEqual(["PIN"]);
    });

    it("RESET_N is one variable", () => {
        expect(parseExpression("RESET_N").variables).toEqual(["RESET_N"]);
    });

    it("DATA0 is one variable", () => {
        expect(parseExpression("DATA0").variables).toEqual(["DATA0"]);
    });

    it("ENABLE is one variable", () => {
        expect(parseExpression("ENABLE").variables).toEqual(["ENABLE"]);
    });

    it("mixes multi-char names in one expression", () => {
        const r = parseExpression("RESET_N' · DATA0 + ENABLE");
        expect(r.variables.sort()).toEqual(["DATA0", "ENABLE", "RESET_N"].sort());
    });
});

describe("E5: multi-char evaluation", () => {
    it("PIN evaluates correctly", () => {
        const ast = parseExpression("PIN").ast;
        expect(evalAst(ast, { PIN: true })).toBe(true);
        expect(evalAst(ast, { PIN: false })).toBe(false);
    });

    it("RESET_N complement works", () => {
        const ast = parseExpression("RESET_N'").ast;
        expect(evalAst(ast, { RESET_N: true })).toBe(false);
        expect(evalAst(ast, { RESET_N: false })).toBe(true);
    });

    it("complex expression with multi-char names", () => {
        const ast = parseExpression("RESET_N' · ENABLE + DATA0").ast;
        // When RESET_N=0, ENABLE=1 → (1·1) + DATA0 = 1
        expect(evalAst(ast, { RESET_N: false, ENABLE: true, DATA0: false })).toBe(true);
        // When RESET_N=1, ENABLE=0, DATA0=0 → (0·0) + 0 = 0
        expect(evalAst(ast, { RESET_N: true, ENABLE: false, DATA0: false })).toBe(false);
        // When RESET_N=1, ENABLE=0, DATA0=1 → (0·0) + 1 = 1
        expect(evalAst(ast, { RESET_N: true, ENABLE: false, DATA0: true })).toBe(true);
    });
});

describe("E5: multi-char minimization", () => {
    it("minimizes with multi-char variable names", () => {
        const vars = ["RESET_N", "ENABLE", "DATA0"];
        // Majority function on these renamed variables
        const minterms = [3, 5, 6, 7]; // same minterms as ABC majority
        const result = minimizeSOP(minterms, vars);
        expect(result.implicants.length).toBeGreaterThan(0);

        const ast = sopAstFromImplicants(result.implicants, vars);
        // Exhaustive check: all 8 rows must match
        for (let i = 0; i < 8; i++) {
            const assignment: Record<string, boolean> = {};
            vars.forEach((v, idx) => {
                assignment[v] = ((i >> (2 - idx)) & 1) === 1;
            });
            expect(evalAst(ast, assignment)).toBe(minterms.includes(i));
        }
    });
});

describe("E5: multi-char formatter round-trip", () => {
    it("formatter separates adjacent identifiers with ·", () => {
        const ast = parseExpression("PIN · ENABLE").ast;
        const formatted = formatAst(ast, { andSymbol: "" });
        expect(formatted).toBe("PIN·ENABLE");
    });

    it("formatted output re-parses identically", () => {
        const original = parseExpression("RESET_N' · ENABLE + DATA0").ast;
        const formatted = formatAst(original, { andSymbol: "·" });
        const reparsed = parseExpression(formatted).ast;
        const vars = ["DATA0", "ENABLE", "RESET_N"];
        expect(firstMismatch(original, reparsed, vars)).toBe(-1);
    });
});

describe("E5: multi-char export", () => {
    it("Verilog preserves multi-char names", () => {
        const ast = parseExpression("RESET_N' · ENABLE + DATA0").ast;
        const v = generateVerilogModule(ast, { inputs: ["RESET_N", "ENABLE", "DATA0"] });
        expect(v).toContain("RESET_N");
        expect(v).toContain("ENABLE");
        expect(v).toContain("DATA0");
    });

    it("C export preserves multi-char names", () => {
        const ast = parseExpression("RESET_N' · ENABLE + DATA0").ast;
        const c = generateCFunction(ast, { parameters: ["RESET_N", "ENABLE", "DATA0"] });
        expect(c).toContain("RESET_N");
        expect(c).toContain("ENABLE");
        expect(c).toContain("DATA0");
    });
});

describe("E5: merged-identifier detection", () => {
    it("suggests explicit AND when known variables are merged", () => {
        try {
            parseExpression("AB + C", ["A", "B", "C"]);
            expect.fail("expected an error");
        } catch (e) {
            expect((e as Error).message).toContain("Unknown variable 'AB'");
            expect((e as Error).message).toContain("A·B");
        }
    });
});
