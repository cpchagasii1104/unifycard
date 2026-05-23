/**
 * Prompt 53.1 — limites por nível (tabela risk_financial_limits_by_level).
 */

import { pool } from '@core/database/pool';
import type { RiskLevel } from './actor-risk.repository';

export interface RiskLevelLimits {
  maxTransferCentsPerOperation: number;
  maxPaymentCentsPerOperation: number;
  maxPayoutCentsPerOperation: number;
}

const DEFAULT_MEDIUM: RiskLevelLimits = {
  maxTransferCentsPerOperation: 500_000,
  maxPaymentCentsPerOperation: 500_000,
  maxPayoutCentsPerOperation: 1_000_000,
};

export async function getLimitsForRiskLevel(level: RiskLevel): Promise<RiskLevelLimits> {
  try {
    const r = await pool.query<{
      max_transfer_cents_per_operation: string;
      max_payment_cents_per_operation: string;
      max_payout_cents_per_operation: string;
    }>(
      `SELECT max_transfer_cents_per_operation::text, max_payment_cents_per_operation::text,
              max_payout_cents_per_operation::text
       FROM risk_financial_limits_by_level WHERE risk_level = $1`,
      [level]
    );
    const row = r.rows[0];
    if (!row) {
      if (level === 'medium') return DEFAULT_MEDIUM;
      return {
        maxTransferCentsPerOperation: 500_000_000,
        maxPaymentCentsPerOperation: 500_000_000,
        maxPayoutCentsPerOperation: 500_000_000,
      };
    }
    return {
      maxTransferCentsPerOperation: Number(row.max_transfer_cents_per_operation),
      maxPaymentCentsPerOperation: Number(row.max_payment_cents_per_operation),
      maxPayoutCentsPerOperation: Number(row.max_payout_cents_per_operation),
    };
  } catch {
    return level === 'medium' ? DEFAULT_MEDIUM : DEFAULT_MEDIUM;
  }
}