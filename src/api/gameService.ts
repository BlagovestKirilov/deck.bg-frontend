import apiClient from './apiClient';

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

    surrender: () =>
        apiClient.post(`/santase/surrender`),

    inactivity: () =>
        apiClient.post('/santase/inactivity'),

    extendTime: () =>
        apiClient.post('/santase/extend-time')
};