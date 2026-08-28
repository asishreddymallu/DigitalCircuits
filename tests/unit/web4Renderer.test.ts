/**
 * Tests for the Web4 Digital Logic Playground renderer.
 *
 * Covers:
 *   - Gate SVG generation for all gate types
 *   - Port rendering (input/output)
 *   - Wire orthogonal routing
 *   - Wire preview rendering
 *   - Wire value badges
 *   - Selection and value visual states
 */

import { describe, it, expect } from "vitest";
import {
    renderGateSVG,
    renderPorts,
    renderWire,
    renderWirePreview,
    renderWireValues,
} from "../../Web4/src/renderer";
import type { PlaygroundNode, Wire, PortPosition } from "../../Web4/src/types";
import type { GateType } from "../../shared/ts/circuit/gates";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function mkNode(
    id: string,
    type: GateType | string,
    x = 0,
    y = 0,
    label = "",
    inputPorts: PortPosition[] = [],
    outputPorts: PortPosition[] = [{ x: 80, y: 25, side: "right", index: 0 }],
    config?: { value?: boolean }
): PlaygroundNode {
    return {
        id, type: type as GateType, x, y, width: 80, height: 50, rotation: 0,
        label: label || type, config, inputPorts, outputPorts,
    };
}

function mkWire(id: string, src: string, tgt: string, srcPort = 0, tgtPort = 0): Wire {
    return { id, sourceNodeId: src, sourcePort: srcPort, targetNodeId: tgt, targetPort: tgtPort, points: [], value: false };
}

/* ================================================================== */
/* 1. renderGateSVG                                                    */
/* ================================================================== */

