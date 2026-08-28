/**
 * Web4 — Digital Logic Playground entry point.
 *
 * Interactive circuit design environment with drag-drop gates, wire connections,
 * live simulation, waveform panel, and save/load support.
 */

import type { GateType } from "../../shared/ts/circuit/gates";
import {
    SOURCE_TYPES,
    TOGGLEABLE_TYPES,
} from "../../shared/ts/circuit/gates";
import {
    createInitialState,
    createNode,
    snapToGrid,
} from "./state";
import type { PlaygroundNode, Wire, DragMode } from "./types";
import { GRID_SIZE } from "./types";
import { simulateCircuit } from "./simulator";
import {
    renderGateSVG,
    renderPorts,
    renderWire,
    renderWirePreview,
    renderWireValues,
} from "./renderer";
import { renderPalette, renderToolbar, renderStatusBar } from "./toolbar";
import { setupTouchHandlers } from "./touch";
import {
    saveToLocalStorage,
    loadFromLocalStorage,
    exportAsJSON,
    importFromFile,
    type CircuitFile,
} from "./persistence";
import { loadImportedCircuit } from "../../shared/ts/circuit/interop";
import { showTruthTableDialog } from "./truthTableImport";
import {
    createWaveformState,
    recordSample,
    drawWaveform,
    getSignalNames,
    type WaveformState,
} from "./waveform";
import { createToastEmitter } from "./ui/toast";
import { resolveShortcut, shouldIgnoreKeyEvent } from "./ui/shortcuts";


/* ------------------------------------------------------------------ */
/* DOM HELPERS                                                         */
/* ------------------------------------------------------------------ */

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el as T;
}

/* ------------------------------------------------------------------ */
/* APPLICATION STATE                                                   */
/* ------------------------------------------------------------------ */

const state = createInitialState();
const waveformState = createWaveformState();
let currentMode: DragMode = "select";

/* ------------------------------------------------------------------ */
/* INITIALIZATION                                                      */
/* ------------------------------------------------------------------ */

function init(): void {
    // Render toolbar, palette, status bar
    byId("w4Toolbar").innerHTML = renderToolbar();
    byId("w4Palette").innerHTML = renderPalette();
    byId("w4StatusBar").innerHTML = renderStatusBar();

    // Wire up toolbar
    setupToolbar();

    // Wire up palette drag-and-drop
    setupPalette();

    // Wire up canvas interactions
    setupCanvas();

    // Wire up keyboard shortcuts
    setupKeyboard();

    // Wire up probe hover
    setupProbeHover();

    // Wire up waveform controls
    const pauseBtn = byId<HTMLButtonElement>("w4WaveformPause");
    const clearBtn = byId<HTMLButtonElement>("w4WaveformClear");
    if (pauseBtn) {
        pauseBtn.addEventListener("click", () => {
            waveformState.isPaused = !waveformState.isPaused;
            pauseBtn.textContent = waveformState.isPaused ? "▶" : "⏸";
            pauseBtn.title = waveformState.isPaused ? "Resume" : "Pause";
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            waveformState.history = [];
            waveformState.timeCounter = 0;
            drawWaveformPanel();
        });
    }

    // Wire up touch events for mobile/tablet
    setupTouchHandlers({
        state,
        byId,
        hitTestNode: (mx: number, my: number) => hitTestNode(mx, my),
        hitTestPort: (mx: number, my: number) => hitTestPort(mx, my),
        hitTestWire: (mx: number, my: number) => hitTestWire(mx, my),
        toggleSourceNode,
        deleteNode,
        deleteWire,
        setZoom,
        render,
        runSimulation,
        pushUndo,
        addNodeAt,
        currentMode: () => currentMode,
        snapToGrid,
        justToggledRef: { get value() { return justToggled; }, set value(v: boolean) { justToggled = v; } },
    });

    // Wire up window resize
    window.addEventListener("resize", () => resizeCanvas());

    // Resize canvas
    resizeCanvas();

    // Check for imported circuit from Web1 first, then fall back to saved circuit
    const imported = loadImportedCircuit();
    if (imported) {
        loadCircuit(imported);
        showToast("Circuit imported from Boolean Solver", "success");
    } else {
        const saved = loadFromLocalStorage();
        if (saved) {
            loadCircuit(saved);
        }
    }

    // Start simulation loop
    startSimulation();
}

/* ------------------------------------------------------------------ */
/* TOOLBAR                                                             */
/* ------------------------------------------------------------------ */

