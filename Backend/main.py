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
import re

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
    GEMINI_TIMEOUT_SECONDS,
)
from models import ProblemRequest, CircuitImageRequest
from parser import parse_explicit_minterms
from ai_solver import build_prompt, call_gemini, validate_variables, MODEL
from boolean_engine import (
    generate_dont_cares,
    generate_minterms,
)
from google.genai import types as genai_types

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


CIRCUIT_IMAGE_PROMPT = """
You are an expert at analyzing digital logic circuit diagrams.

Given an image of a circuit, identify:
1. All input variables and their labels
2. All output variables and their labels
3. All logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR, BUFFER)
4. The connections between gates
5. The final Boolean expression for each output
6. A confidence score (0.0 to 1.0) for your analysis

Return ONLY valid JSON with this structure:
{{
    "variables": ["A", "B", "C"],
    "outputs": ["F"],
    "gates": [
        {{
            "id": "g1",
            "type": "AND",
            "inputs": ["A", "B"],
            "output": "n1"
        }}
    ],
    "connections": [
        {{ "from": "A", "to": "g1", "port": 0 }}
    ],
    "booleanExpression": "A AND B",
    "minterms": [3],
    "dont_cares": [],
    "confidence": 0.85
}}

Rules:
- Variables should be single uppercase letters if visible, otherwise A, B, C, D...
- If you cannot identify the circuit clearly, return low confidence
- Minterms must be consistent with the Boolean expression
- Do not guess if the image is unclear
"""


@app.post("/api/analyze-circuit-image")
def analyze_circuit_image(req: CircuitImageRequest):
    """Analyze a circuit image using Gemini vision."""
    if not req.image.strip():
        raise HTTPException(status_code=400, detail="image is required")

    last_error = ""

    for attempt in range(1 + MAX_RETRIES):
        prompt = CIRCUIT_IMAGE_PROMPT
        if last_error:
            prompt += f"""

PREVIOUS ATTEMPT FAILED:
{last_error}
Please fix the issue and try again.
"""

        try:
            # Use Gemini with image input
            response = client.models.generate_content(
                model=MODEL,
                contents=[
                    genai_types.Content(
                        role="user",
                        parts=[
                            genai_types.Part.from_text(text=prompt),
                            genai_types.Part.from_bytes(
                                data=_extract_image_bytes(req.image),
                                mime_type=_detect_mime_type(req.image)
                            )
                        ]
                    )
                ],
                config=genai_types.GenerateContentConfig(
                    http_options=genai_types.HttpOptions(
                        timeout=GEMINI_TIMEOUT_SECONDS * 1000,
                    ),
                    response_mime_type="application/json",
                    thinking_config=genai_types.ThinkingConfig(thinking_level="MINIMAL"),
                ),
            )

            if not response.text:
                raise ValueError("Gemini returned empty response.")

            result = json.loads(response.text)

            # Validate basic structure
            variables = result.get("variables") or []
            minterms = result.get("minterms") or []
            dont_cares = result.get("dont_cares") or []
            expression = result.get("booleanExpression") or result.get("expression")
            confidence = result.get("confidence", 0.5)

            if not variables:
                last_error = "No variables identified in the circuit."
                if attempt < MAX_RETRIES:
                    continue
                raise HTTPException(status_code=502, detail=last_error)

            # Validate variables
            try:
                validate_variables(variables)
            except ValueError as e:
                last_error = str(e)
                if attempt < MAX_RETRIES:
                    continue
                raise HTTPException(status_code=502, detail=last_error)

            if len(variables) > MAX_VARIABLES:
                last_error = f"Too many variables ({len(variables)})."
                if attempt < MAX_RETRIES:
                    continue
                raise HTTPException(status_code=502, detail=last_error)

            # If expression provided, verify minterms against it
            if expression and minterms:
                try:
                    calc_minterms = generate_minterms(variables, expression)
                    if sorted(calc_minterms) != sorted(minterms):
                        minterms = calc_minterms
                except Exception:
                    pass  # Keep AI-provided minterms if verification fails
            elif expression and not minterms:
                try:
                    minterms = generate_minterms(variables, expression)
                except Exception:
                    last_error = f"Could not evaluate expression: {expression}"
                    if attempt < MAX_RETRIES:
                        continue

            return {
                "variables": variables,
                "minterms": sorted(set(minterms)),
                "dont_cares": sorted(set(dont_cares)),
                "expression": expression,
                "confidence": confidence,
                "circuit": result.get("circuit"),
            }

        except json.JSONDecodeError:
            last_error = "Gemini returned invalid JSON."
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)
        except HTTPException:
            raise
        except Exception as e:
            last_error = f"Analysis failed: {e}"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

    raise HTTPException(
        status_code=502,
        detail="Could not analyze the circuit image after multiple attempts."
    )


def _extract_image_bytes(data_url: str) -> bytes:
    """Extract raw bytes from a base64 data URL or plain base64 string."""
    import base64
    if "," in data_url:
        # data:image/png;base64,xxxxx
        header, b64data = data_url.split(",", 1)
    else:
        b64data = data_url
    return base64.b64decode(b64data)


def _detect_mime_type(data_url: str) -> str:
    """Detect MIME type from a data URL."""
    if data_url.startswith("data:"):
        match = re.match(r"data:(image/[a-z]+);", data_url)
        if match:
            return match.group(1)
    return "image/png"


@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "status": "online",
        "service": "Boolean Logic AI Backend",
    }
