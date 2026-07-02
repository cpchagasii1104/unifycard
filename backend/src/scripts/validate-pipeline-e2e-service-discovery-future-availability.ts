/**
 * E2E — F-SERVICE-DISCOVERY-FUTURE-AVAILABILITY-SLICE-B (DT-SERVICE-DISCOVERY-IGNORES-FUTURE-
 * AVAILABILITY D2+D3). NÃO MOVE DINHEIRO. Prova, via ROTA REAL (GET /services/discover), que:
 *
 *   A browse padrão (sem data, sem flag) continua mostrando TODOS (3 providers) — prateleira atual
 *      NÃO é gateada por agenda por padrão, decisão preservada, não alterada nesta fatia
 *   B has_availability=true (sem data, D2): mostra quem tem QUALQUER janela futura (A e C), exclui
 *      quem não tem nenhuma (B)
 *   C starts_at/ends_at (D3, MESMO SEM has_availability=true — o bug original era exatamente essa
 *      ausência de gatilho implícito): filtra pra quem tem janela que SOBREPÕE o range pedido — só A
 *      (cuja janela é semana que vem, dentro do range) aparece; C (janela mês que vem, fora do range)
 *      e B (sem agenda) ficam de fora
 *   D Δbank=0
 *
 * 🔒 DB EFÊMERA (run-service-discovery-future-availability-ephemeral.ps1). NUNCA toca unificard_dev.
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
  if (!/discovery|availability|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function mkProvider(tenantId: string, conceptId: string, name: string, offeringWindow: { start: Date; end: Date } | null): Promise<string> {
  const userId = randomUUID();
  const gu = randomUUID();
  const tax = String(Date.now() + Math.floor(Math.random() * 1e6)).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${Date.now()}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;

  const canonicalId = (await pool.query<{ id: string }>(
    `INSERT INTO canonical_services (tenant_id, scope, concept_id, name, slug, status) VALUES (NULL,'global',$1,$2,$3,'active') RETURNING id`,
    [conceptId, `E2E ${name}`, `e2e-discovery-canon-${randomUUID().slice(0, 8)}`]
  )).rows[0].id;

  const serviceId = (await pool.query<{ id: string }>(
    `INSERT INTO services (tenant_id, actor_id, canonical_service_id, name, slug, service_type, status, currency)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,'service','active','BRL') RETURNING service_id AS id`,
    [tenantId, actorId, canonicalId, `E2E ${name} Service`, `e2e-discovery-svc-${randomUUID().slice(0, 8)}`]
  )).rows[0].id;

  const offeringId = (await pool.query<{ id: string }>(
    `INSERT INTO service_offerings (tenant_id, canonical_service_id, provider_actor_id, service_id, price_cents, duration_minutes, modality, location, service_area, conditions, status)
     VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,10000,60,'in_person','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'active') RETURNING id`,
    [tenantId, canonicalId, actorId, serviceId]
  )).rows[0].id;

  if (offeringWindow) {
    await pool.query(
      `INSERT INTO availability (tenant_id, owner_type, owner_id, start_datetime, end_datetime, status, timezone)
       VALUES ($1::uuid,'service_offering',$2::uuid,$3,$4,'active','America/Sao_Paulo')`,
      [tenantId, offeringId, offeringWindow.start, offeringWindow.end]
    );
  }

  return actorId;
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const TENANT = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug) VALUES ($1,'Discovery Availability E2E',$2)`, [TENANT, `discovery-avail-e2e-${TENANT.slice(0, 8)}`]);

  // concepts é GOVERNADO (0075_concept_governance_trigger).
  let conceptId: string;
  { const gc = await pool.connect();
    try {
      await gc.query('BEGIN');
      await gc.query(`SELECT set_config('app.concept_governance','true', true)`);
      conceptId = (await gc.query<{ concept_id: string }>(
        `INSERT INTO concepts (domain, slug) VALUES ('servicos',$1) RETURNING concept_id`,
        [`e2e-discovery-concept-${Date.now()}`]
      )).rows[0].concept_id;
      await gc.query('COMMIT');
    } catch (e) { await gc.query('ROLLBACK'); throw e; } finally { gc.release(); }
  }

  const now = new Date();
  const nextWeekStart = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const nextWeekEnd = new Date(now.getTime() + 8 * 24 * 3600 * 1000);
  const nextMonthStart = new Date(now.getTime() + 35 * 24 * 3600 * 1000);
  const nextMonthEnd = new Date(now.getTime() + 36 * 24 * 3600 * 1000);

  await mkProvider(TENANT, conceptId, 'ProviderA', { start: nextWeekStart, end: nextWeekEnd });   // janela semana que vem
  await mkProvider(TENANT, conceptId, 'ProviderB', null);                                          // sem agenda nenhuma
  await mkProvider(TENANT, conceptId, 'ProviderC', { start: nextMonthStart, end: nextMonthEnd });  // janela mês que vem (fora do range D3)

  const { default: servicesRoutes } = await import('../modules/services/services.routes');
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: randomUUID() };
  });
  await app.register(servicesRoutes, { prefix: '/services' });
  await app.ready();

  try {
    console.log('\n— A: browse padrão (sem data, sem flag) —');
    const rA = await app.inject({ method: 'GET', url: '/services/discover' });
    const dataA = JSON.parse(rA.body);
    record('A browse padrão mostra os 3 providers (prateleira não gateada por padrão)', rA.statusCode === 200 && dataA.data?.length === 3, `status=${rA.statusCode} count=${dataA.data?.length}`);

    console.log('\n— B: has_availability=true (D2, sem data) —');
    const rB = await app.inject({ method: 'GET', url: '/services/discover?has_availability=true' });
    const dataB = JSON.parse(rB.body);
    record('B has_availability=true mostra A e C (têm janela futura), exclui B (sem agenda)', rB.statusCode === 200 && dataB.data?.length === 2, `status=${rB.statusCode} count=${dataB.data?.length}`);

    console.log('\n— C: starts_at/ends_at (D3, SEM has_availability=true — o bug original) —');
    const startsAt = nextWeekStart.toISOString();
    const endsAt = nextWeekEnd.toISOString();
    const rC = await app.inject({ method: 'GET', url: `/services/discover?starts_at=${encodeURIComponent(startsAt)}&ends_at=${encodeURIComponent(endsAt)}` });
    const dataC = JSON.parse(rC.body);
    record('C starts_at/ends_at SOZINHO (sem flag) já filtra — só quem sobrepõe o range aparece (ProviderA)', rC.statusCode === 200 && dataC.data?.length === 1, `status=${rC.statusCode} count=${dataC.data?.length}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('D Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-service-discovery-future-availability-slice-b.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('E guard estrutural verde', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ browse padrão não gateado; has_availability=true (D2) e starts_at/ends_at SOZINHO (D3, gatilho implícito) filtram corretamente pelo SSOT canônico; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
