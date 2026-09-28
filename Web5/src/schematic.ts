/**
 * SVG schematic rendering for Web5 Sequential Circuits Simulator.
 *
 * Draws the animated clock source, gate-level flip-flop schematics with
 * live wire coloring, and the per-panel edge-trigger indicator.
 */

import type { FlipFlopKind, PanelState } from "./types";
import { SIGNAL_COLORS } from "./types";

function esc(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Wire color for a boolean signal level. */
function wireColor(v: boolean): string {
    return v ? "var(--w5-signal-1, #10b981)" : "var(--w5-signal-0, #475569)";
}

/* ------------------------------------------------------------------ */
/* Shared primitives                                                   */
/* ------------------------------------------------------------------ */

function wirePath(x1: number, y1: number, x2: number, y2: number, value: boolean, id = ""): string {
    const midX = (x1 + x2) / 2;
    const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
    return `<path d="${d}" ${id ? `data-wire="${id}"` : ""} stroke="${wireColor(value)}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}

function wireStraight(x1: number, y1: number, x2: number, y2: number, value: boolean, id = ""): string {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${id ? `data-wire="${id}"` : ""} stroke="${wireColor(value)}" stroke-width="2" stroke-linecap="round"/>`;
}

function junction(x: number, y: number, value: boolean): string {
    return `<circle cx="${x}" cy="${y}" r="3.2" fill="${wireColor(value)}"/>`;
}

function label(x: number, y: number, text: string, opts?: { anchor?: string; size?: number; color?: string; bold?: boolean }): string {
    return `<text x="${x}" y="${y}" text-anchor="${opts?.anchor ?? "start"}" font-size="${opts?.size ?? 11}"
        font-weight="${opts?.bold === false ? 500 : 700}" font-family="'JetBrains Mono', monospace"
        fill="${opts?.color ?? "var(--w5-text, #f8fafc)"}">${esc(text)}</text>`;
}

function sigBadge(x: number, y: number, v: boolean, size = 18): string {
    const color = v ? "var(--w5-signal-1, #10b981)" : "var(--w5-signal-0, #475569)";
    return `<g pointer-events="none">
        <rect x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" rx="4" fill="var(--w5-bg, #0f172a)" stroke="${color}" stroke-width="1.4"/>
        <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="10.5" font-weight="800"
            font-family="'JetBrains Mono', monospace" fill="${color}">${v ? "1" : "0"}</text>
    </g>`;
}

function gateAND(x: number, y: number, w: number, h: number): string {
    return `<path d="M ${x} ${y} h ${w / 2} a ${h / 2} ${h / 2} 0 0 1 0 ${h} h ${-w / 2} z"
        fill="var(--w5-gate-fill, #1e293b)" stroke="var(--w5-gate-stroke, #94a3b8)" stroke-width="2"/>`;
}

function gateOR(x: number, y: number, w: number, h: number): string {
    return `<path d="M ${x} ${y} Q ${x + w * 0.4} ${y + h / 2} ${x} ${y + h}
        Q ${x + w * 0.66} ${y + h} ${x + w} ${y + h / 2}
        Q ${x + w * 0.66} ${y} ${x} ${y} Z"
        fill="var(--w5-gate-fill, #1e293b)" stroke="var(--w5-gate-stroke, #94a3b8)" stroke-width="2"/>`;
}

function bubble(x: number, y: number): string {
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="var(--w5-gate-fill, #1e293b)" stroke="var(--w5-gate-stroke, #94a3b8)" stroke-width="1.8"/>`;
}

/* ------------------------------------------------------------------ */
/* Clock panel schematic                                               */
/* ------------------------------------------------------------------ */

/** The shared clock source: oscillator block + square-wave glyph. */
export function renderClockSchematic(clk: boolean, highTicks: number, lowTicks: number): string {
    const W = 300;
    const H = 120;
    const midY = H / 2 + 8;

    let svg = `<svg viewBox="0 0 ${W} ${H}" class="w5-schematic-svg" role="img" aria-label="Clock source schematic">`;

    // Oscillator block
    svg += `<rect x="16" y="${midY - 26}" width="86" height="52" rx="10"
        fill="var(--w5-gate-fill, #1e293b)" stroke="${SIGNAL_COLORS.clock}" stroke-width="2"/>`;
    svg += label(59, midY - 4, "CLOCK", { anchor: "middle", size: 12, color: SIGNAL_COLORS.clock });
    svg += label(59, midY + 12, `${highTicks}↑ / ${lowTicks}↓`, { anchor: "middle", size: 9, color: "var(--w5-muted, #94a3b8)" });

    // Output wire
    svg += wireStraight(102, midY, 168, midY, clk);
    svg += sigBadge(138, midY, clk);

    // Square-wave glyph of the current level
    const gx = 176;
    const gy = midY - 16;
    const gw = 108;
    const hh = 12;
    const hl = highTicks;
    const ll = lowTicks;
    const seg = gw / (hl + ll);
    svg += `<path d="M ${gx} ${gy + hh} h ${seg * Math.max(hl, 1)} V ${gy} h ${seg * Math.max(ll, 1)} V ${gy + hh}"
        fill="none" stroke="${SIGNAL_COLORS.clock}" stroke-width="2" opacity="0.8"/>`;
    svg += `</svg>`;
    return svg;
}

/* ------------------------------------------------------------------ */
/* Flip-flop schematics (gate level)                                   */
/* ------------------------------------------------------------------ */

interface FFLayout {
    W: number;
    H: number;
    inX: number;
    inYs: number[];
    outX: number;
    qY: number;
    qnY: number;
}

function ffLayout(inputCount: number): FFLayout {
    const W = 460;
    const H = 190;
    const inYs = inputCount === 1 ? [H / 2 + 10] : [H / 2 - 12, H / 2 + 42];
    return { W, H, inX: 14, inYs, outX: W - 14, qY: H / 2 + 10, qnY: H / 2 + 62 };
}

/**
 * Render the gate-level schematic of a flip-flop panel.
 * All input/output values are live-colored; the CLK edge bubble marks
 * negative-edge triggering.
 */
export function renderFlipFlopSchematic(panel: PanelState, clk: boolean): string {
    const { kind } = panel;
    const L = ffLayout(panel.inputs.length);
    const names = panel.kind === "SR" ? ["S", "R"] : panel.kind === "JK" ? ["J", "K"] : panel.kind === "T" ? ["T"] : ["D"];

    let svg = `<svg viewBox="0 0 ${L.W} ${L.H}" class="w5-schematic-svg" role="img" aria-label="${esc(kind)} flip-flop schematic">`;

    // Input wires + labels + badges
    names.forEach((name, i) => {
        const y = L.inYs[i];
        const v = panel.inputs[i];
        svg += wireStraight(L.inX, y, 96, y, v, `in-${kind}-${i}`);
        svg += label(L.inX + 2, y - 8, name, { size: 12, color: "var(--w5-text, #f8fafc)" });
        svg += sigBadge(L.inX + 34, y - 20, v);
    });

    // Clock input (into the bottom of the body)
    const clkY = L.H - 22;
    svg += wireStraight(L.inX, clkY, 96, clkY, clk, `clk-${kind}`);
    svg += label(L.inX + 2, clkY - 8, "CLK", { size: 10, color: SIGNAL_COLORS.clock });
    svg += sigBadge(L.inX + 34, clkY - 20, clk);

    // Flip-flop body
    svg += `<rect x="96" y="34" width="150" height="${L.H - 58}" rx="10"
        fill="var(--w5-gate-fill, #1e293b)" stroke="${panel.invalid ? "var(--w5-invalid, #ef4444)" : "var(--w5-gate-stroke, #94a3b8)"}"
        stroke-width="${panel.invalid ? 2.4 : 2}"/>`;

    // Negative-edge (bubble + triangle) trigger marker on clock pin
    svg += `<path d="M 88 ${clkY - 5} L 96 ${clkY} L 88 ${clkY + 5} Z" fill="none" stroke="var(--w5-gate-stroke, #94a3b8)" stroke-width="1.6"/>`;
    svg += bubble(84, clkY);
    svg += label(112, clkY + 3, "▾ neg-edge", { size: 8.5, color: "var(--w5-muted, #94a3b8)" });

    // Kind label + characteristic equation
    svg += label(171, 56, `${kind} FF`, { anchor: "middle", size: 13, color: "var(--w5-text, #f8fafc)" });
    const eq = kind === "SR" ? "Q⁺=S+R′Q" : kind === "JK" ? "Q⁺=JQ′+K′Q" : kind === "T" ? "Q⁺=T⊕Q" : "Q⁺=D";
    svg += label(171, 72, eq, { anchor: "middle", size: 9, color: "var(--w5-muted, #94a3b8)" });
    if (panel.invalid) {
        svg += label(171, 88, "INVALID INPUTS", { anchor: "middle", size: 9, color: "var(--w5-invalid, #ef4444)" });
    }

    // Input pins on the body
    names.forEach((name, i) => {
        const y = L.inYs[i];
        svg += wireStraight(96, y, 106, y, panel.inputs[i]);
        svg += label(112, y + 4, name, { size: 10 });
    });

    // Output pins + wires
    svg += wireStraight(246, L.qY, L.outX - 40, L.qY, panel.q, `q-${kind}`);
    svg += label(258, L.qY - 8, "Q", { size: 12, color: SIGNAL_COLORS.output });
    svg += sigBadge(L.outX - 24, L.qY, panel.q, 20);

    svg += wireStraight(246, L.qnY, L.outX - 40, L.qnY, !panel.q, `qn-${kind}`);
    svg += bubble(250, L.qnY);
    svg += label(260, L.qnY - 8, "Q̄", { size: 12, color: "var(--w5-muted, #94a3b8)" });
    svg += sigBadge(L.outX - 24, L.qnY, !panel.q, 20);

    // Active-state hint (what will happen at the next falling edge)
    svg += renderActionHint(panel, L);

    svg += `</svg>`;
    return svg;
}

/** Small text under the body describing the pending next-state action. */
function renderActionHint(panel: PanelState, L: FFLayout): string {
    const names = panel.kind === "SR" ? ["S", "R"] : panel.kind === "JK" ? ["J", "K"] : panel.kind === "T" ? ["T"] : ["D"];
    let action: string;
    if (panel.invalid) {
        action = "S=R=1 forbidden — Q holds";
    } else {
        const [a, b] = panel.inputs;
        switch (panel.kind) {
            case "SR": action = a ? "Set Q=1 at next ↓" : b ? "Reset Q=0 at next ↓" : "Hold at next ↓"; break;
            case "JK": action = a && b ? "Toggle Q at next ↓" : a ? "Set Q=1 at next ↓" : b ? "Reset Q=0 at next ↓" : "Hold at next ↓"; break;
            case "T":  action = a ? "Toggle Q at next ↓" : "Hold at next ↓"; break;
            case "D":  action = `Q⁺ = ${a ? 1 : 0} at next ↓`; break;
        }
    }
    void names;
    return label(L.W - 12, L.H - 10, action, { anchor: "end", size: 10, color: "var(--w5-accent, #38bdf8)" });
}

/* ------------------------------------------------------------------ */
/* Truth/excitation table                                              */
/* ------------------------------------------------------------------ */

/** Render the excitation table as HTML rows (used by the UI). */
export function excitationTableHTML(rows: { inputs: string; action: string }[]): string {
    return rows.map(r => `
        <div class="w5-tt-row">
            <span class="w5-tt-inputs">${esc(r.inputs)}</span>
            <span class="w5-tt-action">${esc(r.action)}</span>
        </div>`).join("");
}
