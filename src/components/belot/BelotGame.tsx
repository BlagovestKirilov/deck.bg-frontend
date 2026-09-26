import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { belotService } from '../../api/belotService';
import { noteUnavailable } from '../../api/unavailable';
import { useBelotTable } from '../../hooks/useBelotTable';
import {
    BelotBidView,
    BelotContract,
    BelotSeatName,
    BelotSeatView,
    BelotState,
} from '../../types/belot.types';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import StatusScreen from '../ui/StatusScreen';
import BelotCardFace from './BelotCardFace';
import '../../styles/belot.css';

/** Play runs counter-clockwise, so the seat after yours sits to your right. */
const ORDER: BelotSeatName[] = ['NORTH', 'WEST', 'SOUTH', 'EAST'];

const CONTRACT_LABEL: Record<BelotContract, string> = {
    CLUBS: '♣ спатия',
    DIAMONDS: '♦ каро',
    HEARTS: '♥ купа',
    SPADES: '♠ пика',
    NO_TRUMPS: 'без коз',
    ALL_TRUMPS: 'всичко коз',
};

/** Where each seat is drawn, once the table is turned so you are at the bottom. */
type Place = 'you' | 'right' | 'partner' | 'left';

function placeOf(seat: BelotSeatName, you: BelotSeatName | null): Place {
    if (!you) return 'partner';
    const steps = (ORDER.indexOf(seat) - ORDER.indexOf(you) + ORDER.length) % ORDER.length;
    return (['you', 'right', 'partner', 'left'] as Place[])[steps];
}

function labelOf(bid: BelotBidView): string {
    switch (bid.kind) {
        case 'PASS': return 'Пас';
        case 'CONTRA': return 'Контра';
        case 'RECONTRA': return 'Реконтра';
        case 'BID': return bid.contract ? CONTRACT_LABEL[bid.contract] : 'Обявявам';
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
        const waiting = state.seats.length;
        return (
            <StatusScreen
                tone="info"
                icon="cards"
                title="Чакаме още играчи"
                message={`${waiting} от 4 на масата.`}
                secondaryLabel="Игри"
                onSecondary={() => navigate('/')}
            />
        );
    }

    const you = seats.get('you');
    const toAct = state.play?.toAct ?? state.bidding?.toAct ?? null;

    return (
        <main className="screen belot">
            <header className="belot__bar">
                <Button variant="ghost" size="sm" icon="arrowLeft" onClick={() => navigate('/')}>
                    Игри
                </Button>
                <p className="belot__score">
                    <span>Ние {state.northSouthScore}</span>
                    <span aria-hidden="true">·</span>
                    <span>Те {state.eastWestScore}</span>
                    {state.hangingPoints > 0 && <span className="belot__hanging">висящи {state.hangingPoints}</span>}
                </p>
            </header>

            <div className="belot__table">
                {(['partner', 'left', 'right'] as Place[]).map((place) => (
                    <Opponent key={place} place={place} seat={seats.get(place)} toAct={toAct} state={state} />
                ))}

                <div className="belot__middle">
                    {state.play
                        ? <Trick state={state} />
                        : <Bidding state={state} />}
                </div>
            </div>

            <section className="belot__hand" aria-label="Вашите карти">
                {you && (
                    <p className="belot__you">
                        {you.username}
                        {state.dealerSeat === you.seat && <span className="belot__tag">раздава</span>}
                        {toAct === you.seat && <span className="belot__tag belot__tag--turn">ваш ред</span>}
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
        </main>
    );
};

const Opponent: React.FC<{
    place: Place;
    seat?: BelotSeatView;
    toAct: BelotSeatName | null;
    state: BelotState;
}> = ({ place, seat, toAct, state }) => (
    <div className={`belot__seat belot__seat--${place} ${seat && toAct === seat.seat ? 'is-turn' : ''}`}>
        <span className="belot__name">{seat?.username ?? '—'}</span>
        <span className="belot__backs" aria-label={`${seat?.cardsLeft ?? 0} карти`}>
            {Array.from({ length: seat?.cardsLeft ?? 0 }).map((_, i) => (
                <span key={i} className="belot__back" aria-hidden="true" />
            ))}
        </span>
        {seat && state.dealerSeat === seat.seat && <span className="belot__tag">раздава</span>}
    </div>
);

/** The cards on the table, each shown at the seat that played it. */
const Trick: React.FC<{ state: BelotState }> = ({ state }) => (
    <div className="belot__trick">
        <p className="belot__contract">
            {CONTRACT_LABEL[state.play!.contract]} · ръка {state.dealNumber} · ръцете {state.play!.trickNo}/8
        </p>
        <div className="belot__played">
            {state.play!.onTable.map((played) => (
                <span
                    key={`${played.seat}`}
                    className={`belot__played-card belot__played-card--${placeOf(played.seat, state.yourSeat)}`}
                >
                    <BelotCardFace card={played.card} size="table" />
                </span>
            ))}
        </div>
    </div>
);

/** What has been said, and what this player may say. */
const Bidding: React.FC<{ state: BelotState }> = ({ state }) => {
    const bidding = state.bidding;
    if (!bidding) return null;

    const yours = bidding.yours;

    return (
        <div className="belot__bidding">
            <p className="belot__contract">
                {bidding.highestBid
                    ? `${CONTRACT_LABEL[bidding.highestBid]}${bidding.doubling !== 'NONE' ? ` · ${bidding.doubling === 'CONTRA' ? 'контра' : 'реконтра'}` : ''}`
                    : 'Още никой не е обявил'}
            </p>

            {yours.length > 0 ? (
                <div className="belot__calls">
                    {yours.map((bid) => (
                        <button
                            key={`${bid.kind}-${bid.contract ?? ''}`}
                            type="button"
                            className={`belot__call ${bid.kind === 'PASS' ? 'belot__call--pass' : ''}`}
                            onClick={() => { void belotService.bid(bid.kind, bid.contract ?? undefined); }}
                        >
                            {labelOf(bid)}
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

export default BelotGame;
