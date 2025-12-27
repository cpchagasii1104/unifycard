export interface AuthUser {
    userId: string;
    tenantId: string;
    email: string;
    globalUserId?: string | null;
    createdAt: Date;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
}
export interface LoginResult {
    user: AuthUser;
    tokens: AuthTokens;
}
export interface JwtPayload {
    sub: string;
    tenantId: string;
    email: string;
    type: 'access' | 'refresh';
    userId?: string;
    role?: string;
    permissions?: string[];
}
//# sourceMappingURL=auth.types.d.ts.map