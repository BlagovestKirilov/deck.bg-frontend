import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { rememberedUsername } from '../context/AuthContext';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { authService } from '../api/authService';
import Button from './ui/Button';
import Field from './ui/Field';
import Note from './ui/Note';
import Icon from './ui/Icon';
import Brand from './ui/Brand';
import FeltDrift from './lobby/FeltDrift';
import CardIndex from './lobby/CardIndex';

type Mode = 'login' | 'register' | 'forgot';

/**
 * The card each screen is printed on, indexed the way the cards in the game
 * are. (Cyrillic В for the jack read as a Latin B: a card that
 * does not exist.) Signing in is the ace; the others are a different card so
 * that turning between them reads as a new card coming up, not the same one
 * spinning in place.
 */
const CARD: Record<Mode, { rank: string; suit: string; red: boolean }> = {
    login:    { rank: 'A', suit: '♠', red: false },
    register: { rank: 'Q', suit: '♥', red: true },
    forgot:   { rank: 'Q', suit: '♦', red: true },
};

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

    const title = isForgot ? 'Забравена парола' : isRegister ? 'Нов профил' : 'Вход';
    const sub = isForgot
        ? 'Ще ти изпратим линк за нова парола на имейла от регистрацията.'
        : isLogin
          ? 'Сантасе и табла срещу реални опоненти.'
          : 'Един профил за Сантасе и за Табла.';

    return (
        <main className="screen screen--flow lobby lobby-auth">
            <FeltDrift />

            <div className="deal">
                {/* Keyed by mode: a new mode is a new card, and it turns up. */}
                <section key={mode} className="play-card" aria-labelledby="auth-title">
                    <CardIndex {...CARD[mode]} corner="tl" />
                    <CardIndex {...CARD[mode]} corner="br" />

                    <header className="play-card__head">
                        {isLogin ? (
                            <>
                                {/* The name of the place is what the sign-in card
                                    shows; the heading is still there for anyone
                                    navigating by headings. */}
                                <Brand tone="card" size="lg" />
                                <h1 id="auth-title" className="sr-only">{title}</h1>
                            </>
                        ) : (
                            <h1 id="auth-title" className="play-card__title">{title}</h1>
                        )}
                        <p className="play-card__sub">{sub}</p>
                    </header>

                    {!isForgot ? (
                        <form onSubmit={handleSubmit} noValidate className="play-card__form">
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
                                    hint="Само за потвърждение и за нова парола."
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
                                    label="Повтори паролата"
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
                                {isLogin ? 'Влез' : 'Създай профил'}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleForgotSubmit} noValidate className="play-card__form">
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
                                Изпрати линк
                            </Button>
                        </form>
                    )}

                    <footer className="play-card__foot">
                        {isLogin && (
                            <button type="button" className="btn btn--link" onClick={() => setMode('forgot')}>
                                Забравена парола?
                            </button>
                        )}

                        {isForgot ? (
                            <button type="button" className="btn btn--link" onClick={() => setMode('login')}>
                                <Icon name="arrowLeft" size={16} />
                                Обратно към вход
                            </button>
                        ) : (
                            <p className="play-card__switch">
                                {isLogin ? 'Нямаш профил?' : 'Вече имаш профил?'}
                                <button
                                    type="button"
                                    className="btn btn--link"
                                    onClick={() => setMode(isLogin ? 'register' : 'login')}
                                >
                                    {isLogin ? 'Създай профил' : 'Влез'}
                                </button>
                            </p>
                        )}
                    </footer>
                </section>
            </div>

            <p className="lobby-auth__legal">
                <Link to="/privacy">Поверителност</Link>
            </p>
        </main>
    );
};

export default AuthPage;
