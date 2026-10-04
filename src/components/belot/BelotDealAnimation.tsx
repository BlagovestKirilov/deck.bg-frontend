import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { belotService } from '../../api/belotService';
import { BelotCard, BelotSeatName, BelotState } from '../../types/belot.types';

/** Where each seat is drawn, once the table is turned so you are at the bottom. */
export type DealPlace = 'you' | 'right' | 'partner' | 'left';

/** Cards in a belot deck, every one of them spread out for the cut. */
const DECK = 32;
/** The cut once chosen: the top part lifted, carried round and put underneath. */
const CUT_MS = 800;
/** Then the spread gathered back into a squared deck to deal from. */
const GATHER_MS = 380;
/** From one packet leaving the deck to the next. */
const PACKET_MS = 170;
/** How long a packet takes to cross the table. */
const FLY_MS = 460;
/** Between the cards of one packet, so three read as three and not as one. */
const CARD_MS = 30;

/** One run of the dealer's hands: a cut and two rounds, or the three after the bidding. */
export interface DealRun {
    id: string;
    /** Spread for the cut, waiting to be cut, or being dealt from. */
    phase: 'cut' | 'deal';
    dealer: DealPlace;
    cutter: DealPlace;
    cutterName: string;
    packets: { place: DealPlace; count: number }[];
}

export interface Dealt {
    run: DealRun | null;
    /** How many cards each seat has been given so far, while a run is on. */
    shown: Record<DealPlace, number> | null;
    /** Your cards that were already in your hand when the run started. */
    keep: Set<string>;
    /** The cut is made: start dealing. */
    cutDone: () => void;
}

const keyOf = (card: BelotCard) => `${card.suit}-${card.rank}`;

