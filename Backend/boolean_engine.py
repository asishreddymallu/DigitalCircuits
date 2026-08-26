"""Deterministic Boolean expression evaluator and minterm generator.

Converts a Boolean expression (with AND/OR/NOT) into Python, parses it
into an AST, and evaluates it safely for every possible input assignment.

The key invariant: for n variables, we evaluate exactly 2^n combinations
and collect the indices where the output is 1.
"""

import ast
import re


def normalize_expression(expression: str) -> str:
    """Convert Boolean operators (AND/OR/NOT) to Python keywords."""
    expression = expression.strip()
    expression = re.sub(r"\bAND\b", " and ", expression, flags=re.IGNORECASE)
    expression = re.sub(r"\bOR\b", " or ", expression, flags=re.IGNORECASE)
    expression = re.sub(r"\bNOT\b", " not ", expression, flags=re.IGNORECASE)
    return expression


def evaluate_boolean_expression(
    expression: str,
    variables: list[str],
    values: dict[str, int],
) -> int:
    """
    Evaluate a Boolean expression for a single variable assignment.

    Uses Python's ast module for safe evaluation — no eval/exec.
    Returns 0 or 1.
    """
    py_expr = normalize_expression(expression)

    try:
        tree = ast.parse(py_expr, mode="eval")
    except SyntaxError as e:
        raise ValueError(
            f"Invalid Boolean expression: {expression}"
        ) from e

    def _eval(node):
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Name):
            if node.id not in values:
                raise ValueError(
                    f"Unknown variable '{node.id}' in expression."
                )
            return bool(values[node.id])
        if isinstance(node, ast.BoolOp) and isinstance(node.op, ast.And):
            return all(_eval(v) for v in node.values)
        if isinstance(node, ast.BoolOp) and isinstance(node.op, ast.Or):
            return any(_eval(v) for v in node.values)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Not):
            return not _eval(node.operand)
        raise ValueError(
            "Unsupported component in Boolean expression: "
            + ast.dump(node)
        )

    return int(_eval(tree))


def generate_minterms(
    variables: list[str],
    expression: str,
) -> list[int]:
    """
    Evaluate an expression for all 2^n input combinations.

    Returns sorted list of indices where the output is 1.
    The first variable is MSB.
    """
    minterms = []
    n = len(variables)

    for index in range(2 ** n):
        values = {}
        for pos, var in enumerate(variables):
            bit_pos = n - 1 - pos
            values[var] = (index >> bit_pos) & 1

        if evaluate_boolean_expression(expression, variables, values) == 1:
            minterms.append(index)

    return minterms


def generate_dont_cares(
    variables: list[str],
    conditions: list[str],
) -> list[int]:
    """
    Evaluate each don't-care condition expression for all 2^n combinations.
    Returns sorted list of indices where ANY condition is true.
    """
    if not conditions:
        return []

    dont_cares = []
    n = len(variables)

    for condition in conditions:
        if not condition.strip():
            continue

        for index in range(2 ** n):
            values = {}
            for pos, var in enumerate(variables):
                bit_pos = n - 1 - pos
                values[var] = (index >> bit_pos) & 1

            try:
                if evaluate_boolean_expression(condition, variables, values) == 1:
                    dont_cares.append(index)
            except Exception:
                continue

    return sorted(set(dont_cares))
