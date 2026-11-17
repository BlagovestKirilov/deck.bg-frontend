import React from 'react';
import TurnBar from './TurnBar';

interface ClockChipProps {
    /** Seconds left on your move. */
    seconds: number;
    /** A full move, in seconds: a full fuse. */
    total: number;
    /** From how many seconds left it turns red. */
    urgentSeconds: number;
    /** Whose time it is, for a screen reader. */
    label?: string;
}

/**
 * Your own move's time at a two-player table: a chip of the card stock the
 * 66 is cut from, its seconds in figures and a gold fuse burning down beside
 * them, red in the last seconds. Shown only while the move is yours — santase
 * and табла alike. The opponent's time stays a thin bar by their side.
 */
const ClockChip: React.FC<ClockChipProps> = ({ seconds, total, urgentSeconds, label }) => (
    <span className={`clock-chip ${seconds <= urgentSeconds ? 'is-urgent' : ''}`}>
        <span className="clock-chip__count tabular" aria-hidden="true">{seconds}</span>
        <TurnBar
            className="clock-chip__fuse"
            startedAt={null}
            deadline={null}
            fraction={seconds / Math.max(1, total)}
            seconds={seconds}
            urgentSeconds={urgentSeconds}
            label={label}
        />
    </span>
);

export default ClockChip;
