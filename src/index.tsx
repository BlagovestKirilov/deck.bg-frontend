import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
);

root.render(
    <React.StrictMode>
        {/* Wrapping App in AuthProvider is essential for useAuthContext to work */}
        <AuthProvider>
            <App />
        </AuthProvider>
    </React.StrictMode>
);