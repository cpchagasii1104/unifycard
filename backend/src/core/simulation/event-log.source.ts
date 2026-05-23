// src/core/simulation/event-log.source.ts
// Implementação de CanonicalEventSource que lê do event_log

import { getClientWithTenant } from '@core/database/pool';
import type { CanonicalEvent } from '../orchestrator/contracts/canonical-event';
import type { CanonicalEventSource } from './event-source.interface';
import type { EventFilters } from './simulation.types';
import type { UnificardEvent } from '../events/event-bus';
import { translateEventToCanonical } from './event-translator';

/**
 * Implementação que lê eventos do event_log e converte para CanonicalEvent
 */
class EventLogSource implements CanonicalEventSource {
  /**
   * Lista eventos canônicos do event_log
   */
  async listEvents(filters: EventFilters): Promise<CanonicalEvent[]> {
    if (!filters.tenantId) {
      throw new Error('tenantId é obrigatório para listar eventos');
    }

    const client = await getClientWithTenant(filters.tenantId);

    try {
      // Construir query baseada em filtros
      let query = `
        SELECT event_id, tenant_id, event_type, event_version, payload, metadata, created_at
        FROM event_log
        WHERE tenant_id = $1
      `;

      const params: any[] = [filters.tenantId];
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

      const result = await client.query<{
        event_id: string;
        tenant_id: string;
        event_type: string;
        event_version: number;
        payload: any;
        metadata: any;
        created_at: Date;
      }>(query, params);

      // Converter eventos do event_log para CanonicalEvent
      const canonicalEvents: CanonicalEvent[] = [];

      for (const row of result.rows) {
        // Criar UnificardEvent a partir do row
        const unificardEvent: UnificardEvent = {
          eventId: row.event_id,
          tenantId: row.tenant_id,
          type: row.event_type,
          version: row.event_version,
          payload: row.payload,
          metadata: row.metadata || {},
          createdAt: row.created_at,
        };

        // Traduzir para CanonicalEvent
        const canonicalEvent = translateEventToCanonical(unificardEvent);
        if (canonicalEvent) {
          // Aplicar filtros adicionais (regionId, userId, amount)
          if (filters.regionId && canonicalEvent.regionId !== filters.regionId) {
            continue;
          }
          if (filters.userId && canonicalEvent.userId !== filters.userId) {
            continue;
          }
          if (filters.minAmount !== undefined && (canonicalEvent.amountCents || 0) < filters.minAmount) {
            continue;
          }
          if (filters.maxAmount !== undefined && (canonicalEvent.amountCents || 0) > filters.maxAmount) {
            continue;
          }

          canonicalEvents.push(canonicalEvent);
        }
      }

      return canonicalEvents;
    } finally {
      client.release();
    }
  }
}

export const eventLogSource = new EventLogSource();


