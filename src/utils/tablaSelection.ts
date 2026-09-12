import { Hop } from '../types/tabla.types';

/**
 * The one point every legal move starts from, or null when there is a choice.
 *
 * A checker on the bar has to come in before anything else moves, so every
 * legal hop starts there and choosing the origin decides nothing. The same
 * holds whenever a single point is the only one with a move left.
 */
export function soleOrigin(legalHops: Hop[]): number | null {
    if (legalHops.length === 0) return null;

    const first = legalHops[0].from;
    return legalHops.every((h) => h.from === first) ? first : null;
}

/** Whether a held origin still has anything to play. */
export function stillPlayable(origin: number | null, legalHops: Hop[]): boolean {
    return origin !== null && legalHops.some((h) => h.from === origin);
}
