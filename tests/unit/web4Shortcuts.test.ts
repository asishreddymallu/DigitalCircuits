/**
 * Tests for the Web4 keyboard shortcut system.
 *
 * Verifies that the key→action mapping correctly identifies shortcuts,
 * handles modifier keys, and maps the "?" key to scrolling the manual.
 */

import { describe, it, expect } from "vitest";
import {
    matchesShortcut,
    resolveShortcut,
    shouldIgnoreKeyEvent,
    SHORTCUTS,
    type ShortcutAction,
} from "../../Web4/src/ui/shortcuts";

/* ------------------------------------------------------------------ */
/* Helper: build a minimal KeyboardEvent-like object                   */
/* ------------------------------------------------------------------ */

function keyEvent(
    key: string,
    opts: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}
): Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"> {
    return {
        key,
        ctrlKey: opts.ctrl ?? false,
        metaKey: opts.meta ?? false,
        shiftKey: opts.shift ?? false,
        altKey: opts.alt ?? false,
    };
}

/* ------------------------------------------------------------------ */
/* Tests: matchesShortcut                                              */
/* ------------------------------------------------------------------ */

describe("shortcuts: matchesShortcut", () => {
    it("matches simple key (no modifiers)", () => {
        const action: ShortcutAction = { key: "v", description: "Select" };
        expect(matchesShortcut(keyEvent("v"), action)).toBe(true);
        expect(matchesShortcut(keyEvent("V"), action)).toBe(true); // case-insensitive (lowercased)
        expect(matchesShortcut(keyEvent("w"), action)).toBe(false);
    });

    it("matches Ctrl+key", () => {
        const action: ShortcutAction = { key: "z", ctrl: true, description: "Undo" };
        expect(matchesShortcut(keyEvent("z", { ctrl: true }), action)).toBe(true);
        expect(matchesShortcut(keyEvent("z", { meta: true }), action)).toBe(true); // Cmd on Mac
        expect(matchesShortcut(keyEvent("z"), action)).toBe(false); // no modifier
    });

    it("rejects Ctrl+key when ctrl is not required", () => {
        const action: ShortcutAction = { key: "v", description: "Select" };
        expect(matchesShortcut(keyEvent("v", { ctrl: true }), action)).toBe(false);
    });

    it("matches Ctrl+Shift+key", () => {
        const action: ShortcutAction = {
            key: "z",
            ctrl: true,
            shift: true,
            description: "Redo",
        };
        expect(matchesShortcut(keyEvent("z", { ctrl: true, shift: true }), action)).toBe(true);
        expect(matchesShortcut(keyEvent("z", { ctrl: true }), action)).toBe(false);
    });

    it("matches Ctrl+Shift=false key (undo vs redo)", () => {
        const undo: ShortcutAction = {
            key: "z",
            ctrl: true,
            shift: false,
            description: "Undo",
        };
        expect(matchesShortcut(keyEvent("z", { ctrl: true }), undo)).toBe(true);
        expect(matchesShortcut(keyEvent("z", { ctrl: true, shift: true }), undo)).toBe(false);
    });

    it("matches space key", () => {
        const action: ShortcutAction = { key: " ", description: "Pause" };
        expect(matchesShortcut(keyEvent(" "), action)).toBe(true);
        expect(matchesShortcut(keyEvent("Space"), action)).toBe(false);
    });

    it("matches question mark key", () => {
        const action: ShortcutAction = { key: "?", description: "Help" };
        expect(matchesShortcut(keyEvent("?"), action)).toBe(true);
        expect(matchesShortcut(keyEvent("/", { shift: true }), action)).toBe(false);
    });

    it("rejects when Alt is held but not required", () => {
        const action: ShortcutAction = { key: "v", description: "Select" };
        expect(matchesShortcut(keyEvent("v", { alt: true }), action)).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/* Tests: resolveShortcut                                              */
/* ------------------------------------------------------------------ */

describe("shortcuts: resolveShortcut", () => {
    it("resolves Ctrl+Z to Undo", () => {
        const result = resolveShortcut(keyEvent("z", { ctrl: true }));
        expect(result?.description).toBe("Undo");
    });

    it("resolves Ctrl+Shift+Z to Redo", () => {
        const result = resolveShortcut(keyEvent("z", { ctrl: true, shift: true }));
        expect(result?.description).toBe("Redo");
    });

    it("resolves V to Select mode", () => {
        const result = resolveShortcut(keyEvent("v"));
        expect(result?.description).toBe("Select mode");
    });

    it("resolves W to Wire mode", () => {
        const result = resolveShortcut(keyEvent("w"));
        expect(result?.description).toBe("Wire mode");
    });

    it("resolves D to Delete mode", () => {
        const result = resolveShortcut(keyEvent("d"));
        expect(result?.description).toBe("Delete mode");
    });

    it("resolves Delete to Delete selected", () => {
        const result = resolveShortcut(keyEvent("Delete"));
        expect(result?.description).toBe("Delete selected");
    });

    it("resolves Backspace to Delete selected", () => {
        const result = resolveShortcut(keyEvent("Backspace"));
        expect(result?.description).toBe("Delete selected");
    });

    it("resolves Ctrl+S to Save", () => {
        const result = resolveShortcut(keyEvent("s", { ctrl: true }));
        expect(result?.description).toBe("Save");
    });

    it("resolves Escape to Cancel / Deselect", () => {
        const result = resolveShortcut(keyEvent("Escape"));
        expect(result?.description).toBe("Cancel / Deselect");
    });

    it("resolves Space to Toggle waveform pause", () => {
        const result = resolveShortcut(keyEvent(" "));
        expect(result?.description).toBe("Toggle waveform pause");
    });

    it("resolves ? to Scroll to manual", () => {
        const result = resolveShortcut(keyEvent("?"));
        expect(result?.description).toBe("Scroll to manual");
    });

    it("returns null for unrecognized key", () => {
        const result = resolveShortcut(keyEvent("x"));
        expect(result).toBeNull();
    });

    it("returns null for Ctrl+unrecognized key", () => {
        const result = resolveShortcut(keyEvent("x", { ctrl: true }));
        expect(result).toBeNull();
    });

    it("resolves Ctrl+Z even with metaKey (Mac Cmd)", () => {
        const result = resolveShortcut(keyEvent("z", { meta: true }));
        expect(result?.description).toBe("Undo");
    });

    it("prioritizes Redo over Undo when Shift is held", () => {
        const result = resolveShortcut(keyEvent("z", { ctrl: true, shift: true }));
        expect(result?.description).toBe("Redo");
    });
});

/* ------------------------------------------------------------------ */
/* Tests: shouldIgnoreKeyEvent                                         */
/* ------------------------------------------------------------------ */

describe("shortcuts: shouldIgnoreKeyEvent", () => {
    function mockTarget(tagName: string): EventTarget {
        return { tagName } as unknown as EventTarget;
    }

    it("returns true for INPUT elements", () => {
        expect(shouldIgnoreKeyEvent(mockTarget("INPUT"))).toBe(true);
    });

    it("returns true for TEXTAREA elements", () => {
        expect(shouldIgnoreKeyEvent(mockTarget("TEXTAREA"))).toBe(true);
    });

    it("returns true for SELECT elements", () => {
        expect(shouldIgnoreKeyEvent(mockTarget("SELECT"))).toBe(true);
    });

    it("returns false for DIV elements", () => {
        expect(shouldIgnoreKeyEvent(mockTarget("DIV"))).toBe(false);
    });

    it("returns false for null target", () => {
        expect(shouldIgnoreKeyEvent(null)).toBe(false);
    });

    it("returns false for BUTTON elements", () => {
        expect(shouldIgnoreKeyEvent(mockTarget("BUTTON"))).toBe(false);
    });
});

/* ------------------------------------------------------------------ */
/* Tests: SHORTCUTS constant                                           */
/* ------------------------------------------------------------------ */

describe("shortcuts: SHORTCUTS registry", () => {
    it("contains at least 12 shortcuts", () => {
        expect(SHORTCUTS.length).toBeGreaterThanOrEqual(12);
    });

    it("every shortcut has a non-empty description", () => {
        for (const s of SHORTCUTS) {
            expect(s.description.length).toBeGreaterThan(0);
        }
    });

    it("every shortcut has a non-empty key", () => {
        for (const s of SHORTCUTS) {
            expect(s.key.length).toBeGreaterThan(0);
        }
    });

    it("includes ? shortcut for manual scroll", () => {
        const manualShortcut = SHORTCUTS.find(s => s.key === "?");
        expect(manualShortcut).toBeDefined();
        expect(manualShortcut!.description).toBe("Scroll to manual");
    });

    it("includes Space shortcut for waveform pause", () => {
        const spaceShortcut = SHORTCUTS.find(s => s.key === " ");
        expect(spaceShortcut).toBeDefined();
        expect(spaceShortcut!.description).toBe("Toggle waveform pause");
    });

    it("includes all mode-switch shortcuts (V, W, D)", () => {
        const keys = SHORTCUTS.map(s => s.key);
        expect(keys).toContain("v");
        expect(keys).toContain("w");
        expect(keys).toContain("d");
    });
});
