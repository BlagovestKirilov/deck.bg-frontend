import React from 'react';
import { BelotDeclarationKind, BelotSeatName, BelotState } from '../../types/belot.types';

/**
 * What each one is called out as at a table.
 *
 * Not the textbook names: a Bulgarian table says терца, 50, 100, каре and
 * белот, and those are what a player is listening for. The lengths of the
 * sequences are how the engine thinks about them, not how anyone says them.
 */
const KIND_WORD: Record<BelotDeclarationKind, string> = {
    TERZ: 'Терца',
    QUARTE: '50',
    QUINTE: '100',
    CARRE: 'Каре',
    BELOTE: 'Белот',
};

/**
 * Who announced what, in the order the server listed it.
 *
 * Kept per seat rather than as one list, because an announcement belongs to
 * the player who made it: it is said out loud and the table hears it from
 * that chair.
 */
export function announcementsBySeat(state: BelotState): Map<BelotSeatName, string[]> {
    const bySeat = new Map<BelotSeatName, string[]>();

    state.declarations?.shown.forEach((declaration) => {
        const said = bySeat.get(declaration.seat) ?? [];
        said.push(KIND_WORD[declaration.kind]);
        bySeat.set(declaration.seat, said);
    });

    return bySeat;
}

/**
 * What one seat announced, next to that seat.
 *
 * Only what was said — "терца", not "терца in diamonds up to the king, worth
 * twenty, cancelled". At a table you announce that you have one and the table
 * takes your word for it; which of two terces is the better one is settled
 * when the cards are down, and the sheet has it afterwards. Showing the
 * winner mid-hand gave away both the answer and the cards behind it.
 */
const Announced: React.FC<{ said?: string[] }> = ({ said }) => {
    if (!said || said.length === 0) {
        return null;
    }

    // One bubble for everything said in the same breath, keyed on what it
    // says, so a second announcement pops in fresh rather than changing the
    // words inside a bubble that is already fading.
    const words = said.join(' + ');
    return (
        <span key={words} className="belot__said belot__said--announce" role="status">
            {words}
        </span>
    );
};

export default Announced;
