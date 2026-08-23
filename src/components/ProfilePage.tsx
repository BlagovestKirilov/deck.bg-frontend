import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../api/userService';
import { ProfileResponse } from '../types/user.types';
import { useAuthContext } from '../context/AuthContext';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Field from './ui/Field';
import Note from './ui/Note';
import Icon from './ui/Icon';
import RankBadge from './RankBadge';

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

    const wins = profile?.santaseWins ?? 0;
    const losses = profile?.santaseLosses ?? 0;
    const total = wins + losses;
    const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

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
            <Modal title="Профил" onClose={onClose}>
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                        {/* Skeletons reserve the real layout so nothing jumps when data lands */}
                        <div className="skeleton" style={{ height: 96, width: 96, borderRadius: '50%', margin: '0 auto' }} />
                        <div className="skeleton" style={{ height: 22, width: '52%', margin: '0 auto' }} />
                        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                            <div className="skeleton" style={{ height: 84, flex: 1 }} />
                            <div className="skeleton" style={{ height: 84, flex: 1 }} />
                            <div className="skeleton" style={{ height: 84, flex: 1 }} />
                        </div>
                        <div className="skeleton" style={{ height: 14, width: '100%' }} />
                        <span className="sr-only">Зареждане на профила…</span>
                    </div>
                ) : error ? (
                    <Note tone="error">{error}</Note>
                ) : profile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
                        {/* identity */}
                        <div style={identityStyle}>
                            <div style={avatarStyle}>
                                <Icon name="user" size="52%" />
                            </div>
                            <h3 style={usernameStyle}>{username}</h3>
                            <RankBadge rank={profile.rank} size="medium" wins={wins} losses={losses} />
                        </div>

                        {/* email confirmation state */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', alignItems: 'center' }}>
                            <span className={`badge ${profile.isEmailConfirmed ? 'badge--success' : 'badge--danger'}`}>
                                <Icon name={profile.isEmailConfirmed ? 'checkCircle' : 'xCircle'} size={15} />
                                {profile.isEmailConfirmed ? 'Имейлът е потвърден' : 'Имейлът не е потвърден'}
                            </span>

                            {!profile.isEmailConfirmed && !emailSent && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="mail"
                                    loading={isResendingEmail}
                                    onClick={handleResendEmail}
                                >
                                    Изпрати имейл за потвърждение
                                </Button>
                            )}

                            {resendMessage && <Note tone={resendMessage.tone}>{resendMessage.text}</Note>}
                        </div>

                        {/* stats */}
                        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                            <div className="stat">
                                <div className="stat__value">{wins}</div>
                                <div className="stat__label">Победи</div>
                            </div>
                            <div className="stat">
                                <div className="stat__value">{losses}</div>
                                <div className="stat__label">Загуби</div>
                            </div>
                            <div className="stat">
                                <div className="stat__value">{total}</div>
                                <div className="stat__label">Игри</div>
                            </div>
                        </div>

                        {total > 0 && (
                            <div>
                                <div className="ratio" role="img" aria-label={`Победи ${wins}, загуби ${losses}, ${winPct}% успеваемост`}>
                                    <div className="ratio__win" style={{ width: `${winPct}%` }} />
                                    <div className="ratio__loss" style={{ width: `${100 - winPct}%` }} />
                                </div>
                                <div style={ratioLabelsStyle}>
                                    <span style={{ color: 'var(--success)', fontWeight: 700 }}>{winPct}% победи</span>
                                    <span style={{ color: 'var(--text-3)' }}>{total} изиграни</span>
                                    <span style={{ color: 'var(--danger-bright)', fontWeight: 700 }}>
                                        {100 - winPct}% загуби
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* account actions — same size; the rule above the
                            destructive one keeps it visually separated */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                            <Button variant="secondary" icon="lock" block onClick={openPasswordChange}>
                                Промени парола
                            </Button>

                            <hr style={dividerStyle} />

                            <Button
                                variant="danger"
                                icon="trash"
                                block
                                onClick={() => {
                                    setDeletePassword('');
                                    setDeleteError(null);
                                    setShowDeleteConfirm(true);
                                }}
                            >
                                Изтрий акаунт
                            </Button>
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

const identityStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--sp-3)',
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

const usernameStyle: React.CSSProperties = {
    fontSize: 'var(--fs-xl)',
    color: 'var(--text-1)',
    fontWeight: 600,
    wordBreak: 'break-word',
    textAlign: 'center',
};

const ratioLabelsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 'var(--sp-2)',
    marginTop: 'var(--sp-2)',
    fontSize: 'var(--fs-xs)',
};

const dividerStyle: React.CSSProperties = {
    width: '100%',
    height: 0,
    margin: 0,
    border: 0,
    borderTop: '1px solid var(--line)',
};

export default ProfilePage;
