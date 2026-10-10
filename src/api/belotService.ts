import apiClient from './apiClient';
import { BelotBidKind, BelotCard, BelotContract, BelotProfile, BelotState } from '../types/belot.types';

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

    /**
     * This seat's view: 200 with it, also sent on the socket, or 204 at no
     * table. A server from before the view was in the answer says 202 and
     * sends it on the socket only.
     */
    getState: () => apiClient.get<BelotState | ''>('/belot/state'),

    bid: (kind: BelotBidKind, contract?: BelotContract) =>
        apiClient.post('/belot/bid', { kind, contract: contract ?? null }),

    play: (card: BelotCard) => apiClient.post('/belot/play', { card }),

    /**
     * The clock on screen has reached nought. The server acts for whoever ran
     * out straight away instead of on its next sweep, and ignores the call if
     * its own deadline has not passed.
     */
    timeout: () => apiClient.post('/belot/timeout'),

    /** Cut the deck at this card, counted from the top, when it is yours to cut. */
    cut: (at: number) => apiClient.post('/belot/cut', { at }),

    /**
     * Get up from a table still waiting for its fourth player — back to the
     * games. A table already being played is not left this way.
     */
    leave: () => apiClient.post('/belot/leave'),

    /**
     * Give up the game: it goes to the other pair, costs whoever gave up twice
     * the rating, and counts as a win for their partner.
     *
     * Safe to call twice: a table that is already over is left alone.
     */
    surrender: () => apiClient.post('/belot/surrender'),

    /**
     * This player's belot record.
     *
     * Its own endpoint: belot keeps its own tables, so the profile page and
     * the lobby ask both sides and put the answers together.
     */
    profile: (signal?: AbortSignal) =>
        apiClient.get<BelotProfile>('/belot/profile', { signal }).then((response) => response.data),
};
