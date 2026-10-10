import apiClient from './apiClient';

/**
 * Обикновена табла. Same shape as gameService: every call returns 202 with an
 * empty body and the real state arrives over STOMP.
 */
export const tablaService = {
    searchGame: () => apiClient.post('/tabla/search'),

    getInitialState: () => apiClient.get('/tabla/state'),

    /** The game this player is already in: 202 and its id on the search topic, or 204. */
    getActiveGame: () => apiClient.get('/tabla/active'),

    /** This player's die of the opening roll — who starts. */
    openingThrow: () => apiClient.post('/tabla/opening-throw'),
    roll: () => apiClient.post('/tabla/roll'),

    /** `from` is 1..24, or 25 for the bar. The destination is derived server-side. */
    move: (from: number, die: number) => apiClient.post('/tabla/move', { from, die }),

    undo: () => apiClient.post('/tabla/undo'),

    confirm: () => apiClient.post('/tabla/confirm'),

    surrender: () => apiClient.post('/tabla/surrender'),

    inactivity: () => apiClient.post('/tabla/inactivity'),

    extendTime: () => apiClient.post('/tabla/extend-time'),
};
