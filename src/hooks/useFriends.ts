import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SockJS from 'sockjs-client';
import { Stomp } from '@stomp/stompjs';
import { socketToken } from '../api/apiClient';
import { friendService } from '../api/friendService';
import { gameService } from '../api/gameService';
import { tablaService } from '../api/tablaService';
import { ChallengeGame, ChallengeView, FriendEvent, FriendsResponse } from '../types/friends.types';

const API_BASE_URL = import.meta.env.VITE_API_URL;

/** The first wait before the friends socket is opened again after it drops; doubled each time after. */
const RECONNECT_MS = 5_000;
/** The longest wait between two attempts to open it again. */
const RECONNECT_MAX_MS = 60_000;
/** How long a connection has to stay up to count as good, and start the waits from the first again. */
const STABLE_MS = 30_000;
/** A (re)connection reads the list only when the last read is older than this. */
const READ_ON_CONNECT_AFTER_MS = 10_000;
/** How often the list is read while a game you invited somebody to waits for them. */
const WAITING_REFRESH_MS = 3_000;

/** Whether this player is now in a game of this kind: the answer is 200 when they are. */
const ACTIVE_GAME: Record<ChallengeGame, () => Promise<{ status: number }>> = {
    SANTASE: gameService.getActiveGame,
    TABLA: tablaService.getActiveGame,
};

/** Where each game is played. */
export const GAME_PATH: Record<ChallengeGame, string> = {
    SANTASE: '/play/santase',
    TABLA: '/play/tabla',
};

/** What a declined, cancelled or expired challenge says, briefly. */
function noticeFor(event: FriendEvent): string | null {
    const who = event.from ?? '';
    switch (event.type) {
        case 'CHALLENGE_DECLINED': return `${who} отказа поканата.`;
        case 'CHALLENGE_CANCELLED': return 'Поканата за игра беше оттеглена.';
        case 'CHALLENGE_EXPIRED': return 'Поканата за игра изтече.';
        case 'ACCEPTED': return `${who} прие поканата за приятелство.`;
        default: return null;
    }
}

export interface Friends {
    page: FriendsResponse | null;
    /** A short line about what just happened, for a toast. */
    notice: string | null;
    clearNotice: () => void;
    /** Runs a change and takes the page it answers with; its error text, if it fails. */
    act: (change: () => Promise<FriendsResponse>) => Promise<string | null>;
    acceptChallenge: (id: string) => Promise<string | null>;
}

/**
 * The hub's view of a player's friends: the list, read on opening and on every
 * event on their friends topic — a friend coming, going or sitting down at
 * a table among them —, never on a timer; and a socket of the
 * hub's own for that topic, which is also what shows them as here to their
 * friends. A challenge accepted on either side opens the game.
 */
