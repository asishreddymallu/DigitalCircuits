/**
 * Shared safety limits for exponential Boolean operations.
 *
 * These values mirror Backend/config.py — update both together. They were
 * chosen from the existing application: Web1's numeric inputs allow at most
 * 6 variables, and the AI path historically produced 3-6 variable problems,
 * so 8 gives comfortable headroom without allowing browser-freezing inputs.
 */

export const LIMITS = {
    /** Maximum number of distinct variables in one function. */
    MAX_VARIABLES: 8,
    /** Maximum characters accepted for a typed Boolean expression. */
    MAX_EXPRESSION_LENGTH: 2000,
    /** Maximum characters accepted for a natural-language problem statement. */
    MAX_PROBLEM_LENGTH: 4000,
    /** Maximum don't-care conditions accepted from the AI per request. */
    MAX_DONT_CARE_CONDITIONS: 8,
    /**
     * Node budget for the exact-cover branch search in Quine-McCluskey.
     * When exceeded, the solver finishes the cover greedily. The result stays
     * logically equivalent (verified afterwards); only guaranteed minimality
     * is relaxed. Typical 6-variable problems use far fewer nodes.
     */
    MINIMIZE_NODE_BUDGET: 200_000
} as const;

/** Error thrown when an input exceeds a safety limit. */
export class LimitError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LimitError";
    }
}
