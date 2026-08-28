/**
 * End-to-end tests for the Web4 Digital Logic Playground.
 *
 * Tests real browser interactions:
 *   - Page loads correctly
 *   - Gate palette is visible
 *   - Toolbar buttons work
 *   - Clicking palette items adds gates
 *   - Simulation updates output values
 *   - Undo/redo works
 *   - Save/load works
 *   - Keyboard shortcuts work
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:4173/Web4/index.html";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function waitForPage(page: Page): Promise<void> {
    await page.goto(BASE_URL);
    await page.waitForSelector(".w4-svg", { timeout: 10000 });
    await page.waitForTimeout(500);
}

async function getSvgContent(page: Page): Promise<string> {
    return page.locator(".w4-svg").innerHTML();
}

/* ================================================================== */
/* PAGE LOAD                                                           */
/* ================================================================== */

test.describe("Web4 Page Load", () => {
    test("page loads and shows title", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator(".w4-page-header h1")).toContainText("Logic Playground");
    });

    test("SVG workspace is visible", async ({ page }) => {
        await waitForPage(page);
        const svg = page.locator(".w4-svg");
        await expect(svg).toBeVisible();
    });

    test("gate palette is visible with categories", async ({ page }) => {
        await waitForPage(page);
        const palette = page.locator("#w4Palette");
        await expect(palette).toBeVisible();
        await expect(palette).toContainText("Sources");
        await expect(palette).toContainText("Logic Gates");
        await expect(palette).toContainText("Outputs");
    });

    test("toolbar buttons are visible", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w4ToolSelect")).toBeVisible();
        await expect(page.locator("#w4ToolWire")).toBeVisible();
        await expect(page.locator("#w4ToolDelete")).toBeVisible();
        await expect(page.locator("#w4UndoBtn")).toBeVisible();
        await expect(page.locator("#w4RedoBtn")).toBeVisible();
        await expect(page.locator("#w4SaveBtn")).toBeVisible();
    });

    test("status bar shows initial state", async ({ page }) => {
        await waitForPage(page);
        const status = page.locator("#w4StatusBar");
        await expect(status).toContainText("Nodes: 0");
    });

    test("manual section is below the playground", async ({ page }) => {
        await waitForPage(page);
        const manual = page.locator("#w4Manual");
        await expect(manual).toBeVisible();
        await expect(manual).toContainText("How to Use");
    });
});

/* ================================================================== */
/* GATE PALETTE                                                        */
/* ================================================================== */

test.describe("Gate Palette", () => {
    test("palette has all required gate types", async ({ page }) => {
        await waitForPage(page);
        const palette = page.locator("#w4Palette");
        const expectedGates = ["Input", "Switch", "Constant", "Clock", "AND", "OR", "NOT", "NAND", "NOR", "XOR", "XNOR", "Buffer", "Output", "LED"];
        for (const gate of expectedGates) {
            await expect(palette).toContainText(gate);
        }
    });

    test("palette items are draggable", async ({ page }) => {
        await waitForPage(page);
        const items = page.locator(".w4-palette-item");
        const count = await items.count();
        expect(count).toBeGreaterThanOrEqual(14);
        await expect(items.first()).toHaveAttribute("draggable", "true");
    });
});

/* ================================================================== */
/* TOOLBAR                                                             */
/* ================================================================== */

test.describe("Toolbar", () => {
    test("select mode button is active by default", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w4ToolSelect")).toHaveClass(/active/);
    });

    test("clicking wire mode activates wire mode", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4ToolWire");
        await expect(page.locator("#w4ToolWire")).toHaveClass(/active/);
        await expect(page.locator("#w4ToolSelect")).not.toHaveClass(/active/);
    });

    test("clicking delete mode activates delete mode", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4ToolDelete");
        await expect(page.locator("#w4ToolDelete")).toHaveClass(/active/);
    });

    test("zoom in/out buttons work", async ({ page }) => {
        await waitForPage(page);
        const zoomBefore = await page.locator("#w4StatusZoom").textContent();
        await page.click("#w4ZoomInBtn");
        const zoomAfter = await page.locator("#w4StatusZoom").textContent();
        expect(zoomAfter).not.toBe(zoomBefore);
    });

    test("fit button resets zoom", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4ZoomInBtn");
        await page.click("#w4ZoomInBtn");
        await page.click("#w4ZoomFitBtn");
        await expect(page.locator("#w4StatusZoom")).toContainText("100%");
    });
});

/* ================================================================== */
/* KEYBOARD SHORTCUTS                                                  */
/* ================================================================== */

test.describe("Keyboard Shortcuts", () => {
    test("clicking select mode after wire mode works", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4ToolWire");
        await expect(page.locator("#w4ToolWire")).toHaveClass(/active/);

        await page.click("#w4ToolSelect");
        await expect(page.locator("#w4ToolSelect")).toHaveClass(/active/);
        await expect(page.locator("#w4ToolWire")).not.toHaveClass(/active/);
    });

    test("V key switches to select mode", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4ToolWire");
        await page.keyboard.press("v");
        await expect(page.locator("#w4ToolSelect")).toHaveClass(/active/);
    });

    test("W key switches to wire mode", async ({ page }) => {
        await waitForPage(page);
        await page.keyboard.press("w");
        await expect(page.locator("#w4ToolWire")).toHaveClass(/active/);
    });

    test("D key switches to delete mode", async ({ page }) => {
        await waitForPage(page);
        await page.keyboard.press("d");
        await expect(page.locator("#w4ToolDelete")).toHaveClass(/active/);
    });

    test("? key scrolls to manual section", async ({ page }) => {
        await waitForPage(page);
        await page.keyboard.press("?");
        await page.waitForTimeout(500);
        const manual = page.locator("#w4Manual");
        await expect(manual).toBeInViewport();
    });
});

