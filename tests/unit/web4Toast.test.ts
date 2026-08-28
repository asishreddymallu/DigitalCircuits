/**
 * Tests for the Web4 toast notification system.
 *
 * Uses minimal DOM mocks (Element, setTimeout) to test the toast
 * creation, styling, and auto-dismiss logic without a real browser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createToast, createToastEmitter, type ToastType } from "../../Web4/src/ui/toast";

/* ------------------------------------------------------------------ */
/* Minimal DOM mock                                                    */
/* ------------------------------------------------------------------ */

class MockElement {
    tagName = "";
    className = "";
    textContent = "";
    children: MockElement[] = [];
    parentElement: MockElement | null = null;
    classList = new MockClassList(this);

    constructor(tagName = "div") {
        this.tagName = tagName;
    }

    appendChild(child: MockElement): MockElement {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    remove(): void {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(c => c !== this);
            this.parentElement = null;
        }
    }
}

class MockClassList {
    private classes: Set<string> = new Set();
    private owner: MockElement;

    constructor(owner: MockElement) {
        this.owner = owner;
        // Sync from initial className
        if (owner.className) {
            owner.className.split(/\s+/).filter(Boolean).forEach(c => this.classes.add(c));
        }
    }

    add(cls: string): void {
        this.classes.add(cls);
        this.owner.className = [...this.classes].join(" ");
    }

    remove(cls: string): void {
        this.classes.delete(cls);
        this.owner.className = [...this.classes].join(" ");
    }

    contains(cls: string): boolean {
        return this.classes.has(cls);
    }
}

const mockDoc = {
    createElement(tag: string): MockElement {
        return new MockElement(tag);
    },
};

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe("toast: createToast", () => {
    let container: MockElement;

    beforeEach(() => {
        vi.useFakeTimers();
        container = new MockElement("div");
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("creates a div with correct class and text", () => {
        const instance = createToast(container as any, "Saved!", "success", {}, undefined, mockDoc as any);
        expect(instance.element.tagName).toBe("div");
        expect(instance.element.className).toBe("w4-toast toast-success");
        expect(instance.element.textContent).toBe("Saved!");
    });

    it("appends the toast to the container", () => {
        const instance = createToast(container as any, "Hello", "info", {}, undefined, mockDoc as any);
        expect(container.children).toContain(instance.element);
    });

    it("applies correct class for each toast type", () => {
        const types: ToastType[] = ["success", "error", "info"];
        for (const type of types) {
            const instance = createToast(container as any, `msg-${type}`, type, {}, undefined, mockDoc as any);
            expect(instance.element.className).toBe(`w4-toast toast-${type}`);
        }
    });

    it("adds toast-out class after duration", () => {
        const instance = createToast(container as any, "Fade me", "info", { duration: 1000 }, undefined, mockDoc as any);
        expect(instance.element.className).not.toContain("toast-out");

        vi.advanceTimersByTime(1000);
        expect(instance.element.className).toContain("toast-out");
    });

    it("removes element from DOM after fade duration", () => {
        const instance = createToast(container as any, "Gone", "error", {
            duration: 500,
            fadeDuration: 200,
        }, undefined, mockDoc as any);

        // Before duration: still in container
        vi.advanceTimersByTime(400);
        expect(container.children).toContain(instance.element);

        // After duration + fade: removed
        vi.advanceTimersByTime(500);
        expect(container.children).not.toContain(instance.element);
    });

    it("cancel prevents auto-dismiss", () => {
        const instance = createToast(container as any, "Stay", "success", { duration: 1000 }, undefined, mockDoc as any);

        vi.advanceTimersByTime(500);
        instance.cancel();

        vi.advanceTimersByTime(5000);
        // toast-out was never added
        expect(instance.element.className).not.toContain("toast-out");
        // element still in container
        expect(container.children).toContain(instance.element);
    });

    it("calls onRemove callback when toast is removed", () => {
        const onRemove = vi.fn();
        createToast(container as any, "Callback test", "info", {
            duration: 100,
            fadeDuration: 50,
        }, onRemove, mockDoc as any);

        expect(onRemove).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100 + 50);
        expect(onRemove).toHaveBeenCalledOnce();
    });

    it("defaults to info type when type is omitted", () => {
        const instance = createToast(container as any, "Default type", undefined, {}, undefined, mockDoc as any);
        expect(instance.element.className).toBe("w4-toast toast-info");
    });

    it("defaults to 2500ms duration", () => {
        const instance = createToast(container as any, "Default duration", "info", {}, undefined, mockDoc as any);

        vi.advanceTimersByTime(2499);
        expect(instance.element.className).not.toContain("toast-out");

        vi.advanceTimersByTime(1);
        expect(instance.element.className).toContain("toast-out");
    });
});

describe("toast: createToastEmitter", () => {
    let container: MockElement;
    const elements = new Map<string, MockElement>();

    beforeEach(() => {
        vi.useFakeTimers();
        container = new MockElement("div");
        elements.set("toastContainer", container);

        // Patch document
        (globalThis as any).document = {
            getElementById: (id: string) => elements.get(id) ?? null,
            createElement: (tag: string) => new MockElement(tag),
        };
    });

    afterEach(() => {
        vi.useRealTimers();
        delete (globalThis as any).document;
    });

    it("creates a function that appends toasts to the container", () => {
        const emit = createToastEmitter("toastContainer");
        emit("Test message", "success");

        expect(container.children.length).toBe(1);
        expect(container.children[0].className).toBe("w4-toast toast-success");
        expect(container.children[0].textContent).toBe("Test message");
    });

    it("silently ignores when container does not exist", () => {
        const emit = createToastEmitter("nonexistent");
        // Should not throw
        emit("Should not appear", "error");
    });

    it("multiple calls create multiple toasts", () => {
        const emit = createToastEmitter("toastContainer");
        emit("First", "info");
        emit("Second", "success");
        emit("Third", "error");

        expect(container.children.length).toBe(3);
        expect(container.children.map(c => c.textContent)).toEqual([
            "First", "Second", "Third"
        ]);
    });
});
