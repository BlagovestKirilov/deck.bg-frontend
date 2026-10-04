import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { belotService } from '../../api/belotService';
import { noteUnavailable } from '../../api/unavailable';
import { useBelotTable } from '../../hooks/useBelotTable';
import { useCountdown } from '../../hooks/useCountdown';
import {
    BelotBidKind,
    BelotBidView,
    BelotCard,
    BelotContract,
    BelotDealRow,
    BelotPlayedCard,
    BelotSeatName,
    BelotSeatView,
    BelotTeam,
    BelotState,
    BelotTurnView,
} from '../../types/belot.types';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import StatusScreen from '../ui/StatusScreen';
import BelotCardFace from './BelotCardFace';
import Announced, { announcementsBySeat } from './BelotDeclarations';
import BelotHandResult from './BelotHandResult';
import BelotResult from './BelotResult';
import BelotScoreSheet from './BelotScoreSheet';
import { ContractMark } from './ContractMark';
import { sortedHand } from './handOrder';
import '../../styles/belot.css';

/** Play runs counter-clockwise, so the seat after yours sits to your right. */
const ORDER: BelotSeatName[] = ['NORTH', 'WEST', 'SOUTH', 'EAST'];

/** What a call is called, when it has to be a word rather than a glyph. */
const CALL_WORD: Record<BelotContract, string> = {
    CLUBS: 'спатия',
    DIAMONDS: 'каро',
    HEARTS: 'купа',
    SPADES: 'пика',
    NO_TRUMPS: 'без коз',
    ALL_TRUMPS: 'всичко коз',
};

/**
 * Every call there is, in the order they beat one another, laid out in the
 * two columns a Bulgarian table calls them in: the suits down the left, and
 * the two that beat all four suits — then the two answers to them — down the
 * right. The same eight places whoever is bidding, so a player learns where
 * their call is rather than reading a row that is a different length each
 * time round.
 */
const LADDER: { kind: BelotBidKind; contract: BelotContract | null; multiplier?: string }[] = [
    { kind: 'BID', contract: 'CLUBS' },
    { kind: 'BID', contract: 'NO_TRUMPS' },
    { kind: 'BID', contract: 'DIAMONDS' },
    { kind: 'BID', contract: 'ALL_TRUMPS' },
    { kind: 'BID', contract: 'HEARTS' },
    { kind: 'CONTRA', contract: null, multiplier: '×2' },
    { kind: 'BID', contract: 'SPADES' },
    { kind: 'RECONTRA', contract: null, multiplier: '×4' },
];

/** Under this many seconds the clock is the thing to look at, so it turns red. */
const URGENT_SECONDS = 6;

/**
 * How long an announcement stays up at the seat that made it.
 *
 * Said, heard, gone — the way santase shows +20 and +40. It used to stay on
 * the player's plate for the rest of the hand, which is not how anything said
 * at a table works; what it came to is counted out when the hand ends.
 */
const ANNOUNCED_FOR_MS = 3500;

/**
 * How long the last trick of a hand stays out before the hand is counted:
 * the longer hold of `.belot__trick.is-last`, its sweep, and a beat after.
 */
const LAST_TRICK_FOR_MS = 2500;

/**
 * How long a finished trick is being taken: held, then swept to whoever took
 * it (`.belot__trick.is-collected`). The next card cannot be led until it is
 * gone — the server refuses one sooner (`deck.belot.trick-pause`), and the
 * hand is locked here for the same time so the refusal is never met.
 */
const TRICK_TAKEN_MS = 1600;

/** A vibration, where the device has one and the browser allows it. */
function buzz(pattern: number | number[]) {
    try {
        navigator.vibrate?.(pattern);
    } catch {
        // Refused before any tap on the page, or not offered at all: no buzz.
    }
}

/** Long enough for the last of eight cards to finish rising into the hand. */
const DEAL_MS = 1000;

/** One thing a seat said, for as long as it is being said. */
type Heard = { key: string; seat: BelotSeatName; word: string };

/** Where each seat is drawn, once the table is turned so you are at the bottom. */
type Place = 'you' | 'right' | 'partner' | 'left';

/**
 * Where a seat is drawn, counting round from the chair this player is in.
 *
 * With no chair of their own — a reload whose state came back before the seat
 * did, or a table this player is not sitting at — the table is turned as if
 * they were in the south one. Anything is better than the answer this used to
 * give, which was "partner" for all four of them: the map is keyed by place,
 * so the four of them overwrote each other and the whole table was drawn as
 * one player standing in the middle.
 */
