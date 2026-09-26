import apiClient from './apiClient';
import { GameKey } from '../types/user.types';

/** Where the last answer is kept, so a reload or a deep link starts knowing. */
const REMEMBERED = 'availableServices';

/**
 * Which games this player is being offered.
 *
 * The server decides — states and scopes never reach the client, and a game
 * somebody may not have is simply absent rather than listed as forbidden.
 *
 * The list here is a convenience for drawing the lobby. It can be out of date,
 * and that is allowed: starting a game the server no longer offers comes back
 * 404, which is the answer that actually counts.
 */
export const servicesService = {
    available: async (signal?: AbortSignal): Promise<GameKey[]> => {
        const { data } = await apiClient.get<{ services: GameKey[] }>('/services', { signal });

        // A 200 is not proof of an answer. A proxy that does not know this
        // path hands back the app’s own index.html with a 200, and taking
        // that at its word left the lobby with neither a list nor an error.
        if (!isList(data?.services)) {
            throw new Error('/services did not answer with a list of games');
        }

        remember(data.services);
        return data.services;
    },

    /**
     * The last answer, or null if this browser has never had one.
     *
     * Read synchronously by the route guard, which has nowhere to await: with
     * no answer yet it lets the navigation through and leaves the refusal to
     * the server.
     */
    lastKnown(): GameKey[] | null {
        try {
            const stored = sessionStorage.getItem(REMEMBERED);
            const parsed = stored ? JSON.parse(stored) : null;
            return isList(parsed) ? parsed : null;
        } catch {
            // Private windows and blocked storage: no memory, no harm.
            return null;
        }
    },

    forget(): void {
        try {
            sessionStorage.removeItem(REMEMBERED);
        } catch {
            /* nothing to forget */
        }
    },
};

/** Every game a list can hold is a string; anything else is not an answer. */
function isList(value: unknown): value is GameKey[] {
    return Array.isArray(value) && value.every((game) => typeof game === 'string');
}

function remember(services: GameKey[]): void {
    try {
        sessionStorage.setItem(REMEMBERED, JSON.stringify(services));
    } catch {
        /* the list simply is not remembered */
    }
}
