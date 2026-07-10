/**
 * E2E — F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION (DECISION-0140 unidade bps + DECISION-0141 schema-of-record).
 *
 * Prova material da correção da taxa UnifyCard/marketplace:
 *   - 299 bps sobre 10.000 cents = 299 cents (via economic_policy_engine, floor(gross*bps/10000));
 *   - a taxa vem do economic_policy_engine (resolved + policyId), NÃO de fee_percentage/100;
 *   - snapshot é em bps (feeRateBps), sem fee_percentage;
 *   - fail-closed: sem policy aplicável ⇒ fee=0 (sem fallback em percentage);
 *   - payment_methods/unifycard_payment_methods NÃO são consultadas pelo resolvedor (não-SSOT);
 *   - marketplace-fee-policy NÃO importa Bank/settlement/payout (boundary preservado);
 *   - R8Q 501 unifycard-method continua contido (guard);
 *   - guard de consumer fee-bps verde.
 *
 * Cria e DEPOIS LIMPA sua própria policy (cleanup por policy_code dedicado). Não toca bank_ledger/payout/settlement.
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-unifycard-fee-bps.ts
 */
import dotenv from 'dotenv';
import { join } from 'path';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import { resolveMarketplaceFeeViaPolicy } from '../modules/marketplace/marketplace-fee-policy';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';
const MODULE = 'marketplace_payment'; // moduleContext que o resolvedor usa
const CODE_PREFIX = 'unifycard_fee_bps_e2e'; // base do cleanup (pega runs antigas via LIKE)
// DECISION-0166 (F1-a): policy ativada é imutável e não-deletável (encerra por deprecação);
// deprecated de runs antigas ficam no banco → código único por run evita colisão do
// UNIQUE(tenant, policy_code, version).
const RUN_CODE = `${CODE_PREFIX}_${Date.now().toString(36)}`;
const cwd = process.cwd();

let pass = 0;
let fail = 0;
const ok = (label: string, cond: boolean, detail?: unknown): void => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
};

async function cleanup(): Promise<void> {
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
  // DECISION-0166 (F1-a): ativada NUNCA é deletada — neutraliza por deprecação (transição
  // permitida; deprecated é inerte na resolução). Só draft é deletável.
  await pool.query(
    `UPDATE economic_policies SET status = 'deprecated'
      WHERE tenant_id = $1::uuid AND policy_code LIKE $2 AND status = 'active'`,
    [TENANT_ID, `${CODE_PREFIX}%`]
  );
  await pool.query(
    `DELETE FROM economic_policies WHERE tenant_id = $1::uuid AND policy_code LIKE $2 AND status = 'draft'`,
    [TENANT_ID, `${CODE_PREFIX}%`]
  );
}

async function seedFeePolicy(): Promise<string> {
  // Rito DECISION-0166 (F1-b): lines só entram em policy DRAFT — draft → lines → activate.
  const policy = await economicPolicyRepository.createPolicy({
    tenantId: TENANT_ID,
    policyCode: `${RUN_CODE}_main`,
    policyType: 'COMMISSION_SPLIT',
    moduleContext: MODULE,
    vertical: 'marketplace',
    priority: 0,
    effectiveFrom: new Date(Date.now() - 60 * 1000),
    effectiveUntil: null,
    status: 'draft',
  } as any);
  // platform_fee 299 bps (a taxa) + revenue_share 9701 bps (líquido do vendedor, absorve drift).
  await economicPolicyRepository.createPolicyLine(TENANT_ID, {
    policyId: policy.id, lineType: 'platform_fee' as any, destinationType: 'platform_fees' as any,
    bps: 299, fixedAmountCents: null, priority: 0,
  } as any);
  await economicPolicyRepository.createPolicyLine(TENANT_ID, {
    policyId: policy.id, lineType: 'revenue_share' as any, destinationType: 'receiver_actor' as any,
    bps: 9701, fixedAmountCents: null, priority: 1,
  } as any);
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [TENANT_ID]);
  await pool.query(
    `UPDATE economic_policies SET status = 'active' WHERE id = $1::uuid AND status = 'draft'`,
    [policy.id]
  );
  return policy.id;
}

