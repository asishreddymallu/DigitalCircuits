# ============================================================
# Boolean Logic AI Backend
#
# Install:
# pip install fastapi uvicorn google-genai python-dotenv
#
# Run:
# uvicorn boolean_solver_backend:app --reload
#
# API:
# POST /api/solve-boolean
# ============================================================

import ast
import json
import os
import re

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google import genai
from google.genai import types

from dotenv import load_dotenv


# ============================================================
# INITIALIZATION
# ============================================================

load_dotenv()

app = FastAPI()


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

MODEL = "gemini-3.5-flash-lite"


# ============================================================
# REQUEST MODEL
# ============================================================

class ProblemRequest(BaseModel):
    problem_statement: str


# ============================================================
# DIRECT MINTERM PARSER
# ============================================================

def parse_explicit_minterms(problem_statement: str):
    """
    Detect whether the user has already supplied minterms.

    Examples supported:

        F(A,B,C,D) = Σm(1,3,5,7)

        F(A,B,C,D) = ∑m(1,3,5,7)

        F(A,B,C,D) = Σ m(1,3,5,7)

        F(A,B,C,D) = sum m(1,3,5,7)

    With don't-cares:

        d(A,B,C,D) = Σd(2,6)

        d(A,B,C,D) = ∑d(2,6)

    If explicit minterms are found, Gemini is NOT called.
    """

    text = problem_statement.strip()

    # --------------------------------------------------------
    # Find the main function variable list.
    #
    # Example:
    #
    # F(C,B,K,S,E)
    #
    # gives:
    #
    # ["C", "B", "K", "S", "E"]
    # --------------------------------------------------------

    variable_match = re.search(
        r"(?:^|\n)\s*[Ff]\s*\(\s*"
        r"([A-Za-z][A-Za-z0-9_]*(?:\s*,\s*"
        r"[A-Za-z][A-Za-z0-9_]*)*)"
        r"\s*\)",
        text
    )

    # If the above doesn't find it, try anywhere in the text.
    if not variable_match:

        variable_match = re.search(
            r"[Ff]\s*\(\s*"
            r"([A-Za-z][A-Za-z0-9_]*(?:\s*,\s*"
            r"[A-Za-z][A-Za-z0-9_]*)*)"
            r"\s*\)",
            text
        )

    if not variable_match:
        return None

    variables = [
        variable.strip()
        for variable in variable_match.group(1).split(",")
    ]

    # --------------------------------------------------------
    # Find Σm / ∑m / Σ m / ∑ m / sum m
    #
    # Example:
    #
    # Σm(12,16,18)
    # --------------------------------------------------------

    minterm_match = re.search(
        r"(?:Σ|∑)\s*m\s*"
        r"\(\s*([0-9,\s]+)\s*\)",
        text,
        flags=re.IGNORECASE
    )

    # Also support ASCII:
    #
    # sum m(1,2,3)

    if not minterm_match:

        minterm_match = re.search(
            r"\bsum\s*m\s*"
            r"\(\s*([0-9,\s]+)\s*\)",
            text,
            flags=re.IGNORECASE
        )

    # No explicit minterms means this is probably a word problem.
    if not minterm_match:
        return None

    minterms = [
        int(value.strip())
        for value in minterm_match.group(1).split(",")
        if value.strip()
    ]

    # --------------------------------------------------------
    # Find don't-care terms.
    #
    # Examples:
    #
    # Σd(13,17,21)
    # ∑d(13,17,21)
    # Σ d(13,17,21)
    # --------------------------------------------------------

    dont_care_match = re.search(
        r"(?:Σ|∑)\s*d\s*"
        r"\(\s*([0-9,\s]+)\s*\)",
        text,
        flags=re.IGNORECASE
    )

    # Also support:
    #
    # sum d(1,2,3)

    if not dont_care_match:

        dont_care_match = re.search(
            r"\bsum\s*d\s*"
            r"\(\s*([0-9,\s]+)\s*\)",
            text,
            flags=re.IGNORECASE
        )

    if dont_care_match:

        dont_cares = [
            int(value.strip())
            for value in dont_care_match.group(1).split(",")
            if value.strip()
        ]

    else:

        dont_cares = []

    # --------------------------------------------------------
    # Validate indices.
    # --------------------------------------------------------

    number_of_variables = len(variables)

    max_index = (2 ** number_of_variables) - 1

    invalid_minterms = [
        value
        for value in minterms
        if value < 0 or value > max_index
    ]

    invalid_dont_cares = [
        value
        for value in dont_cares
        if value < 0 or value > max_index
    ]

    if invalid_minterms:

        raise ValueError(
            f"Minterm index out of range: {invalid_minterms}. "
            f"For {number_of_variables} variables, valid "
            f"indices are 0 to {max_index}."
        )

    if invalid_dont_cares:

        raise ValueError(
            f"Don't-care index out of range: "
            f"{invalid_dont_cares}. "
            f"For {number_of_variables} variables, valid "
            f"indices are 0 to {max_index}."
        )

    # --------------------------------------------------------
    # Remove duplicates and sort.
    # --------------------------------------------------------

    minterms = sorted(set(minterms))

    dont_cares = sorted(set(dont_cares))

    # A value cannot be both a minterm and a don't-care.
    dont_cares = [
        value
        for value in dont_cares
        if value not in minterms
    ]

    # --------------------------------------------------------
    # Return direct result.
    # --------------------------------------------------------

    return {
        "variables": variables,
        "minterms": minterms,
        "dont_cares": dont_cares
    }


