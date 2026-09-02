/**
 * Results rendering: truth table, canonical forms, simplified expression,
 * don't-care summary, code exports, verification panel and error display.
 */

import { generateVerilogModule } from "../../../shared/ts/exporters/verilog";
import { generateCFunction } from "../../../shared/ts/exporters/c";
import { generateLatex } from "../../../shared/ts/exporters/latex";
import type { TruthRow } from "../../../shared/ts/boolean/ast";
import { el, byId, maybeById, escapeHtml } from "./dom";
import {
    SolverModel,
    verifySolution,
    CircuitTriple,
    posDisplay
} from "../solver";
import { state } from "../state";
import { resetCircuitIds, buildBasicSOPCircuit, buildNANDCircuit, buildNORCircuit, computeCircuitStats, CircuitStats } from "../circuits/circuitGraph";
import { renderCircuit } from "../circuits/renderer";
import { generateKarnaughMap } from "../kmap/kmap";
import { positionKarnaughOverlays } from "../kmap/overlays";
import { setupProbePanels, toggleProbe } from "./probe";
import { initWaveformPlayground, resetWaveform } from "./waveform";
import { getMinimizationSteps } from "../../../shared/ts/boolean/minimizer";

/* ------------------------------------------------------------------ */
/* Clipboard                                                           */
/* ------------------------------------------------------------------ */

function copyToClipboard(text: string, btn: HTMLButtonElement, onSound?: (isHigh: boolean) => void): void {
    onSound?.(true);
    navigator.clipboard.writeText(text).then(() => {
        const prev = btn.textContent;
        btn.textContent = "✅ Copied!";
        btn.classList.add("copied");
        setTimeout(() => {
            btn.textContent = prev;
            btn.classList.remove("copied");
        }, 1600);
    });
}

/* ------------------------------------------------------------------ */
/* Truth table HTML                                                    */
/* ------------------------------------------------------------------ */

export function createTruthTableHTML(variables: string[], rows: TruthRow[], dontCareIndices?: ReadonlySet<number>): string {
    let html = `<table class="truth-table"><thead><tr>`;
    variables.forEach(v => { html += `<th>${escapeHtml(v)}</th>`; });
    html += `<th>F</th></tr></thead><tbody>`;

    rows.forEach((row, index) => {
        html += `<tr>`;
        row.inputs.forEach(val => { html += `<td>${val}</td>`; });
        let outCell: string;
        if (dontCareIndices?.has(index)) {
            outCell = `<span class="tt-dontcare">X</span>`;
        } else if (row.output === 1) {
            outCell = `<span class="tt-one">1</span>`;
        } else {
            outCell = `<span class="tt-zero">0</span>`;
        }
        html += `<td>${outCell}</td></tr>`;
    });

    html += `</tbody></table>`;
    return html;
}

export function generateMarkdownTable(variables: string[], rows: TruthRow[]): string {
    let md = "| " + variables.join(" | ") + " | F |\n";
    md += "| " + variables.map(() => "---").join(" | ") + " | --- |\n";
    rows.forEach(r => {
        const outStr = r.output === 1 ? "1" : r.output === 0 ? "0" : "X";
        md += "| " + r.inputs.join(" | ") + " | " + outStr + " |\n";
    });
    return md;
}

/* ------------------------------------------------------------------ */
/* Error box                                                           */
/* ------------------------------------------------------------------ */

let errorTimeout: ReturnType<typeof setTimeout> | null = null;

export function showError(message: string): void {
    if (errorTimeout) clearTimeout(errorTimeout);
    const box = byId<HTMLElement>("errorMessage");
    box.textContent = message;
    box.classList.remove("hidden");
    errorTimeout = setTimeout(() => box.classList.add("hidden"), 6000);
}

export function clearError(): void {
    const box = byId<HTMLElement>("errorMessage");
    box.textContent = "";
    box.classList.add("hidden");
}

/* ------------------------------------------------------------------ */
/* Word-problem status / legend                                        */
/* ------------------------------------------------------------------ */

export function setWordProblemStatus(message: string, isError = false): void {
    const statusEl = byId<HTMLElement>("wordProblemStatus");
    statusEl.textContent = message;
    statusEl.classList.remove("hidden");
    statusEl.classList.toggle("status-error", isError);
}

