import React from 'react';
import { Link } from 'react-router-dom';

interface BrandProps {
    /**
     * What the mark is printed on. On the felt it is white with the orange
     * `.bg`; on the sign-in card it is card ink with the suit red, the two
     * colours a playing card is printed in.
     */
    tone?: 'felt' | 'card';
    size?: 'md' | 'lg';
    /**
     * The mark is the way back to the games — on screens a signed-in player
     * reaches from the hub. Left off where there is nowhere to go back to:
     * the sign-in card, and the tables, where a stray tap must not walk a
     * player out of a game.
     */
    home?: boolean;
}

/**
 * DECK.bg wordmark. Announced as a single name so a screen reader says
 * "DECK.bg" rather than reading the two coloured halves apart.
 */
const Brand: React.FC<BrandProps> = ({ tone = 'felt', size = 'md', home = false }) => {
    const mark = <Mark tone={tone} size={size} />;
    if (!home) return mark;
    return (
        <Link to="/" className="brand-link" aria-label="DECK.bg, към игрите">
            {mark}
        </Link>
    );
};

const Mark: React.FC<Required<Pick<BrandProps, 'tone' | 'size'>>> = ({ tone, size }) => (
    <span
        style={{
            ...wordStyle,
            fontSize: size === 'lg' ? 'clamp(2.1rem, 9vw, 2.6rem)' : wordStyle.fontSize,
            color: tone === 'card' ? 'var(--ink)' : 'var(--text-1)',
        }}
        role="img"
        aria-label="DECK.bg"
    >
        <span aria-hidden="true">
            DECK<span style={{ color: tone === 'card' ? 'var(--suit-red)' : 'var(--accent)' }}>.bg</span>
        </span>
    </span>
);

const wordStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.05rem, 4.2vw, 1.3rem)',
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
};

export default Brand;
