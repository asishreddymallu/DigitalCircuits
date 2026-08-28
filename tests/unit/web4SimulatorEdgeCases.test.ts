/**
 * Edge-case tests for the Web4 circuit simulation engine (simulator.ts).
 *
 * Covers:
 *   - Empty circuits
 *   - Fan-out (one source → many gates)
 *   - Feedback / cycle prevention (topological sort)
 *   - Disconnected / isolated nodes
 *   - Missing inputs (under-connected gates)
 *   - Long propagation chains
 *   - Wire value correctness
 *   - CONST node evaluation
 *   - Multi-output circuits
 *   - Mixed gate types
 *   - Boundary conditions (single node, single wire)
 */

import { describe, it, expect } from "vitest";
import { simulateCircuit } from "../../Web4/src/simulator";
import type { PlaygroundNode, Wire } from "../../Web4/src/types";
import type { GateType } from "../../shared/ts/circuit/gates";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const GRID = 20;

function mkNode(
    id: string,
    type: GateType,
    x: number,
    y: number,
    label = "",
    config?: { value?: boolean; frequency?: number },
    inputCount = 0,
    outputCount = 1
): PlaygroundNode {
    const sizes: Record<string, { w: number; h: number }> = {
        INPUT: { w: 80, h: 50 }, OUTPUT: { w: 80, h: 50 }, CONST: { w: 70, h: 50 },
        CLOCK: { w: 80, h: 50 }, SWITCH: { w: 80, h: 50 }, LED: { w: 70, h: 50 },
        BUFFER: { w: 60, h: 50 }, NOT: { w: 70, h: 50 },
        AND: { w: 80, h: 60 }, OR: { w: 80, h: 60 },
        NAND: { w: 90, h: 60 }, NOR: { w: 90, h: 60 },
        XOR: { w: 80, h: 60 }, XNOR: { w: 90, h: 60 },
    };
    const s = sizes[type] ?? { w: 80, h: 60 };
    return {
        id, type, x, y, width: s.w, height: s.h, rotation: 0,
        label: label || type, config,
        inputPorts: Array.from({ length: inputCount }, (_, i) => ({
            x: 0, y: 15 + (i * (s.h - 30)) / Math.max(inputCount - 1, 1),
            side: "left" as const, index: i,
        })),
        outputPorts: Array.from({ length: outputCount }, (_, i) => ({
            x: s.w, y: s.h / 2,
            side: "right" as const, index: i,
        })),
    };
}

function mkWire(id: string, src: string, tgt: string, tgtPort = 0): Wire {
    return { id, sourceNodeId: src, sourcePort: 0, targetNodeId: tgt, targetPort: tgtPort, points: [], value: false };
}

function srcNode(id: string, type: GateType = "INPUT", label = ""): PlaygroundNode {
    return mkNode(id, type, 0, 0, label, undefined, 0, 1);
}

function sinkNode(id: string, type: GateType = "OUTPUT", label = ""): PlaygroundNode {
    return mkNode(id, type, 200, 0, label, undefined, 1, 0);
}

/* ================================================================== */
/* 1. Empty circuits                                                   */
/* ================================================================== */

describe("Web4 simulator edge cases: empty circuits", () => {
    it("empty node and wire arrays return empty maps", () => {
        const result = simulateCircuit([], [], new Map());
        expect(result.nodeValues.size).toBe(0);
        expect(result.wireValues.size).toBe(0);
    });

    it("single isolated INPUT node defaults to false", () => {
        const nodes = [srcNode("a")];
        const result = simulateCircuit(nodes, [], new Map());
        expect(result.nodeValues.get("a")).toBe(false);
    });

    it("single isolated INPUT node with explicit state", () => {
        const nodes = [srcNode("a")];
        const states = new Map([["a", true]]);
        const result = simulateCircuit(nodes, [], states);
        expect(result.nodeValues.get("a")).toBe(true);
    });

    it("single isolated CONST node uses config.value", () => {
        const nodes = [mkNode("c", "CONST", 0, 0, "C1", { value: true }, 0, 1)];
        const result = simulateCircuit(nodes, [], new Map());
        expect(result.nodeValues.get("c")).toBe(true);
    });

    it("single isolated CONST node defaults to false when no config", () => {
        const nodes = [mkNode("c", "CONST", 0, 0, "C1", undefined, 0, 1)];
        const result = simulateCircuit(nodes, [], new Map());
        expect(result.nodeValues.get("c")).toBe(false);
    });
});

/* ================================================================== */
/* 2. Fan-out                                                          */
/* ================================================================== */

