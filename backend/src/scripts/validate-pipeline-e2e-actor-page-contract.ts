/**
 * E2E — F-ACTOR-PAGE-SHELL-SLICE-3 (DESENHO_PAGINA_DO_ACTOR.md §2.4 SELADO).
 * Money-free; MATERIAL (contrato server-driven novo). Roda SÓ em DB efêmera
 * (runner run-actor-page-ephemeral.ps1). NUNCA unificard_dev.
 *
 * Prova o coração do desenho — "a aba existe se o bloco está aceso" + autoridade + anti-PII:
 *   A · GET sem req.user → 401;
 *   B · página da ANA (PF com 1 post): aba Posts ACENDE (count=1); Products/Services NÃO;
 *       Tudo+Sobre sempre; Conectar com allowedLabels do par PF↔PF (seed governado);
 *   C · página da BIA (PF vazia): só Tudo+Sobre — nenhum bloco além de about;
 *   D · página da PADARIA (page com 1 serviço ativo): aba Serviços ACENDE; ação Contratar
 *       renderiza DESABILITADA gatedBy='PORTA-1'; Conectar com labels do par PF↔PJ;
 *   E · mode=operating: estranha → 403 fail-closed; dono → 200 com ações de gestão;
 *   F · anti-PII: o JSON do contrato não contém cpf/tax_id/kyc/global_user_id/user_id;
 *   G · Δbank=0.
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
  if (!/actor_page|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq * 19).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `ap-${seq}@e2e.test`, gu]);
  const actorId = (
    await pool.query<{ id: string }>(
      `INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
      [tenantId, name, userId, gu]
    )
  ).rows[0].id;
  return { userId, actorId, gu };
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
  await tenantService.createTenant({ id: TENANT, name: 'ActorPage Tenant', slug: `ap-${Date.now()}` });

  const ana = await mkUserActor(TENANT, 'Ana Page E2E');
  const bia = await mkUserActor(TENANT, 'Bia Vazia E2E');
  const carlos = await mkUserActor(TENANT, 'Carlos Dono E2E');

  // padaria: page-actor + company_users owner (canRepresentActor via canManageCompany)
  const companyId = (await pool.query<{ id: string }>(`INSERT INTO companies (tenant_id, company_name) VALUES ($1::uuid,$2) RETURNING company_id::text AS id`, [TENANT, 'Padaria Page E2E'])).rows[0].id;
  const pageActorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, slug, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4,$5::uuid) RETURNING id::text AS id`,
    [TENANT, 'Padaria Page E2E', companyId, `ap-page-${Date.now()}`, carlos.actorId]
  )).rows[0].id;
  await pool.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true)`, [TENANT, companyId, carlos.gu]);

  // substrato: ana publica 1 post; padaria publica 1 serviço ativo (concept→canonical→service)
  await pool.query(`INSERT INTO posts (tenant_id, actor_id, content, is_published, is_deleted) VALUES ($1::uuid,$2::uuid,'olá página',true,false)`, [TENANT, ana.actorId]);
  // concepts é GOVERNADO (0075_concept_governance_trigger): INSERT exige app.concept_governance
  // dentro de transação autorizada — mesmo padrão dos e2es de catálogo.
  const gc = await pool.connect();
  let conceptId: string;
  try {
    await gc.query('BEGIN');
    await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
    conceptId = (await gc.query<{ id: string }>(
      `INSERT INTO concepts (slug, domain) VALUES ($1,'servicos') RETURNING concept_id::text AS id`,
      [`ap-corte-${Date.now()}`]
    )).rows[0].id;
    await gc.query('COMMIT');
  } catch (e) {
    await gc.query('ROLLBACK');
    throw e;
  } finally {
    gc.release();
  }
  const canonicalId = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_services (concept_id, name, slug, scope) VALUES ($1::uuid,'Corte E2E',$2,'global') RETURNING id::text AS id`,
    [conceptId, `ap-corte-canon-${Date.now()}`]
  )).rows[0].id;
  await pool.query(
    `INSERT INTO services (tenant_id, actor_id, name, slug, canonical_service_id, status) VALUES ($1::uuid,$2::uuid,'Corte E2E',$3,$4::uuid,'active')`,
    [TENANT, pageActorId, `ap-corte-svc-${Date.now()}`, canonicalId]
  );

  const actorPageRoutes = (await import('../modules/actor-page/actor-page.routes')).default;
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
  await app.register(actorPageRoutes);
  await app.ready();

  const call = (url: string, opts: { userId?: string; actorId?: string } = {}) =>
    app.inject({
      method: 'GET',
      url,
      headers: {
        ...(opts.userId ? { 'x-test-user-id': opts.userId } : {}),
        ...(opts.actorId ? { 'x-test-actor-id': opts.actorId } : {}),
        'x-test-tenant-id': TENANT,
      },
    });

  try {
    console.log('\n— actor page contract END-TO-END (a aba existe se o bloco está aceso) —');

    const bankBefore = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );

    // A · sem req.user → 401
    const rA = await call(`/actor-page/${ana.actorId}`);
    record('A GET sem autenticação → 401', rA.statusCode === 401, `status=${rA.statusCode}`);

    // B · página da Ana (PF, 1 post) vista pela Bia
    const rB = await call(`/actor-page/${ana.actorId}`, { userId: bia.userId, actorId: bia.actorId });
    const cB = (rB.json() as any)?.data;
    const tabsB = (cB?.tabs ?? []).map((t: any) => t.key);
    const postsBlock = (cB?.blocks ?? []).find((b: any) => b.type === 'posts');
    const connectB = (cB?.actions ?? []).find((a: any) => a.key === 'connect');
    record('B Ana: Posts ACENDE (count=1); Products/Services NÃO; Tudo+Sobre sempre',
      rB.statusCode === 200 &&
      tabsB.includes('all') && tabsB.includes('about') && tabsB.includes('posts') &&
      !tabsB.includes('products') && !tabsB.includes('services') &&
      postsBlock?.data?.count === 1,
      `status=${rB.statusCode} tabs=${JSON.stringify(tabsB)} posts=${JSON.stringify(postsBlock)}`);
    record("B2 Conectar com allowedLabels do par PF↔PF (amigo/conhecido/familiar)",
      !!connectB && connectB.enabled === true &&
      JSON.stringify(connectB.data?.allowedLabels) === JSON.stringify(['amigo', 'conhecido', 'familiar']),
      `connect=${JSON.stringify(connectB)}`);

    // C · página da Bia (vazia): só Tudo+Sobre
    const rC = await call(`/actor-page/${bia.actorId}`, { userId: ana.userId, actorId: ana.actorId });
    const cC = (rC.json() as any)?.data;
    const tabsC = (cC?.tabs ?? []).map((t: any) => t.key);
    record('C Bia (nada publicado): só Tudo+Sobre — nenhuma aba fantasma',
      rC.statusCode === 200 && tabsC.length === 2 && tabsC.includes('all') && tabsC.includes('about'),
      `tabs=${JSON.stringify(tabsC)}`);

    // D · página da Padaria (1 serviço ativo) vista pela Ana
    const rD = await call(`/actor-page/${pageActorId}`, { userId: ana.userId, actorId: ana.actorId });
    const cD = (rD.json() as any)?.data;
    const tabsD = (cD?.tabs ?? []).map((t: any) => t.key);
    const contractAction = (cD?.actions ?? []).find((a: any) => a.key === 'contract');
    const connectD = (cD?.actions ?? []).find((a: any) => a.key === 'connect');
    record('D Padaria: Serviços ACENDE; Contratar renderiza DESABILITADA gatedBy=PORTA-1',
      rD.statusCode === 200 && tabsD.includes('services') &&
      !!contractAction && contractAction.enabled === false && contractAction.gatedBy === 'PORTA-1',
      `tabs=${JSON.stringify(tabsD)} contract=${JSON.stringify(contractAction)}`);
    record("D2 Conectar PF↔PJ com labels do seed (cliente/colaborador/fornecedor)",
      !!connectD && JSON.stringify(connectD.data?.allowedLabels) === JSON.stringify(['cliente', 'colaborador', 'fornecedor']),
      `connect=${JSON.stringify(connectD)}`);

    // E · operating: estranha → 403; dono → 200 com gestão
    const rE1 = await call(`/actor-page/${pageActorId}?mode=operating`, { userId: bia.userId, actorId: bia.actorId });
    const rE2 = await call(`/actor-page/${pageActorId}?mode=operating`, { userId: carlos.userId, actorId: carlos.actorId });
    const cE2 = (rE2.json() as any)?.data;
    const opKeys = (cE2?.actions ?? []).map((a: any) => a.key);
    record('E operating: estranha → 403 fail-closed; dono → 200 com ações de gestão',
      rE1.statusCode === 403 && rE2.statusCode === 200 &&
      cE2?.mode === 'operating' && opKeys.includes('edit_profile') && opKeys.includes('create_service'),
      `estranha=${rE1.statusCode} dono=${rE2.statusCode} actions=${JSON.stringify(opKeys)}`);

    // F · anti-PII no contrato
    const raw = JSON.stringify(cB) + JSON.stringify(cD) + JSON.stringify(cE2);
    const leak = /cpf|tax_id|kyc|global_user_id|user_id|birthdate/i.test(raw);
    record('F contrato sem PII (cpf/tax_id/kyc/global_user_id/user_id)', !leak, raw.slice(0, 200));

    // G · Δbank = 0
    const bankAfter = await pool.query<{ n: string }>(
      `SELECT (SELECT COUNT(*) FROM bank_ledger) || ':' || (SELECT COUNT(*) FROM bank_transactions) AS n`
    );
    record('G Δbank=0 (contrato é leitura pura)', bankBefore.rows[0].n === bankAfter.rows[0].n,
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
