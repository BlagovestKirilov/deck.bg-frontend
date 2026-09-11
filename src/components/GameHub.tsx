import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { userService } from '../api/userService';
import { GameKey, GameStats } from '../types/user.types';
import { RankMedal, rankName } from './RankBadge';
import Brand from './ui/Brand';
import Button from './ui/Button';
import Icon, { IconName } from './ui/Icon';
import Modal from './ui/Modal';
import ProfilePage from './ProfilePage';

interface GameCard {
    key: GameKey;
    title: string;
    tagline: string;
    icon: IconName;
    crest: string;
    path: string;
}

const GAMES: GameCard[] = [
    {
        key: 'SANTASE',
        title: 'Сантасе 66',
        tagline: 'Класическо Сантасе срещу реални опоненти',
        icon: 'cards',
        crest: '66',
        path: '/play/santase',
    },
    {
        key: 'TABLA',
        title: 'Табла',
        tagline: 'Класическа табла срещу реални опоненти',
        icon: 'dice',
        crest: '',
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

    return (
        <main className="screen" style={{ alignItems: 'flex-start' }}>
            <div style={shell}>
                <nav style={navStyle}>
                    <Brand />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <button
                            type="button"
                            onClick={() => setShowProfile(true)}
                            style={userButton}
                            aria-label={`Отвори профила на ${username}`}
                        >
                            <Icon name="user" size={20} />
                            <span className="truncate" style={{ maxWidth: '12ch', fontWeight: 700 }}>
                                {username}
                            </span>
                        </button>

                        <Button
                            variant="ghost"
                            size="sm"
                            icon="logout"
                            onClick={() => setConfirmLogout(true)}
                            aria-label="Изход от профила"
                        >
                            <span className="nav-label">ИЗХОД</span>
                        </Button>
                    </div>
                </nav>

                <header style={{ textAlign: 'center', margin: 'var(--sp-6) 0 var(--sp-5)' }}>
                    <h1 style={{ fontSize: 'var(--fs-2xl)', color: 'var(--text-1)' }}>
                        Здравей, <span style={{ color: 'var(--gold)' }}>{username}</span>
                    </h1>
                    <p style={{ marginTop: 'var(--sp-2)', color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>
                        Избери игра
                    </p>
                </header>

                <div style={grid}>
                    {GAMES.map((game) => (
                        <button
                            key={game.key}
                            type="button"
                            className="panel panel--gold"
                            style={card}
                            onClick={() => navigate(game.path)}
                        >
                            <span style={crest}>
                                {game.crest
                                    ? <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{game.crest}</span>
                                    : <Icon name={game.icon} size="54%" />}
                            </span>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>
                                {game.title}
                            </span>
                            <span style={{ color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }}>
                                {game.tagline}
                            </span>

                            {stats?.[game.key] && <GameRecord stats={stats[game.key]!} />}
                        </button>
                    ))}
                </div>
            </div>

            {showProfile && <ProfilePage username={username} onClose={() => setShowProfile(false)} />}

            {confirmLogout && (
                <Modal
                    title="Изход от профила"
                    width="narrow"
                    onClose={() => setConfirmLogout(false)}
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => setConfirmLogout(false)}>Отказ</Button>
                            <Button variant="danger" onClick={logout}>Изход</Button>
                        </>
                    }
                >
                    <p style={{ color: 'var(--text-2)' }}>Сигурни ли сте, че искате да излезете?</p>
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
            <span className="hub-record__text">
                <span className="hub-record__rank">
                    {inPlacement
                        ? `Още ${placementGamesRemaining} ${placementGamesRemaining === 1 ? 'игра' : 'игри'} до ранг`
                        : rankName(rank)}
                </span>
            </span>
        </span>
    );
};

const shell: React.CSSProperties = {
    width: '100%',
    maxWidth: '760px',
    margin: '0 auto',
};

const navStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 'var(--sp-3)',
    width: '100%',
    minHeight: 'clamp(56px, 12vw, 68px)',
};

const userButton: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-2)',
    minHeight: 'var(--tap)',
    padding: '0 var(--sp-3)',
    borderRadius: 'var(--r-md)',
    color: 'var(--text-1)',
    fontSize: 'var(--fs-sm)',
};

const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 'var(--sp-4)',
    width: '100%',
    paddingBottom: 'calc(var(--sp-8) + var(--sa-bottom))',
};

const card: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-3)',
    padding: 'var(--sp-6)',
    minHeight: '200px',
    justifyContent: 'center',
    textAlign: 'center',
    cursor: 'pointer',
    color: 'var(--text-1)',
};

const crest: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(64px, 16vw, 80px)',
    height: 'clamp(64px, 16vw, 80px)',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent-bright), var(--accent) 55%, var(--accent-deep))',
    color: 'var(--text-on-accent)',
    fontSize: 'clamp(1.5rem, 5vw, 2rem)',
    boxShadow: 'var(--glow-accent)',
};

export default GameHub;
