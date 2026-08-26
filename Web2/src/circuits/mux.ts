import type { CircuitDefinition } from "../types";
import {
    wireHopH, wireV, dot,
    gateXOR, gateAND, gateOR, gateNOT,
    gateNAND, gateNOR, gateXNOR,
} from "../gates";

export const mux_2to1: CircuitDefinition = {
        id: "mux_2to1",
        title: "2:1 Multiplexer",
        description: "Selects between 2 data inputs (I0, I1) based on select line S0.",
        inputs: ["I0", "I1", "S0"],
        outputs: ["Y"],
        evaluate: (inp) => ({ "Y": inp.S0 === 0 ? inp.I0 : inp.I1 }),
        truthTable: [
            { inputs: [0, 0, 0], outputs: [0] },
            { inputs: [1, 0, 0], outputs: [1] },
            { inputs: [0, 1, 1], outputs: [1] },
            { inputs: [1, 1, 1], outputs: [1] }
        ],
        expressions: [{ output: "Y", formula: "S0'·I0 + S0·I1" }],
        renderSchematic: (inp, out) => {
            const i0 = inp.I0, i1 = inp.I1, s0 = inp.S0, y = out.Y;
            const notS0 = 1 - s0;
            const and0 = i0 & notS0;
            const and1 = i1 & s0;
            return `
                <svg width="620" height="260" viewBox="0 0 620 260" class="circuit-svg">
                    <!-- Control Inverter -->
                    ${gateNOT(110, 208)}
                    ${gateAND(270, 45, "AND1")}
                    ${gateAND(270, 135, "AND2")}
                    ${gateOR(430, 90, "OR")}

                    <!-- Select S0 Line & Inverter -->
                    ${wireHopH(40, 110, 220, [], s0)}
                    ${dot(80, 220, s0)}
                    ${wireV(80, 165, 220, s0)}
                    ${wireHopH(145, 175, 220, [], notS0)}
                    ${wireV(175, 75, 220, notS0)}

                    <!-- Data Inputs -->
                    ${wireHopH(40, 270, 55, [80], i0)}
                    ${wireHopH(175, 270, 75, [], notS0)}

                    ${wireHopH(40, 270, 145, [80, 175], i1)}
                    ${wireHopH(80, 270, 165, [175], s0)}

                    <!-- AND outputs to OR -->
                    ${wireHopH(320, 380, 65, [], and0)}
                    ${wireV(380, 65, 100, and0)}
                    ${wireHopH(380, 430, 100, [], and0)}

                    ${wireHopH(320, 380, 155, [], and1)}
                    ${wireV(380, 120, 155, and1)}
                    ${wireHopH(380, 430, 120, [], and1)}

                    <!-- Final Output -->
                    ${wireHopH(486, 560, 110, [], y)}

                    <text x="20" y="60" font-weight="800" font-size="14" fill="var(--text-primary)">I0</text>
                    <text x="20" y="150" font-weight="800" font-size="14" fill="var(--text-primary)">I1</text>
                    <text x="20" y="225" font-weight="800" font-size="14" fill="var(--text-primary)">S0</text>
                    <text x="575" y="115" font-weight="800" font-size="15" fill="var(--text-primary)">Y = ${y}</text>
                </svg>
            `;
        },
        verilogModule: `module mux_2to1 (
    input  wire I0,
    input  wire I1,
    input  wire S0,
    output wire Y
);
    assign Y = S0 ? I1 : I0;
endmodule`
    }

