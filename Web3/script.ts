/**
 * Web3 — 7-Segment Display Simulator entry point.
 *
 * Wires together the modular components:
 *   src/types.ts      — types, constants, segment patterns
 *   src/hexExpressions.ts — QM-derived Boolean expressions
 *   src/segments.ts   — 7-segment SVG renderer + pattern matching
 *   src/circuit.ts    — decoder schematic + wire helpers
 *   src/ui.ts         — all UI logic (waveform, inputs, truth table,
 *                       expressions, k-maps, counter, zoom, mode controls)
 */

import { SEGMENTS } from "./src/types";
import type { SegmentId, SegmentPattern } from "./src/types";
import {
    buildInputs,
    buildTruthTable,
    buildExpressions,
    buildKarnaughMaps,
    syncDisplayFromInput,
    setupZoomPan,
    setupCounter,
    setupLedColorPicker,
    setupKeyboard,
    setupModeControls,
} from "./src/ui";
import type { Web3Els, Web3State, Web3Deps } from "./src/ui";

/* ------------------------------------------------------------------ */
/* WINDOW TYPE AUGMENTATION                                            */
/* ------------------------------------------------------------------ */

interface Window {
    StudioFX?: any;
    toggleSiteTheme?: () => void;
    toggleSiteSound?: () => void;
}

/* ------------------------------------------------------------------ */
/* DOM ELEMENT LOOKUP                                                  */
/* ------------------------------------------------------------------ */

function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

const els: Web3Els = {
    step1:             byId("step1"),
    step3:             byId("step3"),
    backToStep2:       byId<HTMLButtonElement>("backToStep2"),
    breadcrumbCurrent: byId("breadcrumbCurrent"),
    encBcdBtn:         byId<HTMLButtonElement>("encBcdBtn"),
    encHexBtn:         byId<HTMLButtonElement>("encHexBtn"),
    polCathodeBtn:     byId<HTMLButtonElement>("polCathodeBtn"),
    polAnodeBtn:       byId<HTMLButtonElement>("polAnodeBtn"),
    segmentDisplay:    byId("segmentDisplay"),
    reverseMatchText:  byId("reverseMatchText"),
    bcdInput:          byId("bcdInput"),
    truthTable:        byId("truthTable"),
    booleanExpressions: byId("booleanExpressions"),
    karnaughMaps:      byId("karnaughMaps"),
    circuitDiagram:    byId("circuitDiagram"),
    verilogBox:        byId("verilogBox"),
    copyVerilogBtn:    byId<HTMLButtonElement>("copyVerilogBtn"),
    segTimingCanvas:   byId<HTMLCanvasElement>("segTimingCanvas"),
    displayHint:       byId("displayHint"),
    counterSection:    byId("counterSection"),
    counterStart:      byId<HTMLButtonElement>("counterStart"),
    counterStop:       byId<HTMLButtonElement>("counterStop"),
    counterReset:      byId<HTMLButtonElement>("counterReset"),
    counterStepFwd:    byId<HTMLButtonElement>("counterStepFwd"),
    counterStepBack:   byId<HTMLButtonElement>("counterStepBack"),
    counterSpeed:      byId<HTMLInputElement>("counterSpeed"),
    speedLabel:        byId("speedLabel"),
    zoomInBtn:         byId<HTMLButtonElement>("zoomInBtn"),
    zoomOutBtn:        byId<HTMLButtonElement>("zoomOutBtn"),
    zoomResetBtn:      byId<HTMLButtonElement>("zoomResetBtn"),
};

/* ------------------------------------------------------------------ */
/* SHARED STATE                                                        */
/* ------------------------------------------------------------------ */

const state: Web3State = {
    currentMode: "interactive",
    isHexMode: false,
    isCommonAnode: false,
    currentInput: 0,
    segmentValues: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 0 },
    zoomScale: 1.0,
    panX: 0,
    panY: 0,
    segWaveHistory: [],
    segWaveTimer: 0,
    counterInterval: null,
};

/* ------------------------------------------------------------------ */
/* DEPENDENCY INJECTION                                                */
/* ------------------------------------------------------------------ */

const deps: Web3Deps = {
    els,
    state,
    sfx: window.StudioFX ?? null,
};

/* ------------------------------------------------------------------ */
/* WIRE UP EVENT LISTENERS & INITIALIZE                                 */
/* ------------------------------------------------------------------ */

setupZoomPan(deps);
setupCounter(deps);
setupLedColorPicker(deps);
setupKeyboard(deps);
setupModeControls(deps);

buildInputs(deps);
buildTruthTable(deps);
buildExpressions(deps);
buildKarnaughMaps(deps);
syncDisplayFromInput(deps);
