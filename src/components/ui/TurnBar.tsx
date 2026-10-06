import React, { useEffect, useState } from 'react';

interface TurnBarProps {
    /** When the turn began: an ISO moment from the server. */
    startedAt: string | null | undefined;
    /** When it runs out: an ISO moment from the server. */
    deadline: string | null | undefined;
    /** From how many seconds left the bar turns red. */
    urgentSeconds: number;
    /** Where the table puts it: placement only, the look is the bar's own. */
    className?: string;
    /** Whose time it is, for a screen reader. */
    label?: string;
}

/**
 * A turn's time, burning down from full to nothing — at every table, the same.
 *
 * A bar rather than a number: how much of the turn is left is read at a glance
 * from across the table, where a figure had to be read. Measured between two
 * moments the server sent, so it is right after a reload too, and refills on
 * its own when the server moves the deadline — a player pressing Continue.
 */
const TurnBar: React.FC<TurnBarProps> = ({ startedAt, deadline, urgentSeconds, className = '', label }) => {
    const [left, setLeft] = useState(1);
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    useEffect(() => {
        if (!startedAt || !deadline) return undefined;
        const start = new Date(startedAt).getTime();
        const end = new Date(deadline).getTime();
        const span = Math.max(1, end - start);
        const tick = () => {
            const remaining = end - Date.now();
            // A turn that has not begun yet — the table still showing the deal —
            // is a full bar, not more than one.
            setLeft(Math.min(1, Math.max(0, remaining / span)));
            setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
        };
        tick();
        // Four steps a second, each eased into by the fill's own transition,
        // reads as one smooth burn and still holds under reduced motion.
        const id = window.setInterval(tick, 250);
        return () => window.clearInterval(id);
    }, [startedAt, deadline]);

    if (!startedAt || !deadline) return null;
    const urgent = secondsLeft !== null && secondsLeft <= urgentSeconds;
    const spoken = secondsLeft === null ? undefined : `Остават ${secondsLeft} секунди`;

    return (
        <span
            className={`turnbar ${urgent ? 'is-urgent' : ''} ${className}`}
            role="timer"
            aria-label={label && spoken ? `${label}: ${spoken}` : spoken}
            // The same fraction for a table that draws the time as something
            // other than a bar: belot's ring round a player's plate.
            style={{ '--turn-left': left } as React.CSSProperties}
        >
            <span className="turnbar__fill" style={{ transform: `scaleX(${left})` }} />
        </span>
    );
};

export default TurnBar;