function placeOf(seat: BelotSeatName, you: BelotSeatName | null): Place {
    const from = you ?? 'SOUTH';
    const steps = (ORDER.indexOf(seat) - ORDER.indexOf(from) + ORDER.length) % ORDER.length;
    return (['you', 'right', 'partner', 'left'] as Place[])[steps];
}

function callLabel(bid: BelotBidView): string {
    switch (bid.kind) {
        case 'PASS': return 'Пас';
        case 'CONTRA': return 'Контра';
        case 'RECONTRA': return 'Реконтра';
        case 'BID': return bid.contract ? CALL_WORD[bid.contract] : 'Обявявам';
    }
}

/**
 * A table of belot.
 *
 * The table is turned so this player is always at the bottom and their partner
 * opposite, whichever seat the server gave them — a player should not have to
 * work out where they are sitting before they can read the table.
 *
 * Nothing here decides a rule. What may be bid and what may be played arrive
 * from the server as lists, and this screen draws buttons for exactly those.
 */
const BelotGame: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const username = user?.username ?? '';

    const { state, isConnected, unavailable } = useBelotTable(username);

    // One clock for the screen: the seat that is being waited for shows it,
    // and it is the server’s deadline rather than a timer of our own.
    const secondsLeft = useCountdown(state?.turn?.deadline);

    // At nought, say so: the server acts for whoever ran out at once rather
    // than on its next pass, which left the clock standing at 0. Once per
    // deadline, from every screen — the first to arrive is acted on and the
    // others find nothing left to do.
    // A buzz when the table turns to you, and again with five seconds left.
    // On a phone the screen is often not being looked at when the turn comes
    // round. Android only: iOS browsers do not vibrate, and it is skipped
    // where it is not offered.
    const myTurn = !!state?.yourSeat && state.turn?.seat === state.yourSeat;
    useEffect(() => {
        if (myTurn) buzz(60);
    }, [myTurn, state?.turn?.deadline]);
    useEffect(() => {
        if (myTurn && secondsLeft === 5) buzz([40, 60, 40]);
    }, [myTurn, secondsLeft]);

    const timedOut = useRef<string | null>(null);
    const deadline = state?.turn?.deadline ?? null;
    useEffect(() => {
        if (secondsLeft !== 0 || !deadline || timedOut.current === deadline) return;
        timedOut.current = deadline;
        belotService.timeout().catch(() => undefined);
    }, [secondsLeft, deadline]);

    const [sheetOpen, setSheetOpen] = useState(false);
    const [confirmGiveUp, setConfirmGiveUp] = useState(false);

    // The count of the hand that has just ended, shown once when its line
    // lands on the sheet. The sheet a reload brings back is history, not
    // news: it is taken as already seen, so only a hand finished while this
    // screen is open is counted out on it.
    //
    // The last card of a hand deals the next one in the same moment, so
    // before the count the last trick is put back on the table to be seen
    // falling and taken, the way every other trick is. Without it the fourth
    // card is never seen at all: the table jumps straight to the count.
    const [handResult, setHandResult] = useState<BelotDealRow | null>(null);
    const [closingTrick, setClosingTrick] = useState<BelotState['lastTrick']>(null);
    const rowsSeen = useRef<number | null>(null);
    const countTimer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(countTimer.current), []);
    const sheetRows = state?.sheet.length;
    // Before paint: the next hand's bid panel must not flash up for a frame
    // in the place the last trick is about to be put back.
    useLayoutEffect(() => {
        if (sheetRows === undefined || !state) return;
        if (rowsSeen.current !== null && sheetRows > rowsSeen.current) {
            const row = state.sheet[sheetRows - 1];
            const last = state.lastTrick;
            window.clearTimeout(countTimer.current);
            if (last && last.dealNumber === row.dealNumber) {
                setClosingTrick(last);
                countTimer.current = window.setTimeout(() => {
                    setClosingTrick(null);
                    setHandResult(row);
                }, LAST_TRICK_FOR_MS);
            } else {
                setHandResult(row);
            }
        }
        rowsSeen.current = sheetRows;
        // Keyed on the length alone: only a new line on the sheet is news, and
        // every other change to the state would otherwise count it out again.
    }, [sheetRows]);
    const closeHandResult = useCallback(() => setHandResult(null), []);

    // The hand is laid out once, when play starts — all eight, by the
    // contract — and from then on only loses the cards that are played. Sorted
    // again on every card, the suits swapped places whenever one ran out,
    // because which suits alternate red and black depends on which are left.
    const handOrder = useRef<{ deal: number | null; keys: string[] }>({ deal: null, keys: [] });
    const shownHand = useMemo(() => {
        if (!state) return [];
        if (!state.play) return sortedHand(state.yourHand, null);

        const keyOf = (card: BelotCard) => `${card.suit}-${card.rank}`;
        const kept = handOrder.current;
        const known = new Set(kept.keys);
        if (kept.deal !== state.dealNumber || state.yourHand.some((card) => !known.has(keyOf(card)))) {
            const sorted = sortedHand(state.yourHand, state.play.contract);
            handOrder.current = { deal: state.dealNumber, keys: sorted.map(keyOf) };
            return sorted;
        }
        const byKey = new Map(state.yourHand.map((card) => [keyOf(card), card]));
        return kept.keys.filter((key) => byKey.has(key)).map((key) => byKey.get(key)!);
    }, [state]);

    const seats = useMemo(() => {
        const byPlace = new Map<Place, BelotSeatView>();
        state?.seats.forEach((seat) => byPlace.set(placeOf(seat.seat, state.yourSeat), seat));
        return byPlace;
    }, [state]);

    // What each seat has announced this hand, kept at the seat that announced
    // it — a терца is called out from a chair, not printed on the table.
    const announced = useMemo(() => state ? announcementsBySeat(state) : new Map(), [state]);

    // Only what has just been said is shown, and only for a moment. What was
    // said before this screen opened (a reload mid-hand) is taken as already
    // heard, so it is not said a second time.
    const [fresh, setFresh] = useState<Heard[]>([]);
    const heardKeys = useRef<Set<string> | null>(null);
    const fadeTimers = useRef<number[]>([]);
    useEffect(() => () => fadeTimers.current.forEach(window.clearTimeout), []);
    useEffect(() => {
        if (!state) return;
        const now: Heard[] = [];
        announced.forEach((words: string[], seat: BelotSeatName) => words.forEach((word, i) =>
            now.push({ key: `${state.dealNumber}:${seat}:${i}:${word}`, seat, word })));

        if (heardKeys.current === null) {
            heardKeys.current = new Set(now.map((heard) => heard.key));
            return;
        }
        const seen = heardKeys.current;
        const newly = now.filter((heard) => !seen.has(heard.key));
        if (newly.length === 0) return;

        newly.forEach((heard) => seen.add(heard.key));
        setFresh((shown) => [...shown, ...newly]);
        const said = new Set(newly.map((heard) => heard.key));
        fadeTimers.current.push(window.setTimeout(
            () => setFresh((shown) => shown.filter((heard) => !said.has(heard.key))),
            ANNOUNCED_FOR_MS));
    }, [announced, state]);
    const saying = useMemo(() => {
        const bySeat = new Map<BelotSeatName, string[]>();
        fresh.forEach((heard) => bySeat.set(heard.seat, [...(bySeat.get(heard.seat) ?? []), heard.word]));
        return bySeat;
    }, [fresh]);

    // What each seat said last, kept at the seat that said it. An auction read
    // as four chips around the table is the auction; read as one line naming
    // the best call so far, it is a summary of one.
    // A trick that has just been decided is still being taken, and nobody
    // may lead the next one until it has gone to whoever took it. Counted
    // from when it arrived here, which is never before the server's own
    // pause started, so a card played once this ends is never refused.
    const takenKey = state?.play?.wonBy ? `${state.dealNumber}:${state.play.trickNo}` : null;
    const [settledKey, setSettledKey] = useState<string | null>(null);
    useEffect(() => {
        if (!takenKey) return;
        const settle = window.setTimeout(() => setSettledKey(takenKey), TRICK_TAKEN_MS);
        return () => window.clearTimeout(settle);
    }, [takenKey]);
    const trickBeingTaken = takenKey !== null && settledKey !== takenKey;

    const lastCalls = useMemo(() => {
        const bySeat = new Map<BelotSeatName, BelotBidView>();
        state?.bidding?.said.forEach((bid) => bySeat.set(bid.seat, bid));
        return bySeat;
    }, [state]);

    if (unavailable) {
        noteUnavailable('BELOT');
        navigate('/', { replace: true });
        return null;
    }

    if (!state) {
        return (
            <StatusScreen
                tone="neutral"
                icon="cards"
                title={isConnected ? 'Търси се маса' : 'Свързване…'}
                message="Белот се играе от четирима. Щом седнат и четиримата, раздаваме."
            />
        );
    }

    if (state.status === 'WAITING') {
        return <Waiting state={state} onLeave={() => navigate('/')} />;
    }

    // Only when there is a chair to be in. Without one the bottom of the
    // table is somebody else's, and naming them as you would be a lie.
    const you = state.yourSeat ? seats.get('you') : undefined;
    const toAct = state.play?.toAct ?? state.bidding?.toAct ?? null;

    // What has been called and by whom, kept on the score plate from the
    // moment it is said until the hand is over. It is the one fact a player
    // checks most often and the one they cannot work out from the table.
    const contract = state.play?.contract ?? state.bidding?.highestBid ?? null;
    const declarerSeat = state.play?.declarer ?? state.bidding?.bidder ?? null;
    const declarer = state.seats.find((seat) => seat.seat === declarerSeat)?.username;
    const doubling = state.bidding?.doubling ?? 'NONE';
    const partner = seats.get('partner');
    const ourTeam = state.seats.find((seat) => seat.seat === state.yourSeat)?.team ?? 'NORTH_SOUTH';
    const theirTeam = ourTeam === 'NORTH_SOUTH' ? 'EAST_WEST' : 'NORTH_SOUTH';
    // Whoever is taking the trick on the table: their plate lights up as the
    // pile is swept to them, so the answer is at the chair and not only on
    // the card.
    const takingSeat = closingTrick?.wonBy ?? state.play?.wonBy ?? null;
    // The next hand is dealt the moment the last card of this one falls, but
    // it is only put on the table once this one has been taken and counted —
    // cards arriving under the count read as the table moving on without
    // anyone. And nothing is dealt at all once the game is over.
    const dealing = !!closingTrick || !!handResult || state.status === 'FINISHED';

    return (
        <main className="screen belot">
            {/* The sheet on the left where it is kept at a table, and the one
                way off the table on the right. There is no third thing up
                here: leaving a hand of belot is conceding it, and a door
                marked otherwise would be a lie about what it does. */}
            <header className="belot__bar">
                {/* The score is kept on paper at a real table, so it is paper
                    here too — and tapping the sheet opens the sheet. */}
                {/* The slot is always as tall as a plate with a contract on
                    it, held open by an invisible copy of one. The plate itself
                    is only as tall as what it says, so it has no empty line
                    before anything is called — and the table under it still
                    does not jump when a hand ends or the first bid comes in. */}
                <div className="belot__score-slot">
                <span className="belot__score belot__score--ghost" aria-hidden="true">
                    <span className="belot__score-col">
                        <span className="belot__side">ние</span>
                        <span className="belot__points">0</span>
                    </span>
                    <span className="belot__score-col">
                        <span className="belot__side">вие</span>
                        <span className="belot__points">0</span>
                    </span>
                    <span className="belot__declared">
                        <span className="belot__suit">♠</span>
                        <span className="belot__declared-by">—</span>
                    </span>
                </span>
                <button
                    type="button"
                    className="belot__score"
                    onClick={() => setSheetOpen(true)}
                    aria-label="Виж резултата ръка по ръка"
                >
                    <span className="belot__score-col">
                        <span className="belot__side">ние</span>
                        <span className="belot__points">{scoreOf(state, ourTeam)}</span>
                    </span>
                    <span className="belot__score-col">
                        <span className="belot__side">вие</span>
                        <span className="belot__points">{scoreOf(state, theirTeam)}</span>
                    </span>
                    {contract && (
                        <span className="belot__declared">
                            <ContractMark contract={contract} />
                            {doubling !== 'NONE' && (
                                <span className="belot__doubled">
                                    {doubling === 'CONTRA' ? '×2' : '×4'}
                                </span>
                            )}
                            {declarer && <span className="belot__declared-by">{declarer}</span>}
                        </span>
                    )}
                    {state.hangingPoints > 0 && (
                        <span className="belot__hanging">висящи {state.hangingPoints}</span>
                    )}
                </button>
                </div>
                {state.status !== 'FINISHED' && (
                    <button
                        type="button"
                        className="round-btn round-btn--danger"
                        onClick={() => setConfirmGiveUp(true)}
                        aria-label="Предай играта и излез"
                    >
                        <Icon name="x" size={20} />
                    </button>
                )}
            </header>

            <div className="belot__table">
                {(['partner', 'left', 'right'] as Place[]).map((place) => (
                    <Opponent
                        key={place}
                        place={place}
                        seat={seats.get(place)}
                        dealing={dealing}
                        toAct={toAct}
                        taking={!!seats.get(place) && takingSeat === seats.get(place)!.seat}
                        last={!!closingTrick}
                        secondsLeft={secondsLeft}
                        lastCall={seats.get(place) && lastCalls.get(seats.get(place)!.seat)}
                        announced={seats.get(place) && saying.get(seats.get(place)!.seat)}
                        state={state}
                    />
                ))}

                {/* The middle of the felt, which is where both of these are
                    put down at a table. The three other players sit at the
                    edges of the screen, so the bid panel laid here covers
                    none of them — which is what kept it out of the middle
                    while they were sitting close in around it. */}
                <div className="belot__middle">
                    {closingTrick ? (
                        <Trick
                            cards={closingTrick.cards}
                            wonBy={closingTrick.wonBy}
                            yourSeat={state.yourSeat}
                            last
                        />
                    ) : state.play ? (
                        <Trick
                            cards={state.play.onTable}
                            wonBy={state.play.wonBy}
                            yourSeat={state.yourSeat}
                        />
                    ) : <Bidding state={state} />}
                </div>
            </div>

            <section className="belot__hand" aria-label="Вашите карти">
                {/* Your name, and the clock beside it when the table is
                    waiting for you. When it is waiting for somebody else the
                    clock is at their seat instead: one clock, always at the
                    player it is counting for. */}
                <div className="belot__hand-head">
                    {!state.yourSeat && (
                        <p className="belot__you">Гледате маса, на която не седите.</p>
                    )}
                    {you && (
                        <p className={[
                            'belot__you',
                            toAct === you.seat ? 'is-turn' : '',
                            takingSeat === you.seat ? 'is-taking' : '',
                            closingTrick ? 'is-last' : '',
                        ].filter(Boolean).join(' ')}
                        >
                            <span className="belot__you-name">{you.username}</span>
                            {toAct === you.seat && <TurnBar turn={state.turn} secondsLeft={secondsLeft} />}
                            {!state.play && state.dealerSeat === you.seat && <Dealer />}
                            <SeatBubble
                                lastCall={lastCalls.get(you.seat)}
                                announced={saying.get(you.seat)}
                            />
                        </p>
                    )}
                </div>
                {/* Laid out by the contract only once it is settled. Sorted by
                    the best call so far, the hand rearranged itself under the
                    player's eyes every time somebody raised the bidding. */}
                <Held
                    cards={dealing ? [] : shownHand}
                    state={state}
                    locked={trickBeingTaken}
                />
            </section>

            {sheetOpen && <BelotScoreSheet state={state} onClose={() => setSheetOpen(false)} />}

            {confirmGiveUp && (
                <Modal
                    title="Да предадеш ли играта?"
                    width="narrow"
                    className="belot sheet"
                    onClose={() => setConfirmGiveUp(false)}
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => setConfirmGiveUp(false)}>
                                Продължи играта
                            </Button>
                            {/* Danger, because it ends the game for two people. */}
                            <Button
                                variant="danger"
                                onClick={() => {
                                    setConfirmGiveUp(false);
                                    void belotService.surrender();
                                }}
                            >
                                Предай
                            </Button>
                        </>
                    }
                >
                    <p className="sheet__text">
                        Белотът се играе по двойки, затова играта се предава за двама:
                        {partner ? ` ${partner.username} губи заедно с теб.` : ' съотборникът ти губи заедно с теб.'}
                    </p>
                </Modal>
            )}

            {handResult && (
                <BelotHandResult
                    row={handResult}
                    state={state}
                    ourTeam={ourTeam}
                    onClose={closeHandResult}
                />
            )}

            {/* After the last hand's own count, not over it: the game is won on
                that hand, and the count is how. */}
            {state.status === 'FINISHED' && state.winnerTeam && !sheetOpen && !handResult && !closingTrick && (
                <BelotResult
                    state={state}
                    ourTeam={ourTeam}
                    onLeave={() => navigate('/')}
                    onAgain={() => { void belotService.search(); }}
                />
            )}
        </main>
    );
};

