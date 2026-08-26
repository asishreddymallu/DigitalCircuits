import type { CircuitDefinition } from "../types";
import {
    wireHopH, wireV, dot,
    gateXOR, gateAND, gateOR, gateNOT,
    gateNAND, gateNOR, gateXNOR,
} from "../gates";

export const half_subtractor: CircuitDefinition = {
        id: "half_subtractor",
        title: "Half Subtractor",
        description: "Subtracts 1-bit input B from A, producing Difference (D) and Borrow (Bout).",
        inputs: ["A", "B"],
        outputs: ["Diff (D)", "Borrow (Bout)"],
        evaluate: (inp) => {
            const diff = inp.A ^ inp.B;
            const bout = (1 - inp.A) & inp.B;
            return { "Diff (D)": diff, "Borrow (Bout)": bout };
        },
        truthTable: [
            { inputs: [0, 0], outputs: [0, 0] },
            { inputs: [0, 1], outputs: [1, 1] },
            { inputs: [1, 0], outputs: [1, 0] },
            { inputs: [1, 1], outputs: [0, 0] }
        ],
        expressions: [
            { output: "Diff (D)", formula: "A ⊕ B" },
            { output: "Borrow (Bout)", formula: "A' · B" }
        ],
        renderSchematic: (inp, out) => {
            const a = inp.A, b = inp.B, d = out["Diff (D)"], bo = out["Borrow (Bout)"];
            const notA = 1 - a;
            return `
                <svg width="600" height="240" viewBox="0 0 600 240" class="circuit-svg">
                    <!-- Gates -->
                    ${gateXOR(260, 40, "XOR")}
                    ${gateNOT(130, 138)}
                    ${gateAND(260, 140, "AND")}

                    <!-- Input A -->
                    ${wireHopH(40, 258, 50, [], a)}
                    ${dot(90, 50, a)}
                    ${wireV(90, 50, 150, a)}
                    ${wireHopH(90, 130, 150, [], a)}

                    <!-- Inverter Output -->
                    ${wireHopH(165, 260, 150, [200], notA)}

                    <!-- Input B -->
                    ${wireHopH(40, 260, 170, [], b)}
                    ${dot(200, 170, b)}
                    ${wireV(200, 70, 170, b)}
                    ${wireHopH(200, 258, 70, [], b)}

                    <!-- Outputs -->
                    ${wireHopH(320, 490, 60, [], d)}
                    ${wireHopH(310, 490, 160, [], bo)}

                    <text x="20" y="55" font-weight="800" font-size="14" fill="var(--text-primary)">A</text>
                    <text x="20" y="175" font-weight="800" font-size="14" fill="var(--text-primary)">B</text>
                    <text x="510" y="65" font-weight="800" font-size="14" fill="var(--text-primary)">Diff = ${d}</text>
                    <text x="510" y="165" font-weight="800" font-size="14" fill="var(--text-primary)">Bout = ${bo}</text>
                </svg>
            `;
        },
        verilogModule: `module half_subtractor (
    input  wire A,
    input  wire B,
    output wire Diff,
    output wire Bout
);
    assign Diff = A ^ B;
    assign Bout = (~A) & B;
endmodule`
    }

