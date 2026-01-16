import React, {useEffect, useRef, useState} from 'react';
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

const API_BASE_URL = import.meta.env.VITE_API_URL;

// Global styles and animations
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        body, html { margin: 0; padding: 0; height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background: #0a1f0f; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        body { overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
        @media (min-width: 769px) {
            body { overflow: hidden; }
        }
        * { -webkit-tap-highlight-color: transparent; }
        button:focus { outline: none; }
        #root { height: 100%; width: 100%; }
        button { 
            cursor: pointer; 
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
            border: none; 
        }
        button:hover { 
            transform: translateY(-2px); 
            filter: brightness(1.15);
            box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
        }
        button:active { 
            transform: scale(0.96) translateY(0); 
        }
        
        @keyframes floatUpFade {
            0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
            20% { transform: translate(-50%, -20px) scale(1.1); opacity: 1; }
            80% { transform: translate(-50%, -60px) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -100px) scale(0.8); opacity: 0; }
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            15% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            85% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes shimmer {
            0% { 
                left: -100%;
            }
            100% { 
                left: 100%;
            }
        }
        .last-drawn-shimmer {
            position: relative;
            overflow: hidden;
            isolation: isolate;
        }
        .last-drawn-shimmer::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                90deg,
                transparent,
                rgba(76, 175, 80, 0.7),
                rgba(255, 255, 255, 0.8),
                rgba(76, 175, 80, 0.7),
                transparent
            );
            animation: shimmer 0.6s ease-out;
            pointer-events: none;
            z-index: 1;
            clip-path: inset(0);
        }
        @media (max-width: 768px) {
            .last-drawn-shimmer {
                overflow: hidden !important;
                contain: layout style paint;
            }
            .last-drawn-shimmer::before {
                clip-path: inset(0);
                will-change: left;
            }
        }
        .bonus-bubble {
            position: absolute;
            left: 50%;
            background: linear-gradient(135deg, #ffeb3b, #fbc02d);
            color: #000;
            font-weight: 800;
            padding: 12px 30px;
            border-radius: 50px;
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
            animation: floatUpFade 2.5s ease-out forwards;
            z-index: 1000;
            pointer-events: none;
            font-size: 1.3rem;
            text-transform: uppercase;
        }
        
        @media (max-width: 768px) {
            .bonus-bubble {
                padding: 8px 20px;
                font-size: 1rem;
            }
        }
        
        @media (max-width: 480px) {
            .bonus-bubble {
                padding: 6px 15px;
                font-size: 0.85rem;
            }
        }
    `;
    document.head.appendChild(style);
}

const SUIT_MAP: Record<Suit, { symbol: string; color: string }> = {
    SPADES: {symbol: '♠', color: '#1a1a1a'},
    HEARTS: {symbol: '♥', color: '#d32f2f'},
    DIAMONDS: {symbol: '♦', color: '#d32f2f'},
    CLUBS: {symbol: '♣', color: '#1a1a1a'}
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

const CardComponent: React.FC<{
    card: Card;
    onClick?: () => void;
    isPlayable?: boolean;
    isSelected?: boolean;
    isSmall?: boolean;
    windowWidth?: number;
    isLastDrawn?: boolean;
}> = ({card, onClick, isPlayable = true, isSelected, isSmall, windowWidth = 1024, isLastDrawn = false}) => {
    const suit = SUIT_MAP[card.suit] || {symbol: '?', color: 'black'};
    const displayRank = card.rank === 'NINE' ? '9' : (card.rank === 'TEN' ? '10' : card.rank[0]);

    // Responsive card sizing
    const isMobile = windowWidth <= 768;
    const isSmallMobile = windowWidth <= 480;

    const cardWidth = isSmall
        ? (isSmallMobile ? '55px' : isMobile ? '65px' : '110px')
        : (isSmallMobile ? '85px' : isMobile ? '100px' : '100px');
    const cardHeight = isSmall
        ? (isSmallMobile ? '80px' : isMobile ? '95px' : '150px')
        : (isSmallMobile ? '120px' : isMobile ? '145px' : '145px');
    const cardStyle = {
        ...styles.card,
        width: cardWidth,
        height: cardHeight,
        minWidth: cardWidth,
        minHeight: cardHeight,
        maxWidth: cardWidth,
        maxHeight: cardHeight,
        flexShrink: 0,
        borderRadius: '14px',

        // 1. OPAQUE: Strictly 1 to prevent seeing cards behind
        opacity: 1,

        // 2. SUIT COLOR: Kept as-is so you still see red/black clearly
        color: suit.color,

        // 3. BLUR & DIM: Increased blur slightly for a "pushed back" feel
        filter: isPlayable ? 'none' : 'brightness(0.75)',

        // // 4. DARKER GREY BACKGROUND: Solid color to hide overlapping content
        // background: isPlayable
        //     ? 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)'
        //     : '#cccccc', // Mid-tone grey (Darker than before)

        // // 5. SEPARATION BORDER: Darker border to define the card edge
        // border: isSelected
        //     ? '3px solid #ffd700'
        //     : isPlayable
        //         ? '2px solid rgba(255,255,255,0.9)'
        //         : '2px solid #a1a1a1', // Stronger grey border for overlap clarity

        // // 6. STACKING DEPTH
        // zIndex: isSelected ? 10 : isPlayable ? 5 : 1,
        // boxShadow: isSelected
        //     ? '0 12px 28px rgba(0,0,0,0.3)'
        //     : isPlayable
        //         ? '0 8px 16px rgba(0,0,0,0.2)'
        //         : '0 4px 10px rgba(0,0,0,0.25)', // Slightly heavier shadow for depth

        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        padding: isSmallMobile ? '5px' : isMobile ? '7px' : '10px',
        position: 'relative' as const,
        transition: 'all 0.2s ease-in-out',
    };

    const cornerStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        lineHeight: '1',
        fontWeight: 'bold' as const,
        fontSize: isSmall
            ? (isSmallMobile ? '1.1rem' : isMobile ? '1.2rem' : '1.7rem')
            : (isSmallMobile ? '1.2rem' : isMobile ? '1.4rem' : '1.5rem'),
    };

    const centerSymbolSize = isSmall
        ? (isSmallMobile ? '1.6rem' : isMobile ? '1.9rem' : '3rem')
        : (isSmallMobile ? '2.2rem' : isMobile ? '2.4rem' : '2.9rem');

    return (
        <div
            onClick={isPlayable ? onClick : undefined}
            style={cardStyle}
            className={isLastDrawn ? 'last-drawn-shimmer' : ''}
        >
            <div style={{...cornerStyle, alignSelf: 'flex-start'}}>
                <span>{displayRank}</span>
                <span
                    style={{fontSize: isSmallMobile ? '1rem' : isMobile ? '1.1rem' : (isSmall ? '1.6rem' : '1.4rem')}}>{suit.symbol}</span>
            </div>
            <div style={{fontSize: centerSymbolSize, alignSelf: 'center', opacity: 0.9}}>
                {suit.symbol}
            </div>
            <div style={{...cornerStyle, alignSelf: 'flex-end', transform: 'rotate(180deg)'}}>
                <span>{displayRank}</span>
                <span
                    style={{fontSize: isSmallMobile ? '1rem' : isMobile ? '1.1rem' : (isSmall ? '1.6rem' : '1.4rem')}}>{suit.symbol}</span>
            </div>
        </div>
    );
};

const Navbar: React.FC<{
    username: string;
    onLogout: () => void;
    onProfileClick: () => void;
    windowWidth?: number;
    rank?: Rank;
    wins?: number;
    losses?: number;
}> = ({
          username,
          onLogout,
          onProfileClick,
          windowWidth = 1024,
          rank = 'UNRANKED',
          wins = 0,
          losses = 0
      }) => {
    const isMobile = windowWidth <= 768;
    const isSmallMobile = windowWidth <= 480;

    return (
        <nav style={{
            ...styles.navbar,
            height: isSmallMobile ? '50px' : isMobile ? '60px' : '70px',
            padding: isSmallMobile ? '0 15px' : isMobile ? '0 20px' : '0 40px',
        }}>
            <div style={{
                ...styles.navLogo,
                fontSize: isSmallMobile ? '1.2rem' : isMobile ? '1.4rem' : '1.6rem',
            }}>
                SANTASE <span style={{color: '#fff'}}>66</span>
            </div>
            <div style={styles.navLinks}>
                {/* Rank Badge */}
                <RankBadge 
                    rank={rank} 
                    size="small" 
                    windowWidth={windowWidth}
                    wins={wins}
                    losses={losses}
                />
                <div
                    onClick={onProfileClick}
                    style={{
                        ...styles.userInfo,
                        cursor: 'pointer',
                        padding: '5px 10px',
                        borderRadius: '8px',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <span style={styles.userIcon}>👤</span>
                    {!isSmallMobile && (
                        <span style={{
                            fontWeight: 600,
                            fontSize: isMobile ? '0.9rem' : '1rem',
                        }}>
                            {isMobile && username.length > 10 ? username.substring(0, 10) + '...' : username}
                        </span>
                    )}
                </div>
                <button onClick={onLogout} style={{
                    ...styles.btnLogout,
                    padding: isSmallMobile ? '4px 10px' : isMobile ? '5px 12px' : '5px 15px',
                    fontSize: isSmallMobile ? '0.8rem' : isMobile ? '0.9rem' : '1rem',
                }}>
                    {isSmallMobile ? '✕' : 'ИЗХОД'}
                </button>
            </div>
        </nav>
    );
};

const AppModal: React.FC<{
    title?: string;
    message?: string | React.ReactNode;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    windowWidth?: number;
}> = ({title, message, onConfirm, onCancel, confirmText = "Потвърди", cancelText = "Отказ", windowWidth = 1024}) => {
    const isMobile = windowWidth <= 768;
    const isSmallMobile = windowWidth <= 480;

    return (
        <div style={styles.modalOverlay}>
            <div style={{
                ...styles.modalBox,
                padding: isSmallMobile ? '20px' : isMobile ? '25px' : '30px',
                minWidth: isSmallMobile ? '280px' : isMobile ? '300px' : '300px',
                maxWidth: isSmallMobile ? '90vw' : isMobile ? '85vw' : '500px',
            }}>
                {title && <h3 style={{
                    margin: '0 0 15px 0',
                    color: '#1a1a1a',
                    fontSize: isSmallMobile ? '1.2rem' : isMobile ? '1.3rem' : '1.5rem',
                }}>{title}</h3>}
                {message && <div style={{
                    marginBottom: '25px',
                    color: '#444',
                    fontSize: isSmallMobile ? '0.95rem' : isMobile ? '1rem' : '1.1rem',
                }}>{message}</div>}
                <div style={{
                    ...styles.modalActions,
                    justifyContent: onCancel ? 'space-between' : 'center',
                    flexDirection: isSmallMobile ? 'column' : 'row',
                    gap: isSmallMobile ? '10px' : '10px',
                }}>
                    {onCancel && <button onClick={onCancel} style={{
                        ...styles.btnCancel,
                        padding: isSmallMobile ? '12px' : '10px',
                        fontSize: isSmallMobile ? '0.9rem' : '1rem',
                    }}>{cancelText}</button>}
                    <button onClick={onConfirm} style={{
                        ...styles.btnConfirm,
                        padding: isSmallMobile ? '12px' : '10px',
                        fontSize: isSmallMobile ? '0.9rem' : '1rem',
                    }}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const SantaseGame: React.FC = () => {
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
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [showProfile, setShowProfile] = useState<boolean>(false);
    const [userRank, setUserRank] = useState<Rank>('UNRANKED');
    const [userWins, setUserWins] = useState<number>(0);
    const [userLosses, setUserLosses] = useState<number>(0);
    const prevGameStateRef = useRef<GameState | null>(null);
    const profileFetchedRef = useRef<boolean>(false);

    // One-time rank-up popup handling
    const rankPopupShownRef = useRef<boolean>(false); // prevents duplicate popups in a session
    const [showRankUpModal, setShowRankUpModal] = useState<boolean>(false);
    const [rankUpNewRank, setRankUpNewRank] = useState<Rank | null>(null);

    // Helper to refresh profile, update local state and localStorage, and show rank-up modal if rank improved
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

    // Handle window resize for responsive design
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Initial call

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Fetch user profile (including rank) on mount
    useEffect(() => {
        // Prevent duplicate fetch in StrictMode
        if (profileFetchedRef.current) return;
        profileFetchedRef.current = true;

        const fetchProfile = async () => {
            await refreshProfileAndCheckRank();
        };
        fetchProfile();
    }, []);

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
                    await gameService.finishGame();
                    // cleanup similar to finishGameAndReturn
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

    const SUIT_COLOR: Record<Suit, 'BLACK' | 'RED'> = {
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
                    ? SUIT_COLOR[result[result.length - 1]]
                    : null;

            // Prefer opposite color
            const next = presentSuits.find(
                s =>
                    !used.has(s) &&
                    (lastColor === null || SUIT_COLOR[s] !== lastColor)
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
        // If connection doesn't succeed within 15 seconds, treat it as failure and retry
        connectionTimeoutRef.current = setTimeout(() => {
            if (!isConnected && gameIdRef.current && connectionLockRef.current) {
                connectionLockRef.current = false;
                // Trigger retry
                if (isReconnectingRef.current) {
                    attemptReconnect();
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

            if (!isReconnect && !isSearching) {
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
                        await gameService.announce(card.id);
                        setAnnouncedSuit(card.suit);
                    } catch (e) {
                        console.error(e);
                    }
                    setConfirmAction(null);
                },
                onCancel: () => {
                    setConfirmAction(null);
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
            {!gameState && <Navbar username={username} onLogout={logout} onProfileClick={() => setShowProfile(true)}
                                   windowWidth={windowWidth} rank={userRank} wins={userWins} losses={userLosses}/>}

            {/* Loading overlay when disconnected */}
            {gameState && !isConnected && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                    color: 'white',
                }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        border: '4px solid rgba(255, 255, 255, 0.3)',
                        borderTop: '4px solid #4CAF50',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                    }}/>
                    <div style={{
                        marginTop: '20px',
                        fontSize: windowWidth <= 768 ? '1.1rem' : '1.3rem',
                        fontWeight: 600,
                        textAlign: 'center',
                    }}>Възстановяване на връзката...
                    </div>
                    <div style={{
                        marginTop: '10px',
                        fontSize: windowWidth <= 768 ? '0.9rem' : '1rem',
                        opacity: 0.8,
                        textAlign: 'center',
                    }}>Моля, изчакайте
                    </div>
                </div>
            )}

            {!gameState ? (
                <div style={styles.lobby}>
                    {(() => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;
                        return (
                            <div style={{
                                ...styles.lobbyContent,
                                padding: isSmallMobile ? '25px 15px' : isMobile ? '30px 20px' : '40px',
                                maxWidth: isSmallMobile ? '280px' : isMobile ? '350px' : '500px',
                            }}>
                                <div style={{
                                    ...styles.logoBadge,
                                    width: isSmallMobile ? '60px' : isMobile ? '70px' : '80px',
                                    height: isSmallMobile ? '60px' : isMobile ? '70px' : '80px',
                                    fontSize: isSmallMobile ? '2rem' : isMobile ? '2.2rem' : '2.5rem',
                                }}>66
                                </div>
                                <h1 style={{
                                    ...styles.welcomeTitle,
                                    fontSize: isSmallMobile ? '1.5rem' : isMobile ? '1.8rem' : '2rem',
                                    marginBottom: isSmallMobile ? '20px' : '30px',
                                }}>Добре дошли, {username}</h1>
                                <p style={{
                                    ...styles.welcomeSub,
                                    fontSize: isSmallMobile ? '0.9rem' : isMobile ? '1rem' : '1.1rem',
                                    marginBottom: isSmallMobile ? '25px' : '30px',
                                }}>Класическо Сантасе срещу реални опоненти</p>
                                <button
                                    onClick={startSearch}
                                    style={{
                                        ...styles.btnMain,
                                        background: isSearching ? '#555' : '#ff9800',
                                        padding: isSmallMobile ? '12px 30px' : isMobile ? '14px 35px' : '15px 40px',
                                        fontSize: isSmallMobile ? '0.95rem' : isMobile ? '1rem' : '1.1rem',
                                    }}
                                >
                                    {isSearching ? 'ТЪРСЕНЕ...' : 'НОВА ИГРА'}
                                </button>
                            </div>
                        );
                    })()}
                </div>
            ) : (
                <div style={styles.gameWrapper}>
                    {/* Leave Game Button - Desktop only */}
                    {(() => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;
                        // Only show standalone button on desktop
                        if (isMobile) return null;
                        return (
                            <button
                                onClick={handleLeaveGame}
                                style={{
                                    position: 'absolute',
                                    top: '20px',
                                    right: '20px',
                                    zIndex: 1000,
                                    ...styles.btnLeave,
                                    width: '50px',
                                    height: '50px',
                                    fontSize: '1.2rem',
                                }}
                            >
                                ✕
                            </button>
                        );
                    })()}

                    {activeBonuses.map(b => (
                        <div key={b.id} className="bonus-bubble" style={{top: b.isOpponent ? '25%' : '65%'}}>
                            +{b.val} ТОЧКИ
                        </div>
                    ))}

                    {/* Notifications in the middle of screen */}
                    {notifications.map(notification => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;
                        return (
                            <div
                                key={notification.id}
                                style={{
                                    position: 'fixed',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.9) 100%)',
                                    backdropFilter: 'blur(20px) saturate(180%)',
                                    borderRadius: '20px',
                                    padding: isSmallMobile ? '15px 25px' : isMobile ? '18px 30px' : '20px 40px',
                                    color: 'white',
                                    fontSize: isSmallMobile ? '1rem' : isMobile ? '1.1rem' : '1.3rem',
                                    fontWeight: 700,
                                    zIndex: 2000,
                                    boxShadow: '0 12px 32px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
                                    border: '2px solid rgba(255,255,255,0.2)',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    animation: 'fadeInOut 3s ease-out forwards',
                                    pointerEvents: 'none',
                                }}
                            >
                                {notification.message}
                            </div>
                        );
                    })}

                    {/* SCOREBOARD - Different layout for mobile vs desktop */}
                    {(() => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;

                        // Mobile: vertical scoreboard above opponent cards (same structure as desktop)
                        if (isMobile) {
                            return (
                                <>
                                    {/* Scoreboard on the left */}
                                    <div style={{
                                        ...styles.scoreBoardMobile,
                                        top: '10px',
                                        left: '10px',
                                        right: 'auto',
                                        width: isSmallMobile ? '160px' : '180px',
                                        padding: isSmallMobile ? '8px 12px' : '10px 14px',
                                        fontSize: isSmallMobile ? '0.75rem' : '0.85rem',
                                        position: 'absolute',
                                        flexDirection: 'column',
                                        alignItems: 'stretch',
                                        justifyContent: 'flex-start',
                                    }}>
                                        <div style={{
                                            ...styles.scoreRow,
                                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                                            paddingBottom: isSmallMobile ? '6px' : '8px',
                                            marginBottom: isSmallMobile ? '6px' : '8px',
                                        }}>
                                            <span style={{
                                                fontSize: isSmallMobile ? '0.7rem' : '0.8rem',
                                                maxWidth: isSmallMobile ? '70px' : '85px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {isFirstPlayerMe ? gameState.secondPlayerUsername : gameState.firstPlayerUsername}
                                            </span>
                                            <span style={{
                                                fontSize: isSmallMobile ? '1rem' : '1.1rem',
                                                fontWeight: 800,
                                                color: '#ff5252',
                                                textShadow: '0 2px 4px rgba(255, 82, 82, 0.3)',
                                            }}>
                                {isFirstPlayerMe ? gameState.secondPlayerResult : gameState.firstPlayerResult}
                            </span>
                                        </div>
                                        <div style={styles.scoreRow}>
                                            <span style={{
                                                fontSize: isSmallMobile ? '0.7rem' : '0.8rem',
                                                maxWidth: isSmallMobile ? '70px' : '85px',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {username}
                                            </span>
                                            <span style={{
                                                fontSize: isSmallMobile ? '1rem' : '1.1rem',
                                                fontWeight: 800,
                                                color: '#4CAF50',
                                                textShadow: '0 2px 4px rgba(76, 175, 80, 0.3)',
                                            }}>
                                {isFirstPlayerMe ? gameState.firstPlayerResult : gameState.secondPlayerResult}
                            </span>
                                        </div>
                                    </div>
                                    {/* Leave Game Button - Mobile - positioned on right */}
                                    <button
                                        onClick={handleLeaveGame}
                                        style={{
                                            ...styles.btnLeave,
                                            position: 'absolute',
                                            top: isSmallMobile ? '10px' : '12px',
                                            right: isSmallMobile ? '10px' : '12px',
                                            width: isSmallMobile ? '36px' : '40px',
                                            height: isSmallMobile ? '36px' : '40px',
                                            fontSize: isSmallMobile ? '1rem' : '1.1rem',
                                            zIndex: 1000,
                                        }}
                                    >
                                        ✕
                                    </button>
                                </>
                            );
                        }

                        // Desktop: vertical scoreboard on left
                        return (
                            <div style={{
                                ...styles.scoreBoard,
                                top: '40px',
                                left: '20px',
                                right: 'auto',
                                padding: '15px',
                                minWidth: '180px',
                                fontSize: '1rem',
                            }}>
                                <div style={{
                                    ...styles.scoreRow,
                                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                                    paddingBottom: '8px',
                                    marginBottom: '8px',
                                }}>
                                    <span style={{
                                        fontSize: '1rem',
                                        maxWidth: '140px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {isFirstPlayerMe ? gameState.secondPlayerUsername : gameState.firstPlayerUsername}
                                    </span>
                                    <span style={{
                                        fontSize: '1.4rem',
                                        fontWeight: 800,
                                        color: '#ff5252',
                                        textShadow: '0 2px 4px rgba(255, 82, 82, 0.3)',
                                    }}>
                                {isFirstPlayerMe ? gameState.secondPlayerResult : gameState.firstPlayerResult}
                            </span>
                                </div>
                                <div style={styles.scoreRow}>
                                    <span style={{
                                        fontSize: '1rem',
                                        maxWidth: '140px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {username}
                                    </span>
                                    <span style={{
                                        fontSize: '1.4rem',
                                        fontWeight: 800,
                                        color: '#4CAF50',
                                        textShadow: '0 2px 4px rgba(76, 175, 80, 0.3)',
                                    }}>
                                {isFirstPlayerMe ? gameState.firstPlayerResult : gameState.secondPlayerResult}
                            </span>
                                </div>
                            </div>
                        );
                    })()}

                    {(() => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;

                        return (
                            <>
                                <div style={{
                                    ...styles.topSection,
                                    height: isSmallMobile ? '18vh' : isMobile ? '22vh' : '25vh',
                                    paddingTop: isMobile ? (isSmallMobile ? '70px' : '75px') : '0',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <div style={{
                                        ...styles.handOpponent,
                                        gap: isSmallMobile ? '-8px' : isMobile ? '-12px' : '-15px',
                                    }}>
                                        {Array.from({length: gameState.opponentPlayerCardsCount || 0}).map((_, i) => (
                                            <div
                                                key={i}
                                                style={{
                                                    ...styles.cardBack,
                                                    width: isSmallMobile ? '50px' : isMobile ? '65px' : '130px',
                                                    height: isSmallMobile ? '75px' : isMobile ? '95px' : '175px',
                                                    borderRadius: isMobile ? '5px' : '14px',
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div style={{
                                    ...styles.midSection,
                                    flex: 1,
                                    padding: isSmallMobile ? '0 10px' : isMobile ? '0 20px' : '0 60px',
                                    flexDirection: 'row',
                                    gap: isSmallMobile ? '15px' : isMobile ? '20px' : '30px',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        ...styles.deckSide,
                                        width: isSmallMobile ? '80px' : isMobile ? '100px' : '120px',
                                        display: 'flex',
                                        justifyContent: 'flex-start',
                                        alignItems: 'center',
                                    }}>
                                        {gameState.remainingCardsCount > 0 && !gameState.isClosed ? (
                                            <div style={{
                                                position: 'relative',
                                                width: isSmallMobile ? '80px' : isMobile ? '100px' : '120px',
                                                height: isSmallMobile ? '95px' : isMobile ? '120px' : '150px',
                                            }}>
                                                <div style={{
                                                    ...styles.trumpUnder,
                                                    top: isSmallMobile ? '3px' : isMobile ? '5px' : '10px',
                                                    left: isSmallMobile ? '35px' : isMobile ? '35px' : '90px',
                                                    zIndex: 1,
                                                }} onClick={() => {
                                                    if (gameState.isOnTurn && gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2 && isConnected) {
                                                        gameService.replaceCard();
                                                    }
                                                }}>
                                                    <CardComponent card={gameState.trumpCard!} isSmall
                                                                   windowWidth={windowWidth}/>
                                                </div>
                                                <div style={{
                                                    ...styles.deckPile,
                                                    width: isSmallMobile ? '70px' : isMobile ? '75px' : '140px',
                                                    height: isSmallMobile ? '100px' : isMobile ? '110px' : '210px',
                                                    borderRadius: isMobile ? '5px' : '14px',
                                                    top: isSmallMobile ? '0' : isMobile ? '0' : '-5px',
                                                    left: isSmallMobile ? '0' : isMobile ? '0' : '-5px',
                                                    zIndex: 2,
                                                }} onClick={() => {
                                                    if (gameState.isOnTurn && gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2 && isConnected) {
                                                        setConfirmAction({
                                                            title: 'Затваряне',
                                                            message: 'Затваряте ли тестето?',
                                                            action: async () => {
                                                                await gameService.closeDeck();
                                                                setConfirmAction(null);
                                                            }
                                                        });
                                                    }
                                                }}>
                                                    <div style={{
                                                        ...styles.deckCount,
                                                        fontSize: isSmallMobile ? '1.3rem' : isMobile ? '1.5rem' : '1.8rem',
                                                        position: 'relative',
                                                        zIndex: 10,
                                                    }}>{gameState.remainingCardsCount}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{
                                                ...styles.closedTrump,
                                                width: isSmallMobile ? '60px' : isMobile ? '70px' : '80px',
                                                height: isSmallMobile ? '60px' : isMobile ? '70px' : '80px',
                                                fontSize: isSmallMobile ? '1.8rem' : isMobile ? '2.2rem' : '2.5rem',
                                            }}>
                                                <span style={{
                                                    fontSize: isSmallMobile ? '0.6rem' : isMobile ? '0.7rem' : '0.8rem',
                                                    display: 'block',
                                                }}>КОЗ</span>
                                                {gameState.trumpCard && (() => {
                                                    const suit = SUIT_MAP[gameState.trumpCard.suit] || {
                                                        symbol: '?',
                                                        color: '#1a1a1a'
                                                    };
                                                    return (
                                                        <span style={{
                                                            color: suit.color,
                                                            // Add white text shadow for black suits on dark background to maintain visibility
                                                            textShadow: suit.color === '#1a1a1a'
                                                                ? '0 0 3px rgba(255,255,255,0.8), 0 0 6px rgba(255,255,255,0.5)'
                                                                : 'none',
                                                        }}>
                                                {suit.symbol}
                                            </span>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{
                                        ...styles.tableCenter,
                                        flex: 1,
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: isSmallMobile ? '15px' : isMobile ? '20px' : '30px',
                                    }}>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>{gameState.opponentPlayedCard &&
                                            <CardComponent card={gameState.opponentPlayedCard} isPlayable={true}
                                                           windowWidth={windowWidth}/>}</div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>{gameState.playedCard &&
                                            <CardComponent card={gameState.playedCard} isPlayable={true}
                                                           windowWidth={windowWidth}/>}</div>
                                    </div>
                                </div>

                                <div style={{
                                    ...styles.bottomSection,
                                    height: isSmallMobile ? '30vh' : isMobile ? '32vh' : '35vh',
                                    position: 'relative',
                                    paddingBottom: isSmallMobile ? '15px' : isMobile ? '20px' : '25px',
                                }}>
                                    {/* Turn indicator and 66 button in one row */}
                                    <div style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: isSmallMobile ? '50px' : isMobile ? '55px' : '60px',
                                        marginBottom: isSmallMobile ? '12px' : isMobile ? '15px' : '18px',
                                        paddingLeft: isSmallMobile ? '10px' : isMobile ? '15px' : '20px',
                                        paddingRight: isSmallMobile ? '10px' : isMobile ? '15px' : '20px',
                                    }}>
                                        {/* Turn indicator exactly centered */}
                                        <div style={{
                                            ...styles.turnIndicator,
                                            padding: isSmallMobile ? '6px 18px' : isMobile ? '7px 20px' : '8px 24px',
                                            fontSize: isSmallMobile ? '0.8rem' : isMobile ? '0.9rem' : '1rem',
                                            position: 'absolute',
                                            left: '50%',
                                            top: '50%',
                                            transform: 'translate(-50%, -50%)',
                                        }}>
                                            <div style={{
                                                ...styles.pulse,
                                                width: isSmallMobile ? '7px' : isMobile ? '8px' : '9px',
                                                height: isSmallMobile ? '7px' : isMobile ? '8px' : '9px',
                                                backgroundColor: gameState.isOnTurn ? '#4CAF50' : '#ff5252',
                                            }}/>
                                            {isSmallMobile
                                                ? (gameState.isOnTurn ? 'ВАШ РЕД' : 'ОПОНЕНТ...')
                                                : (gameState.isOnTurn ? 'ВАШ РЕД' : 'ОПОНЕНТЪТ ИГРАЕ...')
                                            }
                                        </div>

                                        {/* 66 button next to turn indicator (to the right) */}
                                        {(() => {
                                            const canFinishDeal = gameState.isOnTurn && !gameState.playedCard && !gameState.opponentPlayedCard && isConnected;
                                            return (
                                                <div
                                                    style={{
                                                        ...styles.icon66,
                                                        width: isSmallMobile ? '45px' : isMobile ? '45px' : '55px',
                                                        height: isSmallMobile ? '45px' : isMobile ? '45px' : '55px',
                                                        fontSize: isSmallMobile ? '1.05rem' : isMobile ? '1.15rem' : '1.25rem',
                                                        position: 'absolute',
                                                        left: isSmallMobile ? 'calc(50% + 80px)' : isMobile ? 'calc(50% + 95px)' : 'calc(50% + 110px)',  // Position next to turn indicator
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        marginLeft: isSmallMobile ? '12px' : isMobile ? '15px' : '18px',  // Gap between turn indicator and button
                                                        opacity: canFinishDeal ? 1 : 0.4,  // Dimmed when not player's turn or cards are played or disconnected
                                                        cursor: canFinishDeal ? 'pointer' : 'not-allowed',
                                                        pointerEvents: canFinishDeal ? 'auto' : 'none',  // Disable clicks when not player's turn or cards are played or disconnected
                                                    }}
                                                    onClick={canFinishDeal ? () => setConfirmAction({
                                                        title: 'Край',
                                                        message: 'Имате ли 66 точки?',
                                                        action: async () => {
                                                            await gameService.finishDeal();
                                                            setConfirmAction(null);
                                                        }
                                                    }) : undefined}
                                                    onMouseEnter={canFinishDeal ? (e) => {
                                                        e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                                                        e.currentTarget.style.boxShadow = '0 10px 28px rgba(255, 152, 0, 0.6), 0 5px 14px rgba(0,0,0,0.3)';
                                                    } : undefined}
                                                    onMouseLeave={canFinishDeal ? (e) => {
                                                        e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                                                        e.currentTarget.style.boxShadow = styles.icon66.boxShadow as string;
                                                    } : undefined}
                                                >66</div>
                                            );
                                        })()}
                                    </div>

                                    {/* Cards section */}
                                    <div style={{
                                        ...styles.handPlayer,
                                        gap: isMobile ? '0' : '12px',  // No gap for mobile (using margin instead), space for desktop
                                        flexWrap: 'nowrap' as const,
                                        justifyContent: 'center',
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflowX: 'hidden' as const,
                                        overflowY: 'hidden' as const,
                                        padding: isSmallMobile ? '0 10px' : isMobile ? '0 15px' : '0 20px',
                                        marginTop: isMobile ? (isSmallMobile ? '20px' : '25px') : '0',  // Move cards lower on mobile
                                        boxSizing: 'border-box',
                                    }}>
                                        {getSortedCards(gameState.deck).map((card, index) => (
                                            <div
                                                key={card.id}
                                                style={{
                                                    marginLeft: isMobile && index > 0
                                                        ? (isSmallMobile ? '-50.5px' : '-58px')  // Half overlap: each card shows half, next card starts
                                                        : '0',
                                                }}
                                            >
                                                <CardComponent
                                                    card={card}
                                                    isPlayable={card.isPlayable && gameState.isOnTurn}
                                                    isSelected={announcedSuit === card.suit && (card.rank === 'KING' || card.rank === 'QUEEN')}
                                                    isLastDrawn={card.isLastDrawn}
                                                    onClick={() => handlePlayCard(card)}
                                                    windowWidth={windowWidth}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        );
                    })()}

                    {finalWinner && !trickResult && gameState && (() => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;
                        return (
                            <div style={styles.resultOverlay}>
                                <div style={{
                                    ...styles.resultBox,
                                    padding: isSmallMobile ? '30px 20px' : isMobile ? '40px 30px' : '50px',
                                    maxWidth: isSmallMobile ? '90vw' : isMobile ? '85vw' : '500px',
                                }}>
                                    <div style={{
                                        fontSize: isSmallMobile ? '3rem' : isMobile ? '3.5rem' : '4rem',
                                        marginBottom: '10px',
                                    }}>
                                        {finalWinner === username ? '🏆' : '🏳️'}
                                    </div>
                                    <h2 style={{
                                        margin: '0 0 10px 0',
                                        fontSize: isSmallMobile ? '1.5rem' : isMobile ? '1.8rem' : '2rem',
                                    }}>ИГРАТА ПРИКЛЮЧИ</h2>
                                    <div style={{
                                        fontSize: isSmallMobile ? '1rem' : isMobile ? '1.2rem' : '1.4rem',
                                        marginBottom: isSmallMobile ? '20px' : '30px',
                                        fontWeight: 300,
                                    }}>
                                        <p style={{margin: '0 0 10px 0'}}>
                                            {finalWinner === username
                                                ? 'Брилянтна победа!'
                                                : `${finalWinner} спечели тази игра.`
                                            }
                                        </p>
                                        <p style={{margin: 0}}>
                                            {finalWinner === username
                                                ? `${username} ${isFirstPlayerMe ? gameState?.firstPlayerResult : gameState?.secondPlayerResult} - ${isFirstPlayerMe ? gameState?.secondPlayerResult : gameState?.firstPlayerResult} ${isFirstPlayerMe ? gameState?.secondPlayerUsername : gameState?.firstPlayerUsername}`
                                                : `${finalWinner} ${isFirstPlayerMe ? gameState?.secondPlayerResult : gameState?.firstPlayerResult} - ${isFirstPlayerMe ? gameState?.firstPlayerResult : gameState?.secondPlayerResult} ${username}`
                                            }
                                        </p>
                                    </div>
                                    <button onClick={() => { finishGameAndReturn(); }} style={{
                                        ...styles.btnMain,
                                        padding: isSmallMobile ? '12px 30px' : isMobile ? '14px 35px' : '15px 40px',
                                        fontSize: isSmallMobile ? '0.95rem' : isMobile ? '1rem' : '1.1rem',
                                    }}>КЪМ НАЧАЛО
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {confirmAction && (
                <AppModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    onConfirm={confirmAction.action}
                    onCancel={confirmAction.onCancel ? confirmAction.onCancel : () => setConfirmAction(null)}
                    windowWidth={windowWidth}
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
                    windowWidth={windowWidth}
                />
            )}

            {trickResult && (() => {
                const isMobile = windowWidth <= 768;
                const isSmallMobile = windowWidth <= 480;
                return (
                    <AppModal
                        confirmText="ПРОДЪЛЖИ"
                        title="Край на раздаването"
                        windowWidth={windowWidth}
                        message={
                            <div style={{
                                textAlign: 'left',
                                minWidth: isSmallMobile ? '240px' : isMobile ? '260px' : '280px',
                            }}>
                                <div style={{
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    color: '#4CAF50',
                                    fontSize: isSmallMobile ? '1rem' : isMobile ? '1.1rem' : '1.2rem',
                                    marginBottom: '20px',
                                    padding: isSmallMobile ? '8px' : '10px',
                                    background: '#f1f8e9',
                                    borderRadius: '8px',
                                }}>
                                    Победител: {trickResult.winner}
                                </div>
                                <div style={{
                                    ...styles.trickScoreRow,
                                    fontSize: isSmallMobile ? '0.95rem' : isMobile ? '1rem' : '1.1rem',
                                    padding: isSmallMobile ? '10px 0' : '12px 0',
                                }}>
                                    <span style={{
                                        maxWidth: isSmallMobile ? '120px' : '150px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>{trickResult.p1Name}</span>
                                    <span style={{fontWeight: 800}}>{trickResult.p1Score} т.</span>
                                </div>
                                <div style={{
                                    ...styles.trickScoreRow,
                                    fontSize: isSmallMobile ? '0.95rem' : isMobile ? '1rem' : '1.1rem',
                                    padding: isSmallMobile ? '10px 0' : '12px 0',
                                }}>
                                    <span style={{
                                        maxWidth: isSmallMobile ? '120px' : '150px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>{trickResult.p2Name}</span>
                                    <span style={{fontWeight: 800}}>{trickResult.p2Score} т.</span>
                                </div>
                            </div>
                        }
                        onConfirm={() => setTrickResult(null)}
                    />
                );
            })()}

            {showProfile && (
                <ProfilePage
                    username={username}
                    onClose={() => setShowProfile(false)}
                    windowWidth={windowWidth}
                />
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    table: {
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        background: `radial-gradient(ellipse at center, #1a4d2e 0%, #0f3a1f 40%, #081a0f 100%)`,
        touchAction: 'manipulation',
    },
    gameWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },
    lobby: {
        height: '80%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
    },
    lobbyContent: {
        textAlign: 'center',
        color: 'white',
        background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.5) 100%)',
        borderRadius: '36px',
        backdropFilter: 'blur(20px) saturate(180%)',
        width: '100%',
        maxWidth: '500px',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 20px 56px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
        // Responsive maxWidth will be set inline
    },
    logoBadge: {
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 50%, #e65100 100%)',
        margin: '0 auto 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        border: '5px solid rgba(255,255,255,0.95)',
        boxShadow: '0 12px 32px rgba(255, 152, 0, 0.5), 0 6px 16px rgba(0,0,0,0.4), inset 0 3px 6px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.2)',
        color: 'white',
        textShadow: '0 2px 8px rgba(0,0,0,0.4)',
    },
    welcomeTitle: {
        color: '#fff',
    },
    welcomeSub: {
        color: 'rgba(255,255,255,0.9)',
    },
    navbar: {
        width: '100%',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.6) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
        zIndex: 100,
        boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)',
        borderBottom: '2px solid rgba(255,255,255,0.15)',
    },
    navLogo: {
        color: '#ff9800',
        fontWeight: 900,
    },
    navLinks: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
    },
    userInfo: {
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
    },
    userIcon: {
        background: 'rgba(255,255,255,0.1)',
        padding: '5px',
        borderRadius: '50%',
    },
    btnLogout: {
        background: 'linear-gradient(135deg, rgba(255, 82, 82, 0.15) 0%, rgba(211, 47, 47, 0.2) 100%)',
        border: '2px solid rgba(255, 82, 82, 0.6)',
        color: '#ff5252',
        borderRadius: '10px',
        touchAction: 'manipulation',
        fontWeight: 600,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: '0 4px 12px rgba(255, 82, 82, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
    },
    scoreBoard: {
        position: 'absolute',
        zIndex: 10,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.75) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: '20px',
        color: 'white',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
    },
    scoreBoardMobile: {
        position: 'absolute',
        top: '10px',
        left: '10px',
        right: '10px',
        zIndex: 10,
        background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 100%)',
        backdropFilter: 'blur(20px) saturate(180%)',
        borderRadius: '16px',
        color: 'white',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
        display: 'flex',
    },
    scoreRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    topSection: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    handOpponent: {
        display: 'flex',
        justifyContent: 'center',
    },
    cardBack: {
        backgroundImage: 'url(/card-back.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        // border: '3px solid rgba(255,255,255,0.95)',
        // boxShadow: '0 8px 20px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.25), inset 0 2px 6px rgba(255,255,255,0.25), inset 0 -2px 6px rgba(0,0,0,0.3)',
        position: 'relative' as const,
        overflow: 'hidden',
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
    feltArea: {
        display: 'flex',
    },
    cardSlot: {
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsSide: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    deckPile: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundImage: 'url(/card-back.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        // border: '3px solid rgba(255,255,255,0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        cursor: 'pointer',
        overflow: 'hidden',
        // boxShadow: '0 8px 20px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.3), inset 0 2px 6px rgba(255,255,255,0.25), inset 0 0 0 2px rgba(255,255,255,0.1)',
        touchAction: 'manipulation',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1.5)',
    },
    deckCount: {
        color: 'white',
        fontWeight: 900,
        WebkitTextStroke: '1px black',
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
        border: '3px solid rgba(255,255,255,0.5)',
        borderRadius: '50%',
        color: 'white',
        background: 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.4) 100%)',
        boxShadow: '0 6px 16px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 2px 6px rgba(255,255,255,0.15)',
        backdropFilter: 'blur(10px) saturate(150%)',
    },
    icon66: {
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 40%, #e65100 100%)',
        border: '3px solid rgba(255,255,255,0.95)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 900,
        cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(255, 152, 0, 0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.5), inset 0 -3px 6px rgba(0,0,0,0.25)',
        touchAction: 'manipulation',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        color: 'white',
        textShadow: '0 2px 8px rgba(0,0,0,0.5)',
    },
    btnLeave: {
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(255, 82, 82, 0.5) 0%, rgba(211, 47, 47, 0.6) 40%, rgba(183, 28, 28, 0.7) 100%)',
        border: '3px solid rgba(255,255,255,0.7)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        touchAction: 'manipulation',
        boxShadow: '0 6px 20px rgba(255, 82, 82, 0.4), 0 3px 10px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.35), inset 0 -3px 6px rgba(0,0,0,0.25)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontWeight: 700,
        textShadow: '0 2px 6px rgba(0,0,0,0.4)',
        lineHeight: 1,
        padding: 0,
        textAlign: 'center' as const,
    },
    menuButton: {
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(100, 100, 100, 0.4) 0%, rgba(70, 70, 70, 0.5) 100%)',
        border: '3px solid rgba(255,255,255,0.3)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        touchAction: 'manipulation',
        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.4), 0 3px 10px rgba(0,0,0,0.3), inset 0 3px 6px rgba(255,255,255,0.2), inset 0 -3px 6px rgba(0,0,0,0.25)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        fontWeight: 700,
        lineHeight: '1',
        letterSpacing: '-2px',
    },
    bottomSection: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflow: 'hidden',
        paddingBottom: '10px',
    },
    turnIndicator: {
        background: 'linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.7) 100%)',
        backdropFilter: 'blur(15px) saturate(150%)',
        borderRadius: '28px',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: '0 6px 20px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
        fontWeight: 600,
        letterSpacing: '0.5px',
    },
    pulse: {
        borderRadius: '50%',
        boxShadow: '0 0 8px currentColor, 0 0 16px currentColor',
        animation: 'pulse 2s ease-in-out infinite',
    },
    handPlayer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    card: {
        borderRadius: '14px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        touchAction: 'manipulation',
        userSelect: 'none',
        outline: 'none',
        WebkitTapHighlightColor: 'transparent',
        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
    },
    btnMain: {
        background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 50%, #e65100 100%)',
        color: 'white',
        borderRadius: '32px',
        fontWeight: 800,
        touchAction: 'manipulation',
        boxShadow: '0 8px 24px rgba(255, 152, 0, 0.5), 0 4px 12px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: 'none',
        textShadow: '0 2px 6px rgba(0,0,0,0.3)',
    },
    modalOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
    },
    modalBox: {
        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
        borderRadius: '28px',
        textAlign: 'center',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.9)',
        border: '2px solid rgba(255,255,255,0.9)',
    },
    modalActions: {
        display: 'flex',
        marginTop: '20px',
    },
    btnCancel: {
        flex: 1,
        background: 'linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)',
        borderRadius: '14px',
        touchAction: 'manipulation',
        border: '2px solid rgba(0,0,0,0.1)',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        color: '#333',
    },
    btnConfirm: {
        flex: 1,
        background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 50%, #0d4f14 100%)',
        color: 'white',
        borderRadius: '14px',
        touchAction: 'manipulation',
        fontWeight: 600,
        boxShadow: '0 6px 16px rgba(46, 125, 50, 0.5), 0 3px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: 'none',
        textShadow: '0 2px 4px rgba(0,0,0,0.3)',
    },
    resultOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0,0.9)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
    },
    resultBox: {
        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
        borderRadius: '36px',
        textAlign: 'center',
        width: '100%',
        maxWidth: '500px',
        boxShadow: '0 28px 72px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.9)',
        border: '2px solid rgba(255,255,255,0.95)',
    },
    trickScoreRow: {
        display: 'flex',
        justifyContent: 'space-between',
        borderBottom: '1px solid #eee',
    },
};

export default SantaseGame;