function setupToolbar(): void {
    // Mode buttons
    document.querySelectorAll<HTMLButtonElement>(".w4-tool-btn[data-mode]").forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.getAttribute("data-mode") as DragMode;
            setMode(mode);
        });
    });

    byId("w4UndoBtn").addEventListener("click", undo);
    byId("w4RedoBtn").addEventListener("click", redo);
    byId("w4SaveBtn").addEventListener("click", saveCircuit);
    byId("w4LoadBtn").addEventListener("click", loadCircuitDialog);
    byId("w4ExportBtn").addEventListener("click", exportCircuit);
    byId("w4ImportBtn").addEventListener("click", importCircuitDialog);
    byId("w4TruthTableBtn").addEventListener("click", async () => {
        const result = await showTruthTableDialog();
        if (result) {
            state.nodes = result.nodes;
            state.wires = result.wires;
            state.circuit.inputNodeIds = result.inputNodeIds;
            state.circuit.outputNodeIds = result.outputNodeIds;
            state.selectedNodeIds.clear();
            state.nodeValues.clear();
            for (const node of state.nodes) {
                if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
                    state.nodeValues.set(node.id, false);
                }
            }
            updateStatusCounts();
            runSimulation();
            showToast("Circuit generated from truth table", "success");
        }
    });
    byId("w4ClearBtn").addEventListener("click", clearCircuit);
    byId("w4ZoomInBtn").addEventListener("click", () => setZoom(state.zoom + 0.2));
    byId("w4ZoomOutBtn").addEventListener("click", () => setZoom(state.zoom - 0.2));
    byId("w4ZoomFitBtn").addEventListener("click", fitToScreen);
}

