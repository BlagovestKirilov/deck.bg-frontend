import { useState } from 'react';
import { authService } from '../api/authService';
import { useAuthContext } from '../context/AuthContext';

export const useAuth = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Destructure 'login' from context (previously you had 'saveAuth')
    const { login } = useAuthContext();

    const performAction = async (action: 'login' | 'register', form: any) => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await (action === 'login'
                ? authService.login(form)
                : authService.register(form));

            // Use the login function from context to update global state
            // response.token comes from your AuthResponse type
            if(action === 'login') {
                login(
                    {username: form.username},
                    response.token,
                    response.refreshToken
                );
            }

            return response;
        } catch (err: any) {
            const message = err.response?.data?.message || 'Authentication failed';
            setError(message);
            throw err;
        } finally {
            setIsLoading(false);
        }
    };

    return { performAction, isLoading, error };
};