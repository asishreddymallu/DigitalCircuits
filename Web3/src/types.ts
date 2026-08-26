/**
 * Shared type definitions for the Web3 7-segment display simulator.
 */

export type SegmentId = "a" | "b" | "c" | "d" | "e" | "f" | "g";

export interface SegmentPattern {
    a: number; b: number; c: number; d: number;
    e: number; f: number; g: number;
}

export const SEGMENTS: SegmentId[] = ["a", "b", "c", "d", "e", "f", "g"];

/** 16 Hexadecimal segment patterns (0 to F). Canonical source of truth. */
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
    10: { a: 1, b: 1, c: 1, d: 0, e: 1, f: 1, g: 1 }, // A
    11: { a: 0, b: 0, c: 1, d: 1, e: 1, f: 1, g: 1 }, // b
    12: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 0 }, // C
    13: { a: 0, b: 1, c: 1, d: 1, e: 1, f: 0, g: 1 }, // d
    14: { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1, g: 1 }, // E
    15: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 1, g: 1 }, // F
};

/** Display characters for hex digits 0-F. */
export const HEX_CHARS = [
    "0", "1", "2", "3", "4", "5", "6", "7",
    "8", "9", "A", "b", "C", "d", "E", "F",
];

/** BCD minterms (0-9) for K-map display in BCD mode. */
export const BCD_MINTERMS: Record<SegmentId, number[]> = {
    a: [0, 2, 3, 5, 6, 7, 8, 9],
    b: [0, 1, 2, 3, 4, 7, 8, 9],
    c: [0, 1, 3, 4, 5, 6, 7, 8, 9],
    d: [0, 2, 3, 5, 6, 8, 9],
    e: [0, 2, 6, 8],
    f: [0, 4, 5, 6, 8, 9],
    g: [2, 3, 4, 5, 6, 8, 9],
};
