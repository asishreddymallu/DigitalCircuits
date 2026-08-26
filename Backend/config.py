"""Backend configuration and safety limits.

Must mirror shared/ts/boolean/limits.ts — update both together.
"""

# Maximum characters accepted for a natural-language problem statement.
MAX_PROBLEM_LENGTH = 4000

# Maximum distinct variables in one function.
MAX_VARIABLES = 8

# Maximum characters in a generated Boolean expression.
MAX_EXPRESSION_LENGTH = 2000

# Maximum don't-care conditions from the AI per request.
MAX_DONT_CARE_CONDITIONS = 8

# Timeout for Gemini API calls (seconds).
GEMINI_TIMEOUT_SECONDS = 30

# Number of retry attempts after initial failure.
MAX_RETRIES = 1
