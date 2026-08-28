/**
 * Interop utilities for converting circuit representations between
 * Web1 (Boolean Solver), the shared circuit model, and Web4 (Logic Playground).
 *
 * These functions enable the Web1→Web4 round-trip:
 *   Web1 solver → buildBasicSOPCircuit → convertWeb1Circuit → shared CircuitGraph
 *   → importSharedToWeb4 → Web4 PlaygroundNode[] + Wire[] → simulateCircuit
 */

import type { GateType } from "./gates";
import { evaluateGate, SOURCE_TYPES, TOGGLEABLE_TYPES } from "./gates";

/* ------------------------------------------------------------------ */
/* Web1 circuit types (local to Web1/src/circuits/circuitGraph.ts)    */
/* ------------------------------------------------------------------ */

export interface Web1CircuitNode {
    id: string;
    type: GateType;
    inputs: string[];
    label: string;
}

export interface Web1CircuitGraph {
    nodes: Web1CircuitNode[];
    output: string;
    inputs: string[];
}

/* ------------------------------------------------------------------ */
/* Shared circuit types                                               */
/* ------------------------------------------------------------------ */

export interface SharedCircuitNode {
    id: string;
    type: GateType;
    label: string;
    inputs: string[];
    config?: { value?: boolean; frequency?: number; dutyCycle?: number };
}

export interface SharedCircuitConnection {
    id: string;
    sourceId: string;
    targetId: string;
    targetPort: number;
}

export interface SharedCircuitGraph {
    id: string;
    name: string;
    version: number;
    nodes: SharedCircuitNode[];
    connections: SharedCircuitConnection[];
    inputNodeIds: string[];
    outputNodeId?: string;
}

/* ------------------------------------------------------------------ */
/* Web4 playground types (local to Web4/src/types.ts)                 */
/* ------------------------------------------------------------------ */

export interface Web4PortPosition {
    x: number;
    y: number;
    side: "left" | "right" | "top" | "bottom";
    index: number;
}

export interface Web4PlaygroundNode {
    id: string;
    type: GateType;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    label: string;
    config?: { value?: boolean; frequency?: number; dutyCycle?: number };
    inputPorts: Web4PortPosition[];
    outputPorts: Web4PortPosition[];
}

export interface Web4Wire {
    id: string;
    sourceNodeId: string;
    sourcePort: number;
    targetNodeId: string;
    targetPort: number;
    points: { x: number; y: number }[];
    value: boolean;
}

export interface Web4CircuitFile {
    id: string;
    name: string;
    version: number;
    nodes: Web4PlaygroundNode[];
    wires: Web4Wire[];
    inputNodeIds: string[];
    outputNodeIds: string[];
    savedAt: string;
}

/* ------------------------------------------------------------------ */
/* Gate size constants (must match Web4/src/types.ts GATE_SIZES)      */
/* ------------------------------------------------------------------ */

const GATE_SIZES: Record<string, { width: number; height: number }> = {
    INPUT:   { width: 80, height: 50 },
    OUTPUT:  { width: 80, height: 50 },
    CONST:   { width: 70, height: 50 },
    CLOCK:   { width: 80, height: 50 },
    SWITCH:  { width: 80, height: 50 },
    LED:     { width: 70, height: 50 },
    BUFFER:  { width: 60, height: 50 },
    NOT:     { width: 70, height: 50 },
    AND:     { width: 80, height: 60 },
    OR:      { width: 80, height: 60 },
    NAND:    { width: 90, height: 60 },
    NOR:     { width: 90, height: 60 },
    XOR:     { width: 80, height: 60 },
    XNOR:    { width: 90, height: 60 },
};

const GRID_SIZE = 20;

/* ------------------------------------------------------------------ */
/* 1. Web1 → Shared conversion                                        */
/* ------------------------------------------------------------------ */

