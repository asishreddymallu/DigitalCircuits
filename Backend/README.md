# Backend — Boolean Logic AI Backend

> **Framework:** FastAPI + uvicorn  
> **AI Provider:** Google Gemini (gemini-3.5-flash-lite)  
> **Language:** Python 3.12+

A FastAPI service that converts natural-language Boolean logic problems into
structured minterm lists. The critical design principle: **the LLM is never
trusted as the final authority** — every result is verified deterministically.

---

## Quick Start

```bash
# 1. Create virtual environment
cd Backend
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure Gemini API key
cp .env.example .env
# Edit .env and set GEMINI_API_KEY=your_key
# Get a key at: https://aistudio.google.com/apikey

# 4. Run the server
uvicorn main:app --reload --port 8000

# 5. Test it
curl -X POST http://localhost:8000/api/solve-boolean \
  -H "Content-Type: application/json" \
  -d '{"problem_statement": "F(A,B,C) = Σm(1,3,5,7)"}'
```

---

## API Endpoints

### `POST /api/solve-boolean`

Solve a Boolean problem from natural language or explicit minterm notation.

**Request:**
```json
{
  "problem_statement": "string"
}
```

**Response (success):**
```json
{
  "variables": ["A", "B", "C"],
  "num_variables": 3,
  "minterms": [1, 3, 5, 7],
  "dont_cares": [],
  "variable_descriptions": {"A": "input A", "B": "input B", "C": "input C"},
  "expression": "(A AND C) OR (B AND C)"
}
```

**Error responses:**
| Status | Meaning |
|--------|---------|
| 400 | Invalid input (empty, too long, out-of-range indices) |
| 502 | AI interpretation could not be verified (after retry) |
| 504 | Gemini timed out after all retry attempts |

### `GET /`

Health check. Returns `{"status": "online", "service": "Boolean Logic AI Backend"}`.

---

## Architecture — Two Paths

The solver has two processing paths based on the input format:

```
User Input
    ↓
┌──────────────────────────────────┐
│  Is it explicit Σm/Σd notation?  │
│  e.g. F(A,B,C) = Σm(1,3,5,7)   │
└──────────┬───────────────────────┘
           │
     YES ──┤── NO
     │     │     │
     ↓     │     ↓
  Path 1   │  Path 2
  Parser   │  Gemini AI
     │     │     │
     ↓     │     ↓
  Direct   │  Structured JSON
  result   │     │
           │     ↓
           │  Boolean Engine
           │  (deterministic verification)
           │     │
           ↓     ↓
        Verified Response
```

### Path 1: Explicit Minterms (Deterministic)

When the input matches the pattern `F(vars) = Σm(...)`, we skip Gemini entirely.
The `parser.py` module parses the notation directly — no AI needed.

**Supported formats:**
```
F(A,B,C) = Σm(1,3,5,7)
F(A,B,C,D) = Σm(1,3) Σd(2,6)
F(A,B) = sum m(0,2,4) sum d(3)
```

### Path 2: Natural Language (Gemini + Verify)

1. **Build prompt** — system prompt with 11 reasoning rules + retry context
2. **Call Gemini** — structured JSON output (response_schema enforced)
3. **Validate** — variable names, expression length, don't-care count
4. **Evaluate** — deterministic Boolean evaluation for all 2^n combinations
5. **Derive minterms** — indices where output = 1
6. **Verify** — check for suspicious results (constant 0 or 1)
7. **Retry** — if verification fails, retry once with error context
8. **Return** — verified minterm list

---

## Module Reference

### `main.py` — Routes + Orchestration

The FastAPI application entry point. Handles:
- CORS configuration (allow all origins for development)
- Gemini client initialization (requires `GEMINI_API_KEY`)
- The retry loop with verification checks
- Two endpoints: `POST /api/solve-boolean` and `GET /`

**Key function:** `solve_boolean(req)` — the main route handler.

### `config.py` — Safety Limits

Constants that mirror `shared/ts/boolean/limits.ts` in the frontend:

| Constant | Value | Purpose |
|---|---|---|
| `MAX_PROBLEM_LENGTH` | 4000 | Max characters in problem statement |
| `MAX_VARIABLES` | 8 | Max distinct variables per function |
| `MAX_EXPRESSION_LENGTH` | 2000 | Max characters in Boolean expression |
| `MAX_DONT_CARE_CONDITIONS` | 8 | Max don't-care expressions |
| `GEMINI_TIMEOUT_SECONDS` | 30 | Gemini API timeout |
| `MAX_RETRIES` | 1 | Retry attempts after failure |

**Update both `config.py` and `limits.ts` when changing limits.**

### `models.py` — Pydantic Models

```python
class ProblemRequest(BaseModel):
    problem_statement: str
```

Minimal — the response is a plain dict (not a Pydantic model) for simplicity.

### `parser.py` — Explicit Σm/Σd Parser

Parses structured Boolean notation using regex. Handles:
- Unicode sigma: `Σm(...)`, `∑m(...)`
- ASCII alternative: `sum m(...)`
- Don't-care notation: `Σd(...)`, `sum d(...)`
- Multi-character variable names: `RESET_N`, `ENABLE`, `DATA0`

**Key function:** `parse_explicit_minterms(text) → dict | None`

Returns `None` if the input is natural language (not Σm notation).
Returns `{"variables": [...], "minterms": [...], "dont_cares": [...]}` on success.
Raises `ValueError` on invalid indices.

### `boolean_engine.py` — Deterministic Evaluator

The authoritative Boolean evaluation engine. Converts expressions to Python,
parses into AST, and evaluates safely (no `eval()`/`exec()`).

