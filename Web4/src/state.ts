/**
 * Application state for the Web4 Digital Logic Playground.
 */

import type {
    PlaygroundNode,
    Wire,
    PlaygroundCircuit,
    DragMode,
    SelectionBox,
    UndoAction,
    ProbeData
} from "./types";
import {
    GRID_SIZE,
    GATE_SIZES,
    getDefaultInputPorts,
    getDefaultOutputPorts
} from "./types";
import type { GateType } from "../../shared/ts/circuit/gates";

export interface AppState {
    circuit: PlaygroundCircuit;
    nodes: PlaygroundNode[];
    wires: Wire[];

    // Viewport
    zoom: number;
    panX: number;
    panY: number;

    // Interaction
    dragMode: DragMode;
    draggedNodeId: string | null;
    dragOffset: { x: number; y: number };
    selectedNodeIds: Set<string>;
    selectionBox: SelectionBox | null;

    // Wire drawing
    wireDrawing: {
        sourceNodeId: string;
        sourcePort: number;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null;

    // Simulation
    isRunning: boolean;
    simSpeed: number;
    nodeValues: Map<string, boolean>;

    // Probes
    probes: ProbeData[];

    // Undo/Redo
    undoStack: UndoAction[];
    redoStack: UndoAction[];

    // Clock
    clockInterval: ReturnType<typeof setInterval> | null;
    clockState: boolean;
}

let nextId = 0;
function genId(): string {
    return `w4_${Date.now()}_${nextId++}`;
}

export function createInitialState(): AppState {
    return {
        circuit: {
            id: genId(),
            name: "Untitled Circuit",
            version: 1,
            nodes: [],
            wires: [],
            inputNodeIds: [],
            outputNodeIds: [],
            savedAt: new Date().toISOString(),
        },
        nodes: [],
        wires: [],

        zoom: 1,
        panX: 0,
        panY: 0,

        dragMode: "none",
        draggedNodeId: null,
        dragOffset: { x: 0, y: 0 },
        selectedNodeIds: new Set(),
        selectionBox: null,

        wireDrawing: null,

        isRunning: true,
        simSpeed: 500,
        nodeValues: new Map(),

        probes: [],

        undoStack: [],
        redoStack: [],

        clockInterval: null,
        clockState: false,
    };
}

export function createNode(
    type: GateType,
    x: number,
    y: number,
    label = "",
    config?: PlaygroundNode["config"]
): PlaygroundNode {
    const size = GATE_SIZES[type] || { width: 80, height: 60 };
    const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;

    return {
        id: genId(),
        type,
        x: snappedX,
        y: snappedY,
        width: size.width,
        height: size.height,
        rotation: 0,
        label: label || type,
        config,
        inputPorts: getDefaultInputPorts(type, size.width, size.height),
        outputPorts: getDefaultOutputPorts(type, size.width, size.height),
    };
}

/** Absolute position of a port. */
export function getPortPosition(
    node: PlaygroundNode,
    port: "input" | "output",
    portIndex: number
): { x: number; y: number } {
    const ports = port === "input" ? node.inputPorts : node.outputPorts;
    const p = ports[portIndex];
    if (!p) return { x: node.x, y: node.y };

    // Apply rotation
    const cx = node.width / 2;
    const cy = node.height / 2;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const angle = (node.rotation * Math.PI) / 180;
    const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
    const ry = dx * Math.sin(angle) + dy * Math.cos(angle);

    return {
        x: node.x + cx + rx,
        y: node.y + cy + ry,
    };
}

export function snapToGrid(val: number): number {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
}
