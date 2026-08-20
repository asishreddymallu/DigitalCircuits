/* =========================================================
   BOOLEAN LOGIC SOLVER - FIXED SCHEMATIC CIRCUIT ENGINE
   - Standard schematic gate geometry (AND, OR, NOT, NAND, NOR)
   - Dynamic channel wire routing with zero overlaps
   - Accurate port collision boundaries
   - Truth table generation & Quine-McCluskey minimization
   - Complete verification and PNG download export
========================================================= */

/* =========================================================
   TYPES
========================================================= */

type Token =
    | { type: "VARIABLE"; value: string }
    | { type: "POSTFIX_NOT" | "OR" | "XOR" | "AND" | "NOT" | "LPAREN" | "RPAREN" };

type ASTNode =
    | { type: "VARIABLE"; name: string }
    | { type: "NOT"; child: ASTNode }
    | { type: "AND"; left: ASTNode; right: ASTNode }
    | { type: "OR"; left: ASTNode; right: ASTNode }
    | { type: "XOR"; left: ASTNode; right: ASTNode }
    | { type: "CONST"; value: boolean };

interface TruthRow {
    inputs: number[];
    output: number;
}

interface Implicant {
    pattern: string;
    covered?: number[];
}

type GateType = "INPUT" | "CONST" | "NOT" | "AND" | "OR" | "NAND" | "NOR";

interface CircuitNode {
    id: string;
    type: GateType;
    inputs: string[];
    label: string;
}

interface CircuitGraph {
    nodes: CircuitNode[];
    output: string | null;
    inputMap?: Map<string, string>;
}

interface LayoutPosition {
    x: number;
    y: number;
}

interface CircuitLayout {
    positions: Map<string, LayoutPosition>;
    levels: Map<string, number>;
    width: number;
    height: number;
    levelGap: number;
    paddingX: number;
}

interface GateInfo {
    width: number;
    height: number;
    outX: (x: number) => number;
    outY: (x: number, y: number) => number;
    inX: (x: number, y: number, i: number, count: number) => number;
    inY: (x: number, y: number, i: number, count: number) => number;
}

interface CoverCandidate {
    terms: number;
    literals: number;
    chosen: number[];
}

interface Edge {
    sourceId: string;
    targetId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    sourceLevel: number;
    targetLevel: number;
}

interface SourceGroup {
    id: string;
    edges: Edge[];
    x1: number;
    y1: number;
    minTargetX: number;
}

/* =========================================================
   DOM ELEMENTS
========================================================= */

const inputType = document.getElementById("inputType") as HTMLSelectElement;
const expressionSection = document.getElementById("expressionSection") as HTMLElement;
const mintermSection = document.getElementById("mintermSection") as HTMLElement;
const maxtermSection = document.getElementById("maxtermSection") as HTMLElement;
const dontCareSection = document.getElementById("dontCareSection") as HTMLElement;
const truthTableSection = document.getElementById("truthTableSection") as HTMLElement;

const expressionInput = document.getElementById("expression") as HTMLInputElement;
const mintermVariables = document.getElementById("mintermVariables") as HTMLSelectElement;
const maxtermVariables = document.getElementById("maxtermVariables") as HTMLSelectElement;
const dontCareVariables = document.getElementById("dontCareVariables") as HTMLSelectElement;
const truthVariables = document.getElementById("truthVariables") as HTMLSelectElement;
const mintermsInput = document.getElementById("minterms") as HTMLInputElement;
const maxtermsInput = document.getElementById("maxterms") as HTMLInputElement;
const dontCareMintermsInput = document.getElementById("dontCareMinterms") as HTMLInputElement;
const dontCaresInput = document.getElementById("dontCares") as HTMLInputElement;

const solveButton = document.getElementById("solveButton") as HTMLButtonElement;
const results = document.getElementById("results") as HTMLElement;
const errorMessage = document.getElementById("errorMessage") as HTMLElement;

const mintermExample = document.getElementById("mintermExample") as HTMLElement;
const maxtermExample = document.getElementById("maxtermExample") as HTMLElement;
const dontCareMintermExample = document.getElementById("dontCareMintermExample") as HTMLElement;
const dontCareExample = document.getElementById("dontCareExample") as HTMLElement;

/* =========================================================
   DYNAMIC EXAMPLES
========================================================= */

const exampleData: Record<number, { minterms: string; maxterms: string }> = {
    2: { minterms: "1,2", maxterms: "0,3" },
    3: { minterms: "1,3,5,7", maxterms: "0,2,4,6" },
    4: { minterms: "1,3,7,11", maxterms: "0,2,4,8" },
    5: { minterms: "1,5,9,17", maxterms: "0,2,8,16" },
    6: { minterms: "1,5,9,17,33", maxterms: "0,2,8,24,40" }
};

const dontCareExampleData: Record<number, { minterms: string; dontCares: string }> = {
    2: { minterms: "1,3", dontCares: "0" },
    3: { minterms: "1,3,5", dontCares: "0,7" },
    4: { minterms: "1,3,5,15", dontCares: "0,7,12" },
    5: { minterms: "1,5,9,15,31", dontCares: "0,8,16,24" },
    6: { minterms: "1,5,9,15,33,45", dontCares: "0,8,16,32,40" }
};

function updateNumericExamples(): void {
    const minCount = Number(mintermVariables.value);
    const maxCount = Number(maxtermVariables.value);

    const minExample = exampleData[minCount];
    const maxExample = exampleData[maxCount];

    if (minExample) {
        mintermsInput.placeholder = `Example: ${minExample.minterms}`;
        mintermExample.innerHTML = `Example: <code>${minExample.minterms}</code>`;
    }

    if (maxExample) {
        maxtermsInput.placeholder = `Example: ${maxExample.maxterms}`;
        maxtermExample.innerHTML = `Example: <code>${maxExample.maxterms}</code>`;
    }
}

function updateDontCareExamples(): void {
    const count = Number(dontCareVariables.value);
    const example = dontCareExampleData[count];
    if (example) {
        dontCareMintermsInput.placeholder = `Example: ${example.minterms}`;
        dontCareMintermExample.innerHTML = `Example: <code>${example.minterms}</code>`;
        dontCaresInput.placeholder = `Example: ${example.dontCares}`;
        dontCareExample.innerHTML = `Example: <code>${example.dontCares}</code>`;
    }
}

/* =========================================================
   CLEAR RESULTS
========================================================= */

function clearResults(): void {
    results.classList.add("hidden");
    clearError();

    [
        "originalExpression",
        "generatedTruthTable",
        "canonicalSOP",
        "canonicalPOS",
        "simplifiedExpression",
        "karnaughMap",
        "basicCircuit",
        "nandCircuit",
        "norCircuit",
        "verification"
    ].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.innerHTML = "";
    });

    const dontCareResults = document.getElementById("dontCareResults");
    if (dontCareResults) dontCareResults.classList.add("hidden");
}

/* =========================================================
   INPUT TYPE LISTENERS
========================================================= */

inputType.addEventListener("change", () => {
    clearResults();
    updateInputInterface();
});

function updateInputInterface(): void {
    expressionSection.classList.add("hidden");
    mintermSection.classList.add("hidden");
    maxtermSection.classList.add("hidden");
    dontCareSection.classList.add("hidden");
    truthTableSection.classList.add("hidden");

    switch (inputType.value) {
        case "expression":
            expressionSection.classList.remove("hidden");
            break;
        case "minterms":
            mintermSection.classList.remove("hidden");
            updateNumericExamples();
            break;
        case "maxterms":
            maxtermSection.classList.remove("hidden");
            updateNumericExamples();
            break;
        case "dontCare":
            dontCareSection.classList.remove("hidden");
            updateDontCareExamples();
            break;
        case "truthTable":
            truthTableSection.classList.remove("hidden");
            generateTruthTableInput();
            break;
    }
}

[expressionInput, mintermsInput, maxtermsInput, dontCareMintermsInput, dontCaresInput].forEach(element => {
    element.addEventListener("input", clearResults);
});

mintermVariables.addEventListener("change", () => {
    clearResults();
    updateNumericExamples();
});

maxtermVariables.addEventListener("change", () => {
    clearResults();
    updateNumericExamples();
});

dontCareVariables.addEventListener("change", () => {
    clearResults();
    updateDontCareExamples();
});

truthVariables.addEventListener("change", () => {
    clearResults();
    generateTruthTableInput();
});

document.addEventListener("change", (event: Event) => {
    const target = event.target as Element;
    if (target.classList.contains("truth-input")) {
        clearResults();
    }
});

/* =========================================================
   VARIABLES & TOKENIZER
========================================================= */

function getVariables(expression: string): string[] {
    const matches = expression.match(/[A-Z]/gi) || [];
    return [...new Set(matches.map(value => value.toUpperCase()))].sort();
}

function generateVariableNames(count: number): string[] {
    const variables = [];
    for (let i = 0; i < count; i++) {
        variables.push(String.fromCharCode(65 + i));
    }
    return variables;
}

