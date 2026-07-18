/**
 * E2E — Convergência territorial (Fatia D · D3). Reader `getUserRegionalFund` resolvido pela
 * RESIDÊNCIA actor-scoped canônica (DECISION-0177/0020). Roda SÓ em DB efêmera. NUNCA unificard_dev.
 *
 * Prova o fim do fallback mono-fundo e os estados territoriais honestos:
 *   A · residência actor-scoped em Curitiba (fundo provisionado) → resourceState='fund_available',
 *       cityId=Curitiba, currentBalanceCents=0 REAL (conta existe; ledger prova zero), cityName presente;
 *   B · ISOLAMENTO: residência em São Paulo (fundo PRÓPRIO provisionado) → conta de SP, NUNCA a de
 *       Curitiba (o antigo mono-fundo devolveria Curitiba pra qualquer um) — accountId distinto;
 *   C · residência numa cidade SEM mapping em regional_fund_accounts → 'regional_fund_not_provisioned'
 *       (cityId/cityName presentes, currentBalanceCents=null — ausência ≠ R$ 0,00);
 *   D · residência actor-scoped cujo endereço tem city_id NULL → 'canonical_city_missing';
 *   E · SEM residência actor-scoped (apenas legado owner_type='profile') → 'residence_missing'
 *       (prova que o reader não usa o legado profile/CEP — pendência honesta → CTA de confirmação);
 *   F · Δbank=0 (o reader é leitura pura; nenhuma conta/residência/mapping criada no GET).
 */

