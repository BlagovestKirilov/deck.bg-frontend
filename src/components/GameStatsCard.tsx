import React from 'react';
import { GameStats } from '../types/user.types';
import RankBadge from './RankBadge';
import Icon, { IconName } from './ui/Icon';

interface Props {
    title: string;
    /** Shown when the game has no crest of its own. */
    icon?: IconName;
    /** A short mark — Сантасе is known by its 66, the same as on the hub. */
    crest?: string;
    stats: GameStats;
}

/**
 * One game's record: rank, W/L and the win ratio.
 *
 * Each game is ranked separately, so the profile shows one of these per game
 * rather than a single account-wide number — a Santase rank says nothing about
 * how someone plays табла.
 */
const GameStatsCard: React.FC<Props> = ({ title, icon, crest, stats }) => {
    const { wins, losses, rank, placementGamesRemaining } = stats;
    const total = wins + losses;
    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
    const inPlacement = placementGamesRemaining > 0;

    return (
        <section className="game-stats" aria-label={`Статистика: ${title}`}>
            <header className="game-stats__head">
                <span className="game-stats__title">
                    {crest
                        ? <span className="game-stats__crest">{crest}</span>
                        : icon && <Icon name={icon} size={18} />}
                    {title}
                </span>

                <span className="game-stats__rank">
                    <RankBadge
                        rank={rank}
                        size="small"
                        placementGamesRemaining={placementGamesRemaining}
                    />
                </span>
            </header>

            <div className="game-stats__row">
                <div className="stat">
                    <div className="stat__value">{wins}</div>
                    <div className="stat__label">Победи</div>
                </div>
                <div className="stat">
                    <div className="stat__value">{losses}</div>
                    <div className="stat__label">Загуби</div>
                </div>
                <div className="stat">
                    <div className="stat__value">{total}</div>
                    <div className="stat__label">Игри</div>
                </div>
            </div>

            {total > 0 ? (
                <>
                    <div
                        className="ratio"
                        role="img"
                        aria-label={`Победи ${wins}, загуби ${losses}, ${winPct}% успеваемост`}
                    >
                        <div className="ratio__win" style={{ width: `${winPct}%` }} />
                        <div className="ratio__loss" style={{ width: `${100 - winPct}%` }} />
                    </div>
                    <div className="game-stats__legend">
                        <span style={{ color: 'var(--success)', fontWeight: 700 }}>{winPct}% победи</span>
                        {inPlacement && (
                            <span style={{ color: 'var(--text-3)' }}>
                                още {placementGamesRemaining} до ранг
                            </span>
                        )}
                        <span style={{ color: 'var(--danger-bright)', fontWeight: 700 }}>
                            {100 - winPct}% загуби
                        </span>
                    </div>
                </>
            ) : (
                <p className="game-stats__empty">Още няма изиграни игри.</p>
            )}
        </section>
    );
};

export default GameStatsCard;
