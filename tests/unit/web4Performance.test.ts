/**
 * Performance benchmarks for the Web4 circuit simulation engine.
 *
 * Tests simulation speed with circuits of increasing size:
 *   - 50 gates
 *   - 100 gates
 *   - 200 gates
 *
 * Ensures simulation completes within reasonable time bounds.
 */

import { describe, it, expect } from "vitest";
import { simulateCircuit } from "../../Web4/src/simulator";
import type { PlaygroundNode, Wire, PortPosition } from "../../Web4/src/types";
import type { GateType } from "../../shared/ts/circuit/gates";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const GATE_SIZES: Record<string, { w: number; h: number }> = {
    INPUT: { w: 80, h: 50 }, OUTPUT: { w: 80, h: 50 },
    AND: { w: 80, h: 60 }, OR: { w: 80, h: 60 },
    NOT: { w: 70, h: 50 }, NAND: { w: 90, h: 60 },
    NOR: { w: 90, h: 60 }, XOR: { w: 80, h: 60 },
    XNOR: { w: 90, h: 60 }, CONST: { w: 70, h: 50 },
    BUFFER: { w: 60, h: 50 },
};

function mkNode(id: string, type: GateType, x: number, y: number, label: string): PlaygroundNode {
    const size = GATE_SIZES[type] || { w: 80, h: 60 };
    return {
        id, type, x, y, width: size.w, height: size.h, rotation: 0,
        label,
        inputPorts: mkInputPorts(type, size.w, size.h),
        outputPorts: mkOutputPorts(type, size.w),
    };
}

function mkInputPorts(type: GateType, w: number, h: number): PortPosition[] {
    const count = (type === "NOT" || type === "BUFFER") ? 1 : (["AND","OR","NAND","NOR","XOR","XNOR"].includes(type) ? 2 : 0);
    if (count === 0) return [];
    if (count === 1) return [{ x: 0, y: h / 2, side: "left", index: 0 }];
    return [
        { x: 0, y: 15, side: "left", index: 0 },
        { x: 0, y: h - 15, side: "left", index: 1 },
    ];
}

function mkOutputPorts(type: GateType, w: number): PortPosition[] {
    if (type === "OUTPUT") return [];
    return [{ x: w, y: 30, side: "right", index: 0 }];
}

function buildChainCircuit(gateCount: number): { nodes: PlaygroundNode[]; wires: Wire[] } {
    const nodes: PlaygroundNode[] = [];
    const wires: Wire[] = [];
    let wireId = 0;

    // Input
    const input = mkNode("in0", "INPUT", 0, 100, "A");
    nodes.push(input);

    // Chain of NOT gates (each feeds the next)
    let prevId = "in0";
    const logicTypes: GateType[] = ["NOT", "AND", "OR", "NAND", "NOR", "XOR"];

    for (let i = 0; i < gateCount; i++) {
        const type = logicTypes[i % logicTypes.length];
        const size = GATE_SIZES[type] || { w: 80, h: 60 };
        const x = (i + 1) * 120;
        const y = 100;
        const id = `g${i}`;

        const node: PlaygroundNode = {
            id, type, x, y, width: size.w, height: size.h, rotation: 0,
            label: `${type}${i}`,
            inputPorts: mkInputPorts(type, size.w, size.h),
            outputPorts: mkOutputPorts(type, size.w),
        };
        nodes.push(node);

        // Connect previous to this gate's first input
        wires.push({
            id: `w${wireId++}`, sourceNodeId: prevId, sourcePort: 0,
            targetNodeId: id, targetPort: 0, points: [], value: false,
        });

        // For 2-input gates, connect the same source to the second input
        if (node.inputPorts.length > 1) {
            wires.push({
                id: `w${wireId++}`, sourceNodeId: prevId, sourcePort: 0,
                targetNodeId: id, targetPort: 1, points: [], value: false,
            });
        }

        prevId = id;
    }

    // Output
    const outSize = GATE_SIZES["OUTPUT"];
    const outNode: PlaygroundNode = {
        id: "out", type: "OUTPUT", x: (gateCount + 1) * 120, y: 100,
        width: outSize.w, height: outSize.h, rotation: 0, label: "F",
        inputPorts: [{ x: 0, y: outSize.h / 2, side: "left", index: 0 }],
        outputPorts: [],
    };
    nodes.push(outNode);
    wires.push({
        id: `w${wireId++}`, sourceNodeId: prevId, sourcePort: 0,
        targetNodeId: "out", targetPort: 0, points: [], value: false,
    });

    return { nodes, wires };
}

