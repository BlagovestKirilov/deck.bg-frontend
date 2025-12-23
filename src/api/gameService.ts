import apiClient from './apiClient';

export const gameService = {
    searchGame: () =>
        apiClient.post('/game/search'),

    playCard: (cardId: string) =>
        apiClient.post('/game/play-card', {cardId}),

    announce: (cardId: string) =>
        apiClient.post('/game/announce', {cardId}),

    replaceCard: () =>
        apiClient.post('/game/replace-card'),

    closeDeck: () =>
        apiClient.post('/game/close-deck'),

    finishDeal: () =>
        apiClient.post('/game/finish-deal'),

    getInitialState: () =>
        apiClient.get(`/game/state`),

    finishGame: () =>
        apiClient.post(`/game/finish-game`)
};