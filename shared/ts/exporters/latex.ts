/**
 * LaTeX export for documents that render math ($$...$$ blocks).
 * NOT renders as \overline{...}, AND as \cdot, XOR as \oplus.
 */

import { AstNode } from "../boolean/ast";

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function latexVar(name: string): string {
    // Multi-character names read better in \mathrm{}; single letters are
    // already italic math variables.
    return IDENT_RE.test(name) && name.length > 1 ? `\\mathrm{${name}}` : name;
}

function toLatexExpr(node: AstNode): string {
    switch (node.kind) {
        case "var": return latexVar(node.name);
        case "const": return node.value ? "1" : "0";
        case "not": return `\\overline{${toLatexExpr(node.child)}}`;
        case "and": return `${toLatexOperand(node.left, node.kind)} \\cdot ${toLatexOperand(node.right, node.kind)}`;
        case "or": return `${toLatexOperand(node.left, node.kind)} + ${toLatexOperand(node.right, node.kind)}`;
        case "xor": return `${toLatexOperand(node.left, node.kind)} \\oplus ${toLatexOperand(node.right, node.kind)}`;
    }
}

/**
 * Parenthesize an operand only when its precedence is looser than the
 * parent's — \cdot binds tighter than +, so AND operands of OR need no
 * grouping, matching conventional textbook layout.
 */
function toLatexOperand(node: AstNode, parentKind: AstNode["kind"]): string {
    const PREC = { or: 1, xor: 2, and: 3, not: 4, var: 5, const: 5 } as const;
    if (PREC[node.kind] < PREC[parentKind]) {
        return `\\left(${toLatexExpr(node)}\\right)`;
    }
    return toLatexExpr(node);
}

export function generateLatex(ast: AstNode, outputName = "F"): string {
    return `$$${outputName} = ${toLatexExpr(ast)}$$`;
}
