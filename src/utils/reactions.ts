/**
 * What a player can send the table instead of words: the same fixed set the
 * server accepts (bg.deck.common.enums.Reaction), each drawn as an emoji.
 * Shown as pictures only — the words are for screen readers.
 *
 * Emoji are content here, something a player says, not icons; the button
 * that opens them is an icon like any other.
 */
export type ReactionCode =
    | 'THUMBS_UP' | 'CLAP' | 'LAUGH' | 'WOW' | 'SAD' | 'ANGRY' | 'LUCK' | 'RED_CARD' | 'MOUSE';

export const REACTIONS: { code: ReactionCode; emoji: string; label: string }[] = [
    { code: 'THUMBS_UP', emoji: '👍', label: 'Браво' },
    { code: 'CLAP', emoji: '👏', label: 'Ръкопляскане' },
    { code: 'LAUGH', emoji: '😂', label: 'Смях' },
    { code: 'WOW', emoji: '😮', label: 'Изненада' },
    { code: 'SAD', emoji: '😢', label: 'Тъга' },
    { code: 'ANGRY', emoji: '😡', label: 'Ядосан' },
    { code: 'LUCK', emoji: '🍀', label: 'Късмет' },
    { code: 'RED_CARD', emoji: '🟥', label: 'Червен картон' },
    { code: 'MOUSE', emoji: '🐭', label: 'Мишка' },
];

/**
 * The server's limit, kept here too so the button rests rather than
 * sending what would be dropped: one every GAP_MS, BURST in any WINDOW_MS
 * (bg.deck.common.service.ReactionService).
 */
export const REACTION_GAP_MS = 1500;
export const REACTION_BURST = 6;
export const REACTION_WINDOW_MS = 30_000;

/** When this player may send the next one, given when they sent the last few. */
export function nextReactionAt(sentAt: number[], now: number): number {
    const recent = sentAt.filter((at) => now - at <= REACTION_WINDOW_MS);
    const afterGap = recent.length > 0 ? recent[recent.length - 1] + REACTION_GAP_MS : now;
    const afterBurst = recent.length >= REACTION_BURST
        ? recent[recent.length - REACTION_BURST] + REACTION_WINDOW_MS + 1
        : now;
    return Math.max(afterGap, afterBurst, now);
}

export const reactionOf = (code: ReactionCode) => REACTIONS.find((each) => each.code === code);

/** A reaction as the server sends it to everyone at the table. */
export interface ReactionMessage {
    from: string;
    reaction: ReactionCode;
}

/** The window event a game's socket turns each reaction into. */
export const REACTION_EVENT = 'deck:reaction';

/**
 * Listens for reactions on a game's socket, wherever it was opened: each
 * one becomes a window event, so the screens show them without each game's
 * socket code knowing how.
 */
export function subscribeReactions(
    client: { subscribe: (destination: string, callback: (message: { body: string }) => void) => unknown },
    username: string,
): void {
    client.subscribe(`/topic/reactions/${username}`, (message) => {
        try {
            const said = JSON.parse(message.body) as ReactionMessage;
            window.dispatchEvent(new CustomEvent<ReactionMessage>(REACTION_EVENT, { detail: said }));
        } catch {
            // A message we cannot read is a reaction nobody sees, nothing worse.
        }
    });
}
