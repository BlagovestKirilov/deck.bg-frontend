export type Suit = 'SPADES' | 'HEARTS' | 'DIAMONDS' | 'CLUBS';
export type Rank = 'ACE' | 'TEN' | 'KING' | 'QUEEN' | 'JACK' | 'NINE';

export interface Card {
    id: string;
    suit: Suit;
    rank: Rank;
    points: number;
    isPlayable: boolean;
    isLastDrawn?: boolean;
}

export interface GameState {
    gameId: string;
    firstPlayerUsername: string;
    secondPlayerUsername: string;
    firstPlayerResult: number;
    secondPlayerResult: number;
    isOnTurn: boolean;
    deck: Card[];
    playedCard?: Card;
    opponentPlayedCard?: Card;
    trumpCard?: Card;
    remainingCardsCount: number;
    isClosed: boolean;
    winnerUsername?: string;
    trickWinnerUsername?: string;
    /** Who takes the trick whose two cards are on the table, sent with those two cards. */
    trickTakenBy?: string;
    trickFirstPlayerScore?: number;
    trickSecondPlayerScore?: number;
    bonus?: number;
    opponentPlayerBonus?: number;
    opponentPlayerCardsCount?: number;
    status?: 'WAITING' | 'GAME_STARTED';
    surrenderPlayerUsername?: string;
    inactivityCount?: number;
    nextMoveTimeInSeconds?: number;
    /** The opponent's turn while it is theirs: when it began and when it runs out (ISO). */
    opponentTurnStartedAt?: string;
    opponentDeadline?: string;
}

/**
 * The answer to "am I already in a game?" — `/santase/active`, `/tabla/active`.
 * The same shape the search topic sends when a game starts: 200 with this when
 * there is a game, 204 with no body when there is none.
 */
export interface ActiveGameResponse {
    status: 'GAME_STARTED';
    gameId: string;
}
