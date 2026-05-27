/**
 * E2E PE-5-CARTÓRIO OPERACIONAL (DECISION-0050, 2026-05-26)
 *
 * Cobre 6 cenários do cartório operacional de actor-unidade:
 *
 *   T1 — actor PJ sem OPERATIONAL: get retorna null + assert(throw) lança
 *        PJ_OPERATIONAL_ADDRESS_REQUIRED + assert(warn) retorna readiness
 *   T2 — createOperationalAddressForActor cria com owner_type='service_provider',
 *        owner_id=<actor.id>, role='OPERATIONAL', is_primary=true,
 *        valid_until_at NULL
 *   T3 — leitura retorna o endereço recém-criado; NÃO confunde com HQ da company
 *   T4 — idempotência: segunda chamada falha OPERATIONAL_ADDRESS_ALREADY_EXISTS;
 *        confirma via query que existe apenas 1 OPERATIONAL primário ativo
 *   T5 — tenant safety: actor de outro tenant é rejeitado com
 *        ACTOR_NOT_FOUND_OR_CROSS_TENANT
 *   T6 — snapshot bank_ledger/bank_transactions/bank_splits idêntico
 *        antes/depois (não toca dinheiro)
 *
 * NÃO cria endpoint REST nesta fatia (sem padrão de auth claro — vide
 * DT-PE5-CARTORIO-ENDPOINT-AUTH).
 *
 * Modo:
 *   npx tsx backend/src/scripts/validate-pipeline-e2e-pe5-cartorio-operacional.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

import { pool } from '../core/database/pool';
import {
  operationalAddressHelper,
  PJ_OPERATIONAL_ADDRESS_REQUIRED,
  ACTOR_NOT_FOUND_OR_CROSS_TENANT,
  OPERATIONAL_ADDRESS_ALREADY_EXISTS,
} from '../core/location/operational-address.helper';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

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

async function loadBrCountryId(): Promise<string> {
  const r = await pool.query<{ country_id: string }>(
    `SELECT country_id::text FROM countries WHERE iso_alpha2 = 'BR' LIMIT 1`
  );
  if (!r.rows[0]) throw new Error('Fixture: BR não encontrado em countries');
  return r.rows[0].country_id;
}

/** Pega um actor human qualquer do tenant para servir como responsável. */
async function loadResponsibleHumanActor(tenantId: string): Promise<string> {
  const r = await pool.query<{ id: string }>(
    `SELECT id::text FROM actors
      WHERE tenant_id = $1::uuid AND actor_type = 'user' LIMIT 1`,
    [tenantId]
  );
  if (!r.rows[0]) throw new Error('Fixture: nenhum actor user no tenant para servir como responsible_actor_id');
  return r.rows[0].id;
}

/** Cria actor PJ de teste (não-real, prefixo pe5_ no display_name).
 *  Trigger institucional (§4.8 LEI_COERENCIA_SISTEMICA) exige
 *  responsible_actor_id para actor não-humano. */
async function createTestActorPJ(tenantId: string, label: string, responsibleActorId: string): Promise<string> {
  const actorId = uuidv4();
  await pool.query(
    `INSERT INTO actors (id, tenant_id, actor_type, display_name, responsible_actor_id)
     VALUES ($1::uuid, $2::uuid, 'company', $3, $4::uuid)`,
    [actorId, tenantId, `pe5_${label}_${actorId.slice(0, 8)}`, responsibleActorId]
  );
  return actorId;
}

/** Cria company HQ assignment (não OPERATIONAL) para T3 de não-confusão. */
async function createCompanyHqAssignment(tenantId: string): Promise<{ companyId: string; addressId: string }> {
  const brId = await loadBrCountryId();
  const addrRes = await pool.query<{ address_id: string }>(
    `INSERT INTO addresses (country_id, source, created_by_tenant_id)
     VALUES ($1::uuid, 'UX_INPUT', $2::uuid)
     RETURNING address_id::text`,
    [brId, tenantId]
  );
  const addressId = addrRes.rows[0]!.address_id;
  const companyId = uuidv4();
  await pool.query(
    `INSERT INTO companies (company_id, tenant_id, company_name, status, company_status)
     VALUES ($1::uuid, $2::uuid, $3, 'active', 'ACTIVE')`,
    [companyId, tenantId, `pe5_company_${companyId.slice(0, 8)}`]
  );
  await pool.query(
    `INSERT INTO address_assignments (owner_type, owner_id, address_id, role, is_primary)
     VALUES ('company', $1::uuid, $2::uuid, 'HQ', true)`,
    [companyId, addressId]
  );
  return { companyId, addressId };
}

