"""Pydantic models for API requests and responses."""

from pydantic import BaseModel


class ProblemRequest(BaseModel):
    """Incoming request body for /api/solve-boolean."""
    problem_statement: str


class CircuitImageRequest(BaseModel):
    """Incoming request body for /api/analyze-circuit-image."""
    image: str  # Base64 data URL or raw base64
