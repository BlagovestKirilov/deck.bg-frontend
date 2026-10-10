import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * The lobby survives an API answer that is not what it asked for.
 *
 * Production went blank after the first login: `/api/belot/` had no location
 * in nginx, so `/api/belot/profile` fell through to the site and came back as
 * index.html with a 200. The lobby read a rank off that page and threw, and
 * with nothing to catch it the whole app unmounted. A refresh hid it, because
 * by then the tab remembered belot was not on offer and stopped asking.
 *
 * Runs with no backend: every call to it is answered here.
 */
const API = 'http://localhost:8080';

const RECORD = { wins: 3, losses: 1, rank: 'SILVER', placementGamesRemaining: 0 };

async function signedInFirstVisit(page: Page, belotProfile: { contentType: string; body: string }) {
    // Signed in, with nothing remembered about which games are on offer —
    // a fresh tab right after logging in.
    await page.addInitScript(() => {
        localStorage.setItem('token', 'e2e-token');
        localStorage.setItem('username', 'petko91');
    });

    await page.route(`${API}/user/profile`, (route) =>
        route.fulfill({
            json: {
                santaseWins: 3, santaseLosses: 1, rank: 'SILVER', isEmailConfirmed: true,
                stats: { SANTASE: RECORD, TABLA: RECORD },
            },
        }));

    // Arrives after the lobby has already drawn every game and asked for each
    // record, which is the order production saw.
    await page.route(`${API}/services`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.fulfill({ json: { services: ['SANTASE', 'TABLA', 'BELOT'] } });
    });

    await page.route(`${API}/belot/profile`, (route) =>
        route.fulfill({ status: 200, contentType: belotProfile.contentType, body: belotProfile.body }));
}

test.describe('the lobby and a wrong answer', () => {
    test('a web page where the belot record should be', async ({ page }) => {
        await signedInFirstVisit(page, {
            contentType: 'text/html',
            body: '<!doctype html><html><head><title>DECK.bg</title></head><body><div id="root"></div></body></html>',
        });

        await page.goto('/');

        await expect(page.getByRole('heading', { name: 'Избери игра' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Белот/ })).toBeVisible();
        // Past the moment the services answer arrives, still standing.
        await page.waitForTimeout(1200);
        await expect(page.getByRole('heading', { name: 'Избери игра' })).toBeVisible();
    });

    test('a rank this client does not know', async ({ page }) => {
        await signedInFirstVisit(page, {
            contentType: 'application/json',
            body: JSON.stringify({ games: 4, wins: 3, losses: 1, rank: 'MYTHIC', placementGamesRemaining: 0 }),
        });

        await page.goto('/');

        await expect(page.getByRole('button', { name: /Белот/ })).toBeVisible();
        await page.waitForTimeout(1200);
        await expect(page.getByRole('heading', { name: 'Избери игра' })).toBeVisible();
    });
});
