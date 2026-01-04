import apiClient from './apiClient';
import {ProfileResponse} from '../types/user.types';

export const userService = {
    getProfile: async (signal?: AbortSignal): Promise<ProfileResponse> => {
        const {data} = await apiClient.get<ProfileResponse>('/user/profile', {signal});
        return data;
    },
    resendEmail: async (): Promise<{ success: boolean; message: string }> => {
        try {
            await apiClient.post('/user/resend-email');
            return { success: true, message: 'Имейлът е изпратен успешно!' };
        } catch (error: any) {
            if (error.response?.status === 400) {
                return { success: false, message: 'Имейлът вече е потвърден.' };
            }
            throw error;
        }
    },
}
