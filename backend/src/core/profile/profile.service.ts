// src/core/profile/profile.service.ts
// Serviço de perfil de usuário - READ-ONLY para visualização, permite atualização básica
//
// ✅ Corrigido para não quebrar caso a coluna `profile_personal_confirmed` ainda não exista no banco.
// Estratégia: detectar coluna em runtime e usar fallback em metadata (metadata.profile_personal_confirmed).

import { runQueryWithTenant } from '@core/database/pool';
import { ConflictError } from '@core/errors';
import type { Profile, UpdateProfileInput } from './profile.types';
import { validateCpfOrThrow, normalizeCpf, sanitizeCpfForLog } from '@utils/cpf.validator';
import { normalizeFullName } from '@utils/nameNormalizer';
import { isGender } from '@unificard/contracts';

type AnyRow = Record<string, any>;

/**
 * Faz merge profundo de objetos, preservando propriedades aninhadas.
 * 🔴 Campos `undefined` são ignorados (não sobrescrevem valores existentes).
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  if (!source || typeof source !== 'object') return target;

  const result: any = { ...(target as any) };

  for (const key of Object.keys(source)) {
    const sourceValue: any = (source as any)[key];
    const targetValue: any = result[key];

    // Ignorar undefined (PATCH real)
    if (sourceValue === undefined) continue;

    // Merge recursivo para objetos (não arrays)
    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      // Primitivos, arrays e null sobrescrevem
      result[key] = sourceValue;
    }
  }

  return result as T;
}

function isPlaceholderCpf(value: string | null | undefined): boolean {
  if (!value) return true;
  const clean = normalizeCpf(value);
  return clean.length !== 11 || /^0{11}$/.test(clean) || clean.startsWith('syn');
}

class ProfileService {
  /**
   * Cache por processo: se a coluna existe no schema atual.
   * (Se rodar migration, reinicie o serviço para recarregar.)
   */
  private profilePersonalConfirmedColumnCache: string | false | null = null;

  private async getProfilePersonalConfirmedColumn(tenantId: string): Promise<string | null> {
    if (this.profilePersonalConfirmedColumnCache !== null) {
      return this.profilePersonalConfirmedColumnCache || null;
    }

    const row = await runQueryWithTenant<{ column_name: string }>(
      tenantId,
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'profiles'
        AND column_name IN ('is_profile_personal_confirmed', 'profile_personal_confirmed')
      ORDER BY CASE column_name
        WHEN 'is_profile_personal_confirmed' THEN 1
        WHEN 'profile_personal_confirmed' THEN 2
        ELSE 3
      END
      LIMIT 1
      `
    );

    this.profilePersonalConfirmedColumnCache = row?.column_name || false;
    return this.profilePersonalConfirmedColumnCache || null;
  }

  private getConfirmedFromRow(row: AnyRow): boolean {
    // 1) Se a coluna existir no row (schema novo), ela manda.
    if (typeof row.profile_personal_confirmed === 'boolean') return row.profile_personal_confirmed === true;

    // 2) Fallback (schema antigo): metadata.profile_personal_confirmed
    const md = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    return md.profile_personal_confirmed === true;
  }

  private toProfile(row: AnyRow): Profile {
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
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
      profilePersonalConfirmed: profilePersonalConfirmed,
      canEditPersonalData: canEditPersonalData,
    };
  }

  /**
   * Busca perfil de um usuário
   */
  async getProfile(tenantId: string, userId: string): Promise<Profile | null> {
    const confirmedColumn = await this.getProfilePersonalConfirmedColumn(tenantId);

    const selectConfirmed = confirmedColumn
      ? `${confirmedColumn} AS profile_personal_confirmed`
      : `NULL::boolean AS profile_personal_confirmed`;

    const row = await runQueryWithTenant<AnyRow>(
      tenantId,
      `
        SELECT
          profile_id, tenant_id, user_id, full_name, phone, metadata,
          ${selectConfirmed},
          created_at, updated_at
        FROM profiles
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [tenantId, userId]
    );

    if (!row) return null;
    return this.toProfile(row);
  }

  /**
   * Cria perfil se não existir (READ-ONLY para GET)
   * NUNCA sobrescreve dados existentes
   */
  async createProfileIfNotExists(tenantId: string, userId: string): Promise<Profile> {
    const confirmedColumn = await this.getProfilePersonalConfirmedColumn(tenantId);

    const initialMetadata: Record<string, any> = {};
    // Fallback: se não existe coluna, persistimos a flag em metadata para manter o comportamento.
    if (!confirmedColumn) {
      initialMetadata.profile_personal_confirmed = false;
    }

    const insertCols = confirmedColumn
      ? `(tenant_id, user_id, full_name, phone, metadata, ${confirmedColumn})`
      : `(tenant_id, user_id, full_name, phone, metadata)`;

    const insertValues = confirmedColumn
      ? `VALUES ($1, $2, NULL, NULL, $3::JSONB, false)`
      : `VALUES ($1, $2, NULL, NULL, $3::JSONB)`;

    const returningConfirmed = confirmedColumn
      ? `${confirmedColumn} AS profile_personal_confirmed`
      : `NULL::boolean AS profile_personal_confirmed`;

    const row = await runQueryWithTenant<AnyRow>(
      tenantId,
      `
        INSERT INTO profiles ${insertCols}
        ${insertValues}
        ON CONFLICT (tenant_id, user_id) DO NOTHING
        RETURNING
          profile_id, tenant_id, user_id, full_name, phone, metadata,
          ${returningConfirmed},
          created_at, updated_at
      `,
      [tenantId, userId, JSON.stringify(initialMetadata)]
    );

    if (!row) {
      const existing = await this.getProfile(tenantId, userId);
      if (existing) return existing;
      throw new Error('Failed to create profile and profile not found');
    }

    return this.toProfile(row);
  }

  /**
   * Cria ou atualiza perfil de um usuário (PATCH parcial).
   * ⚠️ Só deve ser chamado por endpoints explícitos de UPDATE.
   */
  async upsertProfile(tenantId: string, userId: string, input: UpdateProfileInput): Promise<Profile> {
    const confirmedColumn = await this.getProfilePersonalConfirmedColumn(tenantId);

    // Buscar existente (para merge + regras de imutabilidade)
    const existingProfile = await this.getProfile(tenantId, userId);
    const existingMetadata: Record<string, any> = existingProfile?.metadata || {};

    // 🔧 FIX (first personal save locks identity fields): Verificar se dados pessoais estão bloqueados
    // Fonte única de verdade: metadata.personal_data_locked
    const personalDataLocked = existingMetadata?.personal_data_locked === true;

    // 🔧 FIX (first personal save locks identity fields): fullName (só se veio no payload)
    let fullNameToUpdate: string | null | undefined = undefined;
    if (input.fullName !== undefined) {
      if (personalDataLocked) {
        // Se dados estão bloqueados, ignorar tentativa de alterar
        fullNameToUpdate = undefined;
      } else {
        fullNameToUpdate = normalizeFullName(input.fullName);
      }
    }

    // phone (só se veio)
    let phoneToUpdate: string | null | undefined = undefined;
    if (input.phone !== undefined) {
      phoneToUpdate = input.phone || null;
    }

    // Extrair CPF do payload de metadata (CPF NÃO mora em metadata)
    let cpfToSave: string | null = null;
    if (input.metadata && typeof input.metadata === 'object') {
      const cpfValue = (input.metadata as any).cpf || (input.metadata as any).personal_profile?.cpf;
      if (typeof cpfValue === 'string' && cpfValue.trim().length > 0) {
        try {
          validateCpfOrThrow(cpfValue);
          const cpfClean = normalizeCpf(cpfValue);
          if (cpfClean.length === 11) cpfToSave = cpfClean;
        } catch (e) {
          console.warn('[ProfileService] CPF inválido recebido (ignorado):', {
            userId,
            cpfSanitized: sanitizeCpfForLog(cpfValue),
            error: e instanceof Error ? e.message : 'CPF inválido',
          });
        }
      }
    }

    // F2 GENDER (DECISION-0080 + GO C1 2026-06-11): extrair gender do payload — NÃO mora em metadata;
    // vai para o Identity SSOT (global_users.gender). Enum soberano de 5 valores (GENDER_VALUES).
    let genderToSave: string | null = null;
    if (input.metadata && typeof input.metadata === 'object') {
      const gv = (input.metadata as any).gender;
      const g = typeof gv === 'string' ? gv.trim() : '';
      if (isGender(g)) genderToSave = g;
    }

    // Sanitizar metadata: remover imutáveis e dados sensíveis
    let metadataWithoutImmutables: Record<string, any> | undefined = undefined;
    if (input.metadata !== undefined && input.metadata !== null && typeof input.metadata === 'object') {
      metadataWithoutImmutables = { ...(input.metadata as any) };

      // Nunca permitir CPF em metadata
      delete (metadataWithoutImmutables as any).cpf;
      if ((metadataWithoutImmutables as any).personal_profile) {
        delete (metadataWithoutImmutables as any).personal_profile.cpf;
        delete (metadataWithoutImmutables as any).personal_profile.birthdate;
      }
      delete (metadataWithoutImmutables as any).birthdate;

      // F2 GENDER (DECISION-0080): gender nunca mais é persistido no blob (vai para global_users.gender).
      // O lock/imutabilidade migra para o Identity SSOT via setUserGenderIfAbsent (set-once) — a regra é
      // preservada, só muda o LOCAL. Strip aqui antes do merge, como cpf/birthdate.
      delete (metadataWithoutImmutables as any).gender;

      // Compat: se não existe coluna, manter o flag em metadata
      if (!confirmedColumn && existingProfile) {
        (metadataWithoutImmutables as any).profile_personal_confirmed =
          existingProfile.profilePersonalConfirmed === true;
      }
    }

    // Merge profundo (PATCH real)
    let mergedMetadata: Record<string, any>;
    try {
      mergedMetadata = metadataWithoutImmutables
        ? deepMerge(existingMetadata, metadataWithoutImmutables)
        : existingMetadata;
    } catch {
      mergedMetadata = existingMetadata;
    }
    if (!mergedMetadata || typeof mergedMetadata !== 'object') mergedMetadata = {};

    // 🔧 FIX (first personal save locks identity fields): Se salvou dados pessoais e ainda não está bloqueado, bloquear
    // Verificar se houve tentativa de salvar fullName ou gender (indicando primeiro salvamento)
    const attemptedToSavePersonalData = 
      (input.fullName !== undefined && fullNameToUpdate !== undefined) ||
      (input.metadata?.gender !== undefined && !personalDataLocked);
    
    if (attemptedToSavePersonalData && !personalDataLocked) {
      mergedMetadata.personal_data_locked = true;
      mergedMetadata.personal_data_lockedAt = new Date().toISOString();
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
      const { identityService } = await import('@core/identity/identity.service');
      let hasFullName = false;
      let hasBirthdate = false;
      let genderCanonical: string | null = null; // F2 GENDER: gender do Identity SSOT (global_users.gender)

      try {
        const userLink = await runQueryWithTenant<{ global_user_id: string }>(
          tenantId,
          `SELECT global_user_id FROM users WHERE id = $1 LIMIT 1`,
          [userId]
        );

        if (userLink?.global_user_id) {
          const globalUser = await identityService.getGlobalIdentity(userLink.global_user_id);
          hasFullName = !!(globalUser?.fullName && globalUser.fullName.trim().length > 0);
          hasBirthdate = !!(globalUser?.birthdate);
          genderCanonical = globalUser?.gender ?? null;
        }
      } catch (err) {
        // Se não conseguir verificar, não seta onboarding
        console.warn('[ProfileService] Erro ao verificar dados obrigatórios para onboarding:', err);
      }
      
      // Verificar fullName no profile atual (após merge) - pode estar sendo salvo agora
      const finalFullName = fullNameToUpdate !== undefined ? fullNameToUpdate : existingProfile?.fullName;
      if (finalFullName && finalFullName.trim().length > 0) {
        hasFullName = true;
      }
      
      // F2 GENDER (DECISION-0080): gender vem do Identity SSOT (global_users.gender), não do blob.
      // Considera o valor recém-salvo nesta operação (genderToSave) ou o canônico já persistido.
      const finalGender = genderToSave || genderCanonical || existingMetadata?.gender;
      const hasGender = isGender(finalGender);
      
      // Se todos os dados obrigatórios existem, marcar onboarding como concluído
      if (hasFullName && hasBirthdate && hasGender) {
        mergedMetadata.onboarding_completed = true;
        mergedMetadata.onboarding_completedAt = new Date().toISOString();
      }
    }

    // Serializar metadata com segurança
    let serializedMetadata = '{}';
    try {
      serializedMetadata = JSON.stringify(mergedMetadata);
    } catch {
      serializedMetadata = JSON.stringify(existingMetadata || {});
    }

    // UPSERT (comportamento: não “reabre” cadeado; preserva confirmação)
    const insertCols = confirmedColumn
      ? `(tenant_id, user_id, full_name, phone, metadata, ${confirmedColumn})`
      : `(tenant_id, user_id, full_name, phone, metadata)`;

    const insertValues = confirmedColumn
      ? `VALUES ($1, $2, $3, $4, $5::JSONB, false)`
      : `VALUES ($1, $2, $3, $4, $5::JSONB)`;

    // Campos para INSERT (se não veio no payload, não inventa: usa null no insert)
    const insertFullName = fullNameToUpdate !== undefined ? fullNameToUpdate : null;
    const insertPhone = phoneToUpdate !== undefined ? phoneToUpdate : null;

    const updateFields: string[] = [];

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
    if (confirmedColumn) {
      updateFields.push(`${confirmedColumn} = COALESCE(profiles.${confirmedColumn}, false)`);
    }

    const returningConfirmed = confirmedColumn
      ? `${confirmedColumn} AS profile_personal_confirmed`
      : `NULL::boolean AS profile_personal_confirmed`;

    const row = await runQueryWithTenant<AnyRow>(
      tenantId,
      `
        INSERT INTO profiles ${insertCols}
        ${insertValues}
        ON CONFLICT (tenant_id, user_id)
        DO UPDATE SET
          ${updateFields.join(',\n          ')}
        RETURNING
          profile_id, tenant_id, user_id, full_name, phone, metadata,
          ${returningConfirmed},
          created_at, updated_at
      `,
      [tenantId, userId, insertFullName, insertPhone, serializedMetadata]
    );

    if (!row) {
      throw new Error('Failed to create or update profile');
    }

    // LGPD: CPF imutável. Fonte operacional do CORE: user_profiles.cpf.
    // profiles.cpf pode conter placeholder legado (ex.: 000.000.000-00) e não deve bloquear primeiro salvamento real.
    if (cpfToSave) {
      try {
        const { pool } = await import('@core/database/pool');

        const existing = await pool.query<{ profile_cpf: string | null; user_profile_cpf: string | null }>(
          `
          SELECT
            p.cpf AS profile_cpf,
            up.cpf AS user_profile_cpf
          FROM profiles p
          LEFT JOIN user_profiles up ON up.user_id = p.user_id
          WHERE p.user_id = $1 AND p.tenant_id = $2
          LIMIT 1
          `,
          [userId, tenantId]
        );

        const existingUserProfileCpf = existing.rows[0]?.user_profile_cpf ?? null;
        const existingProfileCpf = existing.rows[0]?.profile_cpf ?? null;
        const canonicalExistingCpf = existingUserProfileCpf && !isPlaceholderCpf(existingUserProfileCpf)
          ? normalizeCpf(existingUserProfileCpf)
          : existingProfileCpf && !isPlaceholderCpf(existingProfileCpf)
            ? normalizeCpf(existingProfileCpf)
            : null;

        if (canonicalExistingCpf && canonicalExistingCpf !== cpfToSave) {
          throw new ConflictError('CPF não pode ser alterado após o cadastro');
        }

        try {
          await pool.query(
            `
            WITH upsert_user_profile AS (
              INSERT INTO user_profiles (user_id, cpf)
              VALUES ($2, $3)
              ON CONFLICT (user_id)
              DO UPDATE SET
                cpf = CASE
                  WHEN user_profiles.cpf IS NULL OR regexp_replace(user_profiles.cpf, '[^0-9]', '', 'g') = ''
                  THEN EXCLUDED.cpf
                  ELSE user_profiles.cpf
                END,
                updated_at = now()
              RETURNING user_id
            )
            UPDATE profiles
            SET cpf = $3
            WHERE tenant_id = $1
              AND user_id = $2
              AND (
                cpf IS NULL
                OR regexp_replace(cpf, '[^0-9]', '', 'g') = ''
                OR regexp_replace(cpf, '[^0-9]', '', 'g') = '00000000000'
                OR regexp_replace(cpf, '[^0-9]', '', 'g') = $3
              )
            `,
            [tenantId, userId, cpfToSave]
          );
        } catch (err: any) {
          if (err?.code === '23505') {
            throw new ConflictError('CPF já está em uso por outra conta');
          }
          throw err;
        }
      } catch (err) {
        if (err instanceof ConflictError) throw err;

        console.error('[ProfileService] Erro ao salvar CPF:', {
          userId,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
        // Não quebra update do profile por falha não-crítica de CPF
      }
    }

    // F2 GENDER (DECISION-0080): gender vai para o Identity SSOT (global_users.gender), set-once.
    // NÃO grava no blob (já stripado acima). setUserGenderIfAbsent preserva a imutabilidade (WHERE gender IS NULL).
    if (genderToSave) {
      try {
        const { identityService } = await import('@core/identity/identity.service');
        const userLink = await runQueryWithTenant<{ global_user_id: string }>(
          tenantId,
          `SELECT global_user_id FROM users WHERE id = $1 LIMIT 1`,
          [userId]
        );
        if (userLink?.global_user_id) {
          await identityService.setUserGenderIfAbsent(userLink.global_user_id, genderToSave);
        }
      } catch (err) {
        // Não quebra o update do profile por falha não-crítica de gender.
        console.error('[ProfileService] Erro ao salvar gender em global_users (nao critico):', err instanceof Error ? err.message : String(err));
      }
    }

    return this.toProfile(row);
  }

  /**
   * Marca onboarding como concluído (apenas flag em metadata).
   */
  async completeOnboarding(tenantId: string, userId: string): Promise<Profile> {
    const { identityService } = await import('@core/identity/identity.service');

    const userLink = await runQueryWithTenant<{ global_user_id: string }>(
      tenantId,
      `SELECT global_user_id FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!userLink?.global_user_id) {
      const error: any = new Error('Usuário não possui identidade global');
      error.statusCode = 400;
      throw error;
    }

    const globalUser = await identityService.getGlobalIdentity(userLink.global_user_id);

    const errors: string[] = [];
    if (!globalUser?.fullName || globalUser.fullName.trim().length === 0) errors.push('Nome completo');
    if (!globalUser?.birthdate) errors.push('Data de nascimento');

    const existingProfile = await this.getProfile(tenantId, userId);
    // F2 GENDER (DECISION-0080 + GO C1 2026-06-11): gender canônico vem de global_users.gender
    // (Identity SSOT); blob é fallback transitório até o cleanup (F4). Enum soberano de 5 valores.
    const gender = globalUser?.gender || existingProfile?.metadata?.gender;
    if (!isGender(gender)) errors.push('Gênero');

    if (errors.length > 0) {
      const error: any = new Error(
        `Não é possível completar onboarding. Dados obrigatórios faltando: ${errors.join(', ')}`
      );
      error.statusCode = 400;
      throw error;
    }

    const existingMetadata = existingProfile?.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      onboarding_completed: true,
      onboarding_completedAt: new Date().toISOString(),
    };

    return this.upsertProfile(tenantId, userId, { metadata: updatedMetadata });
  }

  /**
   * Confirma primeiro acesso (fecha o cadeado).
   * ✅ Se a coluna existir: seta a flag booleana canônica = true
   * ✅ Se não existir: grava metadata.profile_personal_confirmed = true (fallback)
   */
  async confirmFirstAccess(tenantId: string, userId: string): Promise<void> {
    const confirmedColumn = await this.getProfilePersonalConfirmedColumn(tenantId);

    if (confirmedColumn) {
      const result = await runQueryWithTenant<AnyRow>(
        tenantId,
        `
          INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata, ${confirmedColumn})
          VALUES ($1, $2, NULL, NULL, '{}'::JSONB, true)
          ON CONFLICT (tenant_id, user_id)
          DO UPDATE SET
            ${confirmedColumn} = true,
            updated_at = now()
          RETURNING profile_id
        `,
        [tenantId, userId]
      );

      if (!result) throw new Error('Falha ao confirmar primeiro acesso');
      return;
    }

    // Fallback: schema antigo
    const existing = await this.getProfile(tenantId, userId);
    const merged = deepMerge(existing?.metadata || {}, { profile_personal_confirmed: true });

    const result = await runQueryWithTenant<AnyRow>(
      tenantId,
      `
        INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata)
        VALUES ($1, $2, NULL, NULL, $3::JSONB)
        ON CONFLICT (tenant_id, user_id)
        DO UPDATE SET
          metadata = $3::JSONB,
          updated_at = now()
        RETURNING profile_id
      `,
      [tenantId, userId, JSON.stringify(merged)]
    );

    if (!result) throw new Error('Falha ao confirmar primeiro acesso');
  }

  /**
   * Verifica se onboarding foi concluído
   */
  async isOnboardingCompleted(tenantId: string, userId: string): Promise<boolean> {
    const profile = await this.getProfile(tenantId, userId);
    return profile?.metadata?.onboarding_completed === true;
  }

  /**
   * Verifica se pode editar dados pessoais (nome, birthdate, gender)
   * 🔧 FIX (first personal save locks identity fields): Fonte única de verdade é personal_data_locked
   */
  async canEditPersonalData(tenantId: string, userId: string): Promise<boolean> {
    const profile = await this.getProfile(tenantId, userId);
    if (!profile) return true;
    // 🔧 FIX (first personal save locks identity fields): Verificar personal_data_locked primeiro
    const personalDataLocked = profile.metadata?.personal_data_locked === true;
    if (personalDataLocked) return false;
    // Fallback para profilePersonalConfirmed (compatibilidade)
    return !profile.profilePersonalConfirmed;
  }
}

export const profileService = new ProfileService();
