/**
 * Verilog HDL export.
 *
 * Generated expressions are FULLY PARENTHESIZED so correctness never depends
 * on remembering operator precedence rules, and so test tooling can verify
 * semantics with a trivial grammar. Structure comes from the AST — no regex
 * rewriting of display strings.
 */

import { AstNode } from "../boolean/ast";

export interface VerilogModuleOptions {
    moduleName?: string;
    outputName?: string;
    inputs?: string[];
}

function toVerilogExpr(node: AstNode): string {
    switch (node.kind) {
        case "var": return node.name;
        case "const": return node.value ? "1'b1" : "1'b0";
        case "not": return `(~${toVerilogOperand(node.child)})`;
        case "and": return `(${toVerilogExpr(node.left)} & ${toVerilogExpr(node.right)})`;
        case "or": return `(${toVerilogExpr(node.left)} | ${toVerilogExpr(node.right)})`;
        case "xor": return `(${toVerilogExpr(node.left)} ^ ${toVerilogExpr(node.right)})`;
    }
}

/** NOT wraps its operand in parentheses unless the operand is atomic. */
function toVerilogOperand(node: AstNode): string {
    const atom = node.kind === "var" || node.kind === "const";
    return atom ? toVerilogExpr(node) : `(${toVerilogExpr(node)})`;
}

export function generateVerilogModule(ast: AstNode, options: VerilogModuleOptions = {}): string {
    const moduleName = options.moduleName ?? "bool_function";
    const outputName = options.outputName ?? "F";
    const inputs = options.inputs ?? [];

    const portList = [
        ...inputs.map(name => `    input  wire ${name}`),
        `    output wire ${outputName}`
    ].join(",\n");

    return `// Verilog HDL - Boolean Function Synthesis Module
module ${moduleName} (
${portList}
);
    assign ${outputName} = ${toVerilogExpr(ast)};
endmodule`;
}
