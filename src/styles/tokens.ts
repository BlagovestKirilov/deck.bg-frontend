/**
 * TypeScript mirror of the CSS custom properties in theme.css.
 *
 * Components that must compute a style at runtime (the game table positions
 * cards and HUD pieces from live state) read from here instead of hardcoding
 * hex values, so there is still exactly one source of truth for the palette.
 */

export const t = {
    color: {
        bg: 'var(--bg)',
        bgDeep: 'var(--bg-deep)',
        surface1: 'var(--surface-1)',
        surface2: 'var(--surface-2)',
        surface3: 'var(--surface-3)',
        surfaceRaised: 'var(--surface-raised)',
        scrim: 'var(--scrim)',
        felt: 'var(--felt)',

        text1: 'var(--text-1)',
        text2: 'var(--text-2)',
        text3: 'var(--text-3)',
        onAccent: 'var(--text-on-accent)',
        onLight: 'var(--text-on-light)',

        gold: 'var(--gold)',
        goldBright: 'var(--gold-bright)',
        goldDeep: 'var(--gold-deep)',
        goldWash: 'var(--gold-wash)',

        accent: 'var(--accent)',
        accentBright: 'var(--accent-bright)',
        accentDeep: 'var(--accent-deep)',

        success: 'var(--success)',
        danger: 'var(--danger)',
        dangerBright: 'var(--danger-bright)',
        warning: 'var(--warning)',

        line: 'var(--line)',
        lineStrong: 'var(--line-strong)',
        lineGold: 'var(--line-gold)',
    },

    space: (n: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16) => `var(--sp-${n})`,

    radius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        xxl: 'var(--r-2xl)',
        pill: 'var(--r-pill)',
    },

    font: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
        mono: 'var(--font-mono)',
    },

    size: {
        xs: 'var(--fs-xs)',
        sm: 'var(--fs-sm)',
        md: 'var(--fs-md)',
        lg: 'var(--fs-lg)',
        xl: 'var(--fs-xl)',
        xxl: 'var(--fs-2xl)',
        xxxl: 'var(--fs-3xl)',
    },

    shadow: {
        s1: 'var(--sh-1)',
        s2: 'var(--sh-2)',
        s3: 'var(--sh-3)',
        glowGold: 'var(--glow-gold)',
        glowAccent: 'var(--glow-accent)',
    },

    motion: {
        fast: 'var(--dur-fast)',
        base: 'var(--dur)',
        slow: 'var(--dur-slow)',
        easeOut: 'var(--ease-out)',
        easeSpring: 'var(--ease-spring)',
    },

    z: {
        hud: 'var(--z-hud)',
        nav: 'var(--z-nav)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        blocking: 'var(--z-blocking)',
    },

    tap: 'var(--tap)',

    /**
     * How long a toast lives, in milliseconds, for the timer that removes it.
     * The CSS animation is driven by --dur-toast; this is the same number,
     * and the two are meant to be changed together.
     */
    toastMs: 4000,
} as const;

/** Suit colors for playing-card faces. Cards stay light — these sit on white. */
export const SUIT_COLOR = {
    red: '#c62828',
    black: '#16211a',
} as const;

/**
 * Suit glyph colors for the few places a suit is shown on a DARK surface
 * (the closed-deck trump chip). The card-face colors are too dark there.
 */
export const SUIT_ON_DARK = {
    red: '#ff8080',
    black: '#e6efe9',
} as const;
