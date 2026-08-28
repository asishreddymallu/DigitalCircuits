/**
 * Boolean Logic Solver — entry point.
 *
 * Wires the step-1 input controls, runs the async word-problem path against
 * the AI backend (with stale-request cancellation), and delegates all math
 * to Web1/src/solver.ts and rendering to Web1/src/ui/*.
 */

import "./legacy-shims";

import { byId } from "./ui/dom";
import {
    buildSolverModel,
    SolverInputError,
    RawInputs,
    parseNumberList
} from "./solverCore";
import { fetchMintermsFromProblem, analyzeCircuitImage, preprocessImage } from "./ai/booleanApi";
import { web1ToCircuitFile, storeImportedCircuit } from "../../shared/ts/circuit/interop";
import { state } from "./state";
import type { CircuitGraph } from "./circuits/circuitGraph";
import { initInputControls, updateNumericExamples, initZoomPanControls } from "./ui/controls";
import { setupWaveformControls } from "./ui/waveform";
import { generateTruthTableInput, readTruthTableSelections } from "./ui/truthTableInput";
import {
    renderResults,
    clearError,
    clearWordProblemStatus,
    setWordProblemStatus,
    showWordProblemLegend,
    showError
} from "./ui/results";

function sound(isHigh: boolean): void {
    if (window.StudioFX) window.StudioFX.click(isHigh);
}

/** Collect raw inputs from the DOM according to the selected mode. */
function collectRawInputs(): RawInputs {
    const mode = byId<HTMLSelectElement>("inputType").value as RawInputs["mode"];

    switch (mode) {
        case "expression":
            return { mode, expression: byId<HTMLInputElement>("expression").value };
        case "minterms":
            return {
                mode,
                mintermCount: Number(byId<HTMLSelectElement>("mintermVariables").value),
                mintermList: parseNumberList(byId<HTMLInputElement>("minterms").value)
            };
        case "maxterms":
            return {
                mode,
                maxtermCount: Number(byId<HTMLSelectElement>("maxtermVariables").value),
                maxtermList: parseNumberList(byId<HTMLInputElement>("maxterms").value)
            };
        case "dontCare":
            return {
                mode,
                dontCareCount: Number(byId<HTMLSelectElement>("dontCareVariables").value),
                dontCareMintermList: parseNumberList(byId<HTMLInputElement>("dontCareMinterms").value),
                dontCareList: parseNumberList(byId<HTMLInputElement>("dontCares").value)
            };
        case "truthTable":
            return { mode, truthSelections: readTruthTableSelections() };
        case "wordProblem":
            return { mode };
        case "circuitImage":
            return { mode };
    }
}

let activeAiRequest: AbortController | null = null;

async function runWordProblem(): Promise<RawInputs["wordProblem"]> {
    const statement = byId<HTMLTextAreaElement>("problemStatement").value.trim();
    if (!statement) throw new SolverInputError("Please describe the boolean logic problem.");

    // Cancel any in-flight request from a previous Solve click.
    activeAiRequest?.abort();
    const controller = new AbortController();
    activeAiRequest = controller;

    clearWordProblemStatus();
    setWordProblemStatus("Asking the AI backend to work out the minterms...");
    byId<HTMLButtonElement>("solveButton").disabled = true;

    try {
        const parsed = await fetchMintermsFromProblem(statement, { signal: controller.signal });
        showWordProblemLegend(parsed.variables, parsed.variableDescriptions);
        return {
            variables: parsed.variables,
            minterms: parsed.minterms,
            dontCares: parsed.dontCares
        };
    } catch (err) {
        if (controller.signal.aborted && !activeAiRequest?.signal.aborted) {
            // superseded — swallow silently; a newer solve is running
            throw new SolverInputError("__superseded__");
        }
        if (err instanceof Error && err.name === "AbortError") {
            setWordProblemStatus("Request cancelled.", true);
            throw new SolverInputError("__cancelled__");
        }
        const message = err instanceof Error ? err.message : String(err);
        setWordProblemStatus(`Couldn't solve that problem: ${message}`, true);
        throw new SolverInputError(
            "AI conversion failed - see the message above the results for details."
        );
    } finally {
        if (activeAiRequest === controller) activeAiRequest = null;
        byId<HTMLButtonElement>("solveButton").disabled = false;
    }
}

async function solve(): Promise<void> {
    clearError();
    try {
        let raw = collectRawInputs();

        if (raw.mode === "wordProblem") {
            const wp = await runWordProblem();
            if (!wp) return; // superseded or cancelled
            raw = { ...raw, wordProblem: wp };
        }

        if (raw.mode === "circuitImage") {
            const ci = await runCircuitImage();
            if (!ci) return; // superseded or cancelled
            raw = { ...raw, circuitImage: ci };
        }

        const model = buildSolverModel(raw);
        renderResults(model, { onSound: () => window.StudioFX?.success(), onClickSound: sound });

    } catch (error) {
        if (error instanceof Error && /__(superseded|cancelled)__/.test(error.message)) return;
        console.error(error);
        const errMsg = error instanceof SolverInputError || error instanceof Error
            ? error.message
            : String(error);
        showError(errMsg);
    }
}

let circuitImageDataUrl: string | null = null;

