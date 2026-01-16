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

const RankIcon: React.FC<{ rank: Rank; size?: number }> = ({ rank, size = 48 }) => {
  const s = size;
  const title = getRankLabel(rank);
  switch (rank) {
    case 'UNRANKED':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <title>{title}</title>
          <circle cx="12" cy="12" r="10" fill="#6b6b6b" />
          <text x="12" y="16" textAnchor="middle" fontSize="12" fontFamily="Arial, sans-serif" fill="#fff">?</text>
        </svg>
      );
    case 'BRONZE':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <title>{title}</title>
          <circle cx="12" cy="12" r="10" fill="#b5651d" />
          <path d="M8 14 L12 8 L16 14 Z" fill="#fff" />
        </svg>
      );
    case 'SILVER':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <title>{title}</title>
          <circle cx="12" cy="12" r="10" fill="#a8a8a8" />
          <g fill="#fff">
            <path d="M7.5 13 L12 8 L16.5 13" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M7.5 16 L12 12 L16.5 16" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </g>
        </svg>
      );
    case 'GOLD':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <title>{title}</title>
          <circle cx="12" cy="12" r="10" fill="#d4a017" />
          <polygon points="12,6 13.5,10 18,10 14,12.5 15.2,16 12,14 8.8,16 10,12.5 6,10 10.5,10" fill="#fff" />
        </svg>
      );
    case 'PLATINUM':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <title>{title}</title>
          <circle cx="12" cy="12" r="10" fill="#5fb3c9" />
          <rect x="7" y="9" width="10" height="6" rx="1" fill="#fff" />
          <text x="12" y="13.8" textAnchor="middle" fontSize="9" fill="#3a8a9e" fontWeight={800}>Pt</text>
        </svg>
      );
    case 'DIAMOND':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <title>{title}</title>
          <circle cx="12" cy="12" r="10" fill="#2d9cdb" />
          <polygon points="12,6 16.5,11 12,18 7.5,11" fill="#fff" opacity={0.95} />
        </svg>
      );
    case 'LEGEND':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <title>{title}</title>
          <circle cx="12" cy="12" r="10" fill="#e85d04" />
          <path d="M6 15 L9 10 L12 13 L15 10 L18 15 Z" fill="#ffd60a" />
          <rect x="6" y="17" width="12" height="2" rx="1" fill="#9d0208" />
        </svg>
      );
    default:
      return null;
  }
};

export default RankIcon;
