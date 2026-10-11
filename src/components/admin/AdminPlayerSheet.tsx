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
    { value: 'PUBLIC', label: 'Обикновен' },
    { value: 'BETA', label: 'Тест' },
];

const two = (n: number) => String(n).padStart(2, '0');

/** 25.09.2026 г. — the way a date is written in Bulgarian. */
function day(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${two(d.getDate())}.${two(d.getMonth() + 1)}.${d.getFullYear()} г.`;
}

/** 25.09.2026 г., 14:30 */
function moment(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${day(iso)}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** The question for changing a player's access, naming the player. */
function accessChange(username: string, scope: Scope, run: () => void): PendingChange {
    return scope === 'BETA'
        ? {
            title: `Дай тест достъп на ${username}?`,
            text: `${username} ще вижда и игрите, които още не са отворени за всички.`,
            confirmLabel: 'Дай достъп',
            run,
        }
        : {
            title: `Махни тест достъпа на ${username}?`,
            text: `${username} ще вижда само игрите, отворени за всички. Игра, която вече е започнал, ще може да довърши.`,
            confirmLabel: 'Махни',
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
                                    Регистриран на {day(detail.account.createdAt)}
                                </p>
                                {/* Only when there is a date: an account not seen since the
                                    server began keeping it simply has no such line. */}
                                {detail.account.lastLoginAt && (
                                    <p className="admin-sheet__since">
                                        Влизал за последно на {moment(detail.account.lastLoginAt)}
                                    </p>
                                )}
                                {/* The email line above already says whether it is confirmed,
                                    and the access choice below says which games they see. */}
                                <PlayerMarks player={detail.account} email={false} access={false} />
                            </div>
                        </div>

                        <div className="admin-sheet__access">
                            <Choice
                                legend="Достъп до игрите"
                                options={ACCESS}
                                value={detail.account.scope}
                                disabled={saving}
                                onChange={(scope) => setPending(accessChange(username, scope, () => setAccess(scope)))}
                            />
                            {saved === 'ok' && (
                                <Note tone="success">
                                    {detail.account.scope === 'BETA'
                                        ? 'Вече вижда и игрите с тест достъп.'
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
                            <span className="admin-recent__when">{moment(row.finishedAt)}</span>
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
