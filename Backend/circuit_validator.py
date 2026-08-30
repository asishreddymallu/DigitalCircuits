"""Validation for circuit structures returned by the vision model."""

from models import CircuitAnalysis


ALLOWED_GATE_TYPES = {
    "AND",
    "OR",
    "NOT",
    "NAND",
    "NOR",
    "XOR",
    "XNOR",
    "BUFFER",
}


class CircuitValidationError(ValueError):
    """Raised when a detected circuit is structurally inconsistent."""


def validate_circuit(circuit: CircuitAnalysis, max_variables: int) -> None:
    """Validate the circuit graph before deterministic evaluation."""

    variables = circuit.variables
    outputs = circuit.outputs
    gates = circuit.gates
    connections = circuit.connections

    if not variables:
        raise CircuitValidationError("No input variables were identified.")

    if len(variables) > max_variables:
        raise CircuitValidationError(
            f"Too many variables ({len(variables)}). "
            f"Maximum supported is {max_variables}."
        )

    if len(set(variables)) != len(variables):
        raise CircuitValidationError("Duplicate input variables were returned.")

    for var in variables:
        if not var:
            raise CircuitValidationError("An empty variable name was returned.")

    if not outputs:
        raise CircuitValidationError("No circuit output was identified.")

    if len(set(outputs)) != len(outputs):
        raise CircuitValidationError("Duplicate circuit outputs were returned.")

    gate_ids: set[str] = set()
    gate_outputs: set[str] = set()
    signal_names = set(variables)

    for gate in gates:
        if gate.id in gate_ids:
            raise CircuitValidationError(f"Duplicate gate id: {gate.id}")
        gate_ids.add(gate.id)

        if gate.type not in ALLOWED_GATE_TYPES:
            raise CircuitValidationError(
                f"Unsupported gate type '{gate.type}' in {gate.id}."
            )

        if gate.output in signal_names:
            raise CircuitValidationError(
                f"Gate {gate.id} outputs '{gate.output}', "
                "which conflicts with an input variable."
            )

        if gate.output in gate_outputs:
            raise CircuitValidationError(
                f"Duplicate gate output signal: {gate.output}"
            )

        gate_outputs.add(gate.output)

        input_count = len(gate.inputs)
        if gate.type in {"NOT", "BUFFER"} and input_count != 1:
            raise CircuitValidationError(
                f"Gate {gate.id} ({gate.type}) must have exactly 1 input; "
                f"found {input_count}."
            )

        if gate.type in {"AND", "OR", "NAND", "NOR", "XOR", "XNOR"} and input_count < 2:
            raise CircuitValidationError(
                f"Gate {gate.id} ({gate.type}) must have at least 2 inputs; "
                f"found {input_count}."
            )

        for source in gate.inputs:
            if not source:
                raise CircuitValidationError(
                    f"Gate {gate.id} contains an empty input signal."
                )

    valid_signals = signal_names | gate_outputs

    for gate in gates:
        for source in gate.inputs:
            if source not in valid_signals:
                raise CircuitValidationError(
                    f"Gate {gate.id} references unknown signal '{source}'."
                )

    for output in outputs:
        if output not in valid_signals:
            raise CircuitValidationError(
                f"Output '{output}' does not refer to an input or gate output."
            )

    # Connections are supplementary topology evidence. We validate that
    # they are internally meaningful, but we use gate.inputs as the source
    # of truth for deterministic Boolean evaluation because the model may
    # occasionally omit an otherwise harmless connection record.
    for conn in connections:
        if conn.to_gate not in gate_ids:
            raise CircuitValidationError(
                f"Connection points to unknown gate '{conn.to_gate}'."
            )

        gate = next(g for g in gates if g.id == conn.to_gate)
        if conn.to_port >= len(gate.inputs):
            raise CircuitValidationError(
                f"Connection to {conn.to_gate} uses invalid port {conn.to_port}."
            )

        if conn.from_signal not in valid_signals:
            raise CircuitValidationError(
                f"Connection references unknown signal '{conn.from_signal}'."
            )

        expected_source = gate.inputs[conn.to_port]
        if expected_source != conn.from_signal:
            raise CircuitValidationError(
                f"Connection mismatch at {conn.to_gate} port {conn.to_port}: "
                f"gate expects '{expected_source}', connection says "
                f"'{conn.from_signal}'."
            )

    # A circuit used by this project is combinational. Detect a dependency
    # cycle before trying to expand it into a Boolean expression.
    gate_by_output = {gate.output: gate for gate in gates}

    visiting: set[str] = set()
    visited: set[str] = set()

    def visit_signal(signal: str) -> None:
        gate = gate_by_output.get(signal)
        if gate is None:
            return

        if signal in visiting:
            raise CircuitValidationError(
                f"Combinational cycle detected at signal '{signal}'."
            )

        if signal in visited:
            return

        visiting.add(signal)
        for source in gate.inputs:
            visit_signal(source)
        visiting.remove(signal)
        visited.add(signal)

    for output in outputs:
        visit_signal(output)
