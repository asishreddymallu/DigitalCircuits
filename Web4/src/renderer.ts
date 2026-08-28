/**
 * SVG rendering for the Web4 Digital Logic Playground.
 * Renders gates, wires, ports, and signal values on an SVG canvas.
 */

import type { PlaygroundNode, Wire, PortPosition } from "./types";
import { SOURCE_TYPES, TOGGLEABLE_TYPES } from "../../shared/ts/circuit/gates";

function escSvg(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Render a single gate as SVG. */
export function renderGateSVG(
    node: PlaygroundNode,
    nodeValue: boolean | undefined,
    isSelected: boolean
): string {
    const { x, y, width, height, type, label, rotation } = node;
    const cx = x + width / 2;
    const cy = y + height / 2;

    const strokeColor = isSelected ? "var(--w4-accent, #38bdf8)" : "var(--w4-gate-stroke, #475569)";
    const fillColor = "var(--w4-gate-fill, #1e293b)";
    const textColor = "var(--w4-text, #f8fafc)";

    const transform = rotation ? `transform="rotate(${rotation}, ${cx}, ${cy})"` : "";
    let svg = `<g class="w4-gate" data-node-id="${node.id}" ${transform}>`;

    // Background
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" ry="8"
        fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" class="w4-gate-body"/>`;

    // Gate-specific rendering
    switch (type) {
        case "INPUT":
        case "SWITCH":
        case "CONST":
        case "CLOCK": {
            const val = nodeValue ? 1 : 0;
            const badgeColor = val ? "#10b981" : "#64748b";
            svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${textColor}">${escSvg(label)}</text>`;
            svg += `<rect x="${cx - 12}" y="${cy + 2}" width="24" height="18" rx="4" fill="${badgeColor}"/>`;
            svg += `<text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="12" font-weight="800" fill="white">${val}</text>`;
            break;
        }
        case "OUTPUT":
        case "LED": {
            const val = nodeValue ? 1 : 0;
            const ledColor = val ? "#10b981" : "#374151";
            svg += `<circle cx="${cx}" cy="${cy - 2}" r="14" fill="${ledColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            if (val) svg += `<circle cx="${cx}" cy="${cy - 2}" r="14" fill="${ledColor}" opacity="0.3"/>`;
            svg += `<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="10" font-weight="700" fill="${textColor}">${escSvg(label)}</text>`;
            break;
        }
        case "NOT": {
            // Triangle + bubble
            const tx = x + 12;
            svg += `<polygon points="${tx},${y + 6} ${tx + width - 26},${cy} ${tx},${y + height - 6}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<circle cx="${x + width - 8}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx - 4}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="${textColor}">NOT</text>`;
            break;
        }
        case "AND": {
            svg += `<path d="M ${x + 10} ${y + 6} h ${width / 2 - 10} a ${height / 2 - 6} ${height / 2 - 6} 0 0 1 0 ${height - 12} h ${-(width / 2 - 10)} z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx - 2}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="${textColor}">AND</text>`;
            break;
        }
        case "OR": {
            svg += `<path d="M ${x + 10} ${y + 6} Q ${x + width * 0.35} ${cy} ${x + 10} ${y + height - 6} Q ${x + width * 0.6} ${y + height - 6} ${x + width - 10} ${cy} Q ${x + width * 0.6} ${y + 6} ${x + 10} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx + 2}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="${textColor}">OR</text>`;
            break;
        }
        case "NAND": {
            svg += `<path d="M ${x + 10} ${y + 6} h ${width / 2 - 14} a ${height / 2 - 6} ${height / 2 - 6} 0 0 1 0 ${height - 12} h ${-(width / 2 - 14)} z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<circle cx="${x + width - 10}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx - 4}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${textColor}">NAND</text>`;
            break;
        }
        case "NOR": {
            svg += `<path d="M ${x + 10} ${y + 6} Q ${x + width * 0.3} ${cy} ${x + 10} ${y + height - 6} Q ${x + width * 0.55} ${y + height - 6} ${x + width - 14} ${cy} Q ${x + width * 0.55} ${y + 6} ${x + 10} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<circle cx="${x + width - 7}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx - 2}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${textColor}">NOR</text>`;
            break;
        }
        case "XOR": {
            svg += `<path d="M ${x + 14} ${y + 6} Q ${x + width * 0.35} ${cy} ${x + 14} ${y + height - 6} Q ${x + width * 0.6} ${y + height - 6} ${x + width - 10} ${cy} Q ${x + width * 0.6} ${y + 6} ${x + 14} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<path d="M ${x + 6} ${y + 4} Q ${x + 16} ${cy} ${x + 6} ${y + height - 4}" fill="none" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx + 4}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${textColor}">XOR</text>`;
            break;
        }
        case "XNOR": {
            svg += `<path d="M ${x + 14} ${y + 6} Q ${x + width * 0.3} ${cy} ${x + 14} ${y + height - 6} Q ${x + width * 0.55} ${y + height - 6} ${x + width - 14} ${cy} Q ${x + width * 0.55} ${y + 6} ${x + 14} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<path d="M ${x + 6} ${y + 4} Q ${x + 16} ${cy} ${x + 6} ${y + height - 4}" fill="none" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<circle cx="${x + width - 7}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="${textColor}">XNOR</text>`;
            break;
        }
        case "BUFFER": {
            svg += `<polygon points="${x + 12},${y + 6} ${x + width - 10},${cy} ${x + 12},${y + height - 6}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
            svg += `<text x="${cx - 2}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="${textColor}">BUF</text>`;
            break;
        }
    }

    svg += `</g>`;
    return svg;
}

