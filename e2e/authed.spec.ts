import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const USERNAME = process.env.E2E_USERNAME;
const PASSWORD = process.env.E2E_PASSWORD;

/**
 * Signs in through the form rather than writing the token straight into storage.
 *
 * Storage would be quicker, and the app would accept it — `isAuthenticated` only
 * checks that a token is present. But then the login screen itself, which every
 * user meets first, would never be exercised by anything.
 */
async function login(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByLabel(/Потребителско име/).fill(USERNAME!);
    await page.getByLabel(/Парола/).first().fill(PASSWORD!);
    await page.getByRole('button', { name: 'Влез' }).click();
    await expect(page.getByRole('heading', { name: 'Избери игра' })).toBeVisible();
}

/**
 * The screens behind the login, against a running backend.
 *
 * Skipped unless a throwaway account is supplied, so a fresh clone and CI still
 * run the public tier green rather than reporting a failure that only means
 * "no server here".
 *
 * What this does not reach: the табла board. A game route with no live game
 * renders the queue screen, and `TablaBoard` only mounts once two players are
 * matched — so the crash class that lived there is still uncovered. That needs
 * the two-player flow, which is not this slice.
 */
test.describe('screens behind the login', () => {
    test.skip(!USERNAME || !PASSWORD, 'set E2E_USERNAME and E2E_PASSWORD, with a backend on :8080');

    test.beforeEach(async ({ page }) => {
        await login(page);
    });

    test('game hub', async ({ page }) => {
        await expect(page.getByRole('button', { name: /Сантасе/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Табла/ })).toBeVisible();
    });

    test('santase route mounts', async ({ page }) => {
        await page.goto('/play/santase');
        await expect(page).toHaveURL(/\/play\/santase$/);
        await expect(page.locator('.screen')).toBeVisible();
    });

    test('tabla route mounts', async ({ page }) => {
        await page.goto('/play/tabla');
        await expect(page).toHaveURL(/\/play\/tabla$/);
        await expect(page.locator('.screen')).toBeVisible();
    });
});