/**
 * Convert a Web1 CircuitGraph into the shared circuit model.
 *
 * Web1 nodes store inputs as an array of node IDs in `node.inputs[]`.
 * The shared model stores connections separately with explicit port indices.
 * We map `node.inputs[i]` → connection with `targetPort = i`.
 */
export function convertWeb1Circuit(web1: Web1CircuitGraph): SharedCircuitGraph {
    const idMap = new Map<string, string>();
    const sharedNodes: SharedCircuitNode[] = [];
    const connections: SharedCircuitConnection[] = [];
    const inputNodeIds: string[] = [];
    let connCounter = 0;

    // Assign new IDs and create nodes
    for (const node of web1.nodes) {
        const newId = `s_${node.id}`;
        idMap.set(node.id, newId);

        const sharedNode: SharedCircuitNode = {
            id: newId,
            type: node.type,
            label: node.label,
            inputs: [],
            config: node.type === "CONST"
                ? { value: node.label === "1" }
                : undefined,
        };
        sharedNodes.push(sharedNode);

        if (SOURCE_TYPES.has(node.type)) {
            inputNodeIds.push(newId);
        }
    }

    // Convert input arrays to connections
    for (const node of web1.nodes) {
        const targetId = idMap.get(node.id)!;
        for (let port = 0; port < node.inputs.length; port++) {
            const sourceId = idMap.get(node.inputs[port]);
            if (sourceId) {
                connections.push({
                    id: `conn_${connCounter++}`,
                    sourceId,
                    targetId,
                    targetPort: port,
                });
            }
        }
    }

    return {
        id: `shared_${Date.now()}`,
        name: "Converted Circuit",
        version: 1,
        nodes: sharedNodes,
        connections,
        inputNodeIds,
        outputNodeId: idMap.get(web1.output),
    };
}

/* ------------------------------------------------------------------ */
/* 2. Shared → Web4 conversion                                        */
/* ------------------------------------------------------------------ */

function getInputCount(type: GateType): number {
    switch (type) {
        case "INPUT":
        case "SWITCH":
        case "CONST":
        case "CLOCK":
            return 0;
        case "NOT":
        case "BUFFER":
        case "OUTPUT":
        case "LED":
            return 1;
        default:
            return 2;
    }
}

function getOutputCount(type: GateType): number {
    switch (type) {
        case "OUTPUT":
        case "LED":
            return 0;
        default:
            return 1;
    }
}

function getDefaultInputPorts(type: GateType, width: number, height: number): Web4PortPosition[] {
    const count = getInputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: 0, y: height / 2, side: "left", index: 0 }];
    const ports: Web4PortPosition[] = [];
    for (let i = 0; i < count; i++) {
        const y = 15 + (i * (height - 30)) / (count - 1);
        ports.push({ x: 0, y, side: "left", index: i });
    }
    return ports;
}

function getDefaultOutputPorts(type: GateType, width: number, height: number): Web4PortPosition[] {
    const count = getOutputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: width, y: height / 2, side: "right", index: 0 }];
    const ports: Web4PortPosition[] = [];
    for (let i = 0; i < count; i++) {
        const y = 15 + (i * (height - 30)) / (count - 1);
        ports.push({ x: width, y, side: "right", index: i });
    }
    return ports;
}

/**
 * Convert a shared CircuitGraph into Web4 PlaygroundNodes + Wires.
 *
 * Layout: nodes are placed in topological layers left-to-right.
 * Each layer is spaced 140px apart horizontally, and nodes within a layer
 * are spaced 90px apart vertically, centered around y=200.
 */
