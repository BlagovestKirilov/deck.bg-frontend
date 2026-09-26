import { GameKey, ProfileResponse, Rank } from '../types/user.types';

/**
 * The rank a player held before this game, so the end of it can tell a
 * promotion from an ordinary win.
 *
 * Written wherever a fresh profile passes through — the lobby fetches one to
 * draw the cards — and read once when a game ends. A game screen therefore
 * needs no profile request of its own on the way in.
 *
 * Kept per game, because rank is per game: winning at табла says nothing about
 * a сантасе rank.
 */
const KEY = 'lastRank';

/** The rank this profile holds in one game, whichever field carries it. */
export function rankIn(profile: ProfileResponse, game: GameKey): Rank {
    // `stats` supersedes the account-wide field, which is still sent and is
    // SANTASE's. Reading them in this order everywhere is what keeps the
    // before and after of a game comparable.
    return profile.stats?.[game]?.rank ?? profile.rank;
}

export function remember(game: GameKey, rank: Rank): void {
    try {
        localStorage.setItem(`${KEY}:${game}`, rank);
    } catch {
        // Private windows and blocked storage: no baseline, and the promotion
        // simply goes unannounced. See `read`.
    }
}

/**
 * The remembered rank, or null when this browser has none.
 *
 * Null is not "unranked". Nothing is known, so nothing should be claimed: a
 * player whose first game here ends with them already ranked has not just been
 * promoted, and telling them they have would be a lie the confetti sells.
 */
export function read(game: GameKey): Rank | null {
    try {
        const remembered = localStorage.getItem(`${KEY}:${game}`) as Rank | null;
        if (remembered) {
            return remembered;
        }

        // What the сантасе screen wrote before rank was kept per game. Read
        // once so a player mid-promotion on the day this ships still gets
        // told; the next game writes the new key and this stops mattering.
        return game === 'SANTASE'
            ? (localStorage.getItem('lastSantaseRank') as Rank | null)
            : null;
    } catch {
        return null;
    }
}
