"use strict";
// src/core/profile/profile.service.ts
// Serviço de perfil de usuário - READ-ONLY para visualização, permite atualização básica
//
// ✅ Corrigido para não quebrar caso a coluna `profile_personal_confirmed` ainda não exista no banco.
// Estratégia: detectar coluna em runtime e usar fallback em metadata (metadata.profile_personal_confirmed).
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileService = void 0;
const pool_1 = require("@core/database/pool");
const errors_1 = require("@core/errors");
const cpf_validator_1 = require("@utils/cpf.validator");
const nameNormalizer_1 = require("@utils/nameNormalizer");
/**
 * Faz merge profundo de objetos, preservando propriedades aninhadas.
 * 🔴 Campos `undefined` são ignorados (não sobrescrevem valores existentes).
 */
function deepMerge(target, source) {
    if (!source || typeof source !== 'object')
        return target;
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = result[key];
        // Ignorar undefined (PATCH real)
        if (sourceValue === undefined)
            continue;
        // Merge recursivo para objetos (não arrays)
        if (sourceValue &&
            typeof sourceValue === 'object' &&
            !Array.isArray(sourceValue) &&
            targetValue &&
            typeof targetValue === 'object' &&
            !Array.isArray(targetValue)) {
            result[key] = deepMerge(targetValue, sourceValue);
        }
        else {
            // Primitivos, arrays e null sobrescrevem
            result[key] = sourceValue;
        }
    }
    return result;
}
class ProfileService {
    /**
     * Cache por processo: se a coluna existe no schema atual.
     * (Se rodar migration, reinicie o serviço para recarregar.)
     */
    hasProfilePersonalConfirmedColumnCache = null;
    async hasProfilePersonalConfirmedColumn(tenantId) {
        if (this.hasProfilePersonalConfirmedColumnCache !== null) {
            return this.hasProfilePersonalConfirmedColumnCache;
        }
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'profile_personal_confirmed'
      ) AS exists
      `);
        this.hasProfilePersonalConfirmedColumnCache = row?.exists === true;
        return this.hasProfilePersonalConfirmedColumnCache;
    }
    getConfirmedFromRow(row) {
        // 1) Se a coluna existir no row (schema novo), ela manda.
        if (typeof row.profile_personal_confirmed === 'boolean')
            return row.profile_personal_confirmed === true;
        // 2) Fallback (schema antigo): metadata.profile_personal_confirmed
        const md = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        return md.profile_personal_confirmed === true;
    }
    toProfile(row) {
        const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
        const profilePersonalConfirmed = this.getConfirmedFromRow(row);
        const canEditPersonalData = !profilePersonalConfirmed;
        return {
            profileId: row.profile_id,
            tenantId: row.tenant_id,
            userId: row.user_id,
            fullName: row.full_name ?? null,
            phone: row.phone ?? null,
            metadata,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            profile_personal_confirmed: profilePersonalConfirmed,
            can_edit_personal_data: canEditPersonalData,
        };
    }
    /**
     * Busca perfil de um usuário
     */
    async getProfile(tenantId, userId) {
        const hasColumn = await this.hasProfilePersonalConfirmedColumn(tenantId);
        const selectConfirmed = hasColumn
            ? `profile_personal_confirmed`
            : `NULL::boolean AS profile_personal_confirmed`;
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT
          profile_id, tenant_id, user_id, full_name, phone, metadata,
          ${selectConfirmed},
          created_at, updated_at
        FROM profiles
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
      `, [tenantId, userId]);
        if (!row)
            return null;
        return this.toProfile(row);
    }
    /**
     * Cria perfil se não existir (READ-ONLY para GET)
     * NUNCA sobrescreve dados existentes
     */
    async createProfileIfNotExists(tenantId, userId) {
        const hasColumn = await this.hasProfilePersonalConfirmedColumn(tenantId);
        const initialMetadata = {};
        // Fallback: se não existe coluna, persistimos a flag em metadata para manter o comportamento.
        if (!hasColumn) {
            initialMetadata.profile_personal_confirmed = false;
        }
        const insertCols = hasColumn
            ? `(tenant_id, user_id, full_name, phone, metadata, profile_personal_confirmed)`
            : `(tenant_id, user_id, full_name, phone, metadata)`;
        const insertValues = hasColumn
            ? `VALUES ($1, $2, NULL, NULL, $3::JSONB, false)`
            : `VALUES ($1, $2, NULL, NULL, $3::JSONB)`;
        const returningConfirmed = hasColumn
            ? `profile_personal_confirmed`
            : `NULL::boolean AS profile_personal_confirmed`;
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO profiles ${insertCols}
        ${insertValues}
        ON CONFLICT (tenant_id, user_id) DO NOTHING
        RETURNING
          profile_id, tenant_id, user_id, full_name, phone, metadata,
          ${returningConfirmed},
          created_at, updated_at
      `, [tenantId, userId, JSON.stringify(initialMetadata)]);
        if (!row) {
            const existing = await this.getProfile(tenantId, userId);
            if (existing)
                return existing;
            throw new Error('Failed to create profile and profile not found');
        }
        return this.toProfile(row);
    }
    /**
     * Cria ou atualiza perfil de um usuário (PATCH parcial).
     * ⚠️ Só deve ser chamado por endpoints explícitos de UPDATE.
     */
    async upsertProfile(tenantId, userId, input) {
        const hasColumn = await this.hasProfilePersonalConfirmedColumn(tenantId);
        // Buscar existente (para merge + regras de imutabilidade)
        const existingProfile = await this.getProfile(tenantId, userId);
        const existingMetadata = existingProfile?.metadata || {};
        // 🔧 FIX (first personal save locks identity fields): Verificar se dados pessoais estão bloqueados
        // Fonte única de verdade: metadata.personal_data_locked
        const personalDataLocked = existingMetadata?.personal_data_locked === true;
        // 🔧 FIX (first personal save locks identity fields): fullName (só se veio no payload)
        let fullNameToUpdate = undefined;
        if (input.fullName !== undefined) {
            if (personalDataLocked) {
                // Se dados estão bloqueados, ignorar tentativa de alterar
                fullNameToUpdate = undefined;
            }
            else {
                fullNameToUpdate = (0, nameNormalizer_1.normalizeFullName)(input.fullName);
            }
        }
        // phone (só se veio)
        let phoneToUpdate = undefined;
        if (input.phone !== undefined) {
            phoneToUpdate = input.phone || null;
        }
        // Extrair CPF do payload de metadata (CPF NÃO mora em metadata)
        let cpfToSave = null;
        if (input.metadata && typeof input.metadata === 'object') {
            const cpfValue = input.metadata.cpf || input.metadata.personal_profile?.cpf;
            if (typeof cpfValue === 'string' && cpfValue.trim().length > 0) {
                try {
                    (0, cpf_validator_1.validateCpfOrThrow)(cpfValue);
                    const cpfClean = (0, cpf_validator_1.normalizeCpf)(cpfValue);
                    if (cpfClean.length === 11)
                        cpfToSave = cpfClean;
                }
                catch (e) {
                    console.warn('[ProfileService] CPF inválido recebido (ignorado):', {
                        userId,
                        cpfSanitized: (0, cpf_validator_1.sanitizeCpfForLog)(cpfValue),
                        error: e instanceof Error ? e.message : 'CPF inválido',
                    });
                }
            }
        }
        // Sanitizar metadata: remover imutáveis e dados sensíveis
        let metadataWithoutImmutables = undefined;
        if (input.metadata !== undefined && input.metadata !== null && typeof input.metadata === 'object') {
            metadataWithoutImmutables = { ...input.metadata };
            // Nunca permitir CPF em metadata
            delete metadataWithoutImmutables.cpf;
            if (metadataWithoutImmutables.personal_profile) {
                delete metadataWithoutImmutables.personal_profile.cpf;
                delete metadataWithoutImmutables.personal_profile.birthdate;
            }
            delete metadataWithoutImmutables.birthdate;
            // 🔧 FIX (first personal save locks identity fields): Se dados estão bloqueados, não permite alterar gender
            const existingGender = existingMetadata?.gender;
            if (personalDataLocked && (existingGender === 'male' || existingGender === 'female')) {
                metadataWithoutImmutables.gender = existingGender;
            }
            // Compat: se não existe coluna, manter o flag em metadata
            if (!hasColumn && existingProfile) {
                metadataWithoutImmutables.profile_personal_confirmed =
                    existingProfile.profile_personal_confirmed === true;
            }
        }
        // Merge profundo (PATCH real)
        let mergedMetadata;
        try {
            mergedMetadata = metadataWithoutImmutables
                ? deepMerge(existingMetadata, metadataWithoutImmutables)
                : existingMetadata;
        }
        catch {
            mergedMetadata = existingMetadata;
        }
        if (!mergedMetadata || typeof mergedMetadata !== 'object')
            mergedMetadata = {};
        // 🔧 FIX (first personal save locks identity fields): Se salvou dados pessoais e ainda não está bloqueado, bloquear
        // Verificar se houve tentativa de salvar fullName ou gender (indicando primeiro salvamento)
        const attemptedToSavePersonalData = (input.fullName !== undefined && fullNameToUpdate !== undefined) ||
            (input.metadata?.gender !== undefined && !personalDataLocked);
        if (attemptedToSavePersonalData && !personalDataLocked) {
            mergedMetadata.personal_data_locked = true;
            mergedMetadata.personal_data_locked_at = new Date().toISOString();
        }
        // 🔧 FIX (onboarding only after first successful save): Setar onboarding_completed automaticamente após primeiro salvamento bem-sucedido
        // Só seta se:
        // 1. Payload não está vazio (houve tentativa real de salvar)
        // 2. Dados obrigatórios existem (fullName, birthdate, gender)
        // 3. Ainda não foi setado antes
        const hasPayload = input.fullName !== undefined || input.phone !== undefined ||
            (input.metadata !== undefined && input.metadata !== null && typeof input.metadata === 'object' && Object.keys(input.metadata).length > 0);
        const onboardingAlreadyCompleted = existingMetadata?.onboarding_completed === true;
        if (hasPayload && !onboardingAlreadyCompleted) {
            // Verificar se dados obrigatórios existem
            const { identityService } = await Promise.resolve().then(() => __importStar(require('@core/identity/identity.service')));
            let hasFullName = false;
            let hasBirthdate = false;
            try {
                const userLink = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT global_user_id FROM users WHERE user_id = $1 LIMIT 1`, [userId]);
                if (userLink?.global_user_id) {
                    const globalUser = await identityService.getGlobalIdentity(userLink.global_user_id);
                    hasFullName = !!(globalUser?.fullName && globalUser.fullName.trim().length > 0);
                    hasBirthdate = !!(globalUser?.birthdate);
                }
            }
            catch (err) {
                // Se não conseguir verificar, não seta onboarding
                console.warn('[ProfileService] Erro ao verificar dados obrigatórios para onboarding:', err);
            }
            // Verificar fullName no profile atual (após merge) - pode estar sendo salvo agora
            const finalFullName = fullNameToUpdate !== undefined ? fullNameToUpdate : existingProfile?.fullName;
            if (finalFullName && finalFullName.trim().length > 0) {
                hasFullName = true;
            }
            // Verificar gender no profile atual (após merge) - pode estar sendo salvo agora
            const finalGender = mergedMetadata?.gender || existingMetadata?.gender;
            const hasGender = finalGender === 'male' || finalGender === 'female' || finalGender === 'other';
            // Se todos os dados obrigatórios existem, marcar onboarding como concluído
            if (hasFullName && hasBirthdate && hasGender) {
                mergedMetadata.onboarding_completed = true;
                mergedMetadata.onboarding_completed_at = new Date().toISOString();
            }
        }
        // Serializar metadata com segurança
        let serializedMetadata = '{}';
        try {
            serializedMetadata = JSON.stringify(mergedMetadata);
        }
        catch {
            serializedMetadata = JSON.stringify(existingMetadata || {});
        }
        // UPSERT (comportamento: não “reabre” cadeado; preserva confirmação)
        const insertCols = hasColumn
            ? `(tenant_id, user_id, full_name, phone, metadata, profile_personal_confirmed)`
            : `(tenant_id, user_id, full_name, phone, metadata)`;
        const insertValues = hasColumn
            ? `VALUES ($1, $2, $3, $4, $5::JSONB, false)`
            : `VALUES ($1, $2, $3, $4, $5::JSONB)`;
        // Campos para INSERT (se não veio no payload, não inventa: usa null no insert)
        const insertFullName = fullNameToUpdate !== undefined ? fullNameToUpdate : null;
        const insertPhone = phoneToUpdate !== undefined ? phoneToUpdate : null;
        const updateFields = [];
        // full_name: só mexe se veio no payload; e só “preenche” se ainda estiver vazio
        if (fullNameToUpdate !== undefined) {
            updateFields.push(`
        full_name = CASE
          WHEN $3 IS NOT NULL AND (profiles.full_name IS NULL OR profiles.full_name = '')
          THEN $3
          ELSE profiles.full_name
        END
      `);
        }
        // phone: se veio no payload, atualiza direto
        if (phoneToUpdate !== undefined) {
            updateFields.push(`phone = $4`);
        }
        // metadata: sempre atualiza com o merge (preserva campos existentes)
        updateFields.push(`metadata = $5::JSONB`);
        updateFields.push(`updated_at = now()`);
        // confirmação: preserva (nunca “volta pra false”)
        if (hasColumn) {
            updateFields.push(`profile_personal_confirmed = COALESCE(profiles.profile_personal_confirmed, false)`);
        }
        const returningConfirmed = hasColumn
            ? `profile_personal_confirmed`
            : `NULL::boolean AS profile_personal_confirmed`;
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO profiles ${insertCols}
        ${insertValues}
        ON CONFLICT (tenant_id, user_id)
        DO UPDATE SET
          ${updateFields.join(',\n          ')}
        RETURNING
          profile_id, tenant_id, user_id, full_name, phone, metadata,
          ${returningConfirmed},
          created_at, updated_at
      `, [tenantId, userId, insertFullName, insertPhone, serializedMetadata]);
        if (!row) {
            throw new Error('Failed to create or update profile');
        }
        // LGPD: CPF em user_profiles (imutável)
        if (cpfToSave) {
            try {
                const { pool } = await Promise.resolve().then(() => __importStar(require('@core/database/pool')));
                const existing = await pool.query(`SELECT cpf FROM user_profiles WHERE user_id = $1`, [userId]);
                const existingCpf = existing.rows[0]?.cpf;
                if (existingCpf && existingCpf !== cpfToSave) {
                    throw new errors_1.ConflictError('CPF não pode ser alterado após o cadastro');
                }
                try {
                    await pool.query(`
            INSERT INTO user_profiles (user_id, cpf)
            VALUES ($1, $2)
            ON CONFLICT (user_id) DO NOTHING
            `, [userId, cpfToSave]);
                }
                catch (err) {
                    if (err?.code === '23505') {
                        throw new errors_1.ConflictError('CPF já está em uso por outra conta');
                    }
                    throw err;
                }
            }
            catch (err) {
                if (err instanceof errors_1.ConflictError)
                    throw err;
                console.error('[ProfileService] Erro ao salvar CPF:', {
                    userId,
                    error: err instanceof Error ? err.message : 'Erro desconhecido',
                });
                // Não quebra update do profile por falha não-crítica de CPF
            }
        }
        return this.toProfile(row);
    }
    /**
     * Marca onboarding como concluído (apenas flag em metadata).
     */
    async completeOnboarding(tenantId, userId) {
        const { identityService } = await Promise.resolve().then(() => __importStar(require('@core/identity/identity.service')));
        const userLink = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT global_user_id FROM users WHERE user_id = $1 LIMIT 1`, [userId]);
        if (!userLink?.global_user_id) {
            const error = new Error('Usuário não possui identidade global');
            error.statusCode = 400;
            throw error;
        }
        const globalUser = await identityService.getGlobalIdentity(userLink.global_user_id);
        const errors = [];
        if (!globalUser?.fullName || globalUser.fullName.trim().length === 0)
            errors.push('Nome completo');
        if (!globalUser?.birthdate)
            errors.push('Data de nascimento');
        const existingProfile = await this.getProfile(tenantId, userId);
        const gender = existingProfile?.metadata?.gender;
        if (!gender || (gender !== 'male' && gender !== 'female'))
            errors.push('Gênero');
        if (errors.length > 0) {
            const error = new Error(`Não é possível completar onboarding. Dados obrigatórios faltando: ${errors.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }
        const existingMetadata = existingProfile?.metadata || {};
        const updatedMetadata = {
            ...existingMetadata,
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
        };
        return this.upsertProfile(tenantId, userId, { metadata: updatedMetadata });
    }
    /**
     * Confirma primeiro acesso (fecha o cadeado).
     * ✅ Se a coluna existir: seta profiles.profile_personal_confirmed = true
     * ✅ Se não existir: grava metadata.profile_personal_confirmed = true (fallback)
     */
    async confirmFirstAccess(tenantId, userId) {
        const hasColumn = await this.hasProfilePersonalConfirmedColumn(tenantId);
        if (hasColumn) {
            const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
          INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata, profile_personal_confirmed)
          VALUES ($1, $2, NULL, NULL, '{}'::JSONB, true)
          ON CONFLICT (tenant_id, user_id)
          DO UPDATE SET
            profile_personal_confirmed = true,
            updated_at = now()
          RETURNING profile_id
        `, [tenantId, userId]);
            if (!result)
                throw new Error('Falha ao confirmar primeiro acesso');
            return;
        }
        // Fallback: schema antigo
        const existing = await this.getProfile(tenantId, userId);
        const merged = deepMerge(existing?.metadata || {}, { profile_personal_confirmed: true });
        const result = await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata)
        VALUES ($1, $2, NULL, NULL, $3::JSONB)
        ON CONFLICT (tenant_id, user_id)
        DO UPDATE SET
          metadata = $3::JSONB,
          updated_at = now()
        RETURNING profile_id
      `, [tenantId, userId, JSON.stringify(merged)]);
        if (!result)
            throw new Error('Falha ao confirmar primeiro acesso');
    }
    /**
     * Verifica se onboarding foi concluído
     */
    async isOnboardingCompleted(tenantId, userId) {
        const profile = await this.getProfile(tenantId, userId);
        return profile?.metadata?.onboarding_completed === true;
    }
    /**
     * Verifica se pode editar dados pessoais (nome, birthdate, gender)
     * 🔧 FIX (first personal save locks identity fields): Fonte única de verdade é personal_data_locked
     */
    async canEditPersonalData(tenantId, userId) {
        const profile = await this.getProfile(tenantId, userId);
        if (!profile)
            return true;
        // 🔧 FIX (first personal save locks identity fields): Verificar personal_data_locked primeiro
        const personalDataLocked = profile.metadata?.personal_data_locked === true;
        if (personalDataLocked)
            return false;
        // Fallback para profile_personal_confirmed (compatibilidade)
        return !profile.profile_personal_confirmed;
    }
}
exports.profileService = new ProfileService();
