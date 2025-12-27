import axios, { InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
    baseURL: 'https://deck.bg/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token && config.headers) {
            config.headers.set('Authorization', `Bearer ${token}`);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 and Refresh Token
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 and we haven't already tried to refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');

                // We use axios (not apiClient) to avoid an infinite loop of 401s
                const response = await axios.post('https://deck.bg/api/auth/refresh', {
                    refreshToken: refreshToken
                });

                const { token, refreshToken: newRefreshToken } = response.data;

                // Update Storage
                localStorage.setItem('token', token);
                if (newRefreshToken) {
                    localStorage.setItem('refreshToken', newRefreshToken);
                }

                // Update Header and Retry original request
                originalRequest.headers.set('Authorization', `Bearer ${token}`);
                return apiClient(originalRequest);
            } catch (refreshError) {
                // If refresh fails, clear everything and redirect to login
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('username');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;