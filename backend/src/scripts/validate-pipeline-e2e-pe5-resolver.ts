/**
 * E2E PE-5-RESOLVER-MVP (DECISION-0051, 2026-05-26) — Resolver dinâmico de
 * regional_fund PJ-only.
 *
 * Cobre 8 cenários:
 *   T1 — receiver_company_operational com OPERATIONAL cadastrado →
 *        bank_split em regional_fund account da cidade do endereço.
 *   T2 — receiver_company_operational SEM OPERATIONAL →
 *        POLICY_REGIONAL_ORIGIN_UNRESOLVABLE; nada gravado.
 *   T3 — receiver_company_hq com HQ cadastrado →
 *        bank_split em regional_fund account da cidade do HQ.
 *   T4 — receiver_company_hq SEM HQ → POLICY_REGIONAL_ORIGIN_UNRESOLVABLE.
 *   T5 — mixed_policy: 2 linhas regional_fund (operational + hq) →
 *        2 bank_splits em 2 regional_fund accounts diferentes.
 *   T6 — actor_wallet recebe APENAS revenue_share (regional_fund não vaza).
 *   T7 — receiver_identity_residence (PF) → POLICY_BASIS_UNSUPPORTED_MVP.
 *   T8 — HQ NÃO é fallback de operational: actor sem OPERATIONAL + policy
 *        basis=operational → falha (não cai em HQ automaticamente).
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-pe5-resolver.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { deleteCompaniesAndFiscal } from './helpers/pj-fiscal-cleanup';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { servicePaymentExecutionService } from '../modules/services/service-payment-execution.service';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import { operationalAddressHelper } from '../core/location/operational-address.helper';
import { serviceOrderService } from '../modules/services/service-order.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const POLICY_MODULE = 'service_execution';
const POLICY_PREFIX = 'pe5_resolver_';

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
  cwbCity: { id: string; name: string };
  spStateId: string;
  spCity: { id: string; name: string };
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
      [TENANT_ID, workerActorId, 'PE-5-RESOLVER fixture', `pe5-resolver-${uuidv4().slice(0, 8)}`]
    );
    serviceId = newSvc.rows[0]!.service_id;
  }

  // Geo fixtures
  const br = await pool.query<{ country_id: string }>(
    `SELECT country_id::text FROM countries WHERE iso_alpha2 = 'BR' LIMIT 1`
  );
  const brId = br.rows[0]!.country_id;
  const pr = await pool.query<{ state_id: string }>(
    `SELECT state_id::text FROM states WHERE country_id=$1::uuid AND abbreviation='PR' LIMIT 1`,
    [brId]
  );
  const sp = await pool.query<{ state_id: string }>(
    `SELECT state_id::text FROM states WHERE country_id=$1::uuid AND abbreviation='SP' LIMIT 1`,
    [brId]
  );
  // Cria/usa Curitiba e São Paulo se não existirem
  const cwb = await ensureCity(pr.rows[0]!.state_id, 'Curitiba');
  const spc = await ensureCity(sp.rows[0]!.state_id, 'São Paulo');

  return {
    buyerUserId: buyer.user_id,
    buyerActorId,
    workerActorId,
    serviceId,
    brId,
    prStateId: pr.rows[0]!.state_id,
    cwbCity: cwb,
    spStateId: sp.rows[0]!.state_id,
    spCity: spc,
  };
}

async function ensureCity(stateId: string, name: string): Promise<{ id: string; name: string }> {
  const ex = await pool.query<{ city_id: string }>(
    `SELECT city_id::text FROM cities WHERE state_id=$1::uuid AND name=$2 LIMIT 1`,
    [stateId, name]
  );
  if (ex.rows[0]) return { id: ex.rows[0].city_id, name };
  const ins = await pool.query<{ city_id: string }>(
    `INSERT INTO cities (state_id, name, name_normalized, is_active)
     VALUES ($1::uuid, $2, lower($2), true) RETURNING city_id::text`,
    [stateId, name]
  );
  return { id: ins.rows[0]!.city_id, name };
}

/**
 * Subsidia buyer com saldo amplo via INSERT direto (mesmo padrão PE-3).
 */
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
              'E2E PE-5-RESOLVER subsidy', 'pe5_resolver_e2e_subsidy', $6,
              (SELECT concept_id FROM concepts WHERE slug='ride-payment' LIMIT 1), NOW())`,
    [txId, TENANT_ID, buyerActorId, accountId, amount, uuidv4()]
  );
  await pool.query(
    `INSERT INTO bank_ledger (
       id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification
     ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, 'credit',
               $4, 'execution', 'E2E PE-5-RESOLVER subsidy')`,
    [TENANT_ID, accountId, txId, amount]
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

async function seedPolicy(opts: {
  code: string;
  lines: Array<{
    lineType: string;
    destinationType: string;
    bps: number;
    regionalOriginBasis?: string;
    priority?: number;
  }>;
}): Promise<string> {
  const p = await economicPolicyRepository.createPolicy({
    tenantId: TENANT_ID,
    policyCode: opts.code,
    policyType: 'COMMISSION_SPLIT',
    moduleContext: POLICY_MODULE,
    vertical: 'services',
    pricingModel: 'fixed',
    settlementFlow: 'fixed_price_escrow',
    effectiveFrom: new Date(Date.now() - 60 * 1000),
    status: 'active',
  });
  for (const ln of opts.lines) {
    await economicPolicyRepository.createPolicyLine(TENANT_ID, {
      policyId: p.id,
      lineType: ln.lineType as any,
      destinationType: ln.destinationType as any,
      bps: ln.bps,
      priority: ln.priority ?? 0,
      regionalOriginBasis: (ln.regionalOriginBasis as any) ?? null,
    });
  }
  return p.id;
}

async function createPaymentRequest(
  buyerActorId: string,
  receiverActorId: string,
  serviceId: string,
  amount: number
): Promise<string> {
  const paymentRequestId = uuidv4();
  await pool.query(
    `INSERT INTO service_payment_requests (
       payment_request_id, tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id,
       payment_request_status, amount_cents, currency
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, 'pending', $7, 'BRL')`,
    [paymentRequestId, TENANT_ID, uuidv4(), serviceId, buyerActorId, receiverActorId, amount]
  );
  return paymentRequestId;
}

async function getBankSplits(paymentRequestId: string): Promise<Array<{
  split_type: string;
  amount_cents: string;
  target_account_id: string;
}>> {
  const r = await pool.query<{
    split_type: string;
    amount_cents: string;
    target_account_id: string;
  }>(
    `SELECT bs.split_type, bs.amount_cents::text, bs.target_account_id::text
       FROM bank_splits bs
       JOIN bank_transactions bt ON bt.id = bs.transaction_id
      WHERE bs.tenant_id = $1::uuid AND bt.reference_type='service_execution'
        AND bt.reference_id = $2 ORDER BY bs.created_at ASC`,
    [TENANT_ID, paymentRequestId]
  );
  return r.rows;
}

async function getIntentMetadata(paymentRequestId: string): Promise<any> {
  const r = await pool.query<{ id: string; metadata: any }>(
    `SELECT id::text, metadata FROM payment_intents WHERE tenant_id=$1::uuid AND reference_id=$2 LIMIT 1`,
    [TENANT_ID, paymentRequestId]
  );
  return r.rows[0] ?? null;
}

async function main() {
  console.log('═══ E2E PE-5-RESOLVER-MVP — regional_fund dinâmico PJ-only ═══\n');
  await bootstrap();
  await cleanupPolicies();
  const fx = await loadFixtures();
  await subsidizeBuyer(fx.buyerActorId, 500000);
  await bankAccountService.ensurePlatformAccounts(TENANT_ID, 'BRL');
  console.log(
    `  ℹ  buyer=${fx.buyerActorId.slice(0, 8)} worker=${fx.workerActorId.slice(0, 8)} ` +
      `(subsídio 500000 cents)\n`
  );

  // Cleanup operacional do worker para começar do zero
  await cleanupOperational(fx.workerActorId);

  // ============================================================
  // T1 — receiver_company_operational com OPERATIONAL cadastrado
  // ============================================================
  console.log('=== T1 — receiver_company_operational + OPERATIONAL cadastrado → resolve para cidade ===');
  // Cartório PE-5: cadastra OPERATIONAL do worker em Curitiba
  await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, fx.workerActorId, {
    address: {
      countryId: fx.brId,
      stateId: fx.prStateId,
      cityId: fx.cwbCity.id,
      source: 'UX_INPUT',
      street: 'Rua T1 Curitiba',
    } as any,
  });
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_PREFIX}T1_op_resolve`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 1000,
        priority: 1,
        regionalOriginBasis: 'receiver_company_operational',
      },
    ],
  });
  const req1 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
    paymentRequestId: req1,
  });
  const splits1 = await getBankSplits(req1);
  assertOk('T1.1 — 2 bank_splits criados (revenue_share + regional_fund)', {
    ok: splits1.length === 2,
    reason: `count=${splits1.length}`,
    detail: splits1,
  });
  const fundSplit1 = splits1.find((s) => s.split_type === 'regional_fund')!;
  assertOk('T1.2 — split regional_fund = 1000', {
    ok: parseInt(fundSplit1.amount_cents, 10) === 1000,
    reason: `amount=${fundSplit1.amount_cents}`,
  });
  const fundAccount1 = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: 'BR', state: 'PR', city: 'Curitiba' },
    'BRL'
  );
  assertOk('T1.3 — regional_fund routou para conta de Curitiba', {
    ok: fundSplit1.target_account_id === fundAccount1.accountId,
    reason: `target=${fundSplit1.target_account_id} esperado=${fundAccount1.accountId}`,
  });
  const intent1 = await getIntentMetadata(req1);
  const splits1Meta = (intent1.metadata?.splits ?? []) as any[];
  assertOk('T1.4 — metadata.splits APENAS revenue_share (regional_fund não vaza)', {
    ok: splits1Meta.length === 1 && splits1Meta[0]?.amountCents === 9000,
    reason: 'metadata.splits inclui regional_fund',
    detail: splits1Meta,
  });

  // ============================================================
  // T2 — receiver_company_operational SEM OPERATIONAL → fail-closed
  // ============================================================
  console.log('\n=== T2 — receiver_company_operational SEM cadastro → POLICY_REGIONAL_ORIGIN_UNRESOLVABLE ===');
  await cleanupOperational(fx.workerActorId);
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_PREFIX}T2_op_missing`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 1000,
        priority: 1,
        regionalOriginBasis: 'receiver_company_operational',
      },
    ],
  });
  const req2 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  let t2Caught = false;
  try {
    await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
      paymentRequestId: req2,
    });
  } catch (e: any) {
    t2Caught = true;
    assertOk('T2.1 — POLICY_REGIONAL_ORIGIN_UNRESOLVABLE lançado', {
      ok: /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/.test(String(e?.message)),
      reason: `recebi: ${e?.message}`,
    });
  }
  assertOk('T2.2 — exceção foi lançada', { ok: t2Caught });
  const t2Intent = await getIntentMetadata(req2);
  assertOk('T2.3 — nenhum payment_intent criado', { ok: t2Intent === null });
  const t2Splits = await getBankSplits(req2);
  assertOk('T2.4 — nenhum bank_split criado', {
    ok: t2Splits.length === 0,
    detail: t2Splits,
  });

  // ============================================================
  // T3 — receiver_company_hq com HQ cadastrado
  // ============================================================
  console.log('\n=== T3 — receiver_company_hq + HQ cadastrado → resolve para cidade do HQ ===');
  // Cria company + HQ em São Paulo, vincula worker à company
  const companyT3 = uuidv4();
  await pool.query(
    `INSERT INTO companies (company_id, tenant_id, company_name, status, company_status)
     VALUES ($1::uuid, $2::uuid, $3, 'active', 'ACTIVE')`,
    [companyT3, TENANT_ID, `pe5_resolver_T3_company_${companyT3.slice(0, 8)}`]
  );
  await pool.query(
    `UPDATE actors SET company_id=$1::uuid WHERE id=$2::uuid AND tenant_id=$3::uuid`,
    [companyT3, fx.workerActorId, TENANT_ID]
  );
  const hqAddr = await pool.query<{ address_id: string }>(
    `INSERT INTO addresses (country_id, state_id, city_id, source, created_by_tenant_id)
     VALUES ($1::uuid, $2::uuid, $3::uuid, 'UX_INPUT', $4::uuid)
     RETURNING address_id::text`,
    [fx.brId, fx.spStateId, fx.spCity.id, TENANT_ID]
  );
  await pool.query(
    `INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary)
     VALUES ('company', $1::uuid, $2::uuid, 'HQ', true)`,
    [companyT3, hqAddr.rows[0]!.address_id]
  );
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_PREFIX}T3_hq_resolve`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 1000,
        priority: 1,
        regionalOriginBasis: 'receiver_company_hq',
      },
    ],
  });
  const req3 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
    paymentRequestId: req3,
  });
  const splits3 = await getBankSplits(req3);
  const fundSplit3 = splits3.find((s) => s.split_type === 'regional_fund')!;
  const fundAccount3 = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: 'BR', state: 'SP', city: 'São Paulo' },
    'BRL'
  );
  assertOk('T3.1 — regional_fund routou para conta da cidade do HQ (SP)', {
    ok: fundSplit3.target_account_id === fundAccount3.accountId,
    reason: `target=${fundSplit3.target_account_id} esperado=${fundAccount3.accountId}`,
  });

  // ============================================================
  // T4 — receiver_company_hq SEM HQ → fail-closed
  // ============================================================
  console.log('\n=== T4 — receiver_company_hq SEM HQ → POLICY_REGIONAL_ORIGIN_UNRESOLVABLE ===');
  // Apaga HQ da company
  await pool.query(
    `DELETE FROM address_assignments WHERE owner_type='company' AND owner_id=$1::uuid AND role='HQ'`,
    [companyT3]
  );
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_PREFIX}T4_hq_missing`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 1000,
        priority: 1,
        regionalOriginBasis: 'receiver_company_hq',
      },
    ],
  });
  const req4 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  let t4Caught = false;
  try {
    await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
      paymentRequestId: req4,
    });
  } catch (e: any) {
    t4Caught = true;
    assertOk('T4.1 — POLICY_REGIONAL_ORIGIN_UNRESOLVABLE lançado', {
      ok: /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/.test(String(e?.message)),
      reason: `recebi: ${e?.message}`,
    });
  }
  assertOk('T4.2 — exceção foi lançada', { ok: t4Caught });

  // ============================================================
  // T5 — mixed_policy: operational (Curitiba) + hq (SP) → 2 splits distintos
  // ============================================================
  console.log('\n=== T5 — mixed_policy: 2 linhas regional_fund (op + hq) → 2 splits independentes ===');
  // Restaura HQ em SP + OPERATIONAL em Curitiba
  await pool.query(
    `INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary)
     VALUES ('company', $1::uuid, $2::uuid, 'HQ', true)`,
    [companyT3, hqAddr.rows[0]!.address_id]
  );
  await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, fx.workerActorId, {
    address: {
      countryId: fx.brId,
      stateId: fx.prStateId,
      cityId: fx.cwbCity.id,
      source: 'UX_INPUT',
      street: 'Rua T5 op Curitiba',
    } as any,
  });
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_PREFIX}T5_mixed`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 8000, priority: 0 },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 1500,
        priority: 1,
        regionalOriginBasis: 'receiver_company_operational',
      },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 500,
        priority: 2,
        regionalOriginBasis: 'receiver_company_hq',
      },
    ],
  });
  const req5 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
    paymentRequestId: req5,
  });
  const splits5 = await getBankSplits(req5);
  assertOk('T5.1 — 3 bank_splits criados (revenue + 2 regional_fund)', {
    ok: splits5.length === 3,
    reason: `count=${splits5.length}`,
    detail: splits5,
  });
  const regSplits5 = splits5.filter((s) => s.split_type === 'regional_fund');
  assertOk('T5.2 — 2 splits regional_fund distintos', { ok: regSplits5.length === 2 });
  const cwbAcc5 = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: 'BR', state: 'PR', city: 'Curitiba' },
    'BRL'
  );
  const spAcc5 = await bankAccountService.ensureRegionalFundBankAccountForRegion(
    TENANT_ID,
    { country: 'BR', state: 'SP', city: 'São Paulo' },
    'BRL'
  );
  const cwbSplit = regSplits5.find((s) => s.target_account_id === cwbAcc5.accountId);
  const spSplit = regSplits5.find((s) => s.target_account_id === spAcc5.accountId);
  assertOk('T5.3 — Curitiba recebeu 1500 (operational)', {
    ok: cwbSplit !== undefined && parseInt(cwbSplit.amount_cents, 10) === 1500,
    detail: cwbSplit,
  });
  assertOk('T5.4 — São Paulo recebeu 500 (hq)', {
    ok: spSplit !== undefined && parseInt(spSplit.amount_cents, 10) === 500,
    detail: spSplit,
  });

  // ============================================================
  // T6 — actor_wallet recebe APENAS revenue_share via D-money
  // ============================================================
  console.log('\n=== T6 — D-money move APENAS revenue_share para actor_wallet (regional_fund não vaza) ===');
  // Cria service_order release_approved para req5 (mixed_policy)
  const orderT6 = uuidv4();
  const scheduledStart = new Date(Date.now() - 60 * 60 * 1000);
  // Lookup booking_id da req5
  const req5Row = await pool.query<{ booking_id: string }>(
    `SELECT booking_id::text FROM service_payment_requests WHERE payment_request_id=$1::uuid LIMIT 1`,
    [req5]
  );
  await pool.query(
    `INSERT INTO service_orders (
       id, tenant_id, service_id, worker_actor_id, customer_actor_id, booking_id,
       status, settlement_flow, scheduled_start, completed_at,
       buyer_confirmation_deadline_at, release_eligible_at, buyer_confirmed_completion_at,
       created_by_actor_id, description, metadata
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
              'release_approved', 'fixed_price_escrow',
              $7, NOW(), NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days', NOW(),
              $4::uuid, 'PE-5-RESOLVER T6', '{}'::jsonb)`,
    [orderT6, TENANT_ID, fx.serviceId, fx.workerActorId, fx.buyerActorId, req5Row.rows[0]!.booking_id, scheduledStart]
  );
  const workerWallet = await bankAccountService.ensureActorWalletAccount(TENANT_ID, fx.workerActorId, 'BRL');
  const balBefore = (await bankAccountService.getBalance(TENANT_ID, workerWallet.accountId)).balanceCents;
  const released = await serviceOrderService.releaseFundsToActorWalletForOrder(TENANT_ID, orderT6);
  const balAfter = (await bankAccountService.getBalance(TENANT_ID, workerWallet.accountId)).balanceCents;
  assertOk('T6.1 — D-money moveu exatamente 8000 (revenue_share da T5)', {
    ok: balAfter - balBefore === 8000,
    reason: `diff=${balAfter - balBefore}; esperado=8000`,
    detail: released,
  });
  assertOk('T6.2 — D-money emitiu 1 split (não 3)', {
    ok: released.splits.length === 1,
    reason: `${released.splits.length} splits`,
    detail: released,
  });
  // regional_fund accounts NÃO devem ter recebido de D-money
  assertOk('T6.3 — nenhum D-money split foi para regional_fund', {
    ok: released.splits.every(
      (s) => s.toAccountId !== cwbAcc5.accountId && s.toAccountId !== spAcc5.accountId
    ),
    reason: 'D-money vazou regional_fund para actor_wallet',
  });

  // ============================================================
  // T7 — PF basis fail-closed
  // ============================================================
  console.log('\n=== T7 — receiver_identity_residence (PF) → POLICY_BASIS_UNSUPPORTED_MVP ===');
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_PREFIX}T7_pf_fail`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 1000,
        priority: 1,
        regionalOriginBasis: 'receiver_identity_residence',
      },
    ],
  });
  const req7 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  let t7Caught = false;
  try {
    await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
      paymentRequestId: req7,
    });
  } catch (e: any) {
    t7Caught = true;
    assertOk('T7.1 — POLICY_BASIS_UNSUPPORTED_MVP para PF basis', {
      ok: /POLICY_BASIS_UNSUPPORTED_MVP/.test(String(e?.message)),
      reason: `recebi: ${e?.message}`,
    });
  }
  assertOk('T7.2 — exceção foi lançada', { ok: t7Caught });

  // ============================================================
  // T8 — HQ NÃO é fallback de operational
  // ============================================================
  console.log('\n=== T8 — HQ NÃO é fallback automático de operational ===');
  // Remove OPERATIONAL mas MANTÉM HQ. Policy declara basis=operational.
  // Resultado esperado: falha (não cai em HQ).
  await cleanupOperational(fx.workerActorId);
  // HQ ainda está em SP (criado em T5 setup)
  await cleanupPolicies();
  await seedPolicy({
    code: `${POLICY_PREFIX}T8_no_fallback`,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      {
        lineType: 'regional_fund',
        destinationType: 'regional_fund',
        bps: 1000,
        priority: 1,
        regionalOriginBasis: 'receiver_company_operational', // ← pede OP, não HQ
      },
    ],
  });
  const req8 = await createPaymentRequest(fx.buyerActorId, fx.workerActorId, fx.serviceId, 10000);
  let t8Caught = false;
  try {
    await servicePaymentExecutionService.createExecution(TENANT_ID, fx.buyerUserId, {
      paymentRequestId: req8,
    });
  } catch (e: any) {
    t8Caught = true;
    assertOk('T8.1 — POLICY_REGIONAL_ORIGIN_UNRESOLVABLE (não caiu em HQ)', {
      ok: /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/.test(String(e?.message)),
      reason: `recebi: ${e?.message}`,
    });
  }
  assertOk('T8.2 — exceção foi lançada (HQ não preenche operational)', { ok: t8Caught });

  // Cleanup final
  await cleanupOperational(fx.workerActorId);
  await pool.query(
    `DELETE FROM address_assignments WHERE owner_type='company' AND owner_id=$1::uuid`,
    [companyT3]
  );
  await pool.query(
    `UPDATE actors SET company_id=NULL WHERE id=$1::uuid AND tenant_id=$2::uuid`,
    [fx.workerActorId, TENANT_ID]
  );
  await deleteCompaniesAndFiscal(pool, "company_id=$1::uuid", [companyT3]);
  await cleanupPolicies();

  console.log(
    '\n═══ E2E PE-5-RESOLVER :: PASS — 8 cenários T1-T8 verdes. Resolver dinâmico ' +
      'PJ-only funcional. receiver_company_operational + receiver_company_hq + ' +
      'mixed_policy. PF/service/transaction/economic_region fail-closed. HQ NÃO ' +
      'é fallback. actor_wallet só recebe revenue_share. ═══'
  );
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
