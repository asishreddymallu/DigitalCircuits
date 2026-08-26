/**
 * Exhaustive test for the 7-segment hex/BCD Boolean expressions.
 *
 * For each segment a–g, the derived expression must produce the correct
 * output for every hex input 0–15 (and for BCD, 0–9 with 10–15 as don't-cares).
 *
 * This is the E1 correctness guarantee: HEX_PATTERNS is the single source
 * of truth, QM derives the expression, and this test verifies every input.
 */

import { describe, it, expect } from "vitest";
import {
    HEX_PATTERNS,
    HEX_EXPRESSIONS,
    BCD_EXPRESSIONS,
    HEX_CHARS
} from "../../Web3/src/hexExpressions";
import { parseExpression } from "../../shared/ts/boolean/parser";
import { evalAst } from "../../shared/ts/boolean/ast";

type SegmentId = "a" | "b" | "c" | "d" | "e" | "f" | "g";

const SEGMENTS: SegmentId[] = ["a", "b", "c", "d", "e", "f", "g"];
const VARIABLES = ["A", "B", "C", "D"];

function assignmentFor(digit: number): Record<string, boolean> {
    return {
        A: ((digit >> 3) & 1) === 1,
        B: ((digit >> 2) & 1) === 1,
        C: ((digit >> 1) & 1) === 1,
        D: (digit & 1) === 1,
    };
}

describe("E1: hex segment expressions derived from HEX_PATTERNS", () => {
    for (const seg of SEGMENTS) {
        it(`segment ${seg.toUpperCase()} expression is correct for all 16 hex digits`, () => {
            const expr = HEX_EXPRESSIONS[seg];
            expect(expr).toBeTruthy();
            const { ast } = parseExpression(expr);

            for (let d = 0; d < 16; d++) {
                const computed = evalAst(ast, assignmentFor(d)) ? 1 : 0;
                const expected = HEX_PATTERNS[d][seg];
                expect(computed).toBe(expected);
            }
        });
    }
});

describe("E1: BCD segment expressions derived from HEX_PATTERNS with don't-cares", () => {
    for (const seg of SEGMENTS) {
        it(`BCD segment ${seg.toUpperCase()} expression is correct for digits 0–9`, () => {
            const expr = BCD_EXPRESSIONS[seg];
            expect(expr).toBeTruthy();
            const { ast } = parseExpression(expr);

            for (let d = 0; d <= 9; d++) {
                const computed = evalAst(ast, assignmentFor(d)) ? 1 : 0;
                const expected = HEX_PATTERNS[d][seg];
                expect(computed).toBe(expected);
            }
        });
    }
});

describe("E1: HEX_PATTERNS internal consistency", () => {
    it("has all 16 entries (0–15)", () => {
        for (let d = 0; d < 16; d++) {
            expect(HEX_PATTERNS[d]).toBeDefined();
            expect(HEX_CHARS[d]).toBeDefined();
        }
    });

    it("HEX_CHARS length matches HEX_PATTERNS", () => {
        expect(HEX_CHARS.length).toBe(Object.keys(HEX_PATTERNS).length);
    });

    it("digit 0 shows '0' with segments a–f lit (not g)", () => {
        const p = HEX_PATTERNS[0];
        expect(p.a).toBe(1);
        expect(p.b).toBe(1);
        expect(p.c).toBe(1);
        expect(p.d).toBe(1);
        expect(p.e).toBe(1);
        expect(p.f).toBe(1);
        expect(p.g).toBe(0);
    });

    it("digit 8 shows '8' with all segments lit", () => {
        const p = HEX_PATTERNS[8];
        for (const seg of SEGMENTS) {
            expect(p[seg]).toBe(1);
        }
    });

    it("digit 1 (digit '1') has only segments b and c lit", () => {
        const p = HEX_PATTERNS[1];
        for (const seg of SEGMENTS) {
            expect(p[seg]).toBe(seg === "b" || seg === "c" ? 1 : 0);
        }
    });
});
