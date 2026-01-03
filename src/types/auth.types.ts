export interface AuthRequest {
    username: string;
    password: string;
    email?: string;
}

// Your Java AuthResponse with @JsonInclude(NON_NULL)
export interface AuthResponse {
    status: string;
    message: string;
    token?: string;
    refreshToken?: string;
}

export interface ApiError {
    error?: string;
    message: string;
}