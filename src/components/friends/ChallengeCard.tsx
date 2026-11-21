import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { friendService } from '../../api/friendService';
import { Friends } from '../../hooks/useFriends';
import { ChallengeView } from '../../types/friends.types';
import { GAMES } from '../lobby/gameCatalogue';

const titleOf = (key: string) => GAMES.find((game) => game.key === key)?.title ?? key;

/** Seconds left until a challenge runs out, counted down once a second. */
function useSecondsLeft(expiresAt: string | undefined): number {
    const left = () => (expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000)) : 0);
    const [seconds, setSeconds] = useState(left);
    useEffect(() => {
        setSeconds(left());
        const timer = window.setInterval(() => setSeconds(left()), 1000);
        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expiresAt]);
    return seconds;
}

/**
 * A challenge to a game, on the hub: the one made to this player asks for an
 * answer in a dialog; the one they made waits in a bar at the foot of the
 * screen, where it can be taken back. Either runs out on its own after a
 * minute. Accepting opens the game on both screens.
 */
const ChallengeCard: React.FC<{ friends: Friends }> = ({ friends }) => {
    const incoming = friends.page?.incomingChallenge ?? null;
    const outgoing = friends.page?.outgoingChallenge ?? null;
    return (
        <>
            {incoming && <Incoming key={incoming.id} challenge={incoming} friends={friends} />}
            {outgoing && <Outgoing key={outgoing.id} challenge={outgoing} friends={friends} />}
        </>
    );
};

const Incoming: React.FC<{ challenge: ChallengeView; friends: Friends }> = ({ challenge, friends }) => {
    const seconds = useSecondsLeft(challenge.expiresAt);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const game = titleOf(challenge.game);

    const decline = () => void friends.act(() => friendService.declineChallenge(challenge.id));

    if (seconds === 0) return null;

    return (
        <Modal
            title="Покана за игра"
            width="narrow"
            className="lobby sheet challenge"
            dismissOnScrim={false}
            onClose={decline}
            actions={
                <>
                    <Button variant="ghost" disabled={busy} onClick={decline}>Откажи</Button>
                    <Button
                        variant="primary"
                        loading={busy}
                        onClick={async () => {
                            setBusy(true);
                            const failed = await friends.acceptChallenge(challenge.id);
                            if (failed) {
                                setError(failed);
                                setBusy(false);
                            }
                        }}
                    >
                        Играй
                    </Button>
                </>
            }
        >
            <div className="challenge__body">
                <p className="challenge__line">
                    <strong>{challenge.from}</strong> те кани на {game}.
                </p>
                <p className="challenge__note">Приятелска игра: не променя ранга.</p>
                <div className="challenge__clock" role="timer" aria-label={`Остават ${seconds} секунди`}>
                    <span className="challenge__fuse" style={{ transform: `scaleX(${seconds / 60})` }} />
                </div>
                {error && <p className="friends__error" role="alert">{error}</p>}
            </div>
        </Modal>
    );
};

/** How long a challenge waits for its answer: the ring's full turn. */
const ANSWER_SECONDS = 60;

/**
 * A minute running out, drawn as a ring that empties, with the seconds left
 * inside it: one thing to read, where a spinner and a count were two.
 */
const CountdownRing: React.FC<{ seconds: number }> = ({ seconds }) => {
    const r = 15;
    const around = 2 * Math.PI * r;
    const left = Math.max(0, Math.min(1, seconds / ANSWER_SECONDS));
    return (
        <span className="countdown-ring" role="timer" aria-label={`Остават ${seconds} секунди`}>
            <svg viewBox="0 0 36 36" aria-hidden="true">
                <circle className="countdown-ring__track" cx="18" cy="18" r={r} />
                <circle
                    className="countdown-ring__left"
                    cx="18"
                    cy="18"
                    r={r}
                    strokeDasharray={around}
                    strokeDashoffset={around * (1 - left)}
                />
            </svg>
            <span className="countdown-ring__count tabular" aria-hidden="true">{seconds}</span>
        </span>
    );
};

const Outgoing: React.FC<{ challenge: ChallengeView; friends: Friends }> = ({ challenge, friends }) => {
    const seconds = useSecondsLeft(challenge.expiresAt);
    if (seconds === 0) return null;
    return (
        <div className="challenge-bar" role="status" aria-live="polite">
            <CountdownRing seconds={seconds} />
            <span className="challenge-bar__text">
                <span className="challenge-bar__who">Чакаме <strong>{challenge.to}</strong></span>
                <span className="challenge-bar__what">Покана за {titleOf(challenge.game)}</span>
            </span>
            <Button size="sm" variant="ghost"
                    onClick={() => void friends.act(() => friendService.cancelChallenge(challenge.id))}>
                Оттегли
            </Button>
        </div>
    );
};

export default ChallengeCard;
