import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { rememberedUsername } from '../context/AuthContext';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { authService } from '../api/authService';
import Button from './ui/Button';
import Field from './ui/Field';
import Note from './ui/Note';
import Icon from './ui/Icon';

type Mode = 'login' | 'register' | 'forgot';

type FieldKey = 'username' | 'email' | 'password' | 'confirmPassword' | 'forgotEmail';
type Errors = Partial<Record<FieldKey, string>>;

const USERNAME_RE = /^[A-Za-z0-9]+$/;
const PASSWORD_RE = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthPage: React.FC = () => {
    const [mode, setMode] = useState<Mode>('login');
    // Signing in starts with the last name used on this device already filled,
    // so it pairs with the password the browser offers. Registration starts
    // blank — that is a new account, not the old one.
    const [form, setForm] = useState({
        username: rememberedUsername(), password: '', confirmPassword: '', email: '',
    });
    const [forgotEmail, setForgotEmail] = useState('');
    const [errors, setErrors] = useState<Errors>({});
    const [formMessage, setFormMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
    const [isForgotLoading, setIsForgotLoading] = useState(false);

    const { performAction, isLoading, error: serverError } = useAuth();

    // Without this the password field sits behind the on-screen keyboard with
    // nothing able to scroll on iOS and in the WebView.
    useKeyboardInset();

    const usernameRef = useRef<HTMLInputElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const confirmRef = useRef<HTMLInputElement>(null);
    const forgotRef = useRef<HTMLInputElement>(null);

    const isLogin = mode === 'login';
    const isRegister = mode === 'register';
    const isForgot = mode === 'forgot';

    // Switching mode is a fresh start: no stale values, errors or banners.
    useEffect(() => {
        setForm({
            username: mode === 'login' ? rememberedUsername() : '',
            password: '', confirmPassword: '', email: '',
        });
        setForgotEmail('');
        setErrors({});
        setFormMessage(null);
    }, [mode]);

    /* ---------------------------------------------------------------
       Ambient card symbols. Generated once; the count is kept low because
       this renders behind a form on low-end phones. prefers-reduced-motion
       stops the animation globally (see theme.css).
       --------------------------------------------------------------- */
    const driftingSymbols = useMemo(() => {
        const symbols = ['♠', '♥', '♦', '♣', 'K', 'Q', 'A', 'J', '10', '9'];
        return Array.from({ length: 18 }).map((_, i) => {
            const size = 1.4 + Math.random() * 3.4;
            const opacity = 0.04 + Math.random() * 0.09;
            return (
                <span
                    key={i}
                    aria-hidden="true"
                    style={
                        {
                            position: 'absolute',
                            bottom: '-140px',
                            left: `${Math.random() * 100}%`,
                            fontSize: `${size}rem`,
                            color: i % 2 === 0 ? 'var(--gold)' : 'var(--text-3)',
                            opacity,
                            filter: size < 2 ? 'blur(2px)' : undefined,
                            animation: `drift-up ${18 + Math.random() * 26}s linear infinite`,
                            animationDelay: `${Math.random() * -30}s`,
                            pointerEvents: 'none',
                            userSelect: 'none',
                            '--drift-opacity': opacity,
                        } as React.CSSProperties
                    }
                >
                    {symbols[Math.floor(Math.random() * symbols.length)]}
                </span>
            );
        });
    }, []);

    /* ---------------------------------------------------------------
       Validation — every failure attaches to the field that caused it,
       so the message appears next to the input, not in one lump on top.
       --------------------------------------------------------------- */
    const validate = (): Errors => {
        const next: Errors = {};
        const { username, password, confirmPassword, email } = form;

        if (!username) next.username = 'Потребителското име не може да бъде празно.';
        else if (username.length < 4 || username.length > 20)
            next.username = 'Потребителското име трябва да е между 4 и 20 символа.';
        else if (!USERNAME_RE.test(username)) next.username = 'Само латински букви и цифри.';

        if (!password) next.password = 'Паролата не може да бъде празна.';
        else if (password.length < 5 || password.length > 50)
            next.password = 'Паролата трябва да бъде между 5 и 50 символа.';
        else if (!PASSWORD_RE.test(password)) next.password = 'Паролата съдържа неразрешени символи.';

        if (isRegister) {
            if (!email) next.email = 'Имейлът не може да бъде празен.';
            else if (!EMAIL_RE.test(email)) next.email = 'Невалиден имейл адрес.';

            if (password && password !== confirmPassword) next.confirmPassword = 'Паролите не съвпадат!';
        }

        return next;
    };

    /**
     * The fields in tab order for the current mode.
     *
     * The phone keyboard's action key submits the form by default, so typing a
     * username and pressing it fired the whole login or registration with the
     * rest of the form empty. Enter now walks this list instead, and only the
     * last field submits.
     */
    const fieldOrder = isRegister
        ? [usernameRef, emailRef, passwordRef, confirmRef]
        : [usernameRef, passwordRef];

    const onFieldKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        const next = fieldOrder[index + 1];
        if (!next) return;              // last field: let it submit
        e.preventDefault();
        next.current?.focus();
    };

    /** 'next' walks the form; only the final field offers 'go'. */
    const enterHint = (index: number): 'next' | 'go' =>
        index + 1 < fieldOrder.length ? 'next' : 'go';

    /** Puts the cursor in the first field that failed — no hunting. */
    const focusFirstError = (errs: Errors) => {
        if (errs.username) usernameRef.current?.focus();
        else if (errs.email) emailRef.current?.focus();
        else if (errs.password) passwordRef.current?.focus();
        else if (errs.confirmPassword) confirmRef.current?.focus();
    };

    const mapServerError = (errorData: unknown): string => {
        if (!errorData) return '';

        let parsed: any = errorData;
        if (typeof errorData === 'string') {
            try {
                parsed = JSON.parse(errorData);
            } catch {
                parsed = { message: errorData };
            }
        }

        const msg: string = parsed.message || (typeof errorData === 'string' ? errorData : '');
        const status = parsed.status;
        const details: string = parsed.details || parsed.data?.details || '';

        if (
            status === 409 ||
            msg?.toLowerCase().includes('conflict') ||
            msg?.toLowerCase().includes('already in use')
        ) {
            const d = details?.toLowerCase() || '';
            if (d.includes('email') || (d.includes("'") && details?.includes('@'))) return 'Имейлът вече е зает.';
            if (d.includes('username') || (d.includes("'") && !details?.includes('@')))
                return 'Потребителското име е заето.';
            return 'Потребителското име или имейлът е зает.';
        }

        if (msg === 'Username or password is incorrect.') return 'Невалидно потребителско име или парола.';

        if (msg === 'Validation Error') {
            if (details.includes('username')) {
                if (details.includes('between 5 and 20'))
                    return 'Потребителското име трябва да е между 5 и 20 символа.';
                if (details.includes('only letters and digits')) return 'Само латински букви и цифри.';
            }
            if (
                details.includes('password') &&
                (details.includes('between 5 and 50') || details.includes('between 5 and 20'))
            )
                return 'Паролата трябва да бъде между 5 и 50 символа.';
            return 'Невалидни данни.';
        }
        return 'Невалидно потребителско име или парола.';
    };

    const onChange = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setForm((f) => ({ ...f, [key]: value }));
        // Clear this field's error as soon as the user starts fixing it.
        setErrors((prev) => (prev[key as FieldKey] ? { ...prev, [key]: undefined } : prev));
        setFormMessage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const found = validate();
        setErrors(found);
        if (Object.keys(found).length > 0) {
            focusFirstError(found);
            return;
        }

        setFormMessage(null);
        try {
            await performAction(isLogin ? 'login' : 'register', {
                username: form.username,
                password: form.password,
                ...(isLogin ? {} : { email: form.email }),
            });
            setFormMessage({
                tone: 'success',
                text: isLogin
                    ? 'Влязохте успешно!'
                    : 'Успешна регистрация! Изпратихме линк за потвърждение на вашия имейл.',
            });
        } catch (err: any) {
            const raw = err?.response?.data
                ? JSON.stringify({
                      message: err.response.data.message,
                      status: err.response.status,
                      details: err.response.data.details,
                  })
                : serverError;
            setFormMessage({ tone: 'error', text: mapServerError(raw) || 'Възникна грешка. Опитайте отново.' });
        }
    };

    const handleForgotSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!forgotEmail) {
            setErrors({ forgotEmail: 'Имейлът не може да бъде празен.' });
            forgotRef.current?.focus();
            return;
        }
        if (!EMAIL_RE.test(forgotEmail)) {
            setErrors({ forgotEmail: 'Невалиден имейл адрес.' });
            forgotRef.current?.focus();
            return;
        }

        setErrors({});
        setFormMessage(null);
        setIsForgotLoading(true);

        try {
            await authService.forgotPassword(forgotEmail);
            setFormMessage({ tone: 'success', text: 'Имейлът за възстановяване на парола е изпратен успешно!' });
            setForgotEmail('');
        } catch (err: any) {
            const message: string = err.response?.data?.message || '';
            setFormMessage({
                tone: 'error',
                text: message.toLowerCase().includes('is not confirmed')
                    ? 'Имейлът не е потвърден.'
                    : message || 'Грешка при изпращане на имейл.',
            });
        } finally {
            setIsForgotLoading(false);
        }
    };

    const heading = isForgot ? 'Забравена парола' : 'Регистрация';
    const sub = isForgot
        ? 'Въведете вашия имейл адрес за възстановяване на парола'
        : isLogin
          ? 'Влез и играй Сантасе или Табла'
          : 'Стани част от елита';

    return (
        <main className="screen screen--flow">
            <div aria-hidden="true" style={driftLayerStyle}>
                {driftingSymbols}
            </div>

            <div className="panel panel--gold" style={cardStyle}>
                <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
                    <span style={crestStyle}>
                        <Icon name="spade" size="58%" />
                    </span>
                    {isLogin ? (
                        <h1 className="sr-only">Вход</h1>
                    ) : (
                        <h1 style={headingStyle}>{heading}</h1>
                    )}
                    <p style={subStyle}>{sub}</p>
                </div>

                {!isForgot ? (
                    <form onSubmit={handleSubmit} noValidate style={formStyle}>
                        <Field
                            ref={usernameRef}
                            label="Потребителско име"
                            name="username"
                            value={form.username}
                            onChange={onChange('username')}
                            error={errors.username}
                            autoComplete={isLogin ? 'username' : 'off'}
                            autoCapitalize="none"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="Потребителско име"
                            enterKeyHint={enterHint(0)}
                            onKeyDown={onFieldKeyDown(0)}
                            hint={isRegister ? '4–20 символа, латински букви и цифри.' : undefined}
                            required
                        />

                        {isRegister && (
                            <Field
                                ref={emailRef}
                                label="Имейл"
                                name="email"
                                type="email"
                                inputMode="email"
                                value={form.email}
                                onChange={onChange('email')}
                                error={errors.email}
                                autoComplete="email"
                                autoCapitalize="none"
                                placeholder="example@mail.com"
                                hint="Използва се само за потвърждение и възстановяване на парола."
                                enterKeyHint={enterHint(1)}
                                onKeyDown={onFieldKeyDown(1)}
                                required
                            />
                        )}

                        <Field
                            ref={passwordRef}
                            label="Парола"
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={onChange('password')}
                            error={errors.password}
                            autoComplete={isLogin ? 'current-password' : 'new-password'}
                            placeholder="••••••••"
                            enterKeyHint={enterHint(isRegister ? 2 : 1)}
                            onKeyDown={onFieldKeyDown(isRegister ? 2 : 1)}
                            required
                        />

                        {isRegister && (
                            <Field
                                ref={confirmRef}
                                label="Потвърди паролата"
                                name="confirmPassword"
                                type="password"
                                value={form.confirmPassword}
                                onChange={onChange('confirmPassword')}
                                error={errors.confirmPassword}
                                autoComplete="new-password"
                                placeholder="••••••••"
                                enterKeyHint="go"
                                required
                            />
                        )}

                        {formMessage && <Note tone={formMessage.tone}>{formMessage.text}</Note>}

                        <Button type="submit" variant="primary" size="lg" block loading={isLoading}>
                            {isLogin ? 'Влез' : 'Регистрирай се'}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={handleForgotSubmit} noValidate style={formStyle}>
                        <Field
                            ref={forgotRef}
                            label="Имейл"
                            name="forgotEmail"
                            type="email"
                            inputMode="email"
                            value={forgotEmail}
                            onChange={(e) => {
                                setForgotEmail(e.target.value);
                                setErrors({});
                                setFormMessage(null);
                            }}
                            error={errors.forgotEmail}
                            autoComplete="email"
                            autoCapitalize="none"
                            placeholder="example@mail.com"
                            enterKeyHint="go"
                            required
                        />

                        {formMessage && <Note tone={formMessage.tone}>{formMessage.text}</Note>}

                        <Button type="submit" variant="primary" size="lg" block loading={isForgotLoading}>
                            Изпрати
                        </Button>
                    </form>
                )}

                <div style={footerStyle}>
                    {isLogin && (
                        <button type="button" className="btn btn--link" onClick={() => setMode('forgot')}>
                            Забравена парола?
                        </button>
                    )}

                    {isForgot ? (
                        <button type="button" className="btn btn--link" onClick={() => setMode('login')}>
                            <Icon name="arrowLeft" size={16} />
                            Назад към вход
                        </button>
                    ) : (
                        <p style={switchStyle}>
                            {isLogin ? 'Нямаш профил?' : 'Вече имаш профил?'}
                            <button
                                type="button"
                                className="btn btn--link"
                                onClick={() => setMode(isLogin ? 'register' : 'login')}
                            >
                                {isLogin ? 'Създай сега' : 'Влез тук'}
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </main>
    );
};

const driftLayerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
};

const cardStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    // margin:auto rather than relying on align-items, so a tall form keeps its
    // top reachable when it overflows and the screen has to scroll.
    margin: 'auto',
    width: '100%',
    maxWidth: '400px',
    padding: 'clamp(24px, 6vw, 40px)',
};

const crestStyle: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    width: 'clamp(56px, 15vw, 72px)',
    height: 'clamp(56px, 15vw, 72px)',
    margin: '0 auto var(--sp-4)',
    borderRadius: '50%',
    background: 'var(--gold-wash)',
    border: '1px solid var(--line-gold)',
    color: 'var(--gold)',
};

const headingStyle: React.CSSProperties = {
    fontSize: 'var(--fs-2xl)',
    color: 'var(--gold)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
};

const subStyle: React.CSSProperties = {
    marginTop: 'var(--sp-2)',
    fontSize: 'var(--fs-sm)',
    color: 'var(--text-3)',
};

const formStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp-4)',
};

const footerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: 'var(--sp-4)',
};

const switchStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--sp-1)',
    fontSize: 'var(--fs-sm)',
    color: 'var(--text-3)',
};

export default AuthPage;
