"""Boolean Logic AI Backend — entry point.

This module re-exports the FastAPI app from main.py so that:
    uvicorn backend:app --reload
continues to work.

All logic lives in:
    main.py       — FastAPI routes + initialization
    config.py     — safety limits
    models.py     — Pydantic models
    parser.py     — explicit Σm/Σd parser
    ai_solver.py  — Gemini interaction + prompt building
    boolean_engine.py — expression evaluation + minterm generation
"""

from main import app  # noqa: F401

__all__ = ["app"]
