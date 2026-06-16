/**
 * E2E — F-ORGANIZATION-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-ORGANIZATION-SCHEMA-GHOST).
 * NÃO MOVE DINHEIRO.
 *
 * O módulo `organization` está montado mas suas tabelas (organization_invites/members/units/roles) são
 * SCHEMA GHOST (zero migration canônica; organization_members é tombstone). As 13 rotas (5 writes + 8 reads)
 * batiam no service/repository → 42P01. Decisão IA Diretora: CONTER fail-closed (501 nomeado
 * ORGANIZATION_SCHEMA_GHOST_CONTAINED, blanket), NÃO religar / NÃO ressuscitar a tombstone. Este e2e prova:
 * cada rota retorna 501 nomeado curto-circuitando ANTES do DB — por isso NÃO emite o 500 "relation does not
 * exist" que uma rota não-contida emitiria.
 *
 * 🔒 DB EFÊMERA (run-organization-schema-ghost-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import organizationRoutes from '../modules/organization/organization.routes';
import { readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};
const count = async (sql: string, p: unknown[] = []): Promise<number> => Number((await pool.query(sql, p)).rows[0].n);

async function assertEphemeralDb(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/organization|ghost|containment|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Organization Containment', slug: `orgc-${Date.now()}` });

  // Confirma de 1ª mão o schema ghost: as 4 tabelas NÃO existem no schema canônico.
  const ghost = async (t: string) => (await pool.query<{ r: string | null }>(`SELECT to_regclass($1) AS r`, [`public.${t}`])).rows[0].r;
  for (const t of ['organization_members', 'organization_units', 'organization_roles', 'organization_invites']) {
    const r = await ghost(t);
    record(`S schema ghost confirmado: ${t} NÃO existe (to_regclass=NULL)`, r === null, `to_regclass=${r}`);
  }

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: randomUUID(), userId: randomUUID() };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: randomUUID() };
  });
  await app.register(organizationRoutes);
  await app.ready();

  const post = (url: string, body: unknown = {}) =>
    app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(body) });
  const get = (url: string) => app.inject({ method: 'GET', url });
  const st = (r: any) => r.statusCode;
  const code = (r: any) => { try { return JSON.parse(r.body)?.code; } catch { return undefined; } };
  const CODE = 'ORGANIZATION_SCHEMA_GHOST_CONTAINED';
  const ID = randomUUID();

  // As 13 rotas: 501 + code + NÃO 500 (curto-circuito pré-DB; rota não-contida emitiria 42P01).
  const cases: Array<{ label: string; run: () => Promise<any> }> = [
    { label: 'POST /invites (inviteUser)', run: () => post('/invites', { email: 'x@y.z', actorId: ID }) },
    { label: 'POST /invites/:id/accept (acceptInvite)', run: () => post(`/invites/${ID}/accept`, { token: 't', actorId: ID }) },
    { label: 'POST /invites/:id/revoke (revokeInvite)', run: () => post(`/invites/${ID}/revoke`) },
    { label: 'GET /invites (listInvites)', run: () => get('/invites') },
    { label: 'GET /members (listMembers)', run: () => get('/members') },
    { label: 'POST /members/:id/role (changeRole)', run: () => post(`/members/${ID}/role`, { roleKey: 'admin' }) },
    { label: 'POST /members/:id/remove (removeMember)', run: () => post(`/members/${ID}/remove`) },
    { label: 'GET /units (listUnits)', run: () => get('/units') },
    { label: 'GET /units/tree (getUnitTree)', run: () => get('/units/tree') },
    { label: 'GET /units/:id (getUnitById)', run: () => get(`/units/${ID}`) },
    { label: 'GET /units/:id/children (getChildren)', run: () => get(`/units/${ID}/children`) },
    { label: 'GET /units/:id/descendants (getDescendants)', run: () => get(`/units/${ID}/descendants`) },
    { label: 'GET /units/actor/:actorId (getUnitByActor)', run: () => get(`/units/actor/${ID}`) },
  ];

  try {
    let i = 0;
    for (const c of cases) {
      i += 1;
      const r = await c.run();
      record(`T${i} ${c.label} → 501 ${CODE} + NÃO 500 (curto-circuito pré-DB)`,
        st(r) === 501 && code(r) === CODE && st(r) !== 500, `status=${st(r)} code=${code(r)}`);
    }

    // ───────────────────────── BANK INTOCADO ─────────────────────────
    {
      const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
      record('T-bank Bank intocado (bank_ledger + bank_transactions inalterados)',
        bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
    }

    // ───────────────────────── TOMBSTONE NÃO RESSUSCITADA ─────────────────────────
    {
      const stillGhost = (await ghost('organization_members')) === null;
      record('T-tombstone organization_members continua AUSENTE (não ressuscitada pela frente)', stillGhost);
    }

    // ───────────────────────── ESTRUTURAL ─────────────────────────
    {
      const raw = readFileSync(join(process.cwd(), 'src/modules/organization/organization.routes.ts'), 'utf8');
      const src = raw
        .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      record('C1 contenção nomeada presente (ORGANIZATION_SCHEMA_GHOST_CONTAINED) + handler 501',
        /ORGANIZATION_SCHEMA_GHOST_CONTAINED/.test(src)
        && /reply\.status\(501\)\.send\(ORGANIZATION_SCHEMA_GHOST_CONTAINED\)/.test(src));
      record('C2 13 rotas contidas (, contained))',
        (src.match(/,\s*contained\)/g) || []).length >= 13);
      record('C3 ZERO service/repository · ZERO actionContext.actorId · ZERO req.body · ZERO canRepresentActor (código)',
        !/organization\w*Service\./.test(src)
        && !/Repository\./.test(src)
        && !/actionContext\.actorId/.test(src)
        && !/req\.body/.test(src)
        && !/canRepresentActor/.test(src));
    }

    const failed = results.filter((r) => !r.ok);
    console.log(`\n${'═'.repeat(64)}`);
    console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
    if (failed.length > 0) {
      console.log('FALHAS:');
      failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
      await app.close();
      await pool.end();
      process.exit(1);
    }
    await app.close();
    await pool.end();
    console.log('✨ organization (13 rotas) contido fail-closed (501 nomeado, curto-circuito pré-DB); schema ghost; tombstone intacta.');
  } catch (e) {
    console.error('💥 Erro no corpo do teste:', e);
    try { await app.close(); } catch { /* noop */ }
    try { await pool.end(); } catch { /* noop */ }
    process.exit(1);
  }
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
