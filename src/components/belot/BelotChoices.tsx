import React from 'react';
import { BelotAnnouncement, BelotDeclarationView, BelotRank, BelotSuit } from '../../types/belot.types';
import Button from '../ui/Button';

/** A carré by what it is four of, the way it is said at the table. */
const CARRE_OF: Partial<Record<BelotRank, string>> = {
    JACK: 'Каре валета',
    NINE: 'Каре деветки',
    ACE: 'Каре аса',
    TEN: 'Каре десетки',
    KING: 'Каре попове',
    QUEEN: 'Каре дами',
};

const NAME: Record<string, string> = { TERZ: 'Терца', QUARTE: 'Кварта', QUINTE: 'Квинта' };

/** 7 8 9 10 J Q K A: the order runs are read in. */
const NATURAL: BelotRank[] = ['SEVEN', 'EIGHT', 'NINE', 'TEN', 'JACK', 'QUEEN', 'KING', 'ACE'];
const GLYPH: Record<BelotRank, string> = {
    SEVEN: '7', EIGHT: '8', NINE: '9', TEN: '10', JACK: 'J', QUEEN: 'Q', KING: 'K', ACE: 'A',
};
const SUIT_SIGN: Record<BelotSuit, string> = { SPADES: '♠', HEARTS: '♥', DIAMONDS: '♦', CLUBS: '♣' };
const RUN_LENGTH: Record<string, number> = { TERZ: 3, QUARTE: 4, QUINTE: 5 };

/** One declaration's own key, as the server spells it: kind/suit/top card. */
export const keyOf = (declaration: BelotDeclarationView): string =>
    `${declaration.kind}/${declaration.suit ?? '-'}/${declaration.topRank}`;

/** The cards it is, the way they lie in the hand: "♥ 10 9 8", or "10 ♠♥♦♣" for a carré. */
const Cards: React.FC<{ declaration: BelotDeclarationView }> = ({ declaration }) => {
    if (declaration.kind === 'CARRE') {
        return (
            <span className="belot-declare__cards">
                {GLYPH[declaration.topRank]}{' '}
                <span className="belot-declare__suit belot-declare__suit--black">♠</span>
                <span className="belot-declare__suit belot-declare__suit--red">♥♦</span>
                <span className="belot-declare__suit belot-declare__suit--black">♣</span>
            </span>
        );
    }
    const top = NATURAL.indexOf(declaration.topRank);
    const length = RUN_LENGTH[declaration.kind] ?? 3;
    const ranks = NATURAL.slice(Math.max(0, top - length + 1), top + 1).reverse().map((rank) => GLYPH[rank]);
    const red = declaration.suit === 'HEARTS' || declaration.suit === 'DIAMONDS';
    return (
        <span className="belot-declare__cards">
            <span className={`belot-declare__suit belot-declare__suit--${red ? 'red' : 'black'}`}>
                {SUIT_SIGN[declaration.suit]}
            </span>{' '}
            {ranks.join(' ')}
        </span>
    );
};

/** One tickable line: the box, what it is called, and the cards it is. */
const Row: React.FC<{
    checked: boolean;
    onToggle: () => void;
    name: string;
    children?: React.ReactNode;
}> = ({ checked, onToggle, name, children }) => (
    <button type="button" role="checkbox" aria-checked={checked} className="belot-declare__row" onClick={onToggle}>
        <span className="belot-declare__box" aria-hidden="true">
            {checked && (
                <svg viewBox="0 0 24 24" width="18" height="18">
                    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3"
                          strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </span>
        <span className="belot-declare__name">{name}</span>
        {children}
    </button>
);

/**
 * What to say with the card about to be played, ticked off a list and
 * confirmed with "Продължи" — the announcements a hand may make with its
 * first card, and a belote with its own card, in one panel.
 *
 * Two announcements that would need the same card cannot both be ticked:
 * ticking one clears the other. Nothing ticked announces nothing. The turn's
 * clock keeps running the whole time: a player who never presses
 * "Продължи" is played for when it runs out, as anyone who lets it run out
 * is, so nobody can hold the table here.
 */
export const DeclarePanel: React.FC<{
    announcements: BelotAnnouncement[];
    ticked: Set<string>;
    onTick: (key: string) => void;
    /** Set while a card that would say a belote waits to be played. */
    belote?: { suit: BelotSuit; say: boolean; onToggle: () => void };
    onContinue: () => void;
}> = ({ announcements, ticked, onTick, belote, onContinue }) => {
    // Every declaration any way of reading the hand offers, once each,
    // the richest first.
    const seen = new Map<string, BelotDeclarationView>();
    announcements.forEach((option) => option.declarations.forEach((declaration) => {
        if (!seen.has(keyOf(declaration))) seen.set(keyOf(declaration), declaration);
    }));
    const items = [...seen.values()].sort((one, other) => other.points - one.points);

    return (
        <div className="belot-declare" role="group" aria-label="Избери обявяване">
            <p className="belot-declare__title">Избери обявяване</p>
            {items.map((declaration) => (
                <Row
                    key={keyOf(declaration)}
                    checked={ticked.has(keyOf(declaration))}
                    onToggle={() => onTick(keyOf(declaration))}
                    name={declaration.kind === 'CARRE'
                        ? CARRE_OF[declaration.topRank] ?? 'Каре'
                        : NAME[declaration.kind] ?? declaration.kind}
                >
                    <Cards declaration={declaration} />
                </Row>
            ))}
            {belote && (
                <Row checked={belote.say} onToggle={belote.onToggle} name="Белот">
                    <span className="belot-declare__cards">
                        <span className={`belot-declare__suit belot-declare__suit--${
                            belote.suit === 'HEARTS' || belote.suit === 'DIAMONDS' ? 'red' : 'black'}`}>
                            {SUIT_SIGN[belote.suit]}
                        </span>{' '}K Q
                    </span>
                </Row>
            )}
            <Button variant="gold" block onClick={onContinue}>Продължи</Button>
        </div>
    );
};
