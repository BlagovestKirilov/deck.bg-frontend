import { useCallback, useEffect, useState } from 'react';
import { CheckerColor } from '../types/tabla.types';

const KEY = 'tabla_checker_color';

/**
 * Which colour this player's own checkers are drawn in.
 *
 * The game itself is unaffected: the server still calls the first player WHITE
 * and the second BLACK, and every move is sent in the mover's own frame. This
 * only decides how the two sides are painted on this device, so both players
 * can choose white and each still sees their own checkers white and their
 * opponent's black.
 *
 * Stored per device. `localStorage` can throw outright in a private window or
 * with site data blocked, so every access is guarded and the default stands.
 */
export function useCheckerColor(): [CheckerColor, (next: CheckerColor) => void] {
    const [color, setColor] = useState<CheckerColor>(() => {
        try {
            return localStorage.getItem(KEY) === 'black' ? 'black' : 'white';
        } catch {
            return 'white';
        }
    });

    // Keep other tabs in step; a player may have the table open twice.
    useEffect(() => {
        const onStorage = (event: StorageEvent) => {
            if (event.key !== KEY) return;
            setColor(event.newValue === 'black' ? 'black' : 'white');
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const choose = useCallback((next: CheckerColor) => {
        setColor(next);
        try {
            localStorage.setItem(KEY, next);
        } catch {
            // A per-device convenience; losing it costs nothing.
        }
    }, []);

    return [color, choose];
}
