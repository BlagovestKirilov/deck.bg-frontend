import React, { useEffect, useRef, useState } from 'react';
import { Rank } from '../types/user.types';

interface RankBadgeProps {
    rank: Rank;
    size?: 'small' | 'medium' | 'large';
    /**
     * Games still needed before a rank is assigned. Comes from the server,
     * which owns the placement threshold — the badge used to hardcode 10 and
     * derive it from wins + losses, which is wrong the moment that changes.
     */
    placementGamesRemaining?: number;
}

const RANK_CONFIG: Record<Rank, { name: string; borderColor: string; glowColor: string; textColor: string; image: string }> = {
    UNRANKED: {
        name: 'Без ранг',
        borderColor: '#5c6b60',
        glowColor: 'rgba(120, 140, 128, 0.35)',
        textColor: '#a9b8ae',
        image: '/rank-unranked.png',
    },
    BRONZE: {
        name: 'БРОНЗ',
        borderColor: '#cd7f32',
        glowColor: 'rgba(205, 127, 50, 0.5)',
        textColor: '#e0a874',
        image: '/rank-bronze.png',
    },
    SILVER: {
        name: 'СРЕБРО',
        borderColor: '#b8b8b8',
        glowColor: 'rgba(200, 200, 200, 0.5)',
        textColor: '#e6e6e6',
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
        textColor: '#bceef8',
        image: '/rank-platinum.png',
    },
    DIAMOND: {
        name: 'ДИАМАНТ',
        borderColor: '#38b6ff',
        glowColor: 'rgba(56, 182, 255, 0.6)',
        textColor: '#aae6ff',
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

/** Fluid sizes — no window-width listener, no re-render on resize. */
const SIZE: Record<NonNullable<RankBadgeProps['size']>, string> = {
    small: 'clamp(36px, 9vw, 44px)',
    medium: 'clamp(50px, 13vw, 64px)',
    large: 'clamp(70px, 18vw, 96px)',
};

/** Bulgarian name of a rank, for labels outside the badge. */
export const rankName = (rank: Rank): string => RANK_CONFIG[rank].name;

/**
 * The medal on its own — no button, no tooltip.
 *
 * Needed wherever a rank is shown inside something already interactive (the
 * game hub's cards are buttons), where nesting the full badge would produce
 * invalid, unfocusable markup.
 */
export const RankMedal: React.FC<{ rank: Rank; size?: RankBadgeProps['size']; alt?: string }> = ({
    rank,
    size = 'small',
    alt = '',
}) => {
    const config = RANK_CONFIG[rank];
    const dimension = SIZE[size];
    return (
        <img
            src={config.image}
            alt={alt}
            aria-hidden={alt ? undefined : true}
            width={44}
            height={44}
            loading="lazy"
            decoding="async"
            style={{
                width: dimension,
                height: dimension,
                objectFit: 'contain',
                display: 'block',
                flex: '0 0 auto',
                filter: rank === 'LEGEND'
                    ? `drop-shadow(0 0 8px ${config.glowColor})`
                    : 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
            }}
        />
    );
};

/**
 * Rank medal with a label on hover (pointer) or tap/Enter (touch, keyboard).
 * It is a real <button> so the label is reachable without a mouse — the old
 * version was a div that only responded to hover.
 */
const RankBadge: React.FC<RankBadgeProps> = ({ rank, size = 'medium', placementGamesRemaining = 0 }) => {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const config = RANK_CONFIG[rank];
    const isLegend = rank === 'LEGEND';

    const label =
        rank === 'UNRANKED'
            ? `Рангът ще бъде отключен след ${placementGamesRemaining} ${placementGamesRemaining === 1 ? 'игра' : 'игри'}`
            : config.name;

    // Tap anywhere else closes the label on touch devices.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
        };
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onEscape);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onEscape);
        };
    }, [open]);

    const dimension = SIZE[size];

    return (
        <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                aria-label={label}
                aria-expanded={open}
                style={{
                    display: 'grid',
                    placeItems: 'center',
                    // keeps a 44px hit area even for the small medal
                    minWidth: 'var(--tap)',
                    minHeight: 'var(--tap)',
                    padding: 0,
                    borderRadius: 'var(--r-pill)',
                    transition: 'transform var(--dur) var(--ease-spring)',
                    transform: open ? 'scale(1.12)' : 'scale(1)',
                    animation: isLegend ? 'legend-pulse 2.5s ease-in-out infinite' : undefined,
                }}
            >
                <img
                    src={config.image}
                    alt=""
                    aria-hidden="true"
                    width={44}
                    height={44}
                    loading="lazy"
                    decoding="async"
                    style={{
                        width: dimension,
                        height: dimension,
                        objectFit: 'contain',
                        display: 'block',
                        filter: isLegend
                            ? `drop-shadow(0 0 8px ${config.glowColor})`
                            : 'drop-shadow(0 2px 4px rgba(0,0,0,0.35))',
                    }}
                />
            </button>

            {open && (
                <div
                    role="tooltip"
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginTop: 'var(--sp-2)',
                        padding: 'var(--sp-2) var(--sp-4)',
                        background: 'rgba(8, 18, 12, 0.96)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: 'var(--r-md)',
                        border: `1px solid ${config.borderColor}`,
                        boxShadow: `var(--sh-2), 0 0 18px ${config.glowColor}`,
                        color: config.textColor,
                        fontSize: 'var(--fs-xs)',
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        whiteSpace: 'nowrap',
                        zIndex: 'var(--z-toast)' as unknown as number,
                        animation: 'tooltip-in var(--dur) var(--ease-spring)',
                        pointerEvents: 'none',
                    }}
                >
                    {label}
                </div>
            )}
        </div>
    );
};

export default RankBadge;
