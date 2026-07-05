/**
 * E2E — F-REGIONAL-FUND-PF-RESOLVER (Fatia 9 passo 3, decision pack PORTA-1, fecha
 * DT-PE5-PF-RESOLVER-PENDING). Roda SÓ em DB efêmera (runner
 * run-regional-fund-pf-resolver-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o resolver PE-5-RESOLVER-V2 pro basis de Pessoa Física (payer/receiver_identity_residence),
 * espelhando o desenho do E2E irmão (validate-pipeline-e2e-pe5-resolver.ts, PJ-only):
 *   A · receiver_identity_residence COM residência cadastrada → resolve pra conta regional_fund
 *       da cidade da residência do RECEIVER (não do payer);
 *   B · payer_identity_residence COM residência cadastrada → resolve pra conta regional_fund da
 *       cidade da residência do PAYER (não do receiver) — prova que a ponta certa é usada;
 *   C · payer_identity_residence SEM residência cadastrada → POLICY_REGIONAL_ORIGIN_UNRESOLVABLE,
 *       zero bank_split gravado (fail-closed, nunca adivinha);
 *   D · Δbank nos casos A/B reflete exatamente o valor do split regional_fund (a conta é
 *       per-região — `system:regional_fund:<tenant>:<country>-<state>-<city>`).
 */

import 'tsconfig-paths/register';

