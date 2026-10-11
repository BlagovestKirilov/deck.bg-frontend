import apiClient from './apiClient';
import { GameKey } from '../types/user.types';
import {
    AdminGameSwitch,
    AdminPlayerDetail,
    AdminPlayerPage,
    AdminPlayerRow,
    PlayerQuery,
    Scope,
    ServiceState,
} from '../types/admin.types';

/** How many players one page of the list holds. */
export const PLAYERS_PER_PAGE = 8;

/**
 * The admin page. Every call answers 403 to an account that is not an admin —
 * the server reads the role from the database on each one, so the page cannot
 * be reached by a token alone.
 */
export const adminService = {
    /** Every game, whether it is on, and who sees it. */
    games: (signal?: AbortSignal) =>
        apiClient.get<AdminGameSwitch[]>('/admin/services', { signal }).then((response) => response.data),

    /** Switches a game, and sets who sees it. Players see the change on their next request. */
    setGame: (code: GameKey, state: ServiceState, requiredScope: Scope) =>
        apiClient.put<AdminGameSwitch>(`/admin/services/${encodeURIComponent(code)}`, { state, requiredScope })
            .then((response) => response.data),

    /**
     * One page of players. Empty parts of the query are left out of the
     * request, so the server lets everyone through on them.
     */
    findPlayers: (query: PlayerQuery, signal?: AbortSignal) =>
        apiClient.get<AdminPlayerPage>('/admin/players', {
            params: {
                username: query.username.trim() || undefined,
                role: query.role || undefined,
                scope: query.scope || undefined,
                sort: query.sort,
                page: query.page,
                size: PLAYERS_PER_PAGE,
            },
            signal,
        }).then((response) => response.data),

    /** One player, and what each game knows about them. */
    player: (username: string, signal?: AbortSignal) =>
        apiClient.get<AdminPlayerDetail>(`/admin/players/${encodeURIComponent(username)}`, { signal })
            .then((response) => response.data),

    setScope: (username: string, scope: Scope) =>
        apiClient.put<AdminPlayerRow>(`/admin/players/${encodeURIComponent(username)}/scope`, { scope })
            .then((response) => response.data),
};
