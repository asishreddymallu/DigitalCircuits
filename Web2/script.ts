/* =========================================================
   DIGITAL CIRCUITS SIMULATOR
   Adders • Subtractors • Multiplexers
   Live input updates — no "Evaluate" button needed
========================================================= */

/* =========================================================
   DOM ELEMENTS
========================================================= */

const step1 = document.getElementById("step1")!;
const step2 = document.getElementById("step2")!;
const step3 = document.getElementById("step3")!;

const step2Title = document.getElementById("step2Title")!;
const step2Desc = document.getElementById("step2Desc")!;

const adderOptions = document.getElementById("adderOptions")!;
const subtractorOptions = document.getElementById("subtractorOptions")!;
const multiplexerOptions = document.getElementById("multiplexerOptions")!;

const backBtn = document.getElementById("backBtn")!;
const backToStep2 = document.getElementById("backToStep2")!;

const inputPanel = document.getElementById("inputPanel")!;
const truthTable = document.getElementById("truthTable")!;
const circuitDiagram = document.getElementById("circuitDiagram")!;
const booleanExpressions = document.getElementById("booleanExpressions")!;
const circuitTitle = document.getElementById("circuitTitle")!;

/* =========================================================
   STATE
========================================================= */

let selectedCategory: string | null = null;
let selectedCircuit: string | null = null;
let currentTruthTableHTML: string = "";

/* =========================================================
   GATE SVG HELPERS — clean schematic style
========================================================= */

function gateXOR(cx: number, cy: number, w: number, h: number, label = "XOR"): string {
    const hw = w / 2, hh = h / 2;
    return `
        <path d="M ${cx - hw} ${cy - hh} Q ${cx - hw + 18} ${cy} ${cx - hw} ${cy + hh}
                 Q ${cx + 10} ${cy + hh} ${cx + hw} ${cy}
                 Q ${cx + 10} ${cy - hh} ${cx - hw} ${cy - hh} Z"
              fill="white" stroke="#1a3358" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M ${cx - hw - 5} ${cy - hh} Q ${cx - hw + 13} ${cy} ${cx - hw - 5} ${cy + hh}"
              fill="none" stroke="#1a3358" stroke-width="2"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#1a3358">${label}</text>`;
}

function gateAND(cx: number, cy: number, w: number, h: number, label = "AND"): string {
    const hw = w / 2, hh = h / 2;
    return `
        <path d="M ${cx - hw} ${cy - hh} h ${hw} a ${hh} ${hh} 0 0 1 0 ${h} h ${-hw} z"
              fill="white" stroke="#1a3358" stroke-width="2.2" stroke-linejoin="round"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#1a3358">${label}</text>`;
}

function gateOR(cx: number, cy: number, w: number, h: number, label = "OR"): string {
    const hw = w / 2, hh = h / 2;
    return `
        <path d="M ${cx - hw} ${cy - hh} Q ${cx - hw + 18} ${cy} ${cx - hw} ${cy + hh}
                 Q ${cx + 10} ${cy + hh} ${cx + hw} ${cy}
                 Q ${cx + 10} ${cy - hh} ${cx - hw} ${cy - hh} Z"
              fill="white" stroke="#1a3358" stroke-width="2.2" stroke-linejoin="round"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#1a3358">${label}</text>`;
}

function gateNOT(cx: number, cy: number, h: number): string {
    const hh = h / 2;
    return `
        <polygon points="${cx - 20},${cy - hh} ${cx + 20},${cy} ${cx - 20},${cy + hh}"
                 fill="white" stroke="#1a3358" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="${cx + 24}" cy="${cy}" r="5" fill="white" stroke="#1a3358" stroke-width="2"/>`;
}

function wire(x1: number, y1: number, x2: number, y2: number): string {
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round"/>`;
}

