// backend/src/core/events/event-rsvp.service.ts
// Service para RSVP (confirmação de presença) em eventos
// ⚠️ REGRAS CANÔNICAS:
// - RSVP só acontece após clique explícito
// - RSVP NÃO altera visibilidade
// - RSVP NÃO dispara ações automáticas
// - RSVP é reversível

import { v4 as uuidv4 } from 'uuid';
import { runQueryWithTenant, runQueriesWithTenant } from '@core/database/pool';
import { NotFoundError, BadRequestError } from '@core/errors';

export type RSVPStatus = 'yes' | 'no' | 'maybe';

export interface EventRSVP {
  id: string;
  event_id: string;
  tenant_id: string;
  user_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  status: RSVPStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRSVPInput {
  event_id: string;
  user_id?: string | null; // Se não fornecido, usar guest_email/guest_name
  guest_email?: string | null;
  guest_name?: string | null;
  status: RSVPStatus;
  notes?: string | null;
}

export interface RSVPCounts {
  yes: number;
  no: number;
  maybe: number;
}

interface EventRSVPRow {
  id: string;
  event_id: string;
  tenant_id: string;
  user_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  status: string;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface RSVPCountRow {
  status: string;
  count: number;
}

class EventRSVPService {
  /**
   * Cria ou atualiza RSVP
   */
  async upsertRSVP(
    tenantId: string,
    userId: string | null,
    input: CreateRSVPInput
  ): Promise<EventRSVP> {
    // Validar que pelo menos user_id OU guest_email seja fornecido
    if (!input.user_id && !input.guest_email) {
      throw new BadRequestError('user_id ou guest_email deve ser fornecido');
    }

    // Se user_id não fornecido, usar do parâmetro
    const finalUserId = input.user_id || userId;

    // Buscar RSVP existente
    let existingRSVP: EventRSVPRow | null = null;
    
    if (finalUserId) {
      const result = await runQueryWithTenant<EventRSVPRow>(
        tenantId,
        `SELECT * FROM event_rsvp 
         WHERE tenant_id = $1 AND event_id = $2 AND user_id = $3`,
        [tenantId, input.event_id, finalUserId]
      );
      existingRSVP = result ? result : null;
    } else if (input.guest_email) {
      const result = await runQueryWithTenant<EventRSVPRow>(
        tenantId,
        `SELECT * FROM event_rsvp 
         WHERE tenant_id = $1 AND event_id = $2 AND guest_email = $3`,
        [tenantId, input.event_id, input.guest_email]
      );
      existingRSVP = result ? result : null;
    }

    if (existingRSVP) {
      // Atualizar existente
      await runQueryWithTenant(
        tenantId,
        `UPDATE event_rsvp 
         SET status = $1, notes = $2, updated_at = NOW()
         WHERE tenant_id = $3 AND event_id = $4 AND id = $5`,
        [
          input.status,
          input.notes || null,
          tenantId,
          input.event_id,
          existingRSVP.id,
        ]
      );

      // Buscar atualizado
      const updated = await runQueryWithTenant<EventRSVPRow>(
        tenantId,
        `SELECT * FROM event_rsvp WHERE id = $1`,
        [existingRSVP.id]
      );
      if (!updated) throw new NotFoundError('RSVP não encontrado após atualização');
      return this.toEventRSVP(updated);
    } else {
      // Criar novo
      const rsvpId = uuidv4();
      await runQueryWithTenant(
        tenantId,
        `INSERT INTO event_rsvp (
          id, event_id, tenant_id, user_id, guest_email, guest_name, status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rsvpId,
          input.event_id,
          tenantId,
          finalUserId,
          input.guest_email || null,
          input.guest_name || null,
          input.status,
          input.notes || null,
        ]
      );

      // Buscar criado
      const created = await runQueryWithTenant<EventRSVPRow>(
        tenantId,
        `SELECT * FROM event_rsvp WHERE id = $1`,
        [rsvpId]
      );
      if (!created) throw new NotFoundError('RSVP não encontrado após criação');
      return this.toEventRSVP(created);
    }
  }

  /**
   * Busca RSVP do usuário para um evento
   */
  async getRSVPStatus(
    tenantId: string,
    eventId: string,
    userId?: string | null,
    guestEmail?: string | null
  ): Promise<EventRSVP | null> {
    let result: EventRSVPRow | null = null;

    if (userId) {
      const r = await runQueryWithTenant<EventRSVPRow>(
        tenantId,
        `SELECT * FROM event_rsvp 
         WHERE tenant_id = $1 AND event_id = $2 AND user_id = $3`,
        [tenantId, eventId, userId]
      );
      result = r || null;
    } else if (guestEmail) {
      const r = await runQueryWithTenant<EventRSVPRow>(
        tenantId,
        `SELECT * FROM event_rsvp 
         WHERE tenant_id = $1 AND event_id = $2 AND guest_email = $3`,
        [tenantId, eventId, guestEmail]
      );
      result = r || null;
    }

    if (!result) return null;
    return this.toEventRSVP(result);
  }

  /**
   * Busca contagens de RSVP para um evento
   */
  async getRSVPCounts(tenantId: string, eventId: string): Promise<RSVPCounts> {
    const results = await runQueriesWithTenant<RSVPCountRow>(
      tenantId,
      `SELECT status, count 
       FROM event_rsvp_counts 
       WHERE tenant_id = $1 AND event_id = $2`,
      [tenantId, eventId]
    );

    const counts: RSVPCounts = {
      yes: 0,
      no: 0,
      maybe: 0,
    };

    if (results) {
      results.forEach(row => {
        if (row.status === 'yes') counts.yes = row.count;
        else if (row.status === 'no') counts.no = row.count;
        else if (row.status === 'maybe') counts.maybe = row.count;
      });
    }

    return counts;
  }

  /**
   * Remove RSVP
   */
  async removeRSVP(
    tenantId: string,
    eventId: string,
    userId?: string | null,
    guestEmail?: string | null
  ): Promise<void> {
    if (userId) {
      await runQueryWithTenant(
        tenantId,
        `DELETE FROM event_rsvp 
         WHERE tenant_id = $1 AND event_id = $2 AND user_id = $3`,
        [tenantId, eventId, userId]
      );
    } else if (guestEmail) {
      await runQueryWithTenant(
        tenantId,
        `DELETE FROM event_rsvp 
         WHERE tenant_id = $1 AND event_id = $2 AND guest_email = $3`,
        [tenantId, eventId, guestEmail]
      );
    } else {
      throw new BadRequestError('user_id ou guest_email deve ser fornecido');
    }
  }

  /**
   * Converte EventRSVPRow para EventRSVP
   */
  private toEventRSVP(row: EventRSVPRow): EventRSVP {
    return {
      id: row.id,
      event_id: row.event_id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      guest_email: row.guest_email,
      guest_name: row.guest_name,
      status: row.status as RSVPStatus,
      notes: row.notes,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const eventRSVPService = new EventRSVPService();