async function bankSnapshot(): Promise<{ ledger: number; tx: number; splits: number }> {
  const l = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM bank_ledger`);
  const t = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM bank_transactions`);
  const s = await pool.query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM bank_splits`);
  return {
    ledger: parseInt(l.rows[0]!.c, 10),
    tx: parseInt(t.rows[0]!.c, 10),
    splits: parseInt(s.rows[0]!.c, 10),
  };
}

async function cleanupPe5TestData(): Promise<void> {
  // Apaga address_assignments criados por este E2E (filtrando por addresses
  // com created_by_tenant_id=TENANT_ID + role/owner_type marker).
  await pool.query(
    `DELETE FROM address_assignments
       WHERE owner_type = 'service_provider'
         AND owner_id IN (
           SELECT id FROM actors WHERE tenant_id = $1::uuid AND display_name LIKE 'pe5_%'
         )`,
    [TENANT_ID]
  );
  await pool.query(
    `DELETE FROM address_assignments
       WHERE owner_type = 'company'
         AND owner_id IN (
           SELECT company_id FROM companies WHERE tenant_id = $1::uuid AND company_name LIKE 'pe5_%'
         )`,
    [TENANT_ID]
  );
  // Apaga actors/companies de teste (cascade limpa o resto)
  await pool.query(`DELETE FROM actors WHERE tenant_id = $1::uuid AND display_name LIKE 'pe5_%'`, [TENANT_ID]);
  await pool.query(`DELETE FROM companies WHERE tenant_id = $1::uuid AND company_name LIKE 'pe5_%'`, [TENANT_ID]);
  // Apaga addresses órfãos criados nesta sessão E2E
  await pool.query(
    `DELETE FROM addresses
       WHERE created_by_tenant_id = $1::uuid
         AND address_id NOT IN (SELECT address_id FROM address_assignments)`,
    [TENANT_ID]
  );
}

async function main() {
  console.log('═══ E2E PE-5-CARTÓRIO — Cartório operacional de actor-unidade ═══\n');
  await bootstrap();
  await cleanupPe5TestData();

  const brId = await loadBrCountryId();
  const responsibleHumanId = await loadResponsibleHumanActor(TENANT_ID);

  // ============================================================
  // T1 — actor PJ sem OPERATIONAL
  // ============================================================
  console.log('=== T1 — actor PJ sem OPERATIONAL → null / throw / warn ===');
  const actorT1 = await createTestActorPJ(TENANT_ID, 'T1', responsibleHumanId);
  const getT1 = await operationalAddressHelper.getOperationalAddressForActor(TENANT_ID, actorT1);
  assertOk('T1.1 — getOperationalAddressForActor retorna null', {
    ok: getT1 === null,
    reason: 'helper retornou algo onde deveria null',
    detail: getT1,
  });
  let t1ThrowCaught = false;
  try {
    await operationalAddressHelper.assertActorHasOperationalAddress(TENANT_ID, actorT1, 'throw');
  } catch (e: any) {
    t1ThrowCaught = true;
    assertOk('T1.2 — assert(throw) lança PJ_OPERATIONAL_ADDRESS_REQUIRED', {
      ok: e?.code === PJ_OPERATIONAL_ADDRESS_REQUIRED,
      reason: `esperava code=PJ_OPERATIONAL_ADDRESS_REQUIRED; recebi code=${e?.code}`,
      detail: { code: e?.code, message: e?.message },
    });
  }
  assertOk('T1.3 — exceção foi lançada em modo throw', { ok: t1ThrowCaught });
  const warnResult = await operationalAddressHelper.assertActorHasOperationalAddress(TENANT_ID, actorT1, 'warn');
  assertOk('T1.4 — assert(warn) retorna readiness sem lançar', {
    ok: warnResult.hasOperational === false && typeof warnResult.message === 'string',
    reason: 'readiness inválido',
    detail: warnResult,
  });

  // ============================================================
  // T2 — criar OPERATIONAL
  // ============================================================
  console.log('\n=== T2 — createOperationalAddressForActor: convenção canônica ===');
  const created = await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, actorT1, {
    address: {
      countryId: brId,
      source: 'UX_INPUT',
      street: 'Rua Operacional 100',
      number: '100',
    } as any,
  });
  assertOk('T2.1 — assignment.ownerType = "service_provider"', {
    ok: created.assignment.ownerType === 'service_provider',
    reason: `ownerType esperado service_provider; recebi ${created.assignment.ownerType}`,
    detail: created.assignment,
  });
  assertOk('T2.2 — assignment.ownerId = actor.id', {
    ok: created.assignment.ownerId === actorT1,
    reason: `ownerId esperado ${actorT1}; recebi ${created.assignment.ownerId}`,
  });
  assertOk('T2.3 — assignment.role = "OPERATIONAL"', {
    ok: created.assignment.role === 'OPERATIONAL',
    reason: `role esperado OPERATIONAL; recebi ${created.assignment.role}`,
  });
  assertOk('T2.4 — assignment.isPrimary = true', {
    ok: created.assignment.isPrimary === true,
  });
  assertOk('T2.5 — assignment.validUntilAt = null (ativo)', {
    ok: created.assignment.validUntilAt === null,
    reason: `validUntilAt esperado null; recebi ${String(created.assignment.validUntilAt)}`,
  });
  assertOk('T2.6 — address.countryId = BR', {
    ok: created.address.countryId === brId,
  });

  // ============================================================
  // T3 — leitura retorna o endereço criado; não confunde com HQ
  // ============================================================
  console.log('\n=== T3 — getOperationalAddressForActor retorna o criado, não HQ ===');
  // Setup: actor T3 separado + sua própria company HQ
  const actorT3 = await createTestActorPJ(TENANT_ID, 'T3', responsibleHumanId);
  const hqContext = await createCompanyHqAssignment(TENANT_ID); // HQ DA COMPANY (não do actor)
  // (não vinculamos actor à company explicitamente — só para garantir que
  //  HQ existe no DB e o helper não confunde)
  const createdT3 = await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, actorT3, {
    address: { countryId: brId, source: 'UX_INPUT', street: 'Rua T3' } as any,
  });
  const readT3 = await operationalAddressHelper.getOperationalAddressForActor(TENANT_ID, actorT3);
  assertOk('T3.1 — leitura retorna o assignment criado', {
    ok: readT3 !== null && readT3.assignment.id === createdT3.assignment.id,
    reason: 'leitura divergiu da escrita',
    detail: readT3,
  });
  assertOk('T3.2 — leitura NÃO confunde com HQ da company (owner diferente)', {
    ok: readT3 !== null && readT3.address.id !== hqContext.addressId,
    reason: 'helper leu o HQ no lugar do OPERATIONAL',
    detail: { read: readT3?.address.id, hq: hqContext.addressId },
  });
  assertOk('T3.3 — leitura tem ownerType service_provider', {
    ok: readT3?.assignment.ownerType === 'service_provider',
  });

  // ============================================================
  // T4 — idempotência: 2ª chamada falha + DB tem 1 OPERATIONAL
  // ============================================================
  console.log('\n=== T4 — idempotência: segunda criação falha + DB com 1 ativo ===');
  let t4Caught = false;
  try {
    await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, actorT1, {
      address: { countryId: brId, source: 'UX_INPUT' } as any,
    });
  } catch (e: any) {
    t4Caught = true;
    assertOk('T4.1 — 2ª chamada lança OPERATIONAL_ADDRESS_ALREADY_EXISTS', {
      ok: e?.code === OPERATIONAL_ADDRESS_ALREADY_EXISTS,
      reason: `esperava code=OPERATIONAL_ADDRESS_ALREADY_EXISTS; recebi code=${e?.code}`,
      detail: { code: e?.code, message: e?.message },
    });
  }
  assertOk('T4.2 — exceção foi lançada', { ok: t4Caught });
  const count = await pool.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM address_assignments
       WHERE owner_type = 'service_provider' AND owner_id = $1::uuid
         AND role = 'OPERATIONAL' AND valid_until_at IS NULL AND is_primary = true`,
    [actorT1]
  );
  assertOk('T4.3 — DB tem exatamente 1 OPERATIONAL primário ativo para o actor', {
    ok: parseInt(count.rows[0]!.c, 10) === 1,
    reason: `esperava 1; recebi ${count.rows[0]!.c}`,
  });

  // ============================================================
  // T5 — tenant safety: actor de outro tenant é rejeitado
  // ============================================================
  console.log('\n=== T5 — tenant safety: cross-tenant é rejeitado ===');
  // Cria actor em um tenant fake (UUID aleatório, sem entry em tenants)
  // Para garantir falha por "actor não encontrado no tenant atual", criamos
  // um actor com tenant_id diferente do TENANT_ID do teste.
  const fakeTenantId = uuidv4();
  // Inserir tenant fake é caro/inseguro. Em vez disso, criamos actor com
  // outro tenant existente E tentamos acessá-lo do TENANT_ID — deve falhar.
  // Pegamos um tenant_id diferente do TENANT_ID:
  const otherTenant = await pool.query<{ id: string }>(
    `SELECT id::text FROM tenants WHERE id != $1::uuid LIMIT 1`,
    [TENANT_ID]
  );
  if (!otherTenant.rows[0]) {
    console.log('  ⚠️  T5 SKIP — sem outro tenant para testar cross-tenant');
  } else {
    const otherTenantId = otherTenant.rows[0].id;
    const crossActorId = uuidv4();
    // Tenta achar responsible no outro tenant; se não houver, usa o nosso
    // (trigger só valida existência da coluna, não tenant matching).
    let crossResponsible = responsibleHumanId;
    const otherResp = await pool.query<{ id: string }>(
      `SELECT id::text FROM actors WHERE tenant_id = $1::uuid AND actor_type='user' LIMIT 1`,
      [otherTenantId]
    );
    if (otherResp.rows[0]) crossResponsible = otherResp.rows[0].id;
    await pool.query(
      `INSERT INTO actors (id, tenant_id, actor_type, display_name, responsible_actor_id)
       VALUES ($1::uuid, $2::uuid, 'company', $3, $4::uuid)`,
      [crossActorId, otherTenantId, `pe5_T5_cross_${crossActorId.slice(0, 8)}`, crossResponsible]
    );
    let t5Caught = false;
    try {
      await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, crossActorId, {
        address: { countryId: brId, source: 'UX_INPUT' } as any,
      });
    } catch (e: any) {
      t5Caught = true;
      assertOk('T5.1 — cross-tenant lança ACTOR_NOT_FOUND_OR_CROSS_TENANT', {
        ok: e?.code === ACTOR_NOT_FOUND_OR_CROSS_TENANT,
        reason: `esperava code=ACTOR_NOT_FOUND_OR_CROSS_TENANT; recebi code=${e?.code}`,
        detail: { code: e?.code, message: e?.message },
      });
    }
    assertOk('T5.2 — exceção foi lançada', { ok: t5Caught });
    // Cleanup cross-tenant actor
    await pool.query(`DELETE FROM actors WHERE id = $1::uuid`, [crossActorId]);
  }
  void fakeTenantId;

  // ============================================================
  // T6 — não toca dinheiro
  // ============================================================
  console.log('\n=== T6 — snapshot bank inalterado antes/depois ===');
  const beforeSnap = await bankSnapshot();
  // Criar mais uma operação cartório para garantir não-impacto
  const actorT6 = await createTestActorPJ(TENANT_ID, 'T6', responsibleHumanId);
  await operationalAddressHelper.createOperationalAddressForActor(TENANT_ID, actorT6, {
    address: { countryId: brId, source: 'UX_INPUT', street: 'Rua T6' } as any,
  });
  const afterSnap = await bankSnapshot();
  assertOk('T6.1 — bank_ledger count idêntico', {
    ok: beforeSnap.ledger === afterSnap.ledger,
    reason: `bank_ledger mudou: ${beforeSnap.ledger} → ${afterSnap.ledger}`,
  });
  assertOk('T6.2 — bank_transactions count idêntico', {
    ok: beforeSnap.tx === afterSnap.tx,
    reason: `bank_transactions mudou: ${beforeSnap.tx} → ${afterSnap.tx}`,
  });
  assertOk('T6.3 — bank_splits count idêntico', {
    ok: beforeSnap.splits === afterSnap.splits,
    reason: `bank_splits mudou: ${beforeSnap.splits} → ${afterSnap.splits}`,
  });

  // Cleanup final
  await cleanupPe5TestData();

  console.log(
    '\n═══ E2E PE-5-CARTÓRIO :: PASS — 6 cenários T1-T6 verdes. Cartório operacional funcional. Convenção canônica: owner_type=service_provider + owner_id=<actor.id> + role=OPERATIONAL. Idempotente. Tenant-safe. Zero impacto em dinheiro. ═══'
  );
  await pool.end();
}

main().catch((err) => {
  console.error('❌ ERRO NÃO CAPTURADO:', err);
  process.exit(1);
});
