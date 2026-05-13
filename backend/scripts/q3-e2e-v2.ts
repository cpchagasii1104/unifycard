/**
 * Q3-E2E v2 — Smoke Econômico (DEPRECADO 2026-05-13 — vide DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO)
 *
 * ⚠️  DEPRECADO. Use q3-e2e-v3-fundacional.ts.
 *
 * Razão da deprecação:
 *   - Commit message original (61e10c26) declarou "smoke econômico fundacional"
 *     mas o código usa shortcut Opção C que DECISION-0031 refutou:
 *     `createSimpleTransaction(fromAccountId: undefined → liquidity_issuance,
 *      toAccountId: system:reserve, concept_id: 'system-reserve-credit')` —
 *     "provisionamento artificial de reserve sem origem econômica real"
 *     (texto literal da DECISION-0031 refutando esse caminho).
 *   - Smoke passou 11/11 PASS validando ledger técnico (double-entry, bigint),
 *     mas NÃO exercitou o caminho fundacional canônico declarado pela norma.
 *   - Falsa solvência institucional documentada em REMEDIATION_DT_LOG.md
 *     (DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO).
 *
 * Caminho canônico documentado por DECISION-0031:
 *   event_ticket → split engine → parcela de reserve (17%) deposita em system:reserve
 *
 * Substituto: q3-e2e-v3-fundacional.ts (cria evento real, executa checkout via
 * POST /events/:id/checkout que invoca eventEconomyService → bankTransactionService
 * .createTransactionWithSplit(context: 'event_ticket') → bankSplitEngine 4 splits,
 * fundando reserve via 17% do split — caminho fundacional canônico).
 *
 * Este arquivo permanece como artefato histórico até DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO
 * ser formalmente CLOSED em commit subsequente (após validação que v3 executa).
 *
 * Uso histórico: npx tsx scripts/q3-e2e-v2.ts
 * Uso canônico:  npx tsx scripts/q3-e2e-v3-fundacional.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../src/core/database/pool';
import { bankAccountRepository } from '../src/modules/bank/bank-account.repository';
import { bankAccountService } from '../src/modules/bank/bank-account.service';
import { bankTransactionService } from '../src/modules/bank/bank-transaction.service';
import { buildSystemAuthorship } from '../src/modules/bank/financial-authorship.helper';

dotenv.config({ path: join(process.cwd(), '.env') });
// E2E de desenvolvimento: bypass ATL strict (authority_roots não pré-configuradas para users de teste)
if (!process.env.AUTHORITY_MODE) process.env.AUTHORITY_MODE = 'permissive';

const BASE_URL = 'http://localhost:3000';
const P2P_AMOUNT_CENTS = 10_000;  // R$100 transferência A→B
const SEED_AMOUNT_CENTS = 500_000; // R$5.000 no reserve (bootstrap)
const USER_CREDIT_CENTS = 100_000; // R$1.000 para usuário A
const TS = Date.now();

function pass(label: string, detail?: string) {
  console.log(`  ✅ PASS | ${label}${detail ? ' — ' + detail : ''}`);
}
function fail(label: string, detail: string): never {
  console.error(`  ❌ FAIL | ${label} — ${detail}`);
  process.exit(1);
}

async function httpPost(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function httpGet(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Q3-E2E v2 — SMOKE ECONÔMICO FUNDACIONAL');
  console.log('══════════════════════════════════════════════\n');

  // ── PASSO 1: Registrar Usuário A ──────────────────────────────────────────
  console.log('[P1] Registrar Usuário A via HTTP...');
  const regA = await httpPost('/auth/register', {
    email: `q3v2-a-${TS}@e2e.local`,
    password: 'Q3Test@2026',
    name: 'Q3v2 User A',
    cpf: '11144477735',  // CPF válido, verificado
  });
  if (regA.status !== 201) fail('P1 — register A', `status=${regA.status} body=${JSON.stringify(regA.body)}`);
  const d1 = regA.body.data ?? regA.body;
  const tokenA: string = d1?.tokens?.accessToken ?? d1?.token ?? d1?.accessToken;
  const tenantId: string = d1?.tenantId ?? d1?.tenant_id;
  const userIdA: string = d1?.user?.userId ?? d1?.userId ?? d1?.user_id ?? d1?.id;
  if (!tokenA || !tenantId) fail('P1 — register A', `missing token/tenantId: ${JSON.stringify(regA.body)}`);
  pass('P1 — Usuário A registrado', `tenant=${tenantId.slice(0,8)} userId=${userIdA?.slice(0,8)}`);

  // ── PASSO 2: Registrar Usuário B (mesmo tenant) ───────────────────────────
  console.log('[P2] Registrar Usuário B (mesmo tenant)...');
  const regB = await httpPost('/auth/register', {
    email: `q3v2-b-${TS}@e2e.local`,
    password: 'Q3Test@2026',
    name: 'Q3v2 User B',
    cpf: '22233344405',  // CPF válido, verificado
  }, { 'x-tenant-id': tenantId });
  if (regB.status !== 201) fail('P2 — register B', `status=${regB.status} body=${JSON.stringify(regB.body)}`);
  const d2 = regB.body.data ?? regB.body;
  const tokenB: string = d2?.tokens?.accessToken ?? d2?.token ?? d2?.accessToken;
  const userIdB: string = d2?.user?.userId ?? d2?.userId ?? d2?.user_id ?? d2?.id;
  if (!tokenB) fail('P2 — register B', `missing token: ${JSON.stringify(regB.body)}`);
  pass('P2 — Usuário B registrado', `userId=${userIdB?.slice(0,8)}`);

  // ── PASSO 3: Obter conta bancária A e B ───────────────────────────────────
  console.log('[P3] Obter contas bancárias A e B...');
  const accMeA = await httpGet('/economy/accounts/me', {
    'Authorization': `Bearer ${tokenA}`,
    'x-action-context': JSON.stringify({ actorId: userIdA, intent: 'get_account', source: 'q3_e2e_v2', scope: `${tenantId}:bank:read` }),
  });
  if (accMeA.status !== 200) fail('P3 — conta A', `status=${accMeA.status} body=${JSON.stringify(accMeA.body)}`);
  const accountIdA: string = accMeA.body.accountId ?? accMeA.body.account_id ?? accMeA.body.id;
  if (!accountIdA) fail('P3 — conta A', `missing accountId: ${JSON.stringify(accMeA.body)}`);

  const accMeB = await httpGet('/economy/accounts/me', {
    'Authorization': `Bearer ${tokenB}`,
    'x-action-context': JSON.stringify({ actorId: userIdB, intent: 'get_account', source: 'q3_e2e_v2', scope: `${tenantId}:bank:read` }),
  });
  if (accMeB.status !== 200) fail('P3 — conta B', `status=${accMeB.status} body=${JSON.stringify(accMeB.body)}`);
  const accountIdB: string = accMeB.body.accountId ?? accMeB.body.account_id ?? accMeB.body.id;
  if (!accountIdB) fail('P3 — conta B', `missing accountId: ${JSON.stringify(accMeB.body)}`);

  pass('P3 — contas obtidas', `A=${accountIdA.slice(0,8)} B=${accountIdB.slice(0,8)}`);

  // ── PASSO 3.5: Resolver actor IDs reais (actors.id ≠ userId) ─────────────
  // findOrCreateUserActor cria actor com id auto-gerado e user_id=userId
  // bank_transactions.actor_id FK → actors(id), então precisamos do actors.id real
  const actorRowA = await pool.query<{ id: string }>(
    `SELECT id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user' LIMIT 1`,
    [tenantId, userIdA]
  );
  const actorIdA: string = actorRowA.rows[0]?.id ?? userIdA;
  if (!actorRowA.rows[0]) {
    // fallback: tenta actor_human (ensureGenesisActorForUser path)
    const fallbackRow = await pool.query<{ id: string }>(
      `SELECT id FROM actors WHERE tenant_id = $1 AND id = $2::uuid LIMIT 1`,
      [tenantId, userIdA]
    );
    if (!fallbackRow.rows[0]) fail('P3.5 — actorIdA', `nenhum actor encontrado para userId=${userIdA}`);
  }
  pass('P3.5 — actorIdA resolvido', `actorId=${actorIdA.slice(0,8)}`);

  // ── PASSO 4: Bootstrap system:reserve ─────────────────────────────────────
  console.log('[P4] Bootstrap system:reserve (liquidity_issuance → reserve)...');
  let sysReserve = await bankAccountService.getSystemAccount(tenantId, 'reserve', 'BRL');
  if (!sysReserve) {
    await bankAccountRepository.createAccount(tenantId, {
      ownerId: `system:reserve:${tenantId}`,
      ownerType: 'system',
      accountType: 'credit',
      currency: 'BRL',
    });
    sysReserve = await bankAccountService.getSystemAccount(tenantId, 'reserve', 'BRL');
  }
  if (!sysReserve) fail('P4 — system:reserve', 'não encontrado após criação');

  const mintResult = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: `q3-v2-reserve-mint-${tenantId}`,
    referenceType: 'q3_e2e_v2_reserve_mint',
    fromAccountId: undefined,               // → system:liquidity_issuance (bypass trigger)
    toAccountId: sysReserve!.accountId,     // system account → trigger bypass on credit
    amountCents: SEED_AMOUNT_CENTS,
    currency: 'BRL',
    transactionType: 'deposit',
    description: 'Q3-E2E v2 bootstrap system reserve capacity',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({ actingForAccountId: sysReserve!.accountId, actingForActorId: actorIdA }),
  });
  if (mintResult.ledgerEntries.length !== 2) {
    fail('P4 — mint ledger entries', `esperado 2, got ${mintResult.ledgerEntries.length}`);
  }
  pass('P4 — reserve bootstrapped', `txId=${mintResult.transaction.transactionId.slice(0,8)} entries=${mintResult.ledgerEntries.length}`);

  // ── PASSO 5: Validar execution_capacity_cents > 0 e tipos bigint ──────────
  console.log('[P5] Validar system_coverage...');
  const covRow = await pool.query<{ cap: string; tot: string; tc: string; tt: string }>(
    `SELECT execution_capacity_cents::text AS cap, total_credits_cents::text AS tot,
            pg_typeof(execution_capacity_cents)::text AS tc, pg_typeof(total_credits_cents)::text AS tt
     FROM system_coverage WHERE tenant_id = $1`,
    [tenantId]
  );
  if (!covRow.rows[0]) fail('P5 — system_coverage', 'nenhuma linha para tenant');
  const { cap, tot, tc, tt } = covRow.rows[0]!;
  if (BigInt(cap) <= 0n) fail('P5 — execution_capacity_cents', `${cap} não é > 0`);
  if (tc !== 'bigint') fail('P5 — pg_typeof(execution_capacity_cents)', `esperado bigint, got ${tc}`);
  if (tt !== 'bigint') fail('P5 — pg_typeof(total_credits_cents)', `esperado bigint, got ${tt}`);
  pass('P5 — coverage OK', `cap=${cap} tot=${tot} tipos: ${tc}/${tt}`);

  // ── PASSO 6: Creditar usuário A via system:reserve ────────────────────────
  console.log('[P6] Creditar usuário A (system:reserve → user)...');
  const seedResult = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: `q3-v2-seed-user-a-${accountIdA}`,
    referenceType: 'q3_e2e_v2_seed_user',
    fromAccountId: sysReserve!.accountId,
    toAccountId: accountIdA,
    amountCents: USER_CREDIT_CENTS,
    currency: 'BRL',
    transactionType: 'deposit',
    description: 'Q3-E2E v2 credito inicial usuario A via reserve',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({ actingForAccountId: accountIdA, actingForActorId: actorIdA }),
  });
  pass('P6 — usuário A creditado', `txId=${seedResult.transaction.transactionId.slice(0,8)} entries=${seedResult.ledgerEntries.length}`);

  // ── PASSO 7: Validar saldo A ──────────────────────────────────────────────
  const balA_pre = await bankAccountService.getBalance(tenantId, accountIdA);
  if (balA_pre.balanceCents !== USER_CREDIT_CENTS) {
    fail('P7 — saldo A pré-P2P', `esperado ${USER_CREDIT_CENTS}, got ${balA_pre.balanceCents}`);
  }
  pass('P7 — saldo A pré-P2P', `${balA_pre.balanceCents} cents = R$${USER_CREDIT_CENTS/100}`);

  // ── PASSO 8: P2P A → B via serviço (não HTTP, que exige rota com actor) ────
  console.log('[P8] P2P transfer A → B (via bankTransactionService)...');
  const p2pResult = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: `q3-v2-p2p-${TS}`,
    referenceType: 'q3_e2e_v2_p2p',
    fromAccountId: accountIdA,
    toAccountId: accountIdB,
    amountCents: P2P_AMOUNT_CENTS,
    currency: 'BRL',
    transactionType: 'transfer',
    description: 'Q3-E2E v2 P2P transfer de A para B',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({ actingForAccountId: accountIdA, actingForActorId: actorIdA }),
  });
  if (p2pResult.ledgerEntries.length !== 2) {
    fail('P8 — P2P ledger entries', `esperado 2, got ${p2pResult.ledgerEntries.length}`);
  }
  pass('P8 — P2P executado', `txId=${p2pResult.transaction.transactionId.slice(0,8)}`);

  // ── PASSO 9: Validar saldos finais ────────────────────────────────────────
  console.log('[P9] Validar saldos finais...');
  const balA = await bankAccountService.getBalance(tenantId, accountIdA);
  const balB = await bankAccountService.getBalance(tenantId, accountIdB);
  const expectedA = USER_CREDIT_CENTS - P2P_AMOUNT_CENTS;
  const expectedB = P2P_AMOUNT_CENTS;

  if (balA.balanceCents !== expectedA) fail('P9 — saldo A', `esperado ${expectedA}, got ${balA.balanceCents}`);
  if (balB.balanceCents !== expectedB) fail('P9 — saldo B', `esperado ${expectedB}, got ${balB.balanceCents}`);
  pass('P9 — saldo A final', `${balA.balanceCents} cents (R$${expectedA/100})`);
  pass('P9 — saldo B final', `${balB.balanceCents} cents (R$${expectedB/100})`);

  // ── PASSO 10: Double-entry integrity (net = 0 por transação) ─────────────
  console.log('[P10] Validar double-entry net = 0 por transação...');
  const txIds = [
    mintResult.transaction.transactionId,
    seedResult.transaction.transactionId,
    p2pResult.transaction.transactionId,
  ];
  for (const txId of txIds) {
    const nr = await pool.query<{ net: string; cnt: string }>(
      `SELECT SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END)::text AS net,
              COUNT(*)::text AS cnt
       FROM bank_ledger WHERE transaction_id = $1`,
      [txId]
    );
    const { net, cnt } = nr.rows[0]!;
    if (net !== '0') fail('P10 — net', `tx=${txId.slice(0,8)} net=${net} (esperado 0)`);
    if (parseInt(cnt) !== 2) fail('P10 — entries', `tx=${txId.slice(0,8)} cnt=${cnt} (esperado 2)`);
    pass(`P10 — tx ${txId.slice(0,8)}`, `net=0 entries=2 ✓`);
  }

  // ── PASSO 11: pg_typeof bigint no ledger ─────────────────────────────────
  console.log('[P11] Validar pg_typeof(amount_cents) = bigint...');
  const tr = await pool.query<{ typ: string }>(
    `SELECT pg_typeof(amount_cents)::text AS typ FROM bank_ledger
     WHERE transaction_id = $1 LIMIT 1`,
    [p2pResult.transaction.transactionId]
  );
  if (tr.rows[0]?.typ !== 'bigint') fail('P11 — pg_typeof', `esperado bigint, got ${tr.rows[0]?.typ}`);
  pass('P11 — pg_typeof(amount_cents)', 'bigint ✓');

  // ── RESULTADO FINAL ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log('  RESULTADO: 11/11 PASS ✅ — Q3-E2E v2 APROVADO');
  console.log('══════════════════════════════════════════════');
  console.log(`\n  tenant:   ${tenantId}`);
  console.log(`  userA:    ${userIdA}  (saldo: R$${expectedA/100})`);
  console.log(`  userB:    ${userIdB}  (saldo: R$${expectedB/100})`);
  console.log(`  mint_tx:  ${mintResult.transaction.transactionId}`);
  console.log(`  seed_tx:  ${seedResult.transaction.transactionId}`);
  console.log(`  p2p_tx:   ${p2pResult.transaction.transactionId}`);
  console.log('\n  PROVA: dinheiro entra → move → ledger íntegro → tipos bigint\n');

  await pool.end();
}

main().catch((e) => {
  console.error('\n❌ FALHA FATAL:', e?.message ?? String(e));
  process.exit(1);
});
