/**
 * Type definitions for the Web4 Digital Logic Playground.
 */

import type { GateType } from "../../shared/ts/circuit/gates";

export interface Point {
    x: number;
    y: number;
}

export interface PortPosition {
    x: number;
    y: number;
    side: "left" | "right" | "top" | "bottom";
    index: number;
}

export interface WirePoint {
    x: number;
    y: number;
}

export interface Wire {
    id: string;
    sourceNodeId: string;
    sourcePort: number;
    targetNodeId: string;
    targetPort: number;
    points: WirePoint[];
    value: boolean;
}

export interface PlaygroundNode {
    id: string;
    type: GateType;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    label: string;
    config?: {
        value?: boolean;
        frequency?: number;
        dutyCycle?: number;
    };
    inputPorts: PortPosition[];
    outputPorts: PortPosition[];
}

export interface ProbeData {
    wireId: string;
    history: boolean[];
    maxHistory: number;
}

export interface UndoAction {
    type: "addNode" | "removeNode" | "moveNode" | "addWire" | "removeWire" | "changeConfig";
    data: Record<string, unknown>;
    timestamp: number;
}

export interface PlaygroundCircuit {
    id: string;
    name: string;
    version: number;
    nodes: PlaygroundNode[];
    wires: Wire[];
    inputNodeIds: string[];
    outputNodeIds: string[];
    savedAt: string;
}

export type DragMode = "none" | "move" | "pan" | "wire" | "select" | "delete";

export interface SelectionBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export const GRID_SIZE = 20;
export const SNAP_TO_GRID = true;
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 3.0;

/** Default dimensions for each gate type. */
export const GATE_SIZES: Record<GateType, { width: number; height: number }> = {
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

/** Default port positions relative to gate origin. */
export function getDefaultInputPorts(type: GateType, width: number, height: number): PortPosition[] {
    const count = getInputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: 0, y: height / 2, side: "left", index: 0 }];
    const ports: PortPosition[] = [];
    for (let i = 0; i < count; i++) {
        const y = 15 + (i * (height - 30)) / (count - 1);
        ports.push({ x: 0, y, side: "left", index: i });
    }
    return ports;
}

export function getDefaultOutputPorts(type: GateType, width: number, height: number): PortPosition[] {
    const count = getOutputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: width, y: height / 2, side: "right", index: 0 }];
    const ports: PortPosition[] = [];
    for (let i = 0; i < count; i++) {
        const y = 15 + (i * (height - 30)) / (count - 1);
        ports.push({ x: width, y, side: "right", index: i });
    }
    return ports;
}

export function getInputCount(type: GateType): number {
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

export function getOutputCount(type: GateType): number {
    switch (type) {
        case "OUTPUT":
        case "LED":
            return 0;
        default:
            return 1;
    }
}
