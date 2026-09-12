import { useLayoutEffect, useRef } from 'react';
import { BAR, Hop, OFF, Side } from '../types/tabla.types';

/** How long a checker takes to travel. The same for every hop, always. */
export const HOP_MS = 340;
/** Consecutive checkers in a stack overlap by 18%, so this is one stack step. */
const STACK_STEP = 0.82;

/** A hop identity, so the same list rendered twice is not replayed. */
export const hopKey = (h: Hop): string => `${h.from}>${h.to}:${h.die}`;

/**
 * Which canonical point a hop coordinate refers to.
 *
 * Hops travel in the *mover's* normalised frame, and both players are sent the
 * mover's pending hops — so the viewer has to convert from the mover's frame,
 * which is not always their own.
 */
export function toCanonical(point: number, moverSide: Side): number {
    if (point === BAR || point === OFF) return point;
    return moverSide === 'WHITE' ? point : 25 - point;
}

/** The element standing for a canonical point, the bar, or the off tray. */
function slotElement(board: HTMLElement, canonical: number): HTMLElement | null {
    if (canonical === BAR) return board.querySelector('.tabla-bar');
    if (canonical === OFF) return board.querySelector('.tabla-off');
    return board.querySelector(`[data-point="${canonical}"]`);
}

/**
 * Where the checker that just left this slot was sitting.
 *
 * Not simply the slot's centre. Checkers stack from the outer edge of a point
 * inward, so the one that left was a full step beyond whatever is still there —
 * and when the slot is now empty it was against the edge, not in the middle of
 * the triangle. Measuring the centre made the second hop of a combo start close
 * to its destination, so it flew a short distance and looked hurried while the
 * first hop crossed the board.
 */
function departedFrom(board: HTMLElement, slot: HTMLElement): { x: number; y: number } {
    const isPoint = slot.hasAttribute('data-point');
    const fromBottom = slot.classList.contains('tabla-point--bottom');
    const checkers = slot.querySelectorAll('.checker');
    const last = checkers[checkers.length - 1] as HTMLElement | undefined;

    if (last) {
        const r = last.getBoundingClientRect();
        const step = isPoint ? r.height * STACK_STEP : 0;
        return {
            x: r.left + r.width / 2,
            y: r.top + r.height / 2 + (fromBottom ? -step : step),
        };
    }

    const rect = slot.getBoundingClientRect();
    if (!isPoint) {
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    // Nothing left to measure against, so take the size from any checker still
    // on the board and place it against the point's outer edge.
    const any = board.querySelector('.checker');
    const d = any ? any.getBoundingClientRect().height : rect.width * 0.82;
    return {
        x: rect.left + rect.width / 2,
        y: fromBottom ? rect.bottom - d / 2 : rect.top + d / 2,
    };
}

/**
 * Slides a checker along the hop that just happened.
 *
 * FLIP rather than a flying copy: the checker is already in the DOM at its
 * destination by the time this runs, so it is drawn back at the origin and
 * released. Nothing is duplicated, and the board is never out of step with the
 * state it came from.
 *
 * Bearing off is not animated. The checker leaves the board for a tray that
 * holds a count rather than pieces, so there is no arriving element to slide.
 */
function slide(board: HTMLElement, hop: Hop, moverSide: Side): void {
    if (hop.to === OFF) return;

    const from = slotElement(board, toCanonical(hop.from, moverSide));
    const to = slotElement(board, toCanonical(hop.to, moverSide));
    if (!from || !to) return;

    const arrivals = to.querySelectorAll('.checker');
    const arrived = arrivals[arrivals.length - 1] as HTMLElement | undefined;
    if (!arrived) return;

    const start = departedFrom(board, from);
    const end = arrived.getBoundingClientRect();
    const dx = start.x - (end.left + end.width / 2);
    const dy = start.y - (end.top + end.height / 2);

    // Under a pixel apart is not a journey worth drawing.
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    arrived.style.transition = 'none';
    arrived.style.transform = `translate(${dx}px, ${dy}px)`;
    arrived.style.zIndex = '5';

    const release = () => {
        // Force the browser to take the origin as a real starting point.
        // requestAnimationFrame would do it too, but it does not fire while the
        // tab is in the background — and a checker frozen halfway across the
        // board is worse than no animation at all.
        void arrived.offsetWidth;
        arrived.style.transition = `transform ${HOP_MS}ms cubic-bezier(.22, .61, .36, 1)`;
        arrived.style.transform = 'translate(0, 0)';
        window.setTimeout(() => {
            arrived.style.transition = '';
            arrived.style.transform = '';
            arrived.style.zIndex = '';
        }, HOP_MS + 30);
    };

    release();
}

function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

/**
 * Slides checkers along each hop as it is played, on both screens.
 *
 * The server sends the mover's pending hops to both players and pushes after
 * every move, so the waiting player sees each hop arrive rather than finding
 * the position rearranged when the turn ends.
 *
 * Only what changed since the last render is drawn: hops added are played
 * forwards, hops taken back are played in reverse.
 *
 * The mover is remembered with them. Committing a turn empties the pending
 * list at the same moment as the turn changes hands, and an emptied list on its
 * own is indistinguishable from taking the last hop back — so without the mover
 * a confirmed turn was read as an undo. Worse, hops are expressed in the
 * mover's own frame, and that frame had already flipped to the other player, so
 * the coordinates were converted the wrong way round and some unrelated
 * checker — usually one of the opponent's — slid across the board.
 */
export function useHopAnimation(
    boardRef: React.RefObject<HTMLElement | null>,
    pendingHops: Hop[],
    moverSide: Side,
): void {
    const seen = useRef<{ hops: Hop[]; mover: Side }>({ hops: [], mover: moverSide });

    useLayoutEffect(() => {
        const previous = seen.current.hops;
        const sameTurn = seen.current.mover === moverSide;
        seen.current = { hops: pendingHops, mover: moverSide };

        // The turn changed hands. Whatever the pending list did, it was not a
        // move within a turn, and its hops no longer mean what they say.
        if (!sameTurn) return;

        if (prefersReducedMotion()) return;

        const board = boardRef.current;
        if (!board) return;

        const shorter = Math.min(previous.length, pendingHops.length);
        const sharedPrefix = previous.slice(0, shorter)
            .every((h, i) => hopKey(h) === hopKey(pendingHops[i]));
        // A list that changed its prefix is a different turn, not a move.
        if (!sharedPrefix) return;

        if (pendingHops.length > previous.length) {
            // Normally one hop arrives at a time. If two land in the same
            // update — the combo's second push catching the first — only the
            // last can be drawn honestly: the earlier hop's checker has already
            // moved on, so nothing sits where it landed any more.
            const added = pendingHops.slice(previous.length);
            slide(board, added[added.length - 1], moverSide);
            return;
        }

        if (pendingHops.length < previous.length) {
            // Върни. The checker is already back where it started, so it slides
            // in from where it had been — the same journey, run backwards.
            // Without this a move glided out and snapped back, which read as two
            // different kinds of event rather than one being undone.
            const undone = previous[pendingHops.length];
            slide(board, { ...undone, from: undone.to, to: undone.from }, moverSide);
        }
    }, [pendingHops, moverSide, boardRef]);
}
