/**
 * E2E PE-3 — service_execution USA economic_policy_engine antes da actor_wallet
 * (DECISION-0048, 2026-05-26)
 *
 * Prova material que:
 *   - cliente paga valor BRUTO
 *   - economic_policy_engine resolve policy ativa
 *   - Bank materializa splits canônicos em UMA bank_transaction:
 *     revenue_share → escrow_payments (espera D-money)
 *     platform_fee  → conta system platform_fees
 *     reserve       → conta system risk_reserve
 *   - payment_intent.metadata.splits contém APENAS revenue_share
 *   - D-money posterior move SÓ revenue_share para actor_wallet do worker
 *   - actor_wallet NUNCA recebe fee/reserve/etc
 *   - Ausência de policy / ambiguidade FALHA fechado (sem dinheiro escrito)
 *   - Caminho legacy (input.splits explícito) continua funcionando
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-policy-engine-service-execution.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

import { pool, getClientWithTenant } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { servicePaymentExecutionService } from '../modules/services/service-payment-execution.service';
import { serviceOrderService } from '../modules/services/service-order.service';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const POLICY_MODULE = 'service_execution';
const POLICY_CODE_PREFIX = 'pe3_e2e_';

type CheckResult = { ok: boolean; reason?: string; detail?: any };

function assertOk(label: string, r: CheckResult): void {
  if (r.ok === false) {
    console.error(`  ❌ FALHOU: ${label}`);
    if (r.reason) console.error(`     Motivo: ${r.reason}`);
    if (r.detail !== undefined) console.error(JSON.stringify(r.detail, null, 2));
    process.exit(1);
  }
  console.log(`  ✅ ${label}`);
}

async function bootstrap(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
}

interface Fixtures {
  buyerUserId: string;
  buyerActorId: string;
  workerActorId: string;
  serviceId: string;
}

async function loadFixtures(): Promise<Fixtures> {
  const usersRes = await pool.query<{ user_id: string; email: string }>(
    `SELECT user_id::text, email FROM users WHERE tenant_id = $1
      AND email IN ('g2-buyer@e2e.internal', 'g2-provider@e2e.internal')`,
    [TENANT_ID]
  );
  const buyer = usersRes.rows.find((r) => r.email === 'g2-buyer@e2e.internal');
  const provider = usersRes.rows.find((r) => r.email === 'g2-provider@e2e.internal');
  if (!buyer || !provider) {
    throw new Error('Fixtures de users não encontradas (rode E2E transversal antes).');
  }
  const actors = await pool.query<{ user_id: string; actor_id: string }>(
    `SELECT user_id::text, id::text AS actor_id FROM actors
      WHERE tenant_id = $1 AND user_id = ANY($2::uuid[]) AND actor_type = 'user'`,
    [TENANT_ID, [buyer.user_id, provider.user_id]]
  );
  const buyerActorId = actors.rows.find((a) => a.user_id === buyer.user_id)!.actor_id;
  const workerActorId = actors.rows.find((a) => a.user_id === provider.user_id)!.actor_id;

  let serviceId: string;
  const svc = await pool.query<{ service_id: string }>(
    `SELECT service_id::text FROM services WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
    [TENANT_ID, workerActorId]
  );
  if (svc.rows[0]) {
    serviceId = svc.rows[0].service_id;
  } else {
    const newSvc = await pool.query<{ service_id: string }>(
      `INSERT INTO services (tenant_id, actor_id, name, slug, service_type, status, currency)
       VALUES ($1, $2, $3, $4, 'service', 'active', 'BRL') RETURNING service_id::text`,
      [TENANT_ID, workerActorId, 'PE-3 fixture', `pe3-${uuidv4().slice(0, 8)}`]
    );
    serviceId = newSvc.rows[0]!.service_id;
  }
  return { buyerUserId: buyer.user_id, buyerActorId, workerActorId, serviceId };
}

async function cleanupPolicies(): Promise<void> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
  await pool.query(
    `DELETE FROM economic_policies WHERE tenant_id = $1::uuid AND module_context = $2
       AND policy_code LIKE $3`,
    [TENANT_ID, POLICY_MODULE, `${POLICY_CODE_PREFIX}%`]
  );
}

async function seedPolicy(opts: {
  code: string;
  priority?: number;
  effectiveFrom?: Date;
  lines: Array<{
    lineType:
      | 'revenue_share'
      | 'platform_fee'
      | 'reserve'
      | 'referral'
      | 'group_allocation'
      | 'channel_commission'
      | 'regional_fund'
      | 'custom';
    destinationType:
      | 'receiver_actor'
      | 'actor_wallet'
      | 'platform_fees'
      | 'risk_reserve'
      | 'regional_fund'
      | 'escrow_payments'
      | 'referrer_actor_wallet'
      | 'group_wallet'
      | 'channel_actor_wallet'
      | 'custom';
    bps: number;
    priority?: number;
  }>;
}): Promise<string> {
  const policy = await economicPolicyRepository.createPolicy({
    tenantId: TENANT_ID,
    policyCode: opts.code,
    policyType: 'COMMISSION_SPLIT',
    moduleContext: POLICY_MODULE,
    vertical: 'services',
    pricingModel: 'fixed',
    settlementFlow: 'fixed_price_escrow',
    priority: opts.priority ?? 0,
    effectiveFrom: opts.effectiveFrom ?? new Date(Date.now() - 60 * 1000),
    effectiveUntil: null,
    status: 'active',
  });
  for (const ln of opts.lines) {
    await economicPolicyRepository.createPolicyLine(TENANT_ID, {
      policyId: policy.id,
      lineType: ln.lineType,
      destinationType: ln.destinationType,
      bps: ln.bps,
      priority: ln.priority ?? 0,
    });
  }
  return policy.id;
}

async function createPaymentRequest(
  fixtures: Fixtures,
  amount: number
): Promise<{ paymentRequestId: string; bookingId: string }> {
  const bookingId = uuidv4();
  const paymentRequestId = uuidv4();
  await pool.query(
    `INSERT INTO service_payment_requests (
       payment_request_id, tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id,
       status, amount, currency
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
              'pending', $7, 'BRL')`,
    [
      paymentRequestId,
      TENANT_ID,
      bookingId,
      fixtures.serviceId,
      fixtures.buyerActorId,
      fixtures.workerActorId,
      amount,
    ]
  );
  return { paymentRequestId, bookingId };
}

async function getPaymentIntentMetadata(
  paymentRequestId: string
): Promise<{ id: string; metadata: any } | null> {
  const r = await pool.query<{ id: string; metadata: any }>(
    `SELECT id::text, metadata FROM payment_intents WHERE tenant_id = $1::uuid AND reference_id = $2 LIMIT 1`,
    [TENANT_ID, paymentRequestId]
  );
  return r.rows[0] ?? null;
}

async function getBankSplits(
  paymentRequestId: string
): Promise<Array<{ split_type: string; amount_cents: string; target_account_id: string }>> {
  const r = await pool.query<{
    split_type: string;
    amount_cents: string;
    target_account_id: string;
  }>(
    `SELECT bs.split_type, bs.amount_cents::text, bs.target_account_id::text
       FROM bank_splits bs
       JOIN bank_transactions bt ON bt.id = bs.transaction_id
      WHERE bs.tenant_id = $1::uuid
        AND bt.reference_type = 'service_execution'
        AND bt.reference_id = $2
      ORDER BY bs.created_at ASC`,
    [TENANT_ID, paymentRequestId]
  );
  return r.rows;
}

async function ensurePlatformAccounts(): Promise<void> {
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');
}

async function main() {
  console.log('═══ E2E PE-3 — service_execution + economic_policy_engine ═══\n');
  await bootstrap();
  await ensurePlatformAccounts();
  const fixtures = await loadFixtures();
  console.log(
    `  ℹ  buyer=${fixtures.buyerActorId.slice(0, 8)} worker=${fixtures.workerActorId.slice(0, 8)}\n`
  );

  // ============================================================
  // T1 — POLICY_NOT_FOUND fail-closed: sem policy seedada
  // ============================================================
  console.log('=== T1 — sem policy → POLICY_NOT_FOUND fail-closed ===');
  await cleanupPolicies();
  const req1 = await createPaymentRequest(fixtures, 10000);
  let t1Caught = false;
  try {
    await servicePaymentExecutionService.createExecution(TENANT_ID, fixtures.buyerUserId, {
      paymentRequestId: req1.paymentRequestId,
    });
  } catch (e: any) {
    t1Caught = true;
    assertOk('T1.1 — createExecution falhou com POLICY_NOT_FOUND', {
      ok: /POLICY_NOT_FOUND/.test(String(e?.message)),
      reason: `mensagem esperada conter POLICY_NOT_FOUND; recebi: ${e?.message}`,
      detail: e?.message,
    });
  }
  assertOk('T1.2 — exceção foi lançada', { ok: t1Caught, reason: 'createExecution não throw' });
  const t1Intent = await getPaymentIntentMetadata(req1.paymentRequestId);
  assertOk('T1.3 — nenhum payment_intent criado (rollback institucional)', {
    ok: t1Intent === null,
    reason: 'payment_intent gravado mesmo com POLICY_NOT_FOUND',
    detail: t1Intent,
  });
  const t1Splits = await getBankSplits(req1.paymentRequestId);
  assertOk('T1.4 — nenhum bank_split criado', {
    ok: t1Splits.length === 0,
    reason: 'bank_splits gravados mesmo com POLICY_NOT_FOUND',
    detail: t1Splits,
  });

  // ============================================================
  // T2 — Policy 9700/300 → split correto + metadata.splits filtrada
  // ============================================================
  console.log('\n=== T2 — policy 9700/300 (revenue_share + platform_fee) ===');
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_CODE_PREFIX}T2_simple_97_3`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9700, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 300, priority: 1 },
    ],
  });
  const req2 = await createPaymentRequest(fixtures, 10000);
  const exec2 = await servicePaymentExecutionService.createExecution(
    TENANT_ID,
    fixtures.buyerUserId,
    { paymentRequestId: req2.paymentRequestId }
  );
  assertOk('T2.1 — execution criada', {
    ok: !!exec2.execution,
    reason: 'createExecution não retornou execution',
  });
  const splits2 = await getBankSplits(req2.paymentRequestId);
  assertOk('T2.2 — bank_splits tem 2 linhas (revenue_share + fee)', {
    ok: splits2.length === 2,
    reason: 'count != 2',
    detail: splits2,
  });
  const splitTypes2 = splits2.map((s) => s.split_type).sort();
  assertOk('T2.3 — splits têm tipos canônicos', {
    ok: JSON.stringify(splitTypes2) === JSON.stringify(['fee', 'revenue_share']),
    reason: 'tipos esperados ["fee","revenue_share"]',
    detail: splitTypes2,
  });
  const escrowAccount = (await bankAccountService.getPlatformLifecycleAccount(
    TENANT_ID,
    'escrow_payments',
    'BRL'
  ))!;
  const platformFeesAccount = (await bankAccountService.getPlatformLifecycleAccount(
    TENANT_ID,
    'platform_fees',
    'BRL'
  ))!;
  const revShareSplit2 = splits2.find((s) => s.split_type === 'revenue_share')!;
  const feeSplit2 = splits2.find((s) => s.split_type === 'fee')!;
  assertOk('T2.4 — revenue_share=9700 em escrow_payments', {
    ok:
      parseInt(revShareSplit2.amount_cents, 10) === 9700 &&
      revShareSplit2.target_account_id === escrowAccount.accountId,
    reason: 'split revenue_share incorreto',
    detail: revShareSplit2,
  });
  assertOk('T2.5 — fee=300 em platform_fees', {
    ok:
      parseInt(feeSplit2.amount_cents, 10) === 300 &&
      feeSplit2.target_account_id === platformFeesAccount.accountId,
    reason: 'split fee incorreto',
    detail: feeSplit2,
  });
  const intent2 = await getPaymentIntentMetadata(req2.paymentRequestId);
  const intentSplits2 = (intent2!.metadata?.splits ?? []) as any[];
  assertOk('T2.6 — payment_intent.metadata.splits = APENAS revenue_share (1 entrada)', {
    ok: intentSplits2.length === 1 && intentSplits2[0]?.amountCents === 9700,
    reason: 'metadata.splits contém splits não-revenue_share ou está errado',
    detail: intentSplits2,
  });
  assertOk('T2.7 — metadata.policyId/policyCode/calculatedSplits gravados (audit)', {
    ok:
      typeof intent2!.metadata?.policyId === 'string' &&
      intent2!.metadata?.policyCode === `${POLICY_CODE_PREFIX}T2_simple_97_3` &&
      Array.isArray(intent2!.metadata?.calculatedSplits) &&
      intent2!.metadata.calculatedSplits.length === 2,
    reason: 'audit metadata ausente',
    detail: intent2!.metadata,
  });

  // ============================================================
  // T3 — D-money move SÓ revenue_share para actor_wallet
  // ============================================================
  console.log('\n=== T3 — D-money libera APENAS revenue_share para actor_wallet ===');
  // criar service_order release_approved usando req2
  const orderId3 = uuidv4();
  const scheduledStart = new Date(Date.now() - 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO service_orders (
       id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id,
       status, settlement_flow,
       scheduled_start, completed_at,
       buyer_confirmation_deadline_at, release_eligible_at,
       buyer_confirmed_completion_at,
       created_by_actor_id, description, metadata
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
              'release_approved', 'fixed_price_escrow',
              $7, NOW(), NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days', NOW(),
              $4::uuid, 'PE-3 T3 order', '{}'::jsonb)`,
    [
      orderId3,
      TENANT_ID,
      fixtures.serviceId,
      fixtures.workerActorId,
      fixtures.buyerActorId,
      req2.bookingId,
      scheduledStart,
    ]
  );
  const workerWalletBefore = await bankAccountService.ensureActorWalletAccount(
    TENANT_ID,
    fixtures.workerActorId,
    'BRL'
  );
  const balanceBefore = (await bankAccountService.getBalance(TENANT_ID, workerWalletBefore.accountId))
    .balanceCents;
  const released = await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, orderId3);
  const balanceAfter = (await bankAccountService.getBalance(TENANT_ID, workerWalletBefore.accountId))
    .balanceCents;
  assertOk('T3.1 — D-money liberou exatamente 9700 (revenue_share)', {
    ok: balanceAfter - balanceBefore === 9700,
    reason: 'actor_wallet recebeu valor inesperado',
    detail: { balanceBefore, balanceAfter, diff: balanceAfter - balanceBefore, released },
  });
  const movedTotal = released.splits.reduce((s, x) => s + x.amountCents, 0);
  assertOk('T3.2 — D-money moveu exatamente 1 split totalizando 9700 (fee não vaza)', {
    ok: released.splits.length === 1 && movedTotal === 9700,
    reason: 'D-money moveu múltiplos splits ou valor inesperado',
    detail: { splitsCount: released.splits.length, movedTotal, released },
  });
  // platform_fees account não pode ter recebido nada de D-money:
  // verifica via outbox (released.splits.toAccountId nunca = platform_fees)
  const movedToPlatformFees = released.splits.some(
    (s) => s.toAccountId === platformFeesAccount.accountId
  );
  assertOk('T3.3 — nenhum split de D-money apontou para platform_fees', {
    ok: !movedToPlatformFees,
    reason: 'D-money moveu para platform_fees indevidamente',
  });

  // ============================================================
  // T4 — Multi-line (revenue_share + platform_fee + reserve)
  // ============================================================
  console.log('\n=== T4 — multi-line policy (revenue_share + platform_fee + reserve) ===');
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_CODE_PREFIX}T4_multi_line`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 500, priority: 1 },
      { lineType: 'reserve', destinationType: 'risk_reserve', bps: 500, priority: 2 },
    ],
  });
  const req4 = await createPaymentRequest(fixtures, 10000);
  await servicePaymentExecutionService.createExecution(TENANT_ID, fixtures.buyerUserId, {
    paymentRequestId: req4.paymentRequestId,
  });
  const splits4 = await getBankSplits(req4.paymentRequestId);
  assertOk('T4.1 — 3 splits criados', {
    ok: splits4.length === 3,
    reason: 'esperava 3 splits',
    detail: splits4,
  });
  const splitTypes4 = splits4.map((s) => s.split_type).sort();
  assertOk('T4.2 — tipos canônicos: fee + reserve + revenue_share', {
    ok: JSON.stringify(splitTypes4) === JSON.stringify(['fee', 'reserve', 'revenue_share']),
    reason: 'tipos esperados ["fee","reserve","revenue_share"]',
    detail: splitTypes4,
  });
  const sum4 = splits4.reduce((s, x) => s + parseInt(x.amount_cents, 10), 0);
  assertOk('T4.3 — Σ splits = 10000', { ok: sum4 === 10000, reason: 'soma diverge', detail: sum4 });
  const intent4 = await getPaymentIntentMetadata(req4.paymentRequestId);
  const intentSplits4 = (intent4!.metadata?.splits ?? []) as any[];
  assertOk('T4.4 — metadata.splits tem APENAS revenue_share (não inclui fee/reserve)', {
    ok: intentSplits4.length === 1 && intentSplits4[0]?.amountCents === 9000,
    reason: 'metadata.splits incorreta',
    detail: intentSplits4,
  });

  // ============================================================
  // T5 — Drift de arredondamento absorvido por revenue_share
  // ============================================================
  console.log('\n=== T5 — drift de arredondamento → revenue_share ===');
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_CODE_PREFIX}T5_drift`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9700, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 300, priority: 1 },
    ],
  });
  // amount=333: revenue=floor(333*9700/10000)=323, fee=floor(333*300/10000)=9,
  // soma=332, drift=1 → revenue_share[0] absorve, fica revenue=324, fee=9, total=333.
  const req5 = await createPaymentRequest(fixtures, 333);
  await servicePaymentExecutionService.createExecution(TENANT_ID, fixtures.buyerUserId, {
    paymentRequestId: req5.paymentRequestId,
  });
  const splits5 = await getBankSplits(req5.paymentRequestId);
  const sum5 = splits5.reduce((s, x) => s + parseInt(x.amount_cents, 10), 0);
  assertOk('T5.1 — Σ splits = 333 (sem perda de centavo)', {
    ok: sum5 === 333,
    reason: 'soma diverge',
    detail: splits5,
  });
  const revShare5 = splits5.find((s) => s.split_type === 'revenue_share')!;
  const fee5 = splits5.find((s) => s.split_type === 'fee')!;
  assertOk('T5.2 — revenue_share absorveu drift (>= 333 - fee)', {
    ok: parseInt(revShare5.amount_cents, 10) === 333 - parseInt(fee5.amount_cents, 10),
    reason: 'drift não foi para revenue_share',
    detail: { revShare5, fee5 },
  });

  // ============================================================
  // T6 — POLICY_AMBIGUITY fail-closed
  // ============================================================
  console.log('\n=== T6 — duas policies igualmente específicas → POLICY_AMBIGUITY ===');
  await cleanupPolicies();
  const tieFrom = new Date(Date.now() - 30 * 1000);
  await seedPolicy({
    code: `${POLICY_CODE_PREFIX}T6_a`,
    priority: 50,
    effectiveFrom: tieFrom,
    lines: [{ lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, priority: 0 }],
  });
  await seedPolicy({
    code: `${POLICY_CODE_PREFIX}T6_b`,
    priority: 50,
    effectiveFrom: tieFrom,
    lines: [{ lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, priority: 0 }],
  });
  const req6 = await createPaymentRequest(fixtures, 10000);
  let t6Caught = false;
  try {
    await servicePaymentExecutionService.createExecution(TENANT_ID, fixtures.buyerUserId, {
      paymentRequestId: req6.paymentRequestId,
    });
  } catch (e: any) {
    t6Caught = true;
    assertOk('T6.1 — createExecution falhou com POLICY_AMBIGUITY', {
      ok: /POLICY_AMBIGUITY/.test(String(e?.message)),
      reason: `esperava POLICY_AMBIGUITY; recebi: ${e?.message}`,
      detail: e?.message,
    });
  }
  assertOk('T6.2 — exceção foi lançada', { ok: t6Caught, reason: 'não throw' });
  const t6Intent = await getPaymentIntentMetadata(req6.paymentRequestId);
  assertOk('T6.3 — nenhum payment_intent criado', {
    ok: t6Intent === null,
    reason: 'payment_intent gravado mesmo com POLICY_AMBIGUITY',
    detail: t6Intent,
  });

  // ============================================================
  // T7 — Rollback: induzir falha após bank/intent dentro de tx
  // ============================================================
  console.log('\n=== T7 — rollback atômico via existingClient com ROLLBACK manual ===');
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_CODE_PREFIX}T7_rollback`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9700, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 300, priority: 1 },
    ],
  });
  const req7 = await createPaymentRequest(fixtures, 10000);
  const client7 = await getClientWithTenant(TENANT_ID);
  try {
    await client7.query('BEGIN');
    await servicePaymentExecutionService.createExecution(
      TENANT_ID,
      fixtures.buyerUserId,
      { paymentRequestId: req7.paymentRequestId },
      client7
    );
    // Falha induzida: ROLLBACK manual antes do COMMIT.
    await client7.query('ROLLBACK');
  } finally {
    client7.release();
  }
  const t7Intent = await getPaymentIntentMetadata(req7.paymentRequestId);
  assertOk('T7.1 — payment_intent NÃO foi gravado (rollback)', {
    ok: t7Intent === null,
    reason: 'payment_intent persistiu apesar do ROLLBACK',
    detail: t7Intent,
  });
  const t7Splits = await getBankSplits(req7.paymentRequestId);
  assertOk('T7.2 — bank_splits NÃO foram gravados (rollback)', {
    ok: t7Splits.length === 0,
    reason: 'bank_splits persistiram apesar do ROLLBACK',
    detail: t7Splits,
  });

  // ============================================================
  // T8 — Legacy bank_policies não é consultado
  // ============================================================
  console.log('\n=== T8 — service-payment-execution NÃO importa bank-policy.service ===');
  // cwd costuma ser C:/unificard/backend quando rodado via `npx tsx` daqui,
  // mas pode ser C:/unificard se rodado da raiz. Tenta os dois.
  const candidatePaths = [
    join(process.cwd(), 'src/modules/services/service-payment-execution.service.ts'),
    join(process.cwd(), 'backend/src/modules/services/service-payment-execution.service.ts'),
  ];
  const servicePathSpe = candidatePaths.find((p) => {
    try {
      readFileSync(p, 'utf-8');
      return true;
    } catch {
      return false;
    }
  });
  if (!servicePathSpe) {
    throw new Error(`T8: não localizou service-payment-execution.service.ts (tentei: ${candidatePaths.join(', ')})`);
  }
  const speSrc = readFileSync(servicePathSpe, 'utf-8');
  assertOk('T8.1 — service NÃO importa bank-policy.service', {
    ok: !/from\s+['"`][^'"`]*bank-policy\.service/.test(speSrc),
    reason: 'service importa bank-policy.service — guardrail deveria pegar',
  });
  assertOk('T8.2 — service importa economicPolicyEngineService (canônico)', {
    ok: /economic-policy-engine\.service/.test(speSrc),
    reason: 'service não importa economic_policy_engine',
  });

  // ============================================================
  // T9 — Legacy path: input.splits explícitos continua funcionando
  // ============================================================
  console.log('\n=== T9 — legacy: input.splits=[100%] preserva fluxo antigo ===');
  await cleanupPolicies();
  const req9 = await createPaymentRequest(fixtures, 5000);
  await servicePaymentExecutionService.createExecution(TENANT_ID, fixtures.buyerUserId, {
    paymentRequestId: req9.paymentRequestId,
    splits: [{ receiverActorId: fixtures.workerActorId, amountCents: 5000, percentage: 100 }],
  });
  const splits9 = await getBankSplits(req9.paymentRequestId);
  assertOk('T9.1 — 1 split criado (legacy path)', {
    ok: splits9.length === 1,
    reason: 'esperava 1 split legacy',
    detail: splits9,
  });
  assertOk('T9.2 — split tipo=revenue_share em escrow_payments', {
    ok:
      splits9[0]!.split_type === 'revenue_share' &&
      splits9[0]!.target_account_id === escrowAccount.accountId &&
      parseInt(splits9[0]!.amount_cents, 10) === 5000,
    reason: 'split legacy incorreto',
    detail: splits9[0],
  });
  const intent9 = await getPaymentIntentMetadata(req9.paymentRequestId);
  const intentSplits9 = (intent9!.metadata?.splits ?? []) as any[];
  assertOk('T9.3 — metadata.splits com 1 entrada (compat D-money legacy)', {
    ok: intentSplits9.length === 1 && intentSplits9[0]?.amountCents === 5000,
    reason: 'metadata.splits legacy incorreta',
    detail: intentSplits9,
  });
  assertOk('T9.4 — sem audit metadata de policy (legacy path)', {
    ok: !intent9!.metadata?.policyId,
    reason: 'legacy não deveria ter policyId',
    detail: intent9!.metadata,
  });

  // ============================================================
  // Cleanup final
  // ============================================================
  await cleanupPolicies();

  console.log(
    '\n═══ E2E PE-3 :: PASS — 9 cenários T1-T9 verdes. service_execution agora resolve policy via economic_policy_engine, fail-closed em ausência/ambiguidade, actor_wallet recebe APENAS revenue_share via D-money. ═══'
  );
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
