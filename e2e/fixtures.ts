import { test as base, expect } from '@playwright/test';

/**
 * Requests that are expected to fail when the suite runs without a backend.
 *
 * The public tier deliberately runs with nothing on :8080, so the API calls and
 * the game socket cannot connect. Those failures are the arrangement, not a
 * defect, and matching them by URL keeps the allowance narrow — a broken request
 * to the app's own origin still fails the test.
 */
const ALLOWED_URL_PARTS = [
    'localhost:8080',
    '/ws-game',
    'sockjs',
];

/**
 * Console noise that says nothing about the application.
 *
 * Kept deliberately short. Every entry here is a place the suite has agreed to
 * look away, so the list earns its length one line at a time.
 */
const ALLOWED_CONSOLE_PARTS = [
    'Download the React DevTools',
];

/** A navigation cancels whatever the old page had in flight. Not a failure. */
const ALLOWED_FAILURES = ['net::ERR_ABORTED'];

const matches = (text: string, parts: string[]): boolean =>
    parts.some((part) => text.toLowerCase().includes(part.toLowerCase()));

/**
 * The ordinary Playwright test, with the browser's own complaints treated as
 * test failures.
 *
 * This is the reason the suite exists. `vite build` strips types without
 * checking them and there is no `typescript` dependency to check them with, so
 * a type error or a reference to a binding before its declaration builds
 * perfectly and throws on load. Nothing but loading the page in a real browser
 * finds that, and nothing but watching for `pageerror` reports it.
 *
 * An uncaught exception is never allowed, whatever it says. Console errors and
 * failed requests are allowed only against the lists above.
 */
export const test = base.extend({
    page: async ({ page }, use) => {
        const problems: string[] = [];

        page.on('pageerror', (error) => {
            problems.push(`uncaught: ${error.message}`);
        });

        page.on('console', (message) => {
            if (message.type() !== 'error') return;
            const text = message.text();
            const from = message.location().url ?? '';
            if (matches(text, ALLOWED_CONSOLE_PARTS)) return;
            if (matches(text, ALLOWED_URL_PARTS) || matches(from, ALLOWED_URL_PARTS)) return;
            problems.push(`console.error: ${text}`);
        });

        page.on('requestfailed', (request) => {
            const url = request.url();
            const reason = request.failure()?.errorText ?? '';
            if (matches(url, ALLOWED_URL_PARTS)) return;
            if (matches(reason, ALLOWED_FAILURES)) return;
            problems.push(`request failed: ${url} (${reason})`);
        });

        await use(page);

        expect(problems, 'the browser reported errors while the test ran').toEqual([]);
    },
});

export { expect };
