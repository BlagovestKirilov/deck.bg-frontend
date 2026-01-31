import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthContext } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import SantaseGame from './components/SantaseGame';
import ConfirmationSuccess from './components/ConfirmationSuccess';
import ConfirmationInvalid from './components/ConfirmationInvalid';
import ResetPassword from './components/ResetPassword';
import PrivacyPolicy from './components/PrivacyPolicy';
import AccountDeletionInfo from './components/AccountDeletionInfo';
import DeletionSuccess from './components/DeletionSuccess';
import './index.css';

// SafeAreaView component for Android gesture navigation support
// Safe area insets are injected via CSS custom properties from Android MainActivity
const SafeAreaView: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="safe-area-view" style={styles.safeAreaView}>
            <div className="safe-area-content" style={styles.safeAreaContent}>
                {children}
            </div>
        </div>
    );
};

const App: React.FC = () => {
    const { isAuthenticated} = useAuthContext();

    return (
        <SafeAreaView>
            <div style={styles.appContainer}>
                <Routes>
                    <Route 
                        path="/privacy" 
                        element={<PrivacyPolicy />} 
                    />
                    <Route 
                        path="/delete-account" 
                        element={<AccountDeletionInfo />} 
                    />
                    <Route 
                        path="/confirmation-success" 
                        element={<ConfirmationSuccess />} 
                    />
                    <Route 
                        path="/invalid" 
                        element={<ConfirmationInvalid />} 
                    />
                    <Route 
                        path="/reset-password" 
                        element={<ResetPassword />} 
                    />
                    <Route 
                        path="/deletion-success" 
                        element={<DeletionSuccess />} 
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
        </SafeAreaView>
    );
};

const styles: Record<string, React.CSSProperties> = {
    safeAreaView: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        // Safe area padding is applied via CSS class
        backgroundColor: '#1a3a16',
        overflow: 'hidden',
    },
    safeAreaContent: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
    },
    appContainer: {
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        height: '100%',
        width: '100%',
        overflow: 'hidden', // Blocks any scrollbars at the root level
        backgroundColor: '#1a3a16',
        position: 'relative',
    },
    gameWrapper: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
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