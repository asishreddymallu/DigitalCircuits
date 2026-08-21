/* =========================================================
   DIGITAL CIRCUITS SIMULATOR - COMPLETE STUDIO ENGINE
   - 6 Categories & 18 Circuits
   - Live wire signal evaluation (Active High = Neon Green)
   - Step-by-step carry ripple animation with visual glow
   - Real-Time Logic Analyzer (Timing Diagram) Canvas
   - Synthesizable Verilog HDL Export
   - Full Vector Zoom & Pan Engine & Studio Sound FX
   - Zero-Overlap Manhattan Wires with Broken-Line Jump Transitions
========================================================= */

interface Window {
    StudioFX?: any;
    toggleSiteTheme?: () => void;
    toggleSiteSound?: () => void;
}

interface CircuitDefinition {
    id: string;
    title: string;
    description: string;
    inputs: string[];
    outputs: string[];
    evaluate: (inputs: Record<string, number>) => Record<string, number>;
    truthTable: { inputs: number[]; outputs: number[] }[];
    expressions: { output: string; formula: string }[];
    renderSchematic: (inputs: Record<string, number>, outputs: Record<string, number>, rippleStage?: number) => string;
    verilogModule: string;
}

/* =========================================================
   SCHEMATIC VECTOR HELPERS WITH WIRE JUMP HOPS
========================================================= */