function tokenize(expression: string): Token[] {
    const exp = expression.toUpperCase().replace(/\s+/g, "");
    const tokens: Token[] = [];
    let i = 0;

    while (i < exp.length) {
        const char = exp[i];

        if (/[A-Z]/.test(char)) {
            tokens.push({ type: "VARIABLE", value: char });
            i++;
            continue;
        }
        if (char === "'") {
            tokens.push({ type: "POSTFIX_NOT" });
            i++;
            continue;
        }
        if (char === "+") {
            tokens.push({ type: "OR" });
            i++;
            continue;
        }
        if (char === "*") {
            tokens.push({ type: "AND" });
            i++;
            continue;
        }
        if (char === "!") {
            tokens.push({ type: "NOT" });
            i++;
            continue;
        }
        if (char === "^") {
            tokens.push({ type: "XOR" });
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

        throw new Error(`Invalid character: ${char}`);
    }

    return insertImplicitAND(tokens);
}

function insertImplicitAND(tokens: Token[]): Token[] {
    const result: Token[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i];
        const previous = result[result.length - 1];

        if (
            previous &&
            (previous.type === "VARIABLE" || previous.type === "RPAREN" || previous.type === "POSTFIX_NOT") &&
            (current.type === "VARIABLE" || current.type === "LPAREN" || current.type === "NOT")
        ) {
            result.push({ type: "AND" });
        }

        result.push(current);
    }
    return result;
}

/* =========================================================
   PARSER & AST EVALUATION
========================================================= */

class BooleanParser {
    private tokens: Token[];
    private position: number;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
        this.position = 0;
    }

    current(): Token | undefined { return this.tokens[this.position]; }

    consume(type: Token["type"]): Token {
        const current = this.current();
        if (!current || current.type !== type) {
            throw new Error(`Expected ${type}`);
        }
        return this.tokens[this.position++];
    }

    parse(): ASTNode {
        const node = this.parseOR();
        if (this.current()) {
            throw new Error("Unexpected token in expression");
        }
        return node;
    }

    parseOR(): ASTNode {
        let node = this.parseXOR();
        let current = this.current();
        while (current && current.type === "OR") {
            this.consume("OR");
            node = { type: "OR", left: node, right: this.parseXOR() };
            current = this.current();
        }
        return node;
    }

    parseXOR(): ASTNode {
        let node = this.parseAND();
        let current = this.current();
        while (current && current.type === "XOR") {
            this.consume("XOR");
            node = { type: "XOR", left: node, right: this.parseAND() };
            current = this.current();
        }
        return node;
    }

    parseAND(): ASTNode {
        let node = this.parseNOT();
        let current = this.current();
        while (current && current.type === "AND") {
            this.consume("AND");
            node = { type: "AND", left: node, right: this.parseNOT() };
            current = this.current();
        }
        return node;
    }

    parseNOT(): ASTNode {
        const current = this.current();
        if (current && current.type === "NOT") {
            this.consume("NOT");
            return { type: "NOT", child: this.parseNOT() };
        }
        return this.parsePrimary();
    }

    parsePrimary(): ASTNode {
        const token = this.current();
        if (!token) throw new Error("Unexpected end of expression");

        if (token.type === "VARIABLE") {
            this.position++;
            let node: ASTNode = { type: "VARIABLE", name: token.value };
            let current = this.current();
            while (current && current.type === "POSTFIX_NOT") {
                this.consume("POSTFIX_NOT");
                node = { type: "NOT", child: node };
                current = this.current();
            }
            return node;
        }

        if (token.type === "LPAREN") {
            this.consume("LPAREN");
            let node: ASTNode = this.parseOR();
            this.consume("RPAREN");
            let current = this.current();
            while (current && current.type === "POSTFIX_NOT") {
                this.consume("POSTFIX_NOT");
                node = { type: "NOT", child: node };
                current = this.current();
            }
            return node;
        }

        throw new Error("Expected variable or '('");
    }
}

function evaluateAST(node: ASTNode, assignment: Record<string, boolean>): boolean {
    switch (node.type) {
        case "VARIABLE": return Boolean(assignment[node.name]);
        case "NOT": return !evaluateAST(node.child, assignment);
        case "AND": return evaluateAST(node.left, assignment) && evaluateAST(node.right, assignment);
        case "OR": return evaluateAST(node.left, assignment) || evaluateAST(node.right, assignment);
        case "XOR": return evaluateAST(node.left, assignment) !== evaluateAST(node.right, assignment);
        case "CONST": return Boolean(node.value);
        default: throw new Error(`Unknown AST node: ${(node as ASTNode).type}`);
    }
}

function generateCombinations(variableCount: number): number[][] {
    const total = 2 ** variableCount;
    const combinations = [];
    for (let number = 0; number < total; number++) {
        const row = [];
        for (let bit = variableCount - 1; bit >= 0; bit--) {
            row.push((number >> bit) & 1);
        }
        combinations.push(row);
    }
    return combinations;
}

function evaluateExpression(expression: string, variables: string[]): { ast: ASTNode; rows: TruthRow[] } {
    if (expression === "0" || expression === "1") {
        const value = expression === "1";
        return {
            ast: { type: "CONST", value },
            rows: generateCombinations(variables.length).map(inputs => ({ inputs, output: value ? 1 : 0 }))
        };
    }

    const tokens = tokenize(expression);
    const parser = new BooleanParser(tokens);
    const ast = parser.parse();

    const combinations = generateCombinations(variables.length);
    const rows: TruthRow[] = combinations.map(values => {
        const assignment: Record<string, boolean> = {};
        variables.forEach((variable, index) => {
            assignment[variable] = Boolean(values[index]);
        });
        const output = evaluateAST(ast, assignment);
        return { inputs: values, output: output ? 1 : 0 };
    });

    return { ast, rows };
}

/* =========================================================
   CANONICAL FORMS & MINIMIZATION
========================================================= */

function mintermsToExpression(minterms: number[], variableCount: number, dontCares?: Set<number>): string {
    const variables = generateVariableNames(variableCount);
    if (minterms.length === 0) return "0";
    const total = 2 ** variableCount;

    minterms.forEach(number => {
        if (number < 0 || number >= total) {
            throw new Error(`Minterm ${number} is invalid for ${variableCount} variables.`);
        }
    });

    if (dontCares) {
        dontCares.forEach(number => {
            if (number < 0 || number >= total) {
                throw new Error(`Don't care term ${number} is invalid for ${variableCount} variables.`);
            }
        });
    }

    const unique = [...new Set(minterms)].sort((a, b) => a - b);
    if (unique.length === total) return "1";

    const terms = unique.map(number => {
        const binary = number.toString(2).padStart(variableCount, "0");
        let term = "";
        variables.forEach((variable, index) => {
            term += binary[index] === "1" ? variable : variable + "'";
        });
        return term;
    });

    let result = terms.join(" + ");
    if (dontCares && dontCares.size > 0) {
        const dcSorted = [...dontCares].sort((a, b) => a - b);
        result += `  (don't cares: {${dcSorted.join(", ")}})`;
    }
    return result;
}

function maxtermsToExpression(maxterms: number[], variableCount: number, dontCares?: Set<number>): string {
    const variables = generateVariableNames(variableCount);
    if (maxterms.length === 0) return "1";
    const total = 2 ** variableCount;

    maxterms.forEach(number => {
        if (number < 0 || number >= total) {
            throw new Error(`Maxterm ${number} is invalid for ${variableCount} variables.`);
        }
    });

    if (dontCares) {
        dontCares.forEach(number => {
            if (number < 0 || number >= total) {
                throw new Error(`Don't care term ${number} is invalid for ${variableCount} variables.`);
            }
        });
    }

    const unique = [...new Set(maxterms)].sort((a, b) => a - b);
    if (unique.length === total) return "0";

    const clauses = unique.map(number => {
        const binary = number.toString(2).padStart(variableCount, "0");
        const literals = variables.map((variable, index) =>
            binary[index] === "0" ? variable : variable + "'"
        );
        return "(" + literals.join(" + ") + ")";
    });

    let result = clauses.join("");
    if (dontCares && dontCares.size > 0) {
        const dcSorted = [...dontCares].sort((a, b) => a - b);
        result += `  (don't cares: {${dcSorted.join(", ")}})`;
    }
    return result;
}

function generateCanonicalSOP(rows: TruthRow[], variables: string[], dontCares?: Set<number>): string {
    const minterms: number[] = [];
    rows.forEach((row, index) => { if (row.output === 1) minterms.push(index); });
    return mintermsToExpression(minterms, variables.length, dontCares);
}

function generateCanonicalPOS(rows: TruthRow[], variables: string[], dontCares?: Set<number>): string {
    const maxterms: number[] = [];
    rows.forEach((row, index) => { if (row.output === 0) maxterms.push(index); });
    return maxtermsToExpression(maxterms, variables.length, dontCares);
}