/**
 * Somebody else at the table.
 *
 * The same plate whether they are your partner or against you; which of the
 * two they are is said by the ink their name is set in, because a player needs
 * that at a glance and it is not worth a word.
 */
const Opponent: React.FC<{
    place: Place;
    seat?: BelotSeatView;
    toAct: BelotSeatName | null;
    /** Whether the table is between hands, with nothing dealt yet. */
    dealing: boolean;
    /** Whether the trick on the table is being swept to this seat. */
    taking: boolean;
    /** Whether that trick is the last of the hand. */
    last: boolean;
    secondsLeft: number | null;
    lastCall?: BelotBidView;
    announced?: string[];
    state: BelotState;
}> = ({ place, seat, toAct, dealing, taking, last, secondsLeft, lastCall, announced, state }) => (
    <div className={[
        'belot__seat',
        `belot__seat--${place}`,
        seat && toAct === seat.seat ? 'is-turn' : '',
        taking ? 'is-taking' : '',
        last ? 'is-last' : '',
    ].filter(Boolean).join(' ')}
    >
        {/* Behind the plate and partly under it, the way somebody's hand is
            half hidden behind the person holding it. */}
        <Fan cards={dealing ? 0 : seat?.cardsLeft ?? 0} />
        <div className="belot__plate">
            <span className="belot__who">
                <span className="belot__name">{seat?.username ?? 'свободно'}</span>
                {seat && !state.play && state.dealerSeat === seat.seat && <Dealer />}
                {seat && toAct === seat.seat && <TurnBar turn={state.turn} secondsLeft={secondsLeft} />}
            </span>
        </div>
        <SeatBubble lastCall={lastCall} announced={announced} />
    </div>
);

