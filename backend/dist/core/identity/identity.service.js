"use strict";
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
     */
    async createGlobalIdentityForUser(userId, tenantId) {
        // Verificar se já existe link
        const existingLink = await pool_1.pool.query(`
        SELECT id, global_user_id, user_id, tenant_id, created_at
        FROM user_identity_links
        WHERE user_id = $1 AND tenant_id = $2
        LIMIT 1
      `, [userId, tenantId]);
        if (existingLink.rows.length > 0) {
            // Já existe link, buscar global user
            const globalUser = await this.getGlobalIdentity(existingLink.rows[0].global_user_id);
            if (globalUser) {
                return globalUser;
            }
        }
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
        // Criar link
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
     */
    async getGlobalIdentity(globalUserId) {
        console.log('[IdentityService] 🔍 getGlobalIdentity: Buscando no banco', { globalUserId });
        // 🔴 DIAGNÓSTICO: Verificar quantos registros existem (não deveria ser > 1, mas vamos verificar)
        const countResult = await pool_1.pool.query(`SELECT COUNT(*) as count FROM global_users WHERE global_user_id = $1`, [globalUserId]);
        const recordCount = parseInt(countResult.rows[0]?.count || '0', 10);
        if (recordCount > 1) {
            console.error('[IdentityService] ❌ ERRO CRÍTICO: MÚLTIPLOS registros encontrados para global_user_id!', {
                globalUserId,
                count: recordCount,
            });
        }
        // 🔴 CORREÇÃO CRÍTICA: ORDER BY updated_at DESC para garantir registro mais recente
        // NOTA: global_user_id é PRIMARY KEY, então não deveria ter múltiplos registros,
        // mas adicionamos ORDER BY como garantia de que sempre retornamos o mais recente
        const result = await pool_1.pool.query(`
        SELECT global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, metadata
        FROM global_users
        WHERE global_user_id = $1
        ORDER BY updated_at DESC
        LIMIT 1
      `, [globalUserId]);
        if (!result.rows[0]) {
            console.log('[IdentityService] ⚠️ getGlobalIdentity: NÃO encontrado no banco', { globalUserId });
            return null;
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
            if (updates.birthdate !== null && updates.birthdate !== undefined && updates.birthdate !== '') {
                let dateStr;
                // 🔴 PASSO 1: Se for Date, normalizar direto para YYYY-MM-DD (ANTES de validar letras)
                if (updates.birthdate instanceof Date) {
                    // Se for Date, extrair componentes UTC e formatar como YYYY-MM-DD
                    const year = updates.birthdate.getUTCFullYear();
                    const month = String(updates.birthdate.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(updates.birthdate.getUTCDate()).padStart(2, '0');
                    dateStr = `${year}-${month}-${day}`;
                    console.log('[IdentityService] ✅ birthdate Date normalizado para:', dateStr);
                }
                // 🔴 PASSO 2: Se for string, validar e usar
                else if (typeof updates.birthdate === 'string') {
                    const birthdateStr = updates.birthdate.trim();
                    // 🔴 VALIDAÇÃO CRÍTICA 1: Se contém letras, é definitivamente um nome (ERRO)
                    // IMPORTANTE: Esta validação só roda DEPOIS de normalizar Date
                    if (birthdateStr.match(/[a-zA-Z]/)) {
                        console.error('[IdentityService] ❌ ERRO CRÍTICO: birthdate contém letras (parece ser um nome):', {
                            birthdate: updates.birthdate,
                            fullName: updates.fullName,
                            allUpdates: Object.keys(updates),
                        });
                        throw new Error(`Valor inválido para birthdate: "${updates.birthdate}". O campo data de nascimento não pode conter letras. Parece ser um nome. Verifique se os campos não estão trocados.`);
                    }
                    // 🔴 VALIDAÇÃO CRÍTICA 2: Formato YYYY-MM-DD obrigatório
                    const dateMatch = birthdateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (!dateMatch) {
                        console.error('[IdentityService] ❌ ERRO: Formato de data inválido:', {
                            birthdate: updates.birthdate,
                            format: 'Esperado: YYYY-MM-DD',
                        });
                        throw new Error(`Formato de data inválido: "${updates.birthdate}". Use o formato YYYY-MM-DD (ex: 1990-01-15).`);
                    }
                    dateStr = birthdateStr;
                }
                else {
                    console.error('[IdentityService] ❌ ERRO: Tipo de birthdate inválido:', typeof updates.birthdate, updates.birthdate);
                    throw new Error(`Tipo de birthdate inválido: ${typeof updates.birthdate}`);
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
            // Se o registro não existe, criar usando os valores do update
            console.log('[IdentityService] ⚠️ Registro não existe, criando novo...', {
                globalUserId,
                valueMap,
            });
            const newGlobalUser = await pool_1.pool.query(`
          INSERT INTO global_users (global_user_id, full_name, avatar_url, birthdate, metadata, created_at, updated_at)
          VALUES ($1, $2, $3, $4::DATE, $5, now(), now())
          RETURNING global_user_id, created_at, updated_at, full_name, avatar_url, birthdate, metadata
        `, [
                globalUserId,
                valueMap.fullName ?? null,
                valueMap.avatarUrl ?? null,
                valueMap.birthdate ?? null,
                valueMap.metadata ?? '{}',
            ]);
            if (!newGlobalUser.rows[0]) {
                throw new Error(`Failed to create global identity for global_user_id ${globalUserId}`);
            }
            return this.toGlobalUser(newGlobalUser.rows[0]);
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
        if (updates.birthdate !== null && updates.birthdate !== undefined && updates.birthdate !== '') {
            if (updates.birthdate instanceof Date) {
                const year = updates.birthdate.getUTCFullYear();
                const month = String(updates.birthdate.getUTCMonth() + 1).padStart(2, '0');
                const day = String(updates.birthdate.getUTCDate()).padStart(2, '0');
                expectedBirthdate = `${year}-${month}-${day}`;
            }
            else if (typeof updates.birthdate === 'string') {
                expectedBirthdate = updates.birthdate.trim();
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
     */
    async linkLocalUserToGlobal(userId, globalUserId, tenantId) {
        // Verificar se já existe link
        const existing = await pool_1.pool.query(`
        SELECT id, global_user_id, user_id, tenant_id, created_at
        FROM user_identity_links
        WHERE user_id = $1 AND tenant_id = $2
        LIMIT 1
      `, [userId, tenantId]);
        if (existing.rows.length > 0) {
            // Atualizar link existente
            const updated = await pool_1.pool.query(`
          UPDATE user_identity_links
          SET global_user_id = $1
          WHERE id = $2
          RETURNING id, global_user_id, user_id, tenant_id, created_at
        `, [globalUserId, existing.rows[0].id]);
            return this.toUserIdentityLink(updated.rows[0]);
        }
        // Criar novo link
        const result = await pool_1.pool.query(`
        INSERT INTO user_identity_links (global_user_id, user_id, tenant_id)
        VALUES ($1, $2, $3)
        RETURNING id, global_user_id, user_id, tenant_id, created_at
      `, [globalUserId, userId, tenantId]);
        return this.toUserIdentityLink(result.rows[0]);
    }
    /**
     * Busca perfil completo (global + local) do usuário
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
            return null;
        }
        // Buscar identidade global
        let globalUser = null;
        let resolvedGlobalUserId = localUser.global_user_id;
        // 🔴 CORREÇÃO: Se users.global_user_id for NULL, buscar via user_identity_links
        if (!resolvedGlobalUserId) {
            console.log('[IdentityService] ⚠️ getIdentityProfile: global_user_id NULL em users, buscando via user_identity_links');
            // 🔴 CORREÇÃO: ORDER BY para garantir link mais recente (embora não deveria ter múltiplos)
            const linkResult = await pool_1.pool.query(`
          SELECT global_user_id
          FROM user_identity_links
          WHERE user_id = $1 AND tenant_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [userId, tenantId]);
            if (linkResult.rows[0]?.global_user_id) {
                resolvedGlobalUserId = linkResult.rows[0].global_user_id;
                console.log('[IdentityService] ✅ getIdentityProfile: global_user_id encontrado via user_identity_links:', resolvedGlobalUserId);
            }
            else {
                console.log('[IdentityService] ⚠️ getIdentityProfile: NENHUM link encontrado em user_identity_links para userId:', userId, 'tenantId:', tenantId);
            }
        }
        // 🔴 DIAGNÓSTICO: Log do global_user_id encontrado
        console.log('[IdentityService] 🔍 getIdentityProfile: Buscando global user', {
            userId,
            tenantId,
            global_user_id_from_users: localUser.global_user_id,
            resolvedGlobalUserId,
        });
        if (resolvedGlobalUserId) {
            globalUser = await this.getGlobalIdentity(resolvedGlobalUserId);
            console.log('[IdentityService] 🔍 getIdentityProfile: Resultado do getGlobalIdentity', {
                found: !!globalUser,
                globalUserId: resolvedGlobalUserId,
                fullName: globalUser?.fullName,
                birthdate: globalUser?.birthdate,
                birthdateType: globalUser?.birthdate ? typeof globalUser.birthdate : null,
                birthdateString: globalUser?.birthdate ? (globalUser.birthdate instanceof Date ? globalUser.birthdate.toISOString() : String(globalUser.birthdate)) : null,
            });
        }
        else {
            console.log('[IdentityService] ⚠️ getIdentityProfile: NENHUM global_user_id encontrado (nem em users, nem em user_identity_links)');
        }
        // Se não tem global_user_id, criar automaticamente
        // 🔴 CRÍTICO: Só criar se realmente não encontrou nenhum global_user
        // Isso pode acontecer se o registro foi deletado ou nunca foi criado
        if (!globalUser) {
            console.log('[IdentityService] ⚠️⚠️⚠️ ATENÇÃO: Global user não encontrado, criando novo');
            console.log('[IdentityService] 🔍 DIAGNÓSTICO ANTES DE CRIAR:', {
                userId,
                tenantId,
                resolvedGlobalUserId,
                localUserGlobalUserId: localUser.global_user_id,
                globalUserFound: !!globalUser,
            });
            // 🔴 VERIFICAR SE REALMENTE NÃO EXISTE NENHUM LINK ANTES DE CRIAR
            // 🔴 CORREÇÃO: ORDER BY para garantir link mais recente
            const finalCheck = await pool_1.pool.query(`
          SELECT global_user_id
          FROM user_identity_links
          WHERE user_id = $1 AND tenant_id = $2
          ORDER BY created_at DESC
          LIMIT 1
        `, [userId, tenantId]);
            if (finalCheck.rows[0]?.global_user_id) {
                console.log('[IdentityService] 🔍 ULTIMA VERIFICAÇÃO: Link encontrado! Buscando global_user:', finalCheck.rows[0].global_user_id);
                globalUser = await this.getGlobalIdentity(finalCheck.rows[0].global_user_id);
                if (globalUser) {
                    console.log('[IdentityService] ✅ ULTIMA VERIFICAÇÃO: Global user encontrado:', {
                        globalUserId: globalUser.globalUserId,
                        fullName: globalUser.fullName,
                        birthdate: globalUser.birthdate,
                    });
                }
                else {
                    console.log('[IdentityService] ❌ ULTIMA VERIFICAÇÃO: Link existe mas global_user não foi encontrado!');
                }
            }
            // Se ainda não tem globalUser, criar novo
            if (!globalUser) {
                console.log('[IdentityService] ⚠️ CRIANDO NOVO GLOBAL_USER (último recurso)');
                globalUser = await this.createGlobalIdentityForUser(userId, tenantId);
                console.log('[IdentityService] 🔍 DIAGNÓSTICO APÓS CRIAR:', {
                    globalUserId: globalUser.globalUserId,
                    fullName: globalUser.fullName,
                    birthdate: globalUser.birthdate,
                });
            }
        }
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
//# sourceMappingURL=identity.service.js.map