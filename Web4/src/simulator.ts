/**
 * Circuit simulation engine for Web4.
 * Propagates signals through the circuit graph deterministically.
 */

import type { PlaygroundNode, Wire } from "./types";
import { evaluateGate, SOURCE_TYPES, TOGGLEABLE_TYPES } from "../../shared/ts/circuit/gates";

export interface SimResult {
    nodeValues: Map<string, boolean>;
    wireValues: Map<string, boolean>;
}

/**
 * Evaluate all node values given current input states.
 * Uses topological ordering for correct propagation.
 */
export function simulateCircuit(
    nodes: PlaygroundNode[],
    wires: Wire[],
    inputStates: Map<string, boolean>
): SimResult {
    const nodeValues = new Map<string, boolean>();
    const wireValues = new Map<string, boolean>();

    // Build adjacency: targetNodeId -> array of {sourceNodeId, sourcePort, targetPort}
    const incomingWires = new Map<string, { sourceId: string; sourcePort: number; targetPort: number; wireId: string }[]>();
    for (const wire of wires) {
        if (!incomingWires.has(wire.targetNodeId)) {
            incomingWires.set(wire.targetNodeId, []);
        }
        incomingWires.get(wire.targetNodeId)!.push({
            sourceId: wire.sourceNodeId,
            sourcePort: wire.sourcePort,
            targetPort: wire.targetPort,
            wireId: wire.id,
        });
    }

    // Topological sort
    const sorted = topologicalSort(nodes, wires);

    // Evaluate in order
    for (const node of sorted) {
        let value: boolean;

        if (node.type === "CONST") {
            value = node.config?.value ?? false;
        } else if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
            value = inputStates.get(node.id) ?? false;
        } else {
            // Gather inputs from wires
            const nodeIncoming = incomingWires.get(node.id) ?? [];
            const inputValues: boolean[] = [];

            // Sort by target port
            nodeIncoming.sort((a, b) => a.targetPort - b.targetPort);

            for (const wire of nodeIncoming) {
                const srcVal = nodeValues.get(wire.sourceId) ?? false;
                inputValues.push(srcVal);
                wireValues.set(wire.wireId, srcVal);
            }

            value = evaluateGate(node.type, inputValues, node.config);
        }

        nodeValues.set(node.id, value);
    }

    // Update wire values for wires not yet set
    for (const wire of wires) {
        if (!wireValues.has(wire.id)) {
            wireValues.set(wire.id, nodeValues.get(wire.sourceNodeId) ?? false);
        }
    }

    return { nodeValues, wireValues };
}

/**
 * Topological sort using Kahn's algorithm.
 */
function topologicalSort(nodes: PlaygroundNode[], wires: Wire[]): PlaygroundNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const node of nodes) {
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
    }

    for (const wire of wires) {
        adjacency.get(wire.sourceNodeId)?.push(wire.targetNodeId);
        inDegree.set(wire.targetNodeId, (inDegree.get(wire.targetNodeId) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    const sorted: PlaygroundNode[] = [];
    while (queue.length > 0) {
        const id = queue.shift()!;
        const node = nodeMap.get(id);
        if (node) sorted.push(node);

        for (const neighbor of (adjacency.get(id) ?? [])) {
            const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
            inDegree.set(neighbor, newDeg);
            if (newDeg === 0) queue.push(neighbor);
        }
    }

    return sorted;
}
