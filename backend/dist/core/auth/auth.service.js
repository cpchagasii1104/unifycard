"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
// src/core/auth/auth.service.ts
const dotenv_1 = __importDefault(require("dotenv"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = require("crypto");
const pool_1 = require("@core/database/pool");
const canonical_logger_1 = require("@core/logging/canonical-logger");
const cpf_validator_1 = require("@utils/cpf.validator");
const nameNormalizer_1 = require("@utils/nameNormalizer");
dotenv_1.default.config();
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
// Type assertion após validação
const jwtSecret = JWT_SECRET;
class AuthService {
    toAuthUser(row) {
        return {
            userId: row.id,
            tenantId: row.tenant_id,
            email: row.email,
            createdAt: row.createdAt,
        };
    }
    generateTokens(user, tokenVersion, globalUserId) {
        const basePayload = {
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
        const accessToken = jsonwebtoken_1.default.sign({ ...basePayload, type: 'access' }, jwtSecret, { expiresIn: JWT_EXPIRES_IN });
        const refreshToken = jsonwebtoken_1.default.sign({ ...basePayload, type: 'refresh' }, jwtSecret, { expiresIn: JWT_REFRESH_EXPIRES_IN });
        return { accessToken, refreshToken };
    }
    async verifyAccessToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
            // 🔴 GARANTIA CANÔNICA 1: Tipo de token deve ser 'access'
            if (decoded.type !== 'access') {
                const error = new Error('Invalid token type');
                error.statusCode = 401;
                throw error;
            }
            // 🔴 GARANTIA CANÔNICA 2: tenantId OBRIGATÓRIO no JWT - fail fast
            // Nenhuma query pode ser executada sem tenantId válido
            if (!decoded.tenantId || typeof decoded.tenantId !== 'string') {
                const error = new Error('Invalid token: tenantId missing');
                error.statusCode = 401;
                throw error;
            }
            // 🔴 GARANTIA CANÔNICA 3: tokenVersion OBRIGATÓRIO no JWT - fail fast
            // Nenhuma validação pode ser executada sem tokenVersion
            if (typeof decoded.tokenVersion !== 'number') {
                const error = new Error('Invalid token: tokenVersion missing');
                error.statusCode = 401;
                throw error;
            }
            // 🔴 GARANTIA CANÔNICA 4: Validar tokenVersion contra banco
            // Esta é a única validação que requer query ao banco
            const userRow = await (0, pool_1.runQueryWithTenant)(decoded.tenantId, `
          SELECT id, tenant_id, email, password_hash, createdAt, token_version
          FROM users
          WHERE id = $1
          LIMIT 1
        `, [decoded.sub]);
            if (!userRow) {
                const error = new Error('User not found');
                error.statusCode = 401;
                throw error;
            }
            // 🔴 GARANTIA CANÔNICA 5: tokenVersion deve corresponder ao banco
            // Se não corresponder, token foi invalidado (logout ou invalidação manual)
            if (decoded.tokenVersion !== userRow.token_version) {
                // 🔴 LOG CANÔNICO: Token invalidation detectada (tokenVersion não corresponde)
                canonical_logger_1.canonicalLogger.invalidation(null, 'Token invalidation: tokenVersion não corresponde', {
                    tenantId: decoded.tenantId,
                    userId: decoded.sub,
                    tokenVersionFromToken: decoded.tokenVersion,
                    tokenVersionFromDB: userRow.token_version,
                    reason: 'Token foi invalidado (logout ou invalidação manual)',
                });
                const error = new Error('Invalid or expired access token');
                error.statusCode = 401;
                throw error;
            }
            return decoded;
        }
        catch (err) {
            // Se o erro já tem statusCode, preservar (não mascarar erros específicos)
            if (err.statusCode) {
                throw err;
            }
            // Erro genérico apenas se não for erro de validação específico
            const error = new Error('Invalid or expired access token');
            error.statusCode = 401;
            throw error;
        }
    }
    /**
     * Verifica JWT genérico sem verificar tipo (para tokens especiais como validação, QR codes, etc.)
     * Centraliza uso de jwt.verify() para evitar duplicação
     */
    verifyJWT(token) {
        try {
            return jsonwebtoken_1.default.verify(token, jwtSecret);
        }
        catch (err) {
            const error = new Error('Invalid or expired token');
            error.statusCode = 401;
            throw error;
        }
    }
    /**
     * Extrai token do header Authorization (Bearer <token>)
     * Centraliza lógica de extração para evitar duplicação
     */
    extractTokenFromHeader(authHeader) {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }
        return authHeader.substring(7).trim();
    }
    async register(tenantId, email, password, cpf, fullName, birthdate, gender, referralCode) {
        const normalizedEmail = email.trim().toLowerCase();
        // 🔴 GARANTIA CANÔNICA: tenantId pode ser fornecido ou criado automaticamente
        // Log explícito para distinguir tenant fornecido vs criado
        let finalTenantId = tenantId;
        let tenantWasCreated = false;
        if (!finalTenantId) {
            const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
            // Gerar slug baseado no email (primeira parte antes do @)
            const emailSlug = normalizedEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
            const tenantSlug = `user-${emailSlug}-${Date.now()}`;
            const newTenantId = (0, crypto_1.randomUUID)();
            const client = await pool.connect();
            try {
                await client.query(`
          INSERT INTO tenants (id, name, slug, createdAt, updatedAt)
          VALUES ($1, $2, $3, now(), now())
          `, [newTenantId, `Tenant ${emailSlug}`, tenantSlug]);
                finalTenantId = newTenantId;
                tenantWasCreated = true;
                // 🔴 LOG CANÔNICO: tenant criado automaticamente
                canonical_logger_1.canonicalLogger.info(null, 'Tenant criado automaticamente', {
                    tenantId: finalTenantId,
                    email: normalizedEmail.substring(0, 3) + '***',
                    tenantSlug,
                });
            }
            catch (err) {
                console.error('Erro ao criar tenant automaticamente:', err);
                throw err instanceof Error ? err : new Error('Falha ao criar tenant automaticamente');
            }
            finally {
                client.release();
            }
        }
        else {
            // 🔴 LOG CANÔNICO: tenant fornecido
            canonical_logger_1.canonicalLogger.info(null, 'Tenant fornecido', {
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
            const { pilotInvitesService } = await Promise.resolve().then(() => __importStar(require('@core/pilot/pilot-invites.service')));
            const hasInvite = await pilotInvitesService.hasValidInvite(finalTenantId, normalizedEmail);
            if (!hasInvite) {
                // Se não houver convite e tenant foi criado automaticamente, reverter criação
                if (!tenantId) {
                    const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
                    const client = await pool.connect();
                    try {
                        await client.query('DELETE FROM tenants WHERE id = $1', [finalTenantId]);
                    }
                    catch (err) {
                        // Ignorar erro ao reverter
                    }
                    finally {
                        client.release();
                    }
                }
                const error = new Error('O sistema está em fase de piloto fechado.');
                error.statusCode = 403;
                throw error;
            }
        }
        const existing = await (0, pool_1.runQueryWithTenant)(finalTenantId, `
        SELECT id, tenant_id, email, password_hash, createdAt, token_version
        FROM users
        WHERE email = $1
        LIMIT 1
      `, [normalizedEmail]);
        if (existing) {
            const error = new Error('Email already registered');
            error.statusCode = 409;
            throw error;
        }
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const newUserId = (0, crypto_1.randomUUID)();
        // 🔴 GARANTIA CANÔNICA: CPF é obrigatório para criar global_users
        if (!cpf) {
            const error = new Error('CPF é obrigatório para cadastro');
            error.statusCode = 400;
            throw error;
        }
        // 🔒 SEGURANÇA: Validar CPF antes de salvar
        try {
            (0, cpf_validator_1.validateCpfOrThrow)(cpf);
        }
        catch (validationError) {
            const error = new Error(validationError instanceof Error ? validationError.message : 'CPF inválido');
            error.statusCode = 400;
            throw error;
        }
        const normalizedCpf = (0, cpf_validator_1.normalizeCpf)(cpf);
        const normalizedFullName = fullName ? (0, nameNormalizer_1.normalizeFullName)(fullName) : null;
        // 🔴 GARANTIA CANÔNICA: Criar/obter global_users ANTES de criar users
        // UPSERT em global_users usando CPF como chave SSOT
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const globalUserResult = await pool.query(`
        INSERT INTO global_users (cpf, full_name, avatar_url, birthdate, metadata)
        VALUES ($1, $2, NULL, $3, '{}'::jsonb)
        ON CONFLICT (cpf)
        DO UPDATE SET cpf = EXCLUDED.cpf
        RETURNING global_user_id
      `, [normalizedCpf, normalizedFullName, birthdate ? new Date(birthdate) : null]);
        if (!globalUserResult.rows[0]) {
            throw new Error('Failed to create or retrieve global user');
        }
        const globalUserId = globalUserResult.rows[0].global_user_id;
        // 🔴 GARANTIA CANÔNICA: Inserir users com global_user_id NO INSERT
        const inserted = await (0, pool_1.runQueryWithTenant)(finalTenantId, `
        INSERT INTO users (id, tenant_id, global_user_id, email, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, tenant_id, email, password_hash, createdAt, token_version
      `, [newUserId, finalTenantId, globalUserId, normalizedEmail, passwordHash]);
        if (!inserted) {
            throw new Error('Failed to create user');
        }
        const user = this.toAuthUser(inserted);
        // Salvar CPF na tabela profiles
        try {
            await pool.query(`
        INSERT INTO profiles (tenant_id, user_id, cpf)
        VALUES ($1, $2, $3)
        `, [finalTenantId, user.userId, normalizedCpf]);
        }
        catch (dbError) {
            // 🔒 SEGURANÇA: Capturar erro de unicidade (CPF duplicado)
            if (dbError.code === '23505') {
                // Constraint UNIQUE violada (CPF já existe)
                const error = new Error('CPF já está em uso por outra conta');
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
        if (fullName || birthdate || gender) {
            try {
                const { profileService } = await Promise.resolve().then(() => __importStar(require('@core/profile/profile.service')));
                // Preparar dados do perfil
                const profileMetadata = {};
                if (gender) {
                    profileMetadata.gender = gender;
                }
                // Salvar nome e sexo no perfil
                // 🔴 PADRONIZAÇÃO: Usar nome já normalizado
                await profileService.upsertProfile(finalTenantId, user.userId, {
                    fullName: normalizedFullName || undefined,
                    metadata: Object.keys(profileMetadata).length > 0 ? profileMetadata : undefined,
                });
            }
            catch (profileError) {
                // Log mas não falha o registro
                console.warn('Erro ao salvar dados do perfil no cadastro (não crítico):', profileError);
            }
        }
        // Aplicar código de indicação se fornecido (APENAS durante cadastro)
        if (referralCode) {
            try {
                const { referralService } = await Promise.resolve().then(() => __importStar(require('@core/referral/referral.service')));
                await referralService.applyReferralCode(finalTenantId, user.userId, referralCode);
            }
            catch (err) {
                // 🔧 FIX: Não engolir erro quando código de indicação é inválido
                console.warn('Erro ao aplicar código de indicação:', err);
                // Se o erro for "Código de indicação inválido", transformar em erro HTTP 400
                const errorMessage = err instanceof Error ? err.message : String(err);
                if (errorMessage === 'Código de indicação inválido') {
                    const error = new Error('Código de indicação inválido');
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
                const { pilotInvitesService } = await Promise.resolve().then(() => __importStar(require('@core/pilot/pilot-invites.service')));
                await pilotInvitesService.acceptInvite(finalTenantId, normalizedEmail);
            }
            catch (err) {
                // Erro silencioso - não quebrar registro
                console.warn('[AuthService] Erro ao marcar convite como aceito:', err);
            }
        }
        // Gerar código de indicação automaticamente
        // 🔴 CRÍTICO: Código de indicação é chave financeira, DEVE ser gerado
        try {
            const { referralService } = await Promise.resolve().then(() => __importStar(require('@core/referral/referral.service')));
            const generatedCode = await referralService.getOrCreateReferralCode(finalTenantId, user.userId);
            console.log('[AuthService] ✅ Código de indicação gerado:', {
                userId: user.userId,
                referralCode: generatedCode,
            });
        }
        catch (err) {
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
    async login(tenantId, email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        // Para autenticação, usar query direta que contorna RLS
        // RLS pode bloquear queries mesmo com set_config em alguns casos
        const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
        const client = await pool.connect();
        try {
            // Buscar usuário apenas por email (tenant_id será obtido do usuário encontrado)
            const result = await client.query(`
          SELECT id, tenant_id, email, password_hash, createdAt, token_version
          FROM users
          WHERE email = $1
          LIMIT 1
        `, [normalizedEmail]);
            const userRow = result.rows[0];
            if (!userRow) {
                // 🔴 LOG CANÔNICO: Login failure - user não encontrado
                canonical_logger_1.canonicalLogger.warn(null, 'Login failure: User não encontrado', {
                    email: normalizedEmail.substring(0, 3) + '***',
                    tenantId: tenantId || undefined,
                });
                const error = new Error('Invalid credentials');
                error.statusCode = 401;
                throw error;
            }
            // Usar o tenant_id do usuário encontrado
            const userTenantId = userRow.tenant_id;
            const passwordMatch = await bcrypt_1.default.compare(password, userRow.password_hash);
            if (!passwordMatch) {
                // 🔴 LOG CANÔNICO: Login failure - senha incorreta
                canonical_logger_1.canonicalLogger.warn(null, 'Login failure: Senha incorreta', {
                    tenantId: userRow.tenant_id,
                    userId: userRow.id,
                    email: normalizedEmail.substring(0, 3) + '***',
                });
                const error = new Error('Invalid credentials');
                error.statusCode = 401;
                throw error;
            }
            const user = this.toAuthUser(userRow);
            // 🔴 GARANTIA CANÔNICA: Resolver globalUserId via users.global_user_id
            // Usar o tenant_id do usuário encontrado, não o passado como parâmetro
            let globalUserId = undefined;
            try {
                const userWithGlobal = await (0, pool_1.runQueryWithTenant)(userTenantId, `
            SELECT global_user_id
            FROM users
            WHERE id = $1
            LIMIT 1
          `, [userRow.id]);
                if (userWithGlobal?.global_user_id) {
                    globalUserId = userWithGlobal.global_user_id;
                }
            }
            catch (err) {
                // Não crítico - continuar sem globalUserId
                console.warn('[AuthService] Não foi possível resolver globalUserId:', err);
            }
            // CRÍTICO: Incluir token_version do banco no token gerado
            const tokens = this.generateTokens(user, userRow.token_version, globalUserId);
            // 🔴 LOG CANÔNICO: Login success
            canonical_logger_1.canonicalLogger.info(null, 'Login success', {
                tenantId: userRow.tenant_id,
                userId: userRow.id,
                email: normalizedEmail.substring(0, 3) + '***',
                tokenVersion: userRow.token_version,
            });
            // 🔴 PARTE 2 - ONBOARDING: Verificar status de onboarding
            let requiresOnboarding = false;
            try {
                const { profileService } = await Promise.resolve().then(() => __importStar(require('@core/profile/profile.service')));
                const isCompleted = await profileService.isOnboardingCompleted(userRow.tenant_id, user.userId);
                requiresOnboarding = !isCompleted;
            }
            catch (err) {
                // Se não conseguir verificar, assumir que precisa de onboarding
                requiresOnboarding = true;
            }
            return {
                user,
                tokens,
                tenantId: userRow.tenant_id,
                requiresOnboarding
            };
        }
        finally {
            client.release();
        }
    }
    async refreshToken(tenantId, refreshToken) {
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, jwtSecret);
            if (decoded.type !== 'refresh') {
                const error = new Error('Invalid token type');
                error.statusCode = 401;
                throw error;
            }
            // 🔴 GARANTIA CANÔNICA: tenantId OBRIGATÓRIO no refresh token - fail fast
            if (!decoded.tenantId || typeof decoded.tenantId !== 'string') {
                const error = new Error('Invalid refresh token: tenantId missing');
                error.statusCode = 401;
                throw error;
            }
            if (decoded.tenantId !== tenantId) {
                const error = new Error('Invalid tenant for token');
                error.statusCode = 401;
                throw error;
            }
            // 🔴 GARANTIA CANÔNICA: tokenVersion OBRIGATÓRIO no refresh token - fail fast
            if (typeof decoded.tokenVersion !== 'number') {
                canonical_logger_1.canonicalLogger.warn(null, 'Refresh token inválido: tokenVersion ausente', {
                    tenantId,
                    userId: decoded.sub,
                });
                const error = new Error('Invalid refresh token: tokenVersion missing');
                error.statusCode = 401;
                throw error;
            }
            const userRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT id, tenant_id, email, password_hash, createdAt, token_version
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [decoded.sub]);
            if (!userRow) {
                canonical_logger_1.canonicalLogger.warn(null, 'Refresh token inválido: User não encontrado', {
                    tenantId,
                    userId: decoded.sub,
                });
                const error = new Error('User not found');
                error.statusCode = 404;
                throw error;
            }
            // 🔴 GARANTIA CANÔNICA: tokenVersion do refresh token deve corresponder ao banco
            // Se não corresponder, refresh token foi invalidado (logout ou invalidação manual)
            if (decoded.tokenVersion !== userRow.token_version) {
                canonical_logger_1.canonicalLogger.warn(null, 'Refresh token invalidado: tokenVersion não corresponde', {
                    tenantId,
                    userId: decoded.sub,
                    tokenVersionFromToken: decoded.tokenVersion,
                    tokenVersionFromDB: userRow.token_version,
                    reason: 'Token foi invalidado (logout ou invalidação manual)',
                });
                const error = new Error('Invalid or expired refresh token');
                error.statusCode = 401;
                throw error;
            }
            const user = this.toAuthUser(userRow);
            // 🔴 GARANTIA CANÔNICA: Resolver globalUserId via users.global_user_id
            let globalUserId = decoded.globalUserId;
            if (!globalUserId) {
                try {
                    const userWithGlobal = await (0, pool_1.runQueryWithTenant)(tenantId, `
              SELECT global_user_id
              FROM users
              WHERE id = $1
              LIMIT 1
            `, [userRow.id]);
                    if (userWithGlobal?.global_user_id) {
                        globalUserId = userWithGlobal.global_user_id;
                    }
                }
                catch (err) {
                    // Não crítico - continuar sem globalUserId
                }
            }
            // 🔴 LOG CANÔNICO: Refresh token válido, gerando novos tokens
            canonical_logger_1.canonicalLogger.info(null, 'Refresh token válido, gerando novos tokens', {
                tenantId,
                userId: userRow.id,
                tokenVersion: userRow.token_version,
            });
            // CRÍTICO: Incluir token_version do banco no token gerado
            return this.generateTokens(user, userRow.token_version, globalUserId);
        }
        catch (err) {
            // 🔴 LOG CANÔNICO: Erro ao processar refresh token
            if (err.statusCode !== 401 && err.statusCode !== 404) {
                canonical_logger_1.canonicalLogger.error(null, 'Erro ao processar refresh token', {
                    error: err.message,
                    stack: err.stack,
                });
            }
            // Preservar mensagem de erro específica se já existir
            if (err.message && (err.message.includes('tokenVersion') || err.message.includes('tenantId') || err.message.includes('token type') || err.message.includes('User not found') || err.message.includes('Invalid tenant'))) {
                throw err;
            }
            const error = new Error('Invalid refresh token');
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
    async logout(tenantId, userId) {
        // 🔴 LOG CANÔNICO: Início da invalidação
        canonical_logger_1.canonicalLogger.invalidation(null, 'Iniciando invalidação de sessão (logout)', {
            tenantId,
            userId,
        });
        // Buscar token_version atual antes de incrementar (para log)
        const currentRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT token_version
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [userId]);
        const currentTokenVersion = currentRow?.token_version ?? null;
        // Incrementar token_version (invalida todos os tokens existentes)
        await (0, pool_1.runQueryWithTenant)(tenantId, `
        UPDATE users
        SET token_version = token_version + 1
        WHERE id = $1
      `, [userId]);
        // Buscar novo token_version após incremento (para log)
        const newRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT token_version
        FROM users
        WHERE id = $1
        LIMIT 1
      `, [userId]);
        const newTokenVersion = newRow?.token_version ?? null;
        // 🔴 LOG CANÔNICO: Invalidação concluída
        canonical_logger_1.canonicalLogger.invalidation(null, 'Sessão invalidada com sucesso (logout)', {
            tenantId,
            userId,
            previousTokenVersion: currentTokenVersion,
            newTokenVersion,
        });
    }
}
exports.authService = new AuthService();
