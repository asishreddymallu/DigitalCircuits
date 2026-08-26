/**
 * Gate geometry (pin coordinates) and per-gate SVG rendering.
 *
 * Every gate exposes inX/inY/outX/outY so the router can attach wires at
 * exact pin locations; multi-input pins are distributed vertically by
 * getMultiInputY.
 */

import type { CircuitNode, GateType } from "./circuitGraph";
import type { LayoutPosition } from "./layout";

export interface GateInfo {
    width: number;
    height: number;
    inX: (x: number, y: number, index: number, count: number) => number;
    inY: (x: number, y: number, index: number, count: number) => number;
    outX: (x: number) => number;
    outY: (x: number, y: number) => number;
}

export function getMultiInputY(y: number, h: number, i: number, count: number): number {
    if (count <= 1) return y + h / 2;
    const margin = 10;
    const available = h - 2 * margin;
    const step = available / (count - 1);
    return y + margin + i * step;
}

export function getGateInfo(node: CircuitNode): GateInfo {
    switch (node.type as GateType) {
        case "INPUT":
        case "CONST":
            return {
                width: 90, height: 52,
                inX: (x) => x, inY: (_, y) => y + 26,
                outX: (x) => x + 90, outY: (_, y) => y + 26
            };
        case "NOT":
            return {
                width: 74, height: 52,
                inX: (x) => x, inY: (_, y) => y + 26,
                outX: (x) => x + 74, outY: (_, y) => y + 26
            };
        case "AND":
            return {
                width: 76, height: 52,
                inX: (x) => x,
                inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 76, outY: (_, y) => y + 26
            };
        case "NAND":
            return {
                width: 93, height: 52,
                inX: (x) => x,
                inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 93, outY: (_, y) => y + 26
            };
        case "OR":
            return {
                width: 86, height: 52,
                // OR inputs sit on a curved back edge; pins inset toward the
                // center line proportionally to their vertical offset.
                inX: (x, y, i, count) => {
                    const inputY = getMultiInputY(y, 52, i, count);
                    const dy = Math.abs(inputY - (y + 26));
                    return x + Math.max(0, 18 * (1 - dy / 26));
                },
                inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 86, outY: (_, y) => y + 26
            };
        case "NOR":
            return {
                width: 100, height: 52,
                inX: (x, y, i, count) => {
                    const inputY = getMultiInputY(y, 52, i, count);
                    const dy = Math.abs(inputY - (y + 26));
                    return x + Math.max(0, 18 * (1 - dy / 26));
                },
                inY: (_x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 100, outY: (_, y) => y + 26
            };
    }
}

/** SVG body for one gate (or I/O block). Colors come from CSS variables so
 *  dark/light themes apply without JS knowledge of the palette. */
export function renderGateSVG(node: CircuitNode, pos: LayoutPosition): string {
    const x = pos.x;
    const y = pos.y;
    const centerY = y + 26;

    if (node.type === "INPUT" || node.type === "CONST") {
        // INPUT blocks are interactive probe pins (click to toggle).
        return `
            <g class="circuit-gate-group pin-interactive" data-node-id="${node.id}" data-var="${node.label}">
                <rect x="${x}" y="${y}" width="90" height="52" rx="10" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2" />
                <text x="${x + 45}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="15" fill="var(--text-primary)">${escapeSvgText(node.label)}</text>
            </g>
        `;
    }

    if (node.type === "NOT") {
        return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <polygon points="${x},${y} ${x + 60},${centerY} ${x},${y + 52}" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <circle cx="${x + 67}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 20}" y="${centerY + 5}" font-weight="800" font-size="12" fill="var(--text-primary)">NOT</text>
            </g>
        `;
    }

    if (node.type === "AND") {
        return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">AND</text>
            </g>
        `;
    }
    if (node.type === "NAND") {
        return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <circle cx="${x + 86}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">NAND</text>
            </g>
        `;
    }
    if (node.type === "OR") {
        return `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">OR</text>
            </g>
        `;
    }
    // NOR
    return `
        <g class="circuit-gate-group" data-node-id="${node.id}">
            <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
            <circle cx="${x + 93}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
            <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">NOR</text>
        </g>
    `;
}

/** Labels are generated identifiers or NOT-titles — escape defensively since
 *  they are interpolated into markup. */
function escapeSvgText(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
