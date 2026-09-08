import { useCallback, useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const RECONNECT_DELAY_MS = 2000;
const CONNECT_TIMEOUT_MS = 3000;
const HEALTH_CHECK_MS = 10000;
const RECONNECT_GIVE_UP_MS = 60000;

interface GameApi {
    searchGame: () => Promise<unknown>;
    getInitialState: () => Promise<unknown>;
    surrender: () => Promise<unknown>;
}

interface Options<S> {
    /** Namespaces the search topic, e.g. "tabla". */
    gameKey: string;
    username: string;
    api: GameApi;
    /** Called for every state frame the server pushes. */
    onState?: (next: S) => void;
}

interface Session<S> {
    state: S | null;
    isConnected: boolean;
    isSearching: boolean;
    startSearch: () => void;
    /** Surrender, tear down, return to the lobby. */
    leaveGame: () => Promise<void>;
    /** Tear down without surrendering — the game already ended. */
    finishAndReturn: () => void;
}

interface MinimalState {
    gameId?: string;
}

/**
 * Multiplayer session plumbing: socket, subscriptions, reconnect, matchmaking.
 * Game-agnostic — the rules live in the screen that uses it.
 *
 * Written for табла first. SantaseGame still runs its own copy; migrating it is
 * a separate change so a refactor cannot break a game that is live right now.
 */
export function useGameSession<S extends MinimalState>(
    { gameKey, username, api, onState }: Options<S>,
): Session<S> {
    const [state, setState] = useState<S | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const clientRef = useRef<any>(null);
    const socketRef = useRef<any>(null);
    const gameSubRef = useRef<any>(null);
    const searchSubRef = useRef<any>(null);
    const gameIdRef = useRef<string | null>(null);

    const connectingRef = useRef(false);
    const reconnectingRef = useRef(false);
    const reconnectStartedRef = useRef<number | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const healthTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // connect() and scheduleReconnect() call each other; the ref breaks the cycle.
    const connectRef = useRef<(isReconnect: boolean) => void>(() => undefined);
    const onStateRef = useRef(onState);
    const apiRef = useRef(api);

    onStateRef.current = onState;
    apiRef.current = api;

    const clearTimers = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (connectTimerRef.current) {
            clearTimeout(connectTimerRef.current);
            connectTimerRef.current = null;
        }
        if (healthTimerRef.current) {
            clearInterval(healthTimerRef.current);
            healthTimerRef.current = null;
        }
    }, []);

    /** The single teardown path — this logic used to be copy-pasted three times. */
    const teardown = useCallback(() => {
        clearTimers();
        [gameSubRef, searchSubRef].forEach((ref) => {
            try {
                ref.current?.unsubscribe();
            } catch {
                /* already gone */
            }
            ref.current = null;
        });
        try {
            if (clientRef.current?.connected) clientRef.current.disconnect();
        } catch {
            /* already gone */
        }
        try {
            socketRef.current?.close();
        } catch {
            /* already gone */
        }
        clientRef.current = null;
        socketRef.current = null;
        connectingRef.current = false;
        reconnectingRef.current = false;
        reconnectStartedRef.current = null;
        setIsConnected(false);
    }, [clearTimers]);

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimerRef.current) return;
        if (!reconnectingRef.current) {
            reconnectingRef.current = true;
            reconnectStartedRef.current = Date.now();
        }
        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectRef.current(true);
        }, RECONNECT_DELAY_MS);
    }, []);

    const applyState = useCallback((next: S) => {
        if (next.gameId) gameIdRef.current = next.gameId;
        setState(next);
        setIsSearching(false);
        onStateRef.current?.(next);
    }, []);

    const subscribeToGame = useCallback((client: any, gameId: string) => {
        try {
            gameSubRef.current?.unsubscribe();
        } catch {
            /* already gone */
        }
        gameSubRef.current = client.subscribe(
            `/topic/game/${gameId}/${username}`,
            (msg: any) => applyState(JSON.parse(msg.body) as S),
        );
    }, [applyState, username]);

    const connect = useCallback((isReconnect: boolean) => {
        if (connectingRef.current) return;
        connectingRef.current = true;

        // The socket endpoint authenticates with the refresh token.
        const token = localStorage.getItem('refreshToken') ?? localStorage.getItem('token');
        const socket = new SockJS(`${API_BASE_URL}/ws-game?token=${token}`);
        socketRef.current = socket;

        const client = Stomp.over(socket);
        client.reconnect_delay = 0;       // manual reconnect only
        client.debug = () => undefined;   // the default logs every frame
        clientRef.current = client;

        connectTimerRef.current = setTimeout(() => {
            if (connectingRef.current) {
                connectingRef.current = false;
                if (gameIdRef.current) scheduleReconnect();
                else setIsSearching(false);
            }
        }, CONNECT_TIMEOUT_MS);

        socket.onclose = () => {
            setIsConnected(false);
            connectingRef.current = false;
            clearTimers();
            if (!isReconnect && !gameIdRef.current) setIsSearching(false);
            if (gameIdRef.current) scheduleReconnect();
        };

        const onConnected = () => {
            setIsConnected(true);
            connectingRef.current = false;
            reconnectingRef.current = false;
            reconnectStartedRef.current = null;
            if (connectTimerRef.current) {
                clearTimeout(connectTimerRef.current);
                connectTimerRef.current = null;
            }

            healthTimerRef.current = setInterval(() => {
                if (!gameIdRef.current) return;
                if (!clientRef.current?.connected && !reconnectingRef.current) {
                    setIsConnected(false);
                    scheduleReconnect();
                } else if (
                    reconnectingRef.current
                    && reconnectStartedRef.current
                    && Date.now() - reconnectStartedRef.current > RECONNECT_GIVE_UP_MS
                ) {
                    // Unstick a reconnect loop that never resolved.
                    reconnectingRef.current = false;
                    reconnectStartedRef.current = null;
                }
            }, HEALTH_CHECK_MS);

            // The search topic doubles as the resume channel: asking to search
            // while a game is already live makes the server reply GAME_STARTED
            // with its id, which is how a reopened tab finds its way back.
            searchSubRef.current = client.subscribe(
                `/topic/search/${gameKey}/${username}`,
                (msg: any) => {
                    const data = JSON.parse(msg.body);
                    if (data.status === 'GAME_STARTED' && data.gameId) {
                        gameIdRef.current = data.gameId;
                        subscribeToGame(client, data.gameId);
                        apiRef.current.getInitialState().catch(() => undefined);
                    }
                },
            );

            if (gameIdRef.current) {
                subscribeToGame(client, gameIdRef.current);
                apiRef.current.getInitialState().catch(() => undefined);
                return;
            }

            apiRef.current.searchGame().catch(() => setIsSearching(false));
        };

        const onError = () => {
            connectingRef.current = false;
            setIsConnected(false);
            if (gameIdRef.current) scheduleReconnect();
            else setIsSearching(false);
        };

        client.connect({ Authorization: `Bearer ${token}` }, onConnected, onError);
    }, [clearTimers, gameKey, scheduleReconnect, subscribeToGame, username]);

    connectRef.current = connect;

    const startSearch = useCallback(() => {
        if (isSearching || gameIdRef.current) return;
        setIsSearching(true);
        connect(false);
    }, [connect, isSearching]);

    const finishAndReturn = useCallback(() => {
        teardown();
        gameIdRef.current = null;
        setState(null);
        setIsSearching(false);
    }, [teardown]);

    const leaveGame = useCallback(async () => {
        try {
            await apiRef.current.surrender();
        } catch {
            // Getting out matters more than the surrender call succeeding.
        }
        finishAndReturn();
    }, [finishAndReturn]);

    useEffect(() => teardown, [teardown]);

    return { state, isConnected, isSearching, startSearch, leaveGame, finishAndReturn };
}