describe("Web4 simulator edge cases: fan-out", () => {
    it("one INPUT feeds two AND gates with different second inputs", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const c = srcNode("c", "INPUT", "C");
        const and1 = mkNode("and1", "AND", 140, 0, "AND1", undefined, 2);
        const and2 = mkNode("and2", "AND", 140, 100, "AND2", undefined, 2);

        const wires = [
            mkWire("w1", "a", "and1", 0),
            mkWire("w2", "b", "and1", 1),
            mkWire("w3", "a", "and2", 0),
            mkWire("w4", "c", "and2", 1),
        ];

        const states = new Map([["a", true], ["b", true], ["c", false]]);
        const { nodeValues } = simulateCircuit([a, b, c, and1, and2], wires, states);

        expect(nodeValues.get("and1")).toBe(true);   // A·B = 1·1
        expect(nodeValues.get("and2")).toBe(false);  // A·C = 1·0
    });

    it("one INPUT feeds three NOT gates", () => {
        const a = srcNode("a", "INPUT", "A");
        const n1 = mkNode("n1", "NOT", 140, 0, "NOT1", undefined, 1);
        const n2 = mkNode("n2", "NOT", 140, 80, "NOT2", undefined, 1);
        const n3 = mkNode("n3", "NOT", 140, 160, "NOT3", undefined, 1);

        const wires = [
            mkWire("w1", "a", "n1", 0),
            mkWire("w2", "a", "n2", 0),
            mkWire("w3", "a", "n3", 0),
        ];

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, n1, n2, n3], wires, states);

        expect(nodeValues.get("n1")).toBe(false);
        expect(nodeValues.get("n2")).toBe(false);
        expect(nodeValues.get("n3")).toBe(false);
    });

    it("fan-out to different gate types produces different results", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const orGate = mkNode("or", "OR", 140, 80, "OR", undefined, 2);
        const xorGate = mkNode("xor", "XOR", 140, 160, "XOR", undefined, 2);

        const wires = [
            mkWire("w1", "a", "and", 0), mkWire("w2", "b", "and", 1),
            mkWire("w3", "a", "or", 0),  mkWire("w4", "b", "or", 1),
            mkWire("w5", "a", "xor", 0), mkWire("w6", "b", "xor", 1),
        ];

        const states = new Map([["a", true], ["b", false]]);
        const { nodeValues } = simulateCircuit([a, b, andGate, orGate, xorGate], wires, states);

        expect(nodeValues.get("and")).toBe(false); // 1 AND 0 = 0
        expect(nodeValues.get("or")).toBe(true);   // 1 OR 0 = 1
        expect(nodeValues.get("xor")).toBe(true);  // 1 XOR 0 = 1
    });

    it("fan-out through intermediate gate", () => {
        // A → NOT → fan-out to two AND gates
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const c = srcNode("c", "INPUT", "C");
        const notA = mkNode("notA", "NOT", 100, 0, "~A", undefined, 1);
        const and1 = mkNode("and1", "AND", 200, 0, "AND1", undefined, 2);
        const and2 = mkNode("and2", "AND", 200, 80, "AND2", undefined, 2);

        const wires = [
            mkWire("w1", "a", "notA", 0),
            mkWire("w2", "notA", "and1", 0),
            mkWire("w3", "b", "and1", 1),
            mkWire("w4", "notA", "and2", 0),
            mkWire("w5", "c", "and2", 1),
        ];

        const states = new Map([["a", false], ["b", true], ["c", true]]);
        const { nodeValues } = simulateCircuit([a, b, c, notA, and1, and2], wires, states);

        expect(nodeValues.get("notA")).toBe(true);  // NOT false = true
        expect(nodeValues.get("and1")).toBe(true);  // true AND true = true
        expect(nodeValues.get("and2")).toBe(true);  // true AND true = true
    });

    it("fan-out wire values are all set correctly", () => {
        const a = srcNode("a", "INPUT", "A");
        const and1 = mkNode("and1", "AND", 140, 0, "AND1", undefined, 2);
        const and2 = mkNode("and2", "AND", 140, 80, "AND2", undefined, 2);
        const b = srcNode("b", "INPUT", "B");
        const c = srcNode("c", "INPUT", "C");

        const wires = [
            mkWire("w1", "a", "and1", 0),
            mkWire("w2", "b", "and1", 1),
            mkWire("w3", "a", "and2", 0),
            mkWire("w4", "c", "and2", 1),
        ];

        const states = new Map([["a", true], ["b", false], ["c", true]]);
        const { wireValues } = simulateCircuit([a, b, c, and1, and2], wires, states);

        expect(wireValues.get("w1")).toBe(true);   // A=1
        expect(wireValues.get("w2")).toBe(false);  // B=0
        expect(wireValues.get("w3")).toBe(true);   // A=1 (fan-out)
        expect(wireValues.get("w4")).toBe(true);   // C=1
    });
});

/* ================================================================== */
/* 3. Feedback / cycle prevention                                      */
/* ================================================================== */

