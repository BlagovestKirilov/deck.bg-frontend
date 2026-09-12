import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAuthContext } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import GameHub from './components/GameHub';
import SantaseGame from './components/SantaseGame';
import TablaGame from './components/TablaGame';
import ConfirmationSuccess from './components/ConfirmationSuccess';
import ConfirmationInvalid from './components/ConfirmationInvalid';
import ResetPassword from './components/ResetPassword';
import PrivacyPolicy from './components/PrivacyPolicy';
import AccountDeletionInfo from './components/AccountDeletionInfo';
import ConfirmDeletion from './components/ConfirmDeletion';
import DeletionSuccess from './components/DeletionSuccess';
import NotFound from './components/NotFound';
import './index.css';

/**
 * App shell. Fills the viewport, paints the base background, and lets each
 * screen handle its own safe-area padding through the `.screen` class so a
 * scrolling document page can still run under the status bar.
 */
const App: React.FC = () => {
    const { isAuthenticated } = useAuthContext();

    return (
        <div style={shellStyle}>
            <Routes>
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/delete-account" element={<AccountDeletionInfo />} />
                <Route path="/confirmation-success" element={<ConfirmationSuccess />} />
                <Route path="/invalid" element={<ConfirmationInvalid />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/confirm-deletion" element={<ConfirmDeletion />} />
                <Route path="/deletion-success" element={<DeletionSuccess />} />
                <Route path="/" element={isAuthenticated ? <GameHub /> : <AuthPage />} />
                <Route path="/play/santase" element={isAuthenticated ? <SantaseGame /> : <AuthPage />} />
                <Route path="/play/tabla" element={isAuthenticated ? <TablaGame /> : <AuthPage />} />
                <Route path="*" element={<NotFound />} />
            </Routes>
        </div>
    );
};

const shellStyle: React.CSSProperties = {
    // Deliberately not position:fixed. A fixed shell keeps its full height when
    // the on-screen keyboard opens, so the focused field ends up behind the
    // keyboard with nothing able to scroll. In normal flow the document can
    // scroll and the browser brings the focused input into view.
    position: 'relative',
    width: '100%',
    minHeight: '100dvh',
    overflowX: 'hidden',
    background: 'var(--bg)',
    fontFamily: 'var(--font-body)',
};

export default App;
