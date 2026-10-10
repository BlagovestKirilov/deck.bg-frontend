import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { BelotDealRow, BelotState, BelotTeam } from '../../types/belot.types';
import { ContractMark } from './ContractMark';

/** How long the count stays up before the table carries on without it. */
const SHOWN_FOR_SECONDS = 8;

const CALL_WORD: Record<BelotDealRow['contract'], string> = {
    CLUBS: 'СПАТИЯ',
    DIAMONDS: 'КАРО',
    HEARTS: 'КУПА',
    SPADES: 'ПИКА',
    NO_TRUMPS: 'БЕЗ КОЗ',
    ALL_TRUMPS: 'ВСИЧКО КОЗ',
};

interface Props {
    row: BelotDealRow;
    state: BelotState;
    ourTeam: BelotTeam;
    onClose: () => void;
}

/**
 * The count of a hand, once its eighth trick is down.
 *
 * The next hand is dealt the moment this one ends, so without this the last
 * trick and the whole count went by unseen: the score just changed. This is
 * the count as it is read out at a table: what each side announced, what it
 * took in tricks, the total, and what goes on the sheet, in the two columns
 * the sheet keeps.
 *
 * It takes itself away after a few seconds, because the table does not wait:
 * the auction for the next hand is already running underneath it, with a
 * clock.
 */
const BelotHandResult: React.FC<Props> = ({ row, state, ourTeam, onClose }) => {
    const [left, setLeft] = useState(SHOWN_FOR_SECONDS);

    useEffect(() => {
        if (left <= 0) {
            onClose();
            return;
        }
        const tick = setTimeout(() => setLeft((seconds) => seconds - 1), 1000);
        return () => clearTimeout(tick);
    }, [left, onClose]);

    const calledByUs = row.callerTeam === ourTeam;
    const side = (ours: boolean) => {
        const caller = ours === calledByUs;
        const points = (caller ? row.callerPoints : row.opponentPoints) ?? 0;
        const announced = caller ? row.callerDeclarations : row.opponentDeclarations;
        return {
            announced,
            tricks: points - announced,
            total: points,
            written: (caller ? row.callerScore : row.opponentScore) ?? 0,
        };
    };
    const ours = side(true);
    const theirs = side(false);

    const declarer = state.seats.find((seat) => seat.seat === row.declarer)?.username;

    // Said only when the contract was not made, and in the same word to both
    // pairs: the numbers above already say who it went to.
    const inside = row.result === 'INSIDE';

    return (
        <Modal
            label="Резултат от ръката"
            closeButton={false}
            width="narrow"
            className="hand-result"
            onClose={onClose}
            actions={<Button variant="ghost" onClick={onClose}>Продължи</Button>}
        >
            <div className="hand-result__body">
                {/* The call as it was made at the table: the same white
                    bubble it was said in, with who said it beside it. */}
                <p className="hand-result__called">
                    <span className="belot__said hand-result__contract">
                        <ContractMark contract={row.contract} />
                        {CALL_WORD[row.contract]}
                    </span>
                    {row.doubling !== 'NONE' && (
                        <span className={`belot__said belot__said--${row.doubling.toLowerCase()}`}>
                            {row.doubling === 'CONTRA' ? 'Контра' : 'Реконтра'}
                        </span>
                    )}
                    {declarer && <span className="hand-result__by">от {declarer}</span>}
                </p>

                <div className="hand-result__grid">
                    <span aria-hidden="true" />
                    <span className="hand-result__head">ние</span>
                    <span className="hand-result__head hand-result__head--theirs">вие</span>

                    <span className="hand-result__label">Обявявания</span>
                    <span className="hand-result__cell">{ours.announced}</span>
                    <span className="hand-result__cell hand-result__cell--theirs">{theirs.announced}</span>

                    <span className="hand-result__label">От ръце</span>
                    <span className="hand-result__cell">{ours.tricks}</span>
                    <span className="hand-result__cell hand-result__cell--theirs">{theirs.tricks}</span>

                    <span className="hand-result__label">Общо</span>
                    <span className="hand-result__cell">{ours.total}</span>
                    <span className="hand-result__cell hand-result__cell--theirs">{theirs.total}</span>

                    {/* What goes on the sheet: the line the count is for, so it is
                        the one set large and ruled off from the working above —
                        one rule across the whole width, not one per column. */}
                    <span className="hand-result__rule" aria-hidden="true" />
                    <span className="hand-result__label hand-result__label--written">Записват се</span>
                    <span className="hand-result__cell hand-result__cell--written">{ours.written}</span>
                    <span className="hand-result__cell hand-result__cell--written hand-result__cell--theirs">
                        {theirs.written}
                    </span>
                </div>

                {inside && <p className="hand-result__outcome">ВЪТРЕ</p>}
                {/* The time left as a fuse rather than a number: it is read at
                    a glance, and a ticking figure pulled the eye off the count. */}
                <span
                    className="hand-result__fuse"
                    style={{ '--shown-for': `${SHOWN_FOR_SECONDS}s` } as React.CSSProperties}
                    aria-hidden="true"
                />
                <p className="sr-only" aria-live="off">Следващата ръка след {left} секунди</p>
            </div>
        </Modal>
    );
};

export default BelotHandResult;
