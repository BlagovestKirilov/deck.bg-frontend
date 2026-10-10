import apiClient from './apiClient';
import { ActiveGameResponse } from '../types/game.types';

export const gameService = {
    searchGame: () =>
        apiClient.post('/santase/search'),

    playCard: (cardId: string) =>
        apiClient.post('/santase/play-card', {cardId}),

    announce: (cardId: string) =>
        apiClient.post('/santase/announce', {cardId}),

    replaceCard: () =>
        apiClient.post('/santase/replace-card'),

    closeDeck: () =>
        apiClient.post('/santase/close-deck'),

    finishDeal: () =>
        apiClient.post('/santase/finish-deal'),

    getInitialState: () =>
        apiClient.get(`/santase/state`),

    /**
     * The game this player is already in: 200 with its id, or 204. A server
     * from before the id was in the answer says 202 and sends the id on the
     * search topic instead.
     */
    getActiveGame: () =>
        apiClient.get<ActiveGameResponse | ''>('/santase/active'),

    surrender: () =>
        apiClient.post(`/santase/surrender`),

    inactivity: () =>
        apiClient.post('/santase/inactivity'),

    extendTime: () =>
        apiClient.post('/santase/extend-time')
};