function wirePath(points: [number, number][], ): string {
    if (points.length < 2) return "";
    let d = `M ${points[0][0]} ${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i][0]} ${points[i][1]}`;
    }
    return `<path d="${d}" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function junctionDot(x: number, y: number): string {
    return `<circle cx="${x}" cy="${y}" r="3.5" fill="#2563eb" stroke="#1e40af" stroke-width="0.8"/>`;
}

function ioLabel(x: number, y: number, text: string, value: number, isOutput = false): string {
    const color = isOutput ? "#1a3358" : "#1a3358";
    return `
        <text x="${x}" y="${y}" font-size="15" font-weight="700" fill="${color}">${text}</text>
        <text x="${x + (isOutput ? 50 : 20)}" y="${y}" font-size="13" font-weight="600" fill="#2563eb">= ${value}</text>`;
}

/* =========================================================
   CIRCUIT DEFINITIONS
========================================================= */

interface CircuitDef {
    name: string;
    inputs: string[];
    outputs: string[];
    evaluate: (inputs: Record<string, number>) => Record<string, number>;
    expressions: Record<string, string>;
    renderDiagram: (inputs: Record<string, number>) => string;
}

const circuits: Record<string, CircuitDef> = {

    /* =====================================================
       HALF ADDER
       A ──┐
           ├─ XOR → Sum
       B ──┘
       A ──┐
           ├─ AND → Carry
       B ──┘
    ===================================================== */
    halfAdder: {
        name: "Half Adder",
        inputs: ["A", "B"],
        outputs: ["Sum", "Carry"],
        evaluate(inp) {
            const a = inp.A, b = inp.B;
            return { Sum: a ^ b, Carry: a & b };
        },
        expressions: { Sum: "A ⊕ B", Carry: "A · B" },
        renderDiagram(inp) {
            const a = inp.A ?? 0, b = inp.B ?? 0;
            const sum = a ^ b, carry = a & b;
            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="520" height="200" viewBox="0 0 520 200">`;
            // Input labels
            svg += ioLabel(20, 65, "A", a);
            svg += ioLabel(20, 145, "B", b);
            // Wires to gates
            svg += wire(55, 60, 120, 60);
            svg += wire(55, 140, 120, 140);
            svg += wire(55, 60, 55, 130);
            svg += junctionDot(55, 130);
            svg += wire(55, 130, 120, 130);
            // XOR gate
            svg += gateXOR(155, 60, 70, 60);
            svg += wire(120, 140, 135, 100);
            // AND gate
            svg += gateAND(155, 130, 60, 44);
            // Outputs
            svg += wire(190, 60, 310, 60);
            svg += wire(185, 130, 310, 130);
            svg += ioLabel(320, 65, "Sum", sum, true);
            svg += ioLabel(320, 135, "Carry", carry, true);
            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       FULL ADDER
       A ──┐
           ├─ XOR ──┐
       B ──┘        ├─ XOR → Sum
                Cin─┘
       A ──┐
           ├─ AND ──┐
       B ──┘        ├─ OR → Cout
       A⊕B ─┐       │
             ├─ AND ┘
       Cin ──┘
    ===================================================== */
    fullAdder: {
        name: "Full Adder",
        inputs: ["A", "B", "Cin"],
        outputs: ["Sum", "Cout"],
        evaluate(inp) {
            const a = inp.A, b = inp.B, cin = inp.Cin;
            return { Sum: a ^ b ^ cin, Cout: (a & b) | (cin & (a ^ b)) };
        },
        expressions: { Sum: "A ⊕ B ⊕ Cin", Cout: "A·B + Cin·(A ⊕ B)" },
        renderDiagram(inp) {
            const a = inp.A ?? 0, b = inp.B ?? 0, cin = inp.Cin ?? 0;
            const s1 = a ^ b, c1 = a & b;
            const sum = s1 ^ cin, cout = c1 | (cin & s1);
            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="650" height="250" viewBox="0 0 650 250">`;
            // Inputs
            svg += ioLabel(10, 50, "A", a);
            svg += ioLabel(10, 125, "B", b);
            svg += ioLabel(10, 210, "Cin", cin);
            // Wires from inputs
            svg += wire(45, 45, 110, 45);
            svg += wire(45, 120, 110, 120);
            svg += wire(45, 45, 45, 110);
            svg += junctionDot(45, 110);
            svg += wire(45, 110, 110, 110);
            // First XOR
            svg += gateXOR(155, 67, 70, 50);
            svg += wire(110, 120, 130, 92);
            // First AND
            svg += gateAND(155, 120, 50, 36);
            // Connect first XOR output to second XOR + AND
            svg += wire(190, 67, 230, 67);
            svg += junctionDot(230, 67);
            svg += wire(230, 67, 230, 175);
            svg += wire(230, 175, 310, 175);
            svg += wire(230, 67, 310, 67);
            svg += wire(45, 205, 55, 205);
            svg += wire(55, 205, 55, 175);
            svg += wire(55, 175, 310, 175);
            // Second XOR
            svg += gateXOR(350, 120, 70, 60);
            svg += wire(190, 120, 315, 120);
            svg += wire(315, 120, 315, 100);
            // Second AND
            svg += gateAND(420, 175, 50, 36);
            svg += wire(190, 120, 400, 120);
            svg += junctionDot(400, 120);
            svg += wire(400, 120, 400, 160);
            svg += wire(400, 160, 395, 160);
            svg += wire(230, 67, 395, 67);
            svg += wire(395, 67, 395, 160);
            // OR gate
            svg += gateOR(490, 80, 60, 50);
            svg += wire(445, 120, 465, 80);
            svg += wire(445, 175, 465, 80);
            svg += junctionDot(445, 175);
            svg += wire(445, 175, 445, 95);
            // Outputs
            svg += wire(385, 120, 540, 120);
            svg += wire(520, 80, 540, 80);
            svg += ioLabel(550, 125, "Sum", sum, true);
            svg += ioLabel(550, 85, "Cout", cout, true);
            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       4-BIT RIPPLE CARRY ADDER
       Four full adders cascaded: Cin0 → Cout0=Cin1 → ... → Cout3
    ===================================================== */
    rippleCarryAdder4: {
        name: "4-Bit Ripple Carry Adder",
        inputs: ["A3", "A2", "A1", "A0", "B3", "B2", "B1", "B0", "Cin"],
        outputs: ["S3", "S2", "S1", "S0", "Cout"],
        evaluate(inp) {
            let carry = inp.Cin;
            const sums: number[] = [];
            for (let i = 0; i < 4; i++) {
                const a = (inp as any)[`A${i}`] ?? 0;
                const b = (inp as any)[`B${i}`] ?? 0;
                sums.push(a ^ b ^ carry);
                carry = (a & b) | (carry & (a ^ b));
            }
            return {
                S3: sums[3], S2: sums[2], S1: sums[1], S0: sums[0],
                Cout: carry
            };
        },
        expressions: {
            S0: "A0 ⊕ B0 ⊕ Cin",
            S1: "A1 ⊕ B1 ⊕ C0",
            S2: "A2 ⊕ B2 ⊕ C1",
            S3: "A3 ⊕ B3 ⊕ C2",
            Cout: "Carry out from bit 3"
        },
        renderDiagram(inp) {
            // Build 4 full adder stages
            const bits = [0, 1, 2, 3];
            let carries: number[] = [inp.Cin ?? 0];
            const sums: number[] = [];
            bits.forEach(i => {
                const a = (inp as any)[`A${i}`] ?? 0;
                const b = (inp as any)[`B${i}`] ?? 0;
                const cin = carries[i];
                sums.push(a ^ b ^ cin);
                carries.push((a & b) | (cin & (a ^ b)));
            });

            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="920" height="260" viewBox="0 0 920 260">`;
            const stageW = 200, startX = 30, startY = 30;

            bits.forEach((i, idx) => {
                const x = startX + idx * stageW;
                const a = (inp as any)[`A${i}`] ?? 0;
                const b = (inp as any)[`B${i}`] ?? 0;
                const cin = carries[i];
                const s = sums[i];

                // Stage box
                svg += `<rect x="${x}" y="${startY}" width="170" height="200" rx="12" fill="#f8fafc" stroke="#d1d7e0" stroke-width="1.5"/>`;
                svg += `<text x="${x + 85}" y="${startY + 20}" text-anchor="middle" font-size="12" font-weight="700" fill="#6b7280">Bit ${i}</text>`;

                // Input A
                svg += ioLabel(x + 10, startY + 55, `A${i}`, a);
                svg += wire(x + 45, startY + 50, x + 85, startY + 50);

                // Input B
                svg += ioLabel(x + 10, startY + 95, `B${i}`, b);
                svg += wire(x + 45, startY + 90, x + 85, startY + 90);

                // Cin
                svg += `<text x="${x + 10}" y="${startY + 140}" font-size="12" font-weight="700" fill="#1a3358">C<tspan baseline-shift="sub" font-size="9">in</tspan></text>`;
                svg += `<text x="${x + 38}" y="${startY + 140}" font-size="11" fill="#2563eb">=${cin}</text>`;
                svg += wire(x + 55, startY + 135, x + 85, startY + 135);

                // XOR gate (Sum)
                svg += gateXOR(x + 115, startY + 70, 50, 36, "⊕");
                svg += wire(x + 85, startY + 50, x + 90, startY + 62);
                svg += wire(x + 85, startY + 90, x + 90, startY + 78);

                // AND gate (Carry)
                svg += gateAND(x + 115, startY + 120, 40, 30, "·");
                svg += wire(x + 85, startY + 50, x + 100, startY + 112);
                svg += wire(x + 85, startY + 90, x + 100, startY + 128);

                // OR gate (Carry out)
                svg += gateOR(x + 115, startY + 165, 40, 30, "+");
                svg += wire(x + 135, startY + 120, x + 100, startY + 157);
                svg += wire(x + 85, startY + 135, x + 100, startY + 173);

                // Sum output
                svg += wire(x + 140, startY + 70, x + 165, startY + 70);
                svg += `<text x="${x + 148}" y="${startY + 74}" font-size="12" font-weight="700" fill="#1a3358">S${i}</text>`;
                svg += `<text x="${x + 148}" y="${startY + 86}" font-size="10" fill="#2563eb">=${s}</text>`;

                // Carry out to next stage
                if (idx < 3) {
                    svg += wire(x + 135, startY + 165, x + stageW, startY + 135);
                }
            });

            // Final Cout
            svg += `<text x="${startX + 4 * stageW - 10}" y="${startY + 170}" font-size="13" font-weight="700" fill="#1a3358">C<tspan baseline-shift="sub" font-size="10">out</tspan></text>`;
            svg += `<text x="${startX + 4 * stageW - 10}" y="${startY + 184}" font-size="12" fill="#2563eb">= ${carries[4]}</text>`;

            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       HALF SUBTRACTOR
       A ──┐
           ├─ XOR → Diff
       B ──┘
       A' ─┐
            ├─ AND → Borrow
       B ──┘
    ===================================================== */
    halfSubtractor: {
        name: "Half Subtractor",
        inputs: ["A", "B"],
        outputs: ["Diff", "Borrow"],
        evaluate(inp) {
            const a = inp.A, b = inp.B;
            return { Diff: a ^ b, Borrow: (~a & b) & 1 };
        },
        expressions: { Diff: "A ⊕ B", Borrow: "A' · B" },
        renderDiagram(inp) {
            const a = inp.A ?? 0, b = inp.B ?? 0;
            const diff = a ^ b, borrow = (~a & b) & 1;
            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="560" height="200" viewBox="0 0 560 200">`;
            svg += ioLabel(20, 65, "A", a);
            svg += ioLabel(20, 145, "B", b);
            // Wires
            svg += wire(55, 60, 120, 60);
            svg += wire(55, 140, 120, 140);
            svg += wire(55, 60, 55, 130);
            svg += junctionDot(55, 130);
            svg += wire(55, 130, 120, 130);
            // NOT on A for AND
            svg += `<circle cx="118" cy="130" r="5" fill="white" stroke="#1a3358" stroke-width="1.8"/>`;
            // XOR
            svg += gateXOR(155, 60, 70, 60);
            svg += wire(120, 140, 135, 100);
            // AND
            svg += gateAND(155, 130, 60, 44);
            // Outputs
            svg += wire(190, 60, 320, 60);
            svg += wire(185, 130, 320, 130);
            svg += ioLabel(330, 65, "Diff", diff, true);
            svg += ioLabel(330, 135, "Borrow", borrow, true);
            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       FULL SUBTRACTOR
    ===================================================== */
    fullSubtractor: {
        name: "Full Subtractor",
        inputs: ["A", "B", "Bin"],
        outputs: ["Diff", "Bout"],
        evaluate(inp) {
            const a = inp.A, b = inp.B, bin = inp.Bin;
            const diff = a ^ b ^ bin;
            const bout = ((~a & b) | (bin & (~(a ^ b) & 1))) & 1;
            return { Diff: diff, Bout: bout };
        },
        expressions: { Diff: "A ⊕ B ⊕ Bin", Bout: "A'·B + Bin·(A ⊕ B)'" },
        renderDiagram(inp) {
            const a = inp.A ?? 0, b = inp.B ?? 0, bin = inp.Bin ?? 0;
            const s1 = a ^ b, b1 = (~a & b) & 1;
            const diff = s1 ^ bin, bout = (b1 | (bin & (s1 ^ 1))) & 1;
            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="620" height="240" viewBox="0 0 620 240">`;
            svg += ioLabel(10, 50, "A", a);
            svg += ioLabel(10, 120, "B", b);
            svg += ioLabel(10, 210, "Bin", bin);
            // Wires from inputs
            svg += wire(45, 45, 100, 45);
            svg += wire(45, 115, 100, 115);
            svg += wire(45, 45, 45, 105);
            svg += junctionDot(45, 105);
            svg += wire(45, 105, 100, 105);
            // First XOR
            svg += gateXOR(145, 67, 70, 50);
            svg += wire(100, 115, 120, 92);
            // First AND (A'·B)
            svg += gateAND(145, 115, 50, 36);
            svg += `<circle cx="98" cy="115" r="5" fill="white" stroke="#1a3358" stroke-width="1.8"/>`;
            // Connect first XOR out
            svg += wire(180, 67, 220, 67);
            svg += junctionDot(220, 67);
            svg += wire(220, 67, 220, 170);
            svg += wire(220, 170, 300, 170);
            svg += wire(220, 67, 300, 67);
            // Bin wire
            svg += wire(45, 205, 50, 205);
            svg += wire(50, 205, 50, 170);
            svg += wire(50, 170, 300, 170);
            // Second XOR
            svg += gateXOR(340, 117, 70, 50);
            svg += wire(180, 115, 305, 117);
            // OR gate
            svg += gateOR(460, 80, 60, 50);
            svg += wire(170, 115, 435, 80);
            svg += wire(170, 175, 435, 80);
            svg += junctionDot(170, 175);
            svg += wire(170, 175, 170, 95);
            // Outputs
            svg += wire(375, 117, 520, 117);
            svg += wire(490, 80, 520, 80);
            svg += ioLabel(530, 122, "Diff", diff, true);
            svg += ioLabel(530, 85, "Bout", bout, true);
            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       4-BIT RIPPLE BORROW SUBTRACTOR
    ===================================================== */
    rippleBorrowSubtractor4: {
        name: "4-Bit Ripple Borrow Subtractor",
        inputs: ["A3", "A2", "A1", "A0", "B3", "B2", "B1", "B0", "Bin"],
        outputs: ["D3", "D2", "D1", "D0", "Bout"],
        evaluate(inp) {
            let borrow = inp.Bin;
            const diffs: number[] = [];
            for (let i = 0; i < 4; i++) {
                const a = (inp as any)[`A${i}`] ?? 0;
                const b = (inp as any)[`B${i}`] ?? 0;
                diffs.push(a ^ b ^ borrow);
                borrow = ((~a & b) | (borrow & (~(a ^ b) & 1))) & 1;
            }
            return {
                D3: diffs[3], D2: diffs[2], D1: diffs[1], D0: diffs[0],
                Bout: borrow
            };
        },
        expressions: {
            D0: "A0 ⊕ B0 ⊕ Bin",
            D1: "A1 ⊕ B1 ⊕ Bo0",
            D2: "A2 ⊕ B2 ⊕ Bo1",
            D3: "A3 ⊕ B3 ⊕ Bo2",
            Bout: "Borrow out from bit 3"
        },
        renderDiagram(inp) {
            const bits = [0, 1, 2, 3];
            let borrows: number[] = [inp.Bin ?? 0];
            const diffs: number[] = [];
            bits.forEach(i => {
                const a = (inp as any)[`A${i}`] ?? 0;
                const b = (inp as any)[`B${i}`] ?? 0;
                const bin = borrows[i];
                diffs.push(a ^ b ^ bin);
                borrows.push(((~a & b) | (bin & (~(a ^ b) & 1))) & 1);
            });

            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="920" height="260" viewBox="0 0 920 260">`;
            const stageW = 200, startX = 30, startY = 30;

            bits.forEach((i, idx) => {
                const x = startX + idx * stageW;
                const a = (inp as any)[`A${i}`] ?? 0;
                const b = (inp as any)[`B${i}`] ?? 0;
                const bin = borrows[i];
                const d = diffs[i];

                svg += `<rect x="${x}" y="${startY}" width="170" height="200" rx="12" fill="#f8fafc" stroke="#d1d7e0" stroke-width="1.5"/>`;
                svg += `<text x="${x + 85}" y="${startY + 20}" text-anchor="middle" font-size="12" font-weight="700" fill="#6b7280">Bit ${i}</text>`;

                svg += ioLabel(x + 10, startY + 55, `A${i}`, a);
                svg += wire(x + 45, startY + 50, x + 85, startY + 50);

                svg += ioLabel(x + 10, startY + 95, `B${i}`, b);
                svg += wire(x + 45, startY + 90, x + 85, startY + 90);

                svg += `<text x="${x + 10}" y="${startY + 140}" font-size="12" font-weight="700" fill="#1a3358">B<tspan baseline-shift="sub" font-size="9">in</tspan></text>`;
                svg += `<text x="${x + 35}" y="${startY + 140}" font-size="11" fill="#2563eb">=${bin}</text>`;
                svg += wire(x + 55, startY + 135, x + 85, startY + 135);

                svg += gateXOR(x + 115, startY + 70, 50, 36, "⊕");
                svg += wire(x + 85, startY + 50, x + 90, startY + 62);
                svg += wire(x + 85, startY + 90, x + 90, startY + 78);

                svg += gateAND(x + 115, startY + 120, 40, 30, "·");
                svg += `<circle cx="${x + 83}" cy="${startY + 50}" r="4" fill="white" stroke="#1a3358" stroke-width="1.5"/>`;
                svg += wire(x + 85, startY + 50, x + 100, startY + 112);
                svg += wire(x + 85, startY + 90, x + 100, startY + 128);

                svg += gateOR(x + 115, startY + 165, 40, 30, "+");
                svg += wire(x + 135, startY + 120, x + 100, startY + 157);
                svg += wire(x + 85, startY + 135, x + 100, startY + 173);

                svg += wire(x + 140, startY + 70, x + 165, startY + 70);
                svg += `<text x="${x + 148}" y="${startY + 74}" font-size="12" font-weight="700" fill="#1a3358">D${i}</text>`;
                svg += `<text x="${x + 148}" y="${startY + 86}" font-size="10" fill="#2563eb">=${d}</text>`;

                if (idx < 3) {
                    svg += wire(x + 135, startY + 165, x + stageW, startY + 135);
                }
            });

            svg += `<text x="${startX + 4 * stageW - 10}" y="${startY + 170}" font-size="13" font-weight="700" fill="#1a3358">B<tspan baseline-shift="sub" font-size="10">out</tspan></text>`;
            svg += `<text x="${startX + 4 * stageW - 10}" y="${startY + 184}" font-size="12" fill="#2563eb">= ${borrows[4]}</text>`;

            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       2:1 MUX
    ===================================================== */
    mux2to1: {
        name: "2 : 1 Multiplexer",
        inputs: ["I0", "I1", "S"],
        outputs: ["Y"],
        evaluate(inp) { return { Y: inp.S ? inp.I1 : inp.I0 }; },
        expressions: { Y: "S'·I0 + S·I1" },
        renderDiagram(inp) {
            const i0 = inp.I0 ?? 0, i1 = inp.I1 ?? 0, s = inp.S ?? 0;
            const y = s ? i1 : i0;
            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="480" height="220" viewBox="0 0 480 220">`;
            // MUX trapezoid
            svg += `<polygon points="150,25 310,55 310,165 150,195" fill="white" stroke="#1a3358" stroke-width="2.5" stroke-linejoin="round"/>`;
            svg += `<text x="210" y="105" text-anchor="middle" font-size="16" font-weight="700" fill="#1a3358">2:1</text>`;
            svg += `<text x="210" y="122" text-anchor="middle" font-size="11" fill="#6b7280">MUX</text>`;
            // I0
            svg += wire(20, 65, 150, 65);
            svg += ioLabel(20, 65, "I0", i0);
            // I1
            svg += wire(20, 155, 150, 155);
            svg += ioLabel(20, 155, "I1", i1);
            // S
            svg += wire(230, 220, 230, 195);
            svg += `<text x="218" y="238" font-size="15" font-weight="700" fill="#1a3358">S</text>`;
            svg += `<text x="238" y="215" font-size="12" fill="#2563eb">=${s}</text>`;
            // Output
            svg += wire(310, 110, 400, 110);
            svg += ioLabel(410, 115, "Y", y, true);
            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       4:1 MUX
    ===================================================== */
    mux4to1: {
        name: "4 : 1 Multiplexer",
        inputs: ["I0", "I1", "I2", "I3", "S0", "S1"],
        outputs: ["Y"],
        evaluate(inp) {
            const sel = (inp.S1 << 1) | inp.S0;
            return { Y: [inp.I0, inp.I1, inp.I2, inp.I3][sel] };
        },
        expressions: { Y: "S1'·S0'·I0 + S1'·S0·I1 + S1·S0'·I2 + S1·S0·I3" },
        renderDiagram(inp) {
            const i = [0,1,2,3].map(k => (inp as any)[`I${k}`] ?? 0);
            const s0 = inp.S0 ?? 0, s1 = inp.S1 ?? 0;
            const sel = (s1 << 1) | s0;
            const y = i[sel];
            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="520" height="340" viewBox="0 0 520 340">`;
            svg += `<polygon points="170,25 350,60 350,280 170,315" fill="white" stroke="#1a3358" stroke-width="2.5" stroke-linejoin="round"/>`;
            svg += `<text x="240" y="165" text-anchor="middle" font-size="16" font-weight="700" fill="#1a3358">4:1</text>`;
            svg += `<text x="240" y="182" text-anchor="middle" font-size="11" fill="#6b7280">MUX</text>`;
            [0,1,2,3].forEach(k => {
                const yPos = 75 + k * 60;
                svg += wire(20, yPos, 170, yPos);
                svg += ioLabel(20, yPos, `I${k}`, i[k]);
            });
            svg += wire(260, 340, 260, 315);
            svg += `<text x="235" y="358" font-size="14" font-weight="700" fill="#1a3358">S1 S0</text>`;
            svg += `<text x="268" y="335" font-size="12" fill="#2563eb">${s1}${s0}</text>`;
            svg += wire(350, 170, 440, 170);
            svg += ioLabel(450, 175, "Y", y, true);
            svg += `</svg>`;
            return svg;
        }
    },

    /* =====================================================
       8:1 MUX
    ===================================================== */
    mux8to1: {
        name: "8 : 1 Multiplexer",
        inputs: ["I0","I1","I2","I3","I4","I5","I6","I7","S0","S1","S2"],
        outputs: ["Y"],
        evaluate(inp) {
            const sel = (inp.S2 << 2) | (inp.S1 << 1) | inp.S0;
            return { Y: [inp.I0,inp.I1,inp.I2,inp.I3,inp.I4,inp.I5,inp.I6,inp.I7][sel] };
        },
        expressions: { Y: "Σm(I0–I7) selected by S2 S1 S0" },
        renderDiagram(inp) {
            const i = [0,1,2,3,4,5,6,7].map(k => (inp as any)[`I${k}`] ?? 0);
            const s0 = inp.S0 ?? 0, s1 = inp.S1 ?? 0, s2 = inp.S2 ?? 0;
            const sel = (s2 << 2) | (s1 << 1) | s0;
            const y = i[sel];
            let svg = `<svg class="circuit-svg" xmlns="http://www.w3.org/2000/svg" width="560" height="500" viewBox="0 0 560 500">`;
            svg += `<polygon points="190,25 390,70 390,430 190,475" fill="white" stroke="#1a3358" stroke-width="2.5" stroke-linejoin="round"/>`;
            svg += `<text x="275" y="245" text-anchor="middle" font-size="16" font-weight="700" fill="#1a3358">8:1</text>`;
            svg += `<text x="275" y="262" text-anchor="middle" font-size="11" fill="#6b7280">MUX</text>`;
            [0,1,2,3,4,5,6,7].forEach(k => {
                const yPos = 55 + k * 52;
                svg += wire(20, yPos, 190, yPos);
                svg += ioLabel(20, yPos, `I${k}`, i[k]);
            });
            svg += wire(290, 500, 290, 475);
            svg += `<text x="252" y="518" font-size="13" font-weight="700" fill="#1a3358">S2 S1 S0</text>`;
            svg += `<text x="298" y="495" font-size="12" fill="#2563eb">${s2}${s1}${s0}</text>`;
            svg += wire(390, 250, 480, 250);
            svg += ioLabel(490, 255, "Y", y, true);
            svg += `</svg>`;
            return svg;
        }
    }
};

/* =========================================================
   CIRCUIT SELECTION LOGIC
========================================================= */

const categoryBtns = document.querySelectorAll(".category-btn");
const optionBtns = document.querySelectorAll(".option-btn");

categoryBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        selectedCategory = btn.getAttribute("data-category")!;
        showStep2(selectedCategory);
    });
});

optionBtns.forEach(btn => {
    btn.addEventListener("click", () => {
        selectedCircuit = btn.getAttribute("data-circuit")!;
        showStep3(selectedCircuit);
    });
});

backBtn.addEventListener("click", () => {
    step2.classList.add("hidden");
    step1.classList.remove("hidden");
    selectedCategory = null;
    categoryBtns.forEach(b => b.classList.remove("selected"));
});

backToStep2.addEventListener("click", () => {
    step3.classList.add("hidden");
    step2.classList.remove("hidden");
    selectedCircuit = null;
});

/* =========================================================
   STEP NAVIGATION
========================================================= */

function showStep2(category: string): void {
    step1.classList.add("hidden");
    step2.classList.remove("hidden");
    adderOptions.classList.add("hidden");
    subtractorOptions.classList.add("hidden");
    multiplexerOptions.classList.add("hidden");
    categoryBtns.forEach(b => b.classList.remove("selected"));
    document.querySelector(`[data-category="${category}"]`)?.classList.add("selected");
    switch (category) {
        case "adder":
            step2Title.textContent = "Choose an Adder";
            step2Desc.textContent = "Select the type of binary adder circuit.";
            adderOptions.classList.remove("hidden");
            break;
        case "subtractor":
            step2Title.textContent = "Choose a Subtractor";
            step2Desc.textContent = "Select the type of binary subtractor circuit.";
            subtractorOptions.classList.remove("hidden");
            break;
        case "multiplexer":
            step2Title.textContent = "Choose a Multiplexer";
            step2Desc.textContent = "Select the type of data selector circuit.";
            multiplexerOptions.classList.remove("hidden");
            break;
    }
    step2.scrollIntoView({ behavior: "smooth" });
}

function showStep3(circuitId: string): void {
    const circuit = circuits[circuitId];
    if (!circuit) return;
    step2.classList.add("hidden");
    step3.classList.remove("hidden");
    circuitTitle.textContent = circuit.name;

    // Build truth table ONCE (always visible)
    currentTruthTableHTML = buildFullTruthTable(circuit);
    truthTable.innerHTML = currentTruthTableHTML;

    // Build expressions ONCE (always visible)
    showExpressions(circuit);

    // Build input panel
    buildInputPanel(circuit);

    // Initial diagram with all zeros
    updateFromInputs();

    step3.scrollIntoView({ behavior: "smooth" });
}

/* =========================================================
   INPUT PANEL — live updates on toggle
========================================================= */

function buildInputPanel(circuit: CircuitDef): void {
    inputPanel.innerHTML = "";
    circuit.inputs.forEach(name => {
        const group = document.createElement("div");
        group.className = "input-group";
        group.innerHTML = `
            <label>${name}</label>
            <div class="input-toggle" data-input="${name}">
                <button type="button" class="input-toggle-btn active" data-value="0">0</button>
                <button type="button" class="input-toggle-btn" data-value="1">1</button>
            </div>`;
        inputPanel.appendChild(group);
    });

    inputPanel.querySelectorAll(".input-toggle").forEach(toggle => {
        const btns = toggle.querySelectorAll(".input-toggle-btn");
        btns.forEach(btn => {
            btn.addEventListener("click", () => {
                btns.forEach(b => b.classList.remove("active"));
                btn.classList.add("active");
                updateFromInputs();   // ← live update
            });
        });
    });
}

/* =========================================================
   LIVE UPDATE — reads inputs, updates highlight + diagram
========================================================= */

function readCurrentInputs(circuit: CircuitDef): Record<string, number> {
    const vals: Record<string, number> = {};
    circuit.inputs.forEach(name => {
        const toggle = inputPanel.querySelector(`[data-input="${name}"]`);
        const active = toggle?.querySelector(".input-toggle-btn.active");
        vals[name] = Number(active?.getAttribute("data-value") ?? 0);
    });
    return vals;
}

function updateFromInputs(): void {
    if (!selectedCircuit) return;
    const circuit = circuits[selectedCircuit];
    if (!circuit) return;

    const inputVals = readCurrentInputs(circuit);

    // Update truth table highlight (swap highlighted row without rebuilding entire table)
    highlightTruthTableRow(circuit, inputVals);

    // Update diagram
    circuitDiagram.innerHTML = `<div style="width:max-content;margin:0 auto">${circuit.renderDiagram(inputVals)}</div>`;
}

/* =========================================================
   TRUTH TABLE — built once, highlight updated live
========================================================= */

function buildFullTruthTable(circuit: CircuitDef): string {
    const n = circuit.inputs.length;
    const rows = 2 ** n;
    let html = '<div class="table-container"><table><thead><tr>';
    circuit.inputs.forEach(name => { html += `<th>${name}</th>`; });
    circuit.outputs.forEach(name => { html += `<th>${name}</th>`; });
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
        const rowInputs: Record<string, number> = {};
        circuit.inputs.forEach((name, i) => { rowInputs[name] = (r >> (n - 1 - i)) & 1; });
        const outputs = circuit.evaluate(rowInputs);
        html += `<tr>`;
        circuit.inputs.forEach(name => {
            html += `<td class="${rowInputs[name] ? 'output-1' : 'output-0'}">${rowInputs[name]}</td>`;
        });
        circuit.outputs.forEach(name => {
            const v = outputs[name] ?? 0;
            html += `<td class="${v ? 'output-1' : 'output-0'}">${v}</td>`;
        });
        html += '</tr>';
    }
    html += '</tbody></table></div>';
    return html;
}

function highlightTruthTableRow(circuit: CircuitDef, currentInputs: Record<string, number>): void {
    const rows = truthTable.querySelectorAll("tr");
    rows.forEach((row, idx) => {
        if (idx === 0) return; // skip header
        const r = idx - 1;
        const n = circuit.inputs.length;
        const rowInputs: Record<string, number> = {};
        circuit.inputs.forEach((name, i) => { rowInputs[name] = (r >> (n - 1 - i)) & 1; });
        const isCurrent = circuit.inputs.every(name => rowInputs[name] === currentInputs[name]);
        row.classList.toggle("highlighted", isCurrent);
    });
    const highlighted = truthTable.querySelector("tr.highlighted");
    if (highlighted) {
        highlighted.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}

/* =========================================================
   EXPRESSIONS
========================================================= */

function showExpressions(circuit: CircuitDef): void {
    let html = "";
    for (const [output, expr] of Object.entries(circuit.expressions)) {
        html += `
            <div class="expression-row">
                <span class="expression-label">${output} =</span>
                <div class="expression-box">${expr}</div>
            </div>`;
    }
    booleanExpressions.innerHTML = html;
}
