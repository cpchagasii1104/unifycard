// backend/src/core/events/event-actions.service.ts
// Service para tracking de ações em eventos (observabilidade passiva)
// ⚠️ REGRAS CANÔNICAS:
// - Apenas log (append-only)
// - NÃO altera UX
// - NÃO altera ranking
// - NÃO altera visibilidade

import { v4 as uuidv4 } from 'uuid';
import { runQueryWithTenant } from '@core/database/pool';

export type EventActionType =
  | 'rsvp_yes'
  | 'rsvp_no'
  | 'rsvp_maybe'
  | 'calendar_add'
  | 'contribute_click'
  | 'share_click'
  | 'view'
  | 'link_open';

export interface LogEventActionInput {
  event_id: string;
  user_id?: string | null;
  action_type: EventActionType;
  metadata?: Record<string, any>;
}

class EventActionsService {
  /**
   * Loga uma ação em evento (append-only)
   */
  async logAction(tenantId: string, input: LogEventActionInput): Promise<void> {
    await runQueryWithTenant(
      tenantId,
      `INSERT INTO event_actions_log (
        event_id, tenant_id, user_id, action_type, metadata
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        input.event_id,
        tenantId,
        input.user_id || null,
        input.action_type,
        JSON.stringify(input.metadata || {}),
      ]
    );
  }
}

export const eventActionsService = new EventActionsService();



