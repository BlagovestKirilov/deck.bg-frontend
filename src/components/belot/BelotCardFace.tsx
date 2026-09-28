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

type Size = 'hand' | 'table';

/**
 * How big a card is drawn, and how big the ink on it is.
 *
 * Eight cards are held rather than six, so a belot hand cannot be as wide as a
 * santase one — but the face is set to the card, not to a fixed point size, so
 * a smaller card carries the same printed proportions rather than the same
 * glyph shrunk against a growing margin.
 */
const SIZE: Record<Size, { width: string; corner: string; pip: string }> = {
    hand: {
        width: 'clamp(54px, 15.5vw, 86px)',
        corner: 'clamp(0.82rem, 3vw, 1.25rem)',
        pip: 'clamp(1.45rem, 5.4vw, 2.3rem)',
    },
    table: {
        width: 'clamp(46px, 12.5vw, 72px)',
        corner: 'clamp(0.72rem, 2.5vw, 1.05rem)',
        pip: 'clamp(1.2rem, 4.4vw, 1.9rem)',
    },
};

interface Props {
    card: BelotCard;
    /** Given when the card can be played: it becomes a real button. */
    onPlay?: () => void;
    /** Dealt but not playable this turn — dimmed, and not a button. */
    muted?: boolean;
    size?: Size;
}

/**
 * One card, in the deck's own two inks.
 *
 * The same face santase prints: index top-left, the suit large in the middle,
 * and the index again upside down in the far corner — which is what makes a
 * card readable from either end and is the reason real cards are printed that
 * way. Wears the table's existing `.pcard` clothes rather than a belot-only
 * set, because a card is a card across the three games.
 */
const BelotCardFace: React.FC<Props> = ({ card, onPlay, muted = false, size = 'hand' }) => {
    const suit = SUIT[card.suit];
    const rank = RANK[card.rank];
    const label = `${rank.name} ${suit.name}`;
    const scale = SIZE[size];

    const className = ['pcard', onPlay ? 'pcard--playable' : '', muted ? 'pcard--blocked' : '']
        .filter(Boolean)
        .join(' ');

    const style: React.CSSProperties = {
        width: scale.width,
        aspectRatio: '71 / 103',
        color: suit.color,
    };

    const face = (
        <>
            <span className="pcard__corner" style={{ alignSelf: 'flex-start', fontSize: scale.corner }}>
                <span>{rank.glyph}</span>
                <span>{suit.symbol}</span>
            </span>
            <span className="pcard__pip" style={{ fontSize: scale.pip }} aria-hidden="true">
                {suit.symbol}
            </span>
            <span
                className="pcard__corner"
                style={{ alignSelf: 'flex-end', fontSize: scale.corner, transform: 'rotate(180deg)' }}
                aria-hidden="true"
            >
                <span>{rank.glyph}</span>
                <span>{suit.symbol}</span>
            </span>
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
