import React, { useState, useRef, useEffect } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useAuthContext } from '../context/AuthContext';
import { gameService } from '../api/gameService';
import { GameState, Card, Suit } from '../types/game.types';

// Global styles and animations
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        body, html { margin: 0; padding: 0; overflow: hidden; height: 100%; width: 100%; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        #root { height: 100%; width: 100%; }
        button { cursor: pointer; transition: opacity 0.2s; }
        button:hover { opacity: 0.9; }
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
            background: #ffeb3b;
            color: #000;
            font-weight: bold;
            padding: 10px 25px;
            border-radius: 50px;
            border: 2px solid #fbc02d;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            animation: floatUpFade 2.5s ease-out forwards;
            z-index: 1000;
            pointer-events: none;
            font-size: 1.2rem;
        }
    `;
    document.head.appendChild(style);
}

const SUIT_MAP: Record<Suit, { symbol: string; color: string }> = {
    SPADES: { symbol: '♠', color: '#1a1a1a' },
    HEARTS: { symbol: '♥', color: '#cc0000' },
    DIAMONDS: { symbol: '♦', color: '#cc0000' },
    CLUBS: { symbol: '♣', color: '#1a1a1a' }
};

const RANK_ORDER: Record<string, number> = {
    'ACE': 0, 'TEN': 1, 'KING': 2, 'QUEEN': 3, 'JACK': 4, 'NINE': 5
};

// --- Sub-Components ---

const Navbar: React.FC<{ username: string; onLogout: () => void }> = ({ username, onLogout }) => (
    <nav style={styles.navbar}>
        <div style={styles.navLogo}>SANTASE 66</div>
        <div style={styles.navLinks}>
            <div style={styles.userInfo}>
                <span style={styles.userIcon}>👤</span>
                <span>{username}</span>
            </div>
            <button onClick={onLogout} style={styles.btnLogout}>ИЗХОД</button>
        </div>
    </nav>
);

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
        width: isSmall ? '14vw' : '18vw',
        maxWidth: isSmall ? '75px' : '100px',
        height: isSmall ? '20vw' : '26vw',
        maxHeight: isSmall ? '105px' : '140px',
        color: isPlayable ? suit.color : '#777',
        border: isSelected ? '3px solid #4CAF50' : '1px solid #333',
        backgroundColor: isPlayable ? '#fff' : '#ccc',
        transform: isSelected ? 'translateY(-15px)' : 'none',
    };

    return (
        <div onClick={isPlayable ? onClick : undefined} style={cardStyle}>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{displayRank}</div>
            <div style={styles.cardSuitCenter}>{suit.symbol}</div>
        </div>
    );
};

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
            {title && <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>{title}</h3>}
            {message && <div style={{ marginBottom: '20px' }}>{message}</div>}
            <div style={{ ...styles.modalActions, justifyContent: onCancel ? 'space-between' : 'center' }}>
                {onCancel && <button onClick={onCancel} style={styles.btnCancel}>{cancelText}</button>}
                <button onClick={onConfirm} style={styles.btnConfirm}>{confirmText}</button>
            </div>
        </div>
    </div>
);

// --- Main Component ---

const SantaseGame: React.FC = () => {
    const { token, user, logout } = useAuthContext();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [announcedSuit, setAnnouncedSuit] = useState<Suit | null>(null);

    // UI Notification States
    const [activeBonuses, setActiveBonuses] = useState<{id: number, val: number, isOpponent: boolean}[]>([]);
    const [confirmAction, setConfirmAction] = useState<null | { title: string; message: string; action: () => void; onCancel?: () => void }>(null);
    const [trickResult, setTrickResult] = useState<null | { winner: string; p1Name: string; p1Score: number; p2Name: string; p2Score: number }>(null);
    const [finalWinner, setFinalWinner] = useState<string | null>(null);

    const stompClient = useRef<any>(null);
    const username = user?.username || "Играч";

    // Detect Bonus/Announcements to show Bubbles
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

    const handleGameUpdate = (updatedState: GameState) => {
        if (updatedState.trickWinnerUsername) {
            setTrickResult({
                winner: updatedState.trickWinnerUsername,
                p1Name: updatedState.firstPlayerUsername,
                p1Score: updatedState.trickFirstPlayerScore || 0,
                p2Name: updatedState.secondPlayerUsername,
                p2Score: updatedState.trickSecondPlayerScore || 0
            });
        }
        if (updatedState.winnerUsername) {
            setFinalWinner(updatedState.winnerUsername);
        }
        setGameState(updatedState);
        setAnnouncedSuit(null);
    };

    const getSortedCards = (cards: Card[]) => {
        if (!gameState?.trumpCard) return cards;
        const trumpSuit = gameState.trumpCard.suit;
        return [...cards].sort((a, b) => {
            if (a.suit !== b.suit) {
                if (a.suit === trumpSuit) return -1;
                if (b.suit === trumpSuit) return 1;
                return a.suit.localeCompare(b.suit);
            }
            return (RANK_ORDER[a.rank] ?? 99) - (RANK_ORDER[b.rank] ?? 99);
        });
    };

    const connectToGameRoom = (gameId: string) => {
        if (!stompClient.current || !username) return;
        stompClient.current.subscribe(`/topic/game/${gameId}/${username}`, (msg: any) => handleGameUpdate(JSON.parse(msg.body)));
        gameService.getInitialState().then(res => { if (res.data) handleGameUpdate(res.data); });
    };

    const startSearch = () => {
        setIsSearching(true);
        const socket = new SockJS(`https://localhost/ws-game?token=${token}`);
        const client = Stomp.over(socket);
        stompClient.current = client;
        client.connect({ Authorization: `Bearer ${token}` }, () => {
            client.subscribe(`/topic/game/${username}`, (msg: any) => {
                const data = JSON.parse(msg.body);
                if (data.status === 'GAME_STARTED') connectToGameRoom(data.gameId);
            });
            gameService.searchGame();
        });
    };

    const handlePlayCard = async (card: Card) => {
        if (!gameState || !card.isPlayable || !gameState.isOnTurn) return;
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

    return (
        <div style={styles.table}>
            {!gameState && <Navbar username={username} onLogout={logout} />}

            {!gameState ? (
                <div style={styles.lobby}>
                    <div style={styles.lobbyContent}>
                        <h1 style={styles.welcomeTitle}>Добре дошли, {username}</h1>
                        <p style={styles.welcomeSub}>Готови ли сте за нова игра на Сантасе?</p>
                        <button onClick={startSearch} style={styles.btnMain}>
                            {isSearching ? 'ТЪРСЕНЕ НА ОПОНЕНТ...' : 'ЗАПОЧНИ ИГРА'}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={styles.gameWrapper}>
                    {/* Bonus Bubbles */}
                    {activeBonuses.map(b => (
                        <div key={b.id} className="bonus-bubble" style={{ top: b.isOpponent ? '20%' : '70%' }}>
                            +{b.val} Обявяване
                        </div>
                    ))}

                    <div style={styles.scoreBoard}>
                        <div style={styles.scoreRow}><span>{gameState.firstPlayerUsername}:</span> <b>{gameState.firstPlayerResult}</b></div>
                        <div style={styles.scoreRow}><span>{gameState.secondPlayerUsername}:</span> <b>{gameState.secondPlayerResult}</b></div>
                    </div>

                    <div style={styles.topSection}>
                        <div style={styles.handOpponent}>
                            {Array.from({ length: gameState.opponentPlayerCardsCount || 0 }).map((_, i) => (
                                <div key={i} style={styles.cardBack} />
                            ))}
                        </div>
                    </div>

                    <div style={styles.midSection}>
                        <div style={styles.deckContainer}>
                            {gameState.remainingCardsCount > 0 && !gameState.isClosed ? (
                                <div style={{ position: 'relative', width: '150px', height: '140px' }}>
                                    <div
                                        style={{
                                            ...styles.trumpUnder,
                                            cursor: (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) ? 'pointer' : 'not-allowed',
                                            opacity: (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) ? 1 : 0.7
                                        }}
                                        onClick={() => {
                                            if (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) gameService.replaceCard();
                                        }}
                                    >
                                        <CardComponent card={gameState.trumpCard!} isSmall />
                                    </div>
                                    <div
                                        style={{
                                            ...styles.deckPile,
                                            cursor: (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) ? 'pointer' : 'not-allowed'
                                        }}
                                        onClick={() => {
                                            if (gameState.remainingCardsCount < 12 && gameState.remainingCardsCount > 2) {
                                                setConfirmAction({
                                                    title: 'Затваряне',
                                                    message: 'Сигурни ли сте, че искате да затворите тестето?',
                                                    action: async () => { await gameService.closeDeck(); setConfirmAction(null); }
                                                });
                                            }
                                        }}
                                    >
                                        <div style={styles.deckCount}>{gameState.remainingCardsCount}</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={styles.closedTrump}>
                                    {gameState.trumpCard && SUIT_MAP[gameState.trumpCard.suit].symbol}
                                </div>
                            )}
                        </div>

                        <div style={styles.tableCenter}>
                            <div style={styles.cardSlot}>
                                {gameState.opponentPlayedCard && <CardComponent card={gameState.opponentPlayedCard} />}
                            </div>
                            <div style={styles.cardSlot}>
                                {gameState.playedCard && <CardComponent card={gameState.playedCard} />}
                            </div>
                        </div>

                        <div style={styles.actionContainer}>
                            <div style={styles.icon66} onClick={() => setConfirmAction({
                                title: 'Край на ръката',
                                message: 'Сигурни ли сте, че искате да приключите ръката (66)?',
                                action: async () => { await gameService.finishDeal(); setConfirmAction(null); }
                            })}>66</div>
                        </div>
                    </div>

                    <div style={styles.bottomSection}>
                        <div style={styles.handPlayer}>
                            {getSortedCards(gameState.deck).map(card => (
                                <CardComponent
                                    key={card.id} card={card}
                                    isPlayable={card.isPlayable && gameState.isOnTurn}
                                    isSelected={announcedSuit === card.suit && (card.rank === 'KING' || card.rank === 'QUEEN')}
                                    onClick={() => handlePlayCard(card)}
                                />
                            ))}
                        </div>
                        <div style={{ ...styles.turnText, color: gameState.isOnTurn ? '#4CAF50' : '#ff5252' }}>
                            {gameState.isOnTurn ? 'Ваш ход' : 'Ход на противника'}
                        </div>
                    </div>

                    {/* Final Winner Modal - Shown only after trick result is cleared */}
                    {finalWinner && !trickResult && (
                        <div style={styles.resultOverlay}>
                            <div style={styles.resultBox}>
                                <h2 style={{ margin: '0 0 10px 0' }}>ИГРАТА ПРИКЛЮЧИ</h2>
                                <p style={{ fontSize: '1.2rem' }}>
                                    {finalWinner === username ? '🏆 Вие победихте!' : `${finalWinner} победи!`}
                                </p>
                                <button onClick={() => window.location.reload()} style={styles.btnMain}>КЪМ ЛОБИТО</button>
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
                    confirmText="OK"
                    message={
                        <div style={{ textAlign: 'left', fontSize: '1rem', minWidth: '240px' }}>
                            <p style={{ textAlign: 'center', fontWeight: 'bold', color: '#4CAF50', fontSize: '1.1rem', marginBottom: '15px' }}>
                                Раздаването спечели: {trickResult.winner}
                            </p>
                            <div style={styles.trickScoreRow}>
                                <span>{trickResult.p1Name}</span>
                                <span style={{fontWeight: 'bold'}}>{trickResult.p1Score} т.</span>
                            </div>
                            <div style={styles.trickScoreRow}>
                                <span>{trickResult.p2Name}</span>
                                <span style={{fontWeight: 'bold'}}>{trickResult.p2Score} т.</span>
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
    table: { width: '100vw', height: '100vh', background: 'radial-gradient(circle, #35692f 0%, #1a3a16 100%)', position: 'fixed', top: 0, left: 0, overflow: 'hidden' },
    gameWrapper: { width: '100%', height: '100%', position: 'relative' },
    lobby: { height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    lobbyContent: { textAlign: 'center', color: 'white', padding: '20px' },
    welcomeTitle: { fontSize: '2.2rem', marginBottom: '10px', fontWeight: 'bold' },
    welcomeSub: { fontSize: '1.1rem', marginBottom: '30px', opacity: 0.8 },
    navbar: { height: '60px', width: '100%', background: 'rgba(0, 0, 0, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 30px', boxSizing: 'border-box', position: 'absolute', top: 0, zIndex: 100 },
    navLogo: { color: '#ff9800', fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '2px' },
    navLinks: { display: 'flex', alignItems: 'center', gap: '20px' },
    userInfo: { color: 'white', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem' },
    userIcon: { background: 'rgba(255,255,255,0.1)', padding: '6px', borderRadius: '50%', fontSize: '1rem' },
    btnLogout: { background: 'transparent', border: '1px solid #ff5252', color: '#ff5252', padding: '6px 15px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' },
    scoreBoard: { position: 'absolute', top: '10px', left: '10px', zIndex: 10, background: 'rgba(0,0,0,0.5)', padding: '8px 15px', borderRadius: '8px', color: 'white' },
    scoreRow: { display: 'flex', justifyContent: 'space-between', gap: '20px', minWidth: '120px' },
    topSection: { position: 'absolute', top: '5vh', width: '100%', display: 'flex', justifyContent: 'center' },
    handOpponent: { display: 'flex', gap: '8px' },
    cardBack: { width: '18vw', maxWidth: '100px', height: '26vw', maxHeight: '140px', background: 'linear-gradient(#900, #700)', border: '2px solid #fff', borderRadius: '8px', boxShadow: '0 4px 8px rgba(0,0,0,0.4)' },

    // Static mid-section layout
    midSection: { position: 'absolute', top: '50%', left: '0', right: '0', transform: 'translateY(-50%)', height: '200px', display: 'flex', alignItems: 'center', padding: '0 5vw' },
    deckContainer: { width: '180px', display: 'flex', justifyContent: 'center', position: 'relative' },
    tableCenter: { flex: 1, display: 'flex', justifyContent: 'center', gap: '20px' },
    cardSlot: { width: '100px', height: '140px', display: 'flex', justifyContent: 'center' },
    actionContainer: { width: '180px', display: 'flex', justifyContent: 'center' },

    deckPile: { position: 'absolute', top: '0', left: '0', width: '18vw', maxWidth: '100px', height: '26vw', maxHeight: '140px', background: '#900', borderRadius: '6px', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, boxShadow: '4px 0 10px rgba(0,0,0,0.3)' },
    deckCount: { fontSize: '1.5rem', fontWeight: 'bold', color: 'white' },
    trumpUnder: { position: 'absolute', top: '10px', left: '90px', transform: 'rotate(90deg)', zIndex: 1 },
    closedTrump: { fontSize: '3rem', opacity: 0.2, border: '2px dashed white', borderRadius: '50%', padding: '15px', color: 'white' },
    icon66: { width: '65px', height: '65px', borderRadius: '50%', background: '#ff9800', border: '3px solid white', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.6rem', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', cursor: 'pointer' },

    bottomSection: { position: 'absolute', bottom: '3vh', width: '100%' },
    handPlayer: { display: 'flex', justifyContent: 'center', gap: '8px' },
    turnText: { textAlign: 'center', fontSize: '1.1rem', marginTop: '15px', fontWeight: 'bold', textShadow: '1px 1px 2px rgba(0,0,0,0.5)' },
    card: { borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', userSelect: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'all 0.2s ease' },
    cardSuitCenter: { fontSize: '3rem', textAlign: 'center', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    btnMain: { padding: '15px 45px', fontSize: '1.2rem', background: '#ff9800', border: 'none', borderRadius: '30px', color: 'white', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' },
    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalBox: { background: '#fff', padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '360px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' },
    modalActions: { display: 'flex', gap: '10px', marginTop: '10px' },
    btnCancel: { flex: 1, padding: '12px', background: '#f0f0f0', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#555' },
    btnConfirm: { flex: 1, padding: '12px', background: '#ff9800', border: 'none', borderRadius: '8px', fontWeight: 'bold', color: '#fff' },
    trickScoreRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' },
    resultOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    resultBox: { background: '#fff', padding: '40px', borderRadius: '20px', color: '#000', textAlign: 'center' },
};

export default SantaseGame;