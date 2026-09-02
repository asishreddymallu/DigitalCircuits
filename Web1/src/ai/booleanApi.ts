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

export interface TimingDiagramResult {
    signals: Array<{
        name: string;
        values: number[];
        is_output: boolean;
    }>;
    time_steps: number;
    confidence?: number;
}

export async function analyzeTimingDiagram(
    imageDataUrl: string,
    options: { signal?: AbortSignal } = {}
): Promise<TimingDiagramResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);

    try {
        const response = await fetch(`${apiBase()}/api/analyze-timing-diagram`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageDataUrl }),
            signal: controller.signal
        });

        if (!response.ok) {
            let detail = `Request failed (${response.status})`;
            try {
                const body = await response.json();
                if (body && typeof body.detail === "string") detail = body.detail;
            } catch { /* keep default */ }
            throw new ApiError(detail);
        }

        const data = await response.json();
        return {
            signals: Array.isArray(data.signals) ? data.signals : [],
            time_steps: typeof data.time_steps === "number" ? data.time_steps : 16,
            confidence: typeof data.confidence === "number" ? data.confidence : undefined,
        };
    } catch (err) {
        if (err instanceof ApiError) throw err;
        if (err instanceof DOMException && err.name === "AbortError") {
            throw new ApiError("The AI backend did not respond in time. Please try again.");
        }
        throw new ApiError("Could not reach the AI backend for timing diagram analysis.");
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onExternalAbort);
    }
}

export interface CircuitImageResult {
    variables: string[];
    minterms: number[];
    dontCares: number[];
    expression?: string;
    confidence?: number;
    circuit?: {
        inputs: string[];
        outputs: string[];
        gates: { id: string; type: string; inputs: string[]; output: string }[];
        connections: { from: string; to: string; port?: number }[];
    };
}

/**
 * Preprocess an image file: resize if too large, maintain aspect ratio.
 * Returns a base64 data URL.
 */
export function preprocessImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const MAX_DIM = 1024;
                let w = img.width;
                let h = img.height;
                if (w > MAX_DIM || h > MAX_DIM) {
                    const scale = MAX_DIM / Math.max(w, h);
                    w = Math.round(w * scale);
                    h = Math.round(h * scale);
                }
                const canvas = document.createElement("canvas");
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext("2d");
                if (!ctx) { reject(new Error("Canvas not available")); return; }
                ctx.drawImage(img, 0, 0, w, h);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = () => reject(new Error("Failed to load image"));
            img.src = reader.result as string;
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });
}

/**
 * Send a circuit image to the AI backend for analysis.
 */
export async function analyzeCircuitImage(
    imageDataUrl: string,
    options: { signal?: AbortSignal } = {}
): Promise<CircuitImageResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    const onExternalAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onExternalAbort);

    try {
        const response = await fetch(`${apiBase()}/api/analyze-circuit-image`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: imageDataUrl }),
            signal: controller.signal
        });

        if (!response.ok) {
            let detail = `Request failed (${response.status})`;
            try {
                const body = await response.json();
                if (body && typeof body.detail === "string") {
                    detail = body.detail;
                } else if (body && body.detail && typeof body.detail === "object") {
                    const d = body.detail;
                    if (typeof d.message === "string") detail = d.message;
                    else if (typeof d.error === "string") detail = d.error;
                    else if (typeof d.reason === "string") detail = d.reason;
                    else detail = JSON.stringify(d);
                }
            } catch { /* keep default */ }
            throw new ApiError(detail);
        }

        const data = await response.json();
        return {
            variables: Array.isArray(data.variables) ? data.variables.map(String) : [],
            minterms: Array.isArray(data.minterms) ? data.minterms.map(Number) : [],
            dontCares: Array.isArray(data.dont_cares) ? data.dont_cares.map(Number) : [],
            expression: typeof data.expression === "string" ? data.expression : undefined,
            confidence: typeof data.confidence === "number" ? data.confidence : undefined,
            circuit: data.circuit && typeof data.circuit === "object" ? data.circuit : undefined,
        };
    } catch (err) {
        if (err instanceof ApiError) throw err;
        if (err instanceof DOMException && err.name === "AbortError") {
            throw new ApiError("The AI backend did not respond in time. Please try again.");
        }
        throw new ApiError("Could not reach the AI backend. Check your connection and try again.");
    } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onExternalAbort);
    }
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
                if (body && typeof body.detail === "string") {
                    detail = body.detail;
                } else if (body && body.detail && typeof body.detail === "object") {
                    const d = body.detail;
                    if (typeof d.message === "string") detail = d.message;
                    else if (typeof d.error === "string") detail = d.error;
                    else if (typeof d.reason === "string") detail = d.reason;
                    else detail = JSON.stringify(d);
                }
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
