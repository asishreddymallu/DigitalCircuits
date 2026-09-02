"""FastAPI application for the Boolean Logic AI Backend.

Routes:
  POST /api/solve-boolean          — solve a Boolean problem
  POST /api/analyze-circuit-image  — analyze a circuit image
  GET  /                            — health check

Architecture:
  Text problem:
      explicit Sigma notation -> parser.py
      natural language -> ai_solver.py -> boolean_engine.py

  Circuit image:
      image validation -> Gemini vision (structured circuit only)
      -> circuit_validator.py -> circuit_engine.py
      -> boolean_engine.py

Gemini is used for visual interpretation. All Boolean evaluation and
minterm generation are performed deterministically by Python.
"""

import base64
import binascii
import json
import os
import re
from io import BytesIO

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types as genai_types
from PIL import Image

from ai_solver import MODEL, build_prompt, call_gemini, validate_variables
from boolean_engine import generate_dont_cares, generate_minterms
from circuit_engine import circuit_to_expressions
from circuit_validator import CircuitValidationError, validate_circuit
from config import (
    GEMINI_TIMEOUT_SECONDS,
    MAX_DONT_CARE_CONDITIONS,
    MAX_EXPRESSION_LENGTH,
    MAX_IMAGE_BYTES,
    MAX_IMAGE_PIXELS,
    MAX_PROBLEM_LENGTH,
    MAX_RETRIES,
    MAX_VARIABLES,
)
from models import (
    CircuitAnalysis,
    CircuitImageRequest,
    ProblemRequest,
    TimingDiagramAnalysis,
    TimingDiagramRequest,
)
from parser import parse_explicit_minterms

# ============================================================
# INITIALIZATION
# ============================================================

load_dotenv()

app = FastAPI(
    title="Boolean Logic AI Backend",
    description=(
        "Converts digital-logic problems and circuit images into "
        "structured Boolean problems with deterministic verification."
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
# TEXT BOOLEAN SOLVER
# ============================================================

@app.post("/api/solve-boolean")
def solve_boolean(req: ProblemRequest):
    """Solve a Boolean problem from natural language or explicit minterms."""

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

        if len(variables) > MAX_VARIABLES:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum supported variables is {MAX_VARIABLES}.",
            )

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

        try:
            result = call_gemini(client, prompt)
        except json.JSONDecodeError:
            last_error = "Gemini returned invalid JSON."
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)
        except TimeoutError as e:
            last_error = (
                f"Gemini request timed out after {MAX_RETRIES + 1} attempts: {e}"
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=504, detail=last_error)
        except Exception as e:
            last_error = f"Gemini call failed: {e}"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        variables = result.get("variables") or []
        expression = result.get("expression")
        dont_care_conditions = result.get("dont_care_conditions") or []
        raw_descriptions = result.get("variable_descriptions") or []

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
                f"Too many don't-care conditions ({len(dont_care_conditions)}). "
                f"Maximum is {MAX_DONT_CARE_CONDITIONS}."
            )
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        try:
            minterms = generate_minterms(variables, expression)
        except Exception as e:
            last_error = "Could not evaluate Boolean expression: " + str(e)
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

        try:
            dont_cares = generate_dont_cares(variables, dont_care_conditions)
        except Exception:
            dont_cares = []

        dont_cares = sorted(set(dont_cares))
        minterms = [m for m in minterms if m not in dont_cares]

        variable_descriptions = {}
        for item in raw_descriptions:
            if (
                isinstance(item, dict)
                and "letter" in item
                and "description" in item
            ):
                variable_descriptions[item["letter"]] = item["description"]

        return {
            "variables": variables,
            "num_variables": len(variables),
            "minterms": minterms,
            "dont_cares": dont_cares,
            "variable_descriptions": variable_descriptions,
            "expression": expression,
        }

    raise HTTPException(
        status_code=502,
        detail=(
            "The AI interpretation could not be mathematically verified. "
            "Please rephrase the problem or provide the Boolean "
            "conditions explicitly."
        ),
    )