function canCombine(a: string, b: string): boolean {
    let differences = 0;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            if (a[i] === "-" || b[i] === "-") return false;
            differences++;
        }
    }
    return differences === 1;
}

function combinePatterns(a: string, b: string): string {
    let result = "";
    for (let i = 0; i < a.length; i++) {
        result += a[i] === b[i] ? a[i] : "-";
    }
    return result;
}

function patternCovers(pattern: string, minterm: number, variableCount: number): boolean {
    const binary = minterm.toString(2).padStart(variableCount, "0");
    for (let i = 0; i < variableCount; i++) {
        if (pattern[i] !== "-" && pattern[i] !== binary[i]) return false;
    }
    return true;
}

function getPrimeImplicants(minterms: number[], variableCount: number): Implicant[] {
    let current: Implicant[] = minterms.map(minterm => ({
        pattern: minterm.toString(2).padStart(variableCount, "0"),
        covered: [minterm]
    }));

    const primes: Implicant[] = [];

    while (current.length > 0) {
        const next: Implicant[] = [];
        const used = new Set<number>();

        for (let i = 0; i < current.length; i++) {
            for (let j = i + 1; j < current.length; j++) {
                if (canCombine(current[i].pattern, current[j].pattern)) {
                    const pattern = combinePatterns(current[i].pattern, current[j].pattern);
                    used.add(i);
                    used.add(j);

                    const covered = [...new Set([...current[i].covered!, ...current[j].covered!])];
                    if (!next.some(item => item.pattern === pattern)) {
                        next.push({ pattern, covered });
                    }
                }
            }
        }

        current.forEach((implicant, index) => {
            if (!used.has(index) && !primes.some(item => item.pattern === implicant.pattern)) {
                primes.push(implicant);
            }
        });

        current = next;
    }

    return primes;
}

function findMinimumCover(minterms: number[], primes: Implicant[], variableCount: number): Implicant[] {
    if (minterms.length === 0) return [];

    const candidates = new Map<number, number[]>();
    minterms.forEach(minterm => candidates.set(minterm, []));

    primes.forEach((prime, index) => {
        minterms.forEach(minterm => {
            if (patternCovers(prime.pattern, minterm, variableCount)) {
                candidates.get(minterm)!.push(index);
            }
        });
    });

    const selected = new Set<number>();
    const covered = new Set<number>();
    let changed = true;

    while (changed) {
        changed = false;
        minterms.forEach(minterm => {
            const list = candidates.get(minterm)!;
            const remaining = list.filter(index => !selected.has(index));
            if (remaining.length === 1) {
                const index = remaining[0];
                if (!selected.has(index)) {
                    selected.add(index);
                    changed = true;
                    minterms.forEach(m => {
                        if (patternCovers(primes[index].pattern, m, variableCount)) {
                            covered.add(m);
                        }
                    });
                }
            }
        });
    }

    if (covered.size === minterms.length) {
        return [...selected].map(index => primes[index]);
    }

    const remaining = minterms.filter(m => !covered.has(m));
    let best: CoverCandidate | null = null as CoverCandidate | null;

    function search(uncovered: number[], chosen: number[]): void {
        if (uncovered.length === 0) {
            const literalCount = chosen.reduce((sum, index) =>
                sum + primes[index].pattern.split("").filter(bit => bit !== "-").length, 0
            );
            const candidate = { terms: chosen.length, literals: literalCount, chosen: [...chosen] };
            if (!best || candidate.terms < best.terms || (candidate.terms === best.terms && candidate.literals < best.literals)) {
                best = candidate;
            }
            return;
        }

        if (best && chosen.length >= best.terms) return;

        let target = uncovered[0];
        let targetCandidates = candidates.get(target)!;

        uncovered.forEach(minterm => {
            const list = candidates.get(minterm)!;
            if (list.length < targetCandidates.length) {
                target = minterm;
                targetCandidates = list;
            }
        });

        for (const index of targetCandidates) {
            if (chosen.includes(index)) continue;
            const newUncovered = uncovered.filter(m => !patternCovers(primes[index].pattern, m, variableCount));
            search(newUncovered, [...chosen, index]);
        }
    }

    search(remaining, [...selected]);

    return best ? best.chosen.map(index => primes[index]) : [...selected].map(index => primes[index]);
}

function patternToSOPTerm(pattern: string, variables: string[]): string {
    let term = "";
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "1") term += variables[i];
        else if (pattern[i] === "0") term += variables[i] + "'";
    }
    return term || "1";
}

function sopFromImplicants(implicants: Implicant[], variables: string[]): string {
    if (implicants.length === 0) return "0";
    return implicants.map(item => patternToSOPTerm(item.pattern, variables)).join(" + ");
}

function patternToPOSClause(pattern: string, variables: string[]): string {
    const literals: string[] = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "0") literals.push(variables[i]);
        else if (pattern[i] === "1") literals.push(variables[i] + "'");
    }
    return "(" + literals.join(" + ") + ")";
}

function posFromImplicants(implicants: Implicant[], variables: string[]): string {
    if (implicants.length === 0) return "1";
    return implicants.map(item => patternToPOSClause(item.pattern, variables)).join("");
}

function minimizeSOP(minterms: number[], variables: string[], dontCares?: Set<number>): { expression: string; implicants: Implicant[] } {
    const variableCount = variables.length;
    const total = 2 ** variableCount;

    if (minterms.length === 0) return { expression: "0", implicants: [] };
    if (minterms.length === total) return { expression: "1", implicants: [{ pattern: "-".repeat(variableCount) }] };

    // Combine minterms with don't cares for prime implicant calculation
    const allTerms = dontCares ? [...new Set([...minterms, ...dontCares])] : [...minterms];
    allTerms.sort((a, b) => a - b);

    const primes = getPrimeImplicants(allTerms, variableCount);
    // Only cover the required minterms, don't cares are optional
    const selected = findMinimumCover(minterms, primes, variableCount);

    return { expression: sopFromImplicants(selected, variables), implicants: selected };
}

function minimizePOS(zeros: number[], variables: string[], dontCares?: Set<number>): { expression: string; implicants: Implicant[] } {
    const variableCount = variables.length;
    const total = 2 ** variableCount;

    if (zeros.length === 0) return { expression: "1", implicants: [] };
    if (zeros.length === total) return { expression: "0", implicants: [{ pattern: "-".repeat(variableCount) }] };

    // Combine zeros with don't cares for prime implicant calculation
    const allTerms = dontCares ? [...new Set([...zeros, ...dontCares])] : [...zeros];
    allTerms.sort((a, b) => a - b);

    const primes = getPrimeImplicants(allTerms, variableCount);
    // Only cover the required zeros, don't cares are optional
    const selected = findMinimumCover(zeros, primes, variableCount);

    return { expression: posFromImplicants(selected, variables), implicants: selected };
}

/* =========================================================
   CIRCUIT GRAPH GENERATION
========================================================= */

let circuitCounter = 0;

function createGraph(): CircuitGraph {
    return { nodes: [], output: null };
}

function addNode(graph: CircuitGraph, type: GateType, inputs: string[] = [], label = ""): string {
    const node: CircuitNode = { id: `node_${circuitCounter++}`, type, inputs, label };
    graph.nodes.push(node);
    return node.id;
}

function addInput(graph: CircuitGraph, variable: string): string {
    if (!graph.inputMap) graph.inputMap = new Map<string, string>();
    const existingId = graph.inputMap.get(variable);
    if (existingId) return existingId;
    const id = addNode(graph, "INPUT", [], variable);
    graph.inputMap.set(variable, id);
    return id;
}

function buildBasicSOPCircuit(implicants: Implicant[], variables: string[]): CircuitGraph {
    const graph = createGraph();

    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }

    if (implicants.length === 1 && implicants[0].pattern.split("").every(bit => bit === "-")) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }

    const terms: string[] = [];

    implicants.forEach(implicant => {
        const literals: string[] = [];
        for (let i = 0; i < implicant.pattern.length; i++) {
            const bit = implicant.pattern[i];
            if (bit === "-") continue;

            const input = addInput(graph, variables[i]);
            if (bit === "0") {
                literals.push(addNode(graph, "NOT", [input]));
            } else {
                literals.push(input);
            }
        }

        if (literals.length === 1) {
            terms.push(literals[0]);
        } else {
            terms.push(addNode(graph, "AND", literals));
        }
    });

    if (terms.length === 1) {
        graph.output = terms[0];
    } else {
        graph.output = addNode(graph, "OR", terms);
    }

    return graph;
}

