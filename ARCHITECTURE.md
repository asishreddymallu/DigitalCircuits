# Digital Circuits Suite — Architecture Document

> **Project:** Digital Circuits Suite  
> **Version:** 2.1.0  
> **Purpose:** Educational Boolean Logic Solver, Combinational Circuit Simulator, and 7-Segment Display Simulator  
> **Use case:** University project review / viva preparation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [Web1 — Boolean Logic Solver](#3-web1--boolean-logic-solver)
4. [Web2 — Combinational Circuit Simulator](#4-web2--combinational-circuit-simulator)
5. [Web3 — 7-Segment Display Simulator](#5-web3--7-segment-display-simulator)
6. [Backend — AI Solver](#6-backend--ai-solver)
7. [Shared Modules](#7-shared-modules)
8. [Boolean Parser & AST](#8-boolean-parser--ast)
9. [Truth-Table Generation](#9-truth-table-generation)
10. [Quine-McCluskey Minimization](#10-quine-mccluskey-minimization)
11. [Karnaugh Maps](#11-karnaugh-maps)
12. [Circuit Generation](#12-circuit-generation)
13. [Export System](#13-export-system)
14. [AI Integration & Verification](#14-ai-integration--verification)
15. [Data Flow](#15-data-flow)
16. [Build System](#16-build-system)
17. [Testing Strategy](#17-testing-strategy)
18. [How to Explain This Project](#18-how-to-explain-this-project)

---

## 1. Project Overview

The Digital Circuits Suite is a browser-based educational tool for digital logic design. It consists of three independent web applications and a Python backend:

| Application | Purpose | Key Feature |
|---|---|---|
| **Web1** | Boolean Logic Solver | Input expression → Truth Table → K-Map → Circuit → Verilog/C/LaTeX |
| **Web2** | Combinational Circuit Simulator | Adders, Subtractors, MUX/DEMUX, Decoders with live SVG schematics |
| **Web3** | 7-Segment Display Simulator | BCD/Hex decoder with live wiring, waveforms, Verilog export |
| **Backend** | AI Problem Solver | Natural language → Boolean minterms (with deterministic verification) |

**Design Principles:**
- **Correctness first:** Mathematical functions are pure and side-effect-free
- **Single source of truth:** `HEX_PATTERNS` for 7-segment, shared Boolean engine for Web1/Web3
- **Verification by construction:** AI results are validated deterministically before display
- **Professor-friendly:** Each module has one clear responsibility

---

## 2. Folder Structure

```
Digital-Circuits-Suite/
│
├── index.html                    ← Root page (links to Web1/2/3)
├── package.json                  ← Build scripts, test runner
├── tsconfig.json                 ← TypeScript root config
├── vitest.config.ts              ← Unit test configuration
├── vite.config.mjs               ← Vite dev server (root)
│
├── shared/ts/                    ← Shared TypeScript modules
│   ├── boolean/                  ← Core Boolean engine
│   │   ├── ast.ts                ← AST types + evaluator
│   │   ├── tokenizer.ts          ← Tokenizer (recognizer)
│   │   ├── parser.ts             ← Recursive-descent parser
│   │   ├── minimizer.ts          ← Quine-McCluskey
│   │   ├── formatter.ts          ← AST → display string
│   │   └── limits.ts             ← Safety limits
│   └── exporters/                ← Code generation
│       ├── verilog.ts            ← Verilog HDL export
│       ├── c.ts                  ← C/C++ export
│       └── latex.ts              ← LaTeX math export
│
├── Web1/                         ← Boolean Logic Solver
│   ├── index.html
│   ├── style.css
│   ├── script.ts                 ← Legacy shim (delegates to src/)
│   └── src/
│       ├── main.ts               ← Entry point + AI integration
│       ├── solver.ts             ← Pure solver core (unit-testable)
│       ├── solverCore.ts         ← Re-export + parseNumberList helper
│       ├── state.ts              ← Application-wide mutable state
│       ├── legacy-shims.ts       ← Window type augmentations
│       ├── ai/
│       │   └── booleanApi.ts     ← Backend HTTP client
│       ├── circuits/
│       │   ├── circuitGraph.ts   ← Circuit DAG model + 3 implementations
│       │   ├── gates.ts          ← Gate geometry + SVG rendering
│       │   ├── layout.ts         ← Layered graph layout algorithm
│       │   └── renderer.ts       ← Wire routing + full schematic SVG
│       ├── kmap/
│       │   ├── kmap.ts           ← K-map grid generation + HTML
│       │   └── overlays.ts       ← Group overlay rectangles (wrap-around)
│       └── ui/
│           ├── dom.ts            ← DOM helpers (byId, escapeHtml)
│           ├── controls.ts       ← Input mode switching + zoom/pan
│           ├── results.ts        ← Results rendering + verification panel
│           ├── truthTableInput.ts← Editable truth-table input
│           └── probe.ts          ← Live probe (switches + wire coloring)
│
├── Web2/                         ← Combinational Circuit Simulator
│   ├── index.html
│   ├── style.css
│   ├── script.ts                 ← Legacy shim
│   └── src/
│       ├── types.ts              ← CircuitDefinition interface
│       ├── circuits.ts           ← All circuit definitions + schematics
│       ├── gates.ts              ← SVG gate primitives (AND, OR, XOR…)
│       └── ui.ts                 ← UI logic (controls, waveform, zoom)
│
├── Web3/                         ← 7-Segment Display Simulator
│   ├── index.html
│   ├── style.css
│   ├── script.ts                 ← Entry point (wires deps into ui.ts)
│   └── src/
│       ├── types.ts              ← HEX_PATTERNS (single source of truth)
│       ├── segments.ts           ← 7-segment SVG renderer
│       ├── hexExpressions.ts     ← QM-derived segment expressions
│       ├── circuit.ts            ← Decoder schematic + wire helpers
│       └── ui.ts                 ← All UI logic (waveform, truth table, K-map)
│
├── Backend/                      ← FastAPI AI solver backend
│   ├── main.py                   ← FastAPI routes + initialization
│   ├── backend.py                ← Re-export for uvicorn compatibility
│   ├── config.py                 ← Safety limits (mirrors limits.ts)
│   ├── models.py                 ← Pydantic request model
│   ├── parser.py                 ← Deterministic Σm/Σd parser
│   ├── boolean_engine.py         ← Boolean expression evaluator
│   ├── ai_solver.py              ← Gemini prompt + structured output
│   ├── requirements.txt
│   └── .env.example
│
├── tests/
│   ├── unit/                     ← TypeScript unit tests (vitest)
│   │   ├── helpers.ts            ← PRNG + Verilog/C mini-evaluators
│   │   ├── parser.test.ts        ← Parser + error message tests
│   │   ├── minimizer.test.ts     ← QM equivalence tests (random + known)
│   │   ├── formatter.test.ts     ← Round-trip fidelity tests
│   │   ├── exporters.test.ts     ← Verilog/C/LaTeX logical equivalence
│   │   ├── constants.test.ts     ← Constant 0/1 through full pipeline
│   │   ├── multiCharVars.test.ts ← Multi-character variable names
│   │   ├── solverCore.test.ts    ← Full Web1 pipeline tests
│   │   ├── hexSegments.test.ts   ← All 7 segments × 16 hex digits
│   │   └── property.test.ts      ← Random-function property tests
│   └── backend/                  ← Python backend tests (pytest)
│       ├── test_retry.py         ← Retry logic + mock Gemini tests
│       └── test_ai_dataset.py    ← Explicit minterm parser tests
│
└── scripts/
    ├── build.mjs                 ← esbuild bundler (TS → script.js)
    └── check-shared-sync.mjs     ← Detects drift in shared JS files
```

---

## 3. Web1 — Boolean Logic Solver

**Purpose:** The main application — a complete Boolean function solver that accepts expressions, minterm lists, truth-table edits, or natural-language problems, and produces truth tables, canonical forms, minimized SOP/POS, K-maps, gate-level circuits, and code exports.

### 3.1 Input Modes

| Mode | Input | Example |
|---|---|---|
| Expression | Boolean expression string | `A'B + B·C` |
| Minterms | Variable count + minterm indices | 3 variables, m(1,3,5,7) |
| Maxterms | Variable count + maxterm indices | 3 variables, M(0,2,4) |
| Don't-Care | Minterms + don't-care indices | m(1,3) d(2) |
| Truth Table | Editable output column | Click 0/1/X per row |
| Word Problem | Natural language (→ AI backend) | "A door opens when…" |

### 3.2 Data Flow

```
User Input
    ↓
collectRawInputs() [main.ts]
    ↓
buildSolverModel(raw) [solver.ts]
    ↓
    ├── fromExpression()   → parseExpression() → AST → truthTable
    ├── fromMintermList()  → astFromMinterms() → rows
    ├── fromMaxtermList()  → complement → astFromMinterms() → rows
    ├── fromDontCare()     → validates → fromMintermList()
    ├── fromTruthSelections() → rows + minterms
    └── fromWordProblem()  → fetchMintermsFromProblem() → validate
    ↓
finish() [solver.ts]
    ├── minimizeSOP()      ← Quine-McCluskey
    ├── minimizePOS()      ← Quine-McCluskey (complement)
    └── build SolverModel
    ↓
renderResults(model) [results.ts]
    ├── Truth Table HTML
    ├── Canonical SOP/POS display
    ├── Simplified expression display
    ├── Karnaugh map + overlays
    ├── Circuit synthesis (basic/NAND/NOR)
    ├── Code exports (Verilog/C/LaTeX)
    └── Verification panel
```

### 3.3 Key Files

| File | Responsibility | Input | Output |
|---|---|---|---|
| `main.ts` | Entry point, wires UI + AI | DOM events | Calls solver + renderer |
| `solver.ts` | Pure solver core (no DOM) | RawInputs | SolverModel |
| `state.ts` | Shared mutable state | — | Variables, rows, graphs |
| `ai/booleanApi.ts` | HTTP client for backend | Problem statement | {variables, minterms, dontCares} |
| `circuits/circuitGraph.ts` | Circuit DAG model + synthesis | Implicants, variables | CircuitGraph |
| `circuits/gates.ts` | Gate geometry + SVG shapes | CircuitNode | SVG markup |
| `circuits/layout.ts` | Layered graph layout | CircuitGraph | positions + dimensions |
| `circuits/renderer.ts` | Wire routing + full SVG | CircuitGraph | SVG in container |
| `kmap/kmap.ts` | K-map grid + HTML table | variables, rows, implicants | HTML string |
| `kmap/overlays.ts` | Group overlay rectangles | implicants, grid DOM | Positioned divs |
| `ui/results.ts` | Results rendering + verification | SolverModel | DOM updates |
| `ui/probe.ts` | Live probe (switches + wiring) | Variable names | Wire coloring |

### 3.4 Verification

After circuit synthesis, `verifySolution()` exhaustively checks:
- Original expression AST
- Simplified SOP AST
- Basic AND/OR/NOT circuit
- NAND-only circuit
- NOR-only circuit

…against every non-don't-care row. All five must agree.

---

## 4. Web2 — Combinational Circuit Simulator

**Purpose:** Interactive simulation of standard combinational circuits with live SVG schematics, truth tables, and Verilog modules.

### 4.1 Circuit Categories

| Category | Circuits |
|---|---|
| **Adders** | Half Adder, Full Adder, 4-bit Ripple Carry Adder |
| **Subtractors** | Half Subtractor, Full Subtractor, 4-bit Ripple Borrow Subtractor |
| **Multiplexers** | 2:1, 4:1, 8:1 MUX |
| **Demultiplexers** | 1:2, 1:4, 1:8 DEMUX |
| **Decoders** | 2-to-4, 3-to-8 Decoder |
| **Encoders** | 4-to-2, 8-to-3 Priority Encoder |
| **Comparators** | 1-bit, 2-bit Comparator |

### 4.2 Architecture

Each circuit is a `CircuitDefinition` containing:
- `inputs[]` / `outputs[]` — pin names
- `evaluate(inputs)` — pure function returning output values
- `truthTable[]` — pre-computed truth-table rows
- `expressions[]` — Boolean formulas per output
- `renderSchematic(inputs, outputs)` — SVG generator
- `verilogModule` — Verilog HDL string

### 4.3 Wire Helpers

The gate primitives in `gates.ts` provide:
- `gateAND(x, y)` / `gateOR(x, y)` / `gateXOR(x, y)` / `gateNOT(x, y)` — SVG shapes
- `wireHopH(x1, x2, y, crossXs, isHigh)` — horizontal wire with jump-hops
- `wireV(x, y1, y2, isHigh)` — vertical wire
- `dot(cx, cy, isHigh)` — junction dot

---

## 5. Web3 — 7-Segment Display Simulator

**Purpose:** Interactive BCD-to-7-segment and Hex-to-7-segment decoder with live wiring, timing waveforms, K-maps, Boolean expressions, and Verilog export.

### 5.1 Single Source of Truth

`HEX_PATTERNS` in `types.ts` is the canonical reference for all 16 hex digits (0–F). Every segment expression, truth table, K-map, and Verilog module derives from this single table.

### 5.2 Module Responsibilities

| Module | Responsibility |
|---|---|
| `types.ts` | HEX_PATTERNS, BCD_MINTERMS, type definitions |
| `hexExpressions.ts` | Derives per-segment Boolean expressions via QM minimizer |
| `segments.ts` | SVG renderer for the 7-segment display |
| `circuit.ts` | Decoder schematic + wire helpers |
| `ui.ts` | All UI logic: inputs, truth table, expressions, K-maps, counter, waveform |

### 5.3 Expression Derivation

```
HEX_PATTERNS[digit][segment] = 0 or 1
    ↓
segmentMinterms() — collect indices where segment is ON
    ↓
minimizeSOP() — Quine-McCluskey (with BCD don't-cares)
    ↓
implicantToExpression() — format as display string
    ↓
verifyExpression() — exhaustive check against HEX_PATTERNS
    ↓
HEX_EXPRESSIONS[segment] / BCD_EXPRESSIONS[segment]
```

---

## 6. Backend — AI Solver

**Purpose:** Convert natural-language Boolean problems into structured minterm lists using Google Gemini, then verify the AI's output deterministically.

### 6.1 Request Flow

```
POST /api/solve-boolean
    ↓
Input Validation (length, emptiness)
    ↓
Path 1: Explicit Σm/Σd notation?
    ├── YES → parser.py → deterministic result (no Gemini)
    └── NO  → Path 2
    ↓
Path 2: Natural Language
    ↓
build_prompt() — system prompt with retry context
    ↓
call_gemini() — structured JSON output (response_schema)
    ↓
validate_variables() — names must match [A-Za-z][A-Za-z0-9_]*
    ↓
generate_minterms() — deterministic Boolean evaluation for all 2^n inputs
    ↓
generate_dont_cares() — evaluate don't-care conditions
    ↓
Verification:
    ├── Constant-0 check (suspicious if all zeros)
    ├── Constant-1 check (suspicious if always true, n≥3)
    └── Expression parsing + evaluation
    ↓
Success → Return {variables, minterms, dont_cares}
Failure → Retry once with error context, then 502
```

### 6.2 Module Responsibilities

| Module | Responsibility |
|---|---|
| `main.py` | FastAPI app, CORS, route `/api/solve-boolean`, retry loop |
| `config.py` | Safety limits (mirrors `shared/ts/boolean/limits.ts`) |
| `models.py` | Pydantic `ProblemRequest` model |
| `parser.py` | Deterministic Σm/Σd regex parser |
| `boolean_engine.py` | Safe Boolean expression evaluator (AST-based, no eval) |
| `ai_solver.py` | Gemini prompt builder, API caller, variable validator |

### 6.3 Key Architectural Concept: AI is Untrusted

The LLM output is **never trusted as the final authority**. The deterministic Boolean evaluator (`boolean_engine.py`) re-evaluates every expression for all 2^n input combinations and derives actual minterms. If the result is suspicious (constant 0 or constant 1), the backend retries or rejects.

---

## 7. Shared Modules

The `shared/ts/` directory contains code used by multiple web apps:

```
shared/ts/
├── boolean/
│   ├── ast.ts          — AstNode type + evalAst + truth table generation
│   ├── tokenizer.ts    — Tokenizer (recognizer) for Boolean expressions
│   ├── parser.ts       — Recursive-descent parser → AST
│   ├── minimizer.ts    — Quine-McCluskey SOP/POS minimization
│   ├── formatter.ts    — AST → human-readable display string
│   └── limits.ts       — Safety limits (MAX_VARIABLES, budgets)
└── exporters/
    ├── verilog.ts      — AST → Verilog HDL module
    ├── c.ts            — AST → C/C++ function
    └── latex.ts        — AST → LaTeX math expression
```

---

## 8. Boolean Parser & AST

### 8.1 AST Node Types

```typescript
type AstNode =
    | { kind: "var";   name: string }           // Variable (e.g., "A", "RESET_N")
    | { kind: "const"; value: boolean }          // Constant (true/false = 1/0)
    | { kind: "not";   child: AstNode }          // NOT (postfix ' or prefix !)
    | { kind: "and";   left: AstNode; right: AstNode }  // AND
    | { kind: "or";    left: AstNode; right: AstNode }   // OR
    | { kind: "xor";   left: AstNode; right: AstNode }   // XOR
```

### 8.2 Grammar (Precedence: loosest → tightest)

```
expression  → orExpr
orExpr      → xorExpr ('|' xorExpr)*
xorExpr     → andExpr ('^' andExpr)*
andExpr     → unary ('&' unary)*
unary       → '!' unary | postfix
postfix     → primary "'"
primary     → IDENT | CONST | '(' orExpr ')'
```

### 8.3 Tokenizer

Supports: identifiers (`[A-Za-z][A-Za-z0-9_]*`), constants (`0`/`1`), NOT (`'` `!` `~` `¬`), AND (`*` `&` `·` `∧` `.`), OR (`+` `|` `∨`), XOR (`^` `⊕`), parentheses.

Multi-character identifiers are first-class: `PIN` is one variable, never P·I·N.

---

## 9. Truth-Table Generation

Given `n` variables in order `[v0, v1, ..., v_{n-1}]`:

- Row index `i` encodes inputs MSB-first: `v0` is the most-significant bit
- `2^n` rows total
- Each row produces `{ inputs: number[], output: number }` where `output` is 0, 1, or -1 (don't-care)

The truth table is generated by `astTruthTable(ast, variables)` in `ast.ts`.

---

## 10. Quine-McCluskey Minimization

### Algorithm Steps

1. **Group** ON-set minterms by popcount (number of 1-bits)
2. **Merge** patterns differing in exactly one bit across adjacent groups
3. **Identify** prime implicants (patterns that couldn't be merged further)
4. **Build** prime implicant chart (rows = prime implicants, columns = ON-set minterms)
5. **Extract** essential prime implicants (columns with only one covering row)
6. **Solve** remaining exact-cover problem with branch-and-bound (node budget: 200,000)
7. **Fallback** to greedy coverage if budget is exhausted (correctness preserved, minimality relaxed)

### SOP vs POS

- **SOP (Sum of Products):** minimize ON-set minterms → OR of AND terms
- **POS (Product of Sums):** minimize OFF-set zeros → AND of OR terms

### Don't-Care Handling

Don't-care conditions are included in the prime implicant calculation but NOT in the verification. They can be freely used to create larger implicant groups, improving minimality.

### Safety Limits

- Maximum 8 variables (beyond which 2^8 = 256 rows, exponential blowup)
- Maximum 5000 prime implicants (hard cap)
- Node budget of 200,000 for exact-cover search

---

## 11. Karnaugh Maps

### Grid Construction

For 2–4 variables, K-maps are displayed as tables with Gray-code ordering:

| Vars | Row bits | Col bits | Grid |
|---|---|---|---|
| 2 | 1 | 1 | 2×2 |
| 3 | 1 | 2 | 2×4 |
| 4 | 2 | 2 | 4×4 |

Gray code ensures adjacent cells differ in exactly one variable.

### Wrap-Around

Groups can wrap around the edges (e.g., columns 0 and 3). The overlay renderer (`overlays.ts`) splits wrapped groups into contiguous runs and draws one rectangle per run combination, preventing false membership claims.

---

## 12. Circuit Generation

### 12.1 Circuit Graph Model

A `CircuitGraph` is a DAG where:
- **Nodes** have types: INPUT, CONST, NOT, AND, OR, NAND, NOR
- **Edges** connect outputs to inputs (strings, not references)
- **Output** names the driving node

### 12.2 Three Implementations

| Implementation | Gate Types | Derivation |
|---|---|---|
| **Basic SOP** | AND, OR, NOT | Two-level: NOT → AND terms → OR |
| **NAND-only** | NAND | NAND-NAND realization of SOP |
| **NOR-only** | NOR | NOR-NOR realization of POS |

### 12.3 Layout Algorithm

1. Compute levels via longest-path from inputs
2. Stack nodes vertically within each level
3. Center each level vertically

### 12.4 Wire Routing

"Channel" routing with zero overlaps:
- Each source gets a dedicated vertical bus
- Horizontal leads from output pins to bus
- Branches from bus to input pins
- Semicircular hop-arc at crossings

---

## 13. Export System

### Verilog

Fully parenthesized AST-driven generation. Every binary operation is wrapped in `(...)`. Constants emit as `1'b0` / `1'b1`.

```verilog
module bool_function (
    input  wire A,
    input  wire B,
    output wire F
);
    assign F = ((~A) & B) | (B & C);
endmodule
```

### C/C++

Fully parenthesized using `&&` (AND), `||` (OR), `!` (NOT), `!=` (XOR). Constants emit as `true` / `false`.

### LaTeX

`\overline{...}` for NOT, `\cdot` for AND, `\oplus` for XOR, `+` for OR. Multi-character names wrapped in `\mathrm{}`.

---

## 14. AI Integration & Verification

### 14.1 Architecture

```
User provides natural-language problem
    ↓
Backend receives POST /api/solve-boolean
    ↓
Deterministic check: is it explicit Σm/Σd notation?
    ├── YES → parser.py (no AI needed)
    └── NO  → Gemini AI
    ↓
Gemini returns structured JSON:
    {variables, expression, dont_care_conditions, variable_descriptions}
    ↓
Backend validates: variable names, expression length, don't-care count
    ↓
Backend evaluates expression for ALL 2^n combinations (deterministic!)
    ↓
Derives actual minterms from evaluation
    ↓
Suspicious results (constant-0, constant-1) → retry with error context
    ↓
Return verified {variables, minterms, dont_cares} to frontend
```

### 14.2 Key Principle: Deterministic Authority

**The LLM is NEVER the final authority.** The Boolean evaluator re-derives minterms deterministically. If the AI says "the answer is m(3,5)" but the expression evaluates to m(3,5,7), the backend returns m(3,5,7) — the evaluator wins.

### 14.3 Retry Strategy

1. First attempt: build prompt with problem statement
2. On failure: append error context to prompt and retry
3. Maximum 1 retry (2 total attempts)
4. After retry failure: return HTTP 502 with descriptive error

---

## 15. Data Flow

### Complete Web1 Pipeline

```
┌─────────────┐
│  User Input  │ ← Expression, minterms, truth table, or word problem
└──────┬──────┘
       ↓
┌─────────────┐
│  main.ts     │ ← collectRawInputs()
└──────┬──────┘
       ↓
┌─────────────┐
│  solver.ts   │ ← buildSolverModel(raw)
│              │   ├── parseExpression() → AST
│              │   ├── astTruthTable()   → rows
│              │   ├── minimizeSOP()     → QM implicants
│              │   ├── minimizePOS()     → QM implicants
│              │   └── sopAstFromImplicants() → simplifiedAst
└──────┬──────┘
       ↓
┌─────────────┐
│  results.ts  │ ← renderResults(model)
│              │   ├── Truth table HTML
│              │   ├── K-map + overlays
│              │   ├── Circuit synthesis (3 implementations)
│              │   ├── Verilog / C / LaTeX exports
│              │   └── Exhaustive verification
└─────────────┘
```

### Complete AI Pipeline

```
┌─────────────┐
│ User types   │ ← "A door opens when card and PIN are valid"
│ word problem │
└──────┬──────┘
       ↓
┌─────────────┐
│ booleanApi.ts│ ← fetchMintermsFromProblem()
└──────┬──────┘
       ↓ (HTTP POST)
┌─────────────┐
│ Backend      │ ← main.py
│   ↓ parser  │   Is it Σm notation? → deterministic
│   ↓ ai_solve│   Otherwise → Gemini
│   ↓ verify  │   Evaluate expression → derive minterms
└──────┬──────┘
       ↓ (JSON response)
┌─────────────┐
│ solver.ts    │ ← fromWordProblem()
└──────┬──────┘
       ↓
┌─────────────┐
│ renderResults│ ← same as expression pipeline
└─────────────┘
```

---

## 16. Build System

### Build Pipeline

```
TypeScript source (src/**/*.ts)
    ↓ esbuild (bundle, IIFE, ES2020)
JavaScript bundle (script.js)
    ↓
Static HTML page loads script.js
```

### Commands

| Command | Purpose |
|---|---|
| `npm run build` | Typecheck + build all three apps |
| `npm run build:web1` | Build Web1 only |
| `npm run typecheck` | TypeScript type-check only |
| `npm test` | Run unit tests (vitest) |
| `npm run test:backend` | Run backend tests (pytest) |
| `npm run check:shared` | Verify shared JS files are identical |

---

## 17. Testing Strategy

### TypeScript Unit Tests (170 tests)

| Test File | Tests | What It Verifies |
|---|---|---|
| `parser.test.ts` | 18 | Parsing, errors, multi-char, unicode |
| `minimizer.test.ts` | 14 | QM for known functions + random equivalence |
| `formatter.test.ts` | 10 | Display + round-trip fidelity |
| `exporters.test.ts` | 10 | Verilog/C/LaTeX logical equivalence |
| `constants.test.ts` | 20 | Constant 0/1 through full pipeline |
| `multiCharVars.test.ts` | 14 | Multi-character variable names |
| `solverCore.test.ts` | 14 | Full Web1 pipeline |
| `hexSegments.test.ts` | 19 | All 7 segments × 16 hex digits |
| `property.test.ts` | 51 | Random-function minimization |

### Backend Tests (57 tests)

| Test File | Tests | What It Verifies |
|---|---|---|
| `test_retry.py` | 46 | Retry logic, mock Gemini, input validation |
| `test_ai_dataset.py` | 11 | Explicit minterm parser, dataset validity |

### Verification Strategy

1. **Exhaustive comparison:** For every random function, minimize → re-evaluate all 2^n inputs → compare minterms
2. **Cross-check:** Independent Verilog/C evaluators verify exported code semantically
3. **AI is untrusted:** Backend re-derives minterms deterministically
4. **Circuit verification:** All three gate implementations checked against truth table

---

## 18. How to Explain This Project

### Level 1 — 30-Second Explanation

> "This is a Digital Circuits Suite — a web-based tool for Boolean logic education. It takes a Boolean expression and produces the truth table, Karnaugh map, minimized form, and gate-level circuit diagrams. It also exports to Verilog and C code. There's a circuit simulator for adders and multiplexers, a 7-segment display simulator, and an AI backend that can solve word problems."

### Level 2 — 2-Minute Explanation

> "The suite has three parts. **Web1** is the Boolean solver — you type an expression like `A·B + A'C`, and it generates the truth table, minimizes it using Quine-McCluskey, shows the Karnaugh map with group overlays, and renders gate-level circuits in three forms: AND/OR/NOT, NAND-only, and NOR-only. All implementations are verified exhaustively.
>
> **Web2** simulates combinational circuits — half adders, full adders, ripple-carry adders, multiplexers, demultiplexers, decoders, and encoders — with live SVG schematics and interactive input switches.
>
> **Web3** simulates a 7-segment display with BCD and hex modes, including counter automation, waveform timing diagrams, and per-segment Boolean expressions derived by the shared minimizer.
>
> The **Backend** uses Google Gemini for natural-language Boolean problems, but the AI output is always verified deterministically — the AI is never trusted as the final authority."

### Level 3 — 5-Minute Technical Explanation

> "**Boolean Engine:** The core is a shared TypeScript library in `shared/ts/boolean/`. It has a tokenizer that recognizes multi-character identifiers, constants, and all Boolean operators. The parser is a recursive-descent parser producing an AST. The AST is evaluated by `evalAst()` for truth-table generation, and by the Quine-McCluskey minimizer for SOP/POS reduction.
>
> **Quine-McCluskey:** Groups minterms by popcount, merges patterns differing in one bit, identifies prime implicants, builds a prime-implicant chart, extracts essential primes, and solves the remaining exact-cover problem with a branch-and-bound search (200K node budget). Falls back to greedy coverage if the budget is exceeded.
>
> **Circuit Synthesis:** The minimized implicants are converted to a DAG (directed acyclic graph). Three implementations are generated: basic SOP (AND/OR/NOT), NAND-only (using NAND-NAND equivalence), and NOR-only (using NOR-NOR equivalence). The layout algorithm assigns nodes to levels via longest-path, then centers them vertically. Wire routing uses channel routing with hop-arc crossings.
>
> **AI Verification:** The backend uses Gemini's structured JSON output (response_schema) to get variables and a Boolean expression. It then evaluates the expression for all 2^n input combinations using a safe Python AST evaluator (no eval/exec). If the result is suspicious (constant 0 or 1), it retries once with error context."

### Level 4 — Deep Technical Explanation

**Parser:**
- Tokenizer supports: `[A-Za-z][A-Za-z0-9_]*` identifiers, `0`/`1` constants, postfix `'`, prefix `!`/`~`/`¬`, AND (`*`/`&`/`·`/`∧`/`.`), OR (`+`/`|`/`∨`), XOR (`^`/`⊕`), parentheses
- Precedence: OR < XOR < AND < prefix NOT < postfix NOT
- Implicit AND insertion for juxtaposed operands
- `knownVariables` parameter enables merged-identifier detection with helpful error messages

**AST:**
- Discriminated union on `kind` field
- `evalAst()` — recursive evaluator with variable assignment lookup
- `astTruthTable()` — generates all 2^n combinations MSB-first
- `firstMismatch()` — exhaustive comparison of two ASTs

**Quine-McCluskey:**
- Popcount-based grouping for initial partition
- `canCombine()` — exactly one bit difference check
- Prime implicant detection — unmerged patterns from each iteration
- Essential prime extraction — columns with one covering row
- Exact cover — branch-and-budget with 200K node limit
- Greedy fallback — always produces equivalent cover, minimality relaxed

**K-Map:**
- Gray code ordering for row/column labels
- `computeKMapGrid()` — minterm index mapping
- `positionKarnaughOverlays()` — DOM-based overlay rectangles
- Wrap-around groups split into contiguous runs to prevent false membership

**Circuit Synthesis:**
- `buildBasicSOPCircuit()` — AND terms → single OR gate
- `buildNANDCircuit()` — NAND-NAND realization
- `buildNORCircuit()` — NOR-NOR realization (POS convention)
- Layout: longest-path levels → vertical stacking → centering
- Routing: per-source vertical bus + hop-arc crossings

**AI Validation:**
- LLM output is never trusted
- Deterministic Boolean evaluator derives minterms independently
- Constant-0 and constant-1 are suspicious → retry
- Retry prompt includes verification error for self-correction
- Maximum 2 attempts (1 initial + 1 retry)

---

*This document was generated as part of the post-refactoring audit.*
*All algorithms and data flows were verified against the actual source code.*