// F-BANK-TRANSACTION-SINK-FIREWALL (Fatia 9, achado da auditoria Yala 2026-07-05): este E2E
// chama servicePaymentExecutionService.createExecution -> ... -> bankTransactionService.
// createTransactionWithExplicitSplitLines DIRETO (4o entrypoint do sink, agora gated) — precisa
// ligar o gate default-off pra continuar exercitando o fluxo real que este arquivo sempre testou.
process.env.BANK_TRANSACTION_SINK_FIREWALL_ENABLED = 'true';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { servicePaymentExecutionService } from '../modules/services/service-payment-execution.service';
import { economicPolicyRepository } from '../modules/economy/policy-engine/economic-policy.repository';
import { locationRepository } from '../core/location/location.repository';
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
  if (!/regional|pf.?resolver|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 41).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `rfpf-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, gu };
}

async function setResidence(tenantId: string, actorId: string, cep: string, cityName: string, stateAbbr: string): Promise<void> {
  const country = await locationRepository.findCountryByCode('BR');
  if (!country) throw new Error('ABORT: país BR ausente no catálogo (migration de seed geo esperada)');
  const stateRow = await pool.query<{ state_id: string }>(
    `SELECT state_id::text FROM states WHERE country_id=$1::uuid AND abbreviation=$2 LIMIT 1`,
    [country.id, stateAbbr]
  );
  if (!stateRow.rows[0]) throw new Error(`ABORT: estado ${stateAbbr} ausente no catálogo`);
  const stateId = stateRow.rows[0].state_id;
  let cityRow = await pool.query<{ city_id: string }>(
    `SELECT city_id::text FROM cities WHERE state_id=$1::uuid AND name=$2 LIMIT 1`,
    [stateId, cityName]
  );
  let cityId: string;
  if (cityRow.rows[0]) {
    cityId = cityRow.rows[0].city_id;
  } else {
    const ins = await pool.query<{ city_id: string }>(
      `INSERT INTO cities (state_id, name, is_active) VALUES ($1::uuid,$2,true) RETURNING city_id::text`,
      [stateId, cityName]
    );
    cityId = ins.rows[0]!.city_id;
  }
  const addr = await locationRepository.createAddress(
    { countryId: country.id, stateId, cityId, neighborhoodId: null, postalCode: cep, street: 'Rua E2E', number: '1', complement: null, reference: null, source: 'UX_INPUT', lat: null, lng: null },
    tenantId
  );
  await locationRepository.assignAddress(addr.id, 'profile', actorId, 'RESIDENCE', true);
}

async function seedPolicy(tenantId: string, code: string): Promise<string> {
  const p = await economicPolicyRepository.createPolicy({
    tenantId,
    policyCode: code,
    policyType: 'COMMISSION_SPLIT',
    moduleContext: 'service_execution',
    vertical: 'services',
    pricingModel: 'fixed',
    settlementFlow: 'fixed_price_escrow',
    effectiveFrom: new Date(Date.now() - 60_000),
    status: 'active',
  });
  await economicPolicyRepository.createPolicyLine(tenantId, {
    policyId: p.id, lineType: 'revenue_share' as any, destinationType: 'receiver_actor' as any, bps: 9000, priority: 0, regionalOriginBasis: null,
  });
  return p.id;
}

async function addRegionalFundLine(tenantId: string, policyId: string, basis: 'payer_identity_residence' | 'receiver_identity_residence'): Promise<void> {
  await economicPolicyRepository.createPolicyLine(tenantId, {
    policyId, lineType: 'regional_fund' as any, destinationType: 'regional_fund' as any, bps: 1000, priority: 1, regionalOriginBasis: basis as any,
  });
}

// trg_check_coverage (migration 0003) bloqueia crédito em conta NÃO-system se
// execution_capacity_cents (soma de créditos em contas system) for 0 — achado durante a execução
// deste E2E. Semeia capacidade numa conta system ANTES de subsidiar qualquer user_wallet (mesmo
// padrão de validate-pipeline-e2e-kyc.ts §6.2b).
async function seedSystemCapacity(tenantId: string, actorId: string, amountCents: number): Promise<void> {
  const acc = await pool.query<{ id: string }>(
    `INSERT INTO bank_accounts (tenant_id, owner_id, owner_type, account_type)
     VALUES ($1::uuid,$2,'system','credit') RETURNING id::text AS id`,
    [tenantId, `system:rfpf-reserve:${tenantId}`]
  );
  const accountId = acc.rows[0]!.id;
  const txId = randomUUID();
  const conceptId = (await pool.query<{ id: string }>(`SELECT concept_id::text AS id FROM concepts LIMIT 1`)).rows[0]?.id;
  if (!conceptId) throw new Error('ABORT: nenhum concept seedado na DB efêmera');
  await pool.query(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,'execution','E2E system capacity seed','rfpf_e2e_capacity',$6,$7::uuid,NOW())`,
    [txId, tenantId, actorId, accountId, amountCents, randomUUID(), conceptId]
  );
  await pool.query(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'credit',$4,'execution','E2E system capacity seed')`,
    [tenantId, accountId, txId, amountCents]
  );
}

async function subsidize(tenantId: string, actorId: string, userId: string, amountCents: number): Promise<void> {
  // ACHADO durante a execução deste E2E: processServicePaymentExecutionCanonical debita via
  // resolveUserAccount (bank-integration.service.ts) → getOrCreateAccount(ownerId=userId,
  // ownerType='user', accountType default 'credit') — uma conta DIFERENTE da 'user_wallet' que
  // ensureUserWalletForActor cria (essa é pro D-money/payout, não pro débito de compra). Reusa a
  // MESMA função de resolução (composição) em vez de adivinhar o esquema.
  const account = await bankAccountService.getOrCreateAccount(tenantId, { ownerId: userId, ownerType: 'user', currency: 'BRL' });
  const accountId = account.accountId;
  const txId = randomUUID();
  const conceptId = (await pool.query<{ id: string }>(`SELECT concept_id::text AS id FROM concepts LIMIT 1`)).rows[0]?.id;
  if (!conceptId) throw new Error('ABORT: nenhum concept seedado na DB efêmera');
  await pool.query(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id, internal_completed_at)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,'execution','E2E subsidy','rfpf_e2e_subsidy',$6,$7::uuid,NOW())`,
    [txId, tenantId, actorId, accountId, amountCents, randomUUID(), conceptId]
  );
  await pool.query(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'credit',$4,'execution','E2E subsidy')`,
    [tenantId, accountId, txId, amountCents]
  );
}

async function createPaymentRequest(tenantId: string, payerActorId: string, receiverActorId: string, serviceId: string, amountCents: number): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO service_payment_requests (payment_request_id, tenant_id, booking_id, service_id, payer_actor_id, receiver_actor_id, payment_request_status, amount_cents, currency)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,'pending',$7,'BRL')`,
    [id, tenantId, randomUUID(), serviceId, payerActorId, receiverActorId, amountCents]
  );
  return id;
}

