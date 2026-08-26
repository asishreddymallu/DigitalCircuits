/**
 * Tokenizer for the suite's Boolean expression language.
 *
 * Grammar (whitespace-insensitive):
 *   Identifier : [A-Za-z_][A-Za-z0-9_]*        (case-insensitive, canonical UPPERCASE)
 *   Constant   : 0 | 1
 *   NOT        : postfix '   or prefix ! ~ ¬
 *   AND        : * & · ∧        (also implicit between adjacent operands)
 *   OR         : + | ∨
 *   XOR        : ^ ⊕
 *   Grouping   : ( )
 *
 * Multi-character identifiers are first-class tokens: "PIN" is one variable,
 * never P·I·N. As a consequence, juxtaposed single-letter products must use
 * an explicit AND symbol ("A·B", "A*B") — the parser reports a helpful error
 * when it meets an unknown merged identifier.
 */

export type TokenType =
    | "IDENT" | "CONST"
    | "NOT_PREFIX" | "NOT_POSTFIX"
    | "AND" | "OR" | "XOR"
    | "LPAREN" | "RPAREN";

export interface Token {
    type: TokenType;
    /** Canonical (uppercased) identifier name. */
    value?: string;
    /** Character offset in the source string, for error reporting. */
    pos: number;
    /** Raw text as typed, used in error messages. */
    raw?: string;
}

/** Parser/tokenizer error carrying the offending position in the source. */
export class BooleanParseError extends Error {
    position: number;
    constructor(message: string, position = 0) {
        super(message);
        this.name = "BooleanParseError";
        this.position = position;
    }
}

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;

export function isIdentStart(ch: string): boolean { return IDENT_START.test(ch); }
export function isIdentPart(ch: string): boolean { return IDENT_PART.test(ch); }

export function tokenize(expression: string): Token[] {
    if (expression.length > 2000) {
        throw new BooleanParseError(
            `Expression is too long (${expression.length} characters). Maximum supported length is 2000 characters.`,
            2000
        );
    }

    const tokens: Token[] = [];
    let i = 0;
    while (i < expression.length) {
        const ch = expression[i];

        if (/\s/.test(ch)) { i++; continue; }

        // Identifiers: maximal munch so multi-character names stay whole.
        if (IDENT_START.test(ch)) {
            let j = i + 1;
            while (j < expression.length && IDENT_PART.test(expression[j])) j++;
            const raw = expression.slice(i, j);
            tokens.push({ type: "IDENT", value: raw.toUpperCase(), raw, pos: i });
            i = j;
            continue;
        }

        // Constants 0 and 1.
        if (ch === "0" || ch === "1") {
            tokens.push({ type: "CONST", value: ch, raw: ch, pos: i });
            i++;
            continue;
        }

        switch (ch) {
            case "'":
            case "’":
                tokens.push({ type: "NOT_POSTFIX", raw: "'", pos: i }); i++; continue;
            case "!":
            case "~":
            case "¬":
                tokens.push({ type: "NOT_PREFIX", raw: ch, pos: i }); i++; continue;
            case "*":
            case "&":
            case "·":
            case "∧":
            case ".":
                tokens.push({ type: "AND", raw: ch, pos: i }); i++; continue;
            case "+":
            case "|":
            case "∨":
                tokens.push({ type: "OR", raw: ch, pos: i }); i++; continue;
            case "^":
            case "⊕":
                tokens.push({ type: "XOR", raw: ch, pos: i }); i++; continue;
            case "(":
            case "[":
                tokens.push({ type: "LPAREN", raw: "(", pos: i }); i++; continue;
            case ")":
            case "]":
                tokens.push({ type: "RPAREN", raw: ")", pos: i }); i++; continue;
        }

        throw new BooleanParseError(
            `Invalid character '${ch}' at position ${i + 1}. ` +
            `Supported: variables (A–Z or names like ENABLE), constants 0 and 1, ` +
            `NOT (' ! ~), AND (* & ·), OR (+ |), XOR (^), parentheses.`,
            i
        );
    }
    return tokens;
}

/**
 * Insert explicit AND tokens where two operands are adjacent
 * (e.g. "(A+B)(C+D)", "A'B", "A·1"). Valid when the left side can end an
 * operand and the right side can begin one.
 */
export function insertImplicitAND(tokens: Token[]): Token[] {
    const result: Token[] = [];
    for (let i = 0; i < tokens.length; i++) {
        const current = tokens[i];
        result.push(current);
        if (i + 1 < tokens.length) {
            const next = tokens[i + 1];
            const leftCanEnd =
                current.type === "IDENT" ||
                current.type === "CONST" ||
                current.type === "NOT_POSTFIX" ||
                current.type === "RPAREN";
            const rightCanStart =
                next.type === "IDENT" ||
                next.type === "CONST" ||
                next.type === "LPAREN" ||
                next.type === "NOT_PREFIX";
            if (leftCanEnd && rightCanStart) {
                result.push({ type: "AND", raw: "", pos: next.pos });
            }
        }
    }
    return result;
}