describe("Web4 simulator edge cases: feedback / cycles", () => {
    it("cycle A → NOT → A is partially evaluated (topo sort skips cycle)", () => {
        // A (INPUT) feeds NOT, NOT feeds back to... well, we can't connect
        // to an INPUT. But if we have: AND ← INPUT, AND → NOT → AND (cycle)
        // The topological sort will only return nodes with in-degree 0 first.
        const a = srcNode("a", "INPUT", "A");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const notGate = mkNode("not", "NOT", 260, 0, "NOT", undefined, 1);

        // A → AND[0], AND → NOT, NOT → AND[1] (cycle!)
        const wires = [
            mkWire("w1", "a", "and", 0),
            mkWire("w2", "and", "not", 0),
            mkWire("w3", "not", "and", 1),  // creates cycle: and → not → and
        ];

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, andGate, notGate], wires, states);

        // The topological sort should still process nodes reachable from sources.
        // A is processed (no incoming). AND has in-degree 2 (from A and NOT),
        // but NOT depends on AND which depends on NOT → cycle.
        // With Kahn's algorithm, after processing A, AND still has in-degree 1
        // (from NOT), and NOT has in-degree 1 (from AND). Neither can be processed.
        // So AND and NOT are NOT in the sorted output.
        // Only A should be evaluated.
        expect(nodeValues.get("a")).toBe(true);
        // and and not are in the cycle, so they won't be in the sorted list
        // and won't have values set
    });

    it("longer cycle: A → AND → OR → NOT → AND", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const orGate = mkNode("or", "OR", 260, 0, "OR", undefined, 2);
        const notGate = mkNode("not", "NOT", 380, 0, "NOT", undefined, 1);

        // A → AND[0], B → AND[1], AND → OR[0], OR → NOT, NOT → OR[1] (cycle!)
        const wires = [
            mkWire("w1", "a", "and", 0),
            mkWire("w2", "b", "and", 1),
            mkWire("w3", "and", "or", 0),
            mkWire("w4", "or", "not", 0),
            mkWire("w5", "not", "or", 1),  // cycle: or → not → or
        ];

        const states = new Map([["a", true], ["b", true]]);
        const { nodeValues } = simulateCircuit([a, b, andGate, orGate, notGate], wires, states);

        expect(nodeValues.get("a")).toBe(true);
        expect(nodeValues.get("b")).toBe(true);
        // and, or, not are in the cycle — topological sort will skip them
    });

    it("acyclic circuit evaluates fully (no false positive cycle detection)", () => {
        // A → NOT → AND ← B, AND → OR ← C
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const c = srcNode("c", "INPUT", "C");
        const notGate = mkNode("not", "NOT", 140, 0, "NOT", undefined, 1);
        const andGate = mkNode("and", "AND", 260, 0, "AND", undefined, 2);
        const orGate = mkNode("or", "OR", 380, 0, "OR", undefined, 2);

        const wires = [
            mkWire("w1", "a", "not", 0),
            mkWire("w2", "not", "and", 0),
            mkWire("w3", "b", "and", 1),
            mkWire("w4", "and", "or", 0),
            mkWire("w5", "c", "or", 1),
        ];

        const states = new Map([["a", false], ["b", true], ["c", false]]);
        const { nodeValues } = simulateCircuit([a, b, c, notGate, andGate, orGate], wires, states);

        // NOT(A=false) = true, AND(true, B=true) = true, OR(true, C=false) = true
        expect(nodeValues.get("not")).toBe(true);
        expect(nodeValues.get("and")).toBe(true);
        expect(nodeValues.get("or")).toBe(true);
    });

    it("self-loop wire (AND output → AND input) doesn't crash", () => {
        const a = srcNode("a", "INPUT", "A");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);

        // A → AND[0], AND output → AND[1] (self-loop)
        const wires = [
            mkWire("w1", "a", "and", 0),
            mkWire("w2", "and", "and", 1),
        ];

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, andGate], wires, states);

        expect(nodeValues.get("a")).toBe(true);
        // and has a self-loop, so it's in a cycle with itself and won't be evaluated
    });
});

/* ================================================================== */
/* 4. Disconnected / isolated nodes                                    */
/* ================================================================== */

describe("Web4 simulator edge cases: disconnected nodes", () => {
    it("multiple isolated inputs all evaluate", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const c = srcNode("c", "INPUT", "C");

        const states = new Map([["a", true], ["b", false], ["c", true]]);
        const { nodeValues } = simulateCircuit([a, b, c], [], states);

        expect(nodeValues.get("a")).toBe(true);
        expect(nodeValues.get("b")).toBe(false);
        expect(nodeValues.get("c")).toBe(true);
    });

    it("isolated AND gate with no wires defaults to false", () => {
        const andGate = mkNode("and", "AND", 0, 0, "AND", undefined, 2);
        const { nodeValues } = simulateCircuit([andGate], [], new Map());
        expect(nodeValues.get("and")).toBe(false);
    });

    it("isolated NOT gate outputs true (no input defaults to 0, NOT(0)=1)", () => {
        const notGate = mkNode("not", "NOT", 0, 0, "NOT", undefined, 1);
        const { nodeValues } = simulateCircuit([notGate], [], new Map());
        // NOT with no wires: evaluateGate(NOT, []) → !(false) = true
        expect(nodeValues.get("not")).toBe(true);
    });

    it("isolated OUTPUT node defaults to false", () => {
        const out = sinkNode("out", "OUTPUT", "F");
        const { nodeValues } = simulateCircuit([out], [], new Map());
        expect(nodeValues.get("out")).toBe(false);
    });

    it("mixed connected and disconnected nodes", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const c = srcNode("c", "INPUT", "C"); // disconnected
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);

        const wires = [
            mkWire("w1", "a", "and", 0),
            mkWire("w2", "b", "and", 1),
        ];

        const states = new Map([["a", true], ["b", true], ["c", true]]);
        const { nodeValues } = simulateCircuit([a, b, c, andGate], wires, states);

        expect(nodeValues.get("a")).toBe(true);
        expect(nodeValues.get("b")).toBe(true);
        expect(nodeValues.get("c")).toBe(true); // still evaluated
        expect(nodeValues.get("and")).toBe(true); // A·B
    });

    it("gate with wire from non-existent source is not in topological sort", () => {
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        // Wire from non-existent node "ghost" to and[0]
        // Ghost isn't in the node list, so AND's in-degree is never decremented.
        // Kahn's algorithm skips AND (in-degree stays at 1).
        const wires = [mkWire("w1", "ghost", "and", 0)];
        const { nodeValues } = simulateCircuit([andGate], wires, new Map());
        // and is not in the sorted list, so it has no value in nodeValues
        expect(nodeValues.has("and")).toBe(false);
    });
});

