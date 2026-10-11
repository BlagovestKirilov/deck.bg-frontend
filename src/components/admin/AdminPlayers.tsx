import React, { useEffect, useState } from 'react';
import { adminService } from '../../api/adminService';
import { isSessionExpired } from '../../api/apiClient';
import { AccountRole, AdminPlayerPage, AdminPlayerRow, PlayerQuery, PlayerSort, Scope } from '../../types/admin.types';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Note from '../ui/Note';
import Select from '../ui/Select';
import AdminPlayerSheet from './AdminPlayerSheet';

/** Long enough to let a name be typed, short enough to feel like it answers. */
const SEARCH_DELAY_MS = 280;

const ROLES: { value: AccountRole | ''; label: string }[] = [
    { value: '', label: 'Всички роли' },
    { value: 'USER', label: 'Играч' },
    { value: 'ADMIN', label: 'Админ' },
];

const ACCESS: { value: Scope | ''; label: string }[] = [
    { value: '', label: 'Всеки достъп' },
    { value: 'PUBLIC', label: 'Обикновен' },
    { value: 'BETA', label: 'Тест достъп' },
];

const ORDERS: { value: PlayerSort; label: string }[] = [
    { value: 'createdAt,desc', label: 'Най-нови' },
    { value: 'createdAt,asc', label: 'Най-стари' },
    { value: 'lastLoginAt,desc', label: 'Активни' },
    { value: 'username,asc', label: 'Име А–Я' },
    { value: 'username,desc', label: 'Име Я–А' },
];

const FIRST: PlayerQuery = { username: '', role: '', scope: '', sort: 'createdAt,desc', page: 0 };

function players(count: number): string {
    return count === 1 ? '1 играч' : `${count} играчи`;
}

/**
 * Every player, a page at a time — newest first until another order is
 * chosen — narrowed by part of the username, by role and by access. Opening
 * a player shows everything each game knows about them, in a sheet.
 */
const AdminPlayers: React.FC = () => {
    const [name, setName] = useState('');
    const [query, setQuery] = useState<PlayerQuery>(FIRST);
    const [found, setFound] = useState<AdminPlayerPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [open, setOpen] = useState<string | null>(null);

    // The name is typed a letter at a time, so it reaches the query after a
    // pause; the drop-downs and the pages reach it at once. Any change but a
    // page goes back to the first page.
    useEffect(() => {
        const timer = setTimeout(() => {
            setQuery((current) => (current.username === name ? current : { ...current, username: name, page: 0 }));
        }, SEARCH_DELAY_MS);
        return () => clearTimeout(timer);
    }, [name]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        adminService.findPlayers(query, controller.signal)
            .then((page) => {
                setFound(page);
                setFailed(false);
                setLoading(false);
            })
            .catch((error) => {
                if (controller.signal.aborted) return;
                setLoading(false);
                if (!isSessionExpired(error)) setFailed(true);
            });
        return () => controller.abort();
    }, [query]);

    const narrow = (change: Partial<PlayerQuery>) => setQuery((current) => ({ ...current, ...change, page: 0 }));
    const filtered = Boolean(query.username || query.role || query.scope);

    const clear = () => {
        setName('');
        setQuery((current) => ({ ...FIRST, sort: current.sort }));
    };

    const replace = (row: AdminPlayerRow) => setFound((page) => page && {
        ...page,
        players: page.players.map((player) => (player.username === row.username ? row : player)),
    });

    return (
        <>
            <div className="admin-filters">
                <div className="admin-filters__name">
                    <Field
                        label="Потребителско име"
                        type="search"
                        placeholder="Част от името"
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                    />
                </div>
                <Select label="Роля" options={ROLES} value={query.role} onChange={(role) => narrow({ role })} />
                <Select label="Достъп до игрите" options={ACCESS} value={query.scope} onChange={(scope) => narrow({ scope })} />
                <Select label="Подреди" options={ORDERS} value={query.sort} onChange={(sort) => narrow({ sort })} />
            </div>

            {failed && (
                <Note tone="error" className="admin__note">Списъкът не се зареди. Провери връзката и опитай пак.</Note>
            )}

            {!found && !failed ? (
                <ul className="admin-players" aria-busy="true">
                    {[0, 1, 2].map((row) => (
                        <li key={row} className="admin-player admin-player--ghost">
                            <span className="skeleton admin-player__ghost-name" />
                            <span className="skeleton admin-player__ghost-email" />
                        </li>
                    ))}
                </ul>
            ) : found && found.total === 0 ? (
                <div className="admin-empty">
                    {filtered ? (
                        <>
                            <p>Никой играч не отговаря на тези филтри.</p>
                            <Button variant="secondary" size="sm" onClick={clear}>Изчисти филтрите</Button>
                        </>
                    ) : (
                        <p>Още няма регистрирани играчи.</p>
                    )}
                </div>
            ) : found && (
                <>
                    <p className="admin-count" aria-live="polite">
                        <span>{players(found.total)}</span>
                        {filtered && (
                            <Button variant="link" size="sm" onClick={clear}>Изчисти филтрите</Button>
                        )}
                    </p>
                    <ul className={`admin-players${loading ? ' admin-players--loading' : ''}`} aria-busy={loading}>
                        {found.players.map((player) => (
                            <li key={player.username}>
                                <button type="button" className="admin-player" onClick={() => setOpen(player.username)}>
                                    <span className="admin-player__who">
                                        <span className="admin-player__name">{player.username}</span>
                                        <span className="admin-player__email">{player.email}</span>
                                    </span>
                                    <PlayerMarks player={player} />
                                </button>
                            </li>
                        ))}
                    </ul>

                    {found.totalPages > 1 && (
                        <nav className="admin-pager" aria-label="Страници на списъка">
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="arrowLeft"
                                disabled={found.page === 0 || loading}
                                onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
                            >
                                Предишна
                            </Button>
                            <span className="admin-pager__where">
                                Страница {found.page + 1} от {found.totalPages}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                iconAfter="arrowRight"
                                disabled={found.page + 1 >= found.totalPages || loading}
                                onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
                            >
                                Следваща
                            </Button>
                        </nav>
                    )}
                </>
            )}

            {open && (
                <AdminPlayerSheet
                    username={open}
                    onClose={() => setOpen(null)}
                    onChanged={replace}
                />
            )}
        </>
    );
};

/**
 * What sets a player apart from the rest: an admin, early access, an email not
 * yet confirmed. Most players have none, and then nothing is drawn at all.
 * `email={false}` and `access={false}` leave those out, where the screen
 * already says them another way.
 */
export const PlayerMarks: React.FC<{ player: AdminPlayerRow; email?: boolean; access?: boolean }> = ({
    player,
    email = true,
    access = true,
}) => {
    const admin = player.role === 'ADMIN';
    const beta = access && player.scope === 'BETA';
    const unconfirmed = email && !player.emailConfirmed;
    if (!admin && !beta && !unconfirmed) return null;
    return (
        <span className="admin-marks">
            {admin && <span className="admin-mark admin-mark--admin">Админ</span>}
            {beta && <span className="admin-mark admin-mark--beta">Тест достъп</span>}
            {unconfirmed && <span className="admin-mark admin-mark--unconfirmed">Непотвърден имейл</span>}
        </span>
    );
};

export default AdminPlayers;
