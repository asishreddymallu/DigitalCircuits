/**
 * Editable truth-table input (Step 1, "Truth Table" mode).
 */

import { generateCombinations } from "../../../shared/ts/boolean/ast";
import { byId, escapeHtml } from "./dom";
import { generateVariableNames, TruthSelection } from "../solver";

/** Render the editable output column for every input combination. */
export function generateTruthTableInput(variableCount: number): void {
    const host = byId<HTMLDivElement>("userTruthTable");
    const variables = generateVariableNames(variableCount);
    const combinations = generateCombinations(variableCount);

    let html = `<table class="truth-table"><thead><tr>`;
    variables.forEach(v => { html += `<th>${escapeHtml(v)}</th>`; });
    html += `<th>Output (F)</th></tr></thead><tbody>`;

    combinations.forEach((inputs, index) => {
        html += `<tr>`;
        inputs.forEach(v => { html += `<td>${v}</td>`; });
        html += `<td>
            <select class="tt-input-select" data-row="${index}" aria-label="Output for row ${index}">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="X">X (Don't Care)</option>
            </select>
        </td></tr>`;
    });

    html += `</tbody></table>`;
    host.innerHTML = html;
}

/** Read the current selections in row order. */
export function readTruthTableSelections(): TruthSelection[] {
    const host = byId<HTMLDivElement>("userTruthTable");
    return Array.from(host.querySelectorAll<HTMLSelectElement>(".tt-input-select"))
        .map(sel => sel.value as TruthSelection);
}

/**
 * Parse a pasted CSV/text truth table and apply it to the editable table.
 * Validates row count, output values, and provides specific error messages.
 */
export function parsePastedTruthTable(text: string): string | null {
    const lines = text.trim().split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return "No data to parse.";

    // Detect if first line is a header (contains letters but no 0/1/X)
    let startIdx = 0;
    const firstLine = lines[0];
    const hasHeader = /[A-Za-z]/.test(firstLine) && !/[01Xx]/.test(firstLine.replace(/[A-Za-z]/g, ""));
    if (hasHeader) startIdx = 1;

    // Parse separator: comma, tab, or multiple spaces
    function parseLine(line: string): string[] {
        if (line.includes(",")) return line.split(",").map(s => s.trim());
        if (line.includes("\t")) return line.split("\t").map(s => s.trim());
        return line.split(/\s+/).map(s => s.trim());
    }

    // Determine number of variables from the data
    const dataLines = lines.slice(startIdx);
    if (dataLines.length === 0) return "No data rows found after header.";

    const firstDataFields = parseLine(dataLines[0]);
    const numCols = firstDataFields.length;
    const numVars = numCols - 1; // last column is output

    if (numVars < 1 || numVars > 6) {
        return `Detected ${numVars} variable(s). Supported range: 1-6. Each row must have ${numVars + 1} columns (inputs + output).`;
    }

    const expectedRows = 1 << numVars;
    if (dataLines.length !== expectedRows) {
        return `Expected exactly ${expectedRows} rows for ${numVars} variable(s), but found ${dataLines.length}. Each unique input combination must appear exactly once.`;
    }

    // Validate output values are binary (0, 1, X, or -)
    const validOutput = /^[01Xx\-]$/;
    for (let i = 0; i < dataLines.length; i++) {
        const fields = parseLine(dataLines[i]);
        const outputVal = fields[fields.length - 1];
        if (!validOutput.test(outputVal)) {
            return `Row ${i + 1 + startIdx}: invalid output value "${outputVal}". Expected 0, 1, X, or -.`;
        }
        if (fields.length !== numCols) {
            return `Row ${i + 1 + startIdx}: expected ${numCols} columns but found ${fields.length}.`;
        }
    }

    // Set the variable count dropdown
    const varSelect = byId<HTMLSelectElement>("truthVariables");
    varSelect.value = String(numVars);
    generateTruthTableInput(numVars);

    // Parse and apply the output values
    const host = byId<HTMLDivElement>("userTruthTable");
    const selects = Array.from(host.querySelectorAll<HTMLSelectElement>(".tt-input-select"));

    dataLines.forEach((line, idx) => {
        const fields = parseLine(line);
        const outputVal = fields[fields.length - 1].toUpperCase();
        if (idx < selects.length) {
            if (outputVal === "1") selects[idx].value = "1";
            else if (outputVal === "0") selects[idx].value = "0";
            else if (outputVal === "X" || outputVal === "-") selects[idx].value = "X";
        }
    });

    return null; // null = success
}

/** Wire up paste/upload controls. Called once at init. */
export function initTruthTableIO(): void {
    // Parse paste button
    const parseBtn = byId<HTMLButtonElement>("parseTruthTablePasteBtn");
    if (parseBtn) {
        parseBtn.addEventListener("click", () => {
            const textarea = byId<HTMLTextAreaElement>("truthTablePaste");
            if (textarea && textarea.value.trim()) {
                const error = parsePastedTruthTable(textarea.value);
                if (error) {
                    const statusEl = byId<HTMLElement>("truthTablePasteStatus");
                    if (statusEl) {
                        statusEl.textContent = error;
                        statusEl.className = "help-text status-error";
                        statusEl.classList.remove("hidden");
                        setTimeout(() => statusEl.classList.add("hidden"), 6000);
                    }
                }
            }
        });
    }

    // File upload
    const fileInput = byId<HTMLInputElement>("truthTableFileInput");
    if (fileInput) {
        fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const text = reader.result as string;
                const textarea = byId<HTMLTextAreaElement>("truthTablePaste");
                if (textarea) textarea.value = text;
                parsePastedTruthTable(text);
            };
            reader.readAsText(file);
        });
    }
}
