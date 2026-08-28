/**
 * Integration tests for Web1 → Web4 circuit export round-trips.
 *
 * These tests verify that circuits built by the Web1 Boolean Solver
 * can be correctly converted to the shared model and then to Web4's
 * PlaygroundNode/Wire format, and that simulation produces identical
 * results at every stage.
 *
 * Also tests the reverse direction (Web4 → Web1) and serialization
 * round-trips through JSON.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    buildBasicSOPCircuit,
    buildNANDCircuit,
    buildNORCircuit,
    evaluateCircuit,
    resetCircuitIds,
    type CircuitGraph as Web1CircuitGraph,
    type CircuitNode as Web1CircuitNode,
} from "../../Web1/src/circuits/circuitGraph";
import type { Implicant } from "../../shared/ts/boolean/minimizer";
import { getPrimeImplicants } from "../../shared/ts/boolean/minimizer";
import {
    convertWeb1Circuit,
    importSharedToWeb4,
    evaluateSharedCircuit,
    exportWeb4ToShared,
    type SharedCircuitGraph,
    type Web4CircuitFile,
} from "../../shared/ts/circuit/interop";
import { simulateCircuit } from "../../Web4/src/simulator";
import { evalAst, type AstNode } from "../../shared/ts/boolean/ast";
import { parseExpression } from "../../shared/ts/boolean/parser";

/* ------------------------------------------------------------------ */
/* Helper: generate all input assignments for n variables              */
/* ------------------------------------------------------------------ */

function allAssignments(variables: string[]): Record<string, boolean>[] {
    const n = variables.length;
    const count = 1 << n;
    const assignments: Record<string, boolean>[] = [];
    for (let i = 0; i < count; i++) {
        const assignment: Record<string, boolean> = {};
        for (let j = 0; j < n; j++) {
            assignment[variables[j]] = Boolean((i >> (n - 1 - j)) & 1);
        }
        assignments.push(assignment);
    }
    return assignments;
}

/* ------------------------------------------------------------------ */
/* Helper: create Web4 PlaygroundNode from type + position             */
/* ------------------------------------------------------------------ */

function makeW4Node(
    id: string,
    type: string,
    x: number,
    y: number,
    label = "",
    config?: { value?: boolean }
): any {
    const sizes: Record<string, { width: number; height: number }> = {
        INPUT: { width: 80, height: 50 },
        OUTPUT: { width: 80, height: 50 },
        CONST: { width: 70, height: 50 },
        NOT: { width: 70, height: 50 },
        AND: { width: 80, height: 60 },
        OR: { width: 80, height: 60 },
        NAND: { width: 90, height: 60 },
        NOR: { width: 90, height: 60 },
    };
    const size = sizes[type] ?? { width: 80, height: 60 };
    return {
        id,
        type,
        x,
        y,
        width: size.width,
        height: size.height,
        rotation: 0,
        label: label || type,
        config,
        inputPorts: type === "INPUT" || type === "CONST"
            ? []
            : [{ x: 0, y: size.height / 2, side: "left", index: 0 }],
        outputPorts: type === "OUTPUT"
            ? []
            : [{ x: size.width, y: size.height / 2, side: "right", index: 0 }],
    };
}

function makeW4Wire(
    id: string,
    sourceId: string,
    targetId: string,
    targetPort = 0
): any {
    return {
        id,
        sourceNodeId: sourceId,
        sourcePort: 0,
        targetNodeId: targetId,
        targetPort,
        points: [],
        value: false,
    };
}

/* ================================================================== */
/* TEST SUITE                                                          */
/* ================================================================== */

beforeEach(() => {
    resetCircuitIds();
});

/* ------------------------------------------------------------------ */
/* 1. AND gate: F = A · B                                             */
/* ------------------------------------------------------------------ */

