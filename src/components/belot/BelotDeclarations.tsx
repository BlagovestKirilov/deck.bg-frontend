import React from 'react';
import { BelotDeclarationKind, BelotState, BelotTeam } from '../../types/belot.types';
import { ContractMark } from './ContractMark';

/** What each kind is called at a table. A carré is named after its rank. */
const KIND_WORD: Record<BelotDeclarationKind, string> = {
    TERZ: 'терца',
    QUARTE: 'квинта от четири',
    QUINTE: 'квинта',
    CARRE: 'каре',
    BELOTE: 'белот',
};

interface Props {
    state: BelotState;
    ourTeam: BelotTeam;
}

/**
 * What the table announced this deal.
 *
 * Shown from the first trick, which is when it is called out at a table.
 * Every announcement is listed even when it scores nothing, because a
 * sequence cancelled by a better one is the thing a player most wants to see
 * — a silent zero reads as the server having lost it.
 */
const BelotDeclarations: React.FC<Props> = ({ state, ourTeam }) => {
    const declarations = state.declarations;
    if (!declarations || declarations.shown.length === 0) {
        return null;
    }

    const ours = ourTeam === 'NORTH_SOUTH'
        ? declarations.northSouthPoints
        : declarations.eastWestPoints;
    const theirs = ourTeam === 'NORTH_SOUTH'
        ? declarations.eastWestPoints
        : declarations.northSouthPoints;

    return (
        <ul className="belot__announced">
            {declarations.shown.map((declaration) => {
                const who = state.seats.find((seat) => seat.seat === declaration.seat);
                const mine = who?.team === ourTeam;
                const counted = mine ? ours > 0 : theirs > 0;

                return (
                    <li
                        key={`${declaration.seat}-${declaration.kind}-${declaration.suit}`}
                        className={counted ? '' : 'is-cancelled'}
                    >
                        <ContractMark contract={declaration.suit} />
                        <span>{KIND_WORD[declaration.kind]}</span>
                        <span className="belot__announced-points">{declaration.points}</span>
                        <span className="belot__announced-who">{who?.username}</span>
                    </li>
                );
            })}
        </ul>
    );
};

export default BelotDeclarations;