function setMode(mode: DragMode): void {
    currentMode = mode;
    state.dragMode = mode;

    // Update UI
    document.querySelectorAll<HTMLButtonElement>(".w4-tool-btn[data-mode]").forEach(btn => {
        btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });

    const canvas = byId("w4Canvas");
    canvas.style.cursor = mode === "wire" ? "crosshair" : mode === "delete" ? "not-allowed" : "default";

    const statusMode = byId("w4StatusMode");
    statusMode.textContent = `Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
}

/* ------------------------------------------------------------------ */
/* PALETTE                                                             */
/* ------------------------------------------------------------------ */

function setupPalette(): void {
    const palette = byId("w4Palette");
    const canvas = byId("w4Canvas");

    palette.querySelectorAll<HTMLElement>(".w4-palette-item").forEach(item => {
        item.addEventListener("dragstart", (e) => {
            const type = item.getAttribute("data-gate-type") as GateType;
            e.dataTransfer?.setData("text/plain", type);
            e.dataTransfer!.effectAllowed = "copy";
        });

        // Also support click to add at center
        item.addEventListener("click", () => {
            const type = item.getAttribute("data-gate-type") as GateType;
            const canvasRect = canvas.getBoundingClientRect();
            const cx = (canvasRect.width / 2 - state.panX) / state.zoom;
            const cy = (canvasRect.height / 2 - state.panY) / state.zoom;
            addNodeAt(type, cx, cy);
        });
    });

    // Canvas drop zone
    canvas.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "copy";
    });

    canvas.addEventListener("drop", (e) => {
        e.preventDefault();
        const type = e.dataTransfer?.getData("text/plain") as GateType;
        if (!type) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - state.panX) / state.zoom;
        const y = (e.clientY - rect.top - state.panY) / state.zoom;

        addNodeAt(type, x, y);
    });
}

function addNodeAt(type: GateType, x: number, y: number, label?: string): void {
    const node = createNode(type, x, y, label);
    state.nodes.push(node);

    if (SOURCE_TYPES.has(type)) {
        state.circuit.inputNodeIds.push(node.id);
    }
    if (type === "OUTPUT" || type === "LED") {
        state.circuit.outputNodeIds.push(node.id);
    }

    pushUndo({ type: "addNode", data: { node }, timestamp: Date.now() });
    updateStatusCounts();
    render();
}

/* ------------------------------------------------------------------ */
/* CANVAS INTERACTION                                                  */
/* ------------------------------------------------------------------ */

function setupCanvas(): void {
    const canvas = byId("w4Canvas");
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    let lastMouse = { x: 0, y: 0 };

    canvas.addEventListener("mousedown", (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - state.panX) / state.zoom;
        const my = (e.clientY - rect.top - state.panY) / state.zoom;

        lastMouse = { x: e.clientX, y: e.clientY };

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            // Middle-click or Alt+click = pan
            state.dragMode = "pan";
            isDragging = true;
            canvas.style.cursor = "grabbing";
            return;
        }

        if (currentMode === "select" || currentMode === "move") {
            const hitNode = hitTestNode(mx, my);

            if (hitNode) {
                if (e.shiftKey) {
                    // Multi-select
                    if (state.selectedNodeIds.has(hitNode.id)) {
                        state.selectedNodeIds.delete(hitNode.id);
                    } else {
                        state.selectedNodeIds.add(hitNode.id);
                    }
                } else if (!state.selectedNodeIds.has(hitNode.id)) {
                    state.selectedNodeIds.clear();
                    state.selectedNodeIds.add(hitNode.id);
                }

                state.draggedNodeId = hitNode.id;
                state.dragOffset = { x: mx - hitNode.x, y: my - hitNode.y };
                dragStartPos = { x: hitNode.x, y: hitNode.y };
                state.dragMode = "move";
                isDragging = true;
            } else {
                state.selectedNodeIds.clear();
                isDragging = true;
                state.dragMode = "pan";
            }
        } else if (currentMode === "wire") {
            const hitPort = hitTestPort(mx, my);
            if (hitPort && hitPort.portType === "output") {
                state.wireDrawing = {
                    sourceNodeId: hitPort.nodeId,
                    sourcePort: hitPort.portIndex,
                    startX: hitPort.x,
                    startY: hitPort.y,
                    currentX: hitPort.x,
                    currentY: hitPort.y,
                };
            } else if (state.wireDrawing) {
                // Clicked empty space while drawing wire — cancel
                state.wireDrawing = null;
                render();
            }
        } else if (currentMode === "delete") {
            const hitNode = hitTestNode(mx, my);
            if (hitNode) {
                deleteNode(hitNode.id);
                return;
            }
            const hitWire = hitTestWire(mx, my);
            if (hitWire) {
                deleteWire(hitWire);
            }
        }
    });

    canvas.addEventListener("mousemove", (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - state.panX) / state.zoom;
        const my = (e.clientY - rect.top - state.panY) / state.zoom;

        // Update coordinates
        byId("w4StatusCoords").textContent = `X: ${Math.round(mx)}, Y: ${Math.round(my)}`;

        if (isDragging && state.dragMode === "pan") {
            const dx = e.clientX - lastMouse.x;
            const dy = e.clientY - lastMouse.y;
            state.panX += dx;
            state.panY += dy;
            render();
        } else if (isDragging && state.dragMode === "move" && state.draggedNodeId) {
            const node = state.nodes.find(n => n.id === state.draggedNodeId);
            if (node) {
                node.x = snapToGrid(mx - state.dragOffset.x);
                node.y = snapToGrid(my - state.dragOffset.y);
                render();
            }
        } else if (state.wireDrawing) {
            state.wireDrawing.currentX = mx;
            state.wireDrawing.currentY = my;
            render();
        }

        lastMouse = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener("mouseup", (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - state.panX) / state.zoom;
        const my = (e.clientY - rect.top - state.panY) / state.zoom;

        if (state.wireDrawing) {
            // Try to connect to an input port
            const hitPort = hitTestPort(mx, my);
            if (hitPort && hitPort.portType === "input" && hitPort.nodeId !== state.wireDrawing.sourceNodeId) {
                // Check no duplicate
                const exists = state.wires.some(
                    w => w.targetNodeId === hitPort.nodeId && w.targetPort === hitPort.portIndex
                );
                if (!exists) {
                    const wire: Wire = {
                        id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        sourceNodeId: state.wireDrawing.sourceNodeId,
                        sourcePort: state.wireDrawing.sourcePort,
                        targetNodeId: hitPort.nodeId,
                        targetPort: hitPort.portIndex,
                        points: [],
                        value: false,
                    };
                    state.wires.push(wire);
                    pushUndo({ type: "addWire", data: { wire }, timestamp: Date.now() });
                }
            }
            state.wireDrawing = null;
            render();
        }

        if (state.draggedNodeId) {
            const node = state.nodes.find(n => n.id === state.draggedNodeId);
            if (node) {
                // If it was a click (not a drag), toggle source nodes
                const dx = Math.abs(e.clientX - lastMouse.x);
                const dy = Math.abs(e.clientY - lastMouse.y);
                const wasClick = dx < 4 && dy < 4;

                if (wasClick && (node.type === "INPUT" || node.type === "SWITCH")) {
                    toggleSourceNode(node);
                    justToggled = true;
                    setTimeout(() => { justToggled = false; }, 300);
                } else if (wasClick && node.type === "CONST") {
                    if (!node.config) node.config = {};
                    const oldValue = node.config.value ?? false;
                    node.config.value = !oldValue;
                    pushUndo({
                        type: "changeConfig",
                        data: { nodeId: node.id, oldConfig: { value: oldValue }, newConfig: { value: !oldValue } },
                        timestamp: Date.now(),
                    });
                    runSimulation();
                    justToggled = true;
                    setTimeout(() => { justToggled = false; }, 300);
                } else {
                    pushUndo({
                        type: "moveNode",
                        data: { nodeId: node.id, fromX: dragStartPos.x, fromY: dragStartPos.y, toX: node.x, toY: node.y },
                        timestamp: Date.now(),
                    });
                }
            }
            state.draggedNodeId = null;
        }

        isDragging = false;
        state.dragMode = currentMode;
        canvas.style.cursor = currentMode === "wire" ? "crosshair" : currentMode === "delete" ? "not-allowed" : "default";
    });

    // Mouse wheel zoom
    canvas.addEventListener("wheel", (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setZoom(state.zoom + delta);
    }, { passive: false });

    // Handle mouseup outside canvas (cancel wire drawing)
    window.addEventListener("mouseup", () => {
        if (state.wireDrawing) {
            state.wireDrawing = null;
            render();
        }
    });

    // Double-click to toggle source or configure constant
    canvas.addEventListener("dblclick", (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left - state.panX) / state.zoom;
        const my = (e.clientY - rect.top - state.panY) / state.zoom;

        if (justToggled) return;
        const hitNode = hitTestNode(mx, my);
        if (!hitNode) return;

        if (hitNode.type === "INPUT" || hitNode.type === "SWITCH") {
            toggleSourceNode(hitNode);
        } else if (hitNode.type === "CONST") {
            // Toggle constant value
            if (!hitNode.config) hitNode.config = {};
            hitNode.config.value = !(hitNode.config.value ?? false);
            runSimulation();
            render();
        }
    });
}

/* ------------------------------------------------------------------ */
/* HIT TESTING                                                         */
/* ------------------------------------------------------------------ */

function hitTestNode(mx: number, my: number): PlaygroundNode | null {
    // Search in reverse order (top-most first)
    for (let i = state.nodes.length - 1; i >= 0; i--) {
        const n = state.nodes[i];
        if (mx >= n.x && mx <= n.x + n.width && my >= n.y && my <= n.y + n.height) {
            return n;
        }
    }
    return null;
}



interface PortHit {
    nodeId: string;
    portIndex: number;
    portType: "input" | "output";
    x: number;
    y: number;
}

function hitTestPort(mx: number, my: number): PortHit | null {
    const threshold = 10;
    for (const node of state.nodes) {
        // Input ports
        for (let i = 0; i < node.inputPorts.length; i++) {
            const p = node.inputPorts[i];
            const px = node.x + p.x;
            const py = node.y + p.y;
            if (Math.abs(mx - px) < threshold && Math.abs(my - py) < threshold) {
                return { nodeId: node.id, portIndex: i, portType: "input", x: px, y: py };
            }
        }
        // Output ports
        for (let i = 0; i < node.outputPorts.length; i++) {
            const p = node.outputPorts[i];
            const px = node.x + p.x;
            const py = node.y + p.y;
            if (Math.abs(mx - px) < threshold && Math.abs(my - py) < threshold) {
                return { nodeId: node.id, portIndex: i, portType: "output", x: px, y: py };
            }
        }
    }
    return null;
}

function hitTestWire(mx: number, my: number): Wire | null {
    // Simple proximity test
    for (const wire of state.wires) {
        const sourceNode = state.nodes.find(n => n.id === wire.sourceNodeId);
        const targetNode = state.nodes.find(n => n.id === wire.targetNodeId);
        if (!sourceNode || !targetNode) continue;

        const sp = sourceNode.outputPorts[wire.sourcePort];
        const tp = targetNode.inputPorts[wire.targetPort];
        if (!sp || !tp) continue;

        const sx = sourceNode.x + sp.x;
        const sy = sourceNode.y + sp.y;
        const tx = targetNode.x + tp.x;
        const ty = targetNode.y + tp.y;

        // Check distance to wire path (simplified: check midpoint area)
        const midX = (sx + tx) / 2;
        const points = [
            { x: sx, y: sy },
            { x: midX, y: sy },
            { x: midX, y: ty },
            { x: tx, y: ty },
        ];

        for (let i = 0; i < points.length - 1; i++) {
            const dist = distToSegment(mx, my, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
            if (dist < 8) return wire;
        }
    }
    return null;
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
}

/* ------------------------------------------------------------------ */
/* ACTIONS                                                             */
/* ------------------------------------------------------------------ */

function toggleSourceNode(node: PlaygroundNode): void {
    const current = state.nodeValues.get(node.id) ?? false;
    state.nodeValues.set(node.id, !current);
    runSimulation();
    render();
}

function deleteNode(nodeId: string): void {
    const node = state.nodes.find(n => n.id === nodeId);
    if (!node) return;

    state.nodes = state.nodes.filter(n => n.id !== nodeId);
    state.wires = state.wires.filter(w => w.sourceNodeId !== nodeId && w.targetNodeId !== nodeId);
    state.circuit.inputNodeIds = state.circuit.inputNodeIds.filter(id => id !== nodeId);
    state.circuit.outputNodeIds = state.circuit.outputNodeIds.filter(id => id !== nodeId);
    state.selectedNodeIds.delete(nodeId);

    pushUndo({ type: "removeNode", data: { node }, timestamp: Date.now() });
    updateStatusCounts();
    render();
}

function deleteWire(wire: Wire): void {
    state.wires = state.wires.filter(w => w.id !== wire.id);
    pushUndo({ type: "removeWire", data: { wire }, timestamp: Date.now() });
    render();
}

function clearCircuit(): void {
    if (state.nodes.length === 0) return;
    if (!confirm("Clear all components? This cannot be undone.")) return;

    // Save full state before clearing for undo
    const savedNodes = [...state.nodes];
    const savedWires = [...state.wires];

    state.nodes = [];
    state.wires = [];
    state.circuit.inputNodeIds = [];
    state.circuit.outputNodeIds = [];
    state.selectedNodeIds.clear();
    state.nodeValues.clear();

    pushUndo({ type: "removeNode", data: { nodes: savedNodes, wires: savedWires, isClearAll: true }, timestamp: Date.now() });
    updateStatusCounts();
    render();
}

/* ------------------------------------------------------------------ */
/* UNDO / REDO                                                         */
/* ------------------------------------------------------------------ */

function pushUndo(action: { type: string; data: Record<string, unknown>; timestamp: number }): void {
    state.undoStack.push(action as any);
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
}

function undo(): void {
    if (state.undoStack.length === 0) return;
    const action = state.undoStack.pop()!;

    switch (action.type) {
        case "addNode":
            state.nodes = state.nodes.filter(n => n.id !== (action.data.node as PlaygroundNode).id);
            state.wires = state.wires.filter(w => w.sourceNodeId !== (action.data.node as PlaygroundNode).id && w.targetNodeId !== (action.data.node as PlaygroundNode).id);
            break;
        case "removeNode":
            if (action.data.isClearAll) {
                // Restore full circuit from clear
                state.nodes = (action.data.nodes as PlaygroundNode[]) || [];
                state.wires = (action.data.wires as Wire[]) || [];
            } else if (action.data.node) {
                state.nodes.push(action.data.node as PlaygroundNode);
            }
            break;
        case "addWire":
            state.wires = state.wires.filter(w => w.id !== (action.data.wire as Wire).id);
            break;
        case "removeWire":
            if (action.data.wire) {
                state.wires.push(action.data.wire as Wire);
            }
            break;
        case "moveNode": {
            const node = state.nodes.find(n => n.id === action.data.nodeId);
            if (node) {
                node.x = action.data.fromX as number;
                node.y = action.data.fromY as number;
            }
            break;
        }
        case "changeConfig": {
            const node = state.nodes.find(n => n.id === action.data.nodeId);
            if (node) {
                node.config = { ...node.config, ...(action.data.oldConfig as Record<string, unknown>) };
                runSimulation();
            }
            break;
        }
    }

    state.redoStack.push(action as any);
    updateStatusCounts();
    render();
}

function redo(): void {
    if (state.redoStack.length === 0) return;
    const action = state.redoStack.pop()!;

    switch (action.type) {
        case "addNode":
            if (action.data.node) {
                state.nodes.push(action.data.node as PlaygroundNode);
            }
            break;
        case "removeNode":
            if (action.data.isClearAll) {
                state.nodes = [];
                state.wires = [];
                state.circuit.inputNodeIds = [];
                state.circuit.outputNodeIds = [];
            } else if (action.data.node) {
                state.nodes = state.nodes.filter(n => n.id !== (action.data.node as PlaygroundNode).id);
                state.wires = state.wires.filter(w => w.sourceNodeId !== (action.data.node as PlaygroundNode).id && w.targetNodeId !== (action.data.node as PlaygroundNode).id);
            }
            break;
        case "addWire":
            if (action.data.wire) {
                state.wires.push(action.data.wire as Wire);
            }
            break;
        case "removeWire":
            state.wires = state.wires.filter(w => w.id !== (action.data.wire as Wire).id);
            break;
        case "moveNode": {
            const redoNode = state.nodes.find(n => n.id === action.data.nodeId);
            if (redoNode) {
                redoNode.x = action.data.toX as number;
                redoNode.y = action.data.toY as number;
            }
            break;
        }
        case "changeConfig": {
            const cfgNode = state.nodes.find(n => n.id === action.data.nodeId);
            if (cfgNode) {
                cfgNode.config = { ...cfgNode.config, ...(action.data.newConfig as Record<string, unknown>) };
                runSimulation();
            }
            break;
        }
    }

    state.undoStack.push(action as any);
    updateStatusCounts();
    render();
}

/* ------------------------------------------------------------------ */
/* SIMULATION                                                          */
/* ------------------------------------------------------------------ */

let justToggled = false;
let simTimer: ReturnType<typeof setInterval> | null = null;

function startSimulation(): void {
    if (simTimer) clearInterval(simTimer);
    simTimer = setInterval(() => {
        runSimulation();
        recordSample(waveformState, state.nodes, state.wires, state.nodeValues);
        drawWaveformPanel();
    }, 500);
}

function runSimulation(): void {
    const inputStates = new Map<string, boolean>();
    for (const node of state.nodes) {
        if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
            inputStates.set(node.id, state.nodeValues.get(node.id) ?? false);
        }
    }

    // Handle clock nodes
    for (const node of state.nodes) {
        if (node.type === "CLOCK") {
            const freq = node.config?.frequency ?? 1;
            const time = Date.now() / 1000;
            const val = Math.sin(2 * Math.PI * freq * time) > 0;
            inputStates.set(node.id, val);
            state.nodeValues.set(node.id, val);
        }
    }

    const result = simulateCircuit(state.nodes, state.wires, inputStates);

    // Update node values
    for (const [id, val] of result.nodeValues) {
        state.nodeValues.set(id, val);
    }

    render();
}

/* ------------------------------------------------------------------ */
/* RENDERING                                                           */
/* ------------------------------------------------------------------ */

function render(): void {
    const canvas = byId("w4Canvas");
    const svgWidth = Math.max(2000, window.innerWidth);
    const svgHeight = Math.max(1500, window.innerHeight);

    let svg = `<svg class="w4-svg" xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}"
        viewBox="0 0 ${svgWidth} ${svgHeight}"
        style="transform: translate(${state.panX}px, ${state.panY}px) scale(${state.zoom}); transform-origin: 0 0;">`;

    // Grid background
    svg += `<defs>
        <pattern id="w4-grid" width="${GRID_SIZE}" height="${GRID_SIZE}" patternUnits="userSpaceOnUse">
            <path d="M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}" fill="none" stroke="var(--w4-grid, rgba(255,255,255,0.03))" stroke-width="0.5"/>
        </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#w4-grid)"/>`;

    // Wires
    for (const wire of state.wires) {
        const sourceNode = state.nodes.find(n => n.id === wire.sourceNodeId);
        const targetNode = state.nodes.find(n => n.id === wire.targetNodeId);
        if (!sourceNode || !targetNode) continue;
        svg += renderWire(wire, sourceNode, targetNode, wire.sourcePort, wire.targetPort, wire.value);
    }

    // Wire preview
    if (state.wireDrawing) {
        svg += renderWirePreview(
            state.wireDrawing.startX,
            state.wireDrawing.startY,
            state.wireDrawing.currentX,
            state.wireDrawing.currentY
        );
    }

    // Nodes
    for (const node of state.nodes) {
        const val = state.nodeValues.get(node.id);
        const isSelected = state.selectedNodeIds.has(node.id);
        svg += renderGateSVG(node, val, isSelected);
        svg += renderPorts(node, val, SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type));
    }

    // Wire values
    svg += renderWireValues(state.wires, state.nodes, new Map(Array.from(state.nodeValues).map(([k, v]) => [k, v])));

    svg += `</svg>`;
    canvas.innerHTML = svg;

    // Update zoom display
    byId("w4StatusZoom").textContent = `Zoom: ${Math.round(state.zoom * 100)}%`;
}

