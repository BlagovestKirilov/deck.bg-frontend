import { useEffect, useRef, useState } from 'react';

/**
 * Where each face sits on the cube. Opposite faces sum to seven, as on a real
 * die, so the back of a 1 is a 6 and the whole thing survives being turned.
 */
export const FACE_PLACEMENT: Record<number, string> = {
    1: 'translateZ(var(--die-half))',
    6: 'rotateY(180deg) translateZ(var(--die-half))',
    2: 'rotateY(90deg)  translateZ(var(--die-half))',
    5: 'rotateY(-90deg) translateZ(var(--die-half))',
    3: 'rotateX(90deg)  translateZ(var(--die-half))',
    4: 'rotateX(-90deg) translateZ(var(--die-half))',
};

/** The cube rotation that brings a given face to the front — the inverse. */
const LANDING: Record<number, { rx: number; ry: number }> = {
    1: { rx: 0, ry: 0 },
    6: { rx: 0, ry: 180 },
    2: { rx: 0, ry: -90 },
    5: { rx: 0, ry: 90 },
    3: { rx: -90, ry: 0 },
    4: { rx: 90, ry: 0 },
};

/** Whole turns added per throw, different per die so they never move as one. */
const SPINS = [
    { x: 2, y: 3 },
    { x: 3, y: 2 },
];

/** How long the cube takes to come to rest, and when it stops rising. */
export const THROW_MS = 650;
const APEX_MS = 260;

export function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}

export interface DieThrow {
    /** Cube rotation in degrees; keeps growing so every throw turns forward. */
    rx: number;
    ry: number;
    /**
     * Where the turn starts from — the rotation the previous throw ended on.
     *
     * Carried explicitly rather than left to the browser to remember. A turn
     * begins with no dice, so the cubes are unmounted and mount again when the
     * roll arrives; whether the browser painted the old rotation before the new
     * one was applied was a race, and a slower phone lost it. The cube then had
     * nothing to animate from and snapped straight to the result.
     */
    fromRx: number;
    fromRy: number;
    /** 1 while the die is at the top of its arc, 0 once it has come to rest. */
    lift: number;
}

export interface DiceThrow {
    dice: [DieThrow, DieThrow];
    airborne: boolean;
}

/**
 * Throws the two dice when a new roll arrives.
 *
 * The cube is real: six faces carrying the six values, turned in 3D. The
 * animation therefore cannot show a number that was not rolled — it only
 * decides how far the cube turns, and the landing rotation is derived from the
 * server's value, so the face that ends up forward is the one that was rolled.
 *
 * Rotation accumulates rather than resetting, so each throw keeps turning the
 * same way instead of unwinding back to zero. The two dice take a different
 * number of turns on each axis, so they never tumble in lockstep.
 *
 * The throw is decoration and blocks nothing: the board offers its legal moves
 * the instant the state arrives, not when the dice come to rest.
 *
 * Retriggers when the dice go from absent to present, which is once per turn —
 * a turn begins with no dice until someone presses Хвърли.
 */
export function useDiceRoll(die1?: number, die2?: number): DiceThrow {
    const [dice, setDice] = useState<[DieThrow, DieThrow]>([
        { rx: 0, ry: 0, fromRx: 0, fromRy: 0, lift: 0 },
        { rx: 0, ry: 0, fromRx: 0, fromRy: 0, lift: 0 },
    ]);
    const [airborne, setAirborne] = useState(false);

    // Turns taken so far, so a throw never has to rewind to land.
    const turns = useRef(0);
    // What the last run saw. The server pushes state on every move, and none of
    // those pushes is a new roll.
    const previous = useRef<string>('');
    const timers = useRef<number[]>([]);

    useEffect(() => {
        const key = die1 == null || die2 == null ? '' : `${die1}-${die2}`;
        if (key === previous.current) return;
        previous.current = key;

        timers.current.forEach(window.clearTimeout);
        timers.current = [];

        if (die1 == null || die2 == null) {
            setAirborne(false);
            return;
        }

        /** The pair of cube rotations that show these two values, face forward. */
        const landing = (lift: number, from: [DieThrow, DieThrow]): [DieThrow, DieThrow] =>
            ([0, 1] as const).map((i) => {
                const land = LANDING[i === 0 ? die1 : die2] ?? LANDING[1];
                return {
                    rx: turns.current * 360 * SPINS[i].x + land.rx,
                    ry: turns.current * 360 * SPINS[i].y + land.ry,
                    fromRx: from[i].rx,
                    fromRy: from[i].ry,
                    lift,
                };
            }) as [DieThrow, DieThrow];

        if (prefersReducedMotion()) {
            // Straight to the landing rotation, no extra turns and no arc. The
            // cube still shows the face that was actually rolled.
            // No turn to make: it starts where it ends.
            setDice((current) => landing(0, current).map((d) => ({
                ...d, fromRx: d.rx, fromRy: d.ry,
            })) as [DieThrow, DieThrow]);
            setAirborne(false);
            return;
        }

        // One more throw's worth of turns. Rotation accumulates so the cube
        // never has to rewind, and the delta per throw stays constant.
        turns.current += 1;
        setAirborne(true);

        // Up and turning, from wherever the last throw left the cubes.
        setDice((current) => landing(1, current));

        // ...then down onto the table, keeping the rotation it has reached.
        const down = window.setTimeout(() => {
            setDice((current) => current.map((d) => ({ ...d, lift: 0 })) as [DieThrow, DieThrow]);
        }, APEX_MS);

        const rest = window.setTimeout(() => setAirborne(false), THROW_MS);

        timers.current.push(down, rest);
        return () => {
            timers.current.forEach(window.clearTimeout);
            timers.current = [];
        };
    }, [die1, die2]);

    return { dice, airborne };
}
