import { useEffect, useState } from 'react';
import { BelotBidView, BelotState } from '../../types/belot.types';

/**
 * How long the table stays as the bidding left it before the hand goes on:
 * long enough to read the last "Пас" at the seat that said it, and the
 * auction around it, before cards start moving.
 */
export const AUCTION_HELD_MS = 1800;

/**
 * The table as it stood when the bidding closed, for a moment after.
 *
 * The pass that ends an auction never reaches the screen as a bid: the state
 * it brings is already the next stage — play, with the last three cards
 * dealt, or a fresh hand when all four passed. Everyone but the player who
 * passed saw the auction vanish and the cards arrive at once, and could not
 * tell what had happened.
 *
 * So the last state with the bidding open is shown a little longer, with the
 * pass added at the seat that was due to speak: an auction only ever closes
 * on a pass, said by whoever's turn it was. The hold carries no turn, so no
 * clock runs and nobody can act on it, and the deal runs from the real state
 * once it ends.
 *
 * Worked out while rendering rather than in an effect, so the next stage is
 * never drawn — not even for one frame, which would start its deal under the
 * held table.
 */
export function useAuctionHold(live: BelotState | null): BelotState | null {
    const [seen, setSeen] = useState(live);
    const [held, setHeld] = useState<BelotState | null>(null);

    if (live !== seen) {
        setSeen(live);
        const open = seen?.bidding;
        if (seen && open && live) {
            const contractMade = live.dealNumber === seen.dealNumber && live.dealStatus === 'PLAYING';
            const allPassed = live.dealNumber !== seen.dealNumber && live.dealStatus === 'BIDDING';
            if (contractMade || allPassed) {
                const last: BelotBidView = { seat: open.toAct, kind: 'PASS', contract: null };
                setHeld({ ...seen, turn: null, bidding: { ...open, said: [...open.said, last], yours: [] } });
            }
        }
    }

    useEffect(() => {
        if (!held) return;
        const release = window.setTimeout(() => setHeld(null), AUCTION_HELD_MS);
        return () => window.clearTimeout(release);
    }, [held]);

    return held ?? live;
}
