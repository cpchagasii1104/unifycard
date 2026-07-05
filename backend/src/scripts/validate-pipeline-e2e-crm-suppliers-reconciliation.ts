/**
 * E2E — F-CRM-PROJECTION-SUPPLIERS-RECONCILIATION (Fatia 7, GUIA_MESTRE §2B/§3/§4 — Opção B
 * ratificada por Clayton 2026-07-04). Money-free; sem migration nova (a ponte `suppliers.actor_id`
 * já existe desde a Fatia 1). Roda SÓ em DB efêmera (runner run-crm-suppliers-ephemeral.ps1).
 * NUNCA unificard_dev.
 *
 * Prova a reconciliação da ponte suppliers.actor_id (nunca confia no hint do cliente) e que o
 * fluxo vivo ERP (purchase_orders→suppliers) não regride com a remoção do ghost crm.*:
 *   A · criar fornecedor SEM actorId → 201, actorId null (off-platform, comportamento de hoje
 *       preservado);
 *   B · criar fornecedor COM actorId de um actor REAL → 201, actorId setado;
 *   C · criar fornecedor com actorId de um actor QUE NÃO EXISTE → 400, zero fornecedor novo;
 *   D · link-actor pelo DONO empresarial num fornecedor já existente (criado sem actorId) → 200,
 *       actorId atualizado;
 *   E · link-actor tentado por uma empresa DIFERENTE (não representa o owner) → 403, actor_id
 *       intacto;
 *   F · link-actor com actorId inexistente → 400, actor_id intacto;
 *   G · purchase_orders continua insertável referenciando o supplier (FK viva, prova que a
 *       remoção do ghost crm.* não regrediu o fluxo ERP real);
 *   H · Δbank=0.
 */

