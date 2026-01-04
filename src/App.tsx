import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthContext } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import SantaseGame from './components/SantaseGame';
import ConfirmationSuccess from './components/ConfirmationSuccess';

const App: React.FC = () => {
    const { isAuthenticated} = useAuthContext();

    return (
        <div style={styles.appContainer}>
            <Routes>
                <Route 
                    path="/confirmation-success" 
                    element={<ConfirmationSuccess />} 
                />
                <Route 
                    path="*" 
                    element={
                        !isAuthenticated ? (
                            <AuthPage />
                        ) : (
                            <div style={styles.gameWrapper}>
                                {/* Main Content strictly fills the rest of the screen height */}
                                <main style={styles.mainContent}>
                                    <SantaseGame />
                                </main>
                            </div>
                        )
                    } 
                />
            </Routes>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    appContainer: {
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        height: '100vh',
        width: '100vw',
        overflow: 'hidden', // Blocks any scrollbars at the root level
        backgroundColor: '#1a3a16'
    },
    gameWrapper: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw'
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 15px',
        height: '50px', // Fixed height for navbar
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        flexShrink: 0 // Prevents navbar from squishing
    },
    logoSection: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px'
    },
    logo: {
        fontSize: '1.1rem',
        fontWeight: 'bold',
        color: '#2d5a27'
    },
    welcomeText: {
        fontSize: '0.8rem',
        color: '#555',
        borderLeft: '1px solid #ddd',
        paddingLeft: '15px'
    },
    logoutBtn: {
        padding: '6px 12px',
        backgroundColor: '#e74c3c',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '0.8rem'
    },
    mainContent: {
        flex: 1, // Takes all remaining space below navbar
        position: 'relative',
        overflow: 'hidden' // Blocks scrolling inside the game area
    }
};

export default App;