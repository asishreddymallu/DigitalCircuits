import { describe, it, expect } from "vitest";
import { parseExpression } from "../../shared/ts/boolean/parser";
import { formatAst, termToString, clauseToString } from "../../shared/ts/boolean/formatter";
import { evalAst, firstMismatch } from "../../shared/ts/boolean/ast";
import { mulberry32, randomMinterms, evalAstAtIndex } from "./helpers";
import { sopAstFromImplicants, minimizeSOP } from "../../shared/ts/boolean/minimizer";

const LETTERS = ["A", "B", "C", "D", "E"];

describe("formatter: display conventions", () => {
    it("renders postfix NOT without parens on atoms", () => {
        expect(formatAst(parseExpression("!A").ast)).toBe("A'");
    });

    it("parenthesizes compound NOT operands", () => {
        expect(formatAst(parseExpression("!(A + B)").ast)).toBe("(A + B)'");
    });

    it("separates adjacent identifier literals so output re-parses identically", () => {
        // "BC" would lex as the single variable BC under the E5 grammar, so
        // the formatter guarantees round-trip fidelity with explicit '·'.
        const ast = parseExpression("A·B'·C").ast;
        expect(formatAst(ast, { andSymbol: "" })).toBe("A·B'C");
    });

    it("auto-inserts · between adjacent identifier boundaries", () => {
        // PIN·ENABLE must not render as the single unknown identifier PINENABLE.
        expect(formatAst(parseExpression("PIN · ENABLE").ast, { andSymbol: "" })).toBe("PIN·ENABLE");
        expect(formatAst(parseExpression("ENABLE · DATA0'").ast, { andSymbol: "" })).toBe("ENABLE·DATA0'");
    });

    it("renders constants", () => {
        expect(formatAst(parseExpression("1").ast)).toBe("1");
        expect(formatAst(parseExpression("0").ast)).toBe("0");
    });

    it("renders XOR with ^", () => {
        expect(formatAst(parseExpression("A ^ B").ast)).toBe("A ^ B");
    });
});

describe("formatter: round-trip fidelity", () => {
    // Whatever we display must re-parse to a logically identical function.
    const rand = mulberry32(424242);

    for (const andSymbol of ["", "·"] as const) {
        it(`round-trips random SOP terms (andSymbol='${andSymbol || "juxtaposition"}')`, () => {
            for (let trial = 0; trial < 40; trial++) {
                const n = 2 + (trial % 4); // 2..5 variables
                const minterms = randomMinterms(rand, n, 0.4);
                const vars = LETTERS.slice(0, n);
                const minimized = minimizeSOP(minterms, vars);
                if (minimized.isConstant) continue;

                const renderedTerms = minimized.implicants.map(imp => termToString(imp.pattern, vars, andSymbol));
                const rejoined = renderedTerms.join(" + ");
                const reparsed = parseExpression(rejoined).ast;

                const original = sopAstFromImplicants(minimized.implicants, vars);
                expect(firstMismatch(original, reparsed, vars)).toBe(-1);
            }
        });
    }

    it("multi-character SOP terms round-trip through the parser", () => {
        const vars = ["RESET_N", "ENABLE", "DATA0"];
        const term = termToString("1-0", vars, "");
        // Juxtaposition is ambiguous here, so the formatter must insert '·'.
        expect(term).toBe("RESET_N·DATA0'");
        const reparsed = parseExpression(term, vars);
        expect(reparsed.variables).toEqual(["DATA0", "RESET_N"]);
        // Pattern 1-0 covers 100 and 110 only.
        expect(evalAstAtIndex(reparsed.ast, vars, 4)).toBe(true);
        expect(evalAstAtIndex(reparsed.ast, vars, 6)).toBe(true);
        expect(evalAstAtIndex(reparsed.ast, vars, 7)).toBe(false);
        expect(evalAstAtIndex(reparsed.ast, vars, 0)).toBe(false);
    });

    it("POS clauses render with complement convention", () => {
        // Clause convention: pattern '0' → plain variable, '1' → complemented.
        expect(clauseToString("01-", ["A", "B", "C"])).toBe("(A + B')");
        expect(clauseToString("-1-", ["A", "B", "C"])).toBe("B'");
        expect(clauseToString("---", ["A", "B", "C"])).toBe("0");
    });
});