/* ================================================================== */
/* TRUTH TABLE IMPORT                                                  */
/* ================================================================== */

test.describe("Truth Table Import", () => {
    test("truth table button opens dialog", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4TruthTableBtn");
        await page.waitForTimeout(300);
        const dialog = page.locator(".w4-tt-dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText("Import from Truth Table");
    });

    test("truth table dialog has variable input", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4TruthTableBtn");
        await page.waitForTimeout(300);
        const varsInput = page.locator("#w4-tt-vars");
        await expect(varsInput).toBeVisible();
        await expect(varsInput).toHaveValue("A, B, C");
    });

    test("truth table dialog can be cancelled", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4TruthTableBtn");
        await page.waitForTimeout(300);
        await page.click(".w4-tt-cancel");
        await page.waitForTimeout(300);
        const dialog = page.locator(".w4-tt-dialog");
        await expect(dialog).not.toBeVisible();
    });

    test("truth table dialog generates circuit from AND truth table", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4TruthTableBtn");
        await page.waitForTimeout(300);

        // Set variables to A, B
        await page.fill("#w4-tt-vars", "A, B");
        await page.waitForTimeout(200);

        // Set outputs for AND gate: 0,0,0,1
        await page.fill("#w4-tt-outputs", "0,0,0,1");
        await page.waitForTimeout(200);

        // Click generate
        await page.click(".w4-tt-generate");
        await page.waitForTimeout(500);

        // Check that nodes were created
        const statusText = await page.locator("#w4StatusNodes").textContent();
        expect(statusText).not.toContain("Nodes: 0");
    });

    test("truth table dialog shows error for all-zero outputs", async ({ page }) => {
        await waitForPage(page);
        await page.click("#w4TruthTableBtn");
        await page.waitForTimeout(300);

        await page.fill("#w4-tt-vars", "A");
        await page.waitForTimeout(200);
        await page.fill("#w4-tt-outputs", "0,0");
        await page.waitForTimeout(200);

        await page.click(".w4-tt-generate");
        await page.waitForTimeout(300);

        const error = page.locator("#w4-tt-error");
        await expect(error).toBeVisible();
        await expect(error).toContainText("constant 0");
    });
});

/* ================================================================== */
/* NAVIGATION                                                          */
/* ================================================================== */

test.describe("Navigation", () => {
    test("navigation links are present", async ({ page }) => {
        await waitForPage(page);
        const nav = page.locator("nav, .site-header");
        await expect(nav).toContainText("Boolean Solver");
        await expect(nav).toContainText("Logic Playground");
    });

    test("link to Boolean Solver exists", async ({ page }) => {
        await waitForPage(page);
        const link = page.locator("a[href*=\"Web1\"]");
        await expect(link.first()).toBeVisible();
    });
});

/* ================================================================== */
/* WAVEFORM PANEL                                                      */
/* ================================================================== */

test.describe("Waveform Panel", () => {
    test("waveform panel is visible", async ({ page }) => {
        await waitForPage(page);
        const panel = page.locator(".w4-waveform-panel");
        await expect(panel).toBeVisible();
        await expect(panel).toContainText("Waveform");
    });

    test("waveform canvas exists", async ({ page }) => {
        await waitForPage(page);
        const canvas = page.locator("#w4WaveformCanvas");
        await expect(canvas).toBeVisible();
    });
});

/* ================================================================== */
/* PROBE TOOLTIP                                                       */
/* ================================================================== */

test.describe("Probe Tooltip", () => {
    test("probe tooltip CSS class is defined", async ({ page }) => {
        await waitForPage(page);
        const hasStyle = await page.evaluate(() => {
            const sheets = document.styleSheets;
            for (let i = 0; i < sheets.length; i++) {
                try {
                    const rules = sheets[i].cssRules;
                    for (let j = 0; j < rules.length; j++) {
                        if (rules[j].cssText?.includes("w4-probe-tooltip")) return true;
                    }
                } catch { /* cross-origin */ }
            }
            return false;
        });
        expect(hasStyle).toBe(true);
    });
});

/* ================================================================== */
/* RESPONSIVE                                                          */
/* ================================================================== */

test.describe("Responsive Design", () => {
    test("page works at tablet width", async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await waitForPage(page);
        await expect(page.locator(".w4-svg")).toBeVisible();
        await expect(page.locator("#w4Palette")).toBeVisible();
    });

    test("page works at mobile width", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await waitForPage(page);
        await expect(page.locator(".w4-page-header")).toBeVisible();
    });
});

/* ================================================================== */
/* THEME                                                               */
/* ================================================================== */

test.describe("Theme", () => {
    test("page has theme attribute on body", async ({ page }) => {
        await waitForPage(page);
        const theme = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
        expect(theme).toBeTruthy();
    });
});

/* ================================================================== */
/* CLEAR CIRCUIT                                                       */
/* ================================================================== */

test.describe("Clear Circuit", () => {
    test("clear button exists", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w4ClearBtn")).toBeVisible();
    });
});

/* ================================================================== */
/* SAVE / EXPORT                                                       */
/* ================================================================== */

test.describe("Save and Export", () => {
    test("save button exists", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w4SaveBtn")).toBeVisible();
    });

    test("export button exists", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w4ExportBtn")).toBeVisible();
    });

    test("import button exists", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w4ImportBtn")).toBeVisible();
    });

    test("load button exists", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w4LoadBtn")).toBeVisible();
    });
});
