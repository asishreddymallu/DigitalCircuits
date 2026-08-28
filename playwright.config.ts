import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "tests/e2e",
    timeout: 30000,
    retries: 0,
    use: {
        headless: true,
        viewport: { width: 1280, height: 720 },
        actionTimeout: 10000,
    },
    webServer: {
        command: "npx vite --port 4173",
        port: 4173,
        reuseExistingServer: true,
        timeout: 15000,
    },
    projects: [
        { name: "chromium", use: { browserName: "chromium" } },
    ],
});
