import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { REACTIONS, ReactionCode, nextReactionAt, reactionOf } from '../../utils/reactions';
import { ShownReaction } from '../../hooks/useReactionFeed';

/**
 * Where the button stands: in the column of the table's way out (the round
 * button marked data-exit, top right at every table), as far from the bottom
 * as that one is from the top. Measured, because a table may be a centred
 * column on a wide screen (табла) or span it (santase): the screen's own
 * corner was a long way from the X there. Null where there is no X to line
 * up with; the stylesheet's corner holds then.
 */
function underTheExit(own: HTMLElement | null): React.CSSProperties | null {
    const exit = document.querySelector<HTMLElement>('[data-exit]');
    if (!exit || !own) return null;
    const x = exit.getBoundingClientRect();
    if (x.width === 0) return null;
    const ownBox = own.getBoundingClientRect();
    const width = ownBox.width || x.width;
    const height = ownBox.height || x.height;
    const right = window.innerWidth - (x.left + x.width / 2) - width / 2;
    let bottom = Math.max(0, x.top);

    // Never on a player's cards: a hand the table marked data-reaction-avoid
    // (belot's eight on a phone run to the edge) pushes the button up to sit
    // just above it, in the same column.
    const left = window.innerWidth - right - width;
    document.querySelectorAll<HTMLElement>('[data-reaction-avoid]').forEach((element) => {
        const cards = cardsOf(element);
        if (!cards) return;
        const top = window.innerHeight - bottom - height;
        const overlaps = left < cards.right && left + width > cards.left
            && top < cards.bottom && top + height > cards.top;
        if (overlaps) bottom = Math.max(bottom, window.innerHeight - cards.top + AVOID_GAP_PX);
    });
    return { right: Math.round(right), bottom: Math.round(bottom) };
}

/** The room left between the button and a hand it has stepped up over. */
const AVOID_GAP_PX = 8;

/**
 * The round button under the table's way out, and the tray it opens: the
 * reactions as pictures, one tap to send. Closes on a pick, on Escape and
 * on a tap anywhere else.
 *
 * It rests after each send — dimmed and not pressable — for as long as the
 * server would drop the next one: a moment between two, and longer after a
 * burst. Nobody can flood the table, and nobody taps into silence.
 */
