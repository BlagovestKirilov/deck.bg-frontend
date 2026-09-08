import React, {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import SockJS from 'sockjs-client';
import {Stomp} from '@stomp/stompjs';
import {useAuthContext} from '../context/AuthContext';
import {gameService} from '../api/gameService';
import {userService} from '../api/userService';
import {Card, GameState, Suit} from '../types/game.types';
import {Rank} from '../types/user.types';
import ProfilePage from './ProfilePage';
import RankBadge from './RankBadge';
import RankIcon, { getRankLabel } from './RankIcon';
import Button from './ui/Button';
import Icon from './ui/Icon';
import Brand from './ui/Brand';
import Modal from './ui/Modal';
import { SUIT_COLOR, SUIT_ON_DARK } from '../styles/tokens';

const API_BASE_URL = import.meta.env.VITE_API_URL;


const SUIT_MAP: Record<Suit, { symbol: string; color: string }> = {
    SPADES: {symbol: '♠', color: SUIT_COLOR.black},
    HEARTS: {symbol: '♥', color: SUIT_COLOR.red},
    DIAMONDS: {symbol: '♦', color: SUIT_COLOR.red},
    CLUBS: {symbol: '♣', color: SUIT_COLOR.black}
};

const RANK_ORDER: Record<string, number> = {
    'ACE': 0, 'TEN': 1, 'KING': 2, 'QUEEN': 3, 'JACK': 4, 'NINE': 5
};

// Add rank priority map for comparing user ranks
const RANK_PRIORITY: Record<string, number> = {
    'UNRANKED': 0,
    'BRONZE': 1,
    'SILVER': 2,
    'GOLD': 3,
    'PLATINUM': 4,
    'DIAMOND': 5,
    'LEGEND': 6,
};

const RANK_LABEL_BG: Record<string, string> = {
    ACE: 'Асо', TEN: 'Десетка', KING: 'Поп',
    QUEEN: 'Дама', JACK: 'Вале', NINE: 'Деветка',
};

const SUIT_LABEL_BG: Record<Suit, string> = {
    SPADES: 'пика', HEARTS: 'купа',
    DIAMONDS: 'каро', CLUBS: 'спатия',
};

/**
 * A playing card.
 *
 * Sizes come from clamp() rather than a measured window width, so cards scale
 * continuously instead of snapping at two breakpoints — and resizing no longer
 * re-renders the whole table. A playable card is a real <button>: it can be
 * reached with the keyboard and announces itself ("Асо пика").
 */
const CardComponent: React.FC<{
    card: Card;
    onClick?: () => void;
    isPlayable?: boolean;
    isSelected?: boolean;
    isSmall?: boolean;
    isLastDrawn?: boolean;
}> = ({card, onClick, isPlayable = true, isSelected, isSmall, isLastDrawn = false}) => {
    const suit = SUIT_MAP[card.suit] || {symbol: '?', color: SUIT_COLOR.black};
    const displayRank = card.rank === 'NINE' ? '9' : (card.rank === 'TEN' ? '10' : card.rank[0]);
    const name = `${RANK_LABEL_BG[card.rank] ?? card.rank} ${SUIT_LABEL_BG[card.suit] ?? ''}`.trim();

    const width = isSmall ? 'clamp(52px, 14vw, 98px)' : 'clamp(74px, 20vw, 104px)';
    const cornerSize = isSmall ? 'clamp(0.85rem, 3vw, 1.5rem)' : 'clamp(1rem, 3.6vw, 1.4rem)';
    const pipSize = isSmall ? 'clamp(1.4rem, 5.2vw, 2.7rem)' : 'clamp(1.8rem, 6.4vw, 2.6rem)';

    const interactive = isPlayable && !!onClick;

    const className = [
        'pcard',
        interactive ? 'pcard--playable' : '',
        !isPlayable ? 'pcard--blocked' : '',
        isSelected ? 'pcard--selected' : '',
        isLastDrawn ? 'card-shimmer' : '',
    ].filter(Boolean).join(' ');

    const style: React.CSSProperties = {
        width,
        aspectRatio: '71 / 103',
        color: suit.color,
    };

    const face = (
        <>
            <span className="pcard__corner" style={{alignSelf: 'flex-start', fontSize: cornerSize}}>
                <span>{displayRank}</span>
                <span>{suit.symbol}</span>
            </span>
            <span className="pcard__pip" style={{fontSize: pipSize}} aria-hidden="true">
                {suit.symbol}
            </span>
            <span
                className="pcard__corner"
                style={{alignSelf: 'flex-end', fontSize: cornerSize, transform: 'rotate(180deg)'}}
                aria-hidden="true"
            >
                <span>{displayRank}</span>
                <span>{suit.symbol}</span>
            </span>
        </>
    );

    if (!interactive) {
        return (
            <div className={className} style={style} role="img" aria-label={name}>
                {face}
            </div>
        );
    }

    return (
        <button type="button" className={className} style={style} onClick={onClick} aria-label={`Изиграй ${name}`}>
            {face}
        </button>
    );
};

const Navbar: React.FC<{
    username: string;
    onLogout: () => void;
    onProfileClick: () => void;
    rank?: Rank;
    wins?: number;
    losses?: number;
}> = ({username, onLogout, onProfileClick, rank = 'UNRANKED', wins = 0, losses = 0}) => {
    const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

    return (
        <>
            <nav style={navStyle}>
                <Brand/>

                <div style={{display: 'flex', alignItems: 'center', gap: 'var(--sp-2)'}}>
                    <RankBadge rank={rank} size="small" wins={wins} losses={losses}/>

                    <button
                        type="button"
                        onClick={onProfileClick}
                        style={navUserStyle}
                        aria-label={`Отвори профила на ${username}`}
                    >
                        <Icon name="user" size={20}/>
                        <span className="truncate" style={{maxWidth: '12ch', fontWeight: 700}}>{username}</span>
                    </button>

                    <Button
                        variant="ghost"
                        size="sm"
                        icon="logout"
                        onClick={() => setShowLogoutConfirm(true)}
                        aria-label="Изход от профила"
                    >
                        <span className="nav-label">ИЗХОД</span>
                    </Button>
                </div>
            </nav>

            {showLogoutConfirm && (
                <Modal
                    title="Изход от профила"
                    width="narrow"
                    onClose={() => setShowLogoutConfirm(false)}
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => setShowLogoutConfirm(false)}>Отказ</Button>
                            <Button variant="danger" onClick={onLogout}>Изход</Button>
                        </>
                    }
                >
                    <p style={{color: 'var(--text-2)'}}>Сигурни ли сте, че искате да излезете?</p>
                </Modal>
            )}
        </>
    );
};

const navStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--sp-3)',
    width: '100%',
    minHeight: 'clamp(56px, 12vw, 68px)',
    padding: 'calc(var(--sa-top) + var(--sp-2)) calc(var(--sp-4) + var(--sa-right)) var(--sp-2) calc(var(--sp-4) + var(--sa-left))',
    background: 'rgba(4, 12, 8, 0.82)',
    backdropFilter: 'blur(14px)',
    borderBottom: '1px solid var(--line)',
    zIndex: 'var(--z-nav)' as unknown as number,
    flexShrink: 0,
};

const navUserStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    minHeight: 'var(--tap)',
    padding: '0 var(--sp-3)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-sm)',
    transition: 'background-color var(--dur-fast) var(--ease-out)',
};

/** Confirm / acknowledge dialog used across the table. */
const AppModal: React.FC<{
    title?: string;
    message?: string | React.ReactNode;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}> = ({title, message, onConfirm, onCancel, confirmText = "Потвърди", cancelText = "Отказ"}) => (
    <Modal
        title={title}
        width="narrow"
        onClose={onCancel}
        dismissOnScrim={false}
        actions={
            <>
                {onCancel && <Button variant="ghost" onClick={onCancel}>{cancelText}</Button>}
                <Button variant="primary" onClick={onConfirm}>{confirmText}</Button>
            </>
        }
    >
        {typeof message === 'string'
            ? <p style={{color: 'var(--text-2)', textAlign: 'center'}}>{message}</p>
            : message}
    </Modal>
);

/** End-of-deal scoreboard. Dismisses itself after 2s — no button to hunt for. */
const TrickResultPopup: React.FC<{
    trickResult: { winner: string; p1Name: string; p1Score: number; p2Name: string; p2Score: number };
    onDismiss: () => void;
}> = ({trickResult, onDismiss}) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 2000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    return (
        <Modal title="Край на раздаването" width="narrow" dismissOnScrim={false}>
            <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)'}}>
                <div className="note note--success" style={{justifyContent: 'center'}}>
                    <Icon name="trophy" size={18} className="note__icon"/>
                    <span><strong>{trickResult.winner}</strong></span>
                </div>

                <div>
                    <div style={scoreRowStyle}>
                        <span className="truncate">{trickResult.p1Name}</span>
                        <span className="tabular" style={{fontWeight: 800, color: 'var(--gold)'}}>{trickResult.p1Score} т.</span>
                    </div>
                    <div style={{...scoreRowStyle, borderBottom: 'none'}}>
                        <span className="truncate">{trickResult.p2Name}</span>
                        <span className="tabular" style={{fontWeight: 800, color: 'var(--gold)'}}>{trickResult.p2Score} т.</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

const scoreRowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--sp-4)',
    padding: 'var(--sp-3) 0',
    borderBottom: '1px solid var(--line)',
    color: 'var(--text-2)',
};

/**
 * Coarse layout breakpoints via matchMedia.
 *
 * The table used to keep the exact window width in state and re-render the
 * whole game on every resize/scroll-driven viewport change. Only two structural
 * decisions actually depend on width, so only those two booleans are tracked;
 * everything else scales with clamp() in CSS.
 */
const useLayout = () => {
    const query = (q: string) => typeof window !== 'undefined' && window.matchMedia(q).matches;

    const [layout, setLayout] = useState(() => ({
        isMobile: query('(max-width: 768px)'),
        isSmallMobile: query('(max-width: 480px)'),
    }));

    useEffect(() => {
        const mobile = window.matchMedia('(max-width: 768px)');
        const small = window.matchMedia('(max-width: 480px)');
        const sync = () => setLayout({isMobile: mobile.matches, isSmallMobile: small.matches});

        sync();
        mobile.addEventListener('change', sync);
        small.addEventListener('change', sync);
        return () => {
            mobile.removeEventListener('change', sync);
            small.removeEventListener('change', sync);
        };
    }, []);

    return layout;
};

const SantaseGame: React.FC = () => {
    const navigate = useNavigate();
    const {user, logout} = useAuthContext();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [announcedSuit, setAnnouncedSuit] = useState<Suit | null>(null);
    const [confirmAction, setConfirmAction] = useState<null | {
        title: string;
        message: string;
        action: () => void;
        onCancel?: () => void
    }>(null);
    const [trickResult, setTrickResult] = useState<null | {
        winner: string;
        p1Name: string;
        p1Score: number;
        p2Name: string;
        p2Score: number
    }>(null);
    const [finalWinner, setFinalWinner] = useState<string | null>(null);
    const [activeBonuses, setActiveBonuses] = useState<{ id: number, val: number, isOpponent: boolean }[]>([]);
    const [notifications, setNotifications] = useState<{ id: number, message: string }[]>([]);
    const {isMobile, isSmallMobile} = useLayout();
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [showProfile, setShowProfile] = useState<boolean>(false);
    const [userRank, setUserRank] = useState<Rank>('UNRANKED');
    const [userWins, setUserWins] = useState<number>(0);
    const [userLosses, setUserLosses] = useState<number>(0);
    const prevGameStateRef = useRef<GameState | null>(null);
    const profileFetchedRef = useRef<boolean>(false);

    // Turn timer state
    const [turnTimeRemaining, setTurnTimeRemaining] = useState<number>(20);
    const [isInWarningPhase, setIsInWarningPhase] = useState<boolean>(false);
    const [showInactivityPopup, setShowInactivityPopup] = useState<boolean>(false);
    const [opponentLowOnTime, setOpponentLowOnTime] = useState<boolean>(false);
    const turnTimerRef = useRef<NodeJS.Timeout | null>(null);
    const opponentTimerRef = useRef<NodeJS.Timeout | null>(null);
    const opponentTurnStartRef = useRef<number | null>(null);

    // One-time rank-up popup handling
    const rankPopupShownRef = useRef<boolean>(false); // prevents duplicate popups in a session
    const [showRankUpModal, setShowRankUpModal] = useState<boolean>(false);
    const [rankUpNewRank, setRankUpNewRank] = useState<Rank | null>(null);

    // Helper to fetch profile and update local state (used on initial load - no rank-up check)
    const fetchProfileInitial = async () => {
        try {
            const profile = await userService.getProfile();
            setUserRank(profile.rank);
            setUserWins(profile.santaseWins || 0);
            setUserLosses(profile.santaseLosses || 0);

            // Just save current rank to localStorage without checking for rank-up
            try {
                localStorage.setItem('lastSantaseRank', profile.rank);
            } catch (e) {
                console.warn('Could not access localStorage for rank persistence', e);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    // Helper to refresh profile after game ends, update local state and localStorage, and show rank-up modal if rank improved
    const refreshProfileAndCheckRank = async () => {
        try {
            const profile = await userService.getProfile();
            setUserRank(profile.rank);
            setUserWins(profile.santaseWins || 0);
            setUserLosses(profile.santaseLosses || 0);

            try {
                const saved = (localStorage.getItem('lastSantaseRank') as Rank | null) || 'UNRANKED';
                const savedVal = RANK_PRIORITY[saved] ?? 0;
                const newVal = RANK_PRIORITY[profile.rank] ?? 0;
                if (newVal > savedVal && !rankPopupShownRef.current) {
                    rankPopupShownRef.current = true;
                    setRankUpNewRank(profile.rank);
                    setShowRankUpModal(true);
                }
                localStorage.setItem('lastSantaseRank', profile.rank);
            } catch (e) {
                console.warn('Could not access localStorage for rank persistence', e);
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        }
    };

    const stompClient = useRef<any>(null);
    const socketRef = useRef<any>(null);
    const gameIdRef = useRef<string | null>(null);
    const gameSubscriptionRef = useRef<any>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isReconnectingRef = useRef<boolean>(false);
    const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastMessageTimeRef = useRef<number>(Date.now());
    const reconnectStartTimeRef = useRef<number | null>(null);
    const connectionLockRef = useRef<boolean>(false);
    const retryAttemptRef = useRef<number>(0);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const username = user?.username || "Играч";

    // Fetch user profile (including rank) on mount
    useEffect(() => {
        // Prevent duplicate fetch in StrictMode
        if (profileFetchedRef.current) return;
        profileFetchedRef.current = true;

        // Use initial fetch (no rank-up check) - rank-up should only show after games
        fetchProfileInitial();
    }, []);

    // Track turn start time for persistence across refreshes
    const lastTurnStateRef = useRef<boolean | null>(null);
    const [inactivityCount, setInactivityCount] = useState<number>(0);
    const MAX_INACTIVITY = 2;

    // Session storage keys for timer persistence
    const TURN_START_KEY = 'santase_turn_start';
    const INACTIVITY_COUNT_KEY = 'santase_inactivity_count';
    const GAME_ID_KEY = 'santase_timer_game_id';

    // Helper to get turn start time from sessionStorage
    const getTurnStartTime = (): number | null => {
        try {
            const stored = sessionStorage.getItem(TURN_START_KEY);
            const storedGameId = sessionStorage.getItem(GAME_ID_KEY);
            // Only use stored time if it's for the same game
            if (stored && storedGameId === gameState?.gameId) {
                return parseInt(stored, 10);
            }
        } catch (e) {
            console.warn('Could not access sessionStorage', e);
        }
        return null;
    };

    // Helper to save turn start time to sessionStorage
    const saveTurnStartTime = (time: number) => {
        try {
            sessionStorage.setItem(TURN_START_KEY, time.toString());
            if (gameState?.gameId) {
                sessionStorage.setItem(GAME_ID_KEY, gameState.gameId);
            }
        } catch (e) {
            console.warn('Could not access sessionStorage', e);
        }
    };

    // Helper to clear turn timer from sessionStorage
    const clearTurnStartTime = () => {
        try {
            sessionStorage.removeItem(TURN_START_KEY);
        } catch (e) {
            console.warn('Could not access sessionStorage', e);
        }
    };

    // Helper to get inactivity count from sessionStorage
    const getInactivityCount = (): number => {
        try {
            const stored = sessionStorage.getItem(INACTIVITY_COUNT_KEY);
            const storedGameId = sessionStorage.getItem(GAME_ID_KEY);
            if (stored && storedGameId === gameState?.gameId) {
                return parseInt(stored, 10);
            }
        } catch (e) {
            console.warn('Could not access sessionStorage', e);
        }
        return 0;
    };

    // Helper to save inactivity count to sessionStorage
    const saveInactivityCount = (count: number) => {
        try {
            sessionStorage.setItem(INACTIVITY_COUNT_KEY, count.toString());
            if (gameState?.gameId) {
                sessionStorage.setItem(GAME_ID_KEY, gameState.gameId);
            }
        } catch (e) {
            console.warn('Could not access sessionStorage', e);
        }
    };

    // Helper function to reset turn timer to initial state
    const resetTurnTimer = () => {
        const now = Date.now();
        setTurnTimeRemaining(20);
        setIsInWarningPhase(false);
        setShowInactivityPopup(false);
        saveTurnStartTime(now);
    };

    // Handle inactivity - called when 20 seconds end
    const handleInactivityTimeout = async () => {
        try {
            await gameService.inactivity();
            // Success - show popup for Continue with 10 second countdown
            // Don't increment count yet - it will be incremented when user clicks Continue
            setIsInWarningPhase(true);
            setShowInactivityPopup(true);
            setTurnTimeRemaining(10);
            saveTurnStartTime(Date.now());
        } catch (error: any) {
            // Check if it's a 400 error indicating too many inactivity extensions
            if (error.response?.status === 400) {
                // Player has used all extensions - surrender immediately and go to main screen
                handleInactivitySurrender();
            } else {
                console.error('Error handling inactivity:', error);
            }
        }
    };

    // Handle Continue button click - call extend-time endpoint and reset to 20 seconds
    const handleInactivityContinue = async () => {
        try {
            await gameService.extendTime();
            resetTurnTimer();
        } catch (error: any) {
            // If extend-time fails (e.g., no extensions left), surrender
            if (error.response?.status === 400) {
                handleInactivitySurrender();
            } else {
                console.error('Error extending time:', error);
            }
        }
    };

    // Handle surrender from inactivity - go directly to main screen without any popup
    const handleInactivitySurrender = async () => {
        setShowInactivityPopup(false);
        setIsInWarningPhase(false);
        clearTurnStartTime();
        setInactivityCount(0);
        try {
            sessionStorage.removeItem(INACTIVITY_COUNT_KEY);
        } catch (e) { /* ignore */ }

        try {
            await gameService.surrender();
            
            // Clean up connection and go directly to main screen
            try {
                if (gameSubscriptionRef.current) {
                    gameSubscriptionRef.current.unsubscribe();
                    gameSubscriptionRef.current = null;
                }
            } catch (e) { /* ignore */ }
            try {
                if (stompClient.current) {
                    stompClient.current.disconnect();
                }
            } catch (e) { /* ignore */ }
            try {
                if (socketRef.current) {
                    socketRef.current.close();
                }
            } catch (e) { /* ignore */ }

            // Clear refs and local flags
            gameIdRef.current = null;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
            if (connectionCheckIntervalRef.current) {
                clearInterval(connectionCheckIntervalRef.current);
                connectionCheckIntervalRef.current = null;
            }
            connectionLockRef.current = false;
            isReconnectingRef.current = false;
            setIsConnected(false);

            // Go directly to main screen without showing winner popup
            setGameState(null);
            setFinalWinner(null);
            setTrickResult(null);

            // Refresh profile (loss will be recorded)
            await refreshProfileAndCheckRank();
        } catch (error) {
            console.error('Error surrendering:', error);
            // Fallback - still try to go to main screen
            setGameState(null);
            setFinalWinner(null);
        }
    };

    // Track when trickResult was previously shown (to detect when it clears = new trick starting)
    const lastTrickResultRef = useRef<boolean>(false);
    // Track when player had a played card (to detect when new trick starts after winning)
    const lastHadPlayedCardRef = useRef<boolean>(false);

    // Turn timer effect - manages countdown for player's turn
    useEffect(() => {
        // Clear any existing timer
        if (turnTimerRef.current) {
            clearInterval(turnTimerRef.current);
            turnTimerRef.current = null;
        }

        // Only run timer when: game exists, it's player's turn, no winner yet, not showing trick result, connected
        // AND player hasn't already played a card (waiting for trick resolution)
        const hasPlayedCard = gameState?.playedCard != null;
        const shouldRunTimer = gameState && 
            gameState.isOnTurn && 
            !gameState.winnerUsername && 
            !trickResult && 
            isConnected &&
            !finalWinner &&
            !hasPlayedCard;

        // Detect turn/trick changes BEFORE checking shouldRunTimer
        // This ensures we catch the transition when timer should restart
        const turnJustStarted = lastTurnStateRef.current === false && gameState?.isOnTurn;
        const isFirstLoad = lastTurnStateRef.current === null && gameState?.isOnTurn;
        // Also reset timer when trick result was just cleared (new trick starting, same player's turn)
        const trickJustCleared = lastTrickResultRef.current === true && !trickResult && gameState?.isOnTurn && !hasPlayedCard;
        // Reset timer when played card was cleared (new trick starting after player won)
        const cardJustCleared = lastHadPlayedCardRef.current === true && !hasPlayedCard && gameState?.isOnTurn;

        if (!shouldRunTimer) {
            // Track if trickResult is currently showing
            if (trickResult) {
                lastTrickResultRef.current = true;
            }
            // Track if player has a played card
            if (hasPlayedCard) {
                lastHadPlayedCardRef.current = true;
            }
            // Hide inactivity popup when player plays a card
            if (hasPlayedCard && showInactivityPopup) {
                setShowInactivityPopup(false);
            }
            // Reset timer state when not player's turn or game ended
            if (!gameState?.isOnTurn || gameState?.winnerUsername || finalWinner) {
                setTurnTimeRemaining(20);
                setIsInWarningPhase(false);
                setShowInactivityPopup(false);
                // Clear turn start time when it's not player's turn (so next turn starts fresh)
                if (!gameState?.isOnTurn && lastTurnStateRef.current === true) {
                    clearTurnStartTime();
                }
                lastTurnStateRef.current = gameState?.isOnTurn ?? null;
                // Reset inactivity count when game ends
                if (gameState?.winnerUsername || finalWinner) {
                    setInactivityCount(0);
                    clearTurnStartTime();
                    try {
                        sessionStorage.removeItem(INACTIVITY_COUNT_KEY);
                    } catch (e) { /* ignore */ }
                }
            }
            return;
        }

        if (turnJustStarted || trickJustCleared || cardJustCleared) {
            // Turn just changed, new trick started, or server refreshed time (after announce/closeDeck/replaceCard)
            // Use server's nextMoveTimeInSeconds if available, otherwise default to 20
            const serverTime = gameState.nextMoveTimeInSeconds;
            if (serverTime !== undefined && serverTime > 0) {
                // Server time includes up to 32 seconds (20 + 10 + 2 buffer)
                // If > 10, we're in main phase; otherwise we're in warning phase
                if (serverTime > 10) {
                    // Main phase - show time above 10 as the "countdown to warning"
                    setTurnTimeRemaining(serverTime - 10);
                    setIsInWarningPhase(false);
                    setShowInactivityPopup(false);
                } else {
                    // Already in warning phase
                    setTurnTimeRemaining(serverTime);
                    setIsInWarningPhase(true);
                    setShowInactivityPopup(true);
                }
            } else {
                setTurnTimeRemaining(20);
                setIsInWarningPhase(false);
                setShowInactivityPopup(false);
            }
            const now = Date.now();
            saveTurnStartTime(now);
            lastTrickResultRef.current = false;
            lastHadPlayedCardRef.current = false;
        } else if (isFirstLoad) {
            // First load (page refresh or initial load) - use server's nextMoveTimeInSeconds
            const serverTime = gameState.nextMoveTimeInSeconds;
            if (serverTime !== undefined && serverTime > 0) {
                // Server time includes up to 32 seconds (20 + 10 + 2 buffer)
                // If > 10, we're in main phase; otherwise we're in warning phase
                if (serverTime > 10) {
                    // Main phase - show time above 10 as the "countdown to warning"
                    setTurnTimeRemaining(serverTime - 10);
                    setIsInWarningPhase(false);
                    setShowInactivityPopup(false);
                } else {
                    // Already in warning phase
                    setTurnTimeRemaining(serverTime);
                    setIsInWarningPhase(true);
                    setShowInactivityPopup(true);
                }
                saveTurnStartTime(Date.now());
            } else {
                // Fallback to persisted time
                const persistedStartTime = getTurnStartTime();
                if (persistedStartTime) {
                    const elapsed = Math.floor((Date.now() - persistedStartTime) / 1000);
                    const remaining = Math.max(0, 20 - elapsed);
                    
                    if (remaining <= 0) {
                        setTurnTimeRemaining(0);
                        handleInactivityTimeout();
                    } else {
                        setTurnTimeRemaining(remaining);
                    }
                    setIsInWarningPhase(false);
                    setShowInactivityPopup(false);
                } else {
                    const now = Date.now();
                    setTurnTimeRemaining(20);
                    setIsInWarningPhase(false);
                    setShowInactivityPopup(false);
                    saveTurnStartTime(now);
                }
            }
        }
        
        lastTurnStateRef.current = gameState.isOnTurn;
        lastHadPlayedCardRef.current = hasPlayedCard;

        // Start the countdown interval
        turnTimerRef.current = setInterval(() => {
            setTurnTimeRemaining(prev => {
                if (prev <= 1) {
                    if (!isInWarningPhase) {
                        // Main phase ended - call inactivity endpoint
                        clearInterval(turnTimerRef.current!);
                        turnTimerRef.current = null;
                        handleInactivityTimeout();
                        return 0;
                    } else {
                        // Warning phase ended - auto surrender
                        clearInterval(turnTimerRef.current!);
                        turnTimerRef.current = null;
                        handleInactivitySurrender();
                        return 0;
                    }
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (turnTimerRef.current) {
                clearInterval(turnTimerRef.current);
                turnTimerRef.current = null;
            }
        };
    }, [gameState?.isOnTurn, gameState?.winnerUsername, gameState?.playedCard, gameState?.nextMoveTimeInSeconds, trickResult, isConnected, finalWinner, isInWarningPhase]);

    // Opponent timer effect - track when opponent is taking too long
    useEffect(() => {
        // Clear any existing timer
        if (opponentTimerRef.current) {
            clearInterval(opponentTimerRef.current);
            opponentTimerRef.current = null;
        }
        setOpponentLowOnTime(false);

        // Only run when: game exists, it's opponent's turn, no winner yet, connected
        const shouldTrackOpponent = gameState && 
            !gameState.isOnTurn && 
            !gameState.winnerUsername && 
            !trickResult && 
            isConnected &&
            !finalWinner;

        if (!shouldTrackOpponent) {
            opponentTurnStartRef.current = null;
            return;
        }

        // Record when opponent's turn started
        opponentTurnStartRef.current = Date.now();

        // Check every second if opponent is low on time
        opponentTimerRef.current = setInterval(() => {
            if (opponentTurnStartRef.current) {
                const elapsed = (Date.now() - opponentTurnStartRef.current) / 1000;
                if (elapsed >= 15) {
                    setOpponentLowOnTime(true);
                }
            }
        }, 1000);

        return () => {
            if (opponentTimerRef.current) {
                clearInterval(opponentTimerRef.current);
                opponentTimerRef.current = null;
            }
        };
    }, [gameState?.isOnTurn, gameState?.winnerUsername, trickResult, isConnected, finalWinner]);

    // Auto-reconnect on mount if we have an active game
    useEffect(() => {
        // Check if we have a game state but no active connection
        if (gameState && gameIdRef.current && (!stompClient.current || !stompClient.current.connected)) {
            if (!isReconnectingRef.current && !connectionLockRef.current) {
                isReconnectingRef.current = true;
                connectWebSocket(true);
            }
        }
    }, [gameState]);

    // Retry reconnection with exponential backoff
    const attemptReconnect = () => {
        // Clear any existing timeout
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (!gameIdRef.current) {
            isReconnectingRef.current = false;
            retryAttemptRef.current = 0;
            return;
        }

        // Check both React state and actual STOMP connection state
        const stompConnected = stompClient.current && stompClient.current.connected;
        if (isConnected && stompConnected) {
            isReconnectingRef.current = false;
            retryAttemptRef.current = 0;
            return;
        }

        if (connectionLockRef.current) {
            // Schedule retry after current attempt completes
            const delay = 2000; // Max 10 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                attemptReconnect();
            }, delay);
            return;
        }

        // Calculate delay with exponential backoff (2s, 4s, 8s, max 10s)
        const delay = 2000;

        reconnectTimeoutRef.current = setTimeout(() => {
            if (!gameIdRef.current || isConnected) {
                // Game ended or connection restored
                isReconnectingRef.current = false;
                retryAttemptRef.current = 0;
                return;
            }

            // Increment retry counter before attempting connection
            retryAttemptRef.current++;
            isReconnectingRef.current = true;
            reconnectStartTimeRef.current = Date.now();
            connectWebSocket(true);

            // After connectWebSocket completes (success or failure), 
            // onError/onClose handlers will call attemptReconnect() again if needed
        }, delay);
    };

    // Auto-reconnect when connection is lost during active game
    useEffect(() => {
        if (!isConnected && gameState && gameIdRef.current) {
            // Only start reconnection if not already reconnecting
            if (!isReconnectingRef.current) {
                isReconnectingRef.current = true;
                reconnectStartTimeRef.current = Date.now();
                retryAttemptRef.current = 0;
                attemptReconnect();
            }
        } else if (isConnected) {
            // Connection restored, reset retry counter
            retryAttemptRef.current = 0;
        }
    }, [isConnected, gameState]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
            }
            if (connectionCheckIntervalRef.current) {
                clearInterval(connectionCheckIntervalRef.current);
            }
            if (gameSubscriptionRef.current) {
                gameSubscriptionRef.current.unsubscribe();
            }
            if (stompClient.current) {
                try {
                    stompClient.current.disconnect();
                } catch (e) {
                    console.error('Error disconnecting on unmount:', e);
                }
            }
        };
    }, []);

    // Handle leaving the game
    const handleLeaveGame = () => {
        setConfirmAction({
            title: 'Напускане на играта',
            message: 'Сигурни ли сте, че искате да напуснете играта?',
            action: async () => {
                try {
                    await gameService.surrender();

                    try {
                        if (gameSubscriptionRef.current) {
                            gameSubscriptionRef.current.unsubscribe();
                            gameSubscriptionRef.current = null;
                        }
                    } catch (e) {
                        // ignore
                    }
                    try { if (stompClient.current) stompClient.current.disconnect(); } catch (e) {}
                    try { if (socketRef.current) socketRef.current.close(); } catch (e) {}
                    gameIdRef.current = null;
                    if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null; }
                    if (connectionTimeoutRef.current) { clearTimeout(connectionTimeoutRef.current); connectionTimeoutRef.current = null; }
                    if (connectionCheckIntervalRef.current) { clearInterval(connectionCheckIntervalRef.current); connectionCheckIntervalRef.current = null; }
                    connectionLockRef.current = false;
                    isReconnectingRef.current = false;
                    setIsConnected(false);
                    setGameState(null);
                    setFinalWinner(null);

                    // Refresh profile after finishing
                    await refreshProfileAndCheckRank();
                } catch (e) {
                    console.error(e);
                }
                setConfirmAction(null);
            },
            onCancel: () => {
                setConfirmAction(null);
            }
        });
    };

    useEffect(() => {
        if (!gameState) return;
        const newBubbles: { id: number, val: number, isOpponent: boolean }[] = [];

        if (gameState.bonus && gameState.bonus > 0) {
            newBubbles.push({id: Date.now(), val: gameState.bonus, isOpponent: false});
        }
        if (gameState.opponentPlayerBonus && gameState.opponentPlayerBonus > 0) {
            newBubbles.push({id: Date.now() + 1, val: gameState.opponentPlayerBonus, isOpponent: true});
        }

        if (newBubbles.length > 0) {
            setActiveBonuses(prev => [...prev, ...newBubbles]);
            setTimeout(() => {
                setActiveBonuses(prev => prev.filter(b => !newBubbles.find(nb => nb.id === b.id)));
            }, 2500);
        }
    }, [gameState?.bonus, gameState?.opponentPlayerBonus]);

    const [isUiLocked, setIsUiLocked] = useState(false);
    const messageQueue = useRef<GameState[]>([]);
    const isProcessingQueue = useRef(false);

    const processNextMessage = async () => {
        if (isProcessingQueue.current || messageQueue.current.length === 0) return;
        isProcessingQueue.current = true;
        const nextState = messageQueue.current.shift()!;
        const prevState = prevGameStateRef.current;
        const isTrickFinished = (nextState.playedCard && nextState.opponentPlayedCard)
            || (nextState.remainingCardsCount === 24 && !nextState.playedCard && !nextState.opponentPlayedCard);

        // Detect card replacement - when trump card changes but remainingCardsCount stays same
        if (prevState && prevState.trumpCard && nextState.trumpCard &&
            prevState.trumpCard.id !== nextState.trumpCard.id &&
            prevState.remainingCardsCount === nextState.remainingCardsCount &&
            prevState.remainingCardsCount < 12 && prevState.remainingCardsCount > 2) {
            // Card was replaced - determine who replaced it
            const replacedBy = nextState.isOnTurn ? username : (nextState.firstPlayerUsername === username ? nextState.secondPlayerUsername : nextState.firstPlayerUsername);
            const notificationId = Date.now();
            setNotifications(prev => [...prev, {id: notificationId, message: `${replacedBy} замени карта`}]);
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notificationId));
            }, 3000);
        }

        // Detect deck closing - isClosed changed from false to true
        if (prevState && !prevState.isClosed && nextState.isClosed) {
            // Deck was closed - determine who closed it
            const closedBy = nextState.isOnTurn ? username : (nextState.firstPlayerUsername === username ? nextState.secondPlayerUsername : nextState.firstPlayerUsername);
            const notificationId = Date.now();
            setNotifications(prev => [...prev, {id: notificationId, message: `${closedBy} затвори тестето`}]);
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notificationId));
            }, 3000);
        }

        if (isTrickFinished) {
            setGameState(nextState);
            setIsUiLocked(true);
            await new Promise(resolve => setTimeout(resolve, 1500));
            setIsUiLocked(false);
            setAnnouncedSuit(null); // Fix for reset highlight
        } else {
            setGameState(nextState);
        }

        prevGameStateRef.current = nextState;

        if (nextState.trickWinnerUsername) setTrickResult({
            winner: nextState.trickWinnerUsername,
            p1Name: nextState.firstPlayerUsername,
            p1Score: nextState.trickFirstPlayerScore || 0,
            p2Name: nextState.secondPlayerUsername,
            p2Score: nextState.trickSecondPlayerScore || 0
        });
        if (nextState.winnerUsername) setFinalWinner(nextState.winnerUsername);

        isProcessingQueue.current = false;
        processNextMessage();
    };

    const handleGameUpdate = (newState: GameState) => {
        // Update last message time
        lastMessageTimeRef.current = Date.now();

        // Store gameId when we receive game state
        if (newState.gameId && !gameIdRef.current) {
            gameIdRef.current = newState.gameId;
        }
        // Initialize prevGameStateRef on first game state
        if (!prevGameStateRef.current && newState) {
            prevGameStateRef.current = newState;
        }
        messageQueue.current.push(newState);
        processNextMessage();
    };

    const SUIT_COLOR_GROUP: Record<Suit, 'BLACK' | 'RED'> = {
        SPADES: 'BLACK',
        CLUBS: 'BLACK',
        HEARTS: 'RED',
        DIAMONDS: 'RED'
    };

    const buildSuitOrderForHand = (
        cards: Card[],
        trump: Suit
    ): Suit[] => {
        const presentSuits = Array.from(new Set(cards.map(c => c.suit)));

        const hasTrump = presentSuits.includes(trump);

        const result: Suit[] = [];
        const used = new Set<Suit>();

        // 1️⃣ Start with trump ONLY if it exists in hand
        if (hasTrump) {
            result.push(trump);
            used.add(trump);
        }

        // 2️⃣ Alternate colors with remaining suits
        while (result.length < presentSuits.length) {
            const lastColor =
                result.length > 0
                    ? SUIT_COLOR_GROUP[result[result.length - 1]]
                    : null;

            // Prefer opposite color
            const next = presentSuits.find(
                s =>
                    !used.has(s) &&
                    (lastColor === null || SUIT_COLOR_GROUP[s] !== lastColor)
            );

            // Fallback if alternation is impossible
            const fallback = presentSuits.find(s => !used.has(s));

            const chosen = next ?? fallback!;
            result.push(chosen);
            used.add(chosen);
        }

        return result;
    };

    const getSortedCards = (cards: Card[]) => {
        if (!gameState?.trumpCard) return cards;

        const trumpSuit = gameState.trumpCard.suit;
        const suitOrder = buildSuitOrderForHand(cards, trumpSuit);

        return [...cards].sort((a, b) => {
            if (a.suit !== b.suit) {
                return suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
            }
            return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
        });
    };

    const connectWebSocket = (isReconnect: boolean = false) => {
        // Prevent multiple simultaneous connection attempts
        if (connectionLockRef.current) {
            return;
        }

        const sockToken = localStorage.getItem('refreshToken');
        if (!sockToken) {
            console.error('No refresh token found');
            setIsConnected(false);
            return;
        }

        // Set connection lock
        connectionLockRef.current = true;
        setIsConnected(false);

        // Clean up old connection before creating new one
        const cleanupOldConnection = () => {
            // Clear old subscription
            if (gameSubscriptionRef.current) {
                try {
                    gameSubscriptionRef.current.unsubscribe();
                } catch (e) {
                    // Error unsubscribing old subscription
                }
                gameSubscriptionRef.current = null;
            }

            // Disconnect old STOMP client
            if (stompClient.current) {
                try {
                    if (stompClient.current.connected) {
                        stompClient.current.disconnect();
                    }
                } catch (e) {
                    // Error disconnecting old STOMP client
                }
                stompClient.current = null;
            }

            // Close old socket
            if (socketRef.current) {
                try {
                    socketRef.current.close();
                } catch (e) {
                    // Error closing old socket
                }
                socketRef.current = null;
            }

            // Clear intervals and timeouts
            if (connectionCheckIntervalRef.current) {
                clearInterval(connectionCheckIntervalRef.current);
                connectionCheckIntervalRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
        };

        cleanupOldConnection();

        // Clear any existing connection timeout
        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        const socket = new SockJS(API_BASE_URL + `/ws-game?token=${sockToken}`);
        socketRef.current = socket;
        const client = Stomp.over(socket);

        // Disable STOMP auto-reconnect to avoid conflicts with manual reconnection
        client.reconnect_delay = 0;

        // Set a timeout to detect failed connection attempts
        // If connection doesn't succeed within 3 seconds, treat it as failure
        connectionTimeoutRef.current = setTimeout(() => {
            if (!isConnected && connectionLockRef.current) {
                connectionLockRef.current = false;
                
                // If we have an active game, trigger retry
                if (gameIdRef.current && isReconnectingRef.current) {
                    attemptReconnect();
                } else if (!gameIdRef.current) {
                    // If no active game (searching), reset searching state
                    setIsSearching(false);
                }
            }
        }, 3000);

        // Handle socket close events for reconnection
        socket.onclose = (event: CloseEvent) => {
            setIsConnected(false);
            connectionLockRef.current = false;

            // Clear connection timeout
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }

            // Stop connection monitoring
            if (connectionCheckIntervalRef.current) {
                clearInterval(connectionCheckIntervalRef.current);
                connectionCheckIntervalRef.current = null;
            }

            // If we're searching and connection closed, stop searching
            if (!isReconnect && !gameIdRef.current) {
                setIsSearching(false);
            }

            // Only attempt reconnect if we have an active game
            // Reconnect even if wasClean is true (backend might have restarted)
            if (gameIdRef.current) {
                // Ensure we're in reconnecting state
                if (!isReconnectingRef.current) {
                    isReconnectingRef.current = true;
                    reconnectStartTimeRef.current = Date.now();
                    retryAttemptRef.current = 0;
                } else {
                    // Already reconnecting, but connection failed, so retry with current attempt count
                    // Don't reset retryAttemptRef - keep it so exponential backoff continues
                }
                // Always call attemptReconnect to schedule the next retry
                attemptReconnect();
            }
        };

        // Handle socket error events
        socket.onerror = (error: Event) => {
            console.error('WebSocket error:', error);
        };

        stompClient.current = client;

        const onConnect = () => {
            setIsConnected(true);
            connectionLockRef.current = false;
            isReconnectingRef.current = false;
            reconnectStartTimeRef.current = null;
            retryAttemptRef.current = 0; // Reset retry counter on successful connection
            lastMessageTimeRef.current = Date.now();

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }

            // Start connection monitoring
            if (connectionCheckIntervalRef.current) {
                clearInterval(connectionCheckIntervalRef.current);
            }
            connectionCheckIntervalRef.current = setInterval(() => {
                // Only monitor if we have an active game
                if (!gameIdRef.current) {
                    return;
                }

                // Check STOMP connection status
                const stompConnected = stompClient.current && stompClient.current.connected;

                // Only trigger reconnection if STOMP is actually disconnected AND we're not already reconnecting
                // Don't rely on timeSinceLastMessage - games can have quiet periods without messages
                if (!isReconnectingRef.current && !stompConnected) {
                    // STOMP reports disconnected - definitely need to reconnect
                    setIsConnected(false);
                    isReconnectingRef.current = true;
                    reconnectStartTimeRef.current = Date.now();
                    retryAttemptRef.current = 0;
                    attemptReconnect();
                } else if (isReconnectingRef.current && reconnectStartTimeRef.current) {
                    // If we've been trying to reconnect for more than 60 seconds, reset the flag and try again
                    const reconnectDuration = Date.now() - reconnectStartTimeRef.current;
                    if (reconnectDuration > 60000) {
                        isReconnectingRef.current = false;
                        reconnectStartTimeRef.current = null;
                        retryAttemptRef.current = 0;
                        // Will be picked up by next interval check if still disconnected
                    }
                }
            }, 10000); // Check every 10 seconds

            // If we have an active game, reconnect to it (use gameIdRef instead of gameState in case state was lost)
            if (gameIdRef.current) {
                // Unsubscribe from old subscription if exists
                if (gameSubscriptionRef.current) {
                    try {
                        gameSubscriptionRef.current.unsubscribe();
                    } catch (e) {
                        // Error unsubscribing (expected if already unsubscribed)
                    }
                }
                // Resubscribe to game updates
                gameSubscriptionRef.current = client.subscribe(
                    `/topic/game/${gameIdRef.current}/${username}`,
                    (m: any) => {
                        lastMessageTimeRef.current = Date.now();
                        handleGameUpdate(JSON.parse(m.body));
                    }
                );
                // Get current state
                gameService.getInitialState().then(res => {
                    if (res.data) {
                        lastMessageTimeRef.current = Date.now();
                        handleGameUpdate(res.data);
                    }
                }).catch(err => {
                    console.error('Failed to get initial state on reconnect:', err);
                });
            } else if (!isReconnect) {
                // Only subscribe to game search if not reconnecting and no active game
                client.subscribe(`/topic/game/${username}`, (msg: any) => {
                    lastMessageTimeRef.current = Date.now();
                    const data = JSON.parse(msg.body);
                    if (data.status === 'GAME_STARTED') {
                        setIsSearching(false);
                        gameIdRef.current = data.gameId;
                        gameSubscriptionRef.current = client.subscribe(
                            `/topic/game/${data.gameId}/${username}`,
                            (m: any) => {
                                lastMessageTimeRef.current = Date.now();
                                handleGameUpdate(JSON.parse(m.body));
                            }
                        );
                        gameService.getInitialState().then(res => {
                            if (res.data) {
                                lastMessageTimeRef.current = Date.now();
                                handleGameUpdate(res.data);
                            }
                        });
                    }
                });
                gameService.searchGame().catch(() => setIsSearching(false));
            }
        };

        const onError = (error: any) => {
            console.error('WebSocket connection error:', error);
            setIsConnected(false);
            connectionLockRef.current = false;

            // Clear connection timeout
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }

            // If we're searching and connection failed, stop searching
            if (!isReconnect && !gameIdRef.current) {
                setIsSearching(false);
            }

            // Attempt to reconnect if we have an active game (use gameIdRef to avoid closure issues)
            if (gameIdRef.current) {
                if (!isReconnectingRef.current) {
                    isReconnectingRef.current = true;
                    reconnectStartTimeRef.current = Date.now();
                    retryAttemptRef.current = 0;
                    attemptReconnect();
                } else {
                    // Already reconnecting, but connection failed, so retry with current attempt count
                    // Don't reset retryAttemptRef - keep it so exponential backoff continues
                    attemptReconnect();
                }
            }
        };

        client.connect({'Authorization': `Bearer ${sockToken}`}, onConnect, onError);
    };

    const startSearch = () => {
        if (isSearching) return;
        setIsSearching(true);
        connectWebSocket(false);
    };

    const handlePlayCard = async (card: Card) => {
        if (!gameState || !card.isPlayable || !gameState.isOnTurn || isUiLocked || !isConnected) return;
        
        // Hide inactivity popup if showing (player made a move)
        setShowInactivityPopup(false);
        
        const isKingOrQueen = card.rank === 'KING' || card.rank === 'QUEEN';
        const partnerRank = card.rank === 'KING' ? 'QUEEN' : 'KING';
        const hasPartner = gameState.deck.some(c => c.rank === partnerRank && c.suit === card.suit);
        const isLeadingTurn = gameState.isOnTurn && !gameState.opponentPlayedCard;

        if (isKingOrQueen && hasPartner && isLeadingTurn && announcedSuit !== card.suit && gameState.remainingCardsCount < 12) {
            const pts = card.suit === gameState.trumpCard?.suit ? 40 : 20;
            setConfirmAction({
                title: 'Обявяване',
                message: `Желаете ли да обявите ${pts} точки?`,
                action: async () => {
                    try {
                        setShowInactivityPopup(false);
                        await gameService.announce(card.id);
                        setAnnouncedSuit(card.suit);
                        // Reset timer to 22 seconds after announce
                        setTurnTimeRemaining(22);
                        setIsInWarningPhase(false);
                        saveTurnStartTime(Date.now());
                    } catch (e) {
                        console.error(e);
                    }
                    setConfirmAction(null);
                },
                onCancel: () => {
                    setConfirmAction(null);
                    setShowInactivityPopup(false);
                    gameService.playCard(card.id).catch(console.error);
                }
            });
            return;
        }
        gameService.playCard(card.id).catch(console.error);
    };

    const isFirstPlayerMe = gameState?.firstPlayerUsername === username;

    // Called at game end to ensure backend finish endpoint is invoked, then refresh profile and return to lobby
    const finishGameAndReturn = async () => {
        try {
            // Clean up local connection/subscription/timeouts similar to leaving
            try {
                if (gameSubscriptionRef.current) {
                    gameSubscriptionRef.current.unsubscribe();
                    gameSubscriptionRef.current = null;
                }
            } catch (e) {
                // ignore
            }
            try {
                if (stompClient.current) {
                    stompClient.current.disconnect();
                }
            } catch (e) {
                // ignore
            }
            try {
                if (socketRef.current) {
                    socketRef.current.close();
                }
            } catch (e) {
                // ignore
            }

            // Clear refs and local flags
            gameIdRef.current = null;
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
            if (connectionTimeoutRef.current) {
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
            }
            if (connectionCheckIntervalRef.current) {
                clearInterval(connectionCheckIntervalRef.current);
                connectionCheckIntervalRef.current = null;
            }
            connectionLockRef.current = false;
            isReconnectingRef.current = false;
            setIsConnected(false);

            // Go to lobby
            setGameState(null);
            setFinalWinner(null);

            // Refresh profile and check rank-up
            await refreshProfileAndCheckRank();
        } catch (err) {
            console.error('Error finishing game and returning to lobby', err);
            // As a fallback, still try to return to lobby
            setGameState(null);
            setFinalWinner(null);
        }
    };

    return (
        <div style={styles.table}>


            {/* Connection lost: a blocking layer, because no move can land while offline */}
            {gameState && !isConnected && (
                <div className="blocking" role="alert" aria-live="assertive">
                    <span className="spinner spinner--lg" style={{color: 'var(--accent)'}}/>
                    <div>
                        <p style={{fontSize: 'var(--fs-lg)', fontWeight: 700}}>Възстановяване на връзката…</p>
                        <p style={{marginTop: 'var(--sp-2)', color: 'var(--text-3)', fontSize: 'var(--fs-sm)'}}>
                            Моля, изчакайте
                        </p>
                    </div>
                </div>
            )}

            {!gameState ? (
                <div style={styles.lobby}>
                    <div className="panel panel--gold" style={lobbyCardStyle}>
                        <span style={lobbyCrestStyle}>66</span>

                        <h1 style={{fontSize: 'var(--fs-2xl)', color: 'var(--text-1)'}}>Сантасе 66</h1>

                        <p style={{color: 'var(--text-3)', fontSize: 'var(--fs-sm)'}}>
                            Класическо Сантасе срещу реални опоненти
                        </p>

                        <Button
                            variant="primary"
                            size="lg"
                            block
                            loading={isSearching}
                            onClick={startSearch}
                            style={{marginTop: 'var(--sp-4)'}}
                        >
                            НОВА ИГРА
                        </Button>

                        {isSearching && (
                            <p role="status" style={{color: 'var(--text-3)', fontSize: 'var(--fs-sm)'}}>
                                Търсим опонент…
                            </p>
                        )}

                        <button type="button" className="btn btn--link" onClick={() => navigate('/')}>
                            <Icon name="arrowLeft" size={16}/>
                            Назад
                        </button>
                    </div>
                </div>
            ) : (
                <div style={styles.gameWrapper}>

                    {activeBonuses.map(b => (
                        <div key={b.id} className="bonus-bubble" style={{top: b.isOpponent ? '25%' : '65%'}}>
                            +{b.val} ТОЧКИ
                        </div>
                    ))}

                    {/* Transient game messages. aria-live so they are announced
                        without stealing focus; wrapping instead of nowrap so long
                        Bulgarian strings do not overflow a narrow phone. */}
                    {notifications.map(notification => (
                        <div key={notification.id} className="game-toast" role="status" aria-live="polite">
                            {notification.message}
                        </div>
                    ))}

                    {/* Scoreboard. One markup path for phone and desktop — only the
                        offsets differ, and those come from clamp(). Scores are tabular
                        so the digits do not jitter as they change. */}
                    <div
                        className="hud"
                        style={{
                            ...styles.scoreBoard,
                            top: 'calc(var(--sa-top) + clamp(10px, 2.5vw, 32px))',
                            left: 'calc(var(--sa-left) + clamp(10px, 2.5vw, 20px))',
                        }}
                    >
                        <div style={{...styles.scoreRow, paddingBottom: 'var(--sp-2)', borderBottom: '1px solid var(--line)'}}>
                            <span className="truncate">
                                {isFirstPlayerMe ? gameState.secondPlayerUsername : gameState.firstPlayerUsername}
                            </span>
                            <span className="tabular" style={scoreValueStyle('opponent')}>
                                {isFirstPlayerMe ? gameState.secondPlayerResult : gameState.firstPlayerResult}
                            </span>
                        </div>
                        <div style={styles.scoreRow}>
                            <span className="truncate" style={{color: 'var(--text-1)', fontWeight: 700}}>{username}</span>
                            <span className="tabular" style={scoreValueStyle('me')}>
                                {isFirstPlayerMe ? gameState.firstPlayerResult : gameState.secondPlayerResult}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleLeaveGame}
                        className="round-btn round-btn--danger"
                        aria-label="Напусни играта"
                        style={{
                            position: 'absolute',
                            top: 'calc(var(--sa-top) + clamp(10px, 2.5vw, 20px))',
                            right: 'calc(var(--sa-right) + clamp(10px, 2.5vw, 20px))',
                            zIndex: 'var(--z-hud)' as unknown as number,
                        }}
                    >
                        <Icon name="x" size={20}/>
                    </button>


                    {(() => {
                                                
                        return (
                            <>
                                <div style={{
                                    ...styles.topSection,
                                    height: 'clamp(18vh, 20vh, 25vh)',
                                    // clears the absolutely positioned scoreboard on phones
                                    paddingTop: isMobile ? 'clamp(66px, 17vw, 78px)' : '0',
                                }}>
                                    <div
                                        style={{...styles.handOpponent, gap: 'clamp(-14px, -3vw, -8px)'}}
                                        role="img"
                                        aria-label={`Карти у опонента: ${gameState.opponentPlayerCardsCount || 0}`}
                                    >
                                        {Array.from({length: gameState.opponentPlayerCardsCount || 0}).map((_, i) => (
                                            <div
                                                key={i}
                                                className="card-back"
                                                style={{width: 'clamp(50px, 13vw, 116px)', aspectRatio: '71 / 103'}}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div style={{
                                    ...styles.midSection,
                                    padding: '0 clamp(10px, 4vw, 60px)',
                                    gap: 'clamp(15px, 4vw, 30px)',
                                }}>
                                    <div style={{
                                        ...styles.deckSide,
                                        width: 'clamp(80px, 22vw, 120px)',
                                        justifyContent: 'flex-start',
                                    }}>
                                        {gameState.remainingCardsCount > 0 && !gameState.isClosed ? (
                                            <div style={{
                                                position: 'relative',
                                                width: 'clamp(80px, 22vw, 120px)',
                                                height: 'clamp(95px, 26vw, 150px)',
                                            }}>
                                                <div style={{
                                                    ...styles.trumpUnder,
                                                    top: 'clamp(3px, 1.2vw, 10px)',
                                                    left: 'clamp(35px, 10vw, 90px)',
                                                    zIndex: 1,
                                                }} onClick={async () => {
                                                    if (gameState.isOnTurn && gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2 && isConnected) {
                                                        setShowInactivityPopup(false);
                                                        try {
                                                            await gameService.replaceCard();
                                                            // Reset timer to 22 seconds after replace card
                                                            setTurnTimeRemaining(22);
                                                            setIsInWarningPhase(false);
                                                            saveTurnStartTime(Date.now());
                                                        } catch (e) {
                                                            console.error(e);
                                                        }
                                                    }
                                                }}>
                                                    <CardComponent card={gameState.trumpCard!} isSmall/>
                                                </div>
                                                <div style={{
                                                    ...styles.deckPile,
                                                    width: 'clamp(70px, 19vw, 140px)',
                                                    aspectRatio: '71 / 103',
                                                    zIndex: 2,
                                                }} onClick={() => {
                                                    if (gameState.isOnTurn && gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2 && isConnected) {
                                                        setConfirmAction({
                                                            title: 'Затваряне',
                                                            message: 'Затваряте ли тестето?',
                                                            action: async () => {
                                                                setShowInactivityPopup(false);
                                                                try {
                                                                    await gameService.closeDeck();
                                                                    // Reset timer to 22 seconds after close deck
                                                                    setTurnTimeRemaining(22);
                                                                    setIsInWarningPhase(false);
                                                                    saveTurnStartTime(Date.now());
                                                                } catch (e) {
                                                                    console.error(e);
                                                                }
                                                                setConfirmAction(null);
                                                            }
                                                        });
                                                    }
                                                }}>
                                                    <div style={{
                                                        ...styles.deckCount,
                                                        fontSize: 'clamp(1.3rem, 4.4vw, 1.8rem)',
                                                    }}>{gameState.remainingCardsCount}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{
                                                ...styles.closedTrump,
                                                width: 'clamp(60px, 16vw, 80px)',
                                                height: 'clamp(60px, 16vw, 80px)',
                                                fontSize: 'clamp(1.8rem, 6vw, 2.5rem)',
                                            }}>
                                                <span style={{
                                                    fontSize: 'var(--fs-xs)',
                                                    letterSpacing: '0.08em',
                                                    color: 'var(--text-3)',
                                                }}>КОЗ</span>
                                                {gameState.trumpCard && (() => {
                                                    const suit = SUIT_MAP[gameState.trumpCard.suit];
                                                    const isRed = suit?.color === SUIT_COLOR.red;
                                                    return (
                                                        <span style={{color: isRed ? SUIT_ON_DARK.red : SUIT_ON_DARK.black, lineHeight: 1}}>
                                                            {suit?.symbol ?? '?'}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{
                                        ...styles.tableCenter,
                                        gap: 'clamp(15px, 5vw, 30px)',
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>{gameState.opponentPlayedCard &&
                                            <CardComponent card={gameState.opponentPlayedCard} isPlayable={true}/>}</div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>{gameState.playedCard &&
                                            <CardComponent card={gameState.playedCard} isPlayable={true}/>}</div>
                                    </div>
                                </div>

                                <div style={{
                                    ...styles.bottomSection,
                                    height: 'clamp(30vh, 32vh, 35vh)',
                                    position: 'relative',
                                    paddingBottom: 'clamp(15px, 4vw, 25px)',
                                }}>
                                    {/* Turn state + the "66" claim, in a plain centred flex row.
                                        The button used to be absolutely positioned with magic
                                        pixel offsets measured from the pill's centre. */}
                                    {(() => {
                                        const urgent = gameState.isOnTurn && turnTimeRemaining <= 5;
                                        const canFinishDeal = gameState.isOnTurn && !gameState.playedCard
                                            && !gameState.opponentPlayedCard && isConnected;

                                        return (
                                            <div style={turnRowStyle}>
                                                <div
                                                    className={`turn-pill ${urgent ? 'turn-pill--urgent' : ''}`}
                                                    role="status"
                                                    aria-live="polite"
                                                >
                                                    <span
                                                        className="turn-pill__dot"
                                                        style={{
                                                            background: gameState.isOnTurn
                                                                ? (urgent ? 'var(--danger)' : 'var(--success)')
                                                                : 'var(--text-3)',
                                                        }}
                                                    />
                                                    {gameState.isOnTurn ? (
                                                        <>
                                                            <span>ВАШ РЕД</span>
                                                            <span
                                                                className="tabular"
                                                                style={{
                                                                    minWidth: '2ch',
                                                                    textAlign: 'center',
                                                                    fontWeight: 800,
                                                                    color: turnTimeRemaining <= 5
                                                                        ? 'var(--danger)'
                                                                        : turnTimeRemaining <= 10
                                                                            ? 'var(--warning)'
                                                                            : 'var(--success)',
                                                                }}
                                                            >
                                                                {turnTimeRemaining}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span>{isSmallMobile ? 'ОПОНЕНТ…' : 'ОПОНЕНТЪТ ИГРАЕ…'}</span>
                                                    )}
                                                </div>

                                                {/* a real <button>: focusable, self-describing, and
                                                    disabled rather than pointer-events:none */}
                                                <button
                                                    type="button"
                                                    className="round-btn round-btn--accent"
                                                    disabled={!canFinishDeal}
                                                    aria-label="Обяви 66 точки и приключи раздаването"
                                                    style={{
                                                        width: 'clamp(44px, 12vw, 56px)',
                                                        height: 'clamp(44px, 12vw, 56px)',
                                                        fontSize: 'clamp(1rem, 3.4vw, 1.25rem)',
                                                    }}
                                                    onClick={() => setConfirmAction({
                                                        title: 'Край',
                                                        message: 'Имате ли 66 точки?',
                                                        action: async () => {
                                                            setShowInactivityPopup(false);
                                                            await gameService.finishDeal();
                                                            setConfirmAction(null);
                                                        }
                                                    })}
                                                >
                                                    66
                                                </button>
                                            </div>
                                        );
                                    })()}

                                    {/* Cards section */}
                                    <div style={{
                                        ...styles.handPlayer,
                                        // phones fan the cards with a negative margin instead of a gap
                                        gap: isMobile ? '0' : 'var(--sp-3)',
                                        flexWrap: 'nowrap' as const,
                                        width: '100%',
                                        overflow: 'hidden',
                                        padding: '0 clamp(10px, 3vw, 20px)',
                                        marginTop: isMobile ? 'clamp(20px, 5vw, 25px)' : '0',
                                    }}>
                                        {getSortedCards(gameState.deck).map((card, index) => (
                                            <div
                                                key={card.id}
                                                style={{
                                                    // half-overlap fan: each card shows its left half
                                                    marginLeft: isMobile && index > 0 ? 'clamp(-58px, -14vw, -50px)' : '0',
                                                }}
                                            >
                                                <CardComponent
                                                    card={card}
                                                    isPlayable={card.isPlayable && gameState.isOnTurn}
                                                    isSelected={announcedSuit === card.suit && (card.rank === 'KING' || card.rank === 'QUEEN')}
                                                    isLastDrawn={card.isLastDrawn}
                                                    onClick={() => handlePlayCard(card)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {finalWinner && !trickResult && gameState && (() => {
                        const surrenderedPlayer = gameState.surrenderPlayerUsername;
                        const isSurrender = !!surrenderedPlayer;
                        const opponentSurrendered = surrenderedPlayer && surrenderedPlayer !== username;
                        const iWon = finalWinner === username;

                        const myScore = isFirstPlayerMe ? gameState.firstPlayerResult : gameState.secondPlayerResult;
                        const theirScore = isFirstPlayerMe ? gameState.secondPlayerResult : gameState.firstPlayerResult;
                        const opponentName = isFirstPlayerMe ? gameState.secondPlayerUsername : gameState.firstPlayerUsername;

                        return (
                            <Modal
                                title="ИГРАТА ПРИКЛЮЧИ"
                                width="narrow"
                                dismissOnScrim={false}
                                actions={
                                    <Button variant="primary" size="lg" onClick={() => finishGameAndReturn()}>
                                        КЪМ НАЧАЛО
                                    </Button>
                                }
                            >
                                <div style={resultBodyStyle}>
                                    {/* icon + wording both carry the outcome, so it reads
                                        the same in grayscale or to a screen reader */}
                                    <span
                                        style={{
                                            ...resultMarkStyle,
                                            color: iWon ? 'var(--gold)' : 'var(--text-3)',
                                            background: iWon ? 'var(--gold-wash)' : 'rgba(255,255,255,0.06)',
                                            borderColor: iWon ? 'var(--line-gold)' : 'var(--line)',
                                        }}
                                    >
                                        <Icon name={iWon ? 'trophy' : 'flag'} size="50%"/>
                                    </span>

                                    <p style={{fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--text-1)'}}>
                                        {isSurrender
                                            ? (opponentSurrendered
                                                ? `${surrenderedPlayer} се предаде!`
                                                : 'Вие се предадохте.')
                                            : (iWon
                                                ? 'Брилянтна победа!'
                                                : `${finalWinner} спечели тази игра.`)}
                                    </p>

                                    <div style={finalScoreStyle}>
                                        <div style={{textAlign: 'center', minWidth: 0}}>
                                            <div className="truncate" style={{color: 'var(--text-3)', fontSize: 'var(--fs-xs)'}}>{username}</div>
                                            <div className="tabular" style={{...finalScoreNumStyle, color: iWon ? 'var(--success)' : 'var(--text-2)'}}>{myScore}</div>
                                        </div>
                                        <span style={{color: 'var(--text-3)', fontSize: 'var(--fs-lg)'}}>:</span>
                                        <div style={{textAlign: 'center', minWidth: 0}}>
                                            <div className="truncate" style={{color: 'var(--text-3)', fontSize: 'var(--fs-xs)'}}>{opponentName}</div>
                                            <div className="tabular" style={{...finalScoreNumStyle, color: iWon ? 'var(--text-2)' : 'var(--danger-bright)'}}>{theirScore}</div>
                                        </div>
                                    </div>
                                </div>
                            </Modal>
                        );
                    })()}
                </div>
            )}

            {/* Countdown before an auto-loss. Deliberately NOT dismissible by
                scrim or Escape: the only ways out are the two explicit choices. */}
            {showInactivityPopup && gameState && (() => {
                const used = gameState?.inactivityCount ?? 0;
                const extensionsLeft = Math.max(0, MAX_INACTIVITY - used);
                const noneLeft = used >= MAX_INACTIVITY;
                const critical = turnTimeRemaining <= 3;

                return (
                    <Modal
                        title="Времето изтича!"
                        tone="danger"
                        width="narrow"
                        dismissOnScrim={false}
                        className="modal--urgent"
                        actions={
                            <>
                                <Button
                                    variant="danger-outline"
                                    onClick={handleInactivitySurrender}
                                >
                                    Предавам се
                                </Button>
                                <Button
                                    variant="primary"
                                    disabled={noneLeft}
                                    onClick={handleInactivityContinue}
                                >
                                    {noneLeft ? 'Няма удължения' : 'Продължи (+20)'}
                                </Button>
                            </>
                        }
                    >
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)', textAlign: 'center'}}>
                            <div
                                className="tabular"
                                role="timer"
                                aria-live="assertive"
                                aria-label={`Остават ${turnTimeRemaining} секунди`}
                                style={{
                                    fontFamily: 'var(--font-display)',
                                    fontSize: 'clamp(3rem, 16vw, 4.5rem)',
                                    fontWeight: 700,
                                    lineHeight: 1,
                                    color: critical ? 'var(--danger)' : 'var(--warning)',
                                }}
                            >
                                {turnTimeRemaining}
                            </div>

                            <p style={{color: 'var(--text-2)', fontSize: 'var(--fs-sm)'}}>
                                Ако не предприемете действие, играта ще приключи като загуба.
                            </p>

                            <span className={`badge ${extensionsLeft === 0 ? 'badge--danger' : 'badge--success'}`}>
                                <Icon name="clock" size={15}/>
                                Оставащи удължения: {extensionsLeft} / {MAX_INACTIVITY}
                            </span>
                        </div>
                    </Modal>
                );
            })()}

            {confirmAction && (
                <AppModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    onConfirm={confirmAction.action}
                    onCancel={confirmAction.onCancel ? confirmAction.onCancel : () => setConfirmAction(null)}
                />
            )}

            {/* One-time rank-up modal shown when user's rank improved compared to last stored rank */}
            {showRankUpModal && (
                <AppModal
                    title="Поздравления!"
                    message={(
                        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'}}>
                            <div style={{fontWeight: 700}}>{rankUpNewRank ? `Рангът ви е повишен на ${getRankLabel(rankUpNewRank)}` : 'Рангът ви е повишен!'}</div>
                            <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                                    <div style={{padding: 6, borderRadius: 12, background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                                        <RankIcon rank={rankUpNewRank ?? 'UNRANKED'} size={80} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    onConfirm={() => setShowRankUpModal(false)}
                    confirmText="ОК"
                />
            )}

            {trickResult && <TrickResultPopup 
                trickResult={trickResult}
                onDismiss={() => setTrickResult(null)}
            />}

            {showProfile && (
                <ProfilePage
                    username={username}
                    onClose={() => setShowProfile(false)}
                />
            )}
        </div>
    );
};

/* ---------------------------------------------------------------------------
   Table styles. Every value is a token; sizes that used to be picked from a
   measured window width are clamp() expressions so they scale continuously.
   --------------------------------------------------------------------------- */

const styles: Record<string, React.CSSProperties> = {
    table: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--felt)',
        touchAction: 'manipulation',
    },
    gameWrapper: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        paddingTop: 'var(--sa-top)',
        paddingBottom: 'var(--sa-bottom)',
    },
    lobby: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--sp-5)',
        paddingBottom: 'calc(var(--sp-5) + var(--sa-bottom))',
    },
    scoreBoard: {
        position: 'absolute',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-2)',
        padding: 'var(--sp-3) var(--sp-4)',
        minWidth: 'clamp(150px, 42vw, 200px)',
        zIndex: 'var(--z-hud)' as unknown as number,
    },
    scoreRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        color: 'var(--text-2)',
        fontSize: 'var(--fs-sm)',
    },
    topSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    handOpponent: {
        display: 'flex',
        justifyContent: 'center',
    },
    midSection: {
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    deckSide: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    tableCenter: {
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deckPile: {
        position: 'absolute',
        top: 0,
        left: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundImage: 'url(/card-back.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--sh-2)',
        cursor: 'pointer',
        overflow: 'hidden',
        touchAction: 'manipulation',
        transition: 'transform var(--dur-fast) var(--ease-out)',
    },
    deckCount: {
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        color: '#fff',
        // dark halo keeps the count legible over any card back artwork
        textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 10px rgba(0,0,0,.7)',
    },
    trumpUnder: {
        position: 'absolute',
        transform: 'rotate(90deg)',
        zIndex: 1,
        cursor: 'pointer',
        touchAction: 'manipulation',
    },
    closedTrump: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--sp-1)',
        border: '1px solid var(--line-gold)',
        borderRadius: '50%',
        background: 'rgba(5, 14, 9, 0.8)',
        color: 'var(--text-1)',
        boxShadow: 'var(--sh-2)',
        backdropFilter: 'blur(10px)',
    },
    bottomSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
    },
    handPlayer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
};

/** Score colour: my score reads as progress, the opponent's as pressure. */
const scoreValueStyle = (who: 'me' | 'opponent'): React.CSSProperties => ({
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.05rem, 3.6vw, 1.5rem)',
    fontWeight: 800,
    color: who === 'me' ? 'var(--success)' : 'var(--danger)',
});

const turnRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-3)',
    width: '100%',
    padding: '0 var(--sp-4)',
    marginBottom: 'clamp(12px, 3vw, 18px)',
};

const lobbyCardStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    width: '100%',
    maxWidth: '420px',
    padding: 'clamp(24px, 7vw, 44px)',
    textAlign: 'center',
};

const lobbyCrestStyle: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(60px, 17vw, 84px)',
    height: 'clamp(60px, 17vw, 84px)',
    marginBottom: 'var(--sp-2)',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-bright), var(--accent) 55%, var(--accent-deep))',
    color: 'var(--text-on-accent)',
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(1.6rem, 6vw, 2.2rem)',
    fontWeight: 700,
    boxShadow: 'var(--glow-accent)',
};

const resultBodyStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-4)',
    textAlign: 'center',
};

const resultMarkStyle: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(72px, 20vw, 96px)',
    height: 'clamp(72px, 20vw, 96px)',
    borderRadius: '50%',
    border: '1px solid',
    animation: 'scale-in var(--dur-slow) var(--ease-spring)',
};

const finalScoreStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-4)',
    width: '100%',
    padding: 'var(--sp-4)',
    background: 'var(--surface-raised)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-lg)',
};

const finalScoreNumStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--fs-2xl)',
    fontWeight: 700,
};

export default SantaseGame;