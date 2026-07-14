#!/usr/bin/env node
// PROVA DB (rollback, resíduo-zero) da fundação B-CITY-1 (DECISION-0177).
// Executa as funções REAIS (resolveRegionalFundDestination exportada + lookupRegionalFundAccount)
// numa ÚNICA conexão (pool.connect patchado) dentro de BEGIN→ROLLBACK: fixtures sintéticos nunca
// persistem. Prova a matriz do envelope §17: residência actor-scoped resolve; ausência falha;
// profile legado NÃO salva; infra propaga; outra cidade falha; Curitiba sem mapping falha
// NOT_PROVISIONED; money path não cria conta; tx/split/ledger=0; lookup coerente/incoerente/
// cross-tenant; neighborhood HOLD. Rodar com: node --import tsx scripts/test-bank-city-foundation-db.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const TENANT = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const OTHER_TENANT = 'a0000001-0000-4000-8000-000000000001';
const BR = '42d04887-3033-459c-a4a9-8c6f9ea5a816';
const PR = '281155db-290d-462b-a220-f8aa75b1bf0b';
const CWB = '9d431002-1fd3-4b34-ae82-678f28f64288';
const RIO_BRANCO = '0bcb72d9-9d65-4d28-b46d-8237b6273925';
const RB_STATE = '7cee22a3-7015-46b2-8718-b701e7bfa135';
const A_CWB = 'b0000000-0000-4000-8000-0000000000a1';
const A_NONE = 'b0000000-0000-4000-8000-0000000000a2';
const A_PROFILE = 'b0000000-0000-4000-8000-0000000000a3';
const A_OTHER = 'b0000000-0000-4000-8000-0000000000a4';
const RECEIVER = 'b0000000-0000-4000-8000-0000000000b1';

let pass = 0, fail = 0;
const ok = (label, cond) => { if (cond) { pass++; console.log('  OK  ' + label); } else { fail++; console.log('  FAIL ' + label); } };

