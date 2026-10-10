import apiClient from './apiClient';
import { ActiveGameResponse } from '../types/game.types';

/**
 * Обикновена табла. Same shape as gameService: every call returns 202 with an
 * empty body and the real state arrives over STOMP.
 */
export const tablaService = {
    searchGame: () => apiClient.post('/tabla/search'),

    getInitialState: () => apiClient.get('/tabla/state'),

    /**
     * The game this player is already in: 200 with its id, or 204. A server
     * from before the id was in the answer says 202 and sends the id on the
     * search topic instead.
     */
    getActiveGame: () => apiClient.get<ActiveGameResponse | ''>('/tabla/active'),

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
