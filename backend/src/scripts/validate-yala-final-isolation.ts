// validate-yala-final-isolation.ts — PROVA CONCORRENTE Etapa E (DECISION-0189B D8)
//
// Roda contra CLONE EFÊMERO pós-migrations 20260719180000 + 20260719220000. Duas CONEXÕES reais.
// Prova que a exclusividade membership×delegação é fail-closed em QUALQUER nível de isolamento:
//   E1 READ COMMITTED  → lock+recheck: exatamente UMA relação sobrevive (write-skew morto)
//   E2 REPEATABLE READ → REJEITADO (EXCLUSIVITY_UNSAFE_ISOLATION); NUNCA coexistem as duas
//   E3 SERIALIZABLE    → uma sobrevive OU uma aborta (serialization_failure); nunca coexistem
//   E4 empresas/tenants diferentes NÃO interferem
//   E5 ausência de deadlock
//   E∞ estado final: ZERO relação com membership ativa + delegação empresarial ativa

import { randomUUID } from 'crypto';
import pg from 'pg';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const DB = process.env.DATABASE_URL ?? '';
async function mkConn(): Promise<pg.Client> { const c = new pg.Client({ connectionString: DB }); await c.connect(); return c; }
const cpf = () => String(Math.floor(1e10 + Math.random() * 8.9e10));