function buildFanoutCircuit(gateCount: number): { nodes: PlaygroundNode[]; wires: Wire[] } {
    const nodes: PlaygroundNode[] = [];
    const wires: Wire[] = [];
    let wireId = 0;

    // Input
    const input = mkNode("in0", "INPUT", 0, 100, "A");
    nodes.push(input);

    // Fan-out: input feeds many AND gates, each with a second CONST input
    for (let i = 0; i < gateCount; i++) {
        const constNode: PlaygroundNode = {
            id: `c${i}`, type: "CONST", x: 100, y: i * 80,
            width: 70, height: 50, rotation: 0, label: `C${i}`,
            config: { value: i % 2 === 0 },
            inputPorts: [], outputPorts: [{ x: 70, y: 25, side: "right", index: 0 }],
        };
        nodes.push(constNode);

        const andNode: PlaygroundNode = {
            id: `a${i}`, type: "AND", x: 250, y: i * 80,
            width: 80, height: 60, rotation: 0, label: `AND${i}`,
            inputPorts: mkInputPorts("AND", 80, 60),
            outputPorts: mkOutputPorts("AND", 80),
        };
        nodes.push(andNode);

        wires.push({
            id: `w${wireId++}`, sourceNodeId: "in0", sourcePort: 0,
            targetNodeId: `a${i}`, targetPort: 0, points: [], value: false,
        });
        wires.push({
            id: `w${wireId++}`, sourceNodeId: `c${i}`, sourcePort: 0,
            targetNodeId: `a${i}`, targetPort: 1, points: [], value: false,
        });
    }

    return { nodes, wires };
}

function buildTreeCircuit(depth: number): { nodes: PlaygroundNode[]; wires: Wire[] } {
    const nodes: PlaygroundNode[] = [];
    const wires: Wire[] = [];
    let wireId = 0;

    // Build a binary tree of AND gates
    // Level 0: 2^depth inputs
    // Level 1: 2^(depth-1) AND gates
    // ...
    // Level depth: 1 AND gate (root)

    const inputCount = 1 << depth;
    const inputIds: string[] = [];

    for (let i = 0; i < inputCount; i++) {
        const id = `in${i}`;
        const node: PlaygroundNode = {
            id, type: "INPUT", x: 0, y: i * 60,
            width: 80, height: 50, rotation: 0, label: `I${i}`,
            inputPorts: [], outputPorts: [{ x: 80, y: 25, side: "right", index: 0 }],
        };
        nodes.push(node);
        inputIds.push(id);
    }

    let currentLevel = [...inputIds];
    let xOffset = 120;

    for (let level = 0; level < depth; level++) {
        const nextLevel: string[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const id = `and_${level}_${i / 2}`;
            const size = GATE_SIZES["AND"];
            const y = (i / 2) * (60 * (1 << level)) + 30 * (1 << level);
            const node: PlaygroundNode = {
                id, type: "AND", x: xOffset + level * 120, y,
                width: size.w, height: size.h, rotation: 0,
                label: `AND`,
                inputPorts: mkInputPorts("AND", size.w, size.h),
                outputPorts: mkOutputPorts("AND", size.w),
            };
            nodes.push(node);

            wires.push({
                id: `w${wireId++}`, sourceNodeId: currentLevel[i], sourcePort: 0,
                targetNodeId: id, targetPort: 0, points: [], value: false,
            });
            if (currentLevel[i + 1]) {
                wires.push({
                    id: `w${wireId++}`, sourceNodeId: currentLevel[i + 1], sourcePort: 0,
                    targetNodeId: id, targetPort: 1, points: [], value: false,
                });
            }
            nextLevel.push(id);
        }
        currentLevel = nextLevel;
    }

    return { nodes, wires };
}

/* ================================================================== */
/* BENCHMARKS                                                          */
/* ================================================================== */

