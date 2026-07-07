/**
 * E2E — F-SERVICE-CURATION-HARDENING-BEFORE-UI (D1 gate de plataforma + D2 reject de serviço).
 * 🔒 Roda SÓ em DB efêmera. NUNCA unificard_dev.
 *  A · D1: promoteToGlobal SEM env allowlist → 403 PROMOTE_TO_GLOBAL_PLATFORM_GATE (fail-closed);
 *  B · D1: com env contendo o globalUserId → passa o gate (chega ao service);
 *  C · D2: reject de serviço pending → retired + evento service_curation_rejected;
 *  D · D2: reject de serviço NÃO-pending → 409 (fail-closed).
 */
import 'tsconfig-paths/register';
import { randomUUID } from 'node:crypto';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const results: { label: string; ok: boolean; reason?: string }[] = [];
const rec = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

async function main(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev' || !EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}"`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);

  const T = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('T Cur','t-cur-${Date.now()}') RETURNING id`)).rows[0].id;
  const gu = randomUUID(); const uid = randomUUID();
  const tax = String(Date.now()).slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1,$1,$2,$3,'x',0,true,$4,NOW(),NOW())`, [uid, T, `cur-${Date.now()}@e2e.test`, gu]);
  const actor = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,'user','Curador',$2,$3) RETURNING id`, [T, uid, gu])).rows[0].id;
  await pool.query(`UPDATE actors SET actor_id = id WHERE id = $1`, [actor]);

  // DI do social (curatorActorId usa ensureUserActor → socialPortsRegistry).
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);

  // app mínimo: decora requireRole como no-op (o gate de ROLE já é testado noutra suite; aqui testamos D1/D2)
  const Fastify = (await import('fastify')).default;
  const app = Fastify({ logger: false });
  app.decorate('requireRole', () => async () => { /* role-gate coberto por outra suite */ });
  app.addHook('preHandler', async (req) => {
    const r = req as any;
    r.tenant = { id: T };
    r.user = { id: uid, userId: uid, globalUserId: gu };
    r.actionContext = { actorId: actor };
  });
  app.setErrorHandler((err, _req, reply) => { console.log('   (500:', (err as Error).message?.slice(0, 140), ')'); reply.status(500).send({ error: 'x' }); });
  const govRoutes = (await import('../core/catalog/catalog-governance.routes')).default;
  await app.register(govRoutes, { prefix: '/catalog/governance' });
  await app.ready();

  // fixture: canonical_product pending na fila (para D1) — usa um existente? cria mínimo.
  // concepts é governado por trigger (app.concept_governance) — fixture entra por transação autorizada.
  const cli = await pool.connect();
  let conceptId: string;
  try {
    await cli.query('BEGIN');
    await cli.query(`SELECT set_config('app.concept_governance', 'true', true)`);
    conceptId = (await cli.query<{ concept_id: string }>(`INSERT INTO concepts (concept_id, slug, domain) VALUES (gen_random_uuid(), 'e2e-cur-${Date.now()}', 'item-comercial') RETURNING concept_id`)).rows[0].concept_id;
    await cli.query('COMMIT');
  } catch (e) { await cli.query('ROLLBACK'); throw e; } finally { cli.release(); }
  const cp = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_products (id, tenant_id, scope, concept_id, name, type) VALUES (gen_random_uuid(), $1, 'scoped', $2, 'Prod E2E', 'product') RETURNING id`, [T, conceptId]
  )).rows[0].id;
  await pool.query(`INSERT INTO canonical_concept_resolution_queue (canonical_product_id, status) VALUES ($1,'pending')`, [cp]);

  // A · D1 sem env → 403
  delete process.env.PLATFORM_CURATION_ADMIN_GLOBAL_USER_IDS;
  const rA = await app.inject({ method: 'POST', url: `/catalog/governance/curation/products/${cp}/approve`, payload: { conceptId, promoteToGlobal: true } });
  rec('A D1 promoteToGlobal SEM allowlist → 403 PROMOTE_TO_GLOBAL_PLATFORM_GATE (fail-closed)',
    rA.statusCode === 403 && /PROMOTE_TO_GLOBAL_PLATFORM_GATE/.test(rA.body), `status=${rA.statusCode}`);

  // B · D1 com env → passa o gate (200 ou erro DE DOMÍNIO ≠ gate)
  process.env.PLATFORM_CURATION_ADMIN_GLOBAL_USER_IDS = ` ${gu} `;
  const rB = await app.inject({ method: 'POST', url: `/catalog/governance/curation/products/${cp}/approve`, payload: { conceptId, promoteToGlobal: true } });
  rec('B D1 com globalUserId na allowlist → passa o gate de plataforma',
    rB.statusCode !== 403 || !/PLATFORM_GATE/.test(rB.body), `status=${rB.statusCode} body=${rB.body.slice(0, 120)}`);
  delete process.env.PLATFORM_CURATION_ADMIN_GLOBAL_USER_IDS;

  // C · D2 reject de serviço pending → retired + evento
  const cs = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_services (id, tenant_id, scope, concept_id, name, slug, status) VALUES (gen_random_uuid(), $1, 'scoped', $2, 'Serv E2E', 'serv-e2e-${Date.now()}', 'pending_curation') RETURNING id`, [T, conceptId]
  )).rows[0].id;
  const rC = await app.inject({ method: 'POST', url: `/catalog/governance/curation/services/${cs}/reject`, payload: { reason: 'duplicado' } });
  const st = (await pool.query<{ status: string }>(`SELECT status FROM canonical_services WHERE id=$1`, [cs])).rows[0]?.status;
  const ev = Number((await pool.query<{ n: string }>(`SELECT COUNT(*)::text n FROM canonical_catalog_events WHERE entity_id=$1 AND event_type='service_curation_rejected'`, [cs])).rows[0].n);
  rec('C D2 reject de serviço: 200 + pending→retired + evento service_curation_rejected',
    rC.statusCode === 200 && st === 'retired' && ev === 1, `status=${rC.statusCode} st=${st} ev=${ev}`);

  // D · D2 reject de NÃO-pending → 409
  const rD = await app.inject({ method: 'POST', url: `/catalog/governance/curation/services/${cs}/reject`, payload: {} });
  rec('D D2 reject de não-pending → 409 fail-closed', rD.statusCode === 409, `status=${rD.statusCode}`);

  await app.close();

  // E · gate-duplo (ressalva Yala): chamar o SERVICE direto (pulando a rota) sem allowlist → 403 no sink.
  const { catalogCurationService } = await import('../core/catalog/curation/catalog-curation.service');
  let sinkGate = false;
  try {
    await catalogCurationService.approveProduct({ canonicalProductId: cp, conceptId, curatorActorId: actor, tenantId: T, promoteToGlobal: true, requesterGlobalUserId: gu });
  } catch (e: any) { sinkGate = /PROMOTE_TO_GLOBAL_PLATFORM_GATE/.test(e?.code ?? e?.message ?? ''); }
  rec('E gate-duplo: service direto (pulando a rota) sem allowlist → 403 no SINK', sinkGate);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${failed.length === 0 ? '🎉 PASS' : '💥 FAIL'} — ${results.length - failed.length}/${results.length}`);
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error('💥 fatal:', e?.message ?? e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
