"use strict";
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
exports.identityService = void 0;
// src/core/identity/identity.service.ts
const pool_1 = require("@core/database/pool");
const pool_2 = require("@core/database/pool");
const reputation_service_1 = require("@core/reputation/reputation.service");
const account_service_1 = require("@core/economy/accounts/account.service");
const transaction_service_1 = require("@core/economy/transactions/transaction.service");
const residence_service_1 = require("@core/residence/residence.service");
class IdentityService {
    toGlobalUser(row) {
        // 🔴 CRÍTICO: Garantir que birthdate seja tratado corretamente
        // PostgreSQL DATE retorna como string YYYY-MM-DD ou como Date
        // IMPORTANTE: Sempre criar Date usando UTC para evitar problemas de timezone
        let birthdate = null;
        if (row.birthdate) {
            if (typeof row.birthdate === 'string') {
                // PostgreSQL DATE retorna como string YYYY-MM-DD
                const dateMatch = row.birthdate.match(/^(\d{4})-(\d{2})-(\d{2})/);
                if (dateMatch) {
                    const year = parseInt(dateMatch[1], 10);
                    const month = parseInt(dateMatch[2], 10) - 1; // JavaScript months são 0-indexed
                    const day = parseInt(dateMatch[3], 10);
                    // 🔴 CRÍTICO: Usar Date.UTC para garantir que a data não mude de dia
                    birthdate = new Date(Date.UTC(year, month, day));
                }
                else {
                    // Se não for formato YYYY-MM-DD, tentar parsear como Date
                    const parsed = new Date(row.birthdate);
                    if (!isNaN(parsed.getTime())) {
                        // Extrair componentes UTC e recriar
                        birthdate = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
                    }
                }
            }
            else if (row.birthdate instanceof Date) {
                // Se já é Date, extrair componentes UTC e recriar (garante consistência)
                birthdate = new Date(Date.UTC(row.birthdate.getUTCFullYear(), row.birthdate.getUTCMonth(), row.birthdate.getUTCDate()));
            }
        }
        return {
            globalUserId: row.global_user_id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            fullName: row.full_name,
            avatarUrl: row.avatar_url,
            birthdate,
            metadata: row.metadata || {},
        };
    }
    toUserIdentityLink(row) {
        return {
            id: row.id,
            globalUserId: row.global_user_id,
            userId: row.user_id,
            tenantId: row.tenant_id,
            createdAt: row.created_at,
        };
    }
    /**
     * Cria uma identidade global para um usuário local
     * 🔴 REGRA: NUNCA cria novo global_user se já existir vínculo
     */
    async createGlobalIdentityForUser(userId, tenantId) {
        // 🔴 VERIFICAÇÃO CRÍTICA: Verificar se já existe link
        const existingLink = await pool_1.pool.query(`
        SELECT id, global_user_id, user_id, tenant_id, created_at
        FROM user_identity_links
        WHERE user_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
        LIMIT 1
      `, [userId, tenantId]);
        if (existingLink.rows.length > 0) {
            // 🔴 REGRA: Já existe link - NUNCA criar novo global_user
            // Buscar e retornar o global_user existente
            const existingGlobalUserId = existingLink.rows[0].global_user_id;
            console.log('[IdentityService] ⚠️ Link já existe, retornando global_user existente:', {
                userId,
                tenantId,
                globalUserId: existingGlobalUserId,
            });
            try {
                const globalUser = await this.getGlobalIdentity(existingGlobalUserId);
                return globalUser;
            }
            catch (error) {
                // Se global_user não existe mas link existe, há dessincronização
                console.error('[IdentityService] ❌ ERRO CRÍTICO: Link existe mas global_user não encontrado!', {
                    userId,
                    tenantId,
                    globalUserId: existingGlobalUserId,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw new Error(`Dessincronização detectada: link existe mas global_user não encontrado para global_user_id: ${existingGlobalUserId}`);
            }
        }
        // 🔴 REGRA: Só criar novo global_user se NÃO existe link
        console.log('[IdentityService] ✅ Nenhum link encontrado, criando novo global_user', {
            userId,
            tenantId,
        });
        // Criar novo global user
        const newGlobalUser = await pool_1.pool.query(`
        INSERT INTO global_users (full_name, avatar_url, birthdate, metadata)
        VALUES (NULL, NULL, NULL, '{}'::JSONB)
        RETURNING global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, metadata
      `);
        if (!newGlobalUser.rows[0]) {
            throw new Error('Failed to create global identity');
        }
        const globalUser = this.toGlobalUser(newGlobalUser.rows[0]);
        // Criar link (garante apenas 1 link por usuário)
        await this.linkLocalUserToGlobal(userId, globalUser.globalUserId, tenantId);
        // Atualizar users.global_user_id
        await (0, pool_2.runQueryWithTenant)(tenantId, `
        UPDATE users
        SET global_user_id = $1
        WHERE user_id = $2
      `, [globalUser.globalUserId, userId]);
        // Criar residência digital automaticamente a partir do root-config
        try {
            await residence_service_1.residenceService.autoSetFromRootConfig(globalUser.globalUserId);
        }
        catch (error) {
            // Log mas não falha a criação de identidade
            console.error('Erro ao criar residência digital:', error);
        }
        return globalUser;
    }
    /**
     * Busca identidade global por ID
     * 🔴 REGRA: NUNCA retorna null - sempre lança erro se não encontrado
     */
    async getGlobalIdentity(globalUserId) {
        console.log('[IdentityService] 🔍 getGlobalIdentity: Buscando no banco', { globalUserId });
        if (!globalUserId) {
            throw new Error('globalUserId é obrigatório');
        }
        // 🔴 DIAGNÓSTICO: Verificar quantos registros existem (não deveria ser > 1, mas vamos verificar)
        const countResult = await pool_1.pool.query(`SELECT COUNT(*) as count FROM global_users WHERE global_user_id = $1`, [globalUserId]);
        const recordCount = parseInt(countResult.rows[0]?.count || '0', 10);
        if (recordCount > 1) {
            console.error('[IdentityService] ❌ ERRO CRÍTICO: MÚLTIPLOS registros encontrados para global_user_id!', {
                globalUserId,
                count: recordCount,
            });
            throw new Error(`Múltiplos registros encontrados para global_user_id: ${globalUserId}. Execute DIAGNOSTICO_BIRTHDATE.sql para investigar.`);
        }
        // 🔴 CORREÇÃO: Buscar registro único (global_user_id é PRIMARY KEY)
        const result = await pool_1.pool.query(`
        SELECT global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, metadata
        FROM global_users
        WHERE global_user_id = $1
      `, [globalUserId]);
        if (!result.rows[0]) {
            console.error('[IdentityService] ❌ getGlobalIdentity: NÃO encontrado no banco', { globalUserId });
            throw new Error(`Global identity não encontrada para global_user_id: ${globalUserId}`);
        }
        console.log('[IdentityService] ✅ getGlobalIdentity: Encontrado no banco', {
            globalUserId: result.rows[0].global_user_id,
            fullName: result.rows[0].full_name,
            birthdate: result.rows[0].birthdate,
            updatedAt: result.rows[0].updated_at,
            recordCount,
        });
        return this.toGlobalUser(result.rows[0]);
    }
    /**
     * Atualiza identidade global
     */
    async updateGlobalIdentity(globalUserId, updates) {
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
        // Buscar userId e tenantId para verificar onboarding
        let canEditBirthdate = true;
        try {
            const linkResult = await pool_1.pool.query(`SELECT user_id, tenant_id FROM user_identity_links WHERE global_user_id = $1 LIMIT 1`, [globalUserId]);
            if (linkResult.rows.length > 0) {
                const { user_id, tenant_id } = linkResult.rows[0];
                const { profileService } = await Promise.resolve().then(() => __importStar(require('@core/profile/profile.service')));
                canEditBirthdate = await profileService.canEditPersonalData(tenant_id, user_id);
            }
        }
        catch (err) {
            // Se não conseguir verificar, assumir que não pode editar (mais seguro)
            canEditBirthdate = false;
        }
        // 🔴 CORREÇÃO CRÍTICA: Só bloquear alteração se birthdate JÁ FOI PREENCHIDO (não é null/undefined)
        // REGRA: Permitir salvar birthdate pela primeira vez, mesmo após onboarding, se ainda for null
        const birthdateAlreadyExists = existingGlobalUser?.birthdate !== null && existingGlobalUser?.birthdate !== undefined;
        if (birthdateAlreadyExists && updates.birthdate !== undefined && updates.birthdate !== null && !canEditBirthdate) {
            console.log('[IdentityService] 🔒 Ignorando tentativa de alteração de birthdate (dado imutável após onboarding):', {
                existing: existingGlobalUser.birthdate,
                attempted: updates.birthdate,
                canEdit: canEditBirthdate,
            });
            // Remover birthdate dos updates
            delete updates.birthdate;
        }
        else if (!birthdateAlreadyExists && updates.birthdate !== undefined && updates.birthdate !== null) {
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
        }
        else if (existingGlobalUser?.fullName && existingGlobalUser.fullName.trim().length > 0 && updates.fullName) {
            console.log('[IdentityService] 🔒 Ignorando tentativa de alteração de fullName (dado imutável):', {
                existing: existingGlobalUser.fullName,
                attempted: updates.fullName,
            });
            // Remover fullName dos updates
            delete updates.fullName;
        }
        // 🔴 CORREÇÃO CRÍTICA: Construir arrays de forma ordenada para garantir correspondência correta
        const updateFields = [];
        const values = [];
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
                value: updates.fullName,
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
                let dateStr;
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
                    const { normalizeBirthdate } = await Promise.resolve().then(() => __importStar(require('@utils/dateNormalizer')));
                    try {
                        // Normaliza DD/MM/YYYY ou YYYY-MM-DD para YYYY-MM-DD
                        dateStr = normalizeBirthdate(birthdateValue);
                        console.log('[IdentityService] ✅ birthdate normalizado:', {
                            original: birthdateValue,
                            normalized: dateStr,
                        });
                    }
                    catch (normalizeError) {
                        console.error('[IdentityService] ❌ Erro ao normalizar birthdate:', normalizeError);
                        throw normalizeError; // Re-lançar erro com statusCode
                    }
                }
                else {
                    console.error('[IdentityService] ❌ ERRO: Tipo de birthdate inválido:', typeof birthdateValue, birthdateValue);
                    const error = new Error(`Tipo de birthdate inválido: ${typeof birthdateValue}`);
                    error.statusCode = 400;
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
            }
            else {
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
        for (let i = 0; i < updateFields.length - 1; i++) { // -1 para excluir updated_at
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
        const updateFieldsWithPlaceholders = [];
        const updateValues = [];
        let paramIdx = 1;
        // 🔴 CORREÇÃO: Manter mapeamento dos valores para uso no fallback INSERT
        const valueMap = {};
        // Reconstruir campos com placeholders sequenciais ($1, $2, $3...)
        for (let i = 0; i < updateFields.length; i++) {
            const field = updateFields[i];
            const fieldName = field.split('=')[0].trim();
            const fieldValue = values[i];
            // Mapear valores para uso no fallback INSERT
            if (fieldName === 'full_name')
                valueMap.fullName = fieldValue;
            else if (fieldName === 'avatar_url')
                valueMap.avatarUrl = fieldValue;
            else if (fieldName === 'birthdate')
                valueMap.birthdate = fieldValue;
            else if (fieldName === 'metadata')
                valueMap.metadata = typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue);
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
        const txidBefore = await pool_1.pool.query(`SELECT txid_current() as txid`);
        console.log('[IdentityService] 🔍 TXID ANTES UPDATE:', {
            globalUserId,
            txid: txidBefore.rows[0]?.txid,
            inTransaction: txidBefore.rows[0]?.txid !== '0',
        });
        // 🔴 CRÍTICO: Buscar ANTES do UPDATE para comparar
        // 🔴 CORREÇÃO: ORDER BY updated_at DESC para garantir registro mais recente
        const beforeUpdate = await pool_1.pool.query(`SELECT global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, metadata FROM global_users WHERE global_user_id = $1 ORDER BY updated_at DESC LIMIT 1`, [globalUserId]);
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
      RETURNING global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, metadata, txid_current() as txid
    `;
        console.log('[IdentityService] 🔍 DIAGNÓSTICO: Executando UPDATE', {
            globalUserId,
            sqlQuery: sqlQuery.replace(/\s+/g, ' ').trim(),
            updateFieldsWithPlaceholders,
            updateValues: updateValues.map((v, i) => ({
                index: i,
                placeholder: `$${i + 1}`,
                value: typeof v === 'string' && v.length > 50 ? v.substring(0, 50) + '...' : v,
                type: typeof v,
                isGlobalUserId: i === updateValues.length - 1 && v === globalUserId
            })),
            valuesCount: updateValues.length,
            whereParam: `$${updateValues.length}`,
            txidBefore: txidBefore.rows[0]?.txid,
        });
        const result = await pool_1.pool.query(sqlQuery, updateValues);
        // 🔴 INSTRUMENTAÇÃO: Logar txid após UPDATE
        const txidAfter = await pool_1.pool.query(`SELECT txid_current() as txid`);
        console.log('[IdentityService] 🔍 TXID DEPOIS UPDATE:', {
            globalUserId,
            txidBefore: txidBefore.rows[0]?.txid,
            txidAfter: txidAfter.rows[0]?.txid,
            txidInRow: result.rows[0] ? result.rows[0].txid : null,
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
        // 🔴 CORREÇÃO: ORDER BY updated_at DESC para garantir registro mais recente
        // 🔴 INSTRUMENTAÇÃO: Logar txid no GET após UPDATE
        const verifyResult = await pool_1.pool.query(`
        SELECT global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, metadata, txid_current() as txid
        FROM global_users
        WHERE global_user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `, [globalUserId]);
        console.log('[IdentityService] 🔍 TXID NO GET APÓS UPDATE:', {
            globalUserId,
            txidBefore: txidBefore.rows[0]?.txid,
            txidAfter: txidAfter.rows[0]?.txid,
            txidInVerify: verifyResult.rows[0] ? verifyResult.rows[0].txid : null,
            txidConsistent: txidBefore.rows[0]?.txid === verifyResult.rows[0]?.txid || txidAfter.rows[0]?.txid === verifyResult.rows[0]?.txid,
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
            updatedAt: savedData.updated_at,
            matches: savedData.global_user_id === globalUserId,
        });
        console.log('[IdentityService] 🔍 COMPARAÇÃO ANTES vs DEPOIS:', {
            beforeFullName: beforeUpdate.rows[0]?.full_name,
            afterFullName: savedData.full_name,
            beforeBirthdate: beforeUpdate.rows[0]?.birthdate,
            afterBirthdate: savedData.birthdate,
            beforeUpdatedAt: beforeUpdate.rows[0]?.updated_at,
            afterUpdatedAt: savedData.updated_at,
            changed: (beforeUpdate.rows[0]?.full_name !== savedData.full_name ||
                beforeUpdate.rows[0]?.birthdate?.toString() !== savedData.birthdate?.toString() ||
                beforeUpdate.rows[0]?.updated_at?.getTime() !== savedData.updated_at?.getTime()),
        });
        // 🔴 VALIDAÇÃO FINAL: Comparar dados salvos com dados que tentamos salvar
        // Normalizar birthdate do updates para comparação
        let expectedBirthdate = null;
        const birthdateValue = updates.birthdate;
        if (birthdateValue !== null && birthdateValue !== undefined) {
            if (birthdateValue instanceof Date) {
                const year = birthdateValue.getUTCFullYear();
                const month = String(birthdateValue.getUTCMonth() + 1).padStart(2, '0');
                const day = String(birthdateValue.getUTCDate()).padStart(2, '0');
                expectedBirthdate = `${year}-${month}-${day}`;
            }
            else if (typeof birthdateValue === 'string') {
                expectedBirthdate = birthdateValue.trim();
            }
        }
        const expectedValues = {
            fullName: updates.fullName ?? null,
            birthdate: expectedBirthdate,
        };
        // Normalizar birthdate salvo para comparação
        let actualBirthdate = null;
        if (savedData.birthdate) {
            if (typeof savedData.birthdate === 'string') {
                actualBirthdate = savedData.birthdate.substring(0, 10); // YYYY-MM-DD
            }
            else if (savedData.birthdate instanceof Date) {
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
     * Liga um usuário local a uma identidade global
     * 🔴 REGRA: Garantir que exista APENAS 1 user_identity_link por usuário
     */
    async linkLocalUserToGlobal(userId, globalUserId, tenantId) {
        // 🔴 VERIFICAÇÃO: Verificar se já existe link
        const existing = await pool_1.pool.query(`
        SELECT id, global_user_id, user_id, tenant_id, created_at
        FROM user_identity_links
        WHERE user_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
      `, [userId, tenantId]);
        if (existing.rows.length > 0) {
            // 🔴 REGRA: Se já existe link, verificar se é o mesmo global_user_id
            const existingGlobalUserId = existing.rows[0].global_user_id;
            if (existingGlobalUserId === globalUserId) {
                // Mesmo global_user_id - retornar link existente
                console.log('[IdentityService] ✅ Link já existe com mesmo global_user_id', {
                    userId,
                    tenantId,
                    globalUserId,
                });
                return this.toUserIdentityLink(existing.rows[0]);
            }
            else {
                // 🔴 ERRO: Tentativa de vincular a global_user diferente
                console.error('[IdentityService] ❌ ERRO: Tentativa de vincular a global_user diferente!', {
                    userId,
                    tenantId,
                    existingGlobalUserId,
                    attemptedGlobalUserId: globalUserId,
                });
                throw new Error(`Usuário já está vinculado a outro global_user_id: ${existingGlobalUserId}. Não é permitido alterar o vínculo.`);
            }
        }
        // 🔴 REGRA: Criar novo link apenas se não existe nenhum
        console.log('[IdentityService] ✅ Criando novo link', {
            userId,
            tenantId,
            globalUserId,
        });
        const result = await pool_1.pool.query(`
        INSERT INTO user_identity_links (global_user_id, user_id, tenant_id)
        VALUES ($1, $2, $3)
        RETURNING id, global_user_id, user_id, tenant_id, created_at
      `, [globalUserId, userId, tenantId]);
        if (!result.rows[0]) {
            throw new Error('Failed to create user identity link');
        }
        return this.toUserIdentityLink(result.rows[0]);
    }
    /**
     * Busca perfil completo (global + local) do usuário
     * 🔴 REGRA: Usa EXATAMENTE o mesmo método de resolução que updateGlobalIdentity
     * Garante que ambos usem o mesmo global_user_id
     */
    async getIdentityProfile(userId, tenantId) {
        // Buscar dados locais
        const localUser = await (0, pool_2.runQueryWithTenant)(tenantId, `
        SELECT user_id, tenant_id, email, created_at, global_user_id, plan, is_test
        FROM users
        WHERE user_id = $1
        LIMIT 1
      `, [userId]);
        if (!localUser) {
            throw new Error(`Usuário local não encontrado para user_id: ${userId} (tenant: ${tenantId})`);
        }
        // 🔴 REGRA CRÍTICA: Usar EXATAMENTE o mesmo método de resolução que updateGlobalIdentity
        // Isso garante que ambos usem o mesmo global_user_id
        const { resolveGlobalUserId } = await Promise.resolve().then(() => __importStar(require('@core/identity/identity.utils')));
        let resolvedGlobalUserId;
        try {
            resolvedGlobalUserId = await resolveGlobalUserId(userId, tenantId);
        }
        catch (error) {
            console.error('[IdentityService] ❌ ERRO CRÍTICO: Global user não encontrado para user_id', userId, {
                tenantId,
                error: error instanceof Error ? error.message : String(error),
                message: 'Não foi possível resolver global_user_id. Possível dessincronização ou múltiplos global_users.',
                hint: 'Execute DIAGNOSTICO_MULTIPLOS_GLOBAL_USERS.sql para investigar',
            });
            throw error;
        }
        // 🔴 VERIFICAÇÃO CRÍTICA: Detectar múltiplos global_users para o mesmo usuário
        const allLinksResult = await pool_1.pool.query(`
        SELECT global_user_id, created_at
        FROM user_identity_links
        WHERE user_id = $1 AND tenant_id = $2
        ORDER BY created_at DESC
      `, [userId, tenantId]);
        if (allLinksResult.rows.length > 1) {
            console.error('[IdentityService] ❌ ERRO CRÍTICO: MÚLTIPLOS global_users encontrados!', {
                userId,
                tenantId,
                count: allLinksResult.rows.length,
                globalUserIds: allLinksResult.rows.map(r => r.global_user_id),
                resolvedGlobalUserId,
                message: 'Este usuário tem múltiplos registros em user_identity_links!',
                hint: 'Execute DIAGNOSTICO_MULTIPLOS_GLOBAL_USERS.sql para investigar',
            });
            throw new Error(`Múltiplos global_users encontrados para user_id: ${userId} (tenant: ${tenantId}). Execute diagnóstico SQL para investigar.`);
        }
        // 🔴 VERIFICAÇÃO: Detectar dessincronização entre users.global_user_id e user_identity_links
        if (localUser.global_user_id && allLinksResult.rows.length > 0) {
            const linkGlobalUserId = allLinksResult.rows[0].global_user_id;
            if (localUser.global_user_id !== linkGlobalUserId || resolvedGlobalUserId !== linkGlobalUserId) {
                console.error('[IdentityService] ❌ DESSINCRONIZAÇÃO DETECTADA!', {
                    userId,
                    tenantId,
                    globalUserIdInUsers: localUser.global_user_id,
                    globalUserIdInLinks: linkGlobalUserId,
                    resolvedGlobalUserId,
                    message: 'users.global_user_id diferente de user_identity_links.global_user_id!',
                    hint: 'Execute DIAGNOSTICO_MULTIPLOS_GLOBAL_USERS.sql para investigar',
                });
                throw new Error(`Dessincronização detectada: users.global_user_id (${localUser.global_user_id}) diferente de user_identity_links.global_user_id (${linkGlobalUserId}) para user_id: ${userId}`);
            }
        }
        // 🔴 DIAGNÓSTICO: Log do global_user_id encontrado
        console.log('[IdentityService] 🔍 getIdentityProfile: Buscando global user', {
            userId,
            tenantId,
            global_user_id_from_users: localUser.global_user_id,
            resolvedGlobalUserId,
        });
        // Buscar global user usando o global_user_id resolvido
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
        let reputation;
        if (globalUser.globalUserId) {
            try {
                const rep = await reputation_service_1.reputationService.getScoreByGlobalUserId(globalUser.globalUserId);
                if (rep) {
                    reputation = {
                        scores: rep.scores,
                        summary: rep.summary,
                    };
                }
            }
            catch (error) {
                // Silenciosamente ignora erros ao buscar reputação
            }
        }
        // Buscar wallet se global_user_id disponível
        let wallet;
        if (globalUser.globalUserId) {
            try {
                // Buscar todas as contas do global_user_id
                const accounts = await account_service_1.accountService.getAccountsByGlobalUserId(globalUser.globalUserId);
                if (accounts.length > 0) {
                    // Usar conta primária (BRL) ou primeira disponível
                    const primaryAccount = accounts.find(acc => acc.currency === 'BRL') || accounts[0];
                    // Buscar últimas transações
                    const transactions = await transaction_service_1.transactionService.getTransactionsByGlobalUserId(globalUser.globalUserId, { limit: 5 });
                    // Calcular totais
                    let totalIn = 0;
                    let totalOut = 0;
                    const lastTransactions = transactions.slice(0, 5).map(tx => {
                        const isCredit = tx.toGlobalUserId === globalUser.globalUserId;
                        const amount = tx.amount;
                        if (isCredit) {
                            totalIn += amount;
                        }
                        else {
                            totalOut += amount;
                        }
                        return {
                            transactionId: tx.transactionId,
                            type: isCredit ? 'credit' : 'debit',
                            amount,
                            createdAt: tx.createdAt,
                        };
                    });
                    wallet = {
                        balance: primaryAccount.balance,
                        currency: primaryAccount.currency,
                        totalIn,
                        totalOut,
                        lastTransactions,
                    };
                }
            }
            catch (error) {
                // Silenciosamente ignora erros ao buscar wallet
            }
        }
        // Buscar residência digital se global_user_id disponível
        let residence;
        if (globalUser.globalUserId) {
            try {
                const res = await residence_service_1.residenceService.getResidenceWithDetails(globalUser.globalUserId);
                if (res) {
                    residence = {
                        country: res.country,
                        state: res.state,
                        city: res.city,
                        timezone: res.timezone,
                        currency: res.currency,
                        languages: res.languages,
                    };
                }
                else {
                    // Se não tem residência, criar automaticamente
                    await residence_service_1.residenceService.autoSetFromRootConfig(globalUser.globalUserId);
                    const newRes = await residence_service_1.residenceService.getResidenceWithDetails(globalUser.globalUserId);
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
            }
            catch (error) {
                // Silenciosamente ignora erros ao buscar residência
            }
        }
        return {
            global: globalUser,
            local: {
                userId: localUser.user_id,
                tenantId: localUser.tenant_id,
                email: localUser.email,
                createdAt: localUser.created_at,
                plan: localUser.plan || 'free',
                isTest: localUser.is_test || false,
            },
            reputation,
            wallet,
            residence,
        };
    }
}
exports.identityService = new IdentityService();