export function clearWordProblemStatus(): void {
    const statusEl = byId<HTMLElement>("wordProblemStatus");
    statusEl.textContent = "";
    statusEl.classList.add("hidden");
    statusEl.classList.remove("status-error");
}

/**
 * Variable legend for AI-solved problems. Built with textContent only:
 * descriptions are model-generated and treated as untrusted input.
 */
export function showWordProblemLegend(variables: string[], descriptions?: Record<string, string>): void {
    const legend = byId<HTMLElement>("wordProblemLegend");

    if (!descriptions || Object.keys(descriptions).length === 0) {
        legend.classList.add("hidden");
        legend.replaceChildren();
        return;
    }

    legend.replaceChildren();
    variables.forEach((name, i) => {
        if (i > 0) legend.appendChild(el("br"));
        legend.appendChild(el("strong", undefined, name));
        legend.appendChild(document.createTextNode(` = ${descriptions[name] ?? "(no description)"}`));
    });
    legend.classList.remove("hidden");
}

/* ------------------------------------------------------------------ */
/* Verification panel                                                  */
/* ------------------------------------------------------------------ */

function renderVerification(passed: boolean, variableCount: number, onSound?: () => void): DocumentFragment {
    const frag = document.createDocumentFragment();

    if (passed) {
        onSound?.();
        const ok = el("div", "verification-success");
        ok.appendChild(el("strong", undefined, "✅ All Implementations Verified Successfully"));
        ok.appendChild(el("br"));
        ok.appendChild(el("br"));
        ok.appendChild(document.createTextNode(
            "The original Boolean function, simplified expression, AND/OR/NOT circuit, NAND-only circuit, " +
            `and NOR-only circuit produce 100% identical outputs for all ${2 ** variableCount} possible input combinations.`
        ));
        frag.appendChild(ok);
    } else {
        const bad = el("div", "verification-failure");
        bad.appendChild(el("strong", undefined, "❌ Verification Issue Detected"));
        bad.appendChild(el("br"));
        bad.appendChild(el("br"));
        bad.appendChild(document.createTextNode(
            "One or more circuit implementations does not match the expected Boolean truth table."
        ));
        frag.appendChild(bad);
    }
    return frag;
}

/* ------------------------------------------------------------------ */
/* Main results renderer                                               */
/* ------------------------------------------------------------------ */

export interface RenderCallbacks {
    onSound?(): void;
    onClickSound?(isHigh: boolean): void;
}

/** Hide the results section and clear every output area. */
export function clearResults(): void {
    resetWaveform();
    byId<HTMLElement>("results").classList.add("hidden");
    maybeById("dontCareResults")?.classList.add("hidden");

    const statusEl = maybeById("wordProblemStatus");
    if (statusEl) {
        statusEl.textContent = "";
        statusEl.classList.add("hidden");
        statusEl.classList.remove("status-error");
    }
    const legend = maybeById("wordProblemLegend");
    if (legend) {
        legend.textContent = "";
        legend.classList.add("hidden");
    }

    byId<HTMLElement>("originalExpression").textContent = "";
    byId<HTMLElement>("generatedTruthTable").innerHTML = "";
    byId<HTMLElement>("canonicalSOP").textContent = "";
    byId<HTMLElement>("canonicalPOS").textContent = "";
    byId<HTMLElement>("simplifiedExpression").textContent = "";
    byId<HTMLElement>("simplifiedPOS").textContent = "";
    byId<HTMLElement>("minimizationSteps").innerHTML = "";
    byId<HTMLElement>("karnaughMap").innerHTML = "";
    byId<HTMLElement>("basicCircuit").innerHTML = "";
    byId<HTMLElement>("nandCircuit").innerHTML = "";
    byId<HTMLElement>("norCircuit").innerHTML = "";
    byId<HTMLElement>("circuitComparison").innerHTML = "";
    byId<HTMLElement>("verification").innerHTML = "";
}

/**
 * Fill the entire results section from a solved model. Pure rendering plus
 * circuit synthesis — no input parsing happens here.
 */
