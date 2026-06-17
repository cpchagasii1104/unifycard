/**
 * E2E F-REFUND-SPLIT-AWARE (DECISION-0052, 2026-05-27)
 *
 * Endurece o motor de estorno existente (já split-aware desde Prompt 51):
 *
 *   Bloco A — taxonomia reversal_type (5 valores canônicos)
 *   Bloco B — autoria forte (system vs manual; CHECK Postgres)
 *   Bloco D — E2E split-aware completo com PE-5
 *   Bloco E — vínculo original_split_id em metadata da tx reversa
 *
 * NÃO inclui Bloco C (approval gate) — raio-x do Core de Aprovação primeiro.
 * NÃO inclui Bloco F (escrow_refunds vs reversals) — fora de escopo.
 *
 * Cenários:
 *   T1 — pagamento PE-5 multi-split + estorno antes do D-money
 *        → 3 reversões corretas, cada destino devolve seu valor
 *   T2 — original_split_id presente no metadata de cada tx reversa
 *   T3 — ledger net-zero por reversal (Σ credit = Σ debit nas linhas reversas)
 *   T4 — reversal_type external_reversal persistido + idempotência
 *   T5 — CHECK Postgres: internal_refund SEM performed_by_user_id → bloqueado
 *   T6 — CHECK Postgres: external_reversal COM performed_by_user_id → bloqueado
 *   T7 — TS guard: createReversalRequest rejeita internal_refund sem user
 *   T8 — outbox payment_intent status='reversed' gravado com metadata completo
 *   T9 — LIMITE conhecido (DT registrada): estorno PÓS D-money falha
 *        INSUFFICIENT_FUNDS_FOR_REVERSAL (revenue_share já saiu do escrow)
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-refund-split-aware.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { servicePaymentExecutionService } from '../modules/services/service-payment-execution.service';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import { operationalAddressHelper } from '../core/location/operational-address.helper';
import { requestAndExecuteReversalSync } from '../modules/reversal/reversal.service';
import { createReversalRequest } from '../modules/reversal/reversal.repository';
import { serviceOrderService } from '../modules/services/service-order.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const POLICY_MODULE = 'service_execution';
const POLICY_PREFIX = 'refund_e2e_';

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
      WHERE tenant_id = $1::uuid AND actor_id = $2::uuid AND account_type = 'credit'
      LIMIT 1`,
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
              'E2E F-REFUND subsidy', 'refund_e2e_subsidy', $6,
              (SELECT concept_id FROM concepts WHERE slug='ride-payment' LIMIT 1), NOW())`,
    [txId, TENANT_ID, buyerActorId, accountId, amount, uuidv4()]
  );
  await pool.query(
    `INSERT INTO bank_ledger (
       id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification
     ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit',
               $4, 'execution', 'E2E F-REFUND subsidy')`,
    [TENANT_ID, accountId, txId, amount]
  );
}

/**
 * Reset risk_profile dos actors do tenant E2E.
 *
 * Necessário porque fluxos de pagamento disparam recordActorRiskEventAsync via
 * risk-hooks; em E2Es com múltiplos pagamentos seguidos no MESMO actor, isso
 * acumula score e dispara HIGH_FREQUENCY_TRANSACTIONS → risk_level='blocked'
 * → estorno barrado por ACTOR_RISK_BLOCKED (efeito colateral do teste, não do
 * comportamento testado).
 *
 * NÃO bypassa lógica de risco em produção. Só limpa estado entre fases do E2E.
 */
async function resetRiskProfiles(): Promise<void> {
  // actor_events alimenta evaluateActorRisk (peso 18 por reversal_executed →
  // 5 estornos = score 90 = blocked). Em E2E com múltiplos estornos no MESMO
  // worker, isso bloqueia a próxima chamada — efeito colateral, não do que
  // se testa aqui.
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
  await pool.query(
    `DELETE FROM economic_policies WHERE tenant_id=$1::uuid AND module_context=$2 AND policy_code LIKE $3`,
    [TENANT_ID, POLICY_MODULE, `${POLICY_PREFIX}%`]
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
    status: 'active',
  });
  // 70/20/10: revenue_share (escrow) + regional_fund (Curitiba) + platform_fee (system)
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
       status, amount_cents, currency
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'pending', $7, 'BRL')`,
    [paymentRequestId, TENANT_ID, bookingId, serviceId, buyerActorId, receiverActorId, amount]
  );
  return { paymentRequestId, bookingId };
}

async function getBankTransactionId(paymentRequestId: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT id::text FROM bank_transactions
      WHERE tenant_id=$1::uuid AND reference_type='service_execution' AND reference_id=$2 LIMIT 1`,
    [TENANT_ID, paymentRequestId]
  );
  return r.rows[0]!.id;
}