function reducedMotion(): boolean {
    return typeof window !== 'undefined'
        && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The cut and the deal, played out on the table as the server has already
 * done them.
 *
 * The cards are dealt on the server in one breath; nobody at a table sees
 * them arrive that way. So a hand that has just been dealt is taken from the
 * top again here: the deck is spread in front of the dealer, the player on
 * his left cuts it, and the dealer gives three to each, then two, starting
 * with the player after him and going round the way play goes. After the
 * bidding the last three each follow, without a cut. Each seat's cards
 * appear as its packet lands.
 *
 * It is only the picture of a deal — where the deck is cut changes nothing,
 * because the cards were dealt before it was spread.
 *
 * Only for a hand this screen saw arrive. A reload in the middle of one shows
 * the table as it is; with reduced motion, the cards are simply there.
 *
 * @param blocked the last hand is still being taken or counted, so the next
 *                one is not put on the table yet
 */
export function useDealRun(
    state: BelotState | null,
    blocked: boolean,
    order: BelotSeatName[],
    placeOf: (seat: BelotSeatName) => DealPlace,
): Dealt {
    const [run, setRun] = useState<DealRun | null>(null);
    const [shown, setShown] = useState<Record<DealPlace, number> | null>(null);
    const [keep, setKeep] = useState<Set<string>>(new Set());

    const seen = useRef<{ deal: number | null; status: string | null } | null>(null);
    const biddingHand = useRef<string[]>([]);
    const timers = useRef<number[]>([]);
    const clearTimers = () => {
        timers.current.forEach(window.clearTimeout);
        timers.current = [];
    };
    useEffect(() => clearTimers, []);

    // The five held while the bidding is on: after it, the three that come
    // are the ones that were not among these.
    useEffect(() => {
        if (state?.dealStatus === 'BIDDING') biddingHand.current = state.yourHand.map(keyOf);
    }, [state]);

    /** Deal the packets from now: each seat's cards appear as its packet lands. */
    const deal = useCallback((packets: DealRun['packets']) => {
        clearTimers();
        packets.forEach((packet, i) => {
            timers.current.push(window.setTimeout(() => setShown((counts) => counts && {
                ...counts,
                [packet.place]: counts[packet.place] + packet.count,
            }), i * PACKET_MS + FLY_MS));
        });
        timers.current.push(window.setTimeout(() => {
            setRun(null);
            setShown(null);
            setKeep(new Set());
        }, (packets.length - 1) * PACKET_MS + FLY_MS + 150));
    }, []);

    const cutDone = useCallback(() => {
        setRun((current) => {
            if (!current || current.phase !== 'cut') return current;
            deal(current.packets);
            return { ...current, phase: 'deal' };
        });
    }, [deal]);

    const dealNumber = state?.dealNumber ?? null;
    const status = state?.dealStatus ?? null;

    useEffect(() => {
        if (!state || blocked) return;
        const prev = seen.current;
        seen.current = { deal: dealNumber, status };

        const dealer = state.dealerSeat;
        if (!dealer || reducedMotion()) return;

        const fresh = status === 'BIDDING' && (prev
            ? prev.deal !== dealNumber
            : (state.bidding?.said.length ?? 1) === 0);
        const second = status === 'PLAYING' && !!prev && prev.deal === dealNumber && prev.status === 'BIDDING';
        if (!fresh && !second) return;

        const at = order.indexOf(dealer);
        const inTurn = [1, 2, 3, 4].map((step) => order[(at + step) % order.length]);
        const packets = (fresh ? [3, 2] : [3])
            .flatMap((count) => inTurn.map((seat) => ({ place: placeOf(seat), count })));
        const cutterSeat = order[(at + order.length - 1) % order.length];
        const start = fresh ? 0 : 5;

        clearTimers();
        setKeep(new Set(fresh ? [] : biddingHand.current));
        setShown({ you: start, right: start, partner: start, left: start });
        const next: DealRun = {
            id: `${dealNumber}:${fresh ? 'deal' : 'rest'}`,
            phase: fresh ? 'cut' : 'deal',
            dealer: placeOf(dealer),
            cutter: placeOf(cutterSeat),
            cutterName: state.seats.find((seat) => seat.seat === cutterSeat)?.username ?? '',
            packets,
        };
        setRun(next);
        if (!fresh) deal(packets);
        // Keyed on the deal and its stage: those are what a run is for.
    }, [dealNumber, status, blocked]);

    return { run, shown, keep, cutDone };
}

/**
 * The deck in front of the dealer: spread for the cut, cut, then dealt from.
 *
 * The player cutting chooses where by touching a card in the spread; the
 * others watch it happen. Laid over the screen rather than into the table's
 * layout, so nothing moves while it plays. Where each packet goes is
 * measured from the seats as they are drawn, so it lands on the hand it is
 * for at any screen size.
 */
export const DealOverlay: React.FC<{ run: DealRun; onCutDone: () => void; serverCutAt: number | null }> = ({ run, onCutDone, serverCutAt }) => {
    const anchor = useRef<HTMLSpanElement>(null);
    const [layout, setLayout] = useState<{
        x: number;
        y: number;
        step: number;
        to: Record<DealPlace, { dx: number; dy: number }>;
    } | null>(null);
    const [cutAt, setCutAt] = useState<number | null>(null);
    const yours = run.cutter === 'you';

    useLayoutEffect(() => {
        const table = anchor.current?.closest('.belot__table');
        const screen = anchor.current?.closest('.screen');
        const middle = table?.querySelector('.belot__middle');
        if (!table || !screen || !middle) return;

        const box = middle.getBoundingClientRect();
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const centreOf = (selector: string, root: Element) => {
            const found = root.querySelector(selector)?.getBoundingClientRect();
            return found
                ? { x: found.left + found.width / 2, y: found.top + found.height / 2 }
                : { x: cx, y: cy };
        };
        const seats: Record<DealPlace, { x: number; y: number }> = {
            you: centreOf('.belot__hand', screen),
            right: centreOf('.belot__seat--right .belot__plate', table),
            partner: centreOf('.belot__seat--partner .belot__plate', table),
            left: centreOf('.belot__seat--left .belot__plate', table),
        };
        // In the middle of the table — the middle between the two side
        // players' plates, which are not always the same width (the dealer's
        // carries his mark), so the deck sits evenly between their names.
        const leftPlate = table.querySelector('.belot__seat--left .belot__plate')?.getBoundingClientRect();
        const rightPlate = table.querySelector('.belot__seat--right .belot__plate')?.getBoundingClientRect();
        const x = leftPlate && rightPlate ? (leftPlate.right + rightPlate.left) / 2 : cx;
        const y = cy;
        const to = Object.fromEntries(
            (Object.keys(seats) as DealPlace[]).map((place) => [place, { dx: seats[place].x - x, dy: seats[place].y - y }]),
        ) as Record<DealPlace, { dx: number; dy: number }>;
        // The spread fits between the two side players' plates, so it never
        // lies over their names — measured with a card of the size it is
        // drawn at, which is smaller on a phone.
        const probe = document.createElement('span');
        probe.className = 'card-back';
        anchor.current!.appendChild(probe);
        const cardWidth = probe.offsetWidth;
        probe.remove();
        const room = leftPlate && rightPlate
            ? rightPlate.left - leftPlate.right - 24
            : box.width * 0.6;
        const step = Math.max(2, Math.min(8, (room - cardWidth) / (DECK - 1)));
        setLayout({ x, y, step, to });
    }, [run.id]);

    // The cut is the server's: every screen waits until the player cutting
    // has touched the deck (or the server has cut it for them when their
    // time ran out), and then shows the same cut.
    useEffect(() => {
        if (run.phase === 'cut' && cutAt === null && serverCutAt !== null && serverCutAt > 0) {
            setCutAt(serverCutAt);
        }
    }, [run.phase, cutAt, serverCutAt]);

    useEffect(() => {
        if (cutAt === null) return undefined;
        const done = window.setTimeout(onCutDone, CUT_MS + GATHER_MS + 80);
        return () => window.clearTimeout(done);
    }, [cutAt, onCutDone]);

    if (!layout) {
        return <span ref={anchor} className="belot__deal" style={{ visibility: 'hidden' }} aria-hidden="true" />;
    }

    if (run.phase === 'cut') {
        const middle = (DECK - 1) / 2;
        const choosing = yours && cutAt === null;
        return (
            <span ref={anchor} className="belot__deal" style={{ left: layout.x, top: layout.y }}>
                <span className="belot__cut-label" role="status">
                    {yours ? (cutAt === null ? 'Цепи — докосни тестето' : 'Цепиш') : `${run.cutterName} цепи`}
                </span>
                {Array.from({ length: DECK }, (_, i) => {
                    const lifted = cutAt !== null && i >= cutAt;
                    const shift = cutAt === null ? 0 : lifted ? -cutAt * layout.step : (DECK - cutAt) * layout.step;
                    const offset = (i - middle) * layout.step;
                    const style = {
                        left: offset,
                        zIndex: i + 1,
                        '--shift': `${shift}px`,
                        // Back to the middle of the spread, whence it opened
                        // and where it is gathered again after the cut.
                        '--home': `${-offset}px`,
                        '--i': i,
                    } as React.CSSProperties;
                    const className = [
                        'card-back',
                        'belot__spread',
                        cutAt !== null ? (lifted ? 'is-lifted' : 'is-sliding') : '',
                    ].filter(Boolean).join(' ');
                    return choosing ? (
                        <button
                            key={i}
                            type="button"
                            className={className}
                            style={style}
                            aria-label={`Цепи тук, на карта ${i + 1} от ${DECK}`}
                            onClick={() => {
                                const at = Math.min(DECK - 2, Math.max(2, i));
                                setCutAt(at);
                                belotService.cut(at).catch(() => undefined);
                            }}
                        />
                    ) : (
                        <span key={i} className={className} style={style} aria-hidden="true" />
                    );
                })}
            </span>
        );
    }

    const total = run.packets.reduce((sum, packet) => sum + packet.count, 0);
    let n = 0;
    return (
        <span ref={anchor} className="belot__deal" style={{ left: layout.x, top: layout.y }} aria-hidden="true">
            {run.packets.map((packet, i) => Array.from({ length: packet.count }, (_, j) => {
                const target = layout.to[packet.place];
                const sideways = packet.place === 'left' || packet.place === 'right';
                n += 1;
                // A thrown card does not travel in a straight line: the top of
                // its arc is pushed off to one side, a fifth of the way across.
                const bend = 0.2;
                const mx = target.dx / 2 - target.dy * bend;
                const my = target.dy / 2 + target.dx * bend;
                // And it is not thrown flat: each turns a little in the air,
                // the cards of a packet each their own way.
                const wobble = ((n * 37) % 25) - 12;
                return (
                    <span
                        key={`${i}-${j}`}
                        className="card-back belot__flying"
                        style={{
                            '--dx': `${target.dx}px`,
                            '--dy': `${target.dy}px`,
                            '--mx': `${mx}px`,
                            '--my': `${my}px`,
                            '--rot': sideways ? '90deg' : '0deg',
                            '--spin': `${wobble}deg`,
                            // Still on the deck, every card sits a hair above
                            // the one under it, so the deck has a thickness.
                            '--depth': `${(total - n) * -0.5}px`,
                            zIndex: total - n + 1,
                            animationDelay: `${i * PACKET_MS + j * CARD_MS}ms`,
                        } as React.CSSProperties}
                    />
                );
            }))}
        </span>
    );
};
