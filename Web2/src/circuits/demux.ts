import type { CircuitDefinition } from "../types";
import {
    wireHopH, wireV, dot,
    gateXOR, gateAND, gateOR, gateNOT,
    gateNAND, gateNOR, gateXNOR,
} from "../gates";

export const demux_1to2: CircuitDefinition = {
        id: "demux_1to2",
        title: "1:2 Demultiplexer",
        description: "Directs input data Din to 1 of 2 outputs based on S0.",
        inputs: ["Din", "S0"],
        outputs: ["Y0", "Y1"],
        evaluate: (inp) => ({
            "Y0": inp.S0 === 0 ? inp.Din : 0,
            "Y1": inp.S0 === 1 ? inp.Din : 0
        }),
        truthTable: [
            { inputs: [1, 0], outputs: [1, 0] },
            { inputs: [1, 1], outputs: [0, 1] },
            { inputs: [0, 0], outputs: [0, 0] }
        ],
        expressions: [
            { output: "Y0", formula: "S0' · Din" },
            { output: "Y1", formula: "S0 · Din" }
        ],
        renderSchematic: (inp, out) => {
            const din = inp.Din, s0 = inp.S0;
            return `
                <svg width="600" height="240" viewBox="0 0 600 240" class="circuit-svg">
                    <polygon points="220,60 360,30 360,210 220,180" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.5" />
                    <text x="290" y="125" text-anchor="middle" font-weight="800" font-size="16" fill="var(--text-primary)">1:2 DEMUX</text>

                    ${wireHopH(50, 220, 120, [], din)}
                    <text x="20" y="125" font-weight="800" font-size="14" fill="var(--text-primary)">Din</text>

                    ${wireV(290, 195, 225, s0)}
                    <text x="290" y="235" text-anchor="middle" font-weight="800" font-size="12" fill="var(--text-primary)">S0 = ${s0}</text>

                    ${wireHopH(360, 480, 75, [], out.Y0)}
                    <text x="500" y="80" font-weight="800" font-size="14" fill="var(--text-primary)">Y0 = ${out.Y0}</text>

                    ${wireHopH(360, 480, 165, [], out.Y1)}
                    <text x="500" y="170" font-weight="800" font-size="14" fill="var(--text-primary)">Y1 = ${out.Y1}</text>
                </svg>
            `;
        },
        verilogModule: `module demux_1to2 (
    input  wire Din,
    input  wire S0,
    output wire Y0,
    output wire Y1
);
    assign Y0 = (~S0) & Din;
    assign Y1 = S0 & Din;
endmodule`
    }

export const demux_1to4: CircuitDefinition = {
        id: "demux_1to4",
        title: "1:4 Demultiplexer",
        description: "Distributes 1 data input (Din) to 1 of 4 outputs (Y0-Y3) using select lines (S1, S0).",
        inputs: ["Din", "S1", "S0"],
        outputs: ["Y0", "Y1", "Y2", "Y3"],
        evaluate: (inp) => {
            const sel = (inp.S1 << 1) | inp.S0;
            return {
                "Y0": sel === 0 ? inp.Din : 0,
                "Y1": sel === 1 ? inp.Din : 0,
                "Y2": sel === 2 ? inp.Din : 0,
                "Y3": sel === 3 ? inp.Din : 0
            };
        },
        truthTable: [
            { inputs: [1, 0, 0], outputs: [1, 0, 0, 0] },
            { inputs: [1, 0, 1], outputs: [0, 1, 0, 0] },
            { inputs: [1, 1, 0], outputs: [0, 0, 1, 0] },
            { inputs: [1, 1, 1], outputs: [0, 0, 0, 1] }
        ],
        expressions: [
            { output: "Y0", formula: "S1'·S0'·Din" },
            { output: "Y1", formula: "S1'·S0·Din" },
            { output: "Y2", formula: "S1·S0'·Din" },
            { output: "Y3", formula: "S1·S0·Din" }
        ],
        renderSchematic: (inp, out) => {
            return `
                <svg width="640" height="280" viewBox="0 0 640 280" class="circuit-svg">
                    <polygon points="240,60 380,30 380,250 240,220" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.5" />
                    <text x="310" y="145" text-anchor="middle" font-weight="800" font-size="15" fill="var(--text-primary)">1:4 DEMUX</text>

                    ${wireHopH(50, 240, 140, [], inp.Din)}
                    <text x="20" y="145" font-weight="800" font-size="14" fill="var(--text-primary)">Din</text>

                    ${wireV(290, 230, 265, inp.S1)}
                    <text x="290" y="275" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S1</text>
                    ${wireV(330, 235, 265, inp.S0)}
                    <text x="330" y="275" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S0</text>

                    ${[0,1,2,3].map(i => {
                        const yVal = (out as any)[`Y${i}`];
                        const yPos = 65 + i * 45;
                        return `
                            ${wireHopH(380, 520, yPos, [], yVal)}
                            <text x="540" y="${yPos + 5}" font-weight="800" font-size="14" fill="var(--text-primary)">Y${i} = ${yVal}</text>
                        `;
                    }).join("")}
                </svg>
            `;
        },
        verilogModule: `module demux_1to4 (
    input  wire       Din,
    input  wire [1:0] S,
    output reg  [3:0] Y
);
    always @(*) begin
        Y = 4'b0000;
        Y[S] = Din;
    end
endmodule`
    }