export const mux_4to1: CircuitDefinition = {
        id: "mux_4to1",
        title: "4:1 Multiplexer",
        description: "Selects 1 of 4 data inputs (I0-I3) using 2 select lines (S1, S0).",
        inputs: ["I0", "I1", "I2", "I3", "S1", "S0"],
        outputs: ["Y"],
        evaluate: (inp) => {
            const sel = (inp.S1 << 1) | inp.S0;
            const inps = [inp.I0, inp.I1, inp.I2, inp.I3];
            return { "Y": inps[sel] };
        },
        truthTable: [
            { inputs: [1,0,0,0, 0,0], outputs: [1] },
            { inputs: [0,1,0,0, 0,1], outputs: [1] },
            { inputs: [0,0,1,0, 1,0], outputs: [1] },
            { inputs: [0,0,0,1, 1,1], outputs: [1] }
        ],
        expressions: [{ output: "Y", formula: "S1'·S0'·I0 + S1'·S0·I1 + S1·S0'·I2 + S1·S0·I3" }],
        renderSchematic: (inp, out) => {
            const y = out.Y;
            const sel = (inp.S1 << 1) | inp.S0;
            return `
                <svg width="680" height="290" viewBox="0 0 680 290" class="circuit-svg">
                    <!-- Trapezoid MUX Symbol -->
                    <polygon points="260,25 420,55 420,235 260,265" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.5" />
                    <text x="340" y="145" text-anchor="middle" font-weight="800" font-size="16" fill="var(--text-primary)">4:1 MUX</text>

                    ${[0,1,2,3].map(i => {
                        const isHigh = (inp as any)[`I${i}`] === 1;
                        const isSel = sel === i;
                        const yPos = 55 + i * 50;
                        return `
                            ${wireHopH(50, 260, yPos, [], isHigh)}
                            <text x="25" y="${yPos + 5}" font-weight="800" font-size="13" fill="${isSel ? "var(--accent-secondary)" : "var(--text-primary)"}">I${i}${isSel ? " ★" : ""}</text>
                        `;
                    }).join("")}

                    <!-- Select lines -->
                    ${wireV(310, 255, 275, inp.S1)}
                    <text x="310" y="285" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">S1</text>
                    ${wireV(370, 245, 275, inp.S0)}
                    <text x="370" y="285" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">S0</text>

                    <!-- Output -->
                    ${wireHopH(420, 560, 145, [], y)}
                    <text x="580" y="150" font-weight="800" font-size="16" fill="var(--text-primary)">Y = ${y}</text>
                </svg>
            `;
        },
        verilogModule: `module mux_4to1 (
    input  wire [3:0] I,
    input  wire [1:0] S,
    output wire       Y
);
    assign Y = I[S];
endmodule`
    }

export const mux_8to1: CircuitDefinition = {
        id: "mux_8to1",
        title: "8:1 Multiplexer",
        description: "Selects 1 of 8 inputs (I0-I7) using 3 select lines (S2, S1, S0).",
        inputs: ["I0", "I1", "I2", "I3", "I4", "I5", "I6", "I7", "S2", "S1", "S0"],
        outputs: ["Y"],
        evaluate: (inp) => {
            const sel = (inp.S2 << 2) | (inp.S1 << 1) | inp.S0;
            const inps = [inp.I0, inp.I1, inp.I2, inp.I3, inp.I4, inp.I5, inp.I6, inp.I7];
            return { "Y": inps[sel] };
        },
        truthTable: [
            { inputs: [1,0,0,0, 0,0,0,0, 0,0,0], outputs: [1] },
            { inputs: [0,1,0,0, 0,0,0,0, 0,0,1], outputs: [1] },
            { inputs: [0,0,0,0, 0,0,0,1, 1,1,1], outputs: [1] }
        ],
        expressions: [{ output: "Y", formula: "Σ (m_k · I_k) for k = 0..7" }],
        renderSchematic: (inp, out) => {
            const y = out.Y;
            const sel = (inp.S2 << 2) | (inp.S1 << 1) | inp.S0;
            return `
                <svg width="720" height="340" viewBox="0 0 720 340" class="circuit-svg">
                    <polygon points="260,20 440,55 440,285 260,320" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.5" />
                    <text x="350" y="170" text-anchor="middle" font-weight="800" font-size="18" fill="var(--text-primary)">8:1 MUX</text>

                    ${[0,1,2,3,4,5,6,7].map(i => {
                        const isHigh = (inp as any)[`I${i}`] === 1;
                        const isSel = sel === i;
                        const yPos = 38 + i * 36;
                        return `
                            ${wireHopH(50, 260, yPos, [], isHigh)}
                            <text x="25" y="${yPos + 4}" font-weight="800" font-size="12" fill="${isSel ? "var(--accent-secondary)" : "var(--text-primary)"}">I${i}${isSel ? " ★" : ""}</text>
                        `;
                    }).join("")}

                    ${wireV(310, 310, 330, inp.S2)}
                    <text x="310" y="338" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S2</text>
                    ${wireV(350, 300, 330, inp.S1)}
                    <text x="350" y="338" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S1</text>
                    ${wireV(390, 292, 330, inp.S0)}
                    <text x="390" y="338" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S0</text>

                    ${wireHopH(440, 580, 170, [], y)}
                    <text x="600" y="175" font-weight="800" font-size="16" fill="var(--text-primary)">Y = ${y}</text>
                </svg>
            `;
        },
        verilogModule: `module mux_8to1 (
    input  wire [7:0] I,
    input  wire [2:0] S,
    output wire       Y
);
    assign Y = I[S];
endmodule`
    }
