import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { tablaService } from '../api/tablaService';
import { useGameSession } from '../hooks/useGameSession';
import { TablaState } from '../types/tabla.types';
import TablaBoard, { Die } from './tabla/TablaBoard';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Modal from './ui/Modal';

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

    /* ---------------- actions ---------------- */

    const guard = useCallback(async (fn: () => Promise<unknown>, label?: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await fn();
            if (label) setToast(label);
        } catch (err: any) {
            setToast(err?.response?.data?.message ?? 'Нещо се обърка. Опитайте отново.');
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
        void guard(() => tablaService.move(from, die));
    }, [guard]);

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

                    <Button
                        variant="primary"
                        size="lg"
                        block
                        loading={isSearching}
                        onClick={startSearch}
                        style={{ marginTop: 'var(--sp-4)' }}
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
                    <span>Пипове: <span className="tabla-hud__pip tabular">{state.opponentPipCount}</span></span>
                </span>

                <button
                    type="button"
                    className="round-btn round-btn--danger"
                    onClick={() => void leaveGame().then(() => navigate('/'))}
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
                />
            </div>

            <div className="tabla-footer">
                {/* my side + turn */}
                <div className="tabla-hud">
                    <span className="tabla-hud__name">
                        <span className="truncate" style={{ color: 'var(--gold)', fontWeight: 700 }}>
                            {username}
                        </span>
                        <span>Пипове: <span className="tabla-hud__pip tabular">{state.myPipCount}</span></span>
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
                            <Die value={state.die1} used={!state.remainingDice.includes(state.die1)} />
                            <Die
                                value={state.die2}
                                used={
                                    state.die1 === state.die2
                                        ? state.remainingDice.length === 0
                                        : !state.remainingDice.includes(state.die2)
                                }
                            />
                            {state.die1 === state.die2 && (
                                <span className="badge badge--success">
                                    ×{state.remainingDice.length} останали
                                </span>
                            )}
                        </>
                    )}

                    {canRoll && (
                        <Button variant="primary" icon="dice" loading={busy}
                                onClick={() => void guard(tablaService.roll)}>
                            Хвърли
                        </Button>
                    )}

                    {/* The turn is committed here, not by the last move: until
                        this is pressed every hop can still be taken back. */}
                    {state.mustConfirm && (
                        <Button variant="primary" icon="check" loading={busy}
                                onClick={() => void guard(tablaService.confirm)}>
                            Потвърди
                        </Button>
                    )}

                    {canUndo && (
                        <Button variant="ghost" icon="arrowLeft" disabled={busy}
                                onClick={() => void guard(tablaService.undo)}>
                            Върни
                        </Button>
                    )}

                    {state.noMovesAvailable && (
                        <span className="badge badge--danger">Няма възможен ход</span>
                    )}
                </div>
            </div>

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
                    title="Играта приключи"
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

                        <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-1)' }}>
                            {state.surrenderPlayerUsername
                                ? (state.surrenderPlayerUsername === username
                                    ? 'Вие се предадохте.'
                                    : `${state.surrenderPlayerUsername} се предаде!`)
                                : (iWon ? 'Победа!' : `${state.winnerUsername} спечели.`)}
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
