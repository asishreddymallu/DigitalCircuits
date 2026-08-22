# ============================================================
# Boolean Logic AI Backend - Improved Version
#
# Install:
#   pip install fastapi uvicorn google-genai python-dotenv
#
# Run:
#   uvicorn backend:app --reload
#
# API:
#   POST /api/solve-boolean
# ============================================================

import ast
import json
import os
import re
from typing import Any

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

app = FastAPI(
    title="Boolean Logic AI Backend",
    version="2.0"
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

# Gemini 3.7 Flash is currently Google's latest Flash model
# for complex reasoning / multi-step tasks.
MODEL = "gemini-3.7-flash"

# Your website currently works comfortably with small
# digital-logic problems.
MAX_VARIABLES = 6

ALLOWED_VARIABLES = ["A", "B", "C", "D", "E", "F"]


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
    Detect whether the user directly supplied minterms.

    Supported examples:

        F(A,B,C,D) = Σm(1,3,5,7)
        F(A,B,C,D) = ∑m(1,3,5,7)
        F(A,B,C,D) = Σ m(1,3,5,7)
        F(A,B,C,D) = sum m(1,3,5,7)

    Don't-care examples:

        F(A,B,C,D) = Σm(1,3,5) + Σd(2,6)
        d(A,B,C,D) = Σd(2,6)

    If explicit minterms are found, Gemini is NOT called.
    """

    text = problem_statement.strip()

    # --------------------------------------------------------
    # Find variable list.
    #
    # Prefer:
    #   F(A,B,C,D)
    #
    # Fallback:
    #   d(A,B,C,D)
    #
    # The latter is useful for problems written only in
    # terms of don't-care notation.
    # --------------------------------------------------------

    variable_match = re.search(
        r"(?:^|\n)\s*[Ff]\s*\(\s*"
        r"([A-Za-z][A-Za-z0-9_]*(?:\s*,\s*"
        r"[A-Za-z][A-Za-z0-9_]*)*)"
        r"\s*\)",
        text
    )

    if not variable_match:

        variable_match = re.search(
            r"[Ff]\s*\(\s*"
            r"([A-Za-z][A-Za-z0-9_]*(?:\s*,\s*"
            r"[A-Za-z][A-Za-z0-9_]*)*)"
            r"\s*\)",
            text
        )

    # Fallback for:
    # d(A,B,C,D) = Σd(...)
    if not variable_match:

        variable_match = re.search(
            r"(?:^|\n)\s*[Dd]\s*\(\s*"
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
    # --------------------------------------------------------

    minterm_match = re.search(
        r"(?:Σ|∑)\s*m\s*"
        r"\(\s*([0-9,\s]+)\s*\)",
        text,
        flags=re.IGNORECASE
    )

    if not minterm_match:

        minterm_match = re.search(
            r"\bsum\s*m\s*"
            r"\(\s*([0-9,\s]+)\s*\)",
            text,
            flags=re.IGNORECASE
        )

    if not minterm_match:

        # Another common form:
        #
        # m(1,3,5,7)
        #
        minterm_match = re.search(
            r"\bm\s*"
            r"\(\s*([0-9,\s]+)\s*\)",
            text,
            flags=re.IGNORECASE
        )

    # No explicit minterms -> natural-language problem.
    if not minterm_match:
        return None

    minterms = [
        int(value.strip())
        for value in minterm_match.group(1).split(",")
        if value.strip()
    ]

    # --------------------------------------------------------
    # Find don't-care terms.
    # --------------------------------------------------------

    dont_care_match = re.search(
        r"(?:Σ|∑)\s*d\s*"
        r"\(\s*([0-9,\s]+)\s*\)",
        text,
        flags=re.IGNORECASE
    )

    if not dont_care_match:

        dont_care_match = re.search(
            r"\bsum\s*d\s*"
            r"\(\s*([0-9,\s]+)\s*\)",
            text,
            flags=re.IGNORECASE
        )

    if not dont_care_match:

        dont_care_match = re.search(
            r"\bd\s*"
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
    # Validate variable count.
    # --------------------------------------------------------

    number_of_variables = len(variables)

    if number_of_variables == 0:

        raise ValueError(
            "No variables were identified."
        )

    if number_of_variables > MAX_VARIABLES:

        raise ValueError(
            f"Maximum supported variables: "
            f"{MAX_VARIABLES}."
        )

    # --------------------------------------------------------
    # Validate minterm range.
    # --------------------------------------------------------

    max_index = (
        2 ** number_of_variables
    ) - 1

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
            f"Minterm index out of range: "
            f"{invalid_minterms}. "
            f"For {number_of_variables} variables, "
            f"valid indices are 0 to {max_index}."
        )

    if invalid_dont_cares:

        raise ValueError(
            f"Don't-care index out of range: "
            f"{invalid_dont_cares}. "
            f"For {number_of_variables} variables, "
            f"valid indices are 0 to {max_index}."
        )

    # --------------------------------------------------------
    # Remove duplicates.
    # --------------------------------------------------------

    minterms = sorted(set(minterms))

    dont_cares = sorted(set(dont_cares))

    # A value cannot be both minterm and don't-care.
    dont_cares = [
        value
        for value in dont_cares
        if value not in minterms
    ]

    return {
        "variables": variables,
        "minterms": minterms,
        "dont_cares": dont_cares
    }


# ============================================================
# BUILD PRIMARY GEMINI PROMPT
# ============================================================

def build_prompt(problem_statement: str) -> str:

    return f"""
You are an expert Digital Logic Design and Boolean Algebra engine.

Your job is to translate the natural-language digital logic problem
below into ONE EXACT Boolean expression representing exactly when
the output is 1.

The Boolean expression will be evaluated exhaustively by Python over
all possible input combinations.

Therefore:

SEMANTIC CORRECTNESS IS MORE IMPORTANT THAN SIMPLIFICATION.

============================================================
1. VARIABLES
============================================================

IMPORTANT:

Use ONLY single uppercase-letter variables:

A, B, C, D, E, F

Do NOT use multi-character variables.

Example:

Good:
A = card is valid
B = PIN is correct
C = emergency mode is active

Bad:
CARD
PIN
MODE
VALID_CARD

Assign variables in the exact order in which concepts/signals are
introduced in the problem.

The first variable is the MSB.
The last variable is the LSB.

Maximum number of variables is 6.

The variable_descriptions field must contain the meaning of each
letter.

============================================================
2. UNDERSTAND THE ENGLISH FIRST
============================================================

Before producing the expression, internally determine:

1. What each input means.
2. What conditions activate the output.
3. What conditions prevent the output.
4. What conditions modify another condition.
5. What exceptions are present.

Do NOT assume unstated behavior.

============================================================
3. CONDITIONAL LOGIC
============================================================

Pay special attention to:

- if
- only if
- only when
- unless
- provided
- except
- regardless of
- irrespective of
- but
- however
- still
- override
- suppress
- disable
- enable
- during
- while

Do NOT simply OR all sentences together.

If a later rule modifies an earlier rule, perform case analysis
internally and build the final expression accordingly.

============================================================
4. COUNTING
============================================================

"At least two of A, B, C":

(A AND B) OR (A AND C) OR (B AND C)

"Exactly two":

(A AND B AND NOT C)
OR
(A AND NOT B AND C)
OR
(NOT A AND B AND C)

"At least one":

A OR B OR C

"All":

A AND B AND C

Do not confuse "at least" and "exactly".

============================================================
5. OVERRIDES / SUPPRESSION
============================================================

If one signal suppresses another condition, apply suppression ONLY
where the wording specifies it.

Do not suppress unrelated conditions.

Words such as:

- except
- however
- but
- still
- regardless
- irrespective

often indicate that some previous rule remains active.

============================================================
6. DON'T-CARES
============================================================

Only return don't-care conditions if the problem explicitly states
that certain input combinations are:

- impossible
- unused
- irrelevant
- unspecified
- don't-care

Otherwise return:

[]

============================================================
7. EXPRESSION SYNTAX
============================================================

The expression MUST use only:

A
B
C
D
E
F

and:

AND
OR
NOT

Use explicit parentheses.

Examples:

(A AND B)

((A AND B) OR C)

((NOT A) AND (B OR C))

Do NOT use:

+
*
'
&
|
!

Do not minimize the expression.

Do not calculate minterms yourself.

============================================================
8. SELF-CHECK
============================================================

Before returning your result, mentally test boundary cases.

Specifically check:

1. Every activation condition.
2. Every restriction.
3. Every exception.
4. Every override.
5. Every conditional rule.
6. At least/exactly distinctions.
7. Variable meanings.
8. Variable ordering.

============================================================
9. SEMANTIC TEST CASES
============================================================

Return 3 to 8 representative test cases.

These are NOT exhaustive truth-table rows.

They should focus on difficult or ambiguous boundary cases.

For each test case return:

- inputs
- expected_output
- reason

============================================================
10. OUTPUT
============================================================

Return ONLY valid JSON.

Use exactly:

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
    ],
    "test_cases": [
        {{
            "inputs": {{
                "A": 0,
                "B": 0,
                "C": 1
            }},
            "expected_output": 1,
            "reason": "C directly activates the output"
        }}
    ]
}}

