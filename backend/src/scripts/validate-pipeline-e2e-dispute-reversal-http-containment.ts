/**
 * E2E — F-DISPUTE-REVERSAL-HTTP-AUTHORITY-CONTAINMENT (P0 financeiro).
 *
 * Prova a CONTENÇÃO fail-closed da rota HTTP que disparava reversal financeiro real lendo
 * actor.kind/actorId do BODY (DECISION-0113: actorId do cliente é hint, nunca autoridade;
 * `system`/external_reversal não é ação humana via HTTP — DECISION-0052 / CORE_ESTORNOS).
 *
 *   T1 — usuário autenticado chama POST /reconciliation/disputes/:id/reversal com
 *        actor.kind='system' no body → 403 DISPUTE_REVERSAL_HTTP_DISABLED.
 *   T2 — o serviço executeDisputeFinancialReversal NÃO é chamado pela rota bloqueada
 *        (id inexistente NÃO retorna 404 DISPUTE_NOT_FOUND — o gate curto-circuita antes).
 *   T3 — zero nova linha em reversals/bank_transactions/bank_ledger.
 *   T4 — admin/support no body também são bloqueados (não há atalho por kind).
 *   + estrutural: gate fail-closed precede parseActor/executeDisputeFinancialReversal.
 *
 * 🔒 DB EFÊMERA (wrapper run-dispute-reversal-containment-ephemeral.ps1). Motor financeiro
 * intacto; zero escrita Bank.
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';
import jwt from 'jsonwebtoken';
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
  if (!/dispute|reversal|reconcil|test|ephemeral/i.test(db)) throw new Error(`ABORT: nome "${db}" não parece efêmero.`);
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

  // PUBLIC scope (sem auth hook) — /auth/*.
  await app.register(async (publicScope) => {
    await publicScope.register(authModule.default, { prefix: '/auth' });
  });
  // PROTECTED scope (authPlugin + tenant + actionContext) — /reconciliation/*.
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

  // Cadastro de um usuário autenticado comum.
  const email = `e2e-rev-${base}@e2e.local`;
  const rReg = await app.inject({
    method: 'POST', url: '/auth/register', headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password: 'senha123', cpf: genValidCpf(base), fullName: 'Rev Containment User' }),
  });
  const reg = rReg.statusCode === 201 ? JSON.parse(rReg.body) : null;
  const token = reg?.data?.tokens?.accessToken as string | undefined;
  record('setup usuário autenticado (201 + token)', rReg.statusCode === 201 && !!token, `status=${rReg.statusCode}`);

  const jwtPayload = (() => {
    try { return JSON.parse(Buffer.from((token as string).split('.')[1], 'base64').toString('utf8')); } catch { return null; }
  })();
  const tenantId = jwtPayload?.tenantId;
  const userId = jwtPayload?.userId;
  const actorRow = await pool.query<{ id: string }>(`SELECT id::text FROM actors WHERE user_id=$1 AND actor_type='user' LIMIT 1`, [userId]);
  const actorId = actorRow.rows[0]?.id;
  const actionContext = JSON.stringify({ actorId, intent: 'dispute_reversal_e2e', source: 'e2e', scope: `tenant:${tenantId}` });
  const auth = { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-action-context': actionContext };

  const bankBefore = await count(
    `SELECT ((SELECT count(*) FROM reversals)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::text n`);

  try {
    const disputeId = randomUUID(); // inexistente de propósito (prova de curto-circuito).
    const callReversal = (kind: string) => app.inject({
      method: 'POST', url: `/reconciliation/disputes/${disputeId}/reversal`, headers: auth,
      payload: JSON.stringify({ actor: { kind, actor_id: randomUUID() }, reason: 'e2e containment' }),
    });

    // T1 — actor.kind='system' no body → 403 DISPUTE_REVERSAL_HTTP_DISABLED.
    const rSystem = await callReversal('system');
    const bSystem = JSON.parse(rSystem.body);
    record('T1 reversal com actor.kind=system no body → 403 DISPUTE_REVERSAL_HTTP_DISABLED',
      rSystem.statusCode === 403 && bSystem.code === 'DISPUTE_REVERSAL_HTTP_DISABLED' &&
      /disabled until authority binding/i.test(bSystem.message || ''), `status=${rSystem.statusCode} body=${rSystem.body.slice(0, 120)}`);

    // T2 — o serviço NÃO foi chamado: id inexistente NÃO retornou 404 DISPUTE_NOT_FOUND.
    record('T2 service NÃO chamado: id inexistente não vira 404 DISPUTE_NOT_FOUND (gate curto-circuita antes)',
      rSystem.statusCode === 403 && bSystem.code !== 'DISPUTE_NOT_FOUND');

    // T4 — admin/support também bloqueados (sem atalho por kind).
    const rAdmin = await callReversal('admin');
    const rSupport = await callReversal('support');
    record('T4 actor.kind=admin e support no body também → 403 DISPUTE_REVERSAL_HTTP_DISABLED',
      rAdmin.statusCode === 403 && JSON.parse(rAdmin.body).code === 'DISPUTE_REVERSAL_HTTP_DISABLED' &&
      rSupport.statusCode === 403 && JSON.parse(rSupport.body).code === 'DISPUTE_REVERSAL_HTTP_DISABLED');

    // T3 — zero nova linha em reversals/bank_transactions/bank_ledger.
    const bankAfter = await count(
      `SELECT ((SELECT count(*) FROM reversals)+(SELECT count(*) FROM bank_transactions)+(SELECT count(*) FROM bank_ledger))::text n`);
    record('T3 zero nova linha em reversals/bank_transactions/bank_ledger (motor financeiro não tocado)',
      bankAfter === bankBefore, `${bankBefore}→${bankAfter}`);

    // Estrutural: o gate precede parseActor/executeDisputeFinancialReversal no handler.
    const routes = readFileSync(join(REPO, 'backend/src/modules/reconciliation/reconciliation-dispute.routes.ts'), 'utf8');
    // O handler de /reversal é o ÚLTIMO da rota → bloco = do route literal ao fim do arquivo.
    const reversalBlock = routes.slice(routes.indexOf("'/disputes/:id/reversal'"));
    const gateOk = /return reply\.status\(403\)\.send\(\{[\s\S]{0,200}?DISPUTE_REVERSAL_HTTP_DISABLED/.test(reversalBlock);
    // Dead code REMOVIDO: o handler reduzido NÃO contém chamada real de parseActor nem do engine
    // (só menções em COMENTÁRIO são permitidas — provam o histórico, não um caminho).
    const codeOnly = reversalBlock.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    record('S1 handler /reversal reduzido ao gate 403; SEM caminho (alcançável ou morto) chamando parseActor/engine',
      gateOk &&
      !/actor = parseActor\(/.test(codeOnly) &&
      !/reconciliationDisputeService\.executeDisputeFinancialReversal\(/.test(codeOnly),
      `gateOk=${gateOk}`);
    record('S2 contenção só no edge HTTP: serviço executeDisputeFinancialReversal ainda existe no service (motor intacto)',
      readFileSync(join(REPO, 'backend/src/modules/reconciliation/reconciliation-dispute.service.ts'), 'utf8').includes('executeDisputeFinancialReversal'));
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
  console.log('✨ Rota HTTP de dispute reversal contida fail-closed; motor financeiro intacto — verde.');
  process.exit(0);
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