function buildNANDCircuit(implicants: Implicant[], variables: string[]): CircuitGraph {
    const graph = createGraph();

    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }

    if (implicants.length === 1 && implicants[0].pattern.split("").every(bit => bit === "-")) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }

    if (implicants.length === 1) {
        const pattern = implicants[0].pattern;
        const active: { variable: string; complemented: boolean }[] = [];
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] !== "-") {
                active.push({ variable: variables[i], complemented: pattern[i] === "0" });
            }
        }

        if (active.length === 1) {
            const input = addInput(graph, active[0].variable);
            graph.output = active[0].complemented ? addNode(graph, "NAND", [input, input]) : input;
            return graph;
        }
    }

    const productComplements: string[] = [];

    implicants.forEach(implicant => {
        const literalNodes: string[] = [];
        for (let i = 0; i < implicant.pattern.length; i++) {
            const bit = implicant.pattern[i];
            if (bit === "-") continue;

            const input = addInput(graph, variables[i]);
            literalNodes.push(bit === "0" ? addNode(graph, "NAND", [input, input]) : input);
        }

        if (literalNodes.length === 1) {
            productComplements.push(addNode(graph, "NAND", [literalNodes[0], literalNodes[0]]));
        } else {
            productComplements.push(addNode(graph, "NAND", literalNodes));
        }
    });

    if (productComplements.length === 1) {
        graph.output = addNode(graph, "NAND", [productComplements[0], productComplements[0]]);
    } else {
        graph.output = addNode(graph, "NAND", productComplements);
    }

    return graph;
}

function buildNORCircuit(implicants: Implicant[], variables: string[]): CircuitGraph {
    const graph = createGraph();

    if (implicants.length === 0) {
        graph.output = addNode(graph, "CONST", [], "1");
        return graph;
    }

    if (implicants.length === 1 && implicants[0].pattern.split("").every(bit => bit === "-")) {
        graph.output = addNode(graph, "CONST", [], "0");
        return graph;
    }

    if (implicants.length === 1) {
        const pattern = implicants[0].pattern;
        const active: { variable: string; complemented: boolean }[] = [];
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] !== "-") {
                active.push({ variable: variables[i], complemented: pattern[i] === "1" });
            }
        }

        if (active.length === 1) {
            const input = addInput(graph, active[0].variable);
            graph.output = active[0].complemented ? addNode(graph, "NOR", [input, input]) : input;
            return graph;
        }
    }

    const clauseComplements: string[] = [];

    implicants.forEach(implicant => {
        const literalNodes: string[] = [];
        for (let i = 0; i < implicant.pattern.length; i++) {
            const bit = implicant.pattern[i];
            if (bit === "-") continue;

            const input = addInput(graph, variables[i]);
            literalNodes.push(bit === "1" ? addNode(graph, "NOR", [input, input]) : input);
        }

        if (literalNodes.length === 1) {
            clauseComplements.push(addNode(graph, "NOR", [literalNodes[0], literalNodes[0]]));
        } else {
            clauseComplements.push(addNode(graph, "NOR", literalNodes));
        }
    });

    if (clauseComplements.length === 1) {
        graph.output = addNode(graph, "NOR", [clauseComplements[0], clauseComplements[0]]);
    } else {
        graph.output = addNode(graph, "NOR", clauseComplements);
    }

    return graph;
}

function evaluateCircuit(graph: CircuitGraph, assignment: Record<string, boolean>): boolean {
    const nodeMap = new Map<string, CircuitNode>();
    graph.nodes.forEach(node => nodeMap.set(node.id, node));
    const cache = new Map<string, boolean>();

    function evaluateNode(id: string): boolean {
        if (cache.has(id)) return cache.get(id)!;

        const node = nodeMap.get(id);
        if (!node) throw new Error("Circuit node not found.");

        let value: boolean;
        switch (node.type) {
            case "INPUT": value = Boolean(assignment[node.label]); break;
            case "CONST": value = node.label === "1"; break;
            case "NOT": value = !evaluateNode(node.inputs[0]); break;
            case "AND": value = node.inputs.every(input => evaluateNode(input)); break;
            case "OR": value = node.inputs.some(input => evaluateNode(input)); break;
            case "NAND": value = !node.inputs.every(input => evaluateNode(input)); break;
            case "NOR": value = !node.inputs.some(input => evaluateNode(input)); break;
            default: throw new Error(`Unknown gate: ${(node as CircuitNode).type}`);
        }

        cache.set(id, value);
        return value;
    }

    return evaluateNode(graph.output!);
}

/* =========================================================
   SCHEMATIC GATE GEOMETRY & PORT MAPPER
   Accurate geometry so wires always meet gate ports cleanly.
========================================================= */

function getGateInfo(node: CircuitNode): GateInfo {
    const h = 52;
    // Dimensions chosen so outX/inX match the actual SVG path endpoints.
    if (node.type === "INPUT" || node.type === "CONST") {
        const w = 90;
        return {
            width: w,
            height: h,
            outX: (x: number) => x + w,
            outY: (x: number, y: number) => y + h / 2,
            inX: (x: number) => x,
            inY: (x: number, y: number) => y + h / 2
        };
    }
    if (node.type === "NOT") {
        // Triangle tip at x+60, bubble centre at x+67, bubble right edge at x+74
        const w = 74;
        return {
            width: w,
            height: h,
            outX: (x: number) => x + w,
            outY: (x: number, y: number) => y + h / 2,
            inX: (x: number) => x,
            inY: (x: number, y: number) => y + h / 2
        };
    }
    if (node.type === "AND") {
        // Body: rect left + semicircle of radius 26 → right edge at x+76
        const w = 76;
        return {
            width: w,
            height: h,
            outX: (x: number) => x + w,
            outY: (x: number, y: number) => y + h / 2,
            inX: (x: number) => x,
            inY: (x: number, y: number, i: number, count: number) => getMultiInputY(y, h, i, count)
        };
    }
    if (node.type === "NAND") {
        // AND body to x+76 + bubble centre 76+10=86, right edge 86+7=93
        const w = 93;
        return {
            width: w,
            height: h,
            outX: (x: number) => x + w,
            outY: (x: number, y: number) => y + h / 2,
            inX: (x: number) => x,
            inY: (x: number, y: number, i: number, count: number) => getMultiInputY(y, h, i, count)
        };
    }
    if (node.type === "OR") {
        // Path tip at x+86
        const w = 86;
        return {
            width: w,
            height: h,
            outX: (x: number) => x + w,
            outY: (x: number, y: number) => y + h / 2,
            inX: (x: number, y: number, i: number, count: number) => {
                const iy = getMultiInputY(y, h, i, count);
                const dy = (iy - (y + h / 2)) / (h / 2);
                // Match the curved left edge of the OR symbol
                const indent = 14 * (1 - dy * dy);
                return x + indent;
            },
            inY: (x: number, y: number, i: number, count: number) => getMultiInputY(y, h, i, count)
        };
    }
    if (node.type === "NOR") {
        // OR body tip at x+86 + bubble → right edge at x+100
        const w = 100;
        return {
            width: w,
            height: h,
            outX: (x: number) => x + w,
            outY: (x: number, y: number) => y + h / 2,
            inX: (x: number, y: number, i: number, count: number) => {
                const iy = getMultiInputY(y, h, i, count);
                const dy = (iy - (y + h / 2)) / (h / 2);
                const indent = 14 * (1 - dy * dy);
                return x + indent;
            },
            inY: (x: number, y: number, i: number, count: number) => getMultiInputY(y, h, i, count)
        };
    }
    return {
        width: 90,
        height: h,
        outX: (x: number) => x + 90,
        outY: (x: number, y: number) => y + h / 2,
        inX: (x: number) => x,
        inY: (x: number, y: number) => y + h / 2
    };
}

function getMultiInputY(y: number, h: number, i: number, count: number): number {
    if (count <= 1) return y + h / 2;
    // Keep ports inside the gate body with comfortable spacing
    const usable = Math.min(28, h - 16);
    const spacing = count === 1 ? 0 : usable / (count - 1);
    const startY = y + h / 2 - ((count - 1) / 2) * spacing;
    return startY + i * spacing;
}

function calculateLevels(graph: CircuitGraph): Map<string, number> {
    const levels = new Map<string, number>();

    function getLevel(id: string): number {
        if (levels.has(id)) return levels.get(id)!;

        const node = graph.nodes.find(item => item.id === id);
        if (!node || !node.inputs.length) {
            levels.set(id, 0);
            return 0;
        }

        const level = Math.max(...node.inputs.map(getLevel)) + 1;
        levels.set(id, level);
        return level;
    }

    graph.nodes.forEach(node => getLevel(node.id));
    return levels;
}

/* =========================================================
   CIRCUIT LAYOUT ENGINE
   - Inputs stacked on the left
   - Gates placed by topological level
   - Vertical positions pulled toward the average of their inputs
   - Extra vertical spacing when many gates share a level
========================================================= */

