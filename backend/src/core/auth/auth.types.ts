// backend/src/core/auth/auth.types.ts
export interface AuthUser {
  userId: string;
  tenantId: string;
  email: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult {
  user: AuthUser;
  tokens: AuthTokens;
  requiresOnboarding?: boolean;
}

export interface JwtPayload {
  sub: string; // userId
  tenantId: string;
  email: string;
  type: 'access' | 'refresh';
  userId?: string; // Alias para sub (compatibilidade)
  globalUserId?: string; // Opcional - resolvido via user_identity_links
  role?: string;
  permissions?: string[];
  tokenVersion: number;
}

