import React from 'react';

/**
 * DECK.bg wordmark. Announced as a single name so a screen reader says
 * "DECK.bg" rather than reading the two coloured halves apart.
 */
const Brand: React.FC = () => (
    <span style={wordStyle} role="img" aria-label="DECK.bg">
        <span aria-hidden="true">
            DECK<span style={{ color: 'var(--accent)' }}>.bg</span>
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
    color: 'var(--text-1)',
};

export default Brand;
