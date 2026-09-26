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
            return stored ? (JSON.parse(stored) as GameKey[]) : null;
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

function remember(services: GameKey[]): void {
    try {
        sessionStorage.setItem(REMEMBERED, JSON.stringify(services));
    } catch {
        /* the list simply is not remembered */
    }
}
