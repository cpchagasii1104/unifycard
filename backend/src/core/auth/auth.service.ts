/**
 * ⚠️ LEGADO PRÉ-GATE-0 — CONGELADO
 *
 * Este arquivo contém lógica histórica anterior ao fechamento do Gate 0.
 *
 * Após o Gate 0:
 * - users.global_user_id é a ÚNICA fonte de verdade para identidade global.
 * - user_identity_links NÃO é autoridade.
 * - resolveGlobalUserId NÃO deve ser usado como referência.
 *
 * Este arquivo:
 * - NÃO deve ser refatorado
 * - NÃO deve ser usado como modelo
 * - NÃO deve ser expandido
 *
 * Qualquer alteração só é permitida após abertura formal do Gate 1.
 */

// src/core/auth/auth.service.ts
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import { runQueryWithTenant } from '@core/database/pool';
import type { Gender } from '@unificard/contracts';
import { canonicalLogger } from '@core/logging/canonical-logger';
import type {
  AuthUser,
  AuthTokens,
  JwtPayload,
  LoginResult,
} from '@core/auth/auth.types';
import { validateCpfOrThrow, normalizeCpf, sanitizeCpfForLog } from '@utils/cpf.validator';
import { normalizeFullName } from '@utils/nameNormalizer';
import { normalizeBirthdate } from '@utils/dateNormalizer';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Type assertion após validação
const jwtSecret: string = JWT_SECRET;

// Tipagem do usuário do banco (colunas físicas em snake_case — ver migrations)
interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  token_version: number;
}

class AuthService {
  private toAuthUser(row: UserRow): AuthUser {
    const created = row.created_at;
    return {
      userId: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      createdAt: created instanceof Date ? created.toISOString() : String(created),
    };
  }