/**
 * The one speech bubble a seat has, and what is in it.
 *
 * A seat says one thing at a time: its call while the bidding is on, else
 * what it has just announced. Both are the same white bubble, because both
 * are something said at the table.
 */
const SeatBubble: React.FC<{
    lastCall?: BelotBidView;
    announced?: string[];
}> = ({ lastCall, announced }) => {
    if (lastCall) return <CallChip bid={lastCall} />;
    return <Announced said={announced} />;
};

/**
 * What somebody is still holding, as the hand it is.
 *
 * Each card carries only its place in the fan, counted out from the middle:
 * --fan-step is -3.5 for the leftmost of eight and 3.5 for the last. What a
 * seat does with that is the stylesheet's business, because the player
 * opposite and the two either side of you hold their cards differently — and
 * a transform written in here would win against the stylesheet whatever it
 * said, being an inline style.
 */
const Fan: React.FC<{ cards: number }> = ({ cards }) => (
    <span className="belot__backs" aria-label={`${cards} карти`}>
        {Array.from({ length: cards }).map((_, i) => (
            <span
                key={i}
                className="card-back"
                aria-hidden="true"
                style={{ '--fan-step': i - (cards - 1) / 2, '--deal-i': i } as React.CSSProperties}
            />
        ))}
    </span>
);

