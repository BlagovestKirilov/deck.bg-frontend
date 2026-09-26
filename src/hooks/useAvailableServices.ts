import { useCallback, useEffect, useState } from 'react';
import { servicesService } from '../api/servicesService';
import { GameKey } from '../types/user.types';

/**
 * The games on offer, kept current enough.
 *
 * Fetched when the screen appears and again when the tab comes back into view —
 * the two moments a player is about to look at the list. There is no timer: a
 * lobby polling in the background would spend requests to shorten a window that
 * costs nothing, because a game that has just been switched off answers 404 the
 * moment somebody tries to start it.
 *
 * Starts from whatever this browser saw last, so the cards do not flicker on a
 * reload, and falls back to showing everything if there is nothing to go on —
 * the server is the one that refuses.
 */
export function useAvailableServices(): { services: GameKey[] | null; refresh: () => void } {
    const [services, setServices] = useState<GameKey[] | null>(servicesService.lastKnown);

    const load = useCallback((signal?: AbortSignal) => {
        servicesService
            .available(signal)
            .then((available) => {
                if (!signal?.aborted) setServices(available);
            })
            .catch(() => {
                // An older server, or none reachable: keep what we had rather
                // than empty the lobby over a failed request.
            });
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);

        const onVisible = () => {
            if (document.visibilityState === 'visible') load();
        };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            controller.abort();
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [load]);

    return { services, refresh: () => load() };
}