/* ================================================================== */
/* 5. Missing / under-connected inputs                                 */
/* ================================================================== */

describe("Web4 simulator edge cases: missing inputs", () => {
    it("AND with only 1 of 2 inputs connected", () => {
        const a = srcNode("a", "INPUT", "A");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const wires = [mkWire("w1", "a", "and", 0)]; // port 1 not connected

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, andGate], wires, states);

        // AND gate gets input [true] → evaluateGate(AND, [true]) = true
        expect(nodeValues.get("and")).toBe(true);
    });

    it("OR with only 1 of 2 inputs connected", () => {
        const a = srcNode("a", "INPUT", "A");
        const orGate = mkNode("or", "OR", 140, 0, "OR", undefined, 2);
        const wires = [mkWire("w1", "a", "or", 0)];

        const states = new Map([["a", false]]);
        const { nodeValues } = simulateCircuit([a, orGate], wires, states);

        // OR gate gets input [false] → evaluateGate(OR, [false]) = false
        expect(nodeValues.get("or")).toBe(false);
    });

    it("NOT with no wires connected", () => {
        const a = srcNode("a", "INPUT", "A");
        const notGate = mkNode("not", "NOT", 140, 0, "NOT", undefined, 1);
        // No wires at all

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, notGate], [], states);

        // not has no incoming wires → evaluateGate(NOT, []) = NOT(false) = true
        expect(nodeValues.get("not")).toBe(true);
    });
});

/* ================================================================== */
/* 6. Long propagation chains                                          */
/* ================================================================== */

describe("Web4 simulator edge cases: long chains", () => {
    it("chain of 5 NOT gates inverts correctly (odd = inverted)", () => {
        const a = srcNode("a", "INPUT", "A");
        const nots = Array.from({ length: 5 }, (_, i) =>
            mkNode(`n${i}`, "NOT", 140 * (i + 1), 0, `NOT${i}`, undefined, 1)
        );

        const wires: Wire[] = [mkWire("w0", "a", "n0", 0)];
        for (let i = 0; i < 4; i++) {
            wires.push(mkWire(`w${i + 1}`, `n${i}`, `n${i + 1}`, 0));
        }

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, ...nots], wires, states);

        // 5 NOTs of true → false → true → false → true → false
        expect(nodeValues.get("n0")).toBe(false);
        expect(nodeValues.get("n1")).toBe(true);
        expect(nodeValues.get("n2")).toBe(false);
        expect(nodeValues.get("n3")).toBe(true);
        expect(nodeValues.get("n4")).toBe(false);
    });

    it("chain of 4 NOT gates preserves value (even = same)", () => {
        const a = srcNode("a", "INPUT", "A");
        const nots = Array.from({ length: 4 }, (_, i) =>
            mkNode(`n${i}`, "NOT", 140 * (i + 1), 0, `NOT${i}`, undefined, 1)
        );

        const wires: Wire[] = [mkWire("w0", "a", "n0", 0)];
        for (let i = 0; i < 3; i++) {
            wires.push(mkWire(`w${i + 1}`, `n${i}`, `n${i + 1}`, 0));
        }

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, ...nots], wires, states);

        expect(nodeValues.get("n3")).toBe(true); // 4 NOTs → identity
    });

    it("alternating AND-OR chain propagates correctly", () => {
        // A → AND(A,B) → OR(result,C) → AND(result,D)
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const c = srcNode("c", "INPUT", "C");
        const d = srcNode("d", "INPUT", "D");
        const and1 = mkNode("and1", "AND", 140, 0, "AND1", undefined, 2);
        const or1 = mkNode("or1", "OR", 280, 0, "OR1", undefined, 2);
        const and2 = mkNode("and2", "AND", 420, 0, "AND2", undefined, 2);

        const wires = [
            mkWire("w1", "a", "and1", 0), mkWire("w2", "b", "and1", 1),
            mkWire("w3", "and1", "or1", 0), mkWire("w4", "c", "or1", 1),
            mkWire("w5", "or1", "and2", 0), mkWire("w6", "d", "and2", 1),
        ];

        const states = new Map([["a", true], ["b", false], ["c", true], ["d", true]]);
        const { nodeValues } = simulateCircuit([a, b, c, d, and1, or1, and2], wires, states);

        // AND(A=1,B=0) = 0, OR(0,C=1) = 1, AND(1,D=1) = 1
        expect(nodeValues.get("and1")).toBe(false);
        expect(nodeValues.get("or1")).toBe(true);
        expect(nodeValues.get("and2")).toBe(true);
    });
});

/* ================================================================== */
/* 7. Wire value correctness                                           */
/* ================================================================== */

