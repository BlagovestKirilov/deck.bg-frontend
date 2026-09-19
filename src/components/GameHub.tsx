import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { userService } from '../api/userService';
import { GameKey, GameStats } from '../types/user.types';
import { RankMedal, rankName } from './RankBadge';
import Brand from './ui/Brand';
import Button from './ui/Button';
import Modal from './ui/Modal';
import ProfilePage from './ProfilePage';
import { SantaseArt, TablaArt } from './lobby/GameArt';

interface GameCard {
    key: GameKey;
    title: string;
    /** How the game is won. The title says which game it is; this says what
     *  you are trying to do, which is the part a newcomer does not know. */
    tagline: string;
    Art: React.FC;
    path: string;
}

const GAMES: GameCard[] = [
    {
        key: 'SANTASE',
        title: 'Сантасе',
        tagline: 'Първият до 66 точки печели',
        Art: SantaseArt,
        path: '/play/santase',
    },
    {
        key: 'TABLA',
        title: 'Табла',
        tagline: 'Изведи всички пулове пръв',
        Art: TablaArt,
        path: '/play/tabla',
    },
];

/**
 * Picks a game. Deliberately a dumb picker: each game keeps its own lobby, so
 * adding табла moved no lines of the working Santase screen.
 */
const GameHub: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuthContext();
    const [showProfile, setShowProfile] = useState(false);
    const [confirmLogout, setConfirmLogout] = useState(false);
    const username = user?.username ?? '';

    // Each game is rated separately, so the picker shows the record for that
    // game rather than one account-wide number.
    const [stats, setStats] = useState<Partial<Record<GameKey, GameStats>> | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        userService
            .getProfile(controller.signal)
            .then((profile) => {
                if (!controller.signal.aborted) setStats(profile.stats ?? {});
            })
            .catch(() => {
                // A missing record just means the cards show no rank line; the
                // hub must still be usable offline or on an older server.
            });
        return () => controller.abort();
    }, []);

    // screen--flow, not the pinned .screen: the hub scrolls the document, which
    // is what lets a phone pull down to refresh.
    return (
        <main className="screen screen--flow lobby" style={{ alignItems: 'flex-start' }}>
            <div className="hub">
                <nav className="hub-nav" aria-label="Профил">
                    <Brand />
                    <div className="hub-nav__actions">
                        {/* The same component as Изход, so the two cannot drift
                            apart: one border, one height, one hover. */}
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="user"
                            onClick={() => setShowProfile(true)}
                            aria-label={`Отвори профила на ${username}`}
                        >
                            <span className="truncate" style={{ maxWidth: '12ch', fontWeight: 700 }}>
                                {username}
                            </span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            icon="logout"
                            className="btn--icon-on-phone"
                            onClick={() => setConfirmLogout(true)}
                            aria-label="Изход от профила"
                        >
                            Изход
                        </Button>
                    </div>
                </nav>

                <header className="hub__head">
                    <p className="hub__hello">Здравей, {username}</p>
                    <h1 className="hub__title">Избери игра</h1>
                </header>

                <ul className="hub__games">
                    {GAMES.map(({ key, title, tagline, Art, path }) => (
                        <li key={key}>
                            <button type="button" className="game-pick" onClick={() => navigate(path)}>
                                <span className="game-pick__art">
                                    <Art />
                                </span>
                                <span className="game-pick__text">
                                    <span className="game-pick__name">{title}</span>
                                    <span className="game-pick__rule">{tagline}</span>
                                    {stats?.[key] && <GameRecord stats={stats[key]!} />}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {showProfile && <ProfilePage username={username} onClose={() => setShowProfile(false)} />}

            {confirmLogout && (
                <Modal
                    title="Изход от профила"
                    width="narrow"
                    className="lobby leave"
                    onClose={() => setConfirmLogout(false)}
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => setConfirmLogout(false)}>Остани</Button>
                            {/* Primary, not danger: signing out loses nothing. */}
                            <Button variant="primary" onClick={logout}>Изход</Button>
                        </>
                    }
                >
                    <p className="leave__text">Следващия път ще трябва да влезеш с името и паролата си.</p>
                </Modal>
            )}
        </main>
    );
};

/**
 * The rank line on a game card. Purely presentational — the card itself is the
 * button, so this must not contain one.
 */
const GameRecord: React.FC<{ stats: GameStats }> = ({ stats }) => {
    const { rank, placementGamesRemaining } = stats;
    const inPlacement = placementGamesRemaining > 0;

    return (
        <span className="hub-record">
            <RankMedal rank={rank} size="small" />
            {inPlacement
                ? `Още ${placementGamesRemaining} ${placementGamesRemaining === 1 ? 'игра' : 'игри'} до ранг`
                : rankName(rank)}
        </span>
    );
};

export default GameHub;
