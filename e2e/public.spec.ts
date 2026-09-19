import { test, expect } from './fixtures';

/** Shaped like a real one so the page takes the same path a user would. */
const TOKEN = '11111111-2222-3333-4444-555555555555';

/**
 * Every screen reachable without signing in.
 *
 * No backend is required: the pages that call the API are asserted on what they
 * do when the call fails, which is itself a path worth holding still. The
 * visible-element assertions mostly prove the screen mounted rather than
 * rendering an empty shell — the console guard in the fixture is what actually
 * catches the bugs.
 */
test.describe('public screens load without throwing', () => {
    test('login', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByLabel(/Потребителско име/)).toBeVisible();
    });

    test('privacy policy', async ({ page }) => {
        await page.goto('/privacy');
        await expect(
            page.getByRole('heading', { name: 'Политика за поверителност', level: 1 }),
        ).toBeVisible();
    });

    test('account deletion information', async ({ page }) => {
        await page.goto('/delete-account');
        await expect(
            page.getByRole('heading', { name: 'Изтриване на акаунт', level: 1 }),
        ).toBeVisible();
    });

    test('email confirmed', async ({ page }) => {
        await page.goto('/confirmation-success');
        await expect(
            page.getByRole('heading', { name: 'Имейлът е потвърден!', level: 1 }),
        ).toBeVisible();
    });

    test('invalid link', async ({ page }) => {
        await page.goto('/invalid');
        await expect(
            page.getByRole('heading', { name: 'Невалиден линк', level: 1 }),
        ).toBeVisible();
    });

    test('account deleted', async ({ page }) => {
        await page.goto('/deletion-success');
        await expect(
            page.getByRole('heading', { name: 'Акаунтът е изтрит!', level: 1 }),
        ).toBeVisible();
    });

    /**
     * The deletion prompt renders, and that is all this test does.
     *
     * The button is asserted visible and never pressed. Deleting used to happen
     * on the email link itself, as a GET, which is why the prompt exists at all;
     * a test that clicked it would delete a real account the moment anyone ran
     * the suite against a live backend.
     */
    test('deletion prompt renders but is not confirmed', async ({ page }) => {
        await page.goto(`/confirm-deletion?token=${TOKEN}`);
        await expect(
            page.getByRole('heading', { name: 'Изтриване на акаунт', level: 1 }),
        ).toBeVisible();
        await expect(page.getByRole('button', { name: 'Изтрий акаунта' })).toBeVisible();
    });

    test('deletion link without a token is refused', async ({ page }) => {
        await page.goto('/confirm-deletion');
        await expect(page).toHaveURL(/\/invalid$/);
    });

    /**
     * The reset page validates its token against the API before showing the
     * form. With no backend the validation fails, and failing shut — onto the
     * invalid-link screen rather than a usable password form — is the behaviour
     * worth pinning.
     */
    test('reset password fails shut when the link cannot be validated', async ({ page }) => {
        await page.goto(`/reset-password?token=${TOKEN}`);
        await expect(page).toHaveURL(/\/invalid$/);
    });

    test('unknown route', async ({ page }) => {
        await page.goto('/no-such-page');
        await expect(
            page.getByRole('heading', { name: 'Страницата не е намерена', level: 1 }),
        ).toBeVisible();
    });
});