async function runCircuitImage(): Promise<RawInputs["circuitImage"]> {
    if (!circuitImageDataUrl) throw new SolverInputError("Please upload a circuit image first.");

    activeAiRequest?.abort();
    const controller = new AbortController();
    activeAiRequest = controller;

    const statusEl = byId<HTMLElement>("circuitImageStatus");
    statusEl.textContent = "Analyzing circuit image...";
    statusEl.className = "help-text circuit-image-status status-loading";
    statusEl.classList.remove("hidden");
    byId<HTMLButtonElement>("solveButton").disabled = true;

    try {
        const result = await analyzeCircuitImage(circuitImageDataUrl, { signal: controller.signal });

        if (!result.variables || result.variables.length === 0) {
            statusEl.textContent = "The circuit image could not be interpreted confidently. Please try a clearer image.";
            statusEl.className = "help-text circuit-image-status status-error";
            throw new SolverInputError("Could not interpret the circuit image.");
        }

        if (result.confidence !== undefined && result.confidence < 0.5) {
            statusEl.textContent = `Low confidence (${Math.round(result.confidence * 100)}%). Results may be inaccurate.`;
            statusEl.className = "help-text circuit-image-status status-loading";
        } else {
            statusEl.textContent = "Circuit analysis complete!";
            statusEl.className = "help-text circuit-image-status status-success";
        }

        return {
            variables: result.variables,
            minterms: result.minterms,
            dontCares: result.dontCares,
            expression: result.expression,
        };
    } catch (err) {
        if (controller.signal.aborted && !activeAiRequest?.signal.aborted) {
            throw new SolverInputError("__superseded__");
        }
        if (err instanceof Error && err.name === "AbortError") {
            statusEl.textContent = "Request cancelled.";
            statusEl.className = "help-text circuit-image-status status-error";
            throw new SolverInputError("__cancelled__");
        }
        const message = err instanceof Error ? err.message : String(err);
        statusEl.textContent = `Analysis failed: ${message}`;
        statusEl.className = "help-text circuit-image-status status-error";
        throw new SolverInputError("Circuit image analysis failed.");
    } finally {
        if (activeAiRequest === controller) activeAiRequest = null;
        byId<HTMLButtonElement>("solveButton").disabled = false;
    }
}

function initCircuitImageUpload(): void {
    const dropZone = byId<HTMLDivElement>("circuitImageDropZone");
    const fileInput = byId<HTMLInputElement>("circuitImageInput");
    const placeholder = byId<HTMLDivElement>("circuitImagePlaceholder");
    const preview = byId<HTMLDivElement>("circuitImagePreview");
    const img = byId<HTMLImageElement>("circuitImageImg");
    const status = byId<HTMLElement>("circuitImageStatus");
    const replaceBtn = byId<HTMLButtonElement>("circuitImageReplaceBtn");
    const removeBtn = byId<HTMLButtonElement>("circuitImageRemoveBtn");

    async function handleFile(file: File) {
        if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
            status.textContent = "Unsupported format. Please use PNG, JPEG, or WebP.";
            status.className = "help-text circuit-image-status status-error";
            status.classList.remove("hidden");
            return;
        }

        try {
            status.textContent = "Processing image...";
            status.className = "help-text circuit-image-status status-loading";
            status.classList.remove("hidden");

            circuitImageDataUrl = await preprocessImage(file);
            img.src = circuitImageDataUrl;
            placeholder.classList.add("hidden");
            preview.classList.remove("hidden");
            status.textContent = "Image ready. Click Solve to analyze.";
            status.className = "help-text circuit-image-status status-success";
        } catch (e) {
            status.textContent = "Failed to process image.";
            status.className = "help-text circuit-image-status status-error";
            circuitImageDataUrl = null;
        }
    }

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        const file = e.dataTransfer?.files[0];
        if (file) handleFile(file);
    });

    fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) handleFile(file);
    });

    replaceBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        circuitImageDataUrl = null;
        img.src = "";
        placeholder.classList.remove("hidden");
        preview.classList.add("hidden");
        fileInput.value = "";
        status.classList.add("hidden");
    });

    // Click on drop zone to open file picker
    dropZone.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest(".circuit-image-actions")) return;
        fileInput.click();
    });
}

function init(): void {
    initInputControls(sound);
    initCircuitImageUpload();
    setupWaveformControls();
    updateNumericExamples();
    generateTruthTableInput(Number(byId<HTMLSelectElement>("truthVariables").value));
    initZoomPanControls(sound);

    byId<HTMLButtonElement>("solveButton").addEventListener("click", () => {
        void solve();
    });

    // Open in Circuit Playground buttons (Basic / NAND / NOR)
    const playgroundButtons: Array<[string, () => CircuitGraph | null]> = [
        ["openBasicBtn", () => state.graphs.basic],
        ["openNandBtn", () => state.graphs.nand],
        ["openNorBtn", () => state.graphs.nor],
    ];

    for (const [btnId, getGraph] of playgroundButtons) {
        const btn = byId<HTMLButtonElement>(btnId);
        if (!btn) continue;

        btn.addEventListener("click", () => {
            const graph = getGraph();
            if (!graph) return;

            const label = btnId === "openBasicBtn"
                ? "Basic Gate Circuit"
                : btnId === "openNandBtn"
                    ? "NAND-Only Circuit"
                    : "NOR-Only Circuit";

            const circuitFile = web1ToCircuitFile(graph, label);
            storeImportedCircuit(circuitFile);
            window.location.href = "../Web4/index.html";
        });
    }
}

init();
