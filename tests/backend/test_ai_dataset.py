"""
AI test dataset: representative natural-language digital-logic questions.

These are NOT run against Gemini — they test the deterministic parser
(path 1) and the validation infrastructure. The AI path (path 2) is
tested separately with mocked Gemini responses.

Each test case specifies:
  - problem: the natural-language input
  - expected_minterms: the minterm indices the solver should produce
  - num_variables: how many variables
  - description: what the problem tests
"""

import os
import sys
import pytest

# Set a dummy API key before importing the backend module.
os.environ.setdefault("GEMINI_API_KEY", "test-key-not-real")

import importlib.util
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_backend_dir = os.path.join(_root, "Backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

_backend_path = os.path.join(_backend_dir, "backend.py")
_spec = importlib.util.spec_from_file_location("backend_mod", _backend_path)
_backend_mod = importlib.util.module_from_spec(_spec)
sys.modules["backend_mod"] = _backend_mod
_spec.loader.exec_module(_backend_mod)

from parser import parse_explicit_minterms


# ============================================================
# EXPLICIT MINTERM TESTS (Path 1 — deterministic, no Gemini)
# ============================================================

class TestExplicitMintermsParsing:
    """Test the Σm/Σd deterministic parser with common problem formats."""

    def test_basic_sop(self):
        result = parse_explicit_minterms("F(A,B,C) = Σm(1,3,5,7)")
        assert result is not None
        assert result["variables"] == ["A", "B", "C"]
        assert result["minterms"] == [1, 3, 5, 7]
        assert result["dont_cares"] == []

    def test_with_dont_cares(self):
        result = parse_explicit_minterms("F(A,B,C,D) = Σm(1,3,5,7) Σd(2,6)")
        assert result is not None
        assert result["variables"] == ["A", "B", "C", "D"]
        assert result["minterms"] == [1, 3, 5, 7]
        assert result["dont_cares"] == [2, 6]

    def test_sum_notation(self):
        result = parse_explicit_minterms("F(A,B,C) = sum m(0,2,4)")
        assert result is not None
        assert result["minterms"] == [0, 2, 4]

    def test_sum_d_notation(self):
        result = parse_explicit_minterms("F(A,B) = Σm(0) sum d(2)")
        assert result is not None
        assert result["minterms"] == [0]
        assert result["dont_cares"] == [2]

    def test_multichar_variable_names(self):
        result = parse_explicit_minterms("F(PIN,ENABLE,DATA0) = Σm(1,5)")
        assert result is not None
        assert result["variables"] == ["PIN", "ENABLE", "DATA0"]
        assert result["minterms"] == [1, 5]

    def test_underscore_variable_names(self):
        result = parse_explicit_minterms("F(RESET_N,ENABLE) = Σm(1)")
        assert result is not None
        assert result["variables"] == ["RESET_N", "ENABLE"]

    def test_empty_minterms(self):
        """Empty Σm() is not recognized — the parser requires at least one digit."""
        result = parse_explicit_minterms("F(A,B) = Σm()")
        assert result is None  # Parser expects at least one minterm value

    def test_no_minterms_returns_none(self):
        result = parse_explicit_minterms("A door opens when A and B are both 1.")
        assert result is None

    def test_minterm_out_of_range(self):
        with pytest.raises(ValueError, match="out of range"):
            parse_explicit_minterms("F(A,B) = Σm(5)")

    def test_duplicate_minterms_deduplicated(self):
        result = parse_explicit_minterms("F(A,B) = Σm(0,0,1,1,1)")
        assert result is not None
        assert result["minterms"] == [0, 1]

    def test_dont_cares_not_in_minterms(self):
        """A value in both Σm and Σd should only appear as a minterm."""
        result = parse_explicit_minterms("F(A,B) = Σm(0,1) Σd(1,2)")
        assert result is not None
        assert 1 in result["minterms"]
        assert 1 not in result["dont_cares"]
        assert 2 in result["dont_cares"]

    def test_five_variables(self):
        result = parse_explicit_minterms("F(A,B,C,D,E) = Σm(0,31)")
        assert result is not None
        assert len(result["variables"]) == 5
        assert result["minterms"] == [0, 31]


# ============================================================
# PROBLEM TYPES THE AI SHOULD HANDLE (Path 2 — mocked)
# ============================================================

# These are the problem descriptions the AI test dataset should cover.
# They are NOT executed against Gemini here — they document the expected
# behavior for when the AI integration is tested with live or mocked LLM.

AI_PROBLEM_DESCRIPTIONS = [
    {
        "description": "Simple AND",
        "problem": "Output is 1 when A and B are both 1.",
        "expected_variables": ["A", "B"],
        "expected_minterms": [3],  # AB = 11 = 3
    },
    {
        "description": "Simple OR",
        "problem": "Output is high when A or B is high.",
        "expected_variables": ["A", "B"],
        "expected_minterms": [1, 2, 3],  # A|B = 01,10,11
    },
    {
        "description": "XOR",
        "problem": "Output is high when exactly one input is high.",
        "expected_variables": ["A", "B"],
        "expected_minterms": [1, 2],  # A⊕B
    },
    {
        "description": "Majority 3",
        "problem": "Output is 1 when at least two of A, B and C are 1.",
        "expected_variables": ["A", "B", "C"],
        "expected_minterms": [3, 5, 6, 7],  # AB|AC|BC
    },
    {
        "description": "NAND",
        "problem": "Output is LOW only when both A and B are HIGH.",
        "expected_variables": ["A", "B"],
        "expected_minterms": [0, 1, 2],  # NAND = NOT(AB) = 00,01,10
    },
    {
        "description": "Exactly two of three",
        "problem": "Output is high when exactly two of A, B, C are 1.",
        "expected_variables": ["A", "B", "C"],
        "expected_minterms": [3, 5, 6],  # AB'C, A'BC, ABC'
    },
]


class TestAIDatasetDefinitions:
    """Verify the AI test dataset is well-formed."""

    def test_dataset_is_nonempty(self):
        assert len(AI_PROBLEM_DESCRIPTIONS) > 0

    def test_all_entries_have_required_fields(self):
        for entry in AI_PROBLEM_DESCRIPTIONS:
            assert "description" in entry
            assert "problem" in entry
            assert "expected_variables" in entry
            assert "expected_minterms" in entry

    def test_all_minterms_are_in_range(self):
        for entry in AI_PROBLEM_DESCRIPTIONS:
            n = len(entry["expected_variables"])
            max_minterm = (2 ** n) - 1
            for m in entry["expected_minterms"]:
                assert 0 <= m <= max_minterm, (
                    f"Out of range minterm {m} for {n} variables "
                    f"in '{entry['description']}'"
                )

    def test_minterms_are_sorted_and_unique(self):
        for entry in AI_PROBLEM_DESCRIPTIONS:
            m = entry["expected_minterms"]
            assert m == sorted(set(m)), (
                f"Minterms not sorted/deduped in '{entry['description']}'"
            )

    def test_dataset_covers_and_or_xor_nand_majority(self):
        descriptions = [e["description"].lower() for e in AI_PROBLEM_DESCRIPTIONS]
        assert any("and" in d for d in descriptions)
        assert any("or" in d for d in descriptions)
        assert any("xor" in d for d in descriptions)
        assert any("nand" in d for d in descriptions)
        assert any("majority" in d for d in descriptions)
