import type { CircuitDefinition } from "../types";
import {
    wireHopH, wireV, dot,
    gateXOR, gateAND, gateOR, gateNOT,
    gateNAND, gateNOR, gateXNOR,
} from "../gates";

export const decoder_2to4: CircuitDefinition = {
        id: "decoder_2to4",
        title: "2-to-4 Line Decoder",
        description: "Decodes 2-bit binary code (A1, A0) into 4 active-high one-hot outputs (Y0-Y3).",
        inputs: ["A1", "A0", "Enable"],
        outputs: ["Y0", "Y1", "Y2", "Y3"],
        evaluate: (inp) => {
            if (inp.Enable === 0) return { "Y0": 0, "Y1": 0, "Y2": 0, "Y3": 0 };
            const code = (inp.A1 << 1) | inp.A0;
            return {
                "Y0": code === 0 ? 1 : 0,
                "Y1": code === 1 ? 1 : 0,
                "Y2": code === 2 ? 1 : 0,
                "Y3": code === 3 ? 1 : 0
            };
        },
        truthTable: [
            { inputs: [0, 0, 1], outputs: [1, 0, 0, 0] },
            { inputs: [0, 1, 1], outputs: [0, 1, 0, 0] },
            { inputs: [1, 0, 1], outputs: [0, 0, 1, 0] },
            { inputs: [1, 1, 1], outputs: [0, 0, 0, 1] },
            { inputs: [0, 0, 0], outputs: [0, 0, 0, 0] }
        ],
        expressions: [
            { output: "Y0", formula: "En·A1'·A0'" },
            { output: "Y1", formula: "En·A1'·A0" },
            { output: "Y2", formula: "En·A1·A0'" },
            { output: "Y3", formula: "En·A1·A0" }
        ],
        renderSchematic: (inp, out) => {
            return `
                <svg width="640" height="280" viewBox="0 0 640 280" class="circuit-svg">
                    <rect x="220" y="30" width="180" height="220" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
                    <text x="310" y="130" text-anchor="middle" font-weight="800" font-size="16" fill="var(--text-primary)">2:4 Decoder</text>
                    <text x="310" y="152" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">Active High</text>

                    ${wireHopH(50, 220, 80, [], inp.A1)}
                    <text x="25" y="85" font-weight="800" font-size="14" fill="var(--text-primary)">A1</text>
                    ${wireHopH(50, 220, 140, [], inp.A0)}
                    <text x="25" y="145" font-weight="800" font-size="14" fill="var(--text-primary)">A0</text>
                    ${wireHopH(50, 220, 200, [], inp.Enable)}
                    <text x="25" y="205" font-weight="800" font-size="14" fill="var(--text-primary)">EN</text>

                    ${[0,1,2,3].map(i => {
                        const yVal = (out as any)[`Y${i}`];
                        const yPos = 65 + i * 45;
                        return `
                            ${wireHopH(400, 520, yPos, [], yVal)}
                            <text x="540" y="${yPos + 5}" font-weight="800" font-size="14" fill="var(--text-primary)">Y${i} = ${yVal}</text>
                        `;
                    }).join("")}
                </svg>
            `;
        },
        verilogModule: `module decoder_2to4 (
    input  wire [1:0] A,
    input  wire       Enable,
    output wire [3:0] Y
);
    assign Y = Enable ? (4'b0001 << A) : 4'b0000;
endmodule`
    }

