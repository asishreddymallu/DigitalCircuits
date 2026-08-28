/**
 * Truth Table → Circuit import for Web4.
 *
 * Allows users to input a truth table and auto-generate the corresponding
 * SOP circuit in the playground.
 */

import { getPrimeImplicants } from "../../shared/ts/boolean/minimizer";
import { buildBasicSOPCircuit, resetCircuitIds } from "../../Web1/src/circuits/circuitGraph";
import { convertWeb1Circuit, importSharedToWeb4 } from "../../shared/ts/circuit/interop";
import type { PlaygroundNode, Wire } from "./types";

export interface TruthTableInput {
    variables: string[];
    /** Output value for each row, MSB-first order. */
    outputs: number[];
}

export interface GeneratedCircuit {
    nodes: PlaygroundNode[];
    wires: Wire[];
    inputNodeIds: string[];
    outputNodeIds: string[];
}

/**
 * Show the truth table import dialog.
 * Returns a promise that resolves with the generated circuit or null if cancelled.
 */
export function showTruthTableDialog(): Promise<GeneratedCircuit | null> {
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement("div");
        overlay.className = "w4-tt-overlay";
        overlay.innerHTML = `
            <div class="w4-tt-dialog">
                <div class="w4-tt-header">
                    <h3>📋 Import from Truth Table</h3>
                    <button type="button" class="w4-tt-close" aria-label="Close">&times;</button>
                </div>
                <div class="w4-tt-body">
                    <div class="w4-tt-row">
                        <label for="w4-tt-vars">Variables (comma-separated):</label>
                        <input type="text" id="w4-tt-vars" value="A, B, C" placeholder="A, B, C" />
                    </div>
                    <div class="w4-tt-row">
                        <label>Output values (one per row, MSB-first):</label>
                        <div id="w4-tt-table" class="w4-tt-table"></div>
                    </div>
                    <div class="w4-tt-row">
                        <label for="w4-tt-outputs">Or paste output column:</label>
                        <input type="text" id="w4-tt-outputs" placeholder="0,0,0,1,0,1,1,1" />
                    </div>
                    <div id="w4-tt-error" class="w4-tt-error" style="display:none;"></div>
                </div>
                <div class="w4-tt-footer">
                    <button type="button" class="w4-tt-cancel">Cancel</button>
                    <button type="button" class="w4-tt-generate solve-button">Generate Circuit</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const varsInput = overlay.querySelector<HTMLInputElement>("#w4-tt-vars")!;
        const outputsInput = overlay.querySelector<HTMLInputElement>("#w4-tt-outputs")!;
        const tableContainer = overlay.querySelector<HTMLElement>("#w4-tt-table")!;
        const errorDiv = overlay.querySelector<HTMLElement>("#w4-tt-error")!;
        const closeBtn = overlay.querySelector<HTMLButtonElement>(".w4-tt-close")!;
        const cancelBtn = overlay.querySelector<HTMLButtonElement>(".w4-tt-cancel")!;
        const generateBtn = overlay.querySelector<HTMLButtonElement>(".w4-tt-generate")!;

        function cleanup() {
            overlay.remove();
        }

        function showError(msg: string) {
            errorDiv.textContent = msg;
            errorDiv.style.display = "";
        }

        function hideError() {
            errorDiv.style.display = "none";
        }

        function renderTable() {
            const vars = varsInput.value.split(",").map(v => v.trim()).filter(Boolean);
            const count = 1 << vars.length;
            let html = "<table><thead><tr>";
            vars.forEach(v => { html += `<th>${v}</th>`; });
            html += "<th>F</th></tr></thead><tbody>";

            for (let i = 0; i < count; i++) {
                html += "<tr>";
                for (let j = 0; j < vars.length; j++) {
                    html += `<td>${(i >> (vars.length - 1 - j)) & 1}</td>`;
                }
                html += `<td class="w4-tt-output-cell" data-row="${i}" tabindex="0" role="button" aria-label="Toggle output for row ${i}">0</td>`;
                html += "</tr>";
            }
            html += "</tbody></table>";
            tableContainer.innerHTML = html;

            // Sync from paste input
            const pasteVals = outputsInput.value.split(",").map(v => v.trim()).filter(Boolean);
            if (pasteVals.length === count) {
                tableContainer.querySelectorAll<HTMLElement>(".w4-tt-output-cell").forEach(cell => {
                    const row = Number(cell.dataset.row);
                    cell.textContent = pasteVals[row] || "0";
                });
            }

            // Click to toggle
            tableContainer.querySelectorAll<HTMLElement>(".w4-tt-output-cell").forEach(cell => {
                cell.addEventListener("click", () => {
                    cell.textContent = cell.textContent === "1" ? "0" : "1";
                    syncOutputInput();
                });
                cell.addEventListener("keydown", (e: KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        cell.textContent = cell.textContent === "1" ? "0" : "1";
                        syncOutputInput();
                    }
                });
            });
        }

        function syncOutputInput() {
            const cells = tableContainer.querySelectorAll<HTMLElement>(".w4-tt-output-cell");
            const vals: string[] = [];
            cells.forEach(c => vals.push(c.textContent || "0"));
            outputsInput.value = vals.join(",");
        }

        function readOutputs(): number[] {
            const cells = tableContainer.querySelectorAll<HTMLElement>(".w4-tt-output-cell");
            const vals: number[] = [];
            cells.forEach(c => vals.push(c.textContent === "1" ? 1 : 0));
            return vals;
        }

        // Events
        varsInput.addEventListener("change", renderTable);
        outputsInput.addEventListener("input", () => {
            const vars = varsInput.value.split(",").map(v => v.trim()).filter(Boolean);
            const count = 1 << vars.length;
            const pasteVals = outputsInput.value.split(",").map(v => v.trim()).filter(Boolean);
            if (pasteVals.length === count) {
                tableContainer.querySelectorAll<HTMLElement>(".w4-tt-output-cell").forEach(cell => {
                    const row = Number(cell.dataset.row);
                    cell.textContent = pasteVals[row] || "0";
                });
            }
        });

        closeBtn.addEventListener("click", () => { cleanup(); resolve(null); });
        cancelBtn.addEventListener("click", () => { cleanup(); resolve(null); });
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) { cleanup(); resolve(null); }
        });

        generateBtn.addEventListener("click", () => {
            hideError();
            const vars = varsInput.value.split(",").map(v => v.trim()).filter(Boolean);
            if (vars.length === 0 || vars.length > 6) {
                showError("Enter 1–6 variable names.");
                return;
            }

            // Check for duplicate variable names
            if (new Set(vars).size !== vars.length) {
                showError("Variable names must be unique.");
                return;
            }

            const outputs = readOutputs();
            const expected = 1 << vars.length;
            if (outputs.length !== expected) {
                showError(`Expected ${expected} output values, got ${outputs.length}.`);
                return;
            }

            // Derive minterms
            const minterms: number[] = [];
            for (let i = 0; i < outputs.length; i++) {
                if (outputs[i] === 1) minterms.push(i);
            }

            if (minterms.length === 0) {
                showError("All outputs are 0 — the circuit would be constant 0. Add at least one 1.");
                return;
            }

            if (minterms.length === expected) {
                showError("All outputs are 1 — the circuit would be constant 1. Add at least one 0.");
                return;
            }

            // Build Web1 circuit via prime implicants
            const implicants = getPrimeImplicants(minterms, vars.length);
            resetCircuitIds();
            const web1Circuit = buildBasicSOPCircuit(implicants, vars);

            // Convert to shared then to Web4
            const shared = convertWeb1Circuit(web1Circuit);
            const w4 = importSharedToWeb4(shared);

            cleanup();
            resolve(w4);
        });

        // Initial render
        renderTable();
    });
}

