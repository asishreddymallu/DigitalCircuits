/**
 * Input controls: mode switching, dynamic help text, example presets and the
 * per-circuit zoom & pan engine.
 */

import { byId } from "./dom";
import { clearResults } from "./results";
import { generateTruthTableInput } from "./truthTableInput";

/* ------------------------------------------------------------------ */
/* Zoom & pan                                                          */
/* ------------------------------------------------------------------ */

interface ZoomState {
    scale: number;
    panX: number;
    panY: number;
    isDragging: boolean;
    startX: number;
    startY: number;
}

const zoomStates: Record<string, ZoomState> = {
    basicCircuit: freshZoom(),
    nandCircuit: freshZoom(),
    norCircuit: freshZoom()
};

function freshZoom(): ZoomState {
    return { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
}

function applyZoomPan(containerId: string): void {
    const container = document.getElementById(containerId);
    const svg = container?.querySelector("svg");
    if (!svg) return;
    const s = zoomStates[containerId];
    svg.style.transform = `translate(${s.panX}px, ${s.panY}px) scale(${s.scale})`;
}

export function resetZoomPan(containerId: string): void {
    zoomStates[containerId] = freshZoom();
    applyZoomPan(containerId);
}

export function initZoomPanControls(onSound?: (isHigh: boolean) => void): void {
    document.querySelectorAll<HTMLButtonElement>(".zoom-in-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            if (target && zoomStates[target]) {
                zoomStates[target].scale = Math.min(3.0, zoomStates[target].scale + 0.2);
                applyZoomPan(target);
                onSound?.(true);
            }
        });
    });

    document.querySelectorAll<HTMLButtonElement>(".zoom-out-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            if (target && zoomStates[target]) {
                zoomStates[target].scale = Math.max(0.4, zoomStates[target].scale - 0.2);
                applyZoomPan(target);
                onSound?.(false);
            }
        });
    });

    document.querySelectorAll<HTMLButtonElement>(".zoom-reset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            if (target) resetZoomPan(target);
        });
    });

    ["basicCircuit", "nandCircuit", "norCircuit"].forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;

        container.addEventListener("wheel", (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            zoomStates[id].scale = Math.min(3.0, Math.max(0.4, zoomStates[id].scale + delta));
            applyZoomPan(id);
        }, { passive: false });

        container.addEventListener("mousedown", (e: MouseEvent) => {
            if (e.button !== 0) return;
            zoomStates[id].isDragging = true;
            zoomStates[id].startX = e.clientX - zoomStates[id].panX;
            zoomStates[id].startY = e.clientY - zoomStates[id].panY;
            container.style.cursor = "grabbing";
        });

        window.addEventListener("mousemove", (e: MouseEvent) => {
            if (!zoomStates[id].isDragging) return;
            zoomStates[id].panX = e.clientX - zoomStates[id].startX;
            zoomStates[id].panY = e.clientY - zoomStates[id].startY;
            applyZoomPan(id);
        });

        window.addEventListener("mouseup", () => {
            if (zoomStates[id]) {
                zoomStates[id].isDragging = false;
                container.style.cursor = "grab";
            }
        });
    });
}

/* ------------------------------------------------------------------ */
/* Mode-dependent input sections                                       */
/* ------------------------------------------------------------------ */

export function updateNumericExamples(): void {
    const mintermVariables = byId<HTMLSelectElement>("mintermVariables");
    const maxtermVariables = byId<HTMLSelectElement>("maxtermVariables");

    const minCount = Number(mintermVariables.value);
    byId<HTMLElement>("mintermExample").innerHTML =
        `Valid minterms: <strong>0 to ${(1 << minCount) - 1}</strong> (e.g. 1, 3, 5)`;

    const maxCount = Number(maxtermVariables.value);
    byId<HTMLElement>("maxtermExample").innerHTML =
        `Valid maxterms: <strong>0 to ${(1 << maxCount) - 1}</strong> (e.g. 0, 2, 4)`;

    updateDontCareExamples();
}

export function updateDontCareExamples(): void {
    const count = Number(byId<HTMLSelectElement>("dontCareVariables").value);
    byId<HTMLElement>("dontCareExample").innerHTML =
        `Valid terms: <strong>0 to ${(1 << count) - 1}</strong> (e.g. Minterms: 1,3,7 &nbsp; Don't Cares: 0,5)`;
}