function resizeCanvas(): void {
    const canvas = byId("w4Canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    render();
}

function setZoom(z: number): void {
    state.zoom = Math.max(0.3, Math.min(3.0, z));
    render();
}

function fitToScreen(): void {
    if (state.nodes.length === 0) {
        state.zoom = 1;
        state.panX = 0;
        state.panY = 0;
        render();
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of state.nodes) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + node.width);
        maxY = Math.max(maxY, node.y + node.height);
    }

    const canvas = byId("w4Canvas");
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const margin = 60;

    const scaleX = (cw - 2 * margin) / (maxX - minX || 1);
    const scaleY = (ch - 2 * margin) / (maxY - minY || 1);
    state.zoom = Math.min(scaleX, scaleY, 2.0);

    state.panX = (cw - (maxX - minX) * state.zoom) / 2 - minX * state.zoom;
    state.panY = (ch - (maxY - minY) * state.zoom) / 2 - minY * state.zoom;

    render();
}

/* ------------------------------------------------------------------ */
/* SAVE / LOAD                                                         */
/* ------------------------------------------------------------------ */

function saveCircuit(): void {
    const circuit: CircuitFile = {
        id: state.circuit.id,
        name: state.circuit.name,
        version: 1,
        nodes: state.nodes,
        wires: state.wires,
        inputNodeIds: state.circuit.inputNodeIds,
        outputNodeIds: state.circuit.outputNodeIds,
        savedAt: new Date().toISOString(),
    };
    saveToLocalStorage(circuit);
    showToast("Circuit saved!", "success");
}

