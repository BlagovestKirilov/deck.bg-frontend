import React from 'react';
import { BelotContract } from '../../types/belot.types';

/**
 * What each call is printed as.
 *
 * The four suits are their own glyph. The two that name no suit have none,
 * so they wear the card that is highest under them: the ace in no trumps and
 * the jack in all trumps, which is how a Bulgarian table marks them and the
 * one thing a player needs to remember about either contract.
 */
const GLYPH: Record<BelotContract, { symbol: string; red: boolean }> = {
    CLUBS: { symbol: '♣', red: false },
    DIAMONDS: { symbol: '♦', red: true },
    HEARTS: { symbol: '♥', red: true },
    SPADES: { symbol: '♠', red: false },
    NO_TRUMPS: { symbol: 'A', red: false },
    ALL_TRUMPS: { symbol: 'J', red: true },
};

/** Said out loud, for a screen reader and wherever the word is wanted. */
const SPOKEN: Record<BelotContract, string> = {
    CLUBS: 'спатия',
    DIAMONDS: 'каро',
    HEARTS: 'купа',
    SPADES: 'пика',
    NO_TRUMPS: 'без коз',
    ALL_TRUMPS: 'всичко коз',
};

/**
 * A contract, printed the way a card is: in its own ink, at card size.
 */
export const ContractMark: React.FC<{ contract: BelotContract }> = ({ contract }) => {
    const mark = GLYPH[contract];

    return (
        <span
            className={`belot__suit belot__suit--${mark.red ? 'red' : 'black'}`}
            role="img"
            aria-label={SPOKEN[contract]}
        >
            {mark.symbol}
        </span>
    );
};

export default ContractMark;
