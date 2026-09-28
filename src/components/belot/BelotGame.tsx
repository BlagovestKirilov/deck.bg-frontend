import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { belotService } from '../../api/belotService';
import { noteUnavailable } from '../../api/unavailable';
import { useBelotTable } from '../../hooks/useBelotTable';
import { useCountdown } from '../../hooks/useCountdown';
import {
    BelotBidView,
    BelotContract,
    BelotSeatName,
    BelotSeatView,
    BelotTeam,
    BelotState,
} from '../../types/belot.types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import StatusScreen from '../ui/StatusScreen';
import BelotCardFace from './BelotCardFace';
import BelotDeclarations from './BelotDeclarations';
import BelotResult from './BelotResult';
import BelotScoreSheet from './BelotScoreSheet';
import { ContractMark } from './ContractMark';
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

/** The two calls that name no suit are spoken, not printed. */
const NAMES_A_SUIT: BelotContract[] = ['CLUBS', 'DIAMONDS', 'HEARTS', 'SPADES'];

/** Under this many seconds the clock is the thing to look at, so it turns red. */
const URGENT_SECONDS = 6;

/** Where each seat is drawn, once the table is turned so you are at the bottom. */
type Place = 'you' | 'right' | 'partner' | 'left';

function placeOf(seat: BelotSeatName, you: BelotSeatName | null): Place {
    if (!you) return 'partner';
    const steps = (ORDER.indexOf(seat) - ORDER.indexOf(you) + ORDER.length) % ORDER.length;
    return (['you', 'right', 'partner', 'left'] as Place[])[steps];
}