describe("Web4 simulator edge cases: wire values", () => {
    it("wire from INPUT carries input value", () => {
        const a = srcNode("a", "INPUT", "A");
        const out = sinkNode("out", "OUTPUT", "F");
        const wires = [mkWire("w1", "a", "out", 0)];

        const states = new Map([["a", true]]);
        const { wireValues } = simulateCircuit([a, out], wires, states);
        expect(wireValues.get("w1")).toBe(true);
    });

    it("wire from AND gate carries computed value", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const out = sinkNode("out", "OUTPUT", "F");

        const wires = [
            mkWire("w1", "a", "and", 0),
            mkWire("w2", "b", "and", 1),
            mkWire("w3", "and", "out", 0),
        ];

        const states = new Map([["a", true], ["b", false]]);
        const { wireValues } = simulateCircuit([a, b, andGate, out], wires, states);

        expect(wireValues.get("w1")).toBe(true);   // A=1
        expect(wireValues.get("w2")).toBe(false);  // B=0
        expect(wireValues.get("w3")).toBe(false);  // AND(1,0)=0
    });

    it("wire values update when input changes", () => {
        const a = srcNode("a", "INPUT", "A");
        const notGate = mkNode("not", "NOT", 140, 0, "NOT", undefined, 1);
        const wires = [mkWire("w1", "a", "not", 0)];

        const states1 = new Map([["a", false]]);
        const r1 = simulateCircuit([a, notGate], wires, states1);
        expect(r1.wireValues.get("w1")).toBe(false);
        expect(r1.nodeValues.get("not")).toBe(true);

        const states2 = new Map([["a", true]]);
        const r2 = simulateCircuit([a, notGate], wires, states2);
        expect(r2.wireValues.get("w1")).toBe(true);
        expect(r2.nodeValues.get("not")).toBe(false);
    });

    it("all wire IDs in the circuit get values assigned", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);

        const wires = [
            mkWire("w_in0", "a", "and", 0),
            mkWire("w_in1", "b", "and", 1),
        ];

        const states = new Map([["a", false], ["b", true]]);
        const { wireValues } = simulateCircuit([a, b, andGate], wires, states);

        expect(wireValues.has("w_in0")).toBe(true);
        expect(wireValues.has("w_in1")).toBe(true);
    });
});

/* ================================================================== */
/* 8. CONST node evaluation                                            */
/* ================================================================== */

describe("Web4 simulator edge cases: CONST nodes", () => {
    it("CONST true feeds into AND", () => {
        const c1 = mkNode("c1", "CONST", 0, 0, "C1", { value: true }, 0, 1);
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);

        const wires = [
            mkWire("w1", "c1", "and", 0),
            mkWire("w2", "b", "and", 1),
        ];

        const states = new Map([["b", true]]);
        const { nodeValues } = simulateCircuit([c1, b, andGate], wires, states);

        expect(nodeValues.get("c1")).toBe(true);
        expect(nodeValues.get("and")).toBe(true); // true AND true
    });

    it("CONST false feeds into OR", () => {
        const c0 = mkNode("c0", "CONST", 0, 0, "C0", { value: false }, 0, 1);
        const a = srcNode("a", "INPUT", "A");
        const orGate = mkNode("or", "OR", 140, 0, "OR", undefined, 2);

        const wires = [
            mkWire("w1", "c0", "or", 0),
            mkWire("w2", "a", "or", 1),
        ];

        const states = new Map([["a", false]]);
        const { nodeValues } = simulateCircuit([c0, a, orGate], wires, states);

        expect(nodeValues.get("c0")).toBe(false);
        expect(nodeValues.get("or")).toBe(false); // false OR false
    });

    it("CONST is not affected by inputStates map", () => {
        const c1 = mkNode("c1", "CONST", 0, 0, "C1", { value: true }, 0, 1);
        // Even if we pass a state for the CONST node's ID, it should use config.value
        const states = new Map([["c1", false]]);
        const { nodeValues } = simulateCircuit([c1], [], states);

        expect(nodeValues.get("c1")).toBe(true); // uses config.value, not inputStates
    });

    it("fan-out from CONST to multiple gates", () => {
        const c1 = mkNode("c1", "CONST", 0, 0, "C1", { value: true }, 0, 1);
        const a = srcNode("a", "INPUT", "A");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const orGate = mkNode("or", "OR", 140, 80, "OR", undefined, 2);

        const wires = [
            mkWire("w1", "c1", "and", 0), mkWire("w2", "a", "and", 1),
            mkWire("w3", "c1", "or", 0),  mkWire("w4", "a", "or", 1),
        ];

        const states = new Map([["a", false]]);
        const { nodeValues } = simulateCircuit([c1, a, andGate, orGate], wires, states);

        expect(nodeValues.get("and")).toBe(false); // true AND false
        expect(nodeValues.get("or")).toBe(true);   // true OR false
    });
});

/* ================================================================== */
/* 9. Multi-output circuits                                            */
/* ================================================================== */