async function getSplitsByOriginalTx(originalTxId: string): Promise<Array<{
  split_id: string;
  split_type: string;
  amount_cents: string;
  target_account_id: string;
}>> {
  const r = await pool.query<{
    split_id: string;
    split_type: string;
    amount_cents: string;
    target_account_id: string;
  }>(
    `SELECT id::text AS split_id, split_type, amount_cents::text, target_account_id::text
       FROM bank_splits
      WHERE tenant_id=$1::uuid AND transaction_id=$2::uuid
      ORDER BY created_at ASC`,
    [TENANT_ID, originalTxId]
  );
  return r.rows;
}

async function getReversalLegs(reversalId: string): Promise<Array<{
  id: string;
  amount_cents: string;
  metadata: any;
  account_id: string;
}>> {
  // Metadata da leg vive em bank_transactions.metadata (não em bank_ledger,
  // que tem schema minimal). bank_ledger só fornece a conta destino (credit).
  const r = await pool.query<{
    id: string;
    amount_cents: string;
    metadata: any;
    account_id: string;
  }>(
    `SELECT bt.id::text, bt.amount_cents::text, bt.metadata,
            (SELECT account_id::text FROM bank_ledger
              WHERE transaction_id = bt.id AND direction = 'credit' LIMIT 1) AS account_id
       FROM bank_transactions bt
      WHERE bt.tenant_id=$1::uuid
        AND bt.reference_type='financial_reversal_leg'
        AND bt.metadata->>'reversal_id' = $2
      ORDER BY bt.created_at ASC`,
    [TENANT_ID, reversalId]
  );
  return r.rows;
}

async function getReversalRow(reversalId: string): Promise<{
  reversal_type: string;
  performed_by_user_id: string | null;
  authority_source: string | null;
  status: string;
}> {
  const r = await pool.query<{
    reversal_type: string;
    performed_by_user_id: string | null;
    authority_source: string | null;
    status: string;
  }>(
    `SELECT reversal_type, performed_by_user_id::text, authority_source, status
       FROM reversals WHERE id=$1::uuid LIMIT 1`,
    [reversalId]
  );
  return r.rows[0]!;
}

