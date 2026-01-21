import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../api/authService';

const ResetPassword: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const [passwordForm, setPasswordForm] = useState({
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [isValidatingLink, setIsValidatingLink] = useState(true);
    const styleAddedRef = useRef(false);

    useEffect(() => {
        // Check if token exists, if not redirect to invalid page
        if (!token) {
            navigate('/confirmation-invalid');
            return;
        }

        // Validate the link when component loads with token
        const validateLink = async () => {
            setIsValidatingLink(true);
            try {
                await authService.validateLink(token);
                // If 200, continue normally (do nothing)
                setIsValidatingLink(false);
            } catch (err: any) {
                // If 400 or any error, redirect to invalid page
                if (err.response?.status === 400 || err.response?.status) {
                    navigate('/confirmation-invalid');
                } else {
                    // For network errors, also redirect
                    navigate('/confirmation-invalid');
                }
            }
        };

        validateLink();
    }, [token, navigate]);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Add CSS animation only once
    useEffect(() => {
        if (typeof document !== 'undefined' && !styleAddedRef.current) {
            const existingStyle = document.getElementById('reset-password-animation');
            if (!existingStyle) {
                const style = document.createElement('style');
                style.id = 'reset-password-animation';
                style.innerHTML = `
                    @keyframes scaleIn {
                        from {
                            transform: scale(0);
                            opacity: 0;
                        }
                        to {
                            transform: scale(1);
                            opacity: 1;
                        }
                    }
                `;
                document.head.appendChild(style);
                styleAddedRef.current = true;
            }
        }
    }, []);

    const validatePasswordForm = (): boolean => {
        const { newPassword, confirmPassword } = passwordForm;
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;

        if (!newPassword) {
            setPasswordError("Новата парола не може да бъде празна.");
            return false;
        }
        if (newPassword.length < 5 || newPassword.length > 50) {
            setPasswordError("Паролата трябва да бъде между 5 и 50 символа.");
            return false;
        }
        if (!passwordRegex.test(newPassword)) {
            setPasswordError("Паролата съдържа неразрешени символи.");
            return false;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError("Паролите не съвпадат!");
            return false;
        }

        return true;
    };

    const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
        if (passwordError) setPasswordError(null);
        if (passwordSuccess) setPasswordSuccess(null);
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePasswordForm()) return;

        if (!token) {
            setPasswordError("Невалиден или липсващ токен за възстановяване.");
            return;
        }

        setIsResettingPassword(true);
        setPasswordError(null);
        setPasswordSuccess(null);

        try {
            await authService.resetPassword(token, passwordForm.newPassword);
            setPasswordSuccess("Паролата е променена успешно!");
            setPasswordForm({ newPassword: '', confirmPassword: '' });
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || '';
            const status = err.response?.status;

            // If message is "New password must be different." - show error
            if (errorMessage === "New password must be different.") {
                setPasswordError("Новата парола трябва да е различна от текущата парола.");
            } 
            // For any other error (including "Username or password is incorrect.", 500, or any other message) - redirect
            else {
                navigate('/confirmation-invalid');
            }
            console.error('Error resetting password:', err);
        } finally {
            setIsResettingPassword(false);
        }
    };

    const handleGoToLogin = () => {
        navigate('/');
    };

    const isMobile = windowWidth <= 768;
    const isSmallMobile = windowWidth <= 480;

    // Don't render if no token or still validating (will redirect)
    if (!token || isValidatingLink) {
        return (
            <div style={styles.container}>
                <div style={{
                    ...styles.card,
                    padding: isSmallMobile ? '30px 20px' : isMobile ? '40px 30px' : '50px 40px',
                    maxWidth: isSmallMobile ? '90%' : isMobile ? '400px' : '500px',
                }}>
                    <div style={styles.loadingText}>Проверка на линка...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            <div style={{
                ...styles.card,
                padding: isSmallMobile ? '30px 20px' : isMobile ? '40px 30px' : '50px 40px',
                maxWidth: isSmallMobile ? '90%' : isMobile ? '400px' : '500px',
            }}>
                <div style={{
                    ...styles.iconContainer,
                    width: isSmallMobile ? '80px' : isMobile ? '100px' : '120px',
                    height: isSmallMobile ? '80px' : isMobile ? '100px' : '120px',
                    fontSize: isSmallMobile ? '50px' : isMobile ? '60px' : '70px',
                }}>
                    🔒
                </div>
                
                <h1 style={{
                    ...styles.title,
                    fontSize: isSmallMobile ? '24px' : isMobile ? '28px' : '32px',
                    marginTop: isSmallMobile ? '20px' : '30px',
                }}>
                    Възстановяване на парола
                </h1>
                
                <p style={{
                    ...styles.message,
                    fontSize: isSmallMobile ? '14px' : isMobile ? '16px' : '18px',
                    marginTop: isSmallMobile ? '15px' : '20px',
                }}>
                    Въведете нова парола за вашия профил
                </p>

                <form onSubmit={handleResetPassword} style={styles.form}>
                    <div style={{...styles.inputGroup, marginBottom: isSmallMobile ? '12px' : '18px'}}>
                        <label style={{
                            ...styles.label,
                            fontSize: isSmallMobile ? '10px' : '12px',
                            marginBottom: isSmallMobile ? '4px' : '5px',
                        }}>Нова парола</label>
                        <input
                            type="password"
                            name="newPassword"
                            value={passwordForm.newPassword}
                            onChange={handlePasswordInputChange}
                            placeholder="••••••••"
                            style={{
                                ...styles.input,
                                padding: isSmallMobile ? '10px' : '12px',
                                fontSize: isSmallMobile ? '14px' : '16px',
                            }}
                            required
                        />
                    </div>

                    <div style={{...styles.inputGroup, marginBottom: isSmallMobile ? '12px' : '18px'}}>
                        <label style={{
                            ...styles.label,
                            fontSize: isSmallMobile ? '10px' : '12px',
                            marginBottom: isSmallMobile ? '4px' : '5px',
                        }}>Потвърди паролата</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={passwordForm.confirmPassword}
                            onChange={handlePasswordInputChange}
                            placeholder="••••••••"
                            style={{
                                ...styles.input,
                                padding: isSmallMobile ? '10px' : '12px',
                                fontSize: isSmallMobile ? '14px' : '16px',
                            }}
                            required
                        />
                    </div>

                    {passwordError && (
                        <div style={styles.errorBox}>{passwordError}</div>
                    )}

                    {passwordSuccess && (
                        <div style={styles.successBox}>{passwordSuccess}</div>
                    )}

                    <button
                        type="submit"
                        disabled={isResettingPassword}
                        style={{
                            ...styles.button,
                            padding: isSmallMobile ? '12px 24px' : isMobile ? '14px 28px' : '16px 32px',
                            fontSize: isSmallMobile ? '14px' : isMobile ? '16px' : '18px',
                            marginTop: isSmallMobile ? '15px' : '20px',
                            opacity: isResettingPassword ? 0.7 : 1,
                            cursor: isResettingPassword ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            if (!isResettingPassword) {
                                e.currentTarget.style.backgroundColor = '#0d1f0b';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (!isResettingPassword) {
                                e.currentTarget.style.backgroundColor = '#1a3a16';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }
                        }}
                    >
                        {isResettingPassword ? 'Промяна...' : 'Промени паролата'}
                    </button>
                </form>

                <button
                    onClick={handleGoToLogin}
                    style={{
                        ...styles.secondaryButton,
                        padding: isSmallMobile ? '12px 24px' : isMobile ? '14px 28px' : '16px 32px',
                        fontSize: isSmallMobile ? '14px' : isMobile ? '16px' : '18px',
                        marginTop: isSmallMobile ? '15px' : '20px',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    Назад към вход
                </button>
            </div>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        width: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle, #1a3a16 0%, #0a1a08 100%)',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        padding: '20px',
        boxSizing: 'border-box',
        overflow: 'auto',
    },
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: '20px',
        boxShadow: '0 0 40px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,0.1)',
        textAlign: 'center',
        border: '2px solid #d4af37',
        maxWidth: '500px',
        width: '100%',
    },
    iconContainer: {
        width: '120px',
        height: '120px',
        borderRadius: '50%',
        backgroundColor: '#1a3a16',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        color: 'white',
        fontSize: '70px',
        fontWeight: 'bold',
        boxShadow: '0 4px 20px rgba(26, 58, 22, 0.4)',
        animation: 'scaleIn 0.5s ease-out',
    },
    title: {
        margin: '30px 0 0 0',
        color: '#1a3a16',
        fontWeight: 'bold',
        fontSize: '32px',
    },
    message: {
        margin: '20px 0 0 0',
        color: '#555',
        lineHeight: '1.6',
        fontSize: '18px',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        marginTop: '30px',
        textAlign: 'left',
    },
    inputGroup: {
        marginBottom: '18px',
    },
    label: {
        display: 'block',
        marginBottom: '5px',
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#1a3a16',
        textTransform: 'uppercase',
    },
    input: {
        width: '100%',
        padding: '12px',
        borderRadius: '5px',
        border: '1px solid #ccc',
        fontSize: '16px',
        boxSizing: 'border-box',
        backgroundColor: '#f9f9f9',
    },
    errorBox: {
        padding: '10px',
        backgroundColor: '#fff0f0',
        color: '#a00',
        borderRadius: '5px',
        marginBottom: '15px',
        fontSize: '13px',
        borderLeft: '4px solid #a00',
    },
    successBox: {
        padding: '10px',
        backgroundColor: '#f0fff0',
        color: '#0a0',
        borderRadius: '5px',
        marginBottom: '15px',
        fontSize: '13px',
        borderLeft: '4px solid #0a0',
    },
    button: {
        padding: '16px 32px',
        backgroundColor: '#1a3a16',
        color: '#d4af37',
        border: 'none',
        borderRadius: '8px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 0 #0d1f0b',
        transition: 'all 0.3s ease',
        marginTop: '20px',
        width: '100%',
    },
    secondaryButton: {
        padding: '16px 32px',
        backgroundColor: 'transparent',
        color: '#1a3a16',
        border: '2px solid #1a3a16',
        borderRadius: '8px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        marginTop: '20px',
        width: '100%',
    },
    loadingText: {
        textAlign: 'center',
        color: '#1a3a16',
        fontSize: '18px',
        padding: '20px',
    },
};

export default ResetPassword;

