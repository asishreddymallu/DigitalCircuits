/** Tiny DOM helpers shared by the UI modules. */

export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing #${id} — index.html is out of sync with script.js`);
    return el as T;
}

export function maybeById<T extends HTMLElement = HTMLElement>(id: string): T | null {
    return document.getElementById(id) as T | null;
}

/**
 * Build a DOM element with optional class/text. Used anywhere untrusted or
 * model-derived strings are displayed, so no innerHTML path is needed.
 */
export function el(tag: string, className?: string, text?: string): HTMLElement {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

/**
 * Escape HTML special characters to prevent XSS when inserting
 * user-controlled or model-derived strings into innerHTML templates.
 *
 * This is defense-in-depth: the tokenizer already restricts variable names
 * to [A-Za-z0-9_], but this guard protects against future regressions or
 * any string that slips through.
 */
export function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
