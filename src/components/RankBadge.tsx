import React, { useState } from 'react';
import { Rank } from '../types/user.types';

interface RankBadgeProps {
  rank: Rank;
  size?: 'small' | 'medium' | 'large';
  windowWidth?: number;
}

/* =========================
   Rank configuration
========================= */
const RANK_CONFIG: Record<Rank, {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  borderColor: string;
  glowColor: string;
  textColor: string;
  shadowColor: string;
  tier: number;
}> = {
  UNRANKED: {
    name: 'Рангът се отключва след 10-тата игра',
    primaryColor: '#3d3d3d',
    secondaryColor: '#252525',
    accentColor: '#555555',
    borderColor: '#4a4a4a',
    glowColor: 'rgba(80, 80, 80, 0.4)',
    textColor: '#888888',
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    tier: 0,
  },
  BRONZE: {
    name: 'Бронз',
    primaryColor: '#b5651d',
    secondaryColor: '#8b4513',
    accentColor: '#cd853f',
    borderColor: '#cd7f32',
    glowColor: 'rgba(205, 127, 50, 0.5)',
    textColor: '#daa06d',
    shadowColor: 'rgba(139, 69, 19, 0.7)',
    tier: 1,
  },
  SILVER: {
    name: 'Сребро',
    primaryColor: '#a8a8a8',
    secondaryColor: '#787878',
    accentColor: '#d4d4d4',
    borderColor: '#b8b8b8',
    glowColor: 'rgba(200, 200, 200, 0.5)',
    textColor: '#e0e0e0',
    shadowColor: 'rgba(100, 100, 100, 0.7)',
    tier: 2,
  },
  GOLD: {
    name: 'Злато',
    primaryColor: '#d4a017',
    secondaryColor: '#996515',
    accentColor: '#ffd700',
    borderColor: '#f0c420',
    glowColor: 'rgba(255, 200, 0, 0.55)',
    textColor: '#ffe066',
    shadowColor: 'rgba(180, 130, 0, 0.7)',
    tier: 3,
  },
  PLATINUM: {
    name: 'Платина',
    primaryColor: '#5fb3c9',
    secondaryColor: '#3a8a9e',
    accentColor: '#a8e0ed',
    borderColor: '#6ec5d8',
    glowColor: 'rgba(110, 197, 216, 0.55)',
    textColor: '#b8eaf5',
    shadowColor: 'rgba(58, 138, 158, 0.7)',
    tier: 4,
  },
  DIAMOND: {
    name: 'Диамант',
    primaryColor: '#2d9cdb',
    secondaryColor: '#1a6eb0',
    accentColor: '#7dd3fc',
    borderColor: '#38b6ff',
    glowColor: 'rgba(56, 182, 255, 0.6)',
    textColor: '#a5e4ff',
    shadowColor: 'rgba(26, 110, 176, 0.75)',
    tier: 5,
  },
  LEGEND: {
    name: 'Легенда',
    primaryColor: '#e85d04',
    secondaryColor: '#9d0208',
    accentColor: '#ffba08',
    borderColor: '#ff9500',
    glowColor: 'rgba(255, 149, 0, 0.7)',
    textColor: '#ffd60a',
    shadowColor: 'rgba(157, 2, 8, 0.8)',
    tier: 6,
  },
};

