/**
 * Live probe controller: input switches, schematic pin toggles, wire coloring
 * and the multimeter HUD.
 */

import { byId, escapeHtml } from "./dom";
import { state } from "../state";
import {
    evaluateAllNodeValues
} from "../circuits/circuitGraph";
import type { CircuitGraph } from "../circuits/circuitGraph";

export interface ProbeCallbacks {
    onSound?(isHigh: boolean): void;
}

/** Rebuild the three probe panels for a freshly solved function. */
export function setupProbePanels(variables: string[], callbacks: ProbeCallbacks = {}): void {
    state.probeState = {};
    variables.forEach(v => { state.probeState[v] = false; });

    ["probeSwitchesBasic", "probeSwitchesNand", "probeSwitchesNor"].forEach(panelId => {
        const panel = byId<HTMLDivElement>(panelId);
        panel.innerHTML = variables.map(v => {
            const safe = escapeHtml(v);
            return `
            <div class="probe-switch" data-var="${safe}" role="button" tabindex="0" aria-label="Toggle ${safe}">
                <span>${safe}</span>
                <span class="probe-val-badge">0</span>
            </div>
        `;
        }).join("");

        panel.querySelectorAll<HTMLElement>(".probe-switch").forEach(btn => {
            btn.addEventListener("click", () => {
                const varName = btn.getAttribute("data-var");
                if (varName) toggleProbe(varName, callbacks);
            });
        });
    });

    updateProbeUI();
    updateCircuitSignals();
}

export function toggleProbe(varName: string, callbacks: ProbeCallbacks = {}): void {
    if (!Object.prototype.hasOwnProperty.call(state.probeState, varName)) return;
    state.probeState[varName] = !state.probeState[varName];
    callbacks.onSound?.(state.probeState[varName]);
    updateProbeUI();
    updateCircuitSignals();
}

/** Sync switch badges, schematic pin labels and truth-table row highlight. */
export function updateProbeUI(): void {
    document.querySelectorAll<HTMLElement>(".probe-switch").forEach(btn => {
        const varName = btn.getAttribute("data-var");
        if (varName && Object.prototype.hasOwnProperty.call(state.probeState, varName)) {
            const isHigh = state.probeState[varName];
            btn.classList.toggle("active", isHigh);
            const badge = btn.querySelector(".probe-val-badge");
            if (badge) badge.textContent = isHigh ? "1" : "0";
        }
    });

    document.querySelectorAll<SVGGElement>(".pin-interactive").forEach(nodeEl => {
        const varName = nodeEl.getAttribute("data-var");
        if (varName && Object.prototype.hasOwnProperty.call(state.probeState, varName)) {
            const isHigh = state.probeState[varName];
            const textEl = nodeEl.querySelector("text");
            const rectEl = nodeEl.querySelector("rect");
            if (textEl) textEl.textContent = `${varName} = ${isHigh ? "1" : "0"}`;
            if (rectEl) {
                rectEl.setAttribute("stroke", isHigh ? "var(--wire-high)" : "var(--gate-stroke)");
                rectEl.setAttribute("stroke-width", isHigh ? "2.5" : "2");
            }
        }
    });

    if (state.variables.length > 0 && state.rows.length > 0) {
        // Row index uses the same MSB-first ordering as truth-table generation.
        const rowIdx = state.variables.reduce((acc, v, idx) => {
            return acc | ((state.probeState[v] ? 1 : 0) << (state.variables.length - 1 - idx));
        }, 0);

        document.querySelectorAll("#generatedTruthTable tr").forEach((tr, i) => {
            if (i > 0) tr.classList.toggle("active-row", (i - 1) === rowIdx);
        });

        const hudVector = byId<HTMLElement>("hudVector");
        hudVector.textContent = state.variables.map(v => `${v}=${state.probeState[v] ? 1 : 0}`).join(", ");
    }
}

/** Recolor every wire/junction according to current probe values. */
export function updateCircuitSignals(): void {
    const pairs: [CircuitGraph | null, string][] = [
        [state.graphs.basic, "basicCircuit"],
        [state.graphs.nand, "nandCircuit"],
        [state.graphs.nor, "norCircuit"]
    ];

    for (const [graph, containerId] of pairs) {
        if (!graph) continue;
        updateGraphWires(graph, containerId);
    }
}

function updateGraphWires(graph: CircuitGraph, containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    const values = evaluateAllNodeValues(graph, state.probeState);

    values.forEach((isHigh, nodeId) => {
        container.querySelectorAll(`[data-source-id="${nodeId}"]`).forEach(el => {
            if (el.tagName.toLowerCase() === "path") {
                el.classList.toggle("wire-active", isHigh);
                el.classList.toggle("wire-inactive", !isHigh);
            } else if (el.tagName.toLowerCase() === "circle") {
                el.setAttribute("fill", isHigh ? "var(--wire-high)" : "var(--wire-low)");
            }
        });
    });

    const finalVal = values.get(graph.output);
    if (finalVal !== undefined) {
        const ind = container.querySelector(".output-indicator-text");
        if (ind) ind.textContent = `F = ${finalVal ? "1" : "0"}`;

        if (containerId === "basicCircuit") {
            const hudOutput = byId<HTMLElement>("hudOutput");
            hudOutput.textContent = `${finalVal ? "1" : "0"} (${finalVal ? "5.0 V" : "0.0 V"})`;
            hudOutput.style.color = finalVal ? "#10b981" : "var(--text-muted)";
        }
    }
}
