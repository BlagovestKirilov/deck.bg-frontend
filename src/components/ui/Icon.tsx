import React from 'react';

/**
 * One icon family for the whole app: 24x24 grid, stroke-based, 1.75 stroke,
 * round caps and joins, drawn in currentColor.
 *
 * Replaces the emoji that were previously used as structural icons
 * (👤 ⚠️ ✉️ 🏆 🏳️ ✓ ✗ × ✕). Emoji render differently per platform, cannot be
 * themed, and are announced as their unicode name by screen readers.
 */

export type IconName =
    | 'user'
    | 'warning'
    | 'mail'
    | 'check'
    | 'checkCircle'
    | 'x'
    | 'xCircle'
    | 'close'
    | 'trophy'
    | 'flag'
    | 'eye'
    | 'eyeOff'
    | 'arrowLeft'
    | 'info'
    | 'shield'
    | 'trash'
    | 'lock'
    | 'clock'
    | 'plugOff'
    | 'spade'
    | 'cards'
    | 'logout'
    | 'search'
    | 'compass';

interface IconProps {
    name: IconName;
    /** px size; defaults to 1em so it tracks the surrounding font size */
    size?: number | string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * Accessible name. Omit for icons that sit next to a text label —
     * they are then hidden from screen readers as decoration.
     */
    label?: string;
}

const PATHS: Record<IconName, React.ReactNode> = {
    user: (
        <>
            <circle cx="12" cy="8" r="3.6" />
            <path d="M4.5 20c.6-3.7 3.7-5.6 7.5-5.6s6.9 1.9 7.5 5.6" />
        </>
    ),
    warning: (
        <>
            <path d="M12 3.8 2.9 19.2h18.2L12 3.8Z" />
            <path d="M12 9.6v4.2" />
            <path d="M12 16.9v.1" />
        </>
    ),
    mail: (
        <>
            <rect x="2.8" y="5" width="18.4" height="14" rx="2.4" />
            <path d="m3.6 7.2 7.2 5.1c.7.5 1.7.5 2.4 0l7.2-5.1" />
        </>
    ),
    check: <path d="m4.5 12.6 4.8 4.8L19.5 7.2" />,
    checkCircle: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m8 12.4 2.7 2.7L16 9.8" />
        </>
    ),
    x: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
    xCircle: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.2 9.2 14.8 14.8M14.8 9.2 9.2 14.8" />
        </>
    ),
    close: <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />,
    trophy: (
        <>
            <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0V4Z" />
            <path d="M7.5 5.5H5a2.5 2.5 0 0 0 2.5 2.5" />
            <path d="M16.5 5.5H19a2.5 2.5 0 0 1-2.5 2.5" />
            <path d="M12 13.5V17" />
            <path d="M8.5 20h7" />
            <path d="M9.8 20c0-1.7 1-3 2.2-3s2.2 1.3 2.2 3" />
        </>
    ),
    flag: (
        <>
            <path d="M5.5 21V4" />
            <path d="M5.5 5.2h9.7l-1.4 3.2 1.4 3.2H5.5" />
        </>
    ),
    eye: (
        <>
            <path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="2.9" />
        </>
    ),
    eyeOff: (
        <>
            <path d="M9.9 5.4A9.6 9.6 0 0 1 12 5.2c6 0 9.5 5.8 9.5 5.8a17 17 0 0 1-3 3.6" />
            <path d="M6.4 7.3A16.7 16.7 0 0 0 2.5 11s3.5 5.8 9.5 5.8c1.4 0 2.7-.3 3.8-.8" />
            <path d="M10 10a2.9 2.9 0 0 0 4 4" />
            <path d="M4 3.6 20 19.6" />
        </>
    ),
    arrowLeft: (
        <>
            <path d="M19 12H5.4" />
            <path d="m11 5.6-5.8 6.4 5.8 6.4" />
        </>
    ),
    info: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.4" />
            <path d="M12 7.7v.1" />
        </>
    ),
    shield: (
        <>
            <path d="M12 3.2 5 6v5.6c0 4 3 7.4 7 9.2 4-1.8 7-5.2 7-9.2V6l-7-2.8Z" />
            <path d="m9.2 12.2 2 2 3.6-3.9" />
        </>
    ),
    trash: (
        <>
            <path d="M4.5 6.6h15" />
            <path d="M9.4 6.6V4.8h5.2v1.8" />
            <path d="M6.6 6.6 7.5 20h9l.9-13.4" />
            <path d="M10.4 10.2v6M13.6 10.2v6" />
        </>
    ),
    lock: (
        <>
            <rect x="4.8" y="10.4" width="14.4" height="9.4" rx="2.2" />
            <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.2V12l3.2 2" />
        </>
    ),
    plugOff: (
        <>
            <path d="M3.5 3.5 20.5 20.5" />
            <path d="M8.3 4.4v3.9M14.6 4.4v3.9" />
            <path d="M6.2 8.3h10.4v2.6a5.2 5.2 0 0 1-5.2 5.2h-.5" />
            <path d="M11.6 16.1V20" />
        </>
    ),
    spade: (
        <>
            <path d="M12 3.4c-2.4 3-6.6 5.2-6.6 8.6a3.5 3.5 0 0 0 6 2.4c-.2 2.4-1 4-2.4 5.2h6c-1.4-1.2-2.2-2.8-2.4-5.2a3.5 3.5 0 0 0 6-2.4c0-3.4-4.2-5.6-6.6-8.6Z" />
        </>
    ),
    cards: (
        <>
            <rect x="3.2" y="6.4" width="10.4" height="14" rx="2" />
            <path d="M8.2 4.6h8.6a2 2 0 0 1 2 2v11" />
        </>
    ),
    logout: (
        <>
            <path d="M14.4 8V5.8a1.8 1.8 0 0 0-1.8-1.8H6.2a1.8 1.8 0 0 0-1.8 1.8v12.4A1.8 1.8 0 0 0 6.2 20h6.4a1.8 1.8 0 0 0 1.8-1.8V16" />
            <path d="M20 12H9.6" />
            <path d="m16.6 8.4 3.6 3.6-3.6 3.6" />
        </>
    ),
    search: (
        <>
            <circle cx="10.8" cy="10.8" r="6.4" />
            <path d="m15.6 15.6 4.4 4.4" />
        </>
    ),
    compass: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5 4.5-1.9Z" />
        </>
    ),
};

const Icon: React.FC<IconProps> = ({ name, size = '1em', className, style, label }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        style={{ flexShrink: 0, display: 'block', ...style }}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        focusable="false"
    >
        {PATHS[name]}
    </svg>
);

export default Icon;