/** How a call is drawn: printed on card stock, or spoken on the felt. */
function callClass(bid: BelotBidView): string {
    if (bid.kind === 'PASS') return 'belot__call belot__call--pass';
    if (bid.kind !== 'BID') return 'belot__call belot__call--double';
    return bid.contract && NAMES_A_SUIT.includes(bid.contract)
        ? 'belot__call'
        : 'belot__call belot__call--spoken';
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

    const you = seats.get('you');
    const toAct = state.play?.toAct ?? state.bidding?.toAct ?? null;
    const partner = seats.get('partner');
    const ourTeam = state.seats.find((seat) => seat.seat === state.yourSeat)?.team ?? 'NORTH_SOUTH';
    const theirTeam = ourTeam === 'NORTH_SOUTH' ? 'EAST_WEST' : 'NORTH_SOUTH';

    return (
        <main className="screen belot">
            <header className="belot__bar">
                <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => navigate('/')}>
                    Игри
                </Button>
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
                        <span className="belot__side">те</span>
                        <span className="belot__points">{scoreOf(state, theirTeam)}</span>
                    </span>
                    {state.hangingPoints > 0 && (
                        <span className="belot__hanging">висящи {state.hangingPoints}</span>
                    )}
                </button>
                {state.status !== 'FINISHED' && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmGiveUp(true)}>
                        Предай
                    </Button>
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
                        state={state}
                    />
                ))}

                <div className="belot__middle">
                    {state.play
                        ? <Trick state={state} />
                        : <Bidding state={state} />}
                    <BelotDeclarations state={state} ourTeam={ourTeam} />
                </div>
            </div>

            <section className="belot__hand" aria-label="Вашите карти">
                {/* One clock for the table, and it sits with the hand it is
                    counting down. Four seats each showing their own was four
                    numbers to ignore and one to find. */}
                <div className="belot__hand-head">
                    {you && (
                        <p className="belot__you">
                            <span className="belot__you-name">{you.username}</span>
                            {lastCalls.get(you.seat) && (
                                <CallChip bid={lastCalls.get(you.seat)!} />
                            )}
                            {state.dealerSeat === you.seat && <span className="belot__tag">раздава</span>}
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
                    {state.yourHand.map((card) => {
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
    state: BelotState;
}> = ({ place, seat, toAct, lastCall, state }) => (
    <div className={`belot__seat belot__seat--${place} ${seat && toAct === seat.seat ? 'is-turn' : ''}`}>
        <span className="belot__name">{seat?.username ?? 'свободно'}</span>
        <span className="belot__backs" aria-label={`${seat?.cardsLeft ?? 0} карти`}>
            {Array.from({ length: seat?.cardsLeft ?? 0 }).map((_, i) => (
                <span key={i} className="card-back" aria-hidden="true" />
            ))}
        </span>
        {lastCall && <CallChip bid={lastCall} />}
        {seat && state.dealerSeat === seat.seat && <span className="belot__tag">раздава</span>}
    </div>
);

/**
 * What a seat said, kept at that seat for as long as the auction runs.
 *
 * A named suit is its glyph, the way it is printed on the card that was
 * called; everything else is the word, the way it is said out loud.
 */
const CallChip: React.FC<{ bid: BelotBidView }> = ({ bid }) => {
    const suited = bid.kind === 'BID' && bid.contract && NAMES_A_SUIT.includes(bid.contract);

    return (
        <span className={`belot__said belot__said--${bid.kind.toLowerCase()}`}>
            {suited ? <ContractMark contract={bid.contract!} /> : callLabel(bid)}
        </span>
    );
};

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
            <div className="belot__played">
                {/* The four cards land at the four edges, so the corner is the
                    one part of the square nothing is ever put on. What was
                    called goes there rather than above the square, where it
                    pushed the table a card's height off centre. */}
                <p className="belot__contract belot__contract--corner">
                    <ContractMark contract={play.contract} />
                    <span className="belot__count">{play.trickNo}/8</span>
                </p>
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
 * What has been said, and what this player may say.
 *
 * The calls are laid out the way they are ranked rather than in one wrapping
 * row: the four suits together on their own line, the two that beat all of
 * them under it, and the answers — pass, contra — last and apart. A player
 * choosing a call is choosing along that ladder, so the buttons are set out
 * as the ladder.
 */
const Bidding: React.FC<{ state: BelotState }> = ({ state }) => {
    const bidding = state.bidding;
    if (!bidding) return null;

    const suits = bidding.yours.filter(
        (bid) => bid.kind === 'BID' && bid.contract && NAMES_A_SUIT.includes(bid.contract));
    const spoken = bidding.yours.filter(
        (bid) => bid.kind === 'BID' && bid.contract && !NAMES_A_SUIT.includes(bid.contract));
    const answers = bidding.yours.filter((bid) => bid.kind !== 'BID');

    const call = (bid: BelotBidView) => (
        <button
            key={`${bid.kind}-${bid.contract ?? ''}`}
            type="button"
            className={callClass(bid)}
            aria-label={bid.kind === 'BID' ? `Обяви ${callLabel(bid)}` : callLabel(bid)}
            onClick={() => { void belotService.bid(bid.kind, bid.contract ?? undefined); }}
        >
            {bid.kind === 'BID' && bid.contract && NAMES_A_SUIT.includes(bid.contract) ? (
                <ContractMark contract={bid.contract} />
            ) : (
                callLabel(bid)
            )}
        </button>
    );

    return (
        <div className="belot__bidding">
            {bidding.highestBid ? (
                <p className="belot__contract">
                    <ContractMark contract={bidding.highestBid} />
                    <span>{CALL_WORD[bidding.highestBid]}</span>
                    {bidding.doubling !== 'NONE' && (
                        <span className="belot__doubled">
                            {bidding.doubling === 'CONTRA' ? 'контра' : 'реконтра'}
                        </span>
                    )}
                </p>
            ) : (
                <p className="belot__contract belot__contract--none">Още никой не е обявил</p>
            )}

            {bidding.yours.length > 0 && (
                <div className="belot__calls">
                    {suits.length > 0 && <div className="belot__calls-row">{suits.map(call)}</div>}
                    {spoken.length > 0 && <div className="belot__calls-row">{spoken.map(call)}</div>}
                    {answers.length > 0 && (
                        <div className="belot__calls-row belot__calls-row--answers">
                            {answers.map(call)}
                        </div>
                    )}
                </div>
            )}
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
