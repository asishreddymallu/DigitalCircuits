/**
 * Shared circuit graph model used by both Web1 (Boolean Solver) and
 * Web4 (Logic Playground). This is the single source of truth for
 * circuit representation, enabling interoperability between tools.
 */

import type { GateType } from "./gates";
import { evaluateGate, SOURCE_TYPES, TOGGLEABLE_TYPES } from "./gates";

export interface CircuitNode {
    id: string;
    type: GateType;
    label: string;
    inputs: string[];       // IDs of nodes feeding into this gate's input ports
    config?: {
        value?: boolean;      // For CONST nodes
        frequency?: number;   // For CLOCK nodes (Hz)
        dutyCycle?: number;   // For CLOCK nodes (0-1)
    };
}

export interface CircuitConnection {
    id: string;
    sourceId: string;
    targetId: string;
    targetPort: number;     // Which input port on the target
}

export interface CircuitGraph {
    id: string;
    name: string;
    version: number;
    nodes: CircuitNode[];
    connections: CircuitConnection[];
    /** ID of the output node (if single-output). */
    outputNodeId?: string;
    /** All input node IDs in order. */
    inputNodeIds: string[];
    metadata?: Record<string, unknown>;
}

let nodeCounter = 0;

/** Reset the global ID counter. */
export function resetNodeIds(): void {
    nodeCounter = 0;
}

/** Generate a unique node ID. */
export function nextNodeId(): string {
    return `n${nodeCounter++}`;
}

/** Generate a unique connection ID. */
export function nextConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create an empty circuit graph. */
export function createCircuit(name = "Untitled Circuit"): CircuitGraph {
    return {
        id: `circuit_${Date.now()}`,
        name,
        version: 1,
        nodes: [],
        connections: [],
        inputNodeIds: [],
    };
}

/** Add a node to the graph and return its ID. */
export function addNode(
    graph: CircuitGraph,
    type: GateType,
    label = "",
    config?: CircuitNode["config"]
): string {
    const id = nextNodeId();
    const node: CircuitNode = { id, type, label, inputs: [], config };
    graph.nodes.push(node);
    if (SOURCE_TYPES.has(type)) {
        graph.inputNodeIds.push(id);
    }
    return id;
}

/** Remove a node and all its connections. */
export function removeNode(graph: CircuitGraph, nodeId: string): void {
    graph.nodes = graph.nodes.filter(n => n.id !== nodeId);
    graph.connections = graph.connections.filter(
        c => c.sourceId !== nodeId && c.targetId !== nodeId
    );
    graph.inputNodeIds = graph.inputNodeIds.filter(id => id !== nodeId);
    if (graph.outputNodeId === nodeId) graph.outputNodeId = undefined;
}

/** Add a connection between two nodes. */
export function addConnection(
    graph: CircuitGraph,
    sourceId: string,
    targetId: string,
    targetPort = 0
): string | null {
    const source = graph.nodes.find(n => n.id === sourceId);
    const target = graph.nodes.find(n => n.id === targetId);
    if (!source || !target) return null;

    // Don't allow self-connections
    if (sourceId === targetId) return null;

    // Don't allow connecting to a source node
    if (SOURCE_TYPES.has(target.type)) return null;

    const id = nextConnectionId();
    graph.connections.push({ id, sourceId, targetId, targetPort });
    return id;
}

/** Remove a connection by ID. */
export function removeConnection(graph: CircuitGraph, connectionId: string): void {
    graph.connections = graph.connections.filter(c => c.id !== connectionId);
}

/** Remove all connections involving a node. */
export function removeNodeConnections(graph: CircuitGraph, nodeId: string): void {
    graph.connections = graph.connections.filter(
        c => c.sourceId !== nodeId && c.targetId !== nodeId
    );
}

/**
 * Topological sort of circuit nodes for evaluation order.
 * Uses Kahn's algorithm with cycle detection.
 */
export function topologicalSort(graph: CircuitGraph): CircuitNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const node of graph.nodes) {
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
    }

    // Build adjacency and in-degree from connections
    for (const conn of graph.connections) {
        adjacency.get(conn.sourceId)?.push(conn.targetId);
        inDegree.set(conn.targetId, (inDegree.get(conn.targetId) ?? 0) + 1);
    }

    // Nodes without incoming connections (inputs and sources)
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    const sorted: CircuitNode[] = [];
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

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

/**
 * Evaluate the circuit for a given input assignment.
 * Returns a map of node ID → output value.
 */