export const demux_1to8: CircuitDefinition = {
        id: "demux_1to8",
        title: "1:8 Demultiplexer",
        description: "Distributes 1 data input (Din) to 1 of 8 outputs (Y0-Y7) using select lines (S2, S1, S0).",
        inputs: ["Din", "S2", "S1", "S0"],
        outputs: ["Y0", "Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"],
        evaluate: (inp) => {
            const sel = (inp.S2 << 2) | (inp.S1 << 1) | inp.S0;
            const res: Record<string, number> = {};
            for (let i = 0; i < 8; i++) res[`Y${i}`] = (sel === i && inp.Din === 1) ? 1 : 0;
            return res;
        },
        truthTable: [
            { inputs: [1, 0, 0, 0], outputs: [1,0,0,0, 0,0,0,0] },
            { inputs: [1, 0, 1, 1], outputs: [0,0,0,1, 0,0,0,0] },
            { inputs: [1, 1, 1, 1], outputs: [0,0,0,0, 0,0,0,1] }
        ],
        expressions: [{ output: "Yk", formula: "m_k · Din for k = 0..7" }],
        renderSchematic: (inp, out) => {
            return `
                <svg width="720" height="340" viewBox="0 0 720 340" class="circuit-svg">
                    <polygon points="260,55 440,20 440,320 260,285" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.5" />
                    <text x="350" y="170" text-anchor="middle" font-weight="800" font-size="18" fill="var(--text-primary)">1:8 DEMUX</text>

                    ${wireHopH(50, 260, 170, [], inp.Din)}
                    <text x="20" y="175" font-weight="800" font-size="14" fill="var(--text-primary)">Din</text>

                    ${wireV(310, 292, 330, inp.S2)}
                    <text x="310" y="338" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S2</text>
                    ${wireV(350, 300, 330, inp.S1)}
                    <text x="350" y="338" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S1</text>
                    ${wireV(390, 310, 330, inp.S0)}
                    <text x="390" y="338" text-anchor="middle" font-weight="800" font-size="11" fill="var(--text-primary)">S0</text>

                    ${[0,1,2,3,4,5,6,7].map(i => {
                        const yVal = (out as any)[`Y${i}`];
                        const yPos = 38 + i * 36;
                        return `
                            ${wireHopH(440, 580, yPos, [], yVal)}
                            <text x="600" y="${yPos + 4}" font-weight="800" font-size="12" fill="var(--text-primary)">Y${i} = ${yVal}</text>
                        `;
                    }).join("")}
                </svg>
            `;
        },
        verilogModule: `module demux_1to8 (
    input  wire       Din,
    input  wire [2:0] S,
    output reg  [7:0] Y
);
    always @(*) begin
        Y = 8'b00000000;
        Y[S] = Din;
    end
endmodule`
    }
