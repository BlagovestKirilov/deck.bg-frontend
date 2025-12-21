import { useState } from 'react';
import { authService } from '../api/authService';
import { AuthRequest } from '../types/auth.types';
import { useAuthContext } from '../context/AuthContext'; // Import our new context hook

export const useAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { saveAuth } = useAuthContext(); // Get the save function

    const performAction = async (action: 'login' | 'register', data: AuthRequest) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await authService[action](data);

            // If Java returns tokens, save them globally
            if (response.token && response.refreshToken) {
                saveAuth(response.token, response.refreshToken);
            }

            return response;
        } catch (err: any) {
            const msg = err.response?.data?.message || 'Connection Error';
            setError(msg);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { performAction, isLoading, error };
};