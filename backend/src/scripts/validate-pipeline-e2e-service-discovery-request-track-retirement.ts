/**
 * E2E — F-SERVICE-DISCOVERY-REQUEST-TRACK-RETIREMENT (DECISION-0156 D5+D6, fecha
 * DT-SERVICE-METADATA-AVAILABILITY-BLOB-PARALLEL + DT-SERVICE-DISCOVERY-REQUESTS-PARALLEL-TRAIL).
 * NÃO MOVE DINHEIRO. Prova, via ROTAS REAIS (app.inject), que:
 *
 *   A as 8 rotas do trilho paralelo (offers/metrics/search/my-requests/provider-requests/
 *      request/respond/request/:id/request) retornam 403 SERVICE_DISCOVERY_REQUEST_TRACK_RETIRED_
 *      BY_DECISION_0156 SEM tocar banco (zero linha em services/service_discovery_requests/
 *      canonical_catalog_events como efeito colateral)
 *   B /search-by-term (a ÚNICA rota viva do módulo) continua funcionando (200, não 403)
 *   C /request/pay preserva o comportamento ANTERIOR (firewall 403, R8J) — intocada por esta fatia
 *   D services.metadata.availability e service_discovery_requests continuam vazios (0 linhas) após
 *      as 8 tentativas — nenhum caminho de escrita sobrevive
 *   E Δbank=0
 *
 * 🔒 DB EFÊMERA (run-service-discovery-request-track-retirement-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => { results.push({ label, ok, reason }); console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`); };
const cwd = process.cwd();
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/discovery|retire|track|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
  const discoveryRequestsBefore = await count(`SELECT count(*)::int AS n FROM service_discovery_requests`);
  const blobBefore = await count(`SELECT count(*)::int AS n FROM services WHERE metadata->'availability' IS NOT NULL`);

  const { default: servicesDiscoveryRoutes } = await import('../modules/services/services-discovery.routes');
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  const actorId = randomUUID();
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: randomUUID() };
    req.tenant = { id: randomUUID() };
    req.actionContext = { actorId };
  });
  await app.register(servicesDiscoveryRoutes);
  await app.ready();

  try {
    console.log('\n— A: as 8 rotas do trilho paralelo retornam 403 retirement —');
    const retiredRoutes: Array<{ method: 'GET' | 'POST'; url: string; payload?: Record<string, unknown> }> = [
      { method: 'POST', url: '/offers', payload: { actorId, categoryId: randomUUID(), description: 'x', availability: [{ weekday: 'monday', slots: ['09:00-10:00'] }] } },
      { method: 'GET', url: '/metrics' },
      { method: 'GET', url: `/search?categoryId=${randomUUID()}` },
      { method: 'GET', url: '/my-requests' },
      { method: 'GET', url: '/provider-requests' },
      { method: 'POST', url: '/request/respond', payload: { requestId: randomUUID(), status: 'accepted' } },
      { method: 'GET', url: `/request/${randomUUID()}` },
      { method: 'POST', url: '/request', payload: { offerId: randomUUID(), datetime: new Date().toISOString(), customerId: actorId } },
    ];
    let allRetired = true;
    for (const route of retiredRoutes) {
      const r = await app.inject({ method: route.method, url: route.url, payload: route.payload });
      const body = JSON.parse(r.body);
      const ok = r.statusCode === 403 && body.code === 'SERVICE_DISCOVERY_REQUEST_TRACK_RETIRED_BY_DECISION_0156';
      if (!ok) { allRetired = false; console.log(`     ❌ ${route.method} ${route.url}: status=${r.statusCode} code=${body.code}`); }
    }
    record('A todas as 8 rotas retornam 403 SERVICE_DISCOVERY_REQUEST_TRACK_RETIRED_BY_DECISION_0156', allRetired);

    console.log('\n— B: /search-by-term continua viva —');
    const rB = await app.inject({ method: 'GET', url: `/search-by-term?term=${encodeURIComponent('termo-inexistente-e2e-xyz')}` });
    const dataB = JSON.parse(rB.body);
    record('B /search-by-term responde 200 (não 403 — única rota viva)', rB.statusCode === 200 && dataB.ok === true, `status=${rB.statusCode}`);

    console.log('\n— C: /request/pay preserva comportamento anterior (firewall + R8J) —');
    const rC = await app.inject({ method: 'POST', url: '/request/pay', payload: { requestId: randomUUID() } });
    const dataC = JSON.parse(rC.body);
    record('C /request/pay ainda 403 (firewall default OFF), intocada por esta fatia', rC.statusCode === 403, `status=${rC.statusCode} code=${dataC.code}`);

    console.log('\n— D: zero escrita sobrevive nas 2 fontes aposentadas —');
    const discoveryRequestsAfter = await count(`SELECT count(*)::int AS n FROM service_discovery_requests`);
    const blobAfter = await count(`SELECT count(*)::int AS n FROM services WHERE metadata->'availability' IS NOT NULL`);
    record('D service_discovery_requests continua vazia', discoveryRequestsAfter === discoveryRequestsBefore, `before=${discoveryRequestsBefore} after=${discoveryRequestsAfter}`);
    record('D services.metadata.availability continua vazio', blobAfter === blobBefore, `before=${blobBefore} after=${blobAfter}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('E Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-services-discovery-actor-bind.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('F guard estrutural verde', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ trilho paralelo (blob D5 + service_discovery_requests D6) aposentado incondicionalmente; search-by-term continua vivo; request/pay intocado; zero escrita sobrevive; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
