/**
 * Tests for the shared circuit graph model used by Web1 and Web4.
 */

import { describe, it, expect } from "vitest";
import {
    createCircuit,
    addNode,
    removeNode,
    addConnection,
    removeConnection,
    evaluateCircuit,
    topologicalSort,
    serializeCircuit,
    deriveExpression,
    resetNodeIds,
} from "../../shared/ts/circuit/circuitGraph";

describe("circuitGraph: node operations", () => {
    it("creates an empty circuit", () => {
        const graph = createCircuit("Test");
        expect(graph.name).toBe("Test");
        expect(graph.nodes).toHaveLength(0);
        expect(graph.connections).toHaveLength(0);
    });

    it("adds a node", () => {
        resetNodeIds();
        const graph = createCircuit();
        const id = addNode(graph, "AND", "AND1");
        expect(graph.nodes).toHaveLength(1);
        expect(graph.nodes[0].type).toBe("AND");
        expect(graph.nodes[0].label).toBe("AND1");
    });

    it("adds source nodes to inputNodeIds", () => {
        resetNodeIds();
        const graph = createCircuit();
        const id1 = addNode(graph, "INPUT", "A");
        const id2 = addNode(graph, "INPUT", "B");
        expect(graph.inputNodeIds).toContain(id1);
        expect(graph.inputNodeIds).toContain(id2);
    });

    it("removes a node and its connections", () => {
        resetNodeIds();
        const graph = createCircuit();
        const id1 = addNode(graph, "INPUT", "A");
        const id2 = addNode(graph, "AND", "AND1");
        addConnection(graph, id1, id2, 0);
        expect(graph.connections).toHaveLength(1);

        removeNode(graph, id1);
        expect(graph.nodes).toHaveLength(1);
        expect(graph.connections).toHaveLength(0);
    });
});

describe("circuitGraph: connection operations", () => {
    it("adds a connection", () => {
        resetNodeIds();
        const graph = createCircuit();
        const id1 = addNode(graph, "INPUT", "A");
        const id2 = addNode(graph, "AND", "AND1");
        const connId = addConnection(graph, id1, id2, 0);
        expect(connId).toBeTruthy();
        expect(graph.connections).toHaveLength(1);
    });

    it("rejects self-connections", () => {
        resetNodeIds();
        const graph = createCircuit();
        const id1 = addNode(graph, "AND", "AND1");
        const result = addConnection(graph, id1, id1, 0);
        expect(result).toBeNull();
    });

    it("rejects connections to source nodes", () => {
        resetNodeIds();
        const graph = createCircuit();
        const id1 = addNode(graph, "AND", "AND1");
        const id2 = addNode(graph, "INPUT", "A");
        const result = addConnection(graph, id1, id2, 0);
        expect(result).toBeNull();
    });

    it("removes a connection", () => {
        resetNodeIds();
        const graph = createCircuit();
        const id1 = addNode(graph, "INPUT", "A");
        const id2 = addNode(graph, "AND", "AND1");
        const connId = addConnection(graph, id1, id2, 0)!;
        removeConnection(graph, connId);
        expect(graph.connections).toHaveLength(0);
    });
});

