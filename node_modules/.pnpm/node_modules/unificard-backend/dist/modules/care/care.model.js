"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CareMessageModel = exports.CareModel = void 0;
class CareModel {
    static fromRow(row) {
        return {
            careSessionId: row.care_session_id,
            tenantId: row.tenant_id,
            globalUserId: row.global_user_id,
            targetGlobalUserId: row.target_global_user_id,
            targetCompanyId: row.target_company_id,
            lastMessage: row.last_message,
            state: (row.state && typeof row.state === 'object' ? row.state : {}),
            context: (row.context && typeof row.context === 'object' ? row.context : {}),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }
    static fromRows(rows) {
        return rows.map((row) => this.fromRow(row));
    }
    static toRow(session) {
        const row = {};
        if (session.careSessionId !== undefined)
            row.care_session_id = session.careSessionId;
        if (session.tenantId !== undefined)
            row.tenant_id = session.tenantId;
        if (session.globalUserId !== undefined)
            row.global_user_id = session.globalUserId;
        if (session.targetGlobalUserId !== undefined)
            row.target_global_user_id = session.targetGlobalUserId;
        if (session.targetCompanyId !== undefined)
            row.target_company_id = session.targetCompanyId;
        if (session.lastMessage !== undefined)
            row.last_message = session.lastMessage;
        if (session.state !== undefined)
            row.state = session.state;
        if (session.context !== undefined)
            row.context = session.context;
        return row;
    }
}
exports.CareModel = CareModel;
class CareMessageModel {
    static fromRow(row) {
        return {
            messageId: row.message_id,
            careSessionId: row.care_session_id,
            isFromUser: row.is_from_user,
            content: row.content,
            intent: row.intent,
            parameters: row.parameters && typeof row.parameters === 'object' ? row.parameters : null,
            aiReasoning: row.ai_reasoning && typeof row.ai_reasoning === 'object' ? row.ai_reasoning : null,
            createdAt: row.created_at,
        };
    }
    static fromRows(rows) {
        return rows.map((row) => this.fromRow(row));
    }
    static toRow(message) {
        const row = {};
        if (message.messageId !== undefined)
            row.message_id = message.messageId;
        if (message.careSessionId !== undefined)
            row.care_session_id = message.careSessionId;
        if (message.isFromUser !== undefined)
            row.is_from_user = message.isFromUser;
        if (message.content !== undefined)
            row.content = message.content;
        if (message.intent !== undefined)
            row.intent = message.intent || null;
        if (message.parameters !== undefined)
            row.parameters = message.parameters;
        if (message.aiReasoning !== undefined)
            row.ai_reasoning = message.aiReasoning;
        return row;
    }
}
exports.CareMessageModel = CareMessageModel;