No Markdown.
No explanation outside JSON.

============================================================
PROBLEM
============================================================

{problem_statement.strip()}
"""


# ============================================================
# BUILD VERIFICATION PROMPT
# ============================================================

def build_verification_prompt(
    problem_statement: str,
    candidate: dict
) -> str:

    candidate_json = json.dumps(
        candidate,
        indent=2
    )

    return f"""
You are a strict Digital Logic Design verifier.

You are given:

1. The original natural-language problem.
2. A candidate Boolean solution produced by another AI.

Your task is to determine whether the candidate exactly matches the
meaning of the original problem.

Do NOT accept a solution merely because it is internally consistent.

You must compare the candidate against the ORIGINAL ENGLISH.

============================================================
RULES
============================================================

Use only these variables:

A, B, C, D, E, F

The candidate must preserve the meaning of each variable.

Check carefully:

- conditions
- exceptions
- overrides
- suppression
- "unless"
- "only if"
- "only when"
- "at least"
- "exactly"
- "both"
- "either"
- "except"
- "regardless"
- "still"

Do not simplify unless necessary.

If the candidate is correct:

    correct = true

and:

    corrected_expression = ""

If it is incorrect:

    correct = false

and return a corrected expression.

The corrected expression must use only:

A B C D E F
AND OR NOT
parentheses

