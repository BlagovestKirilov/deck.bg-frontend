import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { REACTIONS, ReactionCode, nextReactionAt, reactionOf } from '../../utils/reactions';
import { ShownReaction } from '../../hooks/useReactionFeed';

/**
 * The round button beside the sound switch, and the tray it opens: the
 * reactions as pictures, one tap to send. Closes on a pick, on Escape and
 * on a tap anywhere else.
 *
 * It rests after each send — dimmed and not pressable — for as long as the
 * server would drop the next one: a moment between two, and longer after a
 * burst. Nobody can flood the table, and nobody taps into silence.
 */
export const ReactionButton: React.FC<{
    onSend: (code: ReactionCode) => void;
    style?: React.CSSProperties;
}> = ({ onSend, style }) => {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);
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
        <div className="reaction-anchor" ref={box} style={style}>
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