# ============================================================
# BUILD GEMINI PROMPT
# ============================================================

def build_prompt(problem_statement: str) -> str:

    return f"""
You are an expert Digital Logic Design and Boolean Algebra engine.

Convert the natural-language problem below into ONE EXACT Boolean
expression representing exactly when the output is 1.

The expression will be evaluated by Python for every possible input
combination to generate the minterms. Therefore, correctness of the
English interpretation is more important than making the expression
short.

IMPORTANT:
Do not overfit to any example in these instructions.
Examples are only explanations of how to reason about language.
They are NOT rules about the actual problem.

============================================================
1. IDENTIFY VARIABLES
============================================================

If the problem explicitly provides variable names, preserve them exactly.

Use the order in which the variables are introduced as the variable
order for minterm numbering.

The first variable is the MSB.
The last variable is the LSB.

If variable names are not explicitly provided, assign A, B, C, D, ...
in order of introduction.

============================================================
2. TRANSLATE EACH REQUIREMENT
============================================================

Read the problem literally and translate each numbered or separate
requirement independently before combining anything.

Pay attention to logical words such as:

- and
- or
- either
- both
- at least
- at most
- exactly
- only if
- only when
- provided
- unless
- regardless of
- irrespective of
- suppress
- override
- disable
- except
- still
- during
- while
- if
- when

Do not invent requirements that are not stated.

============================================================
3. CONDITIONAL REQUIREMENTS
============================================================

A later condition can restrict, modify, or replace a general condition
under a particular circumstance.

Do NOT simply OR every sentence together.

When a requirement says that one rule changes when another input or
condition is active, split the cases and apply the correct rule to
each case.

Generic example:

"At least two of A, B and C are required, but when D is active,
all three are required."

Interpret it as:

D = 0:
    (A AND B) OR (A AND C) OR (B AND C)

D = 1:
    A AND B AND C

Therefore:

((NOT D) AND ((A AND B) OR (A AND C) OR (B AND C)))
OR
(D AND A AND B AND C)

This is ONLY an example of conditional reasoning.
Do not assume A, B, C, D or these rules exist in the actual problem.

============================================================
4. CASE ANALYSIS
============================================================

For complicated wording, internally divide the problem into the
relevant cases.

For example, a condition may depend on:

- a mode being active/inactive
- a signal being high/low
- a special condition being present/absent
- an override being active/inactive

Determine the output condition for each relevant case and combine
those cases.

Only create cases that are actually required by the wording.
Do not invent unnecessary cases.

============================================================
5. OVERRIDES, SUPPRESSION AND EXCEPTIONS
============================================================

If the problem says that an override or mode suppresses something,
determine exactly which condition it suppresses.

Do NOT automatically apply the suppression to the entire output.

If the problem contains an exception such as:

"X suppresses A, but must not suppress B"

then preserve B independently of X.

Likewise, words such as "still", "except", "but", "however",
"regardless", and "irrespective" can indicate that a previous rule
has an exception.

============================================================
6. COUNTING CONDITIONS
============================================================

Translate counting phrases carefully.

"At least two of A, B, C":

(A AND B) OR (A AND C) OR (B AND C)

"Exactly two of A, B, C":

(A AND B AND NOT C)
OR
(A AND NOT B AND C)
OR
(NOT A AND B AND C)

"All three":

A AND B AND C

"At least one":

A OR B OR C

Do not confuse "at least" with "exactly".

============================================================
7. VARIABLE MEANINGS AND NEGATION
============================================================

Respect the meaning assigned to every variable.

If:

T = temperature is high

then:

T     = temperature is high
NOT T = temperature is not high

If:

M = maintenance mode is active

then:

M     = maintenance mode is active
NOT M = maintenance mode is inactive

Do not silently reverse or reinterpret variable meanings.

============================================================
8. COMBINE THE RULES
============================================================

After translating the individual requirements and resolving all
conditions, construct ONE Boolean expression for the output.

The expression must describe the complete truth condition.

Do not minimize it.

Do not calculate minterms yourself.

Do not use Quine-McCluskey.

Do not use Karnaugh maps.

Python will evaluate the expression for all input combinations.

============================================================
9. SELF-CHECK
============================================================

Before returning the expression, check it against the original
English problem.

Verify:

1. Every activation condition is represented.
2. Every restriction is enforced.
3. Conditional rules apply only in their stated cases.
4. Overrides affect only what they are stated to suppress.
5. Explicit exceptions are preserved.
6. No unstated assumptions were introduced.
7. No valid condition was omitted.
8. The variable names and variable order are correct.

For complicated problems, mentally test representative combinations,
especially boundary cases where two or more rules overlap.

============================================================
10. DON'T-CARE CONDITIONS
============================================================

Only return don't-care conditions if the problem explicitly states
that certain combinations are impossible, unused, irrelevant, or
don't-care.

Otherwise return an empty list.

============================================================
11. OUTPUT FORMAT
============================================================

Return ONLY valid JSON.

Use exactly this structure:

{{
    "variables": ["A", "B", "C"],
    "expression": "((A AND B) OR C)",
    "dont_care_conditions": [],
    "variable_descriptions": [
        {{
            "letter": "A",
            "description": "short description"
        }},
        {{
            "letter": "B",
            "description": "short description"
        }},
        {{
            "letter": "C",
            "description": "short description"
        }}
    ]
}}

Do not return Markdown.
Do not return explanations outside the JSON.

============================================================
PROBLEM TO SOLVE
============================================================

{problem_statement.strip()}
"""


