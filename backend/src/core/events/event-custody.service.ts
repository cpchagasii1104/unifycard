// backend/src/core/events/event-custody.service.ts
// Event Custody Service (FASE 6.0)
// FASE_6_CONTRATO_CUSTODIA.md

/**
 * 🔴 CUSTÓDIA NÃO É PAGAMENTO
 * 
 * Custódia é retenção controlada de valor com finalidade explícita.
 * 
 * Nenhum valor entra em custódia sem:
 * - evento explícito
 * - autorização explícita
 * - finalidade explícita
 * 
 * QUANDO A CUSTÓDIA PODE EXISTIR:
 * - Evento está na Fase 6.0
 * - Contrato econômico foi criado
 * - Split ainda NÃO foi executado
 * - Pagamento ainda NÃO foi liberado
 * 
 * EVENTO CANÔNICO DE CRIAÇÃO:
 * - event.custody.created
 */

import { eventService } from './event.service';
import { eventEconomicPhaseService } from './event-economic-phase.service';
import { BadRequestError, NotFoundError } from '@core/errors';
import {
  getClientWithTenant,
  runQueryWithTenant,
  runQueriesWithTenant,
} from '@core/database/pool';
import { insertEventOutboxRow } from './event-outbox.repository';
import { v4 as uuidv4 } from 'uuid';

/**
 * Status da custódia
 */
export type CustodyStatus = 'active' | 'released' | 'reverted' | 'cancelled';

/**
 * Condições de liberação da custódia
 */
export interface CustodyReleaseConditions {
  event_completed?: boolean;
  payment_authorized?: boolean;
  cancellation_approved?: boolean;
  manual_release?: boolean;
}

/**
 * Input para criar custódia
 */
export interface CreateCustodyInput {
  event_id: string;
  amount_cents: number;
  currency: string;
  economic_owner_id: string; // Dono econômico (actor_id)
  economic_owner_type: 'user' | 'page' | 'group' | 'channel';
  release_conditions: CustodyReleaseConditions;
  purpose: string; // Finalidade explícita
}

/**
 * Custódia criada
 */
export interface Custody {
  id: string;
  event_id: string;
  tenant_id: string;
  amount_cents: number;
  currency: string;
  economic_owner_id: string;
  economic_owner_type: string;
  release_conditions: CustodyReleaseConditions;
  purpose: string;
  status: CustodyStatus;
  createdAt: string;
  updatedAt: string;
}

