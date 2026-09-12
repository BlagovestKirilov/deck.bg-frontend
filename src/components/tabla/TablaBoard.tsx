import React from 'react';
import { BAR, CheckerColor, ComboHop, Hop, OFF, Side, TablaState } from '../../types/tabla.types';

interface Props {
    state: TablaState;
    /** Currently picked-up origin, or null. */
    selected: number | null;
    onSelect: (from: number | null) => void;
    onMove: (from: number, die: number) => void;
    /** Plays both dice with one checker. */
    onCombo: (combo: ComboHop) => void;
    /** Colour this player's own checkers are drawn in. */
    myColor: CheckerColor;
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

/**
 * `color` is how a checker is painted, which is now separate from which side it
 * belongs to — that is what lets both players choose white for themselves.
 */
const Checker: React.FC<{ color: CheckerColor; label?: string }> = ({ color, label }) => (
    <span className={`checker checker--${color}`} aria-hidden="true">
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

export const Die: React.FC<{ value: number; used?: boolean }> = ({ value, used }) => {
    const slots = PIP_SLOTS[value];

    // Never render a blank face: if the value is somehow outside 1..6, show it
    // as a number rather than an empty square.
    if (!slots) {
        return (
            <span className={`die die--numeric ${used ? 'die--used' : ''}`} role="img" aria-label={`Зар ${value}`}>
                {value}
            </span>
        );
    }

    return (
        <span className={`die ${used ? 'die--used' : ''}`} role="img" aria-label={`Зар ${value}`}>
            {slots.map((slot) => (
                <span key={slot} className="die__pip" style={{ gridArea: `${Math.floor(slot / 3) + 1} / ${(slot % 3) + 1}` }} />
            ))}
        </span>
    );
};

/**
 * The marker beside a pip count: a die face showing a single pip, painted like
 * that player's checkers.
 *
 * It replaces the word «Пипове», which had to be repeated on both rows and said
 * nothing about whose count it was. Fill carries the distinction as well as
 * colour does — solid for the dark side, pale for the light one — so the two
 * rows stay apart without relying on colour alone.
 */
export const PipDie: React.FC<{ color: CheckerColor }> = ({ color }) => (
    <span className={`pip-die pip-die--${color}`} aria-hidden="true">
        <span className="pip-die__pip" />
    </span>
);

const TablaBoard: React.FC<Props> = ({ state, selected, onSelect, onMove, onCombo, myColor }) => {
    const { points, mySide, legalHops } = state;
    const comboHops = state.comboHops ?? [];
    const otherColor: CheckerColor = myColor === 'white' ? 'black' : 'white';

    /** How a canonical side is painted on this screen. */
    const colorOf = (side: Side): CheckerColor => (side === mySide ? myColor : otherColor);

    const hopsFrom = (from: number) => legalHops.filter((h) => h.from === from);
    const combosFrom = (from: number) => comboHops.filter((c) => c.from === from);
    const movableOrigins = new Set(legalHops.map((h) => h.from));
    const targets: Hop[] = selected === null ? [] : hopsFrom(selected);
    const targetPoints = new Set(targets.map((h) => h.to));

    // Squares reachable only by spending both dice. Marked apart from ordinary
    // targets, because playing one commits two dice rather than one.
    const comboTargets: ComboHop[] = selected === null ? [] : combosFrom(selected);
    const comboByPoint = new Map(comboTargets.map((c) => [c.to, c]));

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
            // Single-die hops win where a square is reachable both ways: that is
            // the smaller commitment, and the far square stays one tap away.
            const combo = comboByPoint.get(normalised);
            if (combo) {
                onCombo(combo);
                onSelect(null);
                return;
            }
        }

        if (movableOrigins.has(normalised)) {
            // Always show the destinations first, even when there is only one.
            // Playing a lone option on the first tap meant the green targets
            // flashed past unseen and a checker moved before it was aimed.
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
        const combo = comboByPoint.get(normalised);
        const isComboTarget = !isLegalTarget && combo !== undefined;
        const isSource = selected === normalised;
        const isMovable = movableOrigins.has(normalised);

        const classes = [
            'tabla-point',
            row === 2 ? 'tabla-point--bottom' : '',
            canonicalPoint % 2 === 0 ? 'tabla-point--dark' : 'tabla-point--light',
            isLegalTarget ? 'tabla-point--legal' : '',
            isComboTarget ? 'tabla-point--combo' : '',
            isSource ? 'tabla-point--source' : '',
            !isLegalTarget && !isComboTarget && !isSource && isMovable ? 'tabla-point--playable' : '',
        ].filter(Boolean).join(' ');

        const interactive = isMovable || isLegalTarget || isComboTarget;
        const label = occ
            ? `Поле ${canonicalPoint}: ${occ.count} ${occ.side === mySide ? 'ваши' : 'на опонента'}`
            : isComboTarget
              ? `Поле ${canonicalPoint}: празно, достижимо с двата зара (${combo!.firstDie} и ${combo!.secondDie})`
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
                            color={colorOf(occ.side)}
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

    // Bearing off can need both dice — a checker six away goes out as 2 then 4,
    // never in one hop. Only single-die hops were consulted here, so that
    // checker had no way out on screen even though the server allowed it.
    const offHop = targets.find((h) => h.to === OFF);
    const offCombo = comboTargets.find((c) => c.to === OFF);
    const offLegal = offHop !== undefined || offCombo !== undefined;

    return (
        <div
            className="tabla-board"
            role="group"
            aria-label={`Дъска за табла, вашите пулове са ${myColor === 'white' ? 'бели' : 'черни'}`}
        >
            {Array.from({ length: 24 }).map((_, i) => renderPoint(i + 1))}

            <button
                type="button"
                className={`tabla-bar ${barLegal ? 'tabla-bar--legal' : ''} ${selected === BAR ? 'tabla-bar--source' : ''}`}
                onClick={() => {
                    if (!barLegal) return;
                    onSelect(selected === BAR ? null : BAR);
                }}
                disabled={!barLegal}
                aria-label={`Централна лента: ваши ${state.myBar}, на опонента ${state.opponentBar}`}
            >
                {Array.from({ length: Math.min(state.opponentBar, 3) }).map((_, i) => (
                    <Checker key={`ob${i}`} color={otherColor} />
                ))}
                {Array.from({ length: Math.min(state.myBar, 3) }).map((_, i) => (
                    <Checker
                        key={`mb${i}`}
                        color={myColor}
                        label={i === 2 && state.myBar > 3 ? String(state.myBar) : undefined}
                    />
                ))}
            </button>

            <button
                type="button"
                className={[
                    'tabla-off',
                    offLegal ? 'tabla-off--legal' : '',
                    // Two dice to get out, marked like a two-dice square on the
                    // board, so the cost is visible before the tap.
                    !offHop && offCombo ? 'tabla-off--combo' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                    // One die where one will do; it is the smaller commitment.
                    if (offHop) {
                        onMove(offHop.from, offHop.die);
                        onSelect(null);
                        return;
                    }
                    if (offCombo) {
                        onCombo(offCombo);
                        onSelect(null);
                    }
                }}
                disabled={!offLegal}
                aria-label={
                    `Изведени пулове: ваши ${state.myOff} от 15, на опонента ${state.opponentOff} от 15`
                    + (offHop ? '. Може да изведете пул.' : '')
                    + (!offHop && offCombo
                        ? `. Може да изведете пул с двата зара (${offCombo.firstDie} и ${offCombo.secondDie}).`
                        : '')
                }
            >
                <span className="tabla-off__side">
                    <Checker color={otherColor} />
                    <span className="tabla-off__count">
                        {state.opponentOff}<span className="tabla-off__total">/15</span>
                    </span>
                </span>
                <span className="tabla-off__side">
                    <Checker color={myColor} />
                    <span className="tabla-off__count" style={{ color: 'var(--gold)' }}>
                        {state.myOff}<span className="tabla-off__total">/15</span>
                    </span>
                </span>
            </button>
        </div>
    );
};

export default TablaBoard;