export function importSharedToWeb4(shared: SharedCircuitGraph): {
    nodes: Web4PlaygroundNode[];
    wires: Web4Wire[];
    inputNodeIds: string[];
    outputNodeIds: string[];
} {
    // Topological sort to determine layers
    const layers = topologicalLayers(shared);
    const layerMap = new Map<string, number>();
    for (let i = 0; i < layers.length; i++) {
        for (const id of layers[i]) {
            layerMap.set(id, i);
        }
    }

    // Position nodes in a grid layout
    const nodes: Web4PlaygroundNode[] = [];
    const H_SPACING = 140;
    const V_SPACING = 90;
    const START_X = 60;
    const START_Y = 60;

    // Count nodes per layer for vertical centering
    const layerCounts = new Map<number, number>();
    for (const [, layer] of layerMap) {
        layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
    }
    const layerIndexCounters = new Map<number, number>();

    for (const node of shared.nodes) {
        const layer = layerMap.get(node.id) ?? 0;
        const size = GATE_SIZES[node.type] ?? { width: 80, height: 60 };
        const idx = layerIndexCounters.get(layer) ?? 0;
        const totalInLayer = layerCounts.get(layer) ?? 1;

        const x = START_X + layer * H_SPACING;
        const totalHeight = totalInLayer * V_SPACING;
        const y = START_Y + idx * V_SPACING - totalHeight / 2 + 200;

        layerIndexCounters.set(layer, idx + 1);

        nodes.push({
            id: node.id,
            type: node.type,
            x: Math.round(x / GRID_SIZE) * GRID_SIZE,
            y: Math.round(y / GRID_SIZE) * GRID_SIZE,
            width: size.width,
            height: size.height,
            rotation: 0,
            label: node.label || node.type,
            config: node.config,
            inputPorts: getDefaultInputPorts(node.type, size.width, size.height),
            outputPorts: getDefaultOutputPorts(node.type, size.width, size.height),
        });
    }

    // Convert connections to wires
    const wires: Web4Wire[] = shared.connections.map((conn, i) => ({
        id: `w_${i}`,
        sourceNodeId: conn.sourceId,
        sourcePort: 0, // most gates have 1 output
        targetNodeId: conn.targetId,
        targetPort: conn.targetPort,
        points: [], // will be computed by the renderer
        value: false,
    }));

    return {
        nodes,
        wires,
        inputNodeIds: shared.inputNodeIds,
        outputNodeIds: shared.outputNodeId ? [shared.outputNodeId] : [],
    };
}

/**
 * Topological sort into layers (for layout).
 */
function topologicalLayers(graph: SharedCircuitGraph): string[][] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of graph.nodes) {
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
    }

    for (const conn of graph.connections) {
        adjacency.get(conn.sourceId)?.push(conn.targetId);
        inDegree.set(conn.targetId, (inDegree.get(conn.targetId) ?? 0) + 1);
    }

    const layers: string[][] = [];
    let queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    while (queue.length > 0) {
        layers.push([...queue]);
        const nextQueue: string[] = [];
        for (const id of queue) {
            for (const neighbor of adjacency.get(id) ?? []) {
                const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
                inDegree.set(neighbor, newDeg);
                if (newDeg === 0) nextQueue.push(neighbor);
            }
        }
        queue = nextQueue;
    }

    return layers;
}

/* ------------------------------------------------------------------ */
/* 3. Evaluation (shared model)                                       */
/* ------------------------------------------------------------------ */

/**
 * Evaluate a SharedCircuitGraph for a given input assignment.
 * Returns a map of node ID → output value.
 */
export function evaluateSharedCircuit(
    graph: SharedCircuitGraph,
    inputValues: Record<string, boolean>
): Map<string, boolean> {
    const results = new Map<string, boolean>();
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    // Topological sort
    const sorted = topologicalSortShared(graph);

    for (const node of sorted) {
        if (node.type === "CONST") {
            results.set(node.id, node.config?.value ?? false);
        } else if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
            results.set(node.id, inputValues[node.id] ?? false);
        } else {
            const incoming = graph.connections
                .filter(c => c.targetId === node.id)
                .sort((a, b) => a.targetPort - b.targetPort);

            const inputVals: boolean[] = incoming.map(c => results.get(c.sourceId) ?? false);
            results.set(node.id, evaluateGate(node.type, inputVals, node.config));
        }
    }

    return results;
}