/**
 * Who is dealing, as the marker that sits by their elbow at a table.
 *
 * A round counter rather than the word: it is read once, so it does not want
 * the same room as what somebody has just announced. As a word on a line of
 * its own it put three labels under one player and turned the seat into a
 * list.
 *
 * Only while the hand is bid for — the dealer is what tells you who speaks
 * first. Once the cards are being played it answers nothing.
 */
const Dealer: React.FC = () => (
    <span className="belot__dealer" role="img" aria-label="раздава">Р</span>
);

/**
 * Your own hand, held the way a hand is held: fanned from a point below the
 * bottom of the screen, so the cards lie on an arc rather than a shelf.
 *
 * The turn and the drop of each card are on a wrapper rather than on the card
 * itself. The card lifts when it can be played, and a lift written into the
 * same transform as the fan's turn would have cancelled one or the other.
 */
const Held: React.FC<{
    cards: BelotCard[];
    state: BelotState;
    /** The last trick is still being taken: nothing can be played yet. */
    locked: boolean;
}> = ({ cards, state, locked }) => {
    const middle = (cards.length - 1) / 2;

    // When each card arrived, so only a card that has just been dealt rises
    // into the hand. Leaving the animation on every card replayed it at
    // random: when the hand is re-sorted the browser moves the card in the
    // page, and a moved element starts its animation again from the top.
    const arrived = useRef(new Map<string, number>());
    const now = Date.now();
    const held = new Set(cards.map((card) => `${card.suit}-${card.rank}`));
    arrived.current.forEach((_, key) => { if (!held.has(key)) arrived.current.delete(key); });
    held.forEach((key) => { if (!arrived.current.has(key)) arrived.current.set(key, now); });

    return (
        <div className="belot__cards">
            {cards.map((card, i) => {
                const step = i - middle;
                const playable = (state.play?.yours ?? []).some(
                    (legal) => legal.suit === card.suit && legal.rank === card.rank);
                return (
                    <span
                        key={`${card.suit}-${card.rank}`}
                        className={now - (arrived.current.get(`${card.suit}-${card.rank}`) ?? 0) < DEAL_MS
                            ? 'belot__held is-dealt'
                            : 'belot__held'}
                        style={{ '--fan-step': step, '--fan-arc': step * step, '--deal-i': i } as React.CSSProperties}
                    >
                        <BelotCardFace
                            card={card}
                            muted={!!state.play && !playable}
                            onPlay={playable && !locked ? () => { void belotService.play(card); } : undefined}
                        />
                    </span>
                );
            })}
        </div>
    );
};

