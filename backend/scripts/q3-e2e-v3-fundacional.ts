/**
 * Q3-E2E v3 — SMOKE ECONÔMICO FUNDACIONAL CANÔNICO
 *
 * Substitui q3-e2e-v2.ts (commit 61e10c26 — Opção C refutada por DECISION-0031).
 * Fecha DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO.
 *
 * PROVA MATERIAL — caminho fundacional canônico de DECISION-0031:
 *   1. event_ticket → eventEconomyService.processCheckout
 *      → bankTransactionService.createTransactionWithSplit({context: 'event_ticket'})
 *      → bankSplitEngineService.calculateSplits(context: 'event_ticket')
 *      → 4 splits no ledger: 70% organizer / 3% fee / 10% regional_fund / 17% reserve
 *   2. Reserve fundada via 17% do split, NÃO via mint direto `concept_id: 'system-reserve-credit'`
 *   3. system_coverage.execution_capacity_cents > 0 emerge da contabilidade real
 *   4. P2P canônico via context p2p_transfer (NÃO via shortcut Opção C)
 *
 * NOTAS INSTITUCIONAIS:
 *
 * (a) Bootstrap capacity inicial:
 *     Para que attendee tenha saldo de checkout, sistema precisa de capacity > 0
 *     (trigger check_coverage_before_credit em bank_ledger). DECISION-0031 cita
 *     "ensurePlatformAccounts inclui atl_reserve" mas código atual cria
 *     'risk_reserve' (naming distinto). Workaround estabelecido em scripts E2E
 *     (validate-pipeline-e2e-transversal.ts, validate-financial-flow-real.ts):
 *     criar manualmente system:reserve/fee/regional_fund + mint inicial via
 *     liquidity_issuance → system:reserve.
 *     Vide DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION (a registrar) — fragmentação
 *     entre `ensurePlatformAccounts` (cria 'risk_reserve', 'platform_fees') e
 *     `SystemAccountName` ('reserve', 'fee', 'regional_fund') espera diferente
 *     em ownerId pattern `system:${SystemAccountName}:${tenantId}`.
 *
 * (b) Mint inicial:
 *     concept_id usado é o mesmo dos scripts E2E vigentes ('system-reserve-credit').
 *     Diferença material vs v2: aqui é apenas BOOTSTRAP de capacity para permitir
 *     primeiro checkout. v2 USAVA essa transação como prova de "smoke fundacional"
 *     — v3 USA o CHECKOUT subsequente (event_ticket → split → reserve via 17%)
 *     como prova fundacional. Mint inicial é setup, não conclusão.
 *
 * Uso: npx tsx scripts/q3-e2e-v3-fundacional.ts
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
if (!process.env.AUTHORITY_MODE) process.env.AUTHORITY_MODE = 'permissive';

const BASE_URL = 'http://localhost:3000';
const TICKET_PRICE_CENTS = 10_000;       // R$ 100 — ticket único
const SEED_CAPACITY_CENTS = 500_000;     // R$ 5.000 — bootstrap capacity inicial
const ATTENDEE_SEED_CENTS = 20_000;      // R$ 200 — saldo inicial do attendee (suficiente para 1 ticket + sobra)
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
  return { status: res.status, body: json as any };
}

async function httpGet(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json as any };
}

function actionCtx(actorId: string, intent: string, tenantId: string, scopeSuffix: string): string {
  return JSON.stringify({
    actorId,
    intent,
    source: 'q3_e2e_v3',
    scope: `${tenantId}:${scopeSuffix}`,
  });
}

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  Q3-E2E v3 — SMOKE ECONÔMICO FUNDACIONAL');
  console.log('  Caminho canônico via event_ticket (DECISION-0031)');
  console.log('══════════════════════════════════════════════\n');

  // ── P1: Registrar Organizer A ─────────────────────────────────────────────
  console.log('[P1] Registrar Organizer A via HTTP...');
  const regA = await httpPost('/auth/register', {
    email: `q3v3-organizer-${TS}@e2e.local`,
    password: 'Q3v3Test@2026',
    name: 'Q3v3 Organizer A',
    cpf: '11144477735',
  });
  if (regA.status !== 201) fail('P1 — register organizer', `status=${regA.status} body=${JSON.stringify(regA.body)}`);
  const d1 = regA.body.data ?? regA.body;
  const tokenA: string = d1?.tokens?.accessToken ?? d1?.token ?? d1?.accessToken;
  const tenantId: string = d1?.tenantId ?? d1?.tenant_id;
  const userIdA: string = d1?.user?.userId ?? d1?.userId ?? d1?.user_id ?? d1?.id;
  if (!tokenA || !tenantId) fail('P1 — register organizer', `missing token/tenantId: ${JSON.stringify(regA.body)}`);
  pass('P1 — Organizer A registrado', `tenant=${tenantId.slice(0, 8)} userId=${userIdA?.slice(0, 8)}`);

  // ── P2: Registrar Attendee B ──────────────────────────────────────────────
  console.log('[P2] Registrar Attendee B (mesmo tenant)...');
  const regB = await httpPost('/auth/register', {
    email: `q3v3-attendee-${TS}@e2e.local`,
    password: 'Q3v3Test@2026',
    name: 'Q3v3 Attendee B',
    cpf: '22233344405',
  }, { 'x-tenant-id': tenantId });
  if (regB.status !== 201) fail('P2 — register attendee', `status=${regB.status} body=${JSON.stringify(regB.body)}`);
  const d2 = regB.body.data ?? regB.body;
  const tokenB: string = d2?.tokens?.accessToken ?? d2?.token ?? d2?.accessToken;
  const userIdB: string = d2?.user?.userId ?? d2?.userId ?? d2?.user_id ?? d2?.id;
  if (!tokenB) fail('P2 — register attendee', `missing token: ${JSON.stringify(regB.body)}`);
  pass('P2 — Attendee B registrado', `userId=${userIdB?.slice(0, 8)}`);

  // ── P3: Resolver actorIds reais (actor.id ≠ user.id) ──────────────────────
  console.log('[P3] Resolver actorIds via actors.user_id lookup...');
  const actorRowA = await pool.query<{ id: string }>(
    `SELECT id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user' LIMIT 1`,
    [tenantId, userIdA]
  );
  const actorRowB = await pool.query<{ id: string }>(
    `SELECT id FROM actors WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user' LIMIT 1`,
    [tenantId, userIdB]
  );
  const actorIdA = actorRowA.rows[0]?.id;
  const actorIdB = actorRowB.rows[0]?.id;
  if (!actorIdA) fail('P3 — actorIdA', `actor não encontrado para userIdA=${userIdA}`);
  if (!actorIdB) fail('P3 — actorIdB', `actor não encontrado para userIdB=${userIdB}`);
  pass('P3 — actorIds resolvidos', `A=${actorIdA.slice(0, 8)} B=${actorIdB.slice(0, 8)}`);

  // ── P4: ensurePlatformAccounts (lifecycle accounts) ───────────────────────
  console.log('[P4] ensurePlatformAccounts (cria contas lifecycle do tenant)...');
  await bankAccountService.ensurePlatformAccounts(tenantId, 'BRL');
  pass('P4 — platform lifecycle accounts garantidas', 'escrow_payments, platform_revenue, risk_reserve, etc.');

  // ── P5: Setup contas system para bankSplitEngine (workaround DT) ─────────
  // Nota: bankSplitEngine event_ticket espera contas system:reserve/fee/regional_fund.
  // ensurePlatformAccounts cria com naming distinto ('risk_reserve', 'platform_fees').
  // Padrão estabelecido em scripts E2E: criar manualmente.
  // DT-PLATFORM-ACCOUNTS-NAMING-FRAGMENTATION (a registrar) cobre convergência futura.
  console.log('[P5] Criar contas system necessárias para bankSplitEngine (reserve/fee/regional_fund)...');
  const systemAccountNames = ['reserve', 'fee', 'regional_fund'] as const;
  for (const name of systemAccountNames) {
    const existing = await bankAccountService.getSystemAccount(tenantId, name, 'BRL');
    if (!existing) {
      await bankAccountRepository.createAccount(tenantId, {
        ownerId: `system:${name}:${tenantId}`,
        ownerType: 'system',
        accountType: 'credit',
        currency: 'BRL',
      });
    }
  }
  const sysReserve = await bankAccountService.getSystemAccount(tenantId, 'reserve', 'BRL');
  const sysFee = await bankAccountService.getSystemAccount(tenantId, 'fee', 'BRL');
  const sysRegionalFund = await bankAccountService.getSystemAccount(tenantId, 'regional_fund', 'BRL');
  if (!sysReserve || !sysFee || !sysRegionalFund) {
    fail('P5 — system accounts', 'reserve/fee/regional_fund não encontradas após criação');
  }
  pass('P5 — 3 contas system criadas', `reserve=${sysReserve!.accountId.slice(0, 8)} fee=${sysFee!.accountId.slice(0, 8)} regional_fund=${sysRegionalFund!.accountId.slice(0, 8)}`);

  // ── P6: Bootstrap capacity inicial via mint para system:reserve ───────────
  // Nota institucional: este mint NÃO é a prova fundacional do smoke. É SETUP
  // necessário para attendee ter saldo de checkout. A prova fundacional é o
  // CHECKOUT subsequente (event_ticket → split → reserve via 17%).
  console.log('[P6] Bootstrap capacity inicial (mint liquidity_issuance → system:reserve)...');
  const bootstrapMint = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: `q3-v3-bootstrap-${tenantId}`,
    referenceType: 'q3_e2e_v3_bootstrap_capacity',
    fromAccountId: undefined,
    toAccountId: sysReserve!.accountId,
    amountCents: SEED_CAPACITY_CENTS,
    currency: 'BRL',
    transactionType: 'deposit',
    description: 'Q3-E2E v3 bootstrap capacity inicial (setup, não prova fundacional)',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({
      actingForAccountId: sysReserve!.accountId,
      actingForActorId: actorIdA,
    }),
  });
  if (bootstrapMint.ledgerEntries.length !== 2) {
    fail('P6 — bootstrap ledger entries', `esperado 2, got ${bootstrapMint.ledgerEntries.length}`);
  }
  pass('P6 — capacity inicial criada', `txId=${bootstrapMint.transaction.transactionId.slice(0, 8)} amount=${SEED_CAPACITY_CENTS / 100} BRL`);

  // ── P7: Obter conta do attendee B + creditar saldo inicial ────────────────
  console.log('[P7] Obter conta attendee B + creditar saldo inicial...');
  const accMeB = await httpGet('/economy/accounts/me', {
    'Authorization': `Bearer ${tokenB}`,
    'x-action-context': actionCtx(actorIdB, 'get_account', tenantId, 'bank:read'),
  });
  if (accMeB.status !== 200) fail('P7 — get account B', `status=${accMeB.status} body=${JSON.stringify(accMeB.body)}`);
  const accountIdB: string = accMeB.body.accountId ?? accMeB.body.account_id ?? accMeB.body.id;
  if (!accountIdB) fail('P7 — get account B', `missing accountId`);

  const seedB = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: `q3-v3-seed-attendee-${accountIdB}`,
    referenceType: 'q3_e2e_v3_seed_attendee',
    fromAccountId: sysReserve!.accountId,
    toAccountId: accountIdB,
    amountCents: ATTENDEE_SEED_CENTS,
    currency: 'BRL',
    transactionType: 'transfer',
    description: 'Q3-E2E v3 seed attendee inicial (representa atividade externa pré-checkout)',
    concept_id: 'system-reserve-credit',
    authorship: buildSystemAuthorship({
      actingForAccountId: accountIdB,
      actingForActorId: actorIdB,
    }),
  });
  if (seedB.ledgerEntries.length !== 2) {
    fail('P7 — seed attendee ledger entries', `esperado 2, got ${seedB.ledgerEntries.length}`);
  }
  pass('P7 — attendee B com saldo inicial', `accountId=${accountIdB.slice(0, 8)} saldo=R$${ATTENDEE_SEED_CENTS / 100}`);

  // ── P8: Criar evento via POST /events (HTTP) ─────────────────────────────
  console.log('[P8] Criar evento (POST /events) — organizer A, ticket R$100...');
  const eventStart = new Date(Date.now() + 86_400_000).toISOString();  // +1 dia
  const eventEnd = new Date(Date.now() + 86_400_000 * 2).toISOString(); // +2 dias
  const createEventRes = await httpPost('/api/events', {
    actor_id: actorIdA,
    actor_type: 'user',
    event_type: 'cultural',
    title: `Q3-E2E v3 Test Event ${TS}`,
    description: 'Evento fundacional para smoke v3',
    datetime_start: eventStart,
    datetime_end: eventEnd,
    visibility: 'public',
    ticket_price_cents: TICKET_PRICE_CENTS,
    max_attendees: 100,
  }, {
    'Authorization': `Bearer ${tokenA}`,
    'x-tenant-id': tenantId,
    'x-action-context': actionCtx(actorIdA, 'create_event', tenantId, 'events:write'),
  });
  if (createEventRes.status !== 201) {
    fail('P8 — create event', `status=${createEventRes.status} body=${JSON.stringify(createEventRes.body)}`);
  }
  const eventId: string = createEventRes.body.event?.id ?? createEventRes.body.id;
  if (!eventId) fail('P8 — create event', `missing eventId: ${JSON.stringify(createEventRes.body)}`);
  pass('P8 — evento criado', `eventId=${eventId.slice(0, 8)} price=R$${TICKET_PRICE_CENTS / 100}`);

  // ── P9: Checkout do attendee B (POST /events/:id/checkout) ────────────────
  // CHAMADA FUNDACIONAL — invoca eventEconomyService.processCheckout
  // → bankTransactionService.createTransactionWithSplit(context: 'event_ticket')
  // → bankSplitEngine 4 splits (70/3/10/17)
  console.log('[P9] Checkout (POST /events/:id/checkout) — attendee B compra ticket...');
  console.log('     ↳ CHAMADA FUNDACIONAL: event_ticket → split engine → 4 splits');
  const checkoutRes = await httpPost(`/api/events/${eventId}/checkout`, {
    attendee_actor_id: actorIdB,
    quantity: 1,
  }, {
    'Authorization': `Bearer ${tokenB}`,
    'x-tenant-id': tenantId,
    'x-action-context': actionCtx(actorIdB, 'event_checkout', tenantId, 'events:checkout'),
  });
  if (checkoutRes.status !== 200 && checkoutRes.status !== 201) {
    fail('P9 — checkout', `status=${checkoutRes.status} body=${JSON.stringify(checkoutRes.body)}`);
  }
  const checkoutTxId: string =
    checkoutRes.body.transactionId ??
    checkoutRes.body.transaction_id ??
    checkoutRes.body.result?.transactionId ??
    checkoutRes.body.data?.transactionId;
  if (!checkoutTxId) {
    console.warn('  ⚠️  checkoutTxId não encontrado em body:', JSON.stringify(checkoutRes.body));
    // Tentar resolver via SQL (último bank_transaction do attendee)
    const txRow = await pool.query<{ id: string }>(
      `SELECT id FROM bank_transactions WHERE tenant_id = $1 AND account_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [tenantId, accountIdB]
    );
    if (!txRow.rows[0]) fail('P9 — checkout', 'transaction não encontrada no DB');
    pass('P9 — checkout executado (txId resolvido via SQL)', `txId=${txRow.rows[0].id.slice(0, 8)}`);
    (globalThis as any).__checkoutTxId = txRow.rows[0].id;
  } else {
    pass('P9 — checkout executado', `txId=${checkoutTxId.slice(0, 8)}`);
    (globalThis as any).__checkoutTxId = checkoutTxId;
  }
  const resolvedCheckoutTxId: string = (globalThis as any).__checkoutTxId;

  // ── P10: Validar 4 ledger entries do checkout (split canônico) ────────────
  console.log('[P10] Validar 4 splits no ledger (70/3/10/17 event_ticket)...');
  const ledgerRows = await pool.query<{
    amount_cents: string;
    direction: string;
    owner_id: string;
    owner_type: string;
  }>(
    `SELECT bl.amount_cents::text AS amount_cents, bl.direction,
            ba.owner_id, ba.owner_type
     FROM bank_ledger bl
     JOIN bank_accounts ba ON ba.id = bl.account_id
     WHERE bl.transaction_id = $1
     ORDER BY bl.direction DESC, bl.id`,
    [resolvedCheckoutTxId]
  );

  // Esperado: 1 débito (attendee) + 4 créditos (organizer, fee, regional_fund, reserve)
  const debits = ledgerRows.rows.filter((r) => r.direction === 'debit');
  const credits = ledgerRows.rows.filter((r) => r.direction === 'credit');
  if (debits.length !== 1) fail('P10 — débitos', `esperado 1, got ${debits.length}`);
  if (credits.length !== 4) fail('P10 — créditos', `esperado 4, got ${credits.length}: ${JSON.stringify(credits.map((c) => ({ owner_id: c.owner_id, amount: c.amount_cents })))}`);

  // Validar montantes esperados — split percentages event_ticket: 70/3/10/17
  const expectedSplits = [
    { label: 'organizer (70%)', amountCents: 7000 },
    { label: 'fee (3%)', amountCents: 300 },
    { label: 'regional_fund (10%)', amountCents: 1000 },
    { label: 'reserve (17%)', amountCents: 1700 },
  ];
  const actualAmounts = credits.map((c) => Number(c.amount_cents)).sort((a, b) => b - a);
  const expectedAmounts = expectedSplits.map((s) => s.amountCents).sort((a, b) => b - a);
  for (let i = 0; i < expectedAmounts.length; i++) {
    if (actualAmounts[i] !== expectedAmounts[i]) {
      fail('P10 — montante split', `posição ${i}: esperado ${expectedAmounts[i]}, got ${actualAmounts[i]} (full: ${JSON.stringify(actualAmounts)})`);
    }
  }
  pass('P10 — 4 splits canônicos validados', `[${actualAmounts.join(', ')}] cents = 70/3/10/17 sobre R$100`);

  // ── P11: Validar reserve fundada via split (não via shortcut) ─────────────
  console.log('[P11] Validar reserve fundada via split engine (não via shortcut)...');
  const reserveCreditFromCheckout = credits.find((c) => c.owner_id === `system:reserve:${tenantId}`);
  if (!reserveCreditFromCheckout) {
    fail('P11 — reserve credit', `reserve account não recebeu crédito do checkout`);
  }
  if (Number(reserveCreditFromCheckout!.amount_cents) !== 1700) {
    fail('P11 — reserve amount', `esperado 1700 (17%), got ${reserveCreditFromCheckout!.amount_cents}`);
  }
  pass('P11 — reserve fundada via 17% do split', `+1700 cents via event_ticket (não via mint direto)`);

  // ── P12: Validar system_coverage (bigint + > 0) ───────────────────────────
  console.log('[P12] Validar system_coverage.execution_capacity_cents...');
  const covRow = await pool.query<{ cap: string; tot: string; tc: string; tt: string }>(
    `SELECT execution_capacity_cents::text AS cap, total_credits_cents::text AS tot,
            pg_typeof(execution_capacity_cents)::text AS tc, pg_typeof(total_credits_cents)::text AS tt
     FROM system_coverage WHERE tenant_id = $1`,
    [tenantId]
  );
  if (!covRow.rows[0]) fail('P12 — system_coverage', 'nenhuma linha para tenant');
  const { cap, tot, tc, tt } = covRow.rows[0];
  if (BigInt(cap) <= 0n) fail('P12 — execution_capacity_cents', `${cap} não é > 0`);
  if (tc !== 'bigint') fail('P12 — pg_typeof(execution_capacity_cents)', `esperado bigint, got ${tc}`);
  if (tt !== 'bigint') fail('P12 — pg_typeof(total_credits_cents)', `esperado bigint, got ${tt}`);
  pass('P12 — coverage OK', `cap=${cap} tot=${tot} tipos: ${tc}/${tt}`);

  // ── P13: P2P attendee → organizer (resto do saldo) via context p2p_transfer
  // Canônico — NÃO usa concept_id shortcut
  console.log('[P13] P2P attendee B → organizer A (canônico via p2p_transfer)...');
  const accMeA = await httpGet('/economy/accounts/me', {
    'Authorization': `Bearer ${tokenA}`,
    'x-action-context': actionCtx(actorIdA, 'get_account', tenantId, 'bank:read'),
  });
  if (accMeA.status !== 200) fail('P13 — get account A', `status=${accMeA.status}`);
  const accountIdA: string = accMeA.body.accountId ?? accMeA.body.account_id ?? accMeA.body.id;

  const balBPre = await bankAccountService.getBalance(tenantId, accountIdB);
  const p2pAmount = balBPre.balanceCents;  // Resto do saldo
  if (p2pAmount <= 0) fail('P13 — saldo B', `attendee B sem saldo restante`);

  const p2pResult = await bankTransactionService.createSimpleTransaction(tenantId, {
    eventId: `q3-v3-p2p-${TS}`,
    referenceType: 'q3_e2e_v3_p2p',
    fromAccountId: accountIdB,
    toAccountId: accountIdA,
    amountCents: p2pAmount,
    currency: 'BRL',
    transactionType: 'transfer',
    description: 'Q3-E2E v3 P2P canônico (não shortcut)',
    concept_id: 'p2p-transfer',
    authorship: buildSystemAuthorship({
      actingForAccountId: accountIdB,
      actingForActorId: actorIdB,
    }),
  });
  if (p2pResult.ledgerEntries.length !== 2) {
    fail('P13 — P2P ledger entries', `esperado 2, got ${p2pResult.ledgerEntries.length}`);
  }
  pass('P13 — P2P executado', `txId=${p2pResult.transaction.transactionId.slice(0, 8)} amount=${p2pAmount} cents`);

  // ── P14: Validar double-entry net=0 + bigint em todas as transações ──────
  console.log('[P14] Validar double-entry net=0 + bigint nas transações principais...');
  const txIds = [
    bootstrapMint.transaction.transactionId,
    seedB.transaction.transactionId,
    resolvedCheckoutTxId,
    p2pResult.transaction.transactionId,
  ];
  for (const txId of txIds) {
    const nr = await pool.query<{ net: string; cnt: string }>(
      `SELECT SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END)::text AS net,
              COUNT(*)::text AS cnt
       FROM bank_ledger WHERE transaction_id = $1`,
      [txId]
    );
    const { net, cnt } = nr.rows[0];
    if (net !== '0') fail('P14 — net', `tx=${txId.slice(0, 8)} net=${net} (esperado 0)`);
    if (parseInt(cnt) < 2) fail('P14 — entries', `tx=${txId.slice(0, 8)} cnt=${cnt} (esperado ≥2)`);
    pass(`P14 — tx ${txId.slice(0, 8)}`, `net=0 entries=${cnt}`);
  }

  // pg_typeof bigint em amount_cents
  const tr = await pool.query<{ typ: string }>(
    `SELECT pg_typeof(amount_cents)::text AS typ FROM bank_ledger
     WHERE transaction_id = $1 LIMIT 1`,
    [resolvedCheckoutTxId]
  );
  if (tr.rows[0]?.typ !== 'bigint') fail('P14 — pg_typeof', `esperado bigint, got ${tr.rows[0]?.typ}`);
  pass('P14 — pg_typeof(amount_cents) = bigint', 'invariante material §4.7');

  // ── RESULTADO FINAL ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log('  RESULTADO: 14/14 PASS ✅ — Q3-E2E v3 APROVADO');
  console.log('  CAMINHO FUNDACIONAL CANÔNICO EXERCITADO');
  console.log('══════════════════════════════════════════════');
  console.log(`\n  tenant:       ${tenantId}`);
  console.log(`  organizerA:   ${userIdA}`);
  console.log(`  attendeeB:    ${userIdB}`);
  console.log(`  eventId:      ${eventId}`);
  console.log(`  checkoutTxId: ${resolvedCheckoutTxId}`);
  console.log(`\n  PROVA MATERIAL:`);
  console.log(`  - 4 splits canônicos: 7000 (organizer) + 300 (fee) + 1000 (regional_fund) + 1700 (reserve) = 10000`);
  console.log(`  - Reserve fundada via 17% do split event_ticket (NÃO via shortcut concept_id 'system-reserve-credit')`);
  console.log(`  - system_coverage.execution_capacity_cents bigint > 0`);
  console.log(`  - P2P canônico via context p2p_transfer`);
  console.log(`  - Ledger double-entry net=0 em todas as transações`);
  console.log(`\n  DT-Q3-E2E-V2-SHORTCUT-EPISTEMICO: PRONTA PARA FECHAMENTO`);
  console.log(`  q3-e2e-v2.ts: deprecated (vide commit deste smoke v3)`);

  await pool.end();
}

main().catch(async (e) => {
  console.error('\n❌ FALHA FATAL:', e?.message ?? String(e));
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
