/**
 * Karnaugh map generation.
 *
 * Cell ordering uses Gray code so horizontally/vertically adjacent cells
 * differ in exactly one variable — the property that makes visual grouping
 * valid. The map is derived from truth rows, never from a separate table.
 */

import type { TruthRow } from "../../../shared/ts/boolean/ast";
import type { Implicant } from "../../../shared/ts/boolean/minimizer";
import { termToString } from "../../../shared/ts/boolean/formatter";

export function grayCode(n: number): number[] {
    const result: number[] = [];
    const total = 1 << n;
    for (let i = 0; i < total; i++) {
        result.push(i ^ (i >> 1));
    }
    return result;
}

/** All minterms covered by an implicant pattern ('-' bits enumerate freely). */
export function patternToMinterms(pattern: string): number[] {
    const dashPositions: number[] = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "-") dashPositions.push(i);
    }
    const total = 1 << dashPositions.length;
    const result: number[] = [];

    for (let mask = 0; mask < total; mask++) {
        let minterm = 0;
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === "1") {
                minterm |= 1 << (pattern.length - 1 - i);
            } else if (pattern[i] === "-") {
                const dashPos = dashPositions.indexOf(i);
                if (mask & (1 << dashPos)) {
                    minterm |= 1 << (pattern.length - 1 - i);
                }
            }
        }
        result.push(minterm);
    }
    return result;
}

export interface KMapGridInfo {
    /** grid[row][col] = minterm index at that cell. */
    grid: number[][];
    rowCount: number;
    colCount: number;
}

export function computeKMapGrid(variableCount: number): KMapGridInfo | null {
    if (variableCount < 2 || variableCount > 4) return null;

    let colBits: number;
    let rowBits: number;
    if (variableCount === 2) { rowBits = 1; colBits = 1; }
    else if (variableCount === 3) { rowBits = 1; colBits = 2; }
    else { rowBits = 2; colBits = 2; }

    const colGray = grayCode(colBits);
    const rowGray = grayCode(rowBits);

    const grid: number[][] = [];
    for (let ri = 0; ri < rowGray.length; ri++) {
        grid[ri] = [];
        for (let ci = 0; ci < colGray.length; ci++) {
            let minterm = 0;
            for (let b = 0; b < rowBits; b++) {
                if (rowGray[ri] & (1 << (rowBits - 1 - b))) {
                    minterm |= 1 << (variableCount - 1 - b);
                }
            }
            for (let b = 0; b < colBits; b++) {
                if (colGray[ci] & (1 << (colBits - 1 - b))) {
                    minterm |= 1 << (variableCount - 1 - rowBits - b);
                }
            }
            grid[ri][ci] = minterm;
        }
    }
    return { grid, rowCount: rowGray.length, colCount: colGray.length };
}

const GROUP_COLORS = ["km-group-1", "km-group-2", "km-group-3", "km-group-4", "km-group-5"];
const BORDER_COLORS = ["#ef4444", "#2563eb", "#16a34a", "#ea580c", "#9333ea"];

export function kmapBorderColor(index: number): string {
    return BORDER_COLORS[index % BORDER_COLORS.length];
}

function labelJoin(names: string[]): string {
    return names.every(n => n.length === 1) ? names.join("") : names.join(", ");
}

export interface GenerateKMapArgs {
    variables: string[];
    rows: TruthRow[];
    dontCares?: ReadonlySet<number>;
    implicants?: Implicant[];
}

export function generateKarnaughMap(args: GenerateKMapArgs): string {
    const { variables, rows, dontCares, implicants } = args;
    const info = computeKMapGrid(variables.length);

    if (!info) {
        return `<div class="help-text" style="text-align:center;">Karnaugh maps are displayed for 2 to 4 variables.</div>`;
    }

    const { grid, rowCount, colCount } = info;
    const rowLabels = grayCode(Math.log2(rowCount)).map(v => v.toString(2).padStart(Math.log2(rowCount), "0"));
    const colLabels = grayCode(Math.log2(colCount)).map(v => v.toString(2).padStart(Math.log2(colCount), "0"));
    const rowBits = Math.log2(rowCount);
    const colBits = Math.log2(colCount);
    const rowVarStr = labelJoin(variables.slice(0, rowBits));
    const colVarStr = labelJoin(variables.slice(rowBits));

    const legendHTML = (implicants && implicants.length > 0)
        ? `<div class="karnaugh-map-legend">
            ${implicants.map((imp, i) => `
                <span class="legend-item">
                    <span class="legend-swatch" style="border-color:${kmapBorderColor(i)};background:${kmapBorderColor(i)}20"></span>
                    ${termToString(imp.pattern, variables)}
                </span>`).join("")}
        </div>`
        : "";

    let html = `<div class="karnaugh-map-wrapper">`;
    html += `<div id="karnaughMapGrid" style="position:relative;display:inline-block;">`;
    html += `<table class="karnaugh-map">`;

    html += `<thead><tr><th style="font-size:14px;">${rowVarStr}\\${colVarStr}</th>`;
    for (const label of colLabels) html += `<th>${label}</th>`;
    html += `</tr></thead><tbody>`;

    for (let ri = 0; ri < rowCount; ri++) {
        html += `<tr><th>${rowLabels[ri]}</th>`;
        for (let ci = 0; ci < colCount; ci++) {
            const minterm = grid[ri][ci];
            const output = rows[minterm]?.output;
            let cellClass = "km-zero";
            let cellValue = "0";
            if (dontCares?.has(minterm)) {
                cellClass = "km-dontcare";
                cellValue = "X";
            } else if (output === 1) {
                cellClass = "km-one";
                cellValue = "1";
            } else if (output === -1) {
                cellClass = "km-dontcare";
                cellValue = "X";
            }
            html += `<td class="${cellClass}" data-row="${ri}" data-col="${ci}">
                <span class="km-minterm">m${minterm}</span>
                <span class="km-value">${cellValue}</span>
            </td>`;
        }
        html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    // Overlay segments are created by overlays.ts after layout measurement.
    if (legendHTML) html += legendHTML;
    html += `</div>`;
    return html;
}
