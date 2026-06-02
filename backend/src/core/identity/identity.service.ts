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

// src/core/identity/identity.service.ts
import { pool } from '@core/database/pool';
import { runQueryWithTenant } from '@core/database/pool';
import { normalizeCpf, validateCpf } from '@utils/cpf.validator';
import { reputationService } from '@core/reputation/reputation.service';
import { residenceService } from '@core/residence/residence.service';
import type {
  GlobalUser,
  GlobalUserRow,
  UpdateGlobalIdentityInput,
  IdentityProfile,
} from './identity.types';

class IdentityService {
  private isSeedBirthdate(value: Date | string | null | undefined): boolean {
    if (!value) return false;
    if (value instanceof Date) {
      return value.getUTCFullYear() === 1990 && value.getUTCMonth() === 0 && value.getUTCDate() === 1;
    }
    return String(value).substring(0, 10) === '1990-01-01';
  }

  private toGlobalUser(row: GlobalUserRow): GlobalUser {
    // 🔴 CRÍTICO: Garantir que birthdate seja tratado corretamente
    // PostgreSQL DATE retorna como string YYYY-MM-DD ou como Date
    // IMPORTANTE: Sempre criar Date usando UTC para evitar problemas de timezone
    let birthdate: Date | null = null;
    if (row.birthdate) {
      if (typeof row.birthdate === 'string') {
        // PostgreSQL DATE retorna como string YYYY-MM-DD
        const dateMatch = (row.birthdate as string).match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1; // JavaScript months são 0-indexed
          const day = parseInt(dateMatch[3], 10);
          // 🔴 CRÍTICO: Usar Date.UTC para garantir que a data não mude de dia
          birthdate = new Date(Date.UTC(year, month, day));
        } else {
          // Se não for formato YYYY-MM-DD, tentar parsear como Date
          const parsed = new Date(row.birthdate);
          if (!isNaN(parsed.getTime())) {
            // Extrair componentes UTC e recriar
            birthdate = new Date(Date.UTC(
              parsed.getUTCFullYear(),
              parsed.getUTCMonth(),
              parsed.getUTCDate()
            ));
          }
        }
      } else if (row.birthdate instanceof Date) {
        // Se já é Date, extrair componentes UTC e recriar (garante consistência)
        birthdate = new Date(Date.UTC(
          row.birthdate.getUTCFullYear(),
          row.birthdate.getUTCMonth(),
          row.birthdate.getUTCDate()
        ));
      }
    }

