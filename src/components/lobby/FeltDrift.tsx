import React, { useMemo } from 'react';

const SUITS = [
    { suit: '♠', red: false },
    { suit: '♥', red: true },
    { suit: '♦', red: true },
    { suit: '♣', red: false },
];

/** Card ranks in the Сантасе deck, in Bulgarian indices. */
const RANKS = ['9', '10', 'В', 'Д', 'К', 'А'];

/** Kept low: this runs behind a form on low-end phones. */
const CARD_COUNT = 9;
const SUIT_COUNT = 7;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

interface Drifter {
    kind: 'card' | 'suit';
    suit: string;
    red: boolean;
    rank: string;
    style: React.CSSProperties;
}

/**
 * Cards and suit signs drifting slowly up the felt behind the sign-in card.
 *
 * Decoration only: hidden from assistive technology and from the pointer.
 * Depth comes from size and opacity, never from a blur filter — a blurred
 * element that moves is repainted every frame, and this has to stay smooth on
 * a cheap phone. Only transform and opacity animate. Reduced motion stops it
 * through the global rule in theme.css, and the drifters then sit below the
 * fold, out of sight.
 *
 * Positions are drawn once per mount: a fresh scatter each visit, but stable
 * while the page is open, so switching between sign-in and register does not
 * reshuffle the table.
 */
const FeltDrift: React.FC = () => {
    const drifters = useMemo<Drifter[]>(() => {
        const make = (kind: Drifter['kind']): Drifter => {
            const { suit, red } = pick(SUITS);
            const scale = kind === 'card' ? rand(0.7, 1.35) : rand(1.2, 3.2);
            // Larger reads as nearer, so it is a little brighter and faster.
            const near = kind === 'card' ? (scale - 0.7) / 0.65 : (scale - 1.2) / 2;
            return {
                kind,
                suit,
                red,
                rank: pick(RANKS),
                style: {
                    left: `${rand(-4, 96)}%`,
                    fontSize: kind === 'suit' ? `${scale}rem` : undefined,
                    '--drift-scale': kind === 'card' ? scale : 1,
                    '--drift-spin': `${rand(-40, 40)}deg`,
                    '--drift-turn': `${rand(-160, 160)}deg`,
                    '--drift-opacity': kind === 'card' ? 0.1 + near * 0.12 : 0.06 + near * 0.08,
                    animationDuration: `${rand(26, 44) - near * 8}s`,
                    // Negative, so the table is already covered on first paint
                    // instead of everything rising from the bottom together.
                    animationDelay: `${-rand(0, 44)}s`,
                } as React.CSSProperties,
            };
        };
        return [
            ...Array.from({ length: CARD_COUNT }, () => make('card')),
            ...Array.from({ length: SUIT_COUNT }, () => make('suit')),
        ];
    }, []);

    return (
        <div className="felt-drift" aria-hidden="true">
            {drifters.map((d, i) =>
                d.kind === 'card' ? (
                    <span key={i} className={`drifter drifter--card ${d.red ? 'drifter--red' : ''}`} style={d.style}>
                        <span className="drifter__rank">{d.rank}</span>
                        <span className="drifter__pip">{d.suit}</span>
                    </span>
                ) : (
                    <span key={i} className={`drifter drifter--suit ${d.red ? 'drifter--red' : ''}`} style={d.style}>
                        {d.suit}
                    </span>
                ),
            )}
        </div>
    );
};

export default FeltDrift;
