/**
 * Toast notification system for Web4.
 *
 * Extracted into its own module so it can be unit-tested independently
 * of the DOM and the main application state.
 */

export type ToastType = "success" | "error" | "info";

export interface ToastOptions {
    /** How long (ms) before the toast starts fading out. Default 2500. */
    duration?: number;
    /** How long (ms) the fade-out animation runs. Default 300. */
    fadeDuration?: number;
}

export interface ToastInstance {
    /** The created DOM element (for inspection in tests). */
    element: HTMLDivElement;
    /** Cancel auto-dismiss (for tests that need to check timing). */
    cancel: () => void;
}

/**
 * Create a toast notification and append it to the given container.
 *
 * @param container - The DOM element to append the toast to.
 * @param message  - Text content of the toast.
 * @param type     - Visual variant: "success", "error", or "info".
 * @param options  - Timing overrides.
 * @param onRemove - Optional callback when the toast is removed from the DOM.
 * @returns        - The toast instance (element + cancel handle).
 */
export function createToast(
    container: Element,
    message: string,
    type: ToastType = "info",
    options: ToastOptions = {},
    onRemove?: () => void,
    doc: { createElement(tag: string): any } = document
): ToastInstance {
    const { duration = 2500, fadeDuration = 300 } = options;

    const toast = doc.createElement("div");
    toast.className = `w4-toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;

    function dismiss() {
        toast.classList.add("toast-out");
        removeTimer = setTimeout(() => {
            toast.remove();
            onRemove?.();
        }, fadeDuration);
    }

    fadeTimer = setTimeout(dismiss, duration);

    function cancel() {
        if (fadeTimer !== null) clearTimeout(fadeTimer);
        if (removeTimer !== null) clearTimeout(removeTimer);
    }

    return { element: toast, cancel };
}

/**
 * Factory that binds toast creation to a specific container element.
 * Returns a `showToast` function suitable for the application.
 */
export function createToastEmitter(
    containerId: string
): (message: string, type?: ToastType) => void {
    return (message: string, type: ToastType = "info") => {
        const container = document.getElementById(containerId);
        if (!container) return;
        createToast(container, message, type);
    };
}