import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import { bankAccountService } from '../modules/bank/bank-account.service';
import { locationRepository } from '../core/location/location.repository';
import { transparencyService } from '../core/unifybank/transparency.service';
import {
  setActorTerritorialAddress,
  type ActorTerritorialWriteResult,
} from '../core/location/actor-territorial-address-writer.service';
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
  if (!/regional|residence|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 37).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `rfrr-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, userId, gu]
  )).rows[0].id;
  return { userId, actorId };
}

async function ensureCity(countryId: string, stateAbbr: string, cityName: string): Promise<{ cityId: string; stateId: string }> {
  const stateRow = await pool.query<{ state_id: string }>(
    `SELECT state_id::text FROM states WHERE country_id=$1::uuid AND abbreviation=$2 LIMIT 1`,
    [countryId, stateAbbr]
  );
  if (!stateRow.rows[0]) throw new Error(`ABORT: estado ${stateAbbr} ausente no catálogo`);
  const stateId = stateRow.rows[0].state_id;
  let cityRow = await pool.query<{ city_id: string }>(
    `SELECT city_id::text FROM cities WHERE state_id=$1::uuid AND name=$2 LIMIT 1`, [stateId, cityName]
  );
  const cityId = cityRow.rows[0]?.city_id ?? (await pool.query<{ city_id: string }>(
    `INSERT INTO cities (state_id, name, is_active) VALUES ($1::uuid,$2,true) RETURNING city_id::text`, [stateId, cityName]
  )).rows[0]!.city_id;
  return { cityId, stateId };
}

/**
 * Residência ACTOR-scoped canônica criada EXCLUSIVAMENTE pelo writer SELADO da Fase C
 * (`setActorTerritorialAddress`) — o MESMO entrypoint governado que a rota POST
 * /actors/:actorId/territorial-address usa (API_CONTRACT_GOVERNANCE). Sem INSERT direto em
 * address_assignments, sem pré-inserção, sem simular sucesso, sem desabilitar trigger/RLS/guard.
 * Authority provada por `canRepresentActor` (ownership do user-actor: operatorUserId=userId,
 * actorId=actor do próprio user). cityId null = endereço canônico sem cidade (canonical_city_missing).
 * O writer cria o endereço, encerra o primary anterior, insere o assignment RESIDENCE e emite o
 * evento `actor_territorial_address_set` — retornado no WriteResult para asserção do caminho canônico.
 */
async function setActorResidence(
  tenantId: string,
  userId: string,
  actorId: string,
  countryId: string,
  stateId: string | null,
  cityId: string | null,
): Promise<ActorTerritorialWriteResult> {
  return setActorTerritorialAddress(
    { tenantId, operatorUserId: userId },
    {
      actorId,
      purpose: 'ACTOR_RESIDENCE',
      address: { countryId, stateId, cityId, postalCode: '80000-000', street: 'Rua Reader E2E', number: '1' },
      idempotencyKey: `rfrr-${actorId}`,
    },
  );
}

/** Residência LEGADO (owner_type='profile') — o reader NÃO deve enxergar. */
async function setLegacyProfileResidence(tenantId: string, actorId: string, countryId: string, stateId: string, cityId: string): Promise<void> {
  const addr = await locationRepository.createAddress(
    { countryId, stateId, cityId, neighborhoodId: null, postalCode: '80000-000', street: 'Rua Legado E2E', number: '1', complement: null, reference: null, source: 'UX_INPUT', lat: null, lng: null },
    tenantId
  );
  await locationRepository.assignAddress(addr.id, 'profile', actorId, 'RESIDENCE', true);
}

async function bankSnapshot(): Promise<string> {
  const r = await pool.query<{ n: string }>(
    `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) || ':' || (SELECT COUNT(*) FROM bank_accounts) || ':' || (SELECT COUNT(*) FROM regional_fund_accounts) AS n`
  );
  return r.rows[0].n;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // Injeta os ports do Bank + Social (bootstrap faz isso no app.builder; aqui é E2E fora do server).
  const { bankPortsRegistry } = await import('../core/bank/ports-registry');
  const ba = await import('../modules/bank/adapters');
  bankPortsRegistry.setBankAccount(ba.bankAccountAdapter);
  bankPortsRegistry.setBankTransaction(ba.bankTransactionAdapter);
  bankPortsRegistry.setBankTransactionRead(ba.bankTransactionReadAdapter);
  bankPortsRegistry.setBankIntegration(ba.bankIntegrationAdapter);
  bankPortsRegistry.setBankLimit(ba.bankLimitAdapter);
  // R-5: o reader passou a usar o resolver canônico socialPortsRegistry.getActorRepository().findByUserId
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Regional Fund Residence Reader Tenant', slug: `rfrr-${Date.now()}` });
  await bankAccountService.ensurePlatformAccounts(TENANT, 'BRL');

  const country = await locationRepository.findCountryByCode('BR');
  if (!country) throw new Error('ABORT: país BR ausente (seed geo esperado nas migrations FULL)');

  const cwb = await ensureCity(country.id, 'PR', 'Curitiba RFRR');
  const sp = await ensureCity(country.id, 'SP', 'São Paulo RFRR');
  const noFundCity = await ensureCity(country.id, 'PR', 'Cidade Sem Fundo RFRR');

  // Fundos PRÓPRIOS por cidade (canônico via provisionRegionalFundAccountForBootstrap). Curitiba e SP
  // provisionados (contas DISTINTAS); "Cidade Sem Fundo" deliberadamente SEM mapping.
  const cwbAcc = await bankAccountService.provisionRegionalFundAccountForBootstrap(TENANT, { level: 'city', countryId: country.id, stateId: cwb.stateId, cityId: cwb.cityId });
  const spAcc = await bankAccountService.provisionRegionalFundAccountForBootstrap(TENANT, { level: 'city', countryId: country.id, stateId: sp.stateId, cityId: sp.cityId });

  const uCwb = await mkUserActor(TENANT, 'Morador Curitiba');
  const uSp = await mkUserActor(TENANT, 'Morador São Paulo');
  const uNoFund = await mkUserActor(TENANT, 'Morador Cidade Sem Fundo');
  const uNoCity = await mkUserActor(TENANT, 'Residência sem cidade');
  const uLegacy = await mkUserActor(TENANT, 'Somente residência legada profile');

  const cwbWrite = await setActorResidence(TENANT, uCwb.userId, uCwb.actorId, country.id, cwb.stateId, cwb.cityId);
  await setActorResidence(TENANT, uSp.userId, uSp.actorId, country.id, sp.stateId, sp.cityId);
  await setActorResidence(TENANT, uNoFund.userId, uNoFund.actorId, country.id, noFundCity.stateId, noFundCity.cityId);
  await setActorResidence(TENANT, uNoCity.userId, uNoCity.actorId, country.id, null, null);
  await setLegacyProfileResidence(TENANT, uLegacy.actorId, country.id, cwb.stateId, cwb.cityId);

  // Cidade com MOVIMENTAÇÃO real no fundo (prova o histórico via reader canônico do Bank, R-8):
  // fundo provisionado + 1 crédito no bank_ledger da conta do fundo (fixture; a conta é SYSTEM).
  const funded = await ensureCity(country.id, 'PR', 'Cidade Com Movimento RFRR');
  const fundedAcc = await bankAccountService.provisionRegionalFundAccountForBootstrap(TENANT, { level: 'city', countryId: country.id, stateId: funded.stateId, cityId: funded.cityId });
  const uFunded = await mkUserActor(TENANT, 'Morador Cidade Com Movimento');
  await setActorResidence(TENANT, uFunded.userId, uFunded.actorId, country.id, funded.stateId, funded.cityId);
  const FUND_CREDIT_CENTS = 4200;
  const conceptId = (await pool.query<{ id: string }>(`SELECT concept_id::text AS id FROM concepts LIMIT 1`)).rows[0]?.id;
  if (!conceptId) throw new Error('ABORT: nenhum concept seedado na DB efêmera');
  const fundTxId = randomUUID();
  await pool.query(
    `INSERT INTO bank_transactions (id, tenant_id, actor_id, account_id, amount_cents, purpose, justification, reference_type, reference_id, concept_id, internal_completed_at, metadata)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,'execution','E2E fund credit','rfrr_e2e_fund',$6,$7::uuid,NOW(),$8::jsonb)`,
    [fundTxId, TENANT, uFunded.actorId, fundedAcc.accountId, FUND_CREDIT_CENTS, randomUUID(), conceptId, JSON.stringify({ context: 'donation', originTransactionId: fundTxId })]
  );
  await pool.query(
    `INSERT INTO bank_ledger (id, tenant_id, account_id, transaction_id, direction, amount_cents, purpose, justification)
     VALUES (gen_random_uuid(),$1::uuid,$2::uuid,$3::uuid,'credit',$4,'execution','E2E fund credit')`,
    [TENANT, fundedAcc.accountId, fundTxId, FUND_CREDIT_CENTS]
  );

  const bankBefore = await bankSnapshot();

  console.log('\n— regional fund residence reader END-TO-END (Fatia D · D3) —');

  // G · CAMINHO CANÔNICO: a residência de Curitiba foi produzida pelo writer SELADO da Fase C
  //     (não por INSERT direto). Evidência suportada pelo contrato: o WriteResult (operation='set',
  //     role='RESIDENCE', assignmentId uuid) + o evento `actor_territorial_address_set` que SÓ o
  //     writer canônico emite (um INSERT direto não emitiria) — sem criar campo de auditoria novo.
  const evt = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM actor_events
      WHERE tenant_id = $1::uuid AND actor_id = $2::uuid AND event_type = 'actor_territorial_address_set'`,
    [TENANT, uCwb.actorId]
  );
  record('G residência produzida pelo writer canônico da Fase C (WriteResult set + evento actor_territorial_address_set)',
    cwbWrite.operation === 'set' && cwbWrite.role === 'RESIDENCE' && !!cwbWrite.assignmentId && Number(evt.rows[0].n) === 1,
    JSON.stringify({ op: cwbWrite.operation, role: cwbWrite.role, assignmentId: cwbWrite.assignmentId, events: evt.rows[0].n }));

  // A · Curitiba: fund_available, saldo 0 real, cityName presente
  const rA = await transparencyService.getUserRegionalFund(TENANT, uCwb.userId, { limit: 5 });
  record('A residência Curitiba (fundo provisionado) → fund_available, saldo 0 real, cityId/cityName presentes',
    rA.resourceState === 'fund_available' && rA.cityId === cwb.cityId && rA.currentBalanceCents === 0 &&
    rA.accountId === cwbAcc.accountId && !!rA.cityName,
    JSON.stringify({ state: rA.resourceState, cityId: rA.cityId, bal: rA.currentBalanceCents, acc: rA.accountId, city: rA.cityName }));

  // B · ISOLAMENTO: São Paulo resolve pra conta de SP, NUNCA a de Curitiba (fim do mono-fundo)
  const rB = await transparencyService.getUserRegionalFund(TENANT, uSp.userId, { limit: 5 });
  record('B ISOLAMENTO: residência São Paulo → conta PRÓPRIA de SP, distinta da de Curitiba (sem mono-fundo)',
    rB.resourceState === 'fund_available' && rB.cityId === sp.cityId &&
    rB.accountId === spAcc.accountId && rB.accountId !== cwbAcc.accountId,
    JSON.stringify({ state: rB.resourceState, cityId: rB.cityId, acc: rB.accountId, cwbAcc: cwbAcc.accountId }));

  // C · cidade sem mapping → regional_fund_not_provisioned (ausência ≠ zero)
  const rC = await transparencyService.getUserRegionalFund(TENANT, uNoFund.userId, { limit: 5 });
  record('C cidade sem fundo provisionado → regional_fund_not_provisioned (cityId/cityName presentes, saldo null)',
    rC.resourceState === 'regional_fund_not_provisioned' && rC.cityId === noFundCity.cityId &&
    rC.currentBalanceCents === null && rC.accountId === null && !!rC.cityName,
    JSON.stringify({ state: rC.resourceState, cityId: rC.cityId, bal: rC.currentBalanceCents }));

  // D · residência com city_id NULL → canonical_city_missing
  const rD = await transparencyService.getUserRegionalFund(TENANT, uNoCity.userId, { limit: 5 });
  record('D residência actor-scoped sem cidade canônica → canonical_city_missing',
    rD.resourceState === 'canonical_city_missing' && rD.currentBalanceCents === null,
    JSON.stringify({ state: rD.resourceState, cityId: rD.cityId, bal: rD.currentBalanceCents }));

  // E · só residência legado profile → residence_missing (reader não usa o legado)
  const rE = await transparencyService.getUserRegionalFund(TENANT, uLegacy.userId, { limit: 5 });
  record('E só residência legado (owner_type=profile) → residence_missing (reader não usa profile/CEP)',
    rE.resourceState === 'residence_missing' && rE.cityId === null && rE.currentBalanceCents === null,
    JSON.stringify({ state: rE.resourceState, cityId: rE.cityId, bal: rE.currentBalanceCents }));

  // H · MOVIMENTAÇÕES via reader canônico do Bank (R-8): saldo REAL do ledger + histórico com o
  //     crédito semeado (type/amount/metadata enriquecido por getMetadataByTransactionIds), sem SQL direto.
  const rH = await transparencyService.getUserRegionalFund(TENANT, uFunded.userId, { limit: 5 });
  const h0 = rH.entries[0];
  record('H fundo com movimento → currentBalanceCents=4200 real + 1 movimento (credit) via reader Bank canônico',
    rH.resourceState === 'fund_available' && rH.currentBalanceCents === FUND_CREDIT_CENTS &&
    rH.entries.length === 1 && h0?.type === 'credit' && h0?.amountCents === FUND_CREDIT_CENTS &&
    rH.summary.totalInCents === FUND_CREDIT_CENTS && h0?.context === 'donation',
    JSON.stringify({ state: rH.resourceState, bal: rH.currentBalanceCents, n: rH.entries.length, e0: h0 }));

  // F · Δbank=0 (reader puro; nenhuma conta/residência/mapping criada no GET)
  const bankAfter = await bankSnapshot();
  record('F Δbank=0 (reader é leitura pura — nada criado no GET)', bankBefore === bankAfter, `${bankBefore} → ${bankAfter}`);

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
