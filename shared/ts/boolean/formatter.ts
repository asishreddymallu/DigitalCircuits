/**
 * Human-readable display formatting for Boolean ASTs and implicant terms.
 *
 * Display conventions match the original suite: postfix ' for NOT, '+' for
 * OR, '^' for XOR, and juxtaposition (or an explicit '·') for AND.
 *
 * Juxtaposition is only safe when the boundary between two adjacent literals
 * cannot be misread as one identifier — e.g. "A'B" is fine (' terminates the
 * identifier) but multi-character names like PIN·ENABLE MUST use a visible
 * separator ("PINENABLE" would lex as a single unknown variable). The
 * formatter inserts '·' automatically whenever adjacency is ambiguous.
 */

import { AstNode } from "./ast";
import { isIdentStart, isIdentPart } from "./tokenizer";

export interface FormatOptions {
    /** Symbol between ANDed literals; "" = juxtaposition (auto-upgrades to "·" when ambiguous). */
    andSymbol?: string;
    /** Symbol for XOR in display output. */
    xorSymbol?: string;
}

const PRECEDENCE: Record<string, number> = { or: 1, xor: 2, and: 3, not: 4, var: 5, const: 5 };

export function formatAst(node: AstNode, options: FormatOptions = {}): string {
    const andSymbol = options.andSymbol ?? "";
    const xorSymbol = options.xorSymbol ?? "^";

    switch (node.kind) {
        case "var": return node.name;
        case "const": return node.value ? "1" : "0";
        case "not": return formatNot(node.child);
        case "xor": {
            const left = formatChild(node.left, PRECEDENCE.xor);
            const right = formatChild(node.right, PRECEDENCE.xor + 1);
            return `${left} ${xorSymbol} ${right}`;
        }
        default: {
            // Flatten same-kind chains so A·B·C renders without deep nesting.
            const parts = flatten(node.kind, node as Extract<AstNode, { kind: "and" | "or" }>);
            const renderedParts = parts.map(p => formatChild(p, PRECEDENCE[node.kind] + 1));
            if (node.kind === "and") {
                return joinAndLiterals(renderedParts, andSymbol);
            }
            return renderedParts.join(" + ");
        }
    }
}

function flatten(kind: "and" | "or", node: Extract<AstNode, { kind: "and" | "or" }>, out: AstNode[] = []): AstNode[] {
    for (const side of [node.left, node.right]) {
        if (side.kind === kind) flatten(kind, side, out);
        else out.push(side);
    }
    return out;
}

function formatNot(child: AstNode): string {
    const inner = formatChild(child, PRECEDENCE.not);
    return `${inner}'`;
}

function formatChild(child: AstNode, minPrecedence: number): string {
    const text = formatAstRaw(child);
    return PRECEDENCE[child.kind] < minPrecedence ? `(${text})` : text;
}

/** Format without outer parentheses decisions — used internally. */
function formatAstRaw(node: AstNode): string {
    return formatAst(node);
}

/**
 * Join literal strings with the chosen AND symbol, inserting '·' wherever
 * plain juxtaposition would be ambiguous (identifier character touching
 * identifier character across the boundary).
 */
function joinAndLiterals(literals: string[], andSymbol: string): string {
    let result = "";
    for (let i = 0; i < literals.length; i++) {
        if (i > 0) {
            const prevEnd = result[result.length - 1];
            const nextStart = literals[i][0];
            const needsSeparator =
                andSymbol !== "" ||
                (prevEnd !== undefined && nextStart !== undefined &&
                    isBoundaryAmbiguous(prevEnd, nextStart));
            result += needsSeparator ? (andSymbol || "·") : "";
        }
        result += literals[i];
    }
    return result;
}

function isBoundaryAmbiguous(prevChar: string, nextChar: string): boolean {
    // A closing quote terminates an identifier, so anything may follow it.
    if (prevChar === "'") return false;
    // If both boundary characters are identifier characters, juxtaposition
    // would re-parse as ONE merged identifier ("BC") — always separate.
    if (!isIdentPart(prevChar)) return false;
    return isIdentPart(nextChar);
}

/**
 * Render a Quine-McCluskey implicant pattern as an SOP term
 * (pattern '1' → variable, '0' → variable', '-' → omitted).
 * An all-dash pattern renders as "1".
 */
export function termToString(pattern: string, variables: string[], andSymbol = ""): string {
    const literals: string[] = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "1") literals.push(variables[i]);
        else if (pattern[i] === "0") literals.push(`${variables[i]}'`);
    }
    if (literals.length === 0) return "1";
    return joinAndLiterals(literals, andSymbol);
}

/**
 * Render a POS clause from an implicant pattern over the complement:
 * pattern '0' → variable, '1' → variable'. Single-literal clauses drop the
 * parentheses; all-dash renders as "0".
 */
export function clauseToString(pattern: string, variables: string[], orSymbol = " + "): string {
    const parts: string[] = [];
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "0") parts.push(variables[i]);
        else if (pattern[i] === "1") parts.push(`${variables[i]}'`);
    }
    if (parts.length === 0) return "0";
    return parts.length === 1 ? parts[0] : `(${parts.join(orSymbol)})`;
}
