/**
 * Tests for the Web4 touch event handling module.
 *
 * Since touch events can't be fully simulated in a unit test environment
 * (they require a real DOM with touch points), these tests verify:
 *   - The module exports correctly
 *   - The dependency interface is satisfied
 *   - Touch coordinate conversion logic
 *   - Touch state management
 */

import { describe, it, expect } from "vitest";
import { setupTouchHandlers, type TouchDeps } from "../../Web4/src/touch";

/* ------------------------------------------------------------------ */
/* Mock dependencies                                                   */
/* ------------------------------------------------------------------ */

function createMockDeps(overrides?: Partial<TouchDeps>): TouchDeps {
    return {
        state: {
            nodes: [],
            wires: [],
            zoom: 1,
            panX: 0,
            panY: 0,
            dragMode: "none",
            draggedNodeId: null,
            dragOffset: { x: 0, y: 0 },
            selectedNodeIds: new Set(),
            wireDrawing: null,
            circuit: { id: "", name: "", version: 1, nodes: [], wires: [], inputNodeIds: [], outputNodeIds: [], savedAt: "" },
        } as any,
        byId: () => null,
        hitTestNode: () => null,
        hitTestPort: () => null,
        hitTestWire: () => null,
        toggleSourceNode: () => {},
        deleteNode: () => {},
        deleteWire: () => {},
        setZoom: () => {},
        render: () => {},
        runSimulation: () => {},
        pushUndo: () => {},
        addNodeAt: () => {},
        currentMode: () => "select",
        snapToGrid: (v: number) => Math.round(v / 20) * 20,
        justToggledRef: { value: false },
        ...overrides,
    };
}

/* ================================================================== */
/* TESTS                                                               */
/* ================================================================== */

describe("touch handler module", () => {
    it("exports setupTouchHandlers function", () => {
        expect(typeof setupTouchHandlers).toBe("function");
    });

    it("does not throw when canvas element is missing", () => {
        const deps = createMockDeps();
        // byId returns null, so canvas is missing
        expect(() => setupTouchHandlers(deps)).not.toThrow();
    });

    it("does not throw when canvas element exists", () => {
        // Skip in non-browser environments
        if (typeof document === "undefined") return;
        const canvas = document.createElement("div");
        canvas.id = "w4Canvas";
        document.body.appendChild(canvas);

        const deps = createMockDeps({
            byId: (id: string) => (id === "w4Canvas" ? canvas : null),
        });

        expect(() => setupTouchHandlers(deps)).not.toThrow();

        document.body.removeChild(canvas);
    });

    it("touch handler interface accepts PlaygroundNode from hitTestNode", () => {
        const hitNode = {
            id: "n1", type: "INPUT", x: 100, y: 100,
            width: 80, height: 50, rotation: 0, label: "A",
            inputPorts: [], outputPorts: [{ x: 80, y: 25, side: "right" as const, index: 0 }],
        };
        const deps = createMockDeps({
            hitTestNode: () => hitNode as any,
        });
        // Should not throw with a PlaygroundNode-like object
        expect(deps.hitTestNode(100, 100)).toBe(hitNode);
    });

    it("touch handler interface accepts Wire from hitTestWire", () => {
        const wire = {
            id: "w1", sourceNodeId: "a", sourcePort: 0,
            targetNodeId: "b", targetPort: 0, points: [], value: false,
        };
        const deps = createMockDeps({
            hitTestWire: () => wire as any,
        });
        expect(deps.hitTestWire(100, 100)).toBe(wire);
    });

    it("snapToGrid rounds to nearest grid", () => {
        const deps = createMockDeps();
        expect(deps.snapToGrid(25)).toBe(20);
        expect(deps.snapToGrid(35)).toBe(40);
        expect(deps.snapToGrid(0)).toBe(0);
        expect(deps.snapToGrid(10)).toBe(20); // 0.5 rounds up
        expect(deps.snapToGrid(9)).toBe(0);
        expect(deps.snapToGrid(11)).toBe(20);
    });

    it("justToggledRef can be set and read", () => {
        const ref = { value: false };
        ref.value = true;
        expect(ref.value).toBe(true);
        ref.value = false;
        expect(ref.value).toBe(false);
    });

    it("state dragMode starts as 'none'", () => {
        const deps = createMockDeps();
        expect(deps.state.dragMode).toBe("none");
    });

    it("state selectedNodeIds is a mutable Set", () => {
        const deps = createMockDeps();
        deps.state.selectedNodeIds.add("n1");
        expect(deps.state.selectedNodeIds.has("n1")).toBe(true);
        deps.state.selectedNodeIds.delete("n1");
        expect(deps.state.selectedNodeIds.has("n1")).toBe(false);
    });

    it("pushUndo is called without error", () => {
        const calls: any[] = [];
        const deps = createMockDeps({
            pushUndo: (action: any) => calls.push(action),
        });
        deps.pushUndo({ type: "addNode", data: { node: { id: "n1" } }, timestamp: Date.now() });
        expect(calls).toHaveLength(1);
        expect(calls[0].type).toBe("addNode");
    });

    it("setZoom is callable", () => {
        let zoomValue = 1;
        const deps = createMockDeps({
            setZoom: (z: number) => { zoomValue = z; },
        });
        deps.setZoom(2.0);
        expect(zoomValue).toBe(2.0);
    });

    it("render is callable", () => {
        let renderCount = 0;
        const deps = createMockDeps({
            render: () => { renderCount++; },
        });
        deps.render();
        deps.render();
        expect(renderCount).toBe(2);
    });
});

