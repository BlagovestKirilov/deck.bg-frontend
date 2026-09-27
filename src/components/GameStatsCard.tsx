import React from 'react';
import { GameStats } from '../types/user.types';
import RankBadge, { rankName } from './RankBadge';

interface Props {
    title: string;
    /**
     * Rank is optional because not every game has one. Belot keeps its own
     * record and has no rating yet; giving it UNRANKED to satisfy the type
     * would print a rank nobody has been given.
     */
    stats: Omit<GameStats, 'rank' | 'placementGamesRemaining'>
        & Partial<Pick<GameStats, 'rank' | 'placementGamesRemaining'>>;
}

/**
 * One game's record: rank, wins, losses and the share won.
 *
 * Each game is ranked separately, so the profile shows one of these per game
 * rather than a single account-wide number — a Santase rank says nothing about
 * how someone plays табла.
 */
const GameStatsCard: React.FC<Props> = ({ title, stats }) => {
    const { wins, losses, rank } = stats;
    const placementGamesRemaining = stats.placementGamesRemaining ?? 0;
    const total = wins + losses;
    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;
    const inPlacement = placementGamesRemaining > 0;

    return (
        <section className="record" aria-label={`Статистика: ${title}`}>
            <header className="record__head">
                <h4 className="record__game">{title}</h4>
                {rank && (
                    <span className="record__rank">
                        {inPlacement
                            ? `Още ${placementGamesRemaining} ${placementGamesRemaining === 1 ? 'игра' : 'игри'} до ранг`
                            : rankName(rank)}
                        <RankBadge rank={rank} size="small" placementGamesRemaining={placementGamesRemaining} />
                    </span>
                )}
            </header>

            <dl className="record__nums">
                <div className="record__num">
                    <dt>Победи</dt>
                    <dd>{wins}</dd>
                </div>
                <div className="record__num">
                    <dt>Загуби</dt>
                    <dd>{losses}</dd>
                </div>
                <div className="record__num">
                    <dt>Игри</dt>
                    <dd>{total}</dd>
                </div>
            </dl>

            {total > 0 ? (
                <>
                    <div
                        className="record__ratio"
                        role="img"
                        aria-label={`Победи ${wins}, загуби ${losses}, ${winPct}% спечелени`}
                    >
                        <span className="record__ratio-win" style={{ width: `${winPct}%` }} />
                        <span className="record__ratio-loss" style={{ width: `${100 - winPct}%` }} />
                    </div>
                    <p className="record__note">
                        <strong>{winPct}%</strong> от игрите спечелени
                    </p>
                </>
            ) : (
                <p className="record__note">Още няма изиграни игри.</p>
            )}
        </section>
    );
};

export default GameStatsCard;
