/**
 * 7-segment display SVG renderer and pattern matching.
 */

import { SEGMENTS, HEX_PATTERNS, HEX_CHARS } from "./types";
import type { SegmentId, SegmentPattern } from "./types";

/** Render a 7-segment display as an SVG string. */
export function render7Segment(pattern: SegmentPattern, isCommonAnode: boolean, size = 180): string {
    const w = size;
    const h = size * 1.7;
    const segLen = w * 0.58;
    const gap = w * 0.06;

    const cx = w / 2;
    const topY = h * 0.08;
    const midY = h * 0.50;
    const botY = h * 0.92;
    const leftX = cx - segLen / 2;
    const rightX = cx + segLen / 2;

    type SegDef = { id: SegmentId; path: string; labelX: number; labelY: number };

    const segDefs: SegDef[] = [
        { id: "a", path: `M ${leftX + gap} ${topY} L ${rightX - gap} ${topY}`, labelX: cx, labelY: topY - 10 },
        { id: "b", path: `M ${rightX} ${topY + gap * 2} L ${rightX} ${midY - gap}`, labelX: rightX + 16, labelY: (topY + midY) / 2 },
        { id: "c", path: `M ${rightX} ${midY + gap} L ${rightX} ${botY - gap * 2}`, labelX: rightX + 16, labelY: (midY + botY) / 2 },
        { id: "d", path: `M ${leftX + gap} ${botY} L ${rightX - gap} ${botY}`, labelX: cx, labelY: botY + 18 },
        { id: "e", path: `M ${leftX} ${midY + gap} L ${leftX} ${botY - gap * 2}`, labelX: leftX - 16, labelY: (midY + botY) / 2 },
        { id: "f", path: `M ${leftX} ${topY + gap * 2} L ${leftX} ${midY - gap}`, labelX: leftX - 16, labelY: (topY + midY) / 2 },
        { id: "g", path: `M ${leftX + gap} ${midY} L ${rightX - gap} ${midY}`, labelX: cx, labelY: midY - 10 },
    ];

    let svg = `<svg class="seg-svg" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="-25 -20 ${w + 50} ${h + 40}">`;

    segDefs.forEach(seg => {
        const isLit = isCommonAnode ? pattern[seg.id] === 0 : pattern[seg.id] === 1;
        const cls = isLit ? "segment-path seg-on" : "segment-path seg-off";

        svg += `
            <g class="segment-group" data-seg="${seg.id}">
                <path d="${seg.path}" class="${cls}" stroke-width="14" stroke-linecap="round" fill="none" />
                <text x="${seg.labelX}" y="${seg.labelY + 4}" text-anchor="middle" font-size="12" font-weight="750" fill="var(--text-muted)">${seg.id}</text>
            </g>
        `;
    });

    // Decimal point (DP).
    svg += `<circle cx="${rightX + 18}" cy="${botY}" r="7" class="segment-path seg-off" stroke-width="0" fill="var(--seg-off)" />`;
    svg += `</svg>`;
    return svg;
}

/**
 * Reverse-decode a segment pattern to find the matching hex digit.
 * Returns a human-readable description string.
 */
export function findMatchingPattern(pat: SegmentPattern, isHexMode: boolean, isCommonAnode: boolean): string {
    const count = isHexMode ? 16 : 10;
    for (let i = 0; i < count; i++) {
        const hexP = HEX_PATTERNS[i];
        let match = true;
        for (const seg of SEGMENTS) {
            const expected = isCommonAnode ? 1 - hexP[seg] : hexP[seg];
            if (pat[seg] !== expected) {
                match = false;
                break;
            }
        }
        if (match) {
            const bin = i.toString(2).padStart(4, "0");
            return `Digit '${HEX_CHARS[i]}' (${bin}) — Hex 0x${i.toString(16).toUpperCase()}`;
        }
    }
    const litSegs = SEGMENTS.filter(s => isCommonAnode ? pat[s] === 0 : pat[s] === 1).join(", ");
    return `Custom Glyph {${litSegs || "none"}}`;
}
