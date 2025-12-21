import React from 'react';
import { useAuthContext } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import SantaseGame from './components/SantaseGame';

const App: React.FC = () => {
    const { isAuthenticated, logout, user } = useAuthContext();

    return (
        <div style={styles.appContainer}>
            {!isAuthenticated ? (
                <AuthPage />
            ) : (
                <div style={styles.gameWrapper}>
                    {/* Persistent Navigation Bar */}
                    <nav style={styles.nav}>
                        <div style={styles.logoSection}>
                            <span style={styles.logo}>🎴 Santase Online</span>
                            <span style={styles.welcomeText}>User: <strong>{user?.username || 'Player'}</strong></span>
                        </div>
                        <button onClick={logout} style={styles.logoutBtn}>
                            Exit Game & Logout
                        </button>
                    </nav>

                    {/* The Game Component */}
                    <main style={styles.mainContent}>
                        <SantaseGame />
                    </main>
                </div>
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    appContainer: {
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        minHeight: '100vh',
        backgroundColor: '#f0f2f5'
    },
    gameWrapper: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh'
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 25px',
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 100
    },
    logoSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px'
    },
    logo: {
        fontSize: '1.4rem',
        fontWeight: 'bold',
        color: '#2d5a27'
    },
    welcomeText: {
        fontSize: '0.9rem',
        color: '#555',
        borderLeft: '1px solid #ddd',
        paddingLeft: '20px'
    },
    logoutBtn: {
        padding: '8px 16px',
        backgroundColor: '#e74c3c',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'bold',
        transition: 'background 0.2s'
    },
    mainContent: {
        flex: 1,
        overflowY: 'auto'
    }
};

export default App;