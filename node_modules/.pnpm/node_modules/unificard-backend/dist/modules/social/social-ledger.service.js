"use strict";
// src/modules/social/social-ledger.service.ts
// Serviço para ledger social (imutável, append-only)
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialLedgerService = exports.SocialLedgerService = void 0;
const pool_1 = require("@core/database/pool");
class SocialLedgerService {
    /**
     * Registra entrada no ledger (append-only, imutável)
     * IMPORTANTE: Ledger só deve ser criado de transação econômica REAL (pagamento/contratação confirmados)
     * NÃO criar ledger automaticamente ao criar post com CTA/preço.
     */
    async recordEntry(tenantId, data) {
        // Validar que há fonte identificável (transação OU post+cta OU repasse calculado)
        if (!data.transaction_id && !(data.post_id && data.cta_id) && data.amount_type !== 'profit_share') {
            throw new Error('Ledger entry must have transaction_id OR (post_id + cta_id) OR be profit_share type');
        }
        const entry = await (0, pool_1.runQueryWithTenant)(tenantId, `
      INSERT INTO social_ledger (
        tenant_id, post_id, cta_id, transaction_id,
        recipient_actor_id, recipient_group_id, owner_actor_id,
        amount_cents, currency, amount_type, description, metadata, idempotency_key
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL
      DO NOTHING
      RETURNING ledger_id, created_at
      `, [
            tenantId,
            data.post_id || null,
            data.cta_id || null,
            data.transaction_id || null,
            data.recipient_actor_id || null,
            data.recipient_group_id || null,
            data.owner_actor_id || null,
            data.amount_cents,
            data.currency || 'BRL',
            data.amount_type,
            data.description || null,
            JSON.stringify(data.metadata || {}),
            data.idempotency_key || null,
        ]);
        // Se idempotency_key foi usado e já existe, retornar entrada existente
        if (!entry && data.idempotency_key) {
            const existing = await (0, pool_1.runQueryWithTenant)(tenantId, `
        SELECT ledger_id, created_at
        FROM social_ledger
        WHERE tenant_id = $1 AND idempotency_key = $2
        LIMIT 1
        `, [tenantId, data.idempotency_key]);
            if (existing) {
                // Buscar entrada completa
                const fullEntry = await this.getEntryById(tenantId, existing.ledger_id);
                if (fullEntry)
                    return fullEntry;
            }
        }
        if (!entry) {
            throw new Error('Erro ao registrar entrada no ledger');
        }
        return {
            ledger_id: entry.ledger_id,
            tenant_id: tenantId,
            post_id: data.post_id || null,
            cta_id: data.cta_id || null,
            transaction_id: data.transaction_id || null,
            recipient_actor_id: data.recipient_actor_id || null,
            recipient_group_id: data.recipient_group_id || null,
            owner_actor_id: data.owner_actor_id || null,
            amount_cents: data.amount_cents,
            currency: data.currency || 'BRL',
            amount_type: data.amount_type,
            description: data.description || null,
            metadata: data.metadata || {},
            idempotency_key: data.idempotency_key || null,
            created_at: entry.created_at,
        };
    }
    /**
     * Busca entrada por ID
     */
    async getEntryById(tenantId, ledgerId) {
        const row = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT 
        ledger_id, tenant_id, post_id, cta_id, transaction_id,
        recipient_actor_id, recipient_group_id, owner_actor_id,
        amount_cents, currency, amount_type, description, metadata, idempotency_key, created_at
      FROM social_ledger
      WHERE ledger_id = $1 AND tenant_id = $2
      LIMIT 1
      `, [ledgerId, tenantId]);
        if (!row)
            return null;
        return {
            ledger_id: row.ledger_id,
            tenant_id: row.tenant_id,
            post_id: row.post_id,
            cta_id: row.cta_id,
            transaction_id: row.transaction_id,
            recipient_actor_id: row.recipient_actor_id,
            recipient_group_id: row.recipient_group_id,
            owner_actor_id: row.owner_actor_id,
            amount_cents: parseInt(row.amount_cents),
            currency: row.currency,
            amount_type: row.amount_type,
            description: row.description,
            metadata: row.metadata || {},
            idempotency_key: row.idempotency_key,
            created_at: row.created_at,
        };
    }
    /**
     * Busca ledger de um usuário (ganhos pessoais + repasses)
     */
    async getUserLedger(tenantId, globalUserId, limit = 50) {
        // Busca actor do usuário
        const user = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT user_id FROM users
      WHERE user_id IN (
        SELECT user_id FROM global_users WHERE global_user_id = $1
      )
      LIMIT 1
      `, [globalUserId]);
        if (!user) {
            return [];
        }
        // Busca actor_id do usuário
        const actor = await (0, pool_1.runQueryWithTenant)(tenantId, `
      SELECT actor_id FROM actors
      WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user'
      LIMIT 1
      `, [tenantId, user.user_id]);
        if (!actor) {
            return [];
        }
        // Buscar lançamentos onde o usuário é owner, recipient ou membro de grupo
        const rows = await (0, pool_1.runQueriesWithTenant)(tenantId, `
      SELECT 
        sl.ledger_id, sl.tenant_id, sl.post_id, sl.cta_id, sl.transaction_id,
        sl.recipient_actor_id, sl.recipient_group_id, sl.owner_actor_id,
        sl.amount_cents, sl.currency, sl.amount_type, sl.description, sl.metadata, sl.idempotency_key, sl.created_at
      FROM social_ledger sl
      WHERE sl.tenant_id = $1 
        AND (
          sl.owner_actor_id = $2 
          OR sl.recipient_actor_id = $2 
          OR sl.recipient_group_id IN (
            SELECT gm.group_id FROM group_members gm
            INNER JOIN users u ON u.global_user_id = gm.user_id
            WHERE u.global_user_id = $3
          )
        )
      ORDER BY sl.created_at DESC
      LIMIT $4
      `, [tenantId, actor.actor_id, globalUserId, limit]);
        return rows.map((row) => ({
            ledger_id: row.ledger_id,
            tenant_id: row.tenant_id,
            post_id: row.post_id,
            cta_id: row.cta_id,
            transaction_id: row.transaction_id,
            recipient_actor_id: row.recipient_actor_id,
            recipient_group_id: row.recipient_group_id,
            owner_actor_id: row.owner_actor_id,
            amount_cents: parseInt(row.amount_cents),
            currency: row.currency,
            amount_type: row.amount_type,
            description: row.description,
            metadata: row.metadata || {},
            idempotency_key: row.idempotency_key,
            created_at: row.created_at,
        }));
    }
    /**
     * Resumo do ledger do usuário
     */
    async getUserLedgerSummary(tenantId, globalUserId) {
        const entries = await this.getUserLedger(tenantId, globalUserId, 1000);
        const summary = {
            total_revenue_cents: 0,
            total_profit_share_received_cents: 0,
            total_donations_given_cents: 0,
            total_commissions_cents: 0,
            group_contributions: [],
        };
        const groupContributions = {};
        for (const entry of entries) {
            switch (entry.amount_type) {
                case 'revenue':
                    summary.total_revenue_cents += entry.amount_cents;
                    break;
                case 'profit_share':
                    summary.total_profit_share_received_cents += entry.amount_cents;
                    if (entry.recipient_group_id) {
                        if (!groupContributions[entry.recipient_group_id]) {
                            // Busca nome do grupo
                            const group = await (0, pool_1.runQueryWithTenant)(tenantId, `SELECT name FROM groups WHERE group_id = $1 LIMIT 1`, [entry.recipient_group_id]);
                            groupContributions[entry.recipient_group_id] = {
                                group_name: group?.name || 'Grupo',
                                total_cents: 0,
                            };
                        }
                        groupContributions[entry.recipient_group_id].total_cents += entry.amount_cents;
                    }
                    break;
                case 'donation':
                    summary.total_donations_given_cents += entry.amount_cents;
                    break;
                case 'commission':
                    summary.total_commissions_cents += entry.amount_cents;
                    break;
            }
        }
        summary.group_contributions = Object.entries(groupContributions).map(([group_id, data]) => ({
            group_id,
            group_name: data.group_name,
            total_contributed_cents: data.total_cents,
        }));
        return summary;
    }
}
exports.SocialLedgerService = SocialLedgerService;
exports.socialLedgerService = new SocialLedgerService();
