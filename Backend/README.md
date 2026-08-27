# Backend — FastAPI AI Backend

> Python FastAPI service for AI-powered Boolean problem solving. Accepts natural-language word problems, converts them to verified minterms via Gemini AI, or parses explicit Σm/Σd notation deterministically.

## Table of Contents

- [Purpose](#purpose)
- [Directory Tree](#directory-tree)
- [Module Tree](#module-tree)
- [Architecture](#architecture)
- [Module-by-Module Walkthrough](#module-by-module-walkthrough)
- [AI Correctness Pipeline](#ai-correctness-pipeline)
- [Professor / Viva Guide](#professor--viva-guide)
- ["Where Do I Find...?" Quick Reference](#where-do-i-find-quick-reference)

---

## Purpose

The backend solves one problem: convert a natural-language Boolean logic description into a list of minterms (indices where the output is 1) and don't-care terms.

**Two paths:**

1. **Path 1 — Explicit Σm/Σd (Deterministic):** If the user provides `F(A,B,C) = Σm(1,3,5,7)`, parse it directly. No AI needed.

2. **Path 2 — Natural Language (AI):** Send the problem to Gemini, get back a Boolean expression, evaluate it exhaustively for all 2^n combinations, and return verified minterms.

**Key invariant:** The AI is NEVER trusted as the final authority. Every result is validated deterministically.

---

## Directory Tree

```
Backend/
├── backend.py            # Entry point: re-exports app from main.py
├── main.py               # FastAPI routes, CORS, Gemini client, validation pipeline
├── models.py             # Pydantic ProblemRequest model
├── parser.py             # Deterministic Σm/Σd parser (Path 1)
├── ai_solver.py          # Gemini prompt builder, API call, variable validation
├── boolean_engine.py     # Boolean expression evaluator + minterm generator
├── config.py             # Safety limits
├── requirements.txt      # Python dependencies
├── .env.example          # Template for GEMINI_API_KEY
└── README.md             # ← This file
```

---

## Module Tree

```
Backend
│
├── FastAPI Application (main.py)
│   ├── CORS middleware (allow all origins)
│   ├── Gemini client (initialized at startup)
│   ├── POST /api/solve-boolean → solve_boolean()
│   └── GET / → root() (health check)
│
├── Request Model (models.py)
│   └── ProblemRequest(problem_statement: str)
│
├── Path 1: Explicit Σm/Σd (parser.py)
│   └── parse_explicit_minterms(text)
│       ├── Regex: F(A,B,C) = Σm(1,3,5) Σd(2)
│       ├── Supports: Σ/∑, m/d, sum notation
│       ├── Multi-char variable names (RESET_N, ENABLE)
│       └── Index validation + dedup
│
├── Path 2: AI Solver (ai_solver.py)
│   ├── build_prompt(problem, retry_error)
│   │   ├── 10-section instruction template
│   │   ├── Variable identification rules
│   │   ├── Translation rules (AND, OR, XOR, counting, etc.)
│   │   ├── Case analysis guidance
│   │   ├── Override/suppression rules
│   │   ├── Self-check instructions
│   │   └── Retry section (error context)
│   ├── call_gemini(client, prompt)
│   │   ├── Structured JSON output (response_schema)
│   │   ├── gemini-3.5-flash-lite model
│   │   └── Configurable timeout
│   └── validate_variables(variables)
│       ├── Regex: [A-Za-z][A-Za-z0-9_]*
│       ├── No empty, no duplicates
│       └── No leading underscore
│
├── Boolean Engine (boolean_engine.py)
│   ├── normalize_expression(expr)
│   │   └── AND/OR/NOT → Python and/or/not
│   ├── evaluate_boolean_expression(expr, vars, values)
│   │   ├── Python AST module (safe — no eval/exec)
│   │   └── Recursive AST walker
│   ├── generate_minterms(variables, expression)
│   │   └── 2^n exhaustive evaluation
│   └── generate_dont_cares(variables, conditions)
│       └── Per-condition evaluation + union
│
└── Configuration (config.py)
    ├── MAX_PROBLEM_LENGTH = 4000
    ├── MAX_VARIABLES = 8
    ├── MAX_EXPRESSION_LENGTH = 2000
    ├── MAX_DONT_CARE_CONDITIONS = 8
    ├── GEMINI_TIMEOUT_SECONDS = 30
    └── MAX_RETRIES = 1
```

---

## Architecture

```
POST /api/solve-boolean
    │
    ▼
Input Validation (length, empty check)
    │
    ▼
Path 1: parse_explicit_minterms()
    │
    ├── Matched? → Return {variables, minterms, dont_cares}
    │              (No Gemini call)
    │
    └── Not matched → Continue to Path 2
    │
    ▼
Path 2: AI Solver (with retry loop)
    │
    ├── build_prompt(problem, retry_error)
    ├── call_gemini(client, prompt)
    │   └── Returns: {variables, expression, dont_care_conditions, variable_descriptions}
    │
    ├── validate_variables(variables)
    ├── Check: len(variables) <= MAX_VARIABLES
    ├── Check: expression exists, len <= MAX_EXPRESSION_LENGTH
    ├── Check: len(dont_care_conditions) <= MAX_DONT_CARE_CONDITIONS
    │
    ├── generate_minterms(variables, expression)
    │   └── Exhaustive 2^n evaluation via Python AST
    │
    ├── generate_dont_cares(variables, dont_care_conditions)
    │
    ├── Verification:
    │   ├── Constant-0 check (all zeros → retry)
    │   └── Constant-1 check (all ones with 3+ vars → retry)
    │
    ├── Success → Return {variables, minterms, dont_cares, variable_descriptions}
    │
    └── Failure → Retry with error context (1 retry max)
```

---

## Module-by-Module Walkthrough

### FastAPI Application (`main.py`)

**Routes:**
- `POST /api/solve-boolean` — Main solver endpoint
- `GET /` — Health check

**CORS:** `allow_origins=["*"]` — all origins allowed (educational project).

**Gemini Client:** Initialized at import time using `os.environ["GEMINI_API_KEY"]`. Raises `RuntimeError` if the key is not set.

### Explicit Σm/Σd Parser (`parser.py`)

**Purpose:** Parse notation like `F(A,B,C) = Σm(1,3,5,7) Σd(2,6)` without calling Gemini.

**Algorithm:**
1. Regex to extract variable list from `F(...)`.
2. Regex to extract minterms from `Σm(...)` or `sum m(...)`.
3. Regex to extract don't-cares from `Σd(...)` or `sum d(...)`.
4. Validate indices (0 to 2^n - 1).
5. Deduplicate and sort.
6. Remove any don't-care that also appears as a minterm.

**Supported Formats:**
- `F(A,B,C) = Σm(1,3,5,7)`
- `F(A,B,C) = Σm(1,3) Σd(2,6)`
- `F(A,B) = sum m(0,2,4)`
- `F(RESET_N,ENABLE) = Σm(1)`

**How to Explain It:**
"When the user provides explicit minterm notation, we parse it directly with regex. This bypasses Gemini entirely, giving instant results. The parser supports both Σ and sum notation, and handles multi-character variable names."

### AI Prompt Builder (`ai_solver.py` → `build_prompt()`)

**Purpose:** Construct a detailed instruction prompt for Gemini.

**Prompt Structure (10 sections):**
1. Identify Variables — preserve names, use introduction order
2. Translate Each Requirement — literal reading, logical words
3. Conditional Requirements — case splitting
4. Case Analysis — mode-dependent rules
5. Overrides, Suppression, Exceptions — handle "unless", "except"
6. Counting Conditions — "at least two", "exactly one"
7. Variable Meanings — respect variable definitions
8. Combine Rules — one complete expression
9. Self-Check — verify against original problem
10. Don't-Care Conditions — only if explicitly stated
11. Output Format — JSON with variables, expression, dont_care_conditions, variable_descriptions

**Retry Section:** On retry, appends the verification error so Gemini can correct itself.

**How to Explain It:**
"The prompt is a 10-section instruction that teaches Gemini how to reason about Boolean logic problems. It emphasizes literal translation, case analysis, and self-checking. On retry, we include the specific error so Gemini knows what went wrong."

### Gemini API Call (`ai_solver.py` → `call_gemini()`)

**Purpose:** Call Gemini with structured JSON output.

**Key Design:**
- Uses `response_mime_type="application/json"` and `response_schema` to enforce structured output at the API level.
- Model: `gemini-3.5-flash-lite`
- Thinking level: `MINIMAL` (for speed)
- Timeout: Configurable via `GEMINI_TIMEOUT_SECONDS` (default 30s)

**How to Explain It:**
"We use Gemini's structured output feature to force it to return valid JSON in exactly the format we need. This eliminates parsing errors and ensures we get variables, an expression, and don't-care conditions."

### Boolean Expression Evaluator (`boolean_engine.py`)

**Purpose:** Safely evaluate Boolean expressions and generate minterms.

**Key Functions:**
- `normalize_expression(expr)` — Converts AND/OR/NOT to Python `and`/`or`/`not`.
- `evaluate_boolean_expression(expr, vars, values)` — Parses the expression using Python's `ast` module (safe — no `eval`/`exec`), then walks the AST to evaluate.
- `generate_minterms(variables, expression)` — For each of the 2^n input combinations, evaluates the expression and collects indices where output is 1.
- `generate_dont_cares(variables, conditions)` — Evaluates each don't-care condition expression separately.

**Safety:** Uses `ast.parse()` + manual AST walking instead of `eval()`. This prevents code injection.

**How to Explain It:**
"We convert the Boolean expression into Python syntax, parse it into an AST, and walk the tree ourselves. This is safe because we only handle `and`, `or`, `not`, variable references, and parentheses. We never use `eval()` or `exec()`."

### Configuration (`config.py`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_PROBLEM_LENGTH` | 4000 | Max characters in problem statement |
| `MAX_VARIABLES` | 8 | Max distinct variables |
| `MAX_EXPRESSION_LENGTH` | 2000 | Max characters in AI expression |
| `MAX_DONT_CARE_CONDITIONS` | 8 | Max don't-care conditions from AI |
| `GEMINI_TIMEOUT_SECONDS` | 30 | Gemini API timeout |
| `MAX_RETRIES` | 1 | Retry attempts after failure |

These mirror `shared/ts/boolean/limits.ts` — both must be updated together.

---

## AI Correctness Pipeline

```
Natural Language
        ↓
   AI Interpretation (Gemini)
        ↓
   Structured JSON: {variables, expression, dont_care_conditions}
        ↓
   Backend Validation
        ├── Variable names: regex + dedup + max 8
        ├── Expression: exists + parseable + length check
        └── Don't-cares: count check
        ↓
   Boolean Evaluation (Python AST sandbox)
        ├── normalize_expression(): AND/OR/NOT → Python keywords
        ├── ast.parse() + manual walk (safe)
        └── evaluate for each of 2^n combinations
        ↓
   Minterm Generation
        └── Collect indices where output = 1
        ↓
   Don't-Care Generation
        └── Evaluate each don't-care condition
        ↓
   Verification
        ├── Constant-0: minterms empty + don't-cares empty → retry
        └── Constant-1: all minterms + no don't-cares + 3+ vars → retry
        ↓
   Frontend
        └── {variables, minterms, dont_cares, variable_descriptions}
```

**Deterministic parts:** Variable validation, expression evaluation, minterm generation, don't-care generation, constant detection.

**AI-dependent parts:** Natural language → variable identification, expression construction, don't-care identification.

**Safeguards:**
1. Variable validation (regex, dedup, max count)
2. Expression parseability check (Python AST)
3. Exhaustive minterm verification (2^n evaluation)
4. Constant-0 detection (all zeros = suspicious)
5. Constant-1 detection (all ones with 3+ vars = suspicious)
6. Retry with error context (1 retry)
7. Input length limits (problem, expression, variables, don't-cares)

**Missing safeguards:**
- No semantic check that the expression matches the English problem
- No check for variables mentioned in the problem but not in the expression
- No check for common translation errors (e.g., confusing "at least" with "exactly")

---

## Professor / Viva Guide

### Q: How does the frontend communicate with FastAPI?

**A:** The frontend sends an HTTP POST to `https://digitalcircuits.onrender.com/api/solve-boolean` with JSON body `{problem_statement: "..."}`. The backend processes it and returns `{variables, minterms, dont_cares, variable_descriptions}`. The request has a 45-second timeout.

### Q: What happens when Gemini gives a wrong answer?

**A:** The backend detects wrong answers through deterministic validation. If the expression evaluates to 0 for all inputs (constant-0) or 1 for all inputs (constant-1 with 3+ variables), it retries with the error appended to the prompt. The retry gives Gemini a chance to correct itself. If the retry also fails, it returns a 502 error.

### Q: How is the Boolean expression evaluated safely?

**A:** In `boolean_engine.py` → `evaluate_boolean_expression()`. The expression is normalized (AND/OR/NOT → Python `and`/`or`/`not`), parsed using Python's `ast` module, and evaluated by walking the AST manually. We never use `eval()` or `exec()`, so arbitrary code execution is impossible.

### Q: What is the explicit Σm/Σd parser?

**A:** In `parser.py` → `parse_explicit_minterms()`. It uses regex to detect notation like `F(A,B,C) = Σm(1,3,5) Σd(2)`. If detected, it parses the variables, minterms, and don't-cares directly — no Gemini call needed. This is deterministic and instant.

### Q: How does the retry mechanism work?

**A:** The main solver loop in `main.py` runs up to `MAX_RETRIES + 1` attempts (default: 2 total). On each failure (constant-0, constant-1, bad variables, missing expression, evaluation error), the error message is saved and passed to `build_prompt(retry_error=...)`. The retry prompt includes a "PREVIOUS ATTEMPT FAILED" section with the specific error.

### Q: What model does Gemini use?

**A:** `gemini-3.5-flash-lite` (specified in `ai_solver.py` → `MODEL`). It's configured with `thinking_level="MINIMAL"` for faster responses and `response_mime_type="application/json"` for structured output.

### Q: How are minterms generated from the expression?

**A:** In `boolean_engine.py` → `generate_minterms()`. For n variables, it iterates over all 2^n input combinations (0 to 2^n - 1). For each combination, it builds a variable assignment dictionary, evaluates the expression, and collects the index if the result is 1.

### Q: What are the safety limits?

**A:** Defined in `config.py` (mirrors `shared/ts/boolean/limits.ts`): max 8 variables, max 4000-character problem statement, max 2000-character expression, max 8 don't-care conditions, 30-second Gemini timeout, 1 retry.

---

## "Where Do I Find...?" Quick Reference

| Professor asks... | File | Function/Module |
|-------------------|------|-----------------|
| FastAPI route | `Backend/main.py` | `solve_boolean()` |
| Health check | `Backend/main.py` | `root()` |
| Σm/Σd parser | `Backend/parser.py` | `parse_explicit_minterms()` |
| AI prompt | `Backend/ai_solver.py` | `build_prompt()` |
| Gemini call | `Backend/ai_solver.py` | `call_gemini()` |
| Variable validation | `Backend/ai_solver.py` | `validate_variables()` |
| Expression evaluator | `Backend/boolean_engine.py` | `evaluate_boolean_expression()` |
| Minterm generator | `Backend/boolean_engine.py` | `generate_minterms()` |
| Don't-care generator | `Backend/boolean_engine.py` | `generate_dont_cares()` |
| Expression normalizer | `Backend/boolean_engine.py` | `normalize_expression()` |
| Request model | `Backend/models.py` | `ProblemRequest` |
| Safety limits | `Backend/config.py` | `MAX_VARIABLES`, `MAX_PROBLEM_LENGTH`, etc. |
| CORS config | `Backend/main.py` | `CORSMiddleware` |
| Gemini client init | `Backend/main.py` | `genai.Client(api_key=...)` |
| Retry loop | `Backend/main.py` | `for attempt in range(1 + MAX_RETRIES)` |
| Constant-0 check | `Backend/main.py` | Inside `solve_boolean()` |
| Constant-1 check | `Backend/main.py` | Inside `solve_boolean()` |
