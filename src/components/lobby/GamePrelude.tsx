import React from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';

interface GamePreludeProps {
    title: string;
    /** How the game is won, in one line. */
    rule: string;
    /** The game's picture — the same one the hub shows, drawn larger. */
    Art: React.FC;
    isSearching: boolean;
    onStart: () => void;
    onBack: () => void;
    /** Anything the player settles before the clock starts (табла's checker colour). */
    children?: React.ReactNode;
    /** What the button finds. One opponent at the two-player games. */
    startLabel?: string;
    /** Said while the search is on. */
    searchingText?: string;
}

/**
 * The screen before a game: the game lying on the table, and one button that
 * finds someone to play.
 *
 * Shared by Сантасе, Табла and Белот so they cannot drift apart; everything
 * that differs between them comes in as props.
 */
const GamePrelude: React.FC<GamePreludeProps> = ({
    title, rule, Art, isSearching, onStart, onBack, children,
    startLabel = 'Намери противник', searchingText = 'Търсим противник…',
}) => (
    <div className="lobby prelude">
        <nav className="prelude__bar">
            <button type="button" className="btn btn--ghost btn--sm prelude__back" onClick={onBack}>
                <Icon name="arrowLeft" size={18} />
                Игри
            </button>
        </nav>

        <div className="prelude__body">
            <div className="prelude__art">
                <Art />
            </div>

            <h1 className="prelude__title">{title}</h1>
            <p className="prelude__rule">{rule}</p>

            {children}

            <Button
                variant="primary"
                size="lg"
                block
                loading={isSearching}
                onClick={onStart}
                className="prelude__start"
            >
                {startLabel}
            </Button>

            {/* Always rendered, so the line is reserved and nothing jumps when
                the search starts; empty until then. */}
            <p className="prelude__status" role="status">
                {isSearching ? searchingText : ''}
            </p>
        </div>
    </div>
);

export default GamePrelude;
