import React from 'react';
import { Rank } from '../types/user.types';

export const getRankLabel = (rank: Rank) => {
  const map: Record<Rank, string> = {
    UNRANKED: 'Без ранг',
    BRONZE: 'БРОНЗ',
    SILVER: 'СРЕБРО',
    GOLD: 'ЗЛАТО',
    PLATINUM: 'ПЛАТИНА',
    DIAMOND: 'ДИАМАНТ',
    LEGEND: 'ЛЕГЕНДА',
  };
  return map[rank] ?? String(rank).toLowerCase();
};

const RANK_IMAGES: Record<Rank, string> = {
  UNRANKED: '/rank-unranked.png',
  BRONZE: '/rank-bronze.png',
  SILVER: '/rank-silver.png',
  GOLD: '/rank-gold.png',
  PLATINUM: '/rank-platinum.png',
  DIAMOND: '/rank-diamond.png',
  LEGEND: '/rank-legend.png',
};

const RankIcon: React.FC<{ rank: Rank; size?: number }> = ({ rank, size = 48 }) => {
  const title = getRankLabel(rank);
  const imageSrc = RANK_IMAGES[rank];

  return (
    <img
      src={imageSrc}
      alt={title}
      title={title}
      width={size}
      height={size}
      style={{
        objectFit: 'contain',
        display: 'block',
      }}
    />
  );
};

export default RankIcon;
