import { describe, expect, it } from "vitest";
import { buildSolverModel, verifySolution } from "../../Web1/src/solver";
import {
    buildBasicSOPCircuit,
    buildNANDCircuit,
    buildNORCircuit,
    resetCircuitIds,
} from "../../Web1/src/circuits/circuitGraph";

describe("Web1 circuit verification", () => {
    it("matches every 3-variable function, including don't-care states, in all implementations", () => {
        const variableCount = 3;
        const rowCount = 1 << variableCount;

        // Each row is 0, 1, or X. This exhausts all 3^8 possible truth tables
        // and catches circuits that only disagree on a minimized don't-care cover.
        for (let functionMask = 0; functionMask < 3 ** rowCount; functionMask++) {
            let remaining = functionMask;
            const minterms: number[] = [];
            const dontCares: number[] = [];
            for (let minterm = 0; minterm < rowCount; minterm++) {
                const state = remaining % 3;
                remaining = Math.floor(remaining / 3);
                if (state === 1) minterms.push(minterm);
                if (state === 2) dontCares.push(minterm);
            }
            const model = minterms.length === 0 && dontCares.length === 0
                ? buildSolverModel({
                    mode: "minterms",
                    mintermCount: variableCount,
                    mintermList: [],
                })
                : buildSolverModel({
                    mode: "dontCare",
                    dontCareCount: variableCount,
                    dontCareMintermList: minterms,
                    dontCareList: dontCares,
                });

            resetCircuitIds();
            const circuits = {
                basic: buildBasicSOPCircuit(model.sop.implicants, model.variables),
                nand: buildNANDCircuit(model.sop.implicants, model.variables),
                nor: buildNORCircuit(model.pos.implicants, model.variables),
            };

            expect(verifySolution(model, circuits), `function mask ${functionMask}`).toBe(true);
        }
    });
});
