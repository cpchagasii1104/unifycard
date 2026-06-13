/**
 * E2E — F-DISPUTE-MUTATION-ACTOR-BODY-AUTHORITY-CONTAINMENT (P1).
 *
 * Prova a CONTENÇÃO fail-closed das 3 rotas irmãs de mutação de disputa que liam actor.kind/
 * actorId do BODY sem binding server-side (6º canal, DECISION-0113). NÃO movem dinheiro
 * diretamente (P1), mas alteram estado sensível / habilitam reversal.
 *
 *   T1 — from-discrepancy com actor.kind='system' → 403 DISPUTE_MUTATION_HTTP_DISABLED.
 *   T2 — to-review com actor.kind='admin' → 403 DISPUTE_MUTATION_HTTP_DISABLED.
 *   T3 — resolve com actor.kind='support' → 403 DISPUTE_MUTATION_HTTP_DISABLED.
 *   T4 — IDs inexistentes: NÃO vira 404/estado do service (403 = service não chamado).
 *   T5 — zero linha/alteração em reconciliation_disputes / reconciliation_dispute_events.
 *   T6 — /reversal continua 403 DISPUTE_REVERSAL_HTTP_DISABLED (contenção P0 intacta).
 *   T7 — GET /disputes/:id/events não foi quebrado (responde sem 5xx do gate).
 *   + estrutural: handlers reduzidos ao gate, sem parseActor/service de mutação.
 *
 * 🔒 DB EFÊMERA (wrapper run-dispute-mutation-containment-ephemeral.ps1). Zero Bank; motor intacto.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';
dotenv.config({ path: join(process.cwd(), '.env') });

import Fastify, { FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
const JWT_SECRET = process.env.JWT_SECRET;
const REPO = join(process.cwd(), '..');
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (label: string, ok: boolean, reason?: string): void => {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
};

function genValidCpf(seed: number): string {
  const n: number[] = [];
  let s = seed;
  for (let i = 0; i < 9; i++) { n.push(s % 10); s = Math.floor(s / 10) + 7 * (i + 1); }
  const dv = (arr: number[]) => {
    let sum = 0; const len = arr.length + 1;
    for (let i = 0; i < arr.length; i++) sum += arr[i] * (len - i);
    const r = (sum * 10) % 11; return r === 10 ? 0 : r;
  };
  const d1 = dv(n); const d2 = dv([...n, d1]);
  return [...n, d1, d2].join('');
}

async function assertEphemeralDb(): Promise<void> {
  const r = await pool.query<{ db: string }>('SELECT current_database() AS db');
  const db = r.rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: banco-alvo é "unificard_dev".');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: banco "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/dispute|mutation|reconcil|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
  if (!JWT_SECRET) throw new Error('ABORT: JWT_SECRET ausente.');
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

async function buildApp(): Promise<FastifyInstance> {
  const { socialPortsRegistry } = await import('../core/social/ports-registry');
  const sa = await import('../modules/social/adapters');
  socialPortsRegistry.setActorRepository(sa.actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(sa.actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(sa.socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(sa.socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(sa.eventFeedHandlersAdapter);

  const app = Fastify({ logger: false });
  await app.register(sensible);
  const authPlugin = (await import('../core/auth/auth.plugin')).default;
  const { tenantPlugin } = await import('../plugins/tenant.plugin');
  const { actionContextPlugin } = await import('../plugins/action-context.plugin');
  const authModule = await import('../core/auth/auth.routes');
  const reconciliationDisputeRoutes = (await import('../modules/reconciliation/reconciliation-dispute.routes')).default;

  await app.register(async (publicScope) => {
    await publicScope.register(authModule.default, { prefix: '/auth' });
  });
  await app.register(async (protectedScope) => {
    await protectedScope.register(authPlugin);
    await protectedScope.register(tenantPlugin);
    await protectedScope.register(actionContextPlugin);
    await protectedScope.register(reconciliationDisputeRoutes, { prefix: '/reconciliation' });
  });
  await app.ready();
  return app;
}

const count = async (sql: string, p: unknown[] = []): Promise<number> =>
  Number((await pool.query<{ n: string }>(sql, p)).rows[0].n);

async function main(): Promise<void> {
  await assertEphemeralDb();
  delete process.env.PILOT_MODE;
  const app = await buildApp();
  const base = Math.floor(Math.random() * 90000000) + 10000000;

  // Usuário autenticado comum.
  const email = `e2e-dmut-${base}@e2e.local`;
  const rReg = await app.inject({
    method: 'POST', url: '/auth/register', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password: 'senha123', cpf: genValidCpf(base), fullName: 'Dispute Mut User' }),
  });
  const reg = rReg.statusCode === 201 ? JSON.parse(rReg.body) : null;
  const token = reg?.data?.tokens?.accessToken as string | undefined;
  record('setup usuário autenticado (201 + token)', rReg.statusCode === 201 && !!token, `status=${rReg.statusCode}`);
  const jwtPayload = (() => { try { return JSON.parse(Buffer.from((token as string).split('.')[1], 'base64').toString('utf8')); } catch { return null; } })();
  const tenantId = jwtPayload?.tenantId;
  const userId = jwtPayload?.userId;
  const actorRow = await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id=$1 AND actor_type='user' LIMIT 1`, [userId]);
  const actionContext = JSON.stringify({ actorId: actorRow.rows[0]?.id, intent: 'dispute_mut_e2e', source: 'e2e', scope: `tenant:${tenantId}` });
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-action-context': actionContext };

  // Tabelas de estado de disputa (existência tolerante — efêmera FULL).
  const disputesTable = (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name='reconciliation_disputes'`)) === 1;
  const eventsTable = (await count(`SELECT count(*)::text n FROM information_schema.tables WHERE table_name='reconciliation_dispute_events'`)) === 1;
  const dispBefore = disputesTable ? await count(`SELECT count(*)::text n FROM reconciliation_disputes`) : 0;
  const evtBefore = eventsTable ? await count(`SELECT count(*)::text n FROM reconciliation_dispute_events`) : 0;

  try {
    const fakeId = randomUUID();
    const post = (url: string, kind: string, extra: Record<string, unknown> = {}) => app.inject({
      method: 'POST', url, headers: auth,
      payload: JSON.stringify({ actor: { kind, actor_id: randomUUID() }, reason: 'e2e', ...extra }),
    });

    // T1/T2/T3 — as 3 mutações com system/admin/support → 403 DISPUTE_MUTATION_HTTP_DISABLED.
    const r1 = await post('/reconciliation/disputes/from-discrepancy', 'system', { ledger_discrepancy_id: fakeId });
    const b1 = JSON.parse(r1.body);
    record('T1 from-discrepancy actor.kind=system → 403 DISPUTE_MUTATION_HTTP_DISABLED',
      r1.statusCode === 403 && b1.code === 'DISPUTE_MUTATION_HTTP_DISABLED' && /disabled until authority binding/i.test(b1.message || ''),
      `status=${r1.statusCode} body=${r1.body.slice(0, 120)}`);

    const r2 = await post(`/reconciliation/disputes/${fakeId}/to-review`, 'admin');
    record('T2 to-review actor.kind=admin → 403 DISPUTE_MUTATION_HTTP_DISABLED',
      r2.statusCode === 403 && JSON.parse(r2.body).code === 'DISPUTE_MUTATION_HTTP_DISABLED', `status=${r2.statusCode}`);

    const r3 = await post(`/reconciliation/disputes/${fakeId}/resolve`, 'support');
    record('T3 resolve actor.kind=support → 403 DISPUTE_MUTATION_HTTP_DISABLED',
      r3.statusCode === 403 && JSON.parse(r3.body).code === 'DISPUTE_MUTATION_HTTP_DISABLED', `status=${r3.statusCode}`);

    // T4 — IDs inexistentes não viram 404 DISPUTE_NOT_FOUND/LEDGER_*_NOT_FOUND (service não chamado).
    record('T4 service NÃO chamado: id inexistente não vira 404 (gate curto-circuita antes do service)',
      r1.statusCode === 403 && r2.statusCode === 403 && r3.statusCode === 403 &&
      b1.code !== 'LEDGER_DISCREPANCY_NOT_FOUND' && JSON.parse(r2.body).code !== 'DISPUTE_NOT_FOUND' && JSON.parse(r3.body).code !== 'DISPUTE_NOT_FOUND');

    // T5 — zero alteração de estado de disputa.
    const dispAfter = disputesTable ? await count(`SELECT count(*)::text n FROM reconciliation_disputes`) : 0;
    const evtAfter = eventsTable ? await count(`SELECT count(*)::text n FROM reconciliation_dispute_events`) : 0;
    record('T5 zero nova linha em reconciliation_disputes / reconciliation_dispute_events',
      dispAfter === dispBefore && evtAfter === evtBefore, `disp ${dispBefore}->${dispAfter} evt ${evtBefore}->${evtAfter}`);

    // T6 — /reversal continua contido com seu código próprio.
    const rRev = await post(`/reconciliation/disputes/${fakeId}/reversal`, 'system');
    record('T6 /reversal continua 403 DISPUTE_REVERSAL_HTTP_DISABLED (contenção P0 intacta)',
      rRev.statusCode === 403 && JSON.parse(rRev.body).code === 'DISPUTE_REVERSAL_HTTP_DISABLED', `status=${rRev.statusCode} code=${JSON.parse(rRev.body).code}`);

    // T7 — GET /events não foi quebrado pela contenção (sem 5xx do gate; 200/404/4xx de leitura ok).
    const rEvents = await app.inject({ method: 'GET', url: `/reconciliation/disputes/${fakeId}/events`, headers: auth });
    record('T7 GET /disputes/:id/events não foi quebrado pela contenção (não retorna o gate de mutação)',
      rEvents.statusCode !== 403 || !/DISPUTE_MUTATION_HTTP_DISABLED/.test(rEvents.body), `status=${rEvents.statusCode}`);

    // Estrutural: handlers reduzidos ao gate; sem parseActor/service de mutação no arquivo.
    const routes = readFileSync(join(REPO, 'backend/src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf8');
    const codeOnly = routes.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    record('S1 handlers de mutação reduzidos ao gate: sem parseActor e sem service de mutação no código',
      !/parseActor\(/.test(codeOnly) &&
      !/createDisputeFromDiscrepancy\(|moveDisputeToUnderReview\(|resolveDispute\(/.test(codeOnly) &&
      (routes.match(/DISPUTE_MUTATION_HTTP_DISABLED/g) || []).length >= 3);
    record('S2 GET /events preservado (listDisputeAuditEvents ainda chamado); /reversal contido em separado',
      /listDisputeAuditEvents\(/.test(codeOnly) && /DISPUTE_REVERSAL_HTTP_DISABLED/.test(routes));
    record('S3 reversal.service não tocado por esta rota: requestAndExecuteReversalSync intacto no service',
      readFileSync(join(REPO, 'backend/src/modules/reversal/reversal.service.ts'), 'utf8').includes('requestAndExecuteReversalSync'));
  } finally {
    await app.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Mutações HTTP de disputa contidas fail-closed; motor/reversal intactos — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
