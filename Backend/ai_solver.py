"""Gemini AI interaction: prompt building, API calls, and response validation.

The LLM is used ONLY for natural language → structured Boolean problem.
It is never trusted as the final authority — every result is validated
deterministically by boolean_engine.py.
"""

import json
import re

from google import genai
from google.genai import types

from config import GEMINI_TIMEOUT_SECONDS

# Gemini model name.
MODEL = "gemini-3.5-flash-lite"


def build_prompt(problem_statement: str, retry_error: str = "") -> str:
    """
    Construct the Gemini system prompt.

    On retry, appends the verification error so the LLM can correct itself.
    """
    retry_section = ""
    if retry_error:
        retry_section = f"""
============================================================
*** PREVIOUS ATTEMPT FAILED — READ CAREFULLY ***
============================================================

Your previous response failed verification:

{retry_error}

Please re-read the problem above and fix the issue.
Do NOT repeat the same mistake.
Double-check your expression against every condition in the problem.
"""

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
{retry_section}
============================================================
PROBLEM TO SOLVE
============================================================

{problem_statement.strip()}
"""


def call_gemini(client, prompt: str) -> dict:
    """
    Call Gemini with structured JSON output schema.

    Uses response_mime_type and response_schema to enforce
    structured output at the API level.
    """
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
                    items=genai.types.Schema(type=genai.types.Type.STRING),
                ),
                "expression": genai.types.Schema(
                    type=genai.types.Type.STRING,
                ),
                "dont_care_conditions": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(type=genai.types.Type.STRING),
                ),
                "variable_descriptions": genai.types.Schema(
                    type=genai.types.Type.ARRAY,
                    items=genai.types.Schema(
                        type=genai.types.Type.OBJECT,
                        properties={
                            "letter": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                            "description": genai.types.Schema(
                                type=genai.types.Type.STRING,
                            ),
                        },
                        required=["letter", "description"],
                    ),
                ),
            },
            required=[
                "variables",
                "expression",
                "dont_care_conditions",
                "variable_descriptions",
            ],
        ),
    )

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=config,
        http_options=types.HttpOptions(
            timeout=GEMINI_TIMEOUT_SECONDS * 1000,  # milliseconds
        ),
    )

    if not response.text:
        raise ValueError("Gemini returned an empty response.")

    return json.loads(response.text)


def validate_variables(variables: list[str]) -> None:
    """
    Validate variable names returned by Gemini.

    Rules:
    - Must not be empty.
    - Must not have duplicates.
    - Must match [A-Za-z][A-Za-z0-9_]*.
    """
    if not variables:
        raise ValueError("No variables were identified.")

    if len(set(variables)) != len(variables):
        raise ValueError("Duplicate variables returned.")

    for var in variables:
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]*", var):
            raise ValueError(f"Invalid variable name: {var}")
