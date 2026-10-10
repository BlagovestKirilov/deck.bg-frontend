import React from 'react';

/**
 * Where the pips of a number card are printed, as a real card prints them:
 * two columns down the sides and the rest on the centre line. Each is
 * [column, row] — column 0, 1 or 2 across, row 0 to 1 down. A pip below the
 * middle is printed upside down, so the card reads the same from either end.
 */
const PIPS: Record<number, ReadonlyArray<readonly [number, number]>> = {
    7: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [0, 1], [2, 1]],
    8: [[0, 0], [2, 0], [1, 0.25], [0, 0.5], [2, 0.5], [1, 0.75], [0, 1], [2, 1]],
    9: [[0, 0], [2, 0], [0, 1 / 3], [2, 1 / 3], [1, 0.5], [0, 2 / 3], [2, 2 / 3], [0, 1], [2, 1]],
    10: [[0, 0], [2, 0], [1, 1 / 6], [0, 1 / 3], [2, 1 / 3], [0, 2 / 3], [2, 2 / 3], [1, 5 / 6], [0, 1], [2, 1]],
};

interface Props {
    /** The rank as it is printed in the corner: '7' to '10', or a letter. */
    glyph: string;
    symbol: string;
    /** The card's own width, which every measure of the face is a share of. */
    width: string;
    /** How big the single suit is on a card with no number of pips. */
    pipSize: string;
}

/**
 * The middle of a card face.
 *
 * A seven carries seven pips and a ten carries ten, laid out as a printed
 * deck lays them — so the rank can be read from the middle of the card as
 * well as from its corner, which is all that shows of a card under the plate
 * or half under its neighbour. An ace and the court cards keep the one large
 * suit. Shared by every table that draws a card face.
 */
const CardCentre: React.FC<Props> = ({ glyph, symbol, width, pipSize }) => {
    const pips = PIPS[Number(glyph)];
    if (!pips) {
        return <span className="pcard__pip" style={{ fontSize: pipSize }} aria-hidden="true">{symbol}</span>;
    }
    return (
        <span className="pcard__pips" style={{ fontSize: `calc(${width} * 0.17)` }} aria-hidden="true">
            {pips.map(([column, row], i) => (
                <span
                    key={i}
                    className={row > 0.5 ? 'is-turned' : undefined}
                    style={{ left: `${column * 50}%`, top: `${row * 100}%` }}
                >
                    {symbol}
                </span>
            ))}
        </span>
    );
};

export default CardCentre;
