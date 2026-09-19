import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../api/userService';
import { GameKey, GameStats, ProfileResponse } from '../types/user.types';
import { useAuthContext } from '../context/AuthContext';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Field from './ui/Field';
import Note from './ui/Note';
import Icon from './ui/Icon';
import GameStatsCard from './GameStatsCard';

interface ProfilePageProps {
    username: string;
    onClose: () => void;
}

type PasswordErrors = Partial<Record<'currentPassword' | 'newPassword' | 'confirmPassword', string>>;

const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;

const ProfilePage: React.FC<ProfilePageProps> = ({ username, onClose }) => {
    const navigate = useNavigate();
    const { logout } = useAuthContext();

    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isResendingEmail, setIsResendingEmail] = useState(false);
    const [resendMessage, setResendMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [emailSent, setEmailSent] = useState(false);

    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
    const [passwordBanner, setPasswordBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const currentPwRef = useRef<HTMLInputElement>(null);
    const newPwRef = useRef<HTMLInputElement>(null);
    const confirmPwRef = useRef<HTMLInputElement>(null);
    const deletePwRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await userService.getProfile(controller.signal);
                if (!controller.signal.aborted) setProfile(data);
            } catch (err: any) {
                if (!controller.signal.aborted && err.name !== 'CanceledError' && !err.message?.includes('canceled')) {
                    setError('Неуспешно зареждане на профила.');
                    console.error('Error fetching profile:', err);
                }
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        fetchProfile();
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (profile?.isEmailConfirmed) {
            setResendMessage(null);
            setEmailSent(false);
        }
    }, [profile?.isEmailConfirmed]);

    /**
     * Rating and rank are per game, so the profile lists one card per game.
     *
     * `stats` is the current shape; the legacy top-level santaseWins/Losses are
     * still read as a fallback so an older server does not blank the page.
     */
    const gameCards: { key: GameKey; title: string; stats: GameStats }[] =
        profile
            ? ([
                  { key: 'SANTASE' as const, title: 'Сантасе' },
                  { key: 'TABLA' as const, title: 'Табла' },
              ]
                  .map((game) => {
                      const stats = profile.stats?.[game.key]
                          ?? (game.key === 'SANTASE'
                              ? {
                                    wins: profile.santaseWins ?? 0,
                                    losses: profile.santaseLosses ?? 0,
                                    rank: profile.rank,
                                    placementGamesRemaining: Math.max(
                                        0, 10 - (profile.santaseWins ?? 0) - (profile.santaseLosses ?? 0)),
                                }
                              : null);
                      return stats ? { ...game, stats } : null;
                  })
                  .filter(Boolean) as { key: GameKey; title: string; stats: GameStats }[])
            : [];

    /* ---------------- email confirmation ---------------- */

    const handleResendEmail = async () => {
        setIsResendingEmail(true);
        setResendMessage(null);

        try {
            const result = await userService.resendEmail();
            setResendMessage({ tone: result.success ? 'success' : 'error', text: result.message });

            if (result.success) {
                setEmailSent(true);
                setTimeout(async () => {
                    try {
                        setProfile(await userService.getProfile());
                    } catch (err) {
                        console.error('Error refreshing profile:', err);
                    }
                }, 1000);
            }
        } catch (err) {
            setResendMessage({ tone: 'error', text: 'Грешка при изпращане на имейл. Моля опитайте отново.' });
            console.error('Error resending email:', err);
        } finally {
            setIsResendingEmail(false);
        }
    };

    /* ---------------- password change ---------------- */

    const validatePassword = (): PasswordErrors => {
        const next: PasswordErrors = {};
        const { currentPassword, newPassword, confirmPassword } = passwordForm;

        if (!currentPassword) next.currentPassword = 'Текущата парола не може да бъде празна.';

        if (!newPassword) next.newPassword = 'Новата парола не може да бъде празна.';
        else if (newPassword.length < 5 || newPassword.length > 50)
            next.newPassword = 'Паролата трябва да бъде между 5 и 50 символа.';
        else if (!PASSWORD_RE.test(newPassword)) next.newPassword = 'Паролата съдържа неразрешени символи.';
        else if (newPassword === currentPassword)
            next.newPassword = 'Новата парола трябва да е различна от текущата.';

        if (newPassword && newPassword !== confirmPassword) next.confirmPassword = 'Паролите не съвпадат!';

        return next;
    };

    const onPasswordChange = (key: keyof typeof passwordForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setPasswordForm((f) => ({ ...f, [key]: value }));
        setPasswordErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
        setPasswordBanner(null);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const found = validatePassword();
        setPasswordErrors(found);
        if (Object.keys(found).length > 0) {
            if (found.currentPassword) currentPwRef.current?.focus();
            else if (found.newPassword) newPwRef.current?.focus();
            else confirmPwRef.current?.focus();
            return;
        }

        setIsChangingPassword(true);
        setPasswordBanner(null);

        try {
            const result = await userService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);

            if (result.success) {
                setPasswordBanner({ tone: 'success', text: result.message });
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => {
                    setShowPasswordChange(false);
                    setPasswordBanner(null);
                }, 1800);
            } else {
                setPasswordBanner({ tone: 'error', text: result.message });
            }
        } catch (err) {
            setPasswordBanner({ tone: 'error', text: 'Грешка при промяна на паролата. Моля опитайте отново.' });
            console.error('Error changing password:', err);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const openPasswordChange = () => {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordErrors({});
        setPasswordBanner(null);
        setShowPasswordChange(true);
    };

    /* ---------------- account deletion ---------------- */

    const handleDeleteAccount = async () => {
        if (!deletePassword) {
            setDeleteError('Паролата не може да бъде празна.');
            deletePwRef.current?.focus();
            return;
        }
        if (deletePassword.length < 5 || deletePassword.length > 50) {
            setDeleteError('Паролата трябва да бъде между 5 и 50 символа.');
            deletePwRef.current?.focus();
            return;
        }
        if (!PASSWORD_RE.test(deletePassword)) {
            setDeleteError('Паролата съдържа неразрешени символи.');
            deletePwRef.current?.focus();
            return;
        }

        setIsDeletingAccount(true);
        setDeleteError(null);

        try {
            const result = await userService.sendUserDeletionEmail(deletePassword);
            if (result.success) {
                setShowDeleteConfirm(false);
                setShowDeleteSuccess(true);
            } else {
                setDeleteError(result.message);
            }
        } catch (err) {
            setDeleteError('Грешка при изтриване на акаунта. Моля опитайте отново.');
            console.error('Error deleting account:', err);
        } finally {
            setIsDeletingAccount(false);
        }
    };

    /* ---------------- render ---------------- */

    return (
        <>
            <Modal title="Профил" width="wide" onClose={onClose}>
                {isLoading ? (
                    <div className="lobby profile">
                        {/* Skeletons reserve the real layout so nothing jumps when data lands */}
                        <div className="profile__id">
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                                <div className="skeleton" style={{ height: 34, width: '46%' }} />
                                <div className="skeleton" style={{ height: 14, width: '70%' }} />
                            </div>
                        </div>
                        <div className="profile__games">
                            <div className="skeleton" style={{ height: 156 }} />
                            <div className="skeleton" style={{ height: 156 }} />
                        </div>
                        <span className="sr-only">Зареждане на профила…</span>
                    </div>
                ) : error ? (
                    <Note tone="error">{error}</Note>
                ) : profile ? (
                    <div className="lobby profile">
                        {/* Who this is, and whether their email is confirmed —
                            the one thing on the page that may need doing. */}
                        <header className="profile__id">
                            <div className="profile__who">
                                <h3 className="profile__name">{username}</h3>
                                <p className="profile__email">
                                    <span
                                        className={`profile__email-state ${
                                            profile.isEmailConfirmed
                                                ? 'profile__email-state--ok'
                                                : 'profile__email-state--bad'
                                        }`}
                                    >
                                        <Icon name={profile.isEmailConfirmed ? 'checkCircle' : 'xCircle'} size={15} />
                                        {profile.isEmailConfirmed ? 'Имейлът е потвърден' : 'Имейлът не е потвърден'}
                                    </span>

                                    {!profile.isEmailConfirmed && !emailSent && (
                                        <button
                                            type="button"
                                            className="btn btn--link"
                                            disabled={isResendingEmail}
                                            onClick={handleResendEmail}
                                        >
                                            {isResendingEmail ? 'Изпращане…' : 'Изпрати имейл за потвърждение'}
                                        </button>
                                    )}
                                </p>
                            </div>
                        </header>

                        {resendMessage && <Note tone={resendMessage.tone}>{resendMessage.text}</Note>}

                        {/* One record per game, each with its own rank. Side by
                            side once there is room. */}
                        <div className="profile__games">
                            {gameCards.map((game) => (
                                <GameStatsCard key={game.key} title={game.title} stats={game.stats} />
                            ))}
                        </div>

                        <div className="profile__actions">
                            <Button variant="secondary" icon="lock" onClick={openPasswordChange}>
                                Промени парола
                            </Button>

                            <button
                                type="button"
                                className="btn btn--link profile__delete"
                                onClick={() => {
                                    setDeletePassword('');
                                    setDeleteError(null);
                                    setShowDeleteConfirm(true);
                                }}
                            >
                                Изтрий акаунт
                            </button>
                        </div>
                    </div>
                ) : null}
            </Modal>

            {/* ---- change password ---- */}
            {showPasswordChange && (
                <Modal
                    title="Промяна на парола"
                    onClose={() => setShowPasswordChange(false)}
                    width="narrow"
                    dismissOnScrim={false}
                >
                    <form onSubmit={handleChangePassword} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                        <Field
                            ref={currentPwRef}
                            label="Текуща парола"
                            name="currentPassword"
                            type="password"
                            autoComplete="current-password"
                            value={passwordForm.currentPassword}
                            onChange={onPasswordChange('currentPassword')}
                            error={passwordErrors.currentPassword}
                            placeholder="••••••••"
                            required
                        />
                        <Field
                            ref={newPwRef}
                            label="Нова парола"
                            name="newPassword"
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.newPassword}
                            onChange={onPasswordChange('newPassword')}
                            error={passwordErrors.newPassword}
                            hint="5–50 символа, латиница и цифри."
                            placeholder="••••••••"
                            required
                        />
                        <Field
                            ref={confirmPwRef}
                            label="Потвърди новата парола"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={passwordForm.confirmPassword}
                            onChange={onPasswordChange('confirmPassword')}
                            error={passwordErrors.confirmPassword}
                            placeholder="••••••••"
                            required
                        />

                        {passwordBanner && <Note tone={passwordBanner.tone}>{passwordBanner.text}</Note>}

                        <Button type="submit" variant="primary" block loading={isChangingPassword}>
                            Промени парола
                        </Button>
                    </form>
                </Modal>
            )}

            {/* ---- delete account confirmation ---- */}
            {showDeleteConfirm && (
                <Modal
                    title="Изтриване на акаунт"
                    tone="danger"
                    width="narrow"
                    onClose={() => setShowDeleteConfirm(false)}
                    dismissOnScrim={false}
                    actions={
                        <>
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                                Отказ
                            </Button>
                            <Button variant="danger" loading={isDeletingAccount} onClick={handleDeleteAccount}>
                                Изтрий акаунт
                            </Button>
                        </>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                        <Note tone="warning">
                            Това действие е необратимо. Всички ваши данни — статистика, ранг и история на игрите — ще
                            бъдат премахнати завинаги.
                        </Note>

                        <p style={{ color: 'var(--text-2)', fontSize: 'var(--fs-sm)' }}>
                            За да продължите, въведете паролата си. Ще получите имейл за потвърждение на изтриването.
                        </p>

                        <Field
                            ref={deletePwRef}
                            label="Парола"
                            type="password"
                            autoComplete="current-password"
                            value={deletePassword}
                            onChange={(e) => {
                                setDeletePassword(e.target.value);
                                if (deleteError) setDeleteError(null);
                            }}
                            error={deleteError}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                </Modal>
            )}

            {/* ---- deletion email sent ---- */}
            {showDeleteSuccess && (
                <Modal
                    title="Имейл изпратен"
                    width="narrow"
                    dismissOnScrim={false}
                    actions={
                        <Button
                            variant="primary"
                            onClick={() => {
                                setShowDeleteSuccess(false);
                                logout();
                                navigate('/');
                            }}
                        >
                            Разбрах
                        </Button>
                    }
                >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-4)', textAlign: 'center' }}>
                        <span style={{ ...avatarStyle, color: 'var(--success)', background: 'var(--success-wash)' }}>
                            <Icon name="mail" size="48%" />
                        </span>
                        <p style={{ color: 'var(--text-2)' }}>
                            Изпратихме ви имейл за потвърждение на изтриването на акаунта. Моля, проверете пощата си и
                            следвайте инструкциите.
                        </p>
                    </div>
                </Modal>
            )}
        </>
    );
};

const avatarStyle: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(76px, 22vw, 104px)',
    height: 'clamp(76px, 22vw, 104px)',
    borderRadius: '50%',
    background: 'linear-gradient(150deg, var(--surface-3), var(--surface-1))',
    border: '1px solid var(--line-gold)',
    color: 'var(--gold)',
    boxShadow: 'var(--sh-2)',
};

export default ProfilePage;
