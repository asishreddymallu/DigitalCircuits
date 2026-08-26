import { describe, it, expect } from "vitest";
import { generateVerilogModule } from "../../shared/ts/exporters/verilog";
import { generateCFunction } from "../../shared/ts/exporters/c";
import { generateLatex } from "../../shared/ts/exporters/latex";
import { minimizeSOP, sopAstFromImplicants } from "../../shared/ts/boolean/minimizer";
import { parseExpression } from "../../shared/ts/boolean/parser";
import { evalAst } from "../../shared/ts/boolean/ast";
import { evaluateVerilogExpr, evaluateCExpr, mulberry32, randomMinterms } from "./helpers";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

function extractCReturn(code: string): string {
    const match = code.match(/return\s+([^;]+);/);
    if (!match) throw new Error("Generated C has no return statement:\n" + code);
    return match[1];
}

function extractVerilogAssign(code: string): string {
    const match = code.match(/assign\s+\w+\s*=\s*([^;]+);/);
    if (!match) throw new Error("Generated Verilog has no assign statement:\n" + code);
    return match[1];
}

describe("exporters: exact output shapes", () => {
    // Note: since E5, juxtaposed letters lex as one identifier ("BC" = the
    // variable BC), so products in these fixtures use explicit separators.
    it("emits fully parenthesized Verilog with explicit &", () => {
        const ast = parseExpression("A'B + B·C").ast;
        const verilog = generateVerilogModule(ast, { inputs: ["A", "B", "C"] });
        expect(verilog).toContain("((~A) & B) | (B & C)");
        expect(verilog).not.toMatch(/\)\s*[A-Za-z]/); // no juxtaposition
    });

    it("emits C with && || and !", () => {
        const ast = parseExpression("A'B + B·C").ast;
        const c = generateCFunction(ast, { parameters: ["A", "B", "C"] });
        // ! binds tighter than && in C, so "(!A && B)" is correct.
        expect(c).toContain("(!A && B) || (B && C)");
        expect(c).not.toMatch(/\)\s*[A-Za-z]/);
    });

    it("renders LaTeX with overline and cdot", () => {
        const ast = parseExpression("A'B + B·C").ast;
        expect(generateLatex(ast)).toBe("$$F = \\overline{A} \\cdot B + B \\cdot C$$");
    });

    it("exports constants correctly", () => {
        expect(extractVerilogAssign(generateVerilogModule(parseExpression("0").ast))).toBe(" 1'b0".trim());
        expect(extractCExprText(generateCFunction(parseExpression("1").ast, { parameters: [] }))).toBe("true");
    });

    function extractCExprText(code: string): string { return extractCReturn(code); }

    it("uses 1'b constants in Verilog", () => {
        const v = generateVerilogModule(parseExpression("A · 1").ast, { inputs: ["A"] });
        expect(v).toContain("(A & 1'b1)");
    });
});

describe("exporters: logical equivalence with original truth table", () => {
    // The exported Verilog and C must reproduce the ORIGINAL function's
    // truth table exactly — checked with independent mini-evaluators.
    const rand = mulberry32(999);

    for (const n of [2, 3, 4]) {
        it(`random minimized functions (n=${n}) export equivalently`, () => {
            for (let trial = 0; trial < 40; trial++) {
                const minterms = randomMinterms(rand, n, [0.2, 0.4, 0.6][trial % 3]);
                const vars = LETTERS.slice(0, n);
                const min = minimizeSOP(minterms, vars);

                // Expected output per row.
                const expected = (i: number): boolean => minterms.includes(i);
                if (min.isConstant) {
                    for (let i = 0; i < (1 << n); i++) expect(expected(i)).toBe(min.constantValue!);
                    continue;
                }
                const ast = sopAstFromImplicants(min.implicants, vars);

                const verilogExpr = extractVerilogAssign(generateVerilogModule(ast, { inputs: vars }));
                const cExpr = extractCReturn(generateCFunction(ast, { parameters: vars }));

                for (let i = 0; i < (1 << n); i++) {
                    const env: Record<string, boolean> = {};
                    vars.forEach((v, idx) => { env[v] = ((i >> (n - 1 - idx)) & 1) === 1; });
                    expect(evaluateVerilogExpr(verilogExpr, env)).toBe(expected(i));
                    expect(evaluateCExpr(cExpr, env)).toBe(expected(i));
                    expect(evalAst(ast, env)).toBe(expected(i));
                }
            }
        });
    }

    it("multi-character identifiers survive export and re-evaluation", () => {
        const ast = parseExpression("RESET_N' · ENABLE + DATA0").ast;
        const inputs = ["RESET_N", "ENABLE", "DATA0"];
        const verilogExpr = extractVerilogAssign(generateVerilogModule(ast, { inputs }));
        const cExpr = extractCReturn(generateCFunction(ast, { parameters: inputs }));

        for (let i = 0; i < 8; i++) {
            const env: Record<string, boolean> = {};
            inputs.forEach((v, idx) => { env[v] = ((i >> (2 - idx)) & 1) === 1; });
            const expected = evalAst(ast, env);
            expect(evaluateVerilogExpr(verilogExpr, env)).toBe(expected);
            expect(evaluateCExpr(cExpr, env)).toBe(expected);
        }
    });

    it("XOR exports to ^ in Verilog and != in C", () => {
        const ast = parseExpression("A ^ B").ast;
        expect(extractVerilogAssign(generateVerilogModule(ast, { inputs: ["A", "B"] }))).toBe("(A ^ B)");
        expect(extractCReturn(generateCFunction(ast, { parameters: ["A", "B"] }))).toBe("(A != B)");
    });
});
