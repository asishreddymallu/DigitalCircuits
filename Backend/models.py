"""Pydantic request and structured-response models for the backend."""

from typing import Literal

from pydantic import BaseModel, Field


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

    id: str = Field(min_length=1, max_length=64)
    type: GateType
    inputs: list[str] = Field(default_factory=list)
    output: str = Field(min_length=1, max_length=64)


class CircuitConnection(BaseModel):
    """A visual connection from a signal to a gate input port."""

    from_signal: str = Field(min_length=1, max_length=64)
    to_gate: str = Field(min_length=1, max_length=64)
    to_port: int = Field(ge=0, le=63)


class WaveformSignal(BaseModel):
    """One signal (input or output) extracted from a timing diagram image."""

    name: str = Field(min_length=1, max_length=64)
    values: list[int] = Field(description="Logic levels: 0 or 1 per time step")
    is_output: bool = Field(default=False)


class TimingDiagramAnalysis(BaseModel):
    """Structured output from Gemini for a timing diagram image."""

    signals: list[WaveformSignal] = Field(default_factory=list)
    time_steps: int = Field(ge=2, le=128)
    confidence: float = Field(ge=0.0, le=1.0)


class TimingDiagramRequest(BaseModel):
    """Incoming request body for /api/analyze-timing-diagram."""

    image: str


class CircuitAnalysis(BaseModel):
    """Structured output requested from Gemini for a circuit image.

    The model only describes what it sees. It does NOT calculate
    minterms or a Boolean expression; those are generated deterministically
    by the Python backend after graph validation.
    """

    variables: list[str] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)
    gates: list[CircuitGate] = Field(default_factory=list)
    connections: list[CircuitConnection] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
