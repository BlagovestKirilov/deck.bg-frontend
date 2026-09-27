/**
 * Belot's wire shapes, mirrored by hand from the server's records.
 *
 * There is no codegen: `BelotStateResponse` and friends live in
 * `bg.deck.belot.model.response`, and `WireFormatSnapshotTest` pins their JSON
 * so a rename on that side fails there rather than here, silently.
 */

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
    onTable: BelotPlayedCard[];
    /** What this player may play now. Empty when it is not their turn. */
    yours: BelotCard[];
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
    /** Every hand counted so far, oldest first. */
    sheet: BelotDealRow[];
    northSouthScore: number;
    eastWestScore: number;
    hangingPoints: number;
}
