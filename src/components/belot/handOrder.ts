import { BelotCard, BelotContract, BelotRank, BelotSuit } from '../../types/belot.types';

/**
 * A trump suit, counted down from the top: the jack, then the nine, then the
 * ordinary order. Those two out of sequence are the whole of what makes belot
 * belot, and a hand that shows them anywhere else has to be read twice.
 */
const TRUMP_ORDER: Record<BelotRank, number> = {
    JACK: 0, NINE: 1, ACE: 2, TEN: 3, KING: 4, QUEEN: 5, EIGHT: 6, SEVEN: 7,
};

/** Every other suit, in the order those cards take one another. */
const PLAIN_ORDER: Record<BelotRank, number> = {
    ACE: 0, TEN: 1, KING: 2, QUEEN: 3, JACK: 4, NINE: 5, EIGHT: 6, SEVEN: 7,
};

const COLOUR: Record<BelotSuit, 'RED' | 'BLACK'> = {
    SPADES: 'BLACK',
    CLUBS: 'BLACK',
    HEARTS: 'RED',
    DIAMONDS: 'RED',
};

/** The suit that is trump, or null when the contract names none. */
function trumpOf(contract: BelotContract | null): BelotSuit | null {
    switch (contract) {
        case 'CLUBS':
        case 'DIAMONDS':
        case 'HEARTS':
        case 'SPADES':
            return contract;
        default:
            return null;
    }
}

/**
 * Which suit sits where, for the suits this hand actually holds.
 *
 * Trump first when it is held, then the rest alternating red and black — the
 * same rule santase lays a hand out by, so a player holding cards in both
 * games is reading one habit rather than two. Two suits of the same colour
 * side by side is where a misclick comes from.
 */
function suitOrder(cards: BelotCard[], trump: BelotSuit | null): BelotSuit[] {
    const present = Array.from(new Set(cards.map((card) => card.suit)));
    const order: BelotSuit[] = [];
    const used = new Set<BelotSuit>();

    if (trump && present.includes(trump)) {
        order.push(trump);
        used.add(trump);
    }

    while (order.length < present.length) {
        const last = order.length > 0 ? COLOUR[order[order.length - 1]] : null;
        const alternating = present.find(
            (suit) => !used.has(suit) && (last === null || COLOUR[suit] !== last));
        // Only when what is left is all one colour, which is a real hand.
        const anyLeft = present.find((suit) => !used.has(suit));

        const next = alternating ?? anyLeft!;
        order.push(next);
        used.add(next);
    }

    return order;
}

/**
 * The hand, laid out the way it is held.
 *
 * Suits kept together and never two of a colour running; inside a suit, the
 * cards in the order they take one another, which is a different order for
 * the trump suit. In all trumps every suit counts down from the jack; in no
 * trumps none of them does.
 *
 * Returns a new array — the hand arrives from the server in dealing order and
 * is left that way.
 */
export function sortedHand(cards: BelotCard[], contract: BelotContract | null): BelotCard[] {
    const trump = trumpOf(contract);
    const allTrumps = contract === 'ALL_TRUMPS';
    const order = suitOrder(cards, trump);

    const rank = (card: BelotCard) =>
        (allTrumps || card.suit === trump ? TRUMP_ORDER : PLAIN_ORDER)[card.rank];

    return [...cards].sort((one, other) =>
        one.suit !== other.suit
            ? order.indexOf(one.suit) - order.indexOf(other.suit)
            : rank(one) - rank(other));
}
