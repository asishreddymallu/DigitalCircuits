# Web2 — Combinational Circuits Simulator

> Interactive simulator for 18 standard combinational circuits organized in 6 categories. Toggle inputs, see SVG schematics update in real time, view truth tables, Boolean expressions, Verilog code, waveform timing diagrams, and a ripple-carry animation.

## Table of Contents

- [Purpose](#purpose)
- [Directory Tree](#directory-tree)
- [Module Tree](#module-tree)
- [Architecture](#architecture)
- [Module-by-Module Walkthrough](#module-by-module-walkthrough)
- [Circuit Catalog](#circuit-catalog)
- [Professor / Viva Guide](#professor--viva-guide)
- ["Where Do I Find...?" Quick Reference](#where-do-i-find-quick-reference)

---

## Purpose

Web2 is an interactive simulator for standard combinational logic circuits. It provides:

1. **Category navigation** — 6 categories, 18 circuits total
2. **Interactive inputs** — Toggle buttons for each input bit
3. **Live SVG schematics** — Gate-level circuit diagrams with wire coloring
4. **Truth tables** — Auto-highlighted active row
5. **Boolean expressions** — Per-output formulas
6. **Verilog modules** — Copy-ready HDL code
7. **Waveform timing diagram** — Canvas 2D time-series of all signals
8. **Ripple-carry animation** — Step-by-step carry propagation (4-bit adder)
9. **Zoom/Pan** — Mouse wheel + drag on circuit diagrams

---

## Directory Tree

```
Web2/
├── index.html                # Main HTML page
├── style.css                 # Full UI stylesheet
├── script.ts                 # Entry point: wires deps, initializes UI
├── script.js                 # ← Compiled output (DO NOT EDIT)
├── theme.js                  # Theme system (identical copy)
├── fx.js                     # Studio FX (identical copy)
└── src/
    ├── types.ts              # CircuitDefinition, WaveformPoint interfaces
    ├── gates.ts              # SVG gate + wire rendering helpers
    ├── ui.ts                 # All UI logic
    └── circuits/
        ├── index.ts          # Circuit registry + CATEGORIES
        ├── adders.ts         # half_adder, full_adder, ripple_carry_adder_4bit
        ├── subtractors.ts    # half_subtractor, full_subtractor, subtractor_4bit
        ├── mux.ts            # mux_2to1, mux_4to1, mux_8to1
        ├── demux.ts          # demux_1to2, demux_1to4, demux_1to8
        ├── decoders.ts       # decoder_2to4, decoder_3to8, priority_encoder_4to2, 8to3
        └── comparators.ts    # comparator_1bit, comparator_2bit
```

---

## Module Tree

```
Web2
│
├── Entry Point (script.ts)
│   ├── DOM element lookup
│   ├── State initialization
│   ├── Dependency injection (deps)
│   └── Wire up: setupRippleAnimation, setupNavigation, setupZoomPan
│
├── Type Definitions (src/types.ts)
│   ├── CircuitDefinition interface
│   │   ├── id, title, description
│   │   ├── inputs[], outputs[]
│   │   ├── evaluate(inputs) → outputs
│   │   ├── truthTable[]
│   │   ├── expressions[]
│   │   ├── renderSchematic(inputs, outputs, rippleStage?) → SVG string
│   │   └── verilogModule (string)
│   └── WaveformPoint interface
│
├── Circuit Registry (src/circuits/index.ts)
│   ├── CIRCUITS: Record<string, CircuitDefinition> — 18 circuits
│   └── CATEGORIES: Record<string, {title, circuits[]}> — 6 categories
│
├── Gate Rendering (src/gates.ts)
│   ├── wireHopH() — horizontal wire with hop-arcs
│   ├── wireV() — vertical wire
│   ├── dot() — junction dot
│   ├── gateXOR(), gateAND(), gateOR(), gateNOT()
│   ├── gateNAND(), gateNOR(), gateXNOR()
│   └── All return SVG markup strings
│
├── UI Logic (src/ui.ts)
│   ├── Waveform
│   │   ├── recordWaveformSample() — record current signals
│   │   └── drawTimingDiagram() — Canvas 2D rendering
│   ├── Circuit Workspace
│   │   ├── loadCircuitWorkspace() — initialize circuit view
│   │   ├── buildInputButtons() — toggle buttons for inputs
│   │   ├── updateCircuitState() — re-evaluate + re-render
│   │   ├── buildTruthTable() — HTML table from circuit.truthTable
│   │   └── buildExpressions() — expression cards + Verilog
│   ├── Zoom/Pan
│   │   ├── applyZoom() — transform SVG
│   │   └── resetZoom() — reset to default
│   ├── Ripple Animation
│   │   └── setupRippleAnimation() — step-through carry propagation
│   └── Navigation
│       ├── setupNavigation() — category → subcategory → workspace
│       └── setupZoomPan() — mouse wheel + drag events
│
├── Circuit Definitions
│   ├── Adders (circuits/adders.ts)
│   │   ├── half_adder — S=A^B, C=A&B
│   │   ├── full_adder — S=A^B^Cin, Cout=majority
│   │   └── ripple_carry_adder_4bit — 4 cascaded FAs
│   ├── Subtractors (circuits/subtractors.ts)
│   │   ├── half_subtractor — D=A^B, Bout=A'·B
│   │   ├── full_subtractor — D=A^B^Bin, Bout=...
│   │   └── subtractor_4bit — 4 cascaded FS
│   ├── Multiplexers (circuits/mux.ts)
│   │   ├── mux_2to1 — Y=S0'·I0 + S0·I1
│   │   ├── mux_4to1 — 4:1 with 2 select lines
│   │   └── mux_8to1 — 8:1 with 3 select lines
│   ├── Demultiplexers (circuits/demux.ts)
│   │   ├── demux_1to2 — 1 input, 2 outputs
│   │   ├── demux_1to4 — 1 input, 4 outputs
│   │   └── demux_1to8 — 1 input, 8 outputs
│   ├── Decoders/Encoders (circuits/decoders.ts)
│   │   ├── decoder_2to4 — 2-bit to 4-line
│   │   ├── decoder_3to8 — 3-bit to 8-line
│   │   ├── priority_encoder_4to2 — 4-to-2 priority
│   │   └── priority_encoder_8to3 — 8-to-3 priority
│   └── Comparators (circuits/comparators.ts)
│       ├── comparator_1bit — A>B, A=B, A<B
│       └── comparator_2bit — 2-bit magnitude comparison
```

---

## Architecture

```
User clicks category
    │
    ▼
setupNavigation()
    │  Populates subcategory grid
    ▼
User clicks subcategory (circuit)
    │
    ▼
loadCircuitWorkspace(circuit, deps)
    │
    ├── state.currentCircuit = circuit
    ├── state.currentInputs = {all 0}
    ├── state.waveformHistory = []
    │
    ├── buildInputButtons() → toggle buttons
    ├── buildTruthTable() → HTML table
    ├── buildExpressions() → expression cards + Verilog
    │
    └── updateCircuitState()
        │
        ├── circuit.evaluate(inputs) → outputs
        ├── circuit.renderSchematic(inputs, outputs) → SVG string
        ├── Highlight active truth table row
        └── recordWaveformSample() → drawTimingDiagram()
```

---

## Module-by-Module Walkthrough

### Circuit Definition Pattern

Every circuit in Web2 follows the same `CircuitDefinition` interface:

```typescript
interface CircuitDefinition {
    id: string;                    // e.g., "full_adder"
    title: string;                 // e.g., "Full Adder"
    description: string;           // Human-readable description
    inputs: string[];              // e.g., ["A", "B", "Cin"]
    outputs: string[];             // e.g., ["Sum (S)", "Cout"]
    evaluate: (inputs) => outputs; // Pure computation
    truthTable: [...]              // Pre-defined rows
    expressions: [...]             // Boolean formulas per output
    renderSchematic: (...) => string; // SVG markup
    verilogModule: string;         // Verilog HDL code
}
```

**How to Explain It:**
"Each circuit is a self-contained definition. It knows its own inputs, outputs, how to compute results, how to draw itself as an SVG, and what Verilog code it corresponds to. This makes it trivial to add new circuits — just add a new object to the registry."

### SVG Gate Helpers (`gates.ts`)

All gates and wires are rendered as SVG markup strings. Key helpers:

- `wireHopH(x1, x2, y, crossXs, isHigh)` — Horizontal wire with semicircular jump-hops over crossing wires.
- `wireV(x, y1, y2, isHigh)` — Vertical wire segment.
- `dot(cx, cy, isHigh)` — Junction dot at wire crossings.
- `gateXOR()`, `gateAND()`, `gateOR()`, etc. — SVG groups for each gate type.

**How to Explain It:**
"Each gate and wire is drawn as SVG. We use helper functions that return SVG markup strings. The wire router draws horizontal wires with small arc 'hops' wherever they cross other wires, so there's never any ambiguity about which wires are connected."

### Waveform Timing Diagram (`ui.ts`)

The timing diagram uses Canvas 2D. Each input toggle records a sample of all signals. The diagram shows up to 25 time steps, with digital waveforms (high/low) for each signal.

**How to Explain It:**
"Every time the user changes an input, we record the state of all inputs and outputs. The timing diagram shows these as digital waveforms on a Canvas — similar to what you'd see on an oscilloscope or logic analyzer."

### Ripple-Carry Animation (`ui.ts`)

For the 4-bit ripple carry adder, a "Ripple Animate" button steps through the carry propagation one full adder at a time. Each stage highlights the active FA block and shows the carry value changing.

**How to Explain It:**
"The ripple animation shows how the carry bit propagates from the least significant bit to the most significant. Each step lights up one full adder, showing its inputs and the carry it produces. This demonstrates why ripple-carry adders have O(n) propagation delay."

---

## Circuit Catalog

### Adders

| Circuit | Inputs | Outputs | Key Equations |
|---------|--------|---------|---------------|
| Half Adder | A, B | Sum, Carry | S=A⊕B, C=A·B |
| Full Adder | A, B, Cin | Sum, Cout | S=A⊕B⊕Cin, Cout=AB+Cin(A⊕B) |
| 4-bit Ripple Carry | A3-A0, B3-B0, Cin | S3-S0, Cout | Cascaded full adders |

### Subtractors

| Circuit | Inputs | Outputs | Key Equations |
|---------|--------|---------|---------------|
| Half Subtractor | A, B | Diff, Bout | D=A⊕B, Bout=A'·B |
| Full Subtractor | A, B, Bin | Diff, Bout | D=A⊕B⊕Bin, Bout=A'·B+(A⊕B)'·Bin |
| 4-bit Ripple Borrow | A3-A0, B3-B0, Bin | D3-D0, Bout | Cascaded full subtractors |

### Multiplexers

| Circuit | Inputs | Outputs | Key Equation |
|---------|--------|---------|--------------|
| 2:1 MUX | I0, I1, S0 | Y | Y=S0'·I0+S0·I1 |
| 4:1 MUX | I0-I3, S0-S1 | Y | Y=S1'S0'I0+S1'S0I1+S1S0'I2+S1S0I3 |
| 8:1 MUX | I0-I7, S0-S2 | Y | 8-to-1 selection |

### Demultiplexers

| Circuit | Inputs | Outputs |
|---------|--------|---------|
| 1:2 DEMUX | D, S0 | Y0, Y1 |
| 1:4 DEMUX | D, S0-S1 | Y0-Y3 |
| 1:8 DEMUX | D, S0-S2 | Y0-Y7 |

### Decoders & Encoders

| Circuit | Inputs | Outputs |
|---------|--------|---------|
| 2:4 Decoder | A, B | Y0-Y3 |
| 3:8 Decoder | A, B, C | Y0-Y7 |
| 4:2 Priority Encoder | I0-I3 | Y0-Y1, V |
| 8:3 Priority Encoder | I0-I7 | Y0-Y2, V |

### Comparators

| Circuit | Inputs | Outputs |
|---------|--------|---------|
| 1-bit Comparator | A, B | A>B, A=B, A<B |
| 2-bit Comparator | A1,A0, B1,B0 | A>B, A=B, A<B |

---

## Professor / Viva Guide

### Q: How does the simulator know which circuit to run?

**A:** Each circuit is defined as a `CircuitDefinition` object in `Web2/src/circuits/*.ts`. They are all imported and registered in `Web2/src/circuits/index.ts` as the `CIRCUITS` map. When the user selects a circuit, `loadCircuitWorkspace()` stores it in `state.currentCircuit`. All subsequent operations (evaluate, render, truth table) use `state.currentCircuit`'s methods.

### Q: How is the output calculated?

**A:** Each circuit has an `evaluate` function that takes an `inputs` record and returns an `outputs` record. For example, the full adder's evaluate function computes `Sum = A ^ B ^ Cin` and `Cout = (A&B) | (B&Cin) | (A&Cin)`. This is called every time the user toggles an input.

### Q: How is the circuit diagram generated?

**A:** Each circuit has a `renderSchematic` function that returns an SVG markup string. It uses helper functions from `Web2/src/gates.ts` (like `gateXOR()`, `wireHopH()`, `wireV()`, `dot()`) to compose the SVG. The current input and output values are interpolated into the SVG text labels.

### Q: How does the animation work?

**A:** For the 4-bit ripple carry adder, `setupRippleAnimation()` in `ui.ts` implements a step-through animation. When the user clicks "Ripple Animate", it iterates through stages 0–3 with 650ms delays. Each stage calls `updateCircuitState(deps, stage)`, which passes the current stage index to `renderSchematic()`. The schematic highlights the active FA block with a different stroke color and width.

### Q: How does the timing diagram work?

**A:** Every time the user toggles an input, `recordWaveformSample()` captures the current state of all inputs and outputs as a `WaveformPoint`. These are stored in `state.waveformHistory` (max 25 entries). `drawTimingDiagram()` renders them on a Canvas element using 2D context — each signal gets a row with a digital waveform path.

### Q: Where is Verilog for each circuit?

**A:** Each `CircuitDefinition` has a `verilogModule` string property. For example, `full_adder.verilogModule` contains the complete Verilog module code. It's displayed in the UI and can be copied via the "Copy Verilog" button.

### Q: How does zoom/pan work?

**A:** `setupZoomPan()` in `ui.ts` attaches wheel (zoom) and mousedown/mousemove/mouseup (pan) events to the circuit diagram container. The SVG element gets a CSS `transform: translate(panX, panY) scale(zoomScale)` applied via `applyZoom()`.

---

## "Where Do I Find...?" Quick Reference

| Professor asks... | File | Function/Module |
|-------------------|------|-----------------|
| Circuit registry | `Web2/src/circuits/index.ts` | `CIRCUITS`, `CATEGORIES` |
| Half adder | `Web2/src/circuits/adders.ts` | `half_adder` |
| Full adder | `Web2/src/circuits/adders.ts` | `full_adder` |
| 4-bit ripple carry adder | `Web2/src/circuits/adders.ts` | `ripple_carry_adder_4bit` |
| Half subtractor | `Web2/src/circuits/subtractors.ts` | `half_subtractor` |
| Full subtractor | `Web2/src/circuits/subtractors.ts` | `full_subtractor` |
| 4-bit subtractor | `Web2/src/circuits/subtractors.ts` | `subtractor_4bit` |
| 2:1 MUX | `Web2/src/circuits/mux.ts` | `mux_2to1` |
| 4:1 MUX | `Web2/src/circuits/mux.ts` | `mux_4to1` |
| 8:1 MUX | `Web2/src/circuits/mux.ts` | `mux_8to1` |
| 1:2 DEMUX | `Web2/src/circuits/demux.ts` | `demux_1to2` |
| 1:4 DEMUX | `Web2/src/circuits/demux.ts` | `demux_1to4` |
| 1:8 DEMUX | `Web2/src/circuits/demux.ts` | `demux_1to8` |
| 2:4 Decoder | `Web2/src/circuits/decoders.ts` | `decoder_2to4` |
| 3:8 Decoder | `Web2/src/circuits/decoders.ts` | `decoder_3to8` |
| Priority encoder | `Web2/src/circuits/decoders.ts` | `priority_encoder_4to2`, `priority_encoder_8to3` |
| Comparator | `Web2/src/circuits/comparators.ts` | `comparator_1bit`, `comparator_2bit` |
| Circuit type definition | `Web2/src/types.ts` | `CircuitDefinition` |
| SVG gate helpers | `Web2/src/gates.ts` | `gateXOR()`, `wireHopH()`, etc. |
| Ripple animation | `Web2/src/ui.ts` | `setupRippleAnimation()` |
| Timing diagram | `Web2/src/ui.ts` | `drawTimingDiagram()` |
| Navigation | `Web2/src/ui.ts` | `setupNavigation()` |
| Zoom/pan | `Web2/src/ui.ts` | `setupZoomPan()` |
| Entry point | `Web2/script.ts` | Wires deps + calls setup functions |