/** Render input/output ports. */
export function renderPorts(node: PlaygroundNode, nodeValue: boolean | undefined, isSource: boolean): string {
    let svg = "";

    // Render input ports (skip for source nodes — they have no inputs)
    if (!isSource) {
        for (const port of node.inputPorts) {
            const px = node.x + port.x;
            const py = node.y + port.y;
            svg += `<circle cx="${px}" cy="${py}" r="5" class="w4-port w4-port-in" data-node-id="${node.id}" data-port-index="${port.index}" data-port-type="input"
                fill="var(--w4-port-fill, #0f172a)" stroke="var(--w4-port-stroke, #94a3b8)" stroke-width="1.5"/>`;
        }
    }

    // Always render output ports (source nodes need them for wire connections)
    for (const port of node.outputPorts) {
        const px = node.x + port.x;
        const py = node.y + port.y;
        const portColor = nodeValue ? "var(--w4-wire-high, #10b981)" : "var(--w4-port-stroke, #94a3b8)";
        svg += `<circle cx="${px}" cy="${py}" r="5" class="w4-port w4-port-out" data-node-id="${node.id}" data-port-index="${port.index}" data-port-type="output"
            fill="var(--w4-port-fill, #0f172a)" stroke="${portColor}" stroke-width="1.5"/>`;
    }

    return svg;
}

/** Render a wire with orthogonal routing. */
export function renderWire(
    wire: Wire,
    sourceNode: PlaygroundNode,
    targetNode: PlaygroundNode,
    sourcePortIndex: number,
    targetPortIndex: number,
    wireValue: boolean
): string {
    const sp = sourceNode.outputPorts[sourcePortIndex];
    const tp = targetNode.inputPorts[targetPortIndex];
    if (!sp || !tp) return "";

    const sx = sourceNode.x + sp.x;
    const sy = sourceNode.y + sp.y;
    const tx = targetNode.x + tp.x;
    const ty = targetNode.y + tp.y;

    const midX = (sx + tx) / 2;

    // Orthogonal routing: horizontal out, vertical, horizontal in
    const d = `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;

    const wireColor = wireValue ? "var(--w4-wire-high, #10b981)" : "var(--w4-wire-low, #475569)";

    return `<path d="${d}" class="w4-wire" data-wire-id="${wire.id}" data-source="${wire.sourceNodeId}" data-target="${wire.targetNodeId}"
        stroke="${wireColor}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}

/** Render a wire being drawn (in progress). */
export function renderWirePreview(
    sx: number, sy: number, tx: number, ty: number
): string {
    const midX = (sx + tx) / 2;
    const d = `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
    return `<path d="${d}" class="w4-wire-preview" stroke="var(--w4-accent, #38bdf8)" stroke-width="2" fill="none" stroke-dasharray="6,4" stroke-linecap="round" pointer-events="none"/>`;
}

/** Render value labels on wires. */
export function renderWireValues(wires: Wire[], nodes: PlaygroundNode[], wireValues: Map<string, boolean>): string {
    let svg = "";
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const wire of wires) {
        const sourceNode = nodeMap.get(wire.sourceNodeId);
        const targetNode = nodeMap.get(wire.targetNodeId);
        if (!sourceNode || !targetNode) continue;

        const sp = sourceNode.outputPorts[wire.sourcePort];
        const tp = targetNode.inputPorts[wire.targetPort];
        if (!sp || !tp) continue;

        const sx = sourceNode.x + sp.x;
        const sy = sourceNode.y + sp.y;
        const tx = targetNode.x + tp.x;
        const ty = targetNode.y + tp.y;

        const val = wireValues.get(wire.id) ?? false;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;

        // Small value badge on wire midpoint
        svg += `<g class="w4-wire-value" pointer-events="none">
            <rect x="${mx - 7}" y="${my - 8}" width="14" height="14" rx="3" fill="var(--w4-bg, #0f172a)" stroke="var(--w4-wire-low, #475569)" stroke-width="1"/>
            <text x="${mx}" y="${my + 2}" text-anchor="middle" font-size="9" font-weight="800" font-family="JetBrains Mono, monospace" fill="${val ? '#10b981' : '#64748b'}">${val ? '1' : '0'}</text>
        </g>`;
    }
    return svg;
}