    return {
      globalUserId: row.global_user_id,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updatedAt:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      birthdate,
      gender: row.gender ?? null,
      metadata: row.metadata || {},
    };
  }

  /**
   * CPF sintético único por (tenant, user) — não passa em validateCpf (proposital),
   * evita colisão com CPFs reais e satisfaz UNIQUE(global_users.cpf).
   */
  private syntheticCpfForUser(tenantId: string, userId: string): string {
    return `syn:${tenantId}:${userId}`;
  }

  /**
   * Garante que `users.global_user_id` aponta para `global_users`.
   * - Se já houver vínculo: devolve a identidade global.
   * - Se houver CPF válido em `profiles`: faz UPSERT em `global_users` (mesma regra do register).
   * - Caso contrário: cria `global_users` com CPF sintético e atualiza `users`.
   */
  async ensureGlobalUserLinked(userId: string, tenantId: string): Promise<GlobalUser> {
    const local = await runQueryWithTenant<{
      id: string;
      user_id: string;
      global_user_id: string | null;
      email: string;
    }>(
      tenantId,
      `
        SELECT id, user_id, global_user_id, email
        FROM users
        WHERE id = $1 OR user_id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (!local) {
      throw new Error(`Usuário local não encontrado: ${userId} (tenant: ${tenantId})`);
    }

    const canonicalUserId = local.id;

    if (local.global_user_id) {
      return this.getGlobalIdentity(local.global_user_id);
    }

    const profileRow = await runQueryWithTenant<{ cpf: string | null }>(
      tenantId,
      `SELECT cpf FROM profiles WHERE user_id = $1 LIMIT 1`,
      [canonicalUserId]
    );

    let cpfForInsert: string;
    const rawCpf = profileRow?.cpf?.trim();
    if (rawCpf) {
      const normalized = normalizeCpf(rawCpf);
      if (normalized.length === 11 && validateCpf(normalized)) {
        cpfForInsert = normalized;
      } else {
        cpfForInsert = this.syntheticCpfForUser(tenantId, canonicalUserId);
      }
    } else {
      cpfForInsert = this.syntheticCpfForUser(tenantId, canonicalUserId);
    }

    const metadata =
      cpfForInsert === this.syntheticCpfForUser(tenantId, canonicalUserId)
        ? { synthetic: true, source: 'ensureGlobalUserLinked' as const }
        : { source: 'ensureGlobalUserLinked' as const };

    const insertResult = await pool.query<{ global_user_id: string }>(
      `
      INSERT INTO global_users (cpf, full_name, avatar_url, birthdate, metadata)
      VALUES ($1, $2, NULL, NULL, $3::jsonb)
      ON CONFLICT (cpf)
      DO UPDATE SET cpf = EXCLUDED.cpf
      RETURNING global_user_id
      `,
      [cpfForInsert, null, JSON.stringify(metadata)]
    );

    const globalUserId = insertResult.rows[0]?.global_user_id;
    if (!globalUserId) {
      throw new Error('Falha ao criar ou resolver global_users para o usuário local');
    }

    await runQueryWithTenant(
      tenantId,
      `
        UPDATE users
        SET global_user_id = $1,
            updated_at = now()
        WHERE id = $2
      `,
      [globalUserId, canonicalUserId]
    );

    return this.getGlobalIdentity(globalUserId);
  }

  /**
   * Para cada `users` sem `global_user_id`, executa {@link ensureGlobalUserLinked}.
   */
  async backfillMissingGlobalUserLinks(): Promise<{ fixed: number; errors: string[] }> {
    const result = await pool.query<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id FROM users WHERE global_user_id IS NULL`
    );
    const errors: string[] = [];
    let fixed = 0;
    for (const row of result.rows) {
      try {
        await this.ensureGlobalUserLinked(row.id, row.tenant_id);
        fixed += 1;
      } catch (e) {
        errors.push(
          `user ${row.id} tenant ${row.tenant_id}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
    return { fixed, errors };
  }

  /**
   * tax_id exigido por `identities` (11 caracteres para tipo cpf).
   */
  private taxIdForIdentityFromGlobalUser(
    globalUserId: string,
    cpfFromDb: string | null
  ): string {
    const normalized = (cpfFromDb || '').replace(/\D/g, '');
    if (normalized.length === 11) {
      return normalized;
    }
    const d = globalUserId.replace(/\D/g, '');
    return d.length >= 11 ? d.slice(0, 11) : d.padEnd(11, '0');
  }

  /**
   * Batch / jobs (reconciliação): garante linha em `identities` para um GU.
   * Delega na mesma implementação que `ensureCanonicalActorChain` — não duplicar INSERT/tax_id.
   */
  async ensureIdentityRowForGlobalUserId(globalUserId: string): Promise<void> {
    await this.ensureIdentityRowForGlobalUser(globalUserId);
  }

  /**
   * Garante linha em `identities` para satisfazer FK `actors.global_user_id → identities(global_user_id)`.
   */
  private async ensureIdentityRowForGlobalUser(globalUserId: string): Promise<void> {
    const exists = await pool.query(`SELECT 1 FROM identities WHERE global_user_id = $1 LIMIT 1`, [
      globalUserId,
    ]);
    if (exists.rows.length > 0) {
      return;
    }
    const gu = await pool.query<{ cpf: string }>(
      `SELECT cpf FROM global_users WHERE global_user_id = $1 LIMIT 1`,
      [globalUserId]
    );
    const taxId = this.taxIdForIdentityFromGlobalUser(
      globalUserId,
      gu.rows[0]?.cpf ?? null
    );
    await pool.query(
      `
      INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level)
      VALUES ($1::uuid, $2, 'cpf', 'pending', 'none')
      ON CONFLICT (global_user_id) DO NOTHING
      `,
      [globalUserId, taxId]
    );
  }

  /**
   * Garante `actors` no schema Genesis (id = users.id, actor_human, FK identities).
   */
  private async ensureGenesisActorForUser(
    tenantId: string,
    canonicalUserId: string,
    globalUserId: string,
    displayLabel: string
  ): Promise<void> {
    const ext = canonicalUserId;
    await runQueryWithTenant(
      tenantId,
      `
      INSERT INTO actors (id, tenant_id, actor_type, external_id, display_name, global_user_id)
      VALUES ($1::uuid, $2, 'actor_human', $5, $3, $4::uuid)
      ON CONFLICT (id) DO UPDATE SET
        global_user_id = COALESCE(actors.global_user_id, EXCLUDED.global_user_id),
        display_name = EXCLUDED.display_name
      `,
      [canonicalUserId, tenantId, displayLabel, globalUserId, ext]
    );
  }

  /**
   * Cadeia canónica (único caminho de serviço): `global_users` + `users.global_user_id`
   * → `identities` → `actors` (Genesis: actor id = user id, actor_human).
   * Usar em E2E, jobs e integrações que precisam de actor físico sem SQL nos scripts.
   */
  async ensureCanonicalActorChain(
    userId: string,
    tenantId: string
  ): Promise<{ userId: string; globalUserId: string; actorId: string }> {
    const globalUser = await this.ensureGlobalUserLinked(userId, tenantId);
    const local = await runQueryWithTenant<{ id: string; email: string }>(
      tenantId,
      `
      SELECT id, email
      FROM users
      WHERE id = $1 OR user_id = $1
      LIMIT 1
      `,
      [userId]
    );
    if (!local) {
      throw new Error(`ensureCanonicalActorChain: utilizador não encontrado: ${userId}`);
    }
    await this.ensureIdentityRowForGlobalUser(globalUser.globalUserId);
    const label = (local.email && local.email.trim()) || `user ${local.id}`;
    await this.ensureGenesisActorForUser(
      tenantId,
      local.id,
      globalUser.globalUserId,
      label
    );
    return {
      userId: local.id,
      globalUserId: globalUser.globalUserId,
      actorId: local.id,
    };
  }

  /**
   * Cria uma identidade global para um usuário local
   * 🔴 REGRA: NUNCA cria novo global_user se já existir vínculo
   */
  async createGlobalIdentityForUser(
    userId: string,
    tenantId: string
  ): Promise<GlobalUser> {
    return this.ensureGlobalUserLinked(userId, tenantId);
  }

  /**
   * Busca identidade global por ID
   * 🔴 REGRA: NUNCA retorna null - sempre lança erro se não encontrado
   */
  async getGlobalIdentity(globalUserId: string): Promise<GlobalUser> {
    console.log('[IdentityService] 🔍 getGlobalIdentity: Buscando no banco', { globalUserId });
    
    if (!globalUserId) {
      throw new Error('globalUserId é obrigatório');
    }
    
    // 🔴 DIAGNÓSTICO: Verificar quantos registros existem (não deveria ser > 1, mas vamos verificar)
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM global_users WHERE global_user_id = $1`,
      [globalUserId]
    );
    const recordCount = parseInt(countResult.rows[0]?.count || '0', 10);
    
    if (recordCount > 1) {
      console.error('[IdentityService] ❌ ERRO CRÍTICO: MÚLTIPLOS registros encontrados para global_user_id!', {
        globalUserId,
        count: recordCount,
      });
      throw new Error(`Múltiplos registros encontrados para global_user_id: ${globalUserId}. Execute DIAGNOSTICO_BIRTHDATE.sql para investigar.`);
    }
    
    // 🔴 CORREÇÃO: Buscar registro único (global_user_id é PRIMARY KEY)
    const result = await pool.query<GlobalUserRow>(
      `
        SELECT global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, gender, metadata
        FROM global_users
        WHERE global_user_id = $1
      `,
      [globalUserId]
    );

    if (!result.rows[0]) {
      console.error('[IdentityService] ❌ getGlobalIdentity: NÃO encontrado no banco', { globalUserId });
      throw new Error(`Global identity não encontrada para global_user_id: ${globalUserId}`);
    }

    console.log('[IdentityService] ✅ getGlobalIdentity: Encontrado no banco', {
      globalUserId: result.rows[0].global_user_id,
      fullName: result.rows[0].full_name,
      birthdate: result.rows[0].birthdate,
      updatedAt:
        result.rows[0].updated_at instanceof Date
          ? result.rows[0].updated_at.toISOString()
          : String(result.rows[0].updated_at),
      recordCount,
    });

    return this.toGlobalUser(result.rows[0]);
  }

  /**
   * F2 GENDER (DECISION-0080): grava `global_users.gender` apenas se ainda AUSENTE (set-once).
   * O `WHERE gender IS NULL` materializa o lock/imutabilidade: o primeiro valor fica; tentativas
   * posteriores de alterar são NO-OP (não lançam) — mesma regra de negócio de hoje, só muda o local.
   * Valida o enum canônico (male|female|other). Valor inválido/ausente → no-op silencioso.
   * Retorna true se gravou agora, false se já existia (ou input inválido).
   */
  async setUserGenderIfAbsent(globalUserId: string, gender: string | null | undefined): Promise<boolean> {
    const g = typeof gender === 'string' ? gender.trim() : '';
    if (g !== 'male' && g !== 'female' && g !== 'other') return false;
    const result = await pool.query(
      `UPDATE global_users
       SET gender = $2, updated_at = now()
       WHERE global_user_id = $1 AND gender IS NULL`,
      [globalUserId, g]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Atualiza identidade global
   * 🔴 REGRA: Toda decisão de perfil é tenant-scoped
   */
  async updateGlobalIdentity(
    tenantId: string,
    globalUserId: string,
    updates: UpdateGlobalIdentityInput
  ): Promise<GlobalUser> {
    // 🔴 CRÍTICO: Log do input recebido
    console.log('[IdentityService] ========== updateGlobalIdentity INICIADO ==========');
    console.log('[IdentityService] Input recebido:', {
      globalUserId,
      updates,
      fullName: updates.fullName,
      birthdate: updates.birthdate,
      fullNameType: typeof updates.fullName,
      birthdateType: typeof updates.birthdate,
    });

    // 🔴 IMUTABILIDADE: Verificar se dados imutáveis já existem antes de permitir alteração
    const existingGlobalUser = await this.getGlobalIdentity(globalUserId);
    
    // 🔴 PARTE 2 - ONBOARDING: Verificar se pode editar birthdate
    // Buscar userId usando fonte canônica (users) com tenantId obrigatório
    let canEditBirthdate = true;
    try {
      const userResult = await runQueryWithTenant<{ user_id: string }>(
        tenantId,
        `SELECT user_id FROM users WHERE global_user_id = $1 AND tenant_id = $2 LIMIT 1`,
        [globalUserId, tenantId]
      );
      
      if (!userResult) {
        throw new Error(`Usuário não encontrado para global_user_id: ${globalUserId} no tenant: ${tenantId}`);
      }
      
      const { user_id } = userResult;
      const { profileService } = await import('@core/profile/profile.service');
      canEditBirthdate = await profileService.canEditPersonalData(tenantId, user_id);
    } catch (err) {
      // Se não conseguir verificar, assumir que não pode editar (mais seguro)
      canEditBirthdate = false;
    }
    
    // 🔴 CORREÇÃO CRÍTICA: Só bloquear alteração se birthdate JÁ FOI PREENCHIDO (não é null/undefined)
    // REGRA: Permitir salvar birthdate pela primeira vez, mesmo após onboarding, se ainda for null
    const birthdateAlreadyExists =
      existingGlobalUser?.birthdate !== null &&
      existingGlobalUser?.birthdate !== undefined &&
      !this.isSeedBirthdate(existingGlobalUser.birthdate);

    if (birthdateAlreadyExists && updates.birthdate !== undefined && updates.birthdate !== null && !canEditBirthdate) {
      console.log('[IdentityService] 🔒 Ignorando tentativa de alteração de birthdate (dado imutável após onboarding):', {
        existing: existingGlobalUser.birthdate,
        attempted: updates.birthdate,
        canEdit: canEditBirthdate,
      });
      // Remover birthdate dos updates
      delete updates.birthdate;
    } else if (!birthdateAlreadyExists && updates.birthdate !== undefined && updates.birthdate !== null) {
      console.log('[IdentityService] ✅ Permitindo salvar birthdate pela primeira vez:', {
        attempted: updates.birthdate,
        canEdit: canEditBirthdate,
        onboardingStatus: canEditBirthdate ? 'não concluído' : 'concluído mas birthdate ainda null',
      });
    }

    // 🔧 FIX (first personal save locks identity fields): Ignorar tentativa de alteração de fullName se dados estão bloqueados
    if (updates.fullName && !canEditBirthdate) {
      console.log('[IdentityService] 🔒 Ignorando tentativa de alteração de fullName (dados bloqueados):', {
        existing: existingGlobalUser.fullName,
        attempted: updates.fullName,
      });
      // Remover fullName dos updates
      delete updates.fullName;
    } else if (existingGlobalUser?.fullName && existingGlobalUser.fullName.trim().length > 0 && updates.fullName) {
      console.log('[IdentityService] 🔒 Ignorando tentativa de alteração de fullName (dado imutável):', {
        existing: existingGlobalUser.fullName,
        attempted: updates.fullName,
      });
      // Remover fullName dos updates
      delete updates.fullName;
    }
    
    // 🔴 CORREÇÃO CRÍTICA: Construir arrays de forma ordenada para garantir correspondência correta
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1; // Placeholders começam em $1

    if (updates.fullName !== undefined) {
      // 🔴 VALIDAÇÃO CRÍTICA: Garantir que fullName não seja uma data
      if (updates.fullName && typeof updates.fullName === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(updates.fullName)) {
          console.error('[IdentityService] ❌ ERRO CRÍTICO: fullName parece ser uma data!', updates.fullName);
          throw new Error(`Valor inválido para fullName: "${updates.fullName}". Parece ser uma data, não um nome.`);
        }
      }
      
      console.log('[IdentityService] Adicionando fullName:', {
        field: `full_name = $${paramIndex}`,
        valueCents: updates.fullName,
        paramIndex,
      });
      
      updateFields.push(`full_name = $${paramIndex}`);
      values.push(updates.fullName);
      paramIndex++;
    }
    if (updates.avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex}`);
      values.push(updates.avatarUrl);
      paramIndex++;
    }
    if (updates.birthdate !== undefined) {
      // 🔴 CORREÇÃO DEFINITIVA: Reordenar validação
      // PRIMEIRO: Normalizar Date para YYYY-MM-DD
      // DEPOIS: Validar letras e formato
      // Se birthdate não está no payload (undefined), não entra neste if
      // Se está no payload, processa normalmente (pode ser null ou Date/string)
      const birthdateValue = updates.birthdate;
      if (birthdateValue !== null && birthdateValue !== undefined) {
        let dateStr: string;
        
        // 🔴 PASSO 1: Se for Date, normalizar direto para YYYY-MM-DD (ANTES de validar letras)
      if (birthdateValue instanceof Date) {
        // Se for Date, extrair componentes UTC e formatar como YYYY-MM-DD
        const year = birthdateValue.getUTCFullYear();
        const month = String(birthdateValue.getUTCMonth() + 1).padStart(2, '0');
        const day = String(birthdateValue.getUTCDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        console.log('[IdentityService] ✅ birthdate Date normalizado para:', dateStr);
      } 
      // 🔴 PASSO 2: Se for string, normalizar usando função utilitária
      else if (typeof birthdateValue === 'string') {
        const { normalizeBirthdate } = await import('@utils/dateNormalizer');
        try {
          // Normaliza DD/MM/YYYY ou YYYY-MM-DD para YYYY-MM-DD
          dateStr = normalizeBirthdate(birthdateValue);
          console.log('[IdentityService] ✅ birthdate normalizado:', {
            original: birthdateValue,
            normalized: dateStr,
          });
        } catch (normalizeError: any) {
          console.error('[IdentityService] ❌ Erro ao normalizar birthdate:', normalizeError);
          throw normalizeError; // Re-lançar erro com statusCode
        }
      } else {
        console.error('[IdentityService] ❌ ERRO: Tipo de birthdate inválido:', typeof birthdateValue, birthdateValue);
        const error = new Error(`Tipo de birthdate inválido: ${typeof birthdateValue}`);
        (error as any).statusCode = 400;
        throw error;
      }
        
        // 🔴 CRÍTICO: Usar CAST para garantir que PostgreSQL trate como DATE
        updateFields.push(`birthdate = $${paramIndex}::DATE`);
        values.push(dateStr);
        
        // 🔴 DIAGNÓSTICO: Log do valor que será salvo
        console.log('[IdentityService] ✅ Salvando birthdate:', {
          original: updates.birthdate,
          dateStr,
          type: typeof dateStr,
          isValid: /^\d{4}-\d{2}-\d{2}$/.test(dateStr),
          paramIndex,
        });
      } else {
        // Se for null, salvar como null
        updateFields.push(`birthdate = $${paramIndex}`);
        values.push(null);
      }
      paramIndex++;
    }
    if (updates.metadata !== undefined) {
      updateFields.push(`metadata = $${paramIndex}`);
      values.push(JSON.stringify(updates.metadata));
      paramIndex++;
    }

    if (updateFields.length === 0) {
      const existing = await this.getGlobalIdentity(globalUserId);
      if (!existing) {
        throw new Error('Global identity not found');
      }
      return existing;
    }

    updateFields.push(`updated_at = now()`);
    
    // 🔴 CRÍTICO: Log antes de construir SQL
    console.log('[IdentityService] Construindo SQL UPDATE:', {
      globalUserId,
      updateFields,
      values,
      valuesCount: values.length,
      updateFieldsCount: updateFields.length,
    });
    
    // 🔴 VALIDAÇÃO CRÍTICA: Verificar se os valores correspondem aos campos
    for (let i = 0; i < updateFields.length - 1; i++) { // -1 para excluir updatedAt
      const field = updateFields[i];
      const fieldName = field.split('=')[0].trim();
      const value = values[i];
      
      // 🔴 VALIDAÇÃO: Se o campo é birthdate, o valor NÃO pode ser um nome
      if (fieldName === 'birthdate' && value && typeof value === 'string') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && value.match(/[a-zA-Z]/)) {
          console.error('[IdentityService] ❌ ERRO CRÍTICO: birthdate recebeu um nome!', {
            fieldName,
            value,
            updateFields,
            values,
          });
          throw new Error(`Valor inválido para birthdate: "${value}". Parece ser um nome, não uma data. Verifique se os campos não estão trocados.`);
        }
      }
      
      // 🔴 VALIDAÇÃO: Se o campo é full_name, o valor NÃO pode ser uma data
      if (fieldName === 'full_name' && value && typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          console.error('[IdentityService] ❌ ERRO CRÍTICO: full_name recebeu uma data!', {
            fieldName,
            value,
            updateFields,
            values,
          });
          throw new Error(`Valor inválido para fullName: "${value}". Parece ser uma data, não um nome. Verifique se os campos não estão trocados.`);
        }
      }
    }
    
    // 🔴 CORREÇÃO DEFINITIVA: Usar UPDATE direto ao invés de UPSERT
    // O registro sempre deve existir (é criado automaticamente no primeiro login)
    // UPDATE é mais simples, direto e confiável
    // Reconstruir updateFields com placeholders corretos ($1, $2, $3, ...)
    const updateFieldsWithPlaceholders: string[] = [];
    const updateValues: any[] = [];
    let paramIdx = 1;
    
    // 🔴 CORREÇÃO: Manter mapeamento dos valores para uso no fallback INSERT
    const valueMap: { fullName?: string | null; avatarUrl?: string | null; birthdate?: string | null; metadata?: string } = {};
    
    // Reconstruir campos com placeholders sequenciais ($1, $2, $3...)
    for (let i = 0; i < updateFields.length; i++) {
      const field = updateFields[i];
      // Timestamp server-side: sem placeholder
      if (field.includes('now()')) {
        updateFieldsWithPlaceholders.push(field.trim());
        continue;
      }
      const fieldName = field.split('=')[0].trim();
      const fieldValue = values[i];
      
      // Mapear valores para uso no fallback INSERT
      if (fieldName === 'full_name') valueMap.fullName = fieldValue;
      else if (fieldName === 'avatar_url') valueMap.avatarUrl = fieldValue;
      else if (fieldName === 'birthdate') valueMap.birthdate = fieldValue;
      else if (fieldName === 'metadata') valueMap.metadata = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
      
      // Extrair CAST se existir (ex: "::DATE")
      const castMatch = field.match(/::(\w+)$/);
      const cast = castMatch ? `::${castMatch[1]}` : '';
      
      updateFieldsWithPlaceholders.push(`${fieldName} = $${paramIdx}${cast}`);
      updateValues.push(fieldValue);
      paramIdx++;
    }
    
    // Adicionar globalUserId no final para WHERE
    updateValues.push(globalUserId);
    
    // 🔴 INSTRUMENTAÇÃO DE TRANSAÇÃO: Logar txid antes do UPDATE
    const txidBefore = await pool.query<{ txid: string }>(
      `SELECT txid_current() as txid`
    );
    console.log('[IdentityService] 🔍 TXID ANTES UPDATE:', {
      globalUserId,
      txid: txidBefore.rows[0]?.txid,
      inTransaction: txidBefore.rows[0]?.txid !== '0',
    });
    
    // 🔴 CRÍTICO: Buscar ANTES do UPDATE para comparar
    // 🔴 CORREÇÃO: ORDER BY updatedAt DESC para garantir registro mais recente
    const beforeUpdate = await pool.query<GlobalUserRow>(
      `SELECT global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, gender, metadata FROM global_users WHERE global_user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [globalUserId]
    );
    console.log('[IdentityService] 🔍 ANTES UPDATE - Estado atual no banco:', {
      globalUserId,
      exists: beforeUpdate.rows.length > 0,
      currentFullName: beforeUpdate.rows[0]?.full_name,
      currentBirthdate: beforeUpdate.rows[0]?.birthdate,
      currentUpdatedAt: beforeUpdate.rows[0]?.updated_at,
    });
    
    const sqlQuery = `
      UPDATE global_users
      SET ${updateFieldsWithPlaceholders.join(', ')}
      WHERE global_user_id = $${updateValues.length}
      RETURNING global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, gender, metadata, txid_current() as txid
    `;
    
    console.log('[IdentityService] 🔍 DIAGNÓSTICO: Executando UPDATE', {
      globalUserId,
      sqlQuery: sqlQuery.replace(/\s+/g, ' ').trim(),
      updateFieldsWithPlaceholders,
      updateValues: updateValues.map((v, i) => ({ 
        index: i, 
        placeholder: `$${i + 1}`,
        valueCents: typeof v === 'string' && v.length > 50 ? v.substring(0, 50) + '...' : v,
        type: typeof v,
        isGlobalUserId: i === updateValues.length - 1 && v === globalUserId
      })),
      valuesCount: updateValues.length,
      whereParam: `$${updateValues.length}`,
      txidBefore: txidBefore.rows[0]?.txid,
    });

    const result = await pool.query<GlobalUserRow & { txid: string }>(sqlQuery, updateValues);
    
    // 🔴 INSTRUMENTAÇÃO: Logar txid após UPDATE
    const txidAfter = await pool.query<{ txid: string }>(
      `SELECT txid_current() as txid`
    );
    console.log('[IdentityService] 🔍 TXID DEPOIS UPDATE:', {
      globalUserId,
      txidBefore: txidBefore.rows[0]?.txid,
      txidAfter: txidAfter.rows[0]?.txid,
      txidInRow: result.rows[0] ? (result.rows[0] as any).txid : null,
      txidChanged: txidBefore.rows[0]?.txid !== txidAfter.rows[0]?.txid,
    });

    // 🔴 CRÍTICO: Verificar se o UPDATE realmente afetou linhas
    console.log('[IdentityService] 🔍 DIAGNÓSTICO: Resultado do UPDATE', {
      globalUserId,
      rowCount: result.rowCount,
      rowsAffected: result.rowCount,
      hasRows: result.rows.length > 0,
    });

    if (result.rowCount === 0) {
      console.error('[IdentityService] ❌ ERRO CRÍTICO: UPDATE não afetou nenhuma linha!', {
        globalUserId,
        updateFields,
        values,
      });
      
      // 🔴 REGRA: NÃO criar novo global_user se não existe
      // Lançar erro explícito para indicar problema de dessincronização
      throw new Error(`Global identity não encontrada para global_user_id: ${globalUserId}. Não é permitido criar novo registro via update.`);
    }

    if (!result.rows[0]) {
      console.error('[IdentityService] ❌ ERRO: UPDATE retornou 0 linhas no RETURNING');
      throw new Error('Global identity not found after update');
    }

    console.log('[IdentityService] ✅ UPDATE bem-sucedido', {
      globalUserId: result.rows[0].global_user_id,
      fullName: result.rows[0].full_name,
      birthdate: result.rows[0].birthdate,
      rowCount: result.rowCount,
      returnedData: result.rows[0],
    });
    
    // 🔴 DIAGNÓSTICO CRÍTICO: Verificar se os dados realmente foram salvos
    // IMPORTANTE: Fazer uma nova query para garantir que os dados estão realmente no banco
    // 🔴 CORREÇÃO: ORDER BY updatedAt DESC para garantir registro mais recente
    // 🔴 INSTRUMENTAÇÃO: Logar txid no GET após UPDATE
    const verifyResult = await pool.query<GlobalUserRow & { txid: string }>(
      `
        SELECT global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, gender, metadata, txid_current() as txid
        FROM global_users
        WHERE global_user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [globalUserId]
    );
    
    console.log('[IdentityService] 🔍 TXID NO GET APÓS UPDATE:', {
      globalUserId,
      txidBefore: txidBefore.rows[0]?.txid,
      txidAfter: txidAfter.rows[0]?.txid,
      txidInVerify: verifyResult.rows[0] ? (verifyResult.rows[0] as any).txid : null,
      txidConsistent: txidBefore.rows[0]?.txid === (verifyResult.rows[0] as any)?.txid || txidAfter.rows[0]?.txid === (verifyResult.rows[0] as any)?.txid,
    });
    
    if (!verifyResult.rows[0]) {
      console.error('[IdentityService] ❌ ERRO CRÍTICO: Dados NÃO encontrados após UPDATE!', {
        globalUserId,
        updateFields,
        updateValues: updateValues.slice(0, -1), // Excluir globalUserId do log
      });
      throw new Error(`Falha crítica: UPDATE executado mas dados não encontrados no banco para global_user_id: ${globalUserId}`);
    }
    
    const savedData = verifyResult.rows[0];
    console.log('[IdentityService] 🔍 DEPOIS UPDATE - Estado no banco após UPDATE:', {
      globalUserId: savedData.global_user_id,
      fullName: savedData.full_name,
      birthdate: savedData.birthdate,
      updatedAt:
        savedData.updated_at instanceof Date
          ? savedData.updated_at.toISOString()
          : String(savedData.updated_at),
      matches: savedData.global_user_id === globalUserId,
    });
    console.log('[IdentityService] 🔍 COMPARAÇÃO ANTES vs DEPOIS:', {
      beforeFullName: beforeUpdate.rows[0]?.full_name,
      afterFullName: savedData.full_name,
      beforeBirthdate: beforeUpdate.rows[0]?.birthdate,
      afterBirthdate: savedData.birthdate,
      beforeUpdatedAt: beforeUpdate.rows[0]?.updated_at,
      afterUpdatedAt: savedData.updated_at,
      changed: (
        beforeUpdate.rows[0]?.full_name !== savedData.full_name ||
        beforeUpdate.rows[0]?.birthdate?.toString() !== savedData.birthdate?.toString() ||
        beforeUpdate.rows[0]?.updated_at != null && savedData.updated_at != null && ((beforeUpdate.rows[0].updated_at as unknown) instanceof Date ? (beforeUpdate.rows[0].updated_at as unknown as Date).getTime() : new Date(beforeUpdate.rows[0].updated_at as unknown as string).getTime()) !== (typeof savedData.updated_at === 'string' ? new Date(savedData.updated_at).getTime() : (savedData.updated_at as unknown as Date).getTime())
      ),
    });
    
    // 🔴 VALIDAÇÃO FINAL: Comparar dados salvos com dados que tentamos salvar
    // Normalizar birthdate do updates para comparação
    let expectedBirthdate: string | null = null;
    const birthdateValue = updates.birthdate;
    if (birthdateValue !== null && birthdateValue !== undefined) {
      if (birthdateValue instanceof Date) {
        const year = birthdateValue.getUTCFullYear();
        const month = String(birthdateValue.getUTCMonth() + 1).padStart(2, '0');
        const day = String(birthdateValue.getUTCDate()).padStart(2, '0');
        expectedBirthdate = `${year}-${month}-${day}`;
      } else if (typeof birthdateValue === 'string') {
        expectedBirthdate = (birthdateValue as string).trim();
      }
    }
    
    const expectedValues = {
      fullName: updates.fullName ?? null,
      birthdate: expectedBirthdate,
    };
    
    // Normalizar birthdate salvo para comparação
    let actualBirthdate: string | null = null;
    if (savedData.birthdate) {
      if (typeof savedData.birthdate === 'string') {
        actualBirthdate = (savedData.birthdate as string).substring(0, 10); // YYYY-MM-DD
      } else if (savedData.birthdate instanceof Date) {
        actualBirthdate = savedData.birthdate.toISOString().substring(0, 10);
      }
    }
    
    const actualValues = {
      fullName: savedData.full_name,
      birthdate: actualBirthdate,
    };
    
    console.log('[IdentityService] 🔍 COMPARAÇÃO FINAL:', {
      expected: expectedValues,
      actual: actualValues,
      fullNameMatches: expectedValues.fullName === actualValues.fullName,
      birthdateMatches: expectedValues.birthdate === actualValues.birthdate,
      updatesOriginal: {
        fullName: updates.fullName,
        birthdate: updates.birthdate,
      },
    });
    
    if (expectedValues.fullName !== null && expectedValues.fullName !== actualValues.fullName) {
      console.error('[IdentityService] ❌ ERRO CRÍTICO: fullName não corresponde!', {
        expected: expectedValues.fullName,
        actual: actualValues.fullName,
        globalUserId,
      });
      throw new Error(`Falha crítica: fullName não foi salvo corretamente. Esperado: "${expectedValues.fullName}", Salvo: "${actualValues.fullName}"`);
    }
    
    if (expectedValues.birthdate !== null && expectedValues.birthdate !== actualValues.birthdate) {
      console.error('[IdentityService] ❌ ERRO CRÍTICO: birthdate não corresponde!', {
        expected: expectedValues.birthdate,
        actual: actualValues.birthdate,
        globalUserId,
      });
      throw new Error(`Falha crítica: birthdate não foi salvo corretamente. Esperado: "${expectedValues.birthdate}", Salvo: "${actualValues.birthdate}"`);
    }

    return this.toGlobalUser(savedData);
  }

  /**
   * Busca perfil completo (global + local) do usuário
   */
  async getIdentityProfile(
    userId: string,
    tenantId: string
  ): Promise<IdentityProfile> {
    // Buscar dados locais
    const localUser = await runQueryWithTenant<{
      id: string;
      tenant_id: string;
      email: string;
      created_at: Date;
      global_user_id: string | null;
    }>(
      tenantId,
      `
        SELECT id, tenant_id, email, created_at, global_user_id
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (!localUser) {
      throw new Error(`Usuário local não encontrado para id: ${userId} (tenant: ${tenantId})`);
    }

    // 🔴 GARANTIA CANÔNICA: users.global_user_id é a fonte única de verdade
    // user_identity_links NÃO existe mais no schema canônico
    if (!localUser.global_user_id) {
      throw new Error(`Global user não encontrado para user_id: ${userId} (tenant: ${tenantId}). users.global_user_id está vazio.`);
    }
    
    const resolvedGlobalUserId = localUser.global_user_id;
    
    // 🔴 DIAGNÓSTICO: Log do global_user_id encontrado
    console.log('[IdentityService] 🔍 getIdentityProfile: Buscando global user', {
      userId,
      tenantId,
      global_user_id_from_users: localUser.global_user_id,
      resolvedGlobalUserId,
    });
    
    // Buscar global user usando o global_user_id de users
    const globalUser = await this.getGlobalIdentity(resolvedGlobalUserId);
    
    console.log('[IdentityService] 🔍 getIdentityProfile: Resultado do getGlobalIdentity', {
      found: !!globalUser,
      globalUserId: resolvedGlobalUserId,
      fullName: globalUser.fullName,
      birthdate: globalUser.birthdate,
      birthdateType: globalUser.birthdate ? typeof globalUser.birthdate : null,
      birthdateString: globalUser.birthdate ? (globalUser.birthdate instanceof Date ? globalUser.birthdate.toISOString() : String(globalUser.birthdate)) : null,
    });

    // Buscar reputação se global_user_id disponível
    let reputation: IdentityProfile['reputation'] | undefined;
    if (globalUser.globalUserId) {
      try {
        const rep = await reputationService.getScoreByGlobalUserId(globalUser.globalUserId);
        if (rep) {
          reputation = {
            scores: rep.scores,
            summary: rep.summary,
          };
        }
      } catch (error) {
        // Silenciosamente ignora erros ao buscar reputação
      }
    }

    // Buscar wallet se global_user_id disponível
    let wallet: IdentityProfile['wallet'] | undefined;
    if (globalUser.globalUserId) {
      try {
        // Buscar todas as contas do global_user_id
        const { accountService } = await import('@core/economy/account.service');
        const accounts = await accountService.getAccountsByGlobalUserId(globalUser.globalUserId);
        
        if (accounts.length > 0) {
          // Usar conta primária (BRL) ou primeira disponível
          const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];
          
          // Buscar últimas transações
          const { transactionService } = await import('@core/economy/transaction.service');
          const transactions = await transactionService.getTransactionsByGlobalUserId(
            globalUser.globalUserId,
            { limit: 5 }
          );

          // Calcular totais
          let totalIn = 0;
          let totalOut = 0;
          const lastTransactions = transactions.slice(0, 5).map(tx => {
            const isCredit = primaryAccount && tx.toAccountId === primaryAccount.accountId;
            const amountCents = tx.amountCents;
            if (isCredit) {
              totalIn += amountCents;
            } else {
              totalOut += amountCents;
            }
            return {
              transactionId: tx.transactionId,
              type: isCredit ? 'credit' as const : 'debit' as const,
              amountCents,
              createdAt: tx.createdAt,
            };
          });

          wallet = {
            balanceCents: primaryAccount.balanceCents,
            currency: primaryAccount.currency,
            totalIn,
            totalOut,
            lastTransactions,
          };
        }
      } catch (error) {
        // Silenciosamente ignora erros ao buscar wallet
      }
    }

    // Buscar residência digital se global_user_id disponível
    let residence: IdentityProfile['residence'] | undefined;
    if (globalUser.globalUserId) {
      try {
        const res = await residenceService.getResidenceWithDetails(globalUser.globalUserId);
        if (res) {
          residence = {
            country: res.country,
            state: res.state,
            city: res.city,
            timezone: res.timezone,
            currency: res.currency,
            languages: res.languages,
          };
        } else {
          // Se não tem residência, criar automaticamente
          await residenceService.autoSetFromRootConfig(globalUser.globalUserId);
          const newRes = await residenceService.getResidenceWithDetails(globalUser.globalUserId);
          if (newRes) {
            residence = {
              country: newRes.country,
              state: newRes.state,
              city: newRes.city,
              timezone: newRes.timezone,
              currency: newRes.currency,
              languages: newRes.languages,
            };
          }
        }
      } catch (error) {
        // Silenciosamente ignora erros ao buscar residência
      }
    }

    return {
      global: globalUser,
      local: {
        userId: localUser.id,
        tenantId: localUser.tenant_id,
        email: localUser.email,
        createdAt: localUser.created_at instanceof Date ? localUser.created_at.toISOString() : String(localUser.created_at),
      },
      reputation,
      wallet,
      residence,
    };
  }
}

export const identityService = new IdentityService();


