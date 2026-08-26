import type { CircuitDefinition } from "../types";
import {
    wireHopH, wireV, dot,
    gateXOR, gateAND, gateOR, gateNOT,
    gateNAND, gateNOR, gateXNOR,
} from "../gates";

export const comparator_1bit: CircuitDefinition = {
        id: "comparator_1bit",
        title: "1-Bit Magnitude Comparator",
        description: "Compares 1-bit inputs A and B producing A > B, A = B, and A < B.",
        inputs: ["A", "B"],
        outputs: ["A > B", "A = B", "A < B"],
        evaluate: (inp) => ({
            "A > B": inp.A > inp.B ? 1 : 0,
            "A = B": inp.A === inp.B ? 1 : 0,
            "A < B": inp.A < inp.B ? 1 : 0
        }),
        truthTable: [
            { inputs: [0, 0], outputs: [0, 1, 0] },
            { inputs: [0, 1], outputs: [0, 0, 1] },
            { inputs: [1, 0], outputs: [1, 0, 0] },
            { inputs: [1, 1], outputs: [0, 1, 0] }
        ],
        expressions: [
            { output: "A = B", formula: "A ⊙ B" },
            { output: "A > B", formula: "A · B'" },
            { output: "A < B", formula: "A' · B" }
        ],
        renderSchematic: (inp, out) => {
            const a = inp.A, b = inp.B;
            const notA = 1 - a, notB = 1 - b;
            const eq = out["A = B"], gt = out["A > B"], lt = out["A < B"];
            return `
                <svg width="640" height="260" viewBox="0 0 640 260" class="circuit-svg">
                    ${gateAND(280, 35, "AND1")}
                    ${gateXNOR(280, 110, "XNOR")}
                    ${gateAND(280, 185, "AND2")}

                    ${gateNOT(140, 68)}
                    ${gateNOT(140, 168)}

                    <!-- Input A -->
                    ${wireHopH(40, 280, 45, [], a)}
                    ${dot(80, 45, a)}
                    ${wireV(80, 45, 180, a)}
                    ${wireHopH(80, 140, 180, [], a)}
                    ${dot(80, 120, a)}
                    ${wireHopH(80, 278, 120, [], a)}

                    <!-- Input B -->
                    ${wireHopH(40, 280, 215, [], b)}
                    ${dot(100, 215, b)}
                    ${wireV(100, 80, 215, b)}
                    ${wireHopH(100, 140, 80, [], b)}
                    ${dot(100, 140, b)}
                    ${wireHopH(100, 278, 140, [], b)}

                    <!-- Inverter Outs -->
                    ${wireHopH(175, 280, 80, [], notB)}
                    ${wireHopH(175, 280, 180, [], notA)}

                    <!-- Outputs -->
                    ${wireHopH(330, 500, 55, [], gt)}
                    ${wireHopH(350, 500, 130, [], eq)}
                    ${wireHopH(330, 500, 205, [], lt)}

                    <text x="20" y="50" font-weight="800" font-size="14" fill="var(--text-primary)">A</text>
                    <text x="20" y="220" font-weight="800" font-size="14" fill="var(--text-primary)">B</text>
                    <text x="520" y="60" font-weight="800" font-size="14" fill="var(--text-primary)">A &gt; B = ${gt}</text>
                    <text x="520" y="135" font-weight="800" font-size="14" fill="var(--text-primary)">A = B = ${eq}</text>
                    <text x="520" y="210" font-weight="800" font-size="14" fill="var(--text-primary)">A &lt; B = ${lt}</text>
                </svg>
            `;
        },
        verilogModule: `module comparator_1bit (
    input  wire A,
    input  wire B,
    output wire A_gt_B,
    output wire A_eq_B,
    output wire A_lt_B
);
    assign A_gt_B = (A > B);
    assign A_eq_B = (A == B);
    assign A_lt_B = (A < B);
endmodule`
    }

export const comparator_2bit: CircuitDefinition = {
        id: "comparator_2bit",
        title: "2-Bit Magnitude Comparator",
        description: "Compares two 2-bit words (A1 A0) and (B1 B0), asserting A > B, A = B, or A < B.",
        inputs: ["A1", "A0", "B1", "B0"],
        outputs: ["A > B", "A = B", "A < B"],
        evaluate: (inp) => {
            const a = (inp.A1 << 1) | inp.A0;
            const b = (inp.B1 << 1) | inp.B0;
            return {
                "A > B": a > b ? 1 : 0,
                "A = B": a === b ? 1 : 0,
                "A < B": a < b ? 1 : 0
            };
        },
        truthTable: [
            { inputs: [0,0, 0,0], outputs: [0, 1, 0] },
            { inputs: [1,0, 0,1], outputs: [1, 0, 0] },
            { inputs: [0,1, 1,0], outputs: [0, 0, 1] },
            { inputs: [1,1, 1,1], outputs: [0, 1, 0] }
        ],
        expressions: [
            { output: "A = B", formula: "(A1 ⊙ B1) · (A0 ⊙ B0)" },
            { output: "A > B", formula: "A1·B1' + (A1 ⊙ B1)·A0·B0'" },
            { output: "A < B", formula: "A1'·B1 + (A1 ⊙ B1)·A0'·B0" }
        ],
        renderSchematic: (inp, out) => {
            return `
                <svg width="660" height="280" viewBox="0 0 660 280" class="circuit-svg">
                    <rect x="220" y="30" width="180" height="220" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
                    <text x="310" y="130" text-anchor="middle" font-weight="800" font-size="16" fill="var(--text-primary)">2-Bit Comparator</text>
                    <text x="310" y="152" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">Magnitude Matrix</text>

                    ${["A1", "A0", "B1", "B0"].map((pin, i) => {
                        const isHigh = (inp as any)[pin] === 1;
                        const yPos = 60 + i * 45;
                        return `
                            ${wireHopH(50, 220, yPos, [], isHigh)}
                            <text x="25" y="${yPos + 5}" font-weight="800" font-size="14" fill="var(--text-primary)">${pin}</text>
                        `;
                    }).join("")}

                    ${wireHopH(400, 520, 80, [], out["A > B"])}
                    <text x="540" y="85" font-weight="800" font-size="14" fill="var(--text-primary)">A &gt; B = ${out["A > B"]}</text>
                    ${wireHopH(400, 520, 140, [], out["A = B"])}
                    <text x="540" y="145" font-weight="800" font-size="14" fill="var(--text-primary)">A = B = ${out["A = B"]}</text>
                    ${wireHopH(400, 520, 200, [], out["A < B"])}
                    <text x="540" y="205" font-weight="800" font-size="14" fill="var(--text-primary)">A &lt; B = ${out["A < B"]}</text>
                </svg>
            `;
        },
        verilogModule: `module comparator_2bit (
    input  wire [1:0] A,
    input  wire [1:0] B,
    output wire       A_gt_B,
    output wire       A_eq_B,
    output wire       A_lt_B
);
    assign A_gt_B = (A > B);
    assign A_eq_B = (A == B);
    assign A_lt_B = (A < B);
endmodule`
    }
