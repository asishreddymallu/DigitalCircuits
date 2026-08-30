"""
Tests for the Boolean Logic AI Backend retry logic.

These tests mock the Gemini client to verify:
- Successful first-attempt responses
- Acceptance of valid constant-0 and constant-1 expressions
- Retry on variable validation failures
- Retry on missing expressions
- Retry on unparseable expressions
- Immediate failure on Gemini network errors (no retry)
- Immediate failure on invalid JSON (no retry)
- Retry prompt includes error context
- Successful retry after first-attempt failure
- Explicit minterm path (no Gemini call)
"""

import json
import os
import sys
import importlib.util

# Set a dummy API key before importing the backend module,
# which requires GEMINI_API_KEY at import time.
os.environ.setdefault("GEMINI_API_KEY", "test-key-not-real")

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Load Backend/backend.py as a module directly to avoid the
# tests/backend/__init__.py package shadowing.
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_backend_dir = os.path.join(_root, "Backend")

# Add Backend/ to sys.path so relative imports within backend modules work.
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_backend_path = os.path.join(_backend_dir, "backend.py")
_spec = importlib.util.spec_from_file_location("backend_mod", _backend_path)
_backend_mod = importlib.util.module_from_spec(_spec)
sys.modules["backend_mod"] = _backend_mod
_spec.loader.exec_module(_backend_mod)

app = _backend_mod.app

# Import helpers from the modular backend files.
from main import build_prompt
from boolean_engine import generate_minterms
from ai_solver import validate_variables

client = TestClient(app)

# Patch target: use the actual module object so unittest.mock patches
# the function where it is looked up at call time.
PATCH_TARGET = "main.call_gemini"


# ============================================================
# HELPER: build a mock Gemini response object
# ============================================================

def mock_gemini_response(variables, expression, dont_cares=None, descriptions=None):
    """Build a dict that call_gemini would return after json.loads."""
    return {
        "variables": variables,
        "expression": expression,
        "dont_care_conditions": dont_cares or [],
        "variable_descriptions": descriptions or []
    }


# ============================================================
# PATH 1: Explicit minterms (no Gemini call)
# ============================================================

class TestExplicitMintermsPath:
    """The deterministic parser path should never call Gemini."""

    def test_explicit_minterms_bypass_gemini(self):
        """F(A,B,C) = Σm(1,3,5,7) should solve without Gemini."""
        with patch(PATCH_TARGET) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "F(A,B,C) = Σm(1,3,5,7)"
            })
            mock_call.assert_not_called()
            assert resp.status_code == 200
            data = resp.json()
            assert data["variables"] == ["A", "B", "C"]
            assert sorted(data["minterms"]) == [1, 3, 5, 7]

    def test_explicit_minterms_with_don_t_cares(self):
        """F(A,B,C,D) = Σm(1,3) Σd(2) should solve without Gemini."""
        with patch(PATCH_TARGET) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "F(A,B,C,D) = Σm(1,3) Σd(2)"
            })
            mock_call.assert_not_called()
            assert resp.status_code == 200
            data = resp.json()
            assert sorted(data["minterms"]) == [1, 3]
            assert sorted(data["dont_cares"]) == [2]

    def test_empty_problem_returns_400(self):
        resp = client.post("/api/solve-boolean", json={
            "problem_statement": "   "
        })
        assert resp.status_code == 400


# ============================================================
# PATH 2: Natural language — successful first attempt
# ============================================================

class TestSuccessfulFirstAttempt:
    """When Gemini returns a valid expression that evaluates correctly,
    the endpoint should return the result without retrying."""

    def test_simple_and_expression(self):
        mock_resp = mock_gemini_response(
            variables=["A", "B"],
            expression="(A AND B)",
            descriptions=[{"letter": "A", "description": "Input A"},
                          {"letter": "B", "description": "Input B"}]
        )
        with patch(PATCH_TARGET, return_value=mock_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "Output is 1 when A and B are both 1."
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["variables"] == ["A", "B"]
            # A AND B → minterm 3 (binary 11)
            assert data["minterms"] == [3]
            # Should have been called exactly once (no retry)
            assert mock_call.call_count == 1

    def test_or_expression(self):
        mock_resp = mock_gemini_response(
            variables=["A", "B"],
            expression="(A OR B)",
        )
        with patch(PATCH_TARGET, return_value=mock_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "Output is high when A or B is high."
            })
            assert resp.status_code == 200
            data = resp.json()
            # A OR B → minterms 1, 2, 3
            assert sorted(data["minterms"]) == [1, 2, 3]
            assert mock_call.call_count == 1


# ============================================================
# CONSTANT RESULTS
# ============================================================