import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
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
  if (!/crm|supplier|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 31).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `crm-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, gu };
}

async function mkCompanyPageActor(tenantId: string, name: string, ownerGu: string, responsibleActorId: string): Promise<{ companyId: string; pageActorId: string }> {
  seq += 1;
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`, [tenantId, name])).rows[0].id;
  const pageActorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, slug, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4,$5::uuid) RETURNING id::text AS id`,
    [tenantId, name, companyId, `crm-page-${companyId.substring(0, 8)}-${seq}`, responsibleActorId]
  )).rows[0].id;
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [tenantId, companyId, ownerGu]);
  return { companyId, pageActorId };
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
  await tenantService.createTenant({ id: TENANT, name: 'CRM Suppliers Tenant', slug: `crm-sup-${Date.now()}` });

  const carlos = await mkUserActor(TENANT, 'Carlos Dono E2E');
  const padaria = await mkCompanyPageActor(TENANT, 'Padaria CRM E2E', carlos.gu, carlos.actorId);
  const beto = await mkUserActor(TENANT, 'Beto Dono Outra Empresa E2E');
  const outraEmpresa = await mkCompanyPageActor(TENANT, 'Outra Empresa E2E', beto.gu, beto.actorId);
  const platformFornecedor = await mkUserActor(TENANT, 'Fornecedor Plataforma E2E');

  const supplierRoutes = (await import('../modules/marketplace/supplier.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    const uid = req.headers['x-test-user-id'];
    const aid = req.headers['x-test-actor-id'];
    const tid = req.headers['x-test-tenant-id'];
    req.user = uid ? { userId: uid, id: uid } : null;
    req.tenant = tid ? { id: tid } : null;
    req.actionContext = aid ? { actorId: aid, intent: 'e2e', source: 'e2e', scope: 'e2e' } : null;
  });
  await app.register(supplierRoutes, { prefix: '/marketplace' });
  await app.ready();

  const call = (method: 'GET' | 'POST' | 'PATCH', url: string, opts: { userId?: string; actorId?: string; body?: unknown } = {}) =>
    app.inject({
      method,
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'x-test-tenant-id': TENANT,
        'content-type': 'application/json',
      },
      payload: opts.body as string | object | undefined,
    });

  try {
    console.log('\n— crm projection + suppliers reconciliation END-TO-END —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · fornecedor sem actorId (off-platform)
    const rA = await call('POST', '/marketplace/suppliers', {
      userId: carlos.userId, actorId: padaria.pageActorId,
      body: { name: 'Fornecedor Externo E2E' },
    });
    const supplierA = rA.json() as any;
    record('A criar fornecedor SEM actorId → 201, actorId null', rA.statusCode === 201 && supplierA?.actorId === null,
      `status=${rA.statusCode} body=${JSON.stringify(supplierA)}`);

    // B · fornecedor COM actorId real
    const rB = await call('POST', '/marketplace/suppliers', {
      userId: carlos.userId, actorId: padaria.pageActorId,
      body: { name: 'Fornecedor Na Plataforma E2E', actorId: platformFornecedor.actorId },
    });
    const supplierB = rB.json() as any;
    record('B criar fornecedor COM actorId real → 201, actorId setado', rB.statusCode === 201 && supplierB?.actorId === platformFornecedor.actorId,
      `status=${rB.statusCode} actorId=${supplierB?.actorId}`);

    // C · actorId bogus → 400, zero fornecedor novo
    const beforeCountC = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM suppliers`);
    const rC = await call('POST', '/marketplace/suppliers', {
      userId: carlos.userId, actorId: padaria.pageActorId,
      body: { name: 'Fornecedor Bogus E2E', actorId: randomUUID() },
    });
    const afterCountC = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM suppliers`);
    record('C actorId inexistente → 400, zero fornecedor novo', rC.statusCode === 400 && beforeCountC.rows[0].n === afterCountC.rows[0].n,
      `status=${rC.statusCode} count ${beforeCountC.rows[0].n}→${afterCountC.rows[0].n}`);

    // D · link-actor pelo dono, no fornecedor A (criado sem actorId)
    const rD = await call('PATCH', `/marketplace/suppliers/${supplierA.id}/link-actor`, {
      userId: carlos.userId, actorId: padaria.pageActorId,
      body: { actorId: platformFornecedor.actorId },
    });
    const supplierD = rD.json() as any;
    record('D link-actor pelo dono → 200, actorId atualizado', rD.statusCode === 200 && supplierD?.actorId === platformFornecedor.actorId,
      `status=${rD.statusCode} actorId=${supplierD?.actorId}`);

    // E · link-actor tentado por OUTRA empresa (não representa o owner de supplierA) → 403
    const rE = await call('PATCH', `/marketplace/suppliers/${supplierA.id}/link-actor`, {
      userId: beto.userId, actorId: outraEmpresa.pageActorId,
      body: { actorId: carlos.actorId },
    });
    const supplierECheck = await pool.query<{ actor_id: string | null }>(`SELECT actor_id FROM suppliers WHERE id = $1`, [supplierA.id]);
    record('E link-actor por empresa alheia → 403, actor_id intacto', rE.statusCode === 403 && supplierECheck.rows[0].actor_id === platformFornecedor.actorId,
      `status=${rE.statusCode} actor_id=${supplierECheck.rows[0].actor_id}`);

    // F · link-actor com actorId inexistente → 400, actor_id intacto
    const rF = await call('PATCH', `/marketplace/suppliers/${supplierA.id}/link-actor`, {
      userId: carlos.userId, actorId: padaria.pageActorId,
      body: { actorId: randomUUID() },
    });
    const supplierFCheck = await pool.query<{ actor_id: string | null }>(`SELECT actor_id FROM suppliers WHERE id = $1`, [supplierA.id]);
    record('F link-actor com actorId inexistente → 400, actor_id intacto', rF.statusCode === 400 && supplierFCheck.rows[0].actor_id === platformFornecedor.actorId,
      `status=${rF.statusCode} actor_id=${supplierFCheck.rows[0].actor_id}`);

    // G · purchase_orders continua insertável referenciando o supplier (FK viva, sem regressão ERP)
    let poOk = false;
    let poReason = '';
    try {
      const po = await pool.query<{ id: string }>(
        `INSERT INTO purchase_orders (tenant_id, supplier_id, created_by_actor_id, owner_actor_id)
         VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid) RETURNING id::text AS id`,
        [TENANT, supplierB.id, carlos.actorId, padaria.pageActorId]
      );
      poOk = !!po.rows[0]?.id;
    } catch (e: any) {
      poReason = e?.message ?? String(e);
    }
    record('G purchase_orders ainda insertável referenciando supplier (FK viva, ERP sem regressão)', poOk, poReason);

    // H · Δbank=0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('H Δbank=0 (nenhuma tabela de valor tocada)', bankBefore.rows[0].n === bankAfter.rows[0].n,
      `${bankBefore.rows[0].n} → ${bankAfter.rows[0].n}`);
  } finally {
    await app.close();
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