# ============================================================
# CALL GEMINI
# ============================================================

def call_gemini(prompt: str) -> dict:

    config = types.GenerateContentConfig(

        thinking_config=types.ThinkingConfig(
            thinking_level="MINIMAL"
        ),

        response_mime_type="application/json",

        response_schema=genai.types.Schema(
            type=genai.types.Type.OBJECT,

            properties={

                "variables": genai.types.Schema(
                    type=genai.types.Type.ARRAY,

                    items=genai.types.Schema(
                        type=genai.types.Type.STRING
                    )
                ),

                "expression": genai.types.Schema(
                    type=genai.types.Type.STRING
                ),

                "dont_care_conditions": genai.types.Schema(
                    type=genai.types.Type.ARRAY,

                    items=genai.types.Schema(
                        type=genai.types.Type.STRING
                    )
                ),

                "variable_descriptions": genai.types.Schema(
                    type=genai.types.Type.ARRAY,

                    items=genai.types.Schema(
                        type=genai.types.Type.OBJECT,

                        properties={

                            "letter": genai.types.Schema(
                                type=genai.types.Type.STRING
                            ),

                            "description": genai.types.Schema(
                                type=genai.types.Type.STRING
                            )
                        },

                        required=[
                            "letter",
                            "description"
                        ]
                    )
                )
            },

            required=[
                "variables",
                "expression",
                "dont_care_conditions",
                "variable_descriptions"
            ]
        )
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config
    )

    if not response.text:

        raise ValueError(
            "Gemini returned an empty response."
        )

    return json.loads(response.text)


# ============================================================
# NORMALIZE BOOLEAN EXPRESSION
# ============================================================

def normalize_expression(expression: str) -> str:

    expression = expression.strip()

    # Convert Boolean operators to Python operators.

    expression = re.sub(
        r"\bAND\b",
        " and ",
        expression,
        flags=re.IGNORECASE
    )

    expression = re.sub(
        r"\bOR\b",
        " or ",
        expression,
        flags=re.IGNORECASE
    )

    expression = re.sub(
        r"\bNOT\b",
        " not ",
        expression,
        flags=re.IGNORECASE
    )

    return expression


# ============================================================
# SAFE BOOLEAN EXPRESSION EVALUATOR
# ============================================================

