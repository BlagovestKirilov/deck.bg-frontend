import React from 'react';

interface BrandProps {
    /**
     * What the mark is printed on. On the felt it is white with the orange
     * `.bg`; on the sign-in card it is card ink with the suit red, the two
     * colours a playing card is printed in.
     */
    tone?: 'felt' | 'card';
    size?: 'md' | 'lg';
}

/**
 * DECK.bg wordmark. Announced as a single name so a screen reader says
 * "DECK.bg" rather than reading the two coloured halves apart.
 */
const Brand: React.FC<BrandProps> = ({ tone = 'felt', size = 'md' }) => (
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
