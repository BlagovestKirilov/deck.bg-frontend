import axios, { InternalAxiosRequestConfig } from 'axios';

const apiClient = axios.create({
    // Use the FULL URL to bypass the React Dev Server 404/403
    baseURL: 'https://localhost/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');

        if (token && config.headers) {
            // Standard way to set headers in Axios 1.x+
            config.headers.set('Authorization', `Bearer ${token}`);

            // Console log to verify in the browser
            console.log(`Sending token to: ${config.url}`);
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default apiClient;