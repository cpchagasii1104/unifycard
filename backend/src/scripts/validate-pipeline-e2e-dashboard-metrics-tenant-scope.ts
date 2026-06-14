/**
 * E2E — B4f (F-DASHBOARD-METRICS-TENANT-SCOPE / DECISION-0131). NÃO MOVE DINHEIRO.
 *
 * Prova que as métricas de dashboard são ESCOPADAS POR TENANT: o tenant A NÃO enxerga os dados do
 * tenant B (antes, as queries sem `tenant_id` retornavam agregados platform-wide = vazamento cross-tenant).
 *
 *   T1 getTodayMetrics(A).activeOrganizers conta SÓ os organizers de A (não A+B).
 *   T2 getTodayMetrics(A).totalEvents conta SÓ os events de A (não A+B).
 *   T3 getTodayMetrics(B) conta SÓ os de B (simétrico).
 *   T4 guard dashboard-metrics-tenant-scope verde.
 *
 * 🔒 DB EFÊMERA (wrapper run-dashboard-metrics-tenant-scope-ephemeral.ps1).
 */
import 'tsconfig-paths/register';
import dotenv from 'dotenv';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
dotenv.config({ path: join(process.cwd(), '.env') });
import { pool } from '../core/database/pool';

const EXPECTED = process.env.EXPECTED_DATABASE_NAME || '';
type Res = { label: string; ok: boolean; reason?: string };
const results: Res[] = [];
const record = (l: string, ok: boolean, r?: string): void => { results.push({ label: l, ok, reason: r }); console.log(`  ${ok ? '✅' : '❌'} ${l}${ok ? '' : ` — ${r ?? ''}`}`); };
const q = (sql: string, p: unknown[] = []) => pool.query(sql, p);
const cwd = process.cwd();

async function assertEphemeral(): Promise<void> {
  const db = (await pool.query<{ db: string }>('SELECT current_database() AS db')).rows[0]?.db;
  if (db === 'unificard_dev') throw new Error('ABORT: alvo é unificard_dev.');
  if (!EXPECTED || db !== EXPECTED) throw new Error(`ABORT: "${db}" ≠ EXPECTED "${EXPECTED}".`);
  if (!/metric|dashboard|tenant|test|ephemeral/i.test(db)) throw new Error(`ABORT: "${db}" não parece efêmero.`);
  console.log(`🔒 DB efêmera confirmada: ${db}`);
}

let seq = 0;
async function mkTenant(slug: string, organizers: number, events: number): Promise<string> {
  const t = uuidv4();
  await q(`INSERT INTO tenants (id, name, slug) VALUES ($1,$2,$3)`, [t, slug, slug]);
  // cadeia de identidade (chk_actor_requires_identity exige identity p/ actor 'user').
  const gid = uuidv4(); const uid = uuidv4(); seq += 1; const cpf = String(10000000000 + seq * 911 + Math.floor(Math.random() * 100));
  await q(`INSERT INTO global_users (global_user_id, cpf) VALUES ($1,$2)`, [gid, cpf]);
  await q(`INSERT INTO identities (global_user_id, tax_id, tax_id_type, kyc_status, kyc_level) VALUES ($1,$2,'cpf','approved','complete')`, [gid, cpf]);
  await q(`INSERT INTO users (id, user_id, tenant_id, email, password_hash, global_user_id) VALUES ($1,$1,$2,$3,'x',$4)`, [uid, t, `m-${uid.slice(0, 8)}@e2e.local`, gid]);
  const actorId = uuidv4();
  await q(`INSERT INTO actors (id, actor_id, tenant_id, actor_type, display_name, user_id, global_user_id) VALUES ($1,$1,$2,'user','E2E Metrics',$3,$4)`, [actorId, t, uid, gid]);
  for (let i = 0; i < organizers; i++) await q(`INSERT INTO event_organizers (tenant_id, name) VALUES ($1,$2)`, [t, `org-${slug}-${i}`]);
  for (let i = 0; i < events; i++) await q(`INSERT INTO events (tenant_id, actor_id, actor_type, event_type, title) VALUES ($1,$2,'user','general',$3)`, [t, actorId, `evt-${slug}-${i}`]);
  return t;
}

async function main(): Promise<void> {
  await assertEphemeral();
  const { dailyMetricsService } = await import('../core/dashboard/daily-metrics.service');
  const A = await mkTenant(`e2e-m-a-${uuidv4().slice(0, 6)}`, 2, 2);
  const B = await mkTenant(`e2e-m-b-${uuidv4().slice(0, 6)}`, 3, 3);

  try {
    const mA = await dailyMetricsService.getTodayMetrics(A);
    const mB = await dailyMetricsService.getTodayMetrics(B);
    record('T1 activeOrganizers de A = 2 (não 5 = A+B)', mA.business.activeOrganizers === 2, `got=${mA.business.activeOrganizers}`);
    record('T2 totalEvents de A = 2 (não 5 = A+B)', mA.business.totalEvents === 2, `got=${mA.business.totalEvents}`);
    record('T3 B simétrico: organizers=3, events=3', mB.business.activeOrganizers === 3 && mB.business.totalEvents === 3, `org=${mB.business.activeOrganizers} evt=${mB.business.totalEvents}`);
    let guard = false; try { execSync('node scripts/audit-dashboard-metrics-tenant-scope.mjs', { cwd, encoding: 'utf8' }); guard = true; } catch { guard = false; }
    record('T4 guard dashboard-metrics-tenant-scope verde', guard);
  } finally {
    await pool.end();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`RESULTADO: ${results.length - failed.length}/${results.length} verdes`);
  if (failed.length > 0) { failed.forEach((f) => console.log(`  ❌ ${f.label} — ${f.reason ?? ''}`)); process.exit(1); }
  console.log('✨ Métricas escopadas por tenant — A não enxerga B; sem vazamento cross-tenant.');
  process.exit(0);
}

main().catch(async (e) => { console.error('💥 Erro não tratado:', e); try { await pool.end(); } catch { /* noop */ } process.exit(1); });
