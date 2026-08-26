import type { CircuitDefinition } from "../types";
import {
    wireHopH, wireV, dot,
    gateXOR, gateAND, gateOR, gateNOT,
    gateNAND, gateNOR, gateXNOR,
} from "../gates";

export const half_adder: CircuitDefinition = {
        id: "half_adder",
        title: "Half Adder",
        description: "Adds two 1-bit binary inputs (A, B) producing Sum and Carry outputs.",
        inputs: ["A", "B"],
        outputs: ["Sum (S)", "Carry (C)"],
        evaluate: (inp) => {
            const sum = inp.A ^ inp.B;
            const carry = inp.A & inp.B;
            return { "Sum (S)": sum, "Carry (C)": carry };
        },
        truthTable: [
            { inputs: [0, 0], outputs: [0, 0] },
            { inputs: [0, 1], outputs: [1, 0] },
            { inputs: [1, 0], outputs: [1, 0] },
            { inputs: [1, 1], outputs: [0, 1] }
        ],
        expressions: [
            { output: "Sum (S)", formula: "A ⊕ B" },
            { output: "Carry (C)", formula: "A · B" }
        ],
        renderSchematic: (inp, out) => {
            const a = inp.A, b = inp.B, s = out["Sum (S)"], c = out["Carry (C)"];
            return `
                <svg width="600" height="240" viewBox="0 0 600 240" class="circuit-svg">
                    <!-- Gates -->
                    ${gateXOR(260, 40)}
                    ${gateAND(260, 140)}

                    <!-- Input A Leads -->
                    ${wireHopH(40, 258, 50, [], a)}
                    ${dot(110, 50, a)}
                    ${wireV(110, 50, 150, a)}
                    ${wireHopH(110, 260, 150, [180], a)}

                    <!-- Input B Leads -->
                    ${wireHopH(40, 260, 170, [], b)}
                    ${dot(180, 170, b)}
                    ${wireV(180, 70, 170, b)}
                    ${wireHopH(180, 258, 70, [], b)}

                    <!-- Outputs -->
                    ${wireHopH(320, 490, 60, [], s)}
                    ${wireHopH(310, 490, 160, [], c)}

                    <!-- Pin Labels -->
                    <text x="20" y="55" font-weight="800" font-size="14" fill="var(--text-primary)">A</text>
                    <text x="20" y="175" font-weight="800" font-size="14" fill="var(--text-primary)">B</text>
                    <text x="510" y="65" font-weight="800" font-size="14" fill="var(--text-primary)">Sum = ${s}</text>
                    <text x="510" y="165" font-weight="800" font-size="14" fill="var(--text-primary)">Carry = ${c}</text>
                </svg>
            `;
        },
        verilogModule: `module half_adder (
    input  wire A,
    input  wire B,
    output wire Sum,
    output wire Carry
);
    assign Sum   = A ^ B;
    assign Carry = A & B;
endmodule`
    }