/**
 * What a seat said, in a bubble pointing at the table from that seat.
 *
 * A call is spoken, so it is drawn as speech: it belongs to the player who
 * made it and it is gone when the auction is. A contract is its glyph, the
 * way it is printed on the cards; a pass and a contra are the words, the way
 * they are said.
 */
const CallChip: React.FC<{ bid: BelotBidView }> = ({ bid }) => (
    <span className={`belot__said belot__said--${bid.kind.toLowerCase()}`}>
        {/* The mark and the word: an A or a J alone was read as a card, not
            as без коз or всичко коз. */}
        {bid.kind === 'BID' && bid.contract ? (
            <>
                <span aria-hidden="true"><ContractMark contract={bid.contract} /></span>
                {CALL_WORD[bid.contract].charAt(0).toUpperCase() + CALL_WORD[bid.contract].slice(1)}
            </>
        ) : callLabel(bid)}
    </span>
);

/**
 * The time the table is still waiting, as a bar under the plate of the seat
 * it is waiting for, burning down from full to nothing.
 *
 * A bar rather than a number: how much of the turn is left is read at a
 * glance from across the table, where a figure had to be read. Measured from
 * when the turn started to when it ends, both the server's, so it is right
 * after a reload too. Red for the last few seconds, at every seat — a
 * partner about to run out is worth noticing as well.
 */