export function evaluateCircuit(
    graph: CircuitGraph,
    inputValues: Record<string, boolean>
): Map<string, boolean> {
    const results = new Map<string, boolean>();
    const sorted = topologicalSort(graph);

    for (const node of sorted) {
        if (node.type === "CONST") {
            results.set(node.id, node.config?.value ?? false);
        } else if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
            results.set(node.id, inputValues[node.id] ?? false);
        } else {
            // Get input values from connections
            const inputVals: boolean[] = [];
            const nodeInputs = graph.connections
                .filter(c => c.targetId === node.id)
                .sort((a, b) => a.targetPort - b.targetPort);

            for (const conn of nodeInputs) {
                inputVals.push(results.get(conn.sourceId) ?? false);
            }

            results.set(node.id, evaluateGate(node.type, inputVals, node.config));
        }
    }

    return results;
}

/** Get all nodes feeding into a given node (direct predecessors). */
export function getInputs(graph: CircuitGraph, nodeId: string): CircuitNode[] {
    const inputIds = graph.connections
        .filter(c => c.targetId === nodeId)
        .map(c => c.sourceId);
    return graph.nodes.filter(n => inputIds.includes(n.id));
}

/** Get all nodes that a given node feeds into (direct successors). */
export function getOutputs(graph: CircuitGraph, nodeId: string): CircuitNode[] {
    const outputIds = graph.connections
        .filter(c => c.sourceId === nodeId)
        .map(c => c.targetId);
    return graph.nodes.filter(n => outputIds.includes(n.id));
}

/** Check if a connection between two nodes already exists. */
export function connectionExists(
    graph: CircuitGraph,
    sourceId: string,
    targetId: string
): boolean {
    return graph.connections.some(c => c.sourceId === sourceId && c.targetId === targetId);
}

/**
 * Serialize the circuit graph to JSON for save/load.
 */
export function serializeCircuit(graph: CircuitGraph): string {
    return JSON.stringify(graph, null, 2);
}

/**
 * Deserialize a circuit graph from JSON with basic validation.
 */
export function deserializeCircuit(json: string): CircuitGraph | null {
    try {
        const graph = JSON.parse(json);
        if (
            typeof graph.id !== "string" ||
            typeof graph.name !== "string" ||
            !Array.isArray(graph.nodes) ||
            !Array.isArray(graph.connections)
        ) {
            return null;
        }
        return graph as CircuitGraph;
    } catch {
        return null;
    }
}

/**
 * Export circuit as a simple JSON object (for import between tools).
 */
export function exportCircuit(graph: CircuitGraph): object {
    return {
        id: graph.id,
        name: graph.name,
        version: graph.version,
        nodes: graph.nodes.map(n => ({
            id: n.id,
            type: n.type,
            label: n.label,
            config: n.config,
        })),
        connections: graph.connections.map(c => ({
            id: c.id,
            sourceId: c.sourceId,
            targetId: c.targetId,
            targetPort: c.targetPort,
        })),
        inputNodeIds: graph.inputNodeIds,
        outputNodeId: graph.outputNodeId,
    };
}

/**
 * Derive a Boolean expression from the circuit graph.
 * Traces from the output node back through gates to build the expression string.
 */
export function deriveExpression(graph: CircuitGraph, outputId?: string): string {
    const outId = outputId ?? graph.outputNodeId;
    if (!outId) return "";

    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
    const connMap = new Map<string, string[]>();
    for (const conn of graph.connections) {
        if (!connMap.has(conn.targetId)) connMap.set(conn.targetId, []);
        const arr = connMap.get(conn.targetId)!;
        arr[conn.targetPort] = conn.sourceId;
    }

    function trace(nodeId: string): string {
        const node = nodeMap.get(nodeId);
        if (!node) return "0";

        if (node.type === "CONST") {
            return node.config?.value ? "1" : "0";
        }
        if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
            return node.label || nodeId;
        }

        const inputIds = connMap.get(nodeId) ?? [];
        const inputExprs = inputIds.filter(Boolean).map(trace);

        switch (node.type) {
            case "NOT":
                return `${inputExprs[0]}'`;
            case "BUFFER":
                return inputExprs[0];
            case "AND":
                return inputExprs.length > 1 ? `(${inputExprs.join("·")})` : inputExprs[0] ?? "0";
            case "OR":
                return inputExprs.length > 1 ? `(${inputExprs.join("+")})` : inputExprs[0] ?? "0";
            case "NAND":
                return inputExprs.length > 1 ? `(${inputExprs.join("·")})'` : `${inputExprs[0] ?? "0"}'`;
            case "NOR":
                return inputExprs.length > 1 ? `(${inputExprs.join("+")})'` : `${inputExprs[0] ?? "0"}'`;
            case "XOR":
                return inputExprs.length > 1 ? `(${inputExprs.join("^")})` : inputExprs[0] ?? "0";
            case "XNOR":
                return inputExprs.length > 1 ? `(${inputExprs.join("^")})'` : `${inputExprs[0] ?? "0"}'`;
            default:
                return node.label || "0";
        }
    }

    return trace(outId);
}
