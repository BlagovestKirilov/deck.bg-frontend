import React from 'react';
import { BAR, Hop, OFF, Side, TablaState } from '../../types/tabla.types';

interface Props {
    state: TablaState;
    /** Currently picked-up origin, or null. */
    selected: number | null;
    onSelect: (from: number | null) => void;
    onMove: (from: number, die: number) => void;
}

/**
 * Where a canonical point sits on screen.
 *
 * The local player's home is always the bottom-right quadrant, so the board is
 * mirrored for BLACK. Note this is done by *remapping slots*, never by
 * `transform: scaleX(-1)` — a CSS flip would mirror the checker counts and
 * labels too.
 */
function screenSlot(point: number, side: Side): { col: number; row: number } {
    // In WHITE's view: 13..24 across the top (left to right), 12..1 along the
    // bottom (left to right), with the bar between columns 6 and 8.
    const p = side === 'WHITE' ? point : 25 - point;

    if (p >= 13) {
        const index = p - 13;                  // 0..11
        return { col: index < 6 ? index + 1 : index + 2, row: 1 };
    }
    const index = 12 - p;                      // 0..11
    return { col: index < 6 ? index + 1 : index + 2, row: 2 };
}

const MAX_VISIBLE = 5;

const Checker: React.FC<{ side: Side; label?: string }> = ({ side, label }) => (
    <span className={`checker checker--${side === 'WHITE' ? 'white' : 'black'}`} aria-hidden="true">
        {label}
    </span>
);

/** Dice pip layout, by face value. */
const PIP_SLOTS: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

export const Die: React.FC<{ value: number; used?: boolean }> = ({ value, used }) => (
    <span className={`die ${used ? 'die--used' : ''}`} role="img" aria-label={`Зар ${value}`}>
        {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="die__pip" style={{ opacity: PIP_SLOTS[value]?.includes(i) ? 1 : 0 }} />
        ))}
    </span>
);

const TablaBoard: React.FC<Props> = ({ state, selected, onSelect, onMove }) => {
    const { points, mySide, legalHops } = state;
    const opponentSide: Side = mySide === 'WHITE' ? 'BLACK' : 'WHITE';

    const hopsFrom = (from: number) => legalHops.filter((h) => h.from === from);
    const movableOrigins = new Set(legalHops.map((h) => h.from));
    const targets: Hop[] = selected === null ? [] : hopsFrom(selected);
    const targetPoints = new Set(targets.map((h) => h.to));

    /** My checkers are counted in my own direction; the array is canonical. */
    const occupancy = (point: number): { side: Side; count: number } | null => {
        const raw = points[point - 1];
        if (raw === 0) return null;
        return { side: raw > 0 ? 'WHITE' : 'BLACK', count: Math.abs(raw) };
    };

    const handlePoint = (canonicalPoint: number) => {
        // Translate the tapped canonical point into my normalised frame.
        const normalised = mySide === 'WHITE' ? canonicalPoint : 25 - canonicalPoint;

        if (selected !== null) {
            const hop = targets.find((h) => h.to === normalised);
            if (hop) {
                onMove(hop.from, hop.die);
                onSelect(null);
                return;
            }
        }

        if (movableOrigins.has(normalised)) {
            const options = hopsFrom(normalised);
            // With only two distinct dice a single destination is the common
            // case, so play it immediately rather than making them tap twice.
            if (options.length === 1) {
                onMove(options[0].from, options[0].die);
                onSelect(null);
                return;
            }
            onSelect(normalised === selected ? null : normalised);
            return;
        }

        onSelect(null);
    };

    const renderPoint = (canonicalPoint: number) => {
        const { col, row } = screenSlot(canonicalPoint, mySide);
        const normalised = mySide === 'WHITE' ? canonicalPoint : 25 - canonicalPoint;
        const occ = occupancy(canonicalPoint);

        const isLegalTarget = targetPoints.has(normalised);
        const isSource = selected === normalised;
        const isMovable = movableOrigins.has(normalised);

        const classes = [
            'tabla-point',
            row === 2 ? 'tabla-point--bottom' : '',
            canonicalPoint % 2 === 0 ? 'tabla-point--dark' : 'tabla-point--light',
            isLegalTarget ? 'tabla-point--legal' : '',
            isSource ? 'tabla-point--source' : '',
            !isLegalTarget && !isSource && isMovable ? 'tabla-point--playable' : '',
        ].filter(Boolean).join(' ');

        const interactive = isMovable || isLegalTarget;
        const label = occ
            ? `Поле ${canonicalPoint}: ${occ.count} ${occ.side === mySide ? 'ваши' : 'на опонента'}`
            : `Поле ${canonicalPoint}: празно`;

        return (
            <button
                key={canonicalPoint}
                type="button"
                className={classes}
                style={{ gridColumn: col, gridRow: row }}
                onClick={() => handlePoint(canonicalPoint)}
                disabled={!interactive}
                aria-label={label}
            >
                <span className="tabla-stack">
                    {occ && Array.from({ length: Math.min(occ.count, MAX_VISIBLE) }).map((_, i) => (
                        <Checker
                            key={i}
                            side={occ.side}
                            // Past five, the top checker carries the count so a tall
                            // stack never overflows its point.
                            label={i === MAX_VISIBLE - 1 && occ.count > MAX_VISIBLE
                                ? String(occ.count) : undefined}
                        />
                    ))}
                </span>
            </button>
        );
    };

    const barLegal = legalHops.some((h) => h.from === BAR);
    const offLegal = targets.some((h) => h.to === OFF);

    return (
        <div
            className="tabla-board"
            role="group"
            aria-label={`Дъска за табла, играете с ${mySide === 'WHITE' ? 'белите' : 'черните'}`}
        >
            {Array.from({ length: 24 }).map((_, i) => renderPoint(i + 1))}

            <button
                type="button"
                className={`tabla-bar ${barLegal ? 'tabla-bar--legal' : ''} ${selected === BAR ? 'tabla-bar--source' : ''}`}
                onClick={() => {
                    if (!barLegal) return;
                    const options = hopsFrom(BAR);
                    if (options.length === 1) {
                        onMove(BAR, options[0].die);
                        onSelect(null);
                    } else {
                        onSelect(selected === BAR ? null : BAR);
                    }
                }}
                disabled={!barLegal}
                aria-label={`Централна лента: ваши ${state.myBar}, на опонента ${state.opponentBar}`}
            >
                {Array.from({ length: Math.min(state.opponentBar, 3) }).map((_, i) => (
                    <Checker key={`ob${i}`} side={opponentSide} />
                ))}
                {Array.from({ length: Math.min(state.myBar, 3) }).map((_, i) => (
                    <Checker
                        key={`mb${i}`}
                        side={mySide}
                        label={i === 2 && state.myBar > 3 ? String(state.myBar) : undefined}
                    />
                ))}
            </button>

            <button
                type="button"
                className={`tabla-off ${offLegal ? 'tabla-off--legal' : ''}`}
                onClick={() => {
                    const hop = targets.find((h) => h.to === OFF);
                    if (hop) {
                        onMove(hop.from, hop.die);
                        onSelect(null);
                    }
                }}
                disabled={!offLegal}
                aria-label={`Изведени: ваши ${state.myOff} от 15, на опонента ${state.opponentOff}`}
            >
                <span className="tabla-off__label">Опонент</span>
                <span className="tabla-off__count">{state.opponentOff}</span>
                <span className="tabla-off__label">Вие</span>
                <span className="tabla-off__count" style={{ color: 'var(--gold)' }}>{state.myOff}</span>
            </button>
        </div>
    );
};

export default TablaBoard;
