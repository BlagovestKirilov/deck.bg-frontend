import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../api/authService';
import Button from './ui/Button';
import Field from './ui/Field';
import Note from './ui/Note';
import Icon from './ui/Icon';

type Errors = Partial<Record<'newPassword' | 'confirmPassword', string>>;

const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;

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

    // While the link is being checked, show the shape of the page rather than
    // a bare spinner, so the transition into the form does not jump.
    if (!token || isValidatingLink) {
        return (
            <main className="screen">
                <div className="panel panel--gold" style={cardStyle}>
                    <div className="skeleton" style={{ height: 84, width: 84, borderRadius: '50%', margin: '0 auto' }} />
                    <div className="skeleton" style={{ height: 26, width: '70%', margin: 'var(--sp-5) auto 0' }} />
                    <div className="skeleton" style={{ height: 16, width: '50%', margin: 'var(--sp-3) auto 0' }} />
                    <p style={{ marginTop: 'var(--sp-6)', color: 'var(--text-3)', fontSize: 'var(--fs-sm)' }} role="status">
                        Проверка на линка…
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="screen">
            <div className="panel panel--gold" style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
                    <span style={crestStyle}>
                        <Icon name="lock" size="50%" />
                    </span>
                    <h1 style={titleStyle}>Възстановяване на парола</h1>
                    <p style={subStyle}>Въведете нова парола за вашия профил</p>
                </div>

                <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
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
                        required
                    />

                    {banner && <Note tone={banner.tone}>{banner.text}</Note>}

                    <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
                        Промени паролата
                    </Button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--sp-3)' }}>
                    <button type="button" className="btn btn--link" onClick={() => navigate('/')}>
                        <Icon name="arrowLeft" size={16} />
                        Назад към вход
                    </button>
                </div>
            </div>
        </main>
    );
};

const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '420px',
    padding: 'clamp(24px, 6vw, 40px)',
};

const crestStyle: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(64px, 17vw, 84px)',
    height: 'clamp(64px, 17vw, 84px)',
    margin: '0 auto var(--sp-4)',
    borderRadius: '50%',
    background: 'var(--gold-wash)',
    border: '1px solid var(--line-gold)',
    color: 'var(--gold)',
};

const titleStyle: React.CSSProperties = {
    fontSize: 'var(--fs-2xl)',
    color: 'var(--text-1)',
    fontWeight: 600,
};

const subStyle: React.CSSProperties = {
    marginTop: 'var(--sp-2)',
    fontSize: 'var(--fs-sm)',
    color: 'var(--text-3)',
};

export default ResetPassword;
