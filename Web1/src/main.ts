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
import { fetchMintermsFromProblem } from "./ai/booleanApi";
import { initInputControls, updateNumericExamples, initZoomPanControls } from "./ui/controls";
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

function init(): void {
    initInputControls(sound);
    updateNumericExamples();
    generateTruthTableInput(Number(byId<HTMLSelectElement>("truthVariables").value));
    initZoomPanControls(sound);

    byId<HTMLButtonElement>("solveButton").addEventListener("click", () => {
        void solve();
    });
}

init();
