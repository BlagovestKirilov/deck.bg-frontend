import React, { useEffect, useRef, useState } from 'react';
import { OpeningThrow } from '../../types/tabla.types';
import { prefersReducedMotion, THROW_MS, useDiceRoll } from '../../hooks/useDiceRoll';
import { Die } from './TablaBoard';

/** How long a tie stays on the table before both players throw again. */
const TIE_HOLD_MS = 1300;
/** How long the deciding throw stays up, long enough to read who starts. */
const DECIDED_HOLD_MS = 1900;

/**
 * The opening roll, over the board: each player throws their own die, and the
 * higher starts by playing both.
 *
 * Nothing is thrown for you. Your die lands in the bottom half, where you sit,
 * when you press «Хвърли» — the table's own button, in its usual place under
 * the board; the opponent's lands in the top half when they press theirs. The
 * same throw the dice have in the game. A tie is shown as one, and both
 * players throw again.
 *
 * The values are the server's, from the seed committed when the game began:
 * the tap reveals a die, it does not choose one.
 */
const OpeningRoll: React.FC<{
    /** Nobody has started yet. */
    phase: boolean;
    /** Finished throws, ties included. */
    throws: OpeningThrow[];
    /** The throw in progress. */
    mine?: number;
    opponent?: number;
    opponentName: string;
    /**
     * Whether a new throw can be made: not while a finished one — a tie — is
     * still on the table, or the next die would land behind it unseen.
     */
    onReady: (ready: boolean) => void;
    onDone: () => void;
}> = ({ phase, throws, mine, opponent, opponentName, onReady, onDone }) => {
    // Finished throws already shown. Arriving mid-opening, the ties that came
    // before are history; arriving once it is settled, the decider is shown.
    const seen = useRef(phase ? throws.length : Math.max(0, throws.length - 1));
    /** The finished throw on the table right now, if any. */
    const [showing, setShowing] = useState<OpeningThrow | null>(null);
    /** Whether that throw's last die has landed and it can be read. */
    const [settled, setSettled] = useState(false);

    const done = useRef(onDone);
    done.current = onDone;
    const ready = useRef(onReady);
    ready.current = onReady;
    useEffect(() => ready.current(!showing), [showing]);

    // A throw has just been finished — by the second die. Put it on the table.
    useEffect(() => {
        if (showing || throws.length <= seen.current) return;
        setShowing(throws[seen.current]);
        seen.current += 1;
        setSettled(false);
    }, [throws, showing]);

    // It is readable once that last die lands, then held: a tie long enough
    // to see, the decider long enough to read.
    useEffect(() => {
        if (!showing) return;
        if (!settled) {
            const t = window.setTimeout(() => setSettled(true), prefersReducedMotion() ? 0 : THROW_MS);
            return () => window.clearTimeout(t);
        }
        const tie = showing.mine === showing.opponent;
        const t = window.setTimeout(() => {
            if (tie) {
                setShowing(null);
                setSettled(false);
            } else {
                done.current();
            }
        }, tie ? TIE_HOLD_MS : DECIDED_HOLD_MS);
        return () => window.clearTimeout(t);
    }, [showing, settled]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Skipping is for the result. While dice are still to be thrown
            // there is nothing to skip to.
            if (e.key === 'Escape' && showing && showing.mine !== showing.opponent) done.current();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showing]);

    /* The update that finishes a throw also empties the throw in progress, so
       for one render neither was on the table: the die that had already landed
       unmounted, came back, and was thrown a second time. A finished throw is
       therefore put on the table in the same render it arrives in; the effect
       above only takes it over, with the same values, so nothing moves. */
    const pending = !showing && throws.length > seen.current ? throws[seen.current] : null;
    const onTable = showing ?? pending;

    const myDie = onTable ? onTable.mine : mine;
    const theirDie = onTable ? onTable.opponent : opponent;
    // One throw each, so each die has its own: the same cube and the same
    // throw as the game's dice, landing when its own player throws.
    const myThrow = useDiceRoll(myDie, myDie).dice[0];
    const theirThrow = useDiceRoll(theirDie, theirDie).dice[1];

    const tie = !!showing && showing.mine === showing.opponent;
    const decided = !!showing && settled && !tie;
    const iStart = !!showing && showing.mine > showing.opponent;
    const high = showing ? Math.max(showing.mine, showing.opponent) : 0;
    const low = showing ? Math.min(showing.mine, showing.opponent) : 0;

    let who = '';
    let line = '';
    if (showing && settled) {
        who = tie ? 'Равни' : iStart ? 'Започваш ти' : `Започва ${opponentName}`;
        line = tie ? 'Хвърлете отново' : iStart ? `Играеш ${high} и ${low}` : `Играе ${high} и ${low}`;
    } else if (!onTable && phase) {
        line = mine == null ? 'По-високият зар играе първи' : opponent == null ? `Чакаме ${opponentName}` : '';
    }

    return (
        <div
            className="opening"
            // Once it is decided, a tap anywhere gets straight to the game.
            onClick={() => { if (decided) done.current(); }}
            style={{ cursor: decided ? 'pointer' : 'default' }}
        >
            <div className="opening__seat">
                <span className="opening__name truncate">{opponentName}</span>
                {theirDie != null
                    ? <Die value={theirDie} {...theirThrow} used={decided && iStart} />
                    : <span className="opening__slot" aria-label="Не е хвърлен" role="img" />}
            </div>

            <div className="opening__verdict" aria-hidden="true">
                <span className="opening__who">{who}</span>
                <span className="opening__play">{line}</span>
            </div>

            <div className="opening__seat">
                {myDie != null
                    ? <Die value={myDie} {...myThrow} used={decided && !iStart} />
                    : <span className="opening__slot" aria-label="Не е хвърлен" role="img" />}
                <span className="opening__name opening__name--me">Ти</span>
            </div>

            {/* Said once, when the throw that decides it lands. */}
            <p className="sr-only" role="status" aria-live="polite">
                {decided && showing ? summary(showing, opponentName) : tie && settled ? 'Равни. Хвърлете отново.' : ''}
            </p>
        </div>
    );
};

function summary(t: OpeningThrow, opponentName: string): string {
    const who = t.mine > t.opponent ? 'Започваш ти и играеш' : `Започва ${opponentName} и играе`;
    return `Ти хвърли ${t.mine}, ${opponentName} хвърли ${t.opponent}. ${who} ${Math.max(t.mine, t.opponent)} и ${Math.min(t.mine, t.opponent)}.`;
}

export default OpeningRoll;
