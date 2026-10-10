import { useCallback, useEffect, useRef, useState } from 'react';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { socketToken } from '../api/apiClient';
import { belotService } from '../api/belotService';
import { BelotState } from '../types/belot.types';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const RECONNECT_DELAY_MS = 2000;

/**
 * How long to wait for a table before taking it that there is none. The
 * server says so at once (204), and this is only for one that does not yet:
 * otherwise a player at no table would be left looking at "connecting".
 */
const NO_TABLE_AFTER_MS = 3000;

interface Table {
    state: BelotState | null;
    isConnected: boolean;
    /** The server has answered that this player is not at a table. */
    noTable: boolean;
    /** Asked to be seated, and the answer has not come back yet. */
    searching: boolean;
    /** Find a table: the one this player already has, or one short of four. */
    startSearch: () => void;
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
 *
 * Opening the screen sits nobody down: it asks where the player already is,
 * and a player at no table is shown the way to find one, as at the other two
 * games. The search starts when they ask for it.
 */
export function useBelotTable(username: string): Table {
    const [state, setState] = useState<BelotState | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [noTable, setNoTable] = useState(false);
    const [searching, setSearching] = useState(false);
    const [unavailable, setUnavailable] = useState(false);

    const clientRef = useRef<any>(null);
    const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const noTableRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closedByUs = useRef(false);
    // Whether this screen has a table yet.
    const hasState = useRef(false);
    // A search asked for before the socket was up: started once it is, so the
    // table it finds is not pushed to a subscription that does not exist yet.
    const searchWhenConnected = useRef(false);
    // Sitting at a table still short of four. Leaving the screen gets the
    // player up from it, and so does the server when the socket closes — so a
    // socket that only dropped sits them down again once it is back.
    const waiting = useRef(false);
    // Asked to sit down, and no table has come back yet.
    const asked = useRef(false);

    const search = useCallback(() => {
        asked.current = true;
        belotService.search().catch((error) => {
            asked.current = false;
            setSearching(false);
            // 404 is the server saying belot is not on offer to this
            // account — switched off, or still only for the testers.
            if (error?.response?.status === 404) setUnavailable(true);
        });
    }, []);

    const startSearch = useCallback(() => {
        setSearching(true);
        if (clientRef.current?.connected) {
            search();
        } else {
            searchWhenConnected.current = true;
        }
    }, [search]);

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
                const next = JSON.parse(message.body) as BelotState;
                hasState.current = true;
                waiting.current = next.status === 'WAITING';
                if (!waiting.current) asked.current = false;
                setState(next);
            });

            if (searchWhenConnected.current || waiting.current) {
                searchWhenConnected.current = false;
                search();
                return;
            }

            // Only ever asked, never sat down: a reload mid-game, a deploy, the
            // network — the screen gets back the table it has, and a player
            // reading a finished game's result is not seated at a new one.
            belotService.getState()
                .then((response) => {
                    if (response.status === 204 && !hasState.current) setNoTable(true);
                })
                .catch(() => undefined);
            if (!hasState.current) {
                if (noTableRef.current) clearTimeout(noTableRef.current);
                noTableRef.current = setTimeout(() => {
                    if (!hasState.current) setNoTable(true);
                }, NO_TABLE_AFTER_MS);
            }
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
    }, [username, search]);

    useEffect(() => {
        closedByUs.current = false;
        void connect();

        return () => {
            closedByUs.current = true;
            // Back to the games while the table fills: the seat is given up,
            // so the player is free to play something else.
            if (waiting.current || searchWhenConnected.current || asked.current) {
                waiting.current = false;
                searchWhenConnected.current = false;
                asked.current = false;
                belotService.leave().catch(() => undefined);
            }
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            if (noTableRef.current) clearTimeout(noTableRef.current);
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

    return { state, isConnected, noTable, searching, startSearch, unavailable };
}
