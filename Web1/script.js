"use strict";
/* =========================================================
   BOOLEAN LOGIC SOLVER - STUDIO ENGINE
   - Standard schematic gate geometry (AND, OR, NOT, NAND, NOR)
   - Dynamic channel wire routing with zero overlaps
   - Truth table generation & Quine-McCluskey minimization
   - Complete verification and PNG download export
   - Live Interactive Signal Probing Engine & Multimeter HUD
   - Vector Zoom & Pan Controls
   - Web Audio Studio Sound Effects
   - Verilog, C, LaTeX & Markdown Code Generation
========================================================= */
/* =========================================================
   DOM ELEMENTS
========================================================= */
const inputType = document.getElementById("inputType");
const expressionSection = document.getElementById("expressionSection");
const mintermSection = document.getElementById("mintermSection");
const maxtermSection = document.getElementById("maxtermSection");
const dontCareSection = document.getElementById("dontCareSection");
const truthTableSection = document.getElementById("truthTableSection");
const wordProblemSection = document.getElementById("wordProblemSection");
const problemStatementInput = document.getElementById("problemStatement");
const wordProblemStatus = document.getElementById("wordProblemStatus");
const wordProblemLegend = document.getElementById("wordProblemLegend");
const expressionInput = document.getElementById("expression");
const mintermVariables = document.getElementById("mintermVariables");
const maxtermVariables = document.getElementById("maxtermVariables");
const dontCareVariables = document.getElementById("dontCareVariables");
const truthVariables = document.getElementById("truthVariables");
const mintermsInput = document.getElementById("minterms");
const maxtermsInput = document.getElementById("maxterms");
const dontCareMintermsInput = document.getElementById("dontCareMinterms");
const dontCaresInput = document.getElementById("dontCares");
const solveButton = document.getElementById("solveButton");
const results = document.getElementById("results");
const errorMessage = document.getElementById("errorMessage");
const mintermExample = document.getElementById("mintermExample");
const maxtermExample = document.getElementById("maxtermExample");
const dontCareExample = document.getElementById("dontCareExample");
const userTruthTable = document.getElementById("userTruthTable");
const hudVector = document.getElementById("hudVector");
const hudOutput = document.getElementById("hudOutput");
const hudTermCount = document.getElementById("hudTermCount");
let circuitCounter = 0;
let currentVariables = [];
let currentRows = [];
let currentGraphBasic = null;
let currentGraphNand = null;
let currentGraphNor = null;
let currentProbeState = {};
const zoomStates = {
    basicCircuit: { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 },
    nandCircuit: { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 },
    norCircuit: { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 }
};
function applyZoomPan(containerId) {
    const container = document.getElementById(containerId);
    if (!container)
        return;
    const svg = container.querySelector("svg");
    if (!svg)
        return;
    const state = zoomStates[containerId];
    svg.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.scale})`;
}
function resetZoomPan(containerId) {
    zoomStates[containerId] = { scale: 1, panX: 0, panY: 0, isDragging: false, startX: 0, startY: 0 };
    applyZoomPan(containerId);
}
function initZoomPanControls() {
    document.querySelectorAll(".zoom-in-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            if (target && zoomStates[target]) {
                zoomStates[target].scale = Math.min(3.0, zoomStates[target].scale + 0.2);
                applyZoomPan(target);
                if (window.StudioFX)
                    window.StudioFX.click(true);
            }
        });
    });
    document.querySelectorAll(".zoom-out-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            if (target && zoomStates[target]) {
                zoomStates[target].scale = Math.max(0.4, zoomStates[target].scale - 0.2);
                applyZoomPan(target);
                if (window.StudioFX)
                    window.StudioFX.click(false);
            }
        });
    });
    document.querySelectorAll(".zoom-reset-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = btn.getAttribute("data-target");
            if (target)
                resetZoomPan(target);
        });
    });
    ["basicCircuit", "nandCircuit", "norCircuit"].forEach(id => {
        const container = document.getElementById(id);
        if (!container)
            return;
        container.addEventListener("wheel", (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            zoomStates[id].scale = Math.min(3.0, Math.max(0.4, zoomStates[id].scale + delta));
            applyZoomPan(id);
        }, { passive: false });
        container.addEventListener("mousedown", (e) => {
            if (e.button !== 0)
                return;
            zoomStates[id].isDragging = true;
            zoomStates[id].startX = e.clientX - zoomStates[id].panX;
            zoomStates[id].startY = e.clientY - zoomStates[id].panY;
            container.style.cursor = "grabbing";
        });
        window.addEventListener("mousemove", (e) => {
            if (!zoomStates[id] || !zoomStates[id].isDragging)
                return;
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
/* =========================================================
   INPUT INTERFACE & EXAMPLES
========================================================= */
function updateNumericExamples() {
    const minCount = Number(mintermVariables.value);
    const maxVal = (1 << minCount) - 1;
    mintermExample.innerHTML = `Valid minterms: <strong>0 to ${maxVal}</strong> (e.g. 1, 3, 5)`;
    const maxCount = Number(maxtermVariables.value);
    const maxValMax = (1 << maxCount) - 1;
    maxtermExample.innerHTML = `Valid maxterms: <strong>0 to ${maxValMax}</strong> (e.g. 0, 2, 4)`;
    updateDontCareExamples();
}
function updateDontCareExamples() {
    const count = Number(dontCareVariables.value);
    const maxVal = (1 << count) - 1;
    dontCareExample.innerHTML = `Valid terms: <strong>0 to ${maxVal}</strong> (e.g. Minterms: 1,3,7 &nbsp; Don't Cares: 0,5)`;
}
function clearResults() {
    results.classList.add("hidden");
    const dontCareResults = document.getElementById("dontCareResults");
    if (dontCareResults)
        dontCareResults.classList.add("hidden");
    wordProblemStatus.textContent = "";
    wordProblemStatus.classList.add("hidden");
    wordProblemStatus.classList.remove("status-error");
    wordProblemLegend.textContent = "";
    wordProblemLegend.classList.add("hidden");
    document.getElementById("originalExpression").textContent = "";
    document.getElementById("generatedTruthTable").innerHTML = "";
    document.getElementById("canonicalSOP").textContent = "";
    document.getElementById("canonicalPOS").textContent = "";
    document.getElementById("simplifiedExpression").textContent = "";
    document.getElementById("karnaughMap").innerHTML = "";
    document.getElementById("basicCircuit").innerHTML = "";
    document.getElementById("nandCircuit").innerHTML = "";
    document.getElementById("norCircuit").innerHTML = "";
    document.getElementById("verification").innerHTML = "";
}
function updateInputInterface() {
    const type = inputType.value;
    expressionSection.classList.toggle("hidden", type !== "expression");
    mintermSection.classList.toggle("hidden", type !== "minterms");
    maxtermSection.classList.toggle("hidden", type !== "maxterms");
    dontCareSection.classList.toggle("hidden", type !== "dontCare");
    truthTableSection.classList.toggle("hidden", type !== "truthTable");
    wordProblemSection.classList.toggle("hidden", type !== "wordProblem");
    clearResults();
}
inputType.addEventListener("change", () => {
    updateInputInterface();
    if (window.StudioFX)
        window.StudioFX.click(true);
});
mintermVariables.addEventListener("change", updateNumericExamples);
maxtermVariables.addEventListener("change", updateNumericExamples);
dontCareVariables.addEventListener("change", updateDontCareExamples);
truthVariables.addEventListener("change", generateTruthTableInput);
/* =========================================================
   LEXER & PARSER
========================================================= */
function getVariables(expression) {
    const letters = expression.match(/[A-Za-z]/g) || [];
    return [...new Set(letters.map(letter => letter.toUpperCase()))].sort();
}
function generateVariableNames(count) {
    const names = [];
    for (let i = 0; i < count; i++) {
        names.push(String.fromCharCode(65 + i));
    }
    return names;
}
function tokenize(expression) {
    const tokens = [];
    let i = 0;
    while (i < expression.length) {
        const char = expression[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        if (/[A-Za-z]/.test(char)) {
            tokens.push({ type: "VARIABLE", value: char.toUpperCase() });
            i++;
            continue;
        }
        if (char === "'") {
            tokens.push({ type: "POSTFIX_NOT" });
            i++;
            continue;
        }
        if (char === "+" || char === "|") {
            tokens.push({ type: "OR" });
            i++;
            continue;
        }
        if (char === "^") {
            tokens.push({ type: "XOR" });
            i++;
            continue;
        }
        if (char === "*" || char === "&" || char === "·") {
            tokens.push({ type: "AND" });
            i++;
            continue;
        }
        if (char === "~" || char === "!" || char === "¬") {
            tokens.push({ type: "NOT" });
            i++;
            continue;
        }
        if (char === "(") {
            tokens.push({ type: "LPAREN" });
            i++;
            continue;
        }
        if (char === ")") {
            tokens.push({ type: "RPAREN" });
            i++;
            continue;
        }
        throw new Error(`Unsupported character: '${char}'`);
    }
    return tokens;
}
function insertImplicitAND(tokens) {
    const result = [];
    for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i];
        result.push(current);
        if (i + 1 < tokens.length) {
            const next = tokens[i + 1];
            const leftCanEnd = current.type === "VARIABLE" ||
                current.type === "POSTFIX_NOT" ||
                current.type === "RPAREN";
            const rightCanStart = next.type === "VARIABLE" ||
                next.type === "NOT" ||
                next.type === "LPAREN";
            if (leftCanEnd && rightCanStart) {
                result.push({ type: "AND" });
            }
        }
    }
    return result;
}
class Parser {
    constructor(tokens) {
        this.index = 0;
        this.tokens = tokens;
    }
    peek() { return this.tokens[this.index]; }
    get() { return this.tokens[this.index++]; }
    parse() {
        const node = this.parseOR();
        if (this.index < this.tokens.length) {
            throw new Error("Unexpected token at end of expression.");
        }
        return node;
    }
    parseOR() {
        var _a;
        let node = this.parseXOR();
        while (((_a = this.peek()) === null || _a === void 0 ? void 0 : _a.type) === "OR") {
            this.get();
            node = { type: "OR", left: node, right: this.parseXOR() };
        }
        return node;
    }
    parseXOR() {
        var _a;
        let node = this.parseAND();
        while (((_a = this.peek()) === null || _a === void 0 ? void 0 : _a.type) === "XOR") {
            this.get();
            node = { type: "XOR", left: node, right: this.parseAND() };
        }
        return node;
    }
    parseAND() {
        var _a;
        let node = this.parseUnary();
        while (((_a = this.peek()) === null || _a === void 0 ? void 0 : _a.type) === "AND") {
            this.get();
            node = { type: "AND", left: node, right: this.parseUnary() };
        }
        return node;
    }
    parseUnary() {
        var _a, _b;
        if (((_a = this.peek()) === null || _a === void 0 ? void 0 : _a.type) === "NOT") {
            this.get();
            return { type: "NOT", child: this.parseUnary() };
        }
        let node = this.parsePrimary();
        while (((_b = this.peek()) === null || _b === void 0 ? void 0 : _b.type) === "POSTFIX_NOT") {
            this.get();
            node = { type: "NOT", child: node };
        }
        return node;
    }
    parsePrimary() {
        const token = this.get();
        if (!token)
            throw new Error("Unexpected end of expression.");
        if (token.type === "VARIABLE")
            return { type: "VARIABLE", name: token.value };
        if (token.type === "LPAREN") {
            const node = this.parseOR();
            const close = this.get();
            if (!close || close.type !== "RPAREN")
                throw new Error("Missing closing parenthesis ')'.");
            return node;
        }
        throw new Error("Invalid expression syntax.");
    }
}
function evaluateAST(node, assignment) {
    var _a;
    switch (node.type) {
        case "VARIABLE": return (_a = assignment[node.name]) !== null && _a !== void 0 ? _a : false;
        case "NOT": return !evaluateAST(node.child, assignment);
        case "AND": return evaluateAST(node.left, assignment) && evaluateAST(node.right, assignment);
        case "OR": return evaluateAST(node.left, assignment) || evaluateAST(node.right, assignment);
        case "XOR": return evaluateAST(node.left, assignment) !== evaluateAST(node.right, assignment);
        case "CONST": return node.value;
    }
}
function generateCombinations(variableCount) {
    const total = 1 << variableCount;
    const combinations = [];
    for (let i = 0; i < total; i++) {
        const row = [];
        for (let bit = variableCount - 1; bit >= 0; bit--) {
            row.push((i >> bit) & 1);
        }
        combinations.push(row);
    }
    return combinations;
}
function evaluateExpression(expression, variables) {
    const tokens = insertImplicitAND(tokenize(expression));
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const combinations = generateCombinations(variables.length);
    const rows = combinations.map(inputs => {
        const assignment = {};
        variables.forEach((variable, index) => {
            assignment[variable] = Boolean(inputs[index]);
        });
        return { inputs, output: evaluateAST(ast, assignment) ? 1 : 0 };
    });
    return { ast, rows };
}
/* =========================================================
   CANONICAL FORMS & MINIMIZATION (Quine-McCluskey)
========================================================= */
function mintermsToExpression(minterms, variableCount, dontCares) {
    const maxVal = (1 << variableCount) - 1;
    minterms.forEach(m => {
        if (isNaN(m) || m < 0 || m > maxVal) {
            throw new Error(`Minterm ${m} is out of range (0 to ${maxVal}).`);
        }
    });
    const variables = generateVariableNames(variableCount);
    if (minterms.length === 0)
        return "0";
    if (minterms.length === 1 << variableCount)
        return "1";
    return minterms.map(m => {
        let term = "";
        for (let i = 0; i < variableCount; i++) {
            const bit = (m >> (variableCount - 1 - i)) & 1;
            term += bit ? variables[i] : `${variables[i]}'`;
        }
        return term;
    }).join(" + ");
}
function maxtermsToExpression(maxterms, variableCount, dontCares) {
    const maxVal = (1 << variableCount) - 1;
    maxterms.forEach(m => {
        if (isNaN(m) || m < 0 || m > maxVal) {
            throw new Error(`Maxterm ${m} is out of range (0 to ${maxVal}).`);
        }
    });
    const variables = generateVariableNames(variableCount);
    if (maxterms.length === 0)
        return "1";
    if (maxterms.length === 1 << variableCount)
        return "0";
    return maxterms.map(m => {
        const parts = [];
        for (let i = 0; i < variableCount; i++) {
            const bit = (m >> (variableCount - 1 - i)) & 1;
            parts.push(bit ? `${variables[i]}'` : variables[i]);
        }
        return `(${parts.join(" + ")})`;
    }).join("");
}
function generateCanonicalSOP(rows, variables, dontCares) {
    const terms = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row, index }) => row.output === 1 && (!dontCares || !dontCares.has(index)))
        .map(({ row }) => {
        return row.inputs.map((val, idx) => val ? variables[idx] : `${variables[idx]}'`).join("");
    });
    return terms.length > 0 ? terms.join(" + ") : "0";
}
function generateCanonicalPOS(rows, variables, dontCares) {
    const clauses = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row, index }) => row.output === 0 && (!dontCares || !dontCares.has(index)))
        .map(({ row }) => {
        const sum = row.inputs.map((val, idx) => val ? `${variables[idx]}'` : variables[idx]).join(" + ");
        return `(${sum})`;
    });
    return clauses.length > 0 ? clauses.join("") : "1";
}
function canCombine(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            diff++;
            if (diff > 1)
                return false;
        }
    }
    return diff === 1;
}
function combinePatterns(a, b) {
    let result = "";
    for (let i = 0; i < a.length; i++) {
        result += a[i] === b[i] ? a[i] : "-";
    }
    return result;
}
function patternCovers(pattern, minterm, variableCount) {
    const bin = minterm.toString(2).padStart(variableCount, "0");
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] !== "-" && pattern[i] !== bin[i])
            return false;
    }
    return true;
}
function getPrimeImplicants(minterms, variableCount) {
    let groups = new Map();
    minterms.forEach(m => {
        const bin = m.toString(2).padStart(variableCount, "0");
        const ones = (bin.match(/1/g) || []).length;
        if (!groups.has(ones))
            groups.set(ones, new Set());
        groups.get(ones).add(bin);
    });
    const primes = new Set();
    while (groups.size > 0) {
        const nextGroups = new Map();
        const combined = new Set();
        const onesKeys = [...groups.keys()].sort((a, b) => a - b);
        for (let i = 0; i < onesKeys.length - 1; i++) {
            const k1 = onesKeys[i];
            const k2 = onesKeys[i + 1];
            if (k2 !== k1 + 1)
                continue;
            const g1 = groups.get(k1);
            const g2 = groups.get(k2);
            g1.forEach(p1 => {
                g2.forEach(p2 => {
                    if (canCombine(p1, p2)) {
                        const merged = combinePatterns(p1, p2);
                        combined.add(p1);
                        combined.add(p2);
                        const ones = (merged.replace(/-/g, "").match(/1/g) || []).length;
                        if (!nextGroups.has(ones))
                            nextGroups.set(ones, new Set());
                        nextGroups.get(ones).add(merged);
                    }
                });
            });
        }
        groups.forEach(set => {
            set.forEach(pattern => {
                if (!combined.has(pattern))
                    primes.add(pattern);
            });
        });
        groups = nextGroups;
    }
    return [...primes].map(pattern => ({ pattern }));
}
function findMinimumCover(minterms, primes, variableCount) {
    if (minterms.length === 0 || primes.length === 0)
        return [];
    const chart = primes.map(p => minterms.map(m => patternCovers(p.pattern, m, variableCount)));
    const essentialPrimes = new Set();
    const uncoveredMinterms = new Set(minterms.map((_, i) => i));
    for (let c = 0; c < minterms.length; c++) {
        const coveringPrimes = [];
        for (let r = 0; r < primes.length; r++) {
            if (chart[r][c])
                coveringPrimes.push(r);
        }
        if (coveringPrimes.length === 1) {
            const r = coveringPrimes[0];
            essentialPrimes.add(r);
            for (let col = 0; col < minterms.length; col++) {
                if (chart[r][col])
                    uncoveredMinterms.delete(col);
            }
        }
    }
    if (uncoveredMinterms.size === 0) {
        return [...essentialPrimes].map(i => primes[i]);
    }
    const remainingPrimes = primes
        .map((_, i) => i)
        .filter(i => !essentialPrimes.has(i));
    const remainingMinterms = [...uncoveredMinterms];
    let bestCombination = null;
    function search(uncovered, chosen) {
        if (uncovered.length === 0) {
            if (bestCombination === null || chosen.length < bestCombination.length) {
                bestCombination = [...chosen];
            }
            return;
        }
        if (bestCombination !== null && chosen.length >= bestCombination.length)
            return;
        const targetMinterm = uncovered[0];
        const covering = remainingPrimes.filter(p => chart[p][targetMinterm] && !chosen.includes(p));
        for (const p of covering) {
            const newUncovered = uncovered.filter(m => !chart[p][m]);
            search(newUncovered, [...chosen, p]);
        }
    }
    search(remainingMinterms, []);
    const allChosen = new Set([...essentialPrimes, ...(bestCombination || [])]);
    return [...allChosen].map(i => primes[i]);
}
function patternToSOPTerm(pattern, variables) {
    let term = "";
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "1")
            term += variables[i];
        else if (pattern[i] === "0")
            term += `${variables[i]}'`;
    }
    return term || "1";
}
function sopFromImplicants(implicants, variables) {
    if (implicants.length === 0)
        return "0";
    return implicants.map(imp => patternToSOPTerm(imp.pattern, variables)).join(" + ");
}
function patternToPOSClause(pattern, variables) {
    const parts = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "0")
            parts.push(variables[i]);
        else if (pattern[i] === "1")
            parts.push(`${variables[i]}'`);
    }
    if (parts.length === 0)
        return "0";
    return parts.length === 1 ? parts[0] : `(${parts.join(" + ")})`;
}
function posFromImplicants(implicants, variables) {
    if (implicants.length === 0)
        return "1";
    return implicants.map(imp => patternToPOSClause(imp.pattern, variables)).join("");
}
function minimizeSOP(minterms, variables, dontCares) {
    if (minterms.length === 0)
        return { expression: "0", implicants: [] };
    const allTerms = dontCares ? [...minterms, ...dontCares] : minterms;
    if (minterms.length + ((dontCares === null || dontCares === void 0 ? void 0 : dontCares.size) || 0) === (1 << variables.length)) {
        return { expression: "1", implicants: [{ pattern: "-".repeat(variables.length) }] };
    }
    const primes = getPrimeImplicants(allTerms, variables.length);
    const cover = findMinimumCover(minterms, primes, variables.length);
    return { expression: sopFromImplicants(cover, variables), implicants: cover };
}
function minimizePOS(zeros, variables, dontCares) {
    if (zeros.length === 0)
        return { expression: "1", implicants: [] };
    const allTerms = dontCares ? [...zeros, ...dontCares] : zeros;
    if (zeros.length + ((dontCares === null || dontCares === void 0 ? void 0 : dontCares.size) || 0) === (1 << variables.length)) {
        return { expression: "0", implicants: [{ pattern: "-".repeat(variables.length) }] };
    }
    const primes = getPrimeImplicants(allTerms, variables.length);
    const cover = findMinimumCover(zeros, primes, variables.length);
    return { expression: posFromImplicants(cover, variables), implicants: cover };
}
/* =========================================================
   CIRCUIT GRAPH GENERATION
========================================================= */
function createGraph() {
    return { nodes: [], output: "", inputs: [] };
}
function addNode(graph, type, inputs = [], label = "") {
    const id = `node_${circuitCounter++}`;
    graph.nodes.push({ id, type, inputs, label });
    return id;
}
function addInput(graph, variable) {
    const existing = graph.nodes.find(n => n.type === "INPUT" && n.label === variable);
    if (existing)
        return existing.id;
    const id = addNode(graph, "INPUT", [], variable);
    graph.inputs.push(id);
    return id;
}
function buildBasicSOPCircuit(implicants, variables) {
    const graph = createGraph();
    variables.forEach(v => addInput(graph, v));
    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }
    if (implicants.length === 1 && implicants[0].pattern === "-".repeat(variables.length)) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }
    const notMap = new Map();
    const getNot = (varName) => {
        if (!notMap.has(varName)) {
            const inId = addInput(graph, varName);
            const notId = addNode(graph, "NOT", [inId], `~${varName}`);
            notMap.set(varName, notId);
        }
        return notMap.get(varName);
    };
    const termNodeIds = [];
    implicants.forEach(imp => {
        const literalIds = [];
        for (let i = 0; i < imp.pattern.length; i++) {
            const bit = imp.pattern[i];
            if (bit === "1")
                literalIds.push(addInput(graph, variables[i]));
            else if (bit === "0")
                literalIds.push(getNot(variables[i]));
        }
        if (literalIds.length === 1) {
            termNodeIds.push(literalIds[0]);
        }
        else if (literalIds.length > 1) {
            termNodeIds.push(addNode(graph, "AND", literalIds));
        }
    });
    if (termNodeIds.length === 1)
        graph.output = termNodeIds[0];
    else
        graph.output = addNode(graph, "OR", termNodeIds);
    return graph;
}
function buildNANDCircuit(implicants, variables) {
    const graph = createGraph();
    variables.forEach(v => addInput(graph, v));
    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }
    if (implicants.length === 1 && implicants[0].pattern === "-".repeat(variables.length)) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }
    const notMap = new Map();
    const getNandNot = (varName) => {
        if (!notMap.has(varName)) {
            const inId = addInput(graph, varName);
            const notId = addNode(graph, "NAND", [inId, inId], `~${varName}`);
            notMap.set(varName, notId);
        }
        return notMap.get(varName);
    };
    const layer1Ids = [];
    implicants.forEach(imp => {
        const literals = [];
        for (let i = 0; i < imp.pattern.length; i++) {
            const bit = imp.pattern[i];
            if (bit === "1")
                literals.push(addInput(graph, variables[i]));
            else if (bit === "0")
                literals.push(getNandNot(variables[i]));
        }
        if (literals.length === 1) {
            const nandInv = addNode(graph, "NAND", [literals[0], literals[0]]);
            layer1Ids.push(nandInv);
        }
        else {
            layer1Ids.push(addNode(graph, "NAND", literals));
        }
    });
    if (layer1Ids.length === 1) {
        graph.output = addNode(graph, "NAND", [layer1Ids[0], layer1Ids[0]]);
    }
    else {
        graph.output = addNode(graph, "NAND", layer1Ids);
    }
    return graph;
}
function buildNORCircuit(implicants, variables) {
    const graph = createGraph();
    variables.forEach(v => addInput(graph, v));
    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }
    if (implicants.length === 1 && implicants[0].pattern === "-".repeat(variables.length)) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }
    const notMap = new Map();
    const getNorNot = (varName) => {
        if (!notMap.has(varName)) {
            const inId = addInput(graph, varName);
            const notId = addNode(graph, "NOR", [inId, inId], `~${varName}`);
            notMap.set(varName, notId);
        }
        return notMap.get(varName);
    };
    const layer1Ids = [];
    implicants.forEach(imp => {
        const literals = [];
        for (let i = 0; i < imp.pattern.length; i++) {
            const bit = imp.pattern[i];
            if (bit === "0")
                literals.push(addInput(graph, variables[i]));
            else if (bit === "1")
                literals.push(getNorNot(variables[i]));
        }
        if (literals.length === 1) {
            const norInv = addNode(graph, "NOR", [literals[0], literals[0]]);
            layer1Ids.push(norInv);
        }
        else {
            layer1Ids.push(addNode(graph, "NOR", literals));
        }
    });
    if (layer1Ids.length === 1) {
        graph.output = addNode(graph, "NOR", [layer1Ids[0], layer1Ids[0]]);
    }
    else {
        graph.output = addNode(graph, "NOR", layer1Ids);
    }
    return graph;
}
/* =========================================================
   EVALUATE CIRCUIT GRAPH
========================================================= */
function evaluateCircuit(graph, assignment) {
    const memo = new Map();
    function evaluateNode(id) {
        var _a;
        if (memo.has(id))
            return memo.get(id);
        const node = graph.nodes.find(n => n.id === id);
        if (!node)
            return false;
        let result = false;
        switch (node.type) {
            case "INPUT":
                result = (_a = assignment[node.label]) !== null && _a !== void 0 ? _a : false;
                break;
            case "CONST":
                result = node.label === "1";
                break;
            case "NOT":
                result = !evaluateNode(node.inputs[0]);
                break;
            case "AND":
                result = node.inputs.every(inId => evaluateNode(inId));
                break;
            case "OR":
                result = node.inputs.some(inId => evaluateNode(inId));
                break;
            case "NAND":
                result = !node.inputs.every(inId => evaluateNode(inId));
                break;
            case "NOR":
                result = !node.inputs.some(inId => evaluateNode(inId));
                break;
        }
        memo.set(id, result);
        return result;
    }
    return evaluateNode(graph.output);
}
function evaluateAllNodeValues(graph, assignment) {
    const nodeValues = new Map();
    function evalNode(id) {
        var _a;
        if (nodeValues.has(id))
            return nodeValues.get(id);
        const node = graph.nodes.find(n => n.id === id);
        if (!node)
            return false;
        let val = false;
        switch (node.type) {
            case "INPUT":
                val = (_a = assignment[node.label]) !== null && _a !== void 0 ? _a : false;
                break;
            case "CONST":
                val = node.label === "1";
                break;
            case "NOT":
                val = !evalNode(node.inputs[0]);
                break;
            case "AND":
                val = node.inputs.every(inp => evalNode(inp));
                break;
            case "OR":
                val = node.inputs.some(inp => evalNode(inp));
                break;
            case "NAND":
                val = !node.inputs.every(inp => evalNode(inp));
                break;
            case "NOR":
                val = !node.inputs.some(inp => evalNode(inp));
                break;
        }
        nodeValues.set(id, val);
        return val;
    }
    graph.nodes.forEach(n => evalNode(n.id));
    return nodeValues;
}
/* =========================================================
   GATE GEOMETRY & SCHEMATIC LAYOUT
========================================================= */
function getGateInfo(node) {
    switch (node.type) {
        case "INPUT":
        case "CONST":
            return {
                width: 90, height: 52,
                inX: (x) => x, inY: (_, y) => y + 26,
                outX: (x) => x + 90, outY: (_, y) => y + 26
            };
        case "NOT":
            return {
                width: 74, height: 52,
                inX: (x) => x, inY: (_, y) => y + 26,
                outX: (x) => x + 74, outY: (_, y) => y + 26
            };
        case "AND":
            return {
                width: 76, height: 52,
                inX: (x) => x,
                inY: (x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 76, outY: (_, y) => y + 26
            };
        case "NAND":
            return {
                width: 93, height: 52,
                inX: (x) => x,
                inY: (x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 93, outY: (_, y) => y + 26
            };
        case "OR":
            return {
                width: 86, height: 52,
                inX: (x, y, i, count) => {
                    const inputY = getMultiInputY(y, 52, i, count);
                    const dy = Math.abs(inputY - (y + 26));
                    return x + Math.max(0, 18 * (1 - dy / 26));
                },
                inY: (x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 86, outY: (_, y) => y + 26
            };
        case "NOR":
            return {
                width: 100, height: 52,
                inX: (x, y, i, count) => {
                    const inputY = getMultiInputY(y, 52, i, count);
                    const dy = Math.abs(inputY - (y + 26));
                    return x + Math.max(0, 18 * (1 - dy / 26));
                },
                inY: (x, y, i, count) => getMultiInputY(y, 52, i, count),
                outX: (x) => x + 100, outY: (_, y) => y + 26
            };
    }
}
function getMultiInputY(y, h, i, count) {
    if (count <= 1)
        return y + h / 2;
    const margin = 10;
    const available = h - 2 * margin;
    const step = available / (count - 1);
    return y + margin + i * step;
}
function calculateLevels(graph) {
    const levels = new Map();
    function getLevel(id) {
        if (levels.has(id))
            return levels.get(id);
        const node = graph.nodes.find(n => n.id === id);
        if (!node)
            return 0;
        if (node.type === "INPUT" || node.type === "CONST") {
            levels.set(id, 0);
            return 0;
        }
        let maxIn = -1;
        node.inputs.forEach(inId => {
            maxIn = Math.max(maxIn, getLevel(inId));
        });
        const lvl = maxIn + 1;
        levels.set(id, lvl);
        return lvl;
    }
    graph.nodes.forEach(n => getLevel(n.id));
    return levels;
}
function calculateCircuitLayout(graph) {
    const levels = calculateLevels(graph);
    const nodesByLevel = new Map();
    levels.forEach((lvl, id) => {
        if (!nodesByLevel.has(lvl))
            nodesByLevel.set(lvl, []);
        const node = graph.nodes.find(n => n.id === id);
        if (node)
            nodesByLevel.get(lvl).push(node);
    });
    const levelGap = 200;
    const paddingX = 40;
    const paddingY = 40;
    const gateHeight = 52;
    const nodeGapY = 32;
    const positions = new Map();
    let maxTotalHeight = 0;
    const sortedLevels = [...nodesByLevel.keys()].sort((a, b) => a - b);
    sortedLevels.forEach(lvl => {
        const list = nodesByLevel.get(lvl);
        const totalHeight = list.length * gateHeight + (list.length - 1) * nodeGapY;
        maxTotalHeight = Math.max(maxTotalHeight, totalHeight);
    });
    const circuitHeight = Math.max(260, maxTotalHeight + 2 * paddingY);
    sortedLevels.forEach(lvl => {
        const list = nodesByLevel.get(lvl);
        const totalH = list.length * gateHeight + (list.length - 1) * nodeGapY;
        const startY = (circuitHeight - totalH) / 2;
        const x = paddingX + lvl * levelGap;
        list.forEach((node, idx) => {
            const y = startY + idx * (gateHeight + nodeGapY);
            positions.set(node.id, { x, y, level: lvl });
        });
    });
    const maxLevel = Math.max(0, ...sortedLevels);
    const lastLevelNodes = nodesByLevel.get(maxLevel) || [];
    const maxNodeWidth = lastLevelNodes.reduce((m, n) => Math.max(m, getGateInfo(n).width), 90);
    const circuitWidth = paddingX + maxLevel * levelGap + maxNodeWidth + 120;
    return { positions, levels, width: circuitWidth, height: circuitHeight, levelGap, paddingX, paddingY };
}
/* =========================================================
   SVG GATE RENDERING & WIRE ROUTING
========================================================= */
function renderGateSVG(node, pos) {
    const x = pos.x;
    const y = pos.y;
    const centerY = y + 26;
    let svg = "";
    if (node.type === "INPUT" || node.type === "CONST") {
        svg += `
            <g class="circuit-gate-group pin-interactive" data-node-id="${node.id}" data-var="${node.label}">
                <rect x="${x}" y="${y}" width="90" height="52" rx="10" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2" />
                <text x="${x + 45}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="15" fill="var(--text-primary)">${node.label}</text>
            </g>
        `;
        return svg;
    }
    if (node.type === "NOT") {
        svg += `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <polygon points="${x},${y} ${x + 60},${centerY} ${x},${y + 52}" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <circle cx="${x + 67}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 20}" y="${centerY + 5}" font-weight="800" font-size="12" fill="var(--text-primary)">NOT</text>
            </g>
        `;
        return svg;
    }
    if (node.type === "AND") {
        svg += `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">AND</text>
            </g>
        `;
    }
    else if (node.type === "NAND") {
        svg += `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <circle cx="${x + 86}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">NAND</text>
            </g>
        `;
    }
    else if (node.type === "OR") {
        svg += `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">OR</text>
            </g>
        `;
    }
    else if (node.type === "NOR") {
        svg += `
            <g class="circuit-gate-group" data-node-id="${node.id}">
                <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <circle cx="${x + 93}" cy="${centerY}" r="7" fill="var(--gate-fill)" stroke="var(--gate-stroke)" stroke-width="2.2" />
                <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">NOR</text>
            </g>
        `;
    }
    return svg;
}
function formatHopPathH(x1, x2, y, crossXs) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const isLtoR = x1 <= x2;
    const valid = crossXs.filter(cx => cx > minX + 8 && cx < maxX - 8).sort((a, b) => isLtoR ? a - b : b - a);
    if (valid.length === 0) {
        return `M ${x1} ${y} H ${x2}`;
    }
    let d = `M ${x1} ${y}`;
    valid.forEach(cx => {
        if (isLtoR) {
            d += ` H ${cx - 7} A 7 7 0 0 1 ${cx + 7} ${y}`;
        }
        else {
            d += ` H ${cx + 7} A 7 7 0 0 1 ${cx - 7} ${y}`;
        }
    });
    d += ` H ${x2}`;
    return d;
}
function renderEdgesSVG(graph, layout) {
    let svg = "";
    const { positions, levels } = layout;
    const edges = [];
    graph.nodes.forEach(targetNode => {
        const seen = new Map();
        targetNode.inputs.forEach((sourceId, inputIndex) => {
            if (!seen.has(sourceId))
                seen.set(sourceId, []);
            seen.get(sourceId).push(inputIndex);
        });
        seen.forEach((indices, sourceId) => {
            const sourceNode = graph.nodes.find(n => n.id === sourceId);
            const sourcePos = positions.get(sourceId);
            const targetPos = positions.get(targetNode.id);
            if (!sourceNode || !sourcePos || !targetPos)
                return;
            const sourceInfo = getGateInfo(sourceNode);
            const targetInfo = getGateInfo(targetNode);
            const x1 = sourceInfo.outX(sourcePos.x);
            const y1 = sourceInfo.outY(sourcePos.x, sourcePos.y);
            let sumY2 = 0;
            let sumX2 = 0;
            indices.forEach(i => {
                sumX2 += targetInfo.inX(targetPos.x, targetPos.y, i, targetNode.inputs.length);
                sumY2 += targetInfo.inY(targetPos.x, targetPos.y, i, targetNode.inputs.length);
            });
            const x2 = sumX2 / indices.length;
            const y2 = sumY2 / indices.length;
            edges.push({
                sourceId,
                targetId: targetNode.id,
                x1, y1, x2, y2,
                sourceLevel: levels.get(sourceId),
                targetLevel: levels.get(targetNode.id)
            });
        });
    });
    const gapGroups = new Map();
    edges.forEach(edge => {
        const key = `${edge.sourceLevel}->${edge.targetLevel}`;
        if (!gapGroups.has(key))
            gapGroups.set(key, []);
        gapGroups.get(key).push(edge);
    });
    gapGroups.forEach((groupEdges) => {
        const sourceMap = new Map();
        groupEdges.forEach(edge => {
            if (!sourceMap.has(edge.sourceId))
                sourceMap.set(edge.sourceId, []);
            sourceMap.get(edge.sourceId).push(edge);
        });
        const sources = Array.from(sourceMap.entries()).map(([id, sEdges]) => ({
            id,
            edges: sEdges,
            x1: sEdges[0].x1,
            y1: sEdges[0].y1,
            minTargetX: Math.min(...sEdges.map(e => e.x2))
        }));
        sources.sort((a, b) => a.y1 - b.y1);
        const maxSourceX = Math.max(...sources.map(s => s.x1));
        const minTargetX = Math.min(...sources.map(s => s.minTargetX));
        let gapStart = maxSourceX + 16;
        let gapEnd = minTargetX - 16;
        if (gapEnd - gapStart < 35) {
            const mid = (maxSourceX + minTargetX) / 2;
            gapStart = mid - 22;
            gapEnd = mid + 22;
        }
        const available = Math.max(35, gapEnd - gapStart);
        const effectiveStep = available / (sources.length + 1);
        // Pre-compute all vertical buses in this gap
        const vBuses = [];
        sources.forEach((source, idx) => {
            const busX = gapStart + (idx + 1) * effectiveStep;
            const { y1, edges: sEdges } = source;
            if (sEdges.length === 1 && Math.abs(y1 - sEdges[0].y2) < 1.5) {
                // Direct line, no vertical span
            }
            else {
                const allY = [y1, ...sEdges.map(e => e.y2)];
                const minY = Math.min(...allY);
                const maxY = Math.max(...allY);
                vBuses.push({ busX, minY, maxY, source });
            }
        });
        sources.forEach((source, idx) => {
            const busInfo = vBuses.find(v => v.source.id === source.id);
            const busX = busInfo ? busInfo.busX : (gapStart + (idx + 1) * effectiveStep);
            const { id: srcId, x1, y1, edges: sEdges } = source;
            const getCrossings = (hX1, hX2, hY) => {
                const minH = Math.min(hX1, hX2);
                const maxH = Math.max(hX1, hX2);
                return vBuses
                    .filter(v => v.source.id !== srcId && v.busX > minH + 6 && v.busX < maxH - 6 && v.minY <= hY && hY <= v.maxY)
                    .map(v => v.busX);
            };
            if (sEdges.length === 1) {
                const { x2, y2 } = sEdges[0];
                if (Math.abs(y1 - y2) < 1.5) {
                    const crossings = getCrossings(x1, x2, y1);
                    const d = formatHopPathH(x1, x2, y1, crossings);
                    svg += `<path d="${d}" class="circuit-wire" data-source-id="${srcId}" stroke="var(--wire-low)" stroke-width="2.2" fill="none" />`;
                }
                else {
                    const c1 = getCrossings(x1, busX, y1);
                    const d1 = formatHopPathH(x1, busX, y1, c1);
                    const c3 = getCrossings(busX, x2, y2);
                    const d3 = formatHopPathH(busX, x2, y2, c3);
                    svg += `<path d="${d1} V ${y2} ${d3.replace(`M ${busX} ${y2}`, '')}" class="circuit-wire" data-source-id="${srcId}" stroke="var(--wire-low)" stroke-width="2.2" fill="none" />`;
                }
            }
            else {
                const allY = [y1, ...sEdges.map(e => e.y2)];
                const minY = Math.min(...allY);
                const maxY = Math.max(...allY);
                const cLead = getCrossings(x1, busX, y1);
                const dLead = formatHopPathH(x1, busX, y1, cLead);
                svg += `<path d="${dLead}" class="circuit-wire" data-source-id="${srcId}" stroke="var(--wire-low)" stroke-width="2.2" fill="none" />`;
                svg += `<path d="M ${busX} ${minY} V ${maxY}" class="circuit-wire" data-source-id="${srcId}" stroke="var(--wire-low)" stroke-width="2.2" fill="none" />`;
                svg += `<circle cx="${busX}" cy="${y1}" r="3.8" class="circuit-junction" data-source-id="${srcId}" fill="var(--wire-low)" />`;
                sEdges.forEach(edge => {
                    const cBranch = getCrossings(busX, edge.x2, edge.y2);
                    const dBranch = formatHopPathH(busX, edge.x2, edge.y2, cBranch);
                    svg += `<path d="${dBranch}" class="circuit-wire" data-source-id="${srcId}" stroke="var(--wire-low)" stroke-width="2.2" fill="none" />`;
                    if (Math.abs(edge.y2 - y1) > 1) {
                        svg += `<circle cx="${busX}" cy="${edge.y2}" r="3.8" class="circuit-junction" data-source-id="${srcId}" fill="var(--wire-low)" />`;
                    }
                });
            }
        });
    });
    return svg;
}
function renderCircuit(graph, container, title) {
    container.innerHTML = "";
    if (!graph || !graph.output)
        return;
    const layout = calculateCircuitLayout(graph);
    let svg = `
        <svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg"
             width="${layout.width}" height="${layout.height}"
             viewBox="0 0 ${layout.width} ${layout.height}">
    `;
    svg += renderEdgesSVG(graph, layout);
    graph.nodes.forEach(node => {
        svg += renderGateSVG(node, layout.positions.get(node.id));
    });
    const outputNode = graph.nodes.find(node => node.id === graph.output);
    const outputPos = layout.positions.get(graph.output);
    const outputInfo = getGateInfo(outputNode);
    const outX = outputInfo.outX(outputPos.x);
    const outY = outputInfo.outY(outputPos.x, outputPos.y);
    svg += `
        <path d="M ${outX} ${outY} H ${outX + 60}" class="circuit-wire output-wire" data-source-id="${graph.output}" stroke="var(--wire-low)" stroke-width="2" fill="none" />
        <g class="output-label-group">
            <circle cx="${outX + 65}" cy="${outY}" r="15" fill="var(--bg-card-alt)" stroke="var(--border-color)" stroke-width="2" />
            <text x="${outX + 65}" y="${outY + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)" class="output-indicator-text">F</text>
        </g>
    `;
    svg += "</svg>";
    container.innerHTML = svg;
    container.querySelectorAll(".pin-interactive").forEach(group => {
        group.addEventListener("click", () => {
            const varName = group.getAttribute("data-var");
            if (varName && currentProbeState.hasOwnProperty(varName)) {
                currentProbeState[varName] = !currentProbeState[varName];
                if (window.StudioFX)
                    window.StudioFX.click(currentProbeState[varName]);
                updateProbeUI();
                updateCircuitSignals();
            }
        });
    });
}
/* =========================================================
   LIVE PROBE CONTROLLER & MULTIMETER HUD
========================================================= */
function setupProbePanels(variables) {
    currentProbeState = {};
    variables.forEach(v => { currentProbeState[v] = false; });
    ["probeSwitchesBasic", "probeSwitchesNand", "probeSwitchesNor"].forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (!panel)
            return;
        panel.innerHTML = variables.map(v => `
            <div class="probe-switch" data-var="${v}">
                <span>${v}</span>
                <span class="probe-val-badge">0</span>
            </div>
        `).join("");
        panel.querySelectorAll(".probe-switch").forEach(btn => {
            btn.addEventListener("click", () => {
                const varName = btn.getAttribute("data-var");
                if (varName) {
                    currentProbeState[varName] = !currentProbeState[varName];
                    if (window.StudioFX)
                        window.StudioFX.click(currentProbeState[varName]);
                    updateProbeUI();
                    updateCircuitSignals();
                }
            });
        });
    });
    updateProbeUI();
    updateCircuitSignals();
}
function updateProbeUI() {
    document.querySelectorAll(".probe-switch").forEach(btn => {
        const varName = btn.getAttribute("data-var");
        if (varName && currentProbeState.hasOwnProperty(varName)) {
            const isHigh = currentProbeState[varName];
            btn.classList.toggle("active", isHigh);
            const badge = btn.querySelector(".probe-val-badge");
            if (badge)
                badge.textContent = isHigh ? "1" : "0";
        }
    });
    document.querySelectorAll(".pin-interactive").forEach(nodeEl => {
        const varName = nodeEl.getAttribute("data-var");
        if (varName && currentProbeState.hasOwnProperty(varName)) {
            const isHigh = currentProbeState[varName];
            const textEl = nodeEl.querySelector("text");
            const rectEl = nodeEl.querySelector("rect");
            if (textEl)
                textEl.textContent = `${varName} = ${isHigh ? "1" : "0"}`;
            if (rectEl) {
                rectEl.setAttribute("stroke", isHigh ? "var(--wire-high)" : "var(--gate-stroke)");
                rectEl.setAttribute("stroke-width", isHigh ? "2.5" : "2");
            }
        }
    });
    if (currentVariables.length > 0) {
        const rowIdx = currentVariables.reduce((acc, v, idx) => {
            return acc | ((currentProbeState[v] ? 1 : 0) << (currentVariables.length - 1 - idx));
        }, 0);
        document.querySelectorAll("#generatedTruthTable tr").forEach((tr, i) => {
            if (i > 0)
                tr.classList.toggle("active-row", (i - 1) === rowIdx);
        });
        const vectorStr = currentVariables.map(v => `${v}=${currentProbeState[v] ? 1 : 0}`).join(", ");
        if (hudVector)
            hudVector.textContent = vectorStr;
    }
}
function updateCircuitSignals() {
    if (currentGraphBasic)
        updateGraphWires(currentGraphBasic, "basicCircuit");
    if (currentGraphNand)
        updateGraphWires(currentGraphNand, "nandCircuit");
    if (currentGraphNor)
        updateGraphWires(currentGraphNor, "norCircuit");
}
function updateGraphWires(graph, containerId) {
    const container = document.getElementById(containerId);
    if (!container)
        return;
    const values = evaluateAllNodeValues(graph, currentProbeState);
    values.forEach((isHigh, nodeId) => {
        container.querySelectorAll(`[data-source-id="${nodeId}"]`).forEach(el => {
            if (el.tagName.toLowerCase() === "path") {
                el.classList.toggle("wire-active", isHigh);
                el.classList.toggle("wire-inactive", !isHigh);
            }
            else if (el.tagName.toLowerCase() === "circle") {
                el.setAttribute("fill", isHigh ? "var(--wire-high)" : "var(--wire-low)");
            }
        });
    });
    const finalVal = values.get(graph.output);
    if (finalVal !== undefined) {
        const ind = container.querySelector(".output-indicator-text");
        if (ind)
            ind.textContent = `F = ${finalVal ? "1" : "0"}`;
        if (containerId === "basicCircuit" && hudOutput) {
            hudOutput.textContent = `${finalVal ? "1" : "0"} (${finalVal ? "5.0 V" : "0.0 V"})`;
            hudOutput.style.color = finalVal ? "#10b981" : "var(--text-muted)";
        }
    }
}
/* =========================================================
   CODE EXPORTS
========================================================= */
function generateVerilog(variables, simplifiedExpr) {
    const vInputs = variables.join(", ");
    let expr = simplifiedExpr
        .replace(/([A-Za-z])'/g, "(~$1)")
        .replace(/\+/g, " | ")
        .replace(/\^/g, " ^ ")
        .replace(/\s+/g, " ");
    return `// Verilog HDL - Boolean Function Synthesis Module\nmodule bool_function (\n    input  wire ${vInputs},\n    output wire F\n);\n    assign F = ${expr};\nendmodule`;
}
function generateCodeFormat(variables, simplifiedExpr) {
    const args = variables.map(v => `bool ${v}`).join(", ");
    let expr = simplifiedExpr
        .replace(/([A-Za-z])'/g, "(!$1)")
        .replace(/\+/g, " || ")
        .replace(/\^/g, " ^ ")
        .replace(/\s+/g, " ");
    return `// C / C++ / Java / Python Boolean Function\nbool evaluate_logic(${args}) {\n    return ${expr};\n}`;
}
function generateLatexFormat(simplifiedExpr) {
    let expr = simplifiedExpr
        .replace(/([A-Za-z])'/g, "\\overline{$1}")
        .replace(/\+/g, " + ")
        .replace(/\^/g, " \\oplus ");
    return `$$F = ${expr}$$`;
}
function generateMarkdownTable(variables, rows) {
    let md = "| " + variables.join(" | ") + " | F |\n";
    md += "| " + variables.map(() => "---").join(" | ") + " | --- |\n";
    rows.forEach(r => {
        const outStr = r.output === 1 ? "1" : r.output === 0 ? "0" : "X";
        md += "| " + r.inputs.join(" | ") + " | " + outStr + " |\n";
    });
    return md;
}
function copyToClipboard(text, btn) {
    if (window.StudioFX)
        window.StudioFX.click(true);
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
function setupExportButtons(variables, simplifiedExpr, rows) {
    const verilog = generateVerilog(variables, simplifiedExpr);
    const code = generateCodeFormat(variables, simplifiedExpr);
    const latex = generateLatexFormat(simplifiedExpr);
    const mdTable = generateMarkdownTable(variables, rows);
    const vPreview = document.getElementById("verilogPreview");
    if (vPreview)
        vPreview.textContent = verilog;
    const cPreview = document.getElementById("codePreview");
    if (cPreview)
        cPreview.textContent = code;
    const lPreview = document.getElementById("latexPreview");
    if (lPreview)
        lPreview.textContent = latex;
    const copyV = document.getElementById("copyVerilogBtn");
    if (copyV)
        copyV.onclick = () => copyToClipboard(verilog, copyV);
    const copyC = document.getElementById("copyCodeBtn");
    if (copyC)
        copyC.onclick = () => copyToClipboard(code, copyC);
    const copyL = document.getElementById("copyLatexBtn");
    if (copyL)
        copyL.onclick = () => copyToClipboard(latex, copyL);
    const copyMd = document.getElementById("copyMarkdownTableBtn");
    if (copyMd)
        copyMd.onclick = () => copyToClipboard(mdTable, copyMd);
}
/* =========================================================
   TRUTH TABLE HTML GENERATION
========================================================= */
function createTruthTableHTML(variables, rows, dontCareIndices) {
    let html = `<table class="truth-table"><thead><tr>`;
    variables.forEach(v => { html += `<th>${v}</th>`; });
    html += `<th>F</th></tr></thead><tbody>`;
    rows.forEach((row, index) => {
        html += `<tr>`;
        row.inputs.forEach(val => { html += `<td>${val}</td>`; });
        let outCell;
        if (dontCareIndices && dontCareIndices.has(index)) {
            outCell = `<span class="tt-dontcare">X</span>`;
        }
        else if (row.output === 1) {
            outCell = `<span class="tt-one">1</span>`;
        }
        else {
            outCell = `<span class="tt-zero">0</span>`;
        }
        html += `<td>${outCell}</td></tr>`;
    });
    html += `</tbody></table>`;
    return html;
}
function generateTruthTableInput() {
    const count = Number(truthVariables.value);
    const variables = generateVariableNames(count);
    const combinations = generateCombinations(count);
    let html = `<table class="truth-table"><thead><tr>`;
    variables.forEach(v => { html += `<th>${v}</th>`; });
    html += `<th>Output (F)</th></tr></thead><tbody>`;
    combinations.forEach((inputs, index) => {
        html += `<tr>`;
        inputs.forEach(v => { html += `<td>${v}</td>`; });
        html += `<td>
            <select class="tt-input-select" data-row="${index}">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="X">X (Don't Care)</option>
            </select>
        </td></tr>`;
    });
    html += `</tbody></table>`;
    userTruthTable.innerHTML = html;
}
function parseNumberList(value) {
    if (!value.trim())
        return [];
    return value.split(",").map(v => Number(v.trim())).filter(v => !isNaN(v));
}
function getExpressionFromTruthTable() {
    const count = Number(truthVariables.value);
    const variables = generateVariableNames(count);
    const combinations = generateCombinations(count);
    const selects = userTruthTable.querySelectorAll(".tt-input-select");
    const rows = [];
    const minterms = [];
    const dontCares = new Set();
    selects.forEach((sel, i) => {
        const val = sel.value;
        if (val === "1") {
            rows.push({ inputs: combinations[i], output: 1 });
            minterms.push(i);
        }
        else if (val === "X") {
            rows.push({ inputs: combinations[i], output: -1 });
            dontCares.add(i);
        }
        else {
            rows.push({ inputs: combinations[i], output: 0 });
        }
    });
    const expression = mintermsToExpression(minterms, count, dontCares.size > 0 ? dontCares : undefined);
    return { variables, rows, expression, dontCares };
}
/* =========================================================
   KARNAUGH MAP GENERATION & OVERLAYS
========================================================= */
function grayCode(n) {
    const result = [];
    const total = 1 << n;
    for (let i = 0; i < total; i++) {
        result.push(i ^ (i >> 1));
    }
    return result;
}
function patternToMinterms(pattern, variableCount) {
    const dashes = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "-")
            dashes.push(i);
    }
    const total = 1 << dashes.length;
    const result = [];
    for (let mask = 0; mask < total; mask++) {
        let minterm = 0;
        for (let i = 0; i < variableCount; i++) {
            if (pattern[i] === "1") {
                minterm |= 1 << (variableCount - 1 - i);
            }
            else if (pattern[i] === "-") {
                const dashPos = dashes.indexOf(i);
                if (dashPos !== -1 && (mask & (1 << dashPos))) {
                    minterm |= 1 << (variableCount - 1 - i);
                }
            }
        }
        result.push(minterm);
    }
    return result;
}
function generateKarnaughMap(variables, rows, dontCares, implicants) {
    var _a;
    const variableCount = variables.length;
    if (variableCount < 2 || variableCount > 4) {
        return `<div class="help-text" style="text-align:center;">Karnaugh maps are displayed for 2 to 4 variables.</div>`;
    }
    let colBits;
    let rowBits;
    if (variableCount === 2) {
        rowBits = 1;
        colBits = 1;
    }
    else if (variableCount === 3) {
        rowBits = 1;
        colBits = 2;
    }
    else {
        rowBits = 2;
        colBits = 2;
    }
    const colGray = grayCode(colBits);
    const rowGray = grayCode(rowBits);
    const grid = [];
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
    const rowLabels = rowGray.map(v => v.toString(2).padStart(rowBits, "0"));
    const colLabels = colGray.map(v => v.toString(2).padStart(colBits, "0"));
    const rowVarStr = variables.slice(0, rowBits).join("");
    const colVarStr = variables.slice(rowBits).join("");
    const groupColors = ["km-group-1", "km-group-2", "km-group-3", "km-group-4", "km-group-5"];
    const borderColors = ["#ef4444", "#2563eb", "#16a34a", "#ea580c", "#9333ea"];
    const legendHTML = (implicants && implicants.length > 0)
        ? `<div class="karnaugh-map-legend">
            ${implicants.map((imp, i) => {
            const borderColor = borderColors[i % borderColors.length];
            return `<span class="legend-item">
                    <span class="legend-swatch" style="border-color:${borderColor};background:${borderColor}20"></span>
                    ${patternToSOPTerm(imp.pattern, variables)}
                </span>`;
        }).join("")}
        </div>`
        : "";
    let html = `<div class="karnaugh-map-wrapper">`;
    html += `<div id="karnaughMapGrid" style="position:relative;display:inline-block;">`;
    html += `<table class="karnaugh-map">`;
    html += `<thead><tr><th style="font-size:14px;">${rowVarStr}\\${colVarStr}</th>`;
    for (const label of colLabels) {
        html += `<th>${label}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (let ri = 0; ri < rowGray.length; ri++) {
        html += `<tr><th>${rowLabels[ri]}</th>`;
        for (let ci = 0; ci < colGray.length; ci++) {
            const minterm = grid[ri][ci];
            const output = (_a = rows[minterm]) === null || _a === void 0 ? void 0 : _a.output;
            let cellClass = "km-zero";
            let cellValue = "0";
            if (output === 1) {
                cellClass = "km-one";
                cellValue = "1";
            }
            else if (output === -1) {
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
    html += `</tbody></table>`;
    if (implicants && implicants.length > 0) {
        for (let i = 0; i < implicants.length; i++) {
            html += `<div class="km-group-overlay ${groupColors[i % groupColors.length]}" id="kmOverlay${i}" style="display:none;"></div>`;
        }
    }
    html += `</div>`;
    if (legendHTML)
        html += legendHTML;
    html += `</div>`;
    return html;
}
function positionKarnaughOverlays(implicants, variableCount) {
    const grid = document.getElementById("karnaughMapGrid");
    if (!grid)
        return;
    const table = grid.querySelector(".karnaugh-map");
    if (!table)
        return;
    implicants.forEach((imp, i) => {
        const overlay = document.getElementById(`kmOverlay${i}`);
        if (!overlay)
            return;
        const minterms = patternToMinterms(imp.pattern, variableCount);
        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        const cellData = table.querySelectorAll("td[data-row]");
        cellData.forEach(cell => {
            var _a;
            const row = parseInt(cell.getAttribute("data-row") || "-1");
            const col = parseInt(cell.getAttribute("data-col") || "-1");
            const mintermText = ((_a = cell.querySelector(".km-minterm")) === null || _a === void 0 ? void 0 : _a.textContent) || "";
            const m = parseInt(mintermText.replace("m", ""));
            if (!isNaN(m) && minterms.includes(m)) {
                if (row < minRow)
                    minRow = row;
                if (row > maxRow)
                    maxRow = row;
                if (col < minCol)
                    minCol = col;
                if (col > maxCol)
                    maxCol = col;
            }
        });
        if (minRow === Infinity)
            return;
        const firstCell = table.querySelector(`td[data-row="${minRow}"][data-col="${minCol}"]`);
        const lastCell = table.querySelector(`td[data-row="${maxRow}"][data-col="${maxCol}"]`);
        if (!firstCell || !lastCell)
            return;
        const gridRect = grid.getBoundingClientRect();
        const firstRect = firstCell.getBoundingClientRect();
        const lastRect = lastCell.getBoundingClientRect();
        const padding = 4;
        const left = firstRect.left - gridRect.left - padding;
        const top = firstRect.top - gridRect.top - padding;
        const width = lastRect.right - firstRect.left + 2 * padding;
        const height = lastRect.bottom - firstRect.top + 2 * padding;
        overlay.style.display = "block";
        overlay.style.left = `${left}px`;
        overlay.style.top = `${top}px`;
        overlay.style.width = `${width}px`;
        overlay.style.height = `${height}px`;
    });
}
/* =========================================================
   VERIFICATION & ERRORS
========================================================= */
function verifyAllCircuits(originalExpression, simplifiedExpression, variables, rows, basicGraph, nandGraph, norGraph) {
    const original = evaluateExpression(originalExpression, variables);
    const simplified = evaluateExpression(simplifiedExpression, variables);
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const assignment = {};
        variables.forEach((variable, variableIndex) => {
            assignment[variable] = Boolean(row.inputs[variableIndex]);
        });
        if (row.output === -1)
            continue;
        const expected = Boolean(row.output);
        const originalOutput = Boolean(original.rows[i].output);
        const simplifiedOutput = Boolean(simplified.rows[i].output);
        const basicOutput = Boolean(evaluateCircuit(basicGraph, assignment));
        const nandOutput = Boolean(evaluateCircuit(nandGraph, assignment));
        const norOutput = Boolean(evaluateCircuit(norGraph, assignment));
        if (originalOutput !== expected ||
            simplifiedOutput !== expected ||
            basicOutput !== expected ||
            nandOutput !== expected ||
            norOutput !== expected) {
            return false;
        }
    }
    return true;
}
function renderVerification(passed, variableCount) {
    if (passed) {
        if (window.StudioFX)
            window.StudioFX.success();
        return `
            <div class="verification-success">
                <strong>✅ All Implementations Verified Successfully</strong>
                <br><br>
                The original Boolean function, simplified expression, AND/OR/NOT circuit, NAND-only circuit, and NOR-only circuit produce 100% identical outputs for all <strong>${2 ** variableCount}</strong> possible input combinations.
            </div>
        `;
    }
    return `
        <div class="verification-failure">
            <strong>❌ Verification Issue Detected</strong>
            <br><br>
            One or more circuit implementations does not match the expected Boolean truth table.
        </div>
    `;
}
let errorTimeout = null;
function showError(message) {
    if (errorTimeout)
        clearTimeout(errorTimeout);
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
    errorTimeout = setTimeout(() => {
        errorMessage.classList.add("hidden");
    }, 5000);
}
function clearError() {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
}
/* =========================================================
   MAIN SOLVER EXECUTION
========================================================= */
solveButton.addEventListener("click", () => {
    void solve();
});
/* =========================================================
   WORD PROBLEM (AI) INPUT
========================================================= */
// Point this at your deployed FastAPI backend (bolean_backend.py).
// Never call the Gemini API directly from the browser - the key
// must stay server-side.
const BOOLEAN_API_BASE = "https://digitalcircuits.onrender.com/";
function setWordProblemStatus(message, isError = false) {
    wordProblemStatus.textContent = message;
    wordProblemStatus.classList.remove("hidden");
    wordProblemStatus.classList.toggle("status-error", isError);
}
function clearWordProblemStatus() {
    wordProblemStatus.textContent = "";
    wordProblemStatus.classList.add("hidden");
    wordProblemStatus.classList.remove("status-error");
}
function showWordProblemLegend(variables, descriptions) {
    if (!descriptions || Object.keys(descriptions).length === 0) {
        wordProblemLegend.classList.add("hidden");
        wordProblemLegend.innerHTML = "";
        return;
    }
    const items = variables
        .map(name => { var _a; return `<strong>${name}</strong> = ${(_a = descriptions[name]) !== null && _a !== void 0 ? _a : "(no description)"}`; })
        .join("<br>");
    wordProblemLegend.innerHTML = items;
    wordProblemLegend.classList.remove("hidden");
}
async function fetchMintermsFromProblem(problemStatement) {
    const response = await fetch(`${BOOLEAN_API_BASE}/api/solve-boolean`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem_statement: problemStatement })
    });
    if (!response.ok) {
        let detail = `Request failed (${response.status})`;
        try {
            const body = await response.json();
            if (body && body.detail)
                detail = body.detail;
        }
        catch (_a) {
            // ignore - use default message
        }
        throw new Error(detail);
    }
    const data = await response.json();
    return {
        variables: Array.isArray(data.variables) ? data.variables : [],
        minterms: Array.isArray(data.minterms) ? data.minterms : [],
        dontCares: Array.isArray(data.dont_cares) ? data.dont_cares : [],
        variableDescriptions: data.variable_descriptions
    };
}
// Same term-building logic as mintermsToExpression, but labels each bit with
// the backend's actual variable name instead of always A, B, C... - so the
// displayed expression matches the truth table headers for word problems
// where Gemini preserved names like F, H, M, D from the original problem.
function mintermsToExpressionWithNames(minterms, variables, dontCares) {
    const variableCount = variables.length;
    if (minterms.length === 0)
        return "0";
    if (minterms.length === 1 << variableCount)
        return "1";
    return minterms.map(m => {
        let term = "";
        for (let i = 0; i < variableCount; i++) {
            const bit = (m >> (variableCount - 1 - i)) & 1;
            term += bit ? variables[i] : `${variables[i]}'`;
        }
        return term;
    }).join(" + ");
}
async function solve() {
    clearError();
    circuitCounter = 0;
    if (window.StudioFX)
        window.StudioFX.relay();
    try {
        let expression;
        let variables;
        let rows;
        let dontCares = new Set();
        let hasDontCares = false;
        if (inputType.value === "wordProblem") {
            const problemStatement = problemStatementInput.value.trim();
            if (!problemStatement)
                throw new Error("Please describe the boolean logic problem.");
            clearWordProblemStatus();
            wordProblemLegend.classList.add("hidden");
            setWordProblemStatus("Asking the AI backend to work out the minterms...");
            solveButton.disabled = true;
            let parsed;
            try {
                parsed = await fetchMintermsFromProblem(problemStatement);
            }
            catch (fetchError) {
                const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
                setWordProblemStatus(`Couldn't solve that problem: ${message}`, true);
                throw new Error("AI conversion failed - see message above.");
            }
            finally {
                solveButton.disabled = false;
            }
            if (parsed.variables.length === 0)
                throw new Error("The AI backend couldn't identify any variables in that problem.");
            variables = parsed.variables;
            dontCares = new Set(parsed.dontCares);
            hasDontCares = dontCares.size > 0;
            expression = mintermsToExpressionWithNames(parsed.minterms, variables, dontCares);
            const combinations = generateCombinations(variables.length);
            rows = combinations.map((inputs, index) => {
                let output;
                if (parsed.minterms.includes(index))
                    output = 1;
                else if (dontCares.has(index))
                    output = -1;
                else
                    output = 0;
                return { inputs, output };
            });
            clearWordProblemStatus();
            showWordProblemLegend(variables, parsed.variableDescriptions);
        }
        else if (inputType.value === "expression") {
            expression = expressionInput.value.trim();
            if (!expression)
                throw new Error("Please enter a Boolean expression.");
            variables = getVariables(expression);
            if (variables.length === 0)
                throw new Error("No Boolean variables were found.");
            rows = evaluateExpression(expression, variables).rows;
        }
        else if (inputType.value === "minterms") {
            const count = Number(mintermVariables.value);
            const minterms = parseNumberList(mintermsInput.value);
            expression = mintermsToExpression(minterms, count);
            variables = generateVariableNames(count);
            rows = evaluateExpression(expression, variables).rows;
        }
        else if (inputType.value === "maxterms") {
            const count = Number(maxtermVariables.value);
            const maxterms = parseNumberList(maxtermsInput.value);
            expression = maxtermsToExpression(maxterms, count);
            variables = generateVariableNames(count);
            rows = evaluateExpression(expression, variables).rows;
        }
        else if (inputType.value === "dontCare") {
            const count = Number(dontCareVariables.value);
            variables = generateVariableNames(count);
            const mintermList = dontCareMintermsInput.value.trim()
                ? parseNumberList(dontCareMintermsInput.value)
                : [];
            const dontCareList = dontCaresInput.value.trim()
                ? parseNumberList(dontCaresInput.value)
                : [];
            if (mintermList.length === 0 && dontCareList.length === 0) {
                throw new Error("Please enter at least minterms or don't care terms.");
            }
            const overlap = mintermList.filter(m => dontCareList.includes(m));
            if (overlap.length > 0) {
                throw new Error(`Terms ${overlap.join(", ")} appear in both minterms and don't cares.`);
            }
            dontCares = new Set(dontCareList);
            hasDontCares = dontCares.size > 0;
            expression = mintermsToExpression(mintermList, count, dontCares);
            const combinations = generateCombinations(count);
            rows = combinations.map((inputs, index) => {
                let output;
                if (mintermList.includes(index))
                    output = 1;
                else if (dontCares.has(index))
                    output = -1;
                else
                    output = 0;
                return { inputs, output };
            });
        }
        else {
            const result = getExpressionFromTruthTable();
            expression = result.expression;
            variables = result.variables;
            rows = result.rows;
            dontCares = result.dontCares;
            hasDontCares = dontCares.size > 0;
        }
        currentVariables = variables;
        currentRows = rows;
        document.getElementById("originalExpression").textContent = expression;
        document.getElementById("generatedTruthTable").innerHTML = createTruthTableHTML(variables, rows, hasDontCares ? dontCares : undefined);
        document.getElementById("canonicalSOP").textContent = generateCanonicalSOP(rows, variables, hasDontCares ? dontCares : undefined);
        document.getElementById("canonicalPOS").textContent = generateCanonicalPOS(rows, variables, hasDontCares ? dontCares : undefined);
        const ones = [];
        const zeros = [];
        rows.forEach((row, index) => {
            if (row.output === 1)
                ones.push(index);
            else if (row.output === 0)
                zeros.push(index);
        });
        const simplifiedSOP = minimizeSOP(ones, variables, hasDontCares ? dontCares : undefined);
        const simplifiedPOS = minimizePOS(zeros, variables, hasDontCares ? dontCares : undefined);
        document.getElementById("simplifiedExpression").textContent = simplifiedSOP.expression;
        if (hudTermCount)
            hudTermCount.textContent = `${simplifiedSOP.implicants.length} Implicants`;
        document.getElementById("karnaughMap").innerHTML = generateKarnaughMap(variables, rows, hasDontCares ? dontCares : undefined, simplifiedSOP.implicants);
        requestAnimationFrame(() => {
            positionKarnaughOverlays(simplifiedSOP.implicants, variables.length);
        });
        if (hasDontCares) {
            const dontCareResults = document.getElementById("dontCareResults");
            const dontCareSummary = document.getElementById("dontCareSummary");
            if (dontCareResults && dontCareSummary) {
                dontCareResults.classList.remove("hidden");
                const mintermIndices = ones.sort((a, b) => a - b).join(", ") || "none";
                const dcIndices = [...dontCares].sort((a, b) => a - b).join(", ") || "none";
                const totalTerms = ones.length + dontCares.size;
                dontCareSummary.innerHTML = `
                    <div style="font-size:14px;line-height:1.7;">
                        <div><strong>Minterms (F = 1):</strong> {${mintermIndices}}</div>
                        <div><strong>Don't Cares (F = X):</strong> <span style="color:#f59e0b;font-weight:700;">{${dcIndices}}</span></div>
                        <div><strong>Total terms used in minimization:</strong> ${totalTerms}</div>
                    </div>
                `;
            }
        }
        setupExportButtons(variables, simplifiedSOP.expression, rows);
        currentGraphBasic = buildBasicSOPCircuit(simplifiedSOP.implicants, variables);
        currentGraphNand = buildNANDCircuit(simplifiedSOP.implicants, variables);
        currentGraphNor = buildNORCircuit(simplifiedPOS.implicants, variables);
        renderCircuit(currentGraphBasic, document.getElementById("basicCircuit"), "AND / OR / NOT Circuit");
        renderCircuit(currentGraphNand, document.getElementById("nandCircuit"), "NAND-Only Circuit");
        renderCircuit(currentGraphNor, document.getElementById("norCircuit"), "NOR-Only Circuit");
        setupProbePanels(variables);
        const verified = verifyAllCircuits(expression, simplifiedSOP.expression, variables, rows, currentGraphBasic, currentGraphNand, currentGraphNor);
        document.getElementById("verification").innerHTML = renderVerification(verified, variables.length);
        results.classList.remove("hidden");
        results.scrollIntoView({ behavior: "smooth" });
    }
    catch (error) {
        console.error(error);
        if (error instanceof Error)
            showError(error.message);
        else
            showError(String(error));
    }
}
/* =========================================================
   TRY EXAMPLE PRESETS
========================================================= */
const examplePresets = [
    { expression: "A'B + BC", description: "3-variable SOP" },
    { expression: "AB + A'C", description: "3-variable multiplex" },
    { expression: "(A+B)(A'+C)", description: "3-variable POS" },
    { expression: "ABC + A'B'C'", description: "Minterms 0 and 7" },
    { expression: "AB + AC + BC", description: "Majority function" },
    { expression: "A^B", description: "XOR 2-var" },
    { expression: "A'B'C + A'BC' + AB'C' + ABC", description: "Full Adder Sum" }
];
let exampleIndex = 0;
const tryExampleBtn = document.getElementById("tryExampleBtn");
if (tryExampleBtn) {
    tryExampleBtn.addEventListener("click", () => {
        if (window.StudioFX)
            window.StudioFX.click(true);
        inputType.value = "expression";
        updateInputInterface();
        clearResults();
        const preset = examplePresets[exampleIndex % examplePresets.length];
        expressionInput.value = preset.expression;
        expressionInput.focus();
        tryExampleBtn.textContent = preset.description;
        exampleIndex++;
    });
}
/* =========================================================
   WORD PROBLEM EXAMPLE PRESETS
========================================================= */
const wordProblemExamplePresets = [
    { problem: "A laboratory door opens when the identity card and PIN are both valid, or when emergency mode is active and either the PIN is correct or faculty authorization is present.", description: "Lab door access" },
    { problem: "A warning light turns on when the engine is overheating, or when the oil pressure is low and the ignition is on.", description: "Engine warning light" },
    { problem: "A student passes the course if they attend at least 75% of the classes and pass the final exam, or if they have special approval from the dean.", description: "Course pass condition" },
    { problem: "A smart irrigation system waters the garden if the soil is dry and it is not raining, or if the manual override switch is turned on.", description: "Smart irrigation" },
    { problem: "An alarm sounds if a window is open and the security system is armed, or if the smoke detector is triggered regardless of the armed state.", description: "Home alarm system" }
];
let wordProblemExampleIndex = 0;
const tryWordProblemExampleBtn = document.getElementById("tryWordProblemExampleBtn");
if (tryWordProblemExampleBtn) {
    tryWordProblemExampleBtn.addEventListener("click", () => {
        if (window.StudioFX)
            window.StudioFX.click(true);
        const preset = wordProblemExamplePresets[wordProblemExampleIndex % wordProblemExamplePresets.length];
        problemStatementInput.value = preset.problem;
        problemStatementInput.focus();
        tryWordProblemExampleBtn.textContent = preset.description;
        wordProblemExampleIndex++;
    });
}
/* =========================================================
   COPY BUTTONS
========================================================= */
document.querySelectorAll(".copy-btn").forEach(button => {
    button.addEventListener("click", () => {
        var _a;
        const expressionRow = button.closest(".expression-row");
        if (!expressionRow)
            return;
        const box = expressionRow.querySelector(".expression-box");
        if (!box)
            return;
        const text = (_a = box.textContent) === null || _a === void 0 ? void 0 : _a.trim();
        if (!text)
            return;
        copyToClipboard(text, button);
    });
});
/* =========================================================
   INITIALIZATION
========================================================= */
updateNumericExamples();
generateTruthTableInput();
initZoomPanControls();