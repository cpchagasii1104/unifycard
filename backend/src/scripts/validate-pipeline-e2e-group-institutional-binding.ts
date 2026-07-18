/**
 * E2E — D9.1 · GROUP INSTITUTIONAL BINDING (DECISION-0186 + DECISION-0187). Substrato INTERNO e DORMENTE.
 * NÃO MOVE DINHEIRO (Δbank=0 provado por contagem antes/depois). NÃO cria membership/grant/endereço/
 * audience (não-herança provada por contagem). Prova, contra o SCHEMA REAL do banco efêmero:
 *   A criação (page-parent, group-raiz, idempotência, mismatch, cross-tenant, tipos proibidos,
 *     autoridade DUAL real via service — owner path);
 *   B cardinalidade (1 parent ativo; históricos plurais; N groups por instituição; concorrência
 *     com um único vencedor; mesma chave → um único efeito);
 *   C raiz/interno/anti-ciclo (self-link, parent interno, filho-com-filhos, cadeia, ciclo);
 *   D retirada (terminal, replay, mismatch, reativação/DELETE/UPDATE-destrutivo bloqueados no BANCO);
 *   E reparent (retire+nova linha atômico; fault-injection com ROLLBACK total; chave não consumida);
 *   F RLS FORCE + fronteira de escrita (app sem DML; EXECUTE governado; search_path pinado);
 *   G não-herança (contagens de membership/grants/bank/addresses inalteradas).
 *
 * 🔒 DB EFÊMERA (run-group-institutional-binding-ephemeral.ps1). NUNCA toca unificard_dev.
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
  try {
    await fn();
    record(label, false, `esperava falha ${code}, mas passou`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    record(label, msg.includes(code), `esperava ${code}; obteve: ${msg.slice(0, 140)}`);
  }
}

async function assertEphemeralDb(): Promise<void> {
  const db = (await one<{ db: string }>('SELECT current_database() AS db')).db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/binding|gib|ephemeral|e2e|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkTenant(name: string): Promise<string> {
  seq += 1;
  const id = randomUUID();
  await pool.query(`INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ($1,$2,$3,NOW(),NOW())`, [id, name, `${name}-${seq}-${id.slice(0, 8)}`]);
  return id;
}
async function mkUserActor(tenantId: string, name: string): Promise<{ userId: string; actorId: string; globalUserId: string }> {
  seq += 1;
  const gu = randomUUID(); const userId = randomUUID();
  const tax = String(Date.now() + seq).padStart(11, '0').slice(-11);
  await pool.query(`INSERT INTO global_users (global_user_id, cpf, metadata, created_at, updated_at) VALUES ($1::uuid,$2,'{}'::jsonb,NOW(),NOW())`, [gu, tax]);
  await pool.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1::uuid,$2,'cpf','approved','basic')`, [gu, tax]);
  await pool.query(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, token_version, is_test, global_user_id, created_at, updated_at) VALUES ($1::uuid,$1::uuid,$2::uuid,$3,'x',0,true,$4::uuid,NOW(),NOW())`, [userId, tenantId, `${name}-${seq}@gib-e2e.test`, gu]);
  const actorId = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1::uuid,'user',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`, [tenantId, name, userId, gu])).id;
  return { userId, actorId, globalUserId: gu };
}
/** Group completo (momento 2): groups + group-actor + link 1:1. Direto por SQL (script E2E; §4.8.6). */
async function mkGroup(tenantId: string, ownerActorId: string, name: string, withActor = true): Promise<{ groupId: string; groupActorId: string | null }> {
  seq += 1;
  const groupId = (await one<{ id: string }>(
    `INSERT INTO groups (tenant_id, name, slug, owner_actor_id, status, metadata) VALUES ($1::uuid,$2,$3,$4::uuid,'active','{}'::jsonb) RETURNING id::text AS id`,
    [tenantId, name, `${name}-${seq}`.toLowerCase(), ownerActorId]
  )).id;
  if (!withActor) return { groupId, groupActorId: null };
  const groupActorId = (await one<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, group_id, responsible_actor_id) VALUES ($1::uuid,'group',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, `${name}-actor`, groupId, ownerActorId]
  )).id;
  await pool.query(`UPDATE groups SET actor_id = $1::uuid WHERE id = $2::uuid`, [groupActorId, groupId]);
  return { groupId, groupActorId };
}
async function mkPageActor(tenantId: string, responsibleActorId: string, name: string): Promise<string> {
  seq += 1;
  const companyId = randomUUID();
  await pool.query(
    `INSERT INTO companies (company_id, tenant_id, company_name, status, company_status, created_at, updated_at) VALUES ($1::uuid,$2::uuid,$3,'active','DRAFT',NOW(),NOW())`,
    [companyId, tenantId, name]
  );
  return (await one<{ id: string }>(
    `INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page',$2,$3::uuid,$4::uuid) RETURNING id::text AS id`,
    [tenantId, name, companyId, responsibleActorId]
  )).id;
}