function loadCircuitDialog(): void {
    const saved = loadFromLocalStorage();
    if (saved) {
        loadCircuit(saved);
    } else {
        showToast("No saved circuit found.", "info");
    }
}

function exportCircuit(): void {
    const circuit: CircuitFile = {
        id: state.circuit.id,
        name: state.circuit.name,
        version: 1,
        nodes: state.nodes,
        wires: state.wires,
        inputNodeIds: state.circuit.inputNodeIds,
        outputNodeIds: state.circuit.outputNodeIds,
        savedAt: new Date().toISOString(),
    };
    exportAsJSON(circuit);
}

function importCircuitDialog(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const circuit = await importFromFile(file);
        if (circuit) {
            loadCircuit(circuit);
        } else {
            showToast("Invalid circuit file.", "error");
        }
    };
    input.click();
}

function loadCircuit(circuit: CircuitFile): void {
    state.nodes = circuit.nodes || [];
    state.wires = circuit.wires || [];
    state.circuit.id = circuit.id;
    state.circuit.name = circuit.name;
    state.circuit.inputNodeIds = circuit.inputNodeIds || [];
    state.circuit.outputNodeIds = circuit.outputNodeIds || [];
    state.selectedNodeIds.clear();
    state.nodeValues.clear();

    // Initialize input states
    for (const node of state.nodes) {
        if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
            state.nodeValues.set(node.id, false);
        }
    }

    updateStatusCounts();
    runSimulation();
}

