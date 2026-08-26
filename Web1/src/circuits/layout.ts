/**
 * Layered layout: nodes are assigned levels via longest-path from inputs,
 * then each level's nodes are stacked and centered vertically.
 */

import type { CircuitGraph, CircuitNode } from "./circuitGraph";
import { getGateInfo } from "./gates";

export interface LayoutPosition {
    x: number;
    y: number;
    level: number;
}

export interface CircuitLayout {
    positions: Map<string, LayoutPosition>;
    levels: Map<string, number>;
    width: number;
    height: number;
    levelGap: number;
    paddingX: number;
    paddingY: number;
}

export function calculateLevels(graph: CircuitGraph): Map<string, number> {
    const levels = new Map<string, number>();

    function getLevel(id: string): number {
        const cached = levels.get(id);
        if (cached !== undefined) return cached;
        const node = graph.nodes.find(n => n.id === id);
        if (!node) return 0;
        if (node.type === "INPUT" || node.type === "CONST") {
            levels.set(id, 0);
            return 0;
        }
        let maxIn = -1;
        node.inputs.forEach(inId => {
            maxIn = Math.max(maxIn, getLevel(inId));
        });
        const lvl = maxIn + 1;
        levels.set(id, lvl);
        return lvl;
    }

    graph.nodes.forEach(n => getLevel(n.id));
    return levels;
}

export function calculateCircuitLayout(graph: CircuitGraph): CircuitLayout {
    const levels = calculateLevels(graph);
    const nodesByLevel = new Map<number, CircuitNode[]>();

    levels.forEach((lvl, id) => {
        if (!nodesByLevel.has(lvl)) nodesByLevel.set(lvl, []);
        const node = graph.nodes.find(n => n.id === id);
        if (node) nodesByLevel.get(lvl)!.push(node);
    });

    // Horizontal room per level comfortably clears the widest gate + wires.
    const levelGap = 200;
    const paddingX = 40;
    const paddingY = 40;
    const gateHeight = 52;
    const nodeGapY = 32;

    const positions = new Map<string, LayoutPosition>();
    let maxTotalHeight = 0;

    const sortedLevels = [...nodesByLevel.keys()].sort((a, b) => a - b);
    sortedLevels.forEach(lvl => {
        const list = nodesByLevel.get(lvl)!;
        const totalHeight = list.length * gateHeight + (list.length - 1) * nodeGapY;
        maxTotalHeight = Math.max(maxTotalHeight, totalHeight);
    });

    const circuitHeight = Math.max(260, maxTotalHeight + 2 * paddingY);

    sortedLevels.forEach(lvl => {
        const list = nodesByLevel.get(lvl)!;
        const totalH = list.length * gateHeight + (list.length - 1) * nodeGapY;
        const startY = (circuitHeight - totalH) / 2;
        const x = paddingX + lvl * levelGap;

        list.forEach((node, idx) => {
            positions.set(node.id, { x, y: startY + idx * (gateHeight + nodeGapY), level: lvl });
        });
    });

    const maxLevel = Math.max(0, ...sortedLevels);
    const lastLevelNodes = nodesByLevel.get(maxLevel) || [];
    const maxNodeWidth = lastLevelNodes.reduce((m, n) => Math.max(m, getGateInfo(n).width), 90);
    const circuitWidth = paddingX + maxLevel * levelGap + maxNodeWidth + 120;

    return { positions, levels, width: circuitWidth, height: circuitHeight, levelGap, paddingX, paddingY };
}
