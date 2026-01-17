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
    trickFirstPlayerScore?: number;
    trickSecondPlayerScore?: number;
    bonus?: number;
    opponentPlayerBonus?: number;
    opponentPlayerCardsCount?: number;
    status?: 'WAITING' | 'GAME_STARTED';
    surrenderPlayerUsername?: string;
}