describe("circuitGraph: simulation", () => {
    it("evaluates a simple AND gate", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const and = addNode(graph, "AND", "AND1");
        addConnection(graph, a, and, 0);
        addConnection(graph, b, and, 1);

        let result = evaluateCircuit(graph, { [a]: false, [b]: false });
        expect(result.get(and)).toBe(false);

        result = evaluateCircuit(graph, { [a]: true, [b]: false });
        expect(result.get(and)).toBe(false);

        result = evaluateCircuit(graph, { [a]: false, [b]: true });
        expect(result.get(and)).toBe(false);

        result = evaluateCircuit(graph, { [a]: true, [b]: true });
        expect(result.get(and)).toBe(true);
    });

    it("evaluates a simple OR gate", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const or = addNode(graph, "OR", "OR1");
        addConnection(graph, a, or, 0);
        addConnection(graph, b, or, 1);

        let result = evaluateCircuit(graph, { [a]: false, [b]: false });
        expect(result.get(or)).toBe(false);

        result = evaluateCircuit(graph, { [a]: true, [b]: false });
        expect(result.get(or)).toBe(true);

        result = evaluateCircuit(graph, { [a]: false, [b]: true });
        expect(result.get(or)).toBe(true);

        result = evaluateCircuit(graph, { [a]: true, [b]: true });
        expect(result.get(or)).toBe(true);
    });

    it("evaluates a NOT gate", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const not = addNode(graph, "NOT", "NOT1");
        addConnection(graph, a, not, 0);

        let result = evaluateCircuit(graph, { [a]: false });
        expect(result.get(not)).toBe(true);

        result = evaluateCircuit(graph, { [a]: true });
        expect(result.get(not)).toBe(false);
    });

    it("evaluates a NAND gate", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const nand = addNode(graph, "NAND", "NAND1");
        addConnection(graph, a, nand, 0);
        addConnection(graph, b, nand, 1);

        let result = evaluateCircuit(graph, { [a]: true, [b]: true });
        expect(result.get(nand)).toBe(false);

        result = evaluateCircuit(graph, { [a]: true, [b]: false });
        expect(result.get(nand)).toBe(true);
    });

    it("evaluates a NOR gate", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const nor = addNode(graph, "NOR", "NOR1");
        addConnection(graph, a, nor, 0);
        addConnection(graph, b, nor, 1);

        let result = evaluateCircuit(graph, { [a]: false, [b]: false });
        expect(result.get(nor)).toBe(true);

        result = evaluateCircuit(graph, { [a]: true, [b]: false });
        expect(result.get(nor)).toBe(false);
    });

    it("evaluates an XOR gate", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const xor = addNode(graph, "XOR", "XOR1");
        addConnection(graph, a, xor, 0);
        addConnection(graph, b, xor, 1);

        expect(evaluateCircuit(graph, { [a]: false, [b]: false }).get(xor)).toBe(false);
        expect(evaluateCircuit(graph, { [a]: true, [b]: false }).get(xor)).toBe(true);
        expect(evaluateCircuit(graph, { [a]: false, [b]: true }).get(xor)).toBe(true);
        expect(evaluateCircuit(graph, { [a]: true, [b]: true }).get(xor)).toBe(false);
    });

    it("evaluates an XNOR gate", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const xnor = addNode(graph, "XNOR", "XNOR1");
        addConnection(graph, a, xnor, 0);
        addConnection(graph, b, xnor, 1);

        expect(evaluateCircuit(graph, { [a]: false, [b]: false }).get(xnor)).toBe(true);
        expect(evaluateCircuit(graph, { [a]: true, [b]: false }).get(xnor)).toBe(false);
        expect(evaluateCircuit(graph, { [a]: false, [b]: true }).get(xnor)).toBe(false);
        expect(evaluateCircuit(graph, { [a]: true, [b]: true }).get(xnor)).toBe(true);
    });

    it("evaluates multi-gate circuit (A'B + BC)", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const c = addNode(graph, "INPUT", "C");

        // NOT A
        const notA = addNode(graph, "NOT", "~A");
        addConnection(graph, a, notA, 0);

        // AND1: ~A · B
        const and1 = addNode(graph, "AND", "AND1");
        addConnection(graph, notA, and1, 0);
        addConnection(graph, b, and1, 1);

        // AND2: B · C
        const and2 = addNode(graph, "AND", "AND2");
        addConnection(graph, b, and2, 0);
        addConnection(graph, c, and2, 1);

        // OR: AND1 + AND2
        const or = addNode(graph, "OR", "OR1");
        addConnection(graph, and1, or, 0);
        addConnection(graph, and2, or, 1);

        // Test all 8 combinations for A'B + BC
        const combos = [
            { a: false, b: false, c: false, expected: false },  // 000
            { a: false, b: false, c: true, expected: false },   // 001
            { a: false, b: true, c: false, expected: true },    // 010 (A'B)
            { a: false, b: true, c: true, expected: true },     // 011 (A'B + BC)
            { a: true, b: false, c: false, expected: false },   // 100
            { a: true, b: false, c: true, expected: false },    // 101
            { a: true, b: true, c: false, expected: false },    // 110
            { a: true, b: true, c: true, expected: true },      // 111 (BC)
        ];

        for (const combo of combos) {
            const result = evaluateCircuit(graph, {
                [a]: combo.a, [b]: combo.b, [c]: combo.c
            });
            expect(result.get(or)).toBe(combo.expected);
        }
    });

    it("fan-out works correctly", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const and1 = addNode(graph, "AND", "AND1");
        const and2 = addNode(graph, "AND", "AND2");

        // A feeds both AND gates
        addConnection(graph, a, and1, 0);
        addConnection(graph, a, and2, 0);

        const b = addNode(graph, "INPUT", "B");
        addConnection(graph, b, and1, 1);

        const c = addNode(graph, "INPUT", "C");
        addConnection(graph, c, and2, 1);

        const result = evaluateCircuit(graph, {
            [a]: true, [b]: true, [c]: false
        });
        expect(result.get(and1)).toBe(true);   // A·B = 1·1 = 1
        expect(result.get(and2)).toBe(false);  // A·C = 1·0 = 0
    });
});

describe("circuitGraph: topological sort", () => {
    it("sorts nodes in dependency order", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const and = addNode(graph, "AND", "AND1");
        const or = addNode(graph, "OR", "OR1");
        addConnection(graph, a, and, 0);
        addConnection(graph, b, and, 1);
        addConnection(graph, and, or, 0);
        addConnection(graph, b, or, 1);

        const sorted = topologicalSort(graph);
        const ids = sorted.map(n => n.id);

        // A and B must come before AND, AND must come before OR
        expect(ids.indexOf(a)).toBeLessThan(ids.indexOf(and));
        expect(ids.indexOf(b)).toBeLessThan(ids.indexOf(and));
        expect(ids.indexOf(and)).toBeLessThan(ids.indexOf(or));
    });
});

describe("circuitGraph: serialization", () => {
    it("round-trips through JSON", () => {
        resetNodeIds();
        const graph = createCircuit("Test");
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const and = addNode(graph, "AND", "AND1");
        addConnection(graph, a, and, 0);
        addConnection(graph, b, and, 1);

        const json = serializeCircuit(graph);
        const parsed = JSON.parse(json);
        expect(parsed.nodes).toHaveLength(3);
        expect(parsed.connections).toHaveLength(2);
    });
});

describe("circuitGraph: deriveExpression", () => {
    it("derives expression for simple AND", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const b = addNode(graph, "INPUT", "B");
        const and = addNode(graph, "AND", "AND1");
        addConnection(graph, a, and, 0);
        addConnection(graph, b, and, 1);
        graph.outputNodeId = and;

        const expr = deriveExpression(graph);
        expect(expr).toContain("A");
        expect(expr).toContain("B");
    });

    it("derives expression for NOT", () => {
        resetNodeIds();
        const graph = createCircuit();
        const a = addNode(graph, "INPUT", "A");
        const not = addNode(graph, "NOT", "NOT1");
        addConnection(graph, a, not, 0);
        graph.outputNodeId = not;

        const expr = deriveExpression(graph);
        expect(expr).toBe("A'");
    });
});