const TurnBar: React.FC<{ turn: BelotTurnView | null; secondsLeft: number | null }> = ({ turn, secondsLeft }) => {
    const [left, setLeft] = useState(1);
    const startedAt = turn?.startedAt ?? null;
    const deadline = turn?.deadline ?? null;

    useEffect(() => {
        if (!startedAt || !deadline) return undefined;
        const start = new Date(startedAt).getTime();
        const end = new Date(deadline).getTime();
        const span = Math.max(1, end - start);
        const tick = () => setLeft(Math.min(1, Math.max(0, (end - Date.now()) / span)));
        tick();
        // Four steps a second, each eased into by the bar's own transition,
        // reads as one smooth burn and still holds under reduced motion.
        const id = window.setInterval(tick, 250);
        return () => window.clearInterval(id);
    }, [startedAt, deadline]);

    if (!deadline) return null;
    const urgent = secondsLeft !== null && secondsLeft <= URGENT_SECONDS;
    return (
        <span
            className={`belot__turnbar ${urgent ? 'is-urgent' : ''}`}
            role="timer"
            aria-label={secondsLeft !== null ? `${secondsLeft} секунди` : undefined}
        >
            <span className="belot__turnbar-fill" style={{ transform: `scaleX(${left})` }} />
        </span>
    );
};