function calculateCircuitLayout(graph: CircuitGraph): CircuitLayout {
    const levels = calculateLevels(graph);
    const maxLevel = Math.max(0, ...Array.from(levels.values()));

    const levelGroups: CircuitNode[][] = [];
    for (let l = 0; l <= maxLevel; l++) levelGroups[l] = [];
    graph.nodes.forEach(node => {
        const l = levels.get(node.id)!;
        levelGroups[l].push(node);
    });

    // Sort inputs alphabetically for a stable, readable order
    if (levelGroups[0]) {
        levelGroups[0].sort((a, b) => {
            if (a.type === "INPUT" && b.type === "INPUT") {
                return String(a.label).localeCompare(String(b.label));
            }
            return 0;
        });
    }

    const LEVEL_GAP = 200;
    const ROW_GAP = 100;
    const PADDING_X = 50;
    const PADDING_Y = 50;

    const positions = new Map<string, LayoutPosition>();

    // Level 0 – primary inputs / constants
    const level0 = levelGroups[0] || [];
    level0.forEach((node, idx) => {
        positions.set(node.id, {
            x: PADDING_X,
            y: PADDING_Y + idx * ROW_GAP
        });
    });

    // Remaining levels
    for (let l = 1; l <= maxLevel; l++) {
        const group = levelGroups[l] || [];
        if (group.length === 0) continue;

        const items: { node: CircuitNode; idealCenter: number }[] = group.map(node => {
            let sumY = 0;
            let count = 0;
            node.inputs.forEach(inpId => {
                const p = positions.get(inpId);
                if (p) {
                    // Use the vertical centre of the source gate
                    const srcNode = graph.nodes.find(n => n.id === inpId)!;
                    const srcInfo = getGateInfo(srcNode);
                    sumY += p.y + srcInfo.height / 2;
                    count++;
                }
            });
            const idealCenter = count > 0 ? sumY / count : PADDING_Y + 26;
            return { node, idealCenter };
        });

        items.sort((a, b) => a.idealCenter - b.idealCenter);

        // Pack gates with a minimum vertical gap, centred around the ideal average
        const n = items.length;
        const totalSpan = (n - 1) * ROW_GAP;
        const avgIdeal = items.reduce((s, it) => s + it.idealCenter, 0) / n;
        let startCenter = avgIdeal - totalSpan / 2;

        // Keep everything on the canvas
        if (startCenter - 26 < PADDING_Y) {
            startCenter = PADDING_Y + 26;
        }

        items.forEach((item, idx) => {
            const centerY = startCenter + idx * ROW_GAP;
            positions.set(item.node.id, {
                x: PADDING_X + l * LEVEL_GAP,
                y: centerY - 26   // top of 52-px-tall gate
            });
        });
    }

    let maxX = 0;
    let maxY = 0;
    graph.nodes.forEach(node => {
        const pos = positions.get(node.id);
        if (!pos) return;
        const info = getGateInfo(node);
        if (pos.x + info.width > maxX) maxX = pos.x + info.width;
        if (pos.y + info.height > maxY) maxY = pos.y + info.height;
    });

    const width = Math.max(780, maxX + 140);
    const height = Math.max(320, maxY + PADDING_Y + 20);

    return { positions, levels, width, height, levelGap: LEVEL_GAP, paddingX: PADDING_X };
}

/* =========================================================
   SVG SCHEMATIC GATE RENDERER
   Paths match the widths returned by getGateInfo.
========================================================= */

function renderGateSVG(node: CircuitNode, pos: LayoutPosition): string {
    const x = pos.x;
    const y = pos.y;
    const centerY = y + 26;
    let svg = "";

    if (node.type === "INPUT" || node.type === "CONST") {
        svg += `
            <rect x="${x}" y="${y}" width="90" height="52" rx="8" class="circuit-node" />
            <text x="${x + 45}" y="${centerY + 6}" text-anchor="middle" class="input-label">${node.label}</text>
        `;
        return svg;
    }

    if (node.type === "NOT") {
        // Triangle to x+60, bubble centre x+67, right edge x+74
        svg += `
            <polygon points="${x},${y} ${x + 60},${centerY} ${x},${y + 52}" class="circuit-node" />
            <circle cx="${x + 67}" cy="${centerY}" r="7" class="circuit-node" />
            <text x="${x + 20}" y="${centerY + 5}" class="gate-label">NOT</text>
        `;
        return svg;
    }

    if (node.type === "AND") {
        // Left vertical + semicircle radius 26 → right edge at x+76
        svg += `
            <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" class="circuit-node" />
            <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" class="gate-label">AND</text>
        `;
    } else if (node.type === "NAND") {
        // Same body, bubble centre at x+76+10 = x+86, right edge x+93
        svg += `
            <path d="M ${x} ${y} h 50 a 26 26 0 0 1 0 52 h -50 z" class="circuit-node" />
            <circle cx="${x + 86}" cy="${centerY}" r="7" class="circuit-node" />
            <text x="${x + 34}" y="${centerY + 5}" text-anchor="middle" class="gate-label">NAND</text>
        `;
    } else if (node.type === "OR") {
        // Classic curved OR, tip at x+86
        svg += `
            <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" class="circuit-node" />
            <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" class="gate-label">OR</text>
        `;
    } else if (node.type === "NOR") {
        // OR body + bubble, right edge at x+100
        svg += `
            <path d="M ${x} ${y} Q ${x + 18} ${centerY} ${x} ${y + 52} Q ${x + 48} ${y + 52} ${x + 86} ${centerY} Q ${x + 48} ${y} ${x} ${y} Z" class="circuit-node" />
            <circle cx="${x + 93}" cy="${centerY}" r="7" class="circuit-node" />
            <text x="${x + 40}" y="${centerY + 5}" text-anchor="middle" class="gate-label">NOR</text>
        `;
    }

    return svg;
}

/* =========================================================
   ORTHOGONAL WIRE ROUTING ENGINE
   - Every connection is routed with pure H/V segments
   - Distinct vertical channels per source inside each level-gap
   - Fan-out uses a shared trunk + junction dots
   - Self-loops (NAND/NOR used as NOT) are drawn cleanly
========================================================= */

function renderEdgesSVG(graph: CircuitGraph, layout: CircuitLayout): string {
    let svg = "";
    const { positions, levels, levelGap, paddingX } = layout;

    // Collect every directed edge with exact port coordinates
    const edges: Edge[] = [];
    graph.nodes.forEach(targetNode => {
        // Deduplicate identical source ports for self-loops (e.g. NAND(A,A))
        const seen = new Map<string, number[]>(); // sourceId -> list of input indices that share it
        targetNode.inputs.forEach((sourceId, inputIndex) => {
            if (!seen.has(sourceId)) seen.set(sourceId, []);
            seen.get(sourceId)!.push(inputIndex);
        });

        seen.forEach((indices, sourceId) => {
            const sourceNode = graph.nodes.find(n => n.id === sourceId);
            const sourcePos = positions.get(sourceId);
            const targetPos = positions.get(targetNode.id);
            if (!sourceNode || !sourcePos || !targetPos) return;

            const sourceInfo = getGateInfo(sourceNode);
            const targetInfo = getGateInfo(targetNode);

            const x1 = sourceInfo.outX(sourcePos.x);
            const y1 = sourceInfo.outY(sourcePos.x, sourcePos.y);

            // For multi-pin fan-in from the *same* source we still draw one wire
            // to the average of the target ports (visually cleaner for NOT-as-NAND)
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
                sourceLevel: levels.get(sourceId)!,
                targetLevel: levels.get(targetNode.id)!
            });
        });
    });

    // Group edges that cross the same horizontal span between two levels
    // (including multi-level jumps – they share the same source→target level key)
    const gapGroups = new Map<string, Edge[]>();
    edges.forEach(edge => {
        const key = `${edge.sourceLevel}->${edge.targetLevel}`;
        if (!gapGroups.has(key)) gapGroups.set(key, []);
        gapGroups.get(key)!.push(edge);
    });

    gapGroups.forEach((groupEdges) => {
        // Sub-group by source so fan-out can share a trunk
        const sourceMap = new Map<string, Edge[]>();
        groupEdges.forEach(edge => {
            if (!sourceMap.has(edge.sourceId)) sourceMap.set(edge.sourceId, []);
            sourceMap.get(edge.sourceId)!.push(edge);
        });

        const sources: SourceGroup[] = Array.from(sourceMap.entries()).map(([id, sEdges]) => ({
            id,
            edges: sEdges,
            x1: sEdges[0].x1,
            y1: sEdges[0].y1,
            minTargetX: Math.min(...sEdges.map(e => e.x2))
        }));

        // Order sources top-to-bottom so channel lanes stay ordered
        sources.sort((a, b) => a.y1 - b.y1);

        const maxSourceX = Math.max(...sources.map(s => s.x1));
        const minTargetX = Math.min(...sources.map(s => s.minTargetX));

        // Available horizontal room for vertical bus channels.
        // Guarantee a usable channel even if geometry is tight.
        let gapStart = maxSourceX + 14;
        let gapEnd = minTargetX - 14;
        if (gapEnd - gapStart < 30) {
            // Expand channel into the middle of the available span
            const mid = (maxSourceX + minTargetX) / 2;
            gapStart = mid - 20;
            gapEnd = mid + 20;
        }
        const available = Math.max(30, gapEnd - gapStart);

        // One dedicated vertical lane per distinct source (min 12px apart)
        const laneCount = sources.length;
        const minLane = 12;
        const needed = (laneCount + 1) * minLane;
        const laneStep = Math.max(minLane, available / (laneCount + 1));
        // If we need more room than available, still spread evenly across available
        const effectiveStep = available / (laneCount + 1);

        sources.forEach((source, idx) => {
            const busX = gapStart + (idx + 1) * effectiveStep;
            const { x1, y1, edges: sEdges } = source;

            if (sEdges.length === 1) {
                const { x2, y2 } = sEdges[0];
                if (Math.abs(y1 - y2) < 1.5) {
                    // Perfect horizontal alignment – single segment
                    svg += `<path d="M ${x1} ${y1} H ${x2}" class="circuit-wire" />`;
                } else {
                    // Classic three-segment orthogonal route
                    svg += `<path d="M ${x1} ${y1} H ${busX} V ${y2} H ${x2}" class="circuit-wire" />`;
                }
            } else {
                // Fan-out: horizontal stub → vertical trunk → horizontal stubs to each target
                const allY = [y1, ...sEdges.map(e => e.y2)];
                const minY = Math.min(...allY);
                const maxY = Math.max(...allY);

                svg += `<path d="M ${x1} ${y1} H ${busX}" class="circuit-wire" />`;
                svg += `<path d="M ${busX} ${minY} V ${maxY}" class="circuit-wire" />`;
                svg += `<circle cx="${busX}" cy="${y1}" r="3.5" class="circuit-junction" />`;

                sEdges.forEach(edge => {
                    svg += `<path d="M ${busX} ${edge.y2} H ${edge.x2}" class="circuit-wire" />`;
                    if (Math.abs(edge.y2 - y1) > 1) {
                        svg += `<circle cx="${busX}" cy="${edge.y2}" r="3.5" class="circuit-junction" />`;
                    }
                });
            }
        });
    });

    return svg;
}

