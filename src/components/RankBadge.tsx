import React, { useState } from 'react';
import { Rank } from '../types/user.types';

interface RankBadgeProps {
  rank: Rank;
  size?: 'small' | 'medium' | 'large';
  windowWidth?: number;
  wins?: number;
  losses?: number;
}

/* =========================
   Rank configuration
========================= */
const RANK_CONFIG: Record<Rank, {
  name: string;
  borderColor: string;
  glowColor: string;
  textColor: string;
  image: string;
}> = {
  UNRANKED: {
    name: 'Рангът се отключва след 10-тата игра',
    borderColor: '#4a4a4a',
    glowColor: 'rgba(80, 80, 80, 0.4)',
    textColor: '#888888',
    image: '/rank-unranked.png',
  },
  BRONZE: {
    name: 'БРОНЗ',
    borderColor: '#cd7f32',
    glowColor: 'rgba(205, 127, 50, 0.5)',
    textColor: '#daa06d',
    image: '/rank-bronze.png',
  },
  SILVER: {
    name: 'СРЕБРО',
    borderColor: '#b8b8b8',
    glowColor: 'rgba(200, 200, 200, 0.5)',
    textColor: '#e0e0e0',
    image: '/rank-silver.png',
  },
  GOLD: {
    name: 'ЗЛАТО',
    borderColor: '#f0c420',
    glowColor: 'rgba(255, 200, 0, 0.55)',
    textColor: '#ffe066',
    image: '/rank-gold.png',
  },
  PLATINUM: {
    name: 'ПЛАТИНА',
    borderColor: '#6ec5d8',
    glowColor: 'rgba(110, 197, 216, 0.55)',
    textColor: '#b8eaf5',
    image: '/rank-platinum.png',
  },
  DIAMOND: {
    name: 'ДИАМАНТ',
    borderColor: '#38b6ff',
    glowColor: 'rgba(56, 182, 255, 0.6)',
    textColor: '#a5e4ff',
    image: '/rank-diamond.png',
  },
  LEGEND: {
    name: 'ЛЕГЕНДА',
    borderColor: '#ff9500',
    glowColor: 'rgba(255, 149, 0, 0.7)',
    textColor: '#ffd60a',
    image: '/rank-legend.png',
  },
};

/* =========================
   Rank Badge Component
========================= */
const RankBadge: React.FC<RankBadgeProps> = ({ rank, size = 'medium', windowWidth = 1024, wins = 0, losses = 0 }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const config = RANK_CONFIG[rank];
  const badgeRef = React.useRef<HTMLDivElement>(null);

  const isMobile = windowWidth <= 768;
  const isSmallMobile = windowWidth <= 480;

  // Close tooltip when clicking outside (for mobile)
  React.useEffect(() => {
    if (isMobile && showTooltip) {
      const handleClickOutside = (event: MouseEvent) => {
        if (badgeRef.current && !badgeRef.current.contains(event.target as Node)) {
          setShowTooltip(false);
        }
      };

      // Add listener with a small delay to avoid immediate close
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
      }, 10);

      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [isMobile, showTooltip]);

  const sizeConfig = {
    small: { badge: isSmallMobile ? 36 : isMobile ? 40 : 44, tooltip: '0.75rem' },
    medium: { badge: isSmallMobile ? 50 : isMobile ? 56 : 64, tooltip: '0.9rem' },
    large: { badge: isSmallMobile ? 70 : isMobile ? 80 : 96, tooltip: '1rem' },
  };

  const currentSize = sizeConfig[size];
  const isLegend = rank === 'LEGEND';

  return (
      <div ref={badgeRef} style={{ position: 'relative', display: 'inline-flex' }}>
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
          <img
              src={config.image}
              alt={config.name}
              width={currentSize.badge}
              height={currentSize.badge}
              style={{
                objectFit: 'contain',
                display: 'block',
                filter: isLegend
                    ? `drop-shadow(0 0 8px ${config.glowColor})`
                    : `drop-shadow(0 2px 4px rgba(0,0,0,0.3))`,
              }}
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
              {rank === 'UNRANKED'
                  ? `Рангът ще бъде отключен след ${10 - wins - losses} ${(10 - wins - losses) === 1 ? 'игра' : 'игри'}`
                  : config.name}
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
