/**
 * Belot's wire shapes, mirrored by hand from the server's records.
 *
 * There is no codegen: `BelotStateResponse` and friends live in
 * `bg.deck.belot.model.response`, and `WireFormatSnapshotTest` pins their JSON
 * so a rename on that side fails there rather than here, silently.
 */

import { Rank } from './user.types';

export type BelotSuit = 'CLUBS' | 'DIAMONDS' | 'HEARTS' | 'SPADES';

export type BelotRank = 'SEVEN' | 'EIGHT' | 'NINE' | 'TEN' | 'JACK' | 'QUEEN' | 'KING' | 'ACE';

/** Where a player sits. Play runs counter-clockwise: north → west → south → east. */
export type BelotSeatName = 'NORTH' | 'WEST' | 'SOUTH' | 'EAST';

export type BelotTeam = 'NORTH_SOUTH' | 'EAST_WEST';

export type BelotContract = 'CLUBS' | 'DIAMONDS' | 'HEARTS' | 'SPADES' | 'NO_TRUMPS' | 'ALL_TRUMPS';

export type BelotDoubling = 'NONE' | 'CONTRA' | 'RECONTRA';

export type BelotBidKind = 'PASS' | 'BID' | 'CONTRA' | 'RECONTRA';

export type BelotGameStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export type BelotDealStatus = 'BIDDING' | 'PLAYING' | 'THROWN_IN' | 'FINISHED';

export interface BelotCard {
    suit: BelotSuit;
    rank: BelotRank;
}

export interface BelotSeatView {
    seat: BelotSeatName;
    team: BelotTeam;
    username: string;
    /** How many cards are still in that hand — a count, never the cards. */
    cardsLeft: number;
}

export interface BelotBidView {
    seat: BelotSeatName;
    kind: BelotBidKind;
    /** Named on a bid, null otherwise. */
    contract: BelotContract | null;
}

export interface BelotBiddingView {
    toAct: BelotSeatName;
    highestBid: BelotContract | null;
    bidder: BelotSeatName | null;
    doubling: BelotDoubling;
    said: BelotBidView[];
    /** What this player may say now. Empty when it is not their turn. */
    yours: BelotBidView[];
}

export interface BelotPlayedCard {
    seat: BelotSeatName;
    card: BelotCard;
}

export interface BelotPlayView {
    contract: BelotContract;
    declarer: BelotSeatName;
    toAct: BelotSeatName;
    trickNo: number;
    /** The trick in progress, or the one just finished until somebody leads. */
    onTable: BelotPlayedCard[];
    /** Who took the trick on the table, once it is complete. */
    wonBy: BelotSeatName | null;
    /** What this player may play now. Empty when it is not their turn. */
    yours: BelotCard[];
}

/** A finished trick, and who took it. */
export interface BelotTrickView {
    /** Which hand it was the last trick of. */
    dealNumber: number;
    cards: BelotPlayedCard[];
    wonBy: BelotSeatName | null;
}

export type BelotDealResult = 'MADE' | 'INSIDE' | 'HANGING';

/** One line of the score sheet: a hand that has been played and counted. */
export interface BelotDealRow {
    dealNumber: number;
    contract: BelotContract;
    declarer: BelotSeatName;
    /** The side that called it — which column the contract is printed in. */
    callerTeam: BelotTeam;
    doubling: BelotDoubling;
    /** Card points taken. Different from what was written down, deliberately. */
    callerPoints: number | null;
    opponentPoints: number | null;
    /**
     * What the announcements were worth, counted out of the card points they
     * are already inside. A терца is called at the table and then disappears
     * into a total, and it is the hand a player asks about afterwards.
     */
    callerDeclarations: number;
    opponentDeclarations: number;
    callerScore: number | null;
    opponentScore: number | null;
    result: BelotDealResult;
}

/**
 * Who the table is waiting for, and until when.
 *
 * `deadline` is an ISO moment rather than a number of seconds: a tab that was
 * asleep in the background wakes up counting towards the same instant the
 * server is, instead of resuming a countdown that stopped when it slept.
 */
export interface BelotTurnView {
    seat: BelotSeatName;
    deadline: string | null;
}

export type BelotDeclarationKind = 'TERZ' | 'QUARTE' | 'QUINTE' | 'CARRE' | 'BELOTE';

/** Something a player holds that is worth announcing. */
export interface BelotDeclarationView {
    seat: BelotSeatName;
    kind: BelotDeclarationKind;
    suit: BelotSuit;
    topRank: BelotRank;
    points: number;
}

/**
 * What the table announced this deal, and what it came to.
 *
 * Both sides are listed but usually only one scores: the better sequence
 * cancels the other's outright, which is the rule players argue about.
 */
export interface BelotDeclarationsView {
    shown: BelotDeclarationView[];
    northSouthPoints: number;
    eastWestPoints: number;
}

/** One seat's view of the table — the only private part is `yourHand`. */
export interface BelotState {
    gameId: string;
    status: BelotGameStatus;
    /** Who took the game, once a pair passes 151. */
    winnerTeam: BelotTeam | null;
    serverSeedHash: string;
    seats: BelotSeatView[];
    yourSeat: BelotSeatName | null;
    dealNumber: number | null;
    dealerSeat: BelotSeatName | null;
    dealStatus: BelotDealStatus | null;
    yourHand: BelotCard[];
    bidding: BelotBiddingView | null;
    play: BelotPlayView | null;
    turn: BelotTurnView | null;
    /** What was announced this deal, once the first trick is complete. */
    declarations: BelotDeclarationsView | null;
    /** Every hand counted so far, oldest first. */
    sheet: BelotDealRow[];
    /**
     * The last trick of the newest hand on the sheet, or null if it was not
     * played out. The card that ends a hand also deals the next one, so that
     * trick never reaches `play`; this is the only way to see it fall.
     */
    lastTrick: BelotTrickView | null;
    northSouthScore: number;
    eastWestScore: number;
    hangingPoints: number;
}

/**
 * A player's belot record.
 *
 * Same shape as a santase or табла record, and on the same rank ladder: a
 * belot result moves both partners of a pair equally, and the badge it earns
 * means what it means everywhere else. The rating behind it is not sent —
 * players are shown where they stand, not the number that decided it.
 */
export interface BelotProfile {
    games: number;
    wins: number;
    losses: number;
    rank: Rank;
    /** Games still needed before a rank is given at all. */
    placementGamesRemaining: number;
}