/* =========================================================
   RENDER CIRCUIT DIAGRAM
========================================================= */

function renderCircuit(graph: CircuitGraph, container: HTMLElement, title: string): void {
    container.innerHTML = "";
    if (!graph || !graph.output) return;

    const layout = calculateCircuitLayout(graph);

    let svg = `
        <svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg"
             width="${layout.width}" height="${layout.height}"
             viewBox="0 0 ${layout.width} ${layout.height}">
    `;

    // Draw wires behind gates
    svg += renderEdgesSVG(graph, layout);

    // Draw logic gates
    graph.nodes.forEach(node => {
        svg += renderGateSVG(node, layout.positions.get(node.id)!);
    });

    // Final Output line and label 'F'
    const outputNode = graph.nodes.find(node => node.id === graph.output)!;
    const outputPos = layout.positions.get(graph.output)!;
    const outputInfo = getGateInfo(outputNode);

    const outX = outputInfo.outX(outputPos.x);
    const outY = outputInfo.outY(outputPos.x, outputPos.y);

    svg += `
        <path d="M ${outX} ${outY} H ${outX + 60}" class="circuit-wire" />
        <text x="${outX + 75}" y="${outY + 6}" class="output-label">F</text>
    `;

    svg += "</svg>";

    const wrapper = document.createElement("div");
    wrapper.className = "circuit-wrapper";
    wrapper.innerHTML = `
        <div class="circuit-title">${title}</div>
        ${svg}
        <div class="circuit-toolbar">
            <button type="button" class="download-circuit">⬇ Download PNG</button>
        </div>
    `;

    container.appendChild(wrapper);

    const button = wrapper.querySelector(".download-circuit") as HTMLButtonElement;
    const svgElement = wrapper.querySelector("svg") as SVGSVGElement;
    button.addEventListener("click", () => downloadCircuitPNG(svgElement, title));
}

/* =========================================================
   DOWNLOAD PNG
========================================================= */

function downloadCircuitPNG(svg: SVGSVGElement, title: string): void {
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svg);

    if (!source.includes('xmlns="http://www.w3.org/2000/svg"')) {
        source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const width = Number(svg.getAttribute("width"));
    const height = Number(svg.getAttribute("height"));

    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = width * scale;
        canvas.height = height * scale;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        URL.revokeObjectURL(url);

        canvas.toBlob(result => {
            if (!result) return;
            const downloadUrl = URL.createObjectURL(result);
            const link = document.createElement("a");
            link.href = downloadUrl;
            link.download = title.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".png";
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(downloadUrl);
        }, "image/png");
    };

    image.onerror = () => {
        URL.revokeObjectURL(url);
        alert("Unable to download the circuit image.");
    };

    image.src = url;
}

/* =========================================================
   TRUTH TABLE HTML & UTILITIES
========================================================= */

function createTruthTableHTML(variables: string[], rows: TruthRow[], dontCareIndices?: Set<number>): string {
    let html = '<div class="table-container"><table><thead><tr>';
    variables.forEach(v => { html += `<th>${v}</th>`; });
    html += '<th>F</th></tr></thead><tbody>';

    rows.forEach((row, index) => {
        html += '<tr>';
        row.inputs.forEach(val => { html += `<td>${val}</td>`; });
        if (dontCareIndices && dontCareIndices.has(index)) {
            html += `<td class="dont-care-cell">X</td></tr>`;
        } else {
            html += `<td>${row.output}</td></tr>`;
        }
    });

    html += '</tbody></table></div>';
    return html;
}

