import React, { useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useAuthContext } from '../context/AuthContext';
import { gameService } from '../api/gameService';
import { GameState, Card, Suit } from '../types/game.types';

// Global styles and animations
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        body, html { margin: 0; padding: 0; overflow: hidden; height: 100%; width: 100%; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #132a18; }
        #root { height: 100%; width: 100%; }
        button { cursor: pointer; transition: all 0.2s; border: none; }
        button:hover { transform: translateY(-2px); filter: brightness(1.1); }
        button:active { transform: scale(0.98); }
        
        @keyframes floatUpFade {
            0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
            20% { transform: translate(-50%, -20px) scale(1.1); opacity: 1; }
            80% { transform: translate(-50%, -60px) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -100px) scale(0.8); opacity: 0; }
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
}> = ({ card, onClick, isPlayable = true, isSelected, isSmall }) => {
    const suit = SUIT_MAP[card.suit] || { symbol: '?', color: 'black' };
    const displayRank = card.rank === 'NINE' ? '9' : (card.rank === 'TEN' ? '10' : card.rank[0]);

    const cardStyle = {
        ...styles.card,
        width: isSmall ? '75px' : '100px',
        height: isSmall ? '110px' : '145px',
        color: isPlayable ? suit.color : '#999',
        border: isSelected ? '3px solid #ffeb3b' : '1px solid rgba(0,0,0,0.1)',
        backgroundColor: isPlayable ? '#fff' : '#e0e0e0',
        transform: isSelected ? 'translateY(-20px) scale(1.05)' : 'none',
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        padding: '8px',
        position: 'relative' as const,
    };

    const cornerStyle = {
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        lineHeight: '1',
        fontWeight: 'bold' as const,
        fontSize: isSmall ? '0.9rem' : '1.1rem',
    };

    return (
        <div onClick={isPlayable ? onClick : undefined} style={cardStyle}>
            <div style={{ ...cornerStyle, alignSelf: 'flex-start' }}>
                <span>{displayRank}</span>
                <span style={{ fontSize: isSmall ? '0.8rem' : '1rem' }}>{suit.symbol}</span>
            </div>
            <div style={{ fontSize: isSmall ? '1.8rem' : '2.5rem', alignSelf: 'center', opacity: 0.9 }}>
                {suit.symbol}
            </div>
            <div style={{ ...cornerStyle, alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
                <span>{displayRank}</span>
                <span style={{ fontSize: isSmall ? '0.8rem' : '1rem' }}>{suit.symbol}</span>
            </div>
        </div>
    );
};

const Navbar: React.FC<{ username: string; onLogout: () => void }> = ({ username, onLogout }) => (
    <nav style={styles.navbar}>
        <div style={styles.navLogo}>SANTASE <span style={{color: '#fff'}}>66</span></div>
        <div style={styles.navLinks}>
            <div style={styles.userInfo}>
                <span style={styles.userIcon}>👤</span>
                <span style={{fontWeight: 600}}>{username}</span>
            </div>
            <button onClick={onLogout} style={styles.btnLogout}>ИЗХОД</button>
        </div>
    </nav>
);

const AppModal: React.FC<{
    title?: string;
    message?: string | React.ReactNode;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
}> = ({ title, message, onConfirm, onCancel, confirmText = "Потвърди", cancelText = "Отказ" }) => (
    <div style={styles.modalOverlay}>
        <div style={styles.modalBox}>
            {title && <h3 style={{ margin: '0 0 15px 0', color: '#1a1a1a', fontSize: '1.5rem' }}>{title}</h3>}
            {message && <div style={{ marginBottom: '25px', color: '#444', fontSize: '1.1rem' }}>{message}</div>}
            <div style={{ ...styles.modalActions, justifyContent: onCancel ? 'space-between' : 'center' }}>
                {onCancel && <button onClick={onCancel} style={styles.btnCancel}>{cancelText}</button>}
                <button onClick={onConfirm} style={styles.btnConfirm}>{confirmText}</button>
            </div>
        </div>
    </div>
);

const SantaseGame: React.FC = () => {
    const {user, logout } = useAuthContext();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [announcedSuit, setAnnouncedSuit] = useState<Suit | null>(null);
    const [confirmAction, setConfirmAction] = useState<null | { title: string; message: string; action: () => void; onCancel?: () => void }>(null);
    const [trickResult, setTrickResult] = useState<null | { winner: string; p1Name: string; p1Score: number; p2Name: string; p2Score: number }>(null);
    const [finalWinner, setFinalWinner] = useState<string | null>(null);

    const stompClient = useRef<any>(null);
    const username = user?.username || "Играч";
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
        const sockToken = localStorage.getItem('token');
        const socket = new SockJS(`https://deck.bg/ws-game?token=${sockToken}`);
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
            {!gameState && <Navbar username={username} onLogout={logout} />}

            {!gameState ? (
                <div style={styles.lobby}>
                    <div style={styles.lobbyContent}>
                        <div style={styles.logoBadge}>66</div>
                        <h1 style={styles.welcomeTitle}>Добре дошли, {username}</h1>
                        <p style={styles.welcomeSub}>Класическо Сантасе срещу реални опоненти</p>
                        <button
                            onClick={startSearch}
                            style={{
                                ...styles.btnMain,
                                background: isSearching ? '#555' : '#ff9800'
                            }}
                        >
                            {isSearching ? 'ТЪРСЕНЕ...' : 'НОВА ИГРА'}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={styles.gameWrapper}>
                    {/* PERSPECTIVE FIXED SCOREBOARD */}
                    <div style={styles.scoreBoard}>
                        <div style={{...styles.scoreRow, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px', marginBottom: '8px'}}>
                            <span>{isFirstPlayerMe ? gameState.secondPlayerUsername : gameState.firstPlayerUsername}</span>
                            <span style={{fontSize: '1.4rem', fontWeight: 800, color: '#ff5252'}}>
                                {isFirstPlayerMe ? gameState.secondPlayerResult : gameState.firstPlayerResult}
                            </span>
                        </div>
                        <div style={styles.scoreRow}>
                            <span>{username} (Вие)</span>
                            <span style={{fontSize: '1.4rem', fontWeight: 800, color: '#4CAF50'}}>
                                {isFirstPlayerMe ? gameState.firstPlayerResult : gameState.secondPlayerResult}
                            </span>
                        </div>
                    </div>

                    <div style={styles.topSection}>
                        <div style={styles.handOpponent}>
                            {Array.from({ length: gameState.opponentPlayerCardsCount || 0 }).map((_, i) => (
                                <div key={i} style={styles.cardBack} />
                            ))}
                        </div>
                    </div>

                    <div style={styles.midSection}>
                        <div style={styles.deckSide}>
                            {gameState.remainingCardsCount > 0 && !gameState.isClosed ? (
                                <div style={{ position: 'relative', width: '120px', height: '140px' }}>
                                    {/* Restored Replace Nine logic on Click */}
                                    <div style={styles.trumpUnder} onClick={() => {
                                        if (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) gameService.replaceCard();
                                    }}>
                                        <CardComponent card={gameState.trumpCard!} isSmall />
                                    </div>
                                    <div style={styles.deckPile} onClick={() => {
                                        if (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) {
                                            setConfirmAction({ title: 'Затваряне', message: 'Затваряте ли тестето?', action: async () => { await gameService.closeDeck(); setConfirmAction(null); } });
                                        }
                                    }}>
                                        <div style={styles.deckCount}>{gameState.remainingCardsCount}</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={styles.closedTrump}>
                                    <span style={{fontSize: '0.8rem', display: 'block'}}>КОЗ</span>
                                    {gameState.trumpCard && SUIT_MAP[gameState.trumpCard.suit].symbol}
                                </div>
                            )}
                        </div>

                        <div style={styles.tableCenter}>
                            <div style={styles.feltArea}>
                                <div style={styles.cardSlot}>{gameState.opponentPlayedCard && <CardComponent card={gameState.opponentPlayedCard} />}</div>
                                <div style={styles.cardSlot}>{gameState.playedCard && <CardComponent card={gameState.playedCard} />}</div>
                            </div>
                        </div>

                        <div style={styles.actionsSide}>
                            <div style={styles.icon66} onClick={() => setConfirmAction({ title: 'Край', message: 'Имате ли 66 точки?', action: async () => { await gameService.finishDeal(); setConfirmAction(null); } })}>66</div>
                            {/* Restored Leave Game button */}
                            <div style={styles.btnLeave} onClick={() => setConfirmAction({ title: 'Напускане', message: 'Сигурни ли сте? Това е автоматична загуба.', action: () => gameService.finishGame() })}>✕</div>
                        </div>
                    </div>

                    <div style={styles.bottomSection}>
                        <div style={styles.turnIndicator}>
                            <div style={{ ...styles.pulse, backgroundColor: gameState.isOnTurn ? '#4CAF50' : '#ff5252' }} />
                            {gameState.isOnTurn ? 'ВАШ РЕД' : 'ОПОНЕНТЪТ ИГРАЕ...'}
                        </div>
                        <div style={styles.handPlayer}>
                            {getSortedCards(gameState.deck).map((card) => (
                                <CardComponent key={card.id} card={card} isPlayable={card.isPlayable && gameState.isOnTurn} isSelected={announcedSuit === card.suit && (card.rank === 'KING' || card.rank === 'QUEEN')} onClick={() => handlePlayCard(card)} />
                            ))}
                        </div>
                    </div>

                    {finalWinner && !trickResult && (
                        <div style={styles.resultOverlay}>
                            <div style={styles.resultBox}>
                                <div style={{fontSize: '4rem', marginBottom: '10px'}}>
                                    {finalWinner === username ? '🏆' : '🏳️'}
                                </div>
                                <h2 style={{ margin: '0 0 10px 0', fontSize: '2rem' }}>ИГРАТА ПРИКЛЮЧИ</h2>
                                <p style={{ fontSize: '1.4rem', marginBottom: '30px', fontWeight: 300 }}>
                                    {finalWinner === username ? 'Брилянтна победа!' : `${finalWinner} спечели тази игра.`}
                                </p>
                                <button onClick={() => window.location.reload()} style={styles.btnMain}>КЪМ НАЧАЛО</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {confirmAction && (
                <AppModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    onConfirm={confirmAction.action}
                    onCancel={confirmAction.onCancel ? confirmAction.onCancel : () => setConfirmAction(null)}
                />
            )}

            {trickResult && (
                <AppModal
                    confirmText="ПРОДЪЛЖИ"
                    title="Край на раздаването"
                    message={
                        <div style={{ textAlign: 'left', minWidth: '280px' }}>
                            <div style={{ textAlign: 'center', fontWeight: 'bold', color: '#4CAF50', fontSize: '1.2rem', marginBottom: '20px', padding: '10px', background: '#f1f8e9', borderRadius: '8px' }}>
                                Победител: {trickResult.winner}
                            </div>
                            <div style={styles.trickScoreRow}>
                                <span>{trickResult.p1Name}</span>
                                <span style={{fontWeight: 800}}>{trickResult.p1Score} т.</span>
                            </div>
                            <div style={styles.trickScoreRow}>
                                <span>{trickResult.p2Name}</span>
                                <span style={{fontWeight: 800}}>{trickResult.p2Score} т.</span>
                            </div>
                        </div>
                    }
                    onConfirm={() => setTrickResult(null)}
                />
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    table: { width: '100vw', height: '100vh', position: 'fixed', top: 0, left: 0, overflow: 'hidden', background: `radial-gradient(circle at center, #2e7d32 0%, #1b5e20 100%)` },
    gameWrapper: { width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' },
    lobby: { height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    lobbyContent: { textAlign: 'center', color: 'white', padding: '40px', background: 'rgba(0,0,0,0.2)', borderRadius: '30px', backdropFilter: 'blur(10px)' },
    logoBadge: { width: '80px', height: '80px', borderRadius: '50%', background: '#ff9800', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 900, border: '4px solid white' },
    welcomeTitle: { fontSize: '2rem', marginBottom: '30px', color: '#fff' },
    navbar: { height: '70px', width: '100%', background: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', boxSizing: 'border-box' },
    navLogo: { color: '#ff9800', fontSize: '1.6rem', fontWeight: 900 },
    navLinks: { display: 'flex', alignItems: 'center', gap: '20px' },
    userInfo: { color: 'white', display: 'flex', alignItems: 'center', gap: '10px' },
    userIcon: { background: 'rgba(255,255,255,0.1)', padding: '5px', borderRadius: '50%' },
    btnLogout: { background: 'transparent', border: '1px solid #ff5252', color: '#ff5252', padding: '5px 15px', borderRadius: '5px' },
    scoreBoard: { position: 'absolute', top: '40px', left: '20px', zIndex: 10, background: 'rgba(0,0,0,0.6)', padding: '15px', borderRadius: '12px', color: 'white', minWidth: '180px', border: '1px solid rgba(255,255,255,0.1)' },
    scoreRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    topSection: { height: '25vh', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    handOpponent: { display: 'flex' },
    cardBack: { width: '85px', height: '125px', background: 'linear-gradient(135deg, #d32f2f, #b71c1c)', border: '3px solid #fff', borderRadius: '10px', marginLeft: '-15px', boxShadow: '0 4px 8px rgba(0,0,0,0.5)' },
    midSection: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 60px' },
    deckSide: { width: '150px', position: 'relative' },
    tableCenter: { flex: 1, display: 'flex', justifyContent: 'center' },
    feltArea: { padding: '30px 50px', borderRadius: '100px', display: 'flex', gap: '30px' },
    cardSlot: { width: '100px', height: '145px', borderRadius: '10px' },
    actionsSide: { width: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' },
    deckPile: { position: 'absolute', top: 0, left: 0, width: '90px', height: '130px', background: '#b71c1c', border: '3px solid white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, cursor: 'pointer' },
    deckCount: { color: 'white', fontSize: '1.8rem', fontWeight: 900 },
    trumpUnder: { position: 'absolute', top: '5px', left: '40px', transform: 'rotate(90deg)', zIndex: 1, cursor: 'pointer' },
    closedTrump: { width: '80px', height: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(255,255,255,0.3)', borderRadius: '50%', color: 'white', fontSize: '2.5rem', background: 'rgba(0,0,0,0.2)' },
    icon66: { width: '70px', height: '70px', borderRadius: '50%', background: '#ff9800', border: '4px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
    btnLeave: { width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.3)', border: '1px solid white', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
    bottomSection: { height: '35vh', display: 'flex', flexDirection: 'column', alignItems: 'center' },
    turnIndicator: { background: 'rgba(0,0,0,0.5)', padding: '5px 20px', borderRadius: '20px', color: 'white', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' },
    pulse: { width: '8px', height: '8px', borderRadius: '50%' },
    handPlayer: { display: 'flex', gap: '10px' },
    card: { borderRadius: '10px', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'all 0.2s', cursor: 'pointer' },
    btnMain: { padding: '15px 40px', background: '#ff9800', color: 'white', borderRadius: '30px', fontWeight: 800, fontSize: '1.1rem' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalBox: { background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', minWidth: '300px' },
    modalActions: { display: 'flex', gap: '10px', marginTop: '20px' },
    btnCancel: { flex: 1, padding: '10px', background: '#eee', borderRadius: '10px' },
    btnConfirm: { flex: 1, padding: '10px', background: '#2e7d32', color: 'white', borderRadius: '10px' },
    resultOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    resultBox: { background: 'white', padding: '50px', borderRadius: '30px', textAlign: 'center' },
    trickScoreRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee', fontSize: '1.1rem' },
};

export default SantaseGame;