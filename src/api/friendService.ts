import apiClient from './apiClient';
import {
    ChallengeAcceptedResponse, ChallengeGame, FriendSearchResponse, FriendsResponse,
} from '../types/friends.types';

/**
 * Friends and challenges. Every change answers with the page as it now
 * stands, so the screen never asks twice.
 */
export const friendService = {
    page: async (signal?: AbortSignal): Promise<FriendsResponse> =>
        (await apiClient.get<FriendsResponse>('/friends', { signal })).data,

    search: async (typed: string, signal?: AbortSignal): Promise<FriendSearchResponse> =>
        (await apiClient.get<FriendSearchResponse>('/friends/search', { params: { q: typed }, signal })).data,

    request: async (username: string): Promise<FriendsResponse> =>
        (await apiClient.post<FriendsResponse>('/friends/requests', { username })).data,

    accept: async (id: string): Promise<FriendsResponse> =>
        (await apiClient.post<FriendsResponse>(`/friends/requests/${id}/accept`)).data,

    decline: async (id: string): Promise<FriendsResponse> =>
        (await apiClient.post<FriendsResponse>(`/friends/requests/${id}/decline`)).data,

    remove: async (username: string): Promise<FriendsResponse> =>
        (await apiClient.delete<FriendsResponse>(`/friends/${encodeURIComponent(username)}`)).data,

    challenge: async (username: string, game: ChallengeGame): Promise<FriendsResponse> =>
        (await apiClient.post<FriendsResponse>('/friends/challenges', { username, game })).data,

    acceptChallenge: async (id: string): Promise<ChallengeAcceptedResponse> =>
        (await apiClient.post<ChallengeAcceptedResponse>(`/friends/challenges/${id}/accept`)).data,

    declineChallenge: async (id: string): Promise<FriendsResponse> =>
        (await apiClient.post<FriendsResponse>(`/friends/challenges/${id}/decline`)).data,

    cancelChallenge: async (id: string): Promise<FriendsResponse> =>
        (await apiClient.delete<FriendsResponse>(`/friends/challenges/${id}`)).data,
};
