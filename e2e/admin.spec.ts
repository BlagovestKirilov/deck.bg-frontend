import { test, expect } from './fixtures';
import type { Page, Request } from '@playwright/test';

/**
 * The admin page, against a mocked API: no backend needed.
 *
 * Who is an admin is the server's decision — it reads the role from the
 * database on every /admin call — so these tests check what the page does with
 * each answer, that nothing changes without a confirmation, and that what it
 * sends back is what the server expects.
 */
const API = 'http://localhost:8080';

const PROFILE = {
    santaseWins: 3, santaseLosses: 1, rank: 'SILVER', isEmailConfirmed: true,
    stats: {
        SANTASE: { wins: 3, losses: 1, rank: 'SILVER', placementGamesRemaining: 0 },
        TABLA: { wins: 0, losses: 0, rank: 'UNRANKED', placementGamesRemaining: 10 },
    },
};

const GAMES = [
    { code: 'BELOT', state: 'ON', requiredScope: 'BETA' },
    { code: 'SANTASE', state: 'ON', requiredScope: 'PUBLIC' },
    { code: 'TABLA', state: 'OFF', requiredScope: 'PUBLIC' },
];

interface Row {
    username: string;
    email: string;
    role: 'USER' | 'ADMIN';
    scope: 'PUBLIC' | 'BETA';
    emailConfirmed: boolean;
    createdAt: string;
}

const PETKO: Row = {
    username: 'petko91', email: 'petko@deck.bg', role: 'USER', scope: 'PUBLIC',
    emailConfirmed: true, createdAt: '2026-09-01T10:00:00Z',
};
const BOSS: Row = {
    username: 'boss', email: 'boss@deck.bg', role: 'ADMIN', scope: 'BETA',
    emailConfirmed: false, createdAt: '2026-01-05T09:00:00Z',
};

