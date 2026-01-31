import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const DeletionSuccess: React.FC = () => {
    const navigate = useNavigate();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
    const styleAddedRef = useRef(false);

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
            const existingStyle = document.getElementById('deletion-success-animation');
            if (!existingStyle) {
                const style = document.createElement('style');
                style.id = 'deletion-success-animation';
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

    const isMobile = windowWidth <= 768;
    const isSmallMobile = windowWidth <= 480;

    const handleGoToHome = () => {
        navigate('/');
    };

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
                    ✓
                </div>
                
                <h1 style={{
                    ...styles.title,
                    fontSize: isSmallMobile ? '24px' : isMobile ? '28px' : '32px',
                    marginTop: isSmallMobile ? '20px' : '30px',
                }}>
                    Акаунтът е изтрит!
                </h1>
                
                <p style={{
                    ...styles.message,
                    fontSize: isSmallMobile ? '14px' : isMobile ? '16px' : '18px',
                    marginTop: isSmallMobile ? '15px' : '20px',
                }}>
                    Вашият акаунт беше успешно изтрит. Всички ваши данни са премахнати безвъзвратно. Благодарим ви, че използвахте нашето приложение!
                </p>
                
                <button
                    onClick={handleGoToHome}
                    style={{
                        ...styles.button,
                        padding: isSmallMobile ? '12px 24px' : isMobile ? '14px 28px' : '16px 32px',
                        fontSize: isSmallMobile ? '14px' : isMobile ? '16px' : '18px',
                        marginTop: isSmallMobile ? '25px' : '30px',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#0d1f0b';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1a3a16';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    Към началната страница
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
        backgroundColor: '#4caf50',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        color: 'white',
        fontSize: '70px',
        fontWeight: 'bold',
        boxShadow: '0 4px 20px rgba(76, 175, 80, 0.4)',
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
        marginTop: '30px',
    },
};

export default DeletionSuccess;