export const full_subtractor: CircuitDefinition = {
        id: "full_subtractor",
        title: "Full Subtractor",
        description: "Calculates difference of 3 bits: A, B, and Bin, producing Difference and Bout.",
        inputs: ["A", "B", "Bin"],
        outputs: ["Diff (D)", "Bout"],
        evaluate: (inp) => {
            const diff = inp.A ^ inp.B ^ inp.Bin;
            const bout = ((1 - inp.A) & inp.B) | ((1 - (inp.A ^ inp.B)) & inp.Bin);
            return { "Diff (D)": diff, "Bout": bout };
        },
        truthTable: [
            { inputs: [0, 0, 0], outputs: [0, 0] },
            { inputs: [0, 0, 1], outputs: [1, 1] },
            { inputs: [0, 1, 0], outputs: [1, 1] },
            { inputs: [0, 1, 1], outputs: [0, 1] },
            { inputs: [1, 0, 0], outputs: [1, 0] },
            { inputs: [1, 0, 1], outputs: [0, 0] },
            { inputs: [1, 1, 0], outputs: [0, 0] },
            { inputs: [1, 1, 1], outputs: [1, 1] }
        ],
        expressions: [
            { output: "Diff (D)", formula: "A ⊕ B ⊕ Bin" },
            { output: "Bout", formula: "A'·B + Bin·(A ⊕ B)'" }
        ],
        renderSchematic: (inp, out) => {
            const a = inp.A, b = inp.B, bin = inp.Bin;
            const notA = 1 - a;
            const d1 = a ^ b;
            const notD1 = 1 - d1;
            const b1 = notA & b;
            const b2 = notD1 & bin;
            const d = out["Diff (D)"], bout = out["Bout"];
            return `
                <svg width="740" height="280" viewBox="0 0 740 280" class="circuit-svg">
                    <!-- Gates -->
                    ${gateXOR(200, 40, "XOR1")}
                    ${gateNOT(110, 118)}
                    ${gateAND(200, 120, "AND1")}
                    ${gateXOR(380, 45, "XOR2")}
                    ${gateNOT(290, 128)}
                    ${gateAND(380, 130, "AND2")}
                    ${gateOR(540, 155, "OR")}

                    <!-- Input A -->
                    ${wireHopH(40, 198, 50, [], a)}
                    ${dot(80, 50, a)}
                    ${wireV(80, 50, 130, a)}
                    ${wireHopH(80, 110, 130, [], a)}

                    <!-- NOT1 to AND1 -->
                    ${wireHopH(145, 200, 130, [], notA)}

                    <!-- Input B -->
                    ${wireHopH(40, 160, 90, [], b)}
                    ${dot(160, 90, b)}
                    ${wireV(160, 70, 150, b)}
                    ${wireHopH(160, 198, 70, [], b)}
                    ${wireHopH(160, 200, 150, [], b)}

                    <!-- Intermediate XOR1 Out (D1) -->
                    ${wireHopH(260, 378, 60, [], d1)}
                    ${dot(275, 60, d1)}
                    ${wireV(275, 60, 140, d1)}
                    ${wireHopH(275, 290, 140, [], d1)}
                    ${wireHopH(325, 380, 140, [340], notD1)}

                    <!-- Input Bin -->
                    ${wireHopH(40, 340, 230, [], bin)}
                    ${wireV(340, 75, 230, bin)}
                    ${wireHopH(340, 378, 75, [], bin)}
                    ${dot(340, 160, bin)}
                    ${wireHopH(340, 380, 160, [], bin)}

                    <!-- AND1 Out (B1) -->
                    ${wireHopH(250, 310, 140, [], b1)}
                    ${wireV(310, 140, 185, b1)}
                    ${wireHopH(310, 540, 185, [340], b1)}

                    <!-- AND2 Out (B2) -->
                    ${wireHopH(430, 490, 150, [], b2)}
                    ${wireV(490, 150, 165, b2)}
                    ${wireHopH(490, 540, 165, [], b2)}

                    <!-- Final Outputs -->
                    ${wireHopH(440, 650, 65, [], d)}
                    ${wireHopH(596, 650, 175, [], bout)}

                    <text x="20" y="55" font-weight="800" font-size="14" fill="var(--text-primary)">A</text>
                    <text x="20" y="95" font-weight="800" font-size="14" fill="var(--text-primary)">B</text>
                    <text x="15" y="235" font-weight="800" font-size="14" fill="var(--text-primary)">Bin</text>
                    <text x="665" y="70" font-weight="800" font-size="14" fill="var(--text-primary)">Diff = ${d}</text>
                    <text x="665" y="180" font-weight="800" font-size="14" fill="var(--text-primary)">Bout = ${bout}</text>
                </svg>
            `;
        },
        verilogModule: `module full_subtractor (
    input  wire A,
    input  wire B,
    input  wire Bin,
    output wire Diff,
    output wire Bout
);
    assign Diff = A ^ B ^ Bin;
    assign Bout = ((~A) & B) | (~(A ^ B) & Bin);
endmodule`
    }