export function updateInputInterface(): void {
    const type = byId<HTMLSelectElement>("inputType").value;

    const sections: Record<string, string> = {
        expression: "expressionSection",
        minterms: "mintermSection",
        maxterms: "maxtermSection",
        dontCare: "dontCareSection",
        truthTable: "truthTableSection",
        wordProblem: "wordProblemSection",
        circuitImage: "circuitImageSection"
    };

    Object.entries(sections).forEach(([mode, id]) => {
        document.getElementById(id)?.classList.toggle("hidden", mode !== type);
    });

    clearResults();
}

/* ------------------------------------------------------------------ */
/* Example presets                                                     */
/* ------------------------------------------------------------------ */

const EXAMPLE_PRESETS = [
    { expression: "A'B + B·C", description: "3-variable SOP" },
    { expression: "A·B + A'C", description: "3-variable multiplex" },
    { expression: "(A+B)(A'+C)", description: "3-variable POS" },
    { expression: "A·B·C + A'B'C'", description: "Minterms 0 and 7" },
    { expression: "A·B + A·C + B·C", description: "Majority function" },
    { expression: "A^B", description: "XOR 2-var" },
    { expression: "A'B'C + A'BC' + AB'C' + A·B·C", description: "Full Adder Sum" }
];

const WORD_PROBLEM_PRESETS = [
    { problem: "A laboratory door opens when the identity card and PIN are both valid, or when emergency mode is active and either the PIN is correct or faculty authorization is present.", description: "Lab door access" },
    { problem: "A warning light turns on when the engine is overheating, or when the oil pressure is low and the ignition is on.", description: "Engine warning light" },
    { problem: "A student passes the course if they attend at least 75% of the classes and pass the final exam, or if they have special approval from the dean.", description: "Course pass condition" },
    { problem: "A smart irrigation system waters the garden if the soil is dry and it is not raining, or if the manual override switch is turned on.", description: "Smart irrigation" },
    { problem: "An alarm sounds if a window is open and the security system is armed, or if the smoke detector is triggered regardless of the armed state.", description: "Home alarm system" }
];

let exampleIndex = 0;
let wordProblemExampleIndex = 0;

/** Wire all step-1 controls. Called once at startup. */
export function initInputControls(onSound?: (isHigh: boolean) => void): void {
    const inputType = byId<HTMLSelectElement>("inputType");
    const mintermVariables = byId<HTMLSelectElement>("mintermVariables");
    const maxtermVariables = byId<HTMLSelectElement>("maxtermVariables");
    const dontCareVariables = byId<HTMLSelectElement>("dontCareVariables");
    const truthVariables = byId<HTMLSelectElement>("truthVariables");
    const expressionInput = byId<HTMLInputElement>("expression");
    const problemStatementInput = byId<HTMLTextAreaElement>("problemStatement");

    inputType.addEventListener("change", () => {
        updateInputInterface();
        onSound?.(true);
    });
    mintermVariables.addEventListener("change", updateNumericExamples);
    maxtermVariables.addEventListener("change", updateNumericExamples);
    dontCareVariables.addEventListener("change", updateDontCareExamples);
    truthVariables.addEventListener("change", () =>
        generateTruthTableInput(Number(truthVariables.value)));

    // Expression example cycler.
    const tryExampleBtn = byId<HTMLButtonElement>("tryExampleBtn");
    tryExampleBtn.addEventListener("click", () => {
        onSound?.(true);
        inputType.value = "expression";
        updateInputInterface();
        const preset = EXAMPLE_PRESETS[exampleIndex % EXAMPLE_PRESETS.length];
        expressionInput.value = preset.expression;
        expressionInput.focus();
        tryExampleBtn.textContent = preset.description;
        exampleIndex++;
    });

    // Word-problem example cycler.
    const tryWordBtn = byId<HTMLButtonElement>("tryWordProblemExampleBtn");
    tryWordBtn.addEventListener("click", () => {
        onSound?.(true);
        const preset = WORD_PROBLEM_PRESETS[wordProblemExampleIndex % WORD_PROBLEM_PRESETS.length];
        problemStatementInput.value = preset.problem;
        problemStatementInput.focus();
        tryWordBtn.textContent = preset.description;
        wordProblemExampleIndex++;
    });
}
