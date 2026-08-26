/**
 * Wire routing and full schematic rendering.
 *
 * Routing strategy ("channel" routing with zero overlaps):
 *   - Edges are grouped by the level gap they cross, then by source node.
 *   - Each source gets a dedicated vertical bus inside the gap; horizontal
 *     leads run from the output pin to the bus, branches run from the bus to
 *     each input pin.
 *   - Wherever a horizontal segment would cross another source's vertical
 *     bus, a small semicircular "hop" arc is drawn so crossings never look
 *     like junctions.
 */

import type { CircuitGraph } from "./circuitGraph";
import { getGateInfo } from "./gates";
import { CircuitLayout, calculateCircuitLayout } from "./layout";
import { renderGateSVG } from "./gates";

interface Edge {
    sourceId: string;
    targetId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    sourceLevel: number;
    targetLevel: number;
}

interface SourceGroup {
    id: string;
    edges: Edge[];
    x1: number;
    y1: number;
}

/** Horizontal path from (x1,y) to (x2,y) hopping over every x in crossXs. */
function formatHopPathH(x1: number, x2: number, y: number, crossXs: number[]): string {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const isLtoR = x1 <= x2;
    const valid = crossXs.filter(cx => cx > minX + 8 && cx < maxX - 8).sort((a, b) => isLtoR ? a - b : b - a);
    if (valid.length === 0) {
        return `M ${x1} ${y} H ${x2}`;
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
    return d;
}

export function renderEdgesSVG(graph: CircuitGraph, layout: CircuitLayout): string {
    let svg = "";
    const { positions, levels } = layout;

    // One edge per (source → target) pair even when a gate fans the same
    // signal to several inputs; pin positions are averaged for the endpoint.
    const edges: Edge[] = [];
    graph.nodes.forEach(targetNode => {
        const seen = new Map<string, number[]>();
        targetNode.inputs.forEach((sourceId, inputIndex) => {
            if (!seen.has(sourceId)) seen.set(sourceId, []);
            seen.get(sourceId)!.push(inputIndex);
        });

        seen.forEach((indices, sourceId) => {
            const sourceNode = graph.nodes.find(n => n.id === sourceId);
            const sourcePos = positions.get(sourceId);
            const targetPos = positions.get(targetNode.id);
            if (!sourceNode || !sourcePos || !targetPos) return;

            const sourceInfo = getGateInfo(sourceNode);
            const targetInfo = getGateInfo(targetNode);

            const x1 = sourceInfo.outX(sourcePos.x);
            const y1 = sourceInfo.outY(sourcePos.x, sourcePos.y);

            let sumY2 = 0;
            let sumX2 = 0;
            indices.forEach(i => {
                sumX2 += targetInfo.inX(targetPos.x, targetPos.y, i, targetNode.inputs.length);
                sumY2 += targetInfo.inY(targetPos.x, targetPos.y, i, targetNode.inputs.length);
            });

            edges.push({
                sourceId,
                targetId: targetNode.id,
                x1, y1,
                x2: sumX2 / indices.length,
                y2: sumY2 / indices.length,
                sourceLevel: levels.get(sourceId)!,
                targetLevel: levels.get(targetNode.id)!
            });
        });
    });

    const gapGroups = new Map<string, Edge[]>();
    edges.forEach(edge => {
        const key = `${edge.sourceLevel}->${edge.targetLevel}`;
        if (!gapGroups.has(key)) gapGroups.set(key, []);
        gapGroups.get(key)!.push(edge);
    });

    gapGroups.forEach((groupEdges) => {
        const sourceMap = new Map<string, Edge[]>();
        groupEdges.forEach(edge => {
            if (!sourceMap.has(edge.sourceId)) sourceMap.set(edge.sourceId, []);
            sourceMap.get(edge.sourceId)!.push(edge);
        });

        const sources = Array.from(sourceMap.entries()).map(([id, sEdges]) => ({
            id,
            edges: sEdges,
            x1: sEdges[0].x1,
            y1: sEdges[0].y1
        }));

        sources.sort((a, b) => a.y1 - b.y1);

        const maxSourceX = Math.max(...sources.map(s => s.x1));
        const minTargetX = Math.min(...sources.flatMap(s => s.edges.map(e => e.x2)));

        // Vertical buses are distributed in the channel between the levels.
        let gapStart = maxSourceX + 16;
        let gapEnd = minTargetX - 16;
        if (gapEnd - gapStart < 35) {
            const mid = (maxSourceX + minTargetX) / 2;
            gapStart = mid - 22;
            gapEnd = mid + 22;
        }
        const available = Math.max(35, gapEnd - gapStart);
        const effectiveStep = available / (sources.length + 1);

        // Pre-compute every bus that other wires may need to hop over.
        const vBuses: { busX: number; minY: number; maxY: number; sourceId: string }[] = [];
        sources.forEach((source, idx) => {
            const { y1, edges: sEdges } = source;
            const flatSingle = sEdges.length === 1 && Math.abs(y1 - sEdges[0].y2) < 1.5;
            if (!flatSingle) {
                const allY = [y1, ...sEdges.map(e => e.y2)];
                vBuses.push({
                    busX: gapStart + (idx + 1) * effectiveStep,
                    minY: Math.min(...allY),
                    maxY: Math.max(...allY),
                    sourceId: source.id
                });
            }
        });

        sources.forEach((source, idx) => {
            const busEntry = vBuses.find(v => v.sourceId === source.id);
            const busX = busEntry ? busEntry.busX : (gapStart + (idx + 1) * effectiveStep);
            const { id: srcId, x1, y1, edges: sEdges } = source;

            const getCrossings = (hX1: number, hX2: number, hY: number) =>
                vBuses
                    .filter(v => v.sourceId !== srcId && v.busX > Math.min(hX1, hX2) + 6 &&
                        v.busX < Math.max(hX1, hX2) - 6 && v.minY <= hY && hY <= v.maxY)
                    .map(v => v.busX);

            if (sEdges.length === 1) {
                const { x2, y2 } = sEdges[0];
                if (Math.abs(y1 - y2) < 1.5) {
                    const d = formatHopPathH(x1, x2, y1, getCrossings(x1, x2, y1));
                    svg += wirePath(d, srcId);
                } else {
                    // Z-shaped route: lead → bus → drop/rise → branch.
                    const d1 = formatHopPathH(x1, busX, y1, getCrossings(x1, busX, y1));
                    const d3 = formatHopPathH(busX, x2, y2, getCrossings(busX, x2, y2));
                    svg += wirePath(`${d1} V ${y2} ${d3.replace(`M ${busX} ${y2}`, "")}`, srcId);
                }
            } else {
                // Fan-out: lead to bus, trunk spanning all branch heights,
                // then one branch per destination with junction dots.
                const allY = [y1, ...sEdges.map(e => e.y2)];
                const minY = Math.min(...allY);
                const maxY = Math.max(...allY);

                svg += wirePath(formatHopPathH(x1, busX, y1, getCrossings(x1, busX, y1)), srcId);
                svg += wirePath(`M ${busX} ${minY} V ${maxY}`, srcId);
                svg += `<circle cx="${busX}" cy="${y1}" r="3.8" class="circuit-junction" data-source-id="${srcId}" fill="var(--wire-low)" />`;

                sEdges.forEach(edge => {
                    svg += wirePath(formatHopPathH(busX, edge.x2, edge.y2, getCrossings(busX, edge.x2, edge.y2)), srcId);
                    if (Math.abs(edge.y2 - y1) > 1) {
                        svg += `<circle cx="${busX}" cy="${edge.y2}" r="3.8" class="circuit-junction" data-source-id="${srcId}" fill="var(--wire-low)" />`;
                    }
                });
            }
        });
    });

    return svg;
}

function wirePath(d: string, sourceId: string): string {
    return `<path d="${d}" class="circuit-wire" data-source-id="${sourceId}" stroke="var(--wire-low)" stroke-width="2.2" fill="none" />`;
}

export interface RenderCircuitOptions {
    /** Called when an INPUT pin block is clicked (live probe toggle). */
    onPinToggle?: (variable: string) => void;
}

export function renderCircuit(
    graph: CircuitGraph,
    container: HTMLElement,
    options: RenderCircuitOptions = {}
): void {
    container.innerHTML = "";
    if (!graph || !graph.output) return;

    const layout = calculateCircuitLayout(graph);

    let svg = `
        <svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg"
             width="${layout.width}" height="${layout.height}"
             viewBox="0 0 ${layout.width} ${layout.height}">
    `;

    svg += renderEdgesSVG(graph, layout);

    graph.nodes.forEach(node => {
        svg += renderGateSVG(node, layout.positions.get(node.id)!);
    });

    const outputNode = graph.nodes.find(node => node.id === graph.output)!;
    const outputPos = layout.positions.get(graph.output)!;
    const outputInfo = getGateInfo(outputNode);

    const outX = outputInfo.outX(outputPos.x);
    const outY = outputInfo.outY(outputPos.x, outputPos.y);

    svg += `
        <path d="M ${outX} ${outY} H ${outX + 60}" class="circuit-wire output-wire" data-source-id="${graph.output}" stroke="var(--wire-low)" stroke-width="2" fill="none" />
        <g class="output-label-group">
            <circle cx="${outX + 65}" cy="${outY}" r="15" fill="var(--bg-card-alt)" stroke="var(--border-color)" stroke-width="2" />
            <text x="${outX + 65}" y="${outY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)" class="output-indicator-text">F</text>
        </g>
    `;

    svg += "</svg>";
    container.innerHTML = svg;

    container.querySelectorAll(".pin-interactive").forEach(group => {
        group.addEventListener("click", () => {
            const varName = group.getAttribute("data-var");
            if (varName && options.onPinToggle) options.onPinToggle(varName);
        });
    });
}
