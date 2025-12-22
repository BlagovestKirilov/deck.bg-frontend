import React, { useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useAuthContext } from '../context/AuthContext';
import { gameService } from '../api/gameService';
import { GameState, Card, Suit } from '../types/game.types';

// Inject global styles
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.innerHTML = `
        body, html { margin: 0; padding: 0; overflow: hidden; height: 100%; width: 100%; }
        #root { height: 100%; width: 100%; }
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

// Reusable card component
const CardComponent: React.FC<{
    card: Card;
    onClick?: () => void;
    isPlayable?: boolean;
    isSelected?: boolean;
    isSmall?: boolean;
}> = ({ card, onClick, isPlayable = true, isSelected, isSmall }) => {
    const suit = SUIT_MAP[card.suit] || { symbol: '?', color: 'black' };
    const displayRank = card.rank === 'NINE' ? '9' : (card.rank === 'TEN' ? '10' : card.rank[0]);

    let width = '18vw';
    let maxWidth = '100px';
    let height = '26vw';
    let maxHeight = '140px';

    if (isSmall) {
        width = '14vw';
        maxWidth = '75px';
        height = '20vw';
        maxHeight = '105px';
    }

    return (
        <div
            onClick={isPlayable ? onClick : undefined}
            style={{
                ...styles.card,
                width, maxWidth, height, maxHeight,
                color: isPlayable ? suit.color : '#777',
                border: isSelected ? '3px solid #4CAF50' : '1px solid #333',
                backgroundColor: isPlayable ? '#fff' : '#ccc',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                transform: isSelected ? 'translateY(-15px)' : 'none',
                transition: 'all 0.2s ease',
            }}
        >
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{displayRank}</div>
            <div style={{ fontSize: '3rem', textAlign: 'center', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {suit.symbol}
            </div>
        </div>
    );
};

// Reusable confirm modal
const ConfirmModal: React.FC<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}> = ({ title, message, onConfirm, onCancel }) => (
    <div style={styles.modalOverlay}>
        <div style={styles.modalBox}>
            <h3>{title}</h3>
            <p>{message}</p>
            <div style={styles.modalActions}>
                <button onClick={onCancel} style={styles.btnCancel}>Отказ</button>
                <button onClick={onConfirm} style={styles.btnConfirm}>Потвърди</button>
            </div>
        </div>
    </div>
);

const SantaseGame: React.FC = () => {
    const { token, user } = useAuthContext();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [announcedSuit, setAnnouncedSuit] = useState<Suit | null>(null);

    const [confirmAction, setConfirmAction] = useState<null | {
        title: string;
        message: string;
        action: () => void;
    }>(null);

    const stompClient = useRef<any>(null);
    const username = user?.username || "";

    const handleGameUpdate = (updatedState: GameState) => {
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
        gameService.getInitialState().then(res => {
            if (res.data) handleGameUpdate(res.data);
        });
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

    const openConfirm = (title: string, message: string, action: () => void) => {
        setConfirmAction({ title, message, action });
    };
    const closeConfirm = () => setConfirmAction(null);

    const handlePlayCard = async (card: Card) => {
        if (!gameState || !card.isPlayable || !gameState.isOnTurn) return;

        const isKingOrQueen = card.rank === 'KING' || card.rank === 'QUEEN';
        const partnerRank = card.rank === 'KING' ? 'QUEEN' : 'KING';
        const hasPartner = gameState.deck.some(c => c.rank === partnerRank && c.suit === card.suit);

        if (isKingOrQueen && hasPartner && announcedSuit !== card.suit) {
            const pts = card.suit === gameState.trumpCard?.suit ? 40 : 20;
            openConfirm(
                'Обявяване',
                `Желаете ли да обявите ${pts} точки?`,
                async () => {
                    try {
                        await gameService.announce(card.id);
                        setAnnouncedSuit(card.suit);
                    } catch (e) { console.error(e); }
                    closeConfirm();
                }
            );
            return;
        }

        gameService.playCard(card.id).catch(console.error);
    };

    return (
        <div style={styles.table}>
            {!gameState ? (
                <div style={styles.lobby}>
                    <button onClick={startSearch} style={styles.btnMain}>
                        {isSearching ? 'ТЪРСЕНЕ...' : 'ИГРАЙ'}
                    </button>
                </div>
            ) : (
                <div style={styles.gameWrapper}>
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
                                <>
                                    <div style={styles.trumpUnder} onClick={() => gameService.replaceCard()}>
                                        <CardComponent card={gameState.trumpCard!} isSmall />
                                    </div>
                                    <div
                                        style={styles.deckPile}
                                        onClick={() =>
                                            openConfirm(
                                                'Затваряне на тестето',
                                                'Сигурни ли сте, че искате да затворите тестето?',
                                                async () => {
                                                    await gameService.closeDeck();
                                                    closeConfirm();
                                                }
                                            )
                                        }
                                    >
                                        <div style={styles.deckCount}>{gameState.remainingCardsCount}</div>
                                    </div>
                                </>
                            ) : (
                                <div style={styles.closedTrump}>
                                    {gameState.trumpCard && SUIT_MAP[gameState.trumpCard.suit].symbol}
                                </div>
                            )}
                        </div>

                        <div style={styles.tableCenter}>
                            {gameState.opponentPlayedCard && <CardComponent card={gameState.opponentPlayedCard} />}
                            {gameState.playedCard && <CardComponent card={gameState.playedCard} />}
                        </div>
                    </div>

                    <div
                        style={styles.icon66}
                        onClick={() =>
                            openConfirm(
                                'Край на ръката',
                                'Сигурни ли сте, че искате да приключите ръката (66)?',
                                async () => {
                                    await gameService.finishDeal();
                                    closeConfirm();
                                }
                            )
                        }
                    >
                        66
                    </div>

                    <div style={styles.bottomSection}>
                        <div style={styles.handPlayer}>
                            {getSortedCards(gameState.deck).map(card => (
                                <CardComponent
                                    key={card.id}
                                    card={card}
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

                    {gameState.winnerUsername && (
                        <div style={styles.resultOverlay}>
                            <div style={styles.resultBox}>
                                <h2>РЕЗУЛТАТ</h2>
                                <p>{gameState.winnerUsername === username ? 'Вие победихте!' : `${gameState.winnerUsername} победи!`}</p>
                                <button onClick={() => window.location.reload()} style={styles.btnMain}>ОК</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Confirm Modal */}
            {confirmAction && (
                <ConfirmModal
                    title={confirmAction.title}
                    message={confirmAction.message}
                    onCancel={closeConfirm}
                    onConfirm={confirmAction.action}
                />
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    table: { width: '100vw', height: '100vh', background: 'radial-gradient(circle, #35692f 0%, #1a3a16 100%)', position: 'fixed', top: 0, left: 0, overflow: 'hidden', margin: 0, padding: 0 },
    gameWrapper: { width: '100%', height: '100%', position: 'relative' },
    lobby: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    scoreBoard: { position: 'absolute', top: '10px', left: '10px', zIndex: 10, background: 'rgba(0,0,0,0.4)', padding: '5px 10px', borderRadius: '5px', fontSize: '1rem', color: 'rgba(255,255,255,0.9)' },
    scoreRow: { display: 'flex', justifyContent: 'space-between', gap: '15px' },
    topSection: { position: 'absolute', top: '3vh', width: '100%', display: 'flex', justifyContent: 'center' },
    handOpponent: { display: 'flex', justifyContent: 'center', gap: '8px' },
    cardBack: { width: '18vw', maxWidth: '100px', height: '26vw', maxHeight: '140px', background: 'linear-gradient(#900, #700)', border: '1px solid #fff', borderRadius: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.4)' },
    midSection: { position: 'absolute', top: '48%', left: '50%', transform: 'translate(-50%, -50%)', width: '95%', display: 'flex', justifyContent: 'center', alignItems: 'center' },
    deckContainer: { position: 'absolute', left: '2vw', display: 'flex', alignItems: 'center' },
    deckPile: { width: '18vw', maxWidth: '100px', height: '26vw', maxHeight: '140px', background: '#900', borderRadius: '6px', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    deckCount: { fontSize: '1.4rem', fontWeight: 'bold' },
    trumpUnder: { position: 'absolute', left: '90px', transform: 'rotate(90deg)', zIndex: 1 },
    closedTrump: { fontSize: '3rem', opacity: 0.2, border: '2px dashed white', borderRadius: '50%', padding: '10px' },
    tableCenter: { display: 'flex', gap: '20px', marginLeft: '50px' },
    icon66: { position: 'absolute',  right: 'calc(25% - 27.5px)', bottom: '50px', width: '55px', height: '55px', borderRadius: '50%', background: '#ff9800', border: '2px solid white', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', zIndex: 20, boxShadow: '0 4px 10px rgba(0,0,0,0.4)' },
    bottomSection: { position: 'absolute', bottom: '2vh', width: '100%' },
    handPlayer: { display: 'flex', justifyContent: 'center', gap: '8px' },
    turnText: { textAlign: 'center', fontSize: '0.9rem', marginTop: '8px', fontWeight: 'bold', textTransform: 'uppercase' },
    card: { borderRadius: '6px', padding: '6px', display: 'flex', flexDirection: 'column', userSelect: 'none' },
    btnMain: { padding: '12px 40px', fontSize: '1.1rem', background: '#ff9800', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold' },
    resultOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    resultBox: { background: '#fff', padding: '30px', borderRadius: '15px', color: '#000', textAlign: 'center' },

    // Modal styles
    modalOverlay: { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    modalBox: { background: '#fff', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '320px', textAlign: 'center' },
    modalActions: { display: 'flex', justifyContent: 'space-between', marginTop: '20px' },
    btnCancel: { padding: '10px 20px', background: '#ccc', border: 'none', borderRadius: '6px', fontWeight: 'bold' },
    btnConfirm: { padding: '10px 20px', background: '#ff9800', border: 'none', borderRadius: '6px', fontWeight: 'bold', color: '#fff' },
};

export default SantaseGame;