# ============================================================
# CIRCUIT IMAGE ANALYZER
# ============================================================

CIRCUIT_IMAGE_PROMPT = """
You are an expert at reading DIGITAL LOGIC CIRCUIT DIAGRAMS.

Your job is ONLY to extract the circuit structure visible in the image.
Do NOT calculate minterms, truth tables, Karnaugh maps, SOP/POS, or a
Boolean expression. The Python backend will calculate those deterministically.

Supported logic gates:
AND, OR, NOT, NAND, NOR, XOR, XNOR, BUFFER

Return the circuit in the exact structured format requested by the API.

IMPORTANT RULES
================

1. Identify every visible primary input variable and preserve its visible
   label whenever possible.

2. Identify every visible output label. The output string should refer to
   the signal that reaches that output. When the final gate's output wire is
   visibly labelled F, use "F" as that gate's output signal.

3. For every gate, provide:
   - a unique id such as g1, g2, g3
   - the exact supported gate type
   - inputs in the order they enter the gate from top-to-bottom or
     left-to-right as appropriate
   - the output signal name. Use the visible wire label if one exists;
     otherwise create a unique internal signal such as n1, n2, n3.

4. A gate input may be either:
   - a primary input variable, or
   - the output signal of another gate.

5. Connections must describe visible input-to-gate wires using:
   from_signal, to_gate, to_port.
   Port numbering starts at 0.

6. Do NOT invent gates, variables, wires, or labels that are not supported
   by the image.

7. If a label cannot be read, do not invent a likely label. Use a unique
   internal signal name only where a signal identity is required by the
   circuit topology.

8. If the circuit is unclear or parts of the topology cannot be reliably
   determined, lower the confidence score.

9. The circuit is assumed to be combinational. If the image clearly contains
   feedback or sequential logic, lower confidence substantially.

10. Do not infer a wire connection merely because it would make the circuit
    logically convenient. Follow the visible topology.
"""


def _extract_image_bytes(data_url: str) -> bytes:
    """Extract and validate raw bytes from a base64 data URL or raw base64."""

    if not data_url or not data_url.strip():
        raise ValueError("Image data is empty.")

    if "," in data_url:
        header, b64data = data_url.split(",", 1)
        if not header.startswith("data:") or ";base64" not in header.lower():
            raise ValueError("Invalid image data URL.")
    else:
        b64data = data_url

    b64data = re.sub(r"\s+", "", b64data)

    try:
        decoded = base64.b64decode(b64data, validate=True)
    except (binascii.Error, ValueError) as e:
        raise ValueError("Invalid base64 image data.") from e

    if not decoded:
        raise ValueError("Image data is empty.")

    if len(decoded) > MAX_IMAGE_BYTES:
        raise ValueError(
            f"Image is too large. Maximum size is {MAX_IMAGE_BYTES // (1024 * 1024)} MB."
        )

    return decoded


def _validate_declared_image_mime_type(data_url: str) -> None:
    """Reject unsupported MIME types declared by a data URL.

    The declared type is only a client hint.  The actual type sent to Gemini
    is determined from the decoded image bytes below.
    """

    allowed = {
        "image/png",
        "image/jpeg",
        "image/webp",
    }

    if not data_url.startswith("data:"):
        return

    header = data_url.split(",", 1)[0]
    match = re.match(r"^data:(image/[A-Za-z0-9.+-]+);base64$", header)
    if not match:
        raise ValueError("Invalid image MIME type in data URL.")

    mime = match.group(1).lower()
    if mime not in allowed:
        raise ValueError(
            f"Unsupported image type '{mime}'. "
            "Use PNG, JPEG, or WebP."
        )


