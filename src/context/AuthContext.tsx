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
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);

        setUser(userData);
        setIsAuthenticated(true);
    };

    const logout = () => {
        localStorage.clear();
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