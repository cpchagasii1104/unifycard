// backend/src/core/events/event-split-declarative.service.ts
// FASE 1 — Split Declarative Engine. amountCents canônico; percentage_bps <= 10000.

import { v4 as uuidv4 } from 'uuid';
import { BadRequestError } from '@core/errors';
import type { CalculateSplitInput, CalculateSplitPart } from './event-economy.types';

const BPS_MAX = 10000;

export interface CalculatedSplitPart {
  target_id: string;
  target_type: string;
  amount_cents: number;
  percentage: number;
  role: string;
}

export interface CalculatedSplit {
  id: string;
  event_id: string;
  custody_id: string;
  status: 'calculated';
  parts: CalculatedSplitPart[];
  rules_version: string | null;
  createdAt: string;
}

const store = new Map<string, Map<string, CalculatedSplit>>();

function storeKey(tenantId: string, splitId: string): string {
  return `${tenantId}:${splitId}`;
}

function eventKey(tenantId: string, eventId: string): string {
  return `${tenantId}:${eventId}`;
}

class EventSplitDeclarativeService {
  /**
   * Valida percentual: percentage em 0-100 ou percentage_bps em 0-10000.
   */
  private validatePercentage(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new BadRequestError(`Percentual inválido: ${percentage}. Deve estar entre 0 e 100.`);
    }
  }

  /**
   * Valida amount_cents inteiro e não negativo.
   */
  private validateAmountCents(amountCents: number): void {
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      throw new BadRequestError('amount_cents deve ser inteiro não negativo.');
    }
  }

  /**
   * Calcula split declarativo; valida percentuais e valores; persiste em memória (compatível com bank_splits).
   */
  async calculateSplit(
    tenantId: string,
    input: CalculateSplitInput
  ): Promise<CalculatedSplit> {
    const { event_id, custody_id, parts, rules_version = null } = input;

    if (!event_id || !custody_id || !parts || parts.length === 0) {
      throw new BadRequestError('event_id, custody_id e parts são obrigatórios.');
    }

    let totalPercentage = 0;
    for (const p of parts) {
      this.validatePercentage(p.percentage);
      this.validateAmountCents(p.amount_cents);
      totalPercentage += p.percentage;
    }
    if (totalPercentage > 100) {
      throw new BadRequestError(`Soma dos percentuais (${totalPercentage}) não pode exceder 100.`);
    }

    const id = uuidv4();
    const createdAt = new Date().toISOString();
    const calculated: CalculatedSplit = {
      id,
      event_id,
      custody_id,
      status: 'calculated',
      parts: parts.map((p) => ({
        target_id: p.target_id,
        target_type: p.target_type,
        amount_cents: p.amount_cents,
        percentage: p.percentage,
        role: p.role,
      })),
      rules_version,
      createdAt,
    };

    let tenantMap = store.get(tenantId);
    if (!tenantMap) {
      tenantMap = new Map();
      store.set(tenantId, tenantMap);
    }
    tenantMap.set(id, calculated);

    return calculated;
  }

  /**
   * Retorna split por ID.
   */
  async getSplit(tenantId: string, splitId: string): Promise<CalculatedSplit | null> {
    const tenantMap = store.get(tenantId);
    if (!tenantMap) return null;
    return tenantMap.get(splitId) ?? null;
  }

  /**
   * Lista splits calculados por evento.
   */
  async listSplitsByEvent(tenantId: string, eventId: string): Promise<CalculatedSplit[]> {
    const tenantMap = store.get(tenantId);
    if (!tenantMap) return [];
    const list: CalculatedSplit[] = [];
    for (const s of tenantMap.values()) {
      if (s.event_id === eventId) list.push(s);
    }
    return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

export const eventSplitDeclarativeService = new EventSplitDeclarativeService();