def _validate_image_bytes(image_bytes: bytes) -> str:
    """Verify an image and return its MIME type determined from its bytes."""

    try:
        with Image.open(BytesIO(image_bytes)) as image:
            mime_types = {
                "PNG": "image/png",
                "JPEG": "image/jpeg",
                "WEBP": "image/webp",
            }
            mime_type = mime_types.get(image.format or "")
            if mime_type is None:
                raise ValueError(
                    f"Unsupported image format '{image.format}'. "
                    "Use PNG, JPEG, or WebP."
                )

            width, height = image.size
            if width <= 0 or height <= 0:
                raise ValueError("Image has invalid dimensions.")

            if width * height > MAX_IMAGE_PIXELS:
                raise ValueError(
                    "Image resolution is too large. Please upload a smaller image."
                )

            image.verify()
            return mime_type
    except ValueError:
        raise
    except Exception as e:
        raise ValueError("Uploaded bytes are not a valid image.") from e


def _analyze_circuit_with_gemini(
    image_bytes: bytes,
    mime_type: str,
    retry_error: str = "",
) -> CircuitAnalysis:
    """Ask Gemini for a structured circuit description only."""

    prompt = CIRCUIT_IMAGE_PROMPT
    if retry_error:
        prompt += f"""

PREVIOUS ATTEMPT FAILED STRUCTURAL VALIDATION:
{retry_error}

Re-examine the image carefully and correct only the structural problem.
Use only information visibly supported by the image.
"""

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            genai_types.Content(
                role="user",
                parts=[
                    genai_types.Part.from_text(text=prompt),
                    genai_types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                ],
            )
        ],
        config=genai_types.GenerateContentConfig(
            http_options=genai_types.HttpOptions(
                timeout=GEMINI_TIMEOUT_SECONDS * 1000,
            ),
            response_mime_type="application/json",
            response_schema=CircuitAnalysis,
            thinking_config=genai_types.ThinkingConfig(
                thinking_level="MINIMAL"
            ),
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response.")

    # With Pydantic structured output, validate the returned JSON against
    # exactly the same schema we requested.
    try:
        return CircuitAnalysis.model_validate_json(response.text)
    except Exception as e:
        raise ValueError(f"Gemini returned invalid circuit structure: {e}") from e


@app.post("/api/analyze-circuit-image")
def analyze_circuit_image(req: CircuitImageRequest):
    """Analyze a combinational logic circuit image.

    Gemini performs visual recognition only. Boolean expressions and
    minterms are generated by the deterministic backend.
    """

    try:
        image_bytes = _extract_image_bytes(req.image)
        _validate_declared_image_mime_type(req.image)
        mime_type = _validate_image_bytes(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    last_error = ""

    for attempt in range(1 + MAX_RETRIES):
        try:
            circuit = _analyze_circuit_with_gemini(
                image_bytes=image_bytes,
                mime_type=mime_type,
                retry_error=last_error,
            )

            # Normalize variable names exactly as returned. The generic
            # validator from ai_solver.py supports letters/digits/underscore.
            validate_variables(circuit.variables)

            validate_circuit(
                circuit,
                max_variables=MAX_VARIABLES,
            )

            expressions = circuit_to_expressions(circuit)

            output_results = {}
            for output_name, expression in expressions.items():
                if len(expression) > MAX_EXPRESSION_LENGTH:
                    raise CircuitValidationError(
                        f"Generated expression for '{output_name}' is too long."
                    )

                minterms = generate_minterms(
                    circuit.variables,
                    expression,
                )

                output_results[output_name] = {
                    "expression": expression,
                    "minterms": minterms,
                }

            primary_output = circuit.outputs[0]
            primary_result = output_results[primary_output]

            return {
                "success": True,
                "type": "circuit",
                "variables": circuit.variables,
                "num_variables": len(circuit.variables),
                "outputs": circuit.outputs,
                "gates": [gate.model_dump() for gate in circuit.gates],
                "connections": [
                    connection.model_dump()
                    for connection in circuit.connections
                ],
                "expression": primary_result["expression"],
                "booleanExpression": primary_result["expression"],
                "minterms": primary_result["minterms"],
                "dont_cares": [],
                "confidence": circuit.confidence,
                "output_results": output_results,
            }

        except CircuitValidationError as e:
            last_error = str(e)
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Circuit structure could not be validated.",
                    "reason": last_error,
                },
            )
        except TimeoutError as e:
            last_error = f"Gemini request timed out: {e}"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=504, detail=last_error)
        except ValueError as e:
            last_error = str(e)
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)
        except Exception as e:
            last_error = f"Circuit image analysis failed: {e}"
            if attempt < MAX_RETRIES:
                continue
            raise HTTPException(status_code=502, detail=last_error)

    raise HTTPException(
        status_code=502,
        detail="Could not analyze the circuit image after multiple attempts.",
    )


