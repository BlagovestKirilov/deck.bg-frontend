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

/** How often the list is read again for who is here and who is playing. */
const REFRESH_MS = 30_000;
/** The wait before the hub's socket is opened again after it drops. */
const RECONNECT_MS = 5_000;
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
 * The hub's view of a player's friends: the list, read on opening, on every
 * event on their friends topic and every half minute; and a socket of the
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

    const refresh = useCallback(() => {
        friendService.page().then(take).catch(() => undefined);
    }, [take]);

    // While an invitation is out, the list is read every few seconds.
    const waitingFor = page?.outgoingChallenge?.id;
    useEffect(() => {
        if (!waitingFor) return undefined;
        const timer = window.setInterval(refresh, WAITING_REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [waitingFor, refresh]);

    useEffect(() => {
        if (!username) {
            // Signed out: nothing of the last player's is left on screen.
            setPage(null);
            outgoingRef.current = null;
            return undefined;
        }
        refresh();
        const timer = window.setInterval(refresh, REFRESH_MS);
        return () => window.clearInterval(timer);
    }, [username, refresh]);

    useEffect(() => {
        if (!username) return undefined;
        let closed = false;
        let client: ReturnType<typeof Stomp.over> | null = null;
        let retry: number | undefined;

        const open = async () => {
            const token = await socketToken();
            if (closed) return;
            const socket = new SockJS(`${API_BASE_URL}/ws-game`);
            client = Stomp.over(socket);
            client.reconnect_delay = 0;
            client.debug = () => undefined;
            socket.onclose = () => {
                if (!closed) retry = window.setTimeout(() => void open(), RECONNECT_MS);
            };
            client.connect({ Authorization: `Bearer ${token}` }, () => {
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
                // Read again once the socket is up: it is what shows this
                // player as here, and a challenge may have come meanwhile.
                refresh();
            }, () => undefined);
        };
        void open();

        return () => {
            closed = true;
            window.clearTimeout(retry);
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
