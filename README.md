# Digital Circuits Suite

> A browser-based educational suite for digital logic design: Boolean function minimization, combinational circuit simulation, and 7-segment display synthesis — all with AI-powered word-problem solving, SVG schematic rendering, and live interactive probing.

## Table of Contents

- [Project Overview](#project-overview)
- [Complete Directory Tree](#complete-directory-tree)
- [Complete Module Tree](#complete-module-tree)
- [System Architecture](#system-architecture)
- [Data Flow](#data-flow)
- [Feature → File → Function Index](#feature--file--function-index)
- ["Where Do I Find...?" Index](#where-do-i-find-index)
- [Build and Deployment](#build-and-deployment)
- [Development Workflow](#development-workflow)
- [Important Design Decisions](#important-design-decisions)
- [Known Limitations](#known-limitations)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

The Digital Circuits Suite is an educational web application for learning digital logic design. It consists of four independent front-end applications and a Python backend:

| Component | Purpose | URL Path |
|-----------|---------|----------|
| **Web1 — Boolean Logic Solver** | Input Boolean expressions (or word problems) → truth table → canonical SOP/POS → Quine-McCluskey minimization → Karnaugh map → AND/OR/NOT, NAND-only, and NOR-only circuits → verification → Verilog/C/LaTeX export. Live probe simulation on all three circuit variants. | `/Web1/` |
| **Web2 — Combinational Circuits Simulator** | Interactive simulator for 18 standard combinational circuits (adders, subtractors, MUX, DEMUX, decoders, encoders, comparators). Toggle inputs, see SVG schematics update live, truth table highlighting, waveform timing diagram, ripple-carry animation, Verilog export. | `/Web2/` |
| **Web3 — 7-Segment Display Simulator** | BCD-to-7-segment and hex-to-7-segment decoder. Interactive mode (click segments, toggle binary inputs, keyboard 0–F) and counter mode (automated clock). Karnaugh maps, Boolean expressions (QM-minimized), Verilog generation, decoder schematic, LED color picker, timing diagram. | `/Web3/` |
| **Web4 — Digital Logic Playground** | Interactive drag-and-drop circuit design environment with 14 gate types, wire connections, live simulation, waveform timing diagrams, undo/redo, save/load/export, and keyboard shortcuts. | `/Web4/` |
| **Backend** | FastAPI service for AI-powered Boolean problem solving. Accepts natural-language word problems, converts them to minterms via Gemini AI (with deterministic validation), or parses explicit Σm/Σd notation directly. | `https://digitalcircuits.onrender.com` |

**Technology Stack:**
- Frontend: Vanilla TypeScript → esbuild → IIFE bundles → static HTML/CSS/JS
- Backend: Python 3, FastAPI, Pydantic, Google Gemini (`google-genai`)
- Shared: TypeScript library for Boolean AST, tokenizer, parser, Quine-McCluskey, formatter, Verilog/C/LaTeX exporters
- Testing: Vitest (frontend), pytest (backend)
- Deployment: GitHub Pages (frontend), Render (backend)

---

## Complete Directory Tree

```
DigitalCircuits/
│
├── index.html                    # Landing page / home
├── style.css                     # Landing page styles
├── theme.js                      # Cross-page dark/light theme system (runs in <head>)
├── fx.js                         # Studio FX: sound effects, keyboard shortcuts, spotlight
├── package.json                  # Root package — scripts: build, typecheck, test
├── package-lock.json             # Lockfile
├── tsconfig.json                 # Root TypeScript config (includes shared + Web1-3 src)
├── vite.config.mjs               # Dev server (static multi-page)
├── vitest.config.ts              # Vitest config (tests/unit/**/*.test.ts)
├── README.md                     # ← This file
│
├── shared/                       # Shared TypeScript library (source of truth)
│   └── ts/
│       ├── boolean/
│       │   ├── ast.ts            # AST types, evalAst, truth table generation, equivalence check
│       │   ├── limits.ts         # Safety limits (MAX_VARIABLES=8, etc.)
│       │   ├── tokenizer.ts      # Tokenizer for Boolean expressions
│       │   ├── parser.ts         # Recursive-descent parser → AST
│       │   ├── minimizer.ts      # Quine-McCluskey: prime implicants, minimum cover, SOP/POS
│       │   └── formatter.ts      # AST → display string (postfix ', +, ^, juxtaposition)
│       ├── circuit/
│       │   ├── gates.ts          # Shared gate types, evaluation, metadata (used by Web1 & Web4)
│       │   └── circuitGraph.ts   # Shared circuit graph model, serialization, expression derivation
│       └── exporters/
│           ├── verilog.ts        # AST → Verilog HDL module
│           ├── c.ts              # AST → C/C++ function
│           └── latex.ts          # AST → LaTeX math expression
│
├── Web1/                         # Boolean Logic Solver
│   ├── index.html                # Main HTML (6 input modes, results sections)
│   ├── style.css                 # Full UI stylesheet (neon/doctor theme)
│   ├── script.js                 # ← Compiled output (DO NOT EDIT — generated by esbuild)
│   ├── theme.js                  # Theme system (identical copy)
│   ├── fx.js                     # Studio FX (identical copy)
│   ├── README.md                 # ← Web1 documentation
│   └── src/                      # ← Active TypeScript sources
│       ├── main.ts               # Entry point: wires UI, runs solve(), handles AI path
│       ├── solver.ts             # Pure solver: buildSolverModel, verification
│       ├── solverCore.ts         # Re-exports solver.ts + parseNumberList helper
│       ├── state.ts              # Application-wide mutable state
│       ├── legacy-shims.ts       # Window type augmentations
│       ├── ai/
│       │   └── booleanApi.ts     # HTTP client for Backend /api/solve-boolean
│       ├── circuits/
│       │   ├── circuitGraph.ts   # Circuit graph model, 3 builders, evaluation
│       │   ├── gates.ts          # Gate geometry (pin coords) + SVG rendering
│       │   ├── layout.ts         # Layered layout algorithm
│       │   └── renderer.ts       # Wire routing + full schematic rendering
│       ├── kmap/
│       │   ├── kmap.ts           # Karnaugh map grid + HTML generation
│       │   └── overlays.ts       # QM implicant overlay rectangles
│       └── ui/
│           ├── dom.ts            # byId, el, escapeHtml helpers
│           ├── truthTableInput.ts # Editable truth table input (Step 1)
│           ├── controls.ts       # Mode switching, examples, zoom/pan
│           ├── probe.ts          # Live probe: switches, wire coloring, HUD
│           └── results.ts        # Results rendering, export, verification
│
├── Web2/                         # Combinational Circuits Simulator
│   ├── index.html                # Main HTML (category → subcategory → workspace)
│   ├── style.css                 # Full UI stylesheet
│   ├── script.ts                 # Entry point: wires deps, initializes UI
│   ├── script.js                 # ← Compiled output (DO NOT EDIT)
│   ├── theme.js                  # Theme system (identical copy)
│   ├── fx.js                     # Studio FX (identical copy)
│   └── src/
│       ├── types.ts              # CircuitDefinition, WaveformPoint interfaces
│       ├── gates.ts              # SVG gate rendering helpers (wireHopH, gateXOR, etc.)
│       ├── ui.ts                 # UI logic: waveform, inputs, truth table, zoom, ripple
│       └── circuits/
│           ├── index.ts          # Circuit registry + CATEGORIES (18 circuits)
│           ├── adders.ts         # half_adder, full_adder, ripple_carry_adder_4bit
│           ├── subtractors.ts    # half_subtractor, full_subtractor, subtractor_4bit
│           ├── mux.ts            # mux_2to1, mux_4to1, mux_8to1
│           ├── demux.ts          # demux_1to2, demux_1to4, demux_1to8
│           ├── decoders.ts       # decoder_2to4, decoder_3to8, priority_encoder_4to2, 8to3
│           └── comparators.ts    # comparator_1bit, comparator_2bit
│
├── Web3/                         # 7-Segment Display Simulator
│   ├── index.html                # Main HTML (interactive + counter modes)
│   ├── style.css                 # Full UI stylesheet
│   ├── script.ts                 # Entry point: wires deps, initializes UI
│   ├── script.js                 # ← Compiled output (DO NOT EDIT)
│   ├── theme.js                  # Theme system (identical copy)
│   ├── fx.js                     # Studio FX (identical copy)
│   ├── README.md                 # ← Web3 documentation
│   └── src/
│       ├── types.ts              # SegmentId, HEX_PATTERNS, BCD_MINTERMS, HEX_CHARS
│       ├── hexExpressions.ts     # QM-derived Boolean expressions for all 7 segments
│       ├── segments.ts           # 7-segment SVG renderer + reverse pattern matching
│       ├── circuit.ts            # Decoder schematic + wire helpers
│       └── ui.ts                 # All UI logic: inputs, truth table, k-maps, counter, etc.
│
├── Web4/                         # Digital Logic Playground
│   ├── index.html                # Main HTML (3-panel: palette, canvas, waveform)
│   ├── style.css                 # Full UI stylesheet (dark + light themes)
│   ├── script.js                 # ← Compiled output (DO NOT EDIT)
│   ├── theme.js                  # Theme system (identical copy)
│   ├── fx.js                     # Studio FX (identical copy)
│   ├── README.md                 # ← Web4 documentation + user manual
│   └── src/
│       ├── main.ts               # Entry point: wires all modules, keyboard shortcuts
│       ├── state.ts              # Application state management
│       ├── types.ts              # Type definitions, gate sizes, port positions
│       ├── simulator.ts          # Circuit simulation engine (topo-sort + evaluation)
│       ├── renderer.ts           # SVG rendering: gates, wires, ports, signal values
│       ├── toolbar.ts            # Gate palette and toolbar definitions
│       ├── persistence.ts        # Save/load/export/import (localStorage + JSON)
│       ├── waveform.ts           # Waveform timing diagram (Canvas 2D)
│       └── ui/
│           └── help.ts           # Help modal with keyboard shortcuts + user guide

├── Backend/                      # FastAPI AI Backend
│   ├── backend.py                # Entry point: re-exports app from main.py
│   ├── main.py                   # FastAPI routes, CORS, Gemini client, validation pipeline
│   ├── models.py                 # Pydantic ProblemRequest model
│   ├── parser.py                 # Deterministic Σm/Σd parser (Path 1)
│   ├── ai_solver.py              # Gemini prompt builder, call_gemini, validate_variables
│   ├── boolean_engine.py         # Boolean expression evaluator + minterm generator
│   ├── config.py                 # Safety limits (mirrors shared/ts/boolean/limits.ts)
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # Template for GEMINI_API_KEY
│   └── README.md                 # ← Backend documentation
│
├── shared/                       # Shared scripts (copies for static deployment)
│   ├── theme.js                  # (managed by check-shared-sync.mjs)
│   └── fx.js
│
├── scripts/
│   ├── build.mjs                 # esbuild orchestrator: TS → script.js bundles
│   └── check-shared-sync.mjs     # Guards against theme.js/fx.js drift
│
├── tests/
│   ├── unit/                     # Vitest unit tests
│   │   ├── helpers.ts            # PRNG, random functions, Verilog/C evaluators
│   │   ├── parser.test.ts        # Tokenizer + parser tests
│   │   ├── minimizer.test.ts     # QM algorithm tests
│   │   ├── formatter.test.ts     # Display formatting tests
│   │   ├── exporters.test.ts     # Verilog/C/LaTeX export tests
│   │   ├── hexSegments.test.ts   # 7-segment expression tests
│   │   ├── constants.test.ts     # Constant-function edge cases
│   │   ├── multiCharVars.test.ts # Multi-character variable name tests
│   │   ├── solverCore.test.ts    # End-to-end solver tests
│   │   ├── property.test.ts      # Property-based fuzz tests
│   │   ├── circuitImage.test.ts  # Circuit image input tests (10 tests)
│   │   ├── waveform.test.ts      # Waveform playground tests (12 tests)
│   │   └── circuitGraph.test.ts  # Shared circuit model tests (21 tests)
│   └── backend/
│       ├── __init__.py
│       ├── test_retry.py         # Gemini retry logic + explicit minterm tests
│       └── test_ai_dataset.py    # Explicit Σm/Σd parser tests + AI test dataset
```

---

## Complete Module Tree

```
DigitalCircuits
│
├── Shared Boolean Engine (shared/ts/boolean/)
│   ├── AST — Node types, evaluation, truth table, variable collection
│   ├── Limits — Safety constants (8 vars, 2000 chars, 200K node budget)
│   ├── Tokenizer — Lexer with implicit AND insertion
│   ├── Parser — Recursive-descent → AST (OR < XOR < AND < NOT)
│   ├── Minimizer — Quine-McCluskey: prime implicants, minimum cover, SOP/POS
│   └── Formatter — AST → display string with auto-separator
│
├── Shared Circuit Model (shared/ts/circuit/)
│   ├── Gates — Gate type definitions, evaluation, metadata (Web1 & Web4)
│   └── CircuitGraph — Circuit graph model, serialization, expression derivation
│
├── Shared Code Exporters (shared/ts/exporters/)
│   ├── Verilog — Fully-parenthesized AST → Verilog HDL module
│   ├── C — AST → C/C++ bool function
│   └── LaTeX — AST → $$F = ...$$ math
│
├── Web1 — Boolean Logic Solver
│   ├── Input Modes
│   │   ├── Expression (typed Boolean)
│   │   ├── Minterms (numeric list)
│   │   ├── Maxterms (numeric list)
│   │   ├── Don't-Care + Minterms
│   │   ├── Truth Table (editable dropdowns)
│   │   └── Word Problem (AI → minterms via backend)
│   ├── Solver Pipeline
│   │   ├── Input Collection → RawInputs
│   │   ├── Model Building → SolverModel
│   │   ├── Canonical SOP / POS
│   │   ├── Quine-McCluskey Minimization
│   │   └── Simplified Expression
│   ├── Visualization
│   │   ├── Truth Table (result)
│   │   ├── Karnaugh Map (2-4 variables)
│   │   ├── K-map Group Overlays (QM implicants)
│   │   └── Don't-Care Summary
│   ├── Circuit Synthesis
│   │   ├── AND/OR/NOT Circuit (SOP)
│   │   ├── NAND-only Circuit (NAND-NAND)
│   │   └── NOR-only Circuit (NOR-NOR)
│   ├── Circuit Rendering
│   │   ├── Gate Geometry (pin coordinates)
│   │   ├── Layered Layout (longest-path levels)
│   │   ├── Wire Routing (channel routing, hop-arcs)
│   │   └── SVG Generation
│   ├── Live Probe
│   │   ├── Toggle Switches (per variable)
│   │   ├── Wire Coloring (high/low)
│   │   ├── Truth Table Row Highlight
│   │   └── Multimeter HUD
│   ├── Verification
│   │   └── Exhaustive comparison: original AST, simplified AST, all 3 circuits
│   ├── Code Export
│   │   ├── Verilog HDL
│   │   ├── C/C++
│   │   ├── LaTeX
│   │   └── Markdown Truth Table
│   └── UI
│       ├── Mode Switching
│       ├── Example Presets (expression + word problem)
│       ├── Zoom/Pan (per circuit)
│       └── Sound Effects
│
├── Web2 — Combinational Circuits Simulator
│   ├── Circuit Registry (18 circuits, 6 categories)
│   ├── Circuit Definitions
│   │   ├── Adders: Half, Full, 4-bit Ripple Carry
│   │   ├── Subtractors: Half, Full, 4-bit Ripple Borrow
│   │   ├── MUX: 2:1, 4:1, 8:1
│   │   ├── DEMUX: 1:2, 1:4, 1:8
│   │   ├── Decoders/Encoders: 2:4, 3:8, Priority 4:2, 8:3
│   │   └── Comparators: 1-bit, 2-bit
│   ├── Circuit Evaluation (evaluate function per circuit)
│   ├── SVG Schematic Rendering (renderSchematic per circuit)
│   ├── Input Toggle Buttons
│   ├── Truth Table (auto-highlighted active row)
│   ├── Waveform Timing Diagram (Canvas)
│   ├── Ripple-Carry Animation (4-bit adder)
│   ├── Boolean Expressions
│   ├── Verilog Module (per circuit)
│   └── Zoom/Pan
│
├── Web3 — 7-Segment Display Simulator
│   ├── Input System
│   │   ├── 4-bit Binary Switches (A=8, B=4, C=2, D=1)
│   │   ├── Keyboard Input (0-F keys)
│   │   └── Click-on-Segment Toggle
│   ├── Display Modes
│   │   ├── BCD (digits 0-9, 10-15 as don't-cares)
│   │   └── HEX (digits 0-F)
│   ├── Polarity
│   │   ├── Common Cathode (active HIGH)
│   │   └── Common Anode (active LOW, inverted)
│   ├── 7-Segment SVG Renderer
│   ├── Reverse Pattern Matching
│   ├── Truth Table (per-digit segment outputs)
│   ├── Boolean Expressions (QM-minimized per segment)
│   │   ├── HEX_EXPRESSIONS (16 digits, 7 expressions)
│   │   └── BCD_EXPRESSIONS (10 digits, 7 don't-care expressions)
│   ├── Karnaugh Maps (one per segment, 4-variable)
│   ├── Decoder Schematic (SVG with live wire coloring)
│   ├── Verilog Module (case-based decoder)
│   ├── Counter Mode
│   │   ├── Start/Stop/Reset
│   │   ├── Step Forward/Back
│   │   └── Adjustable Speed (ms / Hz)
│   ├── LED Color Picker (6 colors)
│   ├── Segment Waveform Timing Diagram
│   └── Zoom/Pan
│
└── Backend — FastAPI AI Service
    ├── FastAPI Application
    │   ├── CORS (allow all origins)
    │   └── Gemini Client (init at startup)
    ├── Routes
    │   ├── POST /api/solve-boolean (main solver)
    │   └── GET / (health check)
    ├── Path 1: Explicit Σm/Σd (deterministic)
    │   ├── Regex parser for F(A,B,C) = Σm(1,3,5) Σd(2)
    │   ├── Multi-character variable names
    │   └── Index validation
    ├── Path 2: Natural Language (AI)
    │   ├── Prompt Builder (10-section instruction)
    │   ├── Gemini API Call (gemini-3.5-flash-lite, JSON schema)
    │   ├── Variable Validation (regex, dedup, max 8)
    │   ├── Expression Validation (length, parseable)
    │   ├── Boolean Evaluation (Python AST sandbox)
    │   ├── Minterm Generation (exhaustive 2^n)
    │   ├── Don't-Care Evaluation
    │   ├── Constant-0 / Constant-1 Detection
    │   └── Retry Logic (1 retry with error context)
    └── Configuration
        ├── MAX_PROBLEM_LENGTH = 4000
        ├── MAX_VARIABLES = 8
        ├── MAX_EXPRESSION_LENGTH = 2000
        ├── MAX_DONT_CARE_CONDITIONS = 8
        ├── GEMINI_TIMEOUT_SECONDS = 30
        └── MAX_RETRIES = 1
```

---

## System Architecture

```
                         ┌─────────────────────────────────────────────┐
                         │              Static Frontend                │
                         │         (GitHub Pages / Local)              │
                         │                                             │
                         │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
                         │  │   Web1   │  │   Web2   │  │   Web3   │  │
                         │  │ Boolean  │  │  Circuit  │  │  7-Seg   │  │
                         │  │  Solver  │  │ Simulator │  │ Simulator │  │
                         │  └────┬─────┘  └──────────┘  └──────────┘  │
                         │       │                                      │
                         │       │  HTTP POST                          │
                         │       │  /api/solve-boolean                 │
                         │       │  {problem_statement: "..."}         │
                         └───────┼─────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────────┐
                    │   FastAPI Backend (Python)  │
                    │   digitalcircuits.onrender  │
                    │                            │
                    │   ┌──────────────────────┐ │
                    │   │ Path 1: Σm/Σd Parser │ │
                    │   │ (Deterministic)       │ │
                    │   └──────────────────────┘ │
                    │              OR              │
                    │   ┌──────────────────────┐ │
                    │   │ Path 2: AI Solver     │ │
                    │   │ ┌──────────────────┐ │ │
                    │   │ │ Prompt Builder    │ │ │
                    │   │ └────────┬─────────┘ │ │
                    │   │          ▼            │ │
                    │   │ ┌──────────────────┐ │ │
                    │   │ │ Gemini API Call   │ │ │
                    │   │ │ (gemini-3.5-     │ │ │
                    │   │ │  flash-lite)     │ │ │
                    │   │ └────────┬─────────┘ │ │
                    │   │          ▼            │ │
                    │   │ ┌──────────────────┐ │ │
                    │   │ │ Validation        │ │ │
                    │   │ │ • Variable check  │ │ │
                    │   │ │ • AST evaluate    │ │ │
                    │   │ │ • Minterm gen     │ │ │
                    │   │ │ • Constant detect │ │ │
                    │   │ └────────┬─────────┘ │ │
                    │   └──────────┼───────────┘ │
                    └──────────────┼──────────────┘
                                   │
                                   ▼
                         {variables, minterms,
                          dont_cares, descriptions}
```

---

## Data Flow

### A. Web1 Normal Boolean Expression Flow

```
User types "A·B + A'C"
        │
        ▼
┌─────────────────┐
│ Input Collection │  main.ts → collectRawInputs()
│ (mode: expression)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parser           │  shared/ts/boolean/parser.ts → parseExpression()
│ tokenizer → AST  │  (tokenizer.ts → insertImplicitAND → recursive descent)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Truth Table      │  shared/ts/boolean/ast.ts → astTruthTable()
│ 2^n rows         │  (generateCombinations → evalAst per row)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Canonical SOP/POS│  solver.ts → generateCanonicalSOP() / generateCanonicalPOS()
│ (one term/row)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ QM Minimization  │  shared/ts/boolean/minimizer.ts
│ • getPrimeImplicants()
│ • findMinimumCover()
│ → minimized SOP + POS
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Karnaugh Map     │  Web1/src/kmap/kmap.ts → generateKarnaughMap()
│ (Gray code grid) │  Web1/src/kmap/overlays.ts → positionKarnaughOverlays()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Circuit Graph    │  Web1/src/circuits/circuitGraph.ts
│ • buildBasicSOPCircuit()
│ • buildNANDCircuit()
│ • buildNORCircuit()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SVG Rendering    │  Web1/src/circuits/layout.ts → calculateCircuitLayout()
│                  │  Web1/src/circuits/renderer.ts → renderCircuit()
│                  │  Web1/src/circuits/gates.ts → renderGateSVG()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verification     │  solver.ts → verifySolution()
│ Exhaustive check │  (original AST × simplified AST × 3 circuits × all rows)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Code Export      │  shared/ts/exporters/verilog.ts → generateVerilogModule()
│ Verilog / C /    │  shared/ts/exporters/c.ts → generateCFunction()
│ LaTeX / Markdown │  shared/ts/exporters/latex.ts → generateLatex()
└─────────────────┘
```

### B. Web1 AI Word-Problem Flow

```
User types natural language
        │
        ▼
┌─────────────────┐
│ main.ts          │  runWordProblem() → fetchMintermsFromProblem()
│ AbortController  │  (cancels stale requests)
└────────┬────────┘
         │  HTTP POST /api/solve-boolean
         ▼
┌─────────────────────────────────────────────┐
│ Backend/ → main.py → solve_boolean()        │
│                                             │
│  1. Input validation (length, empty)        │
│  2. Try explicit Σm/Σd parser (Path 1)     │
│     parser.py → parse_explicit_minterms()   │
│     If matched → return immediately         │
│                                             │
│  3. Natural language (Path 2):              │
│     ai_solver.py → build_prompt()           │
│     ai_solver.py → call_gemini()            │
│     ai_solver.py → validate_variables()     │
│     boolean_engine.py → generate_minterms() │
│     boolean_engine.py → generate_dont_cares()│
│     Validation: constant-0/1 detection      │
│     Retry on failure (1 retry)              │
└────────┬────────────────────────────────────┘
         │  {variables, minterms, dont_cares, variable_descriptions}
         ▼
┌─────────────────┐
│ main.ts          │  showWordProblemLegend()
│ Display variable │  → returns RawInputs with wordProblem data
│ descriptions     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ buildSolverModel │  solver.ts → fromWordProblem()
│ → Same pipeline  │  (canonical SOP → QM → circuits → verify → export)
│ as expression    │
└─────────────────┘
```

### C. Web2 Simulation Flow

```
User clicks category → subcategory → circuit
        │
        ▼
┌─────────────────┐
│ CIRCUITS[id]     │  Web2/src/circuits/index.ts
│ CircuitDefinition│  (evaluate, truthTable, renderSchematic, verilogModule)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Input Toggle     │  Web2/src/ui.ts → buildInputButtons()
│ Button Click     │  → updateCircuitState()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ evaluate()       │  Per-circuit evaluate function
│ inputs → outputs │  (e.g., A^B^Cin for full adder sum)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ renderSchematic()│  Per-circuit SVG generation
│ SVG string with  │  (uses Web2/src/gates.ts helpers)
│ live wire colors │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Truth Table      │  buildTruthTable() → auto-highlight active row
│ highlight        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Waveform Canvas  │  recordWaveformSample() → drawTimingDiagram()
│ (time-series)    │  (up to 25 samples, Canvas 2D)
└─────────────────┘
```

### D. Web3 7-Segment Flow

```
User selects mode (interactive/counter)
        │
        ▼
┌─────────────────┐
│ Input: 4-bit     │  A(8), B(4), C(2), D(1) switches
│ or keyboard 0-F  │  or counter auto-increment
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ HEX_PATTERNS[id] │  Web3/src/types.ts → source of truth
│ → SegmentPattern │  (16 hex patterns × 7 segments)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Polarity         │  Common Cathode: seg=pattern[i]
│ (Cathode/Anode)  │  Common Anode: seg=1-pattern[i]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ render7Segment() │  Web3/src/segments.ts → SVG
│ Interactive seg  │  (click to toggle individual segments)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ findMatchingPattern() │ Reverse decode: pattern → digit description
└────────┬────────┘
         │
         ├──► Truth Table (buildTruthTable)
         │    10 rows (BCD) or 16 rows (HEX)
         │
         ├──► Boolean Expressions (hexExpressions.ts)
         │    HEX_EXPRESSIONS: QM-minimized from HEX_PATTERNS
         │    BCD_EXPRESSIONS: QM with 10-15 as don't-cares
         │
         ├──► Karnaugh Maps (buildKarnaughMaps)
         │    7 maps, 4-variable, Gray code grid
         │
         ├──► Decoder Schematic (renderDecoderSchematic)
         │    SVG with inverter gates + live segment badges
         │
         └──► Verilog (generateVerilogModule)
              case-based decoder with polarity-aware patterns
```

---

## Feature → File → Function Index

| Feature | Folder | File | Function / Constant | Purpose |
|---------|--------|------|----------------------|---------|
| **Boolean parsing** | shared/ts/boolean | tokenizer.ts | `tokenize()` | Lex expression into tokens |
| **Boolean parsing** | shared/ts/boolean | tokenizer.ts | `insertImplicitAND()` | Add implicit AND operators |
| **Boolean parsing** | shared/ts/boolean | parser.ts | `parseExpression()` | Parse tokens → AST + variable list |
| **AST evaluation** | shared/ts/boolean | ast.ts | `evalAst()` | Evaluate AST with variable assignment |
| **Truth table** | shared/ts/boolean | ast.ts | `astTruthTable()` | Generate truth table from AST |
| **Truth table** | shared/ts/boolean | ast.ts | `generateCombinations()` | All 2^n input combinations |
| **Equivalence check** | shared/ts/boolean | ast.ts | `firstMismatch()` | Compare two ASTs exhaustively |
| **Safety limits** | shared/ts/boolean | limits.ts | `LIMITS` | MAX_VARIABLES=8, MAX_EXPRESSION_LENGTH=2000 |
| **Quine-McCluskey** | shared/ts/boolean | minimizer.ts | `getPrimeImplicants()` | Group + merge + find primes |
| **Minimum cover** | shared/ts/boolean | minimizer.ts | `findMinimumCover()` | Essential primes + exact cover search |
| **SOP minimization** | shared/ts/boolean | minimizer.ts | `minimizeSOP()` | Full SOP pipeline with don't-cares |
| **POS minimization** | shared/ts/boolean | minimizer.ts | `minimizePOS()` | POS via complement's SOP |
| **AST construction** | shared/ts/boolean | minimizer.ts | `patternToTermAst()` | Implicant pattern → AND-of-literals AST |
| **AST construction** | shared/ts/boolean | minimizer.ts | `sopAstFromImplicants()` | OR of all SOP terms |
| **AST construction** | shared/ts/boolean | minimizer.ts | `posAstFromImplicants()` | AND of all POS clauses |
| **Display formatting** | shared/ts/boolean | formatter.ts | `formatAst()` | AST → string with auto-separator |
| **Term display** | shared/ts/boolean | formatter.ts | `termToString()` | Implicant pattern → "A·B'C" |
| **Clause display** | shared/ts/boolean | formatter.ts | `clauseToString()` | Implicant pattern → "(A+B')" |
| **Verilog export** | shared/ts/exporters | verilog.ts | `generateVerilogModule()` | AST → Verilog HDL |
| **C export** | shared/ts/exporters | c.ts | `generateCFunction()` | AST → C/C++ bool function |
| **LaTeX export** | shared/ts/exporters | latex.ts | `generateLatex()` | AST → $$F = ...$$ |
| **Web1 entry point** | Web1/src | main.ts | `init()`, `solve()` | Wire UI, run solve pipeline |
| **Solver core** | Web1/src | solver.ts | `buildSolverModel()` | RawInputs → SolverModel |
| **Input modes** | Web1/src | solver.ts | `fromExpression()`, `fromMintermList()`, etc. | Mode-specific builders |
| **Canonical SOP** | Web1/src | solver.ts | `generateCanonicalSOP()` | Truth rows → sum of minterms |
| **Canonical POS** | Web1/src | solver.ts | `generateCanonicalPOS()` | Truth rows → product of maxterms |
| **Verification** | Web1/src | solver.ts | `verifySolution()` | Compare all implementations |
| **AI API client** | Web1/src/ai | booleanApi.ts | `fetchMintermsFromProblem()` | HTTP POST to backend |
| **Circuit graph** | Web1/src/circuits | circuitGraph.ts | `buildBasicSOPCircuit()` | SOP → AND/OR/NOT graph |
| **NAND circuit** | Web1/src/circuits | circuitGraph.ts | `buildNANDCircuit()` | SOP → NAND-NAND graph |
| **NOR circuit** | Web1/src/circuits | circuitGraph.ts | `buildNORCircuit()` | POS → NOR-NOR graph |
| **Circuit evaluation** | Web1/src/circuits | circuitGraph.ts | `evaluateCircuit()`, `evaluateAllNodeValues()` | DAG evaluation with memoization |
| **Gate geometry** | Web1/src/circuits | gates.ts | `getGateInfo()` | Pin coordinates for each gate type |
| **Gate SVG** | Web1/src/circuits | gates.ts | `renderGateSVG()` | SVG markup for one gate |
| **Layout algorithm** | Web1/src/circuits | layout.ts | `calculateCircuitLayout()` | Level assignment + vertical stacking |
| **Wire routing** | Web1/src/circuits | renderer.ts | `renderEdgesSVG()` | Channel routing with hop-arcs |
| **Schematic render** | Web1/src/circuits | renderer.ts | `renderCircuit()` | Full SVG: edges + gates + output |
| **Karnaugh map** | Web1/src/kmap | kmap.ts | `generateKarnaughMap()` | Gray-code grid HTML |
| **K-map grid** | Web1/src/kmap | kmap.ts | `computeKMapGrid()` | 2-4 variable grid computation |
| **K-map overlays** | Web1/src/kmap | overlays.ts | `positionKarnaughOverlays()` | QM implicant rectangles |
| **Live probe** | Web1/src/ui | probe.ts | `setupProbePanels()`, `toggleProbe()` | Switch toggles + wire coloring |
| **Wire coloring** | Web1/src/ui | probe.ts | `updateCircuitSignals()` | Recolor wires per probe state |
| **Export buttons** | Web1/src/ui | results.ts | `setupExportButtons()` | Verilog/C/LaTeX/Markdown copy |
| **Mode switching** | Web1/src/ui | controls.ts | `updateInputInterface()` | Show/hide input sections |
| **Example presets** | Web1/src/ui | controls.ts | `EXAMPLE_PRESETS`, `WORD_PROBLEM_PRESETS` | Pre-filled examples |
| **Circuit registry** | Web2/src/circuits | index.ts | `CIRCUITS`, `CATEGORIES` | 18 circuits, 6 categories |
| **Half adder** | Web2/src/circuits | adders.ts | `half_adder.evaluate` | S=A^B, C=A&B |
| **Full adder** | Web2/src/circuits | adders.ts | `full_adder.evaluate` | S=A^B^Cin, Cout=... |
| **4-bit adder** | Web2/src/circuits | adders.ts | `ripple_carry_adder_4bit.evaluate` | Cascaded full adders |
| **Ripple animation** | Web2/src/ui | ui.ts | `setupRippleAnimation()` | Step-through carry propagation |
| **Waveform diagram** | Web2/src/ui | ui.ts | `recordWaveformSample()`, `drawTimingDiagram()` | Canvas 2D waveform |
| **Navigation** | Web2/src/ui | ui.ts | `setupNavigation()` | Category → subcategory → workspace |
| **Segment patterns** | Web3/src | types.ts | `HEX_PATTERNS` | 16 hex digit → 7-segment patterns |
| **BCD minterms** | Web3/src | types.ts | `BCD_MINTERMS` | Per-segment minterm lists |
| **Segment SVG** | Web3/src | segments.ts | `render7Segment()` | Interactive 7-segment display |
| **Reverse decode** | Web3/src | segments.ts | `findMatchingPattern()` | Pattern → digit description |
| **Decoder schematic** | Web3/src | circuit.ts | `renderDecoderSchematic()` | SVG with inverter gates |
| **HEX expressions** | Web3/src | hexExpressions.ts | `HEX_EXPRESSIONS` | QM-minimized per segment |
| **BCD expressions** | Web3/src | hexExpressions.ts | `BCD_EXPRESSIONS` | QM with don't-cares |
| **Expression derivation** | Web3/src | hexExpressions.ts | `deriveSegmentExpressions()` | QM pipeline + verification |
| **Karnaugh maps** | Web3/src | ui.ts | `buildKarnaughMaps()` | 7 four-variable K-maps |
| **Verilog generation** | Web3/src | ui.ts | `generateVerilogModule()` | Case-based decoder |
| **Counter** | Web3/src | ui.ts | `setupCounter()` | setInterval + speed control |
| **LED colors** | Web3/src | ui.ts | `setupLedColorPicker()` | 6 CSS class themes |
| **Keyboard input** | Web3/src | ui.ts | `setupKeyboard()` | 0-F key handlers |
| **Backend route** | Backend | main.py | `solve_boolean()` | POST /api/solve-boolean |
| **Health check** | Backend | main.py | `root()` | GET / |
| **Σm/Σd parser** | Backend | parser.py | `parse_explicit_minterms()` | Regex-based explicit notation |
| **AI prompt** | Backend | ai_solver.py | `build_prompt()` | 10-section instruction template |
| **Gemini call** | Backend | ai_solver.py | `call_gemini()` | Structured JSON output via API |
| **Variable validation** | Backend | ai_solver.py | `validate_variables()` | Regex + dedup + empty check |
| **Expression evaluator** | Backend | boolean_engine.py | `evaluate_boolean_expression()` | Python AST sandbox |
| **Minterm generator** | Backend | boolean_engine.py | `generate_minterms()` | 2^n exhaustive evaluation |
| **Don't-care generator** | Backend | boolean_engine.py | `generate_dont_cares()` | Per-condition evaluation |
| **Theme system** | (root) | theme.js | `applyTheme()`, `toggleTheme()` | 5-layer persistence, FOUC-free |
| **Sound effects** | (root) | fx.js | `SFX.click()`, `SFX.relay()`, etc. | Web Audio API synthesis |
| **Keyboard shortcuts** | (root) | fx.js | `initShortcutsHUD()` | ? T M Enter Space Alt+1-3 |

---

## "Where Do I Find...?" Index

### Boolean Parser / Lexer / AST

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is the Boolean parser? | `shared/ts/boolean/parser.ts` | `parseExpression()` |
| Where is the lexer/tokenizer? | `shared/ts/boolean/tokenizer.ts` | `tokenize()`, `insertImplicitAND()` |
| Where is the AST defined? | `shared/ts/boolean/ast.ts` | `AstNode` type, `evalAst()` |
| How does operator precedence work? | `shared/ts/boolean/parser.ts` | `parseOR → parseXOR → parseAND → parseUnary → parsePrimary` |
| Where is implicit AND handled? | `shared/ts/boolean/tokenizer.ts` | `insertImplicitAND()` |
| Where are multi-char variables supported? | `shared/ts/boolean/tokenizer.ts` | Maximal munch in `tokenize()` |

### Truth Table / Canonical Forms

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is the truth table generated? | `shared/ts/boolean/ast.ts` | `astTruthTable()` |
| Where is canonical SOP? | `Web1/src/solver.ts` | `generateCanonicalSOP()` |
| Where is canonical POS? | `Web1/src/solver.ts` | `generateCanonicalPOS()` |
| Where are all 2^n combinations generated? | `shared/ts/boolean/ast.ts` | `generateCombinations()` |

### Quine-McCluskey Minimization

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is Quine-McCluskey implemented? | `shared/ts/boolean/minimizer.ts` | Full file |
| Where are prime implicants found? | `shared/ts/boolean/minimizer.ts` | `getPrimeImplicants()` |
| Where is the minimum cover search? | `shared/ts/boolean/minimizer.ts` | `findMinimumCover()` |
| Where are essential primes extracted? | `shared/ts/boolean/minimizer.ts` | Inside `findMinimumCover()` |
| What happens when the search is too large? | `shared/ts/boolean/minimizer.ts` | Node budget → greedy fallback, `coverTruncated` flag |
| Where is SOP minimized? | `shared/ts/boolean/minimizer.ts` | `minimizeSOP()` |
| Where is POS minimized? | `shared/ts/boolean/minimizer.ts` | `minimizePOS()` |

### Karnaugh Map

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is the K-map generated? | `Web1/src/kmap/kmap.ts` | `generateKarnaughMap()` |
| Where is the K-map grid computed? | `Web1/src/kmap/kmap.ts` | `computeKMapGrid()` |
| Where is Gray code generated? | `Web1/src/kmap/kmap.ts` | `grayCode()` |
| Where are K-map group overlays drawn? | `Web1/src/kmap/overlays.ts` | `positionKarnaughOverlays()` |
| How does wrapping work? | `Web1/src/kmap/overlays.ts` | `contiguousRuns()`, `segmentsForImplicant()` |
| Where are 7-segment K-maps? | `Web3/src/ui.ts` | `buildKarnaughMaps()` |

### Circuit Graph / SVG Rendering

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is the circuit graph model? | `Web1/src/circuits/circuitGraph.ts` | `CircuitGraph`, `CircuitNode` types |
| Where is the AND/OR/NOT circuit built? | `Web1/src/circuits/circuitGraph.ts` | `buildBasicSOPCircuit()` |
| Where is the NAND-only circuit? | `Web1/src/circuits/circuitGraph.ts` | `buildNANDCircuit()` |
| Where is the NOR-only circuit? | `Web1/src/circuits/circuitGraph.ts` | `buildNORCircuit()` |
| Where is the layout algorithm? | `Web1/src/circuits/layout.ts` | `calculateCircuitLayout()` |
| Where is wire routing? | `Web1/src/circuits/renderer.ts` | `renderEdgesSVG()` |
| Where is SVG gate rendering? | `Web1/src/circuits/gates.ts` | `renderGateSVG()` |
| Where are gate pin coordinates? | `Web1/src/circuits/gates.ts` | `getGateInfo()` |
| Where is the full schematic assembled? | `Web1/src/circuits/renderer.ts` | `renderCircuit()` |

### Live Probe / Verification

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is live probing? | `Web1/src/ui/probe.ts` | `setupProbePanels()`, `toggleProbe()` |
| Where are wires recolored? | `Web1/src/ui/probe.ts` | `updateCircuitSignals()`, `updateGraphWires()` |
| Where is verification done? | `Web1/src/solver.ts` | `verifySolution()` |
| How does verification work? | `Web1/src/solver.ts` | Exhaustive: original AST × simplified AST × 3 circuits |
| Where is circuit evaluation? | `Web1/src/circuits/circuitGraph.ts` | `evaluateCircuit()`, `evaluateAllNodeValues()` |

### Code Export

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is Verilog generated? | `shared/ts/exporters/verilog.ts` | `generateVerilogModule()` |
| Where is C code generated? | `shared/ts/exporters/c.ts` | `generateCFunction()` |
| Where is LaTeX generated? | `shared/ts/exporters/latex.ts` | `generateLatex()` |
| Where is Web3 Verilog generated? | `Web3/src/ui.ts` | `generateVerilogModule()` |
| Where is Web2 Verilog? | `Web2/src/circuits/*.ts` | `verilogModule` string per circuit |

### AI / Backend

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is the API call? | `Web1/src/ai/booleanApi.ts` | `fetchMintermsFromProblem()` |
| Where is the backend route? | `Backend/main.py` | `solve_boolean()` |
| Where is the Gemini prompt? | `Backend/ai_solver.py` | `build_prompt()` |
| Where is Gemini called? | `Backend/ai_solver.py` | `call_gemini()` |
| Where is the Σm/Σd parser? | `Backend/parser.py` | `parse_explicit_minterms()` |
| Where is expression evaluation? | `Backend/boolean_engine.py` | `evaluate_boolean_expression()` |
| Where are minterms generated? | `Backend/boolean_engine.py` | `generate_minterms()` |
| Where is retry logic? | `Backend/main.py` | `solve_boolean()` retry loop |
| Where is variable validation? | `Backend/ai_solver.py` | `validate_variables()` |

### 7-Segment Display

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where are segment patterns? | `Web3/src/types.ts` | `HEX_PATTERNS`, `BCD_MINTERMS` |
| Where is the 7-segment SVG? | `Web3/src/segments.ts` | `render7Segment()` |
| Where is reverse decoding? | `Web3/src/segments.ts` | `findMatchingPattern()` |
| Where are HEX expressions derived? | `Web3/src/hexExpressions.ts` | `HEX_EXPRESSIONS`, `deriveSegmentExpressions()` |
| Where are BCD expressions? | `Web3/src/hexExpressions.ts` | `BCD_EXPRESSIONS` |
| Where is the counter? | `Web3/src/ui.ts` | `setupCounter()` |
| Where is the decoder schematic? | `Web3/src/circuit.ts` | `renderDecoderSchematic()` |
| Where is BCD vs HEX handled? | `Web3/src/ui.ts` | `setupModeControls()` |

### Web2 Circuits

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is the circuit registry? | `Web2/src/circuits/index.ts` | `CIRCUITS`, `CATEGORIES` |
| Where are adders? | `Web2/src/circuits/adders.ts` | `half_adder`, `full_adder`, `ripple_carry_adder_4bit` |
| Where are subtractors? | `Web2/src/circuits/subtractors.ts` | `half_subtractor`, `full_subtractor`, `subtractor_4bit` |
| Where is MUX? | `Web2/src/circuits/mux.ts` | `mux_2to1`, `mux_4to1`, `mux_8to1` |
| Where is DEMUX? | `Web2/src/circuits/demux.ts` | `demux_1to2`, `demux_1to4`, `demux_1to8` |
| Where are decoders? | `Web2/src/circuits/decoders.ts` | `decoder_2to4`, `decoder_3to8`, `priority_encoder_*` |
| Where are comparators? | `Web2/src/circuits/comparators.ts` | `comparator_1bit`, `comparator_2bit` |
| Where is ripple animation? | `Web2/src/ui.ts` | `setupRippleAnimation()` |
| Where is the timing diagram? | `Web2/src/ui.ts` | `drawTimingDiagram()` |

### Theme / Sound / Keyboard

| Professor asks... | Go to... | Function/Module |
|-------------------|----------|-----------------|
| Where is the theme system? | `theme.js` (root) | `applyTheme()`, `toggleTheme()`, `getPreferredTheme()` |
| Where is the sound engine? | `fx.js` (root) | `SFX.click()`, `SFX.relay()`, `SFX.tick()`, `SFX.success()` |
| Where are keyboard shortcuts? | `fx.js` (root) | `initShortcutsHUD()` |

---

## Build and Deployment

### TypeScript Compilation

TypeScript is compiled via **esbuild** (not `tsc`). The build script:

```bash
node scripts/build.mjs          # Build all three apps
node scripts/build.mjs web1     # Build Web1 only
node scripts/build.mjs web2     # Build Web2 only
node scripts/build.mjs web3     # Build Web3 only
```

**Build entries:**
| App | Entry Point | Output |
|-----|-------------|--------|
| Web1 | `Web1/src/main.ts` | `Web1/script.js` |
| Web2 | `Web2/script.ts` | `Web2/script.js` |
| Web3 | `Web3/script.ts` | `Web3/script.js` |

The output format is **IIFE** (immediately-invoked function expression), targeting ES2020. The compiled `script.js` files are committed to the repository and loaded via `<script>` tags in each `index.html`.

### Shared Code Synchronization

The `theme.js` and `fx.js` files are copied identically across root, Web1/, Web2/, Web3/. The sync check:

```bash
npm run check:shared     # Verifies all copies are identical
```

### Backend Deployment

The backend runs on **Render** as a Python service:

```bash
cd Backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Required environment variable:** `GEMINI_API_KEY`

The API base URL for the frontend is configured in `Web1/src/ai/booleanApi.ts`:
```typescript
const DEFAULT_API_BASE = "https://digitalcircuits.onrender.com";
// Override: window.DC_BOOLEAN_API_BASE = "http://localhost:8000"
```

### Frontend Deployment

The frontend is a **static site** (GitHub Pages). Each `index.html` loads:
1. `theme.js` (in `<head>` for instant FOUC-free theme)
2. `fx.js` (sound effects + keyboard shortcuts)
3. `script.js` (the esbuild-compiled bundle)

### NPM Scripts

| Command | Action |
|---------|--------|
| `npm run build` | Typecheck + build all apps |
| `npm run build:web1` | Build Web1 only |
| `npm run build:web2` | Build Web2 only |
| `npm run build:web3` | Build Web3 only |
| `npm run typecheck` | `tsc --noEmit` (no output) |
| `npm test` | Run Vitest unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:backend` | Run pytest backend tests |
| `npm run check:shared` | Verify theme.js/fx.js copies are identical |

---

## Development Workflow

### Where to Edit

| What | Edit | Then |
|------|------|------|
| Boolean algorithms | `shared/ts/boolean/*.ts` | `npm run build` |
| Verilog/C/LaTeX export | `shared/ts/exporters/*.ts` | `npm run build` |
| Web1 logic | `Web1/src/**/*.ts` | `npm run build:web1` |
| Web2 logic | `Web2/src/**/*.ts` | `npm run build:web2` |
| Web3 logic | `Web3/src/**/*.ts` | `npm run build:web3` |
| Backend logic | `Backend/*.py` | Restart uvicorn |
| Theme/Sound | `theme.js` / `fx.js` (root) | Copy to Web1-3, or run `npm run check:shared` |
| HTML structure | `Web1/index.html`, etc. | No build needed (loaded directly) |
| CSS styles | `Web1/style.css`, etc. | No build needed |

### What NOT to Edit Manually

- **`Web1/script.js`** — generated by esbuild from `Web1/src/main.ts`
- **`Web2/script.js`** — generated by esbuild from `Web2/script.ts`
- **`Web3/script.js`** — generated by esbuild from `Web3/script.ts`
- **`theme.js` / `fx.js` in Web1-3** — must match root copies

### Running Tests

```bash
npm test                    # All unit tests
npm run test:backend        # Backend pytest tests
```

### Running Backend Locally

```bash
cd Backend
cp .env.example .env        # Add your GEMINI_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

---

## Important Design Decisions

### 1. Modular TypeScript Architecture

**What:** Each web app uses modular TypeScript sources in `src/` directories, bundled via esbuild into `script.js`.

**Where:** `Web1/src/main.ts`, `Web2/script.ts`, `Web3/script.ts` are the entry points.

**Why:** Separation of concerns — parser, solver, circuits, K-map, UI, and AI each in their own file.

**What breaks if changed:** Always edit `*.ts` source files, never `script.js` directly.

### 2. esbuild IIFE Bundles (Not Vite)

**What:** Production builds use esbuild to create IIFE bundles. Vite is only used for local dev serving.

**Where:** `scripts/build.mjs`.

**Why:** The deployment model is static files (GitHub Pages). IIFE bundles work without a module bundler at runtime — just `<script>` tags.

### 3. Gemini Never Touches the Browser

**What:** The Gemini API key lives only on the backend. The frontend sends natural language, the backend calls Gemini, validates the result, and returns minterms.

**Where:** `Backend/main.py` (server), `Web1/src/ai/booleanApi.ts` (client).

**Why:** Security — API keys must never be exposed to the client.

### 4. Deterministic Verification of AI Results

**What:** The backend never trusts Gemini's minterms directly. It receives an expression, evaluates it exhaustively for all 2^n combinations, and generates minterms deterministically.

**Where:** `Backend/boolean_engine.py` → `generate_minterms()`.

**Why:** LLMs can hallucinate. By evaluating the expression ourselves, we guarantee correct minterms regardless of what Gemini claims.

### 5. Retry with Error Context

**What:** When the AI result fails validation (constant-0, constant-1, bad variables), the error is appended to the prompt for a retry.

**Where:** `Backend/main.py` → retry loop, `Backend/ai_solver.py` → `build_prompt(retry_error=...)`.

**Why:** Gives the LLM a chance to correct its mistake with specific feedback.

### 6. Node Budget for QM Search

**What:** The exact-cover branch search in Quine-McCluskey is bounded by a 200,000-node budget. When exceeded, the algorithm falls back to greedy coverage.

**Where:** `shared/ts/boolean/minimizer.ts` → `findMinimumCover()`, `LIMITS.MINIMIZE_NODE_BUDGET`.

**Why:** Prevents browser freezing on complex functions. The result is always logically equivalent (verified); only guaranteed minimality is relaxed.

### 7. HEX_PATTERNS as Single Source of Truth

**What:** The 7-segment truth table, K-maps, Boolean expressions, and Verilog are all derived from `HEX_PATTERNS` in `Web3/src/types.ts`.

**Where:** `Web3/src/types.ts` → `HEX_PATTERNS`, `Web3/src/hexExpressions.ts` → `deriveSegmentExpressions()`.

**Why:** One canonical pattern table prevents inconsistencies across truth tables, K-maps, and expressions.

---

## Known Limitations

1. **K-maps only support 2–4 variables.** The `computeKMapGrid()` function returns `null` for other sizes. 5+ variable expressions show a message instead.

2. **QM exact-cover budget.** Very large functions (6+ variables with many minterms) may trigger the greedy fallback. The result is correct but not guaranteed minimal.

3. **`script.js` files are generated.** Always edit the corresponding `.ts` source files.

4. **Backend requires Gemini API key.** The word-problem feature does not work without `GEMINI_API_KEY` set. Explicit Σm/Σd notation still works.

5. **CORS is fully open** (`allow_origins=["*"]`). This is fine for an educational project but would need restricting for production.

6. **Render cold starts.** The free-tier Render instance may take 30–60 seconds to wake up. The frontend has a 45-second timeout (`REQUEST_TIMEOUT_MS` in `booleanApi.ts`).

7. **Static deployment means no server-side rendering.** All computation happens in the browser or via the backend API.

8. **Shared scripts are manually duplicated.** `theme.js` and `fx.js` exist in 4 locations and must be kept in sync via `npm run check:shared`.

---

## Troubleshooting

| Problem | Where to Investigate |
|---------|---------------------|
| **Backend unreachable** | Check `Web1/src/ai/booleanApi.ts` → `apiBase()`. Verify `https://digitalcircuits.onrender.com` is live. Check browser network tab. |
| **Gemini failure** | Check backend logs. Verify `GEMINI_API_KEY` is set. Check `Backend/config.py` → `GEMINI_TIMEOUT_SECONDS`. |
| **CORS error** | Backend `main.py` allows all origins. If you see CORS errors, the backend may be down. |
| **API response mismatch** | Check `Web1/src/ai/booleanApi.ts` → response parsing. Verify field names: `variables`, `minterms`, `dont_cares`. |
| **TypeScript compilation failure** | Run `npm run typecheck`. Check imports resolve correctly. Ensure `shared/ts/` files are not modified incompatibly. |
| **Missing environment variable** | Backend: `GEMINI_API_KEY` in `Backend/.env`. Frontend: `window.DC_BOOLEAN_API_BASE` for dev override. |
| **GitHub Pages path issues** | Ensure `index.html` files are at the correct paths. Theme parameter `?theme=dark` must survive navigation. |
| **Render deployment failure** | Check `Backend/requirements.txt` is complete. Verify Python version compatibility. |
| **Stale `script.js`** | Run `npm run build:web1` (or web2/web3). The committed `.js` file may be out of date with source `.ts`. |
| **Shared scripts out of sync** | Run `npm run check:shared`. If drift detected, copy root `theme.js`/`fx.js` to Web1-4. |

---

## New Features (v2.2.0)

### Feature 1: Circuit Image Input (Web1)

Upload a circuit image (PNG, JPEG, WebP) to the Boolean Solver and have AI analyze it into a Boolean function.

**Flow:**
```
Circuit Image → AI recognition → Structured circuit graph → Boolean function → Existing solver pipeline
```

**Files:**
- `Web1/index.html` — Circuit Image upload section with drag-and-drop UI
- `Web1/src/main.ts` — `initCircuitImageUpload()`, `runCircuitImage()`
- `Web1/src/ai/booleanApi.ts` — `analyzeCircuitImage()`, `preprocessImage()`
- `Backend/main.py` — `POST /api/analyze-circuit-image` endpoint
- `Backend/models.py` — `CircuitImageRequest` model

**Backend endpoint:** `POST /api/analyze-circuit-image`
```json
{"image": "data:image/png;base64,..."}
```

**AI output schema:**
```json
{
    "variables": ["A", "B", "C"],
    "minterms": [2, 3, 7],
    "dont_cares": [],
    "expression": "A'B + B·C",
    "confidence": 0.85,
    "circuit": { "gates": [...], "connections": [...] }
}
```

### Feature 2: Interactive Waveform Playground (Web1)

At the bottom of Web1 results, experiment with the solved Boolean function using configurable input signal patterns.

**Features:**
- Clickable grid editor for input patterns (toggle 0/1)
- Canvas timing diagram showing inputs and output over time
- Play/Pause/Stop/Step controls
- Speed and zoom controls
- Output F is computed from the actual Boolean logic
- Automatically updates when input patterns change
- Resets when a new function is solved

**Files:**
- `Web1/index.html` — Waveform playground section (card #13)
- `Web1/src/ui/waveform.ts` — `initWaveformPlayground()`, `setupWaveformControls()`, `drawWaveform()`
- `Web1/src/ui/results.ts` — Initializes waveform after solving
- `Web1/style.css` — Waveform and grid editor styles

### Feature 3: Digital Logic Playground (Web4)

A new interactive circuit design environment with drag-and-drop gate placement, wire connections, live simulation, and more.

**Architecture:**
```
Web4/
├── index.html          # Main page with 3-panel layout
├── style.css           # Full UI stylesheet
├── script.js           # Compiled output
├── theme.js            # Theme system (identical copy)
├── fx.js               # Studio FX (identical copy)
└── src/
    ├── main.ts         # Entry point: wires all modules
    ├── state.ts        # Application state
    ├── types.ts        # Type definitions
    ├── simulator.ts    # Circuit simulation engine
    ├── renderer.ts     # SVG rendering for gates/wires
    ├── toolbar.ts      # Gate palette and toolbar
    ├── persistence.ts  # Save/load/export/import
    └── waveform.ts     # Timing diagram panel
```

**Available gates:**
INPUT, OUTPUT, CONST, CLOCK, SWITCH, LED, NOT, BUFFER, AND, OR, NAND, NOR, XOR, XNOR

**Features:**
- Drag-and-drop gate placement from palette
- Click-to-add at canvas center
- Wire connections between output and input ports
- Orthogonal wire routing
- Live signal propagation (deterministic simulation)
- Signal value badges on wires
- Waveform / oscilloscope panel
- Save/Load (localStorage)
- Export/Import JSON
- Undo/Redo
- Keyboard shortcuts (Delete, Ctrl+Z, Ctrl+S, V/W/D modes)
- Zoom/Pan/Fit-to-screen
- Grid snap
- Responsive layout

### Shared Circuit Model

A new shared module `shared/ts/circuit/` provides circuit primitives used by both Web1 and Web4:

- `shared/ts/circuit/gates.ts` — Gate types, evaluation, metadata
- `shared/ts/circuit/circuitGraph.ts` — Circuit graph model, evaluation, serialization, expression derivation

**Cross-tool interoperability:**
- Web1-generated circuits can be opened in Web4
- Web4-built circuits can be analyzed by Web1
- Both tools share the same `GateType` and evaluation logic

### Navigation

Web4 has been added to the site navigation across all pages:
- Root index.html — 4th project card
- Web1/Web2/Web3 nav bars — 🎮 Logic Playground link
- Web4 nav bar — Active state

### New Tests

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `tests/unit/circuitImage.test.ts` | 10 | Circuit image input mode, validation, multi-gate circuits |
| `tests/unit/waveform.test.ts` | 12 | Waveform computation, pattern generation, truth table equivalence |
| `tests/unit/circuitGraph.test.ts` | 21 | Shared circuit model: nodes, connections, simulation, fan-out, serialization |

**Total: 213 tests (170 original + 43 new) — all passing**

### Build & Run

```bash
# Build all apps (including Web4)
npm run build

# Build Web4 only
npm run build:web4

# Run all tests
npm test

# Run backend
cd Backend && cp .env.example .env && pip install -r requirements.txt && uvicorn main:app --reload
```
