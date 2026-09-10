import axios, { InternalAxiosRequestConfig } from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
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

/**
 * Flag on a rejection caused by the session rather than by what the player did.
 *
 * An expired token is not a failed move, so screens must not report it as one.
 */
const SESSION_EXPIRED = 'sessionExpired';

/** True when a request failed only because the session ended. */
export function isSessionExpired(error: unknown): boolean {
    return Boolean(
        error && typeof error === 'object' && (error as Record<string, unknown>)[SESSION_EXPIRED],
    );
}

function markSessionExpired<T>(error: T): T {
    if (error && typeof error === 'object') {
        (error as Record<string, unknown>)[SESSION_EXPIRED] = true;
    }
    return error;
}

/**
 * The refresh currently in flight, shared by every request that hit a 401.
 *
 * A game screen fires several requests in quick succession, so one expired
 * token produces several 401s at once and each used to refresh on its own —
 * three round trips to mint three tokens where one would do, with the last
 * write winning. Today's server issues refresh tokens statelessly and does not
 * invalidate the previous one, so the extras were merely wasteful; the moment
 * it starts invalidating on rotation they would start failing instead. They all
 * await this one promise.
 */
let refreshing: Promise<string> | null = null;

/** Set once the session is over, so the redirect happens a single time. */
let sessionEnded = false;

function refreshAccessToken(): Promise<string> {
    if (!refreshing) {
        const refreshToken = localStorage.getItem('refreshToken');

        // Plain axios, not apiClient: this request must never re-enter the
        // interceptor and refresh in a loop.
        refreshing = axios
            .post(`${API_BASE_URL}/auth/refresh`, { refreshToken })
            .then((response) => {
                const { token, refreshToken: rotated } = response.data;
                localStorage.setItem('token', token);
                if (rotated) {
                    localStorage.setItem('refreshToken', rotated);
                }
                return token as string;
            })
            .finally(() => {
                refreshing = null;
            });
    }
    return refreshing;
}

function endSession(): void {
    if (sessionEnded) return;
    sessionEnded = true;

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('username');
    window.location.href = '/';
}

// Response interceptor: refresh once on 401, then retry the original request.
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status !== 401) {
            return Promise.reject(error);
        }

        // A second 401 after a fresh token means the session is genuinely over.
        if (originalRequest?._retry) {
            endSession();
            return Promise.reject(markSessionExpired(error));
        }

        originalRequest._retry = true;

        try {
            const token = await refreshAccessToken();
            originalRequest.headers.set('Authorization', `Bearer ${token}`);
            return await apiClient(originalRequest);
        } catch (refreshError) {
            endSession();
            // The caller learns the session ended, not that their action failed.
            return Promise.reject(markSessionExpired(refreshError));
        }
    }
);

export default apiClient;