export const full_adder: CircuitDefinition = {
        id: "full_adder",
        title: "Full Adder",
        description: "Adds three 1-bit inputs: A, B, and Carry In (Cin), producing Sum and Carry Out (Cout).",
        inputs: ["A", "B", "Cin"],
        outputs: ["Sum (S)", "Cout"],
        evaluate: (inp) => {
            const sum = inp.A ^ inp.B ^ inp.Cin;
            const cout = (inp.A & inp.B) | (inp.B & inp.Cin) | (inp.A & inp.Cin);
            return { "Sum (S)": sum, "Cout": cout };
        },
        truthTable: [
            { inputs: [0, 0, 0], outputs: [0, 0] },
            { inputs: [0, 0, 1], outputs: [1, 0] },
            { inputs: [0, 1, 0], outputs: [1, 0] },
            { inputs: [0, 1, 1], outputs: [0, 1] },
            { inputs: [1, 0, 0], outputs: [1, 0] },
            { inputs: [1, 0, 1], outputs: [0, 1] },
            { inputs: [1, 1, 0], outputs: [0, 1] },
            { inputs: [1, 1, 1], outputs: [1, 1] }
        ],
        expressions: [
            { output: "Sum (S)", formula: "A ⊕ B ⊕ Cin" },
            { output: "Cout", formula: "A·B + Cin·(A ⊕ B)" }
        ],
        renderSchematic: (inp, out) => {
            const a = inp.A, b = inp.B, cin = inp.Cin;
            const axorb = a ^ b;
            const aandb = a & b;
            const axorb_cin = axorb & cin;
            const s = out["Sum (S)"], cout = out["Cout"];
            return `
                <svg width="720" height="280" viewBox="0 0 720 280" class="circuit-svg">
                    <!-- Gates -->
                    ${gateXOR(190, 40, "XOR1")}
                    ${gateAND(190, 115, "AND1")}
                    ${gateXOR(370, 45, "XOR2")}
                    ${gateAND(370, 125, "AND2")}
                    ${gateOR(530, 155, "OR")}

                    <!-- Stage 1 Inputs: A & B -->
                    ${wireHopH(40, 188, 50, [], a)}
                    ${dot(90, 50, a)}
                    ${wireV(90, 50, 125, a)}
                    ${wireHopH(90, 190, 125, [140], a)}

                    ${wireHopH(40, 140, 90, [], b)}
                    ${dot(140, 90, b)}
                    ${wireV(140, 70, 145, b)}
                    ${wireHopH(140, 188, 70, [], b)}
                    ${wireHopH(140, 190, 145, [], b)}

                    <!-- Intermediate XOR1 Out (A ⊕ B) -->
                    ${wireHopH(250, 368, 60, [], axorb)}
                    ${dot(280, 60, axorb)}
                    ${wireV(280, 60, 135, axorb)}
                    ${wireHopH(280, 370, 135, [330], axorb)}

                    <!-- Intermediate AND1 Out (A · B) -->
                    ${wireHopH(240, 300, 135, [], aandb)}
                    ${wireV(300, 135, 185, aandb)}
                    ${wireHopH(300, 530, 185, [330], aandb)}

                    <!-- Input Cin -->
                    ${wireHopH(40, 330, 230, [], cin)}
                    ${wireV(330, 75, 230, cin)}
                    ${wireHopH(330, 368, 75, [], cin)}
                    ${dot(330, 155, cin)}
                    ${wireHopH(330, 370, 155, [], cin)}

                    <!-- Intermediate AND2 Out -->
                    ${wireHopH(420, 480, 145, [], axorb_cin)}
                    ${wireV(480, 145, 165, axorb_cin)}
                    ${wireHopH(480, 530, 165, [], axorb_cin)}

                    <!-- Final Outputs -->
                    ${wireHopH(430, 630, 65, [], s)}
                    ${wireHopH(586, 630, 175, [], cout)}

                    <!-- Labels -->
                    <text x="20" y="55" font-weight="800" font-size="14" fill="var(--text-primary)">A</text>
                    <text x="20" y="95" font-weight="800" font-size="14" fill="var(--text-primary)">B</text>
                    <text x="15" y="235" font-weight="800" font-size="14" fill="var(--text-primary)">Cin</text>
                    <text x="645" y="70" font-weight="800" font-size="14" fill="var(--text-primary)">Sum = ${s}</text>
                    <text x="645" y="180" font-weight="800" font-size="14" fill="var(--text-primary)">Cout = ${cout}</text>
                </svg>
            `;
        },
        verilogModule: `module full_adder (
    input  wire A,
    input  wire B,
    input  wire Cin,
    output wire Sum,
    output wire Cout
);
    assign Sum  = A ^ B ^ Cin;
    assign Cout = (A & B) | (B & Cin) | (A & Cin);
endmodule`
    }

