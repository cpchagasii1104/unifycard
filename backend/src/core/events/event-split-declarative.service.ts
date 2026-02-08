// backend/src/core/events/event-split-declarative.service.ts
// Event Split Declarative Service (FASE 6.0)
// FASE_6_CONTRATO_SPLIT_PAGAMENTO.md

/**
 * 🔴 SPLIT NÃO É PAGAMENTO
 * 
 * Split é cálculo declarativo de distribuição futura.
 * 
 * Nenhum valor é transferido no split.
 * Nenhum dinheiro se move aqui.
 * 
 * PRÉ-REQUISITOS PARA EXISTIR SPLIT:
 * - Evento está na Fase 6.0
 * - Custódia foi criada
 * - Papéis econômicos estão definidos
 * - Regras de distribuição foram aprovadas
 * 
 * EVENTO CANÔNICO DE CÁLCULO:
 * - event.split.calculated
 */

import { eventService } from './event.service';
import { eventEconomicPhaseService } from './event-economic-phase.service';
import { eventCustodyService } from './event-custody.service';
import { eventBus } from './event-bus';
import { BadRequestError, NotFoundError } from '@core/errors';
import { runQueryWithTenant } from '@core/database/pool';
import { v4 as uuidv4 } from 'uuid';

/**
 * Parte do split (declarativo)
 */
export interface SplitPart {
  target_id: string; // Actor ou account ID
  target_type: 'user' | 'page' | 'group' | 'channel' | 'account';
  amount_cents: number;
  percentage: number;
  role: string; // Ex: 'organizer', 'worker', 'regional_fund'
}

/**
 * Input para calcular split
 */
export interface CalculateSplitInput {
  event_id: string;
  custody_id: string;
  parts: SplitPart[];
  rules_version?: string; // Versão das regras usadas
}

/**
 * Split calculado (declarativo)
 */
export interface DeclarativeSplit {
  id: string;
  event_id: string;
  custody_id: string;
  tenant_id: string;
  total_amount_cents: number;
  currency: string;
  parts: SplitPart[];
  rules_version?: string;
  status: 'calculated' | 'invalidated' | 'executed';
  calculatedAt: string;
  updatedAt: string;
}

interface SplitRow {
  id: string;
  tenant_id: string;
  event_id: string;
  custody_id: string;
  total_amount_cents: number;
  currency: string;
  parts: any;
  rules_version: string | null;
  status: string;
  calculatedAt: string;
  updatedAt: string;
}

class EventSplitDeclarativeService {
  /**
   * Calcula split SOMENTE após custódia existir
   * 
   * Emite: event.split.calculated
   * 
   * NÃO transfere valores
   * NÃO executa pagamento
   * NÃO libera custódia
   */
  async calculateSplit(
    tenantId: string,
    input: CalculateSplitInput
  ): Promise<DeclarativeSplit> {
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

    // 2. Verificar se custódia existe
    const custody = await eventCustodyService.getCustody(tenantId, input.custody_id);
    if (!custody) {
      throw new NotFoundError('Custódia não encontrada');
    }

    // 3. Verificar se custódia pertence ao evento
    if (custody.event_id !== input.event_id) {
      throw new BadRequestError('Custódia não pertence ao evento');
    }

    // 4. Verificar se custódia está ativa
    if (custody.status !== 'active') {
      throw new BadRequestError(`Custódia não está ativa (status: ${custody.status})`);
    }

    // 5. Validar partes do split
    this.validateSplitParts(input.parts, custody.amount_cents);

    // 6. Buscar evento para obter currency
    const event = await eventService.getEvent(tenantId, input.event_id);
    if (!event) {
      throw new NotFoundError('Evento não encontrado');
    }

    // 7. Criar split declarativo
    const splitId = uuidv4();
    const row = await runQueryWithTenant<SplitRow>(
      tenantId,
      `
      INSERT INTO event_split_declarative (
        id, tenant_id, event_id, custody_id,
        total_amount_cents, currency, parts,
        rules_version, status, calculatedAt, updatedAt
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *
      `,
      [
        splitId,
        tenantId,
        input.event_id,
        input.custody_id,
        custody.amount_cents,
        custody.currency,
        JSON.stringify(input.parts),
        input.rules_version || null,
        'calculated',
      ]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao calcular split');
    }

    const split = this.toSplit(row[0]);

    // 8. Emitir evento canônico
    await eventBus.publish({
      tenantId,
      type: 'event.split.calculated',
      payload: {
        split_id: split.id,
        event_id: input.event_id,
        custody_id: input.custody_id,
        total_amount_cents: split.total_amount_cents,
        currency: split.currency,
        parts: split.parts,
        rules_version: split.rules_version,
      },
    });

    return split;
  }

