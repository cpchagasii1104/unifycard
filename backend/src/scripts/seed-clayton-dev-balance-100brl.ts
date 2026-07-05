/**
 * Script de UM USO — semeadura de R$100 na conta de Clayton em unificard_dev, sob pedido explícito
 * ("coloque um saldo de 100 reais na conta do dev. depois a gente exclui quando eu falar").
 *
 * NÃO é um E2E. NÃO é padrão a ser repetido sem novo pedido. Reusa o mecanismo já auditado
 * (ensurePlatformAccounts + creditInitialBalance de seed-initial-balance.ts) em vez de SQL cru —
 * respeita o sink firewall (Fatia 9 passo 2, auditado pela Yala) e o Core de Aprovação existente.
 *
 * Flag ligada SÓ no processo deste script (nunca no ambiente do backend rodando) — mesmo padrão
 * de todo script manual de semeadura desta sessão.
 */
process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

import 'dotenv/config';
import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../modules/bank/financial-authorship.helper';

// ACHADO durante a execução deste script: creditInitialBalance original (seed-initial-balance.ts)
// passa fromAccountId=reserve + toAccountId=user NO MESMO createSimpleTransaction — isso DEBITA a
// reserve e CREDITA o user na MESMA transação de banco; o débito na reserve é visto pela trigger
// trg_check_coverage ANTES do crédito no user (mesma tx Postgres), zerando a capacidade da reserve
// bem na hora de checar o crédito → COVERAGE_EXCEEDED. Fix: mint DIRETO pro user (só toAccountId,
// sem fromAccountId) — mesmo padrão double-entry via `liquidity_issuance` já usado pra capacitar a
// reserve acima; não toca na reserve, não zera capacidade de ninguém.
async function creditInitialBalance(tenantId: string, userId: string, amountCents: number): Promise<string> {
  const userAccount = await bankAccountService.getOrCreateAccount(tenantId, {
    ownerId: userId,
    ownerType: 'user',
    currency: 'BRL',
  });
  const eventId = `initial-balance-${userId}-${tenantId}`;
  const authorship = buildSystemAuthorship({
    actingForAccountId: userAccount.accountId,
    actingForActorId: CLAYTON_ACTOR_ID,
  });
  const result = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId,
    referenceType: 'initial_balance',
    toAccountId: userAccount.accountId,
    amountCents,
    currency: 'BRL',
    transactionType: 'deposit',
    description: `Crédito inicial para novo usuário`,
    metadata: { type: 'initial_balance', userId, source: 'system', reason: 'seed-clayton-dev-balance-100brl', temporary: true },
    concept_id: 'system-reserve-credit',
    authorship,
  } as any);
  return (result as any).transaction.transactionId;
}

const TENANT_ID = '5f7d3233-0c22-46cd-a22a-37b0f9ae526f';
const USER_ID = 'd93ac7fa-db2f-4c79-89f3-7ee415e457da';
// actor real de Clayton neste tenant — bank_transactions.actor_id tem FK real pra actors(id),
// não aceita o literal 'system' (mesmo achado desta sessão em todo E2E que criou tx financeira).
// Usa o próprio actor de Clayton como autoria em vez de fabricar uma identidade fake em
// unificard_dev (evitando poluir o banco persistente com dado fictício).
const CLAYTON_ACTOR_ID = '494642e5-eaa6-49fc-87eb-2ab82c09221c';
const AMOUNT_CENTS = 10_000; // R$ 100,00

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  console.log(`Conectado em: ${db}`);
  if (db !== 'unificard_dev') {
    throw new Error(`ABORT: esperado unificard_dev, conectado em "${db}".`);
  }

  console.log('Garantindo contas de plataforma do tenant (reserve/fee/regional_fund/escrow)...');
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');

  const reserve = await bankAccountService.getSystemAccount(TENANT_ID, 'reserve', 'BRL');
  if (!reserve) throw new Error('ABORT: reserve não foi criada por ensurePlatformAccounts.');

  const reserveBalanceBefore = await pool.query<{ n: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::text AS n
     FROM bank_ledger WHERE account_id = $1`,
    [reserve.accountId]
  );
  console.log(`Reserve account: ${reserve.accountId} — saldo atual: ${reserveBalanceBefore.rows[0].n} centavos`);

  if (Number(reserveBalanceBefore.rows[0].n) < AMOUNT_CENTS) {
    console.log(`Reserve sem capacidade suficiente — mintando ${AMOUNT_CENTS} centavos na reserve primeiro...`);
    const mintResult = await bankTransactionService.createSimpleTransaction(TENANT_ID, {
      eventId: `mint-reserve-seed-clayton-${Date.now()}`,
      referenceType: 'reserve_capacity_seed',
      toAccountId: reserve.accountId,
      amountCents: AMOUNT_CENTS,
      currency: 'BRL',
      transactionType: 'deposit',
      description: 'Capacidade inicial da reserve — semeadura pontual sob pedido de Clayton',
      metadata: { reason: 'seed-clayton-dev-balance-100brl', temporary: true },
      concept_id: 'system-reserve-credit',
      authorship: buildSystemAuthorship({ actingForAccountId: reserve.accountId, actingForActorId: CLAYTON_ACTOR_ID }),
    } as any);
    console.log(`Reserve mintada — transactionId: ${(mintResult as any)?.transaction?.transactionId}`);
  }

  console.log(`Creditando R$${(AMOUNT_CENTS / 100).toFixed(2)} pra usuário ${USER_ID}...`);
  const transactionId = await creditInitialBalance(TENANT_ID, USER_ID, AMOUNT_CENTS);
  console.log(`✅ Crédito criado — transactionId: ${transactionId}`);

  const userAccount = await bankAccountService.getOrCreateAccount(TENANT_ID, {
    ownerId: USER_ID,
    ownerType: 'user',
    currency: 'BRL',
  });
  const userBalance = await pool.query<{ n: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::text AS n
     FROM bank_ledger WHERE account_id = $1`,
    [userAccount.accountId]
  );
  console.log(`Saldo final da conta do usuário (account_id=${userAccount.accountId}): ${userBalance.rows[0].n} centavos`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
