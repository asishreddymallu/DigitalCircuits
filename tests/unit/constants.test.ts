/**
 * E3: Constant expression tests.
 *
 * The Boolean language must correctly handle constants 0 and 1 through
 * the full pipeline: parse → evaluate → minimize → verify → export.
 */

import { describe, it, expect } from "vitest";
import { parseExpression } from "../../shared/ts/boolean/parser";
import { evalAst, firstMismatch } from "../../shared/ts/boolean/ast";
import { minimizeSOP, minimizePOS, sopAstFromImplicants } from "../../shared/ts/boolean/minimizer";
import { formatAst } from "../../shared/ts/boolean/formatter";
import { generateVerilogModule } from "../../shared/ts/exporters/verilog";
import { generateCFunction } from "../../shared/ts/exporters/c";

describe("E3: constant 0 and 1 parsing", () => {
    it("parses and evaluates lone '0' as false", () => {
        expect(evalAst(parseExpression("0").ast, {})).toBe(false);
    });

    it("parses and evaluates lone '1' as true", () => {
        expect(evalAst(parseExpression("1").ast, {})).toBe(true);
    });

    it("A + 0 evaluates correctly", () => {
        const ast = parseExpression("A + 0").ast;
        expect(evalAst(ast, { A: false })).toBe(false);
        expect(evalAst(ast, { A: true })).toBe(true);
    });

    it("A · 1 evaluates correctly", () => {
        const ast = parseExpression("A · 1").ast;
        expect(evalAst(ast, { A: false })).toBe(false);
        expect(evalAst(ast, { A: true })).toBe(true);
    });

    it("A + 1 evaluates to constant true", () => {
        const ast = parseExpression("A + 1").ast;
        expect(evalAst(ast, { A: false })).toBe(true);
        expect(evalAst(ast, { A: true })).toBe(true);
    });

    it("A · 0 evaluates to constant false", () => {
        const ast = parseExpression("A · 0").ast;
        expect(evalAst(ast, { A: false })).toBe(false);
        expect(evalAst(ast, { A: true })).toBe(false);
    });
});

describe("E3: constant minimization", () => {
    it("empty minterm set → constant 0", () => {
        const r = minimizeSOP([], ["A", "B"]);
        expect(r.isConstant).toBe(true);
        expect(r.constantValue).toBe(false);
    });

    it("all-minterm set → constant 1 (SOP)", () => {
        const r = minimizeSOP([0, 1, 2, 3], ["A", "B"]);
        expect(r.isConstant).toBe(true);
        expect(r.constantValue).toBe(true);
    });

    it("empty zero set → constant 1 (POS)", () => {
        const r = minimizePOS([], ["A", "B"]);
        expect(r.isConstant).toBe(true);
        expect(r.constantValue).toBe(true);
    });

    it("all-zero set → constant 0 (POS)", () => {
        const r = minimizePOS([0, 1, 2, 3], ["A", "B"]);
        expect(r.isConstant).toBe(true);
        expect(r.constantValue).toBe(false);
    });

    it("constant 0 SOP builds CONST AST", () => {
        const ast = sopAstFromImplicants([], ["A"]);
        expect(ast.kind).toBe("const");
        expect(evalAst(ast, {})).toBe(false);
    });

    it("constant 1 via all-dash pattern", () => {
        const ast = sopAstFromImplicants([{ pattern: "--" }], ["A", "B"]);
        expect(evalAst(ast, { A: true, B: false })).toBe(true);
        expect(evalAst(ast, { A: false, B: false })).toBe(true);
    });
});

describe("E3: constant display formatting", () => {
    it("formats const 0 as '0'", () => {
        expect(formatAst(parseExpression("0").ast)).toBe("0");
    });

    it("formats const 1 as '1'", () => {
        expect(formatAst(parseExpression("1").ast)).toBe("1");
    });
});

describe("E3: constant export", () => {
    it("exports constant 0 to Verilog as 1'b0", () => {
        const v = generateVerilogModule(parseExpression("0").ast);
        expect(v).toContain("1'b0");
    });

    it("exports constant 1 to Verilog as 1'b1", () => {
        const v = generateVerilogModule(parseExpression("1").ast);
        expect(v).toContain("1'b1");
    });

    it("exports constant 0 to C as false", () => {
        const c = generateCFunction(parseExpression("0").ast, { parameters: [] });
        expect(c).toContain("false");
    });

    it("exports constant 1 to C as true", () => {
        const c = generateCFunction(parseExpression("1").ast, { parameters: [] });
        expect(c).toContain("true");
    });
});

describe("E3: tautology and contradiction through parser", () => {
    it("A + A' is a tautology (always true)", () => {
        const ast = parseExpression("A + A'").ast;
        expect(evalAst(ast, { A: false })).toBe(true);
        expect(evalAst(ast, { A: true })).toBe(true);
    });

    it("A · A' is a contradiction (always false)", () => {
        const ast = parseExpression("A · A'").ast;
        expect(evalAst(ast, { A: false })).toBe(false);
        expect(evalAst(ast, { A: true })).toBe(false);
    });
});
