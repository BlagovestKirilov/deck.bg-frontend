import { GameKey, GameStats } from './user.types';

/** The games a friend can be challenged to. Belot's private tables come later. */
export type ChallengeGame = 'SANTASE' | 'TABLA';

/** One friend as the list shows them. Mirrors the server's FriendView. */
export interface FriendView {
    username: string;
    /** True while they have a screen open. */
    online: boolean;
    /** The game they are in now, if any. */
    playing?: GameKey | null;
    /** Their record at each game, keyed by its code. */
    ranks: Partial<Record<GameKey, GameStats>>;
}

/** A friend request waiting for an answer, and the other player in it. */
export interface FriendRequestView {
    id: string;
    username: string;
}

/** A challenge to a game, open until it is answered or runs out. */
export interface ChallengeView {
    id: string;
    from: string;
    to: string;
    game: ChallengeGame;
    /** ISO moment it runs out. */
    expiresAt: string;
}

/** GET /friends, and the answer to every change. */
export interface FriendsResponse {
    friends: FriendView[];
    incoming: FriendRequestView[];
    outgoing: FriendRequestView[];
    incomingChallenge?: ChallengeView | null;
    outgoingChallenge?: ChallengeView | null;
}

export type FriendEventType =
    | 'REQUEST'
    | 'ACCEPTED'
    | 'REMOVED'
    | 'CHALLENGE'
    | 'CHALLENGE_DECLINED'
    | 'CHALLENGE_CANCELLED'
    | 'CHALLENGE_EXPIRED'
    | 'GAME_STARTED'
    | 'PRESENCE'
    | 'SYNC';

/** What happened among this player's friends, on /topic/friends/{username}. */
export interface FriendEvent {
    type: FriendEventType;
    from?: string;
    challenge?: ChallengeView;
    game?: ChallengeGame;
    gameId?: string;
}

/**
 * Players found by the start of their name. At most a few, and only when they
 * are all of them: `more` says there are more than fit, and then the list
 * holds only the name typed out in full, if there is one.
 */
export interface FriendSearchResponse {
    players: FriendSearchHit[];
    more: boolean;
}

/**
 * Where a player found by a search stands with the one searching. Friends are
 * never found: they are in the list already.
 */
export type FriendRelation = 'NONE' | 'SENT' | 'RECEIVED';

/** A player found by a search. */
export interface FriendSearchHit {
    username: string;
    relation: FriendRelation;
}

/** The game an accepted challenge started. */
export interface ChallengeAcceptedResponse {
    game: ChallengeGame;
    gameId: string;
}
