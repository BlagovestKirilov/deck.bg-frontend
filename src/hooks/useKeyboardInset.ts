import { useEffect } from 'react';

/**
 * Keeps a focused input above the on-screen keyboard.
 *
 * The viewport meta asks for `interactive-widget=resizes-content`, which makes
 * Chrome on Android shrink the layout viewport when the keyboard opens — the
 * page then grows past the visible area and can be scrolled. iOS Safari and the
 * Capacitor WebView ignore that hint: the layout viewport keeps its full height,
 * so a form that fits the screen has nothing to scroll and every field the
 * keyboard covers becomes unreachable. Tapping the username field and then being
 * unable to reach the password field is exactly that.
 *
 * So the keyboard's height is measured directly from `visualViewport` and
 * published as `--kb-inset`. Form screens pad their bottom by it, which gives
 * the document somewhere to scroll on every platform, and the focused field is
 * then scrolled into view.
 *
 * Nothing here runs when `visualViewport` is missing; the CSS falls back to 0px.
 */
export function useKeyboardInset(): void {
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return undefined;

        const root = document.documentElement;
        let raf = 0;

        const apply = () => {
            // How much of the layout viewport the keyboard (and any browser
            // chrome that slid in with it) is covering.
            const covered = root.clientHeight - vv.height - vv.offsetTop;
            // Small negative values show up while the viewport settles; ignore
            // them, and ignore a few pixels of rounding noise.
            const inset = covered > 8 ? Math.round(covered) : 0;
            root.style.setProperty('--kb-inset', `${inset}px`);
        };

        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(apply);
        };

        // The element the keyboard is about to cover. Scrolled into view once
        // the viewport has finished animating — doing it on focus is too early,
        // the keyboard is not up yet and the browser has nothing to scroll past.
        const revealFocused = () => {
            const el = document.activeElement;
            if (!(el instanceof HTMLElement)) return;
            if (!el.matches('input, textarea, select')) return;
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        };

        let revealTimer = 0;
        const onFocusIn = (event: FocusEvent) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            if (!target.matches('input, textarea, select')) return;
            window.clearTimeout(revealTimer);
            // Long enough for the keyboard animation on both platforms.
            revealTimer = window.setTimeout(revealFocused, 320);
        };

        apply();
        vv.addEventListener('resize', schedule);
        vv.addEventListener('scroll', schedule);
        document.addEventListener('focusin', onFocusIn);

        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(revealTimer);
            vv.removeEventListener('resize', schedule);
            vv.removeEventListener('scroll', schedule);
            document.removeEventListener('focusin', onFocusIn);
            root.style.removeProperty('--kb-inset');
        };
    }, []);
}
