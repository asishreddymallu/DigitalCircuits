/**
 * Recursive-descent parser producing the canonical AST.
 *
 * Precedence (loosest to tightest): OR < XOR < AND < prefix NOT < postfix NOT.
 * Error messages state what happened, why, and what to do — they are part of
 * the educational UX and are covered by unit tests.
 */

import { AstNode } from "./ast";
import {
    BooleanParseError,
    insertImplicitAND,
    Token,
    tokenize
} from "./tokenizer";

class TokenStream {
    private index = 0;

    constructor(private readonly tokens: Token[]) {}

    peek(): Token | undefined { return this.tokens[this.index]; }
    next(): Token | undefined { return this.tokens[this.index++]; }

    describe(token: Token | undefined): string {
        if (!token) return "end of expression";
        return `'${token.raw ?? token.value ?? token.type}'`;
    }
}

export interface ParsedExpression {
    ast: AstNode;
    /** Distinct variable names referenced by the expression (sorted). */
    variables: string[];
}

/**
 * Parse a Boolean expression into an AST.
 *
 * `knownVariables` optionally constrains which identifiers may appear; when
 * provided, unknown identifiers raise an error that suggests the intended
 * operator (the classic single-letter user typing "AB" for A AND B).
 */
export function parseExpression(
    source: string,
    knownVariables?: readonly string[]
): ParsedExpression {
    const trimmed = source.trim();
    if (!trimmed) {
        throw new BooleanParseError("The expression is empty. Enter a Boolean expression such as A'B + BC.");
    }

    const stream = new TokenStream(insertImplicitAND(tokenize(trimmed)));
    const node = parseOR(stream);

    const trailing = stream.peek();
    if (trailing) {
        throw new BooleanParseError(
            `Unexpected ${stream.describe(trailing)} at position ${trailing.pos + 1} after the end of the expression. ` +
            `Missing an operator (AND *, OR +, XOR ^)?`,
            trailing.pos
        );
    }

    const variables = [...collectAstVars(node)].sort();

    if (knownVariables && knownVariables.length > 0) {
        const known = new Set(knownVariables);
        for (const v of variables) {
            if (!known.has(v)) {
                // The most common cause is typing single-letter products
                // without separators ("AB" lexes as one identifier).
                const looksMerged = v.length > 1 && [...v].every(c => known.has(c));
                const hint = looksMerged
                    ? ` If you meant ${[...v].map(c => `${c}' or variables joined with ·`).join(", ").replace("' or variables joined with ·", "")}, write them with an explicit AND, e.g. "${[...v].join("·")}".`
                    : "";
                throw new BooleanParseError(
                    `Unknown variable '${v}'. This function uses: ${knownVariables.join(", ")}.${hint}`
                );
            }
        }
    }

    return { ast: node, variables };
}

function collectAstVars(node: AstNode, out: Set<string> = new Set()): Set<string> {
    switch (node.kind) {
        case "var": out.add(node.name); break;
        case "const": break;
        case "not": collectAstVars(node.child, out); break;
        default:
            collectAstVars(node.left, out);
            collectAstVars(node.right, out);
    }
    return out;
}

function parseOR(stream: TokenStream): AstNode {
    let node = parseXOR(stream);
    while (stream.peek()?.type === "OR") {
        stream.next();
        node = { kind: "or", left: node, right: parseXOR(stream) };
    }
    return node;
}

function parseXOR(stream: TokenStream): AstNode {
    let node = parseAND(stream);
    while (stream.peek()?.type === "XOR") {
        const opToken = stream.next()!;
        const right = parseAND(stream);
        if (right.kind === "xor" || right.kind === "and" || right.kind === "or") {
            // XOR is left-associative; parseAND already returns the tightest
            // binding so no re-association is required here.
        }
        void opToken;
        node = { kind: "xor", left: node, right };
    }
    return node;
}

function parseAND(stream: TokenStream): AstNode {
    let node = parseUnary(stream);
    while (stream.peek()?.type === "AND") {
        stream.next();
        node = { kind: "and", left: node, right: parseUnary(stream) };
    }
    return node;
}

function parseUnary(stream: TokenStream): AstNode {
    const tok = stream.peek();
    if (tok?.type === "NOT_PREFIX") {
        stream.next();
        const child = parseUnary(stream);
        if (child.kind === "var" || child.kind === "const") {
            // Keep NOT(var/const) unwrapped; compound operands keep structure.
        }
        return { kind: "not", child };
    }

    let node = parsePrimary(stream);

    while (stream.peek()?.type === "NOT_POSTFIX") {
        stream.next();
        node = { kind: "not", child: node };
    }
    return node;
}

function parsePrimary(stream: TokenStream): AstNode {
    const token = stream.next();

    if (!token) {
        throw new BooleanParseError(
            "Unexpected end of expression. Expected a variable, a constant (0 or 1), or '('."
        );
    }

    if (token.type === "IDENT") {
        return { kind: "var", name: token.value! };
    }

    if (token.type === "CONST") {
        return { kind: "const", value: token.value === "1" };
    }

    if (token.type === "LPAREN") {
        const inner = parseOR(stream);
        const close = stream.next();
        if (!close || close.type !== "RPAREN") {
            throw new BooleanParseError(
                `Missing closing ')' for the parenthesis opened at position ${token.pos + 1}.`,
                token.pos
            );
        }
        return inner;
    }

    if (token.type === "NOT_POSTFIX") {
        throw new BooleanParseError(
            `Stray ''' at position ${token.pos + 1}: nothing before it to complement.`,
            token.pos
        );
    }

    throw new BooleanParseError(
        `Unexpected ${stream.describe(token)} at position ${token.pos + 1}. ` +
        `Expected a variable, a constant (0 or 1), or '('.`,
        token.pos
    );
}
