/**
 * Shared type definitions for the Web2 combinational circuits simulator.
 */

export interface CircuitDefinition {
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

export interface WaveformPoint {
    time: number;
    signals: Record<string, number>;
}
