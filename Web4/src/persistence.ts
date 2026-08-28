/**
 * Circuit save/load/export/import for Web4.
 */

import type { PlaygroundNode, Wire, PlaygroundCircuit } from "./types";

const STORAGE_KEY = "w4_circuit_save";

export interface CircuitFile {
    id: string;
    name: string;
    version: number;
    nodes: PlaygroundNode[];
    wires: Wire[];
    inputNodeIds: string[];
    outputNodeIds: string[];
    savedAt: string;
}

/** Save circuit to localStorage. */
export function saveToLocalStorage(circuit: CircuitFile): void {
    try {
        const data: CircuitFile = {
            ...circuit,
            savedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save circuit:", e);
        throw new Error("Could not save circuit to local storage.");
    }
}

/** Load circuit from localStorage. */
export function loadFromLocalStorage(): CircuitFile | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as CircuitFile;
    } catch {
        return null;
    }
}

/** Export circuit as downloadable JSON file. */
export function exportAsJSON(circuit: CircuitFile, filename?: string): void {
    const data = {
        ...circuit,
        exportedAt: new Date().toISOString(),
        format: "dc-playground-v1",
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `${circuit.name || "circuit"}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/** Import circuit from a JSON string. */
export function importFromJSON(json: string): CircuitFile | null {
    try {
        const data = JSON.parse(json);

        // Validate basic structure
        if (!data.nodes || !Array.isArray(data.nodes)) return null;
        if (!data.wires || !Array.isArray(data.wires)) return null;

        return {
            id: data.id || `imported_${Date.now()}`,
            name: data.name || "Imported Circuit",
            version: data.version || 1,
            nodes: data.nodes,
            wires: data.wires,
            inputNodeIds: data.inputNodeIds || [],
            outputNodeIds: data.outputNodeIds || [],
            savedAt: data.savedAt || new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

/** Import from a file input. */
export function importFromFile(file: File): Promise<CircuitFile | null> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = importFromJSON(reader.result as string);
            resolve(result);
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
    });
}

/** Clear saved circuit from localStorage. */
export function clearSavedCircuit(): void {
    localStorage.removeItem(STORAGE_KEY);
}

/** Get the last saved circuit info. */
export function getLastSaveInfo(): { name: string; savedAt: string } | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return { name: data.name, savedAt: data.savedAt };
    } catch {
        return null;
    }
}
