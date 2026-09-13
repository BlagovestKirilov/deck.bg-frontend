import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { tablaService } from '../api/tablaService';
import { isSessionExpired } from '../api/apiClient';
import { useGameSession } from '../hooks/useGameSession';
import { CheckerColor, ComboHop, TablaState } from '../types/tabla.types';
import { useCheckerColor } from '../hooks/useCheckerColor';
import { soleOrigin, stillPlayable } from '../utils/tablaSelection';
import { useDiceRoll } from '../hooks/useDiceRoll';
import { HOP_MS } from '../hooks/useHopAnimation';
import TablaBoard, { Die, PipDie } from './tabla/TablaBoard';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Modal from './ui/Modal';

/** What the badge's colour is called aloud; the badge itself is decoration. */
const COLOR_LABEL: Record<CheckerColor, string> = { white: 'белите', black: 'черните' };

/**
 * Turn budget, matching the server's TABLA_TURN_SECONDS (45 + 10 + 3 slack).
 *
 * A табла turn is several taps — roll, play each die, confirm — so it gets 45s
 * where Santase gets 20. Running out does not lose the game: like Santase, the
 * first two timeouts only raise the "still there?" prompt, and the third ends
 * the game.
 */
const TURN_SECONDS = 45;
/** Seconds on the prompt before the game is given up. */
const WARNING_SECONDS = 10;
/** When the turn pill starts reading as urgent. */
const WARNING_AT = 10;

