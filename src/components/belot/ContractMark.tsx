import React from 'react';
import { BelotContract } from '../../types/belot.types';

const SUIT_GLYPH: Partial<Record<BelotContract, { symbol: string; red: boolean }>> = {
    CLUBS: { symbol: '♣', red: false },
    DIAMONDS: { symbol: '♦', red: true },
    HEARTS: { symbol: '♥', red: true },
    SPADES: { symbol: '♠', red: false },
};

/** Said out loud, for a screen reader and for the two that have no glyph. */
const SPOKEN: Record<BelotContract, string> = {
    CLUBS: 'спатия',
    DIAMONDS: 'каро',
    HEARTS: 'купа',
    SPADES: 'пика',
    NO_TRUMPS: 'без коз',
    ALL_TRUMPS: 'всичко коз',
};

/**
 * A contract, printed the way a card is: the suit as its own glyph in its own
 * ink. The two contracts that name no suit have no glyph to print, so they
 * are set in words — which is also how they are called at a table.
 */
export const ContractMark: React.FC<{ contract: BelotContract }> = ({ contract }) => {
    const suit = SUIT_GLYPH[contract];

    if (!suit) {
        return <span>{SPOKEN[contract]}</span>;
    }

    return (
        <span
            className={`belot__suit belot__suit--${suit.red ? 'red' : 'black'}`}
            role="img"
            aria-label={SPOKEN[contract]}
        >
            {suit.symbol}
        </span>
    );
};

export default ContractMark;