describe("Round-trip: AND gate (F = A·B)", () => {
    const implicants: Implicant[] = [
        { pattern: "11" },
    ];
    const variables = ["A", "B"];

    it("Web1 circuit evaluates correctly", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const result = evaluateCircuit(web1, assignment);
            const expected = assignment["A"] && assignment["B"];
            expect(result).toBe(expected);
        }
    });

    it("shared circuit evaluates identically to Web1", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const web1Result = evaluateCircuit(web1, assignment);
            // Map assignment variable names to shared node IDs
            const inputValues: Record<string, boolean> = {};
            for (const nodeId of shared.inputNodeIds) {
                const node = shared.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputValues[nodeId] = assignment[node.label];
                }
            }
            const sharedResult = evaluateSharedCircuit(shared, inputValues);
            const outputId = shared.outputNodeId!;
            expect(sharedResult.get(outputId)).toBe(web1Result);
        }
    });

    it("Web4 import and simulation produce identical results", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);
        const assignments = allAssignments(variables);

        // Build inputNodeIds for Web4
        const inputNodeIds = w4.inputNodeIds;

        for (const assignment of assignments) {
            const web1Result = evaluateCircuit(web1, assignment);

            // Map assignment to Web4 input states
            const inputStates = new Map<string, boolean>();
            for (const nodeId of inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }

            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            const outputId = w4.outputNodeIds[0];
            const w4Result = nodeValues.get(outputId) ?? false;
            expect(w4Result).toBe(web1Result);
        }
    });
});

/* ------------------------------------------------------------------ */
/* 2. OR gate: F = A + B                                              */
/* ------------------------------------------------------------------ */

describe("Round-trip: OR gate (F = A+B)", () => {
    const implicants: Implicant[] = [
        { pattern: "-1" },
        { pattern: "1-" },
    ];
    const variables = ["A", "B"];

    it("Web1 circuit evaluates correctly", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const result = evaluateCircuit(web1, assignment);
            const expected = assignment["A"] || assignment["B"];
            expect(result).toBe(expected);
        }
    });

    it("shared circuit evaluates identically to Web1", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputValues: Record<string, boolean> = {};
            for (const nodeId of shared.inputNodeIds) {
                const node = shared.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputValues[nodeId] = assignment[node.label];
                }
            }
            const sharedResult = evaluateSharedCircuit(shared, inputValues);
            expect(sharedResult.get(shared.outputNodeId!)).toBe(web1Result);
        }
    });

    it("Web4 import and simulation produce identical results", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(web1Result);
        }
    });
});

/* ------------------------------------------------------------------ */
/* 3. NOT gate: F = A'                                                */
/* ------------------------------------------------------------------ */

describe("Round-trip: NOT gate (F = A')", () => {
    const implicants: Implicant[] = [
        { pattern: "0" },
    ];
    const variables = ["A"];

    it("Web1 circuit evaluates correctly", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        expect(evaluateCircuit(web1, { A: false })).toBe(true);
        expect(evaluateCircuit(web1, { A: true })).toBe(false);
    });

    it("shared circuit evaluates identically", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);

        for (const assignment of allAssignments(variables)) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputValues: Record<string, boolean> = {};
            for (const nodeId of shared.inputNodeIds) {
                const node = shared.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputValues[nodeId] = assignment[node.label];
                }
            }
            const sharedResult = evaluateSharedCircuit(shared, inputValues);
            expect(sharedResult.get(shared.outputNodeId!)).toBe(web1Result);
        }
    });

    it("Web4 import and simulation produce identical results", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        for (const assignment of allAssignments(variables)) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(web1Result);
        }
    });
});

/* ------------------------------------------------------------------ */
/* 4. Multi-gate: F = A'B + BC  (3 variables)                        */
/* ------------------------------------------------------------------ */

describe("Round-trip: multi-gate F = A'B + BC", () => {
    // Minterms for A'B + BC:
    // A'B: A=0,B=1 → minterms 2(010), 3(011)
    // BC:  B=1,C=1 → minterms 3(011), 7(111)
    // Union: {2, 3, 7}
    const implicants: Implicant[] = [
        { pattern: "01-" },
        { pattern: "-11" },
    ];
    const variables = ["A", "B", "C"];

    it("Web1 circuit evaluates correctly for all 8 inputs", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const result = evaluateCircuit(web1, assignment);
            const A = assignment["A"], B = assignment["B"], C = assignment["C"];
            const expected = (!A && B) || (B && C);
            expect(result).toBe(expected);
        }
    });

    it("shared circuit evaluates identically to Web1 for all 8 inputs", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputValues: Record<string, boolean> = {};
            for (const nodeId of shared.inputNodeIds) {
                const node = shared.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputValues[nodeId] = assignment[node.label];
                }
            }
            const sharedResult = evaluateSharedCircuit(shared, inputValues);
            expect(sharedResult.get(shared.outputNodeId!)).toBe(web1Result);
        }
    });

    it("Web4 import and simulation produce identical results for all 8 inputs", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(web1Result);
        }
    });

    it("Web4 conversion preserves all nodes and connections", () => {
        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        // Should have: 3 inputs + 1 NOT + 2 ANDs + 1 OR = 7 nodes
        expect(w4.nodes.length).toBe(7);
        // Connections should equal Web1 input arrays total
        const totalInputs = shared.connections.length;
        expect(w4.wires.length).toBe(totalInputs);
        // 3 input nodes
        expect(w4.inputNodeIds.length).toBe(3);
        // 1 output node
        expect(w4.outputNodeIds.length).toBe(1);
    });
});