async function main(): Promise<void> {
  console.log('═══ E2E UNIFYCARD FEE BPS — F-UNIFYCARD-METHOD-FEE-BPS-MATERIAL-MIGRATION ═══\n');
  await cleanup();

  console.log('=== A — 299 bps sobre 10000 cents via economic_policy_engine ===');
  await seedFeePolicy();
  const r = await resolveMarketplaceFeeViaPolicy(TENANT_ID, 10000);
  ok('A1 resolved=true (taxa veio do engine)', r.resolved === true, r.resolved);
  ok('A2 feeAmountCents = 299 (floor(10000*299/10000))', r.feeAmountCents === 299, r.feeAmountCents);
  ok('A3 netAmountCents = 9701', r.netAmountCents === 9701, r.netAmountCents);
  ok('A4 feeRateBps (snapshot) = 299', r.feeRateBps === 299, r.feeRateBps);
  ok('A5 policyId presente (origem = economic_policy_engine)', !!r.policyId, r.policyId);
  ok('A6 snapshot NÃO contém fee_percentage (chaves bps-only)',
    !Object.keys(r).some((k) => /percentage|percent/i.test(k)), Object.keys(r));

  console.log('\n=== B — fail-closed: sem policy ⇒ fee=0 (sem fallback em percentage) ===');
  await cleanup();
  const r0 = await resolveMarketplaceFeeViaPolicy(TENANT_ID, 10000);
  ok('B1 resolved=false sem policy', r0.resolved === false, r0.resolved);
  ok('B2 feeAmountCents = 0 (fail-closed, nunca cobra sem SSOT)', r0.feeAmountCents === 0, r0.feeAmountCents);
  ok('B3 netAmountCents = gross (10000)', r0.netAmountCents === 10000, r0.netAmountCents);

  console.log('\n=== C — boundary: resolvedor não toca Bank/settlement/payout nem method-as-SSOT ===');
  const fpSrc = readFileSync(join(cwd, 'src/modules/marketplace/marketplace-fee-policy.ts'), 'utf-8');
  ok('C1 resolvedor não importa bank/settlement/payout',
    !/bank-transaction|bank-account|settlement|payout|bank_ledger|bank_transactions|bank_splits/.test(fpSrc));
  ok('C2 resolvedor não lê payment_methods/unifycard_payment_methods (não-SSOT)',
    !/paymentMethod\s*\.\s*feePercentage|unifycard_payment_methods|payment_methods/.test(fpSrc));
  ok('C3 resolvedor usa calculatePolicySplits (floor bps via engine)', /calculatePolicySplits/.test(fpSrc));

  console.log('\n=== D — guards: fee-bps-consumer verde + R8Q 501 contido ===');
  let g1 = 0; try { execSync('node scripts/audit-unifycard-fee-bps-consumer.mjs', { cwd, encoding: 'utf8' }); } catch { g1 = 1; }
  ok('D1 guard audit-unifycard-fee-bps-consumer verde', g1 === 0);
  let g2 = 0; try { execSync('node scripts/audit-unifycard-method-money-containment.mjs', { cwd, encoding: 'utf8' }); } catch { g2 = 1; }
  ok('D2 R8Q containment (audit-unifycard-method-money-containment) verde', g2 === 0);

  await cleanup();

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${pass}/${pass + fail} verdes`);
  if (fail > 0) { console.error('💥 E2E FALHOU'); await pool.end(); process.exit(1); }
  console.log('✨ UnifyCard fee resolvida via economic_policy_engine em bps: 299 bps × 10000¢ = 299¢; fail-closed sem policy; snapshot bps; boundary preservado; R8Q contido.');
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
