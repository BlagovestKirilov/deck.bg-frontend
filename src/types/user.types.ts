export type Rank = 'UNRANKED' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'LEGEND';

export interface ProfileResponse {
    santaseWins: number;
    santaseLosses: number;
    isEmailConfirmed: boolean;
    rank: Rank;
}

