/**
 * K-map group overlay rendering (E7 fix).
 *
 * A Quine-McCluskey implicant is always a cartesian product of a set of rows
 * and a set of columns in Gray-code order. Because Gray adjacency WRAPS
 * around the map edges, those sets are not always contiguous ranges: e.g.
 * columns {0,3} form one visual group split across both edges. Drawing a
 * single bounding rectangle over such groups would falsely cover non-member
 * cells.
 *
 * Correct approach used here:
 *   1. Split each axis's index set into maximal contiguous runs.
 *   2. Emit one rectangle per (row-run × col-run) combination.
 *
 * This yields at most four rectangles for corner-wrapping groups and never
 * implies membership of cells outside the group.
 */

import type { Implicant } from "../../../shared/ts/boolean/minimizer";
import { patternToMinterms, kmapBorderColor } from "./kmap";

/** [2,3,0] → [[0],[2,3]] ; [1,2] → [[1,2]] */
function contiguousRuns(indices: number[]): number[][] {
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const runs: number[][] = [[sorted[0]]];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i - 1] + 1) {
            runs[runs.length - 1].push(sorted[i]);
        } else {
            runs.push([sorted[i]]);
        }
    }
    return runs;
}

interface OverlaySegment {
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
}

function segmentsForImplicant(implicant: Implicant, cellCoords: Map<number, { r: number; c: number }>): OverlaySegment[] {
    const minterms = new Set(patternToMinterms(implicant.pattern));
    const rows: number[] = [];
    const cols: number[] = [];
    cellCoords.forEach((coord, minterm) => {
        if (minterms.has(minterm)) {
            rows.push(coord.r);
            cols.push(coord.c);
        }
    });
    if (rows.length === 0) return [];

    const rowRuns = contiguousRuns(rows);
    const colRuns = contiguousRuns(cols);

    // A wrapped run is only "connected" if it touches BOTH edges; otherwise
    // it is genuinely two separate runs and must be drawn separately too.
    const segments: OverlaySegment[] = [];
    for (const rr of rowRuns) {
        for (const cr of colRuns) {
            segments.push({
                minRow: rr[0],
                maxRow: rr[rr.length - 1],
                minCol: cr[0],
                maxCol: cr[cr.length - 1]
            });
        }
    }
    return segments;
}

export interface PositionOverlaysArgs {
    implicants: Implicant[];
    /** Container holding #karnaughMapGrid (the position:relative wrapper). */
    gridHost: HTMLElement | null;
}

/**
 * Create and position overlay rectangles for every implicant. Safe to call
 * repeatedly (e.g. on resize): previous overlays are removed first.
 */
export function positionKarnaughOverlays(args: PositionOverlaysArgs): void {
    const { implicants, gridHost } = args;
    if (!gridHost) return;

    // Remove segments from any previous render but keep static children
    // (the table itself).
    gridHost.querySelectorAll(".km-group-overlay").forEach(el => el.remove());

    const grid = gridHost.querySelector("#karnaughMapGrid") as HTMLElement | null;
    const table = grid?.querySelector(".karnaugh-map") as HTMLTableElement | null;
    if (!grid || !table || implicants.length === 0) return;

    // Map every cell's minterm to its (row, col) coordinates once.
    const cellCoords = new Map<number, { r: number; c: number }>();
    table.querySelectorAll<HTMLTableCellElement>("td[data-row]").forEach(cell => {
        const r = parseInt(cell.getAttribute("data-row") ?? "-1", 10);
        const c = parseInt(cell.getAttribute("data-col") ?? "-1", 10);
        const m = parseInt((cell.querySelector(".km-minterm")?.textContent ?? "").replace("m", ""), 10);
        if (!isNaN(r) && !isNaN(c) && !isNaN(m)) cellCoords.set(m, { r, c });
    });

    const gridRect = grid.getBoundingClientRect();
    const padding = 4;

    implicants.forEach((imp, i) => {
        const colorClass = `km-group-${(i % 5) + 1}`;
        const borderColor = kmapBorderColor(i);
        const segments = segmentsForImplicant(imp, cellCoords);
        const memberMinterms = new Set(patternToMinterms(imp.pattern));

        for (const seg of segments) {
            // Union of member-cell rects (robust against uneven column widths).
            let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
            let found = false;
            cellCoords.forEach((coord, minterm) => {
                if (!memberMinterms.has(minterm)) return;
                if (coord.r < seg.minRow || coord.r > seg.maxRow) return;
                if (coord.c < seg.minCol || coord.c > seg.maxCol) return;
                const cell = table.querySelector<HTMLTableCellElement>(
                    `td[data-row="${coord.r}"][data-col="${coord.c}"]`
                );
                if (!cell) return;
                const rect = cell.getBoundingClientRect();
                minLeft = Math.min(minLeft, rect.left);
                minTop = Math.min(minTop, rect.top);
                maxRight = Math.max(maxRight, rect.right);
                maxBottom = Math.max(maxBottom, rect.bottom);
                found = true;
            });
            if (!found) continue;

            const div = document.createElement("div");
            div.className = `km-group-overlay ${colorClass}`;
            div.style.display = "block";
            div.style.left = `${minLeft - gridRect.left - padding}px`;
            div.style.top = `${minTop - gridRect.top - padding}px`;
            div.style.width = `${maxRight - minLeft + 2 * padding}px`;
            div.style.height = `${maxBottom - minTop + 2 * padding}px`;
            div.style.borderColor = borderColor;
            grid.appendChild(div);
        }
    });
}
