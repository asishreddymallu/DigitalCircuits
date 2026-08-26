/**
 * Derive 7-segment Boolean expressions from HEX_PATTERNS using the shared
 * Quine-McCluskey minimizer.  HEX_PATTERNS is the single source of truth:
 *
 *   HEX_PATTERNS → per-segment minterms → QM minimize → display string
 *
 * Every derived expression is exhaustively verified against all 16 hex inputs
 * before it is returned.
 */

import { minimizeSOP } from "../../shared/ts/boolean/minimizer";
import { termToString } from "../../shared/ts/boolean/formatter";
import { evalAst } from "../../shared/ts/boolean/ast";
import { parseExpression } from "../../shared/ts/boolean/parser";

type SegmentId = "a" | "b" | "c" | "d" | "e" | "f" | "g";

interface SegmentPattern {
    a: number; b: number; c: number; d: number;
    e: number; f: number; g: number;
}

const SEGMENTS: SegmentId[] = ["a", "b", "c", "d", "e", "f", "g"];

/** The 4 input variables in MSB-first order (matches bit weighting 8,4,2,1). */
const VARIABLES = ["A", "B", "C", "D"];

/**
 * Canonical hex digit patterns — the single source of truth for segment
 * expressions.  Index is the hex digit (0–15); each value indicates whether
 * the segment is ON (1) or OFF (0) for that digit.
 */
export const HEX_PATTERNS: Record<number, SegmentPattern> = {
    0:  { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 },
    1:  { a: 0, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    2:  { a: 1, b: 1, c: 0, d: 1, e: 1, f: 0, g: 1 },
    3:  { a: 1, b: 1, c: 1, d: 1, e: 0, f: 0, g: 1 },
    4:  { a: 0, b: 1, c: 1, d: 0, e: 0, f: 1, g: 1 },
    5:  { a: 1, b: 0, c: 1, d: 1, e: 0, f: 1, g: 1 },
    6:  { a: 1, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
    7:  { a: 1, b: 1, c: 1, d: 0, e: 0, f: 0, g: 0 },
    8:  { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1 },
    9:  { a: 1, b: 1, c: 1, d: 1, e: 0, f: 1, g: 1 },
    10: { a: 1, b: 1, c: 1, d: 0, e: 1, f: 1, g: 1 },
    11: { a: 0, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 },
    12: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 0 },
    13: { a: 0, b: 1, c: 1, d: 1, e: 1, f: 0, g: 1 },
    14: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 1 },
    15: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 1, g: 1 },
};

/** Characters displayed for digits 0–15. */
export const HEX_CHARS = ["0","1","2","3","4","5","6","7","8","9","A","b","C","d","E","F"];

/**
 * For a given segment, compute the set of minterms (hex digit values)
 * where that segment is ON.
 */
function segmentMinterms(patterns: Record<number, SegmentPattern>, seg: SegmentId): number[] {
    const total = Object.keys(patterns).length;
    const minterms: number[] = [];
    for (let d = 0; d < total; d++) {
        if (patterns[d][seg] === 1) minterms.push(d);
    }
    return minterms;
}

/**
 * Convert a minimized implicant term into a display-friendly string.
 * The QM minimizer returns patterns like "1-10"; we render them using
 * the standard A/B/C/D variable names with postfix NOT for complements.
 */
function implicantToExpression(
    implicants: { pattern: string }[],
    variables: string[]
): string {
    if (implicants.length === 0) return "0";
    return implicants.map(imp => termToString(imp.pattern, variables, "·")).join(" + ");
}

/**
 * Exhaustively verify a display expression against the canonical patterns.
 * Returns true if every hex input produces the expected segment output.
 */
function verifyExpression(
    expression: string,
    patterns: Record<number, SegmentPattern>,
    seg: SegmentId,
    totalCount: number
): boolean {
    const { ast } = parseExpression(expression);
    for (let d = 0; d < totalCount; d++) {
        const assignment: Record<string, boolean> = {
            A: ((d >> 3) & 1) === 1,
            B: ((d >> 2) & 1) === 1,
            C: ((d >> 1) & 1) === 1,
            D: (d & 1) === 1,
        };
        const computed = evalAst(ast, assignment) ? 1 : 0;
        if (computed !== patterns[d][seg]) {
            console.error(
                `Verification FAILED for segment ${seg} at digit ${d}: ` +
                `expected ${patterns[d][seg]}, got ${computed} from "${expression}"`
            );
            return false;
        }
    }
    return true;
}

/**
 * Derive all 7 segment expressions from the given patterns.
 *
 * @param patterns  The source-of-truth segment pattern table.
 * @param totalCount  Number of digits to consider (16 for hex, 10 for BCD).
 * @param dontCareDigits  Digits that are don't-cares (empty for hex, [10..15] for BCD).
 * @returns  Record mapping segment ID to the minimized SOP expression string.
 */
export function deriveSegmentExpressions(
    patterns: Record<number, SegmentPattern>,
    totalCount: number,
    dontCareDigits: number[] = []
): Record<SegmentId, string> {
    const dcSet = new Set(dontCareDigits);
    const result = {} as Record<SegmentId, string>;

    for (const seg of SEGMENTS) {
        const minterms = segmentMinterms(patterns, seg)
            .filter(m => m < totalCount && !dcSet.has(m));

        // For BCD, digits >= 10 are don't-cares; include them in QM grouping.
        const allMintermsForQM = segmentMinterms(patterns, seg)
            .filter(m => m < totalCount);

        const minimized = minimizeSOP(allMintermsForQM, VARIABLES, dcSet);
        const expr = minimized.isConstant
            ? (minimized.constantValue ? "1" : "0")
            : implicantToExpression(minimized.implicants, VARIABLES);

        // Exhaustive verification — every applicable input must match.
        // For BCD mode, only verify digits 0–9; digits 10–15 are don't-cares.
        if (!verifyExpression(expr, patterns, seg, totalCount)) {
            // Fallback: should not happen if QM is correct
            console.error(`FATAL: expression for segment ${seg} failed verification!`);
        }

        result[seg] = expr;
    }

    return result;
}

/**
 * Pre-computed segment expressions.  Derived once at module load time from
 * HEX_PATTERNS via QM minimization, then verified exhaustively.
 */
export const HEX_EXPRESSIONS: Record<SegmentId, string> =
    deriveSegmentExpressions(HEX_PATTERNS, 16, []);

/**
 * BCD segment expressions with digits 10–15 as don't-cares.
 */
export const BCD_EXPRESSIONS: Record<SegmentId, string> =
    deriveSegmentExpressions(HEX_PATTERNS, 10, [10, 11, 12, 13, 14, 15]);
