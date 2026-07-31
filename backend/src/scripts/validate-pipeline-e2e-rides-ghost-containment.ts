/**
 * E2E — F-RIDES-GHOST-CONTAINMENT (2026-07-31)
 *
 * Prova COMPORTAMENTAL, HTTP real contra o ridesModule montado (mesmos route files registrados
 * em app.builder.ts:448 via rides.module.ts):
 *   1) endpoint cujo substrato NÃO existe → 501 nomeando o substrato ausente, ANTES de qualquer
 *      service/SQL (antes desta fatia: 500 cru 42P01/42883 com cara de bug de banco).
 *      Prova de que o service NÃO é alcançado: PATCH /drivers/<uuid-aleatório>/availability
 *      devolve 501, não 404 — o UPDATE (que devolveria "not found") nunca roda; e o SQL direto
 *      na mesma DB confirma 42P01 (o que o handler antigo teria estourado).
 *   2) endpoint cujo substrato EXISTE e cujo SQL bate com o shape vivo → segue funcionando (200).
 *      Provados: GET /service-types e GET /drivers/:id/vehicles (leituras reais em tabela viva)
 *      + GET /location/distance (matemática pura). 🔴 ACHADO DESTA PROVA (fora do escopo, NÃO
 *      contido): a maior parte dos endpoints "de tabela viva" quebra por DRIFT DE COLUNA (42703)
 *      — as tabelas rides_* vivas usam PK `id`, mas o código fala driver_id/city_id/zone_id/
 *      ride_id/active_vehicle_id/verifiedAt/base_fare etc. Classe DIFERENTE de schema-ghost,
 *      não medida no pacote; documentada no cartório e AQUI por 2 asserts reprodutíveis.
 *
 * Authz REAL (requirePermission/RBAC) fica fora do escopo desta prova: os decorators são
 * stubbados como no-op (precedente: validate-pipeline-e2e-contacts-schema-ghost.ts). Em produção
 * a contenção 501 fira DEPOIS do authz (preHandler preservado nos route files, não afrouxado).
 *
 * 🔒 DB EFÊMERA. Orquestrado por scripts/run-rides-ghost-containment-ephemeral.ps1.
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

const GHOST_TABLES = ['rides_driver_availability', 'rides_emergency_contacts', 'rides_ride_events', 'rides_ride_shares', 'rides_disputes', 'rides_zone_demand_pressure', 'rides_zone_incentives', 'rides_driver_services', 'notify_queue'];
const GHOST_FNS = ['rides_check_driving_limit', 'rides_calculate_realtime_earnings', 'rides_calculate_zone_pressure', 'rides_create_auto_zone_incentive'];

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco-alvo "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/rides|ghost|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome de banco "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
  for (const t of GHOST_TABLES) {
    const r = await pool.query<{ t: string | null }>(`SELECT to_regclass('public.' || $1::text)::text AS t`, [t]);
    record(`pré-condição: tabela ${t} AUSENTE (como medido em unificard_dev)`, r.rows[0].t === null, `to_regclass=${r.rows[0].t}`);
  }
  for (const f of GHOST_FNS) {
    const r = await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_proc WHERE proname = $1`, [f]);
    record(`pré-condição: função ${f} AUSENTE (como medido em unificard_dev)`, r.rows[0].n === 0, `pg_proc=${r.rows[0].n}`);
  }
}

let TENANT_ID = '';
let USER_ID = '';

async function main(): Promise<void> {
  await assertEphemeralDb();

  // O 500 de ANTES, provado por SQL direto na mesma DB (o que o handler antigo executava):
  console.log('\n— ANTES (o que o handler antigo estourava): SQL direto → erro cru de banco —');
  try {
    await pool.query(`UPDATE rides_driver_availability SET is_available = TRUE`);
    record('UPDATE rides_driver_availability → erro 42P01 (tabela não existe)', false, 'não lançou');
  } catch (err: any) {
    record('UPDATE rides_driver_availability → erro 42P01 (tabela não existe)', err?.code === '42P01', `code=${err?.code} msg=${err?.message}`);
  }
  try {
    await pool.query(`SELECT * FROM rides_calculate_realtime_earnings($1, $2)`, [randomUUID(), randomUUID()]);
    record('SELECT rides_calculate_realtime_earnings(...) → erro 42883 (função não existe)', false, 'não lançou');
  } catch (err: any) {
    record('SELECT rides_calculate_realtime_earnings(...) → erro 42883 (função não existe)', err?.code === '42883', `code=${err?.code} msg=${err?.message}`);
  }

  TENANT_ID = randomUUID();
  await tenantService.createTenant({ id: TENANT_ID, name: 'Rides Ghost Containment', slug: `rides-ghost-${Date.now()}` });

  const globalId = randomUUID();
  USER_ID = randomUUID();
  const cpf = String(Date.now() % 100000000).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name, metadata) VALUES ($1,$2,$3,'{}'::jsonb)`, [globalId, cpf, 'E2E Driver']);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [globalId, cpf]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version) VALUES ($1,$1,$2,$3,$4,'x',0)`, [USER_ID, TENANT_ID, globalId, `${USER_ID}@e2e.local`]);

  // Seeds diretos no SHAPE VIVO (não no shape que o código legado imagina) pro healthy-path:
  const serviceTypeId = (await pool.query<{ id: string }>(
    `INSERT INTO rides_service_types (tenant_id, name, description, base_fare_cents, price_per_km_cents, price_per_min_cents, is_active, metadata)
     VALUES ($1, 'UnifiGo E2E', 'tipo de serviço e2e', 500, 150, 30, TRUE, '{}'::jsonb) RETURNING id::text AS id`,
    [TENANT_ID]
  )).rows[0].id;
  const driverId = (await pool.query<{ id: string }>(
    `INSERT INTO rides_drivers (tenant_id, user_id, status, level, metadata)
     VALUES ($1, $2, 'active', 'standard', '{}'::jsonb) RETURNING id::text AS id`,
    [TENANT_ID, USER_ID]
  )).rows[0].id;
  await pool.query(
    `INSERT INTO rides_vehicles (tenant_id, driver_id, plate, brand, model, year, color, category, service_type_id, is_active, is_approved, is_verified, metadata)
     VALUES ($1, $2, 'ABC1D23', 'VW', 'Gol', 2020, 'prata', 'standard', $3, TRUE, TRUE, FALSE, '{}'::jsonb)`,
    [TENANT_ID, driverId, serviceTypeId]
  );

  const app = Fastify({ logger: false });
  await app.register(sensible);
  // Stubs de contexto/authz (fora do escopo da prova; contenção fira DEPOIS do authz em produção).
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.decorate('requirePermission', () => async () => { /* no-op: authz fora do escopo */ });
  app.decorate('requireAnyPermission', () => async () => { /* no-op */ });
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: USER_ID, userId: USER_ID };
    req.tenant = { id: TENANT_ID };
    req.actionContext = { actorId: USER_ID, intent: 'rides_ghost_e2e', source: 'e2e', scope: `tenant:${TENANT_ID}` };
  });
  const { default: ridesModule } = await import('../modules/rides/rides.module');
  await app.register(ridesModule, { prefix: '/rides' });
  await app.ready();

  const st = (r: any) => r.statusCode;
  const body = (r: any) => { try { return JSON.parse(r.body); } catch { return {}; } };

  try {
    console.log('\n— CONTIDOS: 501 nomeando o substrato, service NÃO alcançado —');

    const rOnline = await app.inject({ method: 'POST', url: '/rides/availability/online', payload: { lat: -25.4, lng: -49.2, cityId: randomUUID() } });
    record('POST /rides/availability/online → 501 (antes: 500 cru)', st(rOnline) === 501, `status=${st(rOnline)} body=${rOnline.body.slice(0, 200)}`);
    record('  → corpo nomeia rides_driver_availability E (função) rides_check_driving_limit',
      body(rOnline).code === 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED'
        && JSON.stringify(body(rOnline).missing_substrate).includes('rides_driver_availability')
        && JSON.stringify(body(rOnline).missing_substrate).includes('rides_check_driving_limit'),
      rOnline.body.slice(0, 300));

    // service NÃO alcançado: uuid aleatório → o UPDATE antigo devolveria 404 'not found'; 501 = parou antes.
    const rPatch = await app.inject({ method: 'PATCH', url: `/rides/drivers/${randomUUID()}/availability`, payload: { isAvailable: true } });
    record('PATCH /rides/drivers/<uuid-aleatório>/availability → 501, NÃO 404 (prova: parou ANTES do SQL)',
      st(rPatch) === 501 && body(rPatch).code === 'RIDES_AVAILABILITY_SCHEMA_GHOST_CONTAINED', `status=${st(rPatch)} body=${rPatch.body.slice(0, 200)}`);

    const rStatus = await app.inject({ method: 'GET', url: '/rides/availability/status' });
    record('GET /rides/availability/status → 501', st(rStatus) === 501, `status=${st(rStatus)}`);

    const rContacts = await app.inject({ method: 'POST', url: '/rides/safety/contacts', payload: { name: 'Mãe', phone: '+5541999990000' } });
    record('POST /rides/safety/contacts → 501 nomeando rides_emergency_contacts',
      st(rContacts) === 501 && JSON.stringify(body(rContacts).missing_substrate).includes('rides_emergency_contacts'), `status=${st(rContacts)} body=${rContacts.body.slice(0, 200)}`);

    const rSos = await app.inject({ method: 'POST', url: '/rides/safety/sos', payload: { rideId: randomUUID(), lat: -25.4, lng: -49.2, type: 'passenger' } });
    record('POST /rides/safety/sos → 501 nomeando rides_ride_events + notify_queue (borda do notificador)',
      st(rSos) === 501 && JSON.stringify(body(rSos).missing_substrate).includes('rides_ride_events') && JSON.stringify(body(rSos).missing_substrate).includes('notify_queue'), `status=${st(rSos)} body=${rSos.body.slice(0, 250)}`);

    const rPressure = await app.inject({ method: 'GET', url: '/rides/demand/pressure' });
    record('GET /rides/demand/pressure → 501 nomeando rides_zone_demand_pressure',
      st(rPressure) === 501 && JSON.stringify(body(rPressure).missing_substrate).includes('rides_zone_demand_pressure'), `status=${st(rPressure)} body=${rPressure.body.slice(0, 200)}`);

    const rStDrivers = await app.inject({ method: 'GET', url: `/rides/service-types/${randomUUID()}/drivers` });
    record('GET /rides/service-types/:id/drivers → 501 nomeando rides_driver_services',
      st(rStDrivers) === 501 && JSON.stringify(body(rStDrivers).missing_substrate).includes('rides_driver_services'), `status=${st(rStDrivers)} body=${rStDrivers.body.slice(0, 200)}`);

    const rPing = await app.inject({ method: 'POST', url: '/rides/location/drivers/location', payload: { driverId: randomUUID(), lat: -25.4, lng: -49.2 } });
    record('POST /rides/location/drivers/location → 501 (cadeia isOnline→availability ausente)',
      st(rPing) === 501 && body(rPing).code === 'RIDES_LOCATION_SCHEMA_GHOST_CONTAINED', `status=${st(rPing)} body=${rPing.body.slice(0, 200)}`);

    console.log('\n— SAUDÁVEIS: substrato existe E SQL bate com o shape vivo → seguem 200 —');

    const rServiceTypes = await app.inject({ method: 'GET', url: '/rides/service-types' });
    const sts = body(rServiceTypes);
    record('GET /rides/service-types → 200 com o tipo semeado (SELECT *, shape vivo, leitura real)',
      st(rServiceTypes) === 200 && Array.isArray(sts) && sts.some((s: any) => s.name === 'UnifiGo E2E'), `status=${st(rServiceTypes)} body=${rServiceTypes.body.slice(0, 200)}`);

    const rVehicles = await app.inject({ method: 'GET', url: `/rides/vehicles/drivers/${driverId}/vehicles` });
    const vehicles = body(rVehicles);
    record('GET /rides/vehicles/drivers/:driverId/vehicles → 200 com o veículo semeado (leitura real)',
      st(rVehicles) === 200 && Array.isArray(vehicles) && vehicles.length === 1 && vehicles[0].plate === 'ABC1D23', `status=${st(rVehicles)} body=${rVehicles.body.slice(0, 200)}`);

    const rDist = await app.inject({ method: 'GET', url: '/rides/location/location/distance?lat1=-25.42&lng1=-49.27&lat2=-25.43&lng2=-49.28' });
    record('GET /rides/location/location/distance → 200 (matemática pura, zero SQL)',
      st(rDist) === 200 && typeof body(rDist).distance_meters === 'number', `status=${st(rDist)} body=${rDist.body.slice(0, 150)}`);

    console.log('\n— 🔴 ACHADO documentado (drift de coluna, classe fora do escopo, NÃO contido) —');
    const rCities = await app.inject({ method: 'GET', url: '/rides/cities' });
    record('ACHADO: GET /rides/cities → 500 por 42703 (código pede city_id; tabela viva tem PK id) — drift, não ghost',
      st(rCities) === 500, `status=${st(rCities)} body=${rCities.body.slice(0, 200)}`);
    const rListDrivers = await app.inject({ method: 'GET', url: '/rides/drivers' });
    record('ACHADO: GET /rides/drivers → 500 por 42703 (código pede driver_id/active_vehicle_id; tabela viva tem id) — drift, não ghost',
      st(rListDrivers) === 500, `status=${st(rListDrivers)} body=${rListDrivers.body.slice(0, 200)}`);
  } finally {
    await app.close();
  }

  console.log('\n════════════════════════════════════════════');
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length === 0 ? `✅ RIDES-GHOST-CONTAINMENT :: PASS (${results.length}/${results.length})` : `❌ RIDES-GHOST-CONTAINMENT :: FAIL (${results.length - failed.length}/${results.length})`);
  console.log('════════════════════════════════════════════');
  await pool.end();
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
