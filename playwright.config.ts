import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke configuration.
 *
 * The suite answers one question — does every screen load in a real browser
 * without throwing — and it answers it on a phone as well as a desktop. That
 * second viewport is not decoration: the bugs that reached users here were
 * phone-only, so a suite that only ever ran at 1280px would have missed them.
 */
export default defineConfig({
    testDir: './e2e',
    // A test left focused locally must not silently narrow the CI run.
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list'], ['html', { open: 'never' }]],

    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },

    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],

    /**
     * Port 3000 is pinned in vite.config.ts because the backend's dev profile
     * allows exactly http://localhost:3000 for the WebSocket handshake. Playwright
     * must not pick its own port, and an already-running dev server is reused
     * locally so a run does not fight the one the developer has open.
     */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
});
