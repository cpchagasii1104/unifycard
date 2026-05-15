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
    gender?: 'male' | 'female' | 'other' | 'non_binary' | 'prefer_not_to_say',
    referralCode?: string
  ): Promise<LoginResult & { tenantId: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // 🔴 GARANTIA CANÔNICA: tenantId pode ser fornecido ou criado automaticamente
    // Log explícito para distinguir tenant fornecido vs criado
    let finalTenantId = tenantId;
    let tenantWasCreated = false;
    
    if (!finalTenantId) {
      const emailSlug = normalizedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const tenantSlug = `user-${emailSlug}-${Date.now()}`;
      const newTenantId = randomUUID();
      const { tenantService } = await import('@core/tenants/tenant.service');
      try {
        const created = await tenantService.createTenant({
          id: newTenantId,
          name: `Tenant ${emailSlug}`,
          slug: tenantSlug,
        });
        finalTenantId = created.tenantId;
        tenantWasCreated = true;

        canonicalLogger.info(null, 'Tenant criado automaticamente', {
          tenantId: finalTenantId,
          email: normalizedEmail.substring(0, 3) + '***',
          tenantSlug,
        });
      } catch (err) {
        console.error('Erro ao criar tenant automaticamente:', err);
        throw err instanceof Error ? err : new Error('Falha ao criar tenant automaticamente');
      }
    } else {
      // 🔴 LOG CANÔNICO: tenant fornecido
      canonicalLogger.info(null, 'Tenant fornecido', {
        tenantId: finalTenantId,
        email: normalizedEmail.substring(0, 3) + '***',
      });
    }

    // SPRINT 14: Verificar convite se modo piloto estiver ativo
    // Verificar após ter finalTenantId (criado ou fornecido)
    /**
     * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
     * Motivo: Em modo piloto, registro requer convite válido (exceção ao fluxo normal)
     * Contexto: Sistema em fase de piloto fechado
     * Tipo: estrutural (condicional ao PILOT_MODE)
     */
    if (process.env.PILOT_MODE === 'true') {
      const { pilotInvitesService } = await import('@core/pilot/pilot-invites.service');
      const hasInvite = await pilotInvitesService.hasValidInvite(finalTenantId, normalizedEmail);
      
      if (!hasInvite) {
        // Se não houver convite e tenant foi criado automaticamente, reverter criação
        if (!tenantId) {
          const { pool } = await import('@core/database/pool');
          const client = await pool.connect();
          try {
            await client.query('DELETE FROM tenants WHERE id = $1', [finalTenantId]);
          } catch (err) {
            // Ignorar erro ao reverter
          } finally {
            client.release();
          }
        }
        
        const error = new Error('O sistema está em fase de piloto fechado.') as Error & { statusCode?: number };
        error.statusCode = 403;
        throw error;
      }
    }

    const existing = await runQueryWithTenant<UserRow>(
      finalTenantId,
      `
        SELECT id, tenant_id, email, password_hash, created_at, token_version
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

    const newUserId = randomUUID();

    // 🔴 GARANTIA CANÔNICA: CPF é obrigatório para criar global_users
    if (!cpf) {
      const error = new Error('CPF é obrigatório para cadastro') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    // 🔒 SEGURANÇA: Validar CPF antes de salvar
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
    
    // 🔴 GARANTIA CANÔNICA: Criar/obter global_users ANTES de criar users
    // UPSERT em global_users usando CPF como chave SSOT
    const { pool } = await import('@core/database/pool');
    const globalUserResult = await pool.query<{ global_user_id: string }>(
      `
        INSERT INTO global_users (cpf, full_name, avatar_url, birthdate, metadata)
        VALUES ($1, $2, NULL, $3::DATE, '{}'::jsonb)
        ON CONFLICT (cpf)
        DO UPDATE SET cpf = EXCLUDED.cpf
        RETURNING global_user_id
      `,
      [normalizedCpf, normalizedFullName, normalizedBirthdate]
    );

    if (!globalUserResult.rows[0]) {
      throw new Error('Failed to create or retrieve global user');
    }

    const globalUserId = globalUserResult.rows[0].global_user_id;

    // 🔴 GARANTIA CANÔNICA: Inserir users com global_user_id NO INSERT
    const inserted = await runQueryWithTenant<UserRow>(
      finalTenantId,
      `
        INSERT INTO users (id, tenant_id, global_user_id, email, password_hash, plan)
        VALUES ($1, $2, $3, $4, $5, 'free')
        RETURNING id, tenant_id, email, password_hash, created_at, token_version
      `,
      [newUserId, finalTenantId, globalUserId, normalizedEmail, passwordHash]
    );

    if (!inserted) {
      throw new Error('Failed to create user');
    }

    const user = this.toAuthUser(inserted);
    
    // Salvar CPF na tabela profiles
    try {
      await pool.query(
        `
        INSERT INTO profiles (tenant_id, user_id, cpf)
        VALUES ($1, $2, $3)
        `,
        [finalTenantId, user.userId, normalizedCpf]
      );
    } catch (dbError: any) {
      // 🔒 SEGURANÇA: Capturar erro de unicidade (CPF duplicado)
      if (dbError.code === '23505') {
        // Constraint UNIQUE violada (CPF já existe)
        const error = new Error('CPF já está em uso por outra conta') as Error & { statusCode?: number };
        error.statusCode = 409;
        throw error;
      }
      // Re-lançar outros erros
      throw dbError;
    }

    // 🔴 GARANTIA CANÔNICA: users.global_user_id é a fonte única de verdade
    // user_identity_links NÃO é mais usado - removido conforme schema canônico
    
    // 🔴 PARTE 1 - CORREÇÃO BUG: Salvar nome, data de nascimento e sexo no cadastro
    // IMPORTANTE: Fazer isso DEPOIS de criar a identidade global para garantir que globalUserId existe
    if (fullName || birthdate || gender || normalizedCpf) {
      try {
        const { profileService } = await import('@core/profile/profile.service');

        // Preparar dados do perfil
        const profileMetadata: Record<string, any> = {};
        if (gender) {
          profileMetadata.gender = gender;
        }
        // Bug CPF fix (2026-05-14): propagar CPF para user_profiles via profileService.
        // GET /core/profile monta personal_profile.cpf de user_profiles.cpf (core.service.ts:289-304),
        // mas REGISTER só gravava profiles.cpf — Profile inicial via vazio e usuário tinha que
        // reinserir CPF. profileService.upsertProfile lê metadata.cpf, valida via validateCpfOrThrow
        // e faz UPSERT em user_profiles (linha 456) sem persistir cpf dentro de profiles.metadata.
        if (normalizedCpf) {
          profileMetadata.cpf = normalizedCpf;
        }

        // Salvar nome e sexo no perfil
        // 🔴 PADRONIZAÇÃO: Usar nome já normalizado
        await profileService.upsertProfile(finalTenantId, user.userId, {
          fullName: normalizedFullName || undefined,
          metadata: Object.keys(profileMetadata).length > 0 ? profileMetadata : undefined,
        });
      } catch (profileError) {
        // Log mas não falha o registro
        console.warn('Erro ao salvar dados do perfil no cadastro (não crítico):', profileError);
      }
    }
    
    // Aplicar código de indicação se fornecido (APENAS durante cadastro)
    if (referralCode) {
      try {
        const { referralService } = await import('@core/referral/referral.service');
        await referralService.applyReferralCode(finalTenantId, user.userId, referralCode);
      } catch (err) {
        // 🔧 FIX: Não engolir erro quando código de indicação é inválido
        console.warn('Erro ao aplicar código de indicação:', err);
        
        // Se o erro for "Código de indicação inválido", transformar em erro HTTP 400
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage === 'Código de indicação inválido') {
          const error = new Error('Código de indicação inválido') as Error & { statusCode?: number; code?: string };
          error.statusCode = 400;
          error.code = 'INVALID_REFERRAL_CODE';
          throw error;
        }
        
        // Para outros erros, re-lançar para não engolir
        throw err;
      }
    }

    // SPRINT 14: Marcar convite como aceito se modo piloto estiver ativo
    /**
     * EXCEÇÃO INSTITUCIONAL (SPRINT 30)
     * Motivo: Em modo piloto, registro requer convite válido (exceção ao fluxo normal)
     * Contexto: Sistema em fase de piloto fechado
     * Tipo: estrutural (condicional ao PILOT_MODE)
     */
    if (process.env.PILOT_MODE === 'true') {
      try {
        const { pilotInvitesService } = await import('@core/pilot/pilot-invites.service');
        await pilotInvitesService.acceptInvite(finalTenantId, normalizedEmail);
      } catch (err) {
        // Erro silencioso - não quebrar registro
        console.warn('[AuthService] Erro ao marcar convite como aceito:', err);
      }
    }

    // Gerar código de indicação automaticamente
    // 🔴 CRÍTICO: Código de indicação é chave financeira, DEVE ser gerado
    try {
      const { referralService } = await import('@core/referral/referral.service');
      const generatedCode = await referralService.getOrCreateReferralCode(finalTenantId, user.userId);
      console.log('[AuthService] ✅ Código de indicação gerado:', {
        userId: user.userId,
        referralCode: generatedCode,
      });
    } catch (err) {
      // 🔴 Log como ERROR, não WARN - código é importante
      console.error('[AuthService] ❌ ERRO ao gerar código de indicação:', {
        userId: user.userId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Não falha o registro, mas o código ficará vazio
      // Será gerado na primeira vez que o usuário acessar o perfil
    }

    // 🔴 GARANTIA CANÔNICA: token_version OBRIGATÓRIO - fail fast se ausente
    if (typeof inserted.token_version !== 'number') {
      console.error('[AuthService] ❌ Schema inválido: token_version ausente após criação de usuário', {
        userId: user.userId,
        tenantId: finalTenantId,
        insertedKeys: Object.keys(inserted),
      });
      throw new Error('Schema inválido: token_version ausente após criação de usuário');
    }

    // 🔴 GARANTIA CANÔNICA: tenantId OBRIGATÓRIO no user - fail fast se ausente
    if (!user.tenantId || typeof user.tenantId !== 'string') {
      console.error('[AuthService] ❌ tenantId ausente no user após criação', {
        userId: user.userId,
        tenantId: finalTenantId,
        userKeys: Object.keys(user),
      });
      throw new Error('tenantId ausente no user após criação');
    }

    // 🔴 GARANTIA CANÔNICA: tenantId do user deve corresponder ao finalTenantId
    if (user.tenantId !== finalTenantId) {
      console.error('[AuthService] ❌ tenantId do user não corresponde ao finalTenantId', {
        userId: user.userId,
        userTenantId: user.tenantId,
        finalTenantId,
      });
      throw new Error('tenantId do user não corresponde ao finalTenantId');
    }

    // CRÍTICO: Incluir token_version do banco no token gerado
    const tokens = this.generateTokens(user, inserted.token_version, globalUserId);

    // 🔴 LOG CANÔNICO: Registro completo com todas as garantias validadas
    console.log('[AuthService] ✅ Registro concluído com sucesso:', {
      userId: user.userId,
      tenantId: finalTenantId,
      tenantWasCreated,
      tenantWasProvided: !tenantWasCreated,
      tokenVersion: inserted.token_version,
    });

    // 🔴 GARANTIA CANÔNICA: Criar actor operacional para o usuário registrado
    // Idempotente — seguro chamar mesmo em retry. NÃO chamar dentro de transação.
    // §4.8 LEI_COERENCIA_SISTEMICA_UNIFICARD
    try {
      const { ensureUserActor } = await import('@modules/identity/actor-writer.service');
      await ensureUserActor(finalTenantId, user.userId);
    } catch (actorError) {
      // Log mas não falha o registro — actor será criado no próximo uso
      console.warn('[register] ensureUserActor falhou — será retentado no próximo acesso:', actorError);
    }

    // 🔴 PARTE 2 - ONBOARDING: Usuário recém-criado sempre precisa de onboarding
    const requiresOnboarding = true;

    // 🔴 GARANTIA CANÔNICA: tenantId SEMPRE retornado
    return { 
      user, 
      tokens, 
      tenantId: finalTenantId, // Sempre presente - validado acima
      requiresOnboarding 
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
