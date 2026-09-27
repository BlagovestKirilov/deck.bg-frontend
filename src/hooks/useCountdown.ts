import { useEffect, useState } from 'react';

/**
 * Seconds left until a moment the server named, or null when there is none.
 *
 * Counts towards a timestamp rather than down from a duration. A phone that
 * locks stops running timers; on waking, a countdown resumes where it paused
 * and is wrong by however long the screen was off, while a clock that reads
 * the wall against a fixed instant is simply right again.
 */
export function useCountdown(deadline: string | null | undefined): number | null {
    const [left, setLeft] = useState<number | null>(null);

    useEffect(() => {
        if (!deadline) {
            setLeft(null);
            return undefined;
        }

        const target = new Date(deadline).getTime();
        const tick = () => setLeft(Math.max(0, Math.ceil((target - Date.now()) / 1000)));

        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [deadline]);

    return left;
}