# ============================================================
# HEALTH CHECK
# ============================================================

# ============================================================
# TIMING DIAGRAM ANALYZER
# ============================================================

TIMING_DIAGRAM_PROMPT = """
You are an expert at reading DIGITAL TIMING DIAGRAMS.

Your job is to extract the signal waveforms visible in the timing diagram image.

For each signal, identify:
1. The signal name (label) as shown in the diagram.
2. Whether it is an input or output signal.
3. The logic level (0 or 1) at each time step.

Time steps should be identified by vertical grid lines, clock edges, or
visible transitions. Sample the logic level at each distinct time interval.

RULES:
- Preserve signal names exactly as labeled.
- If a signal is not labeled, use a generic name like "SIG1", "SIG2".
- If you cannot determine a logic level, default to 0.
- The output signals are typically below or to the right of input signals.
- If the diagram is unclear, lower the confidence score.
- Return 2 to 128 time steps depending on what the diagram shows.
- All values must be 0 or 1 (no don't-cares in waveforms).
"""


def _analyze_timing_with_gemini(
    image_bytes: bytes,
    mime_type: str,
) -> TimingDiagramAnalysis:
    """Ask Gemini for a structured timing diagram description."""

    response = client.models.generate_content(
        model=MODEL,
        contents=[
            genai_types.Content(
                role="user",
                parts=[
                    genai_types.Part.from_text(text=TIMING_DIAGRAM_PROMPT),
                    genai_types.Part.from_bytes(
                        data=image_bytes,
                        mime_type=mime_type,
                    ),
                ],
            )
        ],
        config=genai_types.GenerateContentConfig(
            http_options=genai_types.HttpOptions(
                timeout=GEMINI_TIMEOUT_SECONDS * 1000,
            ),
            response_mime_type="application/json",
            response_schema=TimingDiagramAnalysis,
            thinking_config=genai_types.ThinkingConfig(
                thinking_level="MINIMAL"
            ),
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response.")

    try:
        return TimingDiagramAnalysis.model_validate_json(response.text)
    except Exception as e:
        raise ValueError(f"Gemini returned invalid timing data: {e}") from e


@app.post("/api/analyze-timing-diagram")
def analyze_timing_diagram(req: TimingDiagramRequest):
    """Analyze a timing diagram image and extract waveforms."""

    try:
        image_bytes = _extract_image_bytes(req.image)
        _validate_declared_image_mime_type(req.image)
        mime_type = _validate_image_bytes(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        result = _analyze_timing_with_gemini(image_bytes, mime_type)

        if not result.signals:
            raise HTTPException(
                status_code=422,
                detail="No signals could be extracted from the timing diagram.",
            )

        return {
            "success": True,
            "signals": [
                {
                    "name": sig.name,
                    "values": sig.values,
                    "is_output": sig.is_output,
                }
                for sig in result.signals
            ],
            "time_steps": result.time_steps,
            "confidence": result.confidence,
        }
    except TimeoutError as e:
        raise HTTPException(status_code=504, detail=f"Gemini request timed out: {e}")
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Timing diagram analysis failed: {e}")


@app.get("/")
def root():
    """Health check endpoint."""

    return {
        "status": "online",
        "service": "Boolean Logic AI Backend",
    }