/** Two named players, and enough others to need a second page. */
const PLAYERS: Row[] = [
    PETKO,
    BOSS,
    ...Array.from({ length: 23 }, (_, i) => ({
        username: `player${String(i).padStart(2, '0')}`,
        email: `p${i}@deck.bg`,
        role: 'USER' as const,
        scope: 'PUBLIC' as const,
        emailConfirmed: true,
        createdAt: `2026-03-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
    })),
];

const DETAIL = {
    account: PETKO,
    games: [
        {
            code: 'SANTASE',
            record: { wins: 18, losses: 13, rating: 1611, rank: 'GOLD' },
            activeGameId: '11111111-2222-3333-4444-555555555555',
            recent: [
                { gameId: 'a1', finishedAt: '2026-10-10T19:30:00Z', others: ['ninja2011'], won: true, surrendered: false },
                { gameId: 'a2', finishedAt: '2026-10-09T18:00:00Z', others: ['gosho'], won: false, surrendered: true },
            ],
        },
        { code: 'TABLA', record: { wins: 0, losses: 0, rating: 1500, rank: 'UNRANKED' }, activeGameId: null, recent: [] },
        {
            code: 'BELOT',
            record: { wins: 4, losses: 2, rating: 1540, rank: 'BRONZE' },
            activeGameId: null,
            recent: [{ gameId: 'b1', finishedAt: '2026-10-08T21:10:00Z', others: ['a', 'b', 'c'], won: true, surrendered: false }],
        },
    ],
};

/** The server's list: filtered, sorted and cut into pages as AdminService does it. */
function pageOf(url: URL) {
    const username = (url.searchParams.get('username') ?? '').toLowerCase();
    const role = url.searchParams.get('role');
    const scope = url.searchParams.get('scope');
    const [field, direction] = (url.searchParams.get('sort') ?? 'createdAt,desc').split(',');
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);

    const matching = PLAYERS
        .filter((player) => !username || player.username.includes(username))
        .filter((player) => !role || player.role === role)
        .filter((player) => !scope || player.scope === scope)
        .sort((a, b) => {
            const key = field as 'createdAt' | 'username';
            const order = a[key].localeCompare(b[key]);
            return direction === 'desc' ? -order : order;
        });
    return {
        players: matching.slice(page * size, page * size + size),
        page,
        size,
        total: matching.length,
        totalPages: Math.ceil(matching.length / size),
    };
}

/** Signed in, with the API answering as the server would for this role. */
async function signedIn(page: Page, role: 'ADMIN' | 'USER'): Promise<{ writes: Request[]; lists: URL[] }> {
    await page.addInitScript(() => {
        localStorage.setItem('token', 'e2e-token');
        localStorage.setItem('username', 'boss');
    });
    const writes: Request[] = [];
    const lists: URL[] = [];
    page.on('request', (request) => {
        if (request.method() === 'PUT') writes.push(request);
    });

    await page.route(`${API}/services`, (route) =>
        route.fulfill({ json: { services: ['SANTASE', 'TABLA', 'BELOT'] } }));
    await page.route(`${API}/user/profile`, (route) => route.fulfill({ json: { ...PROFILE, role } }));
    await page.route(`${API}/belot/profile`, (route) =>
        route.fulfill({ json: { games: 0, wins: 0, losses: 0, rank: 'UNRANKED', placementGamesRemaining: 10 } }));

    const forbidden = { status: 403, json: { status: 403, error: 'Forbidden' } };
    await page.route(`${API}/admin/services`, (route) =>
        route.fulfill(role === 'ADMIN' ? { json: GAMES } : forbidden));
    await page.route(`${API}/admin/services/*`, async (route) => {
        const code = route.request().url().split('/').pop();
        await route.fulfill({ json: { code, ...route.request().postDataJSON() } });
    });
    await page.route(new RegExp(`${API}/admin/players(\\?.*)?$`), (route) => {
        const url = new URL(route.request().url());
        lists.push(url);
        return route.fulfill({ json: pageOf(url) });
    });
    await page.route(`${API}/admin/players/petko91`, (route) => route.fulfill({ json: DETAIL }));
    await page.route(`${API}/admin/players/petko91/scope`, (route) =>
        route.fulfill({ json: { ...PETKO, scope: route.request().postDataJSON().scope } }));
    return { writes, lists };
}

const card = (page: Page, title: string) =>
    page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: title }) });

test.describe('the admin page', () => {
    test('the hub offers it to an admin, and to nobody else', async ({ page }) => {
        await signedIn(page, 'ADMIN');
        await page.goto('/');
        await page.getByRole('button', { name: 'Админ' }).click();
        await expect(page).toHaveURL(/\/admin\/games$/);
        await expect(page.getByRole('heading', { name: 'Сантасе' })).toBeVisible();
    });

    test('games and players are a tab each, at addresses of their own', async ({ page }) => {
        await signedIn(page, 'ADMIN');
        await page.goto('/admin');
        await expect(page).toHaveURL(/\/admin\/games$/);
        await expect(page.getByRole('link', { name: 'Игри', exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(page.locator('.admin-player')).toHaveCount(0);

        await page.getByRole('link', { name: 'Играчи' }).click();
        await expect(page).toHaveURL(/\/admin\/players$/);
        await expect(page.getByRole('button', { name: /petko91/ })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Сантасе' })).toHaveCount(0);

        await page.goBack();
        await expect(page).toHaveURL(/\/admin\/games$/);
        await expect(page.getByRole('heading', { name: 'Сантасе' })).toBeVisible();
    });

    test('the logo leads back to the games once signed in', async ({ page }) => {
        await signedIn(page, 'ADMIN');
        await page.goto('/admin/players');
        await page.getByRole('link', { name: 'DECK.bg, към игрите' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole('heading', { name: 'Избери игра' })).toBeVisible();
    });

    test('on the sign-in card the logo is only a name', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByRole('img', { name: 'DECK.bg' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'DECK.bg, към игрите' })).toHaveCount(0);
    });

    test('a player who is not an admin sees no way in', async ({ page }) => {
        await signedIn(page, 'USER');
        await page.goto('/');
        await expect(page.getByRole('heading', { name: 'Избери игра' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Админ' })).toHaveCount(0);
    });

    test('and is refused if they open it anyway', async ({ page }) => {
        await signedIn(page, 'USER');
        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: 'Само за администратори' })).toBeVisible();
    });

    test('switching a game off asks first, naming it, then shows it closed', async ({ page }) => {
        const { writes } = await signedIn(page, 'ADMIN');
        await page.goto('/admin');

        const santase = card(page, 'Сантасе');
        await santase.getByRole('switch', { name: 'Сантасе е включена' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Изключи Сантасе?' })).toBeVisible();
        await expect(dialog).toContainText('Игрите, които вече се играят, се довършват');
        expect(writes, 'nothing is sent before the answer').toEqual([]);
        await dialog.getByRole('button', { name: 'Изключи', exact: true }).click();

        await expect(santase.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
        await expect(santase).toHaveClass(/admin-game--off/);
        await expect(santase.locator('.admin-game__closed')).toHaveText('Затворена');
        await expect(santase.locator('.card-back')).toHaveCount(0);
        expect(writes.map((request) => [request.url(), request.postDataJSON()])).toEqual([
            [`${API}/admin/services/SANTASE`, { state: 'OFF', requiredScope: 'PUBLIC' }],
        ]);
    });

    test('switching a game on asks too', async ({ page }) => {
        const { writes } = await signedIn(page, 'ADMIN');
        await page.goto('/admin');

        await card(page, 'Табла').getByRole('switch').click();
        await expect(page.getByRole('dialog').getByRole('heading', { name: 'Включи Табла?' })).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Включи', exact: true }).click();

        await expect(card(page, 'Табла').getByRole('switch')).toHaveAttribute('aria-checked', 'true');
        expect(writes[0].postDataJSON()).toEqual({ state: 'ON', requiredScope: 'PUBLIC' });
    });

    test('who sees a game asks first, and a cancelled change sends nothing', async ({ page }) => {
        const { writes } = await signedIn(page, 'ADMIN');
        await page.goto('/admin');

        const belot = card(page, 'Белот');
        await belot.getByRole('button', { name: 'Всички' }).click();
        await expect(page.getByRole('dialog').getByRole('heading', { name: 'Покажи Белот на всички?' })).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Отказ' }).click();
        await expect(belot.getByRole('button', { name: 'Само бета' })).toHaveAttribute('aria-pressed', 'true');
        expect(writes).toEqual([]);

        await belot.getByRole('button', { name: 'Всички' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Покажи', exact: true }).click();
        await expect(belot.getByRole('button', { name: 'Всички' })).toHaveAttribute('aria-pressed', 'true');
        expect(writes.map((request) => request.postDataJSON())).toEqual([{ state: 'ON', requiredScope: 'PUBLIC' }]);
    });

    test('the list is newest first, a page at a time', async ({ page }) => {
        const { lists } = await signedIn(page, 'ADMIN');
        await page.goto('/admin/players');

        await expect(page.getByText('25 играчи')).toBeVisible();
        const rows = page.locator('.admin-player__name');
        await expect(rows.first()).toHaveText('petko91');
        await expect(rows).toHaveCount(8);
        expect(lists[0].searchParams.get('sort')).toBe('createdAt,desc');
        expect(lists[0].searchParams.get('size')).toBe('8');

        await page.getByRole('button', { name: 'Следваща' }).click();
        await expect(page.getByText('Страница 2 от 4')).toBeVisible();
        await expect(rows).toHaveCount(8);
        await page.getByRole('button', { name: 'Следваща' }).click();
        await page.getByRole('button', { name: 'Следваща' }).click();
        await expect(page.getByText('Страница 4 от 4')).toBeVisible();
        await expect(rows).toHaveCount(1);
        await expect(rows.last()).toHaveText('boss');
        await expect(page.getByRole('button', { name: 'Следваща' })).toBeDisabled();
    });

    test('filters by part of the name, by role and by access, and sorts', async ({ page }) => {
        const { lists } = await signedIn(page, 'ADMIN');
        await page.goto('/admin/players');
        const rows = page.locator('.admin-player__name');

        await page.getByLabel('Потребителско име').fill('KO9');
        await expect(rows).toHaveText(['petko91']);
        await expect(page.getByText('1 играч', { exact: true })).toBeVisible();

        await page.getByRole('button', { name: 'Изчисти филтрите' }).click();
        await page.getByLabel('Роля').selectOption('ADMIN');
        await expect(rows).toHaveText(['boss']);
        expect(lists.at(-1)!.searchParams.get('role')).toBe('ADMIN');

        await page.getByLabel('Роля').selectOption('');
        await page.getByLabel('Достъп').selectOption('BETA');
        await expect(rows).toHaveText(['boss']);

        await page.getByLabel('Достъп').selectOption('');
        await page.getByLabel('Подреди').selectOption('username,asc');
        await expect(rows.first()).toHaveText('boss');
        expect(lists.at(-1)!.searchParams.get('sort')).toBe('username,asc');

        await page.getByLabel('Потребителско име').fill('zzz');
        await expect(page.getByText('Никой играч не отговаря на тези филтри.')).toBeVisible();
    });

    test('making a player a beta tester asks first, naming them', async ({ page }) => {
        const { writes } = await signedIn(page, 'ADMIN');
        await page.goto('/admin/players');

        await page.getByRole('button', { name: /petko91/ }).click();
        const sheet = page.getByRole('dialog');
        await expect(sheet.getByRole('heading', { name: 'petko91' })).toBeVisible();
        await expect(sheet).toContainText('1611');
        await expect(sheet).toContainText('Играе в момента');
        await expect(sheet).toContainText('Предаде');
        await expect(sheet).toContainText('a, b, c');

        await sheet.getByRole('button', { name: 'Бета тестер' }).click();
        const question = page.getByRole('dialog', { name: 'Направи petko91 бета тестер?' });
        await expect(question).toContainText('petko91 ще вижда');
        expect(writes).toEqual([]);

        // Escape answers the question, and leaves the player open.
        await page.keyboard.press('Escape');
        await expect(question).toHaveCount(0);
        await expect(sheet.getByRole('heading', { name: 'petko91' })).toBeVisible();
        expect(writes).toEqual([]);

        await sheet.getByRole('button', { name: 'Бета тестер' }).click();
        await page.getByRole('button', { name: 'Направи бета' }).click();
        await expect(sheet).toContainText('Вече вижда и бета игрите');
        expect(writes.map((request) => request.postDataJSON())).toEqual([{ scope: 'BETA' }]);

        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: /petko91/ })).toContainText('Бета');
    });
});
