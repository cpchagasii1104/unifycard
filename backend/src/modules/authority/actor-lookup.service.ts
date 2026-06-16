// backend/src/modules/authority/actor-lookup.service.ts
// F-ACTOR-CAPABILITY-GRANTS Slice 1A (DECISION-0136). Lookup HUMANO do actor por `actors.slug`.
//
// 🔴 DECISION-0134/0135: o código de indicação (`users.referral_code`) é COMERCIAL/money-adjacent
// (DECISION-0119, split/comissão) e é PROIBIDO como lookup de authority. O lookup humano do actor usa
// `actors.slug` — e o resultado é o `actor_id`, nunca o slug. `actors.slug` NÃO tem unicidade garantida no
// schema vivo (0002 era UNIQUE; 0064 readicionou nullable) → este resolver é FAIL-CLOSED em ambiguidade:
// 0 ou >1 match (no tenant) → null. Lookup ≠ authority: resolver só LOCALIZA; a autoridade é validada depois.

import { runQueriesWithTenant } from '@core/database/pool';

export const actorLookupService = {
  /**
   * Resolve um actor pelo slug humano dentro do tenant. Fail-closed:
   *   - slug vazio → null
   *   - inexistente → null
   *   - ambíguo (>1) → null (não escolhe; não vaza qual)
   */
  async resolveBySlug(tenantId: string, slug: string): Promise<{ actorId: string } | null> {
    const s = (slug ?? '').trim();
    if (!s) return null;
    const rows = await runQueriesWithTenant<{ id: string }>(
      tenantId,
      `SELECT id::text AS id FROM actors WHERE tenant_id=$1::uuid AND slug=$2 LIMIT 2`,
      [tenantId, s]
    );
    if (rows.length !== 1) return null; // 0 = inexistente, >1 = ambíguo → fail-closed
    return { actorId: rows[0].id };
  },
};
