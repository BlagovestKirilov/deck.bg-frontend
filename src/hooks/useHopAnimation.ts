import { useLayoutEffect, useRef } from 'react';
import { BAR, CheckerColor, Hop, OFF, Side } from '../types/tabla.types';

/** How long a checker takes to travel. The same for every hop, always. */
export const HOP_MS = 340;
/** Consecutive checkers in a stack overlap by 18%, so this is one stack step. */
const STACK_STEP = 0.82;

interface Point { x: number; y: number }

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
 * Flies a checker that has left, from where it stood to where it went.
 *
 * For an arrival the real element can be slid, but a departure has none: a
 * checker sent to the bar is gone from its point before this runs, and one
 * borne off goes to a tray that holds a count rather than pieces. A stand-in is
 * not a compromise here — there is nothing left to move, so nothing is
 * duplicated by flying a copy.
 *
 * Appended to the body, not the board: the board is a size container, which
 * makes it the containing block for fixed positioning, and the coordinates
 * here are the viewport's.
 */
function ghost(board: HTMLElement, start: Point, end: Point, color: CheckerColor): void {
    const sample = board.querySelector('.checker');
    const size = sample ? sample.getBoundingClientRect().width : 16;

    const el = document.createElement('span');
    el.className = `checker checker--${color}`;
    el.style.position = 'fixed';
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    // The stylesheet sizes checkers in container units, which mean nothing out
    // here; the measured size is the one that matches the board.
    el.style.maxWidth = 'none';
    el.style.left = `${start.x - size / 2}px`;
    el.style.top = `${start.y - size / 2}px`;
    el.style.zIndex = '6';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);

    void el.offsetWidth;
    el.style.transition = `transform ${HOP_MS}ms cubic-bezier(.22, .61, .36, 1),`
        + ` opacity ${HOP_MS}ms ease-in`;
    el.style.transform = `translate(${end.x - start.x}px, ${end.y - start.y}px)`;
    el.style.opacity = '0.15';

    window.setTimeout(() => el.remove(), HOP_MS + 80);
}

/** The middle of a slot, in viewport coordinates. */
function centreOf(el: HTMLElement): Point {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/**
 * Slides a checker along the hop that just happened.
 *
 * FLIP rather than a flying copy: the checker is already in the DOM at its
 * destination by the time this runs, so it is drawn back at the origin and
 * released. Nothing is duplicated, and the board is never out of step with the
 * state it came from.
 *
 * Bearing off, and a checker sent to the bar, are flown as stand-ins instead —
 * see {@link ghost}.
 */
function slide(board: HTMLElement, hop: Hop, moverSide: Side,
               moverColor: CheckerColor, victimColor: CheckerColor): void {
    const from = slotElement(board, toCanonical(hop.from, moverSide));
    const to = slotElement(board, toCanonical(hop.to, moverSide));
    if (!from) return;

    // Off the board: nothing arrives in the tray, so the checker is flown to it.
    if (hop.to === OFF) {
        const tray = board.querySelector<HTMLElement>('.tabla-off');
        if (tray) ghost(board, departedFrom(board, from), centreOf(tray), moverColor);
        return;
    }
    if (!to) return;

    // A checker taken on this square is on its way to the bar, and has already
    // gone from the point by the time this runs.
    if (hop.isHit) {
        const bar = board.querySelector<HTMLElement>('.tabla-bar');
        if (bar) ghost(board, centreOf(to), centreOf(bar), victimColor);
    }

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
    moverColor: CheckerColor,
    victimColor: CheckerColor,
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
            slide(board, added[added.length - 1], moverSide, moverColor, victimColor);
            return;
        }

        if (pendingHops.length < previous.length) {
            // Върни. The checker is already back where it started, so it slides
            // in from where it had been — the same journey, run backwards.
            // Without this a move glided out and snapped back, which read as two
            // different kinds of event rather than one being undone.
            const undone = previous[pendingHops.length];
            // Taking a hit back would have to bring a checker off the bar as
            // well; only the mover's own checker is retraced.
            slide(board, { ...undone, from: undone.to, to: undone.from, isHit: false },
                moverSide, moverColor, victimColor);
        }
    }, [pendingHops, moverSide, moverColor, victimColor, boardRef]);
}
