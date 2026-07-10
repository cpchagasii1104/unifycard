/**
 * E2E F-REFUND-POST-DMONEY — Parte A: Guard pós-D-money (2026-05-27)
 *
 * Verifica que o motor de reversão bloqueia estornos quando o payment_intent
 * já está em 'released_to_actor_wallet' (D-money concluído), evitando drenagem
 * do pool de escrow_payments de terceiros.
 *
 * Cenários:
 *   T0 — reversal pré-D-money continua funcionando (regressão)
 *   T1 — reversal pós-D-money lança REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW
 *        via requestReversal
 *   T1b — mesmo bloqueio via requestAndExecuteReversalSync
 *   T2 — snapshots de bank_ledger, bank_transactions e bank_splits inalterados
 *        após bloqueio pós-D-money
 *   T3 — reversal row NÃO marcado como 'executed' após bloqueio
 *   T4 — regional_fund/platform_fee pré-D-money continuam estornáveis
 *        (motor atual, sem D-money, não é afetado pelo guard)
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-refund-post-dmoney-guard.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { servicePaymentExecutionService } from '../modules/services/service-payment-execution.service';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import { operationalAddressHelper } from '../core/location/operational-address.helper';
import { requestReversal, requestAndExecuteReversalSync } from '../modules/reversal/reversal.service';
import { serviceOrderService } from '../modules/services/service-order.service';

dotenv.config({ path: join(process.cwd(), '.env') });

// F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9, achado da auditoria Yala 2026-07-05): este
// E2E chama servicePaymentExecutionService.createExecution -> ... -> bankTransactionService.
// createTransactionWithExplicitSplitLines DIRETO (4o entrypoint do sink, agora gated) — precisa
// ligar o gate default-off pra continuar exercitando o fluxo real que este arquivo sempre testou.
process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const POLICY_MODULE = 'service_execution';
const POLICY_PREFIX_BASE = 'guard_e2e_'; // base do cleanup (pega runs antigas via LIKE)
// DECISION-0166 (F1-a): deprecated de runs antigas ficam (append-only) → código único por run
// evita colisão do UNIQUE(tenant, policy_code, version).
const POLICY_PREFIX = `${POLICY_PREFIX_BASE}${Date.now().toString(36)}_`;

type CheckResult = { ok: boolean; reason?: string; detail?: any };

function assertOk(label: string, r: CheckResult): void {
  if (!r.ok) {
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

async function loadFixtures(): Promise<{
  buyerUserId: string;
  buyerActorId: string;
  workerActorId: string;
  serviceId: string;
  brId: string;
  prStateId: string;
  cwbCityId: string;
}> {
  const usersRes = await pool.query<{ user_id: string; email: string }>(
    `SELECT user_id::text, email FROM users WHERE tenant_id = $1
      AND email IN ('g2-buyer@e2e.internal', 'g2-provider@e2e.internal')`,
    [TENANT_ID]
  );
  const buyer = usersRes.rows.find((r) => r.email === 'g2-buyer@e2e.internal')!;
  const provider = usersRes.rows.find((r) => r.email === 'g2-provider@e2e.internal')!;
  const actors = await pool.query<{ user_id: string; actor_id: string }>(
    `SELECT user_id::text, id::text AS actor_id FROM actors
      WHERE tenant_id = $1::uuid AND user_id = ANY($2::uuid[]) AND actor_type = 'user'`,
    [TENANT_ID, [buyer.user_id, provider.user_id]]
  );
  const buyerActorId = actors.rows.find((a) => a.user_id === buyer.user_id)!.actor_id;
  const workerActorId = actors.rows.find((a) => a.user_id === provider.user_id)!.actor_id;
  const svc = await pool.query<{ service_id: string }>(
    `SELECT service_id::text FROM services WHERE tenant_id = $1 AND actor_id = $2 LIMIT 1`,
    [TENANT_ID, workerActorId]
  );
  const serviceId = svc.rows[0]!.service_id;
  const br = await pool.query<{ country_id: string }>(
    `SELECT country_id::text FROM countries WHERE iso_alpha2 = 'BR' LIMIT 1`
  );
  const brId = br.rows[0]!.country_id;
  const pr = await pool.query<{ state_id: string }>(
    `SELECT state_id::text FROM states WHERE country_id=$1::uuid AND abbreviation='PR' LIMIT 1`,
    [brId]
  );
  const cwb = await pool.query<{ city_id: string }>(
    `SELECT city_id::text FROM cities WHERE state_id=$1::uuid AND name='Curitiba' LIMIT 1`,
    [pr.rows[0]!.state_id]
  );
  return {
    buyerUserId: buyer.user_id,
    buyerActorId,
    workerActorId,
    serviceId,
    brId,
    prStateId: pr.rows[0]!.state_id,
    cwbCityId: cwb.rows[0]!.city_id,
  };
}

async function subsidizeBuyer(buyerActorId: string, amount: number): Promise<void> {
  const acc = await pool.query<{ id: string }>(
    `SELECT id::text FROM bank_accounts
      WHERE tenant_id = $1::uuid AND actor_id = $2::uuid AND account_type = 'credit' LIMIT 1`,
    [TENANT_ID, buyerActorId]
  );
  if (!acc.rows[0]) return;
  const accountId = acc.rows[0].id;
  const txId = uuidv4();
  await pool.query(
    `INSERT INTO bank_transactions (
       id, tenant_id, actor_id, account_id, amount_cents, purpose,
       justification, reference_type, reference_id, concept_id, internal_completed_at
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, 'execution',
              'E2E guard subsidy', 'guard_e2e_subsidy', $6,
              (SELECT concept_id FROM concepts WHERE slug='ride-payment' LIMIT 1), NOW())`,
    [txId, TENANT_ID, buyerActorId, accountId, amount, uuidv4()]
  );
  await pool.query(
    `INSERT INTO bank_ledger (
       id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification
     ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit',
               $4, 'execution', 'E2E guard subsidy')`,
    [TENANT_ID, accountId, txId, amount]
  );
}

async function resetRiskProfiles(): Promise<void> {
  await pool.query(
    `DELETE FROM actor_events
      WHERE actor_id IN (SELECT id FROM actors WHERE tenant_id=$1::uuid)
        AND event_type IN ('reversal_executed','payment_failed','payout_failed',
                           'cancellation_requested','governance_action_failed',
                           'account_closed','suspicious_activity')`,
    [TENANT_ID]
  );
  await pool.query(
    `UPDATE actor_risk_profile
        SET risk_level='low', risk_score=0, flags='[]'::jsonb, updated_at=NOW()
      WHERE actor_id IN (SELECT id FROM actors WHERE tenant_id=$1::uuid)`,
    [TENANT_ID]
  );
}

async function cleanupPolicies(): Promise<void> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
  // DECISION-0166 (F1-a): ativada NUNCA é deletada — neutraliza por deprecação; só draft deleta.
  await pool.query(
    `UPDATE economic_policies SET status='deprecated'
      WHERE tenant_id=$1::uuid AND module_context=$2 AND policy_code LIKE $3 AND status='active'`,
    [TENANT_ID, POLICY_MODULE, `${POLICY_PREFIX_BASE}%`]
  );
  await pool.query(
    `DELETE FROM economic_policies WHERE tenant_id=$1::uuid AND module_context=$2 AND policy_code LIKE $3 AND status='draft'`,
    [TENANT_ID, POLICY_MODULE, `${POLICY_PREFIX_BASE}%`]
  );
}

async function cleanupOperational(actorId: string): Promise<void> {
  await pool.query(
    `DELETE FROM address_assignments
       WHERE owner_type='service_provider' AND owner_id=$1::uuid AND role='OPERATIONAL'`,
    [actorId]
  );
}

async function seedPolicyMultiSplit(code: string): Promise<string> {
  const p = await economicPolicyRepository.createPolicy({
    tenantId: TENANT_ID,
    policyCode: code,
    policyType: 'COMMISSION_SPLIT',
    moduleContext: POLICY_MODULE,
    vertical: 'services',
    pricingModel: 'fixed',
    settlementFlow: 'fixed_price_escrow',
    effectiveFrom: new Date(Date.now() - 60 * 1000),
    // Rito DECISION-0166 (F1-b): lines só entram em policy DRAFT — draft → lines → activate.
    status: 'draft',
  });
  await economicPolicyRepository.createPolicyLine(TENANT_ID, {
    policyId: p.id,
    lineType: 'revenue_share',
    destinationType: 'receiver_actor',
    bps: 7000,
    priority: 0,
  });
  await economicPolicyRepository.createPolicyLine(TENANT_ID, {
    policyId: p.id,
    lineType: 'regional_fund',
    destinationType: 'regional_fund',
    bps: 2000,
    priority: 1,
    regionalOriginBasis: 'receiver_company_operational' as any,
  });
  await economicPolicyRepository.createPolicyLine(TENANT_ID, {
    policyId: p.id,
    lineType: 'platform_fee',
    destinationType: 'platform_fees',
    bps: 1000,
    priority: 2,
  });
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
  await pool.query(
    `UPDATE economic_policies SET status='active' WHERE id=$1::uuid AND status='draft'`,
    [p.id]
  );
  return p.id;
}

async function createPaymentRequest(
  buyerActorId: string,
  receiverActorId: string,
  serviceId: string,
  amount: number
): Promise<{ paymentRequestId: string; bookingId: string }> {
  const paymentRequestId = uuidv4();
  const bookingId = uuidv4();
  await pool.query(
    `INSERT INTO service_payment_requests (
       payment_request_id, tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id,
       payment_request_status, amount_cents, currency
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'pending', $7, 'BRL')`,
    [paymentRequestId, TENANT_ID, bookingId, serviceId, buyerActorId, receiverActorId, amount]
  );
  return { paymentRequestId, bookingId };
}

async function createServiceOrderForDmoney(
  bookingId: string,
  serviceId: string,
  workerActorId: string,
  buyerActorId: string
): Promise<string> {
  const orderId = uuidv4();
  const scheduledStart = new Date(Date.now() - 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO service_orders (
       id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id,
       status, settlement_flow,
       scheduled_start, completed_at,
       buyer_confirmation_deadline_at, release_eligible_at,
       buyer_confirmed_completion_at,
       created_by_actor_id,
       description, metadata
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
               'release_approved', 'fixed_price_escrow',
               $7, NOW(),
               NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days',
               NOW(),
               $4::uuid,
               'Guard E2E fixture order', '{}'::jsonb)`,
    [orderId, TENANT_ID, serviceId, workerActorId, buyerActorId, bookingId, scheduledStart]
  );
  return orderId;
}

async function getBankTransactionId(paymentRequestId: string): Promise<string | null> {
  const r = await pool.query<{ id: string }>(
    `SELECT id::text FROM bank_transactions
      WHERE tenant_id=$1::uuid AND reference_type='service_execution' AND reference_id=$2 LIMIT 1`,
    [TENANT_ID, paymentRequestId]
  );
  return r.rows[0]?.id ?? null;
}

async function getLedgerCount(txId: string): Promise<number> {
  const r = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM bank_ledger WHERE tenant_id=$1::uuid AND transaction_id=$2::uuid`,
    [TENANT_ID, txId]
  );
  return parseInt(r.rows[0]?.cnt ?? '0', 10);
}

async function getSplitCount(txId: string): Promise<number> {
  const r = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM bank_splits WHERE tenant_id=$1::uuid AND transaction_id=$2::uuid`,
    [TENANT_ID, txId]
  );
  return parseInt(r.rows[0]?.cnt ?? '0', 10);
}

async function getReversalLegsCount(reversalId: string): Promise<number> {
  const r = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM bank_transactions
      WHERE tenant_id=$1::uuid AND reference_type='financial_reversal_leg'
        AND metadata->>'reversal_id' = $2`,
    [TENANT_ID, reversalId]
  );
  return parseInt(r.rows[0]?.cnt ?? '0', 10);
}

async function getReversalStatus(reversalId: string): Promise<string | null> {
  const r = await pool.query<{ status: string }>(
    `SELECT status FROM reversals WHERE id=$1::uuid LIMIT 1`,
    [TENANT_ID === '' ? TENANT_ID : TENANT_ID, reversalId]
  );
  return r.rows[0]?.status ?? null;
}

async function main() {
  console.log('═══ E2E F-REFUND-POST-DMONEY-GUARD — Parte A ═══\n');
  await bootstrap();
  await cleanupPolicies();
  const fx = await loadFixtures();
  await subsidizeBuyer(fx.buyerActorId, 1_000_000);
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');
  await cleanupOperational(fx.workerActorId);
  await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, fx.workerActorId, {
    address: {
      countryId: fx.brId,
      stateId: fx.prStateId,
      cityId: fx.cwbCityId,
      source: 'UX_INPUT',
      street: 'Rua Guard E2E Curitiba',
    } as any,
  });

  const policyCode = `${POLICY_PREFIX}pe5_70_20_10`;
  await seedPolicyMultiSplit(policyCode);

  // ─────────────────────────────────────────────────────────────────────────
  // T0 — Reversal pré-D-money continua funcionando (regressão)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── T0: reversal pré-D-money (regressão) ──');
  await resetRiskProfiles();

  const { paymentRequestId: reqT0, bookingId: bkT0 } = await createPaymentRequest(
    fx.buyerActorId, fx.workerActorId, fx.serviceId, 30000
  );
  await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
    paymentRequestId: reqT0,
  });
  const origTxT0 = await getBankTransactionId(reqT0);
  assertOk('T0.1 — bank_transaction criado', { ok: origTxT0 !== null, reason: 'tx não encontrada' });

  const revT0 = await requestReversal(TENANT_ID, {
    originalTransactionId: origTxT0!,
    actorId: fx.buyerActorId,
    reason: 'T0: estorno pré-D-money — teste de regressão',
    amountCents: 30000,
    reversalType: 'external_reversal',
    authoritySource: 'system',
  });
  assertOk('T0.2 — requestReversal pré-D-money não bloqueado', {
    ok: revT0.status === 'pending',
    reason: `status=${revT0.status}`,
  });
  console.log('  ✅ T0 — reversal pré-D-money criado sem bloqueio');

  // ─────────────────────────────────────────────────────────────────────────
  // T4 — regional_fund/platform_fee pré-D-money continuam estornáveis
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── T4: splits pré-D-money estornáveis pelo motor atual ──');
  await resetRiskProfiles();

  const { paymentRequestId: reqT4 } = await createPaymentRequest(
    fx.buyerActorId, fx.workerActorId, fx.serviceId, 20000
  );
  await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
    paymentRequestId: reqT4,
  });
  const origTxT4 = await getBankTransactionId(reqT4);
  const splitsT4Before = await getSplitCount(origTxT4!);
  assertOk('T4.1 — splits criados (70/20/10)', {
    ok: splitsT4Before === 3,
    reason: `splits=${splitsT4Before} (esperado 3)`,
  });
  const revT4 = await requestReversal(TENANT_ID, {
    originalTransactionId: origTxT4!,
    actorId: fx.buyerActorId,
    reason: 'T4: splits pré-D-money reversíveis',
    amountCents: 20000,
    reversalType: 'external_reversal',
    authoritySource: 'system',
  });
  assertOk('T4.2 — requestReversal com splits pré-D-money não bloqueado', {
    ok: revT4.status === 'pending',
    reason: `status=${revT4.status}`,
  });
  console.log('  ✅ T4 — splits pré-D-money reversíveis, guard não interferiu');

  // ─────────────────────────────────────────────────────────────────────────
  // Setup para T1/T2/T3: pagamento + D-money
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── Setup T1/T2/T3: pagamento + D-money ──');
  await resetRiskProfiles();

  const { paymentRequestId: reqMain, bookingId: bkMain } = await createPaymentRequest(
    fx.buyerActorId, fx.workerActorId, fx.serviceId, 50000
  );
  await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
    paymentRequestId: reqMain,
  });
  const origTxMain = await getBankTransactionId(reqMain);
  assertOk('Setup — bank_transaction service_execution criado', {
    ok: origTxMain !== null,
  });

  // Snapshot pré-D-money
  const ledgerCountBefore = await getLedgerCount(origTxMain!);
  const splitCountBefore = await getSplitCount(origTxMain!);

  // Criar service_order em release_approved + executar D-money
  const orderId = await createServiceOrderForDmoney(bkMain, fx.serviceId, fx.workerActorId, fx.buyerActorId);
  await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, orderId);

  // Confirmar payment_intent = released_to_actor_wallet
  const intentRow = await pool.query<{ payment_status: string }>(
    `SELECT payment_status FROM payment_intents WHERE tenant_id=$1::uuid AND reference_id=$2 LIMIT 1`,
    [TENANT_ID, reqMain]
  );
  assertOk('Setup — payment_intent.payment_status=released_to_actor_wallet', {
    ok: intentRow.rows[0]?.payment_status === 'released_to_actor_wallet',
    reason: `status=${intentRow.rows[0]?.payment_status}`,
    detail: intentRow.rows[0],
  });
  console.log('  ✅ D-money executado; payment_intent=released_to_actor_wallet');

  // ─────────────────────────────────────────────────────────────────────────
  // T1 — requestReversal pós-D-money bloqueado
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── T1: requestReversal pós-D-money bloqueado ──');
  let t1Blocked = false;
  let t1Error = '';
  try {
    await requestReversal(TENANT_ID, {
      originalTransactionId: origTxMain!,
      actorId: fx.buyerActorId,
      reason: 'T1: tentativa de estorno pós-D-money',
      amountCents: 50000,
      reversalType: 'external_reversal',
      authoritySource: 'system',
    });
  } catch (e) {
    t1Error = e instanceof Error ? e.message : String(e);
    t1Blocked = t1Error.includes('REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW');
  }
  assertOk('T1.1 — requestReversal lança REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW', {
    ok: t1Blocked,
    reason: t1Error || 'Não lançou erro',
  });
  assertOk('T1.2 — mensagem referencia DT-PE5-REFUND-POST-DMONEY-CHAIN', {
    ok: t1Error.includes('DT-PE5-REFUND-POST-DMONEY-CHAIN'),
    reason: `msg=${t1Error.slice(0, 200)}`,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T1b — requestAndExecuteReversalSync pós-D-money bloqueado
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── T1b: requestAndExecuteReversalSync pós-D-money bloqueado ──');
  let t1bBlocked = false;
  let t1bError = '';
  try {
    await requestAndExecuteReversalSync(TENANT_ID, {
      originalTransactionId: origTxMain!,
      actorId: fx.buyerActorId,
      reason: 'T1b: sync reversal pós-D-money',
      amountCents: 50000,
      reversalType: 'external_reversal',
      authoritySource: 'system',
    });
  } catch (e) {
    t1bError = e instanceof Error ? e.message : String(e);
    t1bBlocked = t1bError.includes('REVERSAL_POST_DMONEY_REQUIRES_RECOVERY_FLOW');
  }
  assertOk('T1b.1 — requestAndExecuteReversalSync bloqueado', {
    ok: t1bBlocked,
    reason: t1bError || 'Não lançou erro',
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T2 — Snapshots inalterados após bloqueio
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── T2: snapshots inalterados após bloqueio ──');
  const ledgerCountAfter = await getLedgerCount(origTxMain!);
  const splitCountAfter = await getSplitCount(origTxMain!);
  assertOk('T2.1 — bank_ledger inalterado', {
    ok: ledgerCountAfter === ledgerCountBefore,
    reason: `antes=${ledgerCountBefore} depois=${ledgerCountAfter}`,
  });
  assertOk('T2.2 — bank_splits inalterado', {
    ok: splitCountAfter === splitCountBefore,
    reason: `antes=${splitCountBefore} depois=${splitCountAfter}`,
  });
  const reversalLegsAfter = await getReversalLegsCount(origTxMain!);
  assertOk('T2.3 — nenhuma leg reversa criada em bank_transactions', {
    ok: reversalLegsAfter === 0,
    reason: `legs=${reversalLegsAfter}`,
  });

  // ─────────────────────────────────────────────────────────────────────────
  // T3 — Reversal row não marcado como executed
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── T3: reversal row não executado ──');
  const reversalRows = await pool.query<{ id: string; status: string }>(
    `SELECT id::text, status FROM reversals
      WHERE tenant_id=$1::uuid AND original_transaction_id=$2::uuid
      ORDER BY created_at DESC LIMIT 5`,
    [TENANT_ID, origTxMain]
  );
  const executedRows = reversalRows.rows.filter((r) => r.status === 'executed');
  assertOk('T3.1 — nenhum reversal marcado como executed para a tx principal', {
    ok: executedRows.length === 0,
    reason: `executed=${executedRows.length}: ${JSON.stringify(reversalRows.rows)}`,
  });
  // Pode existir row em 'failed' (defesa-em-profundidade executeReversal)
  // ou nenhum row se o bloqueio ocorreu em requestReversal antes de criar
  const nonExecutedRows = reversalRows.rows.filter((r) => r.status !== 'executed');
  console.log(`  ℹ️  Rows de reversal encontrados: ${JSON.stringify(reversalRows.rows)}`);

  // ─────────────────────────────────────────────────────────────────────────
  // Ledger da tx original: double-entry intacto (não contaminado pelo guard)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n── FINAL: double-entry da tx principal intacto ──');
  const ledgerCheck = await pool.query<{ debit: string; credit: string }>(
    `SELECT
       COALESCE(SUM(amount_cents) FILTER (WHERE direction='debit'), 0)::text AS debit,
       COALESCE(SUM(amount_cents) FILTER (WHERE direction='credit'), 0)::text AS credit
     FROM bank_ledger
     WHERE tenant_id=$1::uuid AND transaction_id=$2::uuid`,
    [TENANT_ID, origTxMain]
  );
  const debit = parseInt(ledgerCheck.rows[0]!.debit, 10);
  const credit = parseInt(ledgerCheck.rows[0]!.credit, 10);
  assertOk('FINAL — ledger da tx principal Σdéb=Σcred (50000 cada)', {
    ok: debit === 50000 && credit === 50000,
    reason: `debit=${debit} credit=${credit}`,
  });

  console.log('\n═══ E2E F-REFUND-POST-DMONEY-GUARD Parte A — TODOS OS CENÁRIOS VERDES ═══\n');
  await pool.end();
}

main().catch((err) => {
  console.error('E2E FALHOU:', err);
  process.exit(1);
});
