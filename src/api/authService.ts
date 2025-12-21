import apiClient from './apiClient';
import { AuthRequest, AuthResponse } from '../types/auth.types';

export const authService = {
    /**
     * Calls @PostMapping("/login")
     */
    login: async (credentials: AuthRequest): Promise<AuthResponse> => {
        const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
        return data;
    },

    /**
     * Calls @PostMapping("/register")
     */
    register: async (credentials: AuthRequest): Promise<AuthResponse> => {
        const { data } = await apiClient.post<AuthResponse>('/auth/register', credentials);
        return data;
    },

    /**
     * Helper to store session
     */
    handleAuthSuccess: (response: AuthResponse) => {
        if (response.token) localStorage.setItem('token', response.token);
        if (response.refreshToken) localStorage.setItem('refreshToken', response.refreshToken);
    }
};