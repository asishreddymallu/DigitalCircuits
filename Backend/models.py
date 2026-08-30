"""Pydantic request and structured-response models for the backend."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ProblemRequest(BaseModel):
    """Incoming request body for /api/solve-boolean."""

    problem_statement: str


class CircuitImageRequest(BaseModel):
    """Incoming request body for /api/analyze-circuit-image.

    The image may be a base64 data URL such as
    ``data:image/png;base64,...`` or raw base64.
    """

    image: str


GateType = Literal[
    "AND",
    "OR",
    "NOT",
    "NAND",
    "NOR",
    "XOR",
    "XNOR",
    "BUFFER",
]


class CircuitGate(BaseModel):
    """One logic gate detected in the circuit image."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=64)
    type: GateType
    inputs: list[str] = Field(default_factory=list)
    output: str = Field(min_length=1, max_length=64)


class CircuitConnection(BaseModel):
    """A visual connection from a signal to a gate input port."""

    model_config = ConfigDict(extra="forbid")

    from_signal: str = Field(min_length=1, max_length=64)
    to_gate: str = Field(min_length=1, max_length=64)
    to_port: int = Field(ge=0, le=63)


class CircuitAnalysis(BaseModel):
    """Structured output requested from Gemini for a circuit image.

    The model only describes what it sees. It does NOT calculate
    minterms or a Boolean expression; those are generated deterministically
    by the Python backend after graph validation.
    """

    model_config = ConfigDict(extra="forbid")

    variables: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    gates: list[CircuitGate] = Field(default_factory=list)
    connections: list[CircuitConnection] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
