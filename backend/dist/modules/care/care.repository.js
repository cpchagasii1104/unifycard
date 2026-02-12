"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CareRepository = void 0;
// src/modules/care/care.repository.ts
const pool_1 = require("@core/database/pool");
class CareRepository {
    /**
     * Busca sessão por ID
     */
    async findSessionById(tenantId, sessionId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT care_session_id, tenant_id, global_user_id, target_global_user_id, target_company_id, last_message, state, context, createdAt, updatedAt
      FROM care_sessions
      WHERE care_session_id = $1
      LIMIT 1
      `, [sessionId]);
        return row || null;
    }
    /**
     * Busca sessão ativa por usuário e target
     */
    async findActiveSession(tenantId, globalUserId, targetGlobalUserId, targetCompanyId) {
        let query = `
      SELECT care_session_id, tenant_id, global_user_id, target_global_user_id, target_company_id, last_message, state, context, createdAt, updatedAt
      FROM care_sessions
      WHERE global_user_id = $1
    `;
        const params = [globalUserId];
        if (targetGlobalUserId) {
            query += ` AND target_global_user_id = $2`;
            params.push(targetGlobalUserId);
        }
        else if (targetCompanyId) {
            query += ` AND target_company_id = $2`;
            params.push(targetCompanyId);
        }
        else {
            query += ` AND target_global_user_id IS NULL AND target_company_id IS NULL`;
        }
        query += ` ORDER BY updatedAt DESC LIMIT 1`;
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, query, params);
        return row || null;
    }
    /**
     * Cria uma nova sessão
     */
    async createSession(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO care_sessions (tenant_id, global_user_id, target_global_user_id, target_company_id, state, context)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING care_session_id, tenant_id, global_user_id, target_global_user_id, target_company_id, last_message, state, context, createdAt, updatedAt
      `, [
            data.tenantId,
            data.globalUserId,
            data.targetGlobalUserId ?? null,
            data.targetCompanyId ?? null,
            JSON.stringify(data.state),
            JSON.stringify(data.context),
        ]);
        if (!row) {
            throw new Error('Falha ao criar sessão');
        }
        return row;
    }
    /**
     * Atualiza estado e contexto da sessão
     */
    async updateSession(tenantId, sessionId, updates) {
        const updatesList = [];
        const params = [];
        let paramIndex = 1;
        if (updates.lastMessage !== undefined) {
            updatesList.push(`last_message = $${paramIndex}`);
            params.push(updates.lastMessage);
            paramIndex++;
        }
        if (updates.state !== undefined) {
            updatesList.push(`state = $${paramIndex}`);
            params.push(JSON.stringify(updates.state));
            paramIndex++;
        }
        if (updates.context !== undefined) {
            updatesList.push(`context = $${paramIndex}`);
            params.push(JSON.stringify(updates.context));
            paramIndex++;
        }
        if (updatesList.length === 0) {
            return await this.findSessionById(tenantId, sessionId);
        }
        params.push(sessionId);
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      UPDATE care_sessions
      SET ${updatesList.join(', ')}, updatedAt = now()
      WHERE care_session_id = $${paramIndex}
      RETURNING care_session_id, tenant_id, global_user_id, target_global_user_id, target_company_id, last_message, state, context, createdAt, updatedAt
      `, params);
        return row || null;
    }
    /**
     * Busca mensagens de uma sessão
     */
    async findMessagesBySession(tenantId, sessionId, options = {}) {
        const { limit = 100, offset = 0 } = options;
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT message_id, care_session_id, is_from_user, content, intent, parameters, ai_reasoning, createdAt
      FROM care_messages
      WHERE care_session_id = $1
      ORDER BY createdAt ASC
      LIMIT $2 OFFSET $3
      `, [sessionId, limit, offset]);
        // Contar total
        const countRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as total
      FROM care_messages
      WHERE care_session_id = $1
      `, [sessionId]);
        return {
            rows,
            totalCents: countRow ? Number(countRow.total) : 0,
        };
    }
    /**
     * Cria uma nova mensagem
     */
    async createMessage(data) {
        const row = await (0, pool_1.runQueryWithTenant)(data.tenantId, `
      INSERT INTO care_messages (care_session_id, is_from_user, content, intent, parameters, ai_reasoning)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING message_id, care_session_id, is_from_user, content, intent, parameters, ai_reasoning, createdAt
      `, [
            data.careSessionId,
            data.isFromUser,
            data.content,
            data.intent ?? null,
            data.parameters ? JSON.stringify(data.parameters) : null,
            data.aiReasoning ? JSON.stringify(data.aiReasoning) : null,
        ]);
        if (!row) {
            throw new Error('Falha ao criar mensagem');
        }
        return row;
    }
    /**
     * Busca sessões de um usuário
     */
    async findSessionsByUser(tenantId, globalUserId, options = {}) {
        const { limit = 50, offset = 0 } = options;
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT care_session_id, tenant_id, global_user_id, target_global_user_id, target_company_id, last_message, state, context, createdAt, updatedAt
      FROM care_sessions
      WHERE global_user_id = $1
      ORDER BY updatedAt DESC
      LIMIT $2 OFFSET $3
      `, [globalUserId, limit, offset]);
        // Contar total
        const countRow = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT COUNT(*) as total
      FROM care_sessions
      WHERE global_user_id = $1
      `, [globalUserId]);
        return {
            rows,
            totalCents: countRow ? Number(countRow.total) : 0,
        };
    }
}
exports.CareRepository = CareRepository;
