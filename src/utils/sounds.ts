/**
 * The calls a player makes out loud at the table, as short recordings in
 * public/sounds, played as the bubble that says the same thing appears.
 *
 * Santase: twenty, forty, and the close of the deck. Belot: every bid, and
 * the announcements as they are said — "петдесет" and "сто", not the names
 * of the sequences. Santase and belot: a card put on the table. Tabla: the
 * dice thrown. The card and dice sounds are real recordings (Kenney's Casino
 * Audio, CC0), taken in turn so no two in a row sound the same.
 *
 * Off is remembered per browser and shared by every game, because a player
 * who turns the sound off at work does not want it back on the next table.
 */
const FILES = {
    // santase
    twenty: '/sounds/santase/dvayset.mp3',
    forty: '/sounds/santase/chetiriyset.mp3',
    closed: '/sounds/santase/zatvoreno.mp3',
    // belot — the bidding
    pass: '/sounds/belot/pas.mp3',
    clubs: '/sounds/belot/spatia.mp3',
    diamonds: '/sounds/belot/karo.mp3',
    hearts: '/sounds/belot/kupa.mp3',
    spades: '/sounds/belot/pika.mp3',
    noTrumps: '/sounds/belot/bez-koz.mp3',
    allTrumps: '/sounds/belot/vsichko-koz.mp3',
    contra: '/sounds/belot/kontra.mp3',
    recontra: '/sounds/belot/rekontra.mp3',
    // belot — the announcements
    belote: '/sounds/belot/belot.mp3',
    terz: '/sounds/belot/terca.mp3',
    quarte: '/sounds/belot/petdeset.mp3',
    quinte: '/sounds/belot/sto.mp3',
    carre: '/sounds/belot/kare.mp3',
} as const;

/** A card put on the cloth — shared by both card games. Four takes, in turn. */
const CARD_FILES = ['/sounds/cards/card-1.mp3', '/sounds/cards/card-2.mp3', '/sounds/cards/card-3.mp3', '/sounds/cards/card-4.mp3'];

/** Two dice thrown onto the board. Three takes, in turn. */
const DICE_FILES = ['/sounds/tabla/dice-1.mp3', '/sounds/tabla/dice-2.mp3', '/sounds/tabla/dice-3.mp3'];

export type Sound = keyof typeof FILES;

const STORAGE_KEY = 'sound';
const loaded = new Map<Sound, HTMLAudioElement>();

/**
 * The breath between two calls said one after the other — a терца and a
 * белот, or two players bidding in one update — so they are heard as two
 * calls and not run together into one word.
 */
const PAUSE_BETWEEN_MS = 350;

/** What is waiting to be said after the call being said now. */
let queue: Sound[] = [];
let speaking = false;

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
    if (!on) {
        queue = [];
        loaded.forEach((audio) => audio.pause());
    }
}

function audioFor(name: Sound): HTMLAudioElement {
    let audio = loaded.get(name);
    if (!audio) {
        audio = new Audio(FILES[name]);
        audio.preload = 'auto';
        loaded.set(name, audio);
    }
    return audio;
}

function sayNext(): void {
    const name = queue.shift();
    if (!name) {
        speaking = false;
        return;
    }
    speaking = true;
    const audio = audioFor(name);
    audio.currentTime = 0;
    audio.onended = () => {
        if (queue.length === 0) speaking = false;
        else window.setTimeout(sayNext, PAUSE_BETWEEN_MS);
    };
    // Refused before the page has been tapped, a file not there yet, or no
    // output device: skip it and say the next.
    audio.play().catch(sayNext);
}

/**
 * One of a set of takes of the same sound, the next one each time, played
 * straight away. Not queued behind the calls: a card lands while somebody is
 * still talking, at a real table as here. Each play is its own copy, so two
 * close together are both heard.
 */
function rotation(files: string[], volume: number): () => void {
    const takes = files.map((file) => {
        const audio = new Audio(file);
        audio.preload = 'auto';
        return audio;
    });
    let next = 0;
    let lastAt = 0;
    return () => {
        if (!isSoundOn()) return;
        // Two of the same sound within a breath are one event heard twice —
        // the opening roll's two dice landing together, say.
        const now = Date.now();
        if (now - lastAt < SAME_SOUND_GAP_MS) return;
        lastAt = now;
        const take = takes[next].cloneNode() as HTMLAudioElement;
        next = (next + 1) % takes.length;
        take.volume = volume;
        take.play().catch(() => undefined);
    };
}

/** Closer together than this, two of the same sound are heard as one. */
const SAME_SOUND_GAP_MS = 60;

let cards: (() => void) | null = null;
let dice: (() => void) | null = null;

/** A card put down on the table, in santase or belot. */
export function playCardSound(): void {
    (cards ??= rotation(CARD_FILES, 0.8))();
}

/** The dice thrown, in tabla — the opening roll's too. */
export function playDiceSound(): void {
    (dice ??= rotation(DICE_FILES, 0.9))();
}

/**
 * Says a call. Calls that arrive together — a терца and a белот in the same
 * breath, or two bids in one update — are said one after the other, not on
 * top of each other.
 */
export function playSound(name: Sound): void {
    if (!isSoundOn()) return;
    queue.push(name);
    if (!speaking) sayNext();
}
