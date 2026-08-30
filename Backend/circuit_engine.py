"""Deterministic conversion of a validated circuit graph to Boolean logic."""

from functools import lru_cache

from models import CircuitAnalysis
from circuit_validator import CircuitValidationError


def _format_and(parts: list[str]) -> str:
    return "(" + " AND ".join(parts) + ")"


def _format_or(parts: list[str]) -> str:
    return "(" + " OR ".join(parts) + ")"


def _gate_expression(gate_type: str, inputs: list[str]) -> str:
    if gate_type == "AND":
        return _format_and(inputs)

    if gate_type == "OR":
        return _format_or(inputs)

    if gate_type == "NOT":
        return f"(NOT {inputs[0]})"

    if gate_type == "NAND":
        return f"(NOT {_format_and(inputs)})"

    if gate_type == "NOR":
        return f"(NOT {_format_or(inputs)})"

    if gate_type == "XOR":
        # XOR for two or more inputs. For n inputs we fold XOR left-to-right
        # using the standard 2-input identity.
        current = inputs[0]
        for nxt in inputs[1:]:
            current = (
                f"(({current} AND (NOT {nxt})) OR "
                f"((NOT {current}) AND {nxt}))"
            )
        return current

    if gate_type == "XNOR":
        xor_expr = _gate_expression("XOR", inputs)
        return f"(NOT {xor_expr})"

    if gate_type == "BUFFER":
        return f"({inputs[0]})"

    raise CircuitValidationError(f"Unsupported gate type: {gate_type}")


def circuit_to_expressions(circuit: CircuitAnalysis) -> dict[str, str]:
    """Return one Boolean expression per declared circuit output.

    The expression is expanded recursively from gate outputs, so the final
    expression only contains primary input variables and Boolean operators.
    """

    gate_by_output = {gate.output: gate for gate in circuit.gates}
    primary_variables = set(circuit.variables)

    @lru_cache(maxsize=None)
    def resolve(signal: str) -> str:
        if signal in primary_variables:
            return signal

        gate = gate_by_output.get(signal)
        if gate is None:
            raise CircuitValidationError(
                f"Cannot resolve signal '{signal}' to a variable or gate output."
            )

        resolved_inputs = [resolve(source) for source in gate.inputs]
        return _gate_expression(gate.type, resolved_inputs)

    return {output: resolve(output) for output in circuit.outputs}