async function main() {
  // 1) importa o pool REAL e patcha connect() → conexão única (release = no-op).
  const poolMod = await import('../src/core/database/pool.ts');
  const raw = await poolMod.pool.connect();
  // wrapper puro (NÃO Object.create: métodos do pg Client mutam estado interno via this)
  const single = { query: (...a) => raw.query(...a), release: () => {} };
  poolMod.pool.connect = async () => single;

  // 2) importa as funções REAIS (depois do patch).
  const { resolveRegionalFundDestination } = await import('../src/modules/services/service-payment-execution.service.ts');
  const { bankAccountService } = await import('../src/modules/bank/bank-account.service.ts');

  const q = (sql, p = []) => raw.query(sql, p);
  const n = async (sql, p = []) => Number((await q(sql, p)).rows[0].n);
  const CALC = (over = {}) => ({
    lineType: 'regional_fund', destinationType: 'regional_fund',
    regionalOriginBasis: 'payer_identity_residence', regionalLevel: 'city',
    amountCents: 100, bps: 100, priority: 0, ...over,
  });
  const expectErr = async (label, fn, re) => {
    try { await fn(); ok(label + ' (lançou?)', false); }
    catch (e) { ok(label, re.test(e.message)); }
  };

  const baseAccounts = await n('SELECT count(*)::int n FROM bank_accounts');
  const baseRfa = await n('SELECT count(*)::int n FROM regional_fund_accounts');

  await q('BEGIN');
  try {
    // ── fixtures sintéticos (dentro da tx; nunca commitam) ──
    // ACTOR_RESIDENCE exige PF (trigger fn_addr_assign_actor_role_coherence) → actors user com
    // identity sintética (identities: cpf 11 dígitos, kyc pending/none).
    let cpfSeq = 0;
    for (const [id, name] of [[A_CWB, 'T-CWB'], [A_NONE, 'T-NONE'], [A_PROFILE, 'T-PROFILE'], [A_OTHER, 'T-OTHER'], [RECEIVER, 'T-RECV']]) {
      const gid = id.replace('b0000000', 'c0000000');
      const cpf = String(90000000000 + (cpfSeq++));
      await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1, $2, 'cpf', 'pending', 'none')`, [gid, cpf]);
      await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, global_user_id) VALUES ($1, $1, $2, 'user', $3, $4)`, [id, TENANT, name, gid]);
    }
    const addr = async (cityId) => (await q(
      `INSERT INTO addresses (country_id, city_id, source) VALUES ($1, $2, 'UX_INPUT') RETURNING address_id`,
      [BR, cityId])).rows[0].address_id;
    const addrCwb = await addr(CWB);
    const addrRb = await addr(RIO_BRANCO);
    // ck_addr_assign_actor_shape: owner_type='actor' → actor_id=owner_id; senão actor_id NULL
    // (o modelo profile da DECISION-0074 carrega o actor no owner_id).
    const assign = (ownerType, actorId, addressId) => q(
      `INSERT INTO address_assignments (owner_type, owner_id, actor_id, address_id, role, is_primary, valid_until_at)
       VALUES ($1, $2, $3, $4, 'RESIDENCE', true, NULL)`,
      [ownerType, actorId, ownerType === 'actor' ? actorId : null, addressId]);
    await assign('actor', A_CWB, addrCwb);        // residência actor-scoped Curitiba
    await assign('profile', A_PROFILE, addrCwb);  // SÓ profile legado (não pode salvar)
    await assign('actor', A_OTHER, addrRb);       // residência actor-scoped em OUTRA cidade

    // ── caso 6: Curitiba SEM mapping → NOT_PROVISIONED (antes de provisionar fixture) ──
    await expectErr('6· Curitiba sem mapping falha REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED',
      () => resolveRegionalFundDestination(TENANT, A_CWB, RECEIVER, CALC()),
      /REGIONAL_FUND_ACCOUNT_NOT_PROVISIONED/);

    // ── fixture de mapping Curitiba (espelha o bootstrap; dentro da tx) ──
    const fundAcc = (await q(
      `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type)
       VALUES ($1, 'system', 'system:regional_fund:test:city:cwb', NULL, 'credit') RETURNING id`, [TENANT])).rows[0].id;
    await q(
      `INSERT INTO regional_fund_accounts (tenant_id, scope_level, country_id, state_id, city_id, bank_account_id)
       VALUES ($1, 'city', $2, $3, $4, $5)`, [TENANT, BR, PR, CWB, fundAcc]);

    // ── caso 1: payer Curitiba com ACTOR_RESIDENCE resolve (conta + snapshot íntegro) ──
    const r1 = await resolveRegionalFundDestination(TENANT, A_CWB, RECEIVER, CALC());
    ok('1· payer Curitiba resolve → conta do mapping', r1.destinationAccountId === fundAcc);
    ok('1b· snapshot íntegro {basis,level,countryId,stateId,cityId} canônicos',
      r1.jurisdictionSnapshot && r1.jurisdictionSnapshot.basis === 'payer_identity_residence' &&
      r1.jurisdictionSnapshot.level === 'city' && r1.jurisdictionSnapshot.countryId === BR &&
      r1.jurisdictionSnapshot.stateId === PR && r1.jurisdictionSnapshot.cityId === CWB);

    // ── caso 2: payer sem residência ──
    await expectErr('2· payer sem ACTOR_RESIDENCE falha POLICY_REGIONAL_ORIGIN_UNRESOLVABLE',
      () => resolveRegionalFundDestination(TENANT, A_NONE, RECEIVER, CALC()),
      /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/);

    // ── caso 3: profile legado NÃO salva ──
    await expectErr('3· profile/RESIDENCE legado NÃO salva (actor-scoped only)',
      () => resolveRegionalFundDestination(TENANT, A_PROFILE, RECEIVER, CALC()),
      /POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/);

    // ── caso 5: outra cidade → Curitiba-only ──
    await expectErr('5· payer de outra cidade falha REGIONAL_FUND_CITY_NOT_ENABLED',
      () => resolveRegionalFundDestination(TENANT, A_OTHER, RECEIVER, CALC()),
      /REGIONAL_FUND_CITY_NOT_ENABLED/);

    // ── caso 14: neighborhood não entra (HOLD) ──
    await expectErr('14· regional_level=neighborhood → HOLD fail-closed',
      () => resolveRegionalFundDestination(TENANT, A_CWB, RECEIVER, CALC({ regionalLevel: 'neighborhood' })),
      /REGIONAL_FUND_NEIGHBORHOOD_HOLD/);

    // ── caso 4: infra-error propaga (classe ≠ ausência; nunca vira UNRESOLVABLE) ──
    try {
      await resolveRegionalFundDestination('not-a-uuid', A_CWB, RECEIVER, CALC());
      ok('4· infra-error propaga', false);
    } catch (e) {
      ok('4· infra-error propaga (não convertido em UNRESOLVABLE/ausência)',
        !/POLICY_REGIONAL_ORIGIN_UNRESOLVABLE/.test(e.message));
      // pg aborta a tx em erro → restaura ao savepoint? Sem savepoint a tx fica aborted.
    }
    // erro de infra abortou a tx → ROLLBACK e re-setup mínimo para os casos de lookup
    await q('ROLLBACK');
    await q('BEGIN');
    const fund2 = (await q(
      `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type)
       VALUES ($1, 'system', 'system:regional_fund:test2:city:cwb', NULL, 'credit') RETURNING id`, [TENANT])).rows[0].id;
    await q(
      `INSERT INTO regional_fund_accounts (tenant_id, scope_level, country_id, state_id, city_id, bank_account_id)
       VALUES ($1, 'city', $2, $3, $4, $5)`, [TENANT, BR, PR, CWB, fund2]);

    // ── caso 11: lookup coerente retorna a conta ──
    const found = await bankAccountService.lookupRegionalFundAccount(TENANT, { level: 'city', countryId: BR, stateId: PR, cityId: CWB });
    ok('11· lookup coerente retorna conta do mapping', !!found && found.accountId === fund2);

    // ── caso 12: conta com forma incoerente falha (MALFORMED) ──
    await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, responsible_actor_id) VALUES ($1, $1, $2, 'page', 'T-BAD', '213f4903-d0c3-4c03-aa2f-328e11aac807')`, ['b0000000-0000-4000-8000-0000000000c1', TENANT]);
    const badAcc = (await q(
      `INSERT INTO bank_accounts (tenant_id, owner_type, owner_id, actor_id, account_type)
       VALUES ($1, 'actor', $2::text, $2::uuid, 'credit') RETURNING id`, [TENANT, 'b0000000-0000-4000-8000-0000000000c1'])).rows[0].id;
    await q(
      `INSERT INTO regional_fund_accounts (tenant_id, scope_level, country_id, state_id, city_id, bank_account_id)
       VALUES ($1, 'city', $2, $3, $4, $5)`, [TENANT, BR, RB_STATE, RIO_BRANCO, badAcc]);
    await expectErr('12· mapping para conta fora da forma (actor-owned) falha MALFORMED',
      () => bankAccountService.lookupRegionalFundAccount(TENANT, { level: 'city', countryId: BR, stateId: RB_STATE, cityId: RIO_BRANCO }),
      /REGIONAL_FUND_ACCOUNT_MALFORMED/);

    // ── caso 13: cross-tenant não resolve ──
    const cross = await bankAccountService.lookupRegionalFundAccount(OTHER_TENANT, { level: 'city', countryId: BR, stateId: PR, cityId: CWB });
    ok('13· lookup cross-tenant retorna null (tenant coerente exigido)', cross === null);

    // ── casos 7-10: nenhum caso criou conta pelo MONEY PATH; zero dinheiro ──
    const accNow = await n('SELECT count(*)::int n FROM bank_accounts');
    ok('7· money path não criou conta (só os 2 fixtures explícitos desta tx)', accNow === baseAccounts + 2);
    ok('8· bank_transactions=0', (await n('SELECT count(*)::int n FROM bank_transactions')) === 0);
    ok('9· bank_splits=0', (await n('SELECT count(*)::int n FROM bank_splits')) === 0);
    ok('10· bank_ledger=0', (await n('SELECT count(*)::int n FROM bank_ledger')) === 0);
  } finally {
    try { await q('ROLLBACK'); } catch {}
  }

  // ── resíduo-zero ──
  ok('R· resíduo-zero: bank_accounts restaurado', (await n('SELECT count(*)::int n FROM bank_accounts')) === baseAccounts);
  ok('R· resíduo-zero: regional_fund_accounts restaurado', (await n('SELECT count(*)::int n FROM regional_fund_accounts')) === baseRfa);
  ok('R· resíduo-zero: fixtures de actors não persistiram', (await n('SELECT count(*)::int n FROM actors WHERE id::text LIKE $1', ['b0000000-%'])) === 0);

  console.log(`\n==== B-CITY-1 DB proof: pass=${pass} fail=${fail} ====`);
  raw.release?.();
  await poolMod.pool.end?.().catch(() => {});
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('ERRO FATAL:', e); process.exit(1); });
