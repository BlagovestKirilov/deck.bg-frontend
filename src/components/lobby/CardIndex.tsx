import React from 'react';

/**
 * A playing card's corner index: rank over suit. The bottom corner is the same
 * mark turned upside down. Decoration for the eye only — the heading on the
 * card says what it is for.
 */
const CardIndex: React.FC<{ rank: string; suit: string; red: boolean; corner: 'tl' | 'br' }> = ({
    rank,
    suit,
    red,
    corner,
}) => (
    <span aria-hidden="true" className={`card-index card-index--${corner} ${red ? 'card-index--red' : ''}`}>
        <span className="card-index__rank">{rank}</span>
        <span className="card-index__suit">{suit}</span>
    </span>
);

export default CardIndex;
