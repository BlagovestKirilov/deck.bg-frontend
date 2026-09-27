import React from 'react';
import Modal from '../ui/Modal';
import { BelotDealRow, BelotState, BelotTeam } from '../../types/belot.types';
import { ContractMark } from './ContractMark';

interface Props {
    state: BelotState;
    onClose: () => void;
}

/**
 * The score sheet, drawn as the sheet of paper it is.
 *
 * Two ruled columns, ours and theirs, a line per hand. The contract is
 * printed in the column of the side that called it, so who called what is
 * read from where it sits rather than from an arrow or a label — which is
 * how it is read on the paper version.
 *
 * Under each figure is what the cards were actually worth. Written points
 * and card points are different numbers, and the gap between them is what
 * every argument at a belot table is about.
 */
const BelotScoreSheet: React.FC<Props> = ({ state, onClose }) => {
    const ours = teamOf(state);
    const rows = state.sheet;

    return (
        <Modal title="Резултат" onClose={onClose} width="narrow">
            <div className="sheet">
                {rows.length === 0 ? (
                    <p className="sheet__empty">Още няма изиграна ръка. Първата се записва тук.</p>
                ) : (
                    <>
                        <div className="sheet__grid">
                            <span className="sheet__head" aria-hidden="true" />
                            <span className="sheet__head sheet__head--named">ние</span>
                            <span className="sheet__head sheet__head--named sheet__head--theirs">те</span>

                            {rows.map((row) => (
                                <Line key={row.dealNumber} row={row} ours={ours} />
                            ))}
                        </div>

                        <div className="sheet__grid sheet__totals">
                            <span className="sheet__number" aria-hidden="true" />
                            <span className="sheet__cell">
                                <span className="sheet__points">{scoreOf(state, ours)}</span>
                            </span>
                            <span className="sheet__cell sheet__cell--theirs">
                                <span className="sheet__points">{scoreOf(state, other(ours))}</span>
                            </span>
                        </div>
                    </>
                )}

                {state.hangingPoints > 0 && (
                    <p className="sheet__hanging">
                        Висящи {state.hangingPoints} — печели ги този, който вземе следващата ръка.
                    </p>
                )}
            </div>
        </Modal>
    );
};

/** One hand: what each side was given, and who asked for it. */
const Line: React.FC<{ row: BelotDealRow; ours: BelotTeam }> = ({ row, ours }) => {
    const calledByUs = row.callerTeam === ours;

    const written = (mine: boolean) => (mine ? row.callerScore : row.opponentScore) ?? 0;
    const raw = (mine: boolean) => (mine ? row.callerPoints : row.opponentPoints) ?? 0;

    const cell = (mine: boolean, theirs: boolean) => (
        <span className={`sheet__cell ${theirs ? 'sheet__cell--theirs' : ''}`}>
            <span className={`sheet__points ${written(mine) === 0 ? 'sheet__none' : ''}`}>
                {written(mine) === 0 ? '–' : written(mine)}
            </span>
            <span className="sheet__raw">{raw(mine)}</span>
            {((calledByUs && !theirs) || (!calledByUs && theirs)) && (
                <span className="sheet__called">
                    <ContractMark contract={row.contract} />
                    {row.doubling !== 'NONE' && (
                        <span>{row.doubling === 'CONTRA' ? 'контра' : 'реконтра'}</span>
                    )}
                    {row.result === 'INSIDE' && <span className="sheet__inside">вътре</span>}
                </span>
            )}
        </span>
    );

    return (
        <>
            <span className="sheet__number">{row.dealNumber}</span>
            {cell(calledByUs, false)}
            {cell(!calledByUs, true)}
        </>
    );
};

/** Which pair the player reading this belongs to. */
function teamOf(state: BelotState): BelotTeam {
    return state.seats.find((seat) => seat.seat === state.yourSeat)?.team ?? 'NORTH_SOUTH';
}

function other(team: BelotTeam): BelotTeam {
    return team === 'NORTH_SOUTH' ? 'EAST_WEST' : 'NORTH_SOUTH';
}

function scoreOf(state: BelotState, team: BelotTeam): number {
    return team === 'NORTH_SOUTH' ? state.northSouthScore : state.eastWestScore;
}

export default BelotScoreSheet;
