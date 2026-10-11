import React, { useEffect, useState } from 'react';
import { adminService } from '../../api/adminService';
import { isSessionExpired } from '../../api/apiClient';
import { AdminGameDetail, AdminPlayerDetail, AdminPlayerRow, Scope } from '../../types/admin.types';
import { GAMES } from '../lobby/gameCatalogue';
import { RankMedal, rankName } from '../RankBadge';
import Choice from '../ui/Choice';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import Note from '../ui/Note';
import { PlayerMarks } from './AdminPlayers';
import ConfirmChange, { PendingChange } from './ConfirmChange';

const ACCESS: { value: Scope; label: string }[] = [
    { value: 'PUBLIC', label: 'Обикновен играч' },
    { value: 'BETA', label: 'Бета тестер' },
];

const day = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
const moment = new Intl.DateTimeFormat('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function when(iso: string | null, format: Intl.DateTimeFormat): string {
    return iso ? format.format(new Date(iso)) : '—';
}

/** The question for changing a player's access, naming the player. */
function accessChange(username: string, scope: Scope, run: () => void): PendingChange {
    return scope === 'BETA'
        ? {
            title: `Направи ${username} бета тестер?`,
            text: `${username} ще вижда и игрите, които са отворени само за бета тестерите.`,
            confirmLabel: 'Направи бета',
            run,
        }
        : {
            title: `Върни ${username} като обикновен играч?`,
            text: `${username} вече няма да вижда игрите само за бета тестерите. Игра, която вече е започнал, ще може да довърши.`,
            confirmLabel: 'Върни',
            danger: true,
            run,
        };
}

interface AdminPlayerSheetProps {
    username: string;
    onClose: () => void;
    /** The account as it is after a change made here, for the list behind. */
    onChanged: (row: AdminPlayerRow) => void;
}

/**
 * One player, the way the profile shows a player to themselves — the same
 * sheet, the same records — with what only an admin sees added: their email,
 * whether they are a tester, the game they are in now and their last games.
 */
const AdminPlayerSheet: React.FC<AdminPlayerSheetProps> = ({ username, onClose, onChanged }) => {
    const [detail, setDetail] = useState<AdminPlayerDetail | null>(null);
    const [failed, setFailed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState<'ok' | 'failed' | null>(null);
    const [pending, setPending] = useState<PendingChange | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        adminService.player(username, controller.signal)
            .then(setDetail)
            .catch((error) => {
                if (!controller.signal.aborted && !isSessionExpired(error)) setFailed(true);
            });
        return () => controller.abort();
    }, [username]);

    const setAccess = (scope: Scope) => {
        setSaving(true);
        setSaved(null);
        adminService.setScope(username, scope)
            .then((row) => {
                setDetail((current) => (current ? { ...current, account: row } : current));
                onChanged(row);
                setSaved('ok');
            })
            .catch(() => setSaved('failed'))
            .finally(() => setSaving(false));
    };

    return (
        <Modal title="Играч" width="wide" onClose={onClose}>
            <div className="lobby profile admin-sheet">
                {failed ? (
                    <Note tone="error">Данните за {username} не се заредиха. Затвори и опитай пак.</Note>
                ) : !detail ? (
                    <div className="profile__id" aria-busy="true">
                        <div className="admin-sheet__ghost">
                            <div className="skeleton admin-sheet__ghost-name" />
                            <div className="skeleton admin-sheet__ghost-line" />
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="profile__id">
                            <div className="profile__who">
                                <h3 className="profile__name">{detail.account.username}</h3>
                                <p className="profile__email">
                                    <span>{detail.account.email}</span>
                                    {detail.account.emailConfirmed ? (
                                        <span className="profile__email-state profile__email-state--ok">
                                            <Icon name="checkCircle" /> Потвърден
                                        </span>
                                    ) : (
                                        <span className="profile__email-state profile__email-state--bad">
                                            <Icon name="warning" /> Непотвърден
                                        </span>
                                    )}
                                </p>
                                <p className="admin-sheet__since">
                                    Регистриран на {when(detail.account.createdAt, day)}
                                </p>
                                <PlayerMarks player={detail.account} />
                            </div>
                        </div>

                        <div className="admin-sheet__access">
                            <Choice
                                legend="Достъп"
                                options={ACCESS}
                                value={detail.account.scope}
                                disabled={saving}
                                onChange={(scope) => setPending(accessChange(username, scope, () => setAccess(scope)))}
                            />
                            {saved === 'ok' && (
                                <Note tone="success">
                                    {detail.account.scope === 'BETA'
                                        ? 'Вече вижда и бета игрите.'
                                        : 'Вече вижда само игрите за всички.'}
                                </Note>
                            )}
                            {saved === 'failed' && <Note tone="error">Достъпът не е променен. Опитай отново.</Note>}
                        </div>

                        <div className="profile__games">
                            {detail.games.map((game) => <GameDetail key={game.code} game={game} />)}
                        </div>
                    </>
                )}
            </div>
            {pending && <ConfirmChange change={pending} onClose={() => setPending(null)} />}
        </Modal>
    );
};

/** One game's record, then the game they are in, then their last games. */
const GameDetail: React.FC<{ game: AdminGameDetail }> = ({ game }) => {
    const title = GAMES.find((card) => card.key === game.code)?.title ?? game.code;
    const { record } = game;

    return (
        <section className="record" aria-label={title}>
            <div className="record__head">
                <h4 className="record__game">{title}</h4>
                <span className="record__rank">
                    <RankMedal rank={record.rank} size="small" />
                    {rankName(record.rank)}
                </span>
            </div>

            <dl className="record__nums">
                <div className="record__num"><dt>Победи</dt><dd>{record.wins}</dd></div>
                <div className="record__num"><dt>Загуби</dt><dd>{record.losses}</dd></div>
                <div className="record__num"><dt>Рейтинг</dt><dd>{record.rating}</dd></div>
            </dl>

            {game.activeGameId && (
                <p className="admin-live">
                    <span className="admin-live__dot" aria-hidden="true" /> Играе в момента
                </p>
            )}

            {game.recent.length === 0 ? (
                <p className="record__note">Още няма завършени игри.</p>
            ) : (
                <ol className="admin-recent" aria-label={`Последни игри на ${title}`}>
                    {game.recent.map((row) => (
                        <li key={row.gameId} className="admin-recent__row">
                            <span className="admin-recent__when">{when(row.finishedAt, moment)}</span>
                            <span className="admin-recent__with">{row.others.join(', ')}</span>
                            <span className={`admin-recent__result admin-recent__result--${row.won ? 'won' : 'lost'}`}>
                                {row.won ? 'Победа' : row.surrendered ? 'Предаде' : 'Загуба'}
                            </span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
};

export default AdminPlayerSheet;
