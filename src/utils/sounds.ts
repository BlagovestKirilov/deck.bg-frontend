/**
 * The calls a player makes out loud at the table: twenty, forty, and the
 * close of the deck. Short recordings in public/sounds, played as the bubble
 * or the toast that says the same thing appears.
 *
 * Off is remembered per browser, because a player who turns the sound off at
 * work does not want it back on the next game.
 */
const FILES = {
    twenty: '/sounds/dvayset.mp3',
    forty: '/sounds/chetiriyset.mp3',
    closed: '/sounds/zatvoreno.mp3',
} as const;

export type Sound = keyof typeof FILES;

const STORAGE_KEY = 'sound';
const loaded = new Map<Sound, HTMLAudioElement>();

export function isSoundOn(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
        return true;
    }
}

export function setSoundOn(on: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    } catch {
        // Storage refused (a private window): the choice lasts for this page only.
    }
    if (!on) loaded.forEach((audio) => audio.pause());
}

export function playSound(name: Sound): void {
    if (!isSoundOn()) return;
    let audio = loaded.get(name);
    if (!audio) {
        audio = new Audio(FILES[name]);
        audio.preload = 'auto';
        loaded.set(name, audio);
    }
    audio.currentTime = 0;
    // Refused before the page has been tapped, or no output device: stay silent.
    audio.play().catch(() => undefined);
}
