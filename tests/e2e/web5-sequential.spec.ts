/**
 * End-to-end tests for the Web5 Sequential Circuits Simulator.
 *
 * Tests real browser interactions:
 *   - Page loads correctly
 *   - Clock panel and controls exist
 *   - All four flip-flop panels render with schematics
 *   - Input toggles update badges
 *   - Clock stepping updates waveform canvases
 *   - Keyboard shortcuts work
 */

import { test, expect, type Page } from "@playwright/test";

const BASE_URL = "http://localhost:4173/Web5/index.html";

async function waitForPage(page: Page): Promise<void> {
    await page.goto(BASE_URL);
    await page.waitForSelector(".w5-panel", { timeout: 10000 });
    await page.waitForTimeout(400);
}

/* ================================================================== */
/* PAGE LOAD                                                           */
/* ================================================================== */

test.describe("Web5 Page Load", () => {
    test("page loads and shows title", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator(".w4-page-header h1")).toContainText("Sequential Circuits Simulator");
    });

    test("clock panel is visible with controls", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w5ClockPanel")).toBeVisible();
        await expect(page.locator("#w5ClockRun")).toBeVisible();
        await expect(page.locator("#w5ClockStep")).toBeVisible();
        await expect(page.locator("#w5ClockReset")).toBeVisible();
    });

    test("all four flip-flop panels are present", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w5Panel-SR")).toBeVisible();
        await expect(page.locator("#w5Panel-JK")).toBeVisible();
        await expect(page.locator("#w5Panel-T")).toBeVisible();
        await expect(page.locator("#w5Panel-D")).toBeVisible();
    });

    test("each panel has a schematic and a waveform canvas", async ({ page }) => {
        await waitForPage(page);
        for (const kind of ["SR", "JK", "T", "D"]) {
            await expect(page.locator(`#w5Schematic-${kind} svg`)).toBeVisible();
            await expect(page.locator(`#w5Wave-${kind}`)).toBeVisible();
        }
    });

    test("manual section exists", async ({ page }) => {
        await waitForPage(page);
        await expect(page.locator("#w5Manual")).toBeVisible();
        await expect(page.locator("#w5Manual")).toContainText("How the Sequential Simulator Works");
    });
});

/* ================================================================== */
/* INPUT TOGGLES                                                       */
/* ================================================================== */

test.describe("Web5 Input Toggles", () => {
    test("SR input buttons toggle their badge values", async ({ page }) => {
        await waitForPage(page);
        const sBtn = page.locator('#w5Panel-SR .w5-in-btn[data-input="S"]');
        await expect(sBtn).toContainText("0");
        await sBtn.click();
        await expect(sBtn).toContainText("1");
        await sBtn.click();
        await expect(sBtn).toContainText("0");
    });

    test("invalid SR combination shows INVALID marker in schematic", async ({ page }) => {
        await waitForPage(page);
        await page.locator('#w5Panel-SR .w5-in-btn[data-input="S"]').click();
        await page.locator('#w5Panel-SR .w5-in-btn[data-input="R"]').click();
        await page.waitForTimeout(200);
        const schematic = page.locator("#w5Schematic-SR");
        await expect(schematic).toContainText("INVALID INPUTS");
    });

    test("per-panel reset restores Q=0 and clears inputs", async ({ page }) => {
        await waitForPage(page);
        const sBtn = page.locator('#w5Panel-SR .w5-in-btn[data-input="S"]');
        await sBtn.click();
        await page.locator("#w5ClockStep").click(); // falling edge
        await page.locator("#w5ClockStep").click(); // rising
        await page.locator("#w5ClockStep").click(); // falling → Q=1
        await page.waitForTimeout(200);
        await expect(page.locator("#w5Q-SR")).toContainText("1");

        await page.locator('#w5Panel-SR .w5-ff-reset').click();
        await page.waitForTimeout(200);
        await expect(page.locator("#w5Q-SR")).toContainText("0");
        await expect(sBtn).toContainText("0");
    });
});

