import React, { useState } from 'react';
import { adminService } from '../../api/adminService';
import { servicesService } from '../../api/servicesService';
import { AdminGameSwitch, Scope, ServiceState } from '../../types/admin.types';
import { GAMES } from '../lobby/gameCatalogue';
import Choice from '../ui/Choice';
import Icon from '../ui/Icon';
import Note from '../ui/Note';
import Switch from '../ui/Switch';
import ConfirmChange, { PendingChange } from './ConfirmChange';

const SCOPES: { value: Scope; label: string }[] = [
    { value: 'PUBLIC', label: 'Всички' },
    { value: 'BETA', label: 'Само бета' },
];

function stateLine(game: AdminGameSwitch): string {
    if (game.state === 'OFF') return 'Затворена. Нови игри не започват.';
    return game.requiredScope === 'PUBLIC' ? 'Отворена за всички играчи.' : 'Отворена само за бета тестерите.';
}

function titleOf(game: AdminGameSwitch): string {
    return GAMES.find((card) => card.key === game.code)?.title ?? game.code;
}

/** The question for switching a game on or off, naming the game. */
function switchChange(game: AdminGameSwitch, on: boolean, run: () => void): PendingChange {
    const title = titleOf(game);
    if (!on) {
        return {
            title: `Изключи ${title}?`,
            text: `Никой няма да може да започне нова игра на ${title}. Игрите, които вече се играят, се довършват.`,
            confirmLabel: 'Изключи',
            danger: true,
            run,
        };
    }
    return {
        title: `Включи ${title}?`,
        text: game.requiredScope === 'PUBLIC'
            ? `${title} се отваря за всички играчи и те могат да започват нови игри.`
            : `${title} се отваря за бета тестерите. Обикновените играчи все още няма да я виждат.`,
        confirmLabel: 'Включи',
        run,
    };
}

/** The question for changing who sees a game, naming the game. */
function scopeChange(game: AdminGameSwitch, scope: Scope, run: () => void): PendingChange {
    const title = titleOf(game);
    const open = game.state === 'ON';
    if (scope === 'PUBLIC') {
        return {
            title: `Покажи ${title} на всички?`,
            text: open
                ? `Всички играчи ще виждат ${title} и ще могат да започват игри.`
                : `${title} е изключена. Когато я включиш, ще я виждат всички играчи.`,
            confirmLabel: 'Покажи',
            run,
        };
    }
    return {
        title: `Остави ${title} само за бета тестерите?`,
        text: open
            ? `Обикновените играчи вече няма да виждат ${title}. Игрите, които вече се играят, се довършват.`
            : `${title} е изключена. Когато я включиш, ще я виждат само бета тестерите.`,
        confirmLabel: 'Само за бета',
        danger: open,
        run,
    };
}

interface AdminGamesProps {
    games: AdminGameSwitch[];
    onChanged: (game: AdminGameSwitch) => void;
}

/**
 * The games, each as the hub draws it, with its switch and who sees it.
 *
 * A game that is switched off keeps its own picture, gone grey under a closed
 * sign: still plainly that game, plainly not open.
 * Nothing changes on a press alone — every switch asks first, naming the game
 * and what the players will see.
 */
const AdminGames: React.FC<AdminGamesProps> = ({ games, onChanged }) => {
    const [busy, setBusy] = useState<string | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const [pending, setPending] = useState<PendingChange | null>(null);

    const save = (game: AdminGameSwitch, state: ServiceState, requiredScope: Scope) => {
        setBusy(game.code);
        setFailed(null);
        adminService.setGame(game.code, state, requiredScope)
            .then((saved) => {
                onChanged(saved);
                // This browser's own idea of what is on offer, so the hub
                // shows the change without waiting for the next visit.
                servicesService.forget();
            })
            .catch(() => setFailed(`Промяната за ${titleOf(game)} не е запазена. Опитай отново.`))
            .finally(() => setBusy(null));
    };

    const cards = GAMES
        .map((card) => ({ card, game: games.find((game) => game.code === card.key) }))
        .filter((entry): entry is { card: typeof entry.card; game: AdminGameSwitch } => Boolean(entry.game));

    return (
        <>
            {failed && <Note tone="error" className="admin__note">{failed}</Note>}

            <ul className="admin-games">
                {cards.map(({ card, game }) => {
                    const on = game.state === 'ON';
                    const { Art } = card;
                    return (
                        <li key={game.code} className={`admin-game${on ? '' : ' admin-game--off'}`}>
                            <div className="admin-game__art" aria-hidden="true">
                                <Art />
                                {!on && (
                                    <span className="admin-game__closed">
                                        <Icon name="lock" /> Затворена
                                    </span>
                                )}
                            </div>

                            <div className="admin-game__body">
                                <h3 className="admin-game__name">{card.title}</h3>
                                <p className="admin-game__state">{stateLine(game)}</p>
                                <Switch
                                    label={`${card.title} е включена`}
                                    checked={on}
                                    onText="Включена"
                                    offText="Изключена"
                                    disabled={busy === game.code}
                                    onChange={(next) => setPending(switchChange(game, next,
                                        () => save(game, next ? 'ON' : 'OFF', game.requiredScope)))}
                                />
                                <Choice
                                    legend="Кой я вижда"
                                    options={SCOPES}
                                    value={game.requiredScope}
                                    disabled={busy === game.code}
                                    onChange={(scope) => setPending(scopeChange(game, scope,
                                        () => save(game, game.state, scope)))}
                                />
                            </div>
                        </li>
                    );
                })}
            </ul>

            {pending && <ConfirmChange change={pending} onClose={() => setPending(null)} />}
        </>
    );
};

export default AdminGames;