/* ------------------------------------------------------------------ */
/* WAVEFORM                                                            */
/* ------------------------------------------------------------------ */

let lastWaveformW = 0;
let lastWaveformH = 0;

function drawWaveformPanel(): void {
    const canvas = byId<HTMLCanvasElement>("w4WaveformCanvas");
    if (!canvas) return;

    // Resize canvas only when container size changes
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
        const dpr = window.devicePixelRatio || 1;
        const displayW = Math.max(100, rect.width - 20);
        const displayH = Math.max(100, rect.height - 10);

        // Only resize if dimensions actually changed
        if (displayW !== lastWaveformW || displayH !== lastWaveformH) {
            lastWaveformW = displayW;
            lastWaveformH = displayH;
            canvas.width = displayW * dpr;
            canvas.height = displayH * dpr;
            canvas.style.width = displayW + "px";
            canvas.style.height = displayH + "px";
        }

        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, displayW, displayH);
        }
    }

    const signalNames = getSignalNames(state.nodes);
    const w = lastWaveformW || 300;
    const h = lastWaveformH || 150;
    drawWaveform(canvas, waveformState, signalNames, w, h);
}

/* ------------------------------------------------------------------ */
/* PROBE HOVER                                                         */
/* ------------------------------------------------------------------ */

function setupProbeHover(): void {
    const wrapper = byId<HTMLElement>("w4Canvas");
    const svg = wrapper?.querySelector("svg");
    const tooltip = byId<HTMLElement>("w4ProbeTooltip");
    if (!svg || !tooltip) return;

    svg.addEventListener("mousemove", (e: MouseEvent) => {
        const target = e.target as SVGElement;
        if (!wrapper) return;

        // Check if hovering over a gate group
        const gateGroup = target.closest("g[data-node-id]");
        if (gateGroup) {
            const nodeId = gateGroup.getAttribute("data-node-id")!;
            const node = state.nodes.find(n => n.id === nodeId);
            if (node) {
                const val = state.nodeValues.get(nodeId);
                const valClass = val ? "probe-value-1" : "probe-value-0";
                tooltip.innerHTML = `<span class="probe-label">${node.label || node.type}</span> = <span class="${valClass}">${val ? "1" : "0"}</span>`;
                positionTooltip(tooltip, wrapper, e);
                tooltip.style.display = "";
                return;
            }
        }

        // Check if hovering over a wire
        const wireLine = target.closest("line.w4-wire, path.w4-wire");
        if (wireLine) {
            const wireId = wireLine.getAttribute("data-wire-id");
            if (wireId) {
                const wire = state.wires.find(w => w.id === wireId);
                if (wire) {
                    const srcNode = state.nodes.find(n => n.id === wire.sourceNodeId);
                    const val = state.nodeValues.get(wire.sourceNodeId);
                    const valClass = val ? "probe-value-1" : "probe-value-0";
                    tooltip.innerHTML = `<span class="probe-label">Wire ${srcNode?.label || wire.sourceNodeId}</span> = <span class="${valClass}">${val ? "1" : "0"}</span>`;
                    positionTooltip(tooltip, wrapper, e);
                    tooltip.style.display = "";
                    return;
                }
            }
        }

        // Not hovering over anything interactive — hide tooltip
        tooltip.style.display = "none";
    });

    svg.addEventListener("mouseleave", () => {
        tooltip.style.display = "none";
    });
}

