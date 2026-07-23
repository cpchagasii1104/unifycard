/**
 * E2E — D9.2-B · CUTOVER ACTOR-FIRST DA MEMBERSHIP (DECISION-0188 D16 · GO 2026-07-23).
 * Roda em DB EFÊMERA FRESCA com TODAS as migrations (runner produtivo FULL — inclui a migration
 * de cutover 20260723160000). Prova os 9 pontos do envelope:
 *   (1) createGroup real → owner com membership ATIVA na casa nova (D8); zero group_members;
 *   (2) invite explícito (O1→P) → aceite atômico → ativa com source_intent;
 *   (3) banda B convida a MESMA pessoa → P ativa em A e B; listByMember devolve ambas
 *       (a vocalista em duas bandas — o payoff do arco);
 *   (4) leave → terminal 'left' + reentrada = NOVA linha; owner NÃO sai (GAM_OWNER_CANNOT_LEAVE);
 *   (5) negativos: convite sem representação 403; ativa duplicada bloqueada;
 *   (6) legado CONGELADO: unificard_app sem DML em group_members (ACL + prova SET ROLE);
 *   (7) round-trip de ROTA: POST /join + GET /members + GET /mine sobre a casa nova;
 *   (8) cap civil 3 (D12): 4ª membership da mesma pessoa rejeitada;
 *   (9) Δbank = 0.
 * 🔒 DB EFÊMERA (run-group-membership-cutover-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const q = async <T,>(sql: string, p: unknown[] = []): Promise<T[]> => (await pool.query(sql, p)).rows as T[];
const one = async <T,>(sql: string, p: unknown[] = []): Promise<T> => (await pool.query(sql, p)).rows[0] as T;
async function expectFail(label: string, fn: () => Promise<unknown>, code: string): Promise<void> {
  try { await fn(); record(label, false, `esperava ${code}, passou`); }
  catch (e) { const m = e instanceof Error ? e.message : String(e); record(label, m.includes(code), `esperava ${code}; obteve: ${m.slice(0, 140)}`); }
}
async function assertEphemeralDb(): Promise<void> {
  const db = (await one<{ db: string }>('SELECT current_database() AS db')).db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkTenant(name: string): Promise<string> {
  seq += 1; const id = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [id, name, `${name}-${seq}-${id.slice(0, 8)}`]);
  return id;
}
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1; const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@gmc-e2e.test`, gu]);
  const actorId = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).id;
  return { userId, actorId, globalUserId: gu };
}

async function bootstrapPorts(): Promise<void> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);
  const { groupsPortsRegistry } = await import('../core/groups/ports-registry');
  const ga = await import('../modules/groups/adapters');
  groupsPortsRegistry.setGroupsRepository(ga.groupsRepositoryAdapter);
}

async function buildMinimalApp(): Promise<FastifyInstance> {
  const authPlugin = (await import('../core/auth/auth.plugin')).default;
  const { tenantPlugin } = await import('../plugins/tenant.plugin');
  const { actionContextPlugin } = await import('../plugins/action-context.plugin');
  const { rbacPlugin } = await import('../plugins/rbac.plugin');
  const groupsModule = (await import('../modules/groups/groups.module')).default;
  const app = Fastify({ logger: false });
  await app.register(sensible);
  await app.register(authPlugin);
  await app.register(tenantPlugin);
  await app.register(actionContextPlugin);
  await app.register(rbacPlugin);
  await app.register(groupsModule, { prefix: '/groups' });
  await app.ready();
  return app;
}

async function main(): Promise<void> {
  await assertEphemeralDb();
  await bootstrapPorts();

  const { groupsService } = await import('../modules/groups/groups.service');
  const { groupActorMembershipRepository } = await import('../modules/groups/group-actor-membership.repository');

  const bankCounts = async () => ({
    acc: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_accounts`)).n),
    tx: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_transactions`)).n),
    led: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_ledger`)).n),
  });
  const bankBefore = await bankCounts();

  // ── SETUP ──
  const T = await mkTenant('gmc-t1');
  const o1 = await mkUserActor(T, 'owner-banda-a');
  const o2 = await mkUserActor(T, 'owner-banda-b');
  const o3 = await mkUserActor(T, 'owner-banda-c');
  const o4 = await mkUserActor(T, 'owner-banda-d');
  const p = await mkUserActor(T, 'vocalista-p');
  const r = await mkUserActor(T, 'rota-r');
  const bystander = await mkUserActor(T, 'sem-autoridade');

  const mk = async (owner: { userId: string }, name: string) =>
    groupsService.createGroup(T, owner.userId, { name, description: `banda ${name} do e2e de cutover` } as any);

  // ══ 1 · createGroup REAL → owner membership ATIVA na casa nova (D8); zero escrita legada ══
  const gmLegacyBefore = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_members`)).n);
  const gA = await mk(o1, 'banda-a');
  {
    const rows = await q<{ status: string; member_actor_id: string; entry_idempotency_key: string }>(
      `SELECT status, member_actor_id::text AS member_actor_id, entry_idempotency_key
         FROM group_actor_memberships WHERE tenant_id=$1::uuid AND group_id=$2::uuid`, [T, gA.groupId]);
    record('1a createGroup → owner com membership ATIVA na casa nova (D8)',
      rows.length === 1 && rows[0].status === 'active' && rows[0].member_actor_id === o1.actorId,
      JSON.stringify(rows));
    record('1b chave determinística owner-genesis', rows[0]?.entry_idempotency_key === `owner-genesis:${gA.groupId}`);
    const gmLegacyAfter = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_members`)).n);
    record('1c ZERO escrita na casa legada congelada', gmLegacyAfter === gmLegacyBefore && gmLegacyAfter === 0, `legado=${gmLegacyAfter}`);
    const members = await groupsService.getGroupMembers(T, gA.groupId);
    record('1d getMembers projeta a casa nova (owner derivado, D11)',
      members.length === 1 && members[0].role === 'owner' && members[0].memberActorId === o1.actorId && members[0].userId === o1.userId);
  }

  // ══ 2 · invite explícito O1→P → aceite ATÔMICO → ativa com source_intent ══
  let inviteAId = '';
  {
    const invite = await groupsService.createInvite(T, gA.groupId, p.actorId, o1.userId);
    inviteAId = invite.inviteId;
    const intentRow = await one<{ intent_kind: string; status: string }>(
      `SELECT intent_kind, status FROM group_invites WHERE id=$1::uuid AND tenant_id=$2::uuid`, [inviteAId, T]);
    record('2a convite = intenção EXPLÍCITA pendente (intent_kind=invite)',
      intentRow.intent_kind === 'invite' && intentRow.status === 'pending');
    const member = await groupsService.acceptInvite(T, inviteAId, p.userId);
    record('2b aceite pelo candidato → membro ATIVO (P na banda A)', member.role === 'member' && member.memberActorId === p.actorId);
    const mRow = await one<{ status: string; source_intent_id: string | null; i_status: string }>(
      `SELECT m.status, m.source_intent_id::text AS source_intent_id, gi.status AS i_status
         FROM group_actor_memberships m JOIN group_invites gi ON gi.id = m.source_intent_id AND gi.tenant_id = m.tenant_id
        WHERE m.tenant_id=$1::uuid AND m.group_id=$2::uuid AND m.member_actor_id=$3::uuid AND m.status='active'`,
      [T, gA.groupId, p.actorId]);
    record('2c ATOMICIDADE: membership ativa LIGADA à intent accepted',
      mRow?.status === 'active' && mRow?.source_intent_id === inviteAId && mRow?.i_status === 'accepted');
  }

  // ══ 3 · a MESMA pessoa em DUAS bandas (payoff do arco) ══
  const gB = await mk(o2, 'banda-b');
  {
    const invite = await groupsService.createInvite(T, gB.groupId, p.actorId, o2.userId);
    await groupsService.acceptInvite(T, invite.inviteId, p.userId);
    const mine = (await groupActorMembershipRepository.listByMember(T, p.actorId)).filter((m) => m.status === 'active');
    record('3a vocalista P ATIVA em A e B (listByMember → 2 ativas)',
      mine.length === 2 && new Set(mine.map((m) => m.groupId)).size === 2
        && mine.some((m) => m.groupId === gA.groupId) && mine.some((m) => m.groupId === gB.groupId),
      JSON.stringify(mine.map((m) => m.groupId)));
    const myGroups = await groupsService.getUserGroups(T, p.userId);
    record('3b getUserGroups (via listByMember) devolve as 2 bandas',
      myGroups.length === 2 && myGroups.some((g) => g.groupId === gA.groupId) && myGroups.some((g) => g.groupId === gB.groupId));
  }

  // ══ 4 · lifecycle: leave terminal + reentrada = NOVA linha; owner não sai ══
  {
    const left = await groupsService.leaveGroup(T, gB.groupId, p.userId);
    const rows = await q<{ id: string; status: string; left_by_actor_id: string | null }>(
      `SELECT id::text AS id, status, left_by_actor_id::text AS left_by_actor_id
         FROM group_actor_memberships WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND member_actor_id=$3::uuid
        ORDER BY created_at ASC`, [T, gB.groupId, p.actorId]);
    record('4a leave → terminal left com autoria (história preservada)',
      left === true && rows.length === 1 && rows[0].status === 'left' && rows[0].left_by_actor_id === p.actorId);
    const rejoin = await groupsService.joinGroup(T, gB.groupId, p.userId);
    const rows2 = await q<{ id: string; status: string }>(
      `SELECT id::text AS id, status FROM group_actor_memberships
        WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND member_actor_id=$3::uuid ORDER BY created_at ASC`, [T, gB.groupId, p.actorId]);
    record('4b reentrada = NOVA linha ativa (plural histórico)',
      rejoin.memberActorId === p.actorId && rows2.length === 2 && rows2[0].status === 'left' && rows2[1].status === 'active');
    await expectFail('4c owner NÃO sai do próprio grupo (D8)',
      () => groupsService.leaveGroup(T, gA.groupId, o1.userId), 'GAM_OWNER_CANNOT_LEAVE');
  }

  // ══ 5 · negativos ══
  await expectFail('5a convite por quem NÃO representa o grupo → 403 fail-closed',
    () => groupsService.createInvite(T, gA.groupId, bystander.actorId, bystander.userId), 'GAM_GROUP_NOT_REPRESENTED');
  await expectFail('5b membership ativa DUPLICADA bloqueada',
    () => groupsService.joinGroup(T, gB.groupId, p.userId), 'GAM_ACTIVE_MEMBERSHIP_EXISTS');

  // ══ 6 · legado CONGELADO (ACL + prova comportamental SET ROLE) ══
  {
    const dml = await q<{ privilege_type: string }>(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE table_name='group_members' AND grantee='unificard_app' AND privilege_type IN ('INSERT','UPDATE','DELETE')`);
    record('6a unificard_app SEM INSERT/UPDATE/DELETE em group_members', dml.length === 0, JSON.stringify(dml));
    const sel = await q<{ privilege_type: string }>(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE table_name='group_members' AND grantee='unificard_app' AND privilege_type='SELECT'`);
    record('6b SELECT de projeção preservado (D4: read-only, sem drop)', sel.length === 1, JSON.stringify(sel));
    let deniedCode = '';
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SET LOCAL ROLE unificard_app');
      try {
        await c.query(
          `INSERT INTO group_members (id, tenant_id, group_id, user_id, role) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'member')`,
          [randomUUID(), T, gA.groupId, p.userId]);
      } catch (e) {
        deniedCode = (e as { code?: string }).code ?? '';
      }
      await c.query('ROLLBACK');
    } finally {
      c.release();
    }
    record('6c INSERT como unificard_app FALHA (42501 — congelamento REAL)', deniedCode === '42501', `code=${deniedCode}`);
    const uqOld = await q(`SELECT 1 FROM pg_constraint WHERE conname='uq_group_invite'`);
    const uqNew = await q<{ indexdef: string }>(`SELECT indexdef FROM pg_indexes WHERE indexname='uq_gi_pending_per_pair'`);
    record('6d UNIQUE legado de invites SUBSTITUÍDO (tenant-scoped, pending-only)',
      uqOld.length === 0 && uqNew.length === 1 && /tenant_id/.test(uqNew[0].indexdef) && /pending/.test(uqNew[0].indexdef));
  }

  // ══ 7 · round-trip de ROTA sobre a casa nova ══
  const gC = await mk(o3, 'banda-c');
  {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) throw new Error('JWT_SECRET ausente no ambiente');
    const app = await buildMinimalApp();
    const token = jwt.sign(
      { sub: r.userId, userId: r.userId, tenantId: T, email: 'rota-r@gmc-e2e.test', type: 'access', tokenVersion: 0 },
      JWT_SECRET, { expiresIn: '10m' });
    const ac = JSON.stringify({ actorId: r.actorId, intent: 'join_group', source: 'e2e', scope: `tenant:${T}` });
    try {
      const rJoin = await app.inject({
        method: 'POST', url: `/groups/${gC.groupId}/join`,
        headers: { authorization: `Bearer ${token}`, 'x-action-context': ac },
      });
      record('7a POST /join → 200 (rota flipada, writer governado)', rJoin.statusCode === 200, `status=${rJoin.statusCode} body=${rJoin.body.slice(0, 160)}`);
      const joined = await one<{ n: string }>(
        `SELECT count(*) AS n FROM group_actor_memberships WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND member_actor_id=$3::uuid AND status='active'`,
        [T, gC.groupId, r.actorId]);
      record('7b membership da rota vive na casa NOVA', Number(joined.n) === 1);
      const rMembers = await app.inject({
        method: 'GET', url: `/groups/${gC.groupId}/members`,
        headers: { authorization: `Bearer ${token}`, 'x-action-context': ac },
      });
      const membersBody = JSON.parse(rMembers.body) as { members: Array<{ userId: string | null; memberActorId: string; role: string }> };
      record('7c GET /members projeta a casa nova (owner derivado + R member)',
        rMembers.statusCode === 200
          && membersBody.members.some((m) => m.memberActorId === o3.actorId && m.role === 'owner')
          && membersBody.members.some((m) => m.memberActorId === r.actorId && m.role === 'member'),
        rMembers.body.slice(0, 200));
      const rMine = await app.inject({ method: 'GET', url: '/groups/mine', headers: { authorization: `Bearer ${token}` } });
      const mineBody = JSON.parse(rMine.body) as { groups: Array<{ groupId: string }> };
      record('7d GET /mine (auth-derived) devolve o grupo via casa nova',
        rMine.statusCode === 200 && mineBody.groups.length === 1 && mineBody.groups[0].groupId === gC.groupId,
        rMine.body.slice(0, 200));
    } finally {
      await app.close();
    }
  }

  // ══ 8 · cap civil 3 (D12): a 4ª membership da MESMA pessoa é rejeitada ══
  const gD = await mk(o4, 'banda-d');
  {
    const third = await groupsService.joinGroup(T, gC.groupId, p.userId); // 3ª ativa de P
    record('8a 3ª membership ativa permitida (cap = 3)', third.memberActorId === p.actorId);
    await expectFail('8b 4ª membership REJEITADA (cap civil D12, contado na casa nova)',
      () => groupsService.joinGroup(T, gD.groupId, p.userId), 'User cannot be in more than 3 groups');
    const activeCount = await one<{ n: string }>(
      `SELECT count(*) AS n FROM group_actor_memberships m JOIN groups g ON g.id=m.group_id AND g.tenant_id=m.tenant_id
        WHERE m.tenant_id=$1::uuid AND m.member_actor_id=$2::uuid AND m.status='active' AND g.status='active'`, [T, p.actorId]);
    record('8c contagem física confirma 3 ativas (sem dupla contagem de namespace)', Number(activeCount.n) === 3);
  }

  // ══ 9 · Δbank = 0 + legado intacto ══
  {
    const bankAfter = await bankCounts();
    record('9a Δbank=0 (contas/movimentos/registros idênticos)',
      bankAfter.acc === bankBefore.acc && bankAfter.tx === bankBefore.tx && bankAfter.led === bankBefore.led,
      JSON.stringify({ bankBefore, bankAfter }));
    const legacyFinal = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_members`)).n);
    record('9b group_members permanece VAZIA (nenhum caminho de produto escreve no legado)', legacyFinal === 0, `legado=${legacyFinal}`);
  }

  const failed = results.filter((x) => !x.ok);
  console.log(`\n═══ RESULTADO: ${results.length - failed.length}/${results.length} OK ═══`);
  if (failed.length) {
    console.error('FALHAS:');
    for (const f of failed) console.error(`  ❌ ${f.label} — ${f.reason ?? ''}`);
    process.exit(1);
  }
}

main()
  .then(() => { console.log('E2E GROUP-MEMBERSHIP-CUTOVER: OK'); process.exit(0); })
  .catch((e) => { console.error('💥', e instanceof Error ? e.stack : e); process.exit(1); });