describe("Web4 performance benchmarks", () => {
    it("50-gate chain simulates in under 50ms", () => {
        const { nodes, wires } = buildChainCircuit(50);
        const inputStates = new Map([["in0", true]]);

        const start = performance.now();
        const { nodeValues } = simulateCircuit(nodes, wires, inputStates);
        const elapsed = performance.now() - start;

        expect(nodeValues.size).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(50);
        console.log(`  50-gate chain: ${elapsed.toFixed(1)}ms (${nodes.length} nodes, ${wires.length} wires)`);
    });

    it("100-gate chain simulates in under 100ms", () => {
        const { nodes, wires } = buildChainCircuit(100);
        const inputStates = new Map([["in0", true]]);

        const start = performance.now();
        const { nodeValues } = simulateCircuit(nodes, wires, inputStates);
        const elapsed = performance.now() - start;

        expect(nodeValues.size).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(100);
        console.log(`  100-gate chain: ${elapsed.toFixed(1)}ms (${nodes.length} nodes, ${wires.length} wires)`);
    });

    it("200-gate chain simulates in under 200ms", () => {
        const { nodes, wires } = buildChainCircuit(200);
        const inputStates = new Map([["in0", true]]);

        const start = performance.now();
        const { nodeValues } = simulateCircuit(nodes, wires, inputStates);
        const elapsed = performance.now() - start;

        expect(nodeValues.size).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(200);
        console.log(`  200-gate chain: ${elapsed.toFixed(1)}ms (${nodes.length} nodes, ${wires.length} wires)`);
    });

    it("50-gate fan-out simulates in under 50ms", () => {
        const { nodes, wires } = buildFanoutCircuit(50);
        const inputStates = new Map([["in0", true]]);

        const start = performance.now();
        const { nodeValues } = simulateCircuit(nodes, wires, inputStates);
        const elapsed = performance.now() - start;

        expect(nodeValues.size).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(50);
        console.log(`  50-gate fan-out: ${elapsed.toFixed(1)}ms (${nodes.length} nodes, ${wires.length} wires)`);
    });

    it("100-gate fan-out simulates in under 100ms", () => {
        const { nodes, wires } = buildFanoutCircuit(100);
        const inputStates = new Map([["in0", true]]);

        const start = performance.now();
        const { nodeValues } = simulateCircuit(nodes, wires, inputStates);
        const elapsed = performance.now() - start;

        expect(nodeValues.size).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(100);
        console.log(`  100-gate fan-out: ${elapsed.toFixed(1)}ms (${nodes.length} nodes, ${wires.length} wires)`);
    });

    it("200-gate fan-out simulates in under 200ms", () => {
        const { nodes, wires } = buildFanoutCircuit(200);
        const inputStates = new Map([["in0", true]]);

        const start = performance.now();
        const { nodeValues } = simulateCircuit(nodes, wires, inputStates);
        const elapsed = performance.now() - start;

        expect(nodeValues.size).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(200);
        console.log(`  200-gate fan-out: ${elapsed.toFixed(1)}ms (${nodes.length} nodes, ${wires.length} wires)`);
    });

    it("depth-8 tree (255 AND gates) simulates in under 200ms", () => {
        const { nodes, wires } = buildTreeCircuit(8);
        const inputStates = new Map<string, boolean>();
        for (const node of nodes) {
            if (node.type === "INPUT") inputStates.set(node.id, true);
        }

        const start = performance.now();
        const { nodeValues } = simulateCircuit(nodes, wires, inputStates);
        const elapsed = performance.now() - start;

        expect(nodeValues.size).toBeGreaterThan(0);
        expect(elapsed).toBeLessThan(200);
        console.log(`  depth-8 tree: ${elapsed.toFixed(1)}ms (${nodes.length} nodes, ${wires.length} wires)`);
    });

    it("rapid input toggling (100 iterations) completes in under 500ms", () => {
        const { nodes, wires } = buildChainCircuit(30);
        const inputNodes = nodes.filter(n => n.type === "INPUT");

        const start = performance.now();
        for (let i = 0; i < 100; i++) {
            const inputStates = new Map<string, boolean>();
            for (const node of inputNodes) {
                inputStates.set(node.id, Boolean(i % 2));
            }
            simulateCircuit(nodes, wires, inputStates);
        }
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(500);
        console.log(`  100 toggles (30-gate chain): ${elapsed.toFixed(1)}ms`);
    });
});