const bind = (t: string, g: string, i: string, a: string, k: string) =>
  one<{ id: string }>(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)::text AS id`, [t, g, i, a, k]);
const retire = (t: string, b: string, a: string, k: string) =>
  one<{ id: string }>(`SELECT fn_retire_group_institutional_binding($1::uuid,$2::uuid,$3::uuid,$4)::text AS id`, [t, b, a, k]);
const reparent = (t: string, g: string, i: string, a: string, k: string) =>
  one<{ id: string }>(`SELECT fn_reparent_group_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)::text AS id`, [t, g, i, a, k]);

async function main(): Promise<void> {
  await assertEphemeralDb();

  // DI: injeção dos social ports (script standalone não passa pelo boot do app) — mesma wiring de app.builder.
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const { actorRepositoryAdapter } = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);

  // baseline de NÃO-HERANÇA (G) — contagens antes de TUDO
  const countsOf = async () => ({
    members: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM group_members`)).n),
    grants: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM actor_capability_grants`)).n),
    rels: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM actor_relationships`)).n),
    bankAcc: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_accounts`)).n),
    bankTx: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_transactions`)).n),
    bankLedger: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM bank_ledger`)).n),
    addrAssign: Number((await one<{ n: string }>(`SELECT count(*) AS n FROM address_assignments`)).n),
  });
  const before = await countsOf();

  // ── SETUP ──
  const T1 = await mkTenant('gib-t1');
  const T2 = await mkTenant('gib-t2');
  const owner = await mkUserActor(T1, 'owner-all');       // dono da instituição E dos groups (dual OK)
  const outsider = await mkUserActor(T1, 'outsider');     // nao representa nada
  const ownerT2 = await mkUserActor(T2, 'owner-t2');

  const page = await mkPageActor(T1, owner.actorId, 'condominio-page');
  const root = await mkGroup(T1, owner.actorId, 'igreja-raiz');          // instituição informal raiz
  const child1 = await mkGroup(T1, owner.actorId, 'conselho');
  const child2 = await mkGroup(T1, owner.actorId, 'torre-a');
  const child3 = await mkGroup(T1, owner.actorId, 'ministerio-musica');
  const noActor = await mkGroup(T1, owner.actorId, 'sem-actor', false);  // momento 1
  const groupT2 = await mkGroup(T2, ownerT2.actorId, 'grupo-t2');

  // ══ A · CRIAÇÃO ══
  const b1 = await bind(T1, child1.groupId, page, owner.actorId, 'k-a1');
  record('A1 bind page-parent válido cria vínculo ativo', !!b1.id);
  const b2 = await bind(T1, child2.groupId, root.groupActorId as string, owner.actorId, 'k-a2');
  record('A2 bind group-raiz válido cria vínculo ativo', !!b2.id);
  const b1r = await bind(T1, child1.groupId, page, owner.actorId, 'k-a1');
  record('A3 replay exato retorna o MESMO id (idempotência)', b1r.id === b1.id);
  await expectFail('A4 mesma chave com payload divergente falha', () => bind(T1, child3.groupId, page, owner.actorId, 'k-a1'), 'GIB_IDEMPOTENCY_MISMATCH');
  await expectFail('A5 instituição de OUTRO tenant falha (não-vazante)', () => bind(T1, child3.groupId, groupT2.groupActorId as string, owner.actorId, 'k-a5'), 'ACTOR_TENANT_MISMATCH');
  await expectFail('A6 group inexistente falha', () => bind(T1, randomUUID(), page, owner.actorId, 'k-a6'), 'GIB_GROUP_NOT_FOUND');
  await expectFail('A7 parent inexistente falha', () => bind(T1, child3.groupId, randomUUID(), owner.actorId, 'k-a7'), 'ACTOR_TENANT_MISMATCH');
  await expectFail('A8 group sem group-actor falha', () => bind(T1, noActor.groupId, page, owner.actorId, 'k-a8'), 'GIB_GROUP_ACTOR_MISSING');
  await expectFail('A9 parent user-actor falha (tipo proibido)', () => bind(T1, child3.groupId, owner.actorId, owner.actorId, 'k-a9'), 'GIB_INSTITUTION_TYPE_INVALID');
  {
    const sys = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name) VALUES ($1::uuid,'system','sys-e2e') RETURNING id::text AS id`, [T1])).id;
    await expectFail('A10 parent system-actor falha (tipo proibido)', () => bind(T1, child3.groupId, sys, owner.actorId, 'k-a10'), 'GIB_INSTITUTION_TYPE_INVALID');
  }
  // A11/A12 — AUTORIDADE DUAL REAL via service (owner path do canRepresentActor)
  {
    const { groupInstitutionalBindingService } = await import('../modules/groups/group-institutional-binding.service');
    const svcBinding = await groupInstitutionalBindingService.bindGroupToInstitution({
      tenantId: T1, actingUserId: owner.userId, groupId: child3.groupId,
      institutionActorId: root.groupActorId as string, idempotencyKey: 'k-a11-svc',
    });
    record('A11 service com autoridade DUAL real (owner dos dois lados) vincula', svcBinding.status === 'active');
    await expectFail('A12 service nega quem não representa a INSTITUIÇÃO', () =>
      groupInstitutionalBindingService.bindGroupToInstitution({
        tenantId: T1, actingUserId: outsider.userId, groupId: child3.groupId,
        institutionActorId: page, idempotencyKey: 'k-a12-svc',
      }), 'GIB_INSTITUTION_NOT_REPRESENTED');
    // retire p/ liberar child3 aos testes seguintes
    await groupInstitutionalBindingService.retireBinding({
      tenantId: T1, actingUserId: owner.userId, bindingId: svcBinding.id, idempotencyKey: 'k-a11-svc-ret',
    });
  }

  // ══ B · CARDINALIDADE ══
  await expectFail('B1 segundo parent ativo para o mesmo group falha', () => bind(T1, child1.groupId, root.groupActorId as string, owner.actorId, 'k-b1'), 'GIB_ACTIVE_BINDING_EXISTS');
  {
    await retire(T1, b1.id, owner.actorId, 'k-b2-ret');
    const b3 = await bind(T1, child1.groupId, root.groupActorId as string, owner.actorId, 'k-b2-new');
    record('B2 retire libera novo vínculo; históricos coexistem', !!b3.id);
    const hist = await q<{ status: string }>(`SELECT status FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND group_id=$2::uuid ORDER BY created_at`, [T1, child1.groupId]);
    record('B3 história plural preservada (1 retired + 1 active)', hist.length === 2 && hist.filter(h => h.status === 'retired').length === 1 && hist.filter(h => h.status === 'active').length === 1);
  }
  {
    const kids = await q<{ group_id: string }>(`SELECT group_id::text AS group_id FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND institution_actor_id=$2::uuid AND status='active'`, [T1, root.groupActorId]);
    record('B4 mesma instituição com MÚLTIPLOS groups ativos', kids.length >= 2);
  }
  {
    // B5 concorrência: dois binds simultâneos (chaves diferentes) → exatamente UM vencedor
    const g = await mkGroup(T1, owner.actorId, 'concorrencia');
    const c1 = await pool.connect(); const c2 = await pool.connect();
    const run = (c: typeof c1, k: string) => c.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)::text AS id`, [T1, g.groupId, page, owner.actorId, k]);
    const [r1, r2] = await Promise.allSettled([run(c1, 'k-b5-a'), run(c2, 'k-b5-b')]);
    c1.release(); c2.release();
    const okCount = [r1, r2].filter(r => r.status === 'fulfilled').length;
    const loser = [r1, r2].find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
    const active = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND status='active'`, [T1, g.groupId]);
    record('B5 concorrência (chaves distintas): 1 vencedor, 1 falha canônica, 1 ativo', okCount === 1 && active.length === 1 && !!loser && String(loser.reason).includes('GIB_ACTIVE_BINDING_EXISTS'));
    // B6 concorrência com a MESMA chave → um único efeito (mesmo id nos dois lados)
    const g2 = await mkGroup(T1, owner.actorId, 'mesma-chave');
    const d1 = await pool.connect(); const d2 = await pool.connect();
    const run2 = (c: typeof d1) => c.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)::text AS id`, [T1, g2.groupId, page, owner.actorId, 'k-b6']);
    const [s1, s2] = await Promise.allSettled([run2(d1), run2(d2)]);
    d1.release(); d2.release();
    const ids = [s1, s2]
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<{ rows: { id: string }[] }>).value.rows[0].id);
    const rows = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND group_id=$2::uuid`, [T1, g2.groupId]);
    record('B6 concorrência (mesma chave): efeito único, ids idênticos, 1 linha', rows.length === 1 && ids.length === 2 && ids[0] === ids[1]);
  }

  // ══ C · RAIZ / INTERNO / ANTI-CICLO ══
  await expectFail('C1 self-link falha', () => bind(T1, root.groupId, root.groupActorId as string, owner.actorId, 'k-c1'), 'GIB_SELF_LINK');
  await expectFail('C2 group INTERNO como parent falha (cadeia bloqueada)', () => bind(T1, child3.groupId, child1.groupActorId as string, owner.actorId, 'k-c2'), 'GIB_PARENT_IS_INTERNAL');
  await expectFail('C3 group com FILHOS recebendo parent falha', () => bind(T1, root.groupId, page, owner.actorId, 'k-c3'), 'GIB_GROUP_HAS_CHILDREN');
  await expectFail('C4 ciclo A→B→A impossível (B interno não vira parent)', () => bind(T1, root.groupId, child2.groupActorId as string, owner.actorId, 'k-c4'), 'GIB_PARENT_IS_INTERNAL');
  {
    const orphanGa = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, responsible_actor_id) VALUES ($1::uuid,'group','ga-orfao',$2::uuid) RETURNING id::text AS id`, [T1, owner.actorId])).id;
    await expectFail('C5 group-actor institucional sem group_id coerente falha', () => bind(T1, child3.groupId, orphanGa, owner.actorId, 'k-c5'), 'GIB_INSTITUTION_GROUP_INCOHERENT');
  }

  // ══ D · RETIRADA (terminalidade FÍSICA) ══
  const dGroup = await mkGroup(T1, owner.actorId, 'retirada');
  const dB = await bind(T1, dGroup.groupId, page, owner.actorId, 'k-d0');
  const dRet = await retire(T1, dB.id, owner.actorId, 'k-d1');
  record('D1 retirada válida', dRet.id === dB.id);
  const dRep = await retire(T1, dB.id, owner.actorId, 'k-d1');
  record('D2 replay da retirada retorna o mesmo id', dRep.id === dB.id);
  await expectFail('D3 retirada de vínculo já retired com OUTRA chave falha', () => retire(T1, dB.id, owner.actorId, 'k-d3'), 'GIB_ALREADY_RETIRED');
  {
    const other = await bind(T1, dGroup.groupId, page, owner.actorId, 'k-d4-new');
    await expectFail('D4 chave de retirada reutilizada em OUTRO vínculo falha', () => retire(T1, other.id, owner.actorId, 'k-d1'), 'GIB_IDEMPOTENCY_MISMATCH');
    await expectFail('D5 reativação (UPDATE retired→active) bloqueada NO BANCO', async () => pool.query(`UPDATE group_institutional_bindings SET status='active', retired_at=NULL, retired_by_actor_id=NULL, retire_idempotency_key=NULL WHERE id=$1::uuid`, [dB.id]), 'GIB_IMMUTABLE_RETIRED');
    await expectFail('D6 DELETE bloqueado NO BANCO (append-only)', async () => pool.query(`DELETE FROM group_institutional_bindings WHERE id=$1::uuid`, [dB.id]), 'GIB_DELETE_FORBIDDEN');
    await expectFail('D7 UPDATE destrutivo de parent bloqueado NO BANCO', async () => pool.query(`UPDATE group_institutional_bindings SET institution_actor_id=$1::uuid WHERE id=$2::uuid`, [root.groupActorId, other.id]), 'GIB_IMMUTABLE_FIELD');
    await retire(T1, other.id, owner.actorId, 'k-d4-ret');
  }

  // ══ E · REPARENT ══
  const eGroup = await mkGroup(T1, owner.actorId, 'reparent');
  const e0 = await bind(T1, eGroup.groupId, page, owner.actorId, 'k-e0');
  {
    // E4 fault-injection ANTES do reparent real: fn dentro de transação externa + ROLLBACK
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT fn_reparent_group_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)`, [T1, eGroup.groupId, root.groupActorId, owner.actorId, 'k-e4']);
      await c.query('ROLLBACK');
    } finally { c.release(); }
    const still = await one<{ status: string; institution_actor_id: string }>(`SELECT status, institution_actor_id::text FROM group_institutional_bindings WHERE id=$1::uuid`, [e0.id]);
    const phantom = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND create_idempotency_key=$2`, [T1, 'k-e4']);
    record('E4 fault-injection (rollback pós-retire+bind): vínculo antigo INTACTO, zero resíduo, chave NÃO consumida', still.status === 'active' && still.institution_actor_id === page && phantom.length === 0);
  }
  const e1 = await reparent(T1, eGroup.groupId, root.groupActorId as string, owner.actorId, 'k-e1');
  {
    const hist = await q<{ status: string; institution_actor_id: string }>(`SELECT status, institution_actor_id::text FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND group_id=$2::uuid ORDER BY created_at`, [T1, eGroup.groupId]);
    record('E1 reparent = retire + NOVA linha (histórico integral; 1 ativo)', hist.length === 2 && hist[0].status === 'retired' && hist[1].status === 'active' && hist[1].institution_actor_id === root.groupActorId);
  }
  const e1r = await reparent(T1, eGroup.groupId, root.groupActorId as string, owner.actorId, 'k-e1');
  record('E2 replay do reparent retorna o mesmo novo id', e1r.id === e1.id);
  await expectFail('E3 reparent para o MESMO parent falha', () => reparent(T1, eGroup.groupId, root.groupActorId as string, owner.actorId, 'k-e3'), 'GIB_REPARENT_SAME_PARENT');
  {
    // E5 fault-injection no BIND: rollback externo não consome a chave
    const g = await mkGroup(T1, owner.actorId, 'bind-rollback');
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      await c.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)`, [T1, g.groupId, page, owner.actorId, 'k-e5']);
      await c.query('ROLLBACK');
    } finally { c.release(); }
    const after = await bind(T1, g.groupId, page, owner.actorId, 'k-e5');
    record('E5 rollback externo do bind: zero linha; MESMA chave funciona depois', !!after.id);
  }

  // ══ F · RLS + PRIVILÉGIOS ══
  {
    const c = await pool.connect();
    try {
      await c.query(`SET ROLE unificard_app`);
      await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [T2]);
      const crossRows = (await c.query(`SELECT count(*)::int AS n FROM group_institutional_bindings`)).rows[0].n;
      record('F1 RLS FORCE: app no tenant T2 NÃO enxerga vínculos de T1', crossRows === 0);
      await c.query(`SELECT set_config('app.current_tenant', $1, false)`, [T1]);
      const sameRows = (await c.query(`SELECT count(*)::int AS n FROM group_institutional_bindings`)).rows[0].n;
      record('F2 RLS: app no tenant T1 enxerga os vínculos de T1', sameRows > 0);
      const dmlProbe = async (sql: string) => { try { await c.query(sql); return 'PASSOU'; } catch (e) { return e instanceof Error ? e.message : String(e); } };
      const ins = await dmlProbe(`INSERT INTO group_institutional_bindings (tenant_id, group_id, institution_actor_id, create_idempotency_key, create_fingerprint, created_by_actor_id) VALUES ('${T1}','${child1.groupId}','${page}','k-hack','fp','${owner.actorId}')`);
      record('F3 app SEM INSERT direto (fronteira de escrita)', /permission denied|permissão negada/i.test(ins), ins.slice(0, 100));
      const upd = await dmlProbe(`UPDATE group_institutional_bindings SET status='retired' WHERE tenant_id='${T1}'`);
      record('F4 app SEM UPDATE direto', /permission denied|permissão negada/i.test(upd), upd.slice(0, 100));
      const del = await dmlProbe(`DELETE FROM group_institutional_bindings WHERE tenant_id='${T1}'`);
      record('F5 app SEM DELETE', /permission denied|permissão negada/i.test(del), del.slice(0, 100));
      // writer autorizado FUNCIONA como app (EXECUTE governado)
      const g = await mkGroupAsSuper(T1, owner.actorId);
      const viaApp = (await c.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)::text AS id`, [T1, g, page, owner.actorId, 'k-f6'])).rows[0].id;
      record('F6 app COM EXECUTE na fn canônica (writer governado funciona)', !!viaApp);
    } finally {
      await c.query(`RESET ROLE`).catch(() => undefined);
      c.release();
    }
    const pubExec = (await one<{ ok: boolean }>(`SELECT has_function_privilege('pg_read_all_data', 'fn_bind_group_to_institution(uuid,uuid,uuid,uuid,text)', 'EXECUTE') AS ok`)).ok;
    record('F7 PUBLIC/role não-granted SEM EXECUTE nas fns', pubExec === false);
    const cfg = (await one<{ c: string[] | null }>(`SELECT proconfig AS c FROM pg_proc WHERE proname='fn_bind_group_to_institution'`)).c || [];
    record('F8 search_path pinado (pg_catalog, pg_temp)', cfg.some(x => x.startsWith('search_path=') && x.includes('pg_catalog')));
  }

  // ══ G · NÃO-HERANÇA (Δ=0 em todas as casas alheias) ══
  {
    const after = await countsOf();
    record('G1 group_members inalterado (vínculo ≠ membership)', after.members === before.members);
    record('G2 actor_capability_grants inalterado (vínculo ≠ authority)', after.grants === before.grants);
    record('G3 actor_relationships inalterado (vínculo ≠ relação social)', after.rels === before.rels);
    record('G4 Δbank=0 (accounts/tx/ledger intocados)', after.bankAcc === before.bankAcc && after.bankTx === before.bankTx && after.bankLedger === before.bankLedger);
    record('G5 address_assignments inalterado (vínculo ≠ endereço)', after.addrAssign === before.addrAssign);
    const anchors = await one<{ owner_t: string; resp_t: string }>(
      `SELECT o.actor_type AS owner_t, r.actor_type AS resp_t
         FROM groups g JOIN actors o ON o.id=g.owner_actor_id JOIN actors ga ON ga.id=g.actor_id JOIN actors r ON r.id=ga.responsible_actor_id
        WHERE g.id=$1::uuid`, [child1.groupId]);
    record('G6 âncoras civis intactas (owner e responsible humanos)', anchors.owner_t === 'user' && anchors.resp_t === 'user');
  }

  // ══ H · FRONTEIRA TRANSACIONAL + REVOGAÇÃO CONCORRENTE (remediação Veredito B) ══
  {
    const { authorizationService } = await import('../core/authorization/authorization.service');
    const { groupInstitutionalBindingService } = await import('../modules/groups/group-institutional-binding.service');

    // H0 — caminho POOL (3 args, sem client) permanece vivo para callers antigos (prova 15 do envelope)
    const poolPath = await authorizationService.canRepresentActor(T1, owner.userId, root.groupActorId as string);
    record('H0 canRepresentActor SEM client (callers antigos) segue funcionando (pool path)', poolPath === true);

    // Setup de AUTHORITY REVOGÁVEL REAL: mgr é owner do group filho (lado group) e gestor da
    // company do page-parent VIA company_users (lado instituição — evidência revogável is_active).
    const mgr = await mkUserActor(T1, 'mgr-revocavel');
    const hGroup = await mkGroup(T1, mgr.actorId, 'h-child');
    const companyId = randomUUID();
    await pool.query(`INSERT INTO companies (company_id, tenant_id, company_name, status, company_status, created_at, updated_at) VALUES ($1::uuid,$2::uuid,'h-cond','active','DRAFT',NOW(),NOW())`, [companyId, T1]);
    const hPage = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page','h-cond-page',$2::uuid,$3::uuid) RETURNING id::text AS id`, [T1, companyId, owner.actorId])).id;
    const cu = await one<{ id: string }>(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true) RETURNING id::text AS id`, [T1, companyId, mgr.globalUserId]);
    const revoke = (client?: { query: (s: string, p?: unknown[]) => Promise<unknown> }) =>
      (client ?? pool).query(`UPDATE company_users SET is_active = false, updated_at = NOW() WHERE id = '${cu.id}'::uuid`);
    const regrant = () => pool.query(`UPDATE company_users SET is_active = true, updated_at = NOW() WHERE id = $1::uuid`, [cu.id]);
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // T1 — D9.1 adquire a proteção PRIMEIRO: revogação concorrente BLOQUEIA até o COMMIT
    {
      const A = await pool.connect();
      await A.query('BEGIN');
      await A.query(`SELECT set_config('app.current_tenant', $1, true)`, [T1]);
      await A.query(`SELECT pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || $1::text, 0))`, [T1]);
      const okInst = await authorizationService.canRepresentActor(T1, mgr.userId, hPage, A);
      const okGrp = await authorizationService.canRepresentActor(T1, mgr.userId, hGroup.groupActorId as string, A);
      // revogador em paralelo — deve FICAR BLOQUEADO pela evidência FOR SHARE de A
      let revokeSettled = false;
      const B = pool.connect().then(async (c) => {
        try { await revoke(c); } finally { revokeSettled = true; c.release(); }
      });
      await sleep(500);
      const blockedWhileAHeld = revokeSettled === false;
      await A.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)`, [T1, hGroup.groupId, hPage, mgr.actorId, 'k-t1']);
      await A.query('COMMIT');
      A.release();
      await B; // revogação só completa DEPOIS do commit de A
      const t1Bound = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND status='active'`, [T1, hGroup.groupId]);
      const t1Revoked = await one<{ a: boolean }>(`SELECT is_active AS a FROM company_users WHERE id=$1::uuid`, [cu.id]);
      record('T1 proteção primeiro: authority provada, revogador BLOQUEADO até o COMMIT, binding criado, revogação serializa DEPOIS',
        okInst && okGrp && blockedWhileAHeld && revokeSettled && t1Bound.length === 1 && t1Revoked.a === false);
      // limpeza p/ próximos T: retire + re-grant
      await retire(T1, (await one<{ id: string }>(`SELECT id::text FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND status='active'`, [T1, hGroup.groupId])).id, mgr.actorId, 'k-t1-ret');
      await regrant();
    }

    // T2 — revogação VENCE primeiro: service revalida na transação e falha; zero binding; chave NÃO consumida
    {
      await revoke();
      await expectFail('T2 revogação venceu antes: bind via service falha fail-closed', () =>
        groupInstitutionalBindingService.bindGroupToInstitution({
          tenantId: T1, actingUserId: mgr.userId, groupId: hGroup.groupId,
          institutionActorId: hPage, idempotencyKey: 'k-t2',
        }), 'GIB_INSTITUTION_NOT_REPRESENTED');
      const noRow = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND create_idempotency_key='k-t2'`, [T1]);
      record('T2 zero binding e chave NÃO consumida', noRow.length === 0);
      await regrant();
      const reuse = await groupInstitutionalBindingService.bindGroupToInstitution({
        tenantId: T1, actingUserId: mgr.userId, groupId: hGroup.groupId,
        institutionActorId: hPage, idempotencyKey: 'k-t2',
      });
      record('T2b após re-grant a MESMA chave funciona (não foi consumida na falha)', reuse.status === 'active');
      await groupInstitutionalBindingService.retireBinding({ tenantId: T1, actingUserId: mgr.userId, bindingId: reuse.id, idempotencyKey: 'k-t2-ret' });
    }

    // T3 — revogação DURANTE o bind (revogador chega primeiro mas NÃO commitou): o service espera e lê o estado FINAL
    {
      const B = await pool.connect();
      await B.query('BEGIN');
      await revoke(B); // row lock exclusivo; ainda não commitado
      let svcSettled = false;
      const A = groupInstitutionalBindingService.bindGroupToInstitution({
        tenantId: T1, actingUserId: mgr.userId, groupId: hGroup.groupId,
        institutionActorId: hPage, idempotencyKey: 'k-t3',
      }).then(() => ({ ok: true as const })).catch((e: Error) => ({ ok: false as const, msg: e.message })).finally(() => { svcSettled = true; });
      await sleep(500);
      const blockedOnRevoker = svcSettled === false; // FOR SHARE do service espera o revogador
      await B.query('COMMIT');
      B.release();
      const aOut = await A;
      const t3Rows = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND create_idempotency_key='k-t3'`, [T1]);
      record('T3 revogação durante o bind: NUNCA commit com authority obsoleta (service esperou, leu revogado, falhou; zero binding)',
        blockedOnRevoker && aOut.ok === false && /GIB_INSTITUTION_NOT_REPRESENTED/.test(aOut.msg ?? '') && t3Rows.length === 0);
      await regrant();
    }

    // T4 — revogação durante o RETIRE: mesmo requisito
    {
      const b = await groupInstitutionalBindingService.bindGroupToInstitution({
        tenantId: T1, actingUserId: mgr.userId, groupId: hGroup.groupId,
        institutionActorId: hPage, idempotencyKey: 'k-t4-setup',
      });
      const B = await pool.connect();
      await B.query('BEGIN');
      await revoke(B);
      let settled = false;
      const A = groupInstitutionalBindingService.retireBinding({
        tenantId: T1, actingUserId: mgr.userId, bindingId: b.id, idempotencyKey: 'k-t4',
      }).then(() => ({ ok: true as const })).catch((e: Error) => ({ ok: false as const, msg: e.message })).finally(() => { settled = true; });
      await sleep(500);
      const blocked = settled === false;
      await B.query('COMMIT');
      B.release();
      const out = await A;
      const still = await one<{ status: string }>(`SELECT status FROM group_institutional_bindings WHERE id=$1::uuid`, [b.id]);
      record('T4 revogação durante o retire: retire falha fail-closed; vínculo permanece ATIVO',
        blocked && out.ok === false && /GIB_INSTITUTION_NOT_REPRESENTED/.test(out.msg ?? '') && still.status === 'active');
      await regrant();
      await groupInstitutionalBindingService.retireBinding({ tenantId: T1, actingUserId: mgr.userId, bindingId: b.id, idempotencyKey: 'k-t4-ret' });
    }

    // T5 — revogação do TERCEIRO lado durante o REPARENT: rollback integral
    {
      // grupo vinculado ao root (grupo-raiz do mgr? root pertence a owner) — usar hPage como atual e page2 como novo
      const company2 = randomUUID();
      await pool.query(`INSERT INTO companies (company_id, tenant_id, company_name, status, company_status, created_at, updated_at) VALUES ($1::uuid,$2::uuid,'h-cond2','active','DRAFT',NOW(),NOW())`, [company2, T1]);
      const hPage2 = (await one<{ id: string }>(`INSERT INTO actors (tenant_id, actor_type, display_name, company_id, responsible_actor_id) VALUES ($1::uuid,'page','h-cond2-page',$2::uuid,$3::uuid) RETURNING id::text AS id`, [T1, company2, owner.actorId])).id;
      const cu2 = await one<{ id: string }>(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, can_manage_company) VALUES ($1::uuid,$2::uuid,$3::uuid,'owner',true) RETURNING id::text AS id`, [T1, company2, mgr.globalUserId]);
      const cur = await groupInstitutionalBindingService.bindGroupToInstitution({
        tenantId: T1, actingUserId: mgr.userId, groupId: hGroup.groupId,
        institutionActorId: hPage, idempotencyKey: 'k-t5-setup',
      });
      const B = await pool.connect();
      await B.query('BEGIN');
      await B.query(`UPDATE company_users SET is_active=false WHERE id=$1::uuid`, [cu2.id]); // revoga o NOVO lado, uncommitted
      let settled = false;
      const A = groupInstitutionalBindingService.reparentGroupInstitution({
        tenantId: T1, actingUserId: mgr.userId, groupId: hGroup.groupId,
        newInstitutionActorId: hPage2, idempotencyKey: 'k-t5',
      }).then(() => ({ ok: true as const })).catch((e: Error) => ({ ok: false as const, msg: e.message })).finally(() => { settled = true; });
      await sleep(500);
      const blocked = settled === false;
      await B.query('COMMIT');
      B.release();
      const out = await A;
      const hist = await q<{ status: string; institution_actor_id: string }>(`SELECT status, institution_actor_id::text FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND group_id=$2::uuid AND create_idempotency_key IN ('k-t5-setup','k-t5') ORDER BY created_at`, [T1, hGroup.groupId]);
      const oldStillActive = hist.some(h => h.status === 'active' && h.institution_actor_id === hPage);
      const noNew = !hist.some(h => h.institution_actor_id === hPage2);
      record('T5 revogação do 3º lado durante reparent: ROLLBACK integral (vínculo anterior ativo; zero novo; zero parent duplo)',
        blocked && out.ok === false && /GIB_INSTITUTION_NOT_REPRESENTED/.test(out.msg ?? '') && oldStillActive && noNew);
      await groupInstitutionalBindingService.retireBinding({ tenantId: T1, actingUserId: mgr.userId, bindingId: cur.id, idempotencyKey: 'k-t5-ret' });
    }

    // ══ I · FAULT INJECTIONS TRANSACIONAIS (sequência real do mecanismo em cada ponto) ══
    {
      const points = ['after-begin', 'after-principal', 'after-auth-1', 'after-auth-2', 'after-auth-3', 'after-protection', 'before-fn', 'after-fn', 'before-commit'] as const;
      let allClean = true;
      for (const p of points) {
        const A = await pool.connect();
        try {
          await A.query('BEGIN');
          if (p === 'after-begin') throw new Error('INJ');
          await A.query(`SELECT set_config('app.current_tenant', $1, true)`, [T1]);
          await A.query(`SELECT pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || $1::text, 0))`, [T1]);
          if (p === 'after-protection') throw new Error('INJ');
          const { ensureUserActorTx } = await import('../modules/identity/actor-writer.service');
          await ensureUserActorTx(A, T1, mgr.userId);
          if (p === 'after-principal') throw new Error('INJ');
          const a1 = await authorizationService.canRepresentActor(T1, mgr.userId, hPage, A);
          if (p === 'after-auth-1') throw new Error('INJ');
          const a2 = await authorizationService.canRepresentActor(T1, mgr.userId, hGroup.groupActorId as string, A);
          if (p === 'after-auth-2') throw new Error('INJ');
          const a3 = await authorizationService.canRepresentActor(T1, mgr.userId, hPage, A);
          if (p === 'after-auth-3') throw new Error('INJ');
          if (!a1 || !a2 || !a3) throw new Error('AUTH_UNEXPECTED_FALSE');
          if (p === 'before-fn') throw new Error('INJ');
          await A.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)`, [T1, hGroup.groupId, hPage, mgr.actorId, `k-inj-${p}`]);
          if (p === 'after-fn') throw new Error('INJ');
          if (p === 'before-commit') throw new Error('INJ');
          await A.query('COMMIT');
        } catch {
          await A.query('ROLLBACK').catch(() => undefined);
        } finally {
          A.release();
        }
        const leaked = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND create_idempotency_key=$2`, [T1, `k-inj-${p}`]);
        if (leaked.length !== 0) { allClean = false; record(`I fault ${p}: resíduo detectado`, false); }
      }
      record('I fault injections (9 pontos da sequência transacional): zero binding parcial, zero chave consumida, rollback íntegro', allClean);
      // I2 — "durante COMMIT": backend terminado entre fn e COMMIT → sem estado parcial
      {
        const A = await pool.connect();
        // o backend será terminado: engolir o evento 'error' assíncrono do client (esperado)
        (A as unknown as { on: (ev: string, fn: () => void) => void }).on('error', () => undefined);
        let killed = false;
        try {
          await A.query('BEGIN');
          await A.query(`SELECT set_config('app.current_tenant', $1, true)`, [T1]);
          await A.query(`SELECT pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || $1::text, 0))`, [T1]);
          const pidRow = await A.query(`SELECT pg_backend_pid() AS pid`);
          await A.query(`SELECT fn_bind_group_to_institution($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5)`, [T1, hGroup.groupId, hPage, mgr.actorId, 'k-inj-commit']);
          await pool.query(`SELECT pg_terminate_backend($1)`, [pidRow.rows[0].pid]);
          killed = true;
          await A.query('COMMIT');
        } catch { /* esperado: conexão terminada antes/no COMMIT */ } finally {
          // client com backend terminado: release DESTRUTIVO (não devolve conexão morta ao pool)
          A.release(true as unknown as Error);
        }
        const leaked = await q(`SELECT 1 FROM group_institutional_bindings WHERE tenant_id=$1::uuid AND create_idempotency_key='k-inj-commit'`, [T1]);
        record('I2 falha DURANTE o COMMIT (backend terminado): zero estado parcial, chave não consumida', killed && leaked.length === 0);
      }
    }
  }

  // ── veredito ──
  const failed = results.filter(r => !r.ok);
  console.log(`\n${failed.length === 0 ? '✅' : '❌'} E2E GROUP-INSTITUTIONAL-BINDING: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length) process.exit(1);
}

async function mkGroupAsSuper(tenantId: string, ownerActorId: string): Promise<string> {
  // helper fora do SET ROLE (usa pool superuser) para o F6
  const g = await mkGroup(tenantId, ownerActorId, `f6-${Date.now()}`);
  return g.groupId;
}

main()
  .then(() => pool.end())
  .catch((e) => { console.error('💥', e); pool.end().finally(() => process.exit(1)); });