  private generateTokens(user: AuthUser, tokenVersion: number, globalUserId?: string): AuthTokens {
    const basePayload: any = {
      sub: user.userId,
      userId: user.userId,
      tenantId: user.tenantId,
      email: user.email,
      tokenVersion: tokenVersion, // CRÍTICO: Incluir tokenVersion no payload
    };

    // Incluir globalUserId se disponível (opcional - não quebra se ausente)
    if (globalUserId) {
      basePayload.globalUserId = globalUserId;
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

      // 🔴 GARANTIA CANÔNICA 1: Tipo de token deve ser 'access'
      if (decoded.type !== 'access') {
        const error = new Error('Invalid token type') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      // 🔴 GARANTIA CANÔNICA 2: tenantId OBRIGATÓRIO no JWT - fail fast
      // Nenhuma query pode ser executada sem tenantId válido
      if (!decoded.tenantId || typeof decoded.tenantId !== 'string') {
        const error = new Error('Invalid token: tenantId missing') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      // 🔴 GARANTIA CANÔNICA 3: tokenVersion OBRIGATÓRIO no JWT - fail fast
      // Nenhuma validação pode ser executada sem tokenVersion
      if (typeof decoded.tokenVersion !== 'number') {
        const error = new Error('Invalid token: tokenVersion missing') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      // 🔴 GARANTIA CANÔNICA 4: Validar tokenVersion contra banco
      // Esta é a única validação que requer query ao banco
      const userRow = await runQueryWithTenant<UserRow>(
        decoded.tenantId,
        `
          SELECT id, tenant_id, email, password_hash, created_at, token_version
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [decoded.sub]
      );

      if (!userRow) {
        const error = new Error('User not found') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      // 🔴 GARANTIA CANÔNICA 5: tokenVersion deve corresponder ao banco
      // Se não corresponder, token foi invalidado (logout ou invalidação manual)
      if (decoded.tokenVersion !== userRow.token_version) {
        // 🔴 LOG CANÔNICO: Token invalidation detectada (tokenVersion não corresponde)
        canonicalLogger.invalidation(null, 'Token invalidation: tokenVersion não corresponde', {
          tenantId: decoded.tenantId,
          userId: decoded.sub,
          tokenVersionFromToken: decoded.tokenVersion,
          tokenVersionFromDB: userRow.token_version,
          reason: 'Token foi invalidado (logout ou invalidação manual)',
        });
        const error = new Error('Invalid or expired access token') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      return decoded;
    } catch (err: any) {
      // Se o erro já tem statusCode, preservar (não mascarar erros específicos)
      if (err.statusCode) {
        throw err;
      }
      // Erro genérico apenas se não for erro de validação específico
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
    tenantId: string | undefined,
    email: string,
    password: string,
    cpf?: string,
    fullName?: string,
    birthdate?: string,
    gender?: Gender,
    referralCode?: string
  ): Promise<LoginResult & { tenantId: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // ── TENANT server-side (F-C1-BIRTH-MINIMUM-ATOMIC-ORGANIC · decisão TENANT FECHADA · DECISION-0115 D1) ──
    // x-tenant-id / qualquer input do cliente NÃO escolhe tenant no cadastro. O cadastro orgânico
    // resolve `unificard-inicial` SERVER-SIDE. Zero criação de tenant `user-*`. O override
    // cross-tenant por convite está DECIDIDO mas SEM substrato seguro → fica para
    // F-C1-TENANT-INVITE-RESOLUTION (ver DT-C1-TENANT-INVITE-RESOLUTION-NO-SUBSTRATE).
    // O parâmetro `tenantId` (oriundo do header x-tenant-id) é IGNORADO como autoridade por desenho.
    void tenantId;
    const { tenantService } = await import('@core/tenants/tenant.service');
    const institutionalTenant = await tenantService.getTenantBySlug('unificard-inicial');
    const finalTenantId = institutionalTenant.tenantId;
    canonicalLogger.info(null, 'Cadastro orgânico → tenant institucional unificard-inicial', {
      tenantId: finalTenantId,
      email: normalizedEmail.substring(0, 3) + '***',
    });

    // ── PILOT_MODE: gate de ADMISSÃO dentro de unificard-inicial (NÃO escolhe tenant) ──
    // Falha ANTES de qualquer escrita. Nenhum tenant é criado/revertido (não criamos tenant).
    if (process.env.PILOT_MODE === 'true') {
      const { pilotInvitesService } = await import('@core/pilot/pilot-invites.service');
      const hasInvite = await pilotInvitesService.hasValidInvite(finalTenantId, normalizedEmail);
      if (!hasInvite) {
        const error = new Error('O sistema está em fase de piloto fechado.') as Error & { statusCode?: number };
        error.statusCode = 403;
        throw error;
      }
    }

    // ── VALIDAÇÕES PRÉ-TRANSAÇÃO (zero escrita) ──
    const existing = await runQueryWithTenant<UserRow>(
      finalTenantId,
      `SELECT id, tenant_id, email, password_hash, created_at, token_version
         FROM users WHERE email = $1 LIMIT 1`,
      [normalizedEmail]
    );
    if (existing) {
      const error = new Error('Email already registered') as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    if (!cpf) {
      const error = new Error('CPF é obrigatório para cadastro') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }
    try {
      validateCpfOrThrow(cpf);
    } catch (validationError) {
      const error = new Error(validationError instanceof Error ? validationError.message : 'CPF inválido') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const normalizedCpf = normalizeCpf(cpf);
    const normalizedFullName = fullName ? normalizeFullName(fullName) : null;
    const normalizedBirthdate = birthdate ? normalizeBirthdate(birthdate) : null;

    // ── REFERRAL: validar DENTRO de unificard-inicial ANTES de qualquer escrita ──
    // Referral NÃO escolhe tenant; é intra-tenant (decisão FECHADA). Código inválido → 400
    // honesto, ANTES da transação (zero estado parcial). A APLICAÇÃO ocorre pós-commit
    // (dado progressivo financeiro; nascimento já completo). NÃO procurar cross-tenant.
    if (referralCode) {
      const referrer = await runQueryWithTenant<{ id: string }>(
        finalTenantId,
        `SELECT id FROM users WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2) LIMIT 1`,
        [finalTenantId, referralCode]
      );
      if (!referrer) {
        const error = new Error('Código de indicação inválido') as Error & { statusCode?: number; code?: string };
        error.statusCode = 400;
        error.code = 'INVALID_REFERRAL_CODE';
        throw error;
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUserId = randomUUID();

    // ── NASCIMENTO ATÔMICO: global_user → user → identity → actor em UMA transação ──
    // Token só após COMMIT. Qualquer falha → ROLLBACK total (withTransaction), sem estado
    // residual e sem token. SEM best-effort de identity/actor; SEM "retentar no próximo acesso".
    const { withTransaction } = await import('@core/database/transaction.helper');
    const { identityService } = await import('@core/identity/identity.service');
    const { ensureUserActorTx } = await import('@modules/identity/actor-writer.service');

    const birth = await withTransaction(finalTenantId, async (client) => {
      // global_users UPSERT por CPF (SSOT de identidade global; identidade compartilhada entre tenants)
      const gu = await client.query(
        `INSERT INTO global_users (cpf, full_name, avatar_url, birthdate, metadata)
           VALUES ($1, $2, NULL, $3::DATE, '{}'::jsonb)
           ON CONFLICT (cpf) DO UPDATE SET cpf = EXCLUDED.cpf
           RETURNING global_user_id`,
        [normalizedCpf, normalizedFullName, normalizedBirthdate]
      );
      const globalUserId = gu.rows[0]?.global_user_id as string | undefined;
      if (!globalUserId) {
        throw new Error('Failed to create or retrieve global user');
      }

      // users INSERT (global_user_id no INSERT — SSOT)
      let userRow: UserRow;
      try {
        const ins = await client.query(
          `INSERT INTO users (id, tenant_id, global_user_id, email, password_hash, plan)
             VALUES ($1, $2, $3, $4, $5, 'free')
             RETURNING id, tenant_id, email, password_hash, created_at, token_version`,
          [newUserId, finalTenantId, globalUserId, normalizedEmail, passwordHash]
        );
        userRow = ins.rows[0] as UserRow;
        if (!userRow) throw new Error('Failed to create user');
      } catch (dbError: any) {
        if (dbError?.code === '23505') {
          const error = new Error('Email already registered') as Error & { statusCode?: number };
          error.statusCode = 409;
          throw error;
        }
        throw dbError;
      }

      // profiles(cpf) — dedup CPF ATÔMICO (23505 → ROLLBACK total → 409). Writer já existente
      // (não é completude nova): preserva a integridade de CPF dentro da mesma transação.
      try {
        await client.query(
          `INSERT INTO profiles (tenant_id, user_id, cpf) VALUES ($1, $2, $3)`,
          [finalTenantId, userRow.id, normalizedCpf]
        );
      } catch (dbError: any) {
        if (dbError?.code === '23505') {
          const error = new Error('CPF já está em uso por outra conta') as Error & { statusCode?: number };
          error.statusCode = 409;
          throw error;
        }
        throw dbError;
      }

      // identity mínima (mesmo client) — ANTES do actor (FK actors.global_user_id → identities)
      await identityService.ensureIdentityRowForGlobalUserTx(client, globalUserId);
      // actor humano (mesmo client) — fail-closed; falha aqui → ROLLBACK total (sem órfão)
      await ensureUserActorTx(client, finalTenantId, userRow.id);

      return { globalUserId, userRow };
    });

    const { globalUserId, userRow } = birth;
    const user = this.toAuthUser(userRow);

    if (typeof userRow.token_version !== 'number') {
      throw new Error('Schema inválido: token_version ausente após criação de usuário');
    }

    // ── TOKEN somente APÓS COMMIT bem-sucedido (tenant = unificard-inicial) ──
    const tokens = this.generateTokens(user, userRow.token_version, globalUserId);

    canonicalLogger.info(null, 'Nascimento atômico concluído (commit + token)', {
      tenantId: finalTenantId,
      userId: user.userId,
      tokenVersion: userRow.token_version,
    });

    // ── PÓS-COMMIT — DADOS PROGRESSIVOS (best-effort; nascimento já é COMPLETO e atômico) ──
    // DECISION-0115: perfil/gender/referral são progressivos, NÃO requisitos do nascimento.
    // Gender permanece em metadata (casa canônica fica para a Fatia 4; fora do escopo aqui).
    if (fullName || birthdate || gender || normalizedCpf) {
      try {
        const { profileService } = await import('@core/profile/profile.service');
        const profileMetadata: Record<string, any> = {};
        if (gender) profileMetadata.gender = gender;
        if (normalizedCpf) profileMetadata.cpf = normalizedCpf;
        await profileService.upsertProfile(finalTenantId, user.userId, {
          fullName: normalizedFullName || undefined,
          metadata: Object.keys(profileMetadata).length > 0 ? profileMetadata : undefined,
        });
      } catch (profileError) {
        console.warn('Erro ao salvar dados progressivos do perfil (não crítico):', profileError);
      }
    }

    // Referral já validado pré-tx; aplicação pós-commit (financeiro/progressivo). Falha aqui
    // (ex.: corrida) NÃO invalida o nascimento completo — não é "criação parcial".
    if (referralCode) {
      try {
        const { referralService } = await import('@core/referral/referral.service');
        await referralService.applyReferralCode(finalTenantId, user.userId, referralCode);
      } catch (err) {
        console.warn('[register] aplicação de referral pós-commit falhou (não crítico):', err);
      }
    }

    if (process.env.PILOT_MODE === 'true') {
      try {
        const { pilotInvitesService } = await import('@core/pilot/pilot-invites.service');
        await pilotInvitesService.acceptInvite(finalTenantId, normalizedEmail);
      } catch (err) {
        console.warn('[AuthService] Erro ao marcar convite como aceito:', err);
      }
    }

    // Código próprio de indicação (não faz parte do contrato de resposta) — progressivo.
    try {
      const { referralService } = await import('@core/referral/referral.service');
      await referralService.getOrCreateReferralCode(finalTenantId, user.userId);
    } catch (err) {
      console.error('[AuthService] ❌ ERRO ao gerar código de indicação (não crítico):', err instanceof Error ? err.message : String(err));
    }

    const requiresOnboarding = true;
    return {
      user,
      tokens,
      tenantId: finalTenantId,
      requiresOnboarding,
    };
  }

  async login(
    tenantId: string | undefined,
    email: string,
    password: string
  ): Promise<LoginResult & { tenantId: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Para autenticação, usar query direta que contorna RLS
    // RLS pode bloquear queries mesmo com set_config em alguns casos
    const { pool } = await import('@core/database/pool');
    const client = await pool.connect();
    
    try {
      // Buscar usuário apenas por email (tenant_id será obtido do usuário encontrado)
      const result = await client.query<UserRow>(
        `
        SELECT id, tenant_id, email, password_hash, created_at, token_version
        FROM users
        WHERE email = $1
        LIMIT 1
        `,
        [normalizedEmail]
      );

      const userRow = result.rows[0];

      if (!userRow) {
        // 🔴 LOG CANÔNICO: Login failure - user não encontrado
        canonicalLogger.warn(null, 'Login failure: User não encontrado', {
          email: normalizedEmail.substring(0, 3) + '***',
          tenantId: tenantId || undefined,
        });
        const error = new Error('Invalid credentials') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      // Usar o tenant_id do usuário encontrado
      const userTenantId = userRow.tenant_id;

      const passwordHash = userRow.password_hash;
      const passwordMatch = await bcrypt.compare(password, passwordHash);

      if (!passwordMatch) {
        // 🔴 LOG CANÔNICO: Login failure - senha incorreta
        canonicalLogger.warn(null, 'Login failure: Senha incorreta', {
          tenantId: userRow.tenant_id,
          userId: userRow.id,
          email: normalizedEmail.substring(0, 3) + '***',
        });
        const error = new Error('Invalid credentials') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      const user = this.toAuthUser(userRow);

      // 🔴 GARANTIA CANÔNICA: Resolver globalUserId via users.global_user_id
      // Usar o tenant_id do usuário encontrado, não o passado como parâmetro
      let globalUserId: string | undefined = undefined;
      try {
        const userWithGlobal = await runQueryWithTenant<{ global_user_id: string | null }>(
          userTenantId,
          `
            SELECT global_user_id
            FROM users
            WHERE id = $1
            LIMIT 1
          `,
          [userRow.id]
        );
        
        if (userWithGlobal?.global_user_id) {
          globalUserId = userWithGlobal.global_user_id;
        }
      } catch (err) {
        // Não crítico - continuar sem globalUserId
        console.warn('[AuthService] Não foi possível resolver globalUserId:', err);
      }

      // CRÍTICO: Incluir token_version do banco no token gerado
      const tokens = this.generateTokens(user, userRow.token_version, globalUserId);

      // 🔴 LOG CANÔNICO: Login success
      canonicalLogger.info(null, 'Login success', {
        tenantId: userRow.tenant_id,
        userId: userRow.id,
        email: normalizedEmail.substring(0, 3) + '***',
        tokenVersion: userRow.token_version,
      });

      // 🔴 PARTE 2 - ONBOARDING: Verificar status de onboarding
      let requiresOnboarding = false;
      try {
        const { profileService } = await import('@core/profile/profile.service');
        const isCompleted = await profileService.isOnboardingCompleted(userRow.tenant_id, user.userId);
        requiresOnboarding = !isCompleted;
      } catch (err) {
        // Se não conseguir verificar, assumir que precisa de onboarding
        requiresOnboarding = true;
      }

      return { 
        user, 
        tokens, 
        tenantId: userRow.tenant_id,
        requiresOnboarding 
      };
    } finally {
      client.release();
    }
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

      // 🔴 GARANTIA CANÔNICA: tenantId OBRIGATÓRIO no refresh token - fail fast
      if (!decoded.tenantId || typeof decoded.tenantId !== 'string') {
        const error = new Error('Invalid refresh token: tenantId missing') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      if (decoded.tenantId !== tenantId) {
        const error = new Error('Invalid tenant for token') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      // 🔴 GARANTIA CANÔNICA: tokenVersion OBRIGATÓRIO no refresh token - fail fast
      if (typeof decoded.tokenVersion !== 'number') {
        canonicalLogger.warn(null, 'Refresh token inválido: tokenVersion ausente', {
          tenantId,
          userId: decoded.sub,
        });
        const error = new Error('Invalid refresh token: tokenVersion missing') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      const userRow = await runQueryWithTenant<UserRow>(
        tenantId,
      `
        SELECT id, tenant_id, email, password_hash, created_at, token_version
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
        [decoded.sub]
      );

      if (!userRow) {
        canonicalLogger.warn(null, 'Refresh token inválido: User não encontrado', {
          tenantId,
          userId: decoded.sub,
        });
        const error = new Error('User not found') as Error & { statusCode?: number };
        error.statusCode = 404;
        throw error;
      }

      // 🔴 GARANTIA CANÔNICA: tokenVersion do refresh token deve corresponder ao banco
      // Se não corresponder, refresh token foi invalidado (logout ou invalidação manual)
      if (decoded.tokenVersion !== userRow.token_version) {
        canonicalLogger.warn(null, 'Refresh token invalidado: tokenVersion não corresponde', {
          tenantId,
          userId: decoded.sub,
          tokenVersionFromToken: decoded.tokenVersion,
          tokenVersionFromDB: userRow.token_version,
          reason: 'Token foi invalidado (logout ou invalidação manual)',
        });
        const error = new Error('Invalid or expired refresh token') as Error & { statusCode?: number };
        error.statusCode = 401;
        throw error;
      }

      const user = this.toAuthUser(userRow);
      
      // 🔴 GARANTIA CANÔNICA: Resolver globalUserId via users.global_user_id
      let globalUserId: string | undefined = decoded.globalUserId;
      if (!globalUserId) {
        try {
          const userWithGlobal = await runQueryWithTenant<{ global_user_id: string | null }>(
            tenantId,
            `
              SELECT global_user_id
              FROM users
              WHERE id = $1
              LIMIT 1
            `,
            [userRow.id]
          );
          
          if (userWithGlobal?.global_user_id) {
            globalUserId = userWithGlobal.global_user_id;
          }
        } catch (err) {
          // Não crítico - continuar sem globalUserId
        }
      }
      
      // 🔴 LOG CANÔNICO: Refresh token válido, gerando novos tokens
      canonicalLogger.info(null, 'Refresh token válido, gerando novos tokens', {
        tenantId,
        userId: userRow.id,
        tokenVersion: userRow.token_version,
      });
      
      // CRÍTICO: Incluir token_version do banco no token gerado
      return this.generateTokens(user, userRow.token_version, globalUserId);
    } catch (err: any) {
      // 🔴 LOG CANÔNICO: Erro ao processar refresh token
      if (err.statusCode !== 401 && err.statusCode !== 404) {
        canonicalLogger.error(null, 'Erro ao processar refresh token', {
          error: err.message,
          stack: err.stack,
        });
      }
      // Preservar mensagem de erro específica se já existir
      if (err.message && (err.message.includes('tokenVersion') || err.message.includes('tenantId') || err.message.includes('token type') || err.message.includes('User not found') || err.message.includes('Invalid tenant'))) {
        throw err;
      }
      const error = new Error('Invalid refresh token') as Error & { statusCode?: number };
      error.statusCode = err.statusCode || 401;
      throw error;
    }
  }

  /**
   * Invalida todas as sessões do usuário incrementando token_version
   * 
   * 🔴 GARANTIA CANÔNICA:
   * - Incrementa token_version no banco
   * - Todos os tokens JWT (access e refresh) com tokenVersion antigo ficam inválidos
   * - Nenhuma sessão zombie possível após logout
   * - Logs canônicos para auditoria
   */
  async logout(tenantId: string, userId: string): Promise<void> {
    // 🔴 LOG CANÔNICO: Início da invalidação
    canonicalLogger.invalidation(null, 'Iniciando invalidação de sessão (logout)', {
      tenantId,
      userId,
    });

    // Buscar token_version atual antes de incrementar (para log)
    const currentRow = await runQueryWithTenant<{ token_version: number }>(
      tenantId,
      `
        SELECT token_version
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    const currentTokenVersion = currentRow?.token_version ?? null;

    // Incrementar token_version (invalida todos os tokens existentes)
    await runQueryWithTenant(
      tenantId,
      `
        UPDATE users
        SET token_version = token_version + 1
        WHERE id = $1
      `,
      [userId]
    );

    // Buscar novo token_version após incremento (para log)
    const newRow = await runQueryWithTenant<{ token_version: number }>(
      tenantId,
      `
        SELECT token_version
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    const newTokenVersion = newRow?.token_version ?? null;

    // 🔴 LOG CANÔNICO: Invalidação concluída
    canonicalLogger.invalidation(null, 'Sessão invalidada com sucesso (logout)', {
      tenantId,
      userId,
      previousTokenVersion: currentTokenVersion,
      newTokenVersion,
    });
  }
}

export const authService = new AuthService();
