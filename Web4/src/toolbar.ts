/**
 * Toolbar and gate palette for Web4.
 */

import type { GateType } from "../../shared/ts/circuit/gates";

export interface PaletteItem {
    type: GateType;
    label: string;
    icon: string;
    category: "sources" | "logic" | "sinks";
}

export const PALETTE_ITEMS: PaletteItem[] = [
    { type: "INPUT",   label: "Input",   icon: "📥", category: "sources" },
    { type: "SWITCH",  label: "Switch",  icon: "🔘", category: "sources" },
    { type: "CONST",   label: "Constant", icon: "🔢", category: "sources" },
    { type: "CLOCK",   label: "Clock",   icon: "⏱️", category: "sources" },
    { type: "AND",     label: "AND",     icon: "AND", category: "logic" },
    { type: "OR",      label: "OR",      icon: "OR",  category: "logic" },
    { type: "NOT",     label: "NOT",     icon: "NOT", category: "logic" },
    { type: "NAND",    label: "NAND",    icon: "NAND", category: "logic" },
    { type: "NOR",     label: "NOR",     icon: "NOR",  category: "logic" },
    { type: "XOR",     label: "XOR",     icon: "XOR",  category: "logic" },
    { type: "XNOR",    label: "XNOR",    icon: "XNOR", category: "logic" },
    { type: "BUFFER",  label: "Buffer",  icon: "BUF",  category: "logic" },
    { type: "OUTPUT",  label: "Output",  icon: "📤", category: "sinks" },
    { type: "LED",     label: "LED",     icon: "💡",  category: "sinks" },
];

export function renderPalette(): string {
    const categories: { name: string; key: "sources" | "logic" | "sinks" }[] = [
        { name: "📥 Sources", key: "sources" },
        { name: "⚡ Logic Gates", key: "logic" },
        { name: "📤 Outputs", key: "sinks" },
    ];

    return categories.map(cat => `
        <div class="w4-palette-category">
            <div class="w4-palette-category-title">${cat.name}</div>
            <div class="w4-palette-items">
                ${PALETTE_ITEMS.filter(item => item.category === cat.key).map(item => `
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

export function renderToolbar(): string {
    return `
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn active" id="w4ToolSelect" title="Select mode (V)" data-mode="select">
                <span>↖</span> Select
            </button>
            <button type="button" class="w4-tool-btn" id="w4ToolWire" title="Wire mode (W)" data-mode="wire">
                <span>⚡</span> Wire
            </button>
            <button type="button" class="w4-tool-btn" id="w4ToolDelete" title="Delete mode (D)" data-mode="delete">
                <span>🗑</span> Delete
            </button>
        </div>
        <div class="w4-toolbar-separator"></div>
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn" id="w4UndoBtn" title="Undo (Ctrl+Z)">↶ Undo</button>
            <button type="button" class="w4-tool-btn" id="w4RedoBtn" title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
        </div>
        <div class="w4-toolbar-separator"></div>
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn" id="w4SaveBtn" title="Save (Ctrl+S)">💾 Save</button>
            <button type="button" class="w4-tool-btn" id="w4LoadBtn" title="Load">📂 Load</button>
            <button type="button" class="w4-tool-btn" id="w4ExportBtn" title="Export JSON">📤 Export</button>
            <button type="button" class="w4-tool-btn" id="w4ImportBtn" title="Import JSON">📥 Import</button>
            <button type="button" class="w4-tool-btn" id="w4TruthTableBtn" title="Import from Truth Table">📋 Truth Table</button>
            <button type="button" class="w4-tool-btn" id="w4ClearBtn" title="Clear all">🗑 Clear</button>
        </div>
        <div class="w4-toolbar-separator"></div>
        <div class="w4-toolbar-group">
            <button type="button" class="w4-tool-btn" id="w4ZoomInBtn" title="Zoom In">🔍+</button>
            <button type="button" class="w4-tool-btn" id="w4ZoomOutBtn" title="Zoom Out">🔍−</button>
            <button type="button" class="w4-tool-btn" id="w4ZoomFitBtn" title="Fit to Screen">⊞ Fit</button>
        </div>
    `;
}

export function renderStatusBar(): string {
    return `
        <div class="w4-status-item" id="w4StatusMode">Mode: Select</div>
        <div class="w4-status-item" id="w4StatusNodes">Nodes: 0</div>
        <div class="w4-status-item" id="w4StatusZoom">Zoom: 100%</div>
        <div class="w4-status-item" id="w4StatusCoords">X: 0, Y: 0</div>
    `;
}
