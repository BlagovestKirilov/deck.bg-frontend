import apiClient from './apiClient';
import { AuthRequest, AuthResponse } from '../types/auth.types';

export const authService = {
    login: async (credentials: AuthRequest): Promise<AuthResponse> => {
        const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
        return data;
    },

    register: async (credentials: AuthRequest): Promise<AuthResponse> => {
        const { data } = await apiClient.post<AuthResponse>('/auth/register', credentials);
        return data;
    },

    /**
     * Explicitly call refresh (used by the interceptor)
     */
    refresh: async (refreshToken: string): Promise<AuthResponse> => {
        const { data } = await apiClient.post<AuthResponse>('/auth/refresh', { refreshToken });
        return data;
    },

    /**
     * Helper to store session
     */
    handleAuthSuccess: (response: AuthResponse, username: string) => {
        // Map Spring Boot response fields to LocalStorage keys
        if (response.token) {
            localStorage.setItem('token', response.token);
        }
        if (response.refreshToken) {
            localStorage.setItem('refreshToken', response.refreshToken);
        }

        localStorage.setItem('username', username);
    },

    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
    },

    forgotPassword: async (email: string): Promise<void> => {
        await apiClient.post('/auth/forgot-password', { email });
    },

    resetPassword: async (token: string, newPassword: string): Promise<void> => {
        await apiClient.post('/auth/change-password', { token, newPassword });
    },

    validateLink: async (token: string): Promise<void> => {
        await apiClient.get(`/auth/validate-link?token=${encodeURIComponent(token)}`);
    }
};