**Key functions:**

| Function | Purpose |
|---|---|
| `normalize_expression(expr)` | Converts AND/OR/NOT → Python `and`/`or`/`not` |
| `evaluate_boolean_expression(expr, vars, values)` | Evaluate for one assignment → 0 or 1 |
| `generate_minterms(variables, expression)` | Evaluate all 2^n → minterm indices |
| `generate_dont_cares(variables, conditions)` | Evaluate don't-care expressions → indices |

**Safety:** Uses Python's `ast.parse()` for safe parsing — no dynamic code execution.

### `ai_solver.py` — Gemini Interaction

Handles all communication with Google Gemini.

**Key functions:**

| Function | Purpose |
|---|---|
| `build_prompt(problem, retry_error)` | Build system prompt with 11 reasoning rules |
| `call_gemini(client, prompt)` | Call Gemini with structured JSON output |
| `validate_variables(variables)` | Check variable names are valid identifiers |

**Prompt design:** 11 sections covering variable identification, requirement
translation, conditional logic, case analysis, overrides, counting conditions,
variable meanings, rule combination, self-check, don't-cares, and output format.

**Retry mechanism:** On failure, the error message is appended to the prompt as
a "PREVIOUS ATTEMPT FAILED" section, telling the LLM what went wrong and asking
it to correct itself.

---

## Request Flow (Detailed)

```
POST /api/solve-boolean
    │
    ├── Input validation (length, emptiness)
    │
    ├── Path 1: parser.py
    │   └── parse_explicit_minterms(text)
    │       ├── Match F(vars) = Σm(...) pattern
    │       ├── Extract variable names
    │       ├── Extract minterm indices
    │       ├── Extract don't-care indices (if any)
    │       ├── Validate index ranges
    │       └── Return {variables, minterms, dont_cares}
    │
    ├── Path 2: Gemini AI loop (MAX_RETRIES + 1 attempts)
    │   │
    │   ├── build_prompt(text, retry_error)
    │   │
    │   ├── call_gemini(client, prompt)
    │   │   ├── Send to Gemini with response_schema
    │   │   └── Parse JSON response
    │   │
    │   ├── validate_variables(variables)
    │   │   ├── Non-empty
    │   │   ├── No duplicates
    │   │   └── Match [A-Za-z][A-Za-z0-9_]*
    │   │
    │   ├── Validate expression length
    │   ├── Validate don't-care count
    │   │
    │   ├── generate_minterms(variables, expression)
    │   │   ├── For each of 2^n combinations:
    │   │   │   ├── Assign variable values
    │   │   │   ├── Evaluate expression via Python AST
    │   │   │   └── Collect indices where result = 1
    │   │   └── Return sorted minterm list
    │   │
    │   ├── generate_dont_cares(variables, conditions)
    │   │
    │   ├── Verification checks:
    │   │   ├── Constant-0: minterms = [] and dont_cares = [] → SUSPICIOUS
    │   │   └── Constant-1: all combos are minterms, n ≥ 3 → SUSPICIOUS
    │   │
    │   └── On failure: set retry_error, loop back to build_prompt
    │
    └── Return verified response
```

---

## Testing

```bash
# Run all backend tests
cd ..  # project root
python3 -m pytest tests/backend -v

# Run with coverage
python3 -m pytest tests/backend -v --tb=short
```

### Test Files

| File | Tests | What It Covers |
|---|---|---|
| `tests/backend/test_retry.py` | 46 | Retry logic, mock Gemini, input validation, health check |
| `tests/backend/test_ai_dataset.py` | 11 | Explicit minterm parser, dataset validity |

### Test Strategy

- **Gemini is mocked** — all AI tests use `unittest.mock.patch` to simulate
  Gemini responses without hitting the API.
- **Retry scenarios** tested: constant-0, constant-1, invalid variables,
  missing expression, unparseable expression, network errors.
- **Explicit minterm path** tested with various formats and edge cases.
- **Input validation** tested: empty, too long, out-of-range indices.

---

## Deployment

### Render (current deployment)

The backend is deployed on Render at `https://digitalcircuits.onrender.com`.

Environment variables needed:
```
GEMINI_API_KEY=your_key_here
```

### Local Development

```bash
uvicorn main:app --reload --port 8000
```

### Using `backend.py`

The `backend.py` file exists only for backward compatibility:

```bash
# This still works:
uvicorn backend:app --reload

# But prefer:
uvicorn main:app --reload
```

---

## Key Invariants

1. **Deterministic authority:** The Boolean evaluator always derives minterms
   independently of the LLM output.

2. **Suspicious results trigger retry:** Constant-0 and constant-1 results are
   almost always AI mistakes (real problems have at least one ON and one OFF case).

3. **Limits are enforced twice:** Both client-side (`shared/ts/boolean/limits.ts`)
   and server-side (`config.py`) enforce the same limits.

4. **No eval/exec:** The Boolean engine uses Python's `ast` module for safe
   expression evaluation — never `eval()` or `exec()`.

5. **Variable naming:** Must match `[A-Za-z][A-Za-z0-9_]*` — same regex used by
   the frontend tokenizer.

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| fastapi | 0.115.0 | Web framework |
| uvicorn[standard] | 0.30.6 | ASGI server |
| pydantic | ≥2.12 | Request validation |
| google-genai | ≥1.51.0 | Gemini API client |
| python-dotenv | 1.0.1 | Load .env files |

---

*This README covers the Backend directory only. For the full project architecture,
see [../ARCHITECTURE.md](../ARCHITECTURE.md).*