function positionTooltip(tooltip: HTMLElement, wrapper: HTMLElement, e: MouseEvent): void {
    const rect = wrapper.getBoundingClientRect();
    let x = e.clientX - rect.left + 12;
    let y = e.clientY - rect.top - 30;
    // Keep tooltip within wrapper bounds
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (x + tw > rect.width) x = e.clientX - rect.left - tw - 8;
    if (y < 0) y = e.clientY - rect.top + 16;
    if (y + th > rect.height) y = rect.height - th - 4;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
}

/* ------------------------------------------------------------------ */
/* KEYBOARD SHORTCUTS                                                  */
/* ------------------------------------------------------------------ */

function setupKeyboard(): void {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (shouldIgnoreKeyEvent(e.target)) {
            // Special case: Enter in text input triggers solve (not applicable here, but kept for parity)
            return;
        }

        const shortcut = resolveShortcut(e);
        if (!shortcut) return;

        e.preventDefault();

        switch (shortcut.description) {
            case "Select mode":     setMode("select"); break;
            case "Wire mode":       setMode("wire"); break;
            case "Delete mode":     setMode("delete"); break;
            case "Delete selected":
                for (const id of state.selectedNodeIds) deleteNode(id);
                break;
            case "Undo":            undo(); break;
            case "Redo":            redo(); break;
            case "Save":            saveCircuit(); break;
            case "Cancel / Deselect":
                state.wireDrawing = null;
                state.selectedNodeIds.clear();
                render();
                break;
            case "Toggle waveform pause":
                waveformState.isPaused = !waveformState.isPaused;
                break;
            case "Scroll to manual":
                document.getElementById("w4Manual")?.scrollIntoView({ behavior: "smooth" });
                break;
        }
    });
}



/* ------------------------------------------------------------------ */
/* STATUS                                                              */
/* ------------------------------------------------------------------ */

function updateStatusCounts(): void {
    byId("w4StatusNodes").textContent = `Nodes: ${state.nodes.length} | Wires: ${state.wires.length}`;
}

/* ------------------------------------------------------------------ */
/* START                                                               */
/* ------------------------------------------------------------------ */

document.addEventListener("DOMContentLoaded", init);

/* ------------------------------------------------------------------ */
/* TOAST NOTIFICATIONS                                                 */
/* ------------------------------------------------------------------ */

const showToast = createToastEmitter("w4ToastContainer");
