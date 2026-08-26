"""Deterministic parser for explicit Σm/Σd notation.

When the user already provides minterms like:
    F(A,B,C,D) = Σm(1,3,5,7)
    Σd(2,6)

...we skip Gemini entirely and parse directly.
"""

import re


def parse_explicit_minterms(problem_statement: str) -> dict | None:
    """
    Detect whether the user has already supplied minterms.

    Returns None if the input is a natural-language word problem.
    Returns a dict with variables, minterms, and dont_cares on success.
    Raises ValueError on invalid ranges.
    """
    text = problem_statement.strip()

    # Find the main function variable list: F(C,B,K,S,E)
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

    if not variable_match:
        return None

    variables = [
        v.strip()
        for v in variable_match.group(1).split(",")
    ]

    # Find Σm / ∑m / Σ m / ∑ m / sum m
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
        return None

    minterms = [
        int(v.strip())
        for v in minterm_match.group(1).split(",")
        if v.strip()
    ]

    # Find don't-care terms: Σd / ∑d / sum d
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

    dont_cares = []
    if dont_care_match:
        dont_cares = [
            int(v.strip())
            for v in dont_care_match.group(1).split(",")
            if v.strip()
        ]

    # Validate indices.
    num_vars = len(variables)
    max_index = (2 ** num_vars) - 1

    invalid_minterms = [
        v for v in minterms
        if v < 0 or v > max_index
    ]

    invalid_dont_cares = [
        v for v in dont_cares
        if v < 0 or v > max_index
    ]

    if invalid_minterms:
        raise ValueError(
            f"Minterm index out of range: {invalid_minterms}. "
            f"For {num_vars} variables, valid indices are 0 to {max_index}."
        )

    if invalid_dont_cares:
        raise ValueError(
            f"Don't-care index out of range: {invalid_dont_cares}. "
            f"For {num_vars} variables, valid indices are 0 to {max_index}."
        )

    # Remove duplicates and sort.
    minterms = sorted(set(minterms))
    dont_cares = sorted(set(dont_cares))

    # A value cannot be both a minterm and a don't-care.
    dont_cares = [v for v in dont_cares if v not in minterms]

    return {
        "variables": variables,
        "minterms": minterms,
        "dont_cares": dont_cares,
    }
