import axios from 'axios';

const apiClient = axios.create({
    // Use the FULL URL to bypass the React Dev Server 404/403
    baseURL: 'https://localhost/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Automatically attach JWT to every request if it exists
apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default apiClient;