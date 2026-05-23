// src/modules/social/social-ledger.service.ts
// Serviço para ledger social (imutável, append-only)
// FASE 5.1: ledger social paralelo desativado no runtime (fonte canónica futura: núcleo bank).

import { runQueryWithTenant } from '@core/database/pool';

export interface SocialLedgerEntry {
  ledger_id: string;
  tenant_id: string;
  post_id: string | null;
  cta_id: string | null;
  transaction_id: string | null;
  recipient_actor_id: string | null;
  recipient_group_id: string | null;
  owner_actor_id: string | null;
  amount_cents: number;
  currency: string;
  amount_type: 'revenue' | 'profit_share' | 'donation' | 'commission';
  description: string | null;
  metadata: Record<string, any>;
  idempotency_key: string | null;
  createdAt: string;
}

export interface UserLedgerSummary {
  total_revenue_cents: number;
  total_profit_share_received_cents: number;
  total_donations_given_cents: number;
  total_commissions_cents: number;
  group_contributions: Array<{
    group_id: string;
    group_name: string;
    total_contributed_cents: number;
  }>;
}

export class SocialLedgerService {
  /**
   * Registra entrada no ledger — bloqueado (deriva financeira); fonte canónica futura: bank_*.
   */
  async recordEntry(
    _tenantId: string,
    _data: {
      post_id?: string;
      cta_id?: string;
      transaction_id?: string;
      recipient_actor_id?: string;
      recipient_group_id?: string;
      owner_actor_id?: string;
      amount_cents: number;
      currency?: string;
      amount_type: 'revenue' | 'profit_share' | 'donation' | 'commission';
      description?: string;
      metadata?: Record<string, any>;
      idempotency_key?: string;
    }
  ): Promise<SocialLedgerEntry> {
    throw new Error('DERIVA_FINANCEIRA_BLOQUEADA');
  }

  /**
   * Ledger do usuário — vazio até read-model em bank_* (FASE posterior).
   */
  async getUserLedger(
    _tenantId: string,
    _globalUserId: string,
    _limit: number = 50
  ): Promise<SocialLedgerEntry[]> {
    return [];
  }

  /**
   * Resumo do ledger do usuário — zerado coerente com getUserLedger vazio.
   */
  async getUserLedgerSummary(
    tenantId: string,
    globalUserId: string
  ): Promise<UserLedgerSummary> {
    const entries = await this.getUserLedger(tenantId, globalUserId, 1000);

    const summary: UserLedgerSummary = {
      total_revenue_cents: 0,
      total_profit_share_received_cents: 0,
      total_donations_given_cents: 0,
      total_commissions_cents: 0,
      group_contributions: [],
    };

    const groupContributions: Record<string, { group_name: string; total_cents: number }> = {};

    for (const entry of entries) {
      switch (entry.amount_type) {
        case 'revenue':
          summary.total_revenue_cents += entry.amount_cents;
          break;
        case 'profit_share':
          summary.total_profit_share_received_cents += entry.amount_cents;
          if (entry.recipient_group_id) {
            if (!groupContributions[entry.recipient_group_id]) {
              const group = await runQueryWithTenant<{ name: string }>(
                tenantId,
                `SELECT name FROM groups WHERE group_id = $1 LIMIT 1`,
                [entry.recipient_group_id]
              );
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

export const socialLedgerService = new SocialLedgerService();