def evaluate_boolean_expression(
    expression: str,
    variables: list[str],
    values: dict[str, int]
) -> int:

    expression = normalize_expression(
        expression
    )

    try:

        tree = ast.parse(
            expression,
            mode="eval"
        )

    except SyntaxError as e:

        raise ValueError(
            f"Invalid Boolean expression: {expression}"
        ) from e

    def evaluate(node):

        # ----------------------------------------------------
        # Root
        # ----------------------------------------------------

        if isinstance(
            node,
            ast.Expression
        ):

            return evaluate(
                node.body
            )

        # ----------------------------------------------------
        # Variable
        # ----------------------------------------------------

        if isinstance(
            node,
            ast.Name
        ):

            if node.id not in values:

                raise ValueError(
                    f"Unknown variable '{node.id}' "
                    f"in expression."
                )

            return bool(
                values[node.id]
            )

        # ----------------------------------------------------
        # AND
        # ----------------------------------------------------

        if (
            isinstance(node, ast.BoolOp)
            and isinstance(node.op, ast.And)
        ):

            return all(
                evaluate(value)
                for value in node.values
            )

        # ----------------------------------------------------
        # OR
        # ----------------------------------------------------

        if (
            isinstance(node, ast.BoolOp)
            and isinstance(node.op, ast.Or)
        ):

            return any(
                evaluate(value)
                for value in node.values
            )

        # ----------------------------------------------------
        # NOT
        # ----------------------------------------------------

        if (
            isinstance(node, ast.UnaryOp)
            and isinstance(node.op, ast.Not)
        ):

            return not evaluate(
                node.operand
            )

        # ----------------------------------------------------
        # Unsupported
        # ----------------------------------------------------

        raise ValueError(
            "Unsupported component in Boolean "
            "expression: "
            + ast.dump(node)
        )

    return int(
        evaluate(tree)
    )


# ============================================================
# GENERATE MINTERMS
# ============================================================

def generate_minterms(
    variables: list[str],
    expression: str
) -> list[int]:

    minterms = []

    number_of_variables = len(
        variables
    )

    # --------------------------------------------------------
    # Check every possible combination.
    #
    # n variables -> 2^n combinations
    # --------------------------------------------------------

    for index in range(
        2 ** number_of_variables
    ):

        values = {}

        # ----------------------------------------------------
        # Convert decimal index into bits.
        #
        # The FIRST variable is MSB.
        #
        # Example:
        #
        # variables = [C, B, K, S, E]
        #
        # index = 14
        #
        # binary = 01110
        #
        # C = 0
        # B = 1
        # K = 1
        # S = 1
        # E = 0
        # ----------------------------------------------------

        for position, variable in enumerate(
            variables
        ):

            bit_position = (
                number_of_variables
                - 1
                - position
            )

            bit = (
                index >> bit_position
            ) & 1

            values[variable] = bit

        # ----------------------------------------------------
        # Evaluate expression.
        # ----------------------------------------------------

        output = evaluate_boolean_expression(
            expression,
            variables,
            values
        )

        if output == 1:

            minterms.append(
                index
            )

    return minterms


# ============================================================
# GENERATE DON'T-CARE INDICES
# ============================================================

def generate_dont_cares(
    variables: list[str],
    conditions: list[str]
) -> list[int]:

    if not conditions:
        return []

    dont_cares = []

    number_of_variables = len(
        variables
    )

    for condition in conditions:

        if not condition.strip():
            continue

        for index in range(
            2 ** number_of_variables
        ):

            values = {}

            for position, variable in enumerate(
                variables
            ):

                bit_position = (
                    number_of_variables
                    - 1
                    - position
                )

                bit = (
                    index >> bit_position
                ) & 1

                values[variable] = bit

            try:

                output = evaluate_boolean_expression(
                    condition,
                    variables,
                    values
                )

                if output == 1:

                    dont_cares.append(
                        index
                    )

            except Exception:

                continue

    return sorted(
        set(dont_cares)
    )


# ============================================================
# VALIDATE VARIABLES
# ============================================================

def validate_variables(
    variables: list[str]
) -> None:

    if not variables:

        raise ValueError(
            "No variables were identified."
        )

    # --------------------------------------------------------
    # No duplicate variables.
    # --------------------------------------------------------

    if len(
        set(variables)
    ) != len(variables):

        raise ValueError(
            "Duplicate variables returned."
        )

    # --------------------------------------------------------
    # Valid variable names.
    #
    # Examples:
    #
    # A
    # B
    # F
    # X1
    # --------------------------------------------------------

    for variable in variables:

        if not re.fullmatch(
            r"[A-Za-z][A-Za-z0-9_]*",
            variable
        ):

            raise ValueError(
                f"Invalid variable name: "
                f"{variable}"
            )


