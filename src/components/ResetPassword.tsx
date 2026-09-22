import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../api/authService';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import Button from './ui/Button';
import Field from './ui/Field';
import Note from './ui/Note';
import Icon from './ui/Icon';
import CardIndex from './lobby/CardIndex';

type Errors = Partial<Record<'newPassword' | 'confirmPassword', string>>;

const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;

/**
 * Q♦ — the card «Забравена парола» is printed on. The link in the email picks
 * that same card back up, now to set the new password.
 */
const CARD = { rank: 'Q', suit: '♦', red: true } as const;

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
    const [errors, setErrors] = useState<Errors>({});
    const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValidatingLink, setIsValidatingLink] = useState(true);

    const newPwRef = useRef<HTMLInputElement>(null);
    const confirmPwRef = useRef<HTMLInputElement>(null);

    useKeyboardInset();

    // Enter moves to the confirmation field rather than submitting a half-typed
    // form — the phone keyboard's action key does that by default.
    const onNewPasswordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        confirmPwRef.current?.focus();
    };

    useEffect(() => {
        if (!token) {
            navigate('/invalid');
            return;
        }

        const validateLink = async () => {
            setIsValidatingLink(true);
            try {
                await authService.validateLink(token);
                setIsValidatingLink(false);
            } catch (err) {
                navigate('/invalid');
            }
        };

        validateLink();
    }, [token, navigate]);

    const validate = (): Errors => {
        const next: Errors = {};
        const { newPassword, confirmPassword } = form;

        if (!newPassword) next.newPassword = 'Новата парола не може да бъде празна.';
        else if (newPassword.length < 5 || newPassword.length > 50)
            next.newPassword = 'Паролата трябва да бъде между 5 и 50 символа.';
        else if (!PASSWORD_RE.test(newPassword)) next.newPassword = 'Паролата съдържа неразрешени символи.';

        if (newPassword && newPassword !== confirmPassword) next.confirmPassword = 'Паролите не съвпадат!';

        return next;
    };

    const onChange = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
        setBanner(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) {
            (found.newPassword ? newPwRef : confirmPwRef).current?.focus();
            return;
        }

        if (!token) {
            setBanner({ tone: 'error', text: 'Невалиден или липсващ токен за възстановяване.' });
            return;
        }

        setIsSubmitting(true);
        setBanner(null);

        try {
            await authService.resetPassword(token, form.newPassword);
            setBanner({ tone: 'success', text: 'Паролата е променена успешно! Пренасочваме ви към вход…' });
            setForm({ newPassword: '', confirmPassword: '' });
            setTimeout(() => navigate('/'), 2000);
        } catch (err: any) {
            const message: string = err.response?.data?.message || '';
            if (message === 'New password must be different.') {
                setErrors({ newPassword: 'Новата парола трябва да е различна от текущата парола.' });
                newPwRef.current?.focus();
            } else {
                navigate('/invalid');
            }
            console.error('Error resetting password:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    // While the link is being checked the card is already on the table, with
    // its title, so nothing jumps when the form arrives underneath it.
    if (!token || isValidatingLink) {
        return (
            <main className="screen screen--flow lobby lobby-auth">
                <div className="deal deal--center">
                    <section className="play-card" aria-labelledby="reset-title" aria-busy="true">
                        <CardIndex {...CARD} corner="tl" />
                        <CardIndex {...CARD} corner="br" />
                        <header className="play-card__head">
                            <h1 id="reset-title" className="play-card__title">Нова парола</h1>
                            <p className="play-card__sub" role="status">Проверяваме линка…</p>
                        </header>
                    </section>
                </div>
            </main>
        );
    }

    return (
        <main className="screen screen--flow lobby lobby-auth">
            <div className="deal deal--center">
                <section className="play-card" aria-labelledby="reset-title">
                    <CardIndex {...CARD} corner="tl" />
                    <CardIndex {...CARD} corner="br" />

                    <header className="play-card__head">
                        <h1 id="reset-title" className="play-card__title">Нова парола</h1>
                        <p className="play-card__sub">Избери нова парола за профила си.</p>
                    </header>

                    <form onSubmit={handleSubmit} noValidate className="play-card__form">
                        <Field
                            ref={newPwRef}
                            label="Нова парола"
                            name="newPassword"
                            type="password"
                            autoComplete="new-password"
                            value={form.newPassword}
                            onChange={onChange('newPassword')}
                            error={errors.newPassword}
                            hint="5–50 символа, латиница и цифри."
                            placeholder="••••••••"
                            enterKeyHint="next"
                            onKeyDown={onNewPasswordKeyDown}
                            required
                        />

                        <Field
                            ref={confirmPwRef}
                            label="Потвърди паролата"
                            name="confirmPassword"
                            type="password"
                            autoComplete="new-password"
                            value={form.confirmPassword}
                            onChange={onChange('confirmPassword')}
                            error={errors.confirmPassword}
                            placeholder="••••••••"
                            enterKeyHint="go"
                            required
                        />

                        {banner && <Note tone={banner.tone}>{banner.text}</Note>}

                        <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
                            Промени паролата
                        </Button>
                    </form>

                    <footer className="play-card__foot">
                        <button type="button" className="btn btn--link" onClick={() => navigate('/')}>
                            <Icon name="arrowLeft" size={16} />
                            Обратно към вход
                        </button>
                    </footer>
                </section>
            </div>
        </main>
    );
};

export default ResetPassword;
