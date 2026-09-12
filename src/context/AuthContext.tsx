import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
    username: string;
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (userData: User, token: string, refreshToken?: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** The last username that signed in on this device. Survives logout. */
export const REMEMBERED_USERNAME = 'lastUsername';

/** The remembered name, or '' when there is none. Storage can throw. */
export function rememberedUsername(): string {
    try {
        return localStorage.getItem(REMEMBERED_USERNAME) ?? '';
    } catch {
        return '';
    }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Persist session on refresh
    useEffect(() => {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        if (token && username) {
            setUser({ username });
            setIsAuthenticated(true);
        }
    }, []);

    const login = (userData: User, token: string, refreshToken?: string) => {
        localStorage.setItem('token', token);
        localStorage.setItem('username', userData.username);
        // Kept past logout so the login form can offer the name back, the way
        // the browser offers the saved password.
        localStorage.setItem(REMEMBERED_USERNAME, userData.username);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

        setUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        // Only the session goes. localStorage.clear() took everything with it —
        // the remembered username, the табла checker colour, any per-device
        // preference — none of which is session data.
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');

        setUser(null);
        setIsAuthenticated(false);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuthContext must be used within an AuthProvider');
    }
    return context;
};