export function renderResults(model: SolverModel, callbacks: RenderCallbacks = {}): void {
    state.variables = model.variables;
    state.rows = model.rows;

    byId<HTMLElement>("originalExpression").textContent = model.originalDisplay;
    byId<HTMLElement>("generatedTruthTable").innerHTML =
        createTruthTableHTML(model.variables, model.rows, model.hasDontCares ? model.dontCares : undefined);
    byId<HTMLElement>("canonicalSOP").textContent = model.canonicalSOP;
    byId<HTMLElement>("canonicalPOS").textContent = model.canonicalPOS;

    // Simplified expression + HUD.
    byId<HTMLElement>("simplifiedExpression").textContent = model.simplifiedDisplay;
    byId<HTMLElement>("simplifiedPOS").textContent = posDisplay(model.pos, model.variables);
    byId<HTMLElement>("hudTermCount").textContent = `${model.sop.implicants.length} Implicants`;

    // Step-by-step minimization procedure
    renderMinimizationSteps(model);
    if (model.simplifiedCoverTruncated) {
        // The cover is verified-equivalent but not guaranteed minimal.
        byId<HTMLElement>("simplifiedExpression").appendChild(
            el("div", "help-text", "(very large function: greedy grouping used)")
        );
    }

    // Karnaugh map.
    byId<HTMLElement>("karnaughMap").innerHTML = generateKarnaughMap({
        variables: model.variables,
        rows: model.rows,
        dontCares: model.hasDontCares ? model.dontCares : undefined,
        implicants: model.sop.implicants
    });
    state.kmap = { implicants: model.sop.implicants, variables: model.variables };
    requestAnimationFrame(() => positionKarnaughOverlays({
        implicants: model.sop.implicants,
        gridHost: byId<HTMLElement>("karnaughMap")
    }));

    // Don't-care summary.
    const dontCareResults = maybeById("dontCareResults");
    if (model.hasDontCares && dontCareResults) {
        dontCareResults.classList.remove("hidden");
        byId<HTMLElement>("dontCareSummary").replaceChildren(buildDontCareSummary(model));
    } else if (dontCareResults) {
        dontCareResults.classList.add("hidden");
    }

    // Code exports.
    setupExportButtons(model, callbacks);

    // Circuits.
    resetCircuitIds();
    state.graphs.basic = buildBasicSOPCircuit(model.sop.implicants, model.variables);
    state.graphs.nand = buildNANDCircuit(model.sop.implicants, model.variables);
    state.graphs.nor = buildNORCircuit(model.pos.implicants, model.variables);

    const onPinToggle = (varName: string) => toggleProbe(varName, { onSound: callbacks.onClickSound });

    renderCircuit(state.graphs.basic, byId<HTMLElement>("basicCircuit"), { onPinToggle });
    renderCircuit(state.graphs.nand, byId<HTMLElement>("nandCircuit"), { onPinToggle });
    renderCircuit(state.graphs.nor, byId<HTMLElement>("norCircuit"), { onPinToggle });

    // Gate-count / logic-depth comparison table
    renderComparisonTable(state.graphs as CircuitTriple);

    // Probes + verification.
    setupProbePanels(model.variables, { onSound: callbacks.onClickSound });

    const verified = verifySolution(model, state.graphs as CircuitTriple);
    byId<HTMLElement>("verification").replaceChildren(
        renderVerification(verified, model.variables.length, callbacks.onSound)
    );

    // Initialize waveform playground
    const basicStats = computeCircuitStats(state.graphs.basic);
    initWaveformPlayground(model.variables, model.simplifiedAst, basicStats.logicDepth);

    const resultsSection = byId<HTMLElement>("results");
    resultsSection.classList.remove("hidden");
    resultsSection.scrollIntoView({ behavior: "smooth" });
}

function buildDontCareSummary(model: SolverModel): DocumentFragment {
    const frag = document.createDocumentFragment();
    const wrap = el("div");
    wrap.style.cssText = "font-size:14px;line-height:1.7;";

    const line1 = el("div");
    line1.appendChild(document.createTextNode("Minterms (F = 1): "));
    line1.appendChild(el("strong", undefined, `{${[...model.ones].sort((a, b) => a - b).join(", ") || "none"}}`));

    const line2 = el("div");
    line2.appendChild(document.createTextNode("Don't Cares (F = X): "));
    const dcSpan = el("span", undefined, `{${[...model.dontCares].sort((a, b) => a - b).join(", ") || "none"}}`);
    dcSpan.style.cssText = "color:#f59e0b;font-weight:700;";
    line2.appendChild(dcSpan);

    const line3 = el("div");
    line3.appendChild(document.createTextNode(
        `Total terms used in minimization: ${model.ones.length + model.dontCares.size}`
    ));

    wrap.append(line1, line2, line3);
    frag.appendChild(wrap);
    return frag;
}