async function regionalFundBalanceForCity(tenantId: string, cityName: string, stateAbbr: string): Promise<number> {
  const ownerId = `system:regional_fund:${tenantId}:BR-${stateAbbr}-${cityName}`;
  const acc = await pool.query<{ id: string }>(
    `SELECT id::text FROM bank_accounts WHERE tenant_id=$1::uuid AND owner_id=$2 AND owner_type='system' LIMIT 1`,
    [tenantId, ownerId]
  );
  if (!acc.rows[0]) return 0;
  const bal = await pool.query<{ n: string }>(
    `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount_cents ELSE -amount_cents END),0)::text AS n FROM bank_ledger WHERE account_id=$1`,
    [acc.rows[0].id]
  );
  return Number(bal.rows[0].n);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Regional Fund PF Resolver Tenant', slug: `rfpf-${Date.now()}` });
  await bankAccountService.ensurePlatformAccounts(TENANT, 'BRL');

  const payer = await mkUserActor(TENANT, 'Payer PF E2E');
  const receiver = await mkUserActor(TENANT, 'Receiver PF E2E');
  const noResidencePayer = await mkUserActor(TENANT, 'Payer Sem Residencia E2E');

  await bankAccountService.ensureUserWalletForActor(TENANT, payer.actorId);
  await bankAccountService.ensureUserWalletForActor(TENANT, receiver.actorId);
  await bankAccountService.ensureUserWalletForActor(TENANT, noResidencePayer.actorId);
  await seedSystemCapacity(TENANT, payer.actorId, 10_000_000);
  await subsidize(TENANT, payer.actorId, payer.userId, 500_000);
  await subsidize(TENANT, noResidencePayer.actorId, noResidencePayer.userId, 500_000);

  // concept/canonical_service governados — services.canonical_service_id é NOT NULL (mesmo padrão
  // de fixture já usado nas Fatias 6/9 desta sessão).
  const gcClient = await pool.connect();
  let conceptId: string;
  try {
    await gcClient.query('BEGIN');
    await gcClient.query(`SELECT set_config('app.concept_governance', 'true', true)`);
    conceptId = (await gcClient.query<{ id: string }>(
      `INSERT INTO concepts (slug, domain) VALUES ($1, 'servicos') RETURNING concept_id::text AS id`,
      [`rfpf-servico-${Date.now()}`]
    )).rows[0]!.id;
    await gcClient.query('COMMIT');
  } catch (e) {
    await gcClient.query('ROLLBACK');
    throw e;
  } finally {
    gcClient.release();
  }
  const canonicalServiceId = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_services (concept_id, name, slug, scope) VALUES ($1::uuid,'Serviço RFPF E2E',$2,'global') RETURNING id::text AS id`,
    [conceptId, `rfpf-canon-${Date.now()}`]
  )).rows[0]!.id;
  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status)
     VALUES ($1::uuid,$2::uuid,'Serviço RFPF E2E',$3,$4::uuid,'active') RETURNING service_id::text AS id`,
    [TENANT, receiver.actorId, `rfpf-svc-${Date.now()}`, canonicalServiceId]
  )).rows[0].id;

  await setResidence(TENANT, receiver.actorId, '80000-000', 'Curitiba RFPF', 'PR');
  await setResidence(TENANT, payer.actorId, '01000-000', 'São Paulo RFPF', 'SP');

  try {
    console.log('\n— regional fund PF resolver END-TO-END (fecha DT-PE5-PF-RESOLVER-PENDING) —');

    // A · receiver_identity_residence COM residência → resolve pra cidade do RECEIVER (Curitiba)
    const policyA = await seedPolicy(TENANT, `rfpf_a_${Date.now()}`);
    await addRegionalFundLine(TENANT, policyA, 'receiver_identity_residence');
    const reqA = await createPaymentRequest(TENANT, payer.actorId, receiver.actorId, serviceId, 10000);
    const balCwbBeforeA = await regionalFundBalanceForCity(TENANT, 'Curitiba RFPF', 'PR');
    await servicePaymentExecutionService.createExecution(TENANT, payer.userId, { paymentRequestId: reqA } as any);
    const balCwbAfterA = await regionalFundBalanceForCity(TENANT, 'Curitiba RFPF', 'PR');
    record('A receiver_identity_residence COM residência → resolve pra cidade do RECEIVER (Curitiba), split=1000bps de 10000=1000',
      balCwbAfterA - balCwbBeforeA === 1000,
      `Δcuritiba=${balCwbAfterA - balCwbBeforeA} esperado=1000`);

    // B · payer_identity_residence COM residência → resolve pra cidade do PAYER (São Paulo), NÃO Curitiba
    const policyB = await seedPolicy(TENANT, `rfpf_b_${Date.now()}`);
    await addRegionalFundLine(TENANT, policyB, 'payer_identity_residence');
    // desativa a policy A pra não colidir na resolução (mesmo module_context/vertical)
    await pool.query(`UPDATE economic_policies SET status='deprecated' WHERE id=$1::uuid`, [policyA]);
    const reqB = await createPaymentRequest(TENANT, payer.actorId, receiver.actorId, serviceId, 10000);
    const balSpBeforeB = await regionalFundBalanceForCity(TENANT, 'São Paulo RFPF', 'SP');
    const balCwbBeforeB = await regionalFundBalanceForCity(TENANT, 'Curitiba RFPF', 'PR');
    await servicePaymentExecutionService.createExecution(TENANT, payer.userId, { paymentRequestId: reqB } as any);
    const balSpAfterB = await regionalFundBalanceForCity(TENANT, 'São Paulo RFPF', 'SP');
    const balCwbAfterB = await regionalFundBalanceForCity(TENANT, 'Curitiba RFPF', 'PR');
    record('B payer_identity_residence COM residência → resolve pra cidade do PAYER (São Paulo), NÃO do receiver (Curitiba intacta)',
      balSpAfterB - balSpBeforeB === 1000 && balCwbAfterB === balCwbBeforeB,
      `ΔsãoPaulo=${balSpAfterB - balSpBeforeB} esperado=1000; Δcuritiba=${balCwbAfterB - balCwbBeforeB} esperado=0`);

    // C · payer_identity_residence SEM residência → fail-closed, zero split gravado
    const beforeCountC = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM bank_splits WHERE tenant_id=$1::uuid`, [TENANT]);
    const reqC = await createPaymentRequest(TENANT, noResidencePayer.actorId, receiver.actorId, serviceId, 10000);
    let errC: any = null;
    try {
      await servicePaymentExecutionService.createExecution(TENANT, noResidencePayer.userId, { paymentRequestId: reqC } as any);
    } catch (e: any) { errC = e; }
    const afterCountC = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM bank_splits WHERE tenant_id=$1::uuid`, [TENANT]);
    record('C payer_identity_residence SEM residência → POLICY_REGIONAL_ORIGIN_UNRESOLVABLE, zero bank_split novo',
      /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/.test(String(errC?.message)) && beforeCountC.rows[0].n === afterCountC.rows[0].n,
      `erro=${errC?.message} count ${beforeCountC.rows[0].n}→${afterCountC.rows[0].n}`);
  } finally {
    // noop
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