# ============================================================
# API ENDPOINT
# ============================================================

@app.post("/api/solve-boolean")
def solve_boolean(
    req: ProblemRequest
):

    # ========================================================
    # VALIDATE INPUT
    # ========================================================

    if not req.problem_statement.strip():

        raise HTTPException(
            status_code=400,
            detail="problem_statement is required"
        )

    # ========================================================
    # PATH 1:
    #
    # USER ALREADY PROVIDED MINTERMS
    #
    # Example:
    #
    # F(C,B,K,S,E) = Σm(12,16,18,...)
    #
    # d(C,B,K,S,E) = Σd(13,17,...)
    #
    # DO NOT CALL GEMINI.
    # ========================================================

    try:

        explicit_result = (
            parse_explicit_minterms(
                req.problem_statement
            )
        )

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    if explicit_result is not None:

        variables = (
            explicit_result["variables"]
        )

        minterms = (
            explicit_result["minterms"]
        )

        dont_cares = (
            explicit_result["dont_cares"]
        )

        # No descriptions are necessary because
        # this is an explicit minterm input.

        variable_descriptions = {
            variable: ""
            for variable in variables
        }

        return {

            "variables": variables,

            "num_variables": len(
                variables
            ),

            "minterms": minterms,

            "dont_cares": dont_cares,

            "variable_descriptions":
                variable_descriptions,

            "expression": None
        }

    # ========================================================
    # PATH 2:
    #
    # NATURAL-LANGUAGE WORD PROBLEM
    #
    # Example:
    #
    # "A laboratory door opens when..."
    #
    # Send this to Gemini.
    # ========================================================

    prompt = build_prompt(
        req.problem_statement
    )

    try:

        result = call_gemini(
            prompt
        )

    except json.JSONDecodeError:

        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini returned invalid JSON."
            )
        )

    except Exception as e:

        raise HTTPException(
            status_code=502,
            detail=f"Gemini call failed: {e}"
        )

    # ========================================================
    # EXTRACT GEMINI RESULT
    # ========================================================

    variables = (
        result.get("variables")
        or []
    )

    expression = (
        result.get("expression")
    )

    dont_care_conditions = (
        result.get(
            "dont_care_conditions"
        )
        or []
    )

    raw_descriptions = (
        result.get(
            "variable_descriptions"
        )
        or []
    )

    # ========================================================
    # VALIDATE GEMINI VARIABLES
    # ========================================================

    try:

        validate_variables(
            variables
        )

    except ValueError as e:

        raise HTTPException(
            status_code=502,
            detail=str(e)
        )

    if not expression:

        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini did not return "
                "a Boolean expression."
            )
        )

    # ========================================================
    # CALCULATE MINTERMS WITH PYTHON
    # ========================================================

    try:

        minterms = generate_minterms(
            variables,
            expression
        )

    except Exception as e:

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not evaluate "
                "Boolean expression: "
                + str(e)
            )
        )

    # ========================================================
    # CALCULATE DON'T-CARES
    # ========================================================

    try:

        dont_cares = (
            generate_dont_cares(
                variables,
                dont_care_conditions
            )
        )

    except Exception:

        dont_cares = []

    # ========================================================
    # DON'T-CARE VALUES MUST NOT ALSO BE MINTERMS
    # ========================================================

    dont_cares = sorted(
        set(dont_cares)
    )

    minterms = [
        m
        for m in minterms
        if m not in dont_cares
    ]

    # ========================================================
    # VARIABLE DESCRIPTIONS
    # ========================================================

    variable_descriptions = {}

    for item in raw_descriptions:

        if (
            isinstance(item, dict)
            and "letter" in item
            and "description" in item
        ):

            variable_descriptions[
                item["letter"]
            ] = item["description"]

    # ========================================================
    # RETURN RESULT TO FRONTEND
    # ========================================================

    return {

        "variables": variables,

        "num_variables": len(
            variables
        ),

        "minterms": minterms,

        "dont_cares": dont_cares,

        "variable_descriptions":
            variable_descriptions,

        # Useful for debugging and optionally
        # displaying the AI-derived expression.
        "expression": expression
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "Boolean Logic AI Backend"
    }