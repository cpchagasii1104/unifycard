/**
 * E2E — F-COMPANY-AGENDA-REAL-WIRING. NÃO MOVE DINHEIRO. Prova, via ROTA REAL (app.inject,
 * PUT /availability/weekly-template), que o contrato que o novo frontend passou a usar
 * (ownerType='page' + x-action-context declarando explicitamente o actorId da página, igual ao
 * `actorIdOverride` de `putWeeklyAvailabilityTemplate`) funciona corretamente contra o backend
 * REAL (inalterado — já suportava 'page' nesta rota antes desta frente; só o frontend nunca usava):
 *
 *   A owner da empresa materializa a grade da PÁGINA com sucesso (200)
 *   B janelas nascem com ownerType='page', ownerId=pageActorId (não no actor pessoal do owner)
 *   C dia/horário da janela batem com o schedule enviado
 *   D estranho (sem company_users) declarando o MESMO actorId da página → 403 (autoridade real,
 *      não apenas client-declared — o header não basta, canManageCompany decide)
 *   E Δbank=0 · F guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-company-agenda-real-wiring-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
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
  if (!/company|agenda|wiring|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; gu: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq * 17).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@e2e.test`, gu]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
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
  await tenantService.createTenant({ id: TENANT, name: 'Company Agenda Real Wiring', slug: `carw-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice'); // owner da empresa
  const stranger = await mkUserActor(TENANT, 'Stranger'); // sem vínculo com a empresa

  const companyId = randomUUID();
  await pool.query(
    `INSERT INTO companies (company_id, tenant_id, company_name, company_status, status) VALUES ($1::uuid,$2::uuid,'Empresa E2E','DRAFT','active')`,
    [companyId, TENANT]
  );
  await pool.query(
    `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company, is_active, is_primary) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true,true,true)`,
    [TENANT, companyId, alice.gu]
  );
  const pageActorId = (await pool.query<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page','Empresa E2E',$2::uuid,$3::uuid) RETURNING id::text AS id`,
    [TENANT, companyId, alice.actorId]
  )).rows[0].id;

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const availabilityModule = (await import('../core/availability/availability.module')).availabilityModule;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  let currentUser = alice;
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: currentUser.userId, userId: currentUser.userId, globalUserId: currentUser.gu };
    req.tenant = { id: TENANT };
    // Mesmo header que o frontend agora constrói via actorIdOverride (putWeeklyAvailabilityTemplate).
    const raw = req.headers['x-action-context'];
    req.actionContext = raw ? JSON.parse(raw) : { actorId: currentUser.actorId, intent: 'e2e', source: 'e2e', scope: 'e2e' };
  });
  await app.register(availabilityModule, { prefix: '/availability' });
  await app.ready();

  try {
    console.log('\n— A: owner materializa a grade da PÁGINA —');
    currentUser = alice;
    const r = await app.inject({
      method: 'PUT',
      url: '/availability/weekly-template',
      headers: {
        'x-action-context': JSON.stringify({ actorId: pageActorId, intent: 'user_action', source: 'frontend', scope: `tenant:${TENANT}` }),
      },
      payload: {
        schedule: { monday: ['09:00-18:00'], wednesday: ['09:00-12:00', '14:00-18:00'] },
        timezone: 'America/Sao_Paulo',
        ownerType: 'page',
      },
    });
    record('A owner materializa com sucesso (200)', r.statusCode === 200, `status=${r.statusCode}: ${r.body.slice(0, 300)}`);

    const windows = (await pool.query<{ owner_type: string; owner_id: string; start_datetime: Date }>(
      `SELECT owner_type, owner_id::text AS owner_id, start_datetime FROM availability WHERE tenant_id=$1 AND owner_id=$2::uuid`,
      [TENANT, pageActorId]
    )).rows;
    record('B janelas nascem com owner_type=page, owner_id=pageActorId', windows.length > 0 && windows.every((w) => w.owner_type === 'page'), JSON.stringify(windows.map((w) => w.owner_type)));

    const onAliceUserActor = (await pool.query(`SELECT count(*)::int AS n FROM availability WHERE tenant_id=$1 AND owner_id=$2::uuid`, [TENANT, alice.actorId])).rows[0].n;
    record('C nada nasceu no actor pessoal do owner (só na página)', Number(onAliceUserActor) === 0, `n=${onAliceUserActor}`);

    console.log('\n— D: estranho tenta materializar a MESMA página —');
    currentUser = stranger;
    const r2 = await app.inject({
      method: 'PUT',
      url: '/availability/weekly-template',
      headers: {
        'x-action-context': JSON.stringify({ actorId: pageActorId, intent: 'user_action', source: 'frontend', scope: `tenant:${TENANT}` }),
      },
      payload: {
        schedule: { friday: ['08:00-12:00'] },
        timezone: 'America/Sao_Paulo',
        ownerType: 'page',
      },
    });
    record('D estranho declarando o MESMO actorId → 403 (autoridade real, não client-declared)', r2.statusCode === 403, `status=${r2.statusCode}: ${r2.body.slice(0, 300)}`);

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('E Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-company-agenda-real-wiring.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('F guard estrutural verde', g === 0);
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ ownerType=page + actorIdOverride (via x-action-context) funciona contra o backend real: owner materializa, estranho é barrado por autoridade real; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
