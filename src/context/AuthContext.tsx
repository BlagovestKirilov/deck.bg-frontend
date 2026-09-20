import React, { createContext, useContext, useState, ReactNode } from 'react';

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

/**
 * The session this device already holds, or null.
 *
 * Read while the provider is first rendering, not in an effect: an effect runs
 * after the first paint, so a signed-in tab painted the sign-in screen — deal
 * animation and all — for one frame on every refresh before swapping to the
 * hub. Storage can throw when a browser has it blocked.
 */
function storedSession(): User | null {
    try {
        const token = localStorage.getItem('token');
        const username = localStorage.getItem('username');
        return token && username ? { username } : null;
    } catch {
        return null;
    }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(storedSession);
    // Derived, not a second piece of state: the two cannot disagree.
    const isAuthenticated = user !== null;

    const login = (userData: User, token: string, refreshToken?: string) => {
        localStorage.setItem('token', token);
        localStorage.setItem('username', userData.username);
        // Kept past logout so the login form can offer the name back, the way
        // the browser offers the saved password.
        localStorage.setItem(REMEMBERED_USERNAME, userData.username);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

        setUser(userData);
    };

    const logout = () => {
        // Only the session goes. localStorage.clear() took everything with it —
        // the remembered username, the табла checker colour, any per-device
        // preference — none of which is session data.
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');

        setUser(null);
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