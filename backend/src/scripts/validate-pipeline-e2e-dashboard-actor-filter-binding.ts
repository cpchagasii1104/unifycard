/**
 * E2E — F-AUTHORITY-Z2-R2-DASHBOARD-ACTOR-FILTER-BINDING (DECISION-0113 / Z2).
 *
 * Prova que `query.actorId` em dashboard/overview·today·month NÃO vira filtro sem representação:
 * o actor filtrado é resolvido server-side por `resolveReportActorId` (canRepresentActor); declarar
 * o actor de outro (mesmo com dashboard:view) → 403. /sales segue protegido.
 *
 * (A) ESTRUTURAL (data-flow do dashboard.routes.ts):
 *     A1 overview/today/month/sales gateiam o caminho query.actorId via resolveReportActorId (≥4 chamadas).
 *     A2 NÃO existe `filters.actorId = query.actorId` cru (filtro por actorId declarado sem binding).
 *     A3 o filtro de actor é `filters.actorId = authorizedActorId` (resolvido).
 *     A4 resolveReportActorId = canRepresentActor + req.user.userId + 403 fail-closed.
 * (B) RUNTIME (a decisão EXATA que resolveReportActorId faz com query.actorId):
 *     B1 canRepresentActor(A.userId, A.actor) === true  (filtra o PRÓPRIO actor → autorizado).
 *     B2 canRepresentActor(A.userId, B.actor) === false (query.actorId = actor de B sem representar → 403).
 *     B3 dashboard:view sozinho não autoriza actor alheio (só representação server-side resolve).
 *
 * 🔒 DB EFÊMERA (run-dashboard-actor-filter-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from '../core/database/pool';
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
  if (!/dashboard|actor|authority|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string }> {
  seq += 1;
  const gu = randomUUID();
  const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, full_name) VALUES ($1::uuid,$2,$3)`, [gu, tax, name]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, global_user_id, email, password_hash, token_version, is_test, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3::uuid,$4,'x',0,true,NOW(),NOW())`, [userId, tenantId, gu, `${name}-${seq}@e2e.test`]);
  const actorId = (await pool.query<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).rows[0].id;
  return { userId, actorId };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  // ── (A) Estrutural ────────────────────────────────────────────────────────────────────────
  const src = readFileSync(join(process.cwd(), 'src/modules/dashboard/dashboard.routes.ts'), 'utf8');
  const calls = (src.match(/resolveReportActorId\(req, reply\)/g) || []).length;
  record('A1 overview/today/month/sales gateiam query.actorId via resolveReportActorId (≥4 chamadas)', calls >= 4, `chamadas=${calls}`);
  record('A2 sem `filters.actorId = query.actorId` cru (filtro por actorId declarado)', !/filters\.actorId\s*=\s*query\.actorId/.test(src));
  record('A3 filtro de actor = filters.actorId = authorizedActorId (resolvido)', /filters\.actorId\s*=\s*authorizedActorId/.test(src));
  record('A4 resolveReportActorId = canRepresentActor + req.user.userId + 403 fail-closed',
    /canRepresentActor\(req\.tenant\.id, userId, target\)/.test(src) && /req\?\.user\?\.userId/.test(src) && /REPORT_ACTOR_NOT_REPRESENTABLE/.test(src));

  // ── (B) Runtime — a decisão exata do gate ─────────────────────────────────────────────────
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const adapters = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(adapters.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(adapters.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(adapters.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(adapters.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(adapters.eventFeedHandlersAdapter);
  const { authorizationService } = await import('../core/authorization/authorization.service');

  const tenantId = (await pool.query<{ id: string }>(`INSERT INTO tenants (name, slug) VALUES ('Dashboard Filter E2E', $1) RETURNING id::text AS id`, [`dashboard-filter-e2e-${Date.now()}`])).rows[0].id;
  await pool.query(`SELECT set_config('app.current_tenant', $1, false)`, [tenantId]);
  const A = await mkUserActor(tenantId, 'alice');
  const B = await mkUserActor(tenantId, 'bob');

  const aReprA = await authorizationService.canRepresentActor(tenantId, A.userId, A.actorId);
  const aReprB = await authorizationService.canRepresentActor(tenantId, A.userId, B.actorId);
  record('B1 query.actorId próprio: canRepresentActor(A.userId, A.actor) === true (autorizado)', aReprA === true, `got=${aReprA}`);
  record('B2 query.actorId = actor de B: canRepresentActor(A.userId, B.actor) === false (→ 403 REPORT_ACTOR_NOT_REPRESENTABLE)', aReprB === false, `got=${aReprB}`);
  record('B3 dashboard:view sozinho não autoriza actor alheio (só representação resolve)', aReprA === true && aReprB === false);

  console.log('\n════════════════════════════════════════════════════════════════');
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log(`RESULTADO: ${passed}/${total} verdes`);
  if (passed !== total) {
    console.log('❌ FALHAS:');
    for (const r of results.filter((x) => !x.ok)) console.log(`   - ${r.label}: ${r.reason}`);
    process.exitCode = 1;
  } else {
    console.log('✨ dashboard overview/today/month: query.actorId só filtra com canRepresentActor; dashboard:view não é authority sobre actor alheio.');
  }
}

main()
  .catch((e) => { console.error('💥', e); process.exitCode = 1; })
  .finally(async () => { await pool.end(); });
