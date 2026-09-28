import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { belotService } from '../../api/belotService';
import { noteUnavailable } from '../../api/unavailable';
import { useBelotTable } from '../../hooks/useBelotTable';
import { useCountdown } from '../../hooks/useCountdown';
import {
    BelotBidKind,
    BelotBidView,
    BelotContract,
    BelotSeatName,
    BelotSeatView,
    BelotTeam,
    BelotState,
} from '../../types/belot.types';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import StatusScreen from '../ui/StatusScreen';
import BelotCardFace from './BelotCardFace';
import Announced, { announcementsBySeat } from './BelotDeclarations';
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

    const [sheetOpen, setSheetOpen] = useState(false);
    const [confirmGiveUp, setConfirmGiveUp] = useState(false);

    const seats = useMemo(() => {
        const byPlace = new Map<Place, BelotSeatView>();
        state?.seats.forEach((seat) => byPlace.set(placeOf(seat.seat, state.yourSeat), seat));
        return byPlace;
    }, [state]);

    // What each seat has announced this hand, kept at the seat that announced
    // it — a терца is called out from a chair, not printed on the table.
    const announced = useMemo(() => state ? announcementsBySeat(state) : new Map(), [state]);

    // What each seat said last, kept at the seat that said it. An auction read
    // as four chips around the table is the auction; read as one line naming
    // the best call so far, it is a summary of one.
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

    return (
        <main className="screen belot">
            {/* The sheet on the left where it is kept at a table, and the one
                way off the table on the right. There is no third thing up
                here: leaving a hand of belot is conceding it, and a door
                marked otherwise would be a lie about what it does. */}
            <header className="belot__bar">
                {/* The score is kept on paper at a real table, so it is paper
                    here too — and tapping the sheet opens the sheet. */}
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
                        toAct={toAct}
                        lastCall={seats.get(place) && lastCalls.get(seats.get(place)!.seat)}
                        announced={seats.get(place) && announced.get(seats.get(place)!.seat)}
                        state={state}
                    />
                ))}

                <div className="belot__middle">
                    {state.play && <Trick state={state} />}
                </div>
            </div>

            <section className="belot__hand" aria-label="Вашите карти">
                {/* The auction is answered with the hand in view, under the
                    table rather than on top of it: what the other three have
                    called is half of what a call is chosen on, and a panel in
                    the middle of the table covers all three of them. */}
                <Bidding state={state} />

                {/* One clock for the table, and it sits with the hand it is
                    counting down. Four seats each showing their own was four
                    numbers to ignore and one to find. */}
                <div className="belot__hand-head">
                    {!state.yourSeat && (
                        <p className="belot__you">Гледате маса, на която не седите.</p>
                    )}
                    {you && (
                        <p className="belot__you">
                            <span className="belot__you-name">{you.username}</span>
                            {lastCalls.get(you.seat) && (
                                <CallChip bid={lastCalls.get(you.seat)!} />
                            )}
                            <Announced said={announced.get(you.seat)} />
                            {state.dealerSeat === you.seat && <Dealer />}
                        </p>
                    )}
                    <TurnClock
                        state={state}
                        toAct={toAct}
                        yours={!!you && toAct === you.seat}
                        secondsLeft={secondsLeft}
                    />
                </div>
                <div className="belot__cards">
                    {sortedHand(state.yourHand, contract).map((card) => {
                        const playable = (state.play?.yours ?? []).some(
                            (legal) => legal.suit === card.suit && legal.rank === card.rank);
                        return (
                            <BelotCardFace
                                key={`${card.suit}-${card.rank}`}
                                card={card}
                                muted={!!state.play && !playable}
                                onPlay={playable ? () => { void belotService.play(card); } : undefined}
                            />
                        );
                    })}
                </div>
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

            {state.status === 'FINISHED' && state.winnerTeam && !sheetOpen && (
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
    lastCall?: BelotBidView;
    announced?: string[];
    state: BelotState;
}> = ({ place, seat, toAct, lastCall, announced, state }) => (
    <div className={`belot__seat belot__seat--${place} ${seat && toAct === seat.seat ? 'is-turn' : ''}`}>
        <span className="belot__who">
            <span className="belot__name">{seat?.username ?? 'свободно'}</span>
            {seat && state.dealerSeat === seat.seat && <Dealer />}
        </span>
        <Fan cards={seat?.cardsLeft ?? 0} />
        {lastCall && <CallChip bid={lastCall} />}
        <Announced said={announced} />
    </div>
);

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
                style={{ '--fan-step': i - (cards - 1) / 2 } as React.CSSProperties}
            />
        ))}
    </span>
);

/**
 * Who is dealing, as the marker that sits by their elbow at a table.
 *
 * A round counter rather than the word: it holds for the whole hand and is
 * read once, so it does not want the same room as what somebody has just
 * announced. As a word on a line of its own it put three labels under one
 * player and turned the seat into a list.
 */
const Dealer: React.FC = () => (
    <span className="belot__dealer" role="img" aria-label="раздава">Р</span>
);

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
        {bid.kind === 'BID' && bid.contract
            ? <ContractMark contract={bid.contract} />
            : callLabel(bid)}
    </span>
);

/**
 * Who the table is waiting for, and for how much longer.
 *
 * Always on screen, so the row does not jump when the turn comes round to
 * this player — only what it says changes. Borrowed whole from santase: the
 * same pill, the same dot, the same red under the last few seconds.
 */
const TurnClock: React.FC<{
    state: BelotState;
    toAct: BelotSeatName | null;
    yours: boolean;
    secondsLeft: number | null;
}> = ({ state, toAct, yours, secondsLeft }) => {
    const urgent = yours && secondsLeft !== null && secondsLeft <= URGENT_SECONDS;
    const waitingFor = state.seats.find((seat) => seat.seat === toAct)?.username;

    return (
        <span
            className={`turn-pill ${urgent ? 'turn-pill--urgent' : ''}`}
            role="status"
            aria-live="polite"
        >
            <span
                className="turn-pill__dot"
                style={{
                    background: yours
                        ? (urgent ? 'var(--danger)' : 'var(--success)')
                        : 'var(--text-3)',
                }}
            />
            {yours ? <span>Ваш ред</span> : waitingFor
                ? <span className="belot__waiting-for">Чакаме {waitingFor}</span>
                : <span>Раздаваме</span>}
            {secondsLeft !== null && (
                <span className="belot__clock tabular">{secondsLeft}с</span>
            )}
        </span>
    );
};

/** The cards on the table, each shown at the seat that played it. */
const Trick: React.FC<{ state: BelotState }> = ({ state }) => {
    const play = state.play!;
    const taker = play.wonBy
        ? state.seats.find((seat) => seat.seat === play.wonBy)?.username
        : null;

    return (
        <div className="belot__trick">
            {/* How far through the hand the table is. The contract itself is on
                the score plate, where it stays for the whole hand. */}
            <p className="belot__count belot__count--trick">ръка {play.trickNo}/8</p>
            <div className="belot__played">
                {play.onTable.map((played) => (
                    <span
                        key={played.seat}
                        className={[
                            'belot__played-card',
                            `belot__played-card--${placeOf(played.seat, state.yourSeat)}`,
                            play.wonBy === played.seat ? 'is-taken' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        <BelotCardFace card={played.card} size="table" />
                    </span>
                ))}
            </div>
            {/* Said as well as marked: the ring on the winning card is the
                quick read, the name is the one that settles it. The line keeps
                its height while the trick is still out, so the hand below does
                not hop up and down once per trick. */}
            <p className="belot__took">{taker ? `Ръката е на ${taker}` : ' '}</p>
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