describe("Web4 simulator edge cases: multi-output", () => {
    it("circuit with two independent output paths", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const orGate = mkNode("or", "OR", 140, 80, "OR", undefined, 2);
        const out1 = sinkNode("out1", "OUTPUT", "F1");
        const out2 = sinkNode("out2", "OUTPUT", "F2");

        const wires = [
            mkWire("w1", "a", "and", 0), mkWire("w2", "b", "and", 1),
            mkWire("w3", "and", "out1", 0),
            mkWire("w4", "a", "or", 0), mkWire("w5", "b", "or", 1),
            mkWire("w6", "or", "out2", 0),
        ];

        const states = new Map([["a", true], ["b", false]]);
        const { nodeValues } = simulateCircuit([a, b, andGate, orGate, out1, out2], wires, states);

        expect(nodeValues.get("out1")).toBe(false); // A AND B = 1 AND 0
        expect(nodeValues.get("out2")).toBe(true);  // A OR B = 1 OR 0
    });

    it("shared gate feeding two outputs", () => {
        const a = srcNode("a", "INPUT", "A");
        const notGate = mkNode("not", "NOT", 140, 0, "NOT", undefined, 1);
        const out1 = sinkNode("out1", "OUTPUT", "F1");
        const out2 = sinkNode("out2", "OUTPUT", "F2");

        const wires = [
            mkWire("w1", "a", "not", 0),
            mkWire("w2", "not", "out1", 0),
            mkWire("w3", "not", "out2", 0),
        ];

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, notGate, out1, out2], wires, states);

        expect(nodeValues.get("out1")).toBe(false);
        expect(nodeValues.get("out2")).toBe(false);
    });
});

/* ================================================================== */
/* 10. All gate types evaluation                                       */
/* ================================================================== */

describe("Web4 simulator edge cases: all gate types", () => {
    const makeTwoInput = (type: GateType, a: boolean, b: boolean) => {
        const nA = srcNode("a", "INPUT", "A");
        const nB = srcNode("b", "INPUT", "B");
        const gate = mkNode("g", type, 140, 0, "G", undefined, 2);
        const wires = [mkWire("w1", "a", "g", 0), mkWire("w2", "b", "g", 1)];
        const states = new Map([["a", a], ["b", b]]);
        return simulateCircuit([nA, nB, gate], wires, states).nodeValues.get("g")!;
    };

    it("AND truth table", () => {
        expect(makeTwoInput("AND", false, false)).toBe(false);
        expect(makeTwoInput("AND", false, true)).toBe(false);
        expect(makeTwoInput("AND", true, false)).toBe(false);
        expect(makeTwoInput("AND", true, true)).toBe(true);
    });

    it("OR truth table", () => {
        expect(makeTwoInput("OR", false, false)).toBe(false);
        expect(makeTwoInput("OR", false, true)).toBe(true);
        expect(makeTwoInput("OR", true, false)).toBe(true);
        expect(makeTwoInput("OR", true, true)).toBe(true);
    });

    it("NAND truth table", () => {
        expect(makeTwoInput("NAND", false, false)).toBe(true);
        expect(makeTwoInput("NAND", false, true)).toBe(true);
        expect(makeTwoInput("NAND", true, false)).toBe(true);
        expect(makeTwoInput("NAND", true, true)).toBe(false);
    });

    it("NOR truth table", () => {
        expect(makeTwoInput("NOR", false, false)).toBe(true);
        expect(makeTwoInput("NOR", false, true)).toBe(false);
        expect(makeTwoInput("NOR", true, false)).toBe(false);
        expect(makeTwoInput("NOR", true, true)).toBe(false);
    });

    it("XOR truth table", () => {
        expect(makeTwoInput("XOR", false, false)).toBe(false);
        expect(makeTwoInput("XOR", false, true)).toBe(true);
        expect(makeTwoInput("XOR", true, false)).toBe(true);
        expect(makeTwoInput("XOR", true, true)).toBe(false);
    });

    it("XNOR truth table", () => {
        expect(makeTwoInput("XNOR", false, false)).toBe(true);
        expect(makeTwoInput("XNOR", false, true)).toBe(false);
        expect(makeTwoInput("XNOR", true, false)).toBe(false);
        expect(makeTwoInput("XNOR", true, true)).toBe(true);
    });

    it("NOT single-input truth table", () => {
        const makeNot = (a: boolean) => {
            const nA = srcNode("a", "INPUT", "A");
            const gate = mkNode("g", "NOT", 140, 0, "G", undefined, 1);
            const wires = [mkWire("w1", "a", "g", 0)];
            const states = new Map([["a", a]]);
            return simulateCircuit([nA, gate], wires, states).nodeValues.get("g")!;
        };
        expect(makeNot(false)).toBe(true);
        expect(makeNot(true)).toBe(false);
    });

    it("BUFFER single-input truth table", () => {
        const makeBuf = (a: boolean) => {
            const nA = srcNode("a", "INPUT", "A");
            const gate = mkNode("g", "BUFFER", 140, 0, "G", undefined, 1);
            const wires = [mkWire("w1", "a", "g", 0)];
            const states = new Map([["a", a]]);
            return simulateCircuit([nA, gate], wires, states).nodeValues.get("g")!;
        };
        expect(makeBuf(false)).toBe(false);
        expect(makeBuf(true)).toBe(true);
    });
});

/* ================================================================== */
/* 11. Evaluation order independence                                   */
/* ================================================================== */

