export type Side = 'WHITE' | 'BLACK';

export type ResultKind = 'SINGLE' | 'GAMMON' | 'BACKGAMMON';

/** Pseudo-point for the bar, in the mover's own frame. */
export const BAR = 25;
/** Pseudo-point for the off tray. */
export const OFF = 0;

export interface Hop {
    /** 1..24, or 25 for the bar. */
    from: number;
    /** 1..24, or 0 when bearing off. */
    to: number;
    die: number;
    isHit: boolean;
    isBearOff: boolean;
    isEntry: boolean;
}

/**
 * A position as this player sees it.
 *
 * `legalHops` comes from the server, so the client never re-implements the
 * rules — no chance of the two disagreeing about the must-use rules or bearing off.
 */
export interface TablaState {
    gameId: string;
    gameType: 'TABLA';

    firstPlayerUsername: string;
    secondPlayerUsername: string;

    mySide: Side;

    /** 24 entries, canonical numbering; positive = WHITE checkers. */
    points: number[];

    myBar: number;
    opponentBar: number;
    myOff: number;
    opponentOff: number;

    myPipCount: number;
    opponentPipCount: number;

    isOnTurn: boolean;

    die1?: number;
    die2?: number;
    remainingDice: number[];

    maxDiceUsable: number;
    usedDiceCount: number;
    mustConfirm: boolean;
    noMovesAvailable: boolean;

    legalHops: Hop[];
    pendingHops: Hop[];

    winnerUsername?: string;
    surrenderPlayerUsername?: string;
    resultKind?: ResultKind;

    inactivityCount: number;
    nextMoveTimeInSeconds?: number;

    /** Published from move one so past rolls can be verified afterwards. */
    serverSeedHash?: string;
    /** Only present once the game is over. */
    serverSeed?: string;
}