/* =========================
   Shield SVG Component
========================= */
const RankShield: React.FC<{
  config: typeof RANK_CONFIG[Rank];
  size: number;
  tier: number;
  isLegend: boolean;
}> = ({ config, size, tier, isLegend }) => {
  const id = `rank-${tier}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        filter: isLegend 
          ? `drop-shadow(0 0 12px ${config.glowColor}) drop-shadow(0 4px 8px ${config.shadowColor})`
          : `drop-shadow(0 4px 10px ${config.shadowColor})`,
      }}
    >
      <defs>
        {/* Main shield gradient */}
        <linearGradient id={`main-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={config.accentColor} />
          <stop offset="35%" stopColor={config.primaryColor} />
          <stop offset="70%" stopColor={config.secondaryColor} />
          <stop offset="100%" stopColor={config.primaryColor} />
        </linearGradient>

        {/* Top highlight */}
        <linearGradient id={`highlight-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
          <stop offset="30%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="60%" stopColor="rgba(255,255,255,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
        </linearGradient>

        {/* Inner glow */}
        <radialGradient id={`inner-glow-${id}`} cx="50%" cy="30%" r="60%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>

        {/* Border gradient for 3D effect */}
        <linearGradient id={`border-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={config.accentColor} />
          <stop offset="50%" stopColor={config.borderColor} />
          <stop offset="100%" stopColor={config.secondaryColor} />
        </linearGradient>

        {/* Legend fire gradient */}
        {isLegend && (
          <linearGradient id={`fire-${id}`} x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#9d0208" />
            <stop offset="30%" stopColor="#e85d04" />
            <stop offset="60%" stopColor="#ff9500" />
            <stop offset="100%" stopColor="#ffba08" />
          </linearGradient>
        )}

        {/* Clip path for inner elements */}
        <clipPath id={`shield-clip-${id}`}>
          <path d="M50 8 L82 22 L82 54 Q82 72 50 90 Q18 72 18 54 L18 22 Z" />
        </clipPath>
      </defs>

      {/* Outer glow for legend */}
      {isLegend && (
        <path
          d="M50 5 L85 20 L85 55 Q85 75 50 95 Q15 75 15 55 L15 20 Z"
          fill="none"
          stroke={config.glowColor}
          strokeWidth="6"
          opacity="0.5"
          style={{ filter: 'blur(4px)' }}
        />
      )}

      {/* Main shield body */}
      <path
        d="M50 5 L85 20 L85 55 Q85 75 50 95 Q15 75 15 55 L15 20 Z"
        fill={`url(#main-${id})`}
        stroke={`url(#border-${id})`}
        strokeWidth="2.5"
      />

      {/* Highlight overlay */}
      <path
        d="M50 8 L82 22 L82 54 Q82 72 50 90 Q18 72 18 54 L18 22 Z"
        fill={`url(#highlight-${id})`}
      />

      {/* Inner glow */}
      <path
        d="M50 8 L82 22 L82 54 Q82 72 50 90 Q18 72 18 54 L18 22 Z"
        fill={`url(#inner-glow-${id})`}
      />

      {/* Decorative inner border */}
      <path
        d="M50 14 L76 26 L76 52 Q76 67 50 83 Q24 67 24 52 L24 26 Z"
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth="1"
      />

      {/* Tier-specific emblems */}
      {tier === 0 && (
        <g>
          <text
            x="50"
            y="58"
            textAnchor="middle"
            fontSize="32"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            fill="rgba(255,255,255,0.5)"
          >
            ?
          </text>
        </g>
      )}

      {tier === 1 && (
        <g>
          {/* Bronze: Single chevron pointing UP */}
          <path
            d="M35 58 L50 42 L65 58"
            fill="none"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}
          />
        </g>
      )}

      {tier === 2 && (
        <g>
          {/* Silver: Double chevron pointing UP */}
          <path
            d="M35 54 L50 40 L65 54"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}
          />
          <path
            d="M35 68 L50 54 L65 68"
            fill="none"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}
          />
        </g>
      )}

      {tier === 3 && (
        <g>
          {/* Gold: Star */}
          <polygon
            points="50,22 55,38 72,38 58,48 64,65 50,55 36,65 42,48 28,38 45,38"
            fill="rgba(255,255,255,0.95)"
            stroke="rgba(255,220,100,0.8)"
            strokeWidth="1"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(255,200,0,0.6))' }}
          />
        </g>
      )}

      {tier === 4 && (
        <g>
          {/* Platinum: Platinum bar/ingot icon */}
          <defs>
            <linearGradient id={`platinum-bar-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8e8e8" />
              <stop offset="30%" stopColor="#a8d4e6" />
              <stop offset="50%" stopColor="#7ec8e3" />
              <stop offset="70%" stopColor="#a8d4e6" />
              <stop offset="100%" stopColor="#e8e8e8" />
            </linearGradient>
          </defs>
          {/* Platinum ingot shape */}
          <path
            d="M30 38 L40 28 L60 28 L70 38 L70 62 L60 72 L40 72 L30 62 Z"
            fill={`url(#platinum-bar-${id})`}
            stroke="rgba(255,255,255,0.95)"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(110,197,216,0.6))' }}
          />
          {/* Top face highlight */}
          <path
            d="M30 38 L40 28 L60 28 L70 38 L60 45 L40 45 Z"
            fill="rgba(255,255,255,0.4)"
          />
          {/* PT text */}
          <text
            x="50"
            y="58"
            textAnchor="middle"
            fontSize="16"
            fontWeight="900"
            fontFamily="Arial, sans-serif"
            fill="rgba(60,100,120,0.9)"
            style={{ filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.5))' }}
          >
            Pt
          </text>
          {/* Shine effect */}
          <ellipse cx="38" cy="35" rx="4" ry="2" fill="rgba(255,255,255,0.7)" />
        </g>
      )}

      {tier === 5 && (
        <g>
          {/* Diamond: Real brilliant cut diamond */}
          <defs>
            <linearGradient id={`diamond-facet-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e0f7ff" />
              <stop offset="25%" stopColor="#7dd3fc" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="75%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#e0f7ff" />
            </linearGradient>
          </defs>
          {/* Diamond crown (top) */}
          <polygon
            points="50,18 72,40 28,40"
            fill={`url(#diamond-facet-${id})`}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 0 10px rgba(56,182,255,0.7))' }}
          />
          {/* Diamond pavilion (bottom) */}
          <polygon
            points="28,40 72,40 50,78"
            fill="rgba(56,189,248,0.5)"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.5"
          />
          {/* Crown facets */}
          <line x1="50" y1="18" x2="40" y2="40" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
          <line x1="50" y1="18" x2="60" y2="40" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
          <line x1="50" y1="18" x2="50" y2="40" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
          {/* Pavilion facets */}
          <line x1="28" y1="40" x2="50" y2="78" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
          <line x1="72" y1="40" x2="50" y2="78" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
          <line x1="40" y1="40" x2="50" y2="78" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <line x1="60" y1="40" x2="50" y2="78" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
          <line x1="50" y1="40" x2="50" y2="78" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
          {/* Sparkles */}
          <circle cx="45" cy="28" r="3" fill="rgba(255,255,255,0.95)" style={{ filter: 'blur(0.5px)' }} />
          <circle cx="58" cy="32" r="2" fill="rgba(255,255,255,0.8)" style={{ filter: 'blur(0.5px)' }} />
          <circle cx="36" cy="36" r="1.5" fill="rgba(255,255,255,0.7)" />
        </g>
      )}

      {tier === 6 && (
        <g>
          {/* Legend: Crown */}
          <path
            d="M24 58 L30 32 L40 44 L50 26 L60 44 L70 32 L76 58 Z"
            fill={`url(#fire-${id})`}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(255,149,0,0.7))' }}
          />
          {/* Crown base */}
          <rect
            x="24" y="58" width="52" height="10" rx="2"
            fill={`url(#fire-${id})`}
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="1"
          />
          {/* Crown jewels */}
          <circle cx="35" cy="40" r="4" fill="#fff" opacity="0.9" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
          <circle cx="50" cy="32" r="5" fill="#fff" opacity="0.95" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.9))' }} />
          <circle cx="65" cy="40" r="4" fill="#fff" opacity="0.9" style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' }} />
        </g>
      )}
    </svg>
  );
};