describe("Web4 simulator edge cases: evaluation order", () => {
    it("nodes provided in reverse topological order still evaluate correctly", () => {
        // Provide nodes: output first, then gates, then inputs
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const notGate = mkNode("not", "NOT", 260, 0, "NOT", undefined, 1);

        const wires = [
            mkWire("w1", "a", "and", 0),
            mkWire("w2", "b", "and", 1),
            mkWire("w3", "and", "not", 0),
        ];

        // Intentionally reversed order: NOT, AND, B, A
        const states = new Map([["a", true], ["b", true]]);
        const { nodeValues } = simulateCircuit([notGate, andGate, b, a], wires, states);

        expect(nodeValues.get("and")).toBe(true);
        expect(nodeValues.get("not")).toBe(false); // NOT(true)
    });

    it("sibling nodes (no dependency) evaluate in any order", () => {
        const a = srcNode("a", "INPUT", "A");
        const not1 = mkNode("n1", "NOT", 140, 0, "NOT1", undefined, 1);
        const not2 = mkNode("n2", "NOT", 140, 80, "NOT2", undefined, 1);

        const wires = [
            mkWire("w1", "a", "n1", 0),
            mkWire("w2", "a", "n2", 0),
        ];

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, not2, not1], wires, states);

        expect(nodeValues.get("n1")).toBe(false);
        expect(nodeValues.get("n2")).toBe(false);
    });
});

/* ================================================================== */
/* 12. Boundary: single-node circuits                                  */
/* ================================================================== */

describe("Web4 simulator edge cases: boundary", () => {
    it("single CONST 1 node", () => {
        const c = mkNode("c", "CONST", 0, 0, "ONE", { value: true }, 0, 1);
        const { nodeValues } = simulateCircuit([c], [], new Map());
        expect(nodeValues.get("c")).toBe(true);
    });

    it("single SWITCH node with no state defaults to false", () => {
        const sw = mkNode("sw", "SWITCH", 0, 0, "SW", undefined, 0, 1);
        const { nodeValues } = simulateCircuit([sw], [], new Map());
        expect(nodeValues.get("sw")).toBe(false);
    });

    it("single SWITCH node with state", () => {
        const sw = mkNode("sw", "SWITCH", 0, 0, "SW", undefined, 0, 1);
        const states = new Map([["sw", true]]);
        const { nodeValues } = simulateCircuit([sw], [], states);
        expect(nodeValues.get("sw")).toBe(true);
    });

    it("OUTPUT node with no incoming wire defaults to false", () => {
        const out = sinkNode("out", "OUTPUT", "F");
        const { nodeValues } = simulateCircuit([out], [], new Map());
        expect(nodeValues.get("out")).toBe(false);
    });

    it("LED node with incoming wire reflects source value", () => {
        const a = srcNode("a", "INPUT", "A");
        const led = mkNode("led", "LED", 140, 0, "LED", undefined, 1, 0);
        const wires = [mkWire("w1", "a", "led", 0)];

        const states = new Map([["a", true]]);
        const { nodeValues } = simulateCircuit([a, led], wires, states);
        expect(nodeValues.get("led")).toBe(true);
    });
});

/* ================================================================== */
/* 13. Mixed complex circuit                                           */
/* ================================================================== */

