/**
 * E2E F-TRUST-ADMIN-GATE-INTERIM (DECISION-0113 — gate-admin interino do módulo trust)
 *
 * Trust (risco/anti-fraude/compliance) estava 100% NU (só `req.tenant`), READS E WRITES → qualquer caller
 * lia o mapa de risco do tenant E injetava/recalculava sinais de fraude. Compliance opera CROSS-ACTOR por
 * design → `canRepresentActor` seria ERRADO. Gate interino = `requireRole(['admin'])` (mecanismo canônico da
 * fatia 1; bloqueia 401/403). Modelo fino de compliance/risk = R2.4 (sem permission nova aqui).
 *
 * Prova:
 *   ESTRUTURAL — as 6 rotas (3 reads + 3 writes) têm `preHandler: adminOnly` = `requireRole(['admin'])`,
 *     definido 1x; ZERO `canRepresentActor` (compliance não é representabilidade); ZERO permission nova.
 *   BEHAVIORAL do mecanismo: `requireRole`/`assertActorRepresentable` é coberto pela regressão
 *     `rbac-actor-binding` (13/13). O admin-pass/non-admin-403 ponta-a-ponta via HTTP é **N/A** aqui
 *     (exige fastify.inject + actionContext + fixture admin) — reportado, não vendido como behavioral total.
 *
 * Modo: npx tsx backend/src/scripts/validate-pipeline-e2e-trust-admin-gate-interim.ts
 */

import dotenv from 'dotenv';
import { join } from 'path';
import { readFileSync } from 'fs';

import { pool } from '../core/database/pool';

dotenv.config({ path: join(process.cwd(), '.env') });

const TENANT_ID = process.env.E2E_TENANT_ID || 'fbe13b78-4516-493d-905a-363796aea1d1';

type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
function record(label: string, ok: boolean, reason?: string): void {
  results.push({ label, ok, reason });
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — ${reason ?? ''}`}`);
}
function note(msg: string): void { console.log(`  ℹ️  ${msg}`); }

async function main(): Promise<void> {
  const src = readFileSync(join(process.cwd(), 'src/modules/trust/trust.routes.ts'), 'utf8');

  console.log('\n— ESTRUTURAL: gate-admin interino nas 6 rotas trust —');
  record('A1 adminOnly definido via requireRole([\'admin\']) (mecanismo canônico, sem permission nova)',
    /const adminOnly = .*requireRole\(\['admin'\]\)/.test(src));
  const gateCount = (src.match(/preHandler: adminOnly/g) || []).length;
  record('A2 as 6 rotas trust têm preHandler: adminOnly (3 reads + 3 writes)', gateCount === 6, `encontrados=${gateCount}`);
  // cada rota nomeada está gateada (o preHandler é o 2º arg, ANTES do handler async → roda antes do service)
  for (const route of [
    "'/trust/profile/:actorId', { preHandler: adminOnly",
    "'/trust/profiles', { preHandler: adminOnly",
    "'/trust/events', { preHandler: adminOnly",
    "'/trust/can-proceed', { preHandler: adminOnly",
    "'/trust/recalculate/:actorId', { preHandler: adminOnly",
  ]) {
    record(`A3 rota gateada: ${route.split("'")[1]}`, src.includes(route));
  }
  // POST /trust/events também (mesmo path do GET; confirma os DOIS via contagem + body type)
  record('A4 POST /trust/events (write) gateado',
    /RegisterTrustEventInput }>\('\/trust\/events', \{ preHandler: adminOnly/.test(src));

  console.log('\n— DISCIPLINA: compliance NÃO é representabilidade; sem vocabulário novo —');
  record('B1 ZERO chamada canRepresentActor( no trust (compliance é cross-actor; só o comentário explica por que NÃO usar)',
    !/canRepresentActor\(/.test(src));
  record('B2 ZERO permission nova (trust:/risk:/compliance:) — usa requireRole admin existente',
    !/'(trust|risk|compliance):/.test(src) && !/requirePermission\(\['(trust|risk|compliance)/.test(src));
  record('B3 marcado INTERINO (modelo fino fica para R2.4)',
    /INTERINO/.test(src) && /R2\.4/.test(src));

  console.log('\n— BEHAVIORAL do mecanismo —');
  const adminRole = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM roles r JOIN user_roles ur ON r.role_id=ur.role_id WHERE ur.tenant_id=$1 AND r.name='admin'`,
    [TENANT_ID]
  );
  record('C1 existe role admin no tenant (requireRole([\'admin\']) tem alvo real)', Number(adminRole.rows[0].n) >= 1);
  note('admin-pass / non-admin→403 ponta-a-ponta via HTTP = N/A aqui (exige fastify.inject + actionContext + fixture).');
  note('O mecanismo requireRole/assertActorRepresentable é coberto pela regressão rbac-actor-binding (13/13), rodada à parte.');

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) {
    console.log('FALHAS:');
    failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`));
    await pool.end();
    process.exit(1);
  }
  await pool.end();
  console.log('✨ Trust admin gate interino (6 rotas requireRole admin; sem canRepresentActor; sem permission nova) — verde.');
}

main().catch(async (e) => {
  console.error('💥 Erro não tratado:', e);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
