/**
 * E2E — D9.2-A · FUNDAÇÃO ACTOR-FIRST DORMENTE DA MEMBERSHIP (DECISION-0186 + DECISION-0188).
 * Prova, contra o SCHEMA REAL do clone efêmero (com D9.1 + D9.2-A aplicadas SOMENTE no clone):
 *   A schema/ACL/RLS · B membership user (lifecycle/idempotência/terminal/reentrada) ·
 *   C membership page (representação real via company_users; revogação concorrente) ·
 *   D membership group-raiz (interno/self/parent↔filho rejeitados) · E owner invariante ·
 *   F intents novas (invite/request explícitos; pending único; aceite ATÔMICO; fault injection;
 *     residual do UNIQUE legado SINALIZADO) · G legado intocado (writers/readers vivos seguem;
 *     zero dual-write) · H shadow validation determinística e PURA · I não-contaminação
 *     (grants/relationships/bindings/Bank/N0-N1-N2/categories Δ=0) · J concorrência real.
 * 🔒 DB EFÊMERA (run-group-actor-membership-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import { pool } from '../core/database/pool';
import { randomUUID } from 'crypto';

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
  catch (e) { const m = e instanceof Error ? e.message : String(e); record(label, m.includes(code), `esperava ${code}; obteve: ${m.slice(0, 130)}`); }
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
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@gam-e2e.test`, gu]);
  const actorId = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).id;
  return { userId, actorId, globalUserId: gu };
}
async function mkGroup(tenantId: string, ownerActorId: string, name: string): Promise<{ groupId: string; groupActorId: string }> {
  seq += 1;
  const groupId = (await one<{ id: string }>(`INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,$2,$3,$4::uuid,'active','{}'::jsonb) RETURNING id::text AS id`, [tenantId, name, `${name}-${seq}`.toLowerCase(), ownerActorId])).id;
  const groupActorId = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, group_id, responsible_actor_id) VALUES ($1::uuid,'group',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, `${name}-actor`, groupId, ownerActorId])).id;
  await pool.query(`UPDATE groups SET actor_id = $1::uuid WHERE id = $2::uuid`, [groupActorId, groupId]);
  return { groupId, groupActorId };
}
async function mkManagedPage(tenantId: string, respActorId: string, managerGlobalUserId: string, name: string): Promise<{ pageActorId: string; cuId: string }> {
  seq += 1; const companyId = randomUUID();
  await pool.query(`INSERT INTO companies (company_id, tenant_id, company_name, status, company_status, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3,'active','DRAFT',NOW(),NOW())`, [companyId, tenantId, name]);
  const pageActorId = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, companyId, respActorId])).id;
  const cu = await one<{ id: string }>(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true) RETURNING id::text AS id`, [tenantId, companyId, managerGlobalUserId]);
  return { pageActorId, cuId: cu.id };
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const { actorRepositoryAdapter } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  const { groupActorMembershipService } = await import('../modules/groups/group-actor-membership.service');
  const { measureLegacyMembershipConvergence } = await import('../modules/groups/group-membership-shadow.readmodel');

  const countsOf = async () => ({
    grants: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM actor_capability_grants`)).n),
    rels: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM actor_relationships`)).n),
    bindings: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_institutional_bindings`)).n),
    bankAcc: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_accounts`)).n),
    bankTx: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_transactions`)).n),
    bankLedger: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_ledger`)).n),
    legacyMembers: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_members`)).n),
    n1: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM n1_nodes`)).n),
    categories: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM categories`)).n),
  });
  const before = await countsOf();

  // ── SETUP ──
  const T1 = await mkTenant('gam-t1');
  const T2 = await mkTenant('gam-t2');
  const owner = await mkUserActor(T1, 'owner');
  const alice = await mkUserActor(T1, 'alice');
  const bob = await mkUserActor(T1, 'bob');
  const g1 = await mkGroup(T1, owner.actorId, 'comunidade');
  const page = await mkManagedPage(T1, owner.actorId, alice.globalUserId, 'empresa-membro');
  const root = await mkGroup(T1, alice.actorId, 'inst-raiz');
  const child = await mkGroup(T1, alice.actorId, 'inst-filho');
  // binding D9.1 real NO CLONE: child é INTERNO de root (composição, nunca membership)
  await pool.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)`, [T1, child.groupId, root.groupActorId, alice.actorId, 'gam-setup-bind']);

  // ══ A · SCHEMA / ACL / RLS ══
  {
    const rls = await one<{ e: boolean; f: boolean }>(`SELECT relrowsecurity AS e, relforcerowsecurity AS f FROM pg_class WHERE relname='group_actor_memberships'`);
    record('A1 RLS ENABLE+FORCE na casa nova', rls.e && rls.f);
    const dml = await q(`SELECT privilege_type FROM information_schema.role_table_grants WHERE table_name='group_actor_memberships' AND grantee='unificard_app' AND privilege_type IN ('INSERT','UPDATE','DELETE')`);
    record('A2 app SEM DML direto na casa nova', dml.length === 0);
    const fks = await q<{ conname: string }>(`SELECT conname FROM pg_constraint WHERE conrelid='group_actor_memberships'::regclass AND contype='f' AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (tenant_id,%'`);
    record('A3 FKs compostas tenant-scoped (6)', fks.length === 6, String(fks.length));
    const pubExec = (await one<{ ok: boolean }>(`SELECT has_function_privilege('pg_read_all_data','fn_enter_group_actor_membership(uuid,uuid,uuid,uuid,text,uuid)','EXECUTE') AS ok`)).ok;
    record('A4 PUBLIC/role não-granted SEM EXECUTE', pubExec === false);
    const cols = await q<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='group_actor_memberships'`);
    const names = cols.map(c => c.column_name);
    record('A5 casa SEM user_id/global_user_id/role/member_type', !names.some(n => ['user_id', 'global_user_id', 'role', 'member_type'].includes(n)));
  }

  // ══ B · MEMBERSHIP USER (self) ══
  const mAlice = await groupActorMembershipService.enterMembershipSelf({ tenantId: T1, actingUserId: alice.userId, groupId: g1.groupId, idempotencyKey: 'k-b1' });
  record('B1 entrada self cria membership ativa do PRÓPRIO user-actor', mAlice.status === 'active' && mAlice.memberActorId === alice.actorId);
  const mAliceR = await groupActorMembershipService.enterMembershipSelf({ tenantId: T1, actingUserId: alice.userId, groupId: g1.groupId, idempotencyKey: 'k-b1' });
  record('B2 replay exato retorna a MESMA membership', mAliceR.id === mAlice.id);
  await expectFail('B3 mesma chave com payload divergente falha', () =>
    groupActorMembershipService.enterMembershipSelf({ tenantId: T1, actingUserId: bob.userId, groupId: g1.groupId, idempotencyKey: 'k-b1' }), 'GAM_IDEMPOTENCY_MISMATCH');
  await expectFail('B4 segunda ativa do mesmo par falha', () =>
    groupActorMembershipService.enterMembershipSelf({ tenantId: T1, actingUserId: alice.userId, groupId: g1.groupId, idempotencyKey: 'k-b4' }), 'GAM_ACTIVE_MEMBERSHIP_EXISTS');
  const mLeft = await groupActorMembershipService.leaveMembership({ tenantId: T1, actingUserId: alice.userId, membershipId: mAlice.id });
  record('B5 leave → terminal left com trilha', mLeft.status === 'left' && !!mLeft.leftAt && mLeft.leftByActorId === alice.actorId);
  await expectFail('B6 DELETE bloqueado NO BANCO', async () => pool.query(`DELETE FROM group_actor_memberships WHERE id=$1::uuid`, [mAlice.id]), 'GAM_DELETE_FORBIDDEN');
  await expectFail('B7 reativação bloqueada NO BANCO (terminal)', async () => pool.query(`UPDATE group_actor_memberships SET status='active', left_at=NULL, left_by_actor_id=NULL WHERE id=$1::uuid`, [mAlice.id]), 'GAM_IMMUTABLE_TERMINAL');
  const mAlice2 = await groupActorMembershipService.enterMembershipSelf({ tenantId: T1, actingUserId: alice.userId, groupId: g1.groupId, idempotencyKey: 'k-b8' });
  record('B8 reentrada após left = NOVA linha; história plural', mAlice2.id !== mAlice.id && (await q(`SELECT 1 FROM group_actor_memberships WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND member_actor_id=$3::uuid`, [T1, g1.groupId, alice.actorId])).length === 2);
  const mRemoved = await groupActorMembershipService.removeMembership({ tenantId: T1, actingUserId: owner.userId, membershipId: mAlice2.id });
  record('B9 remove (representando o group-actor via owner) → terminal removed', mRemoved.status === 'removed' && mRemoved.removedByActorId === owner.actorId);

  // ══ C · MEMBERSHIP PAGE (representação REAL + revogação concorrente) ══
  const mPage = await groupActorMembershipService.enterMembershipAsRepresentative({ tenantId: T1, actingUserId: alice.userId, groupId: g1.groupId, memberActorId: page.pageActorId, idempotencyKey: 'k-c1' });
  record('C1 page entra representada (company_users real); membro = a PAGE', mPage.memberActorId === page.pageActorId && mPage.createdByActorId === alice.actorId);
  await expectFail('C2 sem representação (bob) negada', () =>
    groupActorMembershipService.enterMembershipAsRepresentative({ tenantId: T1, actingUserId: bob.userId, groupId: g1.groupId, memberActorId: page.pageActorId, idempotencyKey: 'k-c2' }), 'GAM_MEMBER_NOT_REPRESENTED');
  {
    // revogação DURANTE a entrada institucional (uncommitted) → nunca commit com authority obsoleta
    await groupActorMembershipService.leaveMembership({ tenantId: T1, actingUserId: alice.userId, membershipId: mPage.id });
    const B = await pool.connect();
    await B.query('BEGIN');
    await B.query(`UPDATE company_users SET is_active=false WHERE id=$1::uuid`, [page.cuId]);
    let settled = false;
    const A = groupActorMembershipService.enterMembershipAsRepresentative({ tenantId: T1, actingUserId: alice.userId, groupId: g1.groupId, memberActorId: page.pageActorId, idempotencyKey: 'k-c3' })
      .then(() => ({ ok: true as const })).catch((e: Error) => ({ ok: false as const, msg: e.message })).finally(() => { settled = true; });
    await new Promise(r => setTimeout(r, 500));
    const blocked = settled === false;
    await B.query('COMMIT'); B.release();
    const out = await A;
    const rows = await q(`SELECT 1 FROM group_actor_memberships WHERE tenant_id=$1::uuid AND entry_idempotency_key='k-c3'`, [T1]);
    record('C3 revogação concorrente serializa: entrada espera, lê revogado, falha; zero linha; chave não consumida',
      blocked && out.ok === false && /GAM_MEMBER_NOT_REPRESENTED/.test(out.msg ?? '') && rows.length === 0);
    await pool.query(`UPDATE company_users SET is_active=true WHERE id=$1::uuid`, [page.cuId]);
  }
  {
    const bogusCompany = randomUUID();
    const badPage = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page','page-sem-company',$2::uuid,$3::uuid) RETURNING id::text AS id`, [T1, bogusCompany, owner.actorId])).id;
    await expectFail('C4 page sem Company viva rejeitada (estrutural)', () =>
      pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T1, g1.groupId, badPage, owner.actorId, 'k-c4']), 'GAM_PAGE_INCOHERENT');
  }

  // ══ D · MEMBERSHIP GROUP-RAIZ / ANTI-COMPOSIÇÃO ══
  const mRoot = await groupActorMembershipService.enterMembershipAsRepresentative({ tenantId: T1, actingUserId: alice.userId, groupId: g1.groupId, memberActorId: root.groupActorId, idempotencyKey: 'k-d1' });
  record('D1 group-actor RAIZ entra representado', mRoot.memberActorId === root.groupActorId);
  await expectFail('D2 group INTERNO (filho D9.1) rejeitado como membro', () =>
    pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T1, g1.groupId, child.groupActorId, alice.actorId, 'k-d2']), 'GAM_MEMBER_GROUP_NOT_ROOT');
  await expectFail('D3 self-membership rejeitada', () =>
    pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T1, g1.groupId, g1.groupActorId, owner.actorId, 'k-d3']), 'GAM_SELF_MEMBERSHIP');
  await expectFail('D4 instituição-parent NÃO entra no próprio Group interno', () =>
    pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T1, child.groupId, root.groupActorId, alice.actorId, 'k-d4']), 'GAM_PARENT_CANNOT_JOIN_CHILD');
  {
    const sys = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name) VALUES ($1::uuid,'system','sys-gam') RETURNING id::text AS id`, [T1])).id;
    await expectFail('D5 system-actor rejeitado (classe fechada)', () =>
      pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T1, g1.groupId, sys, owner.actorId, 'k-d5']), 'GAM_MEMBER_TYPE_INVALID');
  }
  await expectFail('D6 cross-tenant fail-closed (não-vazante)', () =>
    pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T2, g1.groupId, alice.actorId, alice.actorId, 'k-d6']), 'ACTOR_TENANT_MISMATCH');

  // ══ E · OWNER INVARIANTE ══
  const mOwner = await groupActorMembershipService.enterMembershipSelf({ tenantId: T1, actingUserId: owner.userId, groupId: g1.groupId, idempotencyKey: 'k-e1' });
  record('E1 owner possui membership ativa própria', mOwner.status === 'active' && mOwner.memberActorId === owner.actorId);
  await expectFail('E2 owner não sai (leave bloqueado)', () =>
    groupActorMembershipService.leaveMembership({ tenantId: T1, actingUserId: owner.userId, membershipId: mOwner.id }), 'GAM_OWNER_CANNOT_LEAVE');
  await expectFail('E3 owner não é removido', () =>
    groupActorMembershipService.removeMembership({ tenantId: T1, actingUserId: owner.userId, membershipId: mOwner.id }), 'GAM_OWNER_CANNOT_BE_REMOVED');
  {
    const g = await one<{ o: string }>(`SELECT owner_actor_id::text AS o FROM groups WHERE id=$1::uuid`, [g1.groupId]);
    record('E4 ownership civil INALTERADO pela membership', g.o === owner.actorId);
  }

  // ══ F · INTENTS EXPLÍCITAS ══
  const carol = await mkUserActor(T1, 'carol');
  const inviteId = await groupActorMembershipService.createMembershipIntent({ tenantId: T1, actingUserId: owner.userId, groupId: g1.groupId, candidateActorId: carol.actorId, intentKind: 'invite', idempotencyKey: 'k-f1' });
  record('F1 invite explícito criado (lado group)', !!inviteId);
  const inviteIdR = await groupActorMembershipService.createMembershipIntent({ tenantId: T1, actingUserId: owner.userId, groupId: g1.groupId, candidateActorId: carol.actorId, intentKind: 'invite', idempotencyKey: 'k-f1' });
  record('F2 replay do intent retorna o MESMO id', inviteIdR === inviteId);
  await expectFail('F3 request pendente do MESMO par não coexiste com invite pendente', () =>
    groupActorMembershipService.createMembershipIntent({ tenantId: T1, actingUserId: carol.userId, groupId: g1.groupId, candidateActorId: carol.actorId, intentKind: 'request', idempotencyKey: 'k-f3' }), 'GAM_INTENT_PENDING_EXISTS');
  {
    // fault injection ANTES do aceite real: rollback externo não consome nada
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT fn_accept_group_membership_intent($1::uuid,$2::uuid,$3::uuid)`, [T1, inviteId, carol.actorId]);
      await c.query('ROLLBACK');
    } finally { c.release(); }
    const st = await one<{ s: string }>(`SELECT status AS s FROM group_invites WHERE id=$1::uuid`, [inviteId]);
    const m = await q(`SELECT 1 FROM group_actor_memberships WHERE tenant_id=$1::uuid AND source_intent_id=$2::uuid`, [T1, inviteId]);
    record('F4 fault-injection no aceite: intent segue pending; zero membership; rollback íntegro', st.s === 'pending' && m.length === 0);
  }
  const mCarol = await groupActorMembershipService.acceptMembershipIntent({ tenantId: T1, actingUserId: carol.userId, intentId: inviteId });
  {
    const st = await one<{ s: string }>(`SELECT status AS s FROM group_invites WHERE id=$1::uuid`, [inviteId]);
    record('F5 aceite ATÔMICO: membership ativa + intent accepted na MESMA transação', mCarol.status === 'active' && mCarol.sourceIntentId === inviteId && st.s === 'accepted');
  }
  const mCarolR = await groupActorMembershipService.acceptMembershipIntent({ tenantId: T1, actingUserId: carol.userId, intentId: inviteId });
  record('F6 replay do aceite retorna a MESMA membership', mCarolR.id === mCarol.id);
  {
    // request explícito (self) + aprovação pelo lado group
    const dave = await mkUserActor(T1, 'dave');
    const reqId = await groupActorMembershipService.createMembershipIntent({ tenantId: T1, actingUserId: dave.userId, groupId: g1.groupId, candidateActorId: dave.actorId, intentKind: 'request', idempotencyKey: 'k-f7' });
    await expectFail('F7 candidato NÃO aprova o próprio request (lado group exigido)', () =>
      groupActorMembershipService.acceptMembershipIntent({ tenantId: T1, actingUserId: dave.userId, intentId: reqId }), 'GAM_GROUP_NOT_REPRESENTED');
    const mDave = await groupActorMembershipService.acceptMembershipIntent({ tenantId: T1, actingUserId: owner.userId, intentId: reqId });
    record('F8 request aprovado pelo lado group → membership do candidato', mDave.memberActorId === dave.actorId);
    // residual do UNIQUE legado: nova intent para par com linha histórica → SINALIZADO fail-closed
    await expectFail('F9 residual pré-cutover SINALIZADO: novo intent p/ par com histórico bate no UNIQUE legado', () =>
      groupActorMembershipService.createMembershipIntent({ tenantId: T1, actingUserId: owner.userId, groupId: g1.groupId, candidateActorId: dave.actorId, intentKind: 'invite', idempotencyKey: 'k-f9' }), 'GAM_INTENT_LEGACY_UNIQUE_RESIDUAL');
  }
  await expectFail('F10 intent_kind implícito/NULL impossível no caminho novo', () =>
    pool.query(`SELECT fn_create_group_membership_intent($1::uuid,$2::uuid,$3::uuid,$4::uuid,NULL,$5)`, [T1, g1.groupId, bob.actorId, owner.actorId, 'k-f10']), 'GAM_INTENT_KIND_INVALID');

  // ══ G · LEGADO INTOCADO ══
  {
    const legacyBefore = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_members`)).n);
    // writer legado segue vivo e NÃO passa pelos triggers novos
    await pool.query(`INSERT INTO group_members (tenant_id, group_id, user_id, role) VALUES ($1::uuid,$2::uuid,$3::uuid,'member')`, [T1, g1.groupId, bob.userId]);
    const legacyAfter = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_members`)).n);
    record('G1 writer legado de group_members segue funcionando (intocado)', legacyAfter === legacyBefore + 1);
    // invite LEGADO (intent_kind NULL) segue o fluxo antigo: insert + update de status LIVRES
    const li = await one<{ id: string }>(`INSERT INTO group_invites (tenant_id, group_id, invited_actor_id, invited_by_actor_id, status) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'pending') RETURNING id::text AS id`, [T1, g1.groupId, bob.actorId, owner.actorId]);
    await pool.query(`UPDATE group_invites SET status='cancelled', responded_at=NOW() WHERE id=$1::uuid`, [li.id]);
    const st = await one<{ s: string }>(`SELECT status AS s FROM group_invites WHERE id=$1::uuid`, [li.id]);
    record('G2 caminho legado de invites intocado (NULL ≠ invite novo; trigger não interfere)', st.s === 'cancelled');
    const dual = await q(`SELECT 1 FROM group_actor_memberships gam JOIN group_members gm ON gm.tenant_id=gam.tenant_id AND gm.group_id=gam.group_id AND gam.entry_idempotency_key LIKE 'legacy%'`);
    record('G3 zero dual-write (nenhuma linha nova nasceu do caminho legado)', dual.length === 0);
  }

  // ══ H · SHADOW VALIDATION (dados REAIS do clone + os deste teste) ══
  {
    const devTenant = await one<{ t: string }>(`SELECT tenant_id::text AS t FROM group_members ORDER BY created_at ASC LIMIT 1`);
    const report = await measureLegacyMembershipConvergence(devTenant.t);
    record('H1 medição determinística do legado do clone (todas as rows classificadas)', report.totalLegacyRows >= 1 && report.rows.every(r => !!r.readiness));
    record('H2 legado do dev-clone resolve determinístico (ready)', report.rows.filter(r => r.readiness === 'ready').length >= 1);
    const gamBefore = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_actor_memberships`)).n);
    await measureLegacyMembershipConvergence(T1);
    const gamAfter = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_actor_memberships`)).n);
    record('H3 shadow é PURA: zero escrita, zero backfill, zero Actor criado', gamBefore === gamAfter);
  }

  // ══ J · CONCORRÊNCIA REAL ══
  {
    const eve = await mkUserActor(T1, 'eve');
    const g2 = await mkGroup(T1, owner.actorId, 'concorrencia-gam');
    const run = (k: string) => pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T1, g2.groupId, eve.actorId, eve.actorId, k]);
    const [r1, r2] = await Promise.allSettled([run('k-j1-a'), run('k-j1-b')]);
    const okCount = [r1, r2].filter(r => r.status === 'fulfilled').length;
    const active = await q(`SELECT 1 FROM group_actor_memberships WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND member_actor_id=$3::uuid AND status='active'`, [T1, g2.groupId, eve.actorId]);
    record('J1 duas entradas simultâneas (chaves distintas): 1 vencedor · 1 fail-closed · 1 ativa', okCount === 1 && active.length === 1);
    const [s1, s2] = await Promise.allSettled([
      pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)::text AS id`, [T1, g2.groupId, owner.actorId, owner.actorId, 'k-j2']),
      pool.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)::text AS id`, [T1, g2.groupId, owner.actorId, owner.actorId, 'k-j2']),
    ]);
    const ids = [s1, s2].filter((r) => r.status === 'fulfilled').map((r) => ((r as PromiseFulfilledResult<{ rows: { id: string }[] }>).value.rows[0] as { id: string }).id);
    record('J2 mesma chave simultânea: efeito ÚNICO (ids idênticos)', ids.length === 2 && ids[0] === ids[1]);
    // leave × remove concorrentes: exatamente UMA terminalização
    const mEve = await one<{ id: string }>(`SELECT id::text FROM group_actor_memberships WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND member_actor_id=$3::uuid AND status='active'`, [T1, g2.groupId, eve.actorId]);
    const [l1, l2] = await Promise.allSettled([
      pool.query(`SELECT fn_leave_group_actor_membership($1::uuid,$2::uuid,$3::uuid)`, [T1, mEve.id, eve.actorId]),
      pool.query(`SELECT fn_remove_group_actor_membership($1::uuid,$2::uuid,$3::uuid)`, [T1, mEve.id, owner.actorId]),
    ]);
    const st = await one<{ s: string }>(`SELECT status AS s FROM group_actor_memberships WHERE id=$1::uuid`, [mEve.id]);
    const terminalOk = (st.s === 'left' || st.s === 'removed');
    const oneFailed = [l1, l2].some(r => r.status === 'rejected');
    record('J3 leave×remove concorrentes: UMA transição terminal; a outra falha canônica; sem dupla trilha', terminalOk && oneFailed);
    // aceite simultâneo do mesmo intent → 1 membership
    const frank = await mkUserActor(T1, 'frank');
    const iId = await groupActorMembershipService.createMembershipIntent({ tenantId: T1, actingUserId: owner.userId, groupId: g2.groupId, candidateActorId: frank.actorId, intentKind: 'invite', idempotencyKey: 'k-j4' });
    const [a1, a2] = await Promise.allSettled([
      pool.query(`SELECT fn_accept_group_membership_intent($1::uuid,$2::uuid,$3::uuid)::text AS id`, [T1, iId, frank.actorId]),
      pool.query(`SELECT fn_accept_group_membership_intent($1::uuid,$2::uuid,$3::uuid)::text AS id`, [T1, iId, frank.actorId]),
    ]);
    const aIds = [a1, a2].filter(r => r.status === 'fulfilled').map(r => ((r as PromiseFulfilledResult<{ rows: { id: string }[] }>).value.rows[0] as { id: string }).id);
    const mm = await q(`SELECT 1 FROM group_actor_memberships WHERE tenant_id=$1::uuid AND source_intent_id=$2::uuid`, [T1, iId]);
    record('J4 aceite simultâneo: 1 membership, ids idênticos, intent accepted única', mm.length === 1 && aIds.length === 2 && aIds[0] === aIds[1]);
    // falha DURANTE o COMMIT → zero parcial
    const grace = await mkUserActor(T1, 'grace');
    const A = await pool.connect();
    (A as unknown as { on: (ev: string, fn: () => void) => void }).on('error', () => undefined);
    let killed = false;
    try {
      await A.query('BEGIN');
      const pid = (await A.query(`SELECT pg_backend_pid() AS pid`)).rows[0].pid;
      await A.query(`SELECT fn_enter_group_actor_membership($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,NULL)`, [T1, g2.groupId, grace.actorId, grace.actorId, 'k-j5']);
      await pool.query(`SELECT pg_terminate_backend($1)`, [pid]);
      killed = true;
      await A.query('COMMIT');
    } catch { /* esperado */ } finally { A.release(true as unknown as Error); }
    const leaked = await q(`SELECT 1 FROM group_actor_memberships WHERE tenant_id=$1::uuid AND entry_idempotency_key='k-j5'`, [T1]);
    record('J5 falha DURANTE o COMMIT: zero estado parcial; chave não consumida', killed && leaked.length === 0);
  }

  // ══ I · NÃO-CONTAMINAÇÃO (Δ=0 nas casas alheias) ══
  {
    const after = await countsOf();
    record('I1 grants Δ=0 (membership não cria authority)', after.grants === before.grants);
    record('I2 actor_relationships Δ=0 (membership ≠ relação social)', after.rels === before.rels);
    record('I3 bindings Δ=+1 SÓ do setup explícito D9.1 (nenhuma inferência)', after.bindings === before.bindings + 1);
    record('I4 Δbank=0 (accounts/tx/ledger intocados)', after.bankAcc === before.bankAcc && after.bankTx === before.bankTx && after.bankLedger === before.bankLedger);
    record('I5 N1/categories Δ=0 (navegação nunca decide membership)', after.n1 === before.n1 && after.categories === before.categories);
    record('I6 group_members: apenas a linha do teste legado (+1) — sem migração/limpeza', after.legacyMembers === before.legacyMembers + 1);
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length === 0 ? '✅' : '❌'} E2E GROUP-ACTOR-MEMBERSHIP: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length) process.exit(1);
}

main()
  .then(() => pool.end())
  .catch((e) => { console.error('💥', e); pool.end().finally(() => process.exit(1)); });
