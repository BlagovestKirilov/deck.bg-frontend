import React from 'react';
import { BelotCard } from '../../types/belot.types';
import { SUIT_COLOR } from '../../styles/tokens';

const SUIT = {
    SPADES: { symbol: '♠', color: SUIT_COLOR.black, name: 'пика' },
    HEARTS: { symbol: '♥', color: SUIT_COLOR.red, name: 'купа' },
    DIAMONDS: { symbol: '♦', color: SUIT_COLOR.red, name: 'каро' },
    CLUBS: { symbol: '♣', color: SUIT_COLOR.black, name: 'спатия' },
} as const;

const RANK = {
    SEVEN: { glyph: '7', name: 'седмица' },
    EIGHT: { glyph: '8', name: 'осмица' },
    NINE: { glyph: '9', name: 'деветка' },
    TEN: { glyph: '10', name: 'десетка' },
    JACK: { glyph: 'J', name: 'вале' },
    QUEEN: { glyph: 'Q', name: 'дама' },
    KING: { glyph: 'K', name: 'поп' },
    ACE: { glyph: 'A', name: 'асо' },
} as const;

interface Props {
    card: BelotCard;
    /** Given when the card can be played: it becomes a real button. */
    onPlay?: () => void;
    /** Dealt but not playable this turn — dimmed, and not a button. */
    muted?: boolean;
    size?: 'hand' | 'table';
}

/**
 * One card, in the deck's own two inks.
 *
 * Wears the table's existing `.pcard` clothes rather than a belot-only set —
 * a card is a card across the three games, and a second visual language for
 * the same object is a second thing to keep in step.
 */
const BelotCardFace: React.FC<Props> = ({ card, onPlay, muted = false, size = 'hand' }) => {
    const suit = SUIT[card.suit];
    const rank = RANK[card.rank];
    const label = `${rank.name} ${suit.name}`;

    const className = ['pcard', onPlay ? 'pcard--playable' : '', muted ? 'pcard--blocked' : '']
        .filter(Boolean)
        .join(' ');

    const style: React.CSSProperties = {
        width: size === 'hand' ? 'clamp(46px, 13vw, 78px)' : 'clamp(38px, 10vw, 62px)',
        aspectRatio: '71 / 103',
        color: suit.color,
    };

    const face = (
        <>
            <span className="pcard__corner" style={{ alignSelf: 'flex-start' }}>
                <span>{rank.glyph}</span>
                <span>{suit.symbol}</span>
            </span>
            <span className="pcard__pip" aria-hidden="true">{suit.symbol}</span>
        </>
    );

    if (!onPlay) {
        return <span className={className} style={style} role="img" aria-label={label}>{face}</span>;
    }

    return (
        <button type="button" className={className} style={style} onClick={onPlay} aria-label={`Изиграй ${label}`}>
            {face}
        </button>
    );
};

export default BelotCardFace;
