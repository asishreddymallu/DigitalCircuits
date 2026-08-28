# Web4 — Digital Logic Playground

An interactive digital circuit design environment with drag-and-drop gate placement, wire connections, live simulation, and waveform timing diagrams.

## Quick Start

1. Open `Web4/index.html` in a browser (or use `npm run dev` from root)
2. **Add gates:** Drag from the left palette onto the canvas, or click a gate in the palette
3. **Connect gates:** Press `W` for wire mode, click an output port → drag to an input port
4. **Toggle inputs:** Double-click INPUT or SWITCH nodes
5. **See results:** Outputs update in real time; waveform shows on the right panel

## Features

- **14 gate types:** INPUT, OUTPUT, CONST, CLOCK, SWITCH, LED, NOT, BUFFER, AND, OR, NAND, NOR, XOR, XNOR
- **Drag-and-drop:** Gate palette with click or drag placement
- **Wire connections:** Click output port → click input port (supports fan-out)
- **Live simulation:** Deterministic signal propagation through the circuit
- **Waveform panel:** Timing diagram of all input/output signals
- **Undo/Redo:** Full undo/redo support for all actions
- **Save/Load:** localStorage persistence + JSON export/import
- **Grid snap:** Automatic snap-to-grid for clean layouts
- **Zoom/Pan:** Mouse wheel zoom, Alt+drag to pan, fit-to-screen
- **Keyboard shortcuts:** See below or press `?` in the app
- **Light/Dark theme:** Matches the rest of the Digital Circuits Suite

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `V` | Select mode (default) |
| `W` | Wire mode |
| `D` | Delete mode |
| `Delete` / `Backspace` | Delete selected gate(s) |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+S` | Save circuit |
| `Escape` | Cancel wire / deselect |
| `Space` | Toggle waveform pause/play |
| `?` | Open help guide |
| Scroll wheel | Zoom in/out |
| Alt+Click drag | Pan canvas |
| Shift+Click | Multi-select gates |

## Mouse Controls

| Action | Effect |
|--------|--------|
| Left-click (Select) | Select a gate |
| Left-drag (Select) | Move selected gate, or pan on empty space |
| Double-click INPUT/SWITCH | Toggle 0/1 |
| Double-click CONST | Toggle constant value |
| Middle-click or Alt+drag | Pan canvas |
| Scroll wheel | Zoom in/out |

## Gate Types Reference

| Gate | Inputs | Description |
|------|--------|-------------|
| INPUT | 0 | User-togglable 0/1 source |
| SWITCH | 0 | Same as INPUT |
| CONST | 0 | Fixed 0 or 1 (double-click to toggle) |
| CLOCK | 0 | Periodic clock signal |
| NOT | 1 | Inverter: output = ¬input |
| BUFFER | 1 | Output = input (no change) |
| AND | 2 | Output = 1 only when both inputs are 1 |
| OR | 2 | Output = 1 when any input is 1 |
| NAND | 2 | Output = ¬(A AND B) — universal gate |
| NOR | 2 | Output = ¬(A OR B) — universal gate |
| XOR | 2 | Output = 1 when inputs differ |
| XNOR | 2 | Output = 1 when inputs are equal |
| OUTPUT | 1 | Display result (LED indicator) |
| LED | 1 | Same as OUTPUT |

## Architecture

```
Web4/
├── index.html          # Main page (3-panel layout)
├── style.css           # Full UI stylesheet
├── script.js           # Compiled output (DO NOT EDIT)
├── theme.js            # Theme system (identical copy from root)
├── fx.js               # Studio FX (identical copy from root)
├── README.md           # This file
└── src/
    ├── main.ts         # Entry point: wires all modules
    ├── state.ts        # Application state management
    ├── types.ts        # Type definitions and gate sizes
    ├── simulator.ts    # Circuit simulation engine (topological sort + evaluation)
    ├── renderer.ts     # SVG rendering for gates, wires, ports, values
    ├── toolbar.ts      # Gate palette and toolbar definitions
    ├── persistence.ts  # Save/load/export/import (localStorage + JSON)
    ├── waveform.ts     # Waveform timing diagram (Canvas 2D)
    └── ui/
        └── help.ts     # Help modal with keyboard shortcuts and user guide
```

## Shared Modules

Web4 reuses shared circuit primitives from:

- `shared/ts/circuit/gates.ts` — Gate type definitions, evaluation logic, metadata
- `shared/ts/circuit/circuitGraph.ts` — Circuit graph model (for interop with Web1)

## Building

```bash
# From project root
npm run build:web4      # Build Web4 only
npm run build           # Build all apps
```

## Development

```bash
# From project root
npm run dev             # Starts Vite dev server on port 5173
# Navigate to http://localhost:5173/Web4/
```

## Save/Load Format

Circuits are saved as JSON with this structure:

```json
{
  "id": "w4_...",
  "name": "Untitled Circuit",
  "version": 1,
  "nodes": [
    {
      "id": "w4_...",
      "type": "AND",
      "x": 200,
      "y": 100,
      "width": 80,
      "height": 60,
      "rotation": 0,
      "label": "AND",
      "inputPorts": [...],
      "outputPorts": [...]
    }
  ],
  "wires": [
    {
      "id": "w_...",
      "sourceNodeId": "...",
      "sourcePort": 0,
      "targetNodeId": "...",
      "targetPort": 0,
      "points": [],
      "value": false
    }
  ],
  "inputNodeIds": ["..."],
  "outputNodeIds": ["..."],
  "savedAt": "2026-08-28T..."
}
```

## Simulation Engine

The simulation uses topological sorting (Kahn's algorithm) to evaluate the circuit in dependency order:

1. Build adjacency list from wire connections
2. Topological sort ensures inputs are evaluated before outputs
3. For each node in order:
   - SOURCE types read from user-controlled input states
   - CONST nodes use their configured value
   - Logic gates evaluate their inputs and produce output
4. Results propagate through connected wires

## Limitations

- No multi-wire bus support (individual wires only)
- No wire labels/net names
- No subcircuit/hierarchical design
- No analog signals (digital only: 0/1)
- Maximum practical size: ~50 gates before SVG rendering slows