export const subtractor_4bit: CircuitDefinition = {
        id: "subtractor_4bit",
        title: "4-Bit Ripple Borrow Subtractor",
        description: "Cascaded 4 Full Subtractors subtracting 4-bit word B from A with borrow propagation.",
        inputs: ["A3", "A2", "A1", "A0", "B3", "B2", "B1", "B0", "Bin"],
        outputs: ["D3", "D2", "D1", "D0", "Bout"],
        evaluate: (inp) => {
            const a = (inp.A3 << 3) | (inp.A2 << 2) | (inp.A1 << 1) | inp.A0;
            const b = (inp.B3 << 3) | (inp.B2 << 2) | (inp.B1 << 1) | inp.B0;
            const diff = (a - b - inp.Bin) & 0x1F;
            return {
                "D0": diff & 1,
                "D1": (diff >> 1) & 1,
                "D2": (diff >> 2) & 1,
                "D3": (diff >> 3) & 1,
                "Bout": (diff >> 4) & 1
            };
        },
        truthTable: [
            { inputs: [0,0,0,0, 0,0,0,0, 0], outputs: [0,0,0,0, 0] },
            { inputs: [1,0,0,0, 0,0,1,1, 0], outputs: [0,1,0,1, 0] },
            { inputs: [0,0,1,1, 0,1,0,0, 0], outputs: [1,1,1,1, 1] }
        ],
        expressions: [
            { output: "Di", formula: "Ai ⊕ Bi ⊕ Bi_in" },
            { output: "Bi_out", formula: "Ai'·Bi + Bi_in·(Ai ⊕ Bi)'" }
        ],
        renderSchematic: (inp, out) => {
            const b0 = inp.Bin;
            const b1 = ((1 - inp.A0) & inp.B0) | ((1 - (inp.A0 ^ inp.B0)) & b0);
            const b2 = ((1 - inp.A1) & inp.B1) | ((1 - (inp.A1 ^ inp.B1)) & b1);
            const b3 = ((1 - inp.A2) & inp.B2) | ((1 - (inp.A2 ^ inp.B2)) & b2);
            const bout = out.Bout;

            const stages = [
                { id: 0, a: inp.A0, b: inp.B0, bin: b0, d: out.D0, bout: b1, x: 590 },
                { id: 1, a: inp.A1, b: inp.B1, bin: b1, d: out.D1, bout: b2, x: 430 },
                { id: 2, a: inp.A2, b: inp.B2, bin: b2, d: out.D2, bout: b3, x: 270 },
                { id: 3, a: inp.A3, b: inp.B3, bin: b3, d: out.D3, bout: bout, x: 110 }
            ];

            let svg = `<svg width="780" height="270" viewBox="0 0 780 270" class="circuit-svg">`;
            stages.forEach((st, idx) => {
                svg += `
                    <g transform="translate(${st.x}, 50)">
                        <rect width="110" height="130" rx="12" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2" />
                        <text x="55" y="35" text-anchor="middle" font-weight="800" font-size="14" fill="var(--text-primary)">FS ${st.id}</text>
                        <text x="55" y="60" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">A${st.id}=${st.a} B${st.id}=${st.b}</text>
                        <text x="55" y="80" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-muted)">Bin=${st.bin}</text>
                        <text x="55" y="108" text-anchor="middle" font-weight="800" font-size="13" fill="var(--accent-secondary)">D${st.id}=${st.d}</text>
                    </g>
                    ${wireV(st.x + 35, 15, 50, st.a)}
                    <text x="${st.x + 35}" y="12" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">A${st.id}</text>
                    ${wireV(st.x + 75, 15, 50, st.b)}
                    <text x="${st.x + 75}" y="12" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">B${st.id}</text>

                    ${wireV(st.x + 55, 180, 230, st.d)}
                    <text x="${st.x + 55}" y="248" text-anchor="middle" font-weight="800" font-size="13" fill="var(--text-primary)">D${st.id} = ${st.d}</text>
                `;

                if (idx < 3) {
                    const nextX = stages[idx + 1].x;
                    svg += `
                        <line x1="${st.x}" y1="115" x2="${nextX + 110}" y2="115" class="${st.bout ? "wire-active" : "wire-inactive"}" stroke-width="2.2" />
                        <text x="${(st.x + nextX + 110) / 2}" y="105" text-anchor="middle" font-size="11" font-weight="750" fill="var(--text-muted)">B${st.id + 1}=${st.bout}</text>
                    `;
                }
            });

            svg += `
                ${wireHopH(700, 760, 115, [], b0)}
                <text x="765" y="120" font-weight="800" font-size="13" fill="var(--text-primary)">Bin</text>
                ${wireHopH(40, 110, 115, [], bout)}
                <text x="10" y="120" font-weight="800" font-size="13" fill="var(--text-primary)">Bout</text>
            `;
            svg += `</svg>`;
            return svg;
        },
        verilogModule: `module subtractor_4bit (
    input  wire [3:0] A,
    input  wire [3:0] B,
    input  wire       Bin,
    output wire [3:0] Diff,
    output wire       Bout
);
    wire [4:0] full_diff = A - B - Bin;
    assign Diff = full_diff[3:0];
    assign Bout = full_diff[4];
endmodule`
    }