export function useFriends(username: string): Friends {
    const navigate = useNavigate();
    const [page, setPage] = useState<FriendsResponse | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const navigateRef = useRef(navigate);
    navigateRef.current = navigate;

    // The invitation this player has out, as the last list read said. When it
    // is gone from the next — accepted, declined, run out — and they are now
    // in that game, the friend accepted it: off to the table. The socket says
    // so at once; this is for when its word does not arrive (a dropped
    // connection), so a player is never left waiting on a game already begun.
    const outgoingRef = useRef<ChallengeView | null>(null);
    const take = useCallback((next: FriendsResponse) => {
        const was = outgoingRef.current;
        outgoingRef.current = next.outgoingChallenge ?? null;
        setPage(next);
        if (was && !next.outgoingChallenge) {
            ACTIVE_GAME[was.game]()
                .then((answer) => { if (answer.status === 200) navigateRef.current(GAME_PATH[was.game]); })
                .catch(() => undefined);
        }
    }, []);

    // One read at a time: a read asked for while one is on its way is that
    // one. And the time of the last, so a reconnection does not read again
    // what was read a moment ago.
    const reading = useRef(false);
    const again = useRef(false);
    const lastRead = useRef(0);
    const refresh = useCallback(() => {
        // Asked for while a read is on its way: one more once it is back, so
        // news that came meanwhile is not lost — however many came, one read.
        if (reading.current) {
            again.current = true;
            return;
        }
        reading.current = true;
        lastRead.current = Date.now();
        friendService.page()
            .then(take)
            .catch(() => undefined)
            .finally(() => {
                reading.current = false;
                if (again.current) {
                    again.current = false;
                    refresh();
                }
            });
    }, [take]);

    // Whether the friends socket is up: while it is, news comes on it.
    const connected = useRef(false);

    // While an invitation is out, the list is read every few seconds.
    const waitingFor = page?.outgoingChallenge?.id;
    useEffect(() => {
        if (!waitingFor) return undefined;
        // A safety net only: while the socket is up, the friend's answer comes
        // on it; while it is down, the list is read until it is back.
        const timer = window.setInterval(() => {
            if (!connected.current && document.visibilityState === 'visible') refresh();
        }, WAITING_REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [waitingFor, refresh]);

    useEffect(() => {
        if (!username) {
            // Signed out: nothing of the last player's is left on screen.
            setPage(null);
            outgoingRef.current = null;
            return undefined;
        }
        // Read on opening, and again on coming back to a tab left in the
        // background. Nothing on a timer: who comes, goes or sits down at a
        // table is told on the friends socket, and the list is read then.
        refresh();
        const onShow = () => {
            if (document.visibilityState === 'visible') refresh();
        };
        document.addEventListener('visibilitychange', onShow);
        return () => document.removeEventListener('visibilitychange', onShow);
    }, [username, refresh]);

    useEffect(() => {
        if (!username) return undefined;
        let closed = false;
        let client: ReturnType<typeof Stomp.over> | null = null;
        let retry: number | undefined;
        let stable: number | undefined;
        // How many times in a row it has dropped: each wait twice the last,
        // up to a minute. A connection that is refused or dropped as soon as
        // it is made — the server turning the topic away — would otherwise be
        // made again every few seconds, forever, each time reading the list.
        let drops = 0;

        const open = async () => {
            const token = await socketToken();
            if (closed) return;
            const socket = new SockJS(`${API_BASE_URL}/ws-game`);
            client = Stomp.over(socket);
            client.reconnect_delay = 0;
            client.debug = () => undefined;
            // stompjs takes the socket's own onclose for itself when it
            // connects, so a handler set there was never called and a dropped
            // socket stayed dropped. Its own close callback is the one heard.
            client.onWebSocketClose = () => {
                connected.current = false;
                window.clearTimeout(stable);
                if (closed) return;
                const wait = Math.min(RECONNECT_MAX_MS, RECONNECT_MS * 2 ** drops);
                drops += 1;
                window.clearTimeout(retry);
                retry = window.setTimeout(() => void open(), wait);
            };
            client.connect({ Authorization: `Bearer ${token}` }, () => {
                connected.current = true;
                // Only a connection that stays up starts the waits over.
                stable = window.setTimeout(() => { drops = 0; }, STABLE_MS);
                client?.subscribe(`/topic/friends/${username}`, (message: { body: string }) => {
                    let event: FriendEvent;
                    try {
                        event = JSON.parse(message.body) as FriendEvent;
                    } catch {
                        return;
                    }
                    if (event.type === 'GAME_STARTED' && event.game && GAME_PATH[event.game]) {
                        navigateRef.current(GAME_PATH[event.game]);
                        return;
                    }
                    const said = noticeFor(event);
                    if (said) setNotice(said);
                    refresh();
                });
                // Read again once the socket is up — it is what shows this
                // player as here, and a challenge may have come meanwhile —
                // unless the list was read only a moment ago.
                if (Date.now() - lastRead.current > READ_ON_CONNECT_AFTER_MS) refresh();
            }, () => undefined);
        };
        void open();

        return () => {
            closed = true;
            connected.current = false;
            window.clearTimeout(retry);
            window.clearTimeout(stable);
            try {
                client?.disconnect(() => undefined);
            } catch {
                // Already gone.
            }
        };
    }, [username, refresh]);

    const act = useCallback(async (change: () => Promise<FriendsResponse>) => {
        try {
            take(await change());
            return null;
        } catch (error: any) {
            refresh();
            return error?.response?.data?.message ?? 'Нещо се обърка. Опитайте отново.';
        }
    }, [refresh, take]);

    const acceptChallenge = useCallback(async (id: string) => {
        try {
            const started = await friendService.acceptChallenge(id);
            navigateRef.current(GAME_PATH[started.game]);
            return null;
        } catch (error: any) {
            refresh();
            return error?.response?.data?.message ?? 'Нещо се обърка. Опитайте отново.';
        }
    }, [refresh]);

    return { page, notice, clearNotice: () => setNotice(null), act, acceptChallenge };
}
