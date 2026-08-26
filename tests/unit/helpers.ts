/**
 * Test helpers: deterministic PRNG, random function generation, and tiny
 * independent evaluators for the exported Verilog/C syntax subsets so that
 * generated code can be checked for semantic equivalence without a compiler.
 */
import { parseExpression } from "../../shared/ts/boolean/parser";
import { AstNode, evalAst } from "../../shared/ts/boolean/ast";

/** Deterministic PRNG (mulberry32) so property tests are reproducible. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Build an AST for a random function over n variables by choosing each of
 *  the 2^n minterms independently with probability p. */
export function randomMinterms(rand: () => number, n: number, p = 0.5): number[] {
    const out: number[] = [];
    for (let m = 0; m < (1 << n); m++) {
        if (rand() < p) out.push(m);
    }
    return out;
}

/** Parse a display string and return its AST. */
export function parse(source: string): AstNode {
    return parseExpression(source).ast;
}

/** Evaluate an AST over row index i of the given ordered variables. */
export function evalAstAtIndex(ast: AstNode, variables: string[], index: number): boolean {
    const assignment: Record<string, boolean> = {};
    variables.forEach((v, idx) => {
        assignment[v] = ((index >> (variables.length - 1 - idx)) & 1) === 1;
    });
    return evalAst(ast, assignment);
}

/* ------------------------------------------------------------------ */
/* Independent mini-evaluators for exported code subsets              */
/* ------------------------------------------------------------------ */

type VToken =
    | { t: "ident"; v: string }
    | { t: "const"; v: boolean }
    | { t: "op"; v: "~" | "&" | "|" | "^" | "(" | ")" };

function tokenizeVerilogExpr(src: string): VToken[] {
    const tokens: VToken[] = [];
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (/\s/.test(ch)) { i++; continue; }
        if ("()~&|^".includes(ch)) { tokens.push({ t: "op", v: ch as any }); i++; continue; }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i + 1;
            while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
            tokens.push({ t: "ident", v: src.slice(i, j) });
            i = j;
            continue;
        }
        if (src.startsWith("1'b1", i)) { tokens.push({ t: "const", v: true }); i += 4; continue; }
        if (src.startsWith("1'b0", i)) { tokens.push({ t: "const", v: false }); i += 4; continue; }
        throw new Error(`Illegal token in generated Verilog near: "${src.slice(i, i + 12)}"`);
    }
    return tokens;
}

/**
 * Recursive-descent evaluator for the fully parenthesized Verilog subset the
 * exporter emits. Deliberately written independently of the generator so the
 * test is a genuine cross-check.
 */
export function evaluateVerilogExpr(src: string, env: Record<string, boolean>): boolean {
    const toks = tokenizeVerilogExpr(src);
    let pos = 0;

    function peek(): VToken | undefined { return toks[pos]; }

    function expectOp(v: string): void {
        const tk = toks[pos];
        if (!tk || tk.t !== "op" || tk.v !== v) {
            throw new Error(`Expected '${v}' at token ${pos} in "${src}"`);
        }
        pos++;
    }

    // The exporter emits fully parenthesized binary operations, so a primary
    // is: identifier | constant | "(" group ")" | "~" primary.
    function parsePrimary(): boolean {
        const tk = peek();
        if (!tk) throw new Error(`Unexpected end in "${src}"`);
        if (tk.t === "ident") { pos++; return env[tk.v] ?? false; }
        if (tk.t === "const") { pos++; return tk.v; }
        if (tk.t === "op" && tk.v === "~") { pos++; return !parsePrimary(); }
        if (tk.t === "op" && tk.v === "(") {
            pos++;
            const inner = parseGroup();
            expectOp(")");
            return inner;
        }
        throw new Error(`Unexpected token ${JSON.stringify(tk)} in "${src}"`);
    }

    // Inside parentheses: either "(~primary)" or "primary op primary".
    function parseGroup(): boolean {
        let left: boolean;
        const first = peek();
        if (first && first.t === "op" && first.v === "~") {
            pos++;
            left = !parsePrimary();
        } else {
            left = parsePrimary();
        }
        const opTok = peek();
        if (!opTok || opTok.t !== "op" || !["&", "|", "^"].includes(opTok.v)) {
            return left;
        }
        pos++;
        const right = parsePrimary();
        switch (opTok.v) {
            case "&": return left && right;
            case "|": return left || right;
            default: return left !== right;
        }
    }

    const value = parsePrimary();
    if (pos !== toks.length) throw new Error(`Trailing tokens in generated Verilog "${src}"`);
    return value;
}

type CToken =
    | { t: "ident"; v: string }
    | { t: "const"; v: boolean }
    | { t: "op"; v: "!" | "&&" | "||" | "!=" | "(" | ")" };

function tokenizeCExpr(src: string): CToken[] {
    const tokens: CToken[] = [];
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === "(" || ch === ")") { tokens.push({ t: "op", v: ch as any }); i++; continue; }
        if (src.startsWith("&&", i)) { tokens.push({ t: "op", v: "&&" }); i += 2; continue; }
        if (src.startsWith("||", i)) { tokens.push({ t: "op", v: "||" }); i += 2; continue; }
        if (src.startsWith("!=", i)) { tokens.push({ t: "op", v: "!=" }); i += 2; continue; }
        if (ch === "!") { tokens.push({ t: "op", v: "!" }); i++; continue; }
        if (/[A-Za-z_]/.test(ch)) {
            let j = i + 1;
            while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
            const word = src.slice(i, j);
            if (word === "true") tokens.push({ t: "const", v: true });
            else if (word === "false") tokens.push({ t: "const", v: false });
            else tokens.push({ t: "ident", v: word });
            i = j;
            continue;
        }
        throw new Error(`Illegal token in generated C near: "${src.slice(i, i + 12)}"`);
    }
    return tokens;
}

export function evaluateCExpr(src: string, env: Record<string, boolean>): boolean {
    const toks = tokenizeCExpr(src);
    let pos = 0;

    function peek(): CToken | undefined { return toks[pos]; }

    function expectOp(v: string): void {
        const tk = toks[pos];
        if (!tk || tk.t !== "op" || tk.v !== v) {
            throw new Error(`Expected '${v}' at token ${pos} in "${src}"`);
        }
        pos++;
    }

    function parsePrimary(): boolean {
        const tk = peek();
        if (!tk) throw new Error(`Unexpected end in "${src}"`);
        if (tk.t === "ident") { pos++; return env[tk.v] ?? false; }
        if (tk.t === "const") { pos++; return tk.v; }
        if (tk.t === "op" && tk.v === "!") { pos++; return !parsePrimary(); }
        if (tk.t === "op" && tk.v === "(") {
            pos++;
            const inner = parseGroup();
            expectOp(")");
            return inner;
        }
        throw new Error(`Unexpected token ${JSON.stringify(tk)} in "${src}"`);
    }

    function parseGroup(): boolean {
        let left: boolean;
        const first = peek();
        if (first && first.t === "op" && first.v === "!") {
            pos++;
            left = !parsePrimary();
        } else {
            left = parsePrimary();
        }
        const opTok = peek();
        if (!opTok || opTok.t !== "op" || !["&&", "||", "!="].includes(opTok.v)) {
            return left;
        }
        pos++;
        const right = parsePrimary();
        switch (opTok.v) {
            case "&&": return left && right;
            case "||": return left || right;
            default: return left !== right;
        }
    }

    const value = parsePrimary();
    if (pos !== toks.length) throw new Error(`Trailing tokens in generated C "${src}"`);
    return value;
}
