import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

/**
 * Opening a game asks "am I already in one?" over plain HTTP before anything
 * else, so a player in no game sees the way in after one round trip.
 *
 * It used to open the game socket first — SockJS info, the upgrade, STOMP
 * CONNECT — and only then ask, so "Свързване…" stayed up for four or five round
 * trips on every click, and the socket was closed again straight after.
 *
 * Runs with no backend: every call to it is answered here, and the socket is
 * watched rather than served.
 */
const API = 'http://localhost:8080';

async function signedIn(page: Page): Promise<string[]> {
    await page.addInitScript(() => {
        localStorage.setItem('token', 'e2e-token');
        localStorage.setItem('username', 'petko91');
    });
    await page.route(`${API}/services`, (route) =>
        route.fulfill({ json: { services: ['SANTASE', 'TABLA', 'BELOT'] } }));

    // The socket is held open and never answered: a slow network, where it is
    // the socket that keeps the screen waiting. Without a backend it would
    // otherwise fail at once, which hides exactly the wait being tested.
    const sockets: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/ws-game')) sockets.push(request.url());
    });
    await page.route('**/ws-game/**', () => undefined);
    return sockets;
}

for (const game of [
    { name: 'сантасе', path: '/play/santase', active: '/santase/active' },
    { name: 'табла', path: '/play/tabla', active: '/tabla/active' },
]) {
    test.describe(`opening ${game.name}`, () => {
        test('in no game: the way in, without opening a socket', async ({ page }) => {
            const sockets = await signedIn(page);
            await page.route(`${API}${game.active}`, (route) => route.fulfill({ status: 204 }));

            await page.goto(game.path);

            await expect(page.getByRole('button', { name: 'Намери противник' })).toBeVisible({ timeout: 1500 });
            expect(sockets, 'no socket is opened until the player searches').toEqual([]);
        });

        test('in a game: asked before the socket, which goes straight to it', async ({ page }) => {
            const sockets = await signedIn(page);
            // When each question was answered and when the socket first went
            // out. Counted rather than compared to one: React's strict mode runs
            // the opening effect twice in development, so the dev server asks
            // twice where a build asks once.
            const askedAt: number[] = [];
            let socketAt = 0;
            page.on('request', (request) => {
                if (request.url().includes('/ws-game') && !socketAt) socketAt = Date.now();
            });
            await page.route(`${API}${game.active}`, (route) => {
                askedAt.push(Date.now());
                return route.fulfill({
                    json: { status: 'GAME_STARTED', gameId: '0b1d6f3e-1a2b-4c3d-8e9f-001122334455' },
                });
            });

            await page.goto(game.path);

            await expect.poll(() => sockets.length, { timeout: 3000 }).toBeGreaterThan(0);
            await page.waitForTimeout(500);
            expect(askedAt.length, 'asked on opening').toBeGreaterThan(0);
            expect(askedAt.every((at) => at <= socketAt),
                'the id came in the answer; nothing asks again once the socket is up').toBe(true);
            await expect(page.getByRole('button', { name: 'Намери противник' })).toHaveCount(0);
        });
    });
}

test('opening belot at no table: the way in before the socket is up', async ({ page }) => {
    await signedIn(page);
    await page.route(`${API}/belot/state`, (route) => route.fulfill({ status: 204 }));

    await page.goto('/play/belot');

    // Well inside the three seconds the screen otherwise waits for a socket
    // that, here, never comes.
    await expect(page.getByRole('button', { name: 'Намери маса' })).toBeVisible({ timeout: 1500 });
});
