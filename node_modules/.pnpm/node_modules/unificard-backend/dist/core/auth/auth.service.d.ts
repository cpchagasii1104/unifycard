import type { AuthTokens, JwtPayload, LoginResult } from '@core/auth/auth.types';
declare class AuthService {
    private toAuthUser;
    private generateTokens;
    verifyAccessToken(token: string): Promise<JwtPayload>;
    register(tenantId: string, email: string, password: string): Promise<LoginResult>;
    login(tenantId: string, email: string, password: string): Promise<LoginResult>;
    refreshToken(tenantId: string, refreshToken: string): Promise<AuthTokens>;
}
export declare const authService: AuthService;
export {};
//# sourceMappingURL=auth.service.d.ts.map