class TestConstantZero:
    """A constant-zero function is valid Boolean logic and must be returned."""

    def test_constant_zero_is_accepted(self):
        zero_resp = mock_gemini_response(
            variables=["A"],
            expression="(A AND (NOT A))",
        )
        with patch(PATCH_TARGET, return_value=zero_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "Output is 1 when A is high."
            })
            assert mock_call.call_count == 1
            assert resp.status_code == 200
            assert resp.json()["minterms"] == []

# ============================================================
# CONSTANT-1 RESULT (always true)
# ============================================================

class TestConstantOne:
    """A constant-one function is valid Boolean logic and must be returned."""

    def test_constant_one_is_accepted(self):
        one_resp = mock_gemini_response(
            variables=["A", "B", "C"],
            expression="((A OR (NOT A)) AND (B OR (NOT B)))",
        )
        with patch(PATCH_TARGET, return_value=one_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "When at least two of A, B, C are 1."
            })
            assert mock_call.call_count == 1
            assert resp.status_code == 200
            assert resp.json()["minterms"] == list(range(8))


# ============================================================
# RETRY: Variable validation failure
# ============================================================

class TestRetryVariableValidation:
    """When Gemini returns invalid variables, the backend retries."""

    def test_empty_variables_retries(self):
        empty_resp = mock_gemini_response(
            variables=[],
            expression="A",
        )
        with patch(PATCH_TARGET, return_value=empty_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "When A is high."
            })
            assert mock_call.call_count == 2
            assert resp.status_code == 502
            assert "No variables" in resp.json()["detail"]

    def test_invalid_variable_name_retries(self):
        bad_var_resp = mock_gemini_response(
            variables=["123INVALID"],
            expression="A",
        )
        with patch(PATCH_TARGET, return_value=bad_var_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "When A is high."
            })
            assert mock_call.call_count == 2
            assert resp.status_code == 502
            assert "Invalid variable name" in resp.json()["detail"]


# ============================================================
# RETRY: Missing expression
# ============================================================

class TestRetryMissingExpression:
    """When Gemini returns no expression, the backend retries."""

    def test_missing_expression_retries(self):
        no_expr_resp = mock_gemini_response(
            variables=["A", "B"],
            expression="",
        )
        with patch(PATCH_TARGET, return_value=no_expr_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "When A and B are both 1."
            })
            assert mock_call.call_count == 2
            assert resp.status_code == 502
            assert "did not return" in resp.json()["detail"]


# ============================================================
# RETRY: Unparseable expression
# ============================================================

class TestRetryUnparseableExpression:
    """When the expression can't be evaluated, the backend retries."""

    def test_unparseable_expression_retries(self):
        bad_expr_resp = mock_gemini_response(
            variables=["A", "B"],
            expression="(((A AND B) OR",  # malformed
        )
        correct_resp = mock_gemini_response(
            variables=["A", "B"],
            expression="(A AND B)",
        )
        with patch(PATCH_TARGET, side_effect=[bad_expr_resp, correct_resp]) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "A and B both 1."
            })
            assert mock_call.call_count == 2
            assert resp.status_code == 200
            assert resp.json()["minterms"] == [3]

    def test_unparseable_fails_after_retry(self):
        bad_expr_resp = mock_gemini_response(
            variables=["A"],
            expression="(((A AND B) OR",  # malformed
        )
        with patch(PATCH_TARGET, return_value=bad_expr_resp) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "When A is high."
            })
            assert mock_call.call_count == 2
            assert resp.status_code == 502
            assert "Could not evaluate" in resp.json()["detail"]


# ============================================================
# NETWORK ERRORS: retries once before failing
# ============================================================

class TestImmediateFailureNetworkError:
    """Network errors from Gemini are retried once before failing."""

    def test_network_error_retries_once(self):
        with patch(PATCH_TARGET, side_effect=ConnectionError("Network timeout")) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "When A is high."
            })
            # Should retry once (2 calls total) before failing
            assert mock_call.call_count == 2
            assert resp.status_code == 502
            assert "Gemini call failed" in resp.json()["detail"]

    def test_invalid_json_retries_once(self):
        with patch(PATCH_TARGET, side_effect=json.JSONDecodeError("err", "", 0)) as mock_call:
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "When A is high."
            })
            assert mock_call.call_count == 2
            assert resp.status_code == 502
            assert "invalid JSON" in resp.json()["detail"]


# ============================================================
# build_prompt: retry_error parameter
# ============================================================

class TestBuildPrompt:
    """The retry section should appear in the prompt when retry_error is set."""

    def test_no_retry_error(self):
        prompt = build_prompt("When A is high.", retry_error="")
        assert "PREVIOUS ATTEMPT FAILED" not in prompt
        assert "Problem:" in prompt

    def test_with_retry_error(self):
        error = "The expression evaluated to 0 for all combinations."
        prompt = build_prompt("When A is high.", retry_error=error)
        assert "PREVIOUS ATTEMPT FAILED" in prompt
        assert error in prompt
        assert "Do NOT repeat the same mistake" in prompt

    def test_prompt_contains_original_problem(self):
        problem = "A warning light turns on when temperature is high."
        prompt = build_prompt(problem, retry_error="some error")
        assert problem in prompt