function generateTruthTableInput(): void {
    const count = Number(truthVariables.value);
    const variables = generateVariableNames(count);
    const combinations = generateCombinations(count);

    let html = '<div class="table-container"><table><thead><tr>';
    variables.forEach(v => { html += `<th>${v}</th>`; });
    html += '<th>F</th></tr></thead><tbody>';

    combinations.forEach((row, index) => {
        html += '<tr>';
        row.forEach(val => { html += `<td>${val}</td>`; });
        html += `
            <td>
                <select class="truth-input" data-row="${index}">
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="-1">X</option>
                </select>
            </td>
        `;
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    (document.getElementById("userTruthTable") as HTMLElement).innerHTML = html;
}

function parseNumberList(value: string): number[] {
    const numbers = value.match(/\d+/g);
    if (!numbers) throw new Error("Please enter valid numbers.");
    return numbers.map(Number);
}

function getExpressionFromTruthTable(): { variables: string[]; rows: TruthRow[]; expression: string; dontCares: Set<number> } {
    const count = Number(truthVariables.value);
    const variables = generateVariableNames(count);
    const combinations = generateCombinations(count);

    const selects = document.querySelectorAll<HTMLSelectElement>(".truth-input");
    const outputs = [...selects].map(select => Number(select.value));

    const dontCares = new Set<number>();
    const rows = combinations.map((inputs, index) => {
        if (outputs[index] === -1) {
            dontCares.add(index);
        }
        return { inputs, output: outputs[index] };
    });

    const minterms: number[] = [];
    rows.forEach((row, index) => { if (row.output === 1) minterms.push(index); });

    return {
        variables,
        rows,
        expression: mintermsToExpression(minterms, count),
        dontCares
    };
}

/* =========================================================
   KARNAUGH MAP
========================================================= */

function grayCode(n: number): number[] {
    if (n === 0) return [0];
    const result: number[] = [];
    for (let i = 0; i < (1 << n); i++) {
        result.push(i ^ (i >> 1));
    }
    return result;
}

function patternToMinterms(pattern: string, variableCount: number): number[] {
    const dashes: number[] = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "-") dashes.push(i);
    }
    const result: number[] = [];
    const count = 1 << dashes.length;
    for (let mask = 0; mask < count; mask++) {
        let minterm = 0;
        let valid = true;
        for (let i = 0; i < pattern.length; i++) {
            if (pattern[i] === "1") {
                minterm |= 1 << (variableCount - 1 - i);
            } else if (pattern[i] === "0") {
                // bit already 0
            } else {
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

function generateKarnaughMap(
    variables: string[],
    rows: TruthRow[],
    dontCares?: Set<number>,
    implicants?: Implicant[]
): string {
    const variableCount = variables.length;
    if (variableCount < 2 || variableCount > 4) {
        return `<div class="karnaugh-map-note">Karnaugh maps are displayed for 2-4 variables.</div>`;
    }

    let colBits: number;
    let rowBits: number;
    if (variableCount === 2) {
        rowBits = 1; colBits = 1;
    } else if (variableCount === 3) {
        rowBits = 1; colBits = 2;
    } else {
        rowBits = 2; colBits = 2;
    }

    const colGray = grayCode(colBits);
    const rowGray = grayCode(rowBits);

    // Build value grid: grid[rowIdx][colIdx] = minterm index
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

    // Row & column labels
    const rowLabels = rowGray.map(v => v.toString(2).padStart(rowBits, "0"));
    const colLabels = colGray.map(v => v.toString(2).padStart(colBits, "0"));

    const rowVarStr = variables.slice(0, rowBits).join("");
    const colVarStr = variables.slice(rowBits).join("");

    // Group colors & legend
    const groupColors = ["km-group-1", "km-group-2", "km-group-3", "km-group-4", "km-group-5"];
    const legendHTML = (implicants && implicants.length > 0)
        ? `<div class="karnaugh-map-legend">
${implicants.map((imp, i) => {
            const color = groupColors[i % groupColors.length];
            const borderColors = ["#ef4444", "#2563eb", "#16a34a", "#ea580c", "#9333ea"];
            const borderColor = borderColors[i % borderColors.length];
            return `            <span class="legend-item">
                <span class="legend-swatch" style="border-color:${borderColor};background:${borderColor}15"></span>
                ${patternToSOPTerm(imp.pattern, variables)}
            </span>`;
        }).join("\n")}
        </div>`
        : "";

    let html = `<div class="karnaugh-map-wrapper">`;
    html += `<div id="karnaughMapGrid" style="position:relative;display:inline-block;">`;
    html += `<table class="karnaugh-map">`;

    // Header row: corner cell + column headers
    html += `<thead><tr>`;
    html += `<th class="km-corner" style="font-size:14px;">${rowVarStr}\\${colVarStr}</th>`;
    for (const label of colLabels) {
        html += `<th class="km-col-label">${label}</th>`;
    }
    html += `</tr></thead>`;

    // Body rows
    html += `<tbody>`;
    for (let ri = 0; ri < rowGray.length; ri++) {
        html += `<tr>`;
        html += `<th class="km-row-label">${rowLabels[ri]}</th>`;
        for (let ci = 0; ci < colGray.length; ci++) {
            const minterm = grid[ri][ci];
            const output = rows[minterm]?.output;
            let cellClass = "km-zero";
            let cellValue = "0";
            if (output === 1) {
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
    html += `</tbody></table>`;

    // Group overlay placeholders
    if (implicants && implicants.length > 0) {
        for (let i = 0; i < implicants.length; i++) {
            html += `<div class="km-group-overlay ${groupColors[i % groupColors.length]}" id="kmOverlay${i}" style="display:none;"></div>`;
        }
    }

    html += `</div>`; // end karnaughMapGrid

    if (legendHTML) html += legendHTML;
    if (variableCount >= 3) {
        html += `<div class="karnaugh-map-note">Read the binary labels on rows (\(${rowVarStr}\)) and columns (\(${colVarStr}\)). Adjacent cells differ by one bit, enabling visual grouping.</div>`;
    }
    html += `</div>`; // end wrapper

    return html;
}

function positionKarnaughOverlays(implicants: Implicant[], variableCount: number): void {
    const grid = document.getElementById("karnaughMapGrid");
    if (!grid) return;

    const table = grid.querySelector(".karnaugh-map") as HTMLTableElement;
    if (!table) return;

    let colBits: number;
    let rowBits: number;
    if (variableCount === 2) {
        rowBits = 1; colBits = 1;
    } else if (variableCount === 3) {
        rowBits = 1; colBits = 2;
    } else {
        rowBits = 2; colBits = 2;
    }

    const groupColors = ["km-group-1", "km-group-2", "km-group-3", "km-group-4", "km-group-5"];

    implicants.forEach((imp, i) => {
        const overlay = document.getElementById(`kmOverlay${i}`);
        if (!overlay) return;

        const minterms = patternToMinterms(imp.pattern, variableCount);

        // Find bounding row/col indices
        let minRow = Infinity, maxRow = -Infinity, minCol = Infinity, maxCol = -Infinity;
        const cellData = table.querySelectorAll("td[data-row]");
        cellData.forEach(cell => {
            const row = parseInt(cell.getAttribute("data-row") || "-1");
            const col = parseInt(cell.getAttribute("data-col") || "-1");
            const mintermText = cell.querySelector(".km-minterm")?.textContent || "";
            const m = parseInt(mintermText.replace("m", ""));
            if (!isNaN(m) && minterms.includes(m)) {
                if (row < minRow) minRow = row;
                if (row > maxRow) maxRow = row;
                if (col < minCol) minCol = col;
                if (col > maxCol) maxCol = col;
            }
        });

        if (minRow === Infinity) return;

        // Data cells start at row offset 1 (after row-label header)
        const firstCell = table.querySelector(`td[data-row="${minRow}"][data-col="${minCol}"]`);
        const lastCell = table.querySelector(`td[data-row="${maxRow}"][data-col="${maxCol}"]`);
        if (!firstCell || !lastCell) return;

        const gridRect = grid.getBoundingClientRect();
        const firstRect = firstCell.getBoundingClientRect();
        const lastRect = lastCell.getBoundingClientRect();

        const padding = 4;
        const left = firstRect.left - gridRect.left - padding;
        const top = firstRect.top - gridRect.top - padding;
        const width = lastRect.right - firstRect.left + 2 * padding;
        const height = lastRect.bottom - firstRect.top + 2 * padding;

        overlay.style.display = "block";
        overlay.style.left = left + "px";
        overlay.style.top = top + "px";
        overlay.style.width = width + "px";
        overlay.style.height = height + "px";
    });
}

/* =========================================================
   CIRCUIT VERIFICATION & DISPLAY
========================================================= */

function verifyAllCircuits(
    originalExpression: string,
    simplifiedExpression: string,
    variables: string[],
    rows: TruthRow[],
    basicGraph: CircuitGraph,
    nandGraph: CircuitGraph,
    norGraph: CircuitGraph
): boolean {
    const original = evaluateExpression(originalExpression, variables);
    const simplified = evaluateExpression(simplifiedExpression, variables);

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const assignment: Record<string, boolean> = {};
        variables.forEach((variable, variableIndex) => {
            assignment[variable] = Boolean(row.inputs[variableIndex]);
        });

        // Don't care rows (output === -1) can produce any output
        if (row.output === -1) continue;

        const expected = Boolean(row.output);
        const originalOutput = Boolean(original.rows[i].output);
        const simplifiedOutput = Boolean(simplified.rows[i].output);
        const basicOutput = Boolean(evaluateCircuit(basicGraph, assignment));
        const nandOutput = Boolean(evaluateCircuit(nandGraph, assignment));
        const norOutput = Boolean(evaluateCircuit(norGraph, assignment));

        if (
            originalOutput !== expected ||
            simplifiedOutput !== expected ||
            basicOutput !== expected ||
            nandOutput !== expected ||
            norOutput !== expected
        ) {
            return false;
        }
    }
    return true;
}

function renderVerification(passed: boolean, variableCount: number): string {
    if (passed) {
        return `
            <div class="verification-success">
                <strong>✅ All Implementations Verified Successfully</strong>
                <br><br>
                The original function, simplified expression, AND / OR / NOT circuit, NAND-only circuit and NOR-only circuit produce identical outputs for all <strong>${2 ** variableCount}</strong> possible input combinations.
            </div>
        `;
    }
    return `
        <div class="verification-failure">
            <strong>❌ Verification Failed</strong>
            <br><br>
            One or more circuit implementations does not match the original Boolean function.
        </div>
    `;
}

let errorTimeout: ReturnType<typeof setTimeout> | null = null;

function showError(message: string): void {
    if (errorTimeout) clearTimeout(errorTimeout);
    errorMessage.textContent = message;
    errorMessage.classList.remove("hidden");
    errorTimeout = setTimeout(() => {
        errorMessage.classList.add("hidden");
    }, 5000);
}

function clearError(): void {
    errorMessage.textContent = "";
    errorMessage.classList.add("hidden");
}

/* =========================================================
   MAIN SOLVER EXECUTION
========================================================= */

solveButton.addEventListener("click", solve);

function solve(): void {
    clearError();
    circuitCounter = 0;

    try {
        let expression: string;
        let variables: string[];
        let rows: TruthRow[];
        let dontCares: Set<number> = new Set();
        let hasDontCares = false;

        if (inputType.value === "expression") {
            expression = expressionInput.value.trim();
            if (!expression) throw new Error("Please enter a Boolean expression.");
            variables = getVariables(expression);
            if (variables.length === 0) throw new Error("No Boolean variables were found.");
            rows = evaluateExpression(expression, variables).rows;
        } else if (inputType.value === "minterms") {
            const count = Number(mintermVariables.value);
            const minterms = parseNumberList(mintermsInput.value);
            expression = mintermsToExpression(minterms, count);
            variables = generateVariableNames(count);
            rows = evaluateExpression(expression, variables).rows;
        } else if (inputType.value === "maxterms") {
            const count = Number(maxtermVariables.value);
            const maxterms = parseNumberList(maxtermsInput.value);
            expression = maxtermsToExpression(maxterms, count);
            variables = generateVariableNames(count);
            rows = evaluateExpression(expression, variables).rows;
        } else if (inputType.value === "dontCare") {
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

            // Validate no overlap between minterms and don't cares
            const overlap = mintermList.filter(m => dontCareList.includes(m));
            if (overlap.length > 0) {
                throw new Error(`Terms ${overlap.join(", ")} appear in both minterms and don't cares.`);
            }

            dontCares = new Set(dontCareList);
            hasDontCares = dontCares.size > 0;

            expression = mintermsToExpression(mintermList, count, dontCares);

            // Build truth table rows: minterms = 1, don't cares = -1, rest = 0
            const combinations = generateCombinations(count);
            rows = combinations.map((inputs, index) => {
                let output: number;
                if (mintermList.includes(index)) {
                    output = 1;
                } else if (dontCares.has(index)) {
                    output = -1;
                } else {
                    output = 0;
                }
                return { inputs, output };
            });
        } else {
            const result = getExpressionFromTruthTable();
            expression = result.expression;
            variables = result.variables;
            rows = result.rows;
            dontCares = result.dontCares;
            hasDontCares = dontCares.size > 0;
        }

        // For truth table input, detect don't cares from rows
        if (inputType.value === "truthTable") {
            hasDontCares = dontCares.size > 0;
        }

        (document.getElementById("originalExpression") as HTMLElement).textContent = expression;
        (document.getElementById("generatedTruthTable") as HTMLElement).innerHTML = createTruthTableHTML(variables, rows, hasDontCares ? dontCares : undefined);
        (document.getElementById("canonicalSOP") as HTMLElement).textContent = generateCanonicalSOP(rows, variables, hasDontCares ? dontCares : undefined);
        (document.getElementById("canonicalPOS") as HTMLElement).textContent = generateCanonicalPOS(rows, variables, hasDontCares ? dontCares : undefined);

        const ones: number[] = [];
        const zeros: number[] = [];
        rows.forEach((row, index) => {
            if (row.output === 1) ones.push(index);
            else if (row.output === 0) zeros.push(index);
            // Don't cares (output === -1) are excluded from both
        });

        const simplifiedSOP = minimizeSOP(ones, variables, hasDontCares ? dontCares : undefined);
        const simplifiedPOS = minimizePOS(zeros, variables, hasDontCares ? dontCares : undefined);

        (document.getElementById("simplifiedExpression") as HTMLElement).textContent = simplifiedSOP.expression;

        // Render Karnaugh Map
        (document.getElementById("karnaughMap") as HTMLElement).innerHTML = generateKarnaughMap(
            variables,
            rows,
            hasDontCares ? dontCares : undefined,
            simplifiedSOP.implicants
        );

        // Position K-map group overlays after DOM update
        requestAnimationFrame(() => {
            positionKarnaughOverlays(simplifiedSOP.implicants, variables.length);
        });

        // Show don't care summary when applicable
        if (hasDontCares) {
            const dontCareResults = document.getElementById("dontCareResults");
            const dontCareSummary = document.getElementById("dontCareSummary");
            if (dontCareResults && dontCareSummary) {
                dontCareResults.classList.remove("hidden");
                const mintermIndices = ones.sort((a, b) => a - b).join(", ") || "none";
                const dcIndices = [...dontCares].sort((a, b) => a - b).join(", ") || "none";
                const totalTerms = ones.length + dontCares.size;
                dontCareSummary.innerHTML = `
                    <div class="dont-care-summary-grid">
                        <div class="dont-care-summary-item">
                            <span class="dont-care-label">Minterms (F = 1)</span>
                            <span class="dont-care-value">{${mintermIndices}}</span>
                        </div>
                        <div class="dont-care-summary-item">
                            <span class="dont-care-label">Don't Cares (F = X)</span>
                            <span class="dont-care-value dont-care-highlight">{${dcIndices}}</span>
                        </div>
                        <div class="dont-care-summary-item">
                            <span class="dont-care-label">Total Terms Used in Minimization</span>
                            <span class="dont-care-value">${totalTerms} (minterms: ${ones.length}, don't cares: ${dontCares.size})</span>
                        </div>
                    </div>
                `;
            }
        }

        const basicGraph = buildBasicSOPCircuit(simplifiedSOP.implicants, variables);
        const nandGraph = buildNANDCircuit(simplifiedSOP.implicants, variables);
        const norGraph = buildNORCircuit(simplifiedPOS.implicants, variables);

        renderCircuit(basicGraph, document.getElementById("basicCircuit") as HTMLElement, "AND / OR / NOT Circuit");
        renderCircuit(nandGraph, document.getElementById("nandCircuit") as HTMLElement, "NAND-Only Circuit");
        renderCircuit(norGraph, document.getElementById("norCircuit") as HTMLElement, "NOR-Only Circuit");

        const verified = verifyAllCircuits(
            expression,
            simplifiedSOP.expression,
            variables,
            rows,
            basicGraph,
            nandGraph,
            norGraph
        );

        (document.getElementById("verification") as HTMLElement).innerHTML = renderVerification(verified, variables.length);

        results.classList.remove("hidden");
        results.scrollIntoView({ behavior: "smooth" });
        saveToHistory(expression);

    } catch (error) {
        console.error(error);
        if (error instanceof Error) showError(error.message);
        else showError(String(error));
    }
}

/* =========================================================
   EXPRESSION HISTORY (localStorage)
========================================================= */

const HISTORY_KEY = "boolSolver_history";
const HISTORY_MAX = 5;

function getHistory(): string[] {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveToHistory(expression: string): void {
    if (!expression.trim()) return;
    const history = getHistory().filter(e => e !== expression);
    history.unshift(expression);
    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX;
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch { /* quota exceeded, ignore */ }
}

function renderHistoryDropdown(): void {
    const history = getHistory();
    let dropdown = document.getElementById("historyDropdown") as HTMLDivElement | null;
    if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.id = "historyDropdown";
        dropdown.className = "history-dropdown hidden";
        const inputRow = expressionInput.closest(".form-group");
        if (inputRow) inputRow.appendChild(dropdown);
    }
    if (history.length === 0) {
        dropdown.classList.add("hidden");
        return;
    }
    dropdown.innerHTML = history.map(expr =>
        `<div class="history-item" data-expr="${expr.replace(/"/g, '&quot;')}">${expr}</div>`
    ).join("");
    dropdown.classList.remove("hidden");

    dropdown.querySelectorAll(".history-item").forEach(item => {
        item.addEventListener("click", () => {
            const expr = item.getAttribute("data-expr") || "";
            (expressionInput as HTMLInputElement).value = expr;
            dropdown.classList.add("hidden");
            expressionInput.focus();
        });
    });
}

expressionInput.addEventListener("focus", renderHistoryDropdown);
document.addEventListener("click", (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.closest("#historyDropdown") && target !== expressionInput) {
        const dropdown = document.getElementById("historyDropdown");
        if (dropdown) dropdown.classList.add("hidden");
    }
});

/* =========================================================
   TRY EXAMPLE PRESET
========================================================= */

interface ExamplePreset {
    expression: string;
    description: string;
}

const examplePresets: ExamplePreset[] = [
    { expression: "A'B + BC", description: "3-variable SOP" },
    { expression: "AB + A'C", description: "3-variable example" },
    { expression: "(A+B)(A'+C)", description: "3-variable POS" },
    { expression: "ABC + A'B'C'", description: "Minterms 0 and 7" },
    { expression: "AB + AC + BC", description: "Majority function" },
    { expression: "A^B", description: "XOR example" },
    { expression: "A'B'C + A'BC' + AB'C' + ABC", description: "XOR-like pattern" }
];

let exampleIndex = 0;
const tryExampleBtn = document.getElementById("tryExampleBtn") as HTMLButtonElement | null;
if (tryExampleBtn) {
    tryExampleBtn.addEventListener("click", () => {
        (inputType as HTMLSelectElement).value = "expression";
        updateInputInterface();
        clearResults();
        const preset = examplePresets[exampleIndex % examplePresets.length];
        (expressionInput as HTMLInputElement).value = preset.expression;
        (expressionInput as HTMLInputElement).focus();
        tryExampleBtn.textContent = preset.description;
        exampleIndex++;
    });
}

/* =========================================================
   COPY TO CLIPBOARD
========================================================= */

document.querySelectorAll(".copy-btn").forEach(button => {
    button.addEventListener("click", () => {
        const expressionRow = button.closest(".expression-row");
        if (!expressionRow) return;
        const box = expressionRow.querySelector(".expression-box");
        if (!box) return;
        const text = box.textContent?.trim();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            (button as HTMLButtonElement).textContent = "✅ Copied!";
            button.classList.add("copied");
            setTimeout(() => {
                (button as HTMLButtonElement).textContent = "📋 Copy";
                button.classList.remove("copied");
            }, 1500);
        }).catch(() => {
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            (button as HTMLButtonElement).textContent = "✅ Copied!";
            button.classList.add("copied");
            setTimeout(() => {
                (button as HTMLButtonElement).textContent = "📋 Copy";
                button.classList.remove("copied");
            }, 1500);
        });
    });
});

/* =========================================================
   INITIALIZATION
========================================================= */

updateNumericExamples();
generateTruthTableInput();