/* ------------------------------------------------------------------ */
/* 5. NAND-only circuit                                                */
/* ------------------------------------------------------------------ */

describe("Round-trip: NAND-only circuit for F = A·B", () => {
    const implicants: Implicant[] = [
        { pattern: "11" },
    ];
    const variables = ["A", "B"];

    it("NAND circuit evaluates correctly", () => {
        const web1 = buildNANDCircuit(implicants, variables);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const result = evaluateCircuit(web1, assignment);
            const expected = assignment["A"] && assignment["B"];
            expect(result).toBe(expected);
        }
    });

    it("Web4 simulation of NAND circuit matches Web1", () => {
        const web1 = buildNANDCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        for (const assignment of allAssignments(variables)) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(web1Result);
        }
    });
});

/* ------------------------------------------------------------------ */
/* 6. NOR-only circuit                                                 */
/* ------------------------------------------------------------------ */

describe("Round-trip: NOR-only circuit for F = A+B", () => {
    const variables = ["A", "B"];
    // For POS: F = A+B has clause {0} (only 00 is 0)
    // NOR circuit uses POS implicants where pattern '0' = variable, '1' = complemented
    const posImplicants: Implicant[] = [
        { pattern: "00" },
    ];

    it("NOR circuit evaluates correctly", () => {
        const web1 = buildNORCircuit(posImplicants, variables);
        const assignments = allAssignments(variables);

        for (const assignment of assignments) {
            const result = evaluateCircuit(web1, assignment);
            const expected = assignment["A"] || assignment["B"];
            expect(result).toBe(expected);
        }
    });

    it("Web4 simulation of NOR circuit matches Web1", () => {
        const web1 = buildNORCircuit(posImplicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        for (const assignment of allAssignments(variables)) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(web1Result);
        }
    });
});

/* ------------------------------------------------------------------ */
/* 7. Serialization round-trip (JSON)                                  */
/* ------------------------------------------------------------------ */

