import { GameKey, Rank } from './user.types';

/**
 * The admin page's view of the server, mirrored by hand from deck-backend's
 * common/model (ServiceAvailability, AdminPlayerRow, AdminPlayerDetail …).
 */

export type ServiceState = 'ON' | 'OFF';

/** How far into the site an account can see. PUBLIC is everyone; BETA, the testers. */
export type Scope = 'PUBLIC' | 'BETA';

export type AccountRole = 'USER' | 'ADMIN';

/** One game: whether it is on, and the lowest scope that sees it. */
export interface AdminGameSwitch {
    code: GameKey;
    state: ServiceState;
    requiredScope: Scope;
}

export interface AdminPlayerRow {
    username: string;
    email: string;
    role: AccountRole;
    scope: Scope;
    emailConfirmed: boolean;
    /** ISO moment. */
    createdAt: string | null;
    /**
     * ISO moment of the last login or token refresh. Null for an account not
     * seen since the server began keeping it.
     */
    lastLoginAt: string | null;
}

/** One page of the player list, as the server cuts it. `page` counts from 0. */
export interface AdminPlayerPage {
    players: AdminPlayerRow[];
    page: number;
    size: number;
    total: number;
    totalPages: number;
}

/** The orders the server sorts the list by: a field and a direction. */
export type PlayerSort =
    | 'createdAt,desc'
    | 'createdAt,asc'
    | 'lastLoginAt,desc'
    | 'username,asc'
    | 'username,desc';

/** Which players to list. An empty part lets every player through on it. */
export interface PlayerQuery {
    username: string;
    role: AccountRole | '';
    scope: Scope | '';
    sort: PlayerSort;
    page: number;
}

export interface AdminGameRecord {
    wins: number;
    losses: number;
    rating: number;
    rank: Rank;
}

export interface AdminGameRow {
    gameId: string;
    /** ISO moment. */
    finishedAt: string | null;
    /** Everybody else at the table: one opponent, or belot's three. */
    others: string[];
    won: boolean;
    /** They gave the game up: surrendered, or let their time run out. */
    surrendered: boolean;
}

export interface AdminGameDetail {
    code: GameKey;
    record: AdminGameRecord;
    /** The game they are in right now, or null. */
    activeGameId: string | null;
    /** Their last finished games, newest first. */
    recent: AdminGameRow[];
}

export interface AdminPlayerDetail {
    account: AdminPlayerRow;
    games: AdminGameDetail[];
}
