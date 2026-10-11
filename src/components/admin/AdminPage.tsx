import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { adminService } from '../../api/adminService';
import { isSessionExpired } from '../../api/apiClient';
import { AdminGameSwitch } from '../../types/admin.types';
import Brand from '../ui/Brand';
import Button from '../ui/Button';
import Note from '../ui/Note';
import StatusScreen from '../ui/StatusScreen';
import AdminGames from './AdminGames';
import AdminPlayers from './AdminPlayers';
import '../../styles/admin.css';

type Status = 'loading' | 'ready' | 'forbidden' | 'failed';

/**
 * The admin page: which games are open and to whom, and the players.
 *
 * The same room as the hub — the felt, the header, the games drawn the same
 * way — so it reads as the other side of the table rather than a separate
 * tool. Whether it opens at all is the server's decision: it reads the role
 * from the database on every call, and a refusal here shows a refusal, not an
 * empty page.
 */
const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState<Status>('loading');
    const [games, setGames] = useState<AdminGameSwitch[]>([]);

    const load = useCallback((signal?: AbortSignal) => {
        setStatus('loading');
        adminService.games(signal)
            .then((found) => {
                setGames(found);
                setStatus('ready');
            })
            .catch((error) => {
                if (signal?.aborted) return;
                if (error?.response?.status === 403) setStatus('forbidden');
                else if (!isSessionExpired(error)) setStatus('failed');
            });
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
    }, [load]);

    if (status === 'forbidden') {
        return (
            <StatusScreen
                tone="warning"
                icon="shield"
                title="Само за администратори"
                message="Този профил няма достъп до тази страница."
                actionLabel="Към игрите"
                onAction={() => navigate('/')}
            />
        );
    }

    const changed = (game: AdminGameSwitch) =>
        setGames((list) => list.map((entry) => (entry.code === game.code ? game : entry)));

    return (
        <main className="screen screen--flow lobby" style={{ alignItems: 'flex-start' }}>
            <div className="hub admin">
                <nav className="hub-nav" aria-label="Админ">
                    <Brand home />
                    <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => navigate('/')}>
                        Към игрите
                    </Button>
                </nav>

                {/* The tabs say where the admin is; the page's name is for
                    the screen reader, not repeated above them. */}
                <h1 className="sr-only">Админ</h1>

                {/* One job at a time, each at an address of its own, so the
                    back button and a refresh land where the admin was. */}
                <nav className="admin-tabs" aria-label="Раздели">
                    <NavLink to="/admin/games" className="admin-tab">Игри</NavLink>
                    <NavLink to="/admin/players" className="admin-tab">Играчи</NavLink>
                </nav>

                {status === 'failed' && (
                    <div className="admin__section admin__retry">
                        <Note tone="error">Страницата не се зареди. Провери връзката и опитай пак.</Note>
                        <Button variant="secondary" onClick={() => load()}>Опитай пак</Button>
                    </div>
                )}

                {status !== 'failed' && (
                    <Routes>
                        <Route index element={<Navigate to="games" replace />} />
                        <Route
                            path="games"
                            element={
                                <section className="admin__section" aria-labelledby="admin-games">
                                    <h2 id="admin-games" className="sr-only">Игри</h2>
                                    <p className="admin__lead">
                                        Изключената игра спира новите маси, а започналите се довършват. Игра
                                        с тест достъп виждат само играчите, на които си го дал.
                                    </p>
                                    {status === 'ready' ? (
                                        <AdminGames games={games} onChanged={changed} />
                                    ) : (
                                        <ul className="admin-games" aria-busy="true">
                                            {[0, 1, 2].map((ghost) => (
                                                <li key={ghost} className="admin-game admin-game--ghost">
                                                    <span className="skeleton admin-game__ghost-art" />
                                                    <span className="skeleton admin-game__ghost-line" />
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            }
                        />
                        <Route
                            path="players"
                            element={
                                <section className="admin__section" aria-labelledby="admin-players">
                                    <h2 id="admin-players" className="sr-only">Играчи</h2>
                                    <p className="admin__lead">
                                        Търси по част от потребителското име и стесни списъка по роля и достъп.
                                        Отвори играч, за да видиш резултатите му и да му дадеш тест достъп.
                                    </p>
                                    {/* Only once the server has let this account in: the
                                        list is asked for after the games answer. */}
                                    {status === 'ready' && <AdminPlayers />}
                                </section>
                            }
                        />
                        <Route path="*" element={<Navigate to="/admin/games" replace />} />
                    </Routes>
                )}
            </div>
        </main>
    );
};

export default AdminPage;
