// Helpers para migração regional_fund / incentivos → Bank (USE_BANK_REGIONAL_FUND).

import { getClientWithTenant } from '@core/database/pool';
import { bankAccountService } from '../bank/bank-account.service';
import type { BankCurrency } from '../bank/bank-account.types';

/** UUID fixo (DNS namespace) para derivar reference_id estável a partir de grantId string. */
export const REGIONAL_INCENTIVE_REF_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/** Namespace distinto para v5(chave lógica) em `regional_fund_bank_topup` (reference_id no DB é UUID). */
export const REGIONAL_FUND_BANK_TOPUP_REF_NAMESPACE = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

/**
 * Resolve conta destino (wallet) para repasse de incentivo ao beneficiaryActorId.
 * Suporta actor user (user_wallet) ou page empresa (seller_available).
 */
export async function resolveIncentiveRecipientAccountId(
  tenantId: string,
  beneficiaryActorId: string,
  currency: BankCurrency = 'BRL'
): Promise<string | null> {
  const client = await getClientWithTenant(tenantId);
  try {
    const r = await client.query<{
      actor_type: string;
      user_id: string | null;
      company_id: string | null;
    }>(
      `SELECT actor_type, user_id, company_id
       FROM actors
       WHERE tenant_id = $1 AND (id = $2::uuid OR actor_id = $2::uuid)
       LIMIT 1`,
      [tenantId, beneficiaryActorId]
    );
    const row = r.rows[0];
    if (!row) {
      return null;
    }
    const userLikeTypes = new Set(['user', 'person', 'actor_human']);
    const isUserLike = row.user_id != null && userLikeTypes.has(row.actor_type);
    if (isUserLike) {
      await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, row.user_id!, 'user', currency);
      const acc = await bankAccountService.getLifecycleAccount(
        tenantId,
        row.user_id!,
        'user',
        'user_wallet',
        currency
      );
      return acc?.accountId ?? null;
    }
    if (row.actor_type === 'page' && row.company_id) {
      await bankAccountService.ensureLifecycleAccountsForOwner(tenantId, row.company_id, 'company', currency);
      const acc = await bankAccountService.getLifecycleAccount(
        tenantId,
        row.company_id,
        'company',
        'seller_available',
        currency
      );
      return acc?.accountId ?? null;
    }
    return null;
  } finally {
    client.release();
  }
}