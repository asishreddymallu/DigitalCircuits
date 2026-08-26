/**
 * SVG gate and wire rendering helpers for Web2 combinational circuits.
 *
 * These functions return SVG markup strings. They are used inside the
 * renderSchematic closures of each CircuitDefinition.
 */

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

export function gateXOR(x: number, y: number, label = "XOR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 6 0 Q 18 20 6 40 Q 36 40 60 20 Q 36 0 6 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <path d="M -2 0 Q 10 20 -2 40" fill="none" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="26" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

export function gateAND(x: number, y: number, label = "AND"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 h 30 a 20 20 0 0 1 0 40 h -30 z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="22" y="25" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

export function gateOR(x: number, y: number, label = "OR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 Q 14 20 0 40 Q 32 40 56 20 Q 32 0 0 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="24" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

export function gateNOT(x: number, y: number): string {
    return `
        <g transform="translate(${x}, ${y})">
            <polygon points="0,0 26,12 0,24" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="31" cy="12" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
        </g>
    `;
}

export function gateNAND(x: number, y: number, label = "NAND"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 h 30 a 20 20 0 0 1 0 40 h -30 z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="55" cy="20" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="20" y="25" text-anchor="middle" font-size="10" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

export function gateNOR(x: number, y: number, label = "NOR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 Q 14 20 0 40 Q 32 40 56 20 Q 32 0 0 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="61" cy="20" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="22" y="24" text-anchor="middle" font-size="10" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

export function gateXNOR(x: number, y: number, label = "XNOR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 6 0 Q 18 20 6 40 Q 36 40 60 20 Q 36 0 6 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <path d="M -2 0 Q 10 20 -2 40" fill="none" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="65" cy="20" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="24" y="24" text-anchor="middle" font-size="10" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}
