import { describe, it, expect } from "vitest";
import { parseExpression, ParsedExpression } from "../../shared/ts/boolean/parser";
import { BooleanParseError } from "../../shared/ts/boolean/tokenizer";
import { evalAst } from "../../shared/ts/boolean/ast";

function parse(src: string): ParsedExpression {
    return parseExpression(src);
}

describe("parser: basic forms", () => {
    it("parses a single variable", () => {
        expect(parse("A").variables).toEqual(["A"]);
    });

    it("uppercases identifiers", () => {
        expect(parse("enable").variables).toEqual(["ENABLE"]);
    });

    it("parses implicit AND of parenthesized groups", () => {
        const { ast } = parse("(A+B)(A'+C)");
        const env = { A: false, B: true, C: true };
        // (0+1)(1+1) = 1
        expect(evalAst(ast, env)).toBe(true);
    });

    it("binds AND tighter than XOR, XOR tighter than OR", () => {
        // With A=B=C=D=1:
        //   correct tree:  A + (B ^ (C·D)) = 1 + (1^1) = 1
        //   wrong tree  :  ((A + B) ^ C) · D = ((1+1)^1)·1 = 0
        const { ast } = parse("A + B ^ C·D");
        expect(evalAst(ast, { A: true, B: true, C: true, D: true })).toBe(true);
    });

    it("handles prefix NOT applied to a postfix-complemented variable", () => {
        // !A' == NOT(NOT(A)) == A ; then ANDed with B.
        expect(evalAst(parse("!A'B").ast, { A: true, B: true })).toBe(true);
        expect(evalAst(parse("!A'B").ast, { A: false, B: true })).toBe(false);
    });

    it("supports unicode operators", () => {
        expect(evalAst(parse("¬A ∧ B ∨ C").ast, { A: true, B: false, C: false })).toBe(false);
        expect(evalAst(parse("A ⊕ B").ast, { A: true, B: true })).toBe(false);
    });
});

describe("parser: constants", () => {
    it("accepts lone constants", () => {
        expect(evalAst(parse("0").ast, {})).toBe(false);
        expect(evalAst(parse("1").ast, {})).toBe(true);
    });

    it("folds constants through operations", () => {
        expect(evalAst(parse("A + 0").ast, { A: false })).toBe(false);
        expect(evalAst(parse("A · 1").ast, { A: false })).toBe(false);
        expect(evalAst(parse("A + 1").ast, { A: false })).toBe(true);
        expect(evalAst(parse("A * 0").ast, { A: true })).toBe(false);
    });

    it("supports contradictory and tautological expressions", () => {
        // Explicit separators: with multi-character identifiers, "AB" would
        // lex as a single variable, so products must be written unambiguously.
        const contradiction = parse("A·B'·A'");
        const tautology = parse("(A + A')");
        for (const a of [false, true]) {
            for (const b of [false, true]) {
                expect(evalAst(contradiction.ast, { A: a, B: b })).toBe(false);
                expect(evalAst(tautology.ast, { A: a, B: b })).toBe(true);
            }
        }
    });
});

describe("parser: multi-character identifiers", () => {
    it("treats PIN as one variable", () => {
        const result = parse("PIN");
        expect(result.variables).toEqual(["PIN"]);
    });

    it("supports RESET_N, DATA0 and mixed names in one expression", () => {
        const result = parse("RESET_N' · DATA0 + ENABLE");
        expect(result.variables).toEqual(["DATA0", "ENABLE", "RESET_N"]);
    });

    it("suggests an explicit AND when a merged identifier is unknown", () => {
        try {
            parseExpression("AB + C", ["A", "B", "C"]);
            expect.fail("expected an error");
        } catch (e) {
            expect(e).toBeInstanceOf(BooleanParseError);
            expect((e as Error).message).toContain("Unknown variable 'AB'");
            expect((e as Error).message).toContain("A·B");
        }
    });
});

describe("parser: errors are actionable", () => {
    it("rejects empty input with guidance", () => {
        expect(() => parse("   ")).toThrow(/empty/i);
    });

    it("reports invalid characters with position", () => {
        try {
            parse("A $ B");
            expect.fail();
        } catch (e) {
            const err = e as BooleanParseError;
            expect(err.message).toContain("'$'");
            expect(err.message).toContain("position 3");
            expect(err.position).toBe(2);
        }
    });

    it("reports missing closing parenthesis", () => {
        try {
            parse("(A + B");
            expect.fail();
        } catch (e) {
            expect((e as Error).message).toMatch(/Missing closing '\)'.*position 1/s);
        }
    });

    it("reports trailing tokens", () => {
        try {
            parse("AB)");
            expect.fail();
        } catch (e) {
            // AB is a single identifier; the ')' trails.
            expect((e as Error).message).toMatch(/after the end of the expression/i);
        }
    });

    it("reports stray postfix NOT with no operand", () => {
        try {
            parse("' + A");
            expect.fail();
        } catch (e) {
            expect((e as Error).message).toMatch(/nothing before it/i);
        }
    });

    it("rejects overlong input via limit", () => {
        expect(() => parse("A".repeat(2001))).toThrow(/too long/i);
    });
});
