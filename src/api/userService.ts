import apiClient from './apiClient';
import {ProfileResponse} from '../types/user.types';

export const userService = {
    getProfile: async (signal?: AbortSignal): Promise<ProfileResponse> => {
        const {data} = await apiClient.get<ProfileResponse>('/user/profile', {signal});
        return data;
    },
    resendEmail: async (): Promise<{ success: boolean; message: string }> => {
        try {
            await apiClient.post('/user/confirm-email');
            return { success: true, message: 'Имейлът е изпратен успешно!' };
        } catch (error: any) {
            if (error.response?.status === 400) {
                return { success: false, message: 'Имейлът вече е потвърден.' };
            }
            throw error;
        }
    },
    changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
        try {
            await apiClient.post('/user/change-password', {
                currentPassword,
                newPassword
            });
            return { success: true, message: 'Паролата е променена успешно!' };
        } catch (error: any) {
            if (error.response?.status === 400) {
                const errorMessage = error.response?.data?.message || '';
                if (errorMessage === 'Username or password is incorrect.') {
                    return { success: false, message: 'Текущата парола е неправилна.' };
                }
                return { success: false, message: 'Неуспешна промяна на паролата.' };
            }
            throw error;
        }
    },
    sendUserDeletionEmail: async (password: string): Promise<{ success: boolean; message: string }> => {
        try {
            await apiClient.post('/user/delete-user', { password });
            return { success: true, message: 'Имейл за изтриване на акаунта е изпратен успешно!' };
        } catch (error: any) {
            if (error.response?.status === 400) {
                return { success: false, message: 'Грешна парола.' };
            }
            throw error;
        }
    },
}
