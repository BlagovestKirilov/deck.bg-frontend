import { useEffect, useRef, useState } from 'react';
import { REACTION_EVENT, ReactionMessage } from '../utils/reactions';

/** How long a reaction stays up. */
export const REACTION_SHOWN_MS = 2600;

export interface ShownReaction extends ReactionMessage {
    id: number;
}

/**
 * The reactions on screen right now: each arrives from the socket, stays
 * for a moment and goes. A newer one from the same player replaces theirs,
 * so a player's chair never holds a stack.
 */
export function useReactionFeed(): ShownReaction[] {
    const [shown, setShown] = useState<ShownReaction[]>([]);
    const next = useRef(0);
    const timers = useRef<number[]>([]);

    useEffect(() => {
        const onReaction = (event: Event) => {
            const said = (event as CustomEvent<ReactionMessage>).detail;
            const id = ++next.current;
            setShown((before) => [...before.filter((each) => each.from !== said.from), { ...said, id }]);
            timers.current.push(window.setTimeout(
                () => setShown((before) => before.filter((each) => each.id !== id)), REACTION_SHOWN_MS));
        };
        window.addEventListener(REACTION_EVENT, onReaction);
        return () => {
            window.removeEventListener(REACTION_EVENT, onReaction);
            timers.current.forEach(window.clearTimeout);
        };
    }, []);

    return shown;
}