/* =========================
   Rank Badge Component
========================= */
const RankBadge: React.FC<RankBadgeProps> = ({ rank, size = 'medium', windowWidth = 1024 }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = RANK_CONFIG[rank];

  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 480;

  const sizeConfig = {
    small: { badge: isSmallMobile ? 36 : isMobile ? 40 : 44, tooltip: '0.75rem' },
    medium: { badge: isSmallMobile ? 50 : isMobile ? 56 : 64, tooltip: '0.9rem' },
    large: { badge: isSmallMobile ? 70 : isMobile ? 80 : 96, tooltip: '1rem' },
  };

  const currentSize = sizeConfig[size];
  const isLegend = rank === 'LEGEND';

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <div
        style={{
          cursor: 'pointer',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: showTooltip ? 'scale(1.15)' : 'scale(1)',
          animation: isLegend ? 'legendPulse 2.5s ease-in-out infinite' : undefined,
        }}
        onMouseEnter={() => !isMobile && setShowTooltip(true)}
        onMouseLeave={() => !isMobile && setShowTooltip(false)}
        onClick={() => isMobile && setShowTooltip(!showTooltip)}
      >
        <RankShield
          config={config}
          size={currentSize.badge}
          tier={config.tier}
          isLegend={isLegend}
        />
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '14px',
            padding: '10px 18px',
            background: `linear-gradient(145deg, rgba(20,20,25,0.95), rgba(10,10,15,0.98))`,
            backdropFilter: 'blur(12px)',
            borderRadius: '10px',
            border: `1.5px solid ${config.borderColor}`,
            boxShadow: `
              0 8px 32px rgba(0,0,0,0.5),
              0 0 20px ${config.glowColor},
              inset 0 1px 0 rgba(255,255,255,0.1)
            `,
            color: config.textColor,
            fontSize: currentSize.tooltip,
            fontWeight: 600,
            letterSpacing: '0.3px',
            whiteSpace: 'nowrap',
            zIndex: 10000,
            animation: 'tooltipSlideIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Tooltip arrow */}
          <div
            style={{
              position: 'absolute',
              top: '-6px',
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: '12px',
              height: '12px',
              background: 'rgba(20,20,25,0.95)',
              borderLeft: `1.5px solid ${config.borderColor}`,
              borderTop: `1.5px solid ${config.borderColor}`,
            }}
          />
          {config.name}
        </div>
      )}

      <style>{`
        @keyframes legendPulse {
          0%, 100% { 
            transform: scale(1);
            filter: brightness(1);
          }
          50% { 
            transform: scale(1.05);
            filter: brightness(1.15);
          }
        }
        @keyframes tooltipSlideIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-8px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default RankBadge;
