import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userService } from '../api/userService';
import { useAuthContext } from '../context/AuthContext';

const DeleteAccount: React.FC = () => {
    const navigate = useNavigate();
    const { logout } = useAuthContext();
    const [isDeletingAccount, setIsDeletingAccount] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const handleDeleteAccount = async () => {
        setIsDeletingAccount(true);
        setDeleteError(null);

        try {
            const result = await userService.deleteUser();
            
            if (result.success) {
                logout();
                navigate('/');
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

    const handleCancel = () => {
        navigate(-1);
    };

    return (
        <div style={styles.container}>
            <div style={styles.content}>
                <button onClick={handleCancel} style={styles.backButton}>
                    ← Назад
                </button>

                <div style={styles.card}>
                    <div style={styles.warningIcon}>⚠️</div>
                    
                    <h1 style={styles.title}>Изтриване на акаунт</h1>
                    
                    <p style={styles.warningText}>
                        Сигурни ли сте, че искате да изтриете акаунта си?
                    </p>
                    
                    <p style={styles.warningSubtext}>
                        Това действие е необратимо и всички ваши данни ще бъдат изтрити завинаги, 
                        включително статистика, постижения и история на игрите.
                    </p>

                    {deleteError && (
                        <div style={styles.errorMessage}>
                            {deleteError}
                        </div>
                    )}

                    <div style={styles.buttonsContainer}>
                        <button
                            onClick={handleCancel}
                            style={styles.cancelButton}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#2d5a27';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#1a3a16';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            Отказ
                        </button>
                        <button
                            onClick={handleDeleteAccount}
                            disabled={isDeletingAccount}
                            style={{
                                ...styles.deleteButton,
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
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    container: {
        minHeight: '100%',
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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
    },
    content: {
        maxWidth: '500px',
        width: '100%',
        margin: '0 auto',
    },
    backButton: {
        padding: '10px 20px',
        backgroundColor: '#1a3a16',
        color: '#d4af37',
        border: 'none',
        borderRadius: '5px',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: 'pointer',
        marginBottom: '20px',
    },
    card: {
        backgroundColor: 'rgba(26, 26, 26, 0.98)',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
        textAlign: 'center',
    },
    warningIcon: {
        fontSize: '4rem',
        marginBottom: '20px',
    },
    title: {
        color: '#e57373',
        fontSize: '1.8rem',
        marginBottom: '20px',
        fontWeight: 'bold',
    },
    warningText: {
        color: '#fff',
        fontSize: '1.1rem',
        lineHeight: '1.6',
        marginBottom: '15px',
        fontWeight: '600',
    },
    warningSubtext: {
        color: '#b0b0b0',
        fontSize: '0.95rem',
        lineHeight: '1.6',
        marginBottom: '30px',
    },
    errorMessage: {
        color: '#e57373',
        backgroundColor: 'rgba(229, 115, 115, 0.1)',
        borderRadius: '8px',
        padding: '12px 15px',
        fontSize: '0.9rem',
        fontWeight: '600',
        border: '1px solid #e57373',
        marginBottom: '20px',
    },
    buttonsContainer: {
        display: 'flex',
        gap: '15px',
        justifyContent: 'center',
    },
    cancelButton: {
        width: '45%',
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
    },
    deleteButton: {
        width: '45%',
        padding: '14px 28px',
        backgroundColor: '#8b0000',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontSize: '1rem',
        fontWeight: 'bold',
        cursor: 'pointer',
        boxShadow: '0 4px 0 #5c0000',
        transition: 'all 0.3s ease',
    },
};

export default DeleteAccount;
