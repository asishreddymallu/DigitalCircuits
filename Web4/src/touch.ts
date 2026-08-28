/**
 * Touch event handlers for the Web4 Digital Logic Playground.
 *
 * Provides tablet/mobile support by mapping touch interactions to the same
 * logical operations as mouse events:
 *   - Single tap → select / toggle source / start+complete wire
 *   - Touch drag on node → move node
 *   - Touch drag on empty canvas → pan
 *   - Touch drag from output port → draw wire
 *   - Pinch → zoom
 *   - Double tap → toggle source / configure constant
 *
 * All coordinates are converted to the same (mx, my) workspace space
 * that the mouse handlers use, so existing hit-test and state logic
 * works unchanged.
 */

import type { AppState } from "./state";
import type { PlaygroundNode, Wire, DragMode } from "./types";
import type { GateType } from "../../shared/ts/circuit/gates";

export interface TouchDeps {
    state: AppState;
    byId: (id: string) => HTMLElement | null;
    hitTestNode: (mx: number, my: number) => PlaygroundNode | null;
    hitTestPort: (mx: number, my: number) => { nodeId: string; portType: "input" | "output"; portIndex: number; x: number; y: number } | null;
    hitTestWire: (mx: number, my: number) => Wire | null;
    toggleSourceNode: (node: PlaygroundNode) => void;
    deleteNode: (id: string) => void;
    deleteWire: (wire: Wire) => void;
    setZoom: (z: number) => void;
    render: () => void;
    runSimulation: () => void;
    pushUndo: (action: { type: string; data: Record<string, unknown>; timestamp: number }) => void;
    addNodeAt: (type: GateType, x: number, y: number, label?: string) => void;
    currentMode: () => DragMode;
    snapToGrid: (v: number) => number;
    justToggledRef: { value: boolean };
}

interface TouchPoint {
    x: number;
    y: number;
    time: number;
}

/**
 * Set up all touch event listeners on the canvas wrapper.
 */
