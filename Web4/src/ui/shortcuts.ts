/**
 * Keyboard shortcut mapping for Web4.
 *
 * Extracted into its own module so the key→action mapping can be
 * unit-tested without a browser event loop.
 */

export interface ShortcutAction {
    /** Human-readable description for help text. */
    description: string;
    /** The key (lowercase) to match. */
    key: string;
    /** Whether Ctrl/Cmd must be held. */
    ctrl?: boolean;
    /** Whether Shift must be held (in addition to Ctrl if ctrl=true). */
    shift?: boolean;
    /** Whether Alt must be held. */
    alt?: boolean;
}

/**
 * All registered keyboard shortcuts for the Web4 playground.
 */
export const SHORTCUTS: ShortcutAction[] = [
    { key: "v",               description: "Select mode" },
    { key: "w",               description: "Wire mode" },
    { key: "d",               description: "Delete mode" },
    { key: "delete",          description: "Delete selected" },
    { key: "backspace",       description: "Delete selected" },
    { key: "z", ctrl: true,                description: "Undo" },
    { key: "z", ctrl: true, shift: true,   description: "Redo" },
    { key: "z", ctrl: true, shift: false,  description: "Undo" },
    { key: "s", ctrl: true,                description: "Save" },
    { key: "escape",          description: "Cancel / Deselect" },
    { key: " ",               description: "Toggle waveform pause" },
    { key: "?",               description: "Scroll to manual" },
];

/**
 * Match a KeyboardEvent against a ShortcutAction.
 */
export function matchesShortcut(
    e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">,
    shortcut: ShortcutAction
): boolean {
    const keyMatch = e.key.toLowerCase() === shortcut.key;
    const ctrlMatch = shortcut.ctrl
        ? (e.ctrlKey || e.metaKey)
        : !(e.ctrlKey || e.metaKey);
    const shiftMatch = shortcut.shift !== undefined
        ? e.shiftKey === shortcut.shift
        : true;
    const altMatch = shortcut.alt ? e.altKey : !e.altKey;

    return keyMatch && ctrlMatch && shiftMatch && altMatch;
}

/**
 * Find the matching shortcut for a keyboard event, or null.
 */
export function resolveShortcut(
    e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">
): ShortcutAction | null {
    // Check Ctrl+Z / Ctrl+Shift+Z first (order-sensitive)
    const ctrlZ = SHORTCUTS.find(
        s => s.key === "z" && s.ctrl && s.shift === false
    );
    const ctrlShiftZ = SHORTCUTS.find(
        s => s.key === "z" && s.ctrl && s.shift === true
    );

    if (ctrlShiftZ && matchesShortcut(e, ctrlShiftZ)) return ctrlShiftZ;
    if (ctrlZ && matchesShortcut(e, ctrlZ)) return ctrlZ;

    // Check all others
    for (const shortcut of SHORTCUTS) {
        if (shortcut.key === "z" && shortcut.ctrl) continue; // already checked
        if (matchesShortcut(e, shortcut)) return shortcut;
    }
    return null;
}

/**
 * Should the event be ignored (e.g. user is typing in an input)?
 */
export function shouldIgnoreKeyEvent(
    target: EventTarget | null
): boolean {
    if (!target) return false;
    const tag = (target as HTMLElement).tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
