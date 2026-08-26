/**
 * SVG wire helpers and decoder circuit diagram renderer for Web3.
 *
 * The decoder schematic shows a BCD/Hex to 7-segment decoder IC with
 * live wire signal coloring, inverter gates, and segment output badges.
 */

import { SEGMENTS } from "./types";
import type { SegmentId, SegmentPattern } from "./types";

/** Horizontal wire with Manhattan jump-hops over crossing wires. */
export function wireHopH(x1: number, x2: number, y: number, crossXs: number[], isHigh: boolean | number): string {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const isLtoR = x1 <= x2;
    const cls = isHigh ? "wire-active" : "wire-inactive";
    const valid = crossXs.filter(cx => cx > minX + 8 && cx < maxX - 8).sort((a, b) => isLtoR ? a - b : b - a);
    if (valid.length === 0) {
        return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="${cls}" stroke-width="2.2" fill="none" />`;
    }
    let d = `M ${x1} ${y}`;
    valid.forEach(cx => {
        if (isLtoR) {
            d += ` H ${cx - 7} A 7 7 0 0 1 ${cx + 7} ${y}`;
        } else {
            d += ` H ${cx + 7} A 7 7 0 0 1 ${cx - 7} ${y}`;
        }
    });
    d += ` H ${x2}`;
    return `<path d="${d}" class="${cls}" stroke-width="2.2" fill="none" />`;
}

/** Vertical wire segment. */
export function wireV(x: number, y1: number, y2: number, isHigh: boolean | number): string {
    const cls = isHigh ? "wire-active" : "wire-inactive";
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="${cls}" stroke-width="2.2" fill="none" />`;
}

/** Junction dot at a wire crossing. */
export function dot(cx: number, cy: number, isHigh: boolean | number): string {
    const col = isHigh ? "var(--wire-high)" : "var(--wire-low)";
    return `<circle cx="${cx}" cy="${cy}" r="3.8" class="circuit-junction" fill="${col}" />`;
}

/**
 * Render the BCD/Hex to 7-segment decoder schematic as SVG.
 *
 * Shows input lines A-D with inverter gates for complemented rails,
 * a decoder IC housing, and 7 segment output badges with live coloring.
 */
export function renderDecoderSchematic(
    currentInput: number,
    segmentValues: SegmentPattern,
    isHexMode: boolean,
    isCommonAnode: boolean,
): string {
    const a = (currentInput >> 3) & 1;
    const b = (currentInput >> 2) & 1;
    const c = (currentInput >> 1) & 1;
    const d = currentInput & 1;

    const notA = 1 - a;
    const notB = 1 - b;
    const notC = 1 - c;
    const notD = 1 - d;

    let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="800" height="380" viewBox="0 0 800 380">`;

    // Main Decoder IC Housing.
    svg += `
        <rect x="250" y="20" width="260" height="340" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-color)" stroke-width="2.2"/>
        <text x="380" y="180" text-anchor="middle" font-size="16" font-weight="800" fill="var(--text-primary)">${isHexMode ? "HEX" : "BCD"} to 7-SEG</text>
        <text x="380" y="205" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-muted)">Decoder Logic Matrix</text>
        <text x="380" y="225" text-anchor="middle" font-size="11" font-weight="600" fill="var(--accent-secondary)">${isCommonAnode ? "Common Anode (Active LOW)" : "Common Cathode (Active HIGH)"}</text>
    `;

    const inY = [60, 130, 200, 270];
    const inNames = ["A (8)", "B (4)", "C (2)", "D (1)"];
    const inVals = [a, b, c, d];
    const inNots = [notA, notB, notC, notD];

    // Inputs, Inverter Gates, and Internal Rails.
    for (let i = 0; i < 4; i++) {
        const yPos = inY[i];
        const val = inVals[i];
        const nVal = inNots[i];

        svg += wireHopH(30, 130, yPos, [], val);
        svg += `<text x="15" y="${yPos + 4}" font-size="13" font-weight="800" fill="var(--text-primary)">${inNames[i]}</text>`;
        svg += dot(100, yPos, val);

        // Tap for direct True rail.
        svg += wireV(100, yPos, yPos + 25, val);
        svg += wireHopH(100, 250, yPos + 25, [], val);

        // Inverter Gate for Complemented rail.
        svg += `
            <g transform="translate(130, ${yPos - 12})">
                <polygon points="0,0 26,12 0,24" fill="var(--bg-card)" stroke="var(--border-hover)" stroke-width="2" />
                <circle cx="31" cy="12" r="4" fill="var(--bg-card)" stroke="var(--border-hover)" stroke-width="2" />
            </g>
        `;
        svg += wireHopH(165, 250, yPos, [], nVal);
    }

    // 7 Segment Outputs.
    const outY = [45, 90, 135, 180, 225, 270, 315];
    for (let i = 0; i < 7; i++) {
        const sId = SEGMENTS[i];
        const val = segmentValues[sId];
        const isLit = isCommonAnode ? val === 0 : val === 1;
        const yPos = outY[i];

        svg += wireHopH(510, 650, yPos, [], isLit);
        svg += dot(510, yPos, isLit);

        // Interactive glowing badge.
        svg += `
            <g transform="translate(660, ${yPos - 13})">
                <rect width="60" height="26" rx="8" fill="var(--bg-card)" stroke="${isLit ? "var(--seg-on)" : "var(--border-color)"}" stroke-width="${isLit ? "2" : "1.2"}"/>
                <text x="30" y="17" text-anchor="middle" font-size="12" font-weight="800" fill="${isLit ? "var(--seg-on)" : "var(--text-muted)"}">seg ${sId} = ${val}</text>
            </g>
        `;
    }

    svg += `</svg>`;
    return svg;
}
