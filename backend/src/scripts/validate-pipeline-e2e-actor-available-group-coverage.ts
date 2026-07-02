/**
 * E2E — F-ACTOR-AVAILABLE-GROUP-COVERAGE (findAvailableActors nunca listava grupos).
 * NÃO MOVE DINHEIRO. Prova, via ROTA REAL (app.inject, GET /social/actors/available), que:
 *
 *   A membro de grupo ATIVO vê o group-actor na listagem
 *   B group_role (owner) propagado como user_role
 *   C can_post=true para membro
 *   D grupo INATIVO (status != 'active') NÃO aparece
 *   E usuário NÃO-membro de outro grupo (mesmo tenant) NÃO vê esse outro grupo
 *   F grupo de OUTRO tenant NÃO aparece (tenant isolation)
 *   G actor pessoal (user) continua aparecendo (não regrediu)
 *   H Δbank=0
 *   I guard estrutural verde
 *
 * 🔒 DB EFÊMERA (run-actor-available-group-coverage-ephemeral.ps1). NUNCA toca unificard_dev.
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
  if (!/actor|available|group|coverage|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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

async function mkGroup(tenantId: string, ownerActorId: string, name: string, opts: { status?: string } = {}): Promise<{ groupId: string; groupActorId: string }> {
  // Mirroring findOrCreateGroupActor (actor.repository.ts): groups (actor_id NULL) → actors
  // (group_id set) → UPDATE groups SET actor_id (FK circular groups.actor_id ↔ actors.group_id).
  const groupId = randomUUID();
  const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
  await pool.query(
    `INSERT INTO groups (id, tenant_id, name, slug, status, owner_actor_id) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6::uuid)`,
    [groupId, tenantId, name, slug, opts.status ?? 'active', ownerActorId]
  );
  const groupActorId = (await pool.query<{ actor_id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, group_id, display_name, slug, responsible_actor_id)
     VALUES ($1::uuid,'group',$2::uuid,$3,$4,$5::uuid) RETURNING actor_id::text AS actor_id`,
    [tenantId, groupId, name, slug, ownerActorId]
  )).rows[0].actor_id;
  await pool.query(`UPDATE groups SET actor_id = $1::uuid WHERE id = $2::uuid`, [groupActorId, groupId]);
  return { groupId, groupActorId };
}

async function addMember(tenantId: string, groupId: string, userId: string, role: string): Promise<void> {
  await pool.query(
    `INSERT INTO group_members (tenant_id, group_id, user_id, role) VALUES ($1::uuid,$2::uuid,$3::uuid,$4)`,
    [tenantId, groupId, userId, role]
  );
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
  await tenantService.createTenant({ id: TENANT, name: 'Actor Available Group Coverage', slug: `aagc-${Date.now()}` });
  const alice = await mkUserActor(TENANT, 'Alice');
  const bob = await mkUserActor(TENANT, 'Bob'); // NÃO membro de grupo nenhum

  const activeGroup = await mkGroup(TENANT, alice.actorId, 'Grupo Ativo Alice');
  await addMember(TENANT, activeGroup.groupId, alice.userId, 'owner');

  const inactiveGroup = await mkGroup(TENANT, alice.actorId, 'Grupo Inativo Alice', { status: 'inactive' });
  await addMember(TENANT, inactiveGroup.groupId, alice.userId, 'owner');

  // Grupo de OUTRO tenant, mesmo owner-actor-id não faz sentido (actor é tenant-scoped) — usa outro tenant+actor.
  const TENANT2 = randomUUID();
  await tenantService.createTenant({ id: TENANT2, name: 'Outro Tenant', slug: `outro-${Date.now()}` });
  const aliceT2 = await mkUserActor(TENANT2, 'AliceT2');
  const otherTenantGroup = await mkGroup(TENANT2, aliceT2.actorId, 'Grupo Outro Tenant');
  await addMember(TENANT2, otherTenantGroup.groupId, aliceT2.userId, 'owner');

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const socialRoutes = (await import('../modules/social/social-2.0.routes')).default;
  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: alice.userId, userId: alice.userId, globalUserId: alice.gu };
    req.tenant = { id: TENANT };
  });
  await app.register(socialRoutes, { prefix: '/social' });
  await app.ready();

  try {
    console.log('\n— GET /social/actors/available (rota real) —');
    const r = await app.inject({ method: 'GET', url: '/social/actors/available' });
    record('status 200', r.statusCode === 200, `status=${r.statusCode}: ${r.body.slice(0, 300)}`);
    const body = r.statusCode === 200 ? JSON.parse(r.body) : { actors: [] };
    const actorList: Array<{ actor_id: string; actor_type: string; display_name: string; user_role?: string; can_post?: boolean }> = body.actors ?? [];

    const activeGroupEntry = actorList.find((a) => a.actor_id === activeGroup.groupActorId);
    record('A membro de grupo ATIVO vê o group-actor', !!activeGroupEntry, JSON.stringify(actorList.map((a) => a.display_name)));
    record('B group_role (owner) propagado como user_role', activeGroupEntry?.user_role === 'owner', `user_role=${activeGroupEntry?.user_role}`);
    record('C can_post=true para membro', activeGroupEntry?.can_post === true, `can_post=${activeGroupEntry?.can_post}`);

    const inactiveGroupEntry = actorList.find((a) => a.actor_id === inactiveGroup.groupActorId);
    record('D grupo INATIVO não aparece', !inactiveGroupEntry, JSON.stringify(inactiveGroupEntry));

    const otherTenantEntry = actorList.find((a) => a.actor_id === otherTenantGroup.groupActorId);
    record('F grupo de OUTRO tenant não aparece', !otherTenantEntry, JSON.stringify(otherTenantEntry));

    const personalEntry = actorList.find((a) => a.actor_id === alice.actorId);
    record('G actor pessoal (user) continua aparecendo (não regrediu)', !!personalEntry && personalEntry.actor_type === 'user');

    const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
    record('H Δbank=0', bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);

    let g = 0; try { execSync('node scripts/audit-actor-available-group-coverage.mjs', { cwd, encoding: 'utf8' }); } catch { g = 1; }
    record('I guard estrutural verde', g === 0);

    // E: Bob (não-membro) — chamada separada trocando o subject, MESMO app (nova injeção, novo hook).
    console.log('\n— E: usuário NÃO-membro não vê o grupo —');
    const app2 = Fastify();
    app2.decorateRequest('user', null);
    app2.decorateRequest('tenant', null);
    app2.addHook('onRequest', async (req: any) => {
      req.user = { id: bob.userId, userId: bob.userId, globalUserId: bob.gu };
      req.tenant = { id: TENANT };
    });
    await app2.register(socialRoutes, { prefix: '/social' });
    await app2.ready();
    try {
      const r2 = await app2.inject({ method: 'GET', url: '/social/actors/available' });
      const body2 = r2.statusCode === 200 ? JSON.parse(r2.body) : { actors: [] };
      const list2: Array<{ actor_id: string }> = body2.actors ?? [];
      const bobSeesActiveGroup = list2.some((a) => a.actor_id === activeGroup.groupActorId);
      record('E Bob (não-membro) NÃO vê Grupo Ativo Alice', !bobSeesActiveGroup, JSON.stringify(list2));
    } finally {
      await app2.close();
    }
  } finally {
    await app.close();
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ findAvailableActors agora lista grupos ativos com membership real; grupo inativo/outro tenant/não-membro corretamente excluídos; Δbank=0.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
