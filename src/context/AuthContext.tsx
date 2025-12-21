import React, { createContext, useContext, useState, ReactNode } from 'react';

// Define what our Auth State looks like
interface AuthState {
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
}

// Define the functions our components can use
interface AuthContextType extends AuthState {
    saveAuth: (token: string, refreshToken: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [authState, setAuthState] = useState<AuthState>({
        token: localStorage.getItem('token'),
        refreshToken: localStorage.getItem('refreshToken'),
        isAuthenticated: !!localStorage.getItem('token'),
    });

    // Function to call after a successful Login/Register
    const saveAuth = (token: string, refreshToken: string) => {
        localStorage.setItem('token', token);
        localStorage.setItem('refreshToken', refreshToken);
        setAuthState({
            token,
            refreshToken,
            isAuthenticated: true,
        });
    };

    // Function to wipe everything on logout
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setAuthState({
            token: null,
            refreshToken: null,
            isAuthenticated: false,
        });
    };

    return (
        <AuthContext.Provider value={{ ...authState, saveAuth, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to make using the context easy
export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};