function topologicalSortShared(graph: SharedCircuitGraph): SharedCircuitNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

    for (const node of graph.nodes) {
        inDegree.set(node.id, 0);
        adjacency.set(node.id, []);
    }

    for (const conn of graph.connections) {
        adjacency.get(conn.sourceId)?.push(conn.targetId);
        inDegree.set(conn.targetId, (inDegree.get(conn.targetId) ?? 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
        if (deg === 0) queue.push(id);
    }

    const sorted: SharedCircuitNode[] = [];
    while (queue.length > 0) {
        const id = queue.shift()!;
        const node = nodeMap.get(id);
        if (node) sorted.push(node);

        for (const neighbor of adjacency.get(id) ?? []) {
            const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
            inDegree.set(neighbor, newDeg);
            if (newDeg === 0) queue.push(neighbor);
        }
    }

    return sorted;
}

/* ------------------------------------------------------------------ */
/* 4. Web4 → Shared reverse conversion                                */
/* ------------------------------------------------------------------ */

/**
 * Convert Web4 PlaygroundNodes + Wires back to a shared CircuitGraph.
 * This enables the reverse direction: analyze a Web4 circuit in Web1.
 */
export function exportWeb4ToShared(
    w4Nodes: Web4PlaygroundNode[],
    w4Wires: Web4Wire[],
    inputNodeIds: string[],
    outputNodeId?: string
): SharedCircuitGraph {
    const nodes: SharedCircuitNode[] = w4Nodes.map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        inputs: [],
        config: n.config,
    }));

    const connections: SharedCircuitConnection[] = w4Wires.map((w, i) => ({
        id: `exp_conn_${i}`,
        sourceId: w.sourceNodeId,
        targetId: w.targetNodeId,
        targetPort: w.targetPort,
    }));

    return {
        id: `exported_${Date.now()}`,
        name: "Exported Circuit",
        version: 1,
        nodes,
        connections,
        inputNodeIds,
        outputNodeId,
    };
}

/* ------------------------------------------------------------------ */
/* 5. Web1 → Web4 CircuitFile (for Open in Playground)                */
/* ------------------------------------------------------------------ */

/** localStorage key for circuits imported from Web1. */
export const WEB1_IMPORT_KEY = "w4_imported_from_web1";

/**
 * Convert a Web1 CircuitGraph directly to a Web4 CircuitFile,
 * suitable for storage in localStorage and loading by Web4.
 */
export function web1ToCircuitFile(
    web1: Web1CircuitGraph,
    name?: string
): Web4CircuitFile {
    const shared = convertWeb1Circuit(web1);
    const w4 = importSharedToWeb4(shared);

    return {
        id: shared.id,
        name: name || "Imported from Boolean Solver",
        version: 1,
        nodes: w4.nodes,
        wires: w4.wires,
        inputNodeIds: w4.inputNodeIds,
        outputNodeIds: w4.outputNodeIds,
        savedAt: new Date().toISOString(),
    };
}

/**
 * Store a circuit in localStorage for Web1 → Web4 import.
 */
export function storeImportedCircuit(circuit: Web4CircuitFile): void {
    try {
        localStorage.setItem(WEB1_IMPORT_KEY, JSON.stringify(circuit));
    } catch (e) {
        console.error("Failed to store imported circuit:", e);
    }
}

/**
 * Load and clear an imported circuit from localStorage.
 * Returns null if none exists.
 */
export function loadImportedCircuit(): Web4CircuitFile | null {
    try {
        const raw = localStorage.getItem(WEB1_IMPORT_KEY);
        if (!raw) return null;
        localStorage.removeItem(WEB1_IMPORT_KEY);
        return JSON.parse(raw) as Web4CircuitFile;
    } catch {
        return null;
    }
}
