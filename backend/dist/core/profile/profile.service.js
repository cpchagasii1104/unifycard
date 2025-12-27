"use strict";
// src/core/profile/profile.service.ts
// Serviço de perfil de usuário - READ-ONLY para visualização, permite atualização básica
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileService = void 0;
const pool_1 = require("@core/database/pool");
/**
 * Faz merge profundo de objetos, preservando propriedades aninhadas
 * Exemplo: deepMerge({ a: { b: 1, c: 2 } }, { a: { b: 3 } }) => { a: { b: 3, c: 2 } }
 */
function deepMerge(target, source) {
    if (!source || typeof source !== 'object') {
        return target;
    }
    const result = { ...target };
    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            const sourceValue = source[key];
            const targetValue = result[key];
            // Se ambos são objetos e não são arrays, fazer merge recursivo
            if (sourceValue &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue) &&
                targetValue &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue)) {
                result[key] = deepMerge(targetValue, sourceValue);
            }
            else {
                // Caso contrário, sobrescrever (inclui null, undefined, arrays, primitivos)
                result[key] = sourceValue;
            }
        }
    }
    return result;
}
class ProfileService {
    toProfile(row) {
        return {
            profileId: row.profile_id,
            tenantId: row.tenant_id,
            userId: row.user_id,
            fullName: row.full_name,
            phone: row.phone,
            metadata: row.metadata || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    /**
     * Busca perfil de um usuário
     */
    async getProfile(tenantId, userId) {
        // 🔴 INSTRUMENTAÇÃO DE TRANSAÇÃO: Logar txid no GET
        const txidInGet = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT txid_current() as txid`);
        // 🔴 DIAGNÓSTICO: Verificar quantos registros existem (com tenant_id para garantir unicidade)
        const countResult = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT COUNT(*) as count FROM profiles WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
        const recordCount = parseInt(countResult?.count || '0', 10);
        if (recordCount > 1) {
            console.warn('[ProfileService] ⚠️ MÚLTIPLOS registros encontrados para tenant_id + user_id:', {
                userId,
                tenantId,
                count: recordCount,
            });
        }
        // 🔴 CORREÇÃO CRÍTICA: WHERE tenant_id = $1 AND user_id = $2 + ORDER BY updated_at DESC
        // IMPORTANTE: Sempre incluir tenant_id no WHERE para garantir isolamento multi-tenant
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT profile_id, tenant_id, user_id, full_name, phone, metadata, created_at, updated_at, txid_current() as txid
        FROM profiles
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
      `, [tenantId, userId]);
        console.log('[ProfileService] 🔍 TXID NO GET:', {
            tenantId,
            userId,
            txid: txidInGet?.txid,
            txidInRow: row ? row.txid : null,
        });
        if (!row) {
            console.log('[ProfileService] ⚠️ getProfile: Nenhum registro encontrado', { userId, tenantId });
            return null;
        }
        console.log('[ProfileService] ✅ getProfile: Registro retornado', {
            tenantId,
            userId,
            profileId: row.profile_id,
            updatedAt: row.updated_at,
            recordCount,
        });
        return this.toProfile(row);
    }
    /**
     * Cria perfil se não existir (READ-ONLY para GET)
     * NUNCA sobrescreve dados existentes
     */
    async createProfileIfNotExists(tenantId, userId) {
        // 🔴 LOG TEMPORÁRIO: Stack trace para identificar caller
        const stackTrace = new Error().stack;
        console.log('[ProfileService] 🔍 createProfileIfNotExists chamado:', {
            tenantId,
            userId,
            caller: stackTrace?.split('\n')[2]?.trim() || 'unknown',
            fullStack: stackTrace,
        });
        // Usar INSERT ... ON CONFLICT DO NOTHING para NUNCA sobrescrever
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata)
        VALUES ($1, $2, NULL, NULL, '{}'::JSONB)
        ON CONFLICT (tenant_id, user_id) DO NOTHING
        RETURNING profile_id, tenant_id, user_id, full_name, phone, metadata, created_at, updated_at
      `, [tenantId, userId]);
        // Se INSERT não criou (porque já existe), buscar o existente
        if (!row) {
            const existing = await this.getProfile(tenantId, userId);
            if (existing) {
                console.log('[ProfileService] ✅ Profile já existia, retornando existente');
                return existing;
            }
            throw new Error('Failed to create profile and profile not found');
        }
        console.log('[ProfileService] ✅ Profile criado vazio (não existia antes)');
        return this.toProfile(row);
    }
    /**
     * Cria ou atualiza perfil de um usuário
     * ⚠️ SÓ DEVE SER CHAMADO DE ENDPOINTS EXPLÍCITOS DE UPDATE
     */
    async upsertProfile(tenantId, userId, input) {
        // 🔴 LOG TEMPORÁRIO: Stack trace para identificar caller
        const stackTrace = new Error().stack;
        console.log('[ProfileService] 🔍 upsertProfile chamado:', {
            tenantId,
            userId,
            inputKeys: Object.keys(input),
            hasMetadata: !!input.metadata,
            caller: stackTrace?.split('\n')[2]?.trim() || 'unknown',
            fullStack: stackTrace,
        });
        // 🔴 CRÍTICO: Buscar metadata existente antes do UPDATE para fazer merge
        const existingProfile = await this.getProfile(tenantId, userId);
        const existingMetadata = existingProfile?.metadata || {};
        // 🔴 CORREÇÃO CRÍTICA: Fazer MERGE PROFUNDO do metadata existente com o novo
        // IMPORTANTE: Não substituir completamente - preservar campos existentes e mesclar objetos aninhados
        const mergedMetadata = input.metadata
            ? deepMerge(existingMetadata, input.metadata)
            : existingMetadata;
        console.log('[ProfileService] 🔍 ANTES UPDATE - Metadata existente:', {
            tenantId,
            userId,
            existingMetadata,
            inputMetadata: input.metadata,
        });
        console.log('[ProfileService] 🔍 DEPOIS MERGE - Metadata mesclado:', {
            tenantId,
            userId,
            mergedMetadata,
        });
        // 🔴 INSTRUMENTAÇÃO DE TRANSAÇÃO: Logar txid antes e depois do UPDATE
        const txidBefore = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT txid_current() as txid`);
        console.log('[ProfileService] 🔍 TXID ANTES UPDATE:', {
            tenantId,
            userId,
            txid: txidBefore?.txid,
            inTransaction: txidBefore?.txid !== '0',
        });
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
        INSERT INTO profiles (tenant_id, user_id, full_name, phone, metadata)
        VALUES ($1, $2, $3, $4, $5::JSONB)
        ON CONFLICT (tenant_id, user_id)
        DO UPDATE SET
          full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
          phone = COALESCE(EXCLUDED.phone, profiles.phone),
          metadata = $5::JSONB,
          updated_at = now()
        RETURNING profile_id, tenant_id, user_id, full_name, phone, metadata, created_at, updated_at, txid_current() as txid
      `, [
            tenantId,
            userId,
            input.fullName || null,
            input.phone || null,
            JSON.stringify(mergedMetadata),
        ]);
        // 🔴 INSTRUMENTAÇÃO: Logar txid após UPDATE
        const txidAfter = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT txid_current() as txid`);
        console.log('[ProfileService] 🔍 TXID DEPOIS UPDATE:', {
            tenantId,
            userId,
            txidBefore: txidBefore?.txid,
            txidAfter: txidAfter?.txid,
            txidInRow: row?.txid,
            txidChanged: txidBefore?.txid !== txidAfter?.txid,
        });
        if (!row) {
            throw new Error('Failed to create or update profile');
        }
        console.log('[ProfileService] ✅ DEPOIS UPDATE - Registro retornado do banco:', {
            tenantId,
            userId,
            returnedMetadata: row.metadata,
            returnedFullName: row.full_name,
            returnedPhone: row.phone,
        });
        // 🔴 CRÍTICO: Verificar se os dados foram realmente salvos fazendo um SELECT direto
        // 🔴 CORREÇÃO: ORDER BY updated_at DESC para garantir registro mais recente
        // 🔴 INSTRUMENTAÇÃO: Logar txid no GET seguinte
        const verifyRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT profile_id, tenant_id, user_id, full_name, phone, metadata, created_at, updated_at, txid_current() as txid
        FROM profiles
        WHERE tenant_id = $1 AND user_id = $2
        ORDER BY updated_at DESC
        LIMIT 1
      `, [tenantId, userId]);
        // 🔴 INSTRUMENTAÇÃO: Logar txid no GET após UPDATE
        console.log('[ProfileService] 🔍 TXID NO GET APÓS UPDATE:', {
            tenantId,
            userId,
            txidBefore: txidBefore?.txid,
            txidAfter: txidAfter?.txid,
            txidInVerify: verifyRow ? verifyRow.txid : null,
            txidConsistent: txidBefore?.txid === verifyRow?.txid || txidAfter?.txid === verifyRow?.txid,
        });
        if (verifyRow) {
            // 🔴 LOG TEMPORÁRIO: Comparar metadata final salvo com o esperado
            const metadataMatches = JSON.stringify(verifyRow.metadata) === JSON.stringify(mergedMetadata);
            console.log('[ProfileService] 🔍 VERIFICAÇÃO APÓS UPDATE - Dados realmente no banco:', {
                tenantId,
                userId,
                verifiedMetadata: verifyRow.metadata,
                verifiedFullName: verifyRow.full_name,
                verifiedPhone: verifyRow.phone,
                metadataMatches,
                mergedMetadataExpected: mergedMetadata,
                verifiedMetadataActual: verifyRow.metadata,
            });
            if (!metadataMatches) {
                console.warn('[ProfileService] ⚠️ ATENÇÃO: Metadata salvo difere do esperado após merge!', {
                    tenantId,
                    userId,
                    expected: mergedMetadata,
                    actual: verifyRow.metadata,
                });
            }
        }
        else {
            console.error('[ProfileService] ❌ ERRO CRÍTICO: Dados NÃO encontrados após UPDATE!', {
                tenantId,
                userId,
            });
        }
        return this.toProfile(row);
    }
}
exports.profileService = new ProfileService();
//# sourceMappingURL=profile.service.js.map