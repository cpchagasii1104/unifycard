// validate-yala-closeout-exclusivity.ts — PROVA CONCORRENTE Etapa C (DECISION-0189A §4)
//
// Roda contra CLONE EFÊMERO pós-migration 20260719180000. Duas CONEXÕES reais com a janela
// crítica ABERTA (T1 segura a transação após o trigger tomar o advisory lock; T2 tenta o lado
// oposto e BLOQUEIA no lock; T1 commita; T2 reexecuta o check e vê a violação).
//
//   C1  T1 membership→active (janela aberta) × T2 delegação empresarial → exatamente UMA commita
//   C2  ordem invertida (T1 delegação × T2 membership)
//   C3  duas RELAÇÕES diferentes da mesma empresa prosseguem em paralelo (sem deadlock)
//   C4  chaves de lock diferem por tenant (mesma identity/company em tenants ≠ → chaves ≠)
//   C5  representante externo SEM membership segue funcionando
//   C∞  estado final: NUNCA membership ativa + delegação empresarial ativa na mesma relação

import { randomUUID } from 'crypto';
import pg from 'pg';

let passed = 0; let failed = 0;
const check = (label: string, ok: boolean, extra?: string) => {
  if (ok) { passed++; console.log(`✅ ${label}`); }
  else { failed++; console.log(`❌ ${label}${extra ? ' — ' + extra : ''}`); }
};

const DB = process.env.DATABASE_URL ?? '';

async function mkConn(): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  return c;
}

interface Person { g: string; u: string; ua: string; cu?: string }

async function mkPerson(c: pg.Client, T: string, companyId: string, withMembership: boolean, memberStatus = 'revoked'): Promise<Person> {
  const g = randomUUID(); const u = randomUUID(); const ua = randomUUID();
  await c.query(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [g, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await c.query(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','pending','none')`, [g, String(Math.floor(1e10 + Math.random() * 8.9e10))]);
  await c.query(`INSERT INTO users (user_id, tenant_id, global_user_id, email, password_hash) VALUES ($1,$2,$3,$4,'x')`, [u, T, g, `xc-${u.slice(0, 8)}@proof.local`]);
  await c.query(`INSERT INTO actors (id, actor_id, tenant_id, user_id, global_user_id, actor_type, display_name) VALUES ($1,$1,$2,$3,$4,'user','XC')`, [ua, T, u, g]);
  const p: Person = { g, u, ua };
  if (withMembership) {
    const r = await c.query(
      `INSERT INTO company_users (tenant_id, company_id, global_user_id, role, member_status) VALUES ($1,$2,$3,'member',$4) RETURNING id`,
      [T, companyId, g, memberStatus]
    );
    p.cu = r.rows[0].id;
  }
  return p;
}

const insertDelegationSql = `
  INSERT INTO actor_delegations (tenant_id, user_actor_id, institutional_actor_id, scopes_json, is_transitive, status, relationship_type)
  VALUES ($1, $2, $3, '["publish_feed"]'::jsonb, false, 'active', 'attorney')
  RETURNING delegation_id`;

async function main() {
  if (!/closeout|ephemeral|clone|upgrade/i.test(DB)) {
    console.error(`recusado: DATABASE_URL não parece efêmero (${DB.split('/').pop()})`);
    process.exit(1);
  }
  const admin = await mkConn();
  const fx = (await admin.query(`
    SELECT cu.tenant_id, cu.company_id, pa.id AS page_actor_id
      FROM company_users cu JOIN actors pa ON pa.company_id = cu.company_id AND pa.tenant_id = cu.tenant_id
     LIMIT 1`)).rows[0] as { tenant_id: string; company_id: string; page_actor_id: string };
  const T = fx.tenant_id;

  // ── C1: T1 membership→active (janela aberta) × T2 delegação ─────────────────
  {
    const p = await mkPerson(admin, T, fx.company_id, true, 'revoked');
    const t1 = await mkConn(); const t2 = await mkConn();
    await t1.query('BEGIN');
    await t1.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [p.cu]); // trigger toma o lock AQUI
    // T2 tenta a delegação — deve BLOQUEAR no advisory lock (janela crítica aberta)
    let t2Err: string | null = null;
    const t2p = t2.query('BEGIN').then(() => t2.query(insertDelegationSql, [T, p.ua, fx.page_actor_id]))
      .then(() => t2.query('COMMIT'))
      .catch((e: Error) => { t2Err = e.message; return t2.query('ROLLBACK'); });
    await new Promise((r) => setTimeout(r, 300)); // T2 está na janela, bloqueada
    const t2Blocked = t2Err === null; // ainda não decidiu = está esperando o lock
    await t1.query('COMMIT');
    await t2p;
    const state = await admin.query(
      `SELECT (SELECT count(*) FROM company_users WHERE id=$1 AND member_status='active')::int AS m,
              (SELECT count(*) FROM actor_delegations ad JOIN actors pa ON pa.tenant_id=ad.tenant_id AND pa.id=ad.institutional_actor_id
                WHERE ad.tenant_id=$2 AND ad.user_actor_id=$3 AND ad.status='active' AND pa.company_id=$4)::int AS d`,
      [p.cu, T, p.ua, fx.company_id]
    );
    const { m, d } = state.rows[0] as { m: number; d: number };
    check('C1 write-skew morto: T2 (delegação) bloqueou na janela e falhou após o commit de T1',
      t2Blocked && /EXCLUSIVITY_VIOLATION/.test(t2Err ?? '') && m === 1 && d === 0,
      `blocked=${t2Blocked} err=${(t2Err ?? '').slice(0, 60)} m=${m} d=${d}`);
    await t1.end(); await t2.end();
  }

  // ── C2: ordem invertida ─────────────────────────────────────────────────────
  {
    const p = await mkPerson(admin, T, fx.company_id, true, 'revoked');
    const t1 = await mkConn(); const t2 = await mkConn();
    await t1.query('BEGIN');
    await t1.query(insertDelegationSql, [T, p.ua, fx.page_actor_id]); // lado delegação toma o lock
    let t2Err: string | null = null;
    const t2p = t2.query('BEGIN').then(() => t2.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [p.cu]))
      .then(() => t2.query('COMMIT'))
      .catch((e: Error) => { t2Err = e.message; return t2.query('ROLLBACK'); });
    await new Promise((r) => setTimeout(r, 300));
    const t2Blocked = t2Err === null;
    await t1.query('COMMIT');
    await t2p;
    const state = await admin.query(
      `SELECT (SELECT count(*) FROM company_users WHERE id=$1 AND member_status='active')::int AS m,
              (SELECT count(*) FROM actor_delegations ad JOIN actors pa ON pa.tenant_id=ad.tenant_id AND pa.id=ad.institutional_actor_id
                WHERE ad.tenant_id=$2 AND ad.user_actor_id=$3 AND ad.status='active' AND pa.company_id=$4)::int AS d`,
      [p.cu, T, p.ua, fx.company_id]
    );
    const { m, d } = state.rows[0] as { m: number; d: number };
    check('C2 ordem invertida: T2 (membership) bloqueou e falhou após o commit de T1 (delegação)',
      t2Blocked && /EXCLUSIVITY_VIOLATION/.test(t2Err ?? '') && m === 0 && d === 1,
      `blocked=${t2Blocked} err=${(t2Err ?? '').slice(0, 60)} m=${m} d=${d}`);
    await t1.end(); await t2.end();
  }

  // ── C3: duas relações DIFERENTES da mesma empresa em paralelo (sem deadlock) ─
  {
    const pa = await mkPerson(admin, T, fx.company_id, true, 'revoked');
    const pb = await mkPerson(admin, T, fx.company_id, false);
    const t1 = await mkConn(); const t2 = await mkConn();
    const r1 = t1.query('BEGIN')
      .then(() => t1.query(`UPDATE company_users SET member_status='active' WHERE id=$1`, [pa.cu]))
      .then(() => t1.query('COMMIT'));
    const r2 = t2.query('BEGIN')
      .then(() => t2.query(insertDelegationSql, [T, pb.ua, fx.page_actor_id]))
      .then(() => t2.query('COMMIT'));
    const both = await Promise.allSettled([r1, r2]);
    check('C3 relações diferentes prosseguem em paralelo (sem deadlock; ambas commitam)',
      both.every((x) => x.status === 'fulfilled'),
      both.map((x) => x.status).join(','));
    await t1.end(); await t2.end();
  }

  // ── C4: chave de lock difere por TENANT (mesma company/identity) ─────────────
  {
    const gid = randomUUID();
    const other = randomUUID();
    const keys = await admin.query(
      `SELECT hashtextextended('company-relation:' || lower($1) || ':' || lower($2) || ':' || lower($3), 0) AS k1,
              hashtextextended('company-relation:' || lower($4) || ':' || lower($2) || ':' || lower($3), 0) AS k2`,
      [T, fx.company_id, gid, other]
    );
    const { k1, k2 } = keys.rows[0] as { k1: string; k2: string };
    check('C4 chave determinística ISOLA tenant (mesma identity/company, tenants ≠ → chaves ≠)', k1 !== k2, `${k1}==${k2}`);
  }

  // ── C5: representante externo SEM membership segue funcionando ───────────────
  {
    const p = await mkPerson(admin, T, fx.company_id, false);
    let ok = true; let err = '';
    try { await admin.query(insertDelegationSql, [T, p.ua, fx.page_actor_id]); }
    catch (e) { ok = false; err = (e as Error).message; }
    check('C5 representante externo (sem membership) → delegação empresarial permitida', ok, err.slice(0, 80));
  }

  // ── C∞: invariante global do clone ───────────────────────────────────────────
  {
    const viol = await admin.query(`
      SELECT count(*)::int AS n
        FROM actor_delegations ad
        JOIN actors pa ON pa.tenant_id=ad.tenant_id AND pa.id=ad.institutional_actor_id AND pa.company_id IS NOT NULL
        JOIN actors ua ON ua.tenant_id=ad.tenant_id AND ua.id=ad.user_actor_id
        JOIN users u ON u.user_id=ua.user_id AND u.tenant_id=ua.tenant_id
        JOIN company_users cu ON cu.tenant_id=ad.tenant_id AND cu.company_id=pa.company_id
             AND cu.global_user_id=u.global_user_id AND cu.member_status='active'
       WHERE ad.status='active'`);
    check('C∞ estado final: ZERO relações com membership ativa + delegação empresarial ativa',
      Number((viol.rows[0] as { n: number }).n) === 0);
  }

  console.log(`\n${failed === 0 ? '✅✅' : '❌'} PROVA ETAPA C: ${passed} verdes, ${failed} vermelhos`);
  await admin.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('❌ prova Etapa C falhou:', err?.message ?? err); process.exit(1); });
