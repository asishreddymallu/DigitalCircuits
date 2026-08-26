/**
 * Circuit graph model and the three synthesized implementations
 * (AND/OR/NOT, NAND-only, NOR-only) for the minimized function.
 *
 * Nodes form a DAG; `output` names the driving node. INPUT nodes are deduped
 * per variable label so multi-character names (PIN, RESET_N) flow through
 * untouched. Constants appear when the function collapses to 0/1 (E3).
 */

import type { Implicant } from "../../../shared/ts/boolean/minimizer";

export type GateType = "INPUT" | "CONST" | "NOT" | "AND" | "OR" | "NAND" | "NOR";

export interface CircuitNode {
    id: string;
    type: GateType;
    inputs: string[];
    label: string;
}

export interface CircuitGraph {
    nodes: CircuitNode[];
    output: string;
    inputs: string[];
}

let circuitCounter = 0;

/** Reset id generation between solves so ids stay small and stable. */
export function resetCircuitIds(): void {
    circuitCounter = 0;
}

function createGraph(): CircuitGraph {
    return { nodes: [], output: "", inputs: [] };
}

function addNode(graph: CircuitGraph, type: GateType, inputs: string[] = [], label = ""): string {
    const id = `node_${circuitCounter++}`;
    graph.nodes.push({ id, type, inputs, label });
    return id;
}

function addInput(graph: CircuitGraph, variable: string): string {
    const existing = graph.nodes.find(n => n.type === "INPUT" && n.label === variable);
    if (existing) return existing.id;
    const id = addNode(graph, "INPUT", [], variable);
    graph.inputs.push(id);
    return id;
}

const isAllDash = (imp: Implicant, n: number) => imp.pattern === "-".repeat(n);

/**
 * Classic two-level SOP: NOT gates feed AND terms; a single OR combines them.
 * Single-literal terms bypass gate creation (the literal feeds the OR directly).
 */
export function buildBasicSOPCircuit(implicants: Implicant[], variables: string[]): CircuitGraph {
    const graph = createGraph();
    variables.forEach(v => addInput(graph, v));

    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }
    if (implicants.length === 1 && isAllDash(implicants[0], variables.length)) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }

    // One shared inverter per complemented variable keeps the schematic tidy.
    const notMap = new Map<string, string>();
    const getNot = (varName: string): string => {
        if (!notMap.has(varName)) {
            const inId = addInput(graph, varName);
            notMap.set(varName, addNode(graph, "NOT", [inId], `~${varName}`));
        }
        return notMap.get(varName)!;
    };

    const termNodeIds: string[] = [];
    implicants.forEach(imp => {
        const literalIds: string[] = [];
        for (let i = 0; i < imp.pattern.length; i++) {
            if (imp.pattern[i] === "1") literalIds.push(addInput(graph, variables[i]));
            else if (imp.pattern[i] === "0") literalIds.push(getNot(variables[i]));
        }
        if (literalIds.length === 1) {
            termNodeIds.push(literalIds[0]);
        } else if (literalIds.length > 1) {
            termNodeIds.push(addNode(graph, "AND", literalIds));
        }
    });

    graph.output = termNodeIds.length === 1
        ? termNodeIds[0]
        : addNode(graph, "OR", termNodeIds);
    return graph;
}

/**
 * NAND-NAND realization of SOP. Each SOP term becomes a NAND of its literals
 * (a single literal is buffered through a self-input NAND inverter), and the
 * final gate is a NAND over all term outputs — De Morgan turns that final
 * NAND into the OR of the complemented terms.
 */
export function buildNANDCircuit(implicants: Implicant[], variables: string[]): CircuitGraph {
    const graph = createGraph();
    variables.forEach(v => addInput(graph, v));

    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }
    if (implicants.length === 1 && isAllDash(implicants[0], variables.length)) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }

    const notMap = new Map<string, string>();
    const getNandNot = (varName: string): string => {
        if (!notMap.has(varName)) {
            const inId = addInput(graph, varName);
            notMap.set(varName, addNode(graph, "NAND", [inId, inId], `~${varName}`));
        }
        return notMap.get(varName)!;
    };

    const layer1Ids: string[] = [];
    implicants.forEach(imp => {
        const literals: string[] = [];
        for (let i = 0; i < imp.pattern.length; i++) {
            if (imp.pattern[i] === "1") literals.push(addInput(graph, variables[i]));
            else if (imp.pattern[i] === "0") literals.push(getNandNot(variables[i]));
        }
        if (literals.length === 1) {
            layer1Ids.push(addNode(graph, "NAND", [literals[0], literals[0]]));
        } else {
            layer1Ids.push(addNode(graph, "NAND", literals));
        }
    });

    graph.output = layer1Ids.length === 1
        ? addNode(graph, "NAND", [layer1Ids[0], layer1Ids[0]])
        : addNode(graph, "NAND", layer1Ids);
    return graph;
}

