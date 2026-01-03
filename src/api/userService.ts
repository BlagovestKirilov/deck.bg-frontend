import apiClient from './apiClient';
import {ProfileResponse} from '../types/user.types';

export const userService = {
    getProfile: async (signal?: AbortSignal): Promise<ProfileResponse> => {
        const {data} = await apiClient.get<ProfileResponse>('/user/profile', {signal});
        return data;
    },
}