describe("Web4 simulator edge cases: complex mixed circuit", () => {
    it("full adder: sum and carry from 3 inputs", () => {
        // Half adder: sum = A XOR B, carry = A AND B
        // Full adder adds Cin: sum = (A XOR B) XOR Cin
        //                         carry = (A AND B) OR (Cin AND (A XOR B))
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const cin = srcNode("cin", "INPUT", "Cin");

        const xor1 = mkNode("xor1", "XOR", 140, 0, "XOR1", undefined, 2);
        const xor2 = mkNode("xor2", "XOR", 280, 0, "XOR2", undefined, 2);
        const and1 = mkNode("and1", "AND", 140, 80, "AND1", undefined, 2);
        const and2 = mkNode("and2", "AND", 280, 80, "AND2", undefined, 2);
        const or1 = mkNode("or1", "OR", 420, 80, "OR1", undefined, 2);

        const wires = [
            mkWire("w1", "a", "xor1", 0), mkWire("w2", "b", "xor1", 1),
            mkWire("w3", "a", "and1", 0), mkWire("w4", "b", "and1", 1),
            mkWire("w5", "xor1", "xor2", 0), mkWire("w6", "cin", "xor2", 1),
            mkWire("w7", "cin", "and2", 0), mkWire("w8", "xor1", "and2", 1),
            mkWire("w9", "and1", "or1", 0), mkWire("w10", "and2", "or1", 1),
        ];

        const allNodes = [a, b, cin, xor1, xor2, and1, and2, or1];

        // Test all 8 combinations
        const combos = [
            { a: 0, b: 0, cin: 0, sum: 0, carry: 0 },
            { a: 0, b: 0, cin: 1, sum: 1, carry: 0 },
            { a: 0, b: 1, cin: 0, sum: 1, carry: 0 },
            { a: 0, b: 1, cin: 1, sum: 0, carry: 1 },
            { a: 1, b: 0, cin: 0, sum: 1, carry: 0 },
            { a: 1, b: 0, cin: 1, sum: 0, carry: 1 },
            { a: 1, b: 1, cin: 0, sum: 0, carry: 1 },
            { a: 1, b: 1, cin: 1, sum: 1, carry: 1 },
        ];

        for (const combo of combos) {
            const states = new Map([
                ["a", Boolean(combo.a)],
                ["b", Boolean(combo.b)],
                ["cin", Boolean(combo.cin)],
            ]);
            const { nodeValues } = simulateCircuit(allNodes, wires, states);

            expect(nodeValues.get("xor2")).toBe(Boolean(combo.sum));
            expect(nodeValues.get("or1")).toBe(Boolean(combo.carry));
        }
    });

    it("74-series style: 2-to-4 decoder", () => {
        // Inputs: A (LSB), B (MSB)
        // Outputs: Y0 = !A·!B, Y1 = A·!B, Y2 = !A·B, Y3 = A·B
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const notA = mkNode("notA", "NOT", 100, 0, "~A", undefined, 1);
        const notB = mkNode("notB", "NOT", 100, 60, "~B", undefined, 1);
        const y0 = mkNode("y0", "AND", 240, 0, "Y0", undefined, 2);
        const y1 = mkNode("y1", "AND", 240, 60, "Y1", undefined, 2);
        const y2 = mkNode("y2", "AND", 240, 120, "Y2", undefined, 2);
        const y3 = mkNode("y3", "AND", 240, 180, "Y3", undefined, 2);

        const wires = [
            mkWire("w1", "a", "notA", 0), mkWire("w2", "b", "notB", 0),
            mkWire("w3", "notA", "y0", 0), mkWire("w4", "notB", "y0", 1),
            mkWire("w5", "a", "y1", 0), mkWire("w6", "notB", "y1", 1),
            mkWire("w7", "notA", "y2", 0), mkWire("w8", "b", "y2", 1),
            mkWire("w9", "a", "y3", 0), mkWire("w10", "b", "y3", 1),
        ];

        const allNodes = [a, b, notA, notB, y0, y1, y2, y3];

        // A=0,B=0 → Y0=1
        let r = simulateCircuit(allNodes, wires, new Map([["a", false], ["b", false]]));
        expect(r.nodeValues.get("y0")).toBe(true);
        expect(r.nodeValues.get("y1")).toBe(false);
        expect(r.nodeValues.get("y2")).toBe(false);
        expect(r.nodeValues.get("y3")).toBe(false);

        // A=1,B=0 → Y1=1
        r = simulateCircuit(allNodes, wires, new Map([["a", true], ["b", false]]));
        expect(r.nodeValues.get("y0")).toBe(false);
        expect(r.nodeValues.get("y1")).toBe(true);
        expect(r.nodeValues.get("y2")).toBe(false);
        expect(r.nodeValues.get("y3")).toBe(false);

        // A=0,B=1 → Y2=1
        r = simulateCircuit(allNodes, wires, new Map([["a", false], ["b", true]]));
        expect(r.nodeValues.get("y0")).toBe(false);
        expect(r.nodeValues.get("y1")).toBe(false);
        expect(r.nodeValues.get("y2")).toBe(true);
        expect(r.nodeValues.get("y3")).toBe(false);

        // A=1,B=1 → Y3=1
        r = simulateCircuit(allNodes, wires, new Map([["a", true], ["b", true]]));
        expect(r.nodeValues.get("y0")).toBe(false);
        expect(r.nodeValues.get("y1")).toBe(false);
        expect(r.nodeValues.get("y2")).toBe(false);
        expect(r.nodeValues.get("y3")).toBe(true);
    });
});

/* ================================================================== */
/* 14. Input toggle propagation                                        */
/* ================================================================== */

describe("Web4 simulator edge cases: input toggling", () => {
    it("toggling input updates downstream gates correctly", () => {
        const a = srcNode("a", "INPUT", "A");
        const notGate = mkNode("not", "NOT", 140, 0, "NOT", undefined, 1);
        const wires = [mkWire("w1", "a", "not", 0)];

        // A=0 → NOT=1
        let r = simulateCircuit([a, notGate], wires, new Map([["a", false]]));
        expect(r.nodeValues.get("not")).toBe(true);

        // A=1 → NOT=0
        r = simulateCircuit([a, notGate], wires, new Map([["a", true]]));
        expect(r.nodeValues.get("not")).toBe(false);

        // Toggle back to A=0 → NOT=1
        r = simulateCircuit([a, notGate], wires, new Map([["a", false]]));
        expect(r.nodeValues.get("not")).toBe(true);
    });

    it("toggling one input doesn't affect unrelated inputs", () => {
        const a = srcNode("a", "INPUT", "A");
        const b = srcNode("b", "INPUT", "B");
        const andGate = mkNode("and", "AND", 140, 0, "AND", undefined, 2);
        const wires = [
            mkWire("w1", "a", "and", 0),
            mkWire("w2", "b", "and", 1),
        ];

        // A=1, B=1
        let r = simulateCircuit([a, b, andGate], wires, new Map([["a", true], ["b", true]]));
        expect(r.nodeValues.get("and")).toBe(true);

        // Toggle A to 0, B stays 1
        r = simulateCircuit([a, b, andGate], wires, new Map([["a", false], ["b", true]]));
        expect(r.nodeValues.get("and")).toBe(false);
        expect(r.nodeValues.get("b")).toBe(true);
    });
});
