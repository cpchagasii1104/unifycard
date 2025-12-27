// backend/src/core/auth/auth.types.ts
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
  sub: string; // userId
  tenantId: string;
  email: string;
  type: 'access' | 'refresh';
  userId?: string; // Alias para sub (compatibilidade)
  globalUserId?: string; // Identidade global do usuário
  role?: string;
  permissions?: string[];
  tokenVersion: number;
}
