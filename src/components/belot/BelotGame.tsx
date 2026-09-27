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
import Icon from '../ui/Icon';
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

    const seats = useMemo(() => {
        const byPlace = new Map<Place, BelotSeatView>();
        state?.seats.forEach((seat) => byPlace.set(placeOf(seat.seat, state.yourSeat), seat));
        return byPlace;
    }, [state]);

    if (unavailable) {
        noteUnavailable('BELOT');
        navigate('/', { replace: true });
        return null;
    }

    if (!state) {
        return (
            <StatusScreen
                tone="info"
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
    const ourTeam = state.seats.find((seat) => seat.seat === state.yourSeat)?.team ?? 'NORTH_SOUTH';
    const theirTeam = ourTeam === 'NORTH_SOUTH' ? 'EAST_WEST' : 'NORTH_SOUTH';

    return (
        <main className="screen belot">
            <header className="belot__bar">
                <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => navigate('/')}>
                    Игри
                </Button>
                <button
                    type="button"
                    className="belot__score"
                    onClick={() => setSheetOpen(true)}
                    aria-label="Виж резултата ръка по ръка"
                >
                    <span>
                        <span className="belot__side">ние</span>
                        <span className="belot__points">{scoreOf(state, ourTeam)}</span>
                    </span>
                    <span>
                        <span className="belot__side">те</span>
                        <span className="belot__points">{scoreOf(state, theirTeam)}</span>
                    </span>
                    {state.hangingPoints > 0 && (
                        <span className="belot__hanging">висящи {state.hangingPoints}</span>
                    )}
                </button>
            </header>

            <div className="belot__table">
                {(['partner', 'left', 'right'] as Place[]).map((place) => (
                    <Opponent
                        key={place}
                        place={place}
                        seat={seats.get(place)}
                        toAct={toAct}
                        secondsLeft={secondsLeft}
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
                {you && (
                    <p className="belot__you">
                        {you.username}
                        {state.dealerSeat === you.seat && <span className="belot__tag">раздава</span>}
                        {toAct === you.seat && (
                            <>
                                <span className="belot__tag belot__tag--turn">ваш ред</span>
                                {secondsLeft !== null && (
                                    <span className="belot__clock">{secondsLeft}с</span>
                                )}
                            </>
                        )}
                    </p>
                )}
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

const Opponent: React.FC<{
    place: Place;
    seat?: BelotSeatView;
    toAct: BelotSeatName | null;
    secondsLeft: number | null;
    state: BelotState;
}> = ({ place, seat, toAct, secondsLeft, state }) => (
    <div className={`belot__seat belot__seat--${place} ${seat && toAct === seat.seat ? 'is-turn' : ''}`}>
        <span className="belot__name">{seat?.username ?? '—'}</span>
        <span className="belot__backs" aria-label={`${seat?.cardsLeft ?? 0} карти`}>
            {Array.from({ length: seat?.cardsLeft ?? 0 }).map((_, i) => (
                <span key={i} className="card-back" aria-hidden="true" />
            ))}
        </span>
        {seat && toAct === seat.seat && secondsLeft !== null && (
            <span className="belot__clock" aria-label={`остават ${secondsLeft} секунди`}>
                {secondsLeft}с
            </span>
        )}
        {seat && state.dealerSeat === seat.seat && <span className="belot__tag">раздава</span>}
    </div>
);

/** The cards on the table, each shown at the seat that played it. */
const Trick: React.FC<{ state: BelotState }> = ({ state }) => {
    const play = state.play!;
    const taker = play.wonBy
        ? state.seats.find((seat) => seat.seat === play.wonBy)?.username
        : null;

    return (
        <div className="belot__trick">
            <p className="belot__contract">
                <ContractMark contract={play.contract} />
                <span className="belot__count">{play.trickNo}/8 ръце</span>
            </p>
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
                quick read, the name is the one that settles it. */}
            {taker && <p className="belot__took">Ръката е на {taker}</p>}
        </div>
    );
};

/** What has been said, and what this player may say. */
const Bidding: React.FC<{ state: BelotState }> = ({ state }) => {
    const bidding = state.bidding;
    if (!bidding) return null;

    const yours = bidding.yours;

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

            {yours.length > 0 ? (
                <div className="belot__calls">
                    {yours.map((bid) => (
                        <button
                            key={`${bid.kind}-${bid.contract ?? ''}`}
                            type="button"
                            className={callClass(bid)}
                            onClick={() => { void belotService.bid(bid.kind, bid.contract ?? undefined); }}
                        >
                            {bid.kind === 'BID' && bid.contract && NAMES_A_SUIT.includes(bid.contract) && (
                                <ContractMark contract={bid.contract} />
                            )}{' '}
                            {callLabel(bid)}
                        </button>
                    ))}
                </div>
            ) : (
                <p className="belot__waiting">
                    <Icon name="clock" size={18} />
                    Чакаме {state.seats.find((seat) => seat.seat === bidding.toAct)?.username}
                </p>
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
