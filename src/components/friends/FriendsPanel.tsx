import React, { useEffect, useRef, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Icon from '../ui/Icon';
import { RankMedal, rankName } from '../RankBadge';
import { friendService } from '../../api/friendService';
import { Friends } from '../../hooks/useFriends';
import {
    ChallengeGame, FriendRelation, FriendSearchHit, FriendSearchResponse, FriendView,
} from '../../types/friends.types';
import { GAMES } from '../lobby/gameCatalogue';

/** Friends on one page of the list: more would push the rest off a phone's screen. */
const PER_PAGE = 5;

/** The games a friend can be challenged to, in the catalogue's order. */
const CHALLENGE_GAMES: ChallengeGame[] = ['SANTASE', 'TABLA'];

const titleOf = (key: string) => GAMES.find((game) => game.key === key)?.title ?? key;

/**
 * A found player's request waiting either way, as an orange tag beside their
 * name. Nothing between you, nothing said.
 */
const PENDING_TAG: Record<FriendRelation, string | null> = {
    NONE: null,
    SENT: 'чака потвърждение',
    RECEIVED: 'очаква вашия отговор',
};

/**
 * What the one button does for the player picked, said with their name, and
 * whether it can: nobody picked yet, a request to send, one of theirs to
 * accept, or one of yours already out.
 */
function actionFor(hit: FriendSearchHit | undefined): { label: string; enabled: boolean } {
    switch (hit?.relation) {
        case 'SENT': return { label: `Поканата до ${hit.username} е изпратена`, enabled: false };
        case 'RECEIVED': return { label: `Приеми поканата на ${hit.username}`, enabled: true };
        case 'NONE': return { label: `Изпрати покана на ${hit.username}`, enabled: true };
        default: return { label: 'Изберете играч', enabled: false };
    }
}

/** The shortest name a search is sent for: fewer letters would list half the players. */
const SEARCH_MIN = 3;

type Run = (change: () => ReturnType<typeof friendService.page>) => Promise<boolean>;

interface FriendsPanelProps {
    friends: Friends;
    /** The games on offer to this player; a challenge is only to one of them. */
    offered: string[];
    onClose: () => void;
}

/**
 * Friends, in two views on the lobby's card stock. The list first — who is
 * waiting for your answer, your friends five to a page with who is here and
 * how each ranks, the requests you sent — and under it the button to add
 * somebody new. Adding is a view of its own. Inviting a friend to a game and
 * removing one each open a dialog of their own over the list.
 */
const FriendsPanel: React.FC<FriendsPanelProps> = ({ friends, offered, onClose }) => {
    const { page, act } = friends;
    const [view, setView] = useState<'list' | 'add'>('list');
    const [error, setError] = useState<string | null>(null);
    const [pageNo, setPageNo] = useState(0);
    const [inviting, setInviting] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);

    /** Runs a change; true when it went through. */
    const run: Run = async (change) => {
        const failed = await act(change);
        setError(failed);
        return failed === null;
    };

    const show = (next: 'list' | 'add') => {
        setError(null);
        setView(next);
    };

    const challengeable = GAMES.filter((game) => CHALLENGE_GAMES.includes(game.key as ChallengeGame)
        && offered.includes(game.key));
    const waitingOnSomeone = !!page?.outgoingChallenge;

    // Five to a page. A page left empty — the last friend on it removed —
    // falls back to the one before.
    const all = page?.friends ?? [];
    const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
    const current = Math.min(pageNo, pages - 1);
    const shown = all.slice(current * PER_PAGE, current * PER_PAGE + PER_PAGE);

    return (
        <>
            <Modal
                title={view === 'list' ? 'Приятели' : 'Добави приятел'}
                onClose={onClose}
                className="lobby sheet friends"
            >
                <div className="friends__body">
                    {view === 'add' ? (
                        <AddFriend run={run} error={error} onBack={() => show('list')} onSent={() => show('list')} />
                    ) : (
                        <>
                            {error && <p className="friends__error" role="alert">{error}</p>}

                            {/* The game this player invited a friend to, waiting: why
                                every Покани is off until it is answered, and the way
                                to take it back. */}
                            {page?.outgoingChallenge && (
                                <div className="friends__waiting" role="status">
                                    <span className="spinner" aria-hidden="true" />
                                    <span className="friends__waiting-text">
                                        Чакате <strong>{page.outgoingChallenge.to}</strong> да приеме
                                        играта на {titleOf(page.outgoingChallenge.game)}.
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => void run(() => friendService.cancelChallenge(page.outgoingChallenge!.id))}
                                    >
                                        Оттегли
                                    </Button>
                                </div>
                            )}

                            {/* Requests waiting for this player's answer: first, and orange. */}
                            {!!page?.incoming.length && (
                                <section className="friends__section friends__section--pending" aria-labelledby="friends-incoming">
                                    <h3 id="friends-incoming" className="friends__heading">Чакат вашия отговор</h3>
                                    <ul className="friends__list">
                                        {page.incoming.map((request) => (
                                            <li key={request.id} className="friends__row">
                                                <span className="friends__name truncate">{request.username}</span>
                                                <span className="friends__actions">
                                                    <Button size="sm" variant="ghost"
                                                            onClick={() => void run(() => friendService.decline(request.id))}>
                                                        Откажи
                                                    </Button>
                                                    <Button size="sm" variant="primary"
                                                            onClick={() => void run(() => friendService.accept(request.id))}>
                                                        Приеми
                                                    </Button>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            <section className="friends__section" aria-labelledby="friends-list">
                                <h3 id="friends-list" className="friends__heading">
                                    Приятели{page ? ` (${all.length})` : ''}
                                </h3>
                                {page && all.length === 0 && (
                                    <p className="friends__empty">
                                        Още нямате приятели. Добавете играч по името му — щом приеме,
                                        ще можете да играете заедно.
                                    </p>
                                )}
                                <ul className="friends__list">
                                    {shown.map((friend) => (
                                        <FriendRow
                                            key={friend.username}
                                            friend={friend}
                                            canInvite={!waitingOnSomeone && challengeable.length > 0}
                                            onInvite={() => setInviting(friend.username)}
                                            onRemove={() => setRemoving(friend.username)}
                                        />
                                    ))}
                                </ul>
                                {pages > 1 && (
                                    <nav className="friends__pager" aria-label="Страници с приятели">
                                        <Button size="sm" variant="ghost" icon="arrowLeft"
                                                disabled={current === 0}
                                                aria-label="Предишна страница"
                                                onClick={() => setPageNo(current - 1)} />
                                        <span className="friends__pager-at tabular" aria-live="polite">
                                            {current + 1} от {pages}
                                        </span>
                                        <Button size="sm" variant="ghost" icon="arrowRight"
                                                disabled={current === pages - 1}
                                                aria-label="Следваща страница"
                                                onClick={() => setPageNo(current + 1)} />
                                    </nav>
                                )}
                            </section>

                            {/* Requests this player sent, waiting: orange, as everywhere. */}
                            {!!page?.outgoing.length && (
                                <section className="friends__section" aria-labelledby="friends-outgoing">
                                    <h3 id="friends-outgoing" className="friends__heading">Изпратени покани</h3>
                                    <ul className="friends__list">
                                        {page.outgoing.map((request) => (
                                            <li key={request.id} className="friends__row">
                                                <span className="friends__who">
                                                    <span className="friends__name truncate">{request.username}</span>
                                                    <span className="friends__tag friends__tag--pending">чака потвърждение</span>
                                                </span>
                                                <Button size="sm" variant="ghost"
                                                        onClick={() => void run(() => friendService.decline(request.id))}>
                                                    Оттегли
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            {/* Somebody new: under the list, where a list ends. */}
                            <Button variant="primary" icon="userPlus" block onClick={() => show('add')}>
                                Добави приятел
                            </Button>
                        </>
                    )}
                </div>
            </Modal>

            {inviting && (
                <InviteDialog
                    friend={inviting}
                    games={challengeable}
                    onClose={() => setInviting(null)}
                    onInvite={async (game) => {
                        const sent = await run(() => friendService.challenge(inviting, game));
                        // Sent: both dialogs give way to the bar that waits for
                        // the answer at the foot of the screen.
                        if (sent) {
                            setInviting(null);
                            onClose();
                        }
                        return sent;
                    }}
                    error={error}
                />
            )}

            {removing && (
                <Modal
                    title="Премахване на приятел"
                    width="narrow"
                    className="lobby sheet"
                    onClose={() => setRemoving(null)}
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => setRemoving(null)}>Отказ</Button>
                            <Button
                                variant="danger"
                                onClick={() => {
                                    const who = removing;
                                    setRemoving(null);
                                    void run(() => friendService.remove(who));
                                }}
                            >
                                Премахни
                            </Button>
                        </>
                    }
                >
                    <p className="sheet__text">
                        Да премахнем ли <strong>{removing}</strong> от приятелите ви? Няма да можете да
                        се каните на игра, докато не се добавите отново.
                    </p>
                </Modal>
            )}
        </>
    );
};

interface AddFriendProps {
    run: Run;
    error: string | null;
    onBack: () => void;
    /** A request went out, or one waiting was accepted: back to the list, where it shows. */
    onSent: () => void;
}

/**
 * Adding a friend: type the start of a name, pick the player from what it
 * finds — never yourself, never a friend already — and press the one button,
 * which says what it will do for them.
 */
const AddFriend: React.FC<AddFriendProps> = ({ run, error, onBack, onSent }) => {
    const [typed, setTyped] = useState('');
    // What the last search found: null until a name is long enough to look for.
    const [found, setFound] = useState<FriendSearchResponse | null>(null);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => { input.current?.focus(); }, []);

    // Search as the name is typed, a moment after the last key. What was found
    // stays up until the next answer comes, so the box does not flicker empty.
    const prefix = typed.trim();
    const foundRef = useRef(found);
    foundRef.current = found;
    useEffect(() => {
        if (prefix.length < SEARCH_MIN) {
            setFound(null);
            return undefined;
        }
        // A name picked from the list — or typed out as one of them — keeps
        // the list as it is, so another can still be picked without typing.
        const listed = foundRef.current?.players
            .some((hit) => hit.username.toLowerCase() === prefix.toLowerCase());
        if (listed) return undefined;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            friendService.search(prefix, controller.signal)
                .then((result) => { if (!controller.signal.aborted) setFound(result); })
                .catch(() => undefined);
        }, 250);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [prefix]);

    // The player the one button acts on: the name typed, once it is a name found.
    const picked = found?.players.find((hit) => hit.username.toLowerCase() === prefix.toLowerCase());
    const action = actionFor(picked);

    const submit = () => {
        if (!picked || !action.enabled) return;
        void run(() => friendService.request(picked.username)).then((sent) => { if (sent) onSent(); });
    };

    return (
        <>
            {/* The way back: a quiet link, not a second button competing with the one that matters. */}
            <button type="button" className="friends__back" onClick={onBack}>
                <Icon name="arrowLeft" size={16} />
                <span>Приятели</span>
            </button>
            <form
                className="friends__add"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                {/* A search, and it looks like one: the glass inside the field. */}
                <div className="friends__search">
                    <Field
                        ref={input}
                        label="Име на играча"
                        value={typed}
                        // A space before the name is never part of it.
                        onChange={(event) => setTyped(event.target.value.trimStart())}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        maxLength={64}
                        enterKeyHint="search"
                    />
                    <span className="friends__search-glass" aria-hidden="true"><Icon name="search" size={20} /></span>
                </div>

                {/* Always three rows tall, whatever it holds, so nothing moves
                    while the name is typed. */}
                <div className="friends__found" aria-live="polite">
                    {!found ? (
                        <FoundNote icon="search" line="Потърсете играч по името му" small="Напишете поне 3 букви." />
                    ) : found.players.length === 0 && !found.more ? (
                        <FoundNote icon="user" line={`Няма играч „${prefix}“`} small="Проверете името и опитайте отново." />
                    ) : found.players.length === 0 ? (
                        <FoundNote icon="search" line={`Твърде много играчи започват с „${prefix}“`} small="Напишете още букви." />
                    ) : (
                        <>
                            <ul className="friends__picks" aria-label="Намерени играчи">
                                {found.players.map((hit) => (
                                    <li key={hit.username}>
                                        <button
                                            type="button"
                                            className={`friends__pick ${hit === picked ? 'is-picked' : ''}`}
                                            aria-pressed={hit === picked}
                                            onClick={() => setTyped(hit.username)}
                                        >
                                            <span className="friends__pick-text">
                                                <span className="friends__name truncate">{hit.username}</span>
                                                {PENDING_TAG[hit.relation] && (
                                                    <span className="friends__tag friends__tag--pending">
                                                        {PENDING_TAG[hit.relation]}
                                                    </span>
                                                )}
                                            </span>
                                            {hit === picked && (
                                                <span className="friends__picked-mark" aria-hidden="true">
                                                    <Icon name="check" size={16} />
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {found.more && (
                                <p className="friends__found-more">Има и други с това начало — напишете още букви.</p>
                            )}
                        </>
                    )}
                </div>

                {error && <p className="friends__error" role="alert">{error}</p>}

                {/* The one button, under what it acts on, saying whom it is for. */}
                <Button type="submit" variant="primary" block icon={picked ? 'userPlus' : undefined}
                        disabled={!action.enabled} className="friends__send">
                    {action.label}
                </Button>
            </form>
        </>
    );
};

/** What the results box says when there are no results to show: a mark, a line, and what to do. */
const FoundNote: React.FC<{ icon: 'search' | 'user'; line: string; small: string }> = ({ icon, line, small }) => (
    <div className="friends__found-empty">
        <span className="friends__found-icon" aria-hidden="true"><Icon name={icon} size={22} /></span>
        <p className="friends__found-line">{line}</p>
        <p className="friends__found-small">{small}</p>
    </div>
);

interface InviteDialogProps {
    friend: string;
    games: typeof GAMES;
    onClose: () => void;
    /** Sends the invitation; true when it went out. */
    onInvite: (game: ChallengeGame) => Promise<boolean>;
    error: string | null;
}

/**
 * Inviting a friend to a game: each game as the hub draws it — its picture,
 * its name, how it is won — one tap to send. A friendly game: it moves no rank.
 */
const InviteDialog: React.FC<InviteDialogProps> = ({ friend, games, onClose, onInvite, error }) => {
    const [sending, setSending] = useState<ChallengeGame | null>(null);
    return (
        <Modal title={`Покани ${friend}`} width="narrow" className="lobby sheet invite" onClose={onClose}>
            <div className="invite__body">
                <p className="invite__lede">На коя игра? Приятелска е — не променя ранга.</p>
                <ul className="invite__games">
                    {games.map(({ key, title, tagline, Art }) => (
                        <li key={key}>
                            <button
                                type="button"
                                className="invite__game"
                                disabled={sending !== null}
                                aria-busy={sending === key}
                                onClick={async () => {
                                    setSending(key as ChallengeGame);
                                    const sent = await onInvite(key as ChallengeGame);
                                    if (!sent) setSending(null);
                                }}
                            >
                                <span className="invite__art"><Art /></span>
                                <span className="invite__text">
                                    <span className="invite__name">{title}</span>
                                    <span className="invite__rule">{tagline}</span>
                                </span>
                                {sending === key && <span className="spinner" aria-hidden="true" />}
                            </button>
                        </li>
                    ))}
                </ul>
                {error && <p className="friends__error" role="alert">{error}</p>}
            </div>
        </Modal>
    );
};

interface FriendRowProps {
    friend: FriendView;
    /** Off while a game you invited somebody to is still waiting, or none can be played. */
    canInvite: boolean;
    onInvite: () => void;
    onRemove: () => void;
}

/** Whether a friend is here, playing or away — said in words as well as the dot's colour. */
function presenceOf(friend: FriendView): { tone: 'here' | 'playing' | 'away'; text: string } {
    if (friend.playing) return { tone: 'playing', text: `Играе ${titleOf(friend.playing)}` };
    if (friend.online) return { tone: 'here', text: 'На линия' };
    return { tone: 'away', text: 'Извън линия' };
}

const FriendRow: React.FC<FriendRowProps> = ({ friend, canInvite, onInvite, onRemove }) => {
    const presence = presenceOf(friend);
    const free = friend.online && !friend.playing;
    const ranked = (['SANTASE', 'TABLA', 'BELOT'] as const)
        .filter((key) => friend.ranks[key])
        .map((key) => ({ key, stats: friend.ranks[key]! }));

    return (
        <li className="friends__row friends__row--friend">
            <span className={`friends__dot friends__dot--${presence.tone}`} aria-hidden="true" />
            <span className="friends__who">
                <span className="friends__name truncate">{friend.username}</span>
                <span className="friends__status">{presence.text}</span>
            </span>
            <span className="friends__ranks">
                {ranked.map(({ key, stats }) => (
                    <span key={key} className="friends__rank" title={`${titleOf(key)}: ${rankName(stats.rank)}`}>
                        <RankMedal rank={stats.rank} size="small" alt={`${titleOf(key)}: ${rankName(stats.rank)}`} />
                        {/* Which game the medal is for: a rank means nothing without it.
                            The name under it on a wide screen; its first letter on
                            the medal on a phone, where the row has to fit. */}
                        <span className="friends__rank-game" aria-hidden="true">{titleOf(key)}</span>
                        <span className="friends__rank-letter" aria-hidden="true">{titleOf(key).charAt(0)}</span>
                    </span>
                ))}
            </span>
            <span className="friends__actions">
                {/* Off while they cannot be asked: away, already playing, or a
                    game you invited somebody to is still waiting — the status
                    beside, or the strip above, says which. */}
                {/* The word on a wide screen; the play mark alone on a phone,
                    where the row needs the room for the name and the ranks. */}
                <Button size="sm" variant="secondary" icon="play" className="btn--icon-on-phone"
                        disabled={!free || !canInvite}
                        aria-label={`Покани ${friend.username} на игра`}
                        title="Покани на игра"
                        onClick={onInvite}>
                    Покани
                </Button>
                <Button size="sm" variant="ghost" icon="trash"
                        aria-label={`Премахни ${friend.username} от приятели`}
                        onClick={onRemove} />
            </span>
        </li>
    );
};

export default FriendsPanel;
