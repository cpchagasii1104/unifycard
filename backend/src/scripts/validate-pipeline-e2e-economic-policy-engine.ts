/**
 * E2E ECONOMIC POLICY ENGINE — PE-1 substrate (2026-05-26)
 *
 * 15 testes do resolver puro + cálculo BPS + access pass.
 * Não toca bank_ledger, payment_intent, service_orders.
 * Cria e DEPOIS LIMPA suas próprias policies/passes (cleanup
 * append-only seguro: DELETE feito por policy_code dedicado a este E2E).
 *
 * Modo de execução:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-economic-policy-engine.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import { economicPolicyEngineService } from '../modules/economy/policy-engine/economic-policy-engine.service';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const MODULE = 'pe1_e2e_module'; // namespace isolado deste E2E

type CheckResult = { ok: true; detail?: any } | { ok: false; reason: string; detail?: any };

function assertOk(label: string, r: CheckResult): void {
  if (r.ok === false) {
    console.error(`  ❌ FALHOU: ${label}`);
    console.error(`     Motivo: ${r.reason}`);
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

async function cleanupPriorRun(): Promise<void> {
  // Apaga policies/products deste namespace antes de seedar. RLS
  // exige set_config.
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
  // Cleanup com LIKE prefix para pegar MODULE + sub-modules (ex: T7).
  await pool.query(
    `DELETE FROM economic_policies WHERE tenant_id = $1::uuid AND module_context LIKE $2`,
    [TENANT_ID, `${MODULE}%`]
  );
  await pool.query(
    `DELETE FROM actor_access_passes WHERE tenant_id = $1::uuid AND product_id IN (
       SELECT id FROM access_pass_products WHERE tenant_id = $1::uuid AND module_context LIKE $2
     )`,
    [TENANT_ID, `${MODULE}%`]
  );
  await pool.query(
    `DELETE FROM access_pass_products WHERE tenant_id = $1::uuid AND module_context LIKE $2`,
    [TENANT_ID, `${MODULE}%`]
  );
}

async function loadActorId(): Promise<string> {
  const res = await pool.query<{ actor_id: string }>(
    `SELECT a.id::text AS actor_id FROM actors a
        JOIN users u ON u.user_id = a.user_id AND u.tenant_id = a.tenant_id
       WHERE a.tenant_id = $1::uuid AND u.email = 'g2-provider@e2e.internal'
         AND a.actor_type = 'user' LIMIT 1`,
    [TENANT_ID]
  );
  if (!res.rows[0]) throw new Error('Fixture actor não encontrado');
  return res.rows[0].actor_id;
}

async function main() {
  console.log('═══ E2E ECONOMIC POLICY ENGINE — PE-1 substrate ═══\n');
  await bootstrap();
  await cleanupPriorRun();
  const actorId = await loadActorId();
  console.log(`  ℹ  actor=${actorId.slice(0, 8)} module=${MODULE}\n`);

  // Helper: cria policy completa (header + lines).
  async function seedPolicy(opts: {
    code: string;
    selectors?: Record<string, any>;
    priority?: number;
    lines: Array<{ lineType: string; destinationType: string; bps?: number; fixedAmountCents?: number; priority?: number }>;
    effectiveFrom?: Date;
    effectiveUntil?: Date | null;
    policyType?: 'COMMISSION_SPLIT' | 'ZERO_FEE' | 'ACCESS_PASS' | 'HYBRID' | 'CONTRACTUAL';
    status?: 'active' | 'draft' | 'deprecated';
  }): Promise<string> {
    const policy = await economicPolicyRepository.createPolicy({
      tenantId: TENANT_ID,
      policyCode: opts.code,
      policyType: opts.policyType ?? 'COMMISSION_SPLIT',
      moduleContext: MODULE,
      priority: opts.priority ?? 0,
      effectiveFrom: opts.effectiveFrom ?? new Date(Date.now() - 60 * 1000),
      effectiveUntil: opts.effectiveUntil ?? null,
      status: opts.status ?? 'active',
      ...(opts.selectors ?? {}),
    });
    for (const ln of opts.lines) {
      await economicPolicyRepository.createPolicyLine(TENANT_ID, {
        policyId: policy.id,
        lineType: ln.lineType as any,
        destinationType: ln.destinationType as any,
        bps: ln.bps ?? null,
        fixedAmountCents: ln.fixedAmountCents ?? null,
        priority: ln.priority ?? 0,
      });
    }
    return policy.id;
  }

  // ============================================================
  // T1 — tenant/contexto resolve policy
  // ============================================================
  console.log('=== T1 — tenant + contexto resolve policy ===');
  const baseId = await seedPolicy({
    code: 'pe1_e2e_T1_base',
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9700, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 300, priority: 1 },
    ],
  });
  const r1 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
  });
  assertOk('T1.1 — status=resolved e policy escolhida', {
    ok: r1.status === 'resolved' && r1.policy?.id === baseId && r1.lines.length === 2,
    reason: 'não resolveu policy base',
    detail: r1,
  });

  // ============================================================
  // T2 — city vence region (specificity)
  // ============================================================
  console.log('\n=== T2 — city vence region ===');
  await seedPolicy({
    code: 'pe1_e2e_T2_region',
    selectors: { country: 'BR', region: 'PR' },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9500, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 500, priority: 1 },
    ],
  });
  const cityWinner = await seedPolicy({
    code: 'pe1_e2e_T2_city',
    selectors: { country: 'BR', region: 'PR', city: 'CWB' },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9800, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 200, priority: 1 },
    ],
  });
  const r2 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    country: 'BR',
    region: 'PR',
    city: 'CWB',
  });
  assertOk('T2.1 — policy de city escolhida', {
    ok: r2.policy?.id === cityWinner,
    reason: 'city não venceu region',
    detail: r2.policy,
  });

  // ============================================================
  // T3 — region vence country (specificity)
  // ============================================================
  console.log('\n=== T3 — region vence country ===');
  await seedPolicy({
    code: 'pe1_e2e_T3_country',
    selectors: { country: 'BR' },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9000, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 1000, priority: 1 },
    ],
  });
  // T2_region já existe — vence sobre T3_country quando city ausente.
  const r3 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    country: 'BR',
    region: 'PR',
  });
  assertOk('T3.1 — region vence country quando city ausente', {
    ok: r3.policy?.policyCode === 'pe1_e2e_T2_region',
    reason: 'region não venceu country',
    detail: r3.policy,
  });

  // ============================================================
  // T4 — category específica vence vertical geral
  // ============================================================
  console.log('\n=== T4 — category específica vence vertical geral ===');
  await seedPolicy({
    code: 'pe1_e2e_T4_vertical_only',
    selectors: { vertical: 'services' },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9700, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 300, priority: 1 },
    ],
  });
  // Categoria existente (categories é global, sem tenant_id).
  const catRow = await pool.query<{ category_id: string }>(
    `SELECT category_id::text AS category_id FROM categories LIMIT 1`
  );
  if (!catRow.rows[0]) throw new Error('Fixture: nenhuma categoria disponível');
  const categoryId = catRow.rows[0].category_id;
  const catWinner = await seedPolicy({
    code: 'pe1_e2e_T4_category',
    selectors: { vertical: 'services', categoryId },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9900, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 100, priority: 1 },
    ],
  });
  const r4 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    vertical: 'services',
    categoryId,
  });
  assertOk('T4.1 — policy com category específica venceu', {
    ok: r4.policy?.id === catWinner,
    reason: 'categoria específica não venceu vertical geral',
    detail: r4.policy,
  });

  // ============================================================
  // T5 — priority desempata (mesma specificity)
  // ============================================================
  console.log('\n=== T5 — priority desempata ===');
  await seedPolicy({
    code: 'pe1_e2e_T5_low',
    selectors: { vertical: 'food' },
    priority: 0,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9500, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 500, priority: 1 },
    ],
  });
  const highPriority = await seedPolicy({
    code: 'pe1_e2e_T5_high',
    selectors: { vertical: 'food' },
    priority: 100,
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9800, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 200, priority: 1 },
    ],
  });
  const r5 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    vertical: 'food',
  });
  assertOk('T5.1 — policy de priority maior escolhida', {
    ok: r5.policy?.id === highPriority,
    reason: 'priority não desempatou',
    detail: r5.policy,
  });

  // ============================================================
  // T6 — empate real → POLICY_AMBIGUITY
  // ============================================================
  console.log('\n=== T6 — empate real gera POLICY_AMBIGUITY ===');
  const tieFrom = new Date(Date.now() - 30 * 1000);
  await seedPolicy({
    code: 'pe1_e2e_T6_a',
    selectors: { vertical: 'events' },
    priority: 50,
    effectiveFrom: tieFrom,
    lines: [{ lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, priority: 0 }],
  });
  await seedPolicy({
    code: 'pe1_e2e_T6_b',
    selectors: { vertical: 'events' },
    priority: 50,
    effectiveFrom: tieFrom,
    lines: [{ lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, priority: 0 }],
  });
  const r6 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    vertical: 'events',
  });
  assertOk('T6.1 — status=ambiguous + errorCode=POLICY_AMBIGUITY', {
    ok: r6.status === 'ambiguous' && r6.errorCode === 'POLICY_AMBIGUITY',
    reason: 'empate real não detectado',
    detail: r6,
  });

  // ============================================================
  // T7 — effective_from/effective_until respeitados
  // ============================================================
  // Usa moduleContext isolado para garantir que SÓ a policy futura
  // existe nesse contexto — se vigência funcionar, deve retornar
  // NOT_FOUND.
  console.log('\n=== T7 — vigência respeitada ===');
  const FUTURE_MODULE = `${MODULE}_t7_future_only`;
  await economicPolicyRepository.createPolicy({
    tenantId: TENANT_ID,
    policyCode: 'pe1_e2e_T7_future',
    policyType: 'COMMISSION_SPLIT',
    moduleContext: FUTURE_MODULE,
    priority: 0,
    effectiveFrom: new Date(Date.now() + 86400 * 1000), // amanhã
    effectiveUntil: null,
    status: 'active',
    vertical: 'mobility',
  });
  const r7 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: FUTURE_MODULE,
    vertical: 'mobility',
  });
  assertOk('T7.1 — policy futura NÃO é elegível hoje', {
    ok: r7.status === 'not_found',
    reason: 'policy futura considerada erroneamente',
    detail: r7,
  });

  // ============================================================
  // T8 — cálculo BPS sem float
  // ============================================================
  console.log('\n=== T8 — cálculo BPS determinístico ===');
  const baseLines = await economicPolicyRepository.findPolicyLines(TENANT_ID, baseId);
  const calc = economicPolicyEngineService.calculatePolicySplits(10000, baseLines);
  assertOk('T8.1 — totalAmountCents preservado', {
    ok: calc.totalAmountCents === 10000,
    reason: 'total alterado',
  });
  assertOk('T8.2 — Σ splits = total (sem perda de centavo)', {
    ok: calc.splits.reduce((s, x) => s + x.amountCents, 0) === 10000,
    reason: 'soma divergiu',
    detail: calc.splits,
  });
  assertOk('T8.3 — sem decimais (Number.isInteger em cada split)', {
    ok: calc.splits.every((s) => Number.isInteger(s.amountCents)),
    reason: 'split com centavos fracionados',
    detail: calc.splits,
  });

  // ============================================================
  // T9 — drift para revenue_share
  // ============================================================
  console.log('\n=== T9 — drift de arredondamento absorvido por revenue_share ===');
  // Construir lines artificiais com bps que produzem drift.
  // 9999 + 1 = 10000; mas se amount=333, 9999*333/10000 = floor(332.667) = 332,
  // 1*333/10000 = 0; soma=332; drift=1 → revenue_share absorve.
  const driftLines = [
    {
      id: uuidv4(),
      policyId: 'fake',
      lineType: 'revenue_share' as const,
      destinationType: 'receiver_actor' as const,
      destinationKey: null,
      regionalOriginBasis: null,
      bps: 9999,
      fixedAmountCents: null,
      appliesTo: 'gross' as const,
      conditionType: null,
      conditionJson: {},
      priority: 0,
      metadata: {},
      createdAt: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      policyId: 'fake',
      lineType: 'platform_fee' as const,
      destinationType: 'platform_fees' as const,
      destinationKey: null,
      regionalOriginBasis: null,
      bps: 1,
      fixedAmountCents: null,
      appliesTo: 'gross' as const,
      conditionType: null,
      conditionJson: {},
      priority: 1,
      metadata: {},
      createdAt: new Date().toISOString(),
    },
  ];
  const driftCalc = economicPolicyEngineService.calculatePolicySplits(333, driftLines);
  const revShare = driftCalc.splits.find((s) => s.lineType === 'revenue_share')!;
  const platFee = driftCalc.splits.find((s) => s.lineType === 'platform_fee')!;
  assertOk('T9.1 — Σ = total mesmo com drift', {
    ok: driftCalc.splits.reduce((s, x) => s + x.amountCents, 0) === 333,
    reason: 'soma diverge',
    detail: driftCalc,
  });
  assertOk('T9.2 — revenue_share absorveu o drift (>=333 - platFee)', {
    ok: revShare.amountCents === 333 - platFee.amountCents,
    reason: 'drift não foi para revenue_share',
    detail: { revShare, platFee },
  });

  // ============================================================
  // T10 — soma final exata (já provada em T8.2/T9.1)
  // ============================================================
  console.log('\n=== T10 — invariante soma exata (re-asserção em valor diferente) ===');
  const calc100 = economicPolicyEngineService.calculatePolicySplits(99_777, baseLines);
  assertOk('T10.1 — Σ = 99777 (cents arbitrários)', {
    ok: calc100.splits.reduce((s, x) => s + x.amountCents, 0) === 99_777,
    reason: 'soma diverge para 99777',
    detail: calc100.splits,
  });

  // ============================================================
  // T11 — access pass ativo zera platform_fee
  // ============================================================
  console.log('\n=== T11 — access pass ativo zera/reduz platform_fee ===');
  const product = await economicPolicyRepository.createAccessPassProduct({
    tenantId: TENANT_ID,
    productCode: 'pe1_e2e_T11_pass',
    vertical: 'pass_test',
    moduleContext: MODULE,
    durationSeconds: 86400,
    priceCents: 5000,
    commissionOverrideBps: 0,
    effectiveFrom: new Date(Date.now() - 60 * 1000),
  });
  await economicPolicyRepository.createActorAccessPass({
    tenantId: TENANT_ID,
    actorId,
    productId: product.id,
    startsAt: new Date(Date.now() - 60 * 1000),
    endsAt: new Date(Date.now() + 86400 * 1000),
    status: 'active',
  });
  // Seedar policy para vertical='pass_test' onde o pass aplica.
  await seedPolicy({
    code: 'pe1_e2e_T11_policy',
    selectors: { vertical: 'pass_test' },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9500, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 500, priority: 1 },
    ],
  });
  const r11 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    vertical: 'pass_test',
    actorId,
  });
  assertOk('T11.1 — access pass aplicado', {
    ok: r11.appliedAccessPass !== null,
    reason: 'pass não aplicado',
    detail: r11,
  });
  const feeLine = r11.lines.find((l) => l.lineType === 'platform_fee')!;
  assertOk('T11.2 — platform_fee bps zerado pelo pass', {
    ok: feeLine.bps === 0,
    reason: 'override não aplicado',
    detail: feeLine,
  });
  const calcWithPass = economicPolicyEngineService.calculatePolicySplits(10000, r11.lines);
  const revLineWithPass = calcWithPass.splits.find((s) => s.lineType === 'revenue_share')!;
  assertOk('T11.3 — revenue_share absorveu 100% do pagamento (drift via revenue_share)', {
    ok: revLineWithPass.amountCents === 10000,
    reason: 'revenue_share não recebeu 100%',
    detail: calcWithPass.splits,
  });

  // ============================================================
  // T12 — access pass expirado NÃO altera policy
  // ============================================================
  console.log('\n=== T12 — pass expirado não aplica override ===');
  const expiredProduct = await economicPolicyRepository.createAccessPassProduct({
    tenantId: TENANT_ID,
    productCode: 'pe1_e2e_T12_expired',
    vertical: 'expired_test',
    moduleContext: MODULE,
    durationSeconds: 86400,
    priceCents: 5000,
    commissionOverrideBps: 0,
    effectiveFrom: new Date(Date.now() - 86400 * 2 * 1000),
  });
  await economicPolicyRepository.createActorAccessPass({
    tenantId: TENANT_ID,
    actorId,
    productId: expiredProduct.id,
    startsAt: new Date(Date.now() - 86400 * 2 * 1000),
    endsAt: new Date(Date.now() - 60 * 1000), // já expirou
    status: 'active', // status='active' mas ends_at no passado
  });
  await seedPolicy({
    code: 'pe1_e2e_T12_policy',
    selectors: { vertical: 'expired_test' },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 9500, priority: 0 },
      { lineType: 'platform_fee', destinationType: 'platform_fees', bps: 500, priority: 1 },
    ],
  });
  const r12 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    vertical: 'expired_test',
    actorId,
  });
  assertOk('T12.1 — pass expirado não foi aplicado', {
    ok: r12.appliedAccessPass === null,
    reason: 'pass expirado aplicado indevidamente',
    detail: r12,
  });
  const feeLine12 = r12.lines.find((l) => l.lineType === 'platform_fee')!;
  assertOk('T12.2 — platform_fee bps preservado (500, não 0)', {
    ok: feeLine12.bps === 500,
    reason: 'fee alterado por pass expirado',
    detail: feeLine12,
  });

  // ============================================================
  // T13 — ZERO_FEE policy: 100% revenue_share
  // ============================================================
  console.log('\n=== T13 — ZERO_FEE policy ===');
  await seedPolicy({
    code: 'pe1_e2e_T13_zerofee',
    policyType: 'ZERO_FEE',
    selectors: { vertical: 'promo_zero' },
    lines: [{ lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, priority: 0 }],
  });
  const r13 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    vertical: 'promo_zero',
  });
  const calc13 = economicPolicyEngineService.calculatePolicySplits(50_000, r13.lines);
  assertOk('T13.1 — ZERO_FEE: revenue_share 100% (50000 todo)', {
    ok:
      calc13.splits.length === 1 &&
      calc13.splits[0]!.lineType === 'revenue_share' &&
      calc13.splits[0]!.amountCents === 50_000,
    reason: 'ZERO_FEE não absorveu tudo',
    detail: calc13.splits,
  });

  // ============================================================
  // T14 — nenhuma policy → POLICY_NOT_FOUND
  // ============================================================
  console.log('\n=== T14 — nenhuma policy gera POLICY_NOT_FOUND ===');
  const r14 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: 'pe1_e2e_module_inexistente_xyz',
  });
  assertOk('T14.1 — status=not_found + errorCode=POLICY_NOT_FOUND', {
    ok: r14.status === 'not_found' && r14.errorCode === 'POLICY_NOT_FOUND',
    reason: 'comportamento errado para módulo sem policy',
    detail: r14,
  });

  // ============================================================
  // T15 — category_id como seletor (re-asserção alinhada com T4)
  // ============================================================
  console.log('\n=== T15 — category_id como seletor funcional ===');
  // T4 já provou categoria mais específica vence. T15 reforça: sem
  // categoria no input, policy sem categoria vence — não a categoria-
  // específica.
  const r15 = await economicPolicyEngineService.resolveEconomicPolicy({
    tenantId: TENANT_ID,
    moduleContext: MODULE,
    vertical: 'services',
    // SEM categoryId.
  });
  assertOk('T15.1 — sem category, policy vertical-only vence (não a category-específica)', {
    ok: r15.policy?.policyCode === 'pe1_e2e_T4_vertical_only',
    reason: 'category foi aplicada indevidamente',
    detail: r15.policy,
  });

  // ============================================================
  // T16-T18 — DECISION-0049 / regional_origin_basis (Postgres CHECK)
  // ============================================================
  // Estes testes provam que as CHECK constraints do banco bloqueiam
  // (não Zod / não TS). INSERT direto via SQL.
  console.log('\n=== T16 — CHECK Postgres: regional_fund dinâmico exige basis ===');
  await cleanupPriorRun();
  const t16PolicyId = await seedPolicy({
    code: 'pe1_e2e_T16_origin_basis',
    selectors: { vertical: 'origin_basis_check' },
    lines: [
      { lineType: 'revenue_share', destinationType: 'receiver_actor', bps: 10000, priority: 0 },
    ],
  });
  let t16Caught = false;
  try {
    await pool.query(
      `INSERT INTO economic_policy_lines (
         policy_id, line_type, destination_type, destination_key,
         regional_origin_basis, bps, applies_to, priority
       ) VALUES (
         $1::uuid, 'regional_fund', 'regional_fund', NULL,
         NULL, 500, 'gross', 1
       )`,
      [t16PolicyId]
    );
  } catch (e: any) {
    t16Caught = true;
    assertOk('T16.1 — Postgres bloqueou via CHECK chk_origin_basis_required_for_dynamic_regional', {
      ok:
        e?.code === '23514' &&
        /chk_origin_basis_required_for_dynamic_regional/.test(String(e?.constraint ?? '')),
      reason: `esperava SQLSTATE 23514 + constraint name; recebi code=${e?.code}, constraint=${e?.constraint}`,
      detail: { code: e?.code, constraint: e?.constraint, message: e?.message },
    });
  }
  assertOk('T16.2 — exceção SQL foi lançada (regional_fund sem destination_key sem basis bloqueia)', {
    ok: t16Caught, reason: 'INSERT permitido apesar do CHECK',
  });

  console.log('\n=== T17 — CHECK Postgres: mixed_policy NÃO é valor de enum ===');
  let t17Caught = false;
  try {
    await pool.query(
      `INSERT INTO economic_policy_lines (
         policy_id, line_type, destination_type, destination_key,
         regional_origin_basis, bps, applies_to, priority
       ) VALUES (
         $1::uuid, 'regional_fund', 'regional_fund', NULL,
         'mixed_policy', 500, 'gross', 1
       )`,
      [t16PolicyId]
    );
  } catch (e: any) {
    t17Caught = true;
    assertOk('T17.1 — Postgres bloqueou via CHECK chk_origin_basis_canonical_values', {
      ok:
        e?.code === '23514' &&
        /chk_origin_basis_canonical_values/.test(String(e?.constraint ?? '')),
      reason: `esperava SQLSTATE 23514 + chk_origin_basis_canonical_values; recebi code=${e?.code}, constraint=${e?.constraint}`,
      detail: { code: e?.code, constraint: e?.constraint, message: e?.message },
    });
  }
  assertOk('T17.2 — exceção SQL foi lançada (mixed_policy bloqueado pelo enum)', {
    ok: t17Caught, reason: 'mixed_policy aceito apesar do CHECK',
  });

  console.log('\n=== T18 — Path feliz via repository: basis canônico aceito ===');
  const t18Line = await economicPolicyRepository.createPolicyLine(TENANT_ID, {
    policyId: t16PolicyId,
    lineType: 'regional_fund',
    destinationType: 'regional_fund',
    bps: 500,
    priority: 2,
    regionalOriginBasis: 'receiver_company_operational',
  });
  assertOk('T18.1 — createPolicyLine via repository aceitou basis canônico', {
    ok: t18Line.regionalOriginBasis === 'receiver_company_operational',
    reason: 'basis não persistido corretamente',
    detail: t18Line,
  });

  // ============================================================
  // CLEANUP (re-roda para garantir limpeza)
  // ============================================================
  await cleanupPriorRun();

  console.log('\n═══ E2E PE-1 :: PASS — 18 testes verdes (T1-T15 originais + T16-T18 DECISION-0049 regional_origin_basis). Resolver canônico funcional, BPS sem float, drift seguro, access pass override correto, CHECK Postgres regional_fund dinâmico operacional, mixed_policy bloqueado no enum, basis canônico aceito. ═══');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
