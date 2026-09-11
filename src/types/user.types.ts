export type Rank = 'UNRANKED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'LEGEND';

/** The games a player holds a separate record in. */
export type GameKey = 'SANTASE' | 'TABLA';

/** One game's record. Rating and rank are per game, not per account. */
export interface GameStats {
    wins: number;
    losses: number;
    rank: Rank;
    /**
     * Games still needed before a rank is assigned. Sent by the server so the
     * client does not keep its own copy of the placement threshold.
     */
    placementGamesRemaining: number;
}

export interface ProfileResponse {
    /** Legacy SANTASE-only fields. Still sent; `stats` supersedes them. */
    santaseWins: number;
    santaseLosses: number;
    rank: Rank;

    isEmailConfirmed: boolean;

    /** Per-game record, keyed by game type. Absent on older servers. */
    stats?: Partial<Record<GameKey, GameStats>>;
}