============================================================
OUTPUT
============================================================

Return ONLY JSON:

{{
    "correct": true,
    "reason": "short explanation",
    "corrected_expression": "",
    "corrected_variables": ["A", "B", "C"],
    "corrected_dont_care_conditions": []
}}

If a correction is needed, corrected_expression MUST contain the
correct Boolean expression.

============================================================
ORIGINAL PROBLEM
============================================================

{problem_statement.strip()}

============================================================
CANDIDATE SOLUTION
============================================================

{candidate_json}
"""


# ============================================================
# GEMINI PRIMARY CALL
# ============================================================

def call_gemini(prompt: str) -> dict:

    config = types.GenerateContentConfig(

        # High reasoning is deliberate here because the difficult
        # part of this application is semantic Boolean reasoning.
        thinking_config=types.ThinkingConfig(
            thinking_level="HIGH"
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
                ),

                "test_cases": genai.types.Schema(
                    type=genai.types.Type.ARRAY,

                    items=genai.types.Schema(
                        type=genai.types.Type.OBJECT,

                        properties={

                            "inputs": genai.types.Schema(
                                type=genai.types.Type.OBJECT,
                                additional_properties=genai.types.Schema(
                                    type=genai.types.Type.INTEGER
                                )
                            ),

                            "expected_output": genai.types.Schema(
                                type=genai.types.Type.INTEGER
                            ),

                            "reason": genai.types.Schema(
                                type=genai.types.Type.STRING
                            )
                        },

                        required=[
                            "inputs",
                            "expected_output",
                            "reason"
                        ]
                    )
                )
            },

            required=[
                "variables",
                "expression",
                "dont_care_conditions",
                "variable_descriptions",
                "test_cases"
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
# GEMINI VERIFICATION CALL
# ============================================================

def call_gemini_verifier(prompt: str) -> dict:

    config = types.GenerateContentConfig(

        thinking_config=types.ThinkingConfig(
            thinking_level="HIGH"
        ),

        response_mime_type="application/json",

        response_schema=genai.types.Schema(
            type=genai.types.Type.OBJECT,

            properties={

                "correct": genai.types.Schema(
                    type=genai.types.Type.BOOLEAN
                ),

                "reason": genai.types.Schema(
                    type=genai.types.Type.STRING
                ),

                "corrected_expression": genai.types.Schema(
                    type=genai.types.Type.STRING
                ),

                "corrected_variables": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING
                    )
                ),

                "corrected_dont_care_conditions": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.STRING
                    )
                )
            },

            required=[
                "correct",
                "reason",
                "corrected_expression",
                "corrected_variables",
                "corrected_dont_care_conditions"
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
            "Gemini verifier returned an empty response."
        )

    return json.loads(response.text)


# ============================================================
# NORMALIZE BOOLEAN EXPRESSION
# ============================================================

def normalize_expression(expression: str) -> str:

    expression = expression.strip()

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
# VALIDATE BOOLEAN EXPRESSION TOKENS
# ============================================================

def validate_expression_syntax(
    expression: str,
    variables: list[str]
) -> None:

    if not expression or not expression.strip():

        raise ValueError(
            "Empty Boolean expression."
        )

    # Only allow the exact intended syntax.
    allowed_pattern = re.compile(
        r"""
        ^
        [\s()A-Za-z]+
        $
        """,
        re.VERBOSE
    )

    if not allowed_pattern.fullmatch(expression):

        raise ValueError(
            "Expression contains unsupported characters."
        )

    # Extract words.
    words = re.findall(
        r"[A-Za-z]+",
        expression
    )

    allowed_words = {
        "AND",
        "OR",
        "NOT"
    }

    allowed_words.update(
        variables
    )

    for word in words:

        if word.upper() in {
            "AND",
            "OR",
            "NOT"
        }:
            continue

        if word not in variables:

            raise ValueError(
                f"Unknown token '{word}' in Boolean expression."
            )


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
                    f"Unknown variable '{node.id}'."
                )

            return bool(
                values[node.id]
            )

        # ----------------------------------------------------
        # AND / OR
        # ----------------------------------------------------

        if isinstance(
            node,
            ast.BoolOp
        ):

            if isinstance(
                node.op,
                ast.And
            ):

                return all(
                    evaluate(value)
                    for value in node.values
                )

            if isinstance(
                node.op,
                ast.Or
            ):

                return any(
                    evaluate(value)
                    for value in node.values
                )

        # ----------------------------------------------------
        # NOT
        # ----------------------------------------------------

        if isinstance(
            node,
            ast.UnaryOp
        ) and isinstance(
            node.op,
            ast.Not
        ):

            return not evaluate(
                node.operand
            )

        raise ValueError(
            "Unsupported component in Boolean expression: "
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

    validate_expression_syntax(
        expression,
        variables
    )

    minterms = []

    number_of_variables = len(
        variables
    )

    # --------------------------------------------------------
    # Evaluate every possible input combination.
    # --------------------------------------------------------

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
# GENERATE DON'T-CARES
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

        condition = condition.strip()

        if not condition:
            continue

        validate_expression_syntax(
            condition,
            variables
        )

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

            output = evaluate_boolean_expression(
                condition,
                variables,
                values
            )

            if output == 1:

                dont_cares.append(
                    index
                )

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

    if len(variables) > MAX_VARIABLES:

        raise ValueError(
            f"Maximum {MAX_VARIABLES} variables supported."
        )

    # No duplicates.
    if len(
        set(variables)
    ) != len(variables):

        raise ValueError(
            "Duplicate variables returned."
        )

    # We deliberately require single-letter variables.
    for variable in variables:

        if variable not in ALLOWED_VARIABLES:

            raise ValueError(
                f"Invalid variable '{variable}'. "
                f"Only A-F are supported."
            )


# ============================================================
# VALIDATE AI TEST CASES
# ============================================================

def validate_test_cases(
    test_cases: list[dict[str, Any]],
    variables: list[str],
    expression: str
) -> None:

    if not test_cases:
        return

    for test_case in test_cases:

        if not isinstance(
            test_case,
            dict
        ):
            continue

        inputs = test_case.get(
            "inputs"
        )

        expected_output = test_case.get(
            "expected_output"
        )

        if not isinstance(
            inputs,
            dict
        ):
            continue

        if expected_output not in (0, 1):
            continue

        values = {}

        for variable in variables:

            if variable not in inputs:
                continue

            value = inputs[variable]

            if value in (0, 1):

                values[variable] = value

        # Only evaluate complete test cases.
        if len(values) != len(variables):
            continue

        actual = evaluate_boolean_expression(
            expression,
            variables,
            values
        )

        if actual != expected_output:

            raise ValueError(
                "Gemini's own test case disagrees "
                "with the returned Boolean expression."
            )


# ============================================================
# BUILD FINAL RESULT
# ============================================================

def construct_result(
    variables: list[str],
    expression: str,
    dont_care_conditions: list[str],
    variable_descriptions_raw: list[Any]
):

    validate_variables(
        variables
    )

    if len(variables) > MAX_VARIABLES:

        raise ValueError(
            f"Maximum {MAX_VARIABLES} variables supported."
        )

    if not expression:

        raise ValueError(
            "No Boolean expression returned."
        )

    # --------------------------------------------------------
    # Generate minterms.
    # --------------------------------------------------------

    minterms = generate_minterms(
        variables,
        expression
    )

    # --------------------------------------------------------
    # Generate don't-cares.
    # --------------------------------------------------------

    dont_cares = generate_dont_cares(
        variables,
        dont_care_conditions
    )

    # --------------------------------------------------------
    # Don't-care values cannot simultaneously be minterms.
    # --------------------------------------------------------

    dont_cares = sorted(
        set(dont_cares)
    )

    minterms = [
        m
        for m in minterms
        if m not in dont_cares
    ]

    # --------------------------------------------------------
    # Descriptions.
    # --------------------------------------------------------

    variable_descriptions = {}

    for item in variable_descriptions_raw:

        if not isinstance(
            item,
            dict
        ):
            continue

        letter = item.get(
            "letter"
        )

        description = item.get(
            "description"
        )

        if (
            isinstance(letter, str)
            and letter in variables
            and isinstance(description, str)
        ):

            variable_descriptions[
                letter
            ] = description

    # Ensure every variable appears.
    for variable in variables:

        variable_descriptions.setdefault(
            variable,
            ""
        )

    return {
        "variables": variables,
        "num_variables": len(variables),
        "minterms": minterms,
        "dont_cares": dont_cares,
        "variable_descriptions": variable_descriptions,
        "expression": expression
    }


# ============================================================
# VERIFY AND, IF NECESSARY, CORRECT GEMINI ANSWER
# ============================================================

def verify_and_correct_solution(
    problem_statement: str,
    result: dict
) -> dict:

    verification_prompt = build_verification_prompt(
        problem_statement,
        result
    )

    try:

        verification = call_gemini_verifier(
            verification_prompt
        )

    except Exception:

        # If verifier itself fails, retain the original solution.
        # The primary response has already passed syntax checks.
        return result

    correct = verification.get(
        "correct",
        True
    )

    if correct:

        return result

    corrected_expression = verification.get(
        "corrected_expression",
        ""
    )

    corrected_variables = verification.get(
        "corrected_variables",
        []
    )

    corrected_dont_cares = verification.get(
        "corrected_dont_care_conditions",
        []
    )

    # --------------------------------------------------------
    # If verifier claims wrong but doesn't provide a correction,
    # do not blindly replace the existing solution.
    # --------------------------------------------------------

    if not corrected_expression:

        return result

    # --------------------------------------------------------
    # Validate corrected variables.
    # --------------------------------------------------------

    try:

        validate_variables(
            corrected_variables
        )

        corrected_result = construct_result(
            variables=corrected_variables,
            expression=corrected_expression,
            dont_care_conditions=corrected_dont_cares,
            variable_descriptions_raw=result.get(
                "variable_descriptions",
                []
            )
        )

        return corrected_result

    except Exception:

        # Keep original result if verifier's correction is invalid.
        return result


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
    # EXPLICIT MINTERMS
    #
    # Do NOT call Gemini.
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

        variable_descriptions = {
            variable: ""
            for variable in variables
        }

        return {
            "variables": variables,
            "num_variables": len(variables),
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
    # Send to Gemini.
    # ========================================================

    prompt = build_prompt(
        req.problem_statement
    )

    # --------------------------------------------------------
    # PRIMARY GEMINI CALL
    # --------------------------------------------------------

    try:

        result = call_gemini(
            prompt
        )

    except json.JSONDecodeError as e:

        raise HTTPException(
            status_code=502,
            detail=(
                "Gemini returned invalid JSON."
            )
        ) from e

    except Exception as e:

        raise HTTPException(
            status_code=502,
            detail=(
                f"Gemini call failed: {str(e)}"
            )
        )

    # ========================================================
    # EXTRACT RESULT
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

    test_cases = (
        result.get(
            "test_cases"
        )
        or []
    )

    # ========================================================
    # VALIDATE PRIMARY RESULT
    # ========================================================

    try:

        validate_variables(
            variables
        )

        if not expression:

            raise ValueError(
                "Gemini did not return "
                "a Boolean expression."
            )

        validate_expression_syntax(
            expression,
            variables
        )

        # Verify that the AI's own test cases are consistent.
        validate_test_cases(
            test_cases,
            variables,
            expression
        )

    except ValueError as e:

        raise HTTPException(
            status_code=502,
            detail=(
                "Invalid Boolean solution from Gemini: "
                + str(e)
            )
        )

    # ========================================================
    # BUILD INITIAL PYTHON-VERIFIED RESULT
    # ========================================================

    try:

        final_result = construct_result(
            variables=variables,
            expression=expression,
            dont_care_conditions=dont_care_conditions,
            variable_descriptions_raw=raw_descriptions
        )

    except Exception as e:

        raise HTTPException(
            status_code=502,
            detail=(
                "Could not evaluate Boolean expression: "
                + str(e)
            )
        )

    # ========================================================
    # SECOND AI PASS
    #
    # Ask another Gemini call to compare the candidate
    # against the ORIGINAL ENGLISH problem.
    #
    # If it finds a semantic mistake, use its correction
    # only if that correction passes our Python validation.
    # ========================================================

    final_result = verify_and_correct_solution(
        req.problem_statement,
        {
            **result,
            **final_result
        }
    )

    # ========================================================
    # FINAL RE-CALCULATION
    #
    # Important: after the verifier possibly corrected the
    # expression, recalculate minterms one final time.
    # ========================================================

    try:

        final_variables = final_result["variables"]

        final_expression = final_result["expression"]

        final_dont_care_conditions = (
            final_result.get(
                "dont_care_conditions",
                []
            )
        )

        rebuilt = construct_result(
            variables=final_variables,
            expression=final_expression,
            dont_care_conditions=final_dont_care_conditions,
            variable_descriptions_raw=(
                result.get(
                    "variable_descriptions",
                    []
                )
            )
        )

        return rebuilt

    except Exception as e:

        raise HTTPException(
            status_code=502,
            detail=(
                "Final Boolean verification failed: "
                + str(e)
            )
        )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "status": "online",
        "service": "Boolean Logic AI Backend",
        "model": MODEL,
        "max_variables": MAX_VARIABLES
    }