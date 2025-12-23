import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
    const [localError, setLocalError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showServerError, setShowServerError] = useState(true);

    const { performAction, isLoading, error: serverError } = useAuth();

    // ПРАВИЛА ЗА ВАЛИДАЦИЯ (съвпадат с тези в Java)
    const validateForm = (): boolean => {
        const { username, password, confirmPassword } = form;
        const usernameRegex = /^[A-Za-z0-9]+$/;
        // Позволени символи за парола според вашия Java Pattern
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;

        // Валидация за Потребителско име
        if (!username) {
            setLocalError("Потребителското име не може да бъде празно.");
            return false;
        }
        if (username.length < 5 || username.length > 20) {
            setLocalError("Потребителското име трябва да е между 5 и 20 символа.");
            return false;
        }
        if (!usernameRegex.test(username)) {
            setLocalError("Потребителското име може да съдържа само латински букви и цифри.");
            return false;
        }

        // Валидация за Парола
        if (!password) {
            setLocalError("Паролата не може да бъде празна.");
            return false;
        }
        if (password.length < 5 || password.length > 50) {
            setLocalError("Паролата трябва да бъде между 5 и 50 символа.");
            return false;
        }
        if (!passwordRegex.test(password)) {
            setLocalError("Паролата съдържа неразрешени символи.");
            return false;
        }

        // Валидация за Потвърждение (само при Регистрация)
        if (!isLogin && password !== confirmPassword) {
            setLocalError("Паролите не съвпадат!");
            return false;
        }

        return true;
    };

    const mapErrorToBulgarian = (errorData: any): string => {
        if (!errorData) return "";
        const msg = errorData.message || (typeof errorData === 'string' ? errorData : "");
        const details = errorData.details || "";

        if (msg === "Username is already in use") return "Това потребителско име вече е заето.";
        if (msg === "Username or password is incorrect") return "Грешно потребителско име или парола.";

        if (msg === "Validation Error") {
            if (details.includes("username")) {
                if (details.includes("between 5 and 20")) return "Потребителското име трябва да е между 5 и 20 символа.";
                if (details.includes("only letters and digits")) return "Потребителското име може да съдържа само латински букви и цифри.";
            }
            if (details.includes("password")) {
                if (details.includes("between 5 and 50") || details.includes("between 5 and 20"))
                    return "Паролата трябва да бъде между 5 и 50 символа.";
            }
            return "Невалидни данни.";
        }
        return "Възникна грешка. Моля, опитайте пак.";
    };

    useEffect(() => {
        setForm({ username: '', password: '', confirmPassword: '' });
        setLocalError(null);
        setSuccessMessage(null);
        setShowServerError(false);
    }, [isLogin]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (localError) setLocalError(null);
        if (successMessage) setSuccessMessage(null);
        setShowServerError(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);
        setSuccessMessage(null);

        // 1. ПЪРВО ПРОВЕРЯВАМЕ ТУК - АКО ИМА ГРЕШКА, НЕ ПРАВИМ ЗАЯВКА
        if (!validateForm()) {
            return;
        }

        setShowServerError(true);
        const action = isLogin ? 'login' : 'register';
        try {
            await performAction(action, {
                username: form.username,
                password: form.password
            });
            setSuccessMessage(isLogin ? "Влязохте успешно!" : "Регистрацията е успешна!");
        } catch (err) {
            // serverError се попълва от хука
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                <div style={styles.logo}>♠</div>
                <h2 style={styles.title}>{isLogin ? 'Вход' : 'Регистрация'}</h2>
                <p style={styles.subtitle}>
                    {isLogin ? 'Добре дошли в deck.bg' : 'Създайте нов профил'}
                </p>

                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Потребителско име</label>
                        <input
                            type="text"
                            name="username"
                            value={form.username}
                            onChange={handleInputChange}
                            placeholder="Потребителско име"
                            style={styles.input}
                            required
                        />
                    </div>

                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Парола</label>
                        <input
                            type="password"
                            name="password"
                            value={form.password}
                            onChange={handleInputChange}
                            placeholder="••••••••"
                            style={styles.input}
                            required
                        />
                    </div>

                    {!isLogin && (
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Потвърди паролата</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                value={form.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="••••••••"
                                style={styles.input}
                                required
                            />
                        </div>
                    )}

                    {/* Показване на локални или сървърни грешки */}
                    {(localError || (showServerError && serverError)) && (
                        <div style={styles.errorBox}>
                            ⚠️ {localError || mapErrorToBulgarian(serverError)}
                        </div>
                    )}

                    {successMessage && (
                        <div style={styles.successBox}>✅ {successMessage}</div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{...styles.button, opacity: isLoading ? 0.7 : 1}}
                    >
                        {isLoading ? 'Зареждане...' : (isLogin ? 'Влез' : 'Регистрация')}
                    </button>
                </form>

                <p style={styles.toggleText}>
                    {isLogin ? "Нямате профил?" : "Вече имате профил?"}
                    <span
                        onClick={() => setIsLogin(!isLogin)}
                        style={styles.toggleLink}
                    >
                        {isLogin ? 'Създайте нов' : 'Влезте'}
                    </span>
                </p>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: 'radial-gradient(circle, #2e7d32 0%, #1b5e20 100%)',
        fontFamily: "'Segoe UI', Roboto, sans-serif"
    },
    card: {
        backgroundColor: '#fff', padding: '40px', borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)', width: '100%', maxWidth: '380px'
    },
    logo: { fontSize: '50px', textAlign: 'center', marginBottom: '10px', color: '#2e7d32' },
    title: { margin: '0 0 8px 0', fontSize: '24px', textAlign: 'center', color: '#333', fontWeight: '800' },
    subtitle: { margin: '0 0 25px 0', fontSize: '14px', textAlign: 'center', color: '#666' },
    form: { display: 'flex', flexDirection: 'column' },
    inputGroup: { marginBottom: '16px' },
    label: { display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#444' },
    input: {
        width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #ddd',
        fontSize: '16px', boxSizing: 'border-box', outline: 'none'
    },
    button: {
        width: '100%', padding: '14px', backgroundColor: '#2e7d32', color: '#fff',
        border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold',
        cursor: 'pointer', marginTop: '10px'
    },
    errorBox: {
        padding: '12px', backgroundColor: '#fff1f0', border: '1px solid #ffa39e',
        color: '#cf1322', borderRadius: '10px', marginBottom: '15px', fontSize: '13px'
    },
    successBox: {
        padding: '12px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f',
        color: '#389e0d', borderRadius: '10px', marginBottom: '15px', fontSize: '14px'
    },
    toggleText: { marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#666' },
    toggleLink: { color: '#2e7d32', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px', textDecoration: 'underline' }
};

export default AuthPage;