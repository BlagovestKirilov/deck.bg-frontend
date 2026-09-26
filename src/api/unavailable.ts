import { GameKey } from '../types/user.types';

/**
 * A note left for the lobby by a game screen that was turned away.
 *
 * The refusal happens on the game screen — clicking a card is a route change,
 * so the server only speaks once the screen is up and searching. The lobby is
 * where the player lands afterwards, and where the explanation belongs.
 */
const KEY = 'serviceUnavailable';

export function noteUnavailable(service: GameKey): void {
    try {
        sessionStorage.setItem(KEY, service);
    } catch {
        // Without storage the player simply returns to the lobby with the card
        // gone and no sentence about it.
    }
}

/** Reads the note and clears it, so it is shown once. */
export function takeUnavailableNote(): GameKey | null {
    try {
        const service = sessionStorage.getItem(KEY) as GameKey | null;
        if (service) sessionStorage.removeItem(KEY);
        return service;
    } catch {
        return null;
    }
}
