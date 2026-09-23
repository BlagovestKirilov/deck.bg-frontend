import axios, { InternalAxiosRequestConfig } from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * The endpoints that need no session: logging in, registering, the whole
 * password-reset flow, and the deletion link — everything opened from an email,
 * where the browser is as likely as not to hold an expired session.
 *
 * None of them reads who is calling, and sending a token they never asked for
 * is how an expired session used to break a password-reset link: the server
 * judged the stale token and answered about that instead of about the link.
 */
function isPublic(url: string | undefined): boolean {
    const path = url ?? '';
    return path.startsWith('/auth/') || path === '/user/confirm-deletion';
}

apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token && config.headers && !isPublic(config.url)) {
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

/**
 * True when a request failed because of the session, not because of what the
 * player did: either the session is over, or it could not be renewed just now
 * because the server was out of reach. Screens stay silent about both — the
 * first ends in the login screen anyway, and the second fixes itself on the
 * next request.
 */
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

/**
 * Waits between refresh attempts that could not reach the server. Short on
 * purpose: they run while a tap is waiting for its answer.
 */
const REFRESH_RETRY_DELAYS_MS = [800, 2000];

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The server looked at the refresh token and turned it down, so no retry will
 * change the answer and the session really is over.
 *
 * Anything short of that — no answer at all, a timeout, a gateway error while a
 * deploy restarts the backend — says nothing about the token, and must not log
 * anyone out. That used to be exactly what happened: every deploy could send a
 * player in the middle of a game to the login screen.
 *
 * A 5xx means "try again": the server is down or restarting, and that says
 * nothing about the token. An unreadable refresh token used to arrive as one of
 * those, carrying the jjwt exception's name for this function to match on; the
 * endpoint answers 401 for it now, so the status alone is the whole story.
 */
function refreshRejected(error: unknown): boolean {
    const response = (error as { response?: { status: number } })?.response;
    if (!response) return false;
    return response.status < 500;
}

async function requestRefresh(): Promise<string> {
    for (let attempt = 0; ; attempt++) {
        try {
            // Read on every attempt: another tab may have rotated it meanwhile.
            const refreshToken = localStorage.getItem('refreshToken');

            // Plain axios, not apiClient: this request must never re-enter the
            // interceptor and refresh in a loop.
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
            const { token, refreshToken: rotated } = response.data;
            localStorage.setItem('token', token);
            if (rotated) {
                localStorage.setItem('refreshToken', rotated);
            }
            return token as string;
        } catch (error) {
            if (refreshRejected(error) || attempt >= REFRESH_RETRY_DELAYS_MS.length) throw error;
            await wait(REFRESH_RETRY_DELAYS_MS[attempt]);
        }
    }
}

function refreshAccessToken(): Promise<string> {
    if (!refreshing) {
        refreshing = requestRefresh().finally(() => {
            refreshing = null;
        });
    }
    return refreshing;
}

/** When the token expires, in milliseconds, or null if it cannot be read. */
function expiryOf(token: string): number | null {
    try {
        const [, payload] = token.split('.');
        const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        return typeof exp === 'number' ? exp * 1000 : null;
    } catch {
        return null;
    }
}

/** Renewed this long before it expires, so it survives the connection. */
const SOCKET_TOKEN_MARGIN_MS = 60_000;

/**
 * An access token good for opening the game socket.
 *
 * The socket sends it once, on the CONNECT frame, and nothing checks it again
 * for the life of that connection — so unlike a request, it cannot be retried
 * with a fresh token after a 401. It is renewed up front when it is close to
 * expiring.
 *
 * Returns whatever is stored if the renewal cannot be reached: the socket then
 * fails to connect and the caller's reconnect brings it round again, which is
 * the same thing that happens to any dropped connection.
 */
export async function socketToken(): Promise<string | null> {
    const token = localStorage.getItem('token');
    if (!token) return null;

    // Only renew when the token says it is nearly out. One that cannot be read
    // is handed over as it is: the server judges it, and a refusal is just
    // another failed connection, which the caller already retries.
    const expiry = expiryOf(token);
    if (expiry === null || expiry - Date.now() > SOCKET_TOKEN_MARGIN_MS) return token;

    try {
        return await refreshAccessToken();
    } catch {
        return token;
    }
}

/**
 * A 401 that has nothing to do with the player's session.
 *
 * Public endpoints answer 401 about the thing they were asked to check — a
 * password-reset link that has expired, for one. Treating that as an expired
 * session tried a refresh, found none, and threw the person onto the login
 * screen instead of the "invalid link" page. And a request that carried no
 * token cannot have had its token expire.
 */
function isOutsideSession(config: InternalAxiosRequestConfig | undefined): boolean {
    if (!config) return true;
    if (isPublic(config.url)) return true;
    return !config.headers?.get('Authorization');
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

        if (error.response?.status !== 401 || isOutsideSession(originalRequest)) {
            return Promise.reject(error);
        }

        // A second 401 after a fresh token means the session is genuinely over.
        if (originalRequest._retry) {
            endSession();
            return Promise.reject(markSessionExpired(error));
        }

        originalRequest._retry = true;

        let token: string;
        try {
            token = await refreshAccessToken();
        } catch (refreshError) {
            if (refreshRejected(refreshError)) {
                endSession();
                // The caller learns the session ended, not that their action failed.
                return Promise.reject(markSessionExpired(refreshError));
            }
            // The server could not be reached to renew the token. The session
            // is not over: the tokens stay, and the next request tries again.
            // Flagged so no screen reports it as a failed move.
            return Promise.reject(markSessionExpired(error));
        }

        // Retried outside the try above. A retried move the server refuses —
        // not your turn, already played — is an ordinary answer to the move.
        // Inside the try it was caught as a failed refresh, and a refused move
        // right after the token expired logged the player out mid-game.
        originalRequest.headers.set('Authorization', `Bearer ${token}`);
        return apiClient(originalRequest);
    }
);

export default apiClient;