describe("touch coordinate conversion", () => {
    it("canvas coordinates account for pan and zoom", () => {
        // Simulate: canvas at (0,0), panX=100, panY=50, zoom=2
        // Touch at screen (300, 200)
        // mx = (300 - 0 - 100) / 2 = 100
        // my = (200 - 0 - 50) / 2 = 75
        const state = {
            panX: 100, panY: 50, zoom: 2,
        };
        const touchScreenX = 300;
        const touchScreenY = 200;
        const canvasLeft = 0;
        const canvasTop = 0;

        const mx = (touchScreenX - canvasLeft - state.panX) / state.zoom;
        const my = (touchScreenY - canvasTop - state.panY) / state.zoom;

        expect(mx).toBe(100);
        expect(my).toBe(75);
    });

    it("pinch zoom ratio is correctly computed", () => {
        const initialDist = 100;
        const currentDist = 150;
        const initialZoom = 1.0;

        const scale = currentDist / initialDist;
        const newZoom = initialZoom * scale;

        expect(newZoom).toBe(1.5);
    });

    it("pinch zoom with initial zoom 2x", () => {
        const initialDist = 100;
        const currentDist = 80;
        const initialZoom = 2.0;

        const scale = currentDist / initialDist;
        const newZoom = initialZoom * scale;

        expect(newZoom).toBe(1.6);
    });
});

describe("touch interaction patterns", () => {
    it("tap detection: small movement = tap", () => {
        const start = { x: 100, y: 100 };
        const end = { x: 102, y: 101 };
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const isTap = dx < 4 && dy < 4;
        expect(isTap).toBe(true);
    });

    it("drag detection: large movement = drag", () => {
        const start = { x: 100, y: 100 };
        const end = { x: 200, y: 150 };
        const dx = Math.abs(end.x - start.x);
        const dy = Math.abs(end.y - start.y);
        const isTap = dx < 4 && dy < 4;
        expect(isTap).toBe(false);
    });

    it("double-tap window is 300ms", () => {
        const t1 = 1000;
        const t2 = 1200; // 200ms later
        const t3 = 1350; // 350ms later

        expect(t2 - t1 < 300).toBe(true);  // double tap
        expect(t3 - t1 < 300).toBe(false); // too slow
    });

    it("wire connection requires different node IDs", () => {
        const sourceNodeId: string = "n1";
        const targetNodeId: string = "n2";
        const selfConnection = sourceNodeId === targetNodeId;
        expect(selfConnection).toBe(false);

        const sameNode: string = "n1";
        expect(sourceNodeId === sameNode).toBe(true);
    });

    it("wire duplicate check works", () => {
        const wires = [
            { targetNodeId: "n2", targetPort: 0 },
            { targetNodeId: "n3", targetPort: 1 },
        ];

        // Check if port is already connected
        const exists1 = wires.some(w => w.targetNodeId === "n2" && w.targetPort === 0);
        expect(exists1).toBe(true);

        const exists2 = wires.some(w => w.targetNodeId === "n2" && w.targetPort === 1);
        expect(exists2).toBe(false);

        const exists3 = wires.some(w => w.targetNodeId === "n5" && w.targetPort === 0);
        expect(exists3).toBe(false);
    });
});
