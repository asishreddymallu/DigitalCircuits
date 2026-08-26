"""Pydantic models for API requests and responses."""

from pydantic import BaseModel


class ProblemRequest(BaseModel):
    """Incoming request body for /api/solve-boolean."""
    problem_statement: str
