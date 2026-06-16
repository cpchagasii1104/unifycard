/**
 * E2E — F-VOTES-WRITES-EXPLICIT-FAIL-CLOSED-CONTAINMENT (DT-VOTES-ACTIVE-ACTOR-WIRING-MISSING).
 * NÃO MOVE DINHEIRO.
 *
 * READ-FIRST provou que o módulo dedicado `votes` está DUPLAMENTE MORTO:
 *   (1) os 4 writes derivam autoria de `req.activeActor`, que NENHUM hook popula no backend (→ 401 enganoso);
 *   (2) as tabelas `votes`/`vote_options`/`vote_responses` NÃO são criadas por nenhuma migration canônica
 *       (schema ghost) → qualquer acesso ao DB falha com "relation votes não existe".
 * Decisão IA Diretora: CONTER os writes fail-closed (501 nomeado VOTES_ACTIVE_ACTOR_WIRING_MISSING),
 * NÃO religar. Este e2e prova que cada write retorna **501 nomeado curto-circuitando ANTES do DB** —
 * justamente por isso NÃO emite o 500 "relation does not exist" que uma rota não-contida emitiria.
 * (Reads ficam FORA do escopo: continuam quebrados pelo schema ghost — pré-existente, não tocado.)
 *
 * 🔒 DB EFÊMERA (run-votes-writes-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import votesRoutes from '../modules/votes/votes.routes';
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
  if (!/votes|containment|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Votes Containment', slug: `votc-${Date.now()}` });

  // Confirma de 1ª mão o schema ghost: a tabela `votes` NÃO existe no schema canônico.
  const votesTableExists = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.votes') AS r`)).rows[0].r;
  record('S0 schema ghost confirmado: tabela `votes` NÃO existe (to_regclass=NULL)', votesTableExists === null,
    `to_regclass=${votesTableExists}`);

  const bankBefore = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);

  const app = Fastify();
  app.decorateRequest('user', null);
  app.decorateRequest('tenant', null);
  app.decorateRequest('actionContext', null);
  // Espelha a REALIDADE: nenhum hook popula req.activeActor; req.user/tenant presentes.
  app.addHook('onRequest', async (req: any) => {
    req.user = { id: randomUUID(), userId: randomUUID() };
    req.tenant = { id: TENANT };
    req.actionContext = { actorId: randomUUID() };
  });
  await app.register(votesRoutes);
  await app.ready();

  const post = (url: string, body: unknown = {}) =>
    app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(body) });
  const st = (r: any) => r.statusCode;
  const code = (r: any) => { try { return JSON.parse(r.body)?.code; } catch { return undefined; } };
  const VOTE_ID = randomUUID();

  try {
    // ───────────────────────── WRITES CONTIDOS (501 ANTES do DB) ─────────────────────────
    // Se a contenção NÃO existisse, a rota tentaria o votesService e emitiria 500 "relation votes não existe"
    // (schema ghost). O 501 nomeado prova o curto-circuito fail-closed antes de qualquer acesso ao DB.
    {
      const r = await post('/', { title: 'Nova', options: ['a', 'b'] });
      record('T1 POST /votes (create) → 501 VOTES_ACTIVE_ACTOR_WIRING_MISSING (curto-circuito antes do DB)',
        st(r) === 501 && code(r) === 'VOTES_ACTIVE_ACTOR_WIRING_MISSING', `status=${st(r)} code=${code(r)}`);
    }
    {
      const r = await post(`/${VOTE_ID}/publish`);
      record('T2 POST /:id/publish → 501 nomeado (sem tocar DB / votesService)',
        st(r) === 501 && code(r) === 'VOTES_ACTIVE_ACTOR_WIRING_MISSING', `status=${st(r)} code=${code(r)}`);
    }
    {
      const r = await post(`/${VOTE_ID}/vote`, { option_id: randomUUID() });
      record('T3 POST /:id/vote → 501 nomeado (zero voto; sem tocar DB)',
        st(r) === 501 && code(r) === 'VOTES_ACTIVE_ACTOR_WIRING_MISSING', `status=${st(r)} code=${code(r)}`);
    }
    {
      const r = await post(`/${VOTE_ID}/close`);
      record('T4 POST /:id/close → 501 nomeado (sem tocar DB)',
        st(r) === 501 && code(r) === 'VOTES_ACTIVE_ACTOR_WIRING_MISSING', `status=${st(r)} code=${code(r)}`);
    }

    // ───────────────────────── NÃO É 500 (prova do curto-circuito) ─────────────────────────
    {
      const r = await post('/', { title: 'x', options: ['a', 'b'] });
      record('T5 contenção NÃO emite 500 "relation does not exist" (prova fail-closed pré-DB)',
        st(r) !== 500, `status=${st(r)}`);
    }

    // ───────────────────────── BANK INTOCADO ─────────────────────────
    {
      const bankAfter = await count(`SELECT ((SELECT count(*) FROM bank_ledger)+(SELECT count(*) FROM bank_transactions))::int AS n`);
      record('T-bank Bank intocado (bank_ledger + bank_transactions inalterados)',
        bankAfter === bankBefore, `before=${bankBefore} after=${bankAfter}`);
    }

    // ───────────────────────── ESTRUTURAL ─────────────────────────
    {
      const src = readFileSync(join(process.cwd(), 'src/modules/votes/votes.routes.ts'), 'utf8');
      record('C1 contenção nomeada presente (VOTES_ACTIVE_ACTOR_WIRING_MISSING) + 4 writes 501',
        /VOTES_ACTIVE_ACTOR_WIRING_MISSING/.test(src)
        && (src.match(/reply\.status\(501\)\.send\(VOTES_WRITES_CONTAINED\)/g) || []).length >= 4);
      record('C2 ZERO chamada de write ao votesService (create/publish/vote/close contidos)',
        !/votesService\.createVote\(/.test(src)
        && !/votesService\.publishVote\(/.test(src)
        && !/votesService\.closeVote\(/.test(src)
        && !/votesService\.vote\(/.test(src));
      record('C3 ZERO actionContext.actorId (conflação removida; sem authority crua)',
        !/actionContext\.actorId/.test(src));
      record('C4 reads NÃO contidos/alterados (listVotes/getVote ainda referenciados — fora do escopo)',
        /votesService\.listVotes\(/.test(src) && /votesService\.getVote\(/.test(src));
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
    console.log('✨ votes writes contidos fail-closed (501 nomeado, curto-circuito pré-DB); módulo duplamente morto.');
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