/**
 * NOR-NOR realization of the POS cover. POS clause convention: pattern '0'
 * → plain variable, '1' → complemented variable.
 */
export function buildNORCircuit(implicants: Implicant[], variables: string[]): CircuitGraph {
    const graph = createGraph();
    variables.forEach(v => addInput(graph, v));

    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }
    if (implicants.length === 1 && isAllDash(implicants[0], variables.length)) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }

    const notMap = new Map<string, string>();
    const getNorNot = (varName: string): string => {
        if (!notMap.has(varName)) {
            const inId = addInput(graph, varName);
            notMap.set(varName, addNode(graph, "NOR", [inId, inId], `~${varName}`));
        }
        return notMap.get(varName)!;
    };

    const layer1Ids: string[] = [];
    implicants.forEach(imp => {
        const literals: string[] = [];
        for (let i = 0; i < imp.pattern.length; i++) {
            if (imp.pattern[i] === "0") literals.push(addInput(graph, variables[i]));
            else if (imp.pattern[i] === "1") literals.push(getNorNot(variables[i]));
        }
        if (literals.length === 1) {
            layer1Ids.push(addNode(graph, "NOR", [literals[0], literals[0]]));
        } else {
            layer1Ids.push(addNode(graph, "NOR", literals));
        }
    });

    graph.output = layer1Ids.length === 1
        ? addNode(graph, "NOR", [layer1Ids[0], layer1Ids[0]])
        : addNode(graph, "NOR", layer1Ids);
    return graph;
}

/* ------------------------------------------------------------------ */
/* Evaluation                                                          */
/* ------------------------------------------------------------------ */

/** Evaluate one node output with memoization (used by verification). */
export function evaluateCircuit(graph: CircuitGraph, assignment: Record<string, boolean>): boolean {
    const memo = new Map<string, boolean>();

    function evaluateNode(id: string): boolean {
        const cached = memo.get(id);
        if (cached !== undefined) return cached;
        const node = graph.nodes.find(n => n.id === id);
        if (!node) return false;

        let result = false;
        switch (node.type) {
            case "INPUT": result = assignment[node.label] ?? false; break;
            case "CONST": result = node.label === "1"; break;
            case "NOT": result = !evaluateNode(node.inputs[0]); break;
            case "AND": result = node.inputs.every(inId => evaluateNode(inId)); break;
            case "OR": result = node.inputs.some(inId => evaluateNode(inId)); break;
            case "NAND": result = !node.inputs.every(inId => evaluateNode(inId)); break;
            case "NOR": result = !node.inputs.some(inId => evaluateNode(inId)); break;
        }

        memo.set(id, result);
        return result;
    }

    return evaluateNode(graph.output);
}

/** Evaluate every node (used to color wires during live probing). */
export function evaluateAllNodeValues(graph: CircuitGraph, assignment: Record<string, boolean>): Map<string, boolean> {
    const nodeValues = new Map<string, boolean>();

    function evalNode(id: string): boolean {
        const cached = nodeValues.get(id);
        if (cached !== undefined) return cached;
        const node = graph.nodes.find(n => n.id === id);
        if (!node) return false;

        let val = false;
        switch (node.type) {
            case "INPUT": val = assignment[node.label] ?? false; break;
            case "CONST": val = node.label === "1"; break;
            case "NOT": val = !evalNode(node.inputs[0]); break;
            case "AND": val = node.inputs.every(inp => evalNode(inp)); break;
            case "OR": val = node.inputs.some(inp => evalNode(inp)); break;
            case "NAND": val = !node.inputs.every(inp => evalNode(inp)); break;
            case "NOR": val = !node.inputs.some(inp => evalNode(inp)); break;
        }
        nodeValues.set(id, val);
        return val;
    }

    graph.nodes.forEach(n => evalNode(n.id));
    return nodeValues;
}