const TablaGame: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const username = user?.username ?? '';

    const [selected, setSelected] = useState<number | null>(null);
    /**
     * How many hops each press of this turn put on the board — 1 for a single
     * die, 2 for a combo.
     *
     * Върни takes back a press, not a hop. A combo is one tap, so it has to come
     * off in one tap; popping a single hop left the checker stranded on the
     * midpoint, half way through a move the player never chose to make.
     *
     * Held only for this session. If it is ever lost — a reload mid-turn —
     * Върни falls back to one hop at a time, which is what it did before.
     */
    const pressSizes = useRef<number[]>([]);
    const [myColor, setMyColor] = useCheckerColor();
    /** Up while a blocked roll is being acknowledged. */
    const [showPass, setShowPass] = useState(false);
    /** Leaving forfeits the game, so it is confirmed first — as in Сантасе. */
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(TURN_SECONDS);
    const [showResult, setShowResult] = useState(false);
    /** True while the "still there?" prompt is up and its own clock is running. */
    const [inWarning, setInWarning] = useState(false);
    const lastTurnKeyRef = useRef<string>('');

    // The api object is stable so the session hook does not re-subscribe.
    const api = useMemo(() => ({
        searchGame: tablaService.searchGame,
        getInitialState: tablaService.getInitialState,
        surrender: tablaService.surrender,
    }), []);

    const onState = useCallback((next: TablaState) => {
        // A new turn or a new roll clears any half-finished selection.
        const key = `${next.isOnTurn}-${next.die1}-${next.die2}-${next.usedDiceCount}`;
        if (key !== lastTurnKeyRef.current) {
            lastTurnKeyRef.current = key;
            setSelected(null);
        }
        if (next.winnerUsername) setShowResult(true);
    }, []);

    const session = useGameSession<TablaState>({ gameKey: 'tabla', username, api, onState });
    const { state, isConnected, isSearching, startSearch, leaveGame, finishAndReturn } = session;

    // How far each cube has turned, and whether it is still in the air. The
    // landing rotation comes from the server's values, so the animation cannot
    // present a face that was not rolled. Above the early returns, like every
    // other hook.
    const diceRoll = useDiceRoll(state?.die1, state?.die2);

    /* ---------------- actions ---------------- */

    /** Runs a table action. Returns false when it did not go through. */
    const guard = useCallback(async (fn: () => Promise<unknown>, label?: string): Promise<boolean> => {
        if (busy) return false;
        setBusy(true);
        try {
            await fn();
            if (label) setToast(label);
            return true;
        } catch (err: any) {
            // An expired token is not a failed move. The client refreshes and
            // retries on its own, and if the session is really over the player
            // is being sent to the login screen — either way "Нещо се обърка"
            // tells them nothing and looks like the game broke.
            if (!isSessionExpired(err)) {
                setToast(err?.response?.data?.message ?? 'Нещо се обърка. Опитайте отново.');
            }
            return false;
        } finally {
            setBusy(false);
        }
    }, [busy]);

    useEffect(() => {
        if (!toast) return undefined;
        const id = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(id);
    }, [toast]);

    const handleMove = useCallback((from: number, die: number) => {
        void guard(async () => {
            await tablaService.move(from, die);
            pressSizes.current.push(1);
        });
    }, [guard]);

    // Several dice with one checker. Sent as the hops it really is, in order,
    // so the server needs no new endpoint and no new shape for a pending hop.
    // Two is the common case; doubles give four, and a checker may spend three
    // or all four. The run is recorded as one press so Върни takes it all back
    // together.
    const handleCombo = useCallback((combo: ComboHop) => {
        void guard(async () => {
            // from -> vias[0] -> ... -> to, one die at each step.
            const stops = [combo.from, ...combo.vias];

            // Each hop waits for the one before it to finish, with a little
            // room over: the move call returns when the server answers, while
            // the slide only starts when its push arrives, so the two are not
            // the same moment. Sent back-to-back the pushes land together and
            // the checker appears to make one long jump — exactly the move the
            // player cannot read, when the whole point of spending several dice
            // with one checker is seeing where it stopped on the way.
            let landed = 0;
            try {
                for (let i = 0; i < combo.dice.length; i += 1) {
                    if (i > 0) {
                        await new Promise((resolve) => window.setTimeout(resolve, HOP_MS + 120));
                    }
                    // Each hop is only sent once the one before it was accepted.
                    await tablaService.move(stops[i], combo.dice[i]);
                    landed += 1;
                }
            } finally {
                // What is on the board, not what was asked for. If a hop is
                // refused part way the earlier ones are still played, and Върни
                // has to take back exactly those.
                if (landed > 0) pressSizes.current.push(landed);
            }
        });
    }, [guard]);

    /**
     * Picks the origin up for you when there is only one it could be.
     *
     * A checker on the bar has to come in before anything else moves, so every
     * legal hop starts there and tapping the bar first decides nothing — and the
     * bar sits in the middle of the board, the furthest reach on a phone. The
     * same holds whenever one point is the only one with a move left.
     *
     * It still only *selects*: the destinations light up and the player aims.
     * Playing the move outright would move a checker before it was aimed.
     *
     * Keyed on the hops themselves, so it runs when the server sends a new
     * position rather than on every render — deselecting by tapping the origin
     * again therefore sticks until the position actually changes.
     */
    useEffect(() => {
        if (!state?.isOnTurn) return;

        const only = soleOrigin(state.legalHops);
        if (only !== null) {
            setSelected(only);
            return;
        }
        // Whatever was held is no longer a place to move from; drop it rather
        // than leaving a highlight on a point with nothing to play.
        setSelected((current) => (stillPlayable(current, state.legalHops) ? current : null));
    }, [state?.legalHops, state?.isOnTurn]);

    /** How many hops are on the board right now, readable from a callback. */
    const pendingCount = useRef(0);
    useEffect(() => {
        pendingCount.current = state?.pendingHops.length ?? 0;
        // A turn with nothing on the board has no presses to take back. Clearing
        // here covers every way a turn can end — confirmed, timed out, the
        // opponent's move, a reconnect — so a count can never outlive its turn
        // and make Върни reach into the one before.
        if (pendingCount.current === 0) pressSizes.current = [];
    }, [state?.pendingHops]);

    /** Takes back the last press: one hop, or every hop of a run. */
    const handleUndo = useCallback(async () => {
        // Never ask for more than is there, whatever the stack claims.
        const hops = Math.min(pressSizes.current.pop() ?? 1, pendingCount.current);

        let taken = 0;
        try {
            for (let i = 0; i < hops; i += 1) {
                if (i > 0) {
                    // Space them so the checker is seen retracing every leg
                    // rather than reappearing at the start.
                    await new Promise((resolve) => window.setTimeout(resolve, HOP_MS + 120));
                }
                await tablaService.undo();
                taken += 1;
            }
        } finally {
            // If it stopped part way, the rest of the press is still on the
            // board. Put the remainder back so the next Върни finishes the job
            // instead of taking back one hop of a run and leaving the others.
            if (taken < hops) pressSizes.current.push(hops - taken);
        }
    }, []);

    /* ---------------- turn clock ---------------- */

    /*
     * One absolute deadline drives both phases.
     *
     * Counting down a number held in state does not survive here: the server
     * pushes a fresh state on every roll, move and timeout report, and each push
     * would restart the countdown. So the deadline is kept as a timestamp and
     * only moved when the server actually grants more time. Everything visible
     * is derived from it: above WARNING_SECONDS remaining it is the main phase,
     * below that it is the prompt.
     */
    const deadlineRef = useRef(0);
    /** The timeout for this window has already been reported. */
    const reportedRef = useRef(false);
    /** Guards against firing the give-up call once per tick at zero. */
    const givingUpRef = useRef(false);

    const giveUp = useCallback(async () => {
        if (givingUpRef.current) return;
        givingUpRef.current = true;
        setInWarning(false);
        try {
            await tablaService.surrender();
        } catch {
            // The server may have ended the game first; leaving is still right.
        }
        finishAndReturn();
        navigate('/');
    }, [finishAndReturn, navigate]);

    // The main phase ran out. Report it and let the prompt run: only when the
    // server says the allowance is spent (400) is the game actually lost.
    const reportTimeout = useCallback(async () => {
        try {
            await tablaService.inactivity();
        } catch (err: any) {
            if (err?.response?.status === 400) void giveUp();
            // Anything else is network trouble, not a spent allowance. The
            // server's own timer still guards the game, so the prompt stays up.
        }
    }, [giveUp]);

    const handleContinue = useCallback(async () => {
        try {
            await tablaService.extendTime();
            // Optimistic: the server's push resyncs this to its own deadline.
            deadlineRef.current = Date.now() + (TURN_SECONDS + WARNING_SECONDS) * 1000;
            reportedRef.current = false;
            setInWarning(false);
        } catch (err: any) {
            if (err?.response?.status === 400) void giveUp();
        }
    }, [giveUp]);

    // Resync only when the server grants MORE time than is being counted — a new
    // turn, or Continue. A push that merely reports the current deadline (the
    // timeout report itself) must not reset the prompt.
    useEffect(() => {
        const fromServer = state?.nextMoveTimeInSeconds;
        if (fromServer == null) return;
        const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
        if (fromServer > remaining + 1) {
            deadlineRef.current = Date.now() + fromServer * 1000;
            reportedRef.current = false;
            givingUpRef.current = false;
        }
    }, [state?.nextMoveTimeInSeconds, state?.isOnTurn]);

    useEffect(() => {
        if (!state || state.winnerUsername || !state.isOnTurn) {
            setInWarning(false);
            return undefined;
        }

        const tick = () => {
            const remaining = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));

            if (remaining > WARNING_SECONDS) {
                setInWarning(false);
                setSecondsLeft(remaining - WARNING_SECONDS);
                return;
            }

            setInWarning(true);
            setSecondsLeft(remaining);

            if (!reportedRef.current) {
                reportedRef.current = true;
                void reportTimeout();
            }
            if (remaining === 0) void giveUp();
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [state, reportTimeout, giveUp]);

    /* ---------------- a blocked roll ---------------- */

    /*
     * A roll with no legal move used to pass the turn inside the same request,
     * so the dice were wiped before either player could see them. The turn now
     * stays open until it is acknowledged: both players get a moment with the
     * dice on the table, and the prompt closes itself so nobody has to sit and
     * wait for a tap.
     */
    const blocked = Boolean(state?.isOnTurn && state?.noMovesAvailable);

    /** One pass per blocked roll, whether the timer sends it or ДОБРЕ does. */
    const passSentRef = useRef(false);

    const passNow = useCallback(async () => {
        setShowPass(false);
        if (passSentRef.current) return;
        passSentRef.current = true;

        // If the pass never reached the server the turn is still ours. Put the
        // prompt back rather than leaving the player on a board they cannot act
        // on: ДОБРЕ is then the retry, and the error itself is in the toast.
        const passed = await guard(tablaService.confirm);
        if (!passed) {
            passSentRef.current = false;
            setShowPass(true);
        }
    }, [guard]);

    // Held in a ref so the timer below can stay out of the effect's deps.
    // `guard` is rebuilt every time `busy` flips, and depending on it restarted
    // the timer mid-pass — which sent confirm a second time, after the turn had
    // already moved on.
    const passNowRef = useRef<() => void>(() => {});
    passNowRef.current = () => void passNow();

    useEffect(() => {
        if (!blocked) {
            passSentRef.current = false;
            setShowPass(false);
            return undefined;
        }
        setShowPass(true);
        const id = setTimeout(() => passNowRef.current(), 2600);
        return () => clearTimeout(id);
    }, [blocked]);

    /* ---------------- lobby ---------------- */

    if (!state) {
        return (
            <main className="screen">
                <div className="panel panel--gold" style={lobbyCard}>
                    <span style={crest}>
                        <Icon name="dice" size="56%" />
                    </span>
                    <h1 style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text-1)' }}>Табла</h1>
                    <p style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>
                        Класическа табла срещу реални опоненти
                    </p>

                    <ColorChoice value={myColor} onChange={setMyColor} />

                    <Button
                        variant="primary"
                        size="lg"
                        block
                        loading={isSearching}
                        onClick={startSearch}
                        style={{ marginTop: 'var(--sp-2)' }}
                    >
                        НОВА ИГРА
                    </Button>

                    {isSearching && (
                        <p role="status" style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>
                            Търсим опонент…
                        </p>
                    )}

                    <button type="button" className="btn btn--link" onClick={() => navigate('/')}>
                        <Icon name="arrowLeft" size={16} />
                        Назад
                    </button>
                </div>
            </main>
        );
    }

    const opponentName = state.firstPlayerUsername === username
        ? state.secondPlayerUsername
        : state.firstPlayerUsername;

    const urgent = state.isOnTurn && secondsLeft <= WARNING_AT;
    const canUndo = state.isOnTurn && state.pendingHops.length > 0;
    const canRoll = state.isOnTurn && state.die1 == null;
    const iWon = state.winnerUsername === username;
    // The badges follow how the checkers are painted on *this* screen, not the
    // canonical sides: both players may have chosen white for themselves, and a
    // badge that disagreed with the board would be worse than no badge.
    const otherColor: CheckerColor = myColor === 'white' ? 'black' : 'white';

    return (
        <main style={tableStyle}>
            {!isConnected && (
                <div className="blocking" role="alert" aria-live="assertive">
                    <span className="spinner spinner--lg" style={{ color: 'var(--accent)' }} />
                    <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Възстановяване на връзката…</p>
                </div>
            )}

            {toast && <div className="game-toast" role="status" aria-live="polite">{toast}</div>}

            {/* opponent */}
            <div className="tabla-hud" style={{ flex: '0 0 auto' }}>
                <span className="tabla-hud__name">
                    <span className="truncate" style={{ color: 'var(--text-1)', fontWeight: 700 }}>
                        {opponentName}
                    </span>
                    <span className="pip-count">
                        <PipDie color={otherColor} />
                        <span className="sr-only">Пипове с {COLOR_LABEL[otherColor]}: </span>
                        <span className="tabla-hud__pip tabular">{state.opponentPipCount}</span>
                    </span>
                </span>

                <button
                    type="button"
                    className="round-btn round-btn--danger"
                    onClick={() => setConfirmLeave(true)}
                    aria-label="Напусни играта"
                >
                    <Icon name="x" size={20} />
                </button>
            </div>

            <div className="tabla-fit">
                <TablaBoard
                    state={state}
                    selected={selected}
                    onSelect={setSelected}
                    onMove={handleMove}
                    onCombo={handleCombo}
                    myColor={myColor}
                />
            </div>

            <div className="tabla-footer">
                {/* my side + turn */}
                <div className="tabla-hud">
                    <span className="tabla-hud__name">
                        <span className="truncate" style={{ color: 'var(--gold)', fontWeight: 700 }}>
                            {username}
                        </span>
                        <span className="pip-count">
                            <PipDie color={myColor} />
                            <span className="sr-only">Пипове с {COLOR_LABEL[myColor]}: </span>
                            <span className="tabla-hud__pip tabular">{state.myPipCount}</span>
                        </span>
                    </span>

                    <span className={`turn-pill ${urgent ? 'turn-pill--urgent' : ''}`} role="status" aria-live="polite">
                        <span
                            className="turn-pill__dot"
                            style={{ background: state.isOnTurn ? (urgent ? 'var(--danger)' : 'var(--success)') : 'var(--text-3)' }}
                        />
                        {state.isOnTurn ? (
                            <>
                                <span>ВАШ РЕД</span>
                                <span className="tabular" style={{ minWidth: '2ch', fontWeight: 800 }}>{secondsLeft}</span>
                            </>
                        ) : (
                            <span>ОПОНЕНТЪТ ИГРАЕ…</span>
                        )}
                    </span>
                </div>

                <div className="tabla-actions">
                    {state.die1 != null && state.die2 != null && (
                        <>
                            <Die
                                value={state.die1}
                                {...diceRoll.dice[0]}
                                // A die still in the air has not been spent yet.
                                used={!diceRoll.airborne && !state.remainingDice.includes(state.die1)}
                            />
                            <Die
                                value={state.die2}
                                {...diceRoll.dice[1]}
                                used={
                                    diceRoll.airborne
                                        ? false
                                        : state.die1 === state.die2
                                            ? state.remainingDice.length === 0
                                            : !state.remainingDice.includes(state.die2)
                                }
                            />
                            {state.die1 === state.die2 && (
                                <span className="badge badge--success">
                                    ×{state.remainingDice.length}
                                    <span className="phone-hide"> останали</span>
                                </span>
                            )}
                        </>
                    )}

                    {canRoll && (
                        <Button variant="primary" icon="dice" loading={busy}
                                className="btn--keep-label"
                                aria-label="Хвърли заровете"
                                onClick={() => void guard(tablaService.roll)}>
                            Хвърли
                        </Button>
                    )}

                    {/* The turn is committed here, not by the last move: until
                        this is pressed every hop can still be taken back. */}
                    {state.mustConfirm && (
                        <Button variant="primary" icon="check" loading={busy}
                                aria-label="Потвърди хода"
                                onClick={() => void guard(tablaService.confirm)}>
                            Потвърди
                        </Button>
                    )}

                    {canUndo && (
                        <Button variant="ghost" icon="arrowLeft" disabled={busy}
                                aria-label="Върни последния ход"
                                onClick={() => void guard(handleUndo)}>
                            Върни
                        </Button>
                    )}
                </div>
            </div>

            {confirmLeave && (
                <Modal
                    title="Напускане на играта"
                    width="narrow"
                    tone="danger"
                    onClose={() => setConfirmLeave(false)}
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => setConfirmLeave(false)}>
                                Отказ
                            </Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    setConfirmLeave(false);
                                    void leaveGame().then(() => navigate('/'));
                                }}
                            >
                                Потвърди
                            </Button>
                        </>
                    }
                >
                    <p style={{ color: 'var(--text-2)' }}>
                        Сигурни ли сте, че искате да напуснете играта? Играта се брои за загубена.
                    </p>
                </Modal>
            )}

            {showPass && !state.winnerUsername && (
                <Modal
                    title="ПОЧИВАШ"
                    width="narrow"
                    dismissOnScrim={false}
                    actions={
                        <Button variant="primary" size="lg" onClick={() => void passNow()}>
                            ДОБРЕ
                        </Button>
                    }
                >
                    <div style={passBody}>
                        {state.die1 != null && state.die2 != null && (
                            <span className="tabla-actions" style={{ minHeight: 0 }}>
                                <Die value={state.die1} />
                                <Die value={state.die2} />
                            </span>
                        )}
                        <p style={{ color: 'var(--text-2)' }}>
                            С тези зарове нямате възможен ход. Редът минава към опонента.
                        </p>
                    </div>
                </Modal>
            )}

            {inWarning && !state.winnerUsername && (
                <Modal
                    title="Още ли сте тук?"
                    width="narrow"
                    tone="danger"
                    dismissOnScrim={false}
                    actions={
                        <Button variant="primary" size="lg" onClick={() => void handleContinue()}>
                            ПРОДЪЛЖИ
                        </Button>
                    }
                >
                    <p style={{ textAlign: 'center', color: 'var(--text-2)' }}>
                        Времето за хода изтече. Продължете в следващите{' '}
                        <span className="tabular" style={{ color: 'var(--danger)', fontWeight: 800 }}>
                            {secondsLeft}
                        </span>{' '}
                        секунди, иначе играта се брои за загубена.
                    </p>
                </Modal>
            )}

            {showResult && state.winnerUsername && (
                <Modal
                    // The outcome belongs in the largest text on the dialog.
                    // "Играта приключи" was identical whether you had won or
                    // lost, leaving a single body line to carry the result.
                    title={iWon ? 'Победа!' : 'Загуба'}
                    className={`modal--result ${iWon ? '' : 'modal--loss'}`}
                    width="narrow"
                    dismissOnScrim={false}
                    actions={
                        <Button variant="primary" size="lg" onClick={() => { finishAndReturn(); navigate('/'); }}>
                            КЪМ НАЧАЛО
                        </Button>
                    }
                >
                    <div style={resultBody}>
                        <span style={{
                            ...resultMark,
                            color: iWon ? 'var(--gold)' : 'var(--text-3)',
                            background: iWon ? 'var(--gold-wash)' : 'rgba(255,255,255,.06)',
                            borderColor: iWon ? 'var(--line-gold)' : 'var(--line)',
                        }}>
                            <Icon name={iWon ? 'trophy' : 'flag'} size="50%" />
                        </span>

                        {/* The title says whether you won; this line says
                            against whom, or how it ended. A result with no
                            opponent named reads like a scoreboard rather than
                            a game someone just played. */}
                        <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-1)' }}>
                            {state.surrenderPlayerUsername
                                ? (state.surrenderPlayerUsername === username
                                    ? `Предадохте се на ${opponentName}`
                                    : `${state.surrenderPlayerUsername} се предаде!`)
                                : (iWon
                                    ? `Победихте ${opponentName}`
                                    : `Загубихте от ${opponentName}`)}
                        </p>

                    </div>
                </Modal>
            )}
        </main>
    );
};

const tableStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    // The board is the only part that flexes; the HUDs and the action row keep
    // their natural height, so the dice can never be pushed off-screen.
    justifyContent: 'flex-start',
    gap: 'var(--sp-2)',
    padding: 'calc(var(--sa-top) + var(--sp-2)) var(--sp-2) calc(var(--sa-bottom) + var(--sp-2))',
    background: 'var(--felt)',
    overflow: 'hidden',
};

/**
 * Which colour this player's checkers are drawn in.
 *
 * Local and cosmetic: the server still decides who moves first, so both players
 * may pick white and each sees their own checkers white and the opponent's
 * black. Kept in the lobby because that is where the choice is made calmly,
 * before a clock is running.
 */
const ColorChoice: React.FC<{ value: CheckerColor; onChange: (next: CheckerColor) => void }> = ({
    value,
    onChange,
}) => (
    <div className="color-choice" role="radiogroup" aria-label="Цвят на вашите пулове">
        <span className="color-choice__label">Твоите пулове</span>
        <div className="color-choice__options">
            {(['white', 'black'] as const).map((option) => (
                <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={value === option}
                    className={`color-choice__option ${value === option ? 'is-selected' : ''}`}
                    onClick={() => onChange(option)}
                >
                    <span className={`checker checker--${option} color-choice__chip`} aria-hidden="true" />
                    {option === 'white' ? 'Бели' : 'Черни'}
                </button>
            ))}
        </div>
    </div>
);

const passBody: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-4)',
    textAlign: 'center',
};

const lobbyCard: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    width: '100%',
    maxWidth: '420px',
    padding: 'clamp(24px, 7vw, 44px)',
    textAlign: 'center',
};

const crest: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(60px, 17vw, 84px)',
    height: 'clamp(60px, 17vw, 84px)',
    marginBottom: 'var(--sp-2)',
    borderRadius: '50%',
    background: 'var(--gold-wash)',
    border: '1px solid var(--line-gold)',
    color: 'var(--gold)',
};

const resultBody: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-4)',
    textAlign: 'center',
};

const resultMark: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(72px, 20vw, 96px)',
    height: 'clamp(72px, 20vw, 96px)',
    borderRadius: '50%',
    border: '1px solid',
    animation: 'scale-in var(--dur-slow) var(--ease-spring)',
};

export default TablaGame;
