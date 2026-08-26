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