interface CustodyRow {
  id: string;
  tenant_id: string;
  event_id: string;
  amount_cents: number;
  currency: string;
  economic_owner_id: string;
  economic_owner_type: string;
  release_conditions: any;
  purpose: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

class EventCustodyService {
  /**
   * Cria custódia SOMENTE via evento explícito
   *
   * Enfileira `event.custody.created` na outbox (mesma TX que o INSERT); publicação efectiva via worker.
   */
  async createCustody(
    tenantId: string,
    input: CreateCustodyInput
  ): Promise<Custody> {
    // 1. Verificar se evento está na Fase 6.0
    const isInEconomicPhase = await eventEconomicPhaseService.isInEconomicPhase(
      tenantId,
      input.event_id
    );
    if (!isInEconomicPhase) {
      throw new BadRequestError(
        'Evento não está na Fase 6.0. Execute o handoff da Fase 5.0 primeiro.'
      );
    }

    // 2. Verificar se evento existe
    const event = await eventService.getEvent(tenantId, input.event_id);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 3. Verificar se split já foi executado (PROIBIDO)
    const hasExecutedSplit = await this.hasExecutedSplit(tenantId, input.event_id);
    if (hasExecutedSplit) {
      throw new BadRequestError('Custódia não pode ser criada após split executado');
    }

    // 4. Verificar se pagamento já foi liberado (PROIBIDO)
    const hasReleasedPayment = await this.hasReleasedPayment(tenantId, input.event_id);
    if (hasReleasedPayment) {
      throw new BadRequestError('Custódia não pode ser criada após pagamento liberado');
    }

    // 5. Validar valor
    if (input.amount_cents <= 0) {
      throw new BadRequestError('Valor da custódia deve ser maior que zero');
    }

    // 6. Criar custódia + linha de outbox (mesma transação)
    const custodyId = uuidv4();
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      try {
        const insertResult = await client.query<CustodyRow>(
          `
          INSERT INTO event_custody (
            id, tenant_id, event_id, amount_cents, currency,
            economic_owner_id, economic_owner_type,
            release_conditions, purpose, status,
            created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
          RETURNING *
          `,
          [
            custodyId,
            tenantId,
            input.event_id,
            input.amount_cents,
            input.currency,
            input.economic_owner_id,
            input.economic_owner_type,
            JSON.stringify(input.release_conditions),
            input.purpose,
            'active',
          ]
        );

        const row = insertResult.rows[0];
        if (!row) {
          throw new Error('Falha ao criar custódia');
        }

        const custody = this.toCustody(row);

        await insertEventOutboxRow(client, {
          tenantId,
          eventId: uuidv4(),
          eventType: 'event.custody.created',
          eventVersion: 1,
          payload: {
            custody_id: custody.id,
            event_id: input.event_id,
            amount_cents: input.amount_cents,
            currency: input.currency,
            economic_owner_id: input.economic_owner_id,
            economic_owner_type: input.economic_owner_type,
            release_conditions: input.release_conditions,
            purpose: input.purpose,
          },
          metadata: {},
        });

        await client.query('COMMIT');
        return custody;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Reverte custódia (estorno)
   *
   * Enfileira `event.custody.reverted` na outbox (mesma TX que o UPDATE); publicação efectiva via worker.
   */
  async revertCustody(
    tenantId: string,
    custodyId: string,
    reason: string
  ): Promise<Custody> {
    // 1. Buscar custódia
    const custody = await this.getCustody(tenantId, custodyId);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }

    // 2. Verificar se pode ser revertida
    if (custody.status !== 'active') {
      throw new BadRequestError(`Custódia não pode ser revertida (status: ${custody.status})`);
    }

    // 3. Atualizar status + linha de outbox (mesma transação)
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      try {
        const updateResult = await client.query<CustodyRow>(
          `
          UPDATE event_custody
          SET status = 'reverted', updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING *
          `,
          [custodyId, tenantId]
        );

        const row = updateResult.rows[0];
        if (!row) {
          throw new Error('Falha ao reverter custódia');
        }

        const revertedCustody = this.toCustody(row);
        const revertedAt = new Date().toISOString();

        await insertEventOutboxRow(client, {
          tenantId,
          eventId: uuidv4(),
          eventType: 'event.custody.reverted',
          eventVersion: 1,
          payload: {
            custody_id: custodyId,
            event_id: custody.event_id,
            amount_cents: custody.amount_cents,
            reason,
            revertedAt,
          },
          metadata: {},
        });

        await client.query('COMMIT');
        return revertedCustody;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Busca custódia por ID
   */
  async getCustody(
    tenantId: string,
    custodyId: string
  ): Promise<Custody | null> {
    const row = await runQueryWithTenant<CustodyRow>(
      tenantId,
      `
      SELECT *
      FROM event_custody
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [custodyId, tenantId]
    );

    if (!row) {
      return null;
    }

    return this.toCustody(row);
  }

  /**
   * Lista custódias de um evento
   */
  async listCustodiesByEvent(
    tenantId: string,
    eventId: string
  ): Promise<Custody[]> {
    const rows = await runQueriesWithTenant<CustodyRow>(
      tenantId,
      `
      SELECT *
      FROM event_custody
      WHERE event_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      `,
      [eventId, tenantId]
    );

    return rows.map(r => this.toCustody(r));
  }

  /**
   * Libera custódia após execução de pagamento
   *
   * Enfileira `event.custody.released` na outbox (mesma TX que o UPDATE); publicação efectiva via worker.
   */
  async releaseCustody(
    tenantId: string,
    custodyId: string,
    reason: string
  ): Promise<Custody> {
    // 1. Buscar custódia
    const custody = await this.getCustody(tenantId, custodyId);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }

    // 2. Verificar se pode ser liberada
    if (custody.status !== 'active') {
      throw new BadRequestError(`Custódia não pode ser liberada (status: ${custody.status})`);
    }

    // 3. Atualizar status + linha de outbox (mesma transação)
    const client = await getClientWithTenant(tenantId);
    try {
      await client.query('BEGIN');
      try {
        const updateResult = await client.query<CustodyRow>(
          `
          UPDATE event_custody
          SET status = 'released', updated_at = NOW()
          WHERE id = $1 AND tenant_id = $2
          RETURNING *
          `,
          [custodyId, tenantId]
        );

        const row = updateResult.rows[0];
        if (!row) {
          throw new Error('Falha ao liberar custódia');
        }

        const releasedCustody = this.toCustody(row);
        const releasedAt = new Date().toISOString();

        await insertEventOutboxRow(client, {
          tenantId,
          eventId: uuidv4(),
          eventType: 'event.custody.released',
          eventVersion: 1,
          payload: {
            custody_id: custodyId,
            event_id: custody.event_id,
            amount_cents: custody.amount_cents,
            reason,
            releasedAt,
          },
          metadata: {},
        });

        await client.query('COMMIT');
        return releasedCustody;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } finally {
      client.release();
    }
  }

  /**
   * Verifica se split já foi executado
   */
  private async hasExecutedSplit(
    tenantId: string,
    eventId: string
  ): Promise<boolean> {
    // Verificar se há split executado (não apenas calculado)
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM event_log
      WHERE tenant_id = $1
        AND payload->>'event_id' = $2
        AND event_type = 'event.split.executed'
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    return result != null && parseInt(result.count, 10) > 0;
  }

  /**
   * Verifica se pagamento já foi liberado
   */
  private async hasReleasedPayment(
    tenantId: string,
    eventId: string
  ): Promise<boolean> {
    // Verificar se há pagamento executado
    const result = await runQueryWithTenant<{ count: string }>(
      tenantId,
      `
      SELECT COUNT(*) as count
      FROM event_log
      WHERE tenant_id = $1
        AND payload->>'event_id' = $2
        AND event_type = 'event.payment.executed'
      LIMIT 1
      `,
      [tenantId, eventId]
    );

    return result != null && parseInt(result.count, 10) > 0;
  }

  /**
   * Converte CustodyRow para Custody
   */
  private toCustody(row: CustodyRow): Custody {
    return {
      id: row.id,
      event_id: row.event_id,
      tenant_id: row.tenant_id,
      amount_cents: row.amount_cents,
      currency: row.currency,
      economic_owner_id: row.economic_owner_id,
      economic_owner_type: row.economic_owner_type,
      release_conditions: row.release_conditions as CustodyReleaseConditions,
      purpose: row.purpose,
      status: row.status as CustodyStatus,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const eventCustodyService = new EventCustodyService();


