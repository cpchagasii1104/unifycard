// backend/tests/support/fixtures/financial-overview-fixture.ts
// DECISION-0189C D7 — FIXTURE FINANCEIRA DE PROVA, FORA de backend/src e do build de produção.
//
// O código de produção NÃO importa este arquivo (só o script de evidência, via tsx). Insere
// substrato financeiro EFÊMERO (bank_account/transaction/split) e devolve os valores esperados.
// O scanner financial-ssot varre apenas backend/src → esta fixture não conta para o baseline (591).

interface PoolLike { query(text: string, params?: unknown[]): Promise<{ rows: any[] }> }

export interface OverviewFixtureResult {
  accountId: string;
  totalPaidCents: number;
  totalReceivedCents: number;
}

/**
 * Semeia 1 transação (paid=5000) + 1 split receptor (received=3000) para o page actor.
 * Reutiliza a conta existente do actor (unicidade tenant×owner) se houver.
 */
export async function seedOverviewFinancialFixture(
  pool: PoolLike,
  params: { tenantId: string; pageActorId: string; conceptId: string }
): Promise<OverviewFixtureResult> {
  const { tenantId, pageActorId, conceptId } = params;
  const existing = (await pool.query(
    `SELECT id FROM bank_accounts WHERE tenant_id=$1 AND actor_id=$2 LIMIT 1`,
    [tenantId, pageActorId]
  )).rows[0] as { id: string } | undefined;
  const acct = existing ?? (await pool.query(
    `INSERT INTO bank_accounts (tenant_id, actor_id, owner_type, owner_id, account_type)
       VALUES ($1::uuid,$2::uuid,'actor',$2::text,'credit') RETURNING id`,
    [tenantId, pageActorId]
  )).rows[0] as { id: string };
  const tx = (await pool.query(
    `INSERT INTO bank_transactions (tenant_id, actor_id, account_id, amount_cents, purpose, concept_id)
       VALUES ($1,$2,$3,5000,'settlement',$4) RETURNING id`,
    [tenantId, pageActorId, acct.id, conceptId]
  )).rows[0] as { id: string };
  await pool.query(
    `INSERT INTO bank_splits (tenant_id, transaction_id, source_actor_id, target_actor_id, amount_cents, split_type, target_account_id)
       VALUES ($1,$2,$3,$3,3000,'fixed',$4)`,
    [tenantId, tx.id, pageActorId, acct.id]
  );
  return { accountId: acct.id, totalPaidCents: 5000, totalReceivedCents: 3000 };
}