export const ReactionButton: React.FC<{
    onSend: (code: ReactionCode) => void;
}> = ({ onSend }) => {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const [place, setPlace] = useState<React.CSSProperties | null>(null);

    // Follow the X: on every render of the table around it, on a resize, and
    // when the X's own row changes size. Only a change is stored, so this
    // settles at once.
    useLayoutEffect(() => {
        const follow = () => setPlace((was) => {
            const next = underTheExit(box.current);
            return was?.right === next?.right && was?.bottom === next?.bottom ? was : next;
        });
        follow();
        window.addEventListener('resize', follow);
        const row = document.querySelector<HTMLElement>('[data-exit]')?.parentElement;
        const watch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(follow) : null;
        if (row) watch?.observe(row);
        // A hand growing to eight, or shrinking as it is played, moves it too.
        document.querySelectorAll<HTMLElement>('[data-reaction-avoid]').forEach((hand) => watch?.observe(hand));
        return () => {
            window.removeEventListener('resize', follow);
            watch?.disconnect();
        };
    });
    const sentAt = useRef<number[]>([]);
    const [resting, setResting] = useState(false);
    const restTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(restTimer.current), []);

    const send = (code: ReactionCode) => {
        const now = Date.now();
        sentAt.current = [...sentAt.current, now].slice(-10);
        onSend(code);
        setOpen(false);
        const wait = nextReactionAt(sentAt.current, Date.now()) - Date.now();
        if (wait > 0) {
            setResting(true);
            window.clearTimeout(restTimer.current);
            restTimer.current = window.setTimeout(() => setResting(false), wait);
        }
    };

    useEffect(() => {
        if (!open) return undefined;
        const away = (event: PointerEvent) => {
            if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', away);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', away);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    return (
        <div className="reaction-anchor" ref={box} style={place ?? undefined}>
            <button
                type="button"
                className="round-btn round-btn--quiet"
                aria-label="Реакции"
                aria-expanded={open}
                disabled={resting}
                onClick={() => setOpen((shown) => !shown)}
            >
                <Icon name="smile" size={20} />
            </button>
            {open && (
                <div className="reaction-tray" role="menu" aria-label="Изпрати реакция">
                    {REACTIONS.map((reaction) => (
                        <button
                            key={reaction.code}
                            type="button"
                            role="menuitem"
                            className="reaction-tray__pick"
                            aria-label={reaction.label}
                            onClick={() => send(reaction.code)}
                        >
                            <Glyph code={reaction.code} emoji={reaction.emoji} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

/**
 * A reaction's picture. The emoji, except the red card: 🟥 is a rounded
 * pink square on most phones and reads as nothing, so the card a referee
 * holds up is drawn instead.
 */
const Glyph: React.FC<{ code: ReactionCode; emoji: string }> = ({ code, emoji }) =>
    code === 'RED_CARD'
        ? <span className="red-card-glyph" aria-hidden="true" />
        : <span aria-hidden="true">{emoji}</span>;

/** Where a player sits on this screen, as far as a reaction is concerned. */
export type ReactionPlace = 'top' | 'bottom' | 'left' | 'right';

/** The gap between a player's name and their reaction. */
const BESIDE_PX = 10;

/** Room a reaction needs beside something: the picture at its largest. */
const POP_PX = 64;

/** The box round an element's children — the cards in a hand row. */
function cardsOf(element: HTMLElement): { left: number; right: number; top: number; bottom: number } | null {
    const boxes = [...element.children]
        .map((child) => child.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0);
    if (boxes.length === 0) return null;
    return {
        left: Math.min(...boxes.map((box) => box.left)),
        right: Math.max(...boxes.map((box) => box.right)),
        top: Math.min(...boxes.map((box) => box.top)),
        bottom: Math.max(...boxes.map((box) => box.bottom)),
    };
}

/**
 * Where a reaction goes: next to the element the game marked with
 * data-reaction-anchor for its sender — that player's name, wherever this
 * screen draws it. Beside it, towards the middle, for a player at either
 * edge; below it for one at the top; above it for one at the bottom.
 */
function besideTheirName(username: string): React.CSSProperties | null {
    const anchor = [...document.querySelectorAll<HTMLElement>('[data-reaction-anchor]')]
        .find((element) => element.dataset.reactionAnchor === username);
    if (!anchor) return null;
    const box = anchor.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) return null;

    const middleX = box.left + box.width / 2;
    const middleY = box.top + box.height / 2;
    const width = window.innerWidth;
    // A seat drawn as a hand of cards (santase) asks for the side outright:
    // to the right of the cards themselves — not of a row that may span the
    // screen — level with them. Where the cards reach the edge, as on a
    // phone, the picture sits on the hand's corner instead: under the cards
    // across the table, over your own.
    if (anchor.dataset.reactionSide === 'right') {
        const cards = cardsOf(anchor) ?? box;
        const level = (cards.top + cards.bottom) / 2;
        if (cards.right + BESIDE_PX + POP_PX <= width) {
            return { left: cards.right + BESIDE_PX, top: level, translate: '0 -50%' };
        }
        return level < window.innerHeight / 2
            ? { left: cards.right, top: cards.bottom + BESIDE_PX, translate: '-100% 0' }
            : { left: cards.right, top: cards.top - BESIDE_PX, translate: '-100% -100%' };
    }
    if (middleX < width / 3) {
        return { left: box.right + BESIDE_PX, top: middleY, translate: '0 -50%' };
    }
    if (middleX > (width * 2) / 3) {
        return { left: box.left - BESIDE_PX, top: middleY, translate: '-100% -50%' };
    }
    return middleY < window.innerHeight / 2
        ? { left: middleX, top: box.bottom + BESIDE_PX, translate: '-50% 0' }
        : { left: middleX, top: box.top - BESIDE_PX, translate: '-50% -100%' };
}

/**
 * The reactions in the air: each a picture popping up beside the name of
 * whoever sent it, and fading. Pictures only; a screen reader hears who sent
 * what, quietly. Where the name cannot be found, the rough side of the
 * table it sits on is used instead.
 */
export const ReactionLayer: React.FC<{
    shown: ShownReaction[];
    placeOf: (username: string) => ReactionPlace | undefined;
}> = ({ shown, placeOf }) => createPortal(
    // At the root of the page, over every table's own stacking and blur:
    // drawn inside a bar, a fixed layer is placed by that bar instead.
    <div className="reaction-layer" aria-live="polite">
        {shown.map((each) => {
            const reaction = reactionOf(each.reaction);
            if (!reaction) return null;
            const beside = besideTheirName(each.from);
            const place = placeOf(each.from);
            if (!beside && !place) return null;
            return (
                <span
                    key={each.id}
                    className={beside ? 'reaction-pop' : `reaction-pop reaction-pop--${place}`}
                    style={beside ?? undefined}
                >
                    <Glyph code={reaction.code} emoji={reaction.emoji} />
                    <span className="sr-only">{`${each.from}: ${reaction.label}`}</span>
                </span>
            );
        })}
    </div>,
    document.body,
);
