import apiClient from './apiClient';
import { BelotBidKind, BelotCard, BelotContract, BelotProfile } from '../types/belot.types';

/**
 * Belot. Every call answers 202 with an empty body: what the player is waiting
 * for arrives on the socket, at `/topic/belot/{username}`.
 *
 * Unlike сантасе and табла there is no search topic — the state itself is the
 * answer to searching, because a table is found and a hand dealt in the same
 * breath.
 */
export const belotService = {
    /** Sit down: at the table this player already has, or at one short of four. */
    search: () => apiClient.post('/belot/search'),

    /** Ask for this seat's view again, after a reload or a dropped socket. */
    getState: () => apiClient.get('/belot/state'),

    bid: (kind: BelotBidKind, contract?: BelotContract) =>
        apiClient.post('/belot/bid', { kind, contract: contract ?? null }),

    play: (card: BelotCard) => apiClient.post('/belot/play', { card }),

    /**
     * This player's belot record.
     *
     * Its own endpoint: belot keeps its own tables, so the profile page and
     * the lobby ask both sides and put the answers together.
     */
    profile: (signal?: AbortSignal) =>
        apiClient.get<BelotProfile>('/belot/profile', { signal }).then((response) => response.data),
};
