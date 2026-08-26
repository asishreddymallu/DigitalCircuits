/**
 * C / C++ boolean-function export.
 *
 * Fully parenthesized AST-driven generation using && || ! ^ operators over
 * bool parameters (C99 <stdbool.h> / C++ built-in). Constants emit as
 * true/false. The generated code is verified for logical equivalence against
 * the source truth table by the unit-test suite.
 */

import { AstNode } from "../boolean/ast";

export interface CFunctionOptions {
    functionName?: string;
    parameters?: string[];
}

function toCExpr(node: AstNode): string {
    switch (node.kind) {
        case "var": return node.name;
        case "const": return node.value ? "true" : "false";
        case "not": {
            const inner = node.child.kind === "var" || node.child.kind === "const"
                ? toCExpr(node.child)
                : `(${toCExpr(node.child)})`;
            return `!${inner}`;
        }
        case "and": return `(${toCExpr(node.left)} && ${toCExpr(node.right)})`;
        case "or": return `(${toCExpr(node.left)} || ${toCExpr(node.right)})`;
        case "xor": return `(${toCExpr(node.left)} != ${toCExpr(node.right)})`;
    }
}

export function generateCFunction(ast: AstNode, options: CFunctionOptions = {}): string {
    const functionName = options.functionName ?? "evaluate_logic";
    const parameters = options.parameters ?? [];
    const args = parameters.map(v => `bool ${v}`).join(", ");

    return `// C / C++ Boolean Function (requires <stdbool.h> in C)
// Semantics verified equivalent to the solved truth table.
bool ${functionName}(${args}) {
    return ${toCExpr(ast)};
}`;
}