/* ================================================================== */
/* CLOCK ENGINE                                                        */
/* ================================================================== */

test.describe("Web5 Clock Engine", () => {
    test("pause/run button toggles label", async ({ page }) => {
        await waitForPage(page);
        const runBtn = page.locator("#w5ClockRun");
        await expect(runBtn).toContainText("Pause");
        await runBtn.click();
        await expect(runBtn).toContainText("Run");
        await runBtn.click();
        await expect(runBtn).toContainText("Pause");
    });

    test("step advances the tick counter", async ({ page }) => {
        await waitForPage(page);
        await page.locator("#w5ClockRun").click(); // pause
        const before = Number(await page.locator("#w5TickCounter").textContent());
        await page.locator("#w5ClockStep").click();
        const after = Number(await page.locator("#w5TickCounter").textContent());
        expect(after).toBe(before + 1);
    });

    test("D flip-flop captures D at the falling edge", async ({ page }) => {
        await waitForPage(page);
        await page.locator("#w5ClockRun").click(); // pause first

        // Set D=1, then drive a full falling edge (rise then fall)
        await page.locator('#w5Panel-D .w5-in-btn[data-input="D"]').click();
        await page.locator("#w5ClockStep").click(); // rise
        await page.locator("#w5ClockStep").click(); // fall → Q=1
        await page.waitForTimeout(200);
        await expect(page.locator("#w5Q-D")).toContainText("1");

        // D=0, another falling edge → Q=0
        await page.locator('#w5Panel-D .w5-in-btn[data-input="D"]').click();
        await page.locator("#w5ClockStep").click(); // rise
        await page.locator("#w5ClockStep").click(); // fall → Q=0
        await page.waitForTimeout(200);
        await expect(page.locator("#w5Q-D")).toContainText("0");
    });

    test("speed buttons switch active state", async ({ page }) => {
        await waitForPage(page);
        const fast = page.locator('.w5-speed-btn[data-speed="fast"]');
        await fast.click();
        await expect(fast).toHaveClass(/active/);
    });

    test("reset all clears Q badges", async ({ page }) => {
        await waitForPage(page);
        await page.locator("#w5ClockRun").click(); // pause
        await page.locator('#w5Panel-T .w5-in-btn[data-input="T"]').click();
        await page.locator("#w5ClockStep").click();
        await page.locator("#w5ClockStep").click();
        await page.waitForTimeout(200);
        await expect(page.locator("#w5Q-T")).toContainText("1");

        await page.locator("#w5ClockReset").click();
        await page.waitForTimeout(200);
        await expect(page.locator("#w5Q-T")).toContainText("0");
    });
});

/* ================================================================== */
/* KEYBOARD                                                            */
/* ================================================================== */

test.describe("Web5 Keyboard", () => {
    test("space toggles run state", async ({ page }) => {
        await waitForPage(page);
        const runBtn = page.locator("#w5ClockRun");
        await expect(runBtn).toContainText("Pause");
        await page.keyboard.press(" ");
        await expect(runBtn).toContainText("Run");
        await page.keyboard.press(" ");
        await expect(runBtn).toContainText("Pause");
    });

    test("N key steps while paused", async ({ page }) => {
        await waitForPage(page);
        await page.locator("#w5ClockRun").click(); // pause
        const before = Number(await page.locator("#w5TickCounter").textContent());
        await page.keyboard.press("n");
        const after = Number(await page.locator("#w5TickCounter").textContent());
        expect(after).toBe(before + 1);
    });
});

/* ================================================================== */
/* NAVIGATION                                                          */
/* ================================================================== */

test.describe("Web5 Navigation", () => {
    test("nav links include all suite tools", async ({ page }) => {
        await waitForPage(page);
        const nav = page.locator("nav");
        await expect(nav).toContainText("Boolean Solver");
        await expect(nav).toContainText("Logic Playground");
        await expect(nav).toContainText("Sequential");
    });
});
