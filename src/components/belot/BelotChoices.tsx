import React from 'react';
import { BelotAnnouncement, BelotCard, BelotDeclarationView, BelotRank, BelotSuit } from '../../types/belot.types';
import Button from '../ui/Button';
import Choice from '../ui/Choice';
import Modal from '../ui/Modal';

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
 * What to announce with the first card: the ways the hand can be read, the
 * richest first and chosen already, and "Нищо" for keeping it to yourself.
 * Shown on the felt above your name only while that first card is to be
 * played; the choice goes with the card.
 */
export const AnnounceChoice: React.FC<{
    options: BelotAnnouncement[];
    value: string;
    onChange: (key: string) => void;
}> = ({ options, value, onChange }) => (
    <div className="belot__announce">
        <Choice
            legend="Обявяваш с първата карта"
            options={options.map((option) => ({ value: option.key, label: label(option) }))}
            value={value}
            onChange={onChange}
        />
    </div>
);

const QUEEN_OR_KING: Partial<Record<BelotRank, string>> = { KING: 'попа', QUEEN: 'дамата' };
const SUIT_OF: Record<BelotSuit, string> = { SPADES: 'пика', HEARTS: 'купа', DIAMONDS: 'каро', CLUBS: 'спатия' };

/**
 * Asked when the card about to be played would say a belote: say it, or play
 * the card quietly so the table does not learn the other one is in your hand.
 * Closing it plays nothing.
 */
export const BeloteQuestion: React.FC<{
    card: BelotCard;
    onAnswer: (sayIt: boolean) => void;
    onCancel: () => void;
}> = ({ card, onAnswer, onCancel }) => (
    <Modal
        title="Белот?"
        width="narrow"
        className="belot sheet"
        onClose={onCancel}
        actions={
            <>
                <Button variant="ghost" onClick={() => onAnswer(false)}>Играй без белот</Button>
                <Button variant="gold" onClick={() => onAnswer(true)}>Играй с белот</Button>
            </>
        }
    >
        <p className="belot__belote-ask">
            Играеш {QUEEN_OR_KING[card.rank] ?? 'картата'} {SUIT_OF[card.suit]}. С белот печелиш 20 точки, но
            всички разбират, че другата карта е у теб. Без белот не можеш да го кажеш по-късно.
        </p>
    </Modal>
);
