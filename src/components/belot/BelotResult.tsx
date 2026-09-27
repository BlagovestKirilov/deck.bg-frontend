import React from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { BelotState, BelotTeam } from '../../types/belot.types';

interface Props {
    state: BelotState;
    ourTeam: BelotTeam;
    onLeave: () => void;
    onAgain: () => void;
}

/**
 * The end of a game, once a pair passes 151.
 *
 * Says who won and by what, and nothing else: the score sheet is one tap
 * away behind it, and a player who has just lost does not need the hand-by-
 * hand put in front of them.
 *
 * A loss is not an error. It is told in the same voice as a win, without the
 * red an error would wear — the only difference is which number is larger.
 */
const BelotResult: React.FC<Props> = ({ state, ourTeam, onLeave, onAgain }) => {
    const won = state.winnerTeam === ourTeam;
    const ours = ourTeam === 'NORTH_SOUTH' ? state.northSouthScore : state.eastWestScore;
    const theirs = ourTeam === 'NORTH_SOUTH' ? state.eastWestScore : state.northSouthScore;

    const partner = state.seats.find(
        (seat) => seat.team === ourTeam && seat.seat !== state.yourSeat)?.username;

    return (
        <Modal
            title={won ? 'Спечелихте' : 'Загубихте'}
            onClose={onLeave}
            width="narrow"
            className={won ? '' : 'modal--loss'}
            actions={
                <>
                    <Button variant="ghost" onClick={onLeave}>Към игрите</Button>
                    <Button variant="primary" onClick={onAgain}>Още една</Button>
                </>
            }
        >
            <p className="belot-result__score">
                <span className="belot-result__ours">{ours}</span>
                <span className="belot-result__rule" aria-hidden="true" />
                <span className="belot-result__theirs">{theirs}</span>
            </p>
            {partner && (
                <p className="belot-result__partner">
                    {won ? `Вие и ${partner} взехте играта.` : `Вие и ${partner} я изпуснахте.`}
                </p>
            )}
        </Modal>
    );
};

export default BelotResult;
