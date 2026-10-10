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

    const you = state.seats.find((seat) => seat.seat === state.yourSeat)?.username ?? null;
    // Your partner gave the game away: the table is lost, but your record takes
    // it as a win, so "you lost" over "it counts as a win" would contradict
    // itself. The heading says only that it is over.
    const partnerGaveUp = !won && !!state.forfeit && !!state.forfeitedBy && state.forfeitedBy !== you;
    const verdict = won ? 'Спечелихте' : partnerGaveUp ? 'Играта приключи' : 'Загубихте';
    const reason = forfeitReason(state, you, won);

    return (
        <Modal
            label={verdict}
            closeButton={false}
            onClose={onLeave}
            width="narrow"
            className={`game-result ${won ? 'game-result--won' : 'game-result--lost'}`}
            actions={
                <>
                    <Button variant="ghost" onClick={onLeave}>Към игрите</Button>
                    <Button variant={won ? 'gold' : 'secondary'} onClick={onAgain}>Още една</Button>
                </>
            }
        >
            <h2 className="game-result__verdict">{verdict}</h2>
            {reason && <p className="game-result__reason">{reason}</p>}
            {/* The two columns of the sheet, closed: the last thing a player
                sees is the shape they have been reading all game. */}
            <p className="game-result__score">
                <span className="game-result__side game-result__side--ours">
                    <span className="game-result__points">{ours}</span>
                    <span className="game-result__who">ние</span>
                </span>
                <span className="game-result__rule" aria-hidden="true" />
                <span className="game-result__side">
                    <span className="game-result__points">{theirs}</span>
                    <span className="game-result__who">вие</span>
                </span>
            </p>
        </Modal>
    );
};

/**
 * Why a game ended before its last hand, said to each of the four in their
 * own terms. A surrender and three missed turns end the same way: whoever
 * gave the game away loses twice the rating, and their partner — who did
 * nothing wrong — is given the win. Both of those are said, to the two they
 * happen to.
 */
function forfeitReason(state: BelotState, you: string | null, won: boolean): string | null {
    const who = state.forfeitedBy;
    if (!state.forfeit || !who) return null;
    const ranOut = state.forfeit === 'INACTIVITY';

    if (who === you) {
        return ranOut
            ? 'Времето ти изтече три пъти и играта отиде при другите двама. Рейтингът ти пада двойно.'
            : 'Предаде играта и тя отиде при другите двама. Рейтингът ти пада двойно.';
    }
    const what = ranOut ? `${who} не игра три пъти` : `${who} се предаде`;
    // Their partner is told the one thing that matters to them: it does not
    // count against them, their record takes it as a win.
    return won
        ? `${what} — играта е ваша.`
        : `${what}. За теб играта се брои за победа.`;
}

export default BelotResult;
