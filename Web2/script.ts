/**
 * Web2 — Combinational Circuits Simulator entry point.
 *
 * This file wires together the modular components:
 *   src/types.ts     — shared type definitions
 *   src/gates.ts     — SVG gate and wire rendering helpers
 *   src/circuits.ts  — CIRCUITS (18 circuits) + CATEGORIES definitions
 *   src/ui.ts        — UI logic (waveform, input buttons, truth table,
 *                      expressions, zoom/pan, ripple animation, navigation)
 *
 * All heavy logic lives in the modules above. This file is responsible
 * only for DOM element lookup, state initialization, and wiring events.
 */

import { CIRCUITS, CATEGORIES } from "./src/circuits";
import {
    setupRippleAnimation,
    setupNavigation,
    setupZoomPan,
} from "./src/ui";
import type { UIDependencies } from "./src/ui";

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

const els = {
    circuitTitle:          byId("circuitTitle"),
    breadcrumbCategory:    byId("breadcrumbCategory"),
    inputControls:         byId("inputControls"),
    rippleControls:        byId("rippleControls"),
    rippleAnimateBtn:      byId<HTMLButtonElement>("rippleAnimateBtn"),
    rippleStepBadge:       byId("rippleStepBadge"),
    circuitDiagram:        byId("circuitDiagram"),
    truthTable:            byId("truthTable"),
    booleanExpressions:    byId("booleanExpressions"),
    verilogCode:           byId("verilogCode"),
    copyVerilogBtn:        byId<HTMLButtonElement>("copyVerilogBtn"),
    timingCanvas:          byId<HTMLCanvasElement>("timingCanvas"),
    zoomInBtn:             byId<HTMLButtonElement>("zoomInBtn"),
    zoomOutBtn:            byId<HTMLButtonElement>("zoomOutBtn"),
    zoomResetBtn:          byId<HTMLButtonElement>("zoomResetBtn"),
    step1:                 byId("step1"),
    step2:                 byId("step2"),
    step3:                 byId("step3"),
    step2Title:            byId("step2Title"),
    subcategoryGrid:       byId("subcategoryGrid"),
    backToStep2:           byId<HTMLButtonElement>("backToStep2"),
};

/* ------------------------------------------------------------------ */
/* SHARED STATE                                                        */
/* ------------------------------------------------------------------ */

const state = {
    currentCircuit: null as any,
    currentInputs: {} as Record<string, number>,
    zoomScale: 1.0,
    panX: 0,
    panY: 0,
    waveformHistory: [] as { time: number; signals: Record<string, number> }[],
    waveTimeCounter: 0,
};

/* ------------------------------------------------------------------ */
/* DEPENDENCY INJECTION                                                */
/* ------------------------------------------------------------------ */

const deps: UIDependencies = {
    els,
    state,
    sfx: window.StudioFX ?? null,
    circuits: CIRCUITS,
    categories: CATEGORIES,
};

/* ------------------------------------------------------------------ */
/* WIRE UP EVENT LISTENERS                                             */
/* ------------------------------------------------------------------ */

setupRippleAnimation(deps);
setupNavigation(deps);
setupZoomPan(deps);
