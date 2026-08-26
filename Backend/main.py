"""FastAPI application for the Boolean Logic AI Backend.

Routes:
  POST /api/solve-boolean  — solve a Boolean problem
  GET  /                   — health check

Architecture:
  1. If the input is explicit Σm/Σd notation → parser.py (deterministic)
  2. Otherwise → ai_solver.py (Gemini) → boolean_engine.py (verification)
"""

import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai

from config import (
    MAX_DONT_CARE_CONDITIONS,
    MAX_EXPRESSION_LENGTH,
    MAX_PROBLEM_LENGTH,
    MAX_RETRIES,
    MAX_VARIABLES,
)
from models import ProblemRequest
from parser import parse_explicit_minterms
from ai_solver import build_prompt, call_gemini, validate_variables
from boolean_engine import (
    generate_dont_cares,
    generate_minterms,
)

# ============================================================
# INITIALIZATION
# ============================================================

load_dotenv()

app = FastAPI(
    title="Boolean Logic AI Backend",
    description=(
        "Converts natural-language digital-logic problems into "
        "structured Boolean problems with verified solutions."
    ),
)

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# GEMINI CLIENT
# ============================================================

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. "
        "Put GEMINI_API_KEY=your_key in your .env file."
    )

client = genai.Client(api_key=api_key)


# ============================================================
# ROUTES
# ============================================================

@app.post("/api/solve-boolean")
def solve_boolean(req: ProblemRequest):
    """Solve a Boolean problem from natural language or explicit minterms."""

    # --------------------------------------------------------
    # INPUT VALIDATION
    # --------------------------------------------------------

    if len(req.problem_statement) > MAX_PROBLEM_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Problem statement exceeds maximum length "
                f"of {MAX_PROBLEM_LENGTH} characters."
            ),
        )

    if not req.problem_statement.strip():
        raise HTTPException(
            status_code=400,
            detail="problem_statement is required",
        )

    # --------------------------------------------------------
    # PATH 1: EXPLICIT MINTERMS (deterministic, no Gemini)
    # --------------------------------------------------------

    try:
        explicit_result = parse_explicit_minterms(req.problem_statement)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if explicit_result is not None:
        variables = explicit_result["variables"]
        minterms = explicit_result["minterms"]
        dont_cares = explicit_result["dont_cares"]

        variable_descriptions = {v: "" for v in variables}

        return {
            "variables": variables,
            "num_variables": len(variables),
            "minterms": minterms,
            "dont_cares": dont_cares,
            "variable_descriptions": variable_descriptions,
            "expression": None,
        }

    # --------------------------------------------------------
    # PATH 2: NATURAL-LANGUAGE WORD PROBLEM (Gemini + verify)
    # --------------------------------------------------------

    last_error = ""

    for attempt in range(1 + MAX_RETRIES):
        prompt = build_prompt(req.problem_statement, retry_error=last_error)

        # --- Call Gemini ---
        try:
            result = call_gemini(client, prompt)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned invalid JSON.",
            )
        except TimeoutError as e:
            last_error = (
                f"Gemini request timed out "
                f"after {MAX_RETRIES + 1} attempts: {e}"
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=504, detail=last_error)
        except Exception as e:
            last_error = f"Gemini call failed: {e}"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        # --- Extract fields ---
        variables = result.get("variables") or []
        expression = result.get("expression")
        dont_care_conditions = result.get("dont_care_conditions") or []
        raw_descriptions = result.get("variable_descriptions") or []

        # --- Validate variables ---
        try:
            validate_variables(variables)
        except ValueError as e:
            last_error = str(e)
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        if len(variables) > MAX_VARIABLES:
            last_error = (
                f"Too many variables ({len(variables)}). "
                f"Maximum supported is {MAX_VARIABLES}."
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        if not expression:
            last_error = "Gemini did not return a Boolean expression."
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        if len(expression) > MAX_EXPRESSION_LENGTH:
            last_error = (
                f"Expression too long ({len(expression)} chars). "
                f"Maximum is {MAX_EXPRESSION_LENGTH}."
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        if len(dont_care_conditions) > MAX_DONT_CARE_CONDITIONS:
            last_error = (
                f"Too many don't-care conditions "
                f"({len(dont_care_conditions)}). "
                f"Maximum is {MAX_DONT_CARE_CONDITIONS}."
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        # --- Calculate minterms deterministically ---
        try:
            minterms = generate_minterms(variables, expression)
        except Exception as e:
            last_error = "Could not evaluate Boolean expression: " + str(e)
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        # --- Calculate don't-cares ---
        try:
            dont_cares = generate_dont_cares(
                variables, dont_care_conditions
            )
        except Exception:
            dont_cares = []

        dont_cares = sorted(set(dont_cares))
        minterms = [m for m in minterms if m not in dont_cares]

        # --- Verification: constant-0 is suspicious ---
        num_vars = len(variables)
        if (
            num_vars > 0
            and len(minterms) == 0
            and len(dont_cares) == 0
        ):
            last_error = (
                "The expression evaluated to 0 for all "
                f"{2 ** num_vars} input combinations, "
                "which contradicts the problem statement. "
                "The output should be 1 for at least one case."
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        # --- Verification: constant-1 is suspicious ---
        if (
            num_vars > 0
            and len(minterms) == (2 ** num_vars) - len(dont_cares)
            and len(dont_cares) == 0
            and num_vars >= 3
        ):
            last_error = (
                "The expression is true for all "
                f"{2 ** num_vars} input combinations, "
                "which contradicts the problem statement. "
                "The output should not always be 1."
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        # --- Build variable descriptions ---
        variable_descriptions = {}
        for item in raw_descriptions:
            if (
                isinstance(item, dict)
                and "letter" in item
                and "description" in item
            ):
                variable_descriptions[item["letter"]] = item["description"]

        # --- Success ---
        return {
            "variables": variables,
            "num_variables": len(variables),
            "minterms": minterms,
            "dont_cares": dont_cares,
            "variable_descriptions": variable_descriptions,
            "expression": expression,
        }

    # Should not reach here, but safety net:
    raise HTTPException(
        status_code=502,
        detail=(
            "The AI interpretation could not be mathematically verified. "
            "Please rephrase the problem or provide the Boolean "
            "conditions explicitly."
        ),
    )


@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "Boolean Logic AI Backend",
    }
