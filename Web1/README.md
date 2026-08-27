# Web1 — Boolean Logic Solver

> Interactive Boolean function analysis: input an expression (or word problem), get truth table, canonical SOP/POS, Quine-McCluskey minimization, Karnaugh map, three circuit implementations (AND/OR/NOT, NAND-only, NOR-only), live probe simulation, verification, and code export.

## Table of Contents

- [Purpose](#purpose)
- [Directory Tree](#directory-tree)
- [Module Tree](#module-tree)
- [Architecture](#architecture)
- [Module-by-Module Walkthrough](#module-by-module-walkthrough)
- [Data Flow](#data-flow)
- [Professor / Viva Guide](#professor--viva-guide)
- ["Where Do I Find...?" Quick Reference](#where-do-i-find-quick-reference)

---

## Purpose

Web1 takes a Boolean function (typed expression, minterm list, maxterm list, don't-care terms, editable truth table, or natural-language word problem) and produces:

1. **Truth table** — all 2^n input/output combinations
2. **Canonical SOP** — sum-of-minterms expansion
3. **Canonical POS** — product-of-maxterms expansion
4. **Simplified SOP** — minimized via Quine-McCluskey
5. **Simplified POS** — minimized via QM on complement
6. **Karnaugh map** — visual grouping of implicants (2–4 variables)
7. **Three circuit implementations** — AND/OR/NOT, NAND-only, NOR-only
8. **Verification** — exhaustive comparison of all implementations
9. **Code export** — Verilog, C, LaTeX, Markdown
10. **Live probe** — toggle variables, see wires change color in real time

---

## Directory Tree

```
Web1/
├── index.html                # Main HTML page
├── style.css                 # Full UI stylesheet
├── script.js                 # ← Compiled output from src/main.ts (DO NOT EDIT)
├── theme.js                  # Theme system (identical copy)
├── fx.js                     # Studio FX (identical copy)
├── README.md                 # ← This file
└── src/                      # ← Active TypeScript sources
    ├── main.ts               # Entry point
    ├── solver.ts             # Pure solver core
    ├── solverCore.ts         # Re-exports + helper
    ├── state.ts              # Mutable application state
    ├── legacy-shims.ts       # Window type augmentations
    ├── ai/
    │   └── booleanApi.ts     # Backend API client
    ├── circuits/
    │   ├── circuitGraph.ts   # Circuit graph model + 3 builders + evaluation
    │   ├── gates.ts          # Gate geometry + SVG rendering
    │   ├── layout.ts         # Layered layout algorithm
    │   └── renderer.ts       # Wire routing + full schematic
    ├── kmap/
    │   ├── kmap.ts           # Karnaugh map generation
    │   └── overlays.ts       # QM implicant overlay rectangles
    └── ui/
        ├── dom.ts            # DOM helpers (byId, el, escapeHtml)
        ├── truthTableInput.ts # Editable truth table input
        ├── controls.ts       # Mode switching, examples, zoom/pan
        ├── probe.ts          # Live probe: switches, wire coloring, HUD
        └── results.ts        # Results rendering, export, verification
```

---

## Module Tree

```
Web1
│
├── Entry Point (main.ts)
│   ├── collectRawInputs() — read DOM inputs
│   ├── solve() — main orchestrator
│   ├── runWordProblem() — AI path with AbortController
│   └── init() — wire all UI controls
│
├── Pure Solver Core (solver.ts)
│   ├── buildSolverModel() — RawInputs → SolverModel
│   ├── fromExpression() — parse expression → model
│   ├── fromMintermList() — minterm indices → model
│   ├── fromMaxtermList() — maxterm indices → model (complement to minterms)
│   ├── fromDontCare() — minterms + don't-cares → model
│   ├── fromTruthSelections() — editable truth table → model
│   ├── fromWordProblem() — AI result → model
│   ├── finish() — shared: rows → QM → model
│   ├── verifySolution() — exhaustive verification
│   └── Display helpers: sopDisplay, posDisplay, canonicalSOP/POS
│
├── AI Client (ai/booleanApi.ts)
│   ├── fetchMintermsFromProblem() — HTTP POST with timeout + abort
│   └── ApiError class
│
├── Circuit Synthesis (circuits/circuitGraph.ts)
│   ├── buildBasicSOPCircuit() — SOP → AND/OR/NOT graph
│   ├── buildNANDCircuit() — SOP → NAND-NAND graph
│   ├── buildNORCircuit() — POS → NOR-NOR graph
│   ├── evaluateCircuit() — DAG evaluation (memoized)
│   └── evaluateAllNodeValues() — all nodes for wire coloring
│
├── Gate Geometry (circuits/gates.ts)
│   ├── getGateInfo() — pin coordinates per gate type
│   ├── getMultiInputY() — distribute multi-input pins vertically
│   └── renderGateSVG() — SVG markup for one gate
│
├── Layout (circuits/layout.ts)
│   ├── calculateLevels() — longest-path level assignment
│   └── calculateCircuitLayout() — positions + dimensions
│
├── Schematic Rendering (circuits/renderer.ts)
│   ├── renderEdgesSVG() — channel routing with hop-arcs
│   └── renderCircuit() — full SVG: edges + gates + output
│
├── Karnaugh Map (kmap/kmap.ts)
│   ├── grayCode() — Gray code sequence
│   ├── computeKMapGrid() — 2-4 variable grid
│   ├── patternToMinterms() — implicant → minterm list
│   └── generateKarnaughMap() — HTML table generation
│
├── K-map Overlays (kmap/overlays.ts)
│   ├── contiguousRuns() — split indices into runs
│   ├── segmentsForImplicant() — rectangle segments per implicant
│   └── positionKarnaughOverlays() — DOM overlay positioning
│
├── UI Controls (ui/controls.ts)
│   ├── initInputControls() — wire mode switching + examples
│   ├── updateInputInterface() — show/hide input sections
│   ├── updateNumericExamples() — update help text
│   ├── initZoomPanControls() — per-circuit zoom/pan
│   └── Example presets (EXAMPLE_PRESETS, WORD_PROBLEM_PRESETS)
│
├── Truth Table Input (ui/truthTableInput.ts)
│   ├── generateTruthTableInput() — editable dropdown table
│   └── readTruthTableSelections() — read current selections
│
├── Live Probe (ui/probe.ts)
│   ├── setupProbePanels() — build switch panels
│   ├── toggleProbe() — flip variable + update everything
│   ├── updateProbeUI() — sync badges, pins, truth table highlight
│   └── updateCircuitSignals() — recolor wires
│
├── Results Rendering (ui/results.ts)
│   ├── renderResults() — fill entire results section from model
│   ├── createTruthTableHTML() — result truth table
│   ├── setupExportButtons() — Verilog/C/LaTeX/Markdown copy
│   ├── renderVerification() — pass/fail panel
│   └── showError/clearError — error display
│
├── DOM Helpers (ui/dom.ts)
│   ├── byId() — typed getElementById
│   ├── el() — create element
│   └── escapeHtml() — XSS prevention
│
└── State (state.ts)
    └── state: SolverPageState — variables, rows, graphs, probeState, kmap
```

---

## Architecture

```
User Input (DOM)
    │
    ▼
main.ts: collectRawInputs()
    │
    ├── mode === "wordProblem"?
    │   YES → runWordProblem()
    │           │
    │           ▼
    │     booleanApi.ts: fetchMintermsFromProblem()
    │           │  HTTP POST /api/solve-boolean
    │           ▼
    │     Backend returns {variables, minterms, dont_cares}
    │           │
    │           ▼
    │     RawInputs with wordProblem data
    │
    ▼
solver.ts: buildSolverModel(raw)
    │
    ├── fromExpression()    ← parseExpression() → astTruthTable()
    ├── fromMintermList()   ← astFromMinterms() → rowsFromMinterms()
    ├── fromMaxtermList()   ← complement → minterms
    ├── fromDontCare()      ← minterms + don't-cares
    ├── fromTruthSelections() ← direct row construction
    └── fromWordProblem()   ← AI result → astFromMinterms()
    │
    ▼
finish() — shared construction
    │
    ├── minimizeSOP(ones, vars, dc)  ← QM
    ├── minimizePOS(zeros, vars, dc) ← QM
    └── Build simplifiedAst from SOP implicants
    │
    ▼
SolverModel
    │
    ▼
results.ts: renderResults(model)
    │
    ├── Truth table HTML
    ├── Canonical SOP/POS display
    ├── Simplified expression display
    ├── Karnaugh map → kmap.ts + overlays.ts
    ├── Circuit synthesis → circuitGraph.ts
    │   ├── buildBasicSOPCircuit()
    │   ├── buildNANDCircuit()
    │   └── buildNORCircuit()
    ├── SVG rendering → renderer.ts
    ├── Live probe setup → probe.ts
    ├── Verification → verifySolution()
    └── Code export → exporters/
```

---

## Module-by-Module Walkthrough

### Module 1: Entry Point (`main.ts`)

**Purpose:** Wires DOM controls, runs the solve pipeline, handles the AI word-problem path with request cancellation.

**Important Functions:**
- `init()` — Called once on page load. Sets up input controls, truth table, zoom/pan, and the Solve button listener.
- `solve()` — Main orchestrator. Collects inputs, runs AI if needed, calls `buildSolverModel()`, then `renderResults()`.
- `collectRawInputs()` — Reads the DOM based on the selected input mode. Returns a `RawInputs` discriminated union.
- `runWordProblem()` — Async. Sends the problem statement to the backend, shows status messages, handles cancellation via `AbortController`.

**Key Design:**
- `activeAiRequest` is an `AbortController` that gets replaced on each Solve click. This ensures only the most recent request's results are used.
- If a new solve starts while an old AI request is in flight, the old one is aborted and its result is silently discarded (`__superseded__`).

**How to Explain It:**
"The entry point collects whatever the user typed — expression, minterm list, or word problem — and passes it to the solver. If it's a word problem, it first contacts the AI backend, gets back minterms, then feeds those into the same solver pipeline."

---

### Module 2: Pure Solver Core (`solver.ts`)

**Purpose:** Turns raw user input into a fully-derived model of the Boolean function. No DOM access — pure computation.

**Important Functions:**
- `buildSolverModel(raw)` — Dispatches to mode-specific builders.
- `finish()` — Shared: takes variables, original AST, truth rows, don't-cares → computes QM minimization → returns `SolverModel`.
- `fromExpression()` — Parses expression → `astTruthTable()` → `finish()`.
- `fromWordProblem()` — Takes AI result (variables + minterms + don't-cares) → `astFromMinterms()` → `finish()`.
- `verifySolution(model, circuits)` — Exhaustively compares original AST, simplified AST, and all three circuit implementations against the truth table. Returns boolean.
- `generateCanonicalSOP()` / `generateCanonicalPOS()` — Truth rows → canonical form text.
- `sopDisplay()` / `posDisplay()` — Implicant list → human-readable expression.

**Inputs:** `RawInputs` (discriminated union of 6 modes).
**Outputs:** `SolverModel` containing truth rows, canonical forms, minimized SOP/POS, simplified AST, and everything needed for rendering.

**Algorithm:**
1. Parse input into truth rows (mode-specific).
2. Separate rows into ones (minterms), zeros (maxterms), don't-cares.
3. Run `minimizeSOP()` on ones + don't-cares.
4. Run `minimizePOS()` on zeros + don't-cares.
5. Build `simplifiedAst` from SOP implicants.
6. Return complete `SolverModel`.

---

### Module 3: AI Client (`ai/booleanApi.ts`)

**Purpose:** HTTP client for the Backend AI service.

**Important Functions:**
- `fetchMintermsFromProblem(statement, options)` — POST to `/api/solve-boolean`. Returns `{variables, minterms, dontCares, variableDescriptions}`.

**Key Design:**
- Gemini key never touches the browser — all AI calls go through the backend.
- Client-side size limit: `LIMITS.MAX_PROBLEM_LENGTH` (4000 chars).
- Hard timeout: 45 seconds (`REQUEST_TIMEOUT_MS`).
- AbortSignal support: callers can cancel stale requests.

**How to Explain It:**
"The frontend sends the natural language to our backend via HTTP. The backend calls Gemini, validates the result, and returns verified minterms. We never expose the API key to the browser."

---

### Module 4: Circuit Graph (`circuits/circuitGraph.ts`)

**Purpose:** Circuit graph model (DAG) and three synthesized implementations.

**Important Functions:**
- `buildBasicSOPCircuit(implicants, variables)` — Classic two-level SOP: NOT gates → AND terms → single OR.
- `buildNANDCircuit(implicants, variables)` — NAND-NAND realization. Each SOP term becomes a NAND of literals; final gate is NAND over all term outputs (De Morgan → OR).
- `buildNORCircuit(implicants, variables)` — NOR-NOR realization of POS cover.
- `evaluateCircuit(graph, assignment)` — Memoized DAG evaluation.
- `evaluateAllNodeValues(graph, assignment)` — Evaluates every node (used for wire coloring).

**Key Design:**
- INPUT nodes are deduplicated per variable label (multi-character names preserved).
- Constants (`CONST` nodes) appear when the function collapses to 0 or 1.
- NAND circuit: single-literal terms are buffered through a self-input NAND inverter.
- NOR circuit uses POS clause convention: pattern '0' → plain variable, '1' → complemented.

**How to Explain It:**
"We build three different gate-level implementations from the minimized expression. The AND/OR/NOT circuit directly implements the SOP. The NAND circuit uses the property that NAND-NAND equals AND-OR. The NOR circuit does the same for POS."

---

### Module 5: Gate Geometry (`circuits/gates.ts`)

**Purpose:** Pin coordinates and SVG rendering for each gate type.

**Key Functions:**
- `getGateInfo(node)` — Returns width, height, and pin coordinate functions (inX, inY, outX, outY) for each gate type.
- `renderGateSVG(node, pos)` — Returns SVG markup string for one gate.
- `getMultiInputY(y, h, i, count)` — Distributes multi-input pins evenly along the gate height.

**Gate Types:** INPUT, CONST, NOT, AND, NAND, OR, NOR.

**How to Explain It:**
"Each gate type has a defined width, height, and pin positions. The layout engine uses these to place gates, and the wire router uses the pin coordinates to attach wires precisely."

---

### Module 6: Layout (`circuits/layout.ts`)

**Purpose:** Assigns nodes to levels and computes x,y positions.

**Algorithm:**
1. `calculateLevels()` — Longest-path from inputs. INPUT/CONST = level 0. Other nodes = max(input levels) + 1.
2. `calculateCircuitLayout()` — Groups nodes by level, stacks vertically within each level, centers vertically. Level gap = 200px.

**How to Explain It:**
"We use a layered graph layout. Inputs are on the left (level 0), gates that depend on them are in the next level, and so on. Within each level, gates are stacked vertically and centered."

---

### Module 7: Renderer (`circuits/renderer.ts`)

**Purpose:** Wire routing and full schematic SVG assembly.

**Wire Routing Algorithm:**
1. Edges grouped by level gap, then by source node.
2. Each source gets a dedicated vertical bus in the channel between levels.
3. Horizontal leads run from output pin to bus; branches run from bus to input pins.
4. Where a horizontal segment crosses another source's vertical bus, a semicircular "hop" arc is drawn.

**How to Explain It:**
"Our wire router uses channel routing. Each signal gets its own vertical channel, and horizontal wires hop over other channels using small arc segments. This prevents any visual ambiguity about which wires are connected."

---

### Module 8: Karnaugh Map (`kmap/kmap.ts`)

**Purpose:** Generates the K-map HTML table with Gray-code ordering.

**Key Functions:**
- `grayCode(n)` — Generates Gray code sequence for n bits.
- `computeKMapGrid(variableCount)` — For 2-4 variables, computes the grid mapping (row, col) → minterm index.
- `generateKarnaughMap(args)` — Full HTML table with minterm labels, cell values (0/1/X), and legend.

**Gray Code Property:** Adjacent cells in the K-map differ by exactly one variable, making visual grouping valid.

**How to Explain It:**
"The Karnaugh map arranges the truth table in a 2D grid where adjacent cells differ by exactly one bit. This is achieved using Gray code ordering. Cells with output 1 are highlighted, and the minimized implicant groups are shown as colored overlay rectangles."

---

### Module 9: K-map Overlays (`kmap/overlays.ts`)

**Purpose:** Draws colored rectangles over K-map cells to show QM implicant groups.

**Algorithm:**
1. For each implicant, find which cells it covers.
2. Map those cells to (row, col) coordinates.
3. Split each axis's indices into contiguous runs.
4. Emit one rectangle per (row-run × col-run) combination.
5. Handle edge-wrapping (columns {0,3} → two separate runs).

**How to Explain It:**
"Each minimized term from Quine-McCluskey is drawn as a colored overlay on the K-map. Because Gray code wraps around the edges, a single group might need multiple rectangles. Our implementation correctly handles this by splitting non-contiguous index sets."

---

### Module 10: Live Probe (`ui/probe.ts`)

**Purpose:** Toggle variable switches and see the circuit respond in real time.

**Key Functions:**
- `setupProbePanels(variables)` — Builds toggle switch panels for all three circuits.
- `toggleProbe(varName)` — Flips a variable, updates all views.
- `updateProbeUI()` — Syncs switch badges, SVG pin labels, truth table row highlight.
- `updateCircuitSignals()` — Recolors all wires based on current probe values.

**How to Explain It:**
"The live probe lets you click on any input variable to toggle it between 0 and 1. The circuit immediately re-evaluates, wires change color (green for high, gray for low), and the corresponding truth table row is highlighted. This is like using a logic probe on a real circuit."

---

### Module 11: Verification (`solver.ts` → `verifySolution()`)

**Purpose:** Exhaustively checks all implementations against the truth table.

**Algorithm:**
For each non-don't-care row:
1. Build variable assignment from row inputs.
2. Evaluate original AST.
3. Evaluate simplified AST.
4. Evaluate AND/OR/NOT circuit.
5. Evaluate NAND-only circuit.
6. Evaluate NOR-only circuit.
7. All five must equal the expected output.

**How to Explain It:**
"We verify by checking every possible input combination. For each row of the truth table, we evaluate the original expression, the minimized expression, and all three gate-level circuits. If all five agree with the truth table output, verification passes."

---

## Professor / Viva Guide

### Q: Where is the Quine-McCluskey algorithm implemented?

**A:** In `shared/ts/boolean/minimizer.ts`. The function `getPrimeImplicants()` groups minterms by popcount, then iteratively merges patterns differing in exactly one bit. Unmerged patterns become prime implicants. The function `findMinimumCover()` builds a prime implicant chart, extracts essential primes, then exhaustively searches for a minimum cover of the remaining minterms. A node budget (200,000) bounds the search; if exceeded, it falls back to greedy coverage.

### Q: How does your K-map implementation work?

**A:** In `Web1/src/kmap/kmap.ts`. The `computeKMapGrid()` function arranges cells using Gray code so adjacent cells differ by exactly one variable. For 2 variables: 2×2 grid. For 3: 2×4. For 4: 4×4. The `generateKarnaughMap()` function fills in the cell values from the truth table. Group overlays are drawn by `positionKarnaughOverlays()` in `kmap/overlays.ts`, which maps each QM implicant to the cells it covers and draws colored rectangles.

### Q: How does the AI produce minterms?

**A:** The frontend sends the natural language to `Backend/main.py` → `solve_boolean()`. The backend first tries the explicit Σm/Σd parser (`parser.py`). If that doesn't match, it calls Gemini (`ai_solver.py` → `call_gemini()`) with a detailed prompt. Gemini returns a Boolean expression, which the backend then evaluates exhaustively for all 2^n combinations using `boolean_engine.py` → `generate_minterms()`. The minterms are returned to the frontend.

### Q: Why don't you trust the AI's minterms directly?

**A:** LLMs can hallucinate or make logical errors. By having Gemini return a Boolean expression (which is easier to verify than a list of minterms), we can deterministically evaluate it ourselves. The `generate_minterms()` function in `boolean_engine.py` uses Python's AST module to safely evaluate the expression for every possible input assignment. This gives us verified minterms regardless of what Gemini might claim.

### Q: How do you verify an AI-generated Boolean expression?

**A:** The backend runs two checks: (1) `generate_minterms()` evaluates the expression for all 2^n combinations to get the minterm list. (2) It then checks for suspicious results — if the expression evaluates to 0 for all inputs (constant-0) or 1 for all inputs with 3+ variables (constant-1), it retries with an error message appended to the prompt.

### Q: How does your NAND-only circuit work?

**A:** In `Web1/src/circuits/circuitGraph.ts` → `buildNANDCircuit()`. It uses the NAND-NAND realization of SOP: each SOP product term becomes a NAND gate (De Morgan: NAND of literals = NOT(AND of literals)). Single-literal terms are buffered through a self-input NAND inverter. The final gate is a NAND over all term outputs. By De Morgan's theorem, NAND(NAND(a,b), NAND(c,d)) = (a·b) + (c·d), which gives us the OR of the product terms.

### Q: How does the frontend communicate with FastAPI?

**A:** The frontend (`Web1/src/ai/booleanApi.ts`) sends an HTTP POST to `https://digitalcircuits.onrender.com/api/solve-boolean` with a JSON body `{problem_statement: "..."}`. The response contains `{variables, minterms, dont_cares, variable_descriptions}`. The request has a 45-second timeout and supports cancellation via AbortController.

### Q: How does the verification system work?

**A:** In `solver.ts` → `verifySolution()`. It exhaustively compares five implementations: (1) the original AST, (2) the simplified AST from QM, (3) the AND/OR/NOT circuit, (4) the NAND-only circuit, and (5) the NOR-only circuit. For every non-don't-care row in the truth table, it builds the variable assignment, evaluates all five, and checks they match the expected output. If any disagrees, verification fails.

### Q: What is the node budget in Quine-McCluskey?

**A:** The exact-cover branch search in `findMinimumCover()` can be exponential. We limit it to 200,000 nodes (`LIMITS.MINIMIZE_NODE_BUDGET`). When exceeded, the algorithm finishes remaining minterms greedily. The result is always logically equivalent (verified by the caller), but minimality is only guaranteed when the budget is not exceeded. The `coverTruncated` flag indicates this happened.

### Q: How do you handle multi-character variable names?

**A:** The tokenizer in `shared/ts/boolean/tokenizer.ts` uses maximal munch: it reads consecutive identifier characters as one token. So `RESET_N` is one variable, never R·E·S·E·T·_·N. Implicit AND is only inserted when the parser detects adjacent operands without an explicit operator. Multi-character names flow through unchanged to the parser, minimizer, circuit graph, and export.

### Q: Where is the ripple-carry animation?

**A:** There is no ripple-carry animation in Web1. The ripple-carry animation exists in **Web2** (`Web2/src/ui.ts` → `setupRippleAnimation()`), which simulates the 4-bit ripple carry adder step by step.

---

## "Where Do I Find...?" Quick Reference

| Professor asks... | File | Function/Module |
|-------------------|------|-----------------|
| Boolean parser | `shared/ts/boolean/parser.ts` | `parseExpression()` |
| Tokenizer | `shared/ts/boolean/tokenizer.ts` | `tokenize()`, `insertImplicitAND()` |
| AST | `shared/ts/boolean/ast.ts` | `AstNode`, `evalAst()` |
| Truth table | `shared/ts/boolean/ast.ts` | `astTruthTable()` |
| Canonical SOP | `Web1/src/solver.ts` | `generateCanonicalSOP()` |
| Canonical POS | `Web1/src/solver.ts` | `generateCanonicalPOS()` |
| QM minimizer | `shared/ts/boolean/minimizer.ts` | `minimizeSOP()`, `minimizePOS()` |
| Prime implicants | `shared/ts/boolean/minimizer.ts` | `getPrimeImplicants()` |
| Minimum cover | `shared/ts/boolean/minimizer.ts` | `findMinimumCover()` |
| K-map generation | `Web1/src/kmap/kmap.ts` | `generateKarnaughMap()` |
| K-map overlays | `Web1/src/kmap/overlays.ts` | `positionKarnaughOverlays()` |
| Circuit graph | `Web1/src/circuits/circuitGraph.ts` | `CircuitGraph` type |
| SOP circuit | `Web1/src/circuits/circuitGraph.ts` | `buildBasicSOPCircuit()` |
| NAND circuit | `Web1/src/circuits/circuitGraph.ts` | `buildNANDCircuit()` |
| NOR circuit | `Web1/src/circuits/circuitGraph.ts` | `buildNORCircuit()` |
| Gate SVG | `Web1/src/circuits/gates.ts` | `renderGateSVG()` |
| Layout | `Web1/src/circuits/layout.ts` | `calculateCircuitLayout()` |
| Wire routing | `Web1/src/circuits/renderer.ts` | `renderEdgesSVG()` |
| Schematic render | `Web1/src/circuits/renderer.ts` | `renderCircuit()` |
| Live probe | `Web1/src/ui/probe.ts` | `setupProbePanels()`, `toggleProbe()` |
| Wire coloring | `Web1/src/ui/probe.ts` | `updateCircuitSignals()` |
| Verification | `Web1/src/solver.ts` | `verifySolution()` |
| Circuit evaluation | `Web1/src/circuits/circuitGraph.ts` | `evaluateCircuit()` |
| Verilog export | `shared/ts/exporters/verilog.ts` | `generateVerilogModule()` |
| C export | `shared/ts/exporters/c.ts` | `generateCFunction()` |
| LaTeX export | `shared/ts/exporters/latex.ts` | `generateLatex()` |
| AI API call | `Web1/src/ai/booleanApi.ts` | `fetchMintermsFromProblem()` |
| Backend route | `Backend/main.py` | `solve_boolean()` |
| Gemini prompt | `Backend/ai_solver.py` | `build_prompt()` |
| Minterm generation | `Backend/boolean_engine.py` | `generate_minterms()` |
| Solver entry | `Web1/src/main.ts` | `solve()` |
| Solver model | `Web1/src/solver.ts` | `buildSolverModel()` |
| Results rendering | `Web1/src/ui/results.ts` | `renderResults()` |