describe("renderGateSVG: all gate types", () => {
    const sourceTypes = ["INPUT", "SWITCH", "CONST", "CLOCK"];
    const logicTypes = ["AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "BUFFER"];
    const sinkTypes = ["OUTPUT", "LED"];

    it("source nodes produce valid SVG with data-node-id", () => {
        for (const type of sourceTypes) {
            const node = mkNode(`n_${type}`, type, 10, 20, type);
            const svg = renderGateSVG(node, false, false);
            expect(svg).toContain(`data-node-id=\"n_${type}\"`);
            expect(svg).toContain("w4-gate");
            expect(svg).toContain("w4-gate-body");
        }
    });

    it("logic gates produce valid SVG with label text", () => {
        for (const type of logicTypes) {
            const node = mkNode(`n_${type}`, type, 10, 20, type);
            const svg = renderGateSVG(node, false, false);
            expect(svg).toContain(`data-node-id=\"n_${type}\"`);
            expect(svg).toContain(type);
        }
    });

    it("sink nodes produce valid SVG", () => {
        for (const type of sinkTypes) {
            const node = mkNode(`n_${type}`, type, 10, 20, type);
            const svg = renderGateSVG(node, false, false);
            expect(svg).toContain(`data-node-id=\"n_${type}\"`);
        }
    });

    it("selected node uses accent stroke color", () => {
        const node = mkNode("n1", "AND", 0, 0, "AND");
        const svg = renderGateSVG(node, false, true);
        expect(svg).toContain("var(--w4-accent, #38bdf8)");
    });

    it("unselected node uses default stroke", () => {
        const node = mkNode("n1", "AND", 0, 0, "AND");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain("var(--w4-gate-stroke, #475569)");
    });

    it("node value 1 shows green badge for source types", () => {
        const node = mkNode("n1", "INPUT", 0, 0, "A");
        const svg = renderGateSVG(node, true, false);
        expect(svg).toContain("10b981"); // green color
        expect(svg).toContain(">1<");
    });

    it("node value 0 shows gray badge for source types", () => {
        const node = mkNode("n1", "INPUT", 0, 0, "A");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain(">0<");
    });

    it("NOT gate includes bubble circle", () => {
        const node = mkNode("n1", "NOT", 0, 0, "NOT");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain("<circle");
        expect(svg).toContain("<polygon");
    });

    it("NAND gate includes both body and bubble", () => {
        const node = mkNode("n1", "NAND", 0, 0, "NAND");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain("<path");
        expect(svg).toContain("<circle");
    });

    it("rotation transform is applied", () => {
        const node: PlaygroundNode = {
            id: "n1", type: "AND", x: 0, y: 0, width: 80, height: 60,
            rotation: 45, label: "AND", inputPorts: [], outputPorts: [],
        };
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain("rotate(45");
    });

    it("node with no rotation has no transform attribute", () => {
        const node = mkNode("n1", "AND", 0, 0, "AND");
        const svg = renderGateSVG(node, false, false);
        expect(svg).not.toContain("transform=");
    });

    it("special characters in label are escaped", () => {
        const node = mkNode("n1", "INPUT", 0, 0, "A&B<C>D");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain("A&amp;B&lt;C&gt;D");
    });
});

/* ================================================================== */
/* 2. renderPorts                                                      */
/* ================================================================== */

describe("renderPorts", () => {
    it("renders input ports for non-source nodes", () => {
        const node = mkNode("n1", "AND", 0, 0, "AND",
            [{ x: 0, y: 15, side: "left", index: 0 }, { x: 0, y: 45, side: "left", index: 1 }],
            [{ x: 80, y: 30, side: "right", index: 0 }]
        );
        const svg = renderPorts(node, undefined, false);
        expect(svg).toContain("w4-port-in");
        expect(svg).toContain("w4-port-out");
    });

    it("source nodes only show output ports", () => {
        const node = mkNode("n1", "INPUT", 0, 0, "A", [],
            [{ x: 80, y: 25, side: "right", index: 0 }]);
        const svg = renderPorts(node, undefined, true);
        expect(svg).toContain("w4-port-out");
        // Source nodes should not show input ports
        expect(svg).not.toContain("w4-port-in");
    });

    it("output/LED nodes only show input ports", () => {
        const node = mkNode("n1", "OUTPUT", 0, 0, "F",
            [{ x: 0, y: 25, side: "left", index: 0 }], []);
        const svg = renderPorts(node, undefined, false);
        expect(svg).toContain("w4-port-in");
        expect(svg).not.toContain("w4-port-out");
    });

    it("port color changes with value (high)", () => {
        const node = mkNode("n1", "AND", 0, 0, "AND",
            [{ x: 0, y: 15, side: "left", index: 0 }],
            [{ x: 80, y: 30, side: "right", index: 0 }]);
        const svg = renderPorts(node, true, false);
        expect(svg).toContain("10b981"); // green for high
    });

    it("port color is default when value is undefined", () => {
        const node = mkNode("n1", "AND", 0, 0, "AND",
            [{ x: 0, y: 15, side: "left", index: 0 }],
            [{ x: 80, y: 30, side: "right", index: 0 }]);
        const svg = renderPorts(node, undefined, false);
        expect(svg).toContain("w4-port-stroke");
    });
});

/* ================================================================== */
/* 3. renderWire                                                       */
/* ================================================================== */

describe("renderWire: orthogonal routing", () => {
    it("produces valid SVG path", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 0, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }],
            [{ x: 80, y: 30, side: "right", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");

        const svg = renderWire(wire, src, tgt, 0, 0, false);
        expect(svg).toContain("<path");
        expect(svg).toContain("w4-wire");
        expect(svg).toContain("data-wire-id=\"w1\"");
        expect(svg).toContain("data-source=\"src\"");
        expect(svg).toContain("data-target=\"tgt\"");
    });

    it("wire value 1 uses high color", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 0, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");
        const svg = renderWire(wire, src, tgt, 0, 0, true);
        expect(svg).toContain("10b981");
    });

    it("wire value 0 uses low color", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 0, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");
        const svg = renderWire(wire, src, tgt, 0, 0, false);
        expect(svg).toContain("475569");
    });

    it("returns empty string when source port missing", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A", [], []);
        const tgt = mkNode("tgt", "AND", 200, 0, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");
        const svg = renderWire(wire, src, tgt, 0, 0, false);
        expect(svg).toBe("");
    });

    it("returns empty string when target port missing", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 0, "AND", []);
        const wire = mkWire("w1", "src", "tgt");
        const svg = renderWire(wire, src, tgt, 0, 0, false);
        expect(svg).toBe("");
    });

    it("orthogonal path uses H and V segments", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 50, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");
        const svg = renderWire(wire, src, tgt, 0, 0, false);
        // Path should have M, H, V, H commands
        expect(svg).toMatch(/M \d+ \d+ H \d+ V \d+ H \d+/);
    });
});

/* ================================================================== */
/* 4. renderWirePreview                                                */
/* ================================================================== */

describe("renderWirePreview", () => {
    it("produces dashed preview path", () => {
        const svg = renderWirePreview(100, 50, 300, 150);
        expect(svg).toContain("w4-wire-preview");
        expect(svg).toContain("stroke-dasharray");
        expect(svg).toContain("pointer-events=\"none\"");
        expect(svg).toContain("<path");
    });

    it("preview path uses accent color", () => {
        const svg = renderWirePreview(0, 0, 100, 100);
        expect(svg).toContain("var(--w4-accent, #38bdf8)");
    });

    it("orthogonal routing in preview", () => {
        const svg = renderWirePreview(10, 20, 200, 80);
        expect(svg).toMatch(/M 10 20 H \d+ V 80 H 200/);
    });
});

