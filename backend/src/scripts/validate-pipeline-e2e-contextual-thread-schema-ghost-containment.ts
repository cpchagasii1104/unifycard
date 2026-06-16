/**
 * E2E — F-CONTEXTUAL-THREAD-SCHEMA-GHOST-FAIL-CLOSED-CONTAINMENT (DT-CONTEXTUAL-THREAD-SCHEMA-GHOST).
 * NÃO MOVE DINHEIRO.
 *
 * O módulo `contextual-messaging` está montado mas suas tabelas (`contextual_threads`/`contextual_messages`)
 * são SCHEMA GHOST (zero migration canônica). As 7 rotas (3 writes + 4 reads) batiam no repository → 42P01.
 * Decisão IA Diretora: CONTER fail-closed (501 nomeado CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED), NÃO religar,
 * incluindo READS. Este e2e prova: cada rota retorna 501 nomeado curto-circuitando ANTES do DB — por isso NÃO
 * emite o 500 "relation does not exist" que uma rota não-contida emitiria.
 *
 * 🔒 DB EFÊMERA (run-contextual-thread-schema-ghost-containment-ephemeral.ps1). NUNCA toca unificard_dev.
 */
import 'tsconfig-paths/register';
import Fastify from 'fastify';
import { pool } from '../core/database/pool';
import { tenantService } from '../core/tenants/tenant.service';
import contextualThreadRoutes from '../modules/contextual-messaging/contextual-thread.routes';
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
  if (!/contextual|thread|ghost|containment|ephemeral|test/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function main(): Promise<void> {
  await assertEphemeralDb();

  const TENANT = randomUUID();
  await tenantService.createTenant({ id: TENANT, name: 'Contextual Thread Containment', slug: `ctc-${Date.now()}` });

  // Confirma de 1ª mão o schema ghost: as tabelas NÃO existem no schema canônico.
  const tGhost = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.contextual_threads') AS r`)).rows[0].r;
  const mGhost = (await pool.query<{ r: string | null }>(`SELECT to_regclass('public.contextual_messages') AS r`)).rows[0].r;
  record('S0 schema ghost confirmado: contextual_threads NÃO existe (to_regclass=NULL)', tGhost === null, `to_regclass=${tGhost}`);
  record('S1 schema ghost confirmado: contextual_messages NÃO existe (to_regclass=NULL)', mGhost === null, `to_regclass=${mGhost}`);

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
  await app.register(contextualThreadRoutes);
  await app.ready();

  const post = (url: string, body: unknown = {}) =>
    app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(body) });
  const get = (url: string) => app.inject({ method: 'GET', url });
  const st = (r: any) => r.statusCode;
  const code = (r: any) => { try { return JSON.parse(r.body)?.code; } catch { return undefined; } };
  const CODE = 'CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED';
  const TID = randomUUID();

  // Cada rota: 501 + code nomeado + NÃO 500 (prova curto-circuito pré-DB; rota não-contida emitiria 42P01).
  const cases: Array<{ label: string; run: () => Promise<any> }> = [
    { label: 'POST /contextual-threads (createThread)', run: () => post('/contextual-threads', { contextType: 'x', contextId: TID, participantActorIds: [TID] }) },
    { label: 'POST /:id/participants (addParticipant)', run: () => post(`/contextual-threads/${TID}/participants`, { actorId: TID }) },
    { label: 'POST /:id/messages (sendMessage)', run: () => post(`/contextual-threads/${TID}/messages`, { content: 'oi' }) },
    { label: 'GET /contextual-threads (listThreads)', run: () => get('/contextual-threads') },
    { label: 'GET /:id (getThreadById)', run: () => get(`/contextual-threads/${TID}`) },
    { label: 'GET /context/:t/:id (getThreadByContext)', run: () => get(`/contextual-threads/context/event/${TID}`) },
    { label: 'GET /:id/messages (getMessages)', run: () => get(`/contextual-threads/${TID}/messages`) },
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

    // ───────────────────────── ESTRUTURAL ─────────────────────────
    {
      const raw = readFileSync(join(process.cwd(), 'src/modules/contextual-messaging/contextual-thread.routes.ts'), 'utf8');
      // Espelha o guard: tira comentários (a explicação do bug menciona os termos legados de propósito).
      const src = raw
        .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
        .replace(/\/\*[\s\S]*?\*\//g, '');
      record('C1 contenção nomeada presente (CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED) + handler 501',
        /CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED/.test(src)
        && /reply\.status\(501\)\.send\(CONTEXTUAL_THREAD_SCHEMA_GHOST_CONTAINED\)/.test(src));
      record('C2 7 rotas contidas (, contained))',
        (src.match(/,\s*contained\)/g) || []).length >= 7);
      record('C3 ZERO service call · ZERO actionContext.actorId · ZERO req.body · ZERO canRepresentActor (código, sem comentários)',
        !/contextualThreadService\./.test(src)
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
    console.log('✨ contextual-thread (7 rotas) contido fail-closed (501 nomeado, curto-circuito pré-DB); schema ghost.');
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
