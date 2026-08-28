"use strict";
(() => {
  // shared/ts/circuit/gates.ts
  var SOURCE_TYPES = /* @__PURE__ */ new Set(["INPUT", "CONST", "CLOCK", "SWITCH"]);
  var TOGGLEABLE_TYPES = /* @__PURE__ */ new Set(["INPUT", "SWITCH"]);
  function evaluateGate(type, inputs, config) {
    switch (type) {
      case "INPUT":
      case "SWITCH":
      case "CLOCK":
        return inputs[0] ?? false;
      case "CONST":
        return config?.value ?? false;
      case "BUFFER":
        return inputs[0] ?? false;
      case "NOT":
        return !(inputs[0] ?? false);
      case "AND":
        return inputs.length > 0 && inputs.every(Boolean);
      case "OR":
        return inputs.some(Boolean);
      case "NAND":
        return !(inputs.length > 0 && inputs.every(Boolean));
      case "NOR":
        return !inputs.some(Boolean);
      case "XOR":
        return inputs.reduce((acc, v) => acc !== v, false);
      case "XNOR":
        return !inputs.reduce((acc, v) => acc !== v, false);
      case "OUTPUT":
      case "LED":
        return inputs[0] ?? false;
      default:
        return false;
    }
  }

  // Web4/src/types.ts
  var GRID_SIZE = 20;
  var GATE_SIZES = {
    INPUT: { width: 80, height: 50 },
    OUTPUT: { width: 80, height: 50 },
    CONST: { width: 70, height: 50 },
    CLOCK: { width: 80, height: 50 },
    SWITCH: { width: 80, height: 50 },
    LED: { width: 70, height: 50 },
    BUFFER: { width: 60, height: 50 },
    NOT: { width: 70, height: 50 },
    AND: { width: 80, height: 60 },
    OR: { width: 80, height: 60 },
    NAND: { width: 90, height: 60 },
    NOR: { width: 90, height: 60 },
    XOR: { width: 80, height: 60 },
    XNOR: { width: 90, height: 60 }
  };
  function getDefaultInputPorts(type, width, height) {
    const count = getInputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: 0, y: height / 2, side: "left", index: 0 }];
    const ports = [];
    for (let i = 0; i < count; i++) {
      const y = 15 + i * (height - 30) / (count - 1);
      ports.push({ x: 0, y, side: "left", index: i });
    }
    return ports;
  }
  function getDefaultOutputPorts(type, width, height) {
    const count = getOutputCount(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: width, y: height / 2, side: "right", index: 0 }];
    const ports = [];
    for (let i = 0; i < count; i++) {
      const y = 15 + i * (height - 30) / (count - 1);
      ports.push({ x: width, y, side: "right", index: i });
    }
    return ports;
  }
  function getInputCount(type) {
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
  function getOutputCount(type) {
    switch (type) {
      case "OUTPUT":
      case "LED":
        return 0;
      default:
        return 1;
    }
  }

  // Web4/src/state.ts
  var nextId = 0;
  function genId() {
    return `w4_${Date.now()}_${nextId++}`;
  }
  function createInitialState() {
    return {
      circuit: {
        id: genId(),
        name: "Untitled Circuit",
        version: 1,
        nodes: [],
        wires: [],
        inputNodeIds: [],
        outputNodeIds: [],
        savedAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      nodes: [],
      wires: [],
      zoom: 1,
      panX: 0,
      panY: 0,
      dragMode: "none",
      draggedNodeId: null,
      dragOffset: { x: 0, y: 0 },
      selectedNodeIds: /* @__PURE__ */ new Set(),
      selectionBox: null,
      wireDrawing: null,
      isRunning: true,
      simSpeed: 500,
      nodeValues: /* @__PURE__ */ new Map(),
      probes: [],
      undoStack: [],
      redoStack: [],
      clockInterval: null,
      clockState: false
    };
  }
  function createNode(type, x, y, label = "", config) {
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
      outputPorts: getDefaultOutputPorts(type, size.width, size.height)
    };
  }
  function snapToGrid(val) {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }

  // Web4/src/simulator.ts
  function simulateCircuit(nodes, wires, inputStates) {
    const nodeValues = /* @__PURE__ */ new Map();
    const wireValues = /* @__PURE__ */ new Map();
    const incomingWires = /* @__PURE__ */ new Map();
    for (const wire of wires) {
      if (!incomingWires.has(wire.targetNodeId)) {
        incomingWires.set(wire.targetNodeId, []);
      }
      incomingWires.get(wire.targetNodeId).push({
        sourceId: wire.sourceNodeId,
        sourcePort: wire.sourcePort,
        targetPort: wire.targetPort,
        wireId: wire.id
      });
    }
    const sorted = topologicalSort(nodes, wires);
    for (const node of sorted) {
      let value;
      if (node.type === "CONST") {
        value = node.config?.value ?? false;
      } else if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
        value = inputStates.get(node.id) ?? false;
      } else {
        const nodeIncoming = incomingWires.get(node.id) ?? [];
        const inputValues = [];
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
    for (const wire of wires) {
      if (!wireValues.has(wire.id)) {
        wireValues.set(wire.id, nodeValues.get(wire.sourceNodeId) ?? false);
      }
    }
    return { nodeValues, wireValues };
  }
  function topologicalSort(nodes, wires) {
    const inDegree = /* @__PURE__ */ new Map();
    const adjacency = /* @__PURE__ */ new Map();
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }
    for (const wire of wires) {
      adjacency.get(wire.sourceNodeId)?.push(wire.targetNodeId);
      inDegree.set(wire.targetNodeId, (inDegree.get(wire.targetNodeId) ?? 0) + 1);
    }
    const queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    const sorted = [];
    while (queue.length > 0) {
      const id = queue.shift();
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

  // Web4/src/renderer.ts
  function escSvg(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function renderGateSVG(node, nodeValue, isSelected) {
    const { x, y, width, height, type, label, rotation } = node;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const strokeColor = isSelected ? "var(--w4-accent, #38bdf8)" : "var(--w4-gate-stroke, #475569)";
    const fillColor = "var(--w4-gate-fill, #1e293b)";
    const textColor = "var(--w4-text, #f8fafc)";
    const transform = rotation ? `transform="rotate(${rotation}, ${cx}, ${cy})"` : "";
    let svg = `<g class="w4-gate" data-node-id="${node.id}" ${transform}>`;
    svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" ry="8"
        fill="${fillColor}" stroke="${strokeColor}" stroke-width="2" class="w4-gate-body"/>`;
    switch (type) {
      case "INPUT":
      case "SWITCH":
      case "CONST":
      case "CLOCK": {
        const val = nodeValue ? 1 : 0;
        const badgeColor = val ? "#10b981" : "#64748b";
        svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${textColor}">${escSvg(label)}</text>`;
        svg += `<rect x="${cx - 12}" y="${cy + 2}" width="24" height="18" rx="4" fill="${badgeColor}"/>`;
        svg += `<text x="${cx}" y="${cy + 15}" text-anchor="middle" font-size="12" font-weight="800" fill="white">${val}</text>`;
        break;
      }
      case "OUTPUT":
      case "LED": {
        const val = nodeValue ? 1 : 0;
        const ledColor = val ? "#10b981" : "#374151";
        svg += `<circle cx="${cx}" cy="${cy - 2}" r="14" fill="${ledColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        if (val) svg += `<circle cx="${cx}" cy="${cy - 2}" r="14" fill="${ledColor}" opacity="0.3"/>`;
        svg += `<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="10" font-weight="700" fill="${textColor}">${escSvg(label)}</text>`;
        break;
      }
      case "NOT": {
        const tx = x + 12;
        svg += `<polygon points="${tx},${y + 6} ${tx + width - 26},${cy} ${tx},${y + height - 6}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<circle cx="${x + width - 8}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx - 4}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="${textColor}">NOT</text>`;
        break;
      }
      case "AND": {
        svg += `<path d="M ${x + 10} ${y + 6} h ${width / 2 - 10} a ${height / 2 - 6} ${height / 2 - 6} 0 0 1 0 ${height - 12} h ${-(width / 2 - 10)} z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx - 2}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="${textColor}">AND</text>`;
        break;
      }
      case "OR": {
        svg += `<path d="M ${x + 10} ${y + 6} Q ${x + width * 0.35} ${cy} ${x + 10} ${y + height - 6} Q ${x + width * 0.6} ${y + height - 6} ${x + width - 10} ${cy} Q ${x + width * 0.6} ${y + 6} ${x + 10} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx + 2}" y="${cy + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="${textColor}">OR</text>`;
        break;
      }
      case "NAND": {
        svg += `<path d="M ${x + 10} ${y + 6} h ${width / 2 - 14} a ${height / 2 - 6} ${height / 2 - 6} 0 0 1 0 ${height - 12} h ${-(width / 2 - 14)} z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<circle cx="${x + width - 10}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx - 4}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${textColor}">NAND</text>`;
        break;
      }
      case "NOR": {
        svg += `<path d="M ${x + 10} ${y + 6} Q ${x + width * 0.3} ${cy} ${x + 10} ${y + height - 6} Q ${x + width * 0.55} ${y + height - 6} ${x + width - 14} ${cy} Q ${x + width * 0.55} ${y + 6} ${x + 10} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<circle cx="${x + width - 7}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx - 2}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${textColor}">NOR</text>`;
        break;
      }
      case "XOR": {
        svg += `<path d="M ${x + 14} ${y + 6} Q ${x + width * 0.35} ${cy} ${x + 14} ${y + height - 6} Q ${x + width * 0.6} ${y + height - 6} ${x + width - 10} ${cy} Q ${x + width * 0.6} ${y + 6} ${x + 14} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<path d="M ${x + 6} ${y + 4} Q ${x + 16} ${cy} ${x + 6} ${y + height - 4}" fill="none" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx + 4}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="${textColor}">XOR</text>`;
        break;
      }
      case "XNOR": {
        svg += `<path d="M ${x + 14} ${y + 6} Q ${x + width * 0.3} ${cy} ${x + 14} ${y + height - 6} Q ${x + width * 0.55} ${y + height - 6} ${x + width - 14} ${cy} Q ${x + width * 0.55} ${y + 6} ${x + 14} ${y + 6} Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<path d="M ${x + 6} ${y + 4} Q ${x + 16} ${cy} ${x + 6} ${y + height - 4}" fill="none" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<circle cx="${x + width - 7}" cy="${cy}" r="6" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="${textColor}">XNOR</text>`;
        break;
      }
      case "BUFFER": {
        svg += `<polygon points="${x + 12},${y + 6} ${x + width - 10},${cy} ${x + 12},${y + height - 6}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>`;
        svg += `<text x="${cx - 2}" y="${cy + 4}" text-anchor="middle" font-size="10" font-weight="800" fill="${textColor}">BUF</text>`;
        break;
      }
    }
    svg += `</g>`;
    return svg;
  }
  function renderPorts(node, nodeValue, isSource) {
    let svg = "";
    if (!isSource) {
      for (const port of node.inputPorts) {
        const px = node.x + port.x;
        const py = node.y + port.y;
        svg += `<circle cx="${px}" cy="${py}" r="5" class="w4-port w4-port-in" data-node-id="${node.id}" data-port-index="${port.index}" data-port-type="input"
                fill="var(--w4-port-fill, #0f172a)" stroke="var(--w4-port-stroke, #94a3b8)" stroke-width="1.5"/>`;
      }
    }
    for (const port of node.outputPorts) {
      const px = node.x + port.x;
      const py = node.y + port.y;
      const portColor = nodeValue ? "var(--w4-wire-high, #10b981)" : "var(--w4-port-stroke, #94a3b8)";
      svg += `<circle cx="${px}" cy="${py}" r="5" class="w4-port w4-port-out" data-node-id="${node.id}" data-port-index="${port.index}" data-port-type="output"
            fill="var(--w4-port-fill, #0f172a)" stroke="${portColor}" stroke-width="1.5"/>`;
    }
    return svg;
  }
  function renderWire(wire, sourceNode, targetNode, sourcePortIndex, targetPortIndex, wireValue) {
    const sp = sourceNode.outputPorts[sourcePortIndex];
    const tp = targetNode.inputPorts[targetPortIndex];
    if (!sp || !tp) return "";
    const sx = sourceNode.x + sp.x;
    const sy = sourceNode.y + sp.y;
    const tx = targetNode.x + tp.x;
    const ty = targetNode.y + tp.y;
    const midX = (sx + tx) / 2;
    const d = `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
    const wireColor = wireValue ? "var(--w4-wire-high, #10b981)" : "var(--w4-wire-low, #475569)";
    return `<path d="${d}" class="w4-wire" data-wire-id="${wire.id}" data-source="${wire.sourceNodeId}" data-target="${wire.targetNodeId}"
        stroke="${wireColor}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  }
  function renderWirePreview(sx, sy, tx, ty) {
    const midX = (sx + tx) / 2;
    const d = `M ${sx} ${sy} H ${midX} V ${ty} H ${tx}`;
    return `<path d="${d}" class="w4-wire-preview" stroke="var(--w4-accent, #38bdf8)" stroke-width="2" fill="none" stroke-dasharray="6,4" stroke-linecap="round" pointer-events="none"/>`;
  }
  function renderWireValues(wires, nodes, wireValues) {
    let svg = "";
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const wire of wires) {
      const sourceNode = nodeMap.get(wire.sourceNodeId);
      const targetNode = nodeMap.get(wire.targetNodeId);
      if (!sourceNode || !targetNode) continue;
      const sp = sourceNode.outputPorts[wire.sourcePort];
      const tp = targetNode.inputPorts[wire.targetPort];
      if (!sp || !tp) continue;
      const sx = sourceNode.x + sp.x;
      const sy = sourceNode.y + sp.y;
      const tx = targetNode.x + tp.x;
      const ty = targetNode.y + tp.y;
      const val = wireValues.get(wire.id) ?? false;
      const mx = (sx + tx) / 2;
      const my = (sy + ty) / 2;
      svg += `<g class="w4-wire-value" pointer-events="none">
            <rect x="${mx - 7}" y="${my - 8}" width="14" height="14" rx="3" fill="var(--w4-bg, #0f172a)" stroke="var(--w4-wire-low, #475569)" stroke-width="1"/>
            <text x="${mx}" y="${my + 2}" text-anchor="middle" font-size="9" font-weight="800" font-family="JetBrains Mono, monospace" fill="${val ? "#10b981" : "#64748b"}">${val ? "1" : "0"}</text>
        </g>`;
    }
    return svg;
  }

  // Web4/src/toolbar.ts
  var PALETTE_ITEMS = [
    { type: "INPUT", label: "Input", icon: "\u{1F4E5}", category: "sources" },
    { type: "SWITCH", label: "Switch", icon: "\u{1F518}", category: "sources" },
    { type: "CONST", label: "Constant", icon: "\u{1F522}", category: "sources" },
    { type: "CLOCK", label: "Clock", icon: "\u23F1\uFE0F", category: "sources" },
    { type: "AND", label: "AND", icon: "AND", category: "logic" },
    { type: "OR", label: "OR", icon: "OR", category: "logic" },
    { type: "NOT", label: "NOT", icon: "NOT", category: "logic" },
    { type: "NAND", label: "NAND", icon: "NAND", category: "logic" },
    { type: "NOR", label: "NOR", icon: "NOR", category: "logic" },
    { type: "XOR", label: "XOR", icon: "XOR", category: "logic" },
    { type: "XNOR", label: "XNOR", icon: "XNOR", category: "logic" },
    { type: "BUFFER", label: "Buffer", icon: "BUF", category: "logic" },
    { type: "OUTPUT", label: "Output", icon: "\u{1F4E4}", category: "sinks" },
    { type: "LED", label: "LED", icon: "\u{1F4A1}", category: "sinks" }
  ];
  function renderPalette() {
    const categories = [
      { name: "\u{1F4E5} Sources", key: "sources" },
      { name: "\u26A1 Logic Gates", key: "logic" },
      { name: "\u{1F4E4} Outputs", key: "sinks" }
    ];
    return categories.map((cat) => `
        <div class="w4-palette-category">
            <div class="w4-palette-category-title">${cat.name}</div>
            <div class="w4-palette-items">
                ${PALETTE_ITEMS.filter((item) => item.category === cat.key).map((item) => `
                    <button type="button" class="w4-palette-item" data-gate-type="${item.type}"
                        draggable="true" title="Drag to add ${item.label}">
                        <span class="w4-palette-icon">${item.icon}</span>
                        <span class="w4-palette-label">${item.label}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `).join("");
  }
  function renderToolbar() {
    return `
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn active" id="w4ToolSelect" title="Select mode (V)" data-mode="select">
                <span>\u2196</span> Select
            </button>
            <button type="button" class="w4-tool-btn" id="w4ToolWire" title="Wire mode (W)" data-mode="wire">
                <span>\u26A1</span> Wire
            </button>
            <button type="button" class="w4-tool-btn" id="w4ToolDelete" title="Delete mode (D)" data-mode="delete">
                <span>\u{1F5D1}</span> Delete
            </button>
        </div>
        <div class="w4-toolbar-separator"></div>
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn" id="w4UndoBtn" title="Undo (Ctrl+Z)">\u21B6 Undo</button>
            <button type="button" class="w4-tool-btn" id="w4RedoBtn" title="Redo (Ctrl+Shift+Z)">\u21B7 Redo</button>
        </div>
        <div class="w4-toolbar-separator"></div>
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn" id="w4SaveBtn" title="Save (Ctrl+S)">\u{1F4BE} Save</button>
            <button type="button" class="w4-tool-btn" id="w4LoadBtn" title="Load">\u{1F4C2} Load</button>
            <button type="button" class="w4-tool-btn" id="w4ExportBtn" title="Export JSON">\u{1F4E4} Export</button>
            <button type="button" class="w4-tool-btn" id="w4ImportBtn" title="Import JSON">\u{1F4E5} Import</button>
            <button type="button" class="w4-tool-btn" id="w4TruthTableBtn" title="Import from Truth Table">\u{1F4CB} Truth Table</button>
            <button type="button" class="w4-tool-btn" id="w4ClearBtn" title="Clear all">\u{1F5D1} Clear</button>
        </div>
        <div class="w4-toolbar-separator"></div>
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn" id="w4ZoomInBtn" title="Zoom In">\u{1F50D}+</button>
            <button type="button" class="w4-tool-btn" id="w4ZoomOutBtn" title="Zoom Out">\u{1F50D}\u2212</button>
            <button type="button" class="w4-tool-btn" id="w4ZoomFitBtn" title="Fit to Screen">\u229E Fit</button>
        </div>
    `;
  }
  function renderStatusBar() {
    return `
        <div class="w4-status-item" id="w4StatusMode">Mode: Select</div>
        <div class="w4-status-item" id="w4StatusNodes">Nodes: 0</div>
        <div class="w4-status-item" id="w4StatusZoom">Zoom: 100%</div>
        <div class="w4-status-item" id="w4StatusCoords">X: 0, Y: 0</div>
    `;
  }

  // Web4/src/touch.ts
  function setupTouchHandlers(deps) {
    const { state: state2, byId: byId2 } = deps;
    const canvas = byId2("w4Canvas");
    if (!canvas) return;
    let activeTouchId = null;
    let lastTouch = null;
    let dragStartPos = { x: 0, y: 0 };
    let hasMoved = false;
    let pinchDist = 0;
    let pinchZoom = 1;
    function canvasCoords(touch) {
      const rect = canvas.getBoundingClientRect();
      return {
        mx: (touch.clientX - rect.left - state2.panX) / state2.zoom,
        my: (touch.clientY - rect.top - state2.panY) / state2.zoom
      };
    }
    function screenToCanvas(touch) {
      const rect = canvas.getBoundingClientRect();
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    canvas.addEventListener("touchstart", (e) => {
      if (e.target !== canvas && !e.target.closest(".w4-canvas-wrapper")) return;
      const touches = e.touches;
      if (touches.length === 2) {
        e.preventDefault();
        const t0 = screenToCanvas(touches[0]);
        const t1 = screenToCanvas(touches[1]);
        pinchDist = Math.hypot(t1.x - t0.x, t1.y - t0.y);
        pinchZoom = state2.zoom;
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
          e.preventDefault();
          state2.selectedNodeIds.clear();
          state2.selectedNodeIds.add(hitNode.id);
          state2.draggedNodeId = hitNode.id;
          state2.dragOffset = { x: mx - hitNode.x, y: my - hitNode.y };
          dragStartPos = { x: hitNode.x, y: hitNode.y };
          state2.dragMode = "move";
        } else {
          state2.selectedNodeIds.clear();
          state2.dragMode = "pan";
        }
      } else if (mode === "wire") {
        const hitPort = deps.hitTestPort(mx, my);
        if (hitPort && hitPort.portType === "output") {
          e.preventDefault();
          state2.wireDrawing = {
            sourceNodeId: hitPort.nodeId,
            sourcePort: hitPort.portIndex,
            startX: hitPort.x,
            startY: hitPort.y,
            currentX: hitPort.x,
            currentY: hitPort.y
          };
        } else if (state2.wireDrawing) {
          state2.wireDrawing = null;
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
          deps.deleteWire(hitWire);
        }
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      const touches = e.touches;
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
      if (state2.dragMode === "pan") {
        e.preventDefault();
        state2.panX += dx;
        state2.panY += dy;
        deps.render();
      } else if (state2.dragMode === "move" && state2.draggedNodeId) {
        e.preventDefault();
        const node = state2.nodes.find((n) => n.id === state2.draggedNodeId);
        if (node) {
          node.x = deps.snapToGrid(mx - state2.dragOffset.x);
          node.y = deps.snapToGrid(my - state2.dragOffset.y);
          deps.render();
        }
      } else if (state2.wireDrawing) {
        e.preventDefault();
        state2.wireDrawing.currentX = mx;
        state2.wireDrawing.currentY = my;
        deps.render();
      }
      lastTouch = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    }, { passive: false });
    canvas.addEventListener("touchend", (e) => {
      const endedTouch = Array.from(e.changedTouches).find((t) => t.identifier === activeTouchId);
      if (!endedTouch) return;
      const { mx, my } = canvasCoords(endedTouch);
      const mode = deps.currentMode();
      if (state2.wireDrawing) {
        const hitPort = deps.hitTestPort(mx, my);
        if (hitPort && hitPort.portType === "input" && hitPort.nodeId !== state2.wireDrawing.sourceNodeId) {
          const exists = state2.wires.some(
            (w) => w.targetNodeId === hitPort.nodeId && w.targetPort === hitPort.portIndex
          );
          if (!exists) {
            const wire = {
              id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              sourceNodeId: state2.wireDrawing.sourceNodeId,
              sourcePort: state2.wireDrawing.sourcePort,
              targetNodeId: hitPort.nodeId,
              targetPort: hitPort.portIndex,
              points: [],
              value: false
            };
            state2.wires.push(wire);
            deps.pushUndo({ type: "addWire", data: { wire }, timestamp: Date.now() });
          }
        }
        state2.wireDrawing = null;
        deps.render();
      }
      if (!hasMoved && state2.draggedNodeId) {
        const node = state2.nodes.find((n) => n.id === state2.draggedNodeId);
        if (node) {
          if ((node.type === "INPUT" || node.type === "SWITCH") && mode === "select") {
            deps.toggleSourceNode(node);
            deps.justToggledRef.value = true;
            setTimeout(() => {
              deps.justToggledRef.value = false;
            }, 300);
          } else if (node.type === "CONST" && mode === "select") {
            if (!node.config) node.config = {};
            const oldValue = node.config.value ?? false;
            node.config.value = !oldValue;
            deps.pushUndo({
              type: "changeConfig",
              data: { nodeId: node.id, oldConfig: { value: oldValue }, newConfig: { value: !oldValue } },
              timestamp: Date.now()
            });
            deps.runSimulation();
            deps.justToggledRef.value = true;
            setTimeout(() => {
              deps.justToggledRef.value = false;
            }, 300);
          } else if (hasMoved) {
            deps.pushUndo({
              type: "moveNode",
              data: { nodeId: node.id, fromX: dragStartPos.x, fromY: dragStartPos.y, toX: node.x, toY: node.y },
              timestamp: Date.now()
            });
          }
        }
      } else if (!hasMoved && state2.dragMode === "move" && state2.draggedNodeId) {
      }
      state2.draggedNodeId = null;
      state2.dragMode = mode;
      activeTouchId = null;
      lastTouch = null;
      deps.render();
    });
    canvas.addEventListener("touchcancel", () => {
      state2.wireDrawing = null;
      state2.draggedNodeId = null;
      state2.dragMode = deps.currentMode();
      activeTouchId = null;
      lastTouch = null;
      deps.render();
    });
    let lastTapTime = 0;
    canvas.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - lastTapTime < 300) {
        const touch = e.changedTouches[0];
        if (touch) {
          const { mx, my } = canvasCoords(touch);
          const hitNode = deps.hitTestNode(mx, my);
          if (hitNode) {
            if (hitNode.type === "INPUT" || hitNode.type === "SWITCH") {
              deps.toggleSourceNode(hitNode);
            } else if (hitNode.type === "CONST") {
              const node = state2.nodes.find((n) => n.id === hitNode.id);
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

  // Web4/src/persistence.ts
  var STORAGE_KEY = "w4_circuit_save";
  function saveToLocalStorage(circuit) {
    try {
      const data = {
        ...circuit,
        savedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save circuit:", e);
      throw new Error("Could not save circuit to local storage.");
    }
  }
  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  function exportAsJSON(circuit, filename) {
    const data = {
      ...circuit,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      format: "dc-playground-v1"
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `${circuit.name || "circuit"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importFromJSON(json) {
    try {
      const data = JSON.parse(json);
      if (!data.nodes || !Array.isArray(data.nodes)) return null;
      if (!data.wires || !Array.isArray(data.wires)) return null;
      return {
        id: data.id || `imported_${Date.now()}`,
        name: data.name || "Imported Circuit",
        version: data.version || 1,
        nodes: data.nodes,
        wires: data.wires,
        inputNodeIds: data.inputNodeIds || [],
        outputNodeIds: data.outputNodeIds || [],
        savedAt: data.savedAt || (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch {
      return null;
    }
  }
  function importFromFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = importFromJSON(reader.result);
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
  }

  // shared/ts/circuit/interop.ts
  var GATE_SIZES2 = {
    INPUT: { width: 80, height: 50 },
    OUTPUT: { width: 80, height: 50 },
    CONST: { width: 70, height: 50 },
    CLOCK: { width: 80, height: 50 },
    SWITCH: { width: 80, height: 50 },
    LED: { width: 70, height: 50 },
    BUFFER: { width: 60, height: 50 },
    NOT: { width: 70, height: 50 },
    AND: { width: 80, height: 60 },
    OR: { width: 80, height: 60 },
    NAND: { width: 90, height: 60 },
    NOR: { width: 90, height: 60 },
    XOR: { width: 80, height: 60 },
    XNOR: { width: 90, height: 60 }
  };
  var GRID_SIZE2 = 20;
  function convertWeb1Circuit(web1) {
    const idMap = /* @__PURE__ */ new Map();
    const sharedNodes = [];
    const connections = [];
    const inputNodeIds = [];
    let connCounter = 0;
    for (const node of web1.nodes) {
      const newId = `s_${node.id}`;
      idMap.set(node.id, newId);
      const sharedNode = {
        id: newId,
        type: node.type,
        label: node.label,
        inputs: [],
        config: node.type === "CONST" ? { value: node.label === "1" } : void 0
      };
      sharedNodes.push(sharedNode);
      if (SOURCE_TYPES.has(node.type)) {
        inputNodeIds.push(newId);
      }
    }
    for (const node of web1.nodes) {
      const targetId = idMap.get(node.id);
      for (let port = 0; port < node.inputs.length; port++) {
        const sourceId = idMap.get(node.inputs[port]);
        if (sourceId) {
          connections.push({
            id: `conn_${connCounter++}`,
            sourceId,
            targetId,
            targetPort: port
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
      outputNodeId: idMap.get(web1.output)
    };
  }
  function getInputCount2(type) {
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
  function getOutputCount2(type) {
    switch (type) {
      case "OUTPUT":
      case "LED":
        return 0;
      default:
        return 1;
    }
  }
  function getDefaultInputPorts2(type, width, height) {
    const count = getInputCount2(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: 0, y: height / 2, side: "left", index: 0 }];
    const ports = [];
    for (let i = 0; i < count; i++) {
      const y = 15 + i * (height - 30) / (count - 1);
      ports.push({ x: 0, y, side: "left", index: i });
    }
    return ports;
  }
  function getDefaultOutputPorts2(type, width, height) {
    const count = getOutputCount2(type);
    if (count === 0) return [];
    if (count === 1) return [{ x: width, y: height / 2, side: "right", index: 0 }];
    const ports = [];
    for (let i = 0; i < count; i++) {
      const y = 15 + i * (height - 30) / (count - 1);
      ports.push({ x: width, y, side: "right", index: i });
    }
    return ports;
  }
  function importSharedToWeb4(shared) {
    const layers = topologicalLayers(shared);
    const layerMap = /* @__PURE__ */ new Map();
    for (let i = 0; i < layers.length; i++) {
      for (const id of layers[i]) {
        layerMap.set(id, i);
      }
    }
    const nodes = [];
    const H_SPACING = 140;
    const V_SPACING = 90;
    const START_X = 60;
    const START_Y = 60;
    const layerCounts = /* @__PURE__ */ new Map();
    for (const [, layer] of layerMap) {
      layerCounts.set(layer, (layerCounts.get(layer) ?? 0) + 1);
    }
    const layerIndexCounters = /* @__PURE__ */ new Map();
    for (const node of shared.nodes) {
      const layer = layerMap.get(node.id) ?? 0;
      const size = GATE_SIZES2[node.type] ?? { width: 80, height: 60 };
      const idx = layerIndexCounters.get(layer) ?? 0;
      const totalInLayer = layerCounts.get(layer) ?? 1;
      const x = START_X + layer * H_SPACING;
      const totalHeight = totalInLayer * V_SPACING;
      const y = START_Y + idx * V_SPACING - totalHeight / 2 + 200;
      layerIndexCounters.set(layer, idx + 1);
      nodes.push({
        id: node.id,
        type: node.type,
        x: Math.round(x / GRID_SIZE2) * GRID_SIZE2,
        y: Math.round(y / GRID_SIZE2) * GRID_SIZE2,
        width: size.width,
        height: size.height,
        rotation: 0,
        label: node.label || node.type,
        config: node.config,
        inputPorts: getDefaultInputPorts2(node.type, size.width, size.height),
        outputPorts: getDefaultOutputPorts2(node.type, size.width, size.height)
      });
    }
    const wires = shared.connections.map((conn, i) => ({
      id: `w_${i}`,
      sourceNodeId: conn.sourceId,
      sourcePort: 0,
      // most gates have 1 output
      targetNodeId: conn.targetId,
      targetPort: conn.targetPort,
      points: [],
      // will be computed by the renderer
      value: false
    }));
    return {
      nodes,
      wires,
      inputNodeIds: shared.inputNodeIds,
      outputNodeIds: shared.outputNodeId ? [shared.outputNodeId] : []
    };
  }
  function topologicalLayers(graph) {
    const inDegree = /* @__PURE__ */ new Map();
    const adjacency = /* @__PURE__ */ new Map();
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }
    for (const conn of graph.connections) {
      adjacency.get(conn.sourceId)?.push(conn.targetId);
      inDegree.set(conn.targetId, (inDegree.get(conn.targetId) ?? 0) + 1);
    }
    const layers = [];
    let queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }
    while (queue.length > 0) {
      layers.push([...queue]);
      const nextQueue = [];
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
  var WEB1_IMPORT_KEY = "w4_imported_from_web1";
  function loadImportedCircuit() {
    try {
      const raw = localStorage.getItem(WEB1_IMPORT_KEY);
      if (!raw) return null;
      localStorage.removeItem(WEB1_IMPORT_KEY);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // shared/ts/boolean/minimizer.ts
  function canCombine(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diff++;
        if (diff > 1) return false;
      }
    }
    return diff === 1;
  }
  function combinePatterns(a, b) {
    let result = "";
    for (let i = 0; i < a.length; i++) {
      result += a[i] === b[i] ? a[i] : "-";
    }
    return result;
  }
  function getPrimeImplicants(minterms, variableCount) {
    let groups = /* @__PURE__ */ new Map();
    minterms.forEach((m) => {
      const bin = m.toString(2).padStart(variableCount, "0");
      const ones = (bin.match(/1/g) || []).length;
      if (!groups.has(ones)) groups.set(ones, /* @__PURE__ */ new Set());
      groups.get(ones).add(bin);
    });
    const primes = /* @__PURE__ */ new Set();
    while (groups.size > 0) {
      const nextGroups = /* @__PURE__ */ new Map();
      const combined = /* @__PURE__ */ new Set();
      const onesKeys = [...groups.keys()].sort((a, b) => a - b);
      for (let i = 0; i < onesKeys.length - 1; i++) {
        const k1 = onesKeys[i];
        const k2 = onesKeys[i + 1];
        if (k2 !== k1 + 1) continue;
        const g1 = groups.get(k1);
        const g2 = groups.get(k2);
        g1.forEach((p1) => {
          g2.forEach((p2) => {
            if (canCombine(p1, p2)) {
              combined.add(p1);
              combined.add(p2);
              const merged = combinePatterns(p1, p2);
              const ones = (merged.replace(/-/g, "").match(/1/g) || []).length;
              if (!nextGroups.has(ones)) nextGroups.set(ones, /* @__PURE__ */ new Set());
              nextGroups.get(ones).add(merged);
            }
          });
        });
      }
      groups.forEach((set) => {
        set.forEach((pattern) => {
          if (!combined.has(pattern)) primes.add(pattern);
        });
      });
      groups = nextGroups;
    }
    return [...primes].map((pattern) => ({ pattern }));
  }

  // Web1/src/circuits/circuitGraph.ts
  var circuitCounter = 0;
  function resetCircuitIds() {
    circuitCounter = 0;
  }
  function createGraph() {
    return { nodes: [], output: "", inputs: [] };
  }
  function addNode(graph, type, inputs = [], label = "") {
    const id = `node_${circuitCounter++}`;
    graph.nodes.push({ id, type, inputs, label });
    return id;
  }
  function addInput(graph, variable) {
    const existing = graph.nodes.find((n) => n.type === "INPUT" && n.label === variable);
    if (existing) return existing.id;
    const id = addNode(graph, "INPUT", [], variable);
    graph.inputs.push(id);
    return id;
  }
  var isAllDash = (imp, n) => imp.pattern === "-".repeat(n);
  function buildBasicSOPCircuit(implicants, variables) {
    const graph = createGraph();
    variables.forEach((v) => addInput(graph, v));
    if (implicants.length === 0) {
      graph.output = addNode(graph, "CONST", [], "0");
      return graph;
    }
    if (implicants.length === 1 && isAllDash(implicants[0], variables.length)) {
      graph.output = addNode(graph, "CONST", [], "1");
      return graph;
    }
    const notMap = /* @__PURE__ */ new Map();
    const getNot = (varName) => {
      if (!notMap.has(varName)) {
        const inId = addInput(graph, varName);
        notMap.set(varName, addNode(graph, "NOT", [inId], `~${varName}`));
      }
      return notMap.get(varName);
    };
    const termNodeIds = [];
    implicants.forEach((imp) => {
      const literalIds = [];
      for (let i = 0; i < imp.pattern.length; i++) {
        if (imp.pattern[i] === "1") literalIds.push(addInput(graph, variables[i]));
        else if (imp.pattern[i] === "0") literalIds.push(getNot(variables[i]));
      }
      if (literalIds.length === 1) {
        termNodeIds.push(literalIds[0]);
      } else if (literalIds.length > 1) {
        termNodeIds.push(addNode(graph, "AND", literalIds));
      }
    });
    graph.output = termNodeIds.length === 1 ? termNodeIds[0] : addNode(graph, "OR", termNodeIds);
    return graph;
  }

  // Web4/src/truthTableImport.ts
  function showTruthTableDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "w4-tt-overlay";
      overlay.innerHTML = `
            <div class="w4-tt-dialog">
                <div class="w4-tt-header">
                    <h3>\u{1F4CB} Import from Truth Table</h3>
                    <button type="button" class="w4-tt-close" aria-label="Close">&times;</button>
                </div>
                <div class="w4-tt-body">
                    <div class="w4-tt-row">
                        <label for="w4-tt-vars">Variables (comma-separated):</label>
                        <input type="text" id="w4-tt-vars" value="A, B, C" placeholder="A, B, C" />
                    </div>
                    <div class="w4-tt-row">
                        <label>Output values (one per row, MSB-first):</label>
                        <div id="w4-tt-table" class="w4-tt-table"></div>
                    </div>
                    <div class="w4-tt-row">
                        <label for="w4-tt-outputs">Or paste output column:</label>
                        <input type="text" id="w4-tt-outputs" placeholder="0,0,0,1,0,1,1,1" />
                    </div>
                    <div id="w4-tt-error" class="w4-tt-error" style="display:none;"></div>
                </div>
                <div class="w4-tt-footer">
                    <button type="button" class="w4-tt-cancel">Cancel</button>
                    <button type="button" class="w4-tt-generate solve-button">Generate Circuit</button>
                </div>
            </div>
        `;
      document.body.appendChild(overlay);
      const varsInput = overlay.querySelector("#w4-tt-vars");
      const outputsInput = overlay.querySelector("#w4-tt-outputs");
      const tableContainer = overlay.querySelector("#w4-tt-table");
      const errorDiv = overlay.querySelector("#w4-tt-error");
      const closeBtn = overlay.querySelector(".w4-tt-close");
      const cancelBtn = overlay.querySelector(".w4-tt-cancel");
      const generateBtn = overlay.querySelector(".w4-tt-generate");
      function cleanup() {
        overlay.remove();
      }
      function showError(msg) {
        errorDiv.textContent = msg;
        errorDiv.style.display = "";
      }
      function hideError() {
        errorDiv.style.display = "none";
      }
      function renderTable() {
        const vars = varsInput.value.split(",").map((v) => v.trim()).filter(Boolean);
        const count = 1 << vars.length;
        let html = "<table><thead><tr>";
        vars.forEach((v) => {
          html += `<th>${v}</th>`;
        });
        html += "<th>F</th></tr></thead><tbody>";
        for (let i = 0; i < count; i++) {
          html += "<tr>";
          for (let j = 0; j < vars.length; j++) {
            html += `<td>${i >> vars.length - 1 - j & 1}</td>`;
          }
          html += `<td class="w4-tt-output-cell" data-row="${i}" tabindex="0" role="button" aria-label="Toggle output for row ${i}">0</td>`;
          html += "</tr>";
        }
        html += "</tbody></table>";
        tableContainer.innerHTML = html;
        const pasteVals = outputsInput.value.split(",").map((v) => v.trim()).filter(Boolean);
        if (pasteVals.length === count) {
          tableContainer.querySelectorAll(".w4-tt-output-cell").forEach((cell) => {
            const row = Number(cell.dataset.row);
            cell.textContent = pasteVals[row] || "0";
          });
        }
        tableContainer.querySelectorAll(".w4-tt-output-cell").forEach((cell) => {
          cell.addEventListener("click", () => {
            cell.textContent = cell.textContent === "1" ? "0" : "1";
            syncOutputInput();
          });
          cell.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              cell.textContent = cell.textContent === "1" ? "0" : "1";
              syncOutputInput();
            }
          });
        });
      }
      function syncOutputInput() {
        const cells = tableContainer.querySelectorAll(".w4-tt-output-cell");
        const vals = [];
        cells.forEach((c) => vals.push(c.textContent || "0"));
        outputsInput.value = vals.join(",");
      }
      function readOutputs() {
        const cells = tableContainer.querySelectorAll(".w4-tt-output-cell");
        const vals = [];
        cells.forEach((c) => vals.push(c.textContent === "1" ? 1 : 0));
        return vals;
      }
      varsInput.addEventListener("change", renderTable);
      outputsInput.addEventListener("input", () => {
        const vars = varsInput.value.split(",").map((v) => v.trim()).filter(Boolean);
        const count = 1 << vars.length;
        const pasteVals = outputsInput.value.split(",").map((v) => v.trim()).filter(Boolean);
        if (pasteVals.length === count) {
          tableContainer.querySelectorAll(".w4-tt-output-cell").forEach((cell) => {
            const row = Number(cell.dataset.row);
            cell.textContent = pasteVals[row] || "0";
          });
        }
      });
      closeBtn.addEventListener("click", () => {
        cleanup();
        resolve(null);
      });
      cancelBtn.addEventListener("click", () => {
        cleanup();
        resolve(null);
      });
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(null);
        }
      });
      generateBtn.addEventListener("click", () => {
        hideError();
        const vars = varsInput.value.split(",").map((v) => v.trim()).filter(Boolean);
        if (vars.length === 0 || vars.length > 6) {
          showError("Enter 1\u20136 variable names.");
          return;
        }
        if (new Set(vars).size !== vars.length) {
          showError("Variable names must be unique.");
          return;
        }
        const outputs = readOutputs();
        const expected = 1 << vars.length;
        if (outputs.length !== expected) {
          showError(`Expected ${expected} output values, got ${outputs.length}.`);
          return;
        }
        const minterms = [];
        for (let i = 0; i < outputs.length; i++) {
          if (outputs[i] === 1) minterms.push(i);
        }
        if (minterms.length === 0) {
          showError("All outputs are 0 \u2014 the circuit would be constant 0. Add at least one 1.");
          return;
        }
        if (minterms.length === expected) {
          showError("All outputs are 1 \u2014 the circuit would be constant 1. Add at least one 0.");
          return;
        }
        const implicants = getPrimeImplicants(minterms, vars.length);
        resetCircuitIds();
        const web1Circuit = buildBasicSOPCircuit(implicants, vars);
        const shared = convertWeb1Circuit(web1Circuit);
        const w4 = importSharedToWeb4(shared);
        cleanup();
        resolve(w4);
      });
      renderTable();
    });
  }

  // Web4/src/waveform.ts
  function createWaveformState(maxHistory = 50) {
    return {
      history: [],
      timeCounter: 0,
      maxHistory,
      isPaused: false
    };
  }
  function recordSample(state2, nodes, wires, nodeValues) {
    if (state2.isPaused) return;
    state2.timeCounter++;
    const signals = {};
    for (const node of nodes) {
      if (node.type === "INPUT" || node.type === "SWITCH" || node.type === "CLOCK") {
        signals[node.label || node.id] = nodeValues.get(node.id) ?? false;
      }
    }
    for (const node of nodes) {
      if (node.type === "OUTPUT" || node.type === "LED") {
        signals[`F:${node.label || node.id}`] = nodeValues.get(node.id) ?? false;
      }
    }
    state2.history.push({ time: state2.timeCounter, signals });
    if (state2.history.length > state2.maxHistory) {
      state2.history.shift();
    }
  }
  function drawWaveform(canvas, state2, signalNames, w, h) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = w ?? canvas.width;
    const height = h ?? canvas.height;
    if (state2.history.length === 0 || signalNames.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("No signals to display", width / 2, height / 2);
      return;
    }
    const startX = 100;
    const graphWidth = width - startX - 30;
    const rowHeight = Math.min(30, Math.floor((height - 20) / signalNames.length));
    const stepX = graphWidth / Math.max(15, state2.history.length - 1);
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = startX; x < width - 20; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 10);
      ctx.lineTo(x, height - 10);
      ctx.stroke();
    }
    ctx.fillStyle = "#64748b";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < state2.history.length; i += 5) {
      const x = startX + i * stepX;
      ctx.fillText(String(state2.history[i].time), x, height - 4);
    }
    signalNames.forEach((sigName, sigIdx) => {
      const topY = 15 + sigIdx * rowHeight;
      const lowY = topY + rowHeight - 6;
      const highY = topY + 4;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = sigName.startsWith("F:") ? "#34d399" : "#60a5fa";
      ctx.textAlign = "right";
      ctx.fillText(sigName, startX - 10, lowY - 2);
      ctx.strokeStyle = sigName.startsWith("F:") ? "#10b981" : "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      state2.history.forEach((pt, i) => {
        const x = startX + i * stepX;
        const val = pt.signals[sigName] ?? false;
        const y = val ? highY : lowY;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          const prevVal = state2.history[i - 1].signals[sigName] ?? false;
          const prevY = prevVal ? highY : lowY;
          if (prevY !== y) {
            ctx.lineTo(x, prevY);
          }
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });
  }
  function getSignalNames(nodes) {
    const names = [];
    for (const node of nodes) {
      if (node.type === "INPUT" || node.type === "SWITCH" || node.type === "CLOCK") {
        names.push(node.label || node.id);
      }
    }
    for (const node of nodes) {
      if (node.type === "OUTPUT" || node.type === "LED") {
        names.push(`F:${node.label || node.id}`);
      }
    }
    return names;
  }

  // Web4/src/ui/toast.ts
  function createToast(container, message, type = "info", options = {}, onRemove, doc = document) {
    const { duration = 2500, fadeDuration = 300 } = options;
    const toast = doc.createElement("div");
    toast.className = `w4-toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    let fadeTimer = null;
    let removeTimer = null;
    function dismiss() {
      toast.classList.add("toast-out");
      removeTimer = setTimeout(() => {
        toast.remove();
        onRemove?.();
      }, fadeDuration);
    }
    fadeTimer = setTimeout(dismiss, duration);
    function cancel() {
      if (fadeTimer !== null) clearTimeout(fadeTimer);
      if (removeTimer !== null) clearTimeout(removeTimer);
    }
    return { element: toast, cancel };
  }
  function createToastEmitter(containerId) {
    return (message, type = "info") => {
      const container = document.getElementById(containerId);
      if (!container) return;
      createToast(container, message, type);
    };
  }

  // Web4/src/ui/shortcuts.ts
  var SHORTCUTS = [
    { key: "v", description: "Select mode" },
    { key: "w", description: "Wire mode" },
    { key: "d", description: "Delete mode" },
    { key: "delete", description: "Delete selected" },
    { key: "backspace", description: "Delete selected" },
    { key: "z", ctrl: true, description: "Undo" },
    { key: "z", ctrl: true, shift: true, description: "Redo" },
    { key: "z", ctrl: true, shift: false, description: "Undo" },
    { key: "s", ctrl: true, description: "Save" },
    { key: "escape", description: "Cancel / Deselect" },
    { key: " ", description: "Toggle waveform pause" },
    { key: "?", description: "Scroll to manual" }
  ];
  function matchesShortcut(e, shortcut) {
    const keyMatch = e.key.toLowerCase() === shortcut.key;
    const ctrlMatch = shortcut.ctrl ? e.ctrlKey || e.metaKey : !(e.ctrlKey || e.metaKey);
    const shiftMatch = shortcut.shift !== void 0 ? e.shiftKey === shortcut.shift : true;
    const altMatch = shortcut.alt ? e.altKey : !e.altKey;
    return keyMatch && ctrlMatch && shiftMatch && altMatch;
  }
  function resolveShortcut(e) {
    const ctrlZ = SHORTCUTS.find(
      (s) => s.key === "z" && s.ctrl && s.shift === false
    );
    const ctrlShiftZ = SHORTCUTS.find(
      (s) => s.key === "z" && s.ctrl && s.shift === true
    );
    if (ctrlShiftZ && matchesShortcut(e, ctrlShiftZ)) return ctrlShiftZ;
    if (ctrlZ && matchesShortcut(e, ctrlZ)) return ctrlZ;
    for (const shortcut of SHORTCUTS) {
      if (shortcut.key === "z" && shortcut.ctrl) continue;
      if (matchesShortcut(e, shortcut)) return shortcut;
    }
    return null;
  }
  function shouldIgnoreKeyEvent(target) {
    if (!target) return false;
    const tag = target.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }

  // Web4/src/main.ts
  function byId(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id}`);
    return el;
  }
  var state = createInitialState();
  var waveformState = createWaveformState();
  var currentMode = "select";
  function init() {
    byId("w4Toolbar").innerHTML = renderToolbar();
    byId("w4Palette").innerHTML = renderPalette();
    byId("w4StatusBar").innerHTML = renderStatusBar();
    setupToolbar();
    setupPalette();
    setupCanvas();
    setupKeyboard();
    setupProbeHover();
    const pauseBtn = byId("w4WaveformPause");
    const clearBtn = byId("w4WaveformClear");
    if (pauseBtn) {
      pauseBtn.addEventListener("click", () => {
        waveformState.isPaused = !waveformState.isPaused;
        pauseBtn.textContent = waveformState.isPaused ? "\u25B6" : "\u23F8";
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
    setupTouchHandlers({
      state,
      byId,
      hitTestNode: (mx, my) => hitTestNode(mx, my),
      hitTestPort: (mx, my) => hitTestPort(mx, my),
      hitTestWire: (mx, my) => hitTestWire(mx, my),
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
      justToggledRef: { get value() {
        return justToggled;
      }, set value(v) {
        justToggled = v;
      } }
    });
    window.addEventListener("resize", () => resizeCanvas());
    resizeCanvas();
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
    startSimulation();
  }
  function setupToolbar() {
    document.querySelectorAll(".w4-tool-btn[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
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
  function setMode(mode) {
    currentMode = mode;
    state.dragMode = mode;
    document.querySelectorAll(".w4-tool-btn[data-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });
    const canvas = byId("w4Canvas");
    canvas.style.cursor = mode === "wire" ? "crosshair" : mode === "delete" ? "not-allowed" : "default";
    const statusMode = byId("w4StatusMode");
    statusMode.textContent = `Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
  }
  function setupPalette() {
    const palette = byId("w4Palette");
    const canvas = byId("w4Canvas");
    palette.querySelectorAll(".w4-palette-item").forEach((item) => {
      item.addEventListener("dragstart", (e) => {
        const type = item.getAttribute("data-gate-type");
        e.dataTransfer?.setData("text/plain", type);
        e.dataTransfer.effectAllowed = "copy";
      });
      item.addEventListener("click", () => {
        const type = item.getAttribute("data-gate-type");
        const canvasRect = canvas.getBoundingClientRect();
        const cx = (canvasRect.width / 2 - state.panX) / state.zoom;
        const cy = (canvasRect.height / 2 - state.panY) / state.zoom;
        addNodeAt(type, cx, cy);
      });
    });
    canvas.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    canvas.addEventListener("drop", (e) => {
      e.preventDefault();
      const type = e.dataTransfer?.getData("text/plain");
      if (!type) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - state.panX) / state.zoom;
      const y = (e.clientY - rect.top - state.panY) / state.zoom;
      addNodeAt(type, x, y);
    });
  }
  function addNodeAt(type, x, y, label) {
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
  function setupCanvas() {
    const canvas = byId("w4Canvas");
    let isDragging = false;
    let dragStartPos = { x: 0, y: 0 };
    let lastMouse = { x: 0, y: 0 };
    canvas.addEventListener("mousedown", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - state.panX) / state.zoom;
      const my = (e.clientY - rect.top - state.panY) / state.zoom;
      lastMouse = { x: e.clientX, y: e.clientY };
      if (e.button === 1 || e.button === 0 && e.altKey) {
        state.dragMode = "pan";
        isDragging = true;
        canvas.style.cursor = "grabbing";
        return;
      }
      if (currentMode === "select" || currentMode === "move") {
        const hitNode = hitTestNode(mx, my);
        if (hitNode) {
          if (e.shiftKey) {
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
            currentY: hitPort.y
          };
        } else if (state.wireDrawing) {
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
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - state.panX) / state.zoom;
      const my = (e.clientY - rect.top - state.panY) / state.zoom;
      byId("w4StatusCoords").textContent = `X: ${Math.round(mx)}, Y: ${Math.round(my)}`;
      if (isDragging && state.dragMode === "pan") {
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        state.panX += dx;
        state.panY += dy;
        render();
      } else if (isDragging && state.dragMode === "move" && state.draggedNodeId) {
        const node = state.nodes.find((n) => n.id === state.draggedNodeId);
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
    canvas.addEventListener("mouseup", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - state.panX) / state.zoom;
      const my = (e.clientY - rect.top - state.panY) / state.zoom;
      if (state.wireDrawing) {
        const hitPort = hitTestPort(mx, my);
        if (hitPort && hitPort.portType === "input" && hitPort.nodeId !== state.wireDrawing.sourceNodeId) {
          const exists = state.wires.some(
            (w) => w.targetNodeId === hitPort.nodeId && w.targetPort === hitPort.portIndex
          );
          if (!exists) {
            const wire = {
              id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              sourceNodeId: state.wireDrawing.sourceNodeId,
              sourcePort: state.wireDrawing.sourcePort,
              targetNodeId: hitPort.nodeId,
              targetPort: hitPort.portIndex,
              points: [],
              value: false
            };
            state.wires.push(wire);
            pushUndo({ type: "addWire", data: { wire }, timestamp: Date.now() });
          }
        }
        state.wireDrawing = null;
        render();
      }
      if (state.draggedNodeId) {
        const node = state.nodes.find((n) => n.id === state.draggedNodeId);
        if (node) {
          const dx = Math.abs(e.clientX - lastMouse.x);
          const dy = Math.abs(e.clientY - lastMouse.y);
          const wasClick = dx < 4 && dy < 4;
          if (wasClick && (node.type === "INPUT" || node.type === "SWITCH")) {
            toggleSourceNode(node);
            justToggled = true;
            setTimeout(() => {
              justToggled = false;
            }, 300);
          } else if (wasClick && node.type === "CONST") {
            if (!node.config) node.config = {};
            const oldValue = node.config.value ?? false;
            node.config.value = !oldValue;
            pushUndo({
              type: "changeConfig",
              data: { nodeId: node.id, oldConfig: { value: oldValue }, newConfig: { value: !oldValue } },
              timestamp: Date.now()
            });
            runSimulation();
            justToggled = true;
            setTimeout(() => {
              justToggled = false;
            }, 300);
          } else {
            pushUndo({
              type: "moveNode",
              data: { nodeId: node.id, fromX: dragStartPos.x, fromY: dragStartPos.y, toX: node.x, toY: node.y },
              timestamp: Date.now()
            });
          }
        }
        state.draggedNodeId = null;
      }
      isDragging = false;
      state.dragMode = currentMode;
      canvas.style.cursor = currentMode === "wire" ? "crosshair" : currentMode === "delete" ? "not-allowed" : "default";
    });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom(state.zoom + delta);
    }, { passive: false });
    window.addEventListener("mouseup", () => {
      if (state.wireDrawing) {
        state.wireDrawing = null;
        render();
      }
    });
    canvas.addEventListener("dblclick", (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - state.panX) / state.zoom;
      const my = (e.clientY - rect.top - state.panY) / state.zoom;
      if (justToggled) return;
      const hitNode = hitTestNode(mx, my);
      if (!hitNode) return;
      if (hitNode.type === "INPUT" || hitNode.type === "SWITCH") {
        toggleSourceNode(hitNode);
      } else if (hitNode.type === "CONST") {
        if (!hitNode.config) hitNode.config = {};
        hitNode.config.value = !(hitNode.config.value ?? false);
        runSimulation();
        render();
      }
    });
  }
  function hitTestNode(mx, my) {
    for (let i = state.nodes.length - 1; i >= 0; i--) {
      const n = state.nodes[i];
      if (mx >= n.x && mx <= n.x + n.width && my >= n.y && my <= n.y + n.height) {
        return n;
      }
    }
    return null;
  }
  function hitTestPort(mx, my) {
    const threshold = 10;
    for (const node of state.nodes) {
      for (let i = 0; i < node.inputPorts.length; i++) {
        const p = node.inputPorts[i];
        const px = node.x + p.x;
        const py = node.y + p.y;
        if (Math.abs(mx - px) < threshold && Math.abs(my - py) < threshold) {
          return { nodeId: node.id, portIndex: i, portType: "input", x: px, y: py };
        }
      }
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
  function hitTestWire(mx, my) {
    for (const wire of state.wires) {
      const sourceNode = state.nodes.find((n) => n.id === wire.sourceNodeId);
      const targetNode = state.nodes.find((n) => n.id === wire.targetNodeId);
      if (!sourceNode || !targetNode) continue;
      const sp = sourceNode.outputPorts[wire.sourcePort];
      const tp = targetNode.inputPorts[wire.targetPort];
      if (!sp || !tp) continue;
      const sx = sourceNode.x + sp.x;
      const sy = sourceNode.y + sp.y;
      const tx = targetNode.x + tp.x;
      const ty = targetNode.y + tp.y;
      const midX = (sx + tx) / 2;
      const points = [
        { x: sx, y: sy },
        { x: midX, y: sy },
        { x: midX, y: ty },
        { x: tx, y: ty }
      ];
      for (let i = 0; i < points.length - 1; i++) {
        const dist = distToSegment(mx, my, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
        if (dist < 8) return wire;
      }
    }
    return null;
  }
  function distToSegment(px, py, x1, y1, x2, y2) {
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
  function toggleSourceNode(node) {
    const current = state.nodeValues.get(node.id) ?? false;
    state.nodeValues.set(node.id, !current);
    runSimulation();
    render();
  }
  function deleteNode(nodeId) {
    const node = state.nodes.find((n) => n.id === nodeId);
    if (!node) return;
    state.nodes = state.nodes.filter((n) => n.id !== nodeId);
    state.wires = state.wires.filter((w) => w.sourceNodeId !== nodeId && w.targetNodeId !== nodeId);
    state.circuit.inputNodeIds = state.circuit.inputNodeIds.filter((id) => id !== nodeId);
    state.circuit.outputNodeIds = state.circuit.outputNodeIds.filter((id) => id !== nodeId);
    state.selectedNodeIds.delete(nodeId);
    pushUndo({ type: "removeNode", data: { node }, timestamp: Date.now() });
    updateStatusCounts();
    render();
  }
  function deleteWire(wire) {
    state.wires = state.wires.filter((w) => w.id !== wire.id);
    pushUndo({ type: "removeWire", data: { wire }, timestamp: Date.now() });
    render();
  }
  function clearCircuit() {
    if (state.nodes.length === 0) return;
    if (!confirm("Clear all components? This cannot be undone.")) return;
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
  function pushUndo(action) {
    state.undoStack.push(action);
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack = [];
  }
  function undo() {
    if (state.undoStack.length === 0) return;
    const action = state.undoStack.pop();
    switch (action.type) {
      case "addNode":
        state.nodes = state.nodes.filter((n) => n.id !== action.data.node.id);
        state.wires = state.wires.filter((w) => w.sourceNodeId !== action.data.node.id && w.targetNodeId !== action.data.node.id);
        break;
      case "removeNode":
        if (action.data.isClearAll) {
          state.nodes = action.data.nodes || [];
          state.wires = action.data.wires || [];
        } else if (action.data.node) {
          state.nodes.push(action.data.node);
        }
        break;
      case "addWire":
        state.wires = state.wires.filter((w) => w.id !== action.data.wire.id);
        break;
      case "removeWire":
        if (action.data.wire) {
          state.wires.push(action.data.wire);
        }
        break;
      case "moveNode": {
        const node = state.nodes.find((n) => n.id === action.data.nodeId);
        if (node) {
          node.x = action.data.fromX;
          node.y = action.data.fromY;
        }
        break;
      }
      case "changeConfig": {
        const node = state.nodes.find((n) => n.id === action.data.nodeId);
        if (node) {
          node.config = { ...node.config, ...action.data.oldConfig };
          runSimulation();
        }
        break;
      }
    }
    state.redoStack.push(action);
    updateStatusCounts();
    render();
  }
  function redo() {
    if (state.redoStack.length === 0) return;
    const action = state.redoStack.pop();
    switch (action.type) {
      case "addNode":
        if (action.data.node) {
          state.nodes.push(action.data.node);
        }
        break;
      case "removeNode":
        if (action.data.isClearAll) {
          state.nodes = [];
          state.wires = [];
          state.circuit.inputNodeIds = [];
          state.circuit.outputNodeIds = [];
        } else if (action.data.node) {
          state.nodes = state.nodes.filter((n) => n.id !== action.data.node.id);
          state.wires = state.wires.filter((w) => w.sourceNodeId !== action.data.node.id && w.targetNodeId !== action.data.node.id);
        }
        break;
      case "addWire":
        if (action.data.wire) {
          state.wires.push(action.data.wire);
        }
        break;
      case "removeWire":
        state.wires = state.wires.filter((w) => w.id !== action.data.wire.id);
        break;
      case "moveNode": {
        const redoNode = state.nodes.find((n) => n.id === action.data.nodeId);
        if (redoNode) {
          redoNode.x = action.data.toX;
          redoNode.y = action.data.toY;
        }
        break;
      }
      case "changeConfig": {
        const cfgNode = state.nodes.find((n) => n.id === action.data.nodeId);
        if (cfgNode) {
          cfgNode.config = { ...cfgNode.config, ...action.data.newConfig };
          runSimulation();
        }
        break;
      }
    }
    state.undoStack.push(action);
    updateStatusCounts();
    render();
  }
  var justToggled = false;
  var simTimer = null;
  function startSimulation() {
    if (simTimer) clearInterval(simTimer);
    simTimer = setInterval(() => {
      runSimulation();
      recordSample(waveformState, state.nodes, state.wires, state.nodeValues);
      drawWaveformPanel();
    }, 500);
  }
  function runSimulation() {
    const inputStates = /* @__PURE__ */ new Map();
    for (const node of state.nodes) {
      if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
        inputStates.set(node.id, state.nodeValues.get(node.id) ?? false);
      }
    }
    for (const node of state.nodes) {
      if (node.type === "CLOCK") {
        const freq = node.config?.frequency ?? 1;
        const time = Date.now() / 1e3;
        const val = Math.sin(2 * Math.PI * freq * time) > 0;
        inputStates.set(node.id, val);
        state.nodeValues.set(node.id, val);
      }
    }
    const result = simulateCircuit(state.nodes, state.wires, inputStates);
    for (const [id, val] of result.nodeValues) {
      state.nodeValues.set(id, val);
    }
    render();
  }
  function render() {
    const canvas = byId("w4Canvas");
    const svgWidth = Math.max(2e3, window.innerWidth);
    const svgHeight = Math.max(1500, window.innerHeight);
    let svg = `<svg class="w4-svg" xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}"
        viewBox="0 0 ${svgWidth} ${svgHeight}"
        style="transform: translate(${state.panX}px, ${state.panY}px) scale(${state.zoom}); transform-origin: 0 0;">`;
    svg += `<defs>
        <pattern id="w4-grid" width="${GRID_SIZE}" height="${GRID_SIZE}" patternUnits="userSpaceOnUse">
            <path d="M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}" fill="none" stroke="var(--w4-grid, rgba(255,255,255,0.03))" stroke-width="0.5"/>
        </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#w4-grid)"/>`;
    for (const wire of state.wires) {
      const sourceNode = state.nodes.find((n) => n.id === wire.sourceNodeId);
      const targetNode = state.nodes.find((n) => n.id === wire.targetNodeId);
      if (!sourceNode || !targetNode) continue;
      svg += renderWire(wire, sourceNode, targetNode, wire.sourcePort, wire.targetPort, wire.value);
    }
    if (state.wireDrawing) {
      svg += renderWirePreview(
        state.wireDrawing.startX,
        state.wireDrawing.startY,
        state.wireDrawing.currentX,
        state.wireDrawing.currentY
      );
    }
    for (const node of state.nodes) {
      const val = state.nodeValues.get(node.id);
      const isSelected = state.selectedNodeIds.has(node.id);
      svg += renderGateSVG(node, val, isSelected);
      svg += renderPorts(node, val, SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type));
    }
    svg += renderWireValues(state.wires, state.nodes, new Map(Array.from(state.nodeValues).map(([k, v]) => [k, v])));
    svg += `</svg>`;
    canvas.innerHTML = svg;
    byId("w4StatusZoom").textContent = `Zoom: ${Math.round(state.zoom * 100)}%`;
  }
  function resizeCanvas() {
    const canvas = byId("w4Canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    render();
  }
  function setZoom(z) {
    state.zoom = Math.max(0.3, Math.min(3, z));
    render();
  }
  function fitToScreen() {
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
    state.zoom = Math.min(scaleX, scaleY, 2);
    state.panX = (cw - (maxX - minX) * state.zoom) / 2 - minX * state.zoom;
    state.panY = (ch - (maxY - minY) * state.zoom) / 2 - minY * state.zoom;
    render();
  }
  function saveCircuit() {
    const circuit = {
      id: state.circuit.id,
      name: state.circuit.name,
      version: 1,
      nodes: state.nodes,
      wires: state.wires,
      inputNodeIds: state.circuit.inputNodeIds,
      outputNodeIds: state.circuit.outputNodeIds,
      savedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    saveToLocalStorage(circuit);
    showToast("Circuit saved!", "success");
  }
  function loadCircuitDialog() {
    const saved = loadFromLocalStorage();
    if (saved) {
      loadCircuit(saved);
    } else {
      showToast("No saved circuit found.", "info");
    }
  }
  function exportCircuit() {
    const circuit = {
      id: state.circuit.id,
      name: state.circuit.name,
      version: 1,
      nodes: state.nodes,
      wires: state.wires,
      inputNodeIds: state.circuit.inputNodeIds,
      outputNodeIds: state.circuit.outputNodeIds,
      savedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    exportAsJSON(circuit);
  }
  function importCircuitDialog() {
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
  function loadCircuit(circuit) {
    state.nodes = circuit.nodes || [];
    state.wires = circuit.wires || [];
    state.circuit.id = circuit.id;
    state.circuit.name = circuit.name;
    state.circuit.inputNodeIds = circuit.inputNodeIds || [];
    state.circuit.outputNodeIds = circuit.outputNodeIds || [];
    state.selectedNodeIds.clear();
    state.nodeValues.clear();
    for (const node of state.nodes) {
      if (SOURCE_TYPES.has(node.type) || TOGGLEABLE_TYPES.has(node.type)) {
        state.nodeValues.set(node.id, false);
      }
    }
    updateStatusCounts();
    runSimulation();
  }
  var lastWaveformW = 0;
  var lastWaveformH = 0;
  function drawWaveformPanel() {
    const canvas = byId("w4WaveformCanvas");
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      const dpr = window.devicePixelRatio || 1;
      const displayW = Math.max(100, rect.width - 20);
      const displayH = Math.max(100, rect.height - 10);
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
  function setupProbeHover() {
    const wrapper = byId("w4Canvas");
    const svg = wrapper?.querySelector("svg");
    const tooltip = byId("w4ProbeTooltip");
    if (!svg || !tooltip) return;
    svg.addEventListener("mousemove", (e) => {
      const target = e.target;
      if (!wrapper) return;
      const gateGroup = target.closest("g[data-node-id]");
      if (gateGroup) {
        const nodeId = gateGroup.getAttribute("data-node-id");
        const node = state.nodes.find((n) => n.id === nodeId);
        if (node) {
          const val = state.nodeValues.get(nodeId);
          const valClass = val ? "probe-value-1" : "probe-value-0";
          tooltip.innerHTML = `<span class="probe-label">${node.label || node.type}</span> = <span class="${valClass}">${val ? "1" : "0"}</span>`;
          positionTooltip(tooltip, wrapper, e);
          tooltip.style.display = "";
          return;
        }
      }
      const wireLine = target.closest("line.w4-wire, path.w4-wire");
      if (wireLine) {
        const wireId = wireLine.getAttribute("data-wire-id");
        if (wireId) {
          const wire = state.wires.find((w) => w.id === wireId);
          if (wire) {
            const srcNode = state.nodes.find((n) => n.id === wire.sourceNodeId);
            const val = state.nodeValues.get(wire.sourceNodeId);
            const valClass = val ? "probe-value-1" : "probe-value-0";
            tooltip.innerHTML = `<span class="probe-label">Wire ${srcNode?.label || wire.sourceNodeId}</span> = <span class="${valClass}">${val ? "1" : "0"}</span>`;
            positionTooltip(tooltip, wrapper, e);
            tooltip.style.display = "";
            return;
          }
        }
      }
      tooltip.style.display = "none";
    });
    svg.addEventListener("mouseleave", () => {
      tooltip.style.display = "none";
    });
  }
  function positionTooltip(tooltip, wrapper, e) {
    const rect = wrapper.getBoundingClientRect();
    let x = e.clientX - rect.left + 12;
    let y = e.clientY - rect.top - 30;
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    if (x + tw > rect.width) x = e.clientX - rect.left - tw - 8;
    if (y < 0) y = e.clientY - rect.top + 16;
    if (y + th > rect.height) y = rect.height - th - 4;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }
  function setupKeyboard() {
    window.addEventListener("keydown", (e) => {
      if (shouldIgnoreKeyEvent(e.target)) {
        return;
      }
      const shortcut = resolveShortcut(e);
      if (!shortcut) return;
      e.preventDefault();
      switch (shortcut.description) {
        case "Select mode":
          setMode("select");
          break;
        case "Wire mode":
          setMode("wire");
          break;
        case "Delete mode":
          setMode("delete");
          break;
        case "Delete selected":
          for (const id of state.selectedNodeIds) deleteNode(id);
          break;
        case "Undo":
          undo();
          break;
        case "Redo":
          redo();
          break;
        case "Save":
          saveCircuit();
          break;
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
  function updateStatusCounts() {
    byId("w4StatusNodes").textContent = `Nodes: ${state.nodes.length} | Wires: ${state.wires.length}`;
  }
  document.addEventListener("DOMContentLoaded", init);
  var showToast = createToastEmitter("w4ToastContainer");
})();