export const decoder_3to8: CircuitDefinition = {
        id: "decoder_3to8",
        title: "3-to-8 Line Decoder",
        description: "Decodes 3-bit binary code (A2, A1, A0) into 8 active-high outputs with Enable.",
        inputs: ["A2", "A1", "A0", "Enable"],
        outputs: ["Y0", "Y1", "Y2", "Y3", "Y4", "Y5", "Y6", "Y7"],
        evaluate: (inp) => {
            if (inp.Enable === 0) return { "Y0":0,"Y1":0,"Y2":0,"Y3":0,"Y4":0,"Y5":0,"Y6":0,"Y7":0 };
            const code = (inp.A2 << 2) | (inp.A1 << 1) | inp.A0;
            const res: Record<string, number> = {};
            for (let i = 0; i < 8; i++) res[`Y${i}`] = code === i ? 1 : 0;
            return res;
        },
        truthTable: [
            { inputs: [0, 0, 0, 1], outputs: [1,0,0,0, 0,0,0,0] },
            { inputs: [0, 1, 1, 1], outputs: [0,0,0,1, 0,0,0,0] },
            { inputs: [1, 1, 1, 1], outputs: [0,0,0,0, 0,0,0,1] },
            { inputs: [0, 0, 0, 0], outputs: [0,0,0,0, 0,0,0,0] }
        ],
        expressions: [{ output: "Yk", formula: "En · m_k for k = 0..7" }],
        renderSchematic: (inp, out) => {
            return `
                <svg width="720" height="340" viewBox="0 0 720 340" class="circuit-svg">
                    <rect x="240" y="20" width="200" height="300" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
                    <text x="340" y="160" text-anchor="middle" font-weight="800" font-size="17" fill="var(--text-primary)">3:8 Decoder</text>
                    <text x="340" y="185" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-muted)">Active High</text>

                    ${wireHopH(50, 240, 70, [], inp.A2)}
                    <text x="25" y="75" font-weight="800" font-size="13" fill="var(--text-primary)">A2</text>
                    ${wireHopH(50, 240, 130, [], inp.A1)}
                    <text x="25" y="135" font-weight="800" font-size="13" fill="var(--text-primary)">A1</text>
                    ${wireHopH(50, 240, 190, [], inp.A0)}
                    <text x="25" y="195" font-weight="800" font-size="13" fill="var(--text-primary)">A0</text>
                    ${wireHopH(50, 240, 250, [], inp.Enable)}
                    <text x="25" y="255" font-weight="800" font-size="13" fill="var(--text-primary)">EN</text>

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
        verilogModule: `module decoder_3to8 (
    input  wire [2:0] A,
    input  wire       Enable,
    output wire [7:0] Y
);
    assign Y = Enable ? (8'b00000001 << A) : 8'b00000000;
endmodule`
    }

export const priority_encoder_4to2: CircuitDefinition = {
        id: "priority_encoder_4to2",
        title: "4-to-2 Priority Encoder",
        description: "Encodes highest-order active input into 2-bit binary code with Valid indicator.",
        inputs: ["D3", "D2", "D1", "D0"],
        outputs: ["Y1", "Y0", "Valid (V)"],
        evaluate: (inp) => {
            if (inp.D3 === 1) return { "Y1": 1, "Y0": 1, "Valid (V)": 1 };
            if (inp.D2 === 1) return { "Y1": 1, "Y0": 0, "Valid (V)": 1 };
            if (inp.D1 === 1) return { "Y1": 0, "Y0": 1, "Valid (V)": 1 };
            if (inp.D0 === 1) return { "Y1": 0, "Y0": 0, "Valid (V)": 1 };
            return { "Y1": 0, "Y0": 0, "Valid (V)": 0 };
        },
        truthTable: [
            { inputs: [0, 0, 0, 0], outputs: [0, 0, 0] },
            { inputs: [0, 0, 0, 1], outputs: [0, 0, 1] },
            { inputs: [0, 0, 1, 0], outputs: [0, 1, 1] },
            { inputs: [0, 1, 0, 0], outputs: [1, 0, 1] },
            { inputs: [1, 0, 0, 0], outputs: [1, 1, 1] }
        ],
        expressions: [
            { output: "Y1", formula: "D3 + D2" },
            { output: "Y0", formula: "D3 + D2'·D1" },
            { output: "Valid (V)", formula: "D3 + D2 + D1 + D0" }
        ],
        renderSchematic: (inp, out) => {
            return `
                <svg width="640" height="280" viewBox="0 0 640 280" class="circuit-svg">
                    <rect x="220" y="30" width="180" height="220" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
                    <text x="310" y="130" text-anchor="middle" font-weight="800" font-size="16" fill="var(--text-primary)">4:2 Encoder</text>
                    <text x="310" y="152" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">Priority Tree</text>

                    ${[3,2,1,0].map((d, i) => {
                        const isHigh = (inp as any)[`D${d}`] === 1;
                        const yPos = 60 + i * 45;
                        return `
                            ${wireHopH(50, 220, yPos, [], isHigh)}
                            <text x="25" y="${yPos + 5}" font-weight="800" font-size="14" fill="var(--text-primary)">D${d}</text>
                        `;
                    }).join("")}

                    ${wireHopH(400, 520, 80, [], out.Y1)}
                    <text x="540" y="85" font-weight="800" font-size="14" fill="var(--text-primary)">Y1 = ${out.Y1}</text>
                    ${wireHopH(400, 520, 140, [], out.Y0)}
                    <text x="540" y="145" font-weight="800" font-size="14" fill="var(--text-primary)">Y0 = ${out.Y0}</text>
                    ${wireHopH(400, 520, 200, [], out["Valid (V)"])}
                    <text x="540" y="205" font-weight="800" font-size="14" fill="var(--text-primary)">V = ${out["Valid (V)"]}</text>
                </svg>
            `;
        },
        verilogModule: `module priority_encoder_4to2 (
    input  wire [3:0] D,
    output reg  [1:0] Y,
    output wire       Valid
);
    assign Valid = |D;
    always @(*) begin
        if (D[3])      Y = 2'b11;
        else if (D[2]) Y = 2'b10;
        else if (D[1]) Y = 2'b01;
        else           Y = 2'b00;
    end
endmodule`
    }

export const priority_encoder_8to3: CircuitDefinition = {
        id: "priority_encoder_8to3",
        title: "8-to-3 Priority Encoder",
        description: "Encodes 8 request inputs into 3-bit binary code with Valid indicator.",
        inputs: ["D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"],
        outputs: ["Y2", "Y1", "Y0", "Valid"],
        evaluate: (inp) => {
            for (let i = 7; i >= 0; i--) {
                if ((inp as any)[`D${i}`] === 1) {
                    return {
                        "Y2": (i >> 2) & 1,
                        "Y1": (i >> 1) & 1,
                        "Y0": i & 1,
                        "Valid": 1
                    };
                }
            }
            return { "Y2": 0, "Y1": 0, "Y0": 0, "Valid": 0 };
        },
        truthTable: [
            { inputs: [1,0,0,0, 0,0,0,0], outputs: [1, 1, 1, 1] },
            { inputs: [0,1,0,0, 0,0,0,0], outputs: [1, 1, 0, 1] },
            { inputs: [0,0,0,0, 0,0,1,0], outputs: [0, 0, 1, 1] },
            { inputs: [0,0,0,0, 0,0,0,0], outputs: [0, 0, 0, 0] }
        ],
        expressions: [{ output: "Y2..Y0", formula: "Priority Encoded MSB to LSB" }],
        renderSchematic: (inp, out) => {
            return `
                <svg width="720" height="340" viewBox="0 0 720 340" class="circuit-svg">
                    <rect x="240" y="20" width="200" height="300" rx="14" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
                    <text x="340" y="160" text-anchor="middle" font-weight="800" font-size="17" fill="var(--text-primary)">8:3 Encoder</text>
                    <text x="340" y="185" text-anchor="middle" font-size="12" font-weight="700" fill="var(--text-muted)">Priority Logic</text>

                    ${[7,6,5,4,3,2,1,0].map((d, i) => {
                        const isHigh = (inp as any)[`D${d}`] === 1;
                        const yPos = 38 + i * 36;
                        return `
                            ${wireHopH(50, 240, yPos, [], isHigh)}
                            <text x="25" y="${yPos + 4}" font-weight="800" font-size="12" fill="var(--text-primary)">D${d}</text>
                        `;
                    }).join("")}

                    ${wireHopH(440, 580, 80, [], out.Y2)}
                    <text x="600" y="85" font-weight="800" font-size="14" fill="var(--text-primary)">Y2 = ${out.Y2}</text>
                    ${wireHopH(440, 580, 140, [], out.Y1)}
                    <text x="600" y="145" font-weight="800" font-size="14" fill="var(--text-primary)">Y1 = ${out.Y1}</text>
                    ${wireHopH(440, 580, 200, [], out.Y0)}
                    <text x="600" y="205" font-weight="800" font-size="14" fill="var(--text-primary)">Y0 = ${out.Y0}</text>
                    ${wireHopH(440, 580, 260, [], out.Valid)}
                    <text x="600" y="265" font-weight="800" font-size="14" fill="var(--text-primary)">V = ${out.Valid}</text>
                </svg>
            `;
        },
        verilogModule: `module priority_encoder_8to3 (
    input  wire [7:0] D,
    output reg  [2:0] Y,
    output wire       Valid
);
    assign Valid = |D;
    always @(*) begin
        if (D[7])      Y = 3'b111;
        else if (D[6]) Y = 3'b110;
        else if (D[5]) Y = 3'b101;
        else if (D[4]) Y = 3'b100;
        else if (D[3]) Y = 3'b011;
        else if (D[2]) Y = 3'b010;
        else if (D[1]) Y = 3'b001;
        else           Y = 3'b000;
    end
endmodule`
    }