function renderMinimizationSteps(model: SolverModel): void {
    const container = byId<HTMLElement>("minimizationSteps");
    if (!container) return;

    const steps = getMinimizationSteps(model.ones, model.variables, model.hasDontCares ? model.dontCares : undefined, "SOP");

    let html = `<ol class="minimization-steps-list">`;
    steps.forEach(step => {
        html += `<li class="minimization-step">`;
        html += `<div class="step-title">${escapeHtml(step.title)}</div>`;
        html += `<pre class="step-detail">${escapeHtml(step.detail)}</pre>`;
        html += `</li>`;
    });
    html += `</ol>`;
    container.innerHTML = html;
}

function renderComparisonTable(circuits: CircuitTriple): void {
    const container = byId<HTMLElement>("circuitComparison");
    if (!container) return;

    const statsBasic = computeCircuitStats(circuits.basic);
    const statsNand = computeCircuitStats(circuits.nand);
    const statsNor = computeCircuitStats(circuits.nor);

    function gateBreakdownStr(stats: CircuitStats): string {
        return Object.entries(stats.gateBreakdown)
            .map(([type, count]) => `${count}× ${type}`)
            .join(", ") || "—";
    }

    let html = `<table class="truth-table comparison-table">
        <thead>
            <tr>
                <th>Metric</th>
                <th>AND/OR/NOT</th>
                <th>NAND-Only</th>
                <th>NOR-Only</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td><strong>Gate Count</strong></td>
                <td>${statsBasic.gateCount}</td>
                <td>${statsNand.gateCount}</td>
                <td>${statsNor.gateCount}</td>
            </tr>
            <tr>
                <td><strong>Logic Depth</strong></td>
                <td>${statsBasic.logicDepth}</td>
                <td>${statsNand.logicDepth}</td>
                <td>${statsNor.logicDepth}</td>
            </tr>
            <tr>
                <td><strong>Total Gate-Inputs</strong></td>
                <td>${statsBasic.totalGateInputs}</td>
                <td>${statsNand.totalGateInputs}</td>
                <td>${statsNor.totalGateInputs}</td>
            </tr>
            <tr>
                <td><strong>Gate Breakdown</strong></td>
                <td>${gateBreakdownStr(statsBasic)}</td>
                <td>${gateBreakdownStr(statsNand)}</td>
                <td>${gateBreakdownStr(statsNor)}</td>
            </tr>
        </tbody>
    </table>`;

    container.innerHTML = html;
}

function setupExportButtons(model: SolverModel, callbacks: RenderCallbacks): void {
    const verilog = generateVerilogModule(model.simplifiedAst, {
        inputs: model.variables
    });
    const cCode = generateCFunction(model.simplifiedAst, {
        parameters: model.variables
    });
    const latex = generateLatex(model.simplifiedAst);
    const mdTable = generateMarkdownTable(model.variables, model.rows);

    const previews: [string, string][] = [
        ["verilogPreview", verilog],
        ["codePreview", cCode],
        ["latexPreview", latex]
    ];
    previews.forEach(([id, content]) => {
        const pre = maybeById(id);
        if (pre) pre.textContent = content;
    });

    const buttons: [string, string][] = [
        ["copyVerilogBtn", verilog],
        ["copyCodeBtn", cCode],
        ["copyLatexBtn", latex],
        ["copyMarkdownTableBtn", mdTable]
    ];
    buttons.forEach(([id, payload]) => {
        const btn = maybeById<HTMLButtonElement>(id);
        if (btn) btn.onclick = () => copyToClipboard(payload, btn, callbacks.onClickSound);
    });

    // Generic expression copy buttons next to expression boxes.
    document.querySelectorAll<HTMLButtonElement>(".copy-btn").forEach(button => {
        button.onclick = () => {
            const row = button.closest(".expression-row");
            const box = row?.querySelector(".expression-box");
            const text = box?.textContent?.trim();
            if (text) copyToClipboard(text, button, callbacks.onClickSound);
        };
    });
}