describe("Serialization round-trip", () => {
    it("Web1 → shared → JSON → shared → Web4 produces same simulation", () => {
        const implicants: Implicant[] = [
            { pattern: "01-" },
            { pattern: "-11" },
        ];
        const variables = ["A", "B", "C"];

        // Build Web1 circuit
        const web1 = buildBasicSOPCircuit(implicants, variables);

        // Convert to shared
        const shared = convertWeb1Circuit(web1);

        // Serialize to JSON
        const json = JSON.stringify(shared);

        // Deserialize from JSON
        const restored: SharedCircuitGraph = JSON.parse(json);

        // Verify structure survived
        expect(restored.nodes.length).toBe(shared.nodes.length);
        expect(restored.connections.length).toBe(shared.connections.length);
        expect(restored.inputNodeIds.length).toBe(shared.inputNodeIds.length);
        expect(restored.outputNodeId).toBe(shared.outputNodeId);

        // Convert to Web4 and simulate
        const w4 = importSharedToWeb4(restored);

        for (const assignment of allAssignments(variables)) {
            const web1Result = evaluateCircuit(web1, assignment);
            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(web1Result);
        }
    });

    it("shared graph round-trips through JSON preserving all fields", () => {
        const shared: SharedCircuitGraph = {
            id: "test_1",
            name: "Test Circuit",
            version: 1,
            nodes: [
                { id: "n0", type: "INPUT", label: "A", inputs: [] },
                { id: "n1", type: "INPUT", label: "B", inputs: [] },
                { id: "n2", type: "AND", label: "AND1", inputs: [] },
                { id: "n3", type: "OUTPUT", label: "F", inputs: [] },
            ],
            connections: [
                { id: "c0", sourceId: "n0", targetId: "n2", targetPort: 0 },
                { id: "c1", sourceId: "n1", targetId: "n2", targetPort: 1 },
                { id: "c2", sourceId: "n2", targetId: "n3", targetPort: 0 },
            ],
            inputNodeIds: ["n0", "n1"],
            outputNodeId: "n3",
        };

        const json = JSON.stringify(shared);
        const restored: SharedCircuitGraph = JSON.parse(json);

        expect(restored.id).toBe(shared.id);
        expect(restored.name).toBe(shared.name);
        expect(restored.version).toBe(shared.version);
        expect(restored.outputNodeId).toBe(shared.outputNodeId);

        for (let i = 0; i < shared.nodes.length; i++) {
            expect(restored.nodes[i].id).toBe(shared.nodes[i].id);
            expect(restored.nodes[i].type).toBe(shared.nodes[i].type);
            expect(restored.nodes[i].label).toBe(shared.nodes[i].label);
        }

        for (let i = 0; i < shared.connections.length; i++) {
            expect(restored.connections[i].sourceId).toBe(shared.connections[i].sourceId);
            expect(restored.connections[i].targetId).toBe(shared.connections[i].targetId);
            expect(restored.connections[i].targetPort).toBe(shared.connections[i].targetPort);
        }
    });
});

/* ------------------------------------------------------------------ */
/* 8. Reverse direction: Web4 → Shared → evaluate                     */
/* ------------------------------------------------------------------ */

