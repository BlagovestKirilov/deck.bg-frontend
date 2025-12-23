import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthPage: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({ username: '', password: '', confirmPassword: '' });
    const [localError, setLocalError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showServerError, setShowServerError] = useState(true);

    const { performAction, isLoading, error: serverError } = useAuth();

    // Добавяне на CSS анимациите динамично
    useEffect(() => {
        if (typeof document !== 'undefined') {
            const style = document.createElement('style');
            style.innerHTML = `
                @keyframes floatSymbols {
                    0% {
                        transform: translateY(0) rotate(0deg) translateX(0);
                        opacity: 0;
                    }
                    10% {
                        opacity: inherit;
                    }
                    50% {
                        transform: translateY(-50vh) rotate(180deg) translateX(20px);
                    }
                    90% {
                        opacity: inherit;
                    }
                    100% {
                        transform: translateY(-110vh) rotate(360deg) translateX(-20px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    const validateForm = (): boolean => {
        const { username, password, confirmPassword } = form;
        const usernameRegex = /^[A-Za-z0-9]+$/;
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;

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
        if (!validateForm()) return;
        setShowServerError(true);
        try {
            await performAction(isLogin ? 'login' : 'register', {
                username: form.username,
                password: form.password
            });
            setSuccessMessage(isLogin ? "Влязохте успешно!" : "Регистрацията е успешна!");
        } catch (err) {}
    };

    // Генериране на символи чрез useMemo, за да не се рестартират при промяна на state
    const floatingSymbols = useMemo(() => {
        const symbols = ['♠', '♥', '♦', '♣', 'K', 'Q', 'A', 'J', '10', '9'];
        return Array.from({ length: 45 }).map((_, i) => {
            const size = 1 + Math.random() * 5;
            const duration = 15 + Math.random() * 30;
            const delay = Math.random() * -30; // Използваме широк отрицателен delay, за да са навсякъде при старт
            const opacity = 0.03 + Math.random() * 0.12;
            const blur = size < 2 ? '2px' : '0px';

            return (
                <div
                    key={i}
                    style={{
                        left: `${Math.random() * 100}%`,
                        animation: `floatSymbols ${duration}s linear infinite`,
                        animationDelay: `${delay}s`,
                        fontSize: `${size}rem`,
                        opacity: opacity,
                        filter: `blur(${blur})`,
                        position: 'absolute',
                        bottom: '-150px',
                        pointerEvents: 'none',
                        color: i % 2 === 0 ? '#d4af37' : '#bdc3c7',
                        zIndex: 0
                    }}
                >
                    {symbols[Math.floor(Math.random() * symbols.length)]}
                </div>
            );
        });
    }, []); // Празният масив гарантира, че се генерират само веднъж

    return (
        <div style={styles.container}>
            {floatingSymbols}

            <div style={styles.card}>
                <div style={styles.logo}>♠</div>
                <h2 style={styles.title}>{isLogin ? 'SANTASE' : 'РЕГИСТРАЦИЯ'}</h2>
                <p style={styles.subtitle}>{isLogin ? 'Влез в кралството на картите' : 'Стани част от елита'}</p>

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

                    {(localError || (showServerError && serverError)) && (
                        <div style={styles.errorBox}> {localError || mapErrorToBulgarian(serverError)}</div>
                    )}

                    {successMessage && <div style={styles.successBox}> {successMessage}</div>}

                    <button type="submit" disabled={isLoading} style={{...styles.button, opacity: isLoading ? 0.7 : 1}}>
                        {isLoading ? '...' : (isLogin ? 'Влез' : 'Регистрирай се')}
                    </button>
                </form>

                <p style={styles.toggleText}>
                    {isLogin ? "Нямаш профил?" : "Вече имаш профил?"}
                    <span onClick={() => setIsLogin(!isLogin)} style={styles.toggleLink}>
                        {isLogin ? 'Създай сега' : 'Влез тук'}
                    </span>
                </p>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh',
        background: 'radial-gradient(circle, #1a3a16 0%, #0a1a08 100%)',
        fontFamily: "'Garamond', serif", position: 'relative', overflow: 'hidden'
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)', padding: '40px', borderRadius: '15px',
        boxShadow: '0 0 40px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,0.1)',
        width: '100%', maxWidth: '360px', zIndex: 10, border: '2px solid #d4af37'
    },
    logo: { fontSize: '60px', textAlign: 'center', color: '#1a3a16', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' },
    title: { margin: '0 0 5px 0', fontSize: '28px', textAlign: 'center', color: '#1a3a16', letterSpacing: '2px', fontWeight: 'bold' },
    subtitle: { margin: '0 0 25px 0', fontSize: '13px', textAlign: 'center', color: '#555', fontStyle: 'italic' },
    form: { display: 'flex', flexDirection: 'column' },
    inputGroup: { marginBottom: '18px' },
    label: { display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: 'bold', color: '#1a3a16', textTransform: 'uppercase' },
    input: {
        width: '100%', padding: '12px', borderRadius: '5px', border: '1px solid #ccc',
        fontSize: '16px', boxSizing: 'border-box', backgroundColor: '#f9f9f9'
    },
    button: {
        width: '100%', padding: '15px', backgroundColor: '#1a3a16', color: '#d4af37',
        border: 'none', borderRadius: '5px', fontSize: '18px', fontWeight: 'bold',
        cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 0 #0d1f0b'
    },
    errorBox: { padding: '10px', backgroundColor: '#fff0f0', color: '#a00', borderRadius: '5px', marginBottom: '15px', fontSize: '13px', borderLeft: '4px solid #a00' },
    successBox: { padding: '10px', backgroundColor: '#f0fff0', color: '#0a0', borderRadius: '5px', marginBottom: '15px', fontSize: '13px', borderLeft: '4px solid #0a0' },
    toggleText: { marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#444' },
    toggleLink: { color: '#1a3a16', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px', textDecoration: 'underline' }
};

export default AuthPage;