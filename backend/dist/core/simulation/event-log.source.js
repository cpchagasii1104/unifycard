"use strict";
// src/core/simulation/event-log.source.ts
// Implementação de CanonicalEventSource que lê do event_log
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventLogSource = void 0;
const pool_1 = require("@core/database/pool");
const event_translator_1 = require("./event-translator");
/**
 * Implementação que lê eventos do event_log e converte para CanonicalEvent
 */
class EventLogSource {
    /**
     * Lista eventos canônicos do event_log
     */
    async listEvents(filters) {
        if (!filters.tenantId) {
            throw new Error('tenantId é obrigatório para listar eventos');
        }
        const client = await (0, pool_1.getClientWithTenant)(filters.tenantId);
        try {
            // Construir query baseada em filtros
            let query = `
        SELECT event_id, tenant_id, event_type, event_version, payload, metadata, created_at
        FROM event_log
        WHERE tenant_id = $1
      `;
            const params = [filters.tenantId];
            let paramIndex = 2;
            // Filtro por módulo fonte (eventos do Work começam com 'work.')
            if (filters.sourceModule) {
                query += ` AND event_type LIKE $${paramIndex}`;
                params.push(`${filters.sourceModule}.%`);
                paramIndex++;
            }
            // Filtro por tipo de evento específico
            if (filters.eventType) {
                query += ` AND event_type = $${paramIndex}`;
                params.push(filters.eventType);
                paramIndex++;
            }
            // Filtro por data de início
            if (filters.startDate) {
                query += ` AND created_at >= $${paramIndex}`;
                params.push(filters.startDate);
                paramIndex++;
            }
            // Filtro por data de fim
            if (filters.endDate) {
                query += ` AND created_at <= $${paramIndex}`;
                params.push(filters.endDate);
                paramIndex++;
            }
            query += ` ORDER BY created_at ASC`;
            const result = await client.query(query, params);
            // Converter eventos do event_log para CanonicalEvent
            const canonicalEvents = [];
            for (const row of result.rows) {
                // Criar UnificardEvent a partir do row
                const unificardEvent = {
                    eventId: row.event_id,
                    tenantId: row.tenant_id,
                    type: row.event_type,
                    version: row.event_version,
                    payload: row.payload,
                    metadata: row.metadata || {},
                    createdAt: row.created_at,
                };
                // Traduzir para CanonicalEvent
                const canonicalEvent = (0, event_translator_1.translateEventToCanonical)(unificardEvent);
                if (canonicalEvent) {
                    // Aplicar filtros adicionais (regionId, userId, amount)
                    if (filters.regionId && canonicalEvent.regionId !== filters.regionId) {
                        continue;
                    }
                    if (filters.userId && canonicalEvent.userId !== filters.userId) {
                        continue;
                    }
                    if (filters.minAmount !== undefined && (canonicalEvent.amount || 0) < filters.minAmount) {
                        continue;
                    }
                    if (filters.maxAmount !== undefined && (canonicalEvent.amount || 0) > filters.maxAmount) {
                        continue;
                    }
                    canonicalEvents.push(canonicalEvent);
                }
            }
            return canonicalEvents;
        }
        finally {
            client.release();
        }
    }
}
exports.eventLogSource = new EventLogSource();
