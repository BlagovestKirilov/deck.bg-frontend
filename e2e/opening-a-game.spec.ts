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

/**
 * A table in play, in the shape the server sends it — taken from the backend's
 * wire-format snapshot (BelotStateResponse), with the clock moved far enough
 * ahead that nobody's turn runs out while the test looks at it.
 */
const BELOT_TABLE = {
    "gameId": "11111111-2222-3333-4444-555555555555",
    "status": "PLAYING",
    "winnerTeam": null,
    "forfeit": null,
    "forfeitedBy": null,
    "serverSeedHash": "0f5c1b6c9b4b4d2f8a1e6d3c2b7a9e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9",
    "seats": [
        {
            "seat": "NORTH",
            "team": "NORTH_SOUTH",
            "username": "petko91",
            "cardsLeft": 5,
            "missedTurns": 0
        },
        {
            "seat": "WEST",
            "team": "EAST_WEST",
            "username": "ninja2011",
            "cardsLeft": 5,
            "missedTurns": 1
        },
        {
            "seat": "SOUTH",
            "team": "NORTH_SOUTH",
            "username": "gosho",
            "cardsLeft": 5,
            "missedTurns": 0
        },
        {
            "seat": "EAST",
            "team": "EAST_WEST",
            "username": "ivan",
            "cardsLeft": 5,
            "missedTurns": 3
        }
    ],
    "yourSeat": "NORTH",
    "dealNumber": 3,
    "dealerSeat": "WEST",
    "dealStatus": "BIDDING",
    "yourHand": [
        {
            "suit": "SPADES",
            "rank": "ACE"
        },
        {
            "suit": "HEARTS",
            "rank": "JACK"
        }
    ],
    "bidding": {
        "toAct": "SOUTH",
        "highestBid": "HEARTS",
        "bidder": "NORTH",
        "doubling": "CONTRA",
        "said": [
            {
                "seat": "NORTH",
                "kind": "BID",
                "contract": "HEARTS"
            },
            {
                "seat": "WEST",
                "kind": "CONTRA",
                "contract": null
            }
        ],
        "yours": [
            {
                "seat": "SOUTH",
                "kind": "PASS",
                "contract": null
            }
        ]
    },
    "play": {
        "contract": "HEARTS",
        "declarer": "NORTH",
        "toAct": "EAST",
        "trickNo": 4,
        "onTable": [
            {
                "seat": "NORTH",
                "card": {
                    "suit": "CLUBS",
                    "rank": "TEN"
                }
            },
            {
                "seat": "WEST",
                "card": {
                    "suit": "CLUBS",
                    "rank": "KING"
                }
            }
        ],
        "wonBy": null,
        "yours": [
            {
                "suit": "CLUBS",
                "rank": "SEVEN"
            }
        ]
    },
    "turn": {
        "seat": "EAST",
        "startedAt": "2099-01-01T10:00:00Z",
        "deadline": "2099-01-01T10:00:30Z"
    },
    "declarations": {
        "shown": [
            {
                "seat": "NORTH",
                "kind": "TERZ",
                "suit": "SPADES",
                "topRank": "KING",
                "points": 20
            },
            {
                "seat": "EAST",
                "kind": "BELOTE",
                "suit": "HEARTS",
                "topRank": "KING",
                "points": 20
            }
        ],
        "northSouthPoints": 20,
        "eastWestPoints": 20
    },
    "sheet": [
        {
            "dealNumber": 1,
            "contract": "SPADES",
            "declarer": "NORTH",
            "callerTeam": "NORTH_SOUTH",
            "doubling": "NONE",
            "callerPoints": 97,
            "opponentPoints": 65,
            "callerDeclarations": 20,
            "opponentDeclarations": 0,
            "callerScore": 10,
            "opponentScore": 6,
            "result": "MADE"
        },
        {
            "dealNumber": 2,
            "contract": "NO_TRUMPS",
            "declarer": "EAST",
            "callerTeam": "EAST_WEST",
            "doubling": "CONTRA",
            "callerPoints": 120,
            "opponentPoints": 140,
            "callerDeclarations": 0,
            "opponentDeclarations": 50,
            "callerScore": 0,
            "opponentScore": 52,
            "result": "INSIDE"
        }
    ],
    "lastTrick": {
        "dealNumber": 2,
        "cards": [
            {
                "seat": "EAST",
                "card": {
                    "suit": "HEARTS",
                    "rank": "ACE"
                }
            },
            {
                "seat": "NORTH",
                "card": {
                    "suit": "HEARTS",
                    "rank": "SEVEN"
                }
            },
            {
                "seat": "WEST",
                "card": {
                    "suit": "HEARTS",
                    "rank": "TEN"
                }
            },
            {
                "seat": "SOUTH",
                "card": {
                    "suit": "HEARTS",
                    "rank": "KING"
                }
            }
        ],
        "wonBy": "EAST"
    },
    "cutAt": 12,
    "northSouthScore": 91,
    "eastWestScore": 64,
    "hangingPoints": 0
};

test('opening belot at a table: drawn from the answer while the socket connects', async ({ page }) => {
    await signedIn(page);
    await page.route(`${API}/belot/state`, (route) => route.fulfill({ json: BELOT_TABLE }));

    await page.goto('/play/belot');

    // The socket never answers here, so the only way to the table is the
    // answer to /belot/state.
    await expect(page.locator('.belot__bar')).toBeVisible({ timeout: 1500 });
    await expect(page.getByText('ninja2011').first()).toBeVisible();
});
