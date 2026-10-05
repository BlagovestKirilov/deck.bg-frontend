import { useCallback, useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { socketToken } from '../api/apiClient';
import { belotService } from '../api/belotService';
import { BelotState } from '../types/belot.types';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const RECONNECT_DELAY_MS = 2000;

interface Table {
    state: BelotState | null;
    isConnected: boolean;
    /** True from sitting down until the fourth player arrives. */
    isWaiting: boolean;
    /** Set when the server refused — the game is not on offer to this account. */
    unavailable: boolean;
}

/**
 * The belot socket: one subscription, and the table state that arrives on it.
 *
 * Simpler than `useGameSession`, deliberately. Сантасе and табла subscribe to a
 * search topic, wait to be told a game id, then subscribe to that game — belot
 * has one topic per player instead, so the client can listen before it knows
 * which table it will be given, and the same subscription carries it through
 * every deal and every reconnect.
 */
export function useBelotTable(username: string): Table {
    const [state, setState] = useState<BelotState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [unavailable, setUnavailable] = useState(false);

    const clientRef = useRef<any>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closedByUs = useRef(false);
    // Whether this screen has a table yet: the first connection sits the
    // player down, a later one only asks where they are.
    const hasState = useRef(false);

    const connect = useCallback(async () => {
        if (!username || closedByUs.current) return;

        // socketToken() is async — it renews the access token when it is close
        // to expiring. Calling it without awaiting sent the literal string
        // "[object Promise]" as the bearer, the CONNECT frame was refused, and
        // the socket reconnected every two seconds forever.
        const token = await socketToken();
        if (closedByUs.current) return;

        const client = Stomp.over(() => new SockJS(`${API_BASE_URL}/ws-game`));
        client.debug = () => undefined;
        clientRef.current = client;

        const onConnected = () => {
            setIsConnected(true);

            client.subscribe(`/topic/belot/${username}`, (message: any) => {
                hasState.current = true;
                setState(JSON.parse(message.body) as BelotState);
            });

            // Coming back after the connection dropped — the server restarted,
            // a deploy, the network — the screen only asks for the table it
            // already has. Searching again would sit a player who is reading a
            // finished game's result down at a new one they never asked for;
            // for one still at a table the two answers are the same.
            if (hasState.current) {
                belotService.getState().catch(() => undefined);
                return;
            }

            // The first time, sitting down and asking for the state are the
            // same request: search returns the player to the table they
            // already have, or finds them one.
            belotService.search().catch((error) => {
                // 404 is the server saying belot is not on offer to this
                // account — switched off, or still only for the testers.
                if (error?.response?.status === 404) setUnavailable(true);
            });
        };

        const onError = () => {
            // A connection already replaced may still report its own close
            // later; reconnecting for it would open a second, duplicate one.
            if (clientRef.current !== client) return;
            setIsConnected(false);
            if (closedByUs.current) return;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            reconnectRef.current = setTimeout(() => { void connect(); }, RECONNECT_DELAY_MS);
        };

        // onError twice: once for a STOMP error, and once as the close callback.
        // The compatibility client neither reconnects by itself nor reports a
        // dropped socket as an error, so without the second a restarted server
        // left this screen connected to nothing — "Още една" seated the player
        // and filled the table, and the game started for the other three.
        client.connect({ Authorization: `Bearer ${token}` }, onConnected, onError, onError);
    }, [username]);

    useEffect(() => {
        closedByUs.current = false;
        void connect();

        return () => {
            closedByUs.current = true;
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            try {
                clientRef.current?.disconnect?.();
            } catch {
                // Already gone: nothing to close.
            }
        };
    }, [connect]);

    // A tab that comes back may have missed a push while it was asleep.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && clientRef.current?.connected) {
                belotService.getState().catch(() => undefined);
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, []);

    return {
        state,
        isConnected,
        isWaiting: state !== null && state.status === 'WAITING',
        unavailable,
    };
}
