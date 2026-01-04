import React, {useEffect, useRef, useState} from 'react';
import {userService} from '../api/userService';
import {ProfileResponse} from '../types/user.types';

interface ProfilePageProps {
    username: string;
    onClose: () => void;
    windowWidth?: number;
}

const ProfilePage: React.FC<ProfilePageProps> = ({username, onClose, windowWidth = 1024}) => {
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isResendingEmail, setIsResendingEmail] = useState(false);
    const [resendEmailMessage, setResendEmailMessage] = useState<string | null>(null);
    const [emailSentSuccessfully, setEmailSentSuccessfully] = useState(false);
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

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div
                style={{
                    ...styles.container,
                    padding: isSmallMobile ? '20px' : isMobile ? '30px' : '40px',
                    maxWidth: isSmallMobile ? '90vw' : isMobile ? '85vw' : '500px',
                    minWidth: isSmallMobile ? '280px' : '350px',
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
        marginBottom: '30px',
        borderBottom: '2px solid rgba(255,255,255,0.1)',
        paddingBottom: '15px',
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
        marginBottom: '30px',
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
        marginBottom: '30px',
        gap: '15px',
    },
    statBox: {
        flex: 1,
        textAlign: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(45, 45, 45, 0.8) 0%, rgba(30, 30, 30, 0.9) 100%)',
        borderRadius: '15px',
        border: '2px solid rgba(255,255,255,0.1)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
    },
    statValue: {
        fontSize: '2rem',
        fontWeight: 'bold',
        color: '#d4af37',
        marginBottom: '8px',
    },
    statLabel: {
        fontSize: '0.9rem',
        color: '#b0b0b0',
        textTransform: 'uppercase',
        fontWeight: '600',
    },
    statusBarContainer: {
        marginTop: '20px',
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
        height: '40px',
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
};

export default ProfilePage;