/** The cards on the table, each shown at the seat that played it. */
const Trick: React.FC<{
    cards: BelotPlayedCard[];
    wonBy: BelotSeatName | null;
    yourSeat: BelotSeatName | null;
    /** The last trick of the hand, held a little longer: it decides the ten. */
    last?: boolean;
}> = ({ cards, wonBy, yourSeat, last = false }) => {
    // Once the trick is decided it is swept to whoever took it: held for a
    // moment so all four can see what fell, then gathered towards that chair
    // and gone. The server keeps the finished trick on the table until the
    // winner leads again, which can be the whole of their turn — thirty seconds
    // of a dead trick sitting where the next one is about to be played.
    const collectedBy = wonBy ? placeOf(wonBy, yourSeat) : null;

    return (
        <div className={[
            'belot__trick',
            collectedBy ? `is-collected belot__trick--to-${collectedBy}` : '',
            last ? 'is-last' : '',
        ].filter(Boolean).join(' ')}
        >
            <div className="belot__played">
                {cards.map((played) => (
                    <span
                        key={played.seat}
                        className={[
                            'belot__played-card',
                            `belot__played-card--${placeOf(played.seat, yourSeat)}`,
                            wonBy === played.seat ? 'is-taken' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        <BelotCardFace card={played.card} size="table" />
                    </span>
                ))}
            </div>
        </div>
    );
};

/**
 * What this player may call.
 *
 * Every call is on screen, in its own place, whether it can be made or not:
 * the four suits, the two that beat them, and the two answers. A call that is
 * not available is dimmed rather than removed, so the panel is the same eight
 * places every time and a player can see what contra would cost before it is
 * theirs to say. Pass runs the width of the panel, because it is the call
 * made most often and the one nobody should have to aim at.
 */
const Bidding: React.FC<{ state: BelotState }> = ({ state }) => {
    const bidding = state.bidding;
    if (!bidding || bidding.yours.length === 0) return null;

    const offered = (kind: BelotBidKind, contract: BelotContract | null) =>
        bidding.yours.find((bid) => bid.kind === kind && (bid.contract ?? null) === contract);

    const say = (kind: BelotBidKind, contract: BelotContract | null) => {
        void belotService.bid(kind, contract ?? undefined);
    };

    return (
        <div className="belot__bidding">
            <div className="belot__ladder">
                {LADDER.map((rung) => {
                    const word = rung.contract ? CALL_WORD[rung.contract]
                        : rung.kind === 'CONTRA' ? 'контра' : 'реконтра';

                    return (
                        <button
                            key={`${rung.kind}-${rung.contract ?? ''}`}
                            type="button"
                            className={`belot__call ${rung.contract ? '' : 'belot__call--double'}`}
                            disabled={!offered(rung.kind, rung.contract)}
                            onClick={() => say(rung.kind, rung.contract)}
                        >
                            {rung.contract
                                ? <ContractMark contract={rung.contract} />
                                : <span className="belot__multiplier">{rung.multiplier}</span>}
                            <span className="belot__call-word">{word}</span>
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                className="belot__call belot__call--pass"
                disabled={!offered('PASS', null)}
                onClick={() => say('PASS', null)}
            >
                Пас
            </button>
        </div>
    );
};

function scoreOf(state: BelotState, team: BelotTeam): number {
    return team === 'NORTH_SOUTH' ? state.northSouthScore : state.eastWestScore;
}

/**
 * The table before it is full.
 *
 * Shows the four places rather than a count: a player who can see three
 * empty chairs and the names in the taken ones knows exactly what is being
 * waited for, and knows their own name is already down.
 */
const Waiting: React.FC<{ state: BelotState; onLeave: () => void }> = ({ state, onLeave }) => {
    const taken = state.seats.length;
    const seats = ORDER.map((seat) => state.seats.find((sitting) => sitting.seat === seat) ?? null);

    return (
        <main className="screen belot belot--waiting">
            <header className="belot__bar">
                <Button variant="ghost" size="sm" icon="arrowLeft" onClick={onLeave}>Игри</Button>
            </header>

            <div className="waiting">
                <h1 className="waiting__title">Масата се пълни</h1>
                <p className="waiting__count">{taken} от 4</p>

                <ul className="waiting__seats">
                    {seats.map((seat, place) => (
                        <li
                            key={seat?.seat ?? `empty-${place}`}
                            className={seat ? 'waiting__seat is-taken' : 'waiting__seat'}
                        >
                            {seat ? (
                                <>
                                    <span className="card-back" aria-hidden="true" />
                                    <span className="waiting__who">
                                        {seat.username}
                                        {seat.seat === state.yourSeat && (
                                            <span className="waiting__you"> — вие</span>
                                        )}
                                    </span>
                                </>
                            ) : (
                                <span className="waiting__free">свободно място</span>
                            )}
                        </li>
                    ))}
                </ul>

                <p className="waiting__note">
                    Белот се играе от четирима. Щом седне и четвъртият, раздаваме — 
                    можете да оставите играта отворена.
                </p>
            </div>
        </main>
    );
};

export default BelotGame;
