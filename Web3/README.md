# Web3 — 7-Segment Display Simulator

> Interactive BCD-to-7-segment and Hex-to-7-segment decoder simulator. Two modes (interactive + counter), BCD/HEX encoding, common cathode/anode polarity, Karnaugh maps, QM-minimized Boolean expressions, Verilog generation, decoder schematic, LED color picker, and timing diagram.

## Table of Contents

- [Purpose](#purpose)
- [Directory Tree](#directory-tree)
- [Module Tree](#module-tree)
- [Architecture](#architecture)
- [Module-by-Module Walkthrough](#module-by-module-walkthrough)
- [BCD vs HEX Logic](#bcd-vs-hex-logic)
- [Professor / Viva Guide](#professor--viva-guide)
- ["Where Do I Find...?" Quick Reference](#where-do-i-find-quick-reference)

---

## Purpose

Web3 simulates a 7-segment display decoder. It takes a 4-bit binary input (A=8, B=4, C=2, D=1) and drives 7 segments (a–g) to display a digit. Features:

1. **Two modes** — Interactive (manual control) and Counter (automated clock)
2. **Two encodings** — BCD (0–9) and HEX (0–F)
3. **Two polarities** — Common Cathode (active HIGH) and Common Anode (active LOW)
4. **Interactive SVG display** — Click individual segments to toggle
5. **Reverse pattern matching** — Identifies which digit the current pattern represents
6. **Truth table** — Per-digit segment outputs
7. **Boolean expressions** — QM-minimized SOP per segment
8. **Karnaugh maps** — One 4-variable K-map per segment
9. **Decoder schematic** — SVG with inverter gates + live wire coloring
10. **Verilog generation** — Case-based decoder module
11. **Counter** — Start/stop/reset, step forward/back, adjustable speed
12. **LED color picker** — 6 color themes
13. **Timing diagram** — Canvas 2D waveform of all 7 segments

---

## Directory Tree

```
Web3/
├── index.html                # Main HTML page
├── style.css                 # Full UI stylesheet
├── script.ts                 # Entry point: wires deps, initializes UI
├── script.js                 # ← Compiled output (DO NOT EDIT)
├── theme.js                  # Theme system (identical copy)
├── fx.js                     # Studio FX (identical copy)
└── src/
    ├── types.ts              # SegmentId, HEX_PATTERNS, BCD_MINTERMS, HEX_CHARS
    ├── hexExpressions.ts     # QM-derived Boolean expressions for all 7 segments
    ├── segments.ts           # 7-segment SVG renderer + reverse pattern matching
    ├── circuit.ts            # Decoder schematic + wire helpers
    └── ui.ts                 # All UI logic
```

---

## Module Tree

```
Web3
│
├── Entry Point (script.ts)
│   ├── DOM element lookup (Web3Els)
│   ├── State initialization (Web3State)
│   ├── Dependency injection (deps)
│   └── Wire up all modules
│
├── Types & Constants (src/types.ts)
│   ├── SegmentId type — "a"|"b"|"c"|"d"|"e"|"f"|"g"
│   ├── SegmentPattern interface — {a, b, c, d, e, f, g: number}
│   ├── SEGMENTS constant — ["a","b","c","d","e","f","g"]
│   ├── HEX_PATTERNS — 16 hex digit → segment patterns
│   ├── HEX_CHARS — display characters for 0-F
│   └── BCD_MINTERMS — per-segment minterm lists (0-9)
│
├── Boolean Expressions (src/hexExpressions.ts)
│   ├── deriveSegmentExpressions() — QM pipeline
│   │   ├── segmentMinterms() — pattern → minterm list
│   │   ├── minimizeSOP() — from shared/ts/boolean/minimizer.ts
│   │   ├── implicantToExpression() — pattern → display string
│   │   └── verifyExpression() — exhaustive verification
│   ├── HEX_EXPRESSIONS — 7 expressions for 16 hex digits
│   └── BCD_EXPRESSIONS — 7 expressions with 10-15 as don't-cares
│
├── Segment Rendering (src/segments.ts)
│   ├── render7Segment(pattern, isCommonAnode, size) — SVG string
│   └── findMatchingPattern(pat, isHexMode, isCommonAnode) — reverse decode
│
├── Decoder Schematic (src/circuit.ts)
│   ├── wireHopH(), wireV(), dot() — wire helpers
│   └── renderDecoderSchematic() — SVG decoder IC with live wires
│
├── UI Logic (src/ui.ts)
│   ├── Waveform
│   │   ├── recordSegmentWave() — record segment states
│   │   └── drawSegTimingDiagram() — Canvas 2D
│   ├── Input Controls
│   │   ├── buildInputs() — 4 binary toggle buttons
│   │   └── syncDisplayFromInput() — update all views from currentInput
│   ├── Display
│   │   ├── updateAllViews() — render segment, match, truth table, circuit, waveform
│   │   └── reverseDecodeCustomDisplay() — for click-on-segment mode
│   ├── Truth Table
│   │   └── buildTruthTable() — 10 rows (BCD) or 16 rows (HEX)
│   ├── Boolean Expressions
│   │   └── buildExpressions() — expression cards + Verilog generation
│   ├── Karnaugh Maps
│   │   └── buildKarnaughMaps() — 7 four-variable K-maps
│   ├── Circuit Diagram
│   │   ├── renderCircuitDiagram() — decoder schematic
│   │   └── applyZoom(), resetZoom(), setupZoomPan()
│   ├── Counter
│   │   └── setupCounter() — start/stop/reset/step/speed
│   ├── LED Colors
│   │   └── setupLedColorPicker() — 6 CSS class themes
│   ├── Keyboard
│   │   └── setupKeyboard() — 0-F key handlers
│   └── Mode Controls
│       └── setupModeControls() — interactive/counter, BCD/HEX, cathode/anode
```

---

## Architecture

```
User selects mode (interactive / counter)
    │
    ▼
Input: 4-bit binary (A=8, B=4, C=2, D=1)
    │  via toggle buttons, keyboard 0-F, or counter auto-increment
    │
    ▼
state.currentInput (0-15)
    │
    ├──► HEX_PATTERNS[state.currentInput] → SegmentPattern
    │
    ├──► Polarity adjustment:
    │    Common Cathode: segmentValues = pattern
    │    Common Anode: segmentValues = 1 - pattern
    │
    ▼
updateAllViews()
    │
    ├──► render7Segment() → SVG interactive display
    ├──► findMatchingPattern() → digit description
    ├──► buildTruthTable() → highlight active row
    ├──► buildExpressions() → QM-minimized expressions + Verilog
    ├──► buildKarnaughMaps() → 7 K-maps
    ├──► renderDecoderSchematic() → SVG with live wires
    └──► recordSegmentWave() → timing diagram
```

---

## Module-by-Module Walkthrough

### Types & Constants (`types.ts`)

**Source of Truth:** `HEX_PATTERNS` is the canonical mapping from hex digit (0–15) to segment on/off state. Everything else — truth tables, K-maps, Boolean expressions, Verilog — is derived from this.

```
Digit 0 → {a:1, b:1, c:1, d:1, e:1, f:1, g:0}
Digit 1 → {a:0, b:1, c:1, d:0, e:0, f:0, g:0}
...
Digit F → {a:1, b:0, c:0, d:0, e:1, f:1, g:1}
```

**BCD_MINTERMS:** For BCD mode, each segment's minterm list (which digits 0–9 activate it). Digits 10–15 are treated as don't-cares.

### Boolean Expressions (`hexExpressions.ts`)

**Purpose:** Derive minimized SOP expressions for each of the 7 segments.

**Algorithm:**
1. For each segment, collect minterms from `HEX_PATTERNS` (digits where segment=1).
2. Run `minimizeSOP()` from `shared/ts/boolean/minimizer.ts`.
3. Convert implicants to display strings.
4. Exhaustively verify against `HEX_PATTERNS`.
5. For BCD: digits 10–15 are passed as don't-cares to QM.

**Output:** `HEX_EXPRESSIONS` and `BCD_EXPRESSIONS` — `Record<SegmentId, string>`.

**How to Explain It:**
"Each of the 7 segments has a Boolean expression that determines when it's ON. We derive these by treating each segment as an independent Boolean function of 4 variables (A, B, C, D) and minimizing with Quine-McCluskey. For BCD mode, digits 10–15 are don't-cares, giving simpler expressions."

### Segment SVG Renderer (`segments.ts`)

**Purpose:** Render the 7-segment display as an interactive SVG.

**Key Function:** `render7Segment(pattern, isCommonAnode, size)` — Returns SVG with 7 path elements (one per segment), each labeled with its segment ID. Segments are colored based on the pattern and polarity.

**Reverse Matching:** `findMatchingPattern()` compares the current segment pattern against all known hex/BCD patterns and returns a description like "Digit 'A' (1010) — Hex 0xA".

### Decoder Schematic (`circuit.ts`)

**Purpose:** Render the BCD/HEX to 7-segment decoder as an SVG schematic.

**Key Function:** `renderDecoderSchematic()` — Draws:
- Input lines A, B, C, D with inverter gates for complemented rails
- A decoder IC housing (labeled "BCD to 7-SEG" or "HEX to 7-SEG")
- 7 segment output badges with live coloring (on/off based on current input)

**How to Explain It:**
"The decoder schematic shows the internal logic: 4 input lines, each with an inverter gate to produce complemented rails, and 7 output lines connected to segment badges. The badges light up in real time as the input changes."

### UI Logic (`ui.ts`)

**Key Design:** All functions accept a `deps` parameter containing DOM elements, state, and sound effects. This keeps the module free of module-scope side effects and makes it testable.

**Counter:** Uses `setInterval` with adjustable speed (ms). Steps through digits 0–maxVal (9 for BCD, 15 for HEX).

**Keyboard:** Listens for keydown events. Keys 0–9 and A–F set `state.currentInput` directly. HEX-only keys are ignored in BCD mode.

**LED Colors:** 6 CSS class themes (led-red, led-green, led-cyan, led-amber, led-purple, led-white) applied to `<body>`.

---

## BCD vs HEX Logic

### BCD Mode (`isHexMode = false`)

- **Input range:** 0–9 (inputs > 9 are clamped to 9)
- **Truth table:** 10 rows
- **K-maps:** Digits 10–15 are shown as don't-cares (X)
- **Boolean expressions:** `BCD_EXPRESSIONS` — derived with digits 10–15 as don't-cares, giving simpler expressions
- **Verilog:** Only 10 case entries (default = all segments off)

### HEX Mode (`isHexMode = true`)

- **Input range:** 0–15
- **Truth table:** 16 rows
- **K-maps:** No don't-cares (all 16 digits are used)
- **Boolean expressions:** `HEX_EXPRESSIONS` — derived with all 16 digits, giving more complex expressions
- **Verilog:** 16 case entries (0-F)

### Polarity Handling

| Polarity | Segment ON | Segment OFF |
|----------|-----------|-------------|
| Common Cathode | seg = 1 | seg = 0 |
| Common Anode | seg = 0 | seg = 1 |

The display renderer (`render7Segment`) checks `isCommonAnode` to determine which segments are lit. The truth table and K-maps also adjust based on polarity.

---

## Professor / Viva Guide

### Q: Where is the 7-segment truth table generated?

**A:** In `Web3/src/ui.ts` → `buildTruthTable()`. It iterates over all digits (10 for BCD, 16 for HEX), looks up `HEX_PATTERNS[digit]`, applies polarity adjustment, and generates an HTML table with columns for Digit, A, B, C, D, and segments a–g.

### Q: How are the Boolean expressions derived?

**A:** In `Web3/src/hexExpressions.ts` → `deriveSegmentExpressions()`. For each segment, it collects the minterms (digits where the segment is ON), runs `minimizeSOP()` from the shared Quine-McCluskey library, and converts the result to a display string. The expressions are verified exhaustively against all hex inputs. For BCD, digits 10–15 are passed as don't-cares.

### Q: What is the difference between BCD and HEX mode?

**A:** BCD only uses digits 0–9, treating 10–15 as don't-cares. This gives simpler Boolean expressions. HEX uses all 16 digits with no don't-cares. The truth table, K-maps, expressions, and Verilog all change accordingly.

### Q: How does common anode vs common cathode work?

**A:** In common cathode, a segment lights up when its input is HIGH (1). In common anode, it lights up when LOW (0). We handle this by inverting the segment values when `isCommonAnode` is true. The display renderer, truth table, and expressions all account for this polarity.

### Q: Where is the counter implemented?

**A:** In `Web3/src/ui.ts` → `setupCounter()`. It uses `setInterval` to auto-increment `state.currentInput` at the user-defined speed. Start, Stop, Reset, Step Forward, and Step Back buttons control the counter.

### Q: How does the decoder schematic work?

**A:** In `Web3/src/circuit.ts` → `renderDecoderSchematic()`. It draws 4 input lines (A, B, C, D) with inverter gates for complemented rails, a decoder IC housing, and 7 output segment badges. The badges update in real time based on the current input.

### Q: Where is the Verilog generated?

**A:** In `Web3/src/ui.ts` → `generateVerilogModule()`. It generates a case-based decoder with entries for each digit. The polarity (common anode/cathode) determines the bit patterns. For HEX mode, it includes 16 cases; for BCD, only 10.

### Q: How are Karnaugh maps handled for 7 segments?

**A:** In `Web3/src/ui.ts` → `buildKarnaughMaps()`. For each segment, it generates a 4-variable K-map (4×4 grid with Gray code ordering). In HEX mode, all 16 cells are either 0 or 1. In BCD mode, cells for digits 10–15 are marked as don't-cares (X).

### Q: How does the segment waveform timing diagram work?

**A:** In `Web3/src/ui.ts` → `recordSegmentWave()` and `drawSegTimingDiagram()`. Each time the display changes, the current state of all 7 segments is recorded. The Canvas 2D context renders these as digital waveforms — one row per segment, showing high/low over time.

---

## "Where Do I Find...?" Quick Reference

| Professor asks... | File | Function/Module |
|-------------------|------|-----------------|
| Segment patterns | `Web3/src/types.ts` | `HEX_PATTERNS` |
| BCD minterms | `Web3/src/types.ts` | `BCD_MINTERMS` |
| Hex characters | `Web3/src/types.ts` | `HEX_CHARS` |
| Segment SVG | `Web3/src/segments.ts` | `render7Segment()` |
| Reverse matching | `Web3/src/segments.ts` | `findMatchingPattern()` |
| HEX expressions | `Web3/src/hexExpressions.ts` | `HEX_EXPRESSIONS` |
| BCD expressions | `Web3/src/hexExpressions.ts` | `BCD_EXPRESSIONS` |
| Expression derivation | `Web3/src/hexExpressions.ts` | `deriveSegmentExpressions()` |
| Decoder schematic | `Web3/src/circuit.ts` | `renderDecoderSchematic()` |
| Truth table | `Web3/src/ui.ts` | `buildTruthTable()` |
| Karnaugh maps | `Web3/src/ui.ts` | `buildKarnaughMaps()` |
| Verilog generation | `Web3/src/ui.ts` | `generateVerilogModule()` |
| Counter | `Web3/src/ui.ts` | `setupCounter()` |
| LED colors | `Web3/src/ui.ts` | `setupLedColorPicker()` |
| Keyboard input | `Web3/src/ui.ts` | `setupKeyboard()` |
| Mode controls | `Web3/src/ui.ts` | `setupModeControls()` |
| Timing diagram | `Web3/src/ui.ts` | `drawSegTimingDiagram()` |
| Zoom/pan | `Web3/src/ui.ts` | `setupZoomPan()` |
| Entry point | `Web3/script.ts` | Wires deps + calls setup functions |
| QM minimizer | `shared/ts/boolean/minimizer.ts` | `minimizeSOP()` |