function wireHopH(x1: number, x2: number, y: number, crossXs: number[], isHigh: boolean | number): string {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const isLtoR = x1 <= x2;
    const cls = isHigh ? "wire-active" : "wire-inactive";
    const valid = crossXs.filter(cx => cx > minX + 8 && cx < maxX - 8).sort((a, b) => isLtoR ? a - b : b - a);
    if (valid.length === 0) {
        return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="${cls}" stroke-width="2.2" fill="none" />`;
    }
    let d = `M ${x1} ${y}`;
    valid.forEach(cx => {
        if (isLtoR) {
            d += ` H ${cx - 7} A 7 7 0 0 1 ${cx + 7} ${y}`;
        } else {
            d += ` H ${cx + 7} A 7 7 0 0 1 ${cx - 7} ${y}`;
        }
    });
    d += ` H ${x2}`;
    return `<path d="${d}" class="${cls}" stroke-width="2.2" fill="none" />`;
}

function wireV(x: number, y1: number, y2: number, isHigh: boolean | number): string {
    const cls = isHigh ? "wire-active" : "wire-inactive";
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="${cls}" stroke-width="2.2" fill="none" />`;
}

function dot(cx: number, cy: number, isHigh: boolean | number): string {
    const col = isHigh ? "var(--wire-high)" : "var(--wire-low)";
    return `<circle cx="${cx}" cy="${cy}" r="3.8" class="circuit-junction" fill="${col}" />`;
}

function gateXOR(x: number, y: number, label = "XOR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 6 0 Q 18 20 6 40 Q 36 40 60 20 Q 36 0 6 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <path d="M -2 0 Q 10 20 -2 40" fill="none" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="26" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

function gateAND(x: number, y: number, label = "AND"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 h 30 a 20 20 0 0 1 0 40 h -30 z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="22" y="25" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

function gateOR(x: number, y: number, label = "OR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 Q 14 20 0 40 Q 32 40 56 20 Q 32 0 0 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="24" y="24" text-anchor="middle" font-size="11" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

function gateNOT(x: number, y: number): string {
    return `
        <g transform="translate(${x}, ${y})">
            <polygon points="0,0 26,12 0,24" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="31" cy="12" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
        </g>
    `;
}

function gateNAND(x: number, y: number, label = "NAND"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 h 30 a 20 20 0 0 1 0 40 h -30 z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="55" cy="20" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="20" y="25" text-anchor="middle" font-size="10" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

function gateNOR(x: number, y: number, label = "NOR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 0 0 Q 14 20 0 40 Q 32 40 56 20 Q 32 0 0 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="61" cy="20" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="22" y="24" text-anchor="middle" font-size="10" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

function gateXNOR(x: number, y: number, label = "XNOR"): string {
    return `
        <g transform="translate(${x}, ${y})">
            <path d="M 6 0 Q 18 20 6 40 Q 36 40 60 20 Q 36 0 6 0 Z" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <path d="M -2 0 Q 10 20 -2 40" fill="none" stroke="var(--border-hover)" stroke-width="2.2" />
            <circle cx="65" cy="20" r="4" fill="var(--bg-card-alt)" stroke="var(--border-hover)" stroke-width="2.2" />
            <text x="24" y="24" text-anchor="middle" font-size="10" font-weight="800" fill="var(--text-primary)">${label}</text>
        </g>
    `;
}

/* =========================================================
   CIRCUIT REPOSITORY (18 CIRCUITS)
========================================================= */

const CIRCUITS: Record<string, CircuitDefinition> = {
    // 1. ADDERS
    half_adder: {
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
    },

    full_adder: {
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
    },

    ripple_carry_adder_4bit: {
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
    },

    // 2. SUBTRACTORS
    half_subtractor: {
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
    },

    full_subtractor: {
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
    },

    subtractor_4bit: {
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
    },

    // 3. MULTIPLEXERS
    mux_2to1: {
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
    },

    mux_4to1: {
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
    },

    mux_8to1: {
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
    },

    // 4. DEMULTIPLEXERS
    demux_1to2: {
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
    },

    demux_1to4: {
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
    },

    demux_1to8: {
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
    },

    // 5. DECODERS & ENCODERS
    decoder_2to4: {
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
    },

    decoder_3to8: {
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
    },

    priority_encoder_4to2: {
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
    },

    priority_encoder_8to3: {
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
    },

    // 6. COMPARATORS
    comparator_1bit: {
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
    },

    comparator_2bit: {
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
};

/* =========================================================
   CATEGORY DEFINITIONS
========================================================= */

const CATEGORIES: Record<string, { title: string; circuits: string[] }> = {
    adders: {
        title: "Adders",
        circuits: ["half_adder", "full_adder", "ripple_carry_adder_4bit"]
    },
    subtractors: {
        title: "Subtractors",
        circuits: ["half_subtractor", "full_subtractor", "subtractor_4bit"]
    },
    multiplexers: {
        title: "Multiplexers (MUX)",
        circuits: ["mux_2to1", "mux_4to1", "mux_8to1"]
    },
    demultiplexers: {
        title: "Demultiplexers (DEMUX)",
        circuits: ["demux_1to2", "demux_1to4", "demux_1to8"]
    },
    decoders_encoders: {
        title: "Decoders & Encoders",
        circuits: ["decoder_2to4", "decoder_3to8", "priority_encoder_4to2", "priority_encoder_8to3"]
    },
    comparators: {
        title: "Magnitude Comparators",
        circuits: ["comparator_1bit", "comparator_2bit"]
    }
};

/* =========================================================
   DOM ELEMENTS & STATE
========================================================= */

const step1 = document.getElementById("step1") as HTMLElement;
const step2 = document.getElementById("step2") as HTMLElement;
const step3 = document.getElementById("step3") as HTMLElement;
const step2Title = document.getElementById("step2Title") as HTMLElement;
const subcategoryGrid = document.getElementById("subcategoryGrid") as HTMLElement;
const backToStep2 = document.getElementById("backToStep2") as HTMLButtonElement;
const circuitTitle = document.getElementById("circuitTitle") as HTMLElement;
const inputControls = document.getElementById("inputControls") as HTMLElement;
const rippleControls = document.getElementById("rippleControls") as HTMLElement;
const rippleAnimateBtn = document.getElementById("rippleAnimateBtn") as HTMLButtonElement;
const rippleStepBadge = document.getElementById("rippleStepBadge") as HTMLElement;
const circuitDiagram = document.getElementById("circuitDiagram") as HTMLElement;
const truthTable = document.getElementById("truthTable") as HTMLElement;
const booleanExpressions = document.getElementById("booleanExpressions") as HTMLElement;
const verilogCode = document.getElementById("verilogCode") as HTMLElement;
const copyVerilogBtn = document.getElementById("copyVerilogBtn") as HTMLButtonElement;
const breadcrumbCategory = document.getElementById("breadcrumbCategory") as HTMLElement;
const timingCanvas = document.getElementById("timingCanvas") as HTMLCanvasElement;

const zoomInBtn = document.getElementById("zoomInBtn") as HTMLButtonElement;
const zoomOutBtn = document.getElementById("zoomOutBtn") as HTMLButtonElement;
const zoomResetBtn = document.getElementById("zoomResetBtn") as HTMLButtonElement;

let currentCategory: string | null = null;
let currentCircuit: CircuitDefinition | null = null;
let currentInputs: Record<string, number> = {};
let zoomScale = 1.0;
let panX = 0;
let panY = 0;
let isDragging = false;
let startDragX = 0;
let startDragY = 0;

// Waveform Timing History Buffer
interface WaveformPoint {
    time: number;
    signals: Record<string, number>;
}
let waveformHistory: WaveformPoint[] = [];
let waveTimeCounter = 0;

/* =========================================================
   WAVEFORM TIMING DIAGRAM ANALYZER
========================================================= */

function recordWaveformSample(): void {
    if (!currentCircuit) return;
    const outputs = currentCircuit.evaluate(currentInputs);
    const sample: Record<string, number> = { ...currentInputs, ...outputs };

    waveTimeCounter++;
    waveformHistory.push({ time: waveTimeCounter, signals: sample });
    if (waveformHistory.length > 25) {
        waveformHistory.shift();
    }
    drawTimingDiagram();
}

function drawTimingDiagram(): void {
    if (!timingCanvas || !currentCircuit || waveformHistory.length === 0) return;
    const ctx = timingCanvas.getContext("2d");
    if (!ctx) return;

    const w = timingCanvas.width;
    const h = timingCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const signalNames = [...currentCircuit.inputs, ...currentCircuit.outputs];
    const rowHeight = Math.min(32, Math.floor((h - 20) / signalNames.length));
    const startX = 120;
    const graphWidth = w - startX - 30;
    const stepX = graphWidth / Math.max(15, waveformHistory.length - 1);

    // Draw background grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = startX; x < w - 20; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 10);
        ctx.lineTo(x, h - 10);
        ctx.stroke();
    }

    signalNames.forEach((sigName, sigIdx) => {
        const topY = 15 + sigIdx * rowHeight;
        const lowY = topY + rowHeight - 8;
        const highY = topY + 4;

        // Label
        ctx.font = "bold 11px 'JetBrains Mono', Consolas, monospace";
        ctx.fillStyle = sigIdx < currentCircuit!.inputs.length ? "#60a5fa" : "#34d399";
        ctx.textAlign = "right";
        ctx.fillText(sigName, startX - 10, lowY - 3);

        // Waveform Path
        ctx.strokeStyle = sigIdx < currentCircuit!.inputs.length ? "#38bdf8" : "#10b981";
        ctx.lineWidth = 2.2;
        ctx.beginPath();

        waveformHistory.forEach((pt, i) => {
            const x = startX + i * stepX;
            const val = pt.signals[sigName] ?? 0;
            const y = val === 1 ? highY : lowY;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevVal = waveformHistory[i - 1].signals[sigName] ?? 0;
                const prevY = prevVal === 1 ? highY : lowY;
                if (prevY !== y) {
                    ctx.lineTo(x, prevY); // Vertical clock edge
                }
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    });
}

/* =========================================================
   WORKSPACE RENDERER
========================================================= */

function loadCircuitWorkspace(circuit: CircuitDefinition): void {
    currentCircuit = circuit;
    currentInputs = {};
    circuit.inputs.forEach(inp => { currentInputs[inp] = 0; });
    waveformHistory = [];
    waveTimeCounter = 0;

    circuitTitle.textContent = `${circuit.title} Workspace`;
    breadcrumbCategory.textContent = `Circuits Simulator / ${circuit.title}`;

    rippleControls.classList.toggle("hidden", circuit.id !== "ripple_carry_adder_4bit");

    buildInputButtons();
    updateCircuitState();
    buildTruthTable();
    buildExpressions();

    step2.classList.add("hidden");
    step3.classList.remove("hidden");
    resetZoom();
}

function buildInputButtons(): void {
    if (!currentCircuit) return;
    inputControls.innerHTML = currentCircuit.inputs.map(inp => `
        <button type="button" class="input-toggle-btn" data-input="${inp}">
            <span>${inp}</span>
            <span class="input-val-badge">0</span>
        </button>
    `).join("");

    inputControls.querySelectorAll(".input-toggle-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const inpName = btn.getAttribute("data-input");
            if (inpName) {
                currentInputs[inpName] = currentInputs[inpName] === 1 ? 0 : 1;
                if (window.StudioFX) window.StudioFX.click(currentInputs[inpName] === 1);
                updateCircuitState();
            }
        });
    });
}

function updateCircuitState(rippleStage = -1): void {
    if (!currentCircuit) return;

    inputControls.querySelectorAll(".input-toggle-btn").forEach(btn => {
        const inpName = btn.getAttribute("data-input");
        if (inpName) {
            const isHigh = currentInputs[inpName] === 1;
            btn.classList.toggle("active", isHigh);
            const badge = btn.querySelector(".input-val-badge");
            if (badge) badge.textContent = isHigh ? "1" : "0";
        }
    });

    const outputs = currentCircuit.evaluate(currentInputs);
    circuitDiagram.innerHTML = currentCircuit.renderSchematic(currentInputs, outputs, rippleStage);
    applyZoom();

    // Highlight active row in Truth Table
    const inVals = currentCircuit.inputs.map(k => currentInputs[k]);
    truthTable.querySelectorAll("tbody tr").forEach(tr => {
        const rowData = tr.getAttribute("data-inputs");
        if (rowData) {
            const isMatch = rowData === inVals.join(",");
            tr.classList.toggle("active-row", isMatch);
        }
    });

    recordWaveformSample();
}

/* =========================================================
   TRUTH TABLE & EXPRESSIONS
========================================================= */

function buildTruthTable(): void {
    if (!currentCircuit) return;
    const inKeys = currentCircuit.inputs;
    const outKeys = currentCircuit.outputs;

    let html = `<table class="truth-table"><thead><tr>`;
    inKeys.forEach(k => { html += `<th>${k}</th>`; });
    outKeys.forEach(k => { html += `<th>${k}</th>`; });
    html += `</tr></thead><tbody>`;

    currentCircuit.truthTable.forEach(row => {
        html += `<tr data-inputs="${row.inputs.join(",")}">`;
        row.inputs.forEach(v => { html += `<td>${v}</td>`; });
        row.outputs.forEach(v => {
            html += `<td class="${v === 1 ? "tt-one" : "tt-zero"}">${v}</td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table>`;
    truthTable.innerHTML = html;
}

function buildExpressions(): void {
    if (!currentCircuit) return;
    booleanExpressions.innerHTML = currentCircuit.expressions.map(exp => `
        <div class="expression-card">
            <h3>${exp.output}</h3>
            <div class="expression-formula">${exp.formula}</div>
        </div>
    `).join("");

    verilogCode.textContent = currentCircuit.verilogModule;
    copyVerilogBtn.onclick = () => {
        if (window.StudioFX) window.StudioFX.click(true);
        navigator.clipboard.writeText(currentCircuit!.verilogModule).then(() => {
            copyVerilogBtn.textContent = "✅ Copied!";
            copyVerilogBtn.classList.add("copied");
            setTimeout(() => {
                copyVerilogBtn.textContent = "📋 Copy Verilog";
                copyVerilogBtn.classList.remove("copied");
            }, 1600);
        });
    };
}

/* =========================================================
   RIPPLE CARRY ANIMATION ENGINE
========================================================= */

let rippleTimer: ReturnType<typeof setTimeout> | null = null;

if (rippleAnimateBtn) {
    rippleAnimateBtn.addEventListener("click", () => {
        if (rippleTimer) clearTimeout(rippleTimer);
        let stage = 0;
        rippleAnimateBtn.disabled = true;
        if (window.StudioFX) window.StudioFX.relay();

        function step() {
            if (stage <= 3) {
                rippleStepBadge.textContent = `Stage: Processing FA ${stage}...`;
                updateCircuitState(stage);
                if (window.StudioFX) window.StudioFX.tick();
                stage++;
                rippleTimer = setTimeout(step, 650);
            } else {
                rippleStepBadge.textContent = "Stage: Complete (Cout Stable)";
                updateCircuitState(-1);
                rippleAnimateBtn.disabled = false;
                if (window.StudioFX) window.StudioFX.success();
            }
        }
        step();
    });
}

/* =========================================================
   ZOOM & PAN SCHEMATIC ENGINE
========================================================= */

function applyZoom(): void {
    const svg = circuitDiagram.querySelector("svg") as SVGSVGElement | null;
    if (svg) {
        svg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
    }
}

function resetZoom(): void {
    zoomScale = 1.0;
    panX = 0;
    panY = 0;
    applyZoom();
}

zoomInBtn.addEventListener("click", () => {
    zoomScale = Math.min(2.5, zoomScale + 0.2);
    applyZoom();
    if (window.StudioFX) window.StudioFX.click(true);
});

zoomOutBtn.addEventListener("click", () => {
    zoomScale = Math.max(0.4, zoomScale - 0.2);
    applyZoom();
    if (window.StudioFX) window.StudioFX.click(false);
});

zoomResetBtn.addEventListener("click", resetZoom);

circuitDiagram.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoomScale = Math.min(2.5, Math.max(0.4, zoomScale + delta));
    applyZoom();
}, { passive: false });

circuitDiagram.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return;
    isDragging = true;
    startDragX = e.clientX - panX;
    startDragY = e.clientY - panY;
    circuitDiagram.style.cursor = "grabbing";
});

window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isDragging) return;
    panX = e.clientX - startDragX;
    panY = e.clientY - startDragY;
    applyZoom();
});

window.addEventListener("mouseup", () => {
    isDragging = false;
    circuitDiagram.style.cursor = "grab";
});

/* =========================================================
   CATEGORY & SUBCATEGORY NAVIGATION
========================================================= */

document.querySelectorAll(".category-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const catKey = btn.getAttribute("data-category");
        if (catKey && CATEGORIES[catKey]) {
            currentCategory = catKey;
            const cat = CATEGORIES[catKey];
            step2Title.textContent = `Select a ${cat.title} Model`;
            breadcrumbCategory.textContent = `Circuits Simulator / ${cat.title}`;

            subcategoryGrid.innerHTML = cat.circuits.map(cId => {
                const c = CIRCUITS[cId];
                return `<button class="subcategory-btn" data-circuit="${cId}">${c.title}</button>`;
            }).join("");

            subcategoryGrid.querySelectorAll(".subcategory-btn").forEach(sBtn => {
                sBtn.addEventListener("click", () => {
                    const cId = sBtn.getAttribute("data-circuit");
                    if (cId && CIRCUITS[cId]) {
                        loadCircuitWorkspace(CIRCUITS[cId]);
                        if (window.StudioFX) window.StudioFX.relay();
                    }
                });
            });

            step1.classList.add("hidden");
            step2.classList.remove("hidden");
            if (window.StudioFX) window.StudioFX.click(true);
        }
    });
});

backToStep2.addEventListener("click", () => {
    if (rippleTimer) clearTimeout(rippleTimer);
    step3.classList.add("hidden");
    step2.classList.remove("hidden");
    if (currentCategory && CATEGORIES[currentCategory]) {
        breadcrumbCategory.textContent = `Circuits Simulator / ${CATEGORIES[currentCategory].title}`;
    }
});