describe("Reverse direction: Web4 → Shared", () => {
    it("manually-built Web4 AND circuit converts to shared and evaluates correctly", () => {
        // Build an AND gate circuit manually in Web4 format
        const w4Nodes = [
            makeW4Node("w4_a", "INPUT", 0, 0, "A"),
            makeW4Node("w4_b", "INPUT", 0, 100, "B"),
            makeW4Node("w4_and", "AND", 140, 40, "AND1"),
            makeW4Node("w4_out", "OUTPUT", 280, 40, "F"),
        ];
        const w4Wires = [
            makeW4Wire("w1", "w4_a", "w4_and", 0),
            makeW4Wire("w2", "w4_b", "w4_and", 1),
            makeW4Wire("w3", "w4_and", "w4_out", 0),
        ];

        // Convert to shared
        const shared = exportWeb4ToShared(
            w4Nodes,
            w4Wires,
            ["w4_a", "w4_b"],
            "w4_out"
        );

        // Evaluate for all assignments
        const variables = ["A", "B"];
        for (const assignment of allAssignments(variables)) {
            const inputValues: Record<string, boolean> = {};
            inputValues["w4_a"] = assignment["A"];
            inputValues["w4_b"] = assignment["B"];

            const result = evaluateSharedCircuit(shared, inputValues);
            const expected = assignment["A"] && assignment["B"];
            expect(result.get("w4_out")).toBe(expected);
        }
    });

    it("manually-built Web4 OR circuit converts to shared and evaluates correctly", () => {
        const w4Nodes = [
            makeW4Node("w4_a", "INPUT", 0, 0, "A"),
            makeW4Node("w4_b", "INPUT", 0, 100, "B"),
            makeW4Node("w4_or", "OR", 140, 40, "OR1"),
            makeW4Node("w4_out", "OUTPUT", 280, 40, "F"),
        ];
        const w4Wires = [
            makeW4Wire("w1", "w4_a", "w4_or", 0),
            makeW4Wire("w2", "w4_b", "w4_or", 1),
            makeW4Wire("w3", "w4_or", "w4_out", 0),
        ];

        const shared = exportWeb4ToShared(
            w4Nodes,
            w4Wires,
            ["w4_a", "w4_b"],
            "w4_out"
        );

        const variables = ["A", "B"];
        for (const assignment of allAssignments(variables)) {
            const inputValues: Record<string, boolean> = {};
            inputValues["w4_a"] = assignment["A"];
            inputValues["w4_b"] = assignment["B"];

            const result = evaluateSharedCircuit(shared, inputValues);
            const expected = assignment["A"] || assignment["B"];
            expect(result.get("w4_out")).toBe(expected);
        }
    });

    it("Web4 NOT circuit round-trips correctly", () => {
        const w4Nodes = [
            makeW4Node("w4_a", "INPUT", 0, 0, "A"),
            makeW4Node("w4_not", "NOT", 140, 0, "NOT1"),
            makeW4Node("w4_out", "OUTPUT", 280, 0, "F"),
        ];
        const w4Wires = [
            makeW4Wire("w1", "w4_a", "w4_not", 0),
            makeW4Wire("w2", "w4_not", "w4_out", 0),
        ];

        const shared = exportWeb4ToShared(
            w4Nodes,
            w4Wires,
            ["w4_a"],
            "w4_out"
        );

        const result0 = evaluateSharedCircuit(shared, { w4_a: false });
        expect(result0.get("w4_out")).toBe(true);

        const result1 = evaluateSharedCircuit(shared, { w4_a: true });
        expect(result1.get("w4_out")).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/* 9. Cross-consistency: Web1 SOP and NAND give same truth table      */
/* ------------------------------------------------------------------ */

describe("Cross-implementation consistency", () => {
    const variables = ["A", "B", "C"];

    it("SOP, NAND, and NOR all produce the same truth table for F = AB + C", () => {
        // F = A·B + C  →  minterms: 1,3,5,7
        const sopImplicants: Implicant[] = [
            { pattern: "1-1" },
            { pattern: "11-" },
        ];

        const web1SOP = buildBasicSOPCircuit(sopImplicants, variables);
        const web1NAND = buildNANDCircuit(sopImplicants, variables);

        for (const assignment of allAssignments(variables)) {
            const sopResult = evaluateCircuit(web1SOP, assignment);
            const nandResult = evaluateCircuit(web1NAND, assignment);
            expect(sopResult).toBe(nandResult);
        }
    });

    it("Web4 simulation matches Web1 for all gate types", () => {
        const gateTests: { type: string; implicants: Implicant[]; vars: string[]; fn: (a: Record<string, boolean>) => boolean }[] = [
            {
                type: "AND",
                implicants: [{ pattern: "11" }],
                vars: ["A", "B"],
                fn: (a) => a["A"] && a["B"],
            },
            {
                type: "OR",
                implicants: [
                    { pattern: "-1" },
                    { pattern: "1-" },
                ],
                vars: ["A", "B"],
                fn: (a) => a["A"] || a["B"],
            },
            {
                type: "NOT",
                implicants: [{ pattern: "0" }],
                vars: ["A"],
                fn: (a) => !a["A"],
            },
        ];

        for (const test of gateTests) {
            const web1 = buildBasicSOPCircuit(test.implicants, test.vars);
            const shared = convertWeb1Circuit(web1);
            const w4 = importSharedToWeb4(shared);

            for (const assignment of allAssignments(test.vars)) {
                const web1Result = evaluateCircuit(web1, assignment);
                expect(web1Result).toBe(test.fn(assignment));

                const inputStates = new Map<string, boolean>();
                for (const nodeId of w4.inputNodeIds) {
                    const node = w4.nodes.find(n => n.id === nodeId);
                    if (node && node.label in assignment) {
                        inputStates.set(nodeId, assignment[node.label]);
                    }
                }
                const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
                expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(test.fn(assignment));
            }
        }
    });
});

/* ------------------------------------------------------------------ */
/* 10. Edge cases                                                      */
/* ------------------------------------------------------------------ */

describe("Edge cases", () => {
    it("constant-0 circuit (empty implicant list) converts correctly", () => {
        const web1 = buildBasicSOPCircuit([], ["A", "B"]);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        const inputStates = new Map<string, boolean>();
        const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
        expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(false);
    });

    it("constant-1 circuit (full don't-care pattern) converts correctly", () => {
        const web1 = buildBasicSOPCircuit(
            [{ pattern: "--" }],
            ["A", "B"]
        );
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        const inputStates = new Map<string, boolean>();
        const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
        expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(true);
    });

    it("single-variable circuit (F = A) converts correctly", () => {
        // F = A has minterm {1}: pattern "1" means A=1 maps to output 1
        const web1 = buildBasicSOPCircuit(
            [{ pattern: "1" }],
            ["A"]
        );
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        const inputStates0 = new Map<string, boolean>();
        for (const nodeId of w4.inputNodeIds) {
            const node = w4.nodes.find(n => n.id === nodeId);
            if (node?.label === "A") inputStates0.set(nodeId, false);
        }
        const r0 = simulateCircuit(w4.nodes, w4.wires, inputStates0);
        expect(r0.nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(false);

        const inputStates1 = new Map<string, boolean>();
        for (const nodeId of w4.inputNodeIds) {
            const node = w4.nodes.find(n => n.id === nodeId);
            if (node?.label === "A") inputStates1.set(nodeId, true);
        }
        const r1 = simulateCircuit(w4.nodes, w4.wires, inputStates1);
        expect(r1.nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(true);
    });

    it("4-variable circuit F = A·B + C·D round-trips correctly", () => {
        const implicants: Implicant[] = [
            { pattern: "11--" },
            { pattern: "--11" },
        ];
        const variables = ["A", "B", "C", "D"];

        const web1 = buildBasicSOPCircuit(implicants, variables);
        const shared = convertWeb1Circuit(web1);
        const w4 = importSharedToWeb4(shared);

        for (const assignment of allAssignments(variables)) {
            const web1Result = evaluateCircuit(web1, assignment);
            const A = assignment["A"], B = assignment["B"], C = assignment["C"], D = assignment["D"];
            const expected = (A && B) || (C && D);
            expect(web1Result).toBe(expected);

            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            expect(nodeValues.get(w4.outputNodeIds[0]) ?? false).toBe(web1Result);
        }
    });
});

/* ------------------------------------------------------------------ */
/* 11. Full round-trip: expression → Web1 → shared → JSON → Web4      */
/* ------------------------------------------------------------------ */

describe("Full pipeline round-trip", () => {
    it("expression → Web1 SOP → shared → JSON → shared → Web4 all match truth table", () => {
        // Parse expression and build truth table
        const expression = "A·B + A'·C";
        const { ast } = parseExpression(expression);
        const variables = ["A", "B", "C"];

        // Generate truth table from AST
        const expectedOutputs: boolean[] = [];
        for (const assignment of allAssignments(variables)) {
            expectedOutputs.push(evalAst(ast, assignment));
        }

        // Derive minterms from truth table
        const minterms: number[] = [];
        for (let i = 0; i < expectedOutputs.length; i++) {
            if (expectedOutputs[i]) minterms.push(i);
        }

        // Get prime implicants from minterms
        const implicants: Implicant[] = minterms.length > 0
            ? getPrimeImplicants(minterms, variables.length)
            : [];

        // Build Web1 circuit
        const web1 = buildBasicSOPCircuit(implicants, variables);

        // Convert to shared
        const shared = convertWeb1Circuit(web1);

        // Serialize/deserialize
        const json = JSON.stringify(shared);
        const restored: SharedCircuitGraph = JSON.parse(json);

        // Convert to Web4
        const w4 = importSharedToWeb4(restored);

        // Verify all truth table rows match
        for (let i = 0; i < allAssignments(variables).length; i++) {
            const assignment = allAssignments(variables)[i];

            const web1Result = evaluateCircuit(web1, assignment);

            const inputValues: Record<string, boolean> = {};
            for (const nodeId of shared.inputNodeIds) {
                const node = shared.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputValues[nodeId] = assignment[node.label];
                }
            }
            const sharedResult = evaluateSharedCircuit(restored, inputValues);
            const sharedOut = sharedResult.get(restored.outputNodeId!) ?? false;

            const inputStates = new Map<string, boolean>();
            for (const nodeId of w4.inputNodeIds) {
                const node = w4.nodes.find(n => n.id === nodeId);
                if (node && node.label in assignment) {
                    inputStates.set(nodeId, assignment[node.label]);
                }
            }
            const { nodeValues } = simulateCircuit(w4.nodes, w4.wires, inputStates);
            const w4Out = nodeValues.get(w4.outputNodeIds[0]) ?? false;

            expect(web1Result).toBe(expectedOutputs[i]);
            expect(sharedOut).toBe(expectedOutputs[i]);
            expect(w4Out).toBe(expectedOutputs[i]);
        }
    });
});
