import React, { useState, useRef, useEffect } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useAuthContext } from '../context/AuthContext';
import { gameService } from '../api/gameService';
import { GameState, Card, Suit } from '../types/game.types';
const API_BASE_URL = import.meta.env.VITE_API_URL;

// Global styles and animations
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        body, html { margin: 0; padding: 0; overflow: hidden; height: 100%; width: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; background: #0a1f0f; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
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
    SPADES: { symbol: '♠', color: '#1a1a1a' },
    HEARTS: { symbol: '♥', color: '#d32f2f' },
    DIAMONDS: { symbol: '♦', color: '#d32f2f' },
    CLUBS: { symbol: '♣', color: '#1a1a1a' }
};

const RANK_ORDER: Record<string, number> = {
    'ACE': 0, 'TEN': 1, 'KING': 2, 'QUEEN': 3, 'JACK': 4, 'NINE': 5
};

const CardComponent: React.FC<{
    card: Card;
    onClick?: () => void;
    isPlayable?: boolean;
    isSelected?: boolean;
    isSmall?: boolean;
    windowWidth?: number;
}> = ({ card, onClick, isPlayable = true, isSelected, isSmall, windowWidth = 1024 }) => {
    const suit = SUIT_MAP[card.suit] || { symbol: '?', color: 'black' };
    const displayRank = card.rank === 'NINE' ? '9' : (card.rank === 'TEN' ? '10' : card.rank[0]);
    
    // Responsive card sizing
    const isMobile = windowWidth <= 768;
    const isSmallMobile = windowWidth <= 480;
    
    const cardWidth = isSmall 
        ? (isSmallMobile ? '55px' : isMobile ? '65px' : '75px')
        : (isSmallMobile ? '85px' : isMobile ? '100px' : '100px');
    const cardHeight = isSmall
        ? (isSmallMobile ? '80px' : isMobile ? '95px' : '110px')
        : (isSmallMobile ? '120px' : isMobile ? '145px' : '145px');

    const cardStyle = {
        ...styles.card,
        width: cardWidth,
        height: cardHeight,
        color: isPlayable ? suit.color : '#999',
        border: isSelected 
            ? '3px solid #ffd700' 
            : isPlayable 
                ? '2px solid rgba(255,255,255,0.4)' 
                : '1px solid rgba(0,0,0,0.15)',
        backgroundColor: isPlayable 
            ? 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)' 
            : 'linear-gradient(135deg, #e8e8e8 0%, #d0d0d0 100%)',
        background: isPlayable 
            ? 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)' 
            : 'linear-gradient(135deg, #e8e8e8 0%, #d0d0d0 100%)',
        transform: 'none',  // No movement for selected cards, only highlight
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        padding: isSmallMobile ? '5px' : isMobile ? '7px' : '10px',
        position: 'relative' as const,
        touchAction: 'manipulation' as const,
        boxShadow: isSelected 
            ? '0 12px 28px rgba(255, 215, 0, 0.4), 0 6px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.8)' 
            : isPlayable 
                ? '0 6px 18px rgba(0,0,0,0.2), 0 3px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.9)' 
                : '0 3px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)',
    };

    const cornerStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        lineHeight: '1',
        fontWeight: 'bold' as const,
        fontSize: isSmall 
            ? (isSmallMobile ? '0.7rem' : isMobile ? '0.8rem' : '0.9rem')
            : (isSmallMobile ? '0.8rem' : isMobile ? '1rem' : '1.1rem'),
    };

    const centerSymbolSize = isSmall
        ? (isSmallMobile ? '1.2rem' : isMobile ? '1.5rem' : '1.8rem')
        : (isSmallMobile ? '1.8rem' : isMobile ? '2rem' : '2.5rem');

    return (
        <div onClick={isPlayable ? onClick : undefined} style={cardStyle}>
            <div style={{ ...cornerStyle, alignSelf: 'flex-start' }}>
                <span>{displayRank}</span>
                <span style={{ fontSize: isSmallMobile ? '0.6rem' : isMobile ? '0.7rem' : (isSmall ? '0.8rem' : '1rem') }}>{suit.symbol}</span>
            </div>
            <div style={{ fontSize: centerSymbolSize, alignSelf: 'center', opacity: 0.9 }}>
                {suit.symbol}
            </div>
            <div style={{ ...cornerStyle, alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
                <span>{displayRank}</span>
                <span style={{ fontSize: isSmallMobile ? '0.6rem' : isMobile ? '0.7rem' : (isSmall ? '0.8rem' : '1rem') }}>{suit.symbol}</span>
            </div>
        </div>
    );
};

const Navbar: React.FC<{ username: string; onLogout: () => void; windowWidth?: number }> = ({ username, onLogout, windowWidth = 1024 }) => {
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
                {!isSmallMobile && (
            <div style={styles.userInfo}>
                <span style={styles.userIcon}>👤</span>
                        <span style={{
                            fontWeight: 600,
                            fontSize: isMobile ? '0.9rem' : '1rem',
                        }}>
                            {isMobile && username.length > 10 ? username.substring(0, 10) + '...' : username}
                        </span>
            </div>
                )}
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
}> = ({ title, message, onConfirm, onCancel, confirmText = "Потвърди", cancelText = "Отказ", windowWidth = 1024 }) => {
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
    const {user, logout } = useAuthContext();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [announcedSuit, setAnnouncedSuit] = useState<Suit | null>(null);
    const [confirmAction, setConfirmAction] = useState<null | { title: string; message: string; action: () => void; onCancel?: () => void }>(null);
    const [trickResult, setTrickResult] = useState<null | { winner: string; p1Name: string; p1Score: number; p2Name: string; p2Score: number }>(null);
    const [finalWinner, setFinalWinner] = useState<string | null>(null);
    const [activeBonuses, setActiveBonuses] = useState<{id: number, val: number, isOpponent: boolean}[]>([]);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

    const stompClient = useRef<any>(null);
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

    // Handle page close - leave game automatically (only when closing, not minimizing)
    useEffect(() => {
        if (!gameState) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // Automatically leave the game when page is closed (red X button)
            gameService.finishGame();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [gameState]);

    useEffect(() => {
        if (!gameState) return;
        const newBubbles: {id: number, val: number, isOpponent: boolean}[] = [];

        if (gameState.bonus && gameState.bonus > 0) {
            newBubbles.push({ id: Date.now(), val: gameState.bonus, isOpponent: false });
        }
        if (gameState.opponentPlayerBonus && gameState.opponentPlayerBonus > 0) {
            newBubbles.push({ id: Date.now() + 1, val: gameState.opponentPlayerBonus, isOpponent: true });
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
        const isTrickFinished = nextState.playedCard && nextState.opponentPlayedCard;

        if (isTrickFinished) {
            setGameState(nextState);
            setIsUiLocked(true);
            await new Promise(resolve => setTimeout(resolve, 2000));
            setIsUiLocked(false);
            setAnnouncedSuit(null); // Fix for reset highlight
        } else {
            setGameState(nextState);
        }

        if (nextState.trickWinnerUsername) setTrickResult({ winner: nextState.trickWinnerUsername, p1Name: nextState.firstPlayerUsername, p1Score: nextState.trickFirstPlayerScore || 0, p2Name: nextState.secondPlayerUsername, p2Score: nextState.trickSecondPlayerScore || 0 });
        if (nextState.winnerUsername) setFinalWinner(nextState.winnerUsername);

        isProcessingQueue.current = false;
        processNextMessage();
    };

    const handleGameUpdate = (newState: GameState) => {
        messageQueue.current.push(newState);
        processNextMessage();
    };

    // restored ordering logic
    const getSortedCards = (cards: Card[]) => {
        if (!gameState?.trumpCard) return cards;
        const trumpSuit = gameState.trumpCard.suit;
        return [...cards].sort((a, b) => {
            if (a.suit !== b.suit) {
                if (a.suit === trumpSuit) return -1; // Trump at the end
                if (b.suit === trumpSuit) return 1;
                return a.suit.localeCompare(b.suit);
            }
            return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
        });
    };

    const startSearch = () => {
        if (isSearching) return;
        setIsSearching(true);
        const sockToken = localStorage.getItem('refreshToken');
        const socket = new SockJS(`http://localhost/ws-game?token=${sockToken}`);
        const client = Stomp.over(socket);
        stompClient.current = client;
        client.connect({ 'Authorization': `Bearer ${sockToken}` }, () => {
            client.subscribe(`/topic/game/${username}`, (msg: any) => {
                const data = JSON.parse(msg.body);
                if (data.status === 'GAME_STARTED') {
                    setIsSearching(false);
                    client.subscribe(`/topic/game/${data.gameId}/${username}`, (m: any) => handleGameUpdate(JSON.parse(m.body)));
                    gameService.getInitialState().then(res => { if (res.data) handleGameUpdate(res.data); });
                }
            });
            gameService.searchGame().catch(() => setIsSearching(false));
        }, () => setIsSearching(false));
    };

    const handlePlayCard = async (card: Card) => {
        if (!gameState || !card.isPlayable || !gameState.isOnTurn || isUiLocked) return;
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
                    try { await gameService.announce(card.id); setAnnouncedSuit(card.suit); } catch (e) { console.error(e); }
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

    return (
        <div style={styles.table}>
            {!gameState && <Navbar username={username} onLogout={logout} windowWidth={windowWidth} />}

            {!gameState ? (
                <div style={styles.lobby}>
                    {(() => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;
                        return (
                            <div style={{
                                ...styles.lobbyContent,
                                padding: isSmallMobile ? '30px 20px' : isMobile ? '35px 30px' : '40px',
                            }}>
                                <div style={{
                                    ...styles.logoBadge,
                                    width: isSmallMobile ? '60px' : isMobile ? '70px' : '80px',
                                    height: isSmallMobile ? '60px' : isMobile ? '70px' : '80px',
                                    fontSize: isSmallMobile ? '2rem' : isMobile ? '2.2rem' : '2.5rem',
                                }}>66</div>
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
                    {activeBonuses.map(b => (
                        <div key={b.id} className="bonus-bubble" style={{ top: b.isOpponent ? '25%' : '65%' }}>
                            +{b.val} ТОЧКИ
                        </div>
                    ))}
                    
                    {/* SCOREBOARD - Different layout for mobile vs desktop */}
                    {(() => {
                        const isMobile = windowWidth <= 768;
                        const isSmallMobile = windowWidth <= 480;
                        
                        // Mobile: horizontal scoreboard above opponent cards
                        if (isMobile) {
                            return (
                                <div style={{
                                    ...styles.scoreBoardMobile,
                                    padding: isSmallMobile ? '8px 12px' : '10px 15px',
                                    fontSize: isSmallMobile ? '0.75rem' : '0.85rem',
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: isSmallMobile ? '12px' : '16px',
                                    }}>
                                        <span style={{
                                            fontSize: isSmallMobile ? '0.7rem' : '0.8rem',
                                            maxWidth: isSmallMobile ? '70px' : '90px',
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
                                        <span style={{
                                            margin: '0 8px',
                                            color: 'rgba(255,255,255,0.3)',
                                        }}>|</span>
                                        <span style={{
                                            fontSize: isSmallMobile ? '0.7rem' : '0.8rem',
                                            maxWidth: isSmallMobile ? '70px' : '90px',
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
                                    paddingTop: isMobile ? (isSmallMobile ? '50px' : '55px') : '0',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <div style={{
                                        ...styles.handOpponent,
                                        gap: isSmallMobile ? '-8px' : isMobile ? '-12px' : '-15px',
                                    }}>
                            {Array.from({ length: gameState.opponentPlayerCardsCount || 0 }).map((_, i) => (
                                            <div 
                                                key={i} 
                                                style={{
                                                    ...styles.cardBack,
                                                    width: isSmallMobile ? '50px' : isMobile ? '65px' : '85px',
                                                    height: isSmallMobile ? '75px' : isMobile ? '95px' : '125px',
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
                                                height: isSmallMobile ? '95px' : isMobile ? '120px' : '140px',
                                            }}>
                                                <div style={{
                                                    ...styles.trumpUnder,
                                                    top: isSmallMobile ? '3px' : '5px',
                                                    left: isSmallMobile ? '25px' : isMobile ? '30px' : '40px',
                                                }} onClick={() => {
                                        if (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) gameService.replaceCard();
                                    }}>
                                                    <CardComponent card={gameState.trumpCard!} isSmall windowWidth={windowWidth} />
                                    </div>
                                                <div style={{
                                                    ...styles.deckPile,
                                                    width: isSmallMobile ? '60px' : isMobile ? '75px' : '90px',
                                                    height: isSmallMobile ? '85px' : isMobile ? '110px' : '130px',
                                                }} onClick={() => {
                                        if (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) {
                                            setConfirmAction({ title: 'Затваряне', message: 'Затваряте ли тестето?', action: async () => { await gameService.closeDeck(); setConfirmAction(null); } });
                                        }
                                    }}>
                                                    <div style={{
                                                        ...styles.deckCount,
                                                        fontSize: isSmallMobile ? '1.3rem' : isMobile ? '1.5rem' : '1.8rem',
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
                                    {gameState.trumpCard && SUIT_MAP[gameState.trumpCard.suit].symbol}
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
                                        }}>{gameState.opponentPlayedCard && <CardComponent card={gameState.opponentPlayedCard} isPlayable={true} windowWidth={windowWidth} />}</div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>{gameState.playedCard && <CardComponent card={gameState.playedCard} isPlayable={true} windowWidth={windowWidth} />}</div>
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
                                            }} />
                                            {isSmallMobile
                                                ? (gameState.isOnTurn ? 'ВАШ РЕД' : 'ОПОНЕНТ...')
                                                : (gameState.isOnTurn ? 'ВАШ РЕД' : 'ОПОНЕНТЪТ ИГРАЕ...')
                                            }
                                        </div>
                                        
                                        {/* 66 button next to turn indicator (to the right) */}
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
                                            }} 
                                            onClick={() => setConfirmAction({ title: 'Край', message: 'Имате ли 66 точки?', action: async () => { await gameService.finishDeal(); setConfirmAction(null); } })}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                                                e.currentTarget.style.boxShadow = '0 10px 28px rgba(255, 152, 0, 0.6), 0 5px 14px rgba(0,0,0,0.3)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.transform = 'translateY(-50%) scale(1)';
                                                e.currentTarget.style.boxShadow = styles.icon66.boxShadow as string;
                                            }}
                                        >66</div>
                                    </div>

                                    {/* Cards section */}
                                    <div style={{
                                        ...styles.handPlayer,
                                        gap: isMobile ? '0' : '12px',  // No gap for mobile (using margin instead), space for desktop
                                        flexWrap: 'nowrap' as const,
                                        justifyContent: 'center',
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflowX: 'auto' as const,
                                        padding: isSmallMobile ? '0 10px' : isMobile ? '0 15px' : '0 20px',
                                        marginTop: isMobile ? (isSmallMobile ? '20px' : '25px') : '0',  // Move cards lower on mobile
                                        WebkitOverflowScrolling: 'touch' as const,
                                        boxSizing: 'border-box',
                                    }}>
                            {getSortedCards(gameState.deck).map((card, index) => (
                                            <div 
                                                key={card.id}
                                                style={{
                                                    marginLeft: isMobile && index > 0 
                                                        ? (isSmallMobile ? '-42.5px' : '-50px')  // Half overlap: each card shows half, next card starts
                                                        : '0',
                                                }}
                                            >
                                                <CardComponent 
                                                    card={card} 
                                                    isPlayable={card.isPlayable && gameState.isOnTurn} 
                                                    isSelected={announcedSuit === card.suit && (card.rank === 'KING' || card.rank === 'QUEEN')} 
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

                    {finalWinner && !trickResult && (() => {
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
                                    <p style={{
                                        fontSize: isSmallMobile ? '1rem' : isMobile ? '1.2rem' : '1.4rem',
                                        marginBottom: isSmallMobile ? '20px' : '30px',
                                        fontWeight: 300,
                                    }}>
                                    {finalWinner === username ? 'Брилянтна победа!' : `${finalWinner} спечели тази игра.`}
                                </p>
                                    <button onClick={() => window.location.reload()} style={{
                                        ...styles.btnMain,
                                        padding: isSmallMobile ? '12px 30px' : isMobile ? '14px 35px' : '15px 40px',
                                        fontSize: isSmallMobile ? '0.95rem' : isMobile ? '1rem' : '1.1rem',
                                    }}>КЪМ НАЧАЛО</button>
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
        justifyContent: 'center',
        alignItems: 'center',
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
        background: 'linear-gradient(135deg, #c62828 0%, #b71c1c 40%, #8e0000 100%)',
        border: '3px solid rgba(255,255,255,0.95)',
        borderRadius: '14px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.25), inset 0 2px 6px rgba(255,255,255,0.25), inset 0 -2px 6px rgba(0,0,0,0.3)',
        position: 'relative' as const,
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
        background: 'linear-gradient(135deg, #b71c1c 0%, #8e0000 100%)',
        border: '3px solid rgba(255,255,255,0.95)',
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        cursor: 'pointer',
        touchAction: 'manipulation',
        boxShadow: '0 8px 20px rgba(0,0,0,0.4), 0 4px 10px rgba(0,0,0,0.3), inset 0 2px 6px rgba(255,255,255,0.25)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    },
    deckCount: {
        color: 'white',
        fontWeight: 900,
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