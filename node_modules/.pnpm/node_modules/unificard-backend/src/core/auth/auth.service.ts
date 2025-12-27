// src/core/auth/auth.service.ts
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { runQueryWithTenant } from '@core/database/pool';
import { identityService } from '@core/identity/identity.service';
import type {
  AuthUser,
  AuthTokens,
  JwtPayload,
  LoginResult,
} from '@core/auth/auth.types';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Type assertion após validação
const jwtSecret: string = JWT_SECRET;

// Tipagem do usuário do banco
interface UserRow {
  user_id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  global_user_id: string | null;
  created_at: Date;
  token_version: number;
}

class AuthService {
  private toAuthUser(row: UserRow): AuthUser {
    return {
      userId: row.user_id,
      tenantId: row.tenant_id,
      email: row.email,
      globalUserId: row.global_user_id,
      createdAt: row.created_at,
    };
  }

  private generateTokens(user: AuthUser, tokenVersion: number): AuthTokens {
    const basePayload: any = {
      sub: user.userId,
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      tokenVersion: tokenVersion, // CRÍTICO: Incluir tokenVersion no payload
    };
    
    if (user.globalUserId) {
      basePayload.globalUserId = user.globalUserId;
    }

    const accessToken = jwt.sign(
      { ...basePayload, type: 'access' as const },
      jwtSecret,
      { expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    const refreshToken = jwt.sign(
      { ...basePayload, type: 'refresh' as const },
      jwtSecret,
      { expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    return { accessToken, refreshToken };
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

      if (decoded.type !== 'access') {
        const error = new Error('Invalid token type') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      // Validar tokenVersion
      const userRow = await runQueryWithTenant<UserRow>(
        decoded.tenantId,
        `
          SELECT user_id, tenant_id, email, password_hash, global_user_id, created_at, token_version
          FROM users
          WHERE user_id = $1
          LIMIT 1
        `,
        [decoded.sub]
      );

      if (!userRow) {
        const error = new Error('User not found') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      if (decoded.tokenVersion !== userRow.token_version) {
        const error = new Error('Invalid or expired access token') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      return decoded;
    } catch (err: any) {
      // Se o erro já tem statusCode, preservar
      if (err.statusCode) {
        throw err;
      }
      const error = new Error('Invalid or expired access token') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
  }

  /**
   * Verifica JWT genérico sem verificar tipo (para tokens especiais como validação, QR codes, etc.)
   * Centraliza uso de jwt.verify() para evitar duplicação
   */
  verifyJWT<T = any>(token: string): T {
    try {
      return jwt.verify(token, jwtSecret) as T;
    } catch (err) {
      const error = new Error('Invalid or expired token') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
  }

  /**
   * Extrai token do header Authorization (Bearer <token>)
   * Centraliza lógica de extração para evitar duplicação
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7).trim();
  }

  async register(
    tenantId: string,
    email: string,
    password: string
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await runQueryWithTenant<UserRow>(
      tenantId,
      `
        SELECT user_id, tenant_id, email, password_hash, global_user_id, created_at, token_version
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (existing) {
      const error = new Error('Email already registered') as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const inserted = await runQueryWithTenant<UserRow>(
      tenantId,
      `
        INSERT INTO users (tenant_id, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING user_id, tenant_id, email, password_hash, global_user_id, created_at, token_version
      `,
      [tenantId, normalizedEmail, passwordHash]
    );

    if (!inserted) {
      throw new Error('Failed to create user');
    }

    const user = this.toAuthUser(inserted);
    
    // Criar identidade global automaticamente
    try {
      await identityService.createGlobalIdentityForUser(user.userId, tenantId);
    } catch (error) {
      // Log mas não falha o registro
      console.error('Erro ao criar identidade global:', error);
    }

    // CRÍTICO: Incluir token_version do banco no token gerado
    const tokens = this.generateTokens(user, inserted.token_version);

    return { user, tokens };
  }

  async login(
    tenantId: string,
    email: string,
    password: string
  ): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const userRow = await runQueryWithTenant<UserRow>(
      tenantId,
      `
        SELECT user_id, tenant_id, email, password_hash, global_user_id, created_at, token_version
        FROM users
        WHERE email = $1
        LIMIT 1
      `,
      [normalizedEmail]
    );

    if (!userRow) {
      const error = new Error('Invalid credentials') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const passwordMatch = await bcrypt.compare(password, userRow.password_hash);

    if (!passwordMatch) {
      const error = new Error('Invalid credentials') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const user = this.toAuthUser(userRow);
    // CRÍTICO: Incluir token_version do banco no token gerado
    const tokens = this.generateTokens(user, userRow.token_version);

    return { user, tokens };
  }

  async refreshToken(
    tenantId: string,
    refreshToken: string
  ): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, jwtSecret) as JwtPayload;

      if (decoded.type !== 'refresh') {
        const error = new Error('Invalid token type') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      if (decoded.tenantId !== tenantId) {
        const error = new Error('Invalid tenant for token') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      const userRow = await runQueryWithTenant<UserRow>(
        tenantId,
      `
        SELECT user_id, tenant_id, email, password_hash, global_user_id, created_at, token_version
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `,
        [decoded.sub]
      );

      if (!userRow) {
        const error = new Error('User not found') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }

      const user = this.toAuthUser(userRow);
      // CRÍTICO: Incluir token_version do banco no token gerado
      return this.generateTokens(user, userRow.token_version);
    } catch {
      const error = new Error('Invalid refresh token') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }
  }

  async logout(tenantId: string, userId: string): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `
        UPDATE users
        SET token_version = token_version + 1
        WHERE user_id = $1
      `,
      [userId]
    );
  }
}

export const authService = new AuthService();