  /**
   * Invalida split (antes da execução)
   */
  async invalidateSplit(
    tenantId: string,
    splitId: string,
    reason: string
  ): Promise<DeclarativeSplit> {
    // 1. Buscar split
    const split = await this.getSplit(tenantId, splitId);
    if (!split) {
      throw new NotFoundError('Split não encontrado');
    }

    // 2. Verificar se pode ser invalidado
    if (split.status !== 'calculated') {
      throw new BadRequestError(`Split não pode ser invalidado (status: ${split.status})`);
    }

    // 3. Atualizar status
    const row = await runQueryWithTenant<SplitRow>(
      tenantId,
      `
      UPDATE event_split_declarative
      SET status = 'invalidated', updatedAt = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
      `,
      [splitId, tenantId]
    );

    if (!row || row.length === 0) {
      throw new Error('Falha ao invalidar split');
    }

    return this.toSplit(row[0]);
  }

  /**
   * Busca split por ID
   */
  async getSplit(
    tenantId: string,
    splitId: string
  ): Promise<DeclarativeSplit | null> {
    const row = await runQueryWithTenant<SplitRow>(
      tenantId,
      `
      SELECT *
      FROM event_split_declarative
      WHERE id = $1 AND tenant_id = $2
      LIMIT 1
      `,
      [splitId, tenantId]
    );

    if (!row || row.length === 0) {
      return null;
    }

    return this.toSplit(row[0]);
  }

  /**
   * Lista splits de um evento
   */
  async listSplitsByEvent(
    tenantId: string,
    eventId: string
  ): Promise<DeclarativeSplit[]> {
    const rows = await runQueryWithTenant<SplitRow>(
      tenantId,
      `
      SELECT *
      FROM event_split_declarative
      WHERE event_id = $1 AND tenant_id = $2
      ORDER BY calculatedAt DESC
      `,
      [eventId, tenantId]
    );

    return rows.map(row => this.toSplit(row));
  }

  /**
   * Valida partes do split
   */
  private validateSplitParts(parts: SplitPart[], totalAmountCents: number): void {
    if (!parts || parts.length === 0) {
      throw new BadRequestError('Split deve ter pelo menos uma parte');
    }

    let totalPercentage = 0;
    let totalAmount = 0;

    for (const part of parts) {
      if (part.percentage < 0 || part.percentage > 100) {
        throw new BadRequestError(`Percentual inválido: ${part.percentage}`);
      }
      if (part.amount_cents < 0) {
        throw new BadRequestError(`Valor inválido: ${part.amount_cents}`);
      }
      totalPercentage += part.percentage;
      totalAmount += part.amount_cents;
    }

    // Tolerância de 0.01% para arredondamento
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new BadRequestError(`Percentuais devem somar 100% (soma: ${totalPercentage}%)`);
    }

    // Tolerância de 1 centavo para arredondamento
    if (Math.abs(totalAmount - totalAmountCents) > 1) {
      throw new BadRequestError(
        `Valores devem somar ${totalAmountCents} centavos (soma: ${totalAmount})`
      );
    }
  }

  /**
   * Converte SplitRow para DeclarativeSplit
   */
  private toSplit(row: SplitRow): DeclarativeSplit {
    return {
      id: row.id,
      event_id: row.event_id,
      custody_id: row.custody_id,
      tenant_id: row.tenant_id,
      total_amount_cents: row.total_amount_cents,
      currency: row.currency,
      parts: row.parts as SplitPart[],
      rules_version: row.rules_version || undefined,
      status: row.status as 'calculated' | 'invalidated' | 'executed',
      calculatedAt: row.calculatedAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const eventSplitDeclarativeService = new EventSplitDeclarativeService();