export function setupTouchHandlers(deps: TouchDeps): void {
    const { state, byId } = deps;
    const canvas = byId("w4Canvas");
    if (!canvas) return;

    // Touch state
    let activeTouchId: number | null = null;
    let lastTouch: TouchPoint | null = null;
    let dragStartPos = { x: 0, y: 0 };
    let hasMoved = false;
    let pinchDist = 0;
    let pinchZoom = 1;

    function canvasCoords(touch: Touch): { mx: number; my: number } {
        const rect = canvas!.getBoundingClientRect();
        return {
            mx: (touch.clientX - rect.left - state.panX) / state.zoom,
            my: (touch.clientY - rect.top - state.panY) / state.zoom,
        };
    }

    function screenToCanvas(touch: Touch): { x: number; y: number } {
        const rect = canvas!.getBoundingClientRect();
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }

    canvas.addEventListener("touchstart", (e: TouchEvent) => {
        // Don't interfere with scrolling if not on canvas
        if (e.target !== canvas && !(e.target as Element).closest(".w4-canvas-wrapper")) return;

        const touches = e.touches;

        if (touches.length === 2) {
            // Pinch start
            e.preventDefault();
            const t0 = screenToCanvas(touches[0]);
            const t1 = screenToCanvas(touches[1]);
            pinchDist = Math.hypot(t1.x - t0.x, t1.y - t0.y);
            pinchZoom = state.zoom;
            return;
        }

        if (touches.length !== 1) return;

        const touch = touches[0];
        activeTouchId = touch.identifier;
        const { mx, my } = canvasCoords(touch);
        lastTouch = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        hasMoved = false;

        const mode = deps.currentMode();

        if (mode === "select" || mode === "move") {
            const hitNode = deps.hitTestNode(mx, my);

            if (hitNode) {
                e.preventDefault(); // Prevent scroll when touching a node
                state.selectedNodeIds.clear();
                state.selectedNodeIds.add(hitNode.id);

                state.draggedNodeId = hitNode.id;
                state.dragOffset = { x: mx - hitNode.x, y: my - hitNode.y };
                dragStartPos = { x: hitNode.x, y: hitNode.y };
                state.dragMode = "move" as DragMode;
            } else {
                state.selectedNodeIds.clear();
                state.dragMode = "pan" as DragMode;
            }
        } else if (mode === "wire") {
            const hitPort = deps.hitTestPort(mx, my);
            if (hitPort && hitPort.portType === "output") {
                e.preventDefault();
                state.wireDrawing = {
                    sourceNodeId: hitPort.nodeId,
                    sourcePort: hitPort.portIndex,
                    startX: hitPort.x,
                    startY: hitPort.y,
                    currentX: hitPort.x,
                    currentY: hitPort.y,
                };
            } else if (state.wireDrawing) {
                // Cancel wire drawing
                state.wireDrawing = null;
                deps.render();
            }
        } else if (mode === "delete") {
            e.preventDefault();
            const hitNode = deps.hitTestNode(mx, my);
            if (hitNode) {
                deps.deleteNode(hitNode.id);
                return;
            }
            const hitWire = deps.hitTestWire(mx, my);
            if (hitWire) {
                deps.deleteWire(hitWire as Wire);
            }
        }
    }, { passive: false });

    canvas.addEventListener("touchmove", (e: TouchEvent) => {
        const touches = e.touches;

        // Handle pinch
        if (touches.length === 2) {
            e.preventDefault();
            const t0 = screenToCanvas(touches[0]);
            const t1 = screenToCanvas(touches[1]);
            const newDist = Math.hypot(t1.x - t0.x, t1.y - t0.y);
            if (pinchDist > 0) {
                const scale = newDist / pinchDist;
                deps.setZoom(pinchZoom * scale);
            }
            return;
        }

        if (touches.length !== 1) return;
        const touch = touches[0];
        if (touch.identifier !== activeTouchId) return;

        const { mx, my } = canvasCoords(touch);
        const dx = touch.clientX - (lastTouch?.x ?? touch.clientX);
        const dy = touch.clientY - (lastTouch?.y ?? touch.clientY);

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            hasMoved = true;
        }

        if (state.dragMode === "pan") {
            e.preventDefault(); // Prevent page scroll when panning
            state.panX += dx;
            state.panY += dy;
            deps.render();
        } else if (state.dragMode === "move" && state.draggedNodeId) {
            e.preventDefault();
            const node = state.nodes.find(n => n.id === state.draggedNodeId);
            if (node) {
                node.x = deps.snapToGrid(mx - state.dragOffset.x);
                node.y = deps.snapToGrid(my - state.dragOffset.y);
                deps.render();
            }
        } else if (state.wireDrawing) {
            e.preventDefault();
            state.wireDrawing.currentX = mx;
            state.wireDrawing.currentY = my;
            deps.render();
        }

        lastTouch = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }, { passive: false });

    canvas.addEventListener("touchend", (e: TouchEvent) => {
        // Find the touch that ended
        const endedTouch = Array.from(e.changedTouches).find(t => t.identifier === activeTouchId);
        if (!endedTouch) return;

        const { mx, my } = canvasCoords(endedTouch);
        const mode = deps.currentMode();

        // Complete wire drawing
        if (state.wireDrawing) {
            const hitPort = deps.hitTestPort(mx, my);
            if (hitPort && hitPort.portType === "input" && hitPort.nodeId !== state.wireDrawing.sourceNodeId) {
                const exists = state.wires.some(
                    w => w.targetNodeId === hitPort.nodeId && w.targetPort === hitPort.portIndex
                );
                if (!exists) {
                    const wire = {
                        id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        sourceNodeId: state.wireDrawing.sourceNodeId,
                        sourcePort: state.wireDrawing.sourcePort,
                        targetNodeId: hitPort.nodeId,
                        targetPort: hitPort.portIndex,
                        points: [],
                        value: false,
                    };
                    state.wires.push(wire);
                    deps.pushUndo({ type: "addWire", data: { wire }, timestamp: Date.now() });
                }
            }
            state.wireDrawing = null;
            deps.render();
        }

        // Handle tap (no significant movement)
        if (!hasMoved && state.draggedNodeId) {
            const node = state.nodes.find(n => n.id === state.draggedNodeId);
            if (node) {
                if ((node.type === "INPUT" || node.type === "SWITCH") && mode === "select") {
                    deps.toggleSourceNode(node);
                    deps.justToggledRef.value = true;
                    setTimeout(() => { deps.justToggledRef.value = false; }, 300);
                } else if (node.type === "CONST" && mode === "select") {
                    if (!node.config) node.config = {};
                    const oldValue = node.config.value ?? false;
                    node.config.value = !oldValue;
                    deps.pushUndo({
                        type: "changeConfig",
                        data: { nodeId: node.id, oldConfig: { value: oldValue }, newConfig: { value: !oldValue } },
                        timestamp: Date.now(),
                    });
                    deps.runSimulation();
                    deps.justToggledRef.value = true;
                    setTimeout(() => { deps.justToggledRef.value = false; }, 300);
                } else if (hasMoved) {
                    // Was a drag, record undo
                    deps.pushUndo({
                        type: "moveNode",
                        data: { nodeId: node.id, fromX: dragStartPos.x, fromY: dragStartPos.y, toX: node.x, toY: node.y },
                        timestamp: Date.now(),
                    });
                }
            }
        } else if (!hasMoved && state.dragMode === "move" && state.draggedNodeId) {
            // Drag ended without movement = tap on a non-toggleable node — just select it
        }

        state.draggedNodeId = null;
        state.dragMode = mode as DragMode;
        activeTouchId = null;
        lastTouch = null;
        deps.render();
    });

    // Handle touch cancel
    canvas.addEventListener("touchcancel", () => {
        state.wireDrawing = null;
        state.draggedNodeId = null;
        state.dragMode = deps.currentMode() as DragMode;
        activeTouchId = null;
        lastTouch = null;
        deps.render();
    });

    // Double-tap detection for source toggle
    let lastTapTime = 0;
    canvas.addEventListener("touchend", (e: TouchEvent) => {
        const now = Date.now();
        if (now - lastTapTime < 300) {
            // Double tap — toggle the node under the tap
            const touch = e.changedTouches[0];
            if (touch) {
                const { mx, my } = canvasCoords(touch);
                const hitNode = deps.hitTestNode(mx, my);
                if (hitNode) {
                    if (hitNode.type === "INPUT" || hitNode.type === "SWITCH") {
                        deps.toggleSourceNode(hitNode as PlaygroundNode);
                    } else if (hitNode.type === "CONST") {
                        const node = state.nodes.find(n => n.id === hitNode!.id);
                        if (node) {
                            if (!node.config) node.config = {};
                            node.config.value = !(node.config.value ?? false);
                            deps.runSimulation();
                            deps.render();
                        }
                    }
                }
            }
        }
        lastTapTime = now;
    });
}
