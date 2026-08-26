/**
 * Client for the Boolean AI backend (Backend/ service).
 *
 * Security/robustness measures:
 *  - The Gemini key never touches the browser; all calls go through our API.
 *  - Requests are size-limited client-side before any network traffic.
 *  - A hard timeout aborts hung requests (Render cold starts can stall).
 *  - Callers pass an AbortSignal so starting a new solve cancels a stale one.
 */

import { LIMITS } from "../../../shared/ts/boolean/limits";

/** Deployment URL of the FastAPI backend. Override in dev/tests via
 *  `window.DC_BOOLEAN_API_BASE` without touching this file. */
const DEFAULT_API_BASE = "https://digitalcircuits.onrender.com";

const REQUEST_TIMEOUT_MS = 45_000;

export interface WordProblemResult {
    variables: string[];
    minterms: number[];
    dontCares: number[];
    variableDescriptions?: Record<string, string>;
}

export class ApiError extends Error {}

function apiBase(): string {
    const override = (window as unknown as { DC_BOOLEAN_API_BASE?: string }).DC_BOOLEAN_API_BASE;
    const base = override || DEFAULT_API_BASE;
    return base.replace(/\/+$/, "");
}

export async function fetchMintermsFromProblem(
    problemStatement: string,
    options: { signal?: AbortSignal } = {}
): Promise<WordProblemResult> {
    if (!problemStatement.trim()) {
        throw new ApiError("Please describe the boolean logic problem.");
    }
    if (problemStatement.length > LIMITS.MAX_PROBLEM_LENGTH) {
        throw new ApiError(
            `The problem description is too long (${problemStatement.length} characters). ` +
            `Maximum supported length is ${LIMITS.MAX_PROBLEM_LENGTH}.`
        );
    }

    // Combine caller's signal (stale-request cancel) with a timeout signal.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);

    try {
        const response = await fetch(`${apiBase()}/api/solve-boolean`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ problem_statement: problemStatement }),
            signal: controller.signal
        });

        if (!response.ok) {
            let detail = `Request failed (${response.status})`;
            try {
                const body = await response.json();
                if (body && typeof body.detail === "string") detail = body.detail;
            } catch {
                // keep default message
            }
            throw new ApiError(detail);
        }

        const data = await response.json();
        return {
            variables: Array.isArray(data.variables) ? data.variables.map(String) : [],
            minterms: Array.isArray(data.minterms) ? data.minterms.map(Number) : [],
            dontCares: Array.isArray(data.dont_cares) ? data.dont_cares.map(Number) : [],
            variableDescriptions:
                data.variable_descriptions && typeof data.variable_descriptions === "object"
                    ? data.variable_descriptions as Record<string, string>
                    : undefined
        };
    } catch (err) {
        if (err instanceof ApiError) throw err;
        if (err instanceof DOMException && err.name === "AbortError") {
            throw new ApiError(
                "The AI backend did not respond in time. Please try again in a moment."
            );
        }
        throw new ApiError(
            "Could not reach the AI backend. Check your connection and try again."
        );
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onExternalAbort);
    }
}
