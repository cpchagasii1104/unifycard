/**
 * E2E — F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9, passo 2 do decision pack PORTA-1).
 * Roda SÓ em DB efêmera (runner run-bank-sink-firewall-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Diferente das outras E2Es desta sessão (que provam Δbank=0), ESTA prova as DUAS pontas do
 * kill-switch: default-OFF bloqueia dinheiro real de mover (nos 3 entrypoints do sink
 * compartilhado); flag='true' deixa o MESMO código mover dinheiro de verdade (E2E de dinheiro
 * real, ephemeral, como o READINESS_PORTA1.md pede antes de qualquer semeadura em ambiente vivo):
 *   A · default-off: transfer() → 403 BANK_TRANSACTION_SINK_FIREWALL_DISABLED, zero linha nova;
 *   B · default-off: createTransactionWithSplit() → mesmo 403, zero linha nova;
 *   C · default-off: createSimpleTransaction() → mesmo 403, zero linha nova;
 *   D · flag='1' (não-estrito) → AINDA bloqueado (prova que só a string exata 'true' liga);
 *   E · flag='true': createSimpleTransaction (mint SYSTEM) → sucesso real, ledger real;
 *   F · flag='true': transfer() SYSTEM→SYSTEM → sucesso real, saldos corretos nos dois lados;
 *   G · flag='true': createTransactionWithSplit() → passa do firewall (não lança o erro do
 *       firewall específico) — split engine em si é passo 3 do decision pack, fora desta fatia;
 *   H · nenhum outro caller de produção precisou mudar (o gate é no sink, não por-caller).
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { bankAccountRepository } from '../modules/bank/bank-account.repository';
import { bankTransactionService } from '../modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../modules/bank/financial-authorship.helper';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/sink|firewall|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function insertGovernedConcept(slug: string, domain: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.concept_governance', 'true', true)`);
    const row = await client.query<{ id: string }>(
      `INSERT INTO concepts (slug, domain) VALUES ($1, $2) RETURNING concept_id::text AS id`,
      [slug, domain]
    );
    await client.query('COMMIT');
    return row.rows[0].id;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function countBankTransactions(tenantId: string): Promise<string> {
  const r = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM bank_transactions WHERE tenant_id = $1`, [tenantId]);
  return r.rows[0].n;
}

// bank_transactions.actor_id tem FK real pra actors(id) — buildSystemAuthorship precisa de um
// actor de verdade, não um UUID solto (achado durante a execução deste E2E).
async function mkSystemActor(tenantId: string, name: string): Promise<string> {
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now()).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `sink-fw@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return actorId;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Bank Sink Firewall Tenant', slug: `sink-fw-${Date.now()}` });

  const conceptId = await insertGovernedConcept(`sink-fw-transfer-${Date.now()}`, 'financeiro-payout');

  const accountA = await bankAccountRepository.createAccount(TENANT, {
    ownerId: `system:sink-fw-a:${TENANT}`, ownerType: 'system', accountType: 'credit', currency: 'BRL',
  });
  const accountB = await bankAccountRepository.createAccount(TENANT, {
    ownerId: `system:sink-fw-b:${TENANT}`, ownerType: 'system', accountType: 'credit', currency: 'BRL',
  });

  // actingForActorId precisa ser um actor REAL — bank_transactions.actor_id tem FK pra actors(id)
  // (o default 'system' literal do helper quebra o cast uuid; um UUID solto quebra a FK).
  const systemActorId = await mkSystemActor(TENANT, 'Sink Firewall System Actor E2E');
  const authorship = (accountId: string) => buildSystemAuthorship({ actingForAccountId: accountId, actingForActorId: systemActorId });

  try {
    console.log('\n— bank transaction sink firewall END-TO-END (default-off bloqueia, flag=true move dinheiro real) —');

    // A · default-off: transfer() → 403, zero linha nova
    delete process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED;
    const beforeA = await countBankTransactions(TENANT);
    let errA: any = null;
    try {
      await bankTransactionService.transfer(TENANT, {
        eventId: randomUUID(), fromAccountId: accountA.accountId, toAccountId: accountB.accountId,
        amountCents: 100, currency: 'BRL', transactionType: 'transfer',
        referenceType: 'e2e_sink_fw_a', referenceId: randomUUID(), concept_id: conceptId,
        authorship: authorship(accountA.accountId),
      } as any);
    } catch (e: any) { errA = e; }
    const afterA = await countBankTransactions(TENANT);
    record('A default-off: transfer() → 403 BANK_TRANSACTION_SINK_FIREWALL_DISABLED, zero linha nova',
      errA?.code === 'BANK_TRANSACTION_SINK_FIREWALL_DISABLED' && errA?.statusCode === 403 && beforeA === afterA,
      `code=${errA?.code} status=${errA?.statusCode} count ${beforeA}→${afterA}`);

    // B · default-off: createTransactionWithSplit() → mesmo 403, zero linha nova
    const beforeB = await countBankTransactions(TENANT);
    let errB: any = null;
    try {
      await bankTransactionService.createTransactionWithSplit(TENANT, {
        eventId: randomUUID(), fromAccountId: accountA.accountId, amountCents: 100,
        currency: 'BRL', context: 'p2p_transfer', concept_id: conceptId,
        authorship: authorship(accountA.accountId),
      } as any);
    } catch (e: any) { errB = e; }
    const afterB = await countBankTransactions(TENANT);
    record('B default-off: createTransactionWithSplit() → mesmo 403, zero linha nova',
      errB?.code === 'BANK_TRANSACTION_SINK_FIREWALL_DISABLED' && errB?.statusCode === 403 && beforeB === afterB,
      `code=${errB?.code} status=${errB?.statusCode} count ${beforeB}→${afterB}`);

    // C · default-off: createSimpleTransaction() → mesmo 403, zero linha nova
    const beforeC = await countBankTransactions(TENANT);
    let errC: any = null;
    try {
      await bankTransactionService.createSimpleTransaction(TENANT, {
        eventId: randomUUID(), referenceType: 'e2e_sink_fw_c', toAccountId: accountA.accountId,
        amountCents: 100, currency: 'BRL', transactionType: 'deposit', concept_id: conceptId,
        authorship: authorship(accountA.accountId),
      } as any);
    } catch (e: any) { errC = e; }
    const afterC = await countBankTransactions(TENANT);
    record('C default-off: createSimpleTransaction() → mesmo 403, zero linha nova',
      errC?.code === 'BANK_TRANSACTION_SINK_FIREWALL_DISABLED' && errC?.statusCode === 403 && beforeC === afterC,
      `code=${errC?.code} status=${errC?.statusCode} count ${beforeC}→${afterC}`);

    // D · flag='1' (não-estrito) → AINDA bloqueado
    process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = '1';
    let errD: any = null;
    try {
      await bankTransactionService.transfer(TENANT, {
        eventId: randomUUID(), fromAccountId: accountA.accountId, toAccountId: accountB.accountId,
        amountCents: 100, currency: 'BRL', transactionType: 'transfer',
        referenceType: 'e2e_sink_fw_d', referenceId: randomUUID(), concept_id: conceptId,
        authorship: authorship(accountA.accountId),
      } as any);
    } catch (e: any) { errD = e; }
    record("D flag='1' (não-estrito) → AINDA bloqueado (só 'true' exato liga)",
      errD?.code === 'BANK_TRANSACTION_SINK_FIREWALL_DISABLED', `code=${errD?.code}`);

    // E · flag='true': createSimpleTransaction (mint) → sucesso real
    process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';
    const mintAmount = 500_00;
    const mintResult = await bankTransactionService.createSimpleTransaction(TENANT, {
      eventId: randomUUID(), referenceType: 'e2e_sink_fw_mint', toAccountId: accountA.accountId,
      amountCents: mintAmount, currency: 'BRL', transactionType: 'deposit', concept_id: conceptId,
      authorship: authorship(accountA.accountId),
    } as any);
    record('E flag=true: createSimpleTransaction (mint) → sucesso real, ledger real',
      !!(mintResult as any)?.transaction?.transactionId,
      `result=${JSON.stringify(mintResult).slice(0, 200)}`);

    // F · flag='true': transfer() SYSTEM→SYSTEM → sucesso real, saldos corretos
    const transferAmount = 200_00;
    const transferResult = await bankTransactionService.transfer(TENANT, {
      eventId: randomUUID(), fromAccountId: accountA.accountId, toAccountId: accountB.accountId,
      amountCents: transferAmount, currency: 'BRL', transactionType: 'transfer',
      referenceType: 'e2e_sink_fw_transfer_real', referenceId: randomUUID(), concept_id: conceptId,
      // treasury isolation: contas ownerType='system' só transferem via fonte autorizada.
      treasurySource: 'treasury:simulation',
      authorship: authorship(accountA.accountId),
    } as any);
    const balA = await pool.query<{ n: string }>(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::text AS n
       FROM bank_ledger WHERE account_id = $1`, [accountA.accountId]);
    const balB = await pool.query<{ n: string }>(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::text AS n
       FROM bank_ledger WHERE account_id = $1`, [accountB.accountId]);
    record('F flag=true: transfer() SYSTEM→SYSTEM → sucesso real, saldos corretos',
      !!(transferResult as any)?.transactionId &&
      Number(balA.rows[0].n) === mintAmount - transferAmount &&
      Number(balB.rows[0].n) === transferAmount,
      `balA=${balA.rows[0].n} (esperado ${mintAmount - transferAmount}) balB=${balB.rows[0].n} (esperado ${transferAmount})`);

    // G · flag='true': createTransactionWithSplit() → passa do firewall (split em si = passo 3, fora desta fatia)
    let errG: any = null;
    try {
      await bankTransactionService.createTransactionWithSplit(TENANT, {
        eventId: randomUUID(), fromAccountId: accountB.accountId, amountCents: 50,
        currency: 'BRL', context: 'p2p_transfer', concept_id: conceptId,
        authorship: authorship(accountB.accountId),
      } as any);
    } catch (e: any) { errG = e; }
    record('G flag=true: createTransactionWithSplit() passa do firewall (erro, se houver, NÃO é o do firewall)',
      errG?.code !== 'BANK_TRANSACTION_SINK_FIREWALL_DISABLED',
      `code=${errG?.code ?? '(sem erro — sucesso pleno)'}`);
  } finally {
    delete process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED;
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 erro fatal:', e?.message ?? e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
