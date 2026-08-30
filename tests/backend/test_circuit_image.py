"""Tests for deterministic circuit-image analysis after vision extraction."""

import base64
from io import BytesIO
import os
import sys
from unittest.mock import patch

os.environ.setdefault("GEMINI_API_KEY", "test-key-not-real")

import pytest
from fastapi import HTTPException
from PIL import Image


ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT, "Backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import main
from models import CircuitAnalysis, CircuitGate


def image_base64(image_format: str) -> str:
    """Return a small valid image as raw base64."""
    buffer = BytesIO()
    Image.new("RGB", (2, 2), "white").save(buffer, format=image_format)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def simple_and_circuit() -> CircuitAnalysis:
    return CircuitAnalysis(
        variables=["A", "B"],
        outputs=["F"],
        gates=[CircuitGate(id="g1", type="AND", inputs=["A", "B"], output="F")],
        connections=[],
        confidence=0.95,
    )


def test_raw_jpeg_uses_detected_mime_type():
    """Raw base64 has no header, so its true byte format must be used."""
    with patch.object(main, "_analyze_circuit_with_gemini", return_value=simple_and_circuit()) as mock_analyze:
        response = main.analyze_circuit_image(
            main.CircuitImageRequest(image=image_base64("JPEG"))
        )

    assert response["minterms"] == [3]
    assert mock_analyze.call_args.kwargs["mime_type"] == "image/jpeg"


def test_circuit_endpoint_generates_minterms_deterministically():
    with patch.object(main, "_analyze_circuit_with_gemini", return_value=simple_and_circuit()):
        response = main.analyze_circuit_image(
            main.CircuitImageRequest(
                image="data:image/png;base64," + image_base64("PNG")
            )
        )

    assert response["expression"] == "(A AND B)"
    assert response["minterms"] == [3]


def test_circuit_endpoint_reports_a_structural_reason():
    cyclic_circuit = CircuitAnalysis(
        variables=["A"],
        outputs=["n1"],
        gates=[
            CircuitGate(id="g1", type="NOT", inputs=["n2"], output="n1"),
            CircuitGate(id="g2", type="NOT", inputs=["n1"], output="n2"),
        ],
        connections=[],
        confidence=0.5,
    )
    with patch.object(main, "_analyze_circuit_with_gemini", return_value=cyclic_circuit):
        with pytest.raises(HTTPException) as exc_info:
            main.analyze_circuit_image(
                main.CircuitImageRequest(
                    image="data:image/png;base64," + image_base64("PNG")
                )
            )

    assert exc_info.value.status_code == 422
    detail = exc_info.value.detail
    assert detail["message"] == "Circuit structure could not be validated."
    assert "cycle" in detail["reason"].lower()