/* ================================================================== */
/* 5. renderWireValues                                                 */
/* ================================================================== */

describe("renderWireValues", () => {
    it("renders value badges at wire midpoints", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 0, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");
        const wireValues = new Map([["w1", true]]);

        const svg = renderWireValues([wire], [src, tgt], wireValues);
        expect(svg).toContain("w4-wire-value");
        expect(svg).toContain(">1<");
    });

    it("value 0 badge uses gray color", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 0, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");
        const wireValues = new Map([["w1", false]]);

        const svg = renderWireValues([wire], [src, tgt], wireValues);
        expect(svg).toContain(">0<");
    });

    it("skips wires with missing source or target node", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const wire = mkWire("w1", "src", "missing", 0, 0);
        const wireValues = new Map([["w1", true]]);

        const svg = renderWireValues([wire], [src], wireValues);
        expect(svg).toBe("");
    });

    it("skips wires with missing ports", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A", [], []);
        const tgt = mkNode("tgt", "AND", 200, 0, "AND", []);
        const wire = mkWire("w1", "src", "tgt", 0, 0);
        const wireValues = new Map([["w1", true]]);

        const svg = renderWireValues([wire], [src, tgt], wireValues);
        expect(svg).toBe("");
    });

    it("defaults to false when wire value not in map", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt = mkNode("tgt", "AND", 200, 0, "AND",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const wire = mkWire("w1", "src", "tgt");
        const wireValues = new Map<string, boolean>();

        const svg = renderWireValues([wire], [src, tgt], wireValues);
        expect(svg).toContain(">0<");
    });

    it("multiple wires get separate badges", () => {
        const src = mkNode("src", "INPUT", 0, 0, "A");
        const tgt1 = mkNode("t1", "AND", 200, 0, "AND1",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const tgt2 = mkNode("t2", "AND", 200, 80, "AND2",
            [{ x: 0, y: 30, side: "left", index: 0 }]);
        const w1 = mkWire("w1", "src", "t1");
        const w2 = mkWire("w2", "src", "t2");
        const wireValues = new Map([["w1", true], ["w2", false]]);

        const svg = renderWireValues([w1, w2], [src, tgt1, tgt2], wireValues);
        const matches = svg.match(/w4-wire-value/g);
        expect(matches?.length).toBe(2);
    });
});

/* ================================================================== */
/* 6. Complex gate rendering                                           */
/* ================================================================== */

describe("renderGateSVG: complex gates", () => {
    it("AND gate renders with D-shaped body path and type label", () => {
        const node = mkNode("n1", "AND", 50, 50, "AND1");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain("<path");
        expect(svg).toContain(">AND<");
    });

    it("OR gate renders with curved path and type label", () => {
        const node = mkNode("n1", "OR", 50, 50, "OR1");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain("<path");
        expect(svg).toContain(">OR<");
    });

    it("XOR gate renders with type label", () => {
        const node = mkNode("n1", "XOR", 50, 50, "XOR1");
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain(">XOR<");
    });

    it("CONST gate with value true shows 1", () => {
        const node = mkNode("n1", "CONST", 0, 0, "C1", [], [],
            { value: true });
        const svg = renderGateSVG(node, true, false);
        expect(svg).toContain(">1<");
    });

    it("CONST gate with value false shows 0", () => {
        const node = mkNode("n1", "CONST", 0, 0, "C1", [], [],
            { value: false });
        const svg = renderGateSVG(node, false, false);
        expect(svg).toContain(">0<");
    });

    it("LED with value 1 has glow effect", () => {
        const node = mkNode("n1", "OUTPUT", 0, 0, "F",
            [{ x: 0, y: 25, side: "left", index: 0 }], []);
        const svg = renderGateSVG(node, true, false);
        // Should have two circles (base + glow)
        const circles = svg.match(/<circle/g);
        expect(circles?.length).toBe(2);
    });

    it("LED with value 0 has single circle (no glow)", () => {
        const node = mkNode("n1", "OUTPUT", 0, 0, "F",
            [{ x: 0, y: 25, side: "left", index: 0 }], []);
        const svg = renderGateSVG(node, false, false);
        const circles = svg.match(/<circle/g);
        expect(circles?.length).toBe(1);
    });
});