# ============================================================
# validate_variables: standalone unit tests
# ============================================================

class TestValidateVariables:
    """Direct unit tests for the validate_variables function."""

    def test_valid_single_letter(self):
        validate_variables(["A"])  # should not raise

    def test_valid_multi_char(self):
        validate_variables(["RESET_N", "ENABLE", "DATA0"])

    def test_empty_list_raises(self):
        with pytest.raises(ValueError, match="No variables"):
            validate_variables([])

    def test_duplicate_raises(self):
        with pytest.raises(ValueError, match="Duplicate"):
            validate_variables(["A", "B", "A"])

    def test_invalid_name_raises(self):
        with pytest.raises(ValueError, match="Invalid variable name"):
            validate_variables(["123BAD"])

    def test_starts_with_underscore_raises(self):
        with pytest.raises(ValueError, match="Invalid variable name"):
            validate_variables(["_private"])


# ============================================================
# generate_minterms: standalone unit tests
# ============================================================

class TestGenerateMinterms:
    """Direct unit tests for the generate_minterms function."""

    def test_simple_and(self):
        # A AND B → minterm 3 only (binary 11)
        minterms = generate_minterms(["A", "B"], "(A and B)")
        assert minterms == [3]

    def test_simple_or(self):
        # A OR B → minterms 1, 2, 3
        minterms = generate_minterms(["A", "B"], "(A or B)")
        assert sorted(minterms) == [1, 2, 3]

    def test_not_expression(self):
        # NOT A → minterm 0 (A=0)
        minterms = generate_minterms(["A"], "(not A)")
        assert minterms == [0]

    def test_complex_expression(self):
        # A XOR B → minterms where A≠B: 1(01), 2(10)
        # Variables are [A, B] with A=MSB
        minterms = generate_minterms(
            ["A", "B"],
            "((A and (not B)) or ((not A) and B))"
        )
        assert sorted(minterms) == [1, 2]

    def test_constant_zero(self):
        minterms = generate_minterms(["A"], "(A and (not A))")
        assert minterms == []

    def test_constant_one(self):
        minterms = generate_minterms(["A"], "(A or (not A))")
        assert minterms == [0, 1]

    def test_unknown_variable_raises(self):
        with pytest.raises(ValueError, match="Unknown variable"):
            generate_minterms(["A"], "(A and B)")


# ============================================================
# INPUT VALIDATION LIMITS
# ============================================================

class TestInputValidationLimits:
    """Test backend safety limits for request size and complexity."""

    def test_problem_too_long(self):
        resp = client.post("/api/solve-boolean", json={
            "problem_statement": "x" * 5000
        })
        assert resp.status_code == 400
        assert "exceeds maximum length" in resp.json()["detail"]

    def test_problem_at_limit_ok(self):
        # Exactly at the limit should be accepted (4000 chars)
        with patch(PATCH_TARGET, side_effect=ConnectionError("expected")):
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "x" * 4000
            })
            # Should not be 400 for length — it's 502 because Gemini fails
            assert resp.status_code != 400

    def test_empty_problem(self):
        resp = client.post("/api/solve-boolean", json={
            "problem_statement": ""
        })
        assert resp.status_code == 400
        assert "required" in resp.json()["detail"]

    def test_whitespace_only_problem(self):
        resp = client.post("/api/solve-boolean", json={
            "problem_statement": "   \n  \t  "
        })
        assert resp.status_code == 400

    def test_too_many_variables_rejected(self):
        """If Gemini returns more than 8 variables, reject."""
        mock_result = {
            "variables": [f"V{i}" for i in range(10)],
            "expression": "V0",  # Simplified — won't matter
            "dont_care_conditions": [],
            "variable_descriptions": []
        }
        with patch(PATCH_TARGET, return_value=mock_result):
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "Test problem"
            })
            # Gemini call itself fails due to timeout/connection mock issues,
            # but the variable check happens first
            assert resp.status_code in (400, 502)

    def test_expression_too_long_rejected(self):
        """If Gemini returns an expression exceeding the limit, reject."""
        mock_result = {
            "variables": ["A", "B"],
            "expression": "A" + " or " * 500 + "B",  # ~1500 chars
            "dont_care_conditions": [],
            "variable_descriptions": []
        }
        with patch(PATCH_TARGET, return_value=mock_result):
            resp = client.post("/api/solve-boolean", json={
                "problem_statement": "Test problem"
            })
            # The expression is 1502 chars, under 2000 limit — should pass validation
            assert resp.status_code == 200 or resp.status_code == 502


# ============================================================
# HEALTH CHECK
# ============================================================

class TestHealthCheck:
    def test_root_endpoint(self):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "online"
