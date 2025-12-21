import React, { useState, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { useAuthContext } from '../context/AuthContext';
import { gameService } from '../api/gameService';
import { GameState, Card, Suit } from '../types/game.types';

// --- Configuration & Constants ---
const SUIT_MAP: Record<Suit, { symbol: string; color: string }> = {
    SPADES: { symbol: '♠', color: '#1a1a1a' },
    HEARTS: { symbol: '♥', color: '#cc0000' },
    DIAMONDS: { symbol: '♦', color: '#cc0000' },
    CLUBS: { symbol: '♣', color: '#1a1a1a' }
};

interface CardProps {
    card: Card;
    onClick?: () => void;
    isTrump?: boolean;
    label?: string;
}

// --- Sub-Component: Card ---
const CardComponent: React.FC<CardProps> = ({ card, onClick, isTrump = false, label }) => {
    const suit = SUIT_MAP[card.suit] || { symbol: '?', color: 'black' };

    return (
        <div style={styles.cardWrapper}>
            {label && <small style={styles.cardLabel}>{label}</small>}
            <div
                onClick={onClick}
                style={{
                    ...styles.card,
                    color: suit.color,
                    border: isTrump ? '3px solid #ff9800' : '1px solid #1a1a1a',
                    backgroundColor: isTrump ? '#fff3e0' : '#fff',
                    cursor: onClick ? 'pointer' : 'default'
                }}
            >
                <div style={styles.cardRank}>
                    {card.rank === 'TEN' ? '10' : card.rank === 'NINE' ? '9' : card.rank[0]}
                </div>
                <div style={styles.cardSuit}>{suit.symbol}</div>
                <div style={styles.cardPoints}>{card.points} pts</div>
            </div>
        </div>
    );
};

// --- Main Class Component ---
const SantaseGame: React.FC = () => {
    const { token, user } = useAuthContext();
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Disconnected');
    const [error, setError] = useState<string | null>(null);

    const stompClient = useRef<any>(null);
    const username = user?.username || "";

    // 1. Move this UP so it's defined before it's called
    const handleGameUpdate = (updatedState: GameState) => {
        if (updatedState.winnerUsername) {
            alert(`🏆 GAME OVER! ${updatedState.winnerUsername} won the match!`);
        }
        setGameState(updatedState);
    };

    // 2. Move this UP so startSearch can find it
    const connectToGameRoom = (gameId: string) => {
        if (!stompClient.current || !username) return;

        const topic = `/topic/game/${gameId}/${username}`;
        console.log("Attempting to subscribe to:", topic);

        // Subscribe
        const subscription = stompClient.current.subscribe(topic, (message: any) => {
            console.log("Update received from WS!", message.body);
            setGameState(JSON.parse(message.body));
        });

        // Instead of waiting for a receipt (which requires backend config),
        // Call the initial state AFTER the subscription call.
        gameService.getInitialState()
            .then(res => {
                console.log("REST API Response:", res.data);
                if (res.data) {
                    setGameState(res.data);
                    setStatusMessage("CONNECTED");
                }
            })
            .catch(err => {
                console.error("Failed to fetch initial state:", err);
                setError("Game started but could not fetch data.");
            });
    };

    // 3. Now startSearch is defined last
    const startSearch = () => {
        if (!username) return;
        setIsSearching(true);

        const socket = new SockJS(`https://localhost/ws-game?token=${token}`);
        const client = Stomp.over(socket);
        stompClient.current = client;

        client.connect({ Authorization: `Bearer ${token}` }, () => {
            client.subscribe(`/topic/game/${username}`, (message: any) => {
                const data = JSON.parse(message.body);
                if (data.status === 'GAME_STARTED') {
                    connectToGameRoom(data.gameId);
                }
            });

            gameService.searchGame();
        });
    };
    return (
        <div style={styles.appContainer}>
            <h1 style={styles.header}>Santase Online</h1>

            {!gameState ? (
                <div style={styles.lobbyCard}>
                    <div style={styles.statusInfo}>
                        <p>Status: <span style={{ color: isSearching ? '#ff9800' : '#4CAF50' }}>{statusMessage}</span></p>
                        {error && <p style={styles.errorText}>{error}</p>}
                    </div>
                    <button
                        disabled={isSearching}
                        onClick={startSearch}
                        style={{...styles.mainButton, opacity: isSearching ? 0.6 : 1}}
                    >
                        {isSearching ? 'Searching...' : 'Find Opponent'}
                    </button>
                </div>
            ) : (
                <div style={styles.gameUI}>
                    {/* Top Bar: Scores & Turn */}
                    <div style={styles.gameControls}>
                        <div style={styles.statusBox}>
                            <strong>Deck:</strong> {gameState.remainingCardsCount}
                            <br/><small onClick={() => gameService.closeDeck()} style={{cursor: 'pointer', color: '#007bff'}}>
                            {gameState.isClosed ? "(CLOSED)" : "(Close Deck)"}
                        </small>
                        </div>
                        <div style={styles.statusBox}>
                            {gameState.firstPlayerUsername}: {gameState.firstPlayerResult}
                        </div>
                        <div style={styles.statusBox}>
                            {gameState.secondPlayerUsername}: {gameState.secondPlayerResult}
                        </div>
                        <div style={{...styles.statusBox, backgroundColor: gameState.isOnTurn ? '#e6ffe6' : '#ffe6e6'}}>
                            Turn: <strong>{gameState.isOnTurn ? 'YOURS' : 'OPPONENT'}</strong>
                        </div>
                        <button style={styles.actionBtn} onClick={() => gameService.finishDeal()}>Finish Deal</button>
                    </div>

                    {/* Table: Trump and Played Cards */}
                    <div style={styles.tableArea}>
                        <div style={styles.section}>
                            <h3>Trump</h3>
                            {gameState.trumpCard && (
                                <CardComponent
                                    card={gameState.trumpCard}
                                    isTrump
                                    onClick={() => gameService.replaceCard()}
                                />
                            )}
                        </div>

                        <div style={styles.section}>
                            <h3>Table</h3>
                            <div style={styles.handContainer}>
                                {gameState.opponentPlayedCard && <CardComponent card={gameState.opponentPlayedCard} label="Opponent" />}
                                {gameState.playedCard && <CardComponent card={gameState.playedCard} label="You" />}
                            </div>
                        </div>
                    </div>

                    {/* Player Hand */}
                    <div style={styles.playerSection}>
                        <h3>Your Hand</h3>
                        <div style={styles.handContainer}>
                            {gameState.deck.map((card) => (
                                <CardComponent
                                    key={card.id}
                                    card={card}
                                    onClick={() => gameService.playCard(card.id)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Styles ---
const styles: Record<string, React.CSSProperties> = {
    appContainer: { fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', padding: '20px' },
    header: { textAlign: 'center', color: '#333' },
    lobbyCard: { maxWidth: '400px', margin: '50px auto', padding: '30px', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center' },
    mainButton: { backgroundColor: '#4a90e2', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '6px', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 'bold' },
    statusInfo: { marginBottom: '20px' },
    errorText: { color: '#d93025', fontWeight: 'bold' },
    gameUI: { maxWidth: '900px', margin: '0 auto' },
    gameControls: { display: 'flex', gap: '15px', justifyContent: 'center', marginBottom: '30px', flexWrap: 'wrap' },
    statusBox: { padding: '10px 15px', border: '1px solid #b3cde0', borderRadius: '8px', backgroundColor: '#eaf4ff', textAlign: 'center', minWidth: '100px' },
    tableArea: { display: 'flex', justifyContent: 'space-around', margin: '40px 0', backgroundColor: '#2d5a27', padding: '20px', borderRadius: '15px', color: 'white' },
    section: { textAlign: 'center' },
    playerSection: { marginTop: '40px' },
    handContainer: { display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap' },
    cardWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' },
    cardLabel: { fontSize: '0.8rem', fontWeight: 'bold', color: '#ddd' },
    card: {
        width: '90px', height: '125px', borderRadius: '8px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)', userSelect: 'none'
    },
    cardRank: { fontSize: '1.4rem', fontWeight: 'bold' },
    cardSuit: { fontSize: '2.8rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
    cardPoints: { fontSize: '0.75rem', textAlign: 'right', color: '#777' },
    actionBtn: { padding: '10px 15px', borderRadius: '8px', border: 'none', backgroundColor: '#ff9800', color: 'white', fontWeight: 'bold', cursor: 'pointer' }
};

export default SantaseGame;