import React from 'react';
import { BelotAnnouncement, BelotDeclarationView, BelotRank } from '../../types/belot.types';
import Choice from '../ui/Choice';

/** A carré by what it is four of, the way it is said at the table. */
const CARRE_OF: Partial<Record<BelotRank, string>> = {
    JACK: 'Каре от валета',
    NINE: 'Каре от деветки',
    ACE: 'Каре от аса',
    TEN: 'Каре от десетки',
    KING: 'Каре от попове',
    QUEEN: 'Каре от дами',
};

function declarationWord(declaration: BelotDeclarationView): string {
    switch (declaration.kind) {
        case 'TERZ': return 'терца';
        case 'QUARTE': return 'кварта';
        case 'QUINTE': return 'квинта';
        case 'CARRE': return CARRE_OF[declaration.topRank] ?? 'Каре';
        case 'BELOTE': return 'белот';
    }
}

/** "Каре от десетки + терца (120)", or "Нищо" for announcing nothing. */
function label(option: BelotAnnouncement): string {
    if (option.declarations.length === 0) return 'Нищо';
    const words = option.declarations.map(declarationWord).join(' + ');
    const points = option.declarations.reduce((sum, declaration) => sum + declaration.points, 0);
    return `${words.charAt(0).toUpperCase()}${words.slice(1)} (${points})`;
}

/**
 * What is said with the card about to be played, on the felt above your
 * name, in one panel and one style: with the first card, which way to
 * announce the hand (the richest chosen already); and, once a card that
 * would say a belote has been tapped, whether to say it — both rows at once
 * when that card is the first. Picking a белот answer plays the card.
 */
export const SayPanel: React.FC<{
    announcements: BelotAnnouncement[];
    announce: string | null;
    onAnnounce: (key: string) => void;
    /** Set while a belote card is waiting to be played. */
    onBelote?: (sayIt: boolean) => void;
}> = ({ announcements, announce, onAnnounce, onBelote }) => (
    <div className="belot__announce">
        {announcements.length > 0 && announce && (
            <Choice
                legend="Обявяваш"
                options={announcements.map((option) => ({ value: option.key, label: label(option) }))}
                value={announce}
                onChange={onAnnounce}
            />
        )}
        {onBelote && (
            // Answers rather than a setting: either one plays the card, so
            // neither is shown as already chosen.
            <fieldset className="choice">
                <legend className="choice__legend">Белот</legend>
                <div className="choice__options">
                    <button type="button" className="choice__option" onClick={() => onBelote(true)}>
                        Белот (20)
                    </button>
                    <button type="button" className="choice__option" onClick={() => onBelote(false)}>
                        Без белот
                    </button>
                </div>
            </fieldset>
        )}
    </div>
);
