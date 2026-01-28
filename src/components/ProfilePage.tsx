import React, {useEffect, useRef, useState} from 'react';
import {userService} from '../api/userService';
import {ProfileResponse} from '../types/user.types';

interface ProfilePageProps {
    username: string;
    onClose: () => void;
    onLogout?: () => void;
    windowWidth?: number;
}

const ProfilePage: React.FC<ProfilePageProps> = ({username, onClose, onLogout, windowWidth = 1024}) => {
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isResendingEmail, setIsResendingEmail] = useState(false);
    const [resendEmailMessage, setResendEmailMessage] = useState<string | null>(null);
    const [emailSentSuccessfully, setEmailSentSuccessfully] = useState(false);
    const [showPasswordChange, setShowPasswordChange] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const isMobile = windowWidth <= 768;
    const isSmallMobile = windowWidth <= 480;

    useEffect(() => {
        // Cancel any previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Create new AbortController for this request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await userService.getProfile(abortController.signal);

                // Check if request was aborted before updating state
                if (!abortController.signal.aborted) {
                    setProfile(data);
                }
            } catch (err: any) {
                // Don't set error if request was aborted
                if (!abortController.signal.aborted && err.name !== 'CanceledError' && !err.message?.includes('canceled')) {
                    setError('Неуспешно зареждане на профила.');
                    console.error('Error fetching profile:', err);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        fetchProfile();

        return () => {
            // Cancel request on unmount or re-render
            abortController.abort();
        };
    }, []);

    // Clear resend message and reset email sent flag when email becomes confirmed
    useEffect(() => {
        if (profile?.isEmailConfirmed) {
            if (resendEmailMessage) {
                setResendEmailMessage(null);
            }
            setEmailSentSuccessfully(false);
        }
    }, [profile?.isEmailConfirmed, resendEmailMessage]);

    const wins = profile?.santaseWins || 0;
    const losses = profile?.santaseLosses || 0;
    const total = wins + losses;

    // Calculate percentage for status bar
    const winsPercentage = total > 0 ? (wins / total) * 100 : 50;
    const lossesPercentage = total > 0 ? (losses / total) * 100 : 50;

    const handleResendEmail = async () => {
        setIsResendingEmail(true);
        setResendEmailMessage(null);
        setError(null);
        setEmailSentSuccessfully(false);
        
        try {
            const result = await userService.resendEmail();
            setResendEmailMessage(result.message);
            
            // If email was sent successfully, hide the button and refresh profile
            if (result.success) {
                setEmailSentSuccessfully(true);
                setTimeout(async () => {
                    try {
                        const updatedProfile = await userService.getProfile();
                        setProfile(updatedProfile);
                    } catch (err) {
                        console.error('Error refreshing profile:', err);
                    }
                }, 1000);
            }
        } catch (err: any) {
            setResendEmailMessage('Грешка при изпращане на имейл. Моля опитайте отново.');
            console.error('Error resending email:', err);
        } finally {
            setIsResendingEmail(false);
        }
    };

    const validatePasswordForm = (): boolean => {
        const { currentPassword, newPassword, confirmPassword } = passwordForm;
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+=\-.,?]+$/;

        if (!currentPassword) {
            setPasswordError("Текущата парола не може да бъде празна.");
            return false;
        }

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

        // Check if new password is different from current password (only if new and confirm match)
        if (newPassword === currentPassword) {
            setPasswordError("Новата парола трябва да е\nразлична от текущата парола.");
            return false;
        }

        return true;
    };

    const handlePasswordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
        if (passwordError) setPasswordError(null);
        if (passwordSuccess) setPasswordSuccess(null);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validatePasswordForm()) return;

        setIsChangingPassword(true);
        setPasswordError(null);
        setPasswordSuccess(null);

        try {
            const result = await userService.changePassword(
                passwordForm.currentPassword,
                passwordForm.newPassword
            );
            
            if (result.success) {
                setPasswordSuccess(result.message);
                setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                setTimeout(() => {
                    setShowPasswordChange(false);
                    setPasswordSuccess(null);
                }, 2000);
            } else {
                setPasswordError(result.message);
            }
        } catch (err: any) {
            setPasswordError('Грешка при промяна на паролата. Моля опитайте отново.');
            console.error('Error changing password:', err);
        } finally {
            setIsChangingPassword(false);
        }
    };

    const handleOpenPasswordChange = () => {
        setShowPasswordChange(true);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordError(null);
        setPasswordSuccess(null);
    };

    const handleClosePasswordChange = () => {
        setShowPasswordChange(false);
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordError(null);
        setPasswordSuccess(null);
    };

    const handleOpenDeleteConfirmation = () => {
        setShowDeleteConfirmation(true);
        setDeleteError(null);
    };

    const handleCloseDeleteConfirmation = () => {
        setShowDeleteConfirmation(false);
        setDeleteError(null);
    };

    const handleDeleteAccount = async () => {
        setIsDeletingAccount(true);
        setDeleteError(null);

        try {
            const result = await userService.deleteUser();
            
            if (result.success) {
                setShowDeleteConfirmation(false);
                if (onLogout) {
                    onLogout();
                }
            } else {
                setDeleteError(result.message);
            }
        } catch (err: any) {
            setDeleteError('Грешка при изтриване на акаунта. Моля опитайте отново.');
            console.error('Error deleting account:', err);
        } finally {
            setIsDeletingAccount(false);
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div
                style={{
                    ...styles.container,
                    padding: isSmallMobile ? '20px' : isMobile ? '30px' : '30px',
                    maxWidth: isSmallMobile ? '90vw' : isMobile ? '85vw' : '500px',
                    minWidth: isSmallMobile ? '280px' : '350px',
                    maxHeight: isMobile ? '90vh' : '85vh',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={styles.header}>
                    <h2 style={{
                        ...styles.title,
                        fontSize: isSmallMobile ? '1.5rem' : isMobile ? '1.8rem' : '2rem',
                    }}>
                        Профил
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            ...styles.closeButton,
                            fontSize: isSmallMobile ? '1.2rem' : '1.5rem',
                            width: isSmallMobile ? '32px' : '40px',
                            height: isSmallMobile ? '32px' : '40px',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                            e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#b0b0b0';
                        }}
                    >
                        ×
                    </button>
                </div>

                {isLoading ? (
                    <div style={styles.loading}>Зареждане...</div>
                ) : error ? (
                    <div style={styles.error}>{error}</div>
                ) : profile ? (
                    <>
                        <div style={styles.userInfo}>
                            <div style={{
                                ...styles.userIcon,
                                fontSize: isSmallMobile ? '3rem' : isMobile ? '4rem' : '5rem',
                                width: isSmallMobile ? '80px' : isMobile ? '100px' : '120px',
                                height: isSmallMobile ? '80px' : isMobile ? '100px' : '120px',
                            }}>
                                👤
                            </div>
                            <h3 style={{
                                ...styles.username,
                                fontSize: isSmallMobile ? '1.2rem' : isMobile ? '1.4rem' : '1.6rem',
                            }}>
                                {username}
                            </h3>
                            <div style={{
                                ...styles.emailStatus,
                                fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                marginTop: isSmallMobile ? '10px' : '15px',
                            }}>
                                <span style={{
                                    ...styles.emailStatusIcon,
                                    width: isSmallMobile ? '20px' : isMobile ? '22px' : '24px',
                                    height: isSmallMobile ? '20px' : isMobile ? '22px' : '24px',
                                    fontSize: isSmallMobile ? '1rem' : isMobile ? '1.1rem' : '1.2rem',
                                    backgroundColor: profile.isEmailConfirmed ? 'rgba(76, 175, 80, 0.2)' : 'rgba(229, 115, 115, 0.2)',
                                    color: profile.isEmailConfirmed ? '#66bb6a' : '#e57373',
                                }}>
                                    {profile.isEmailConfirmed ? '✓' : '✗'}
                                </span>
                                <span style={{
                                    color: profile.isEmailConfirmed ? '#66bb6a' : '#e57373',
                                    marginLeft: '8px',
                                    fontWeight: '600',
                                }}>
                                    {profile.isEmailConfirmed ? 'Имейлът е потвърден' : 'Имейлът не е потвърден'}
                                </span>
                            </div>
                            {!profile.isEmailConfirmed && !emailSentSuccessfully && (
                                <button
                                    onClick={handleResendEmail}
                                    disabled={isResendingEmail}
                                    style={{
                                        ...styles.resendButton,
                                        padding: isSmallMobile ? '10px 20px' : isMobile ? '12px 24px' : '14px 28px',
                                        fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                        marginTop: isSmallMobile ? '15px' : '20px',
                                        opacity: isResendingEmail ? 0.7 : 1,
                                        cursor: isResendingEmail ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isResendingEmail) {
                                            e.currentTarget.style.backgroundColor = '#2d5a27';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isResendingEmail) {
                                            e.currentTarget.style.backgroundColor = '#1a3a16';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }
                                    }}
                                >
                                    {isResendingEmail ? 'Изпращане...' : 'Изпрати имейл за потвърждение'}
                                </button>
                            )}
                            {resendEmailMessage && (
                                <div style={{
                                    ...styles.resendMessage,
                                    color: resendEmailMessage.includes('успешно') ? '#66bb6a' : '#e57373',
                                    backgroundColor: resendEmailMessage.includes('успешно') 
                                        ? 'rgba(76, 175, 80, 0.1)' 
                                        : 'rgba(229, 115, 115, 0.1)',
                                    fontSize: isSmallMobile ? '0.8rem' : isMobile ? '0.85rem' : '0.9rem',
                                    marginTop: isSmallMobile ? '10px' : '15px',
                                    padding: isSmallMobile ? '8px 12px' : '10px 15px',
                                }}>
                                    {resendEmailMessage}
                                </div>
                            )}
                            {profile.isEmailConfirmed && (
                                <button
                                    onClick={handleOpenPasswordChange}
                                    style={{
                                        ...styles.changePasswordButton,
                                        padding: isSmallMobile ? '10px 20px' : isMobile ? '12px 24px' : '14px 28px',
                                        fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                        marginTop: isSmallMobile ? '15px' : '20px',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#2d5a27';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#1a3a16';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    Промени парола
                                </button>
                            )}
                            <button
                                onClick={handleOpenDeleteConfirmation}
                                style={{
                                    ...styles.deleteAccountButton,
                                    padding: isSmallMobile ? '10px 20px' : isMobile ? '12px 24px' : '14px 28px',
                                    fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                    marginTop: isSmallMobile ? '15px' : '20px',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#8b2020';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#6b1515';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                Изтрий акаунт
                            </button>
                        </div>

                        <div style={styles.statsContainer}>
                            <div style={styles.statBox}>
                                <div style={styles.statValue}>{wins}</div>
                                <div style={styles.statLabel}>Победи</div>
                            </div>
                            <div style={styles.statBox}>
                                <div style={styles.statValue}>{losses}</div>
                                <div style={styles.statLabel}>Загуби</div>
                            </div>
                            <div style={styles.statBox}>
                                <div style={styles.statValue}>{total}</div>
                                <div style={styles.statLabel}>Общо</div>
                            </div>
                        </div>

                        <div style={styles.statusBarContainer}>
                            <div style={styles.statusBarLabel}>
                                Статистика
                            </div>
                            <div style={styles.statusBarWrapper}>
                                <div
                                    style={{
                                        ...styles.statusBarGreen,
                                        width: `${winsPercentage}%`,
                                    }}
                                />
                                <div
                                    style={{
                                        ...styles.statusBarRed,
                                        width: `${lossesPercentage}%`,
                                    }}
                                />
                            </div>
                            <div style={styles.statusBarText}>
                                <span style={styles.winsText}>
                                    {winsPercentage.toFixed(1)}% Победи
                                </span>
                                <span style={styles.lossesText}>
                                    {lossesPercentage.toFixed(1)}% Загуби
                                </span>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>

            {showPasswordChange && (
                <div style={styles.passwordChangeOverlay} onClick={handleClosePasswordChange}>
                    <div
                        style={{
                            ...styles.passwordChangeContainer,
                            padding: isSmallMobile ? '20px' : isMobile ? '30px' : '40px',
                            maxWidth: isSmallMobile ? '90vw' : isMobile ? '85vw' : '400px',
                            minWidth: isSmallMobile ? '280px' : '320px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={styles.passwordChangeHeader}>
                            <h3 style={{
                                ...styles.passwordChangeTitle,
                                fontSize: isSmallMobile ? '1.3rem' : isMobile ? '1.5rem' : '1.8rem',
                            }}>
                                Промяна на парола
                            </h3>
                            <button
                                onClick={handleClosePasswordChange}
                                style={{
                                    ...styles.closeButton,
                                    fontSize: isSmallMobile ? '1.2rem' : '1.5rem',
                                    width: isSmallMobile ? '32px' : '40px',
                                    height: isSmallMobile ? '32px' : '40px',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#b0b0b0';
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleChangePassword} style={styles.passwordChangeForm}>
                            <div style={{...styles.passwordInputGroup, marginBottom: isSmallMobile ? '15px' : '20px'}}>
                                <label style={{
                                    ...styles.passwordLabel,
                                    fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                    marginBottom: isSmallMobile ? '5px' : '8px',
                                }}>
                                    Текуща парола
                                </label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={passwordForm.currentPassword}
                                    onChange={handlePasswordInputChange}
                                    placeholder="••••••••"
                                    style={{
                                        ...styles.passwordInput,
                                        padding: isSmallMobile ? '10px' : '12px',
                                        fontSize: isSmallMobile ? '14px' : '16px',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#d4af37';
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                    }}
                                    required
                                />
                            </div>

                            <div style={{...styles.passwordInputGroup, marginBottom: isSmallMobile ? '15px' : '20px'}}>
                                <label style={{
                                    ...styles.passwordLabel,
                                    fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                    marginBottom: isSmallMobile ? '5px' : '8px',
                                }}>
                                    Нова парола
                                </label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={passwordForm.newPassword}
                                    onChange={handlePasswordInputChange}
                                    placeholder="••••••••"
                                    style={{
                                        ...styles.passwordInput,
                                        padding: isSmallMobile ? '10px' : '12px',
                                        fontSize: isSmallMobile ? '14px' : '16px',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#d4af37';
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                    }}
                                    required
                                />
                            </div>

                            <div style={{...styles.passwordInputGroup, marginBottom: isSmallMobile ? '15px' : '20px'}}>
                                <label style={{
                                    ...styles.passwordLabel,
                                    fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                    marginBottom: isSmallMobile ? '5px' : '8px',
                                }}>
                                    Потвърди новата парола
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={passwordForm.confirmPassword}
                                    onChange={handlePasswordInputChange}
                                    placeholder="••••••••"
                                    style={{
                                        ...styles.passwordInput,
                                        padding: isSmallMobile ? '10px' : '12px',
                                        fontSize: isSmallMobile ? '14px' : '16px',
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = '#d4af37';
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
                                    }}
                                    required
                                />
                            </div>

                            <div style={{
                                ...styles.passwordMessageContainer,
                                height: (passwordError || passwordSuccess) ? 'auto' : '0px',
                                minHeight: (passwordError || passwordSuccess) ? (isSmallMobile ? '40px' : isMobile ? '45px' : '50px') : '0px',
                                marginBottom: (passwordError || passwordSuccess) ? (isSmallMobile ? '10px' : '15px') : '0px',
                                overflow: 'hidden',
                            }}>
                                {passwordError && (
                                    <div style={{
                                        ...styles.passwordMessage,
                                        color: '#e57373',
                                        backgroundColor: 'rgba(229, 115, 115, 0.1)',
                                        fontSize: isSmallMobile ? '0.8rem' : isMobile ? '0.85rem' : '0.9rem',
                                        padding: isSmallMobile ? '8px 12px' : '10px 15px',
                                    }}>
                                        {passwordError}
                                    </div>
                                )}

                                {passwordSuccess && (
                                    <div style={{
                                        ...styles.passwordMessage,
                                        color: '#66bb6a',
                                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                        fontSize: isSmallMobile ? '0.8rem' : isMobile ? '0.85rem' : '0.9rem',
                                        padding: isSmallMobile ? '8px 12px' : '10px 15px',
                                    }}>
                                        {passwordSuccess}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={isChangingPassword}
                                style={{
                                    ...styles.passwordChangeSubmitButton,
                                    padding: isSmallMobile ? '12px' : isMobile ? '13px' : '15px',
                                    fontSize: isSmallMobile ? '14px' : isMobile ? '16px' : '18px',
                                    opacity: isChangingPassword ? 0.7 : 1,
                                    cursor: isChangingPassword ? 'not-allowed' : 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isChangingPassword) {
                                        e.currentTarget.style.backgroundColor = '#2d5a27';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isChangingPassword) {
                                        e.currentTarget.style.backgroundColor = '#1a3a16';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }
                                }}
                            >
                                {isChangingPassword ? 'Промяна...' : 'Промени парола'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showDeleteConfirmation && (
                <div style={styles.deleteConfirmationOverlay} onClick={handleCloseDeleteConfirmation}>
                    <div
                        style={{
                            ...styles.deleteConfirmationContainer,
                            padding: isSmallMobile ? '20px' : isMobile ? '30px' : '40px',
                            maxWidth: isSmallMobile ? '90vw' : isMobile ? '85vw' : '400px',
                            minWidth: isSmallMobile ? '280px' : '320px',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={styles.deleteConfirmationHeader}>
                            <h3 style={{
                                ...styles.deleteConfirmationTitle,
                                fontSize: isSmallMobile ? '1.3rem' : isMobile ? '1.5rem' : '1.8rem',
                            }}>
                                Изтриване на акаунт
                            </h3>
                            <button
                                onClick={handleCloseDeleteConfirmation}
                                style={{
                                    ...styles.closeButton,
                                    fontSize: isSmallMobile ? '1.2rem' : '1.5rem',
                                    width: isSmallMobile ? '32px' : '40px',
                                    height: isSmallMobile ? '32px' : '40px',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.color = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#b0b0b0';
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div style={styles.deleteConfirmationContent}>
                            <div style={{
                                ...styles.warningIcon,
                                fontSize: isSmallMobile ? '2.5rem' : isMobile ? '3rem' : '3.5rem',
                            }}>
                                ⚠️
                            </div>
                            <p style={{
                                ...styles.deleteWarningText,
                                fontSize: isSmallMobile ? '0.9rem' : isMobile ? '0.95rem' : '1rem',
                            }}>
                                Сигурни ли сте, че искате да изтриете акаунта си? 
                                Това действие е необратимо и всички ваши данни ще бъдат изтрити завинаги.
                            </p>

                            {deleteError && (
                                <div style={{
                                    ...styles.deleteErrorMessage,
                                    fontSize: isSmallMobile ? '0.8rem' : isMobile ? '0.85rem' : '0.9rem',
                                    padding: isSmallMobile ? '8px 12px' : '10px 15px',
                                    marginBottom: isSmallMobile ? '15px' : '20px',
                                }}>
                                    {deleteError}
                                </div>
                            )}

                            <div style={styles.deleteButtonsContainer}>
                                <button
                                    onClick={handleCloseDeleteConfirmation}
                                    style={{
                                        ...styles.cancelDeleteButton,
                                        padding: isSmallMobile ? '10px' : isMobile ? '12px' : '14px',
                                        fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                                    }}
                                >
                                    Отказ
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={isDeletingAccount}
                                    style={{
                                        ...styles.confirmDeleteButton,
                                        padding: isSmallMobile ? '10px' : isMobile ? '12px' : '14px',
                                        fontSize: isSmallMobile ? '0.85rem' : isMobile ? '0.9rem' : '1rem',
                                        opacity: isDeletingAccount ? 0.7 : 1,
                                        cursor: isDeletingAccount ? 'not-allowed' : 'pointer',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isDeletingAccount) {
                                            e.currentTarget.style.backgroundColor = '#a52a2a';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isDeletingAccount) {
                                            e.currentTarget.style.backgroundColor = '#8b0000';
                                            e.currentTarget.style.transform = 'translateY(0)';
                                        }
                                    }}
                                >
                                    {isDeletingAccount ? 'Изтриване...' : 'Изтрий акаунт'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(5px)',
    },
    container: {
        backgroundColor: 'rgba(26, 26, 26, 0.98)',
        borderRadius: '20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
        position: 'relative',
        maxHeight: '90vh',
        overflow: 'auto',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        paddingBottom: '10px',
    },
    title: {
        margin: 0,
        color: '#d4af37',
        fontWeight: 'bold',
    },
    closeButton: {
        background: 'transparent',
        border: 'none',
        color: '#b0b0b0',
        cursor: 'pointer',
        fontSize: '1.5rem',
        fontWeight: 'bold',
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        transition: 'all 0.2s',
    },
    userInfo: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: '20px',
    },
    userIcon: {
        background: 'linear-gradient(135deg, #2d5a27 0%, #1a3a16 100%)',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '15px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5), 0 0 0 2px rgba(212, 175, 55, 0.3)',
        width: '120px',
        height: '120px',
    },
    username: {
        margin: 0,
        color: '#d4af37',
        fontWeight: 'bold',
    },
    statsContainer: {
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '20px',
        gap: '10px',
    },
    statBox: {
        flex: 1,
        textAlign: 'center',
        padding: '15px',
        background: 'linear-gradient(135deg, rgba(45, 45, 45, 0.8) 0%, rgba(30, 30, 30, 0.9) 100%)',
        borderRadius: '15px',
        border: '2px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
    },
    statValue: {
        fontSize: '1.8rem',
        fontWeight: 'bold',
        color: '#d4af37',
        marginBottom: '5px',
    },
    statLabel: {
        fontSize: '0.9rem',
        color: '#b0b0b0',
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    statusBarContainer: {
        marginTop: '10px',
    },
    statusBarLabel: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#d4af37',
        marginBottom: '10px',
        textAlign: 'center',
    },
    statusBarWrapper: {
        width: '100%',
        height: '35px',
        borderRadius: '20px',
        overflow: 'hidden',
        display: 'flex',
        border: '2px solid rgba(255,255,255,0.2)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
    },
    statusBarGreen: {
        height: '100%',
        background: 'linear-gradient(90deg, #4caf50 0%, #66bb6a 100%)',
        transition: 'width 0.5s ease-in-out',
    },
    statusBarRed: {
        height: '100%',
        background: 'linear-gradient(90deg, #f44336 0%, #e57373 100%)',
        transition: 'width 0.5s ease-in-out',
    },
    statusBarText: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '10px',
        fontSize: '0.9rem',
    },
    winsText: {
        color: '#66bb6a',
        fontWeight: '600',
    },
    lossesText: {
        color: '#e57373',
        fontWeight: '600',
    },
    loading: {
        textAlign: 'center',
        padding: '40px',
        color: '#b0b0b0',
        fontSize: '1.1rem',
    },
    error: {
        textAlign: 'center',
        padding: '40px',
        color: '#e57373',
        fontSize: '1.1rem',
    },
    emailStatus: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: '15px',
        fontSize: '1rem',
    },
    emailStatusIcon: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        fontWeight: 'bold',
    },
    resendButton: {
        padding: '14px 28px',
        backgroundColor: '#1a3a16',
        color: '#d4af37',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 0 #0d1f0b',
        transition: 'all 0.3s ease',
        marginTop: '20px',
    },
    resendMessage: {
        textAlign: 'center',
        borderRadius: '8px',
        padding: '10px 15px',
        marginTop: '15px',
        fontSize: '0.9rem',
        fontWeight: '600',
        border: '1px solid',
    },
    changePasswordButton: {
        padding: '14px 28px',
        backgroundColor: '#1a3a16',
        color: '#d4af37',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 0 #0d1f0b',
        transition: 'all 0.3s ease',
        marginTop: '20px',
    },
    passwordChangeOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(5px)',
    },
    passwordChangeContainer: {
        backgroundColor: 'rgba(26, 26, 26, 0.98)',
        borderRadius: '20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
        position: 'relative',
        maxHeight: '90vh',
        overflow: 'auto',
    },
    passwordChangeHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        paddingBottom: '15px',
    },
    passwordChangeTitle: {
        margin: 0,
        color: '#d4af37',
        fontWeight: 'bold',
    },
    passwordChangeForm: {
        display: 'flex',
        flexDirection: 'column',
    },
    passwordInputGroup: {
        marginBottom: '20px',
    },
    passwordLabel: {
        display: 'block',
        marginBottom: '8px',
        fontSize: '1rem',
        fontWeight: 'bold',
        color: '#d4af37',
        textTransform: 'uppercase',
    },
    passwordInput: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.2)',
        fontSize: '16px',
        boxSizing: 'border-box',
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: '#fff',
        outline: 'none',
        transition: 'all 0.3s ease',
    },
    passwordMessageContainer: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all 0.3s ease',
    },
    passwordMessage: {
        textAlign: 'center',
        borderRadius: '8px',
        padding: '10px 15px',
        fontSize: '0.9rem',
        fontWeight: '600',
        border: '1px solid',
        wordWrap: 'break-word',
        overflowWrap: 'break-word',
        maxWidth: '100%',
        boxSizing: 'border-box',
        width: '100%',
        whiteSpace: 'pre-line',
        lineHeight: '1.4',
    },
    passwordChangeSubmitButton: {
        width: '100%',
        padding: '15px',
        backgroundColor: '#1a3a16',
        color: '#d4af37',
        border: 'none',
        borderRadius: '8px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 0 #0d1f0b',
        transition: 'all 0.3s ease',
        marginTop: '10px',
    },
    deleteAccountButton: {
        padding: '14px 28px',
        backgroundColor: '#6b1515',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 0 #4a0e0e',
        transition: 'all 0.3s ease',
        marginTop: '20px',
    },
    deleteConfirmationOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(5px)',
    },
    deleteConfirmationContainer: {
        backgroundColor: 'rgba(26, 26, 26, 0.98)',
        borderRadius: '20px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
        position: 'relative',
        maxHeight: '90vh',
        overflow: 'auto',
    },
    deleteConfirmationHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '25px',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        paddingBottom: '15px',
    },
    deleteConfirmationTitle: {
        margin: 0,
        color: '#e57373',
        fontWeight: 'bold',
    },
    deleteConfirmationContent: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    },
    warningIcon: {
        marginBottom: '15px',
    },
    deleteWarningText: {
        color: '#b0b0b0',
        lineHeight: '1.6',
        marginBottom: '25px',
    },
    deleteErrorMessage: {
        color: '#e57373',
        backgroundColor: 'rgba(229, 115, 115, 0.1)',
        borderRadius: '8px',
        fontWeight: '600',
        border: '1px solid #e57373',
        width: '100%',
        boxSizing: 'border-box',
    },
    deleteButtonsContainer: {
        display: 'flex',
        gap: '15px',
        width: '100%',
        justifyContent: 'center',
    },
    cancelDeleteButton: {
        width: '45%',
        backgroundColor: 'rgba(255,255,255,0.1)',
        color: '#b0b0b0',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
    },
    confirmDeleteButton: {
        width: '45%',
        backgroundColor: '#8b0000',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 0 #5c0000',
        transition: 'all 0.3s ease',
    },
};

export default ProfilePage;

