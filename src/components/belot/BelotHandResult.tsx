import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { BelotDealRow, BelotState, BelotTeam } from '../../types/belot.types';
import { ContractMark } from './ContractMark';

/** How long the count stays up before the table carries on without it. */
const SHOWN_FOR_SECONDS = 8;

const CALL_WORD: Record<BelotDealRow['contract'], string> = {
    CLUBS: 'спатия',
    DIAMONDS: 'каро',
    HEARTS: 'купа',
    SPADES: 'пика',
    NO_TRUMPS: 'без коз',
    ALL_TRUMPS: 'всичко коз',
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

    const outcome = {
        MADE: calledByUs ? 'Изкарахте я.' : 'Изкараха я.',
        INSIDE: calledByUs
            ? 'Вътре — точките от ръката отиват при тях.'
            : 'Вътре — точките от ръката отиват при вас.',
        HANGING: 'Висяща — точките на обявилите остават за следващата ръка.',
    }[row.result];

    return (
        <Modal
            title={`Ръка ${row.dealNumber}`}
            width="narrow"
            onClose={onClose}
            actions={<Button variant="primary" onClick={onClose}>Продължи</Button>}
        >
            <div className="sheet hand-result">
                <p className="hand-result__called">
                    <ContractMark contract={row.contract} />
                    <span>{CALL_WORD[row.contract]}</span>
                    {row.doubling !== 'NONE' && (
                        <span className="hand-result__doubled">
                            {row.doubling === 'CONTRA' ? 'контра' : 'реконтра'}
                        </span>
                    )}
                    {declarer && <span className="hand-result__by">обяви {declarer}</span>}
                </p>

                <div className="hand-result__grid">
                    <span aria-hidden="true" />
                    <span className="hand-result__head">ние</span>
                    <span className="hand-result__head hand-result__head--theirs">вие</span>

                    <span className="hand-result__label">Обявявания</span>
                    <span className="hand-result__cell">{ours.announced}</span>
                    <span className="hand-result__cell hand-result__cell--theirs">{theirs.announced}</span>

                    <span className="hand-result__label">От ръцете</span>
                    <span className="hand-result__cell">{ours.tricks}</span>
                    <span className="hand-result__cell hand-result__cell--theirs">{theirs.tricks}</span>

                    <span className="hand-result__label">Общо</span>
                    <span className="hand-result__cell">{ours.total}</span>
                    <span className="hand-result__cell hand-result__cell--theirs">{theirs.total}</span>

                    {/* What goes on the sheet: the line the count is for, so it is
                        the one set large and ruled off from the working above. */}
                    <span className="hand-result__label hand-result__label--written">Записват се</span>
                    <span className="hand-result__cell hand-result__cell--written">{ours.written}</span>
                    <span className="hand-result__cell hand-result__cell--written hand-result__cell--theirs">
                        {theirs.written}
                    </span>
                </div>

                <p className={`hand-result__outcome hand-result__outcome--${row.result.toLowerCase()}`}>
                    {outcome}
                </p>
                <p className="hand-result__next" aria-live="off">Следващата ръка след {left} с</p>
            </div>
        </Modal>
    );
};

export default BelotHandResult;
