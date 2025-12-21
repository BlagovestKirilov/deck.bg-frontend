import React from 'react';
import { useAuthContext } from './context/AuthContext';
import AuthPage from './components/AuthPage';

const App: React.FC = () => {
    const { isAuthenticated, logout } = useAuthContext();

    return (
        <div style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* If not authenticated, show Login/Register page */}
            {!isAuthenticated ? (
                <AuthPage />
            ) : (
                /* If authenticated, show the "Business Logic" part of your app */
                <div style={styles.dashboard}>
                    <nav style={styles.nav}>
                        <h1>My Secure App</h1>
                        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
                    </nav>
                    <main style={styles.content}>
                        <h2>Welcome Back!</h2>
                        <p>You are now connected via HTTPS with a valid JWT.</p>
                        {/* Call your Business Logic components here */}
                    </main>
                </div>
            )}
        </div>
    );
};

const styles = {
    dashboard: { minHeight: '100vh', backgroundColor: '#f0f2f5' },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '1rem 2rem',
        backgroundColor: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    logoutBtn: {
        padding: '8px 16px',
        backgroundColor: '#ff4d4f',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    },
    content: { padding: '2rem', textAlign: 'center' as const }
};

export default App;