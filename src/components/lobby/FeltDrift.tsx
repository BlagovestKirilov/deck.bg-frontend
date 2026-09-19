import React, { useMemo } from 'react';

const SUITS = [
    { suit: '♠', red: false },
    { suit: '♥', red: true },
    { suit: '♦', red: true },
    { suit: '♣', red: false },
];

/**
 * How many suit signs are on the table at once. Plain glyphs animating only
 * transform and opacity, so even a cheap phone carries this many easily.
 */
const SUIT_COUNT = 20;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

interface Drifter {
    suit: string;
    red: boolean;
    style: React.CSSProperties;
}

/**
 * Suit signs drifting slowly up the felt behind the sign-in card.
 *
 * Decoration only: hidden from assistive technology and from the pointer.
 * Depth comes from size and opacity, never from a blur filter — a blurred
 * element that moves is repainted every frame, and this has to stay smooth on
 * a cheap phone. Reduced motion stops it through the global rule in
 * theme.css, and the signs then sit below the fold, out of sight.
 *
 * Positions are drawn once per mount: a fresh scatter each visit, but stable
 * while the page is open, so switching between sign-in and register does not
 * reshuffle the table.
 */
const FeltDrift: React.FC = () => {
    const drifters = useMemo<Drifter[]>(() =>
        Array.from({ length: SUIT_COUNT }, () => {
            const { suit, red } = pick(SUITS);
            const size = rand(1.1, 3.8);
            // Larger reads as nearer, so it is a little brighter and faster.
            const near = (size - 1.1) / 2.7;
            return {
                suit,
                red,
                style: {
                    left: `${rand(-3, 97)}%`,
                    fontSize: `${size}rem`,
                    '--drift-spin': `${rand(-40, 40)}deg`,
                    '--drift-turn': `${rand(-180, 180)}deg`,
                    '--drift-opacity': 0.08 + near * 0.12,
                    animationDuration: `${rand(24, 42) - near * 8}s`,
                    // Negative, so the table is already covered on first paint
                    // instead of everything rising from the bottom together.
                    animationDelay: `${-rand(0, 42)}s`,
                } as React.CSSProperties,
            };
        }), []);

    return (
        <div className="felt-drift" aria-hidden="true">
            {drifters.map((d, i) => (
                <span key={i} className={`drifter ${d.red ? 'drifter--red' : ''}`} style={d.style}>
                    {d.suit}
                </span>
            ))}
        </div>
    );
};

export default FeltDrift;