export const ripple_carry_adder_4bit: CircuitDefinition = {
        id: "ripple_carry_adder_4bit",
        title: "4-Bit Ripple Carry Adder",
        description: "Cascaded 4 Full Adders where the carry propagates sequentially from Stage 0 to Stage 3.",
        inputs: ["A3", "A2", "A1", "A0", "B3", "B2", "B1", "B0", "Cin"],
        outputs: ["S3", "S2", "S1", "S0", "Cout"],
        evaluate: (inp) => {
            const a = (inp.A3 << 3) | (inp.A2 << 2) | (inp.A1 << 1) | inp.A0;
            const b = (inp.B3 << 3) | (inp.B2 << 2) | (inp.B1 << 1) | inp.B0;
            const total = a + b + inp.Cin;
            return {
                "S0": total & 1,
                "S1": (total >> 1) & 1,
                "S2": (total >> 2) & 1,
                "S3": (total >> 3) & 1,
                "Cout": (total >> 4) & 1
            };
        },
        truthTable: [
            { inputs: [0,0,0,0, 0,0,0,0, 0], outputs: [0,0,0,0, 0] },
            { inputs: [0,1,0,1, 0,0,1,1, 0], outputs: [1,0,0,0, 0] },
            { inputs: [1,1,1,1, 0,0,0,1, 0], outputs: [0,0,0,0, 1] },
            { inputs: [1,0,1,0, 0,1,0,1, 1], outputs: [0,0,0,0, 1] }
        ],
        expressions: [
            { output: "Si", formula: "Ai ⊕ Bi ⊕ Ci" },
            { output: "Ci+1", formula: "Ai·Bi + Ci·(Ai ⊕ Bi)" }
        ],
        renderSchematic: (inp, out, rippleStage = -1) => {
            const c0 = inp.Cin;
            const c1 = (inp.A0 & inp.B0) | (c0 & (inp.A0 ^ inp.B0));
            const c2 = (inp.A1 & inp.B1) | (c1 & (inp.A1 ^ inp.B1));
            const c3 = (inp.A2 & inp.B2) | (c2 & (inp.A2 ^ inp.B2));
            const cout = out.Cout;

            const stages = [
                { id: 0, a: inp.A0, b: inp.B0, cin: c0, s: out.S0, cout: c1, x: 590 },
                { id: 1, a: inp.A1, b: inp.B1, cin: c1, s: out.S1, cout: c2, x: 430 },
                { id: 2, a: inp.A2, b: inp.B2, cin: c2, s: out.S2, cout: c3, x: 270 },
                { id: 3, a: inp.A3, b: inp.B3, cin: c3, s: out.S3, cout: cout, x: 110 }
            ];

            let svg = `<svg width="780" height="270" viewBox="0 0 780 270" class="circuit-svg">`;
            stages.forEach((st, idx) => {
                const isRipple = rippleStage === idx;
                const strokeCol = isRipple ? "#f59e0b" : "var(--border-hover)";
                const strokeW = isRipple ? "3.5" : "2";

                svg += `
                    <g transform="translate(${st.x}, 50)">
                        <rect width="110" height="130" rx="12" fill="var(--bg-card-alt)" stroke="${strokeCol}" stroke-width="${strokeW}" />
                        <text x="55" y="35" text-anchor="middle" font-weight="800" font-size="14" fill="var(--text-primary)">FA ${st.id}</text>
                        <text x="55" y="60" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">A${st.id}=${st.a} B${st.id}=${st.b}</text>
                        <text x="55" y="80" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">Cin=${st.cin}</text>
                        <text x="55" y="108" text-anchor="middle" font-weight="800" font-size="13" fill="var(--accent-secondary)">S${st.id}=${st.s}</text>
                    </g>
                    <!-- Inputs Top -->
                    ${wireV(st.x + 35, 15, 50, st.a)}
                    <text x="${st.x + 35}" y="12" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">A${st.id}</text>
                    ${wireV(st.x + 75, 15, 50, st.b)}
                    <text x="${st.x + 75}" y="12" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">B${st.id}</text>

                    <!-- Sum line Bottom -->
                    ${wireV(st.x + 55, 180, 230, st.s)}
                    <text x="${st.x + 55}" y="248" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">S${st.id} = ${st.s}</text>
                `;

                if (idx < 3) {
                    const nextX = stages[idx + 1].x;
                    const carryVal = st.cout;
                    const isCarryActive = carryVal === 1;
                    const rippleCls = (rippleStage === idx + 1) ? "wire-ripple-active" : (isCarryActive ? "wire-active" : "wire-inactive");
                    svg += `
                        <line x1="${st.x}" y1="115" x2="${nextX + 110}" y2="115" class="${rippleCls}" stroke-width="2.5" />
                        <text x="${(st.x + nextX + 110) / 2}" y="105" text-anchor="middle" font-size="11" font-weight="750" fill="var(--text-muted)">C${st.id + 1}=${carryVal}</text>
                    `;
                }
            });

            // Final Cout & Initial Cin
            svg += `
                ${wireHopH(700, 760, 115, [], c0)}
                <text x="765" y="120" font-weight="800" font-size="13" fill="var(--text-primary)">Cin</text>
                ${wireHopH(40, 110, 115, [], cout)}
                <text x="10" y="120" font-weight="800" font-size="13" fill="var(--text-primary)">Cout</text>
            `;
            svg += `</svg>`;
            return svg;
        },
        verilogModule: `module ripple_carry_adder_4bit (
    input  wire [3:0] A,
    input  wire [3:0] B,
    input  wire       Cin,
    output wire [3:0] Sum,
    output wire       Cout
);
    wire [4:0] full_sum = A + B + Cin;
    assign Sum  = full_sum[3:0];
    assign Cout = full_sum[4];
endmodule`
    }
