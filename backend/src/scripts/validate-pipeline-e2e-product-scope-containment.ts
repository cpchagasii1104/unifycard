/**
 * E2E — F-OUT-OF-SCOPE-CONTAINMENT (2026-08-01)
 *
 * Prova COMPORTAMENTAL, HTTP real contra os plugins de rota REAIS (os mesmos registrados em
 * app.builder.ts / marketplace.routes.ts / unifybank.module.ts / work.module.ts):
 *
 *   1) Endpoint de módulo FORA DO MÍNIMO → 501 com a razão de ESCOPO (não de defeito):
 *      code=MODULE_OUT_OF_PRODUCT_MINIMUM, o mínimo de produto listado por extenso, o substrato
 *      ausente nomeado, e a instrução de como REABRIR (reversível, custo em horas).
 *   2) A contenção fira ANTES do handler: o hook é onRequest, logo nenhum service/SQL é
 *      alcançado — provado usando rota que, se alcançasse o handler, bateria em tabela ausente
 *      e devolveria 500 cru (42P01) em vez do 501 nomeado.
 *   3) `user-group-allocation` responde com a razão de LEI (MODULE_REVOKED_BY_LAW), não a de
 *      escopo — são razões diferentes e a de lei é mais forte (reversible=false).
 *   4) Endpoint que usa tabela EXISTENTE e funciona hoje SEGUE 200 — contenção de módulo inteiro
 *      apagaria o que presta. Provados 3, todos em rides (o módulo mais contido do repo).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-product-scope-containment-ephemeral.ps1.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { randomUUID } from 'crypto';

import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';

dotenv.config({ path: join(process.cwd(), '.env') });

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
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/scope|product|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let TENANT_ID = '';
let USER_ID = '';

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(sensible);
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.decorate('requirePermission', () => async () => { /* no-op: authz fora do escopo desta prova */ });
  app.decorate('requireAnyPermission', () => async () => { /* no-op */ });
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: USER_ID, userId: USER_ID };
    req.tenant = { id: TENANT_ID };
    req.actionContext = { actorId: USER_ID, intent: 'product_scope_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` };
  });

  const { default: presenceRoutes } = await import('../modules/presence/presence.routes');
  const { default: loyaltyRoutes } = await import('../modules/loyalty/loyalty.routes');
  const { default: ugAllocRoutes } = await import('../core/user-group-allocation/user-group-allocation.routes');
  const { default: workModule } = await import('../modules/work/work.module');
  const { default: humanMvpRoutes } = await import('../modules/human-mvp/human-mvp.routes');
  const { default: pilotEventsRoutes } = await import('../core/pilot/pilot-events.routes');
  const { default: institutionalMemoryRoutes } = await import('../core/pilot/institutional-memory.routes');
  const { default: ridesModule } = await import('../modules/rides/rides.module');

  await app.register(presenceRoutes, { prefix: '/presence' });
  await app.register(loyaltyRoutes, { prefix: '/loyalty' });
  await app.register(ugAllocRoutes, { prefix: '/user' });
  await app.register(workModule, { prefix: '/work' });
  await app.register(humanMvpRoutes, { prefix: '/human-mvp' });
  await app.register(pilotEventsRoutes, { prefix: '/admin/pilot' });
  await app.register(institutionalMemoryRoutes, { prefix: '/admin/pilot' });
  await app.register(ridesModule, { prefix: '/rides' });
  await app.ready();
  return app;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Product Scope Containment Test', slug: `prod-scope-${Date.now()}` });

  const globalId = randomUUID();
  USER_ID = randomUUID();
  const cpf = String(Date.now() % 100000000).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, 'E2E Scope']);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [USER_ID, TENANT_ID, globalId, `${USER_ID}@e2e.local`]);

  // Seeds no SHAPE VIVO, só para os 3 endpoints que DEVEM continuar 200 (regra: não tocar no que presta).
  const serviceTypeId = (await pool.query<{ id: string }>(
    `INSERT INTO rides_service_types (tenant_id, name, description, base_fare_cents, price_per_km_cents, price_per_min_cents, is_active, metadata)
     VALUES ($1, 'UnifiGo Scope E2E', 'tipo e2e', 500, 150, 30, TRUE, '{}'::jsonb) RETURNING id::text AS id`,
    [TENANT_ID]
  )).rows[0].id;
  const driverId = (await pool.query<{ id: string }>(
    `INSERT INTO rides_drivers (tenant_id, user_id, status, level, metadata)
     VALUES ($1, $2, 'active', 'standard', '{}'::jsonb) RETURNING id::text AS id`,
    [TENANT_ID, USER_ID]
  )).rows[0].id;
  await pool.query(
    `INSERT INTO rides_vehicles (tenant_id, driver_id, plate, brand, model, year, color, category, service_type_id, is_active, is_approved, is_verified, metadata)
     VALUES ($1, $2, 'SCP1E23', 'VW', 'Gol', 2020, 'prata', 'standard', $3, TRUE, TRUE, FALSE, '{}'::jsonb)`,
    [TENANT_ID, driverId, serviceTypeId]
  );

  const app = await buildApp();
  const st = (r: any) => r.statusCode;
  const body = (r: any) => { try { return JSON.parse(r.body); } catch { return {}; } };

  try {
    console.log('\n— 1+2. FORA DO MÍNIMO → 501 com razão de ESCOPO, antes de qualquer service/SQL —');

    const casos: Array<[string, string, string, string]> = [
      ['presence', 'GET', '/presence/my?contactId=' + randomUUID(), 'checkins'],
      ['loyalty', 'GET', '/loyalty/account?contactId=' + randomUUID(), 'loyalty_accounts'],
      ['work', 'GET', '/work/jobs', 'jobs'],
      ['work (instant)', 'GET', '/work/instant/status', 'jobs'],
      ['human-mvp', 'POST', '/human-mvp/opportunities', 'human_mvp_opportunities'],
      ['pilot-events', 'GET', '/admin/pilot/events', 'pilot_events'],
      ['institutional-memory', 'GET', '/admin/pilot/institutional-memory', 'institutional_memory_declarations'],
    ];

    for (const [nome, method, url, substrato] of casos) {
      const r = await app.inject({ method: method as any, url });
      const b = body(r);
      const ok501 = st(r) === 501;
      const okCode = b.code === 'MODULE_OUT_OF_PRODUCT_MINIMUM';
      record(`${nome} ${method} ${url} → 501 MODULE_OUT_OF_PRODUCT_MINIMUM (não 500 cru)`, ok501 && okCode, `status=${st(r)} code=${b.code} body=${r.body.slice(0, 200)}`);
      if (ok501 && okCode) {
        record(`  ${nome} → corpo diz "NOT broken / scope that has not been started"`, typeof b.reason === 'string' && b.reason.includes('not been started'), String(b.reason).slice(0, 160));
        record(`  ${nome} → corpo nomeia o substrato ausente (${substrato})`, JSON.stringify(b.missing_substrate ?? []).includes(substrato), JSON.stringify(b.missing_substrate));
        record(`  ${nome} → corpo diz como REABRIR e que é reversível`, b.reversible === true && typeof b.how_to_reopen === 'string' && b.how_to_reopen.includes('REVERSIBLE'), `reversible=${b.reversible}`);
      }
    }

    console.log('\n— 3. LEI ≠ ESCOPO: user-group-allocation responde com a razão mais forte —');
    const rUg = await app.inject({ method: 'GET', url: '/user/group-allocation' });
    const bUg = body(rUg);
    record('user-group-allocation → 501 MODULE_REVOKED_BY_LAW (não a razão de escopo)', st(rUg) === 501 && bUg.code === 'MODULE_REVOKED_BY_LAW', `status=${st(rUg)} code=${bUg.code}`);
    record('  → corpo cita CONTRATO_GRUPOS_V2 e marca reversible=false (não se reabre por decisão de fatia)',
      bUg.reversible === false && String(bUg.reason).includes('CONTRATO_GRUPOS_V2'), `reversible=${bUg.reversible} reason=${String(bUg.reason).slice(0, 140)}`);

    console.log('\n— 4. O QUE PRESTA SEGUE PRESTANDO: 3 endpoints vivos, intocados —');

    const rSt = await app.inject({ method: 'GET', url: '/rides/service-types' });
    const sts = body(rSt);
    record('GET /rides/service-types → 200 com a linha semeada (tabela viva, leitura real)',
      st(rSt) === 200 && Array.isArray(sts) && sts.some((s: any) => s.name === 'UnifiGo Scope E2E'), `status=${st(rSt)} body=${rSt.body.slice(0, 200)}`);

    const rVeh = await app.inject({ method: 'GET', url: `/rides/vehicles/drivers/${driverId}/vehicles` });
    const vs = body(rVeh);
    record('GET /rides/vehicles/drivers/:id/vehicles → 200 com o veículo semeado (leitura real)',
      st(rVeh) === 200 && Array.isArray(vs) && vs.length === 1 && vs[0].plate === 'SCP1E23', `status=${st(rVeh)} body=${rVeh.body.slice(0, 200)}`);

    const rDist = await app.inject({ method: 'GET', url: '/rides/location/location/distance?lat1=-25.42&lng1=-49.27&lat2=-25.43&lng2=-49.28' });
    record('GET /rides/location/location/distance → 200 (matemática pura, zero SQL)',
      st(rDist) === 200 && typeof body(rDist).distance_meters === 'number', `status=${st(rDist)} body=${rDist.body.slice(0, 150)}`);

    console.log('\n— rides: contenção pré-existente agora cita ESCOPO (razão que não expira) —');
    const rOnline = await app.inject({ method: 'POST', url: '/rides/availability/online', payload: { lat: -25.4, lng: -49.2, cityId: randomUUID() } });
    record('POST /rides/availability/online → 501 e a mensagem cita MODULE OUT OF PRODUCT MINIMUM',
      st(rOnline) === 501 && String(body(rOnline).message ?? '').includes('MODULE OUT OF PRODUCT MINIMUM'), `status=${st(rOnline)} msg=${String(body(rOnline).message ?? '').slice(0, 160)}`);
  } finally {
    await app.close();
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ PRODUCT-SCOPE-CONTAINMENT :: PASS (${results.length}/${results.length})` : `❌ PRODUCT-SCOPE-CONTAINMENT :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