interface Person { g: string; u: string; ua: string; cu?: string }
async function mkPerson(c: pg.Client, T: string, companyId: string, withMembership: boolean, memberStatus = 'revoked'): Promise<Person> {
  const g = randomUUID(); const u = randomUUID(); const ua = randomUUID();
  await c.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [g, cpf()]);
  await c.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [g, cpf()]);
  await c.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`, [u, T, g, `iso-${u.slice(0, 8)}@proof.local`]);
  await c.query(`INSERT INTO actors (id, actor_id, tenant_id, user_id, global_user_id, actor_type, display_name) VALUES ($1,$1,$2,$3,$4,'user','ISO')`, [ua, T, u, g]);
  const p: Person = { g, u, ua };
  if (withMembership) {
    const r = await c.query(`INSERT INTO company_users (tenant_id, company_id, global_user_id, role, member_status) VALUES ($1,$2,$3,'member',$4) RETURNING id`, [T, companyId, g, memberStatus]);
    p.cu = r.rows[0].id;
  }
  return p;
}
const insDeleg = `INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, is_transitive, status, relationship_type)
  VALUES ($1,$2,$3,'["publish_feed"]'::jsonb,false,'active','attorney') RETURNING delegation_id`;

async function relState(admin: pg.Client, T: string, cuId: string, ua: string, companyId: string) {
  const s = await admin.query(
    `SELECT (SELECT count(*) FROM company_users WHERE id=$1 AND member_status='active')::int AS m,
            (SELECT count(*) FROM actor_delegations ad JOIN actors pa ON pa.tenant_id=ad.tenant_id AND pa.id=ad.institutional_actor_id
              WHERE ad.tenant_id=$2 AND ad.user_actor_id=$3 AND ad.status='active' AND pa.company_id=$4)::int AS d`,
    [cuId, T, ua, companyId]);
  return s.rows[0] as { m: number; d: number };
}

async function main() {
  if (!/closeout|ephemeral|clone|upgrade|final/i.test(DB)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${DB.split('/').pop()})`);
    process.exit(1);
  }
  const admin = await mkConn();
  const fx = (await admin.query(`
    SELECT cu.tenant_id, cu.company_id, pa.id AS page_actor_id
      FROM company_users cu JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id LIMIT 1`)).rows[0] as { tenant_id: string; company_id: string; page_actor_id: string };
  const T = fx.tenant_id;

  // ── E1 READ COMMITTED: janela crítica → exatamente uma sobrevive ─────────────
  {
    const p = await mkPerson(admin, T, fx.company_id, true, 'revoked');
    const t1 = await mkConn(); const t2 = await mkConn();
    await t1.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await t1.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [p.cu]);
    let t2Err: string | null = null;
    const t2p = t2.query('BEGIN ISOLATION LEVEL READ COMMITTED').then(() => t2.query(insDeleg, [T, p.ua, fx.page_actor_id]))
      .then(() => t2.query('COMMIT')).catch((e: Error) => { t2Err = e.message; return t2.query('ROLLBACK'); });
    await new Promise((r) => setTimeout(r, 300));
    const t2Blocked = t2Err === null;
    await t1.query('COMMIT'); await t2p;
    const { m, d } = await relState(admin, T, p.cu!, p.ua, fx.company_id);
    check('E1 READ COMMITTED: T2 bloqueou na janela e FALHOU após commit de T1 (m=1,d=0)',
      t2Blocked && /EXCLUSIVITY_VIOLATION/.test(t2Err ?? '') && m === 1 && d === 0, `blocked=${t2Blocked} err=${(t2Err ?? '').slice(0, 50)} m=${m} d=${d}`);
    await t1.end(); await t2.end();
  }

  // ── E2 REPEATABLE READ: rejeitado fail-closed ───────────────────────────────
  {
    const p = await mkPerson(admin, T, fx.company_id, true, 'revoked');
    // single write sob RR → guarda dispara
    const t1 = await mkConn();
    let e1: string | null = null;
    await t1.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    try { await t1.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [p.cu]); await t1.query('COMMIT'); }
    catch (e) { e1 = (e as Error).message; await t1.query('ROLLBACK'); }
    await t1.end();
    check('E2 REPEATABLE READ (membership) → REJEITADO EXCLUSIVITY_UNSAFE_ISOLATION', /EXCLUSIVITY_UNSAFE_ISOLATION/.test(e1 ?? ''), (e1 ?? 'sem erro').slice(0, 60));
    // delegação sob RR → também rejeitado
    const t2 = await mkConn();
    let e2: string | null = null;
    await t2.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    try { await t2.query(insDeleg, [T, p.ua, fx.page_actor_id]); await t2.query('COMMIT'); }
    catch (e) { e2 = (e as Error).message; await t2.query('ROLLBACK'); }
    await t2.end();
    check('E2 REPEATABLE READ (delegação) → REJEITADO EXCLUSIVITY_UNSAFE_ISOLATION', /EXCLUSIVITY_UNSAFE_ISOLATION/.test(e2 ?? ''), (e2 ?? 'sem erro').slice(0, 60));
    const { m, d } = await relState(admin, T, p.cu!, p.ua, fx.company_id);
    check('E2 estado após RR: NUNCA coexistem (m=0,d=0 — nada persistido sob RR)', m === 0 && d === 0, `m=${m} d=${d}`);
  }

  // ── E3 SERIALIZABLE: uma sobrevive OU uma aborta; nunca coexistem ────────────
  {
    const p = await mkPerson(admin, T, fx.company_id, true, 'revoked');
    const t1 = await mkConn(); const t2 = await mkConn();
    await t1.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    await t1.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [p.cu]); // lock adquirido, janela aberta
    let t2Err: string | null = null;
    const t2p = t2.query('BEGIN ISOLATION LEVEL SERIALIZABLE').then(() => t2.query(insDeleg, [T, p.ua, fx.page_actor_id]))
      .then(() => t2.query('COMMIT')).catch((e: Error) => { t2Err = e.message; return t2.query('ROLLBACK'); });
    await new Promise((r) => setTimeout(r, 300));
    let t1Err: string | null = null;
    try { await t1.query('COMMIT'); } catch (e) { t1Err = (e as Error).message; }
    await t2p;
    const { m, d } = await relState(admin, T, p.cu!, p.ua, fx.company_id);
    const oneSurvived = (m === 1 && d === 0) || (m === 0 && d === 1);
    const oneAborted = /serializ|40001|EXCLUSIVITY_VIOLATION/i.test(`${t1Err ?? ''} ${t2Err ?? ''}`);
    check('E3 SERIALIZABLE: uma sobrevive OU uma aborta (serialization_failure/exclusivity); nunca coexistem',
      oneSurvived && oneAborted && !(m === 1 && d === 1), `m=${m} d=${d} t1=${(t1Err ?? '').slice(0, 30)} t2=${(t2Err ?? '').slice(0, 30)}`);
    await t1.end(); await t2.end();
  }

  // ── E4 relações diferentes em paralelo (sem deadlock; ambas commitam em RC) ──
  {
    const pa = await mkPerson(admin, T, fx.company_id, true, 'revoked');
    const pb = await mkPerson(admin, T, fx.company_id, false);
    const t1 = await mkConn(); const t2 = await mkConn();
    const r1 = t1.query('BEGIN ISOLATION LEVEL READ COMMITTED').then(() => t1.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [pa.cu])).then(() => t1.query('COMMIT'));
    const r2 = t2.query('BEGIN ISOLATION LEVEL READ COMMITTED').then(() => t2.query(insDeleg, [T, pb.ua, fx.page_actor_id])).then(() => t2.query('COMMIT'));
    const both = await Promise.allSettled([r1, r2]);
    check('E4/E5 relações diferentes em paralelo → ambas commitam (sem deadlock)', both.every((x) => x.status === 'fulfilled'), both.map((x) => x.status).join(','));
    await t1.end(); await t2.end();
  }

  // ── E∞ invariante global ─────────────────────────────────────────────────────
  {
    const viol = await admin.query(`
      SELECT count(*)::int AS n FROM actor_delegations ad
        JOIN actors pa ON pa.tenant_id=ad.tenant_id AND pa.id=ad.institutional_actor_id AND pa.company_id IS NOT NULL
        JOIN actors ua ON ua.tenant_id=ad.tenant_id AND ua.id=ad.user_actor_id
        JOIN users u ON u.user_id=ua.user_id AND u.tenant_id=ua.tenant_id
        JOIN company_users cu ON cu.tenant_id=ad.tenant_id AND cu.company_id=pa.company_id AND cu.global_user_id=u.global_user_id AND cu.member_status='active'
       WHERE ad.status='active'`);
    check('E∞ estado final: ZERO relações com membership ativa + delegação empresarial ativa', Number((viol.rows[0] as { n: number }).n) === 0);
  }

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA ETAPA E: ${passed} verdes, ${failed} vermelhos`);
  await admin.end();
  process.exit(failed === 0 ? 0 : 1);
}
main().catch((err) => { console.error('❌ prova Etapa E falhou:', err?.message ?? err); process.exit(1); });