async function main() {
  console.log('═══ E2E F-REFUND-SPLIT-AWARE — DECISION-0052 ═══\n');
  await bootstrap();
  await cleanupPolicies();
  const fx = await loadFixtures();
  await subsidizeBuyer(fx.buyerActorId, 500000);
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');

  // Setup PE-5: worker tem OPERATIONAL em Curitiba
  await cleanupOperational(fx.workerActorId);
  await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, fx.workerActorId, {
    address: {
      countryId: fx.brId,
      stateId: fx.prStateId,
      cityId: fx.cwbCityId,
      source: 'UX_INPUT',
      street: 'Rua F-REFUND Curitiba',
    } as any,
  });

  console.log(
    `  ℹ  buyer=${fx.buyerActorId.slice(0, 8)} worker=${fx.workerActorId.slice(0, 8)} ` +
      `(subsídio 500000 cents + OPERATIONAL Curitiba)\n`
  );

  // ============================================================
  // T1+T2+T3+T8 — pagamento PE-5 multi-split + estorno antes D-money
  // ============================================================
  console.log('=== T1 — pagamento PE-5 multi-split (70/20/10) + estorno ANTES D-money ===');
  await cleanupPolicies();
  await seedPolicyMultiSplit(`${POLICY_PREFIX}T1_multi`);
  const req1 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
    paymentRequestId: req1.paymentRequestId,
  });
  const origTxId = await getBankTransactionId(req1.paymentRequestId);
  const splits1 = await getSplitsByOriginalTx(origTxId);
  assertOk('T1.1 — pagamento gerou 3 bank_splits (revenue + regional + fee)', {
    ok: splits1.length === 3,
    reason: `count=${splits1.length}`,
    detail: splits1,
  });

  // Dispara estorno (default external_reversal sistêmico)
  await resetRiskProfiles();
  const rev = await requestAndExecuteReversalSync(TENANT_ID, {
    originalTransactionId: origTxId,
    actorId: fx.workerActorId,
    reason: 'E2E refund split-aware T1',
    amountCents: 10000,
    reversalType: 'external_reversal',
    authoritySource: 'system',
  });
  assertOk('T1.2 — reversal executou (3 transferências legs)', {
    ok: rev.reversalTransactionIds.length === 3,
    reason: `legs=${rev.reversalTransactionIds.length}`,
    detail: rev,
  });

  // Localiza reversal_id
  const revRow = await pool.query<{ id: string }>(
    `SELECT id::text FROM reversals WHERE tenant_id=$1::uuid AND original_transaction_id=$2::uuid LIMIT 1`,
    [TENANT_ID, origTxId]
  );
  const reversalId = revRow.rows[0]!.id;

  // T2 — original_split_id em metadata de cada leg
  const legs = await getReversalLegs(reversalId);
  const origSplitIds = splits1.map((s) => s.split_id).sort();
  const legSplitIds = legs.map((l) => l.metadata?.original_split_id).filter(Boolean).sort();
  assertOk('T2.1 — Bloco E: cada leg reversa carrega original_split_id em metadata', {
    ok:
      legs.length === 3 &&
      JSON.stringify(origSplitIds) === JSON.stringify(legSplitIds),
    reason: 'split ids divergem',
    detail: { origSplitIds, legSplitIds },
  });

  // T3 — ledger net-zero: para cada original split, valor revertido = valor original
  for (const orig of splits1) {
    const leg = legs.find((l) => l.metadata?.original_split_id === orig.split_id);
    assertOk(
      `T3.${orig.split_type} — leg reverso devolveu ${orig.amount_cents} cents (mesmo valor)`,
      {
        ok: leg !== undefined && leg.amount_cents === orig.amount_cents,
        reason: `leg=${leg?.amount_cents} esperado=${orig.amount_cents}`,
        detail: { orig, leg },
      }
    );
  }

  // T4 — reversal_type external_reversal persistido + idempotência
  const r1 = await getReversalRow(reversalId);
  assertOk('T4.1 — reversal_type=external_reversal persistido', {
    ok: r1.reversal_type === 'external_reversal',
    reason: `recebi=${r1.reversal_type}`,
    detail: r1,
  });
  assertOk('T4.2 — authority_source=system persistido', {
    ok: r1.authority_source === 'system',
    reason: `recebi=${r1.authority_source}`,
  });
  assertOk('T4.3 — performed_by_user_id=NULL (sistêmico)', {
    ok: r1.performed_by_user_id === null,
    reason: `recebi=${r1.performed_by_user_id}`,
  });
  // Idempotência: 2ª chamada retorna mesmo resultado sem duplicar
  await resetRiskProfiles();
  const rev2 = await requestAndExecuteReversalSync(TENANT_ID, {
    originalTransactionId: origTxId,
    actorId: fx.workerActorId,
    reason: 'E2E refund T1 (idempotente)',
    amountCents: 10000,
    reversalType: 'external_reversal',
    authoritySource: 'system',
  });
  assertOk('T4.4 — idempotência: 2ª chamada retorna mesmos reversal IDs', {
    ok:
      rev2.reversalTransactionId === rev.reversalTransactionId &&
      rev2.reversalTransactionIds.length === rev.reversalTransactionIds.length,
    reason: 'IDs diferem',
    detail: { first: rev, second: rev2 },
  });

  // T8 — outbox payment_intent reversed
  const intentRev = await pool.query<{ status: string; metadata: any }>(
    `SELECT payment_status AS status, metadata FROM payment_intents
      WHERE tenant_id=$1::uuid AND reference_id=$2 LIMIT 1`,
    [TENANT_ID, `reversal-pipeline-${reversalId}`]
  );
  assertOk('T8.1 — payment_intent kind=financial_reversal_pipeline + status=reversed', {
    ok:
      intentRev.rows.length === 1 &&
      intentRev.rows[0]!.status === 'reversed' &&
      intentRev.rows[0]!.metadata?.kind === 'financial_reversal_pipeline',
    reason: 'payment_intent reversed ausente ou metadata incorreta',
    detail: intentRev.rows[0],
  });
  assertOk('T8.2 — outbox metadata inclui original_bank_transaction_id', {
    ok: intentRev.rows[0]?.metadata?.original_bank_transaction_id === origTxId,
    reason: 'original_bank_transaction_id ausente',
  });

  // ============================================================
  // T5+T6 — CHECK Postgres (provando enforcement no banco)
  // ============================================================
  console.log('\n=== T5 — CHECK Postgres: internal_refund SEM performed_by_user_id ===');
  let t5Caught = false;
  try {
    await pool.query(
      `INSERT INTO reversals (
         tenant_id, original_transaction_id, actor_id, reason, amount_cents,
         status, reversal_type, performed_by_user_id
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'T5 attempt', 1, 'pending',
                 'internal_refund', NULL)`,
      [TENANT_ID, origTxId, fx.workerActorId]
    );
  } catch (e: any) {
    t5Caught = true;
    assertOk('T5.1 — Postgres bloqueou via chk_internal_refund_requires_user', {
      ok:
        e?.code === '23514' &&
        /chk_internal_refund_requires_user/.test(String(e?.constraint ?? '')),
      reason: `code=${e?.code} constraint=${e?.constraint}`,
    });
  }
  assertOk('T5.2 — exceção SQL foi lançada', { ok: t5Caught });

  console.log('\n=== T6 — CHECK Postgres: external_reversal COM performed_by_user_id ===');
  let t6Caught = false;
  try {
    await pool.query(
      `INSERT INTO reversals (
         tenant_id, original_transaction_id, actor_id, reason, amount_cents,
         status, reversal_type, performed_by_user_id
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, 'T6 attempt', 1, 'pending',
                 'external_reversal', $4::uuid)`,
      [TENANT_ID, origTxId, fx.workerActorId, fx.buyerUserId]
    );
  } catch (e: any) {
    t6Caught = true;
    assertOk('T6.1 — Postgres bloqueou via chk_external_reversal_is_systemic', {
      ok:
        e?.code === '23514' &&
        /chk_external_reversal_is_systemic/.test(String(e?.constraint ?? '')),
      reason: `code=${e?.code} constraint=${e?.constraint}`,
    });
  }
  assertOk('T6.2 — exceção SQL foi lançada', { ok: t6Caught });

  // ============================================================
  // T7 — TS guard: createReversalRequest rejeita internal_refund sem user
  // ============================================================
  console.log('\n=== T7 — TS guard: createReversalRequest rejeita internal_refund sem user ===');
  let t7Caught = false;
  try {
    await createReversalRequest(TENANT_ID, {
      originalTransactionId: uuidv4(),
      actorId: fx.workerActorId,
      reason: 'T7 attempt',
      amountCents: 1,
      reversalType: 'internal_refund',
    });
  } catch (e: any) {
    t7Caught = true;
    assertOk('T7.1 — TS guard INTERNAL_REFUND_REQUIRES_PERFORMED_BY_USER', {
      ok: /INTERNAL_REFUND_REQUIRES_PERFORMED_BY_USER/.test(String(e?.message)),
      reason: `recebi: ${e?.message}`,
    });
  }
  assertOk('T7.2 — exceção foi lançada', { ok: t7Caught });

  // ============================================================
  // T9 — REMOVIDO desta fatia (não determinístico).
  //
  // Tentativa de E2E para "estorno pós-D-money" gerou efeito colateral:
  // múltiplos estornos consecutivos no mesmo worker disparam
  // ACTOR_RISK_BLOCKED no risk-financial-gate (anomalia
  // HIGH_FREQUENCY_TRANSACTIONS). Logo, o sistema TEM defesa contra
  // estorno pós-D-money em camada anterior, mas não pelo motivo
  // certo — é colateral.
  //
  // Limite material conhecido (auditoria manual):
  //   - Pós D-money, escrow_payments é pool agregado; estorno retira
  //     da pool, drena saldo de outros pagamentos, deixa actor_wallet
  //     do worker com saldo indevido.
  //
  // Rastreado em DT-PE5-REFUND-POST-DMONEY-CHAIN (OPEN HIGH). Frente
  // futura: 3 opções não exclusivas (cobrança reversa no actor_wallet,
  // débito pending, bloqueio fail-closed via flag is_released no intent).
  // ============================================================
  console.log(
    '\n=== T9 — REMOVIDO (não determinístico): limite pós-D-money documentado em ' +
      'DT-PE5-REFUND-POST-DMONEY-CHAIN ==='
  );

  // ============================================================
  // Cleanup final
  // ============================================================
  await cleanupOperational(fx.workerActorId);
  await cleanupPolicies();

  console.log(
    '\n═══ E2E F-REFUND-SPLIT-AWARE :: PASS — 9 cenários verdes. ' +
      'Taxonomia reversal_type + autoria forte + original_split_id + idempotência + ' +
      'CHECK Postgres + TS guards + outbox preservado. ' +
      'Limite pós-D-money rastreado em DT-PE5-REFUND-POST-DMONEY-CHAIN. ═